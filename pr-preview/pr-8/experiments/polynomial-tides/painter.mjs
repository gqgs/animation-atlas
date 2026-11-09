// Direct orbit geometry plus time-dependent display-only illumination.
// A painter owns its caches and may be reused for deterministic frame exports.
const TAU=2*Math.PI;
const themes={
  porcelain:{bg:'#f8f8fc',shade:'#e4e3f2',web:['#5044a6','#8c4db9','#dc6669','#ef9854','#375dba','#b24e92'],
    filament:['#4445d7','#954bd1','#ed674b','#d98f28','#2b90bf','#d43d81'],glow:0.35},
  nocturne:{bg:'#080a19',shade:'#18152e',web:['#6d64f0','#d668bd','#ff935a','#bd6ffd','#4fc3e6','#f1ad6d'],
    filament:['#a89bff','#f789cf','#ffae75','#b69cff','#81e5ef','#ffe0a1'],glow:0.7},
  ember:{bg:'#0c1018',shade:'#1f1820',web:['#50a5af','#e47e68','#faaf64','#bc80a6','#74a6a7','#f0c07e'],
    filament:['#6ce1d5','#ff9880','#ffe0a0','#dba5bf','#9fe9cf','#f5bb7e'],glow:0.7},
};
function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
export function makePainter(orbit,settings){
  const theme=themes[settings.palette]||themes.porcelain;
  const {points,count,bounds}=orbit;
  let cache=null,cacheW=0,cacheH=0;
  function geometry(w,h){
    const span=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY,1e-9);
    const scale=.82*Math.min(w,h)/span*settings.zoom;
    const cx=w/2-(bounds.minX+bounds.maxX)*.5*scale;
    const cy=h/2+(bounds.minY+bounds.maxY)*.5*scale;
    return {scale,cx,cy,px(i){return cx+points[i*2]*scale;},
      py(i){return cy-points[i*2+1]*scale;}};
  }
  function initBase(w,h){
    const layer=document.createElement('canvas');layer.width=w;layer.height=h;
    const g=layer.getContext('2d',{alpha:true}),tr=geometry(w,h);
    g.lineWidth=Math.max(.25,settings.width*Math.min(w,h)/1080*.5);
    g.lineCap='round';
    // Draw thin connected orbit segments, grouped by position along the
    // trajectory; the map, not an interpolated spline, defines every segment.
    for(let band=0;band<6;band++){
      g.beginPath();
      for(let i=1;i<count;i++){
        if(Math.floor(i/113)%6!==band)continue;
        g.moveTo(tr.px(i-1),tr.py(i-1));
        g.lineTo(tr.px(i),tr.py(i));
      }
      g.strokeStyle=theme.web[band];
      g.globalAlpha=settings.palette==='porcelain'?.095:.115;
      g.stroke();
    }
    // Sparse points preserve the attractor's true phase portrait, including
    // distant orbit jumps that should not be smoothed away.
    g.globalAlpha=settings.palette==='porcelain'?.23:.28;
    for(let i=0;i<count;i+=17){
      g.fillStyle=theme.web[Math.floor(i/113)%6];
      g.fillRect(tr.px(i),tr.py(i),Math.max(.35,w/1800),Math.max(.35,h/1800));
    }
    g.globalAlpha=1;
    return layer;
  }
  function project(tr,i,phase){
    const x=points[i*2],y=points[i*2+1];
    const d=settings.drift;
    if(d===0)return [tr.cx+x*tr.scale,tr.cy-y*tr.scale];
    const angle=phase*TAU;
    // Closed, coordinate-only warp. Never feed these positions into the map.
    const dx=d*.075*(Math.sin(3.2*y+angle)*Math.cos(1.7*x-angle)+Math.sin(4*y-angle)*.35);
    const dy=d*.075*(Math.cos(2.8*x-angle)*Math.sin(2*y+angle)+Math.cos(3*x+angle)*.3);
    return [tr.cx+(x+dx)*tr.scale,tr.cy-(y+dy)*tr.scale];
  }
  function flow(ctx,tr,phase,offset,opacity){
    if(opacity<=0)return;
    const strands=settings.strands,trail=settings.trail;
    const scale=Math.min(ctx.canvas.width,ctx.canvas.height)/1080;
    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.globalCompositeOperation=settings.palette==='porcelain'?'source-over':'screen';
    const shift=Math.floor(offset*(count-trail-1));
    for(let s=0;s<strands;s++){
      const start=(Math.floor((s+.22)/strands*(count-trail-1))+shift)%(count-trail-1);
      const color=theme.filament[s%6];
      // Soft colored filament, retaining actual consecutive iteration edges.
      ctx.beginPath();
      for(let j=0;j<trail;j++){
        const [x,y]=project(tr,start+j,phase);
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.globalAlpha=opacity*(settings.palette==='porcelain'?.13:.22);
      ctx.strokeStyle=color;ctx.lineWidth=Math.max(.5,2.8*scale*settings.width);
      ctx.shadowBlur=settings.palette==='porcelain'?2*scale:10*scale;
      ctx.shadowColor=color;ctx.stroke();
      ctx.shadowBlur=0;
      ctx.globalAlpha=opacity*(settings.palette==='porcelain'?.70:.84);
      ctx.lineWidth=Math.max(.35,settings.width*.95*scale);ctx.stroke();
      // Brighter fronts move around the ribbon, making the map's iteration
      // order visible instead of rotating a static image.
      const front=Math.floor((.5+.5*Math.sin(TAU*(phase*2+s*.618)))*(trail-66));
      ctx.beginPath();
      for(let j=front;j<front+66;j++){
        const [x,y]=project(tr,start+j,phase);
        if(j===front)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.globalAlpha=opacity*.9;ctx.lineWidth=Math.max(.55,settings.width*1.65*scale);
      ctx.strokeStyle=color;ctx.shadowColor=color;
      ctx.shadowBlur=settings.palette==='porcelain'?5*scale:17*scale;ctx.stroke();
      ctx.shadowBlur=0;
    }
    ctx.restore();
  }
  return function draw(canvas,phase){
    const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Canvas 2D unavailable');
    if(!cache||cacheW!==w||cacheH!==h){cache=initBase(w,h);cacheW=w;cacheH=h;}
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=theme.bg;ctx.fillRect(0,0,w,h);
    // Extremely subtle vignette avoids competing with the mathematical form.
    const grd=ctx.createRadialGradient(w*.5,h*.52,0,w*.5,h*.52,Math.max(w,h)*.72);
    grd.addColorStop(0,'#ffffff00');grd.addColorStop(1,theme.shade);
    ctx.globalAlpha=settings.palette==='porcelain'?.19:.30;
    ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
    ctx.drawImage(cache,0,0);
    const tr=geometry(w,h);
    // Crossfade the last part of an otherwise nonperiodic trajectory window
    // back to the first part, giving exact visual continuity at loop wrap.
    const f=smoothstep(.76,1,phase);
    flow(ctx,tr,phase,phase,1-f);
    if(f>0)flow(ctx,tr,phase,0,f);
  };
}
