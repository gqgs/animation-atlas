// The underlying quadratic orbit is immutable. All motion is a periodic,
// display-only transformation of cached orbit filaments.
//
// Attractor geometry and expensive glow strokes are rasterized ONCE per
// output size or settings change. Each animation frame composites four layers.
const TAU=2*Math.PI;
const GROUPS=4;

const themes={
  porcelain:{
    bg:'#f8f8fc',shade:'#e4e3f2',
    web:['#5044a6','#8c4db9','#dc6669','#ef9854','#375dba','#b24e92'],
    filament:['#4445d7','#954bd1','#ed674b','#d98f28','#2b90bf','#d43d81']
  },
  nocturne:{
    bg:'#080a19',shade:'#18152e',
    web:['#6d64f0','#d668bd','#ff935a','#bd6ffd','#4fc3e6','#f1ad6d'],
    filament:['#a89bff','#f789cf','#ffae75','#b69cff','#81e5ef','#ffe0a1']
  },
  ember:{
    bg:'#0c1018',shade:'#1f1820',
    web:['#50a5af','#e47e68','#faaf64','#bc80a6','#74a6a7','#f0c07e'],
    filament:['#6ce1d5','#ff9880','#ffe0a0','#dba5bf','#9fe9cf','#f5bb7e']
  }
};

export function layerMotion(phase,layer,drift){
  // Integer frequency harmonics make the whole animation C-infinity periodic:
  // in particular the last export frame approaches the first continuously.
  const angle=TAU*phase,offset=TAU*layer/GROUPS;
  return {
    x:drift*(Math.sin(angle+offset)+.32*Math.sin(2*angle-offset)),
    y:drift*(Math.cos(angle+offset)+.26*Math.cos(3*angle+offset)),
    angle:.014*drift*Math.sin(angle+offset),
    scale:1+.003*drift*Math.cos(angle+offset),
    opacity:.30+.70*(.5+.5*Math.sin(angle+offset))
  };
}

export function filamentWindow(count,strands,trail,index){
  const length=Math.min(trail,count-1);
  const available=Math.max(1,count-length-1);
  return {start:Math.floor((index+.22)/strands*available),length};
}

function layer(w,h){
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  return canvas;
}

