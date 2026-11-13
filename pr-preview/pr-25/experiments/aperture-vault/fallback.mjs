import {TAU, BASE_Y, BASE_RADIUS, SOURCE, add, sub, mul, dot, tracePrism} from './core.mjs';

const rad=Math.PI/180;
export const CAMERA_TARGET=[.90,.63,0];
export function cameraPose(p){
  const a=(80+p.rotation)*rad,e=p.elevation*rad,r=11.9;
  const toward=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
  return {position:add(CAMERA_TARGET,mul(toward,r)),toward,r,a,e};
}

export function projector(p,w,h){
  const {toward,r,a,e}=cameraPose(p);
  const right=[Math.cos(a),0,-Math.sin(a)];
  const up=[-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e)];
  const focal=Math.min(w,h)*p.zoom/(2*Math.tan(16*rad));
  return q=>{
    const v=sub(q,CAMERA_TARGET),d=dot(v,toward),f=focal/Math.max(.6,r-d);
    return [w/2+dot(v,right)*f,h/2-dot(v,up)*f,d];
  };
}

export function polygon(ctx,points,fill,stroke,width=1){
  if(!points.length) return;
  ctx.beginPath();
  for(const [i,[x,y]] of points.entries()) i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
const loop=(r,y=0,n=6)=>Array.from({length:n},(_,i)=>[r*Math.cos(i*TAU/n),y,r*Math.sin(i*TAU/n)]);
const depth=points=>points.reduce((s,q)=>s+q[2],0)/points.length;
const line=(ctx,a,b,color,width)=>{
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
};
function glow(ctx,p,r,color,opacity){
  const [x,y]=p;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();
}

// The same computed rays go on both renderers. Soft colored strokes and floor
// patches visualize thin scattering/diffusion, not additional refraction.
export function drawOptics(ctx,p,frame,project,scale){
  const optics=frame.optics;
  const offsets=frame.samples;
  const from=project(SOURCE),to=project(optics.whiteEnd);
  const hits=offsets.filter(x=>x.entry).length;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';
  // Finite input beam: all sample rays must actually intersect the moving glass.
  for(const sample of offsets){
    const a=project(sample.origin),b=project(sample.whiteEnd);
    ctx.globalAlpha=.12;
    line(ctx,a,b,'#c1d8ff',7.5*scale);
    ctx.globalAlpha=.3;
    line(ctx,a,b,'#fff4e1',1.7*scale);
  }
  ctx.globalAlpha=1;
  if(optics.entry){
    glow(ctx,to,22*scale,'#e7f4ff',.50);
    line(ctx,from,to,'rgba(255,251,228,.92)',1.7*scale);
  }else if(hits<offsets.length){
    glow(ctx,to,23*scale,'#b6c8ff',.30);
  }
  // The central rays set the full fan when the finite beam is centered. If the
  // central ray misses but an edge still intercepts, draw that edge at lower power.
  const visible=optics.rays.length?optics:offsets.find(x=>x.rays.length);
  if(visible){
    const power=Math.max(.15,hits/offsets.length), rays=visible.rays.map(r=>({
      ...r, a:project(r.exit.point), b:project(r.floor),
    }));
    for(let i=0;i<rays.length-1;i++){
      const {a,b,color}=rays[i],next=rays[i+1];
      ctx.globalAlpha=.095*power;
      polygon(ctx,[a,b,next.b,next.a],color);
    }
    for(const {a,b,color,exit,floor} of rays){
      ctx.globalAlpha=.18*power;
      line(ctx,a,b,color,12*scale);
      ctx.globalAlpha=.75*power;
      line(ctx,a,b,color,2*scale);
      ctx.globalAlpha=1;
      glow(ctx,b,14*scale,color,.38*power);
      // Keep the bright near-ground trace aligned to the actual outgoing ray.
      const tip=project(add(mul(exit.point,.045),mul(floor,.955)));
      line(ctx,tip,b,color,2.8*scale);
    }
  }
  ctx.globalAlpha=1;
  glow(ctx,from,46*scale,'#7b99ff',.33);
  glow(ctx,from,18*scale,'#fff1d4',.53);
  ctx.restore();
}

export function drawFallback(canvas,p,frame){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const project=projector(p,w,h),scale=Math.min(w,h)/850;
  const bg=ctx.createRadialGradient(w*.48,h*.52,0,w*.48,h*.52,Math.max(w,h)*.65);
  bg.addColorStop(0,'#202b47');bg.addColorStop(.6,'#101a2e');bg.addColorStop(1,'#080d19');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(const [i,r] of [1.8,2.02,2.8,3.44,4.1,4.2,5.02,6.12].entries()){
    polygon(ctx,loop(r,0,96).map(project),null,i%3===0?'#57627a75':'#586e9140',scale);
  }
  for(let i=0;i<60;i++){
    const a=i*TAU/60, r=i%5===0?4.50:4.39;
    line(ctx,project([4.26*Math.cos(a),0,4.26*Math.sin(a)]),project([r*Math.cos(a),0,r*Math.sin(a)]),'#64729383',scale);
  }
  for(const [radius,y,fill,stroke] of [
    [1.62,.035,'#0a1121','#354363'],[1.60,.13,'#1d2b45','#455475'],
    [1.54,.23,'#202a43','#778ca7'],[BASE_RADIUS,BASE_Y,'#263553','#829fba'],
  ]) polygon(ctx,loop(radius,y).map(project),fill,stroke,1.2*scale);

  const camera=project(SOURCE);
  const faces=frame.faces.map(v=>v.map(project));
  const glass=(points,i)=>{
    const gradient=ctx.createLinearGradient(points[0][0],points[0][1],points[2][0],points[2][1]);
    gradient.addColorStop(0,'rgba(87,152,200,.08)');
    gradient.addColorStop(.48,'rgba(133,194,231,.035)');
    gradient.addColorStop(1,'rgba(134,172,245,.18)');
    polygon(ctx,points,gradient,i===0?'#c9e3fcbd':'#7593c895',1.25*scale);
  };
  const farFaces=faces.map((points,i)=>({points,i,d:depth(points)})).sort((a,b)=>a.d-b.d);
  for(const {points,i,d} of farFaces) if(d<camera[2])glass(points,i);
  for(const [r,y,fill,stroke] of [[.33,.40,'#6d7482','#c7cde1'],[.21,.61,'#2e3a58','#889ab1']]){
    polygon(ctx,loop(r,y,16).map(project),fill,stroke,scale);
  }
  const core=loop(.16,SOURCE[1],8).map(project);
  polygon(ctx,core,'#fff4e0','#f4ddbd',scale);
  for(const {points,i,d} of farFaces) if(d>=camera[2])glass(points,i);
  const wedge=frame.optics.prism.polygons.map(q=>q.map(project)).sort((a,b)=>depth(a)-depth(b));
  for(const [i,q] of wedge.entries()) polygon(ctx,q,i%2?'#799ac244':'#8eb5ed66','#c8e4fa91',scale);
  drawOptics(ctx,p,frame,project,scale);
}

export const opticalFrame=p=>{
  const optics=tracePrism(p.opening,p.lighting);
  return {optics,samples:[tracePrism(p.opening,p.lighting,-.024),optics,tracePrism(p.opening,p.lighting,.024)]};
};