export function makePainter(orbit,settings){
  const theme=themes[settings.palette]||themes.porcelain;
  const {points,count,bounds}=orbit;
  // Copy the settings so the renderer remains stable during a deterministic
  // export, even if the interactive UI changes.
  const scene={...settings};
  let cache=null,cacheW=0,cacheH=0;

  function geometry(w,h){
    const span=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY,1e-9);
    const scale=.82*Math.min(w,h)/span*scene.zoom;
    return {
      scale,
      cx:w/2-(bounds.minX+bounds.maxX)*.5*scale,
      cy:h/2+(bounds.minY+bounds.maxY)*.5*scale
    };
  }

  function initBase(w,h,tr){
    const canvas=layer(w,h);
    const g=canvas.getContext('2d',{alpha:false});
    if(!g)throw new Error('Could not initialize the attractor background');
    g.fillStyle=theme.bg;g.fillRect(0,0,w,h);
    const grd=g.createRadialGradient(w*.5,h*.52,0,w*.5,h*.52,Math.max(w,h)*.72);
    grd.addColorStop(0,'#ffffff00');
    grd.addColorStop(1,theme.shade);
    g.globalAlpha=scene.palette==='porcelain'?.19:.30;
    g.fillStyle=grd;g.fillRect(0,0,w,h);
    g.globalAlpha=1;
    g.lineWidth=Math.max(.25,scene.width*Math.min(w,h)/1080*.5);
    g.lineCap='round';

    // Full underlying orbit portrait, with controllable density so dense
    // attractors do not conceal the moving highlights. Deterministic thinning.
    const density=scene.density??.55;
    for(let band=0;band<6;band++){
      g.beginPath();
      for(let i=1;i<count;i++){
        if(Math.floor(i/113)%6!==band)continue;
        if(((i*73856093)>>>0)/4294967296>=density)continue;
        g.moveTo(tr.cx+points[(i-1)*2]*tr.scale,tr.cy-points[(i-1)*2+1]*tr.scale);
        g.lineTo(tr.cx+points[i*2]*tr.scale,tr.cy-points[i*2+1]*tr.scale);
      }
      g.strokeStyle=theme.web[band];
      g.globalAlpha=scene.palette==='porcelain'?.12:.13;
      g.stroke();
    }

    // Fixed points emphasize the invariant measure without implying
    // interpolation between successive chaotic samples.
    g.globalAlpha=scene.palette==='porcelain'?.24:.30;
    for(let i=0;i<count;i+=17){
      g.fillStyle=theme.web[Math.floor(i/113)%6];
      g.fillRect(tr.cx+points[i*2]*tr.scale,tr.cy-points[i*2+1]*tr.scale,
        Math.max(.35,w/1800),Math.max(.35,h/1800));
    }
    g.globalAlpha=1;
    return canvas;
  }

  function initFilaments(w,h,tr){
    const layers=Array.from({length:GROUPS},()=>layer(w,h));
    const contexts=layers.map(c=>c.getContext('2d',{alpha:true}));
    if(contexts.some(g=>!g))throw new Error('Could not initialize filament layers');
    const px=Math.min(w,h)/1080;
    const strands=scene.strands,trail=scene.trail;
    const white=scene.palette==='porcelain';

    for(let s=0;s<strands;s++){
      const g=contexts[s%GROUPS],color=theme.filament[s%theme.filament.length];
      const {start,length}=filamentWindow(count,strands,trail,s);
      g.save();g.lineJoin='round';g.lineCap='round';
      g.beginPath();
      for(let j=0;j<length;j++){
        const i=start+j,x=tr.cx+points[2*i]*tr.scale,y=tr.cy-points[2*i+1]*tr.scale;
        if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
      }

      // Expensive strokes and shadows are done only when the cache is built.
      g.globalAlpha=white?.17:.24;
      g.strokeStyle=color;
      g.lineWidth=Math.max(.5,scene.width*2.8*px);
      g.shadowColor=color;g.shadowBlur=(white?2:10)*px;
      g.stroke();
      g.shadowBlur=0;g.globalAlpha=white?.76:.90;
      g.lineWidth=Math.max(.35,scene.width*.95*px);
      g.stroke();

      // An anchored accent segment (not a jumping "head") makes the four
      // cached bands shimmer via continuous per-band illumination.
      const highlight=Math.min(66,length);
      const range=Math.max(0,length-highlight);
      const front=Math.floor(range*((s*.61803398875)%1));
      g.beginPath();
      for(let j=front;j<front+highlight;j++){
        const i=start+j,x=tr.cx+points[2*i]*tr.scale,y=tr.cy-points[2*i+1]*tr.scale;
        if(j===front)g.moveTo(x,y);else g.lineTo(x,y);
      }
      g.globalAlpha=white?.58:.75;
      g.strokeStyle=color;g.lineWidth=Math.max(.55,scene.width*1.4*px);
      g.shadowColor=color;g.shadowBlur=(white?4:12)*px;
      g.stroke();g.restore();
    }
    return layers;
  }

  function initialize(w,h){
    const tr=geometry(w,h);
    return {background:initBase(w,h,tr),filaments:initFilaments(w,h,tr)};
  }

  return function draw(canvas,phase){
    const w=canvas.width,h=canvas.height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Canvas 2D unavailable');
    if(!cache||cacheW!==w||cacheH!==h){
      cache=initialize(w,h);cacheW=w;cacheH=h;
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.drawImage(cache.background,0,0);

    // Four inexpensive image composites per frame, regardless of filament
    // count or trail length. No per-frame orbit iteration or path rebuilding.
    const span=Math.min(w,h);
    ctx.globalCompositeOperation=scene.palette==='porcelain'?'source-over':'screen';
    for(let i=0;i<GROUPS;i++){
      const motion=layerMotion(phase,i,scene.drift);
      ctx.save();
      ctx.translate(w/2+motion.x*.008*span,h/2+motion.y*.008*span);
      ctx.rotate(motion.angle);
      ctx.scale(motion.scale,motion.scale);
      ctx.translate(-w/2,-h/2);
      ctx.globalAlpha=motion.opacity;
      ctx.drawImage(cache.filaments[i],0,0);
      ctx.restore();
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  };
}
