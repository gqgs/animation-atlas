import {facesAt,poseAt} from './core.mjs';
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export function draw(canvas,settings,tracks,phase){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=Math.min(w,h);
 const p=poseAt(settings,tracks,phase),yaw=p.rotation*Math.PI/180+.3,e=p.elevation*Math.PI/180;
 const transform=v=>{const x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw),z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw),y=v[1]-.5;return [x,y*Math.cos(e)-z*Math.sin(e),y*Math.sin(e)+z*Math.cos(e)];};
 const project=v=>{const q=transform(v),k=s*.15*p.zoom*9/(9-q[2]);return [w*.5+q[0]*k,h*.51-q[1]*k];};
 ctx.fillStyle='#080e19';ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,s*.65);glow.addColorStop(0,'#21383b');glow.addColorStop(1,'#080e19');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 // Quiet concentric construction marks, not a simulated physical shadow.
 ctx.strokeStyle='#91c6ba12';ctx.lineWidth=s/1400;
 for(const r of [1.35,2.2,3.3]){
  ctx.beginPath();for(let i=0;i<=120;i++){const t=i/120*2*Math.PI,q=project([r*Math.cos(t),-.02,r*Math.sin(t)]);i?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.stroke();
 }
 const faces=facesAt(p.opening,settings.height);
 faces.sort((a,b)=>a.id===6?-1:b.id===6?1:a.vertices.reduce((n,v)=>n+transform(v)[2],0)/a.vertices.length-b.vertices.reduce((n,v)=>n+transform(v)[2],0)/b.vertices.length);
 const path=vs=>{ctx.beginPath();vs.forEach((v,i)=>i?ctx.lineTo(...project(v)):ctx.moveTo(...project(v)));ctx.closePath();};
 for(const f of faces){
  const vs=f.vertices,center=vs.reduce((a,v)=>a.map((x,i)=>x+v[i]/vs.length),[0,0,0]);
  const a=vs[1].map((x,i)=>x-vs[0][i]),b=vs[2].map((x,i)=>x-vs[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=Math.hypot(...n);
  const light=.45+.55*Math.abs((n[0]*.3+n[1]*.8+n[2]*.5)/norm);
  const colors=f.id%2===0?[82,153,148]:[173,111,99];
  const fill=colors.map(c=>Math.round(c*light));
  path(vs);ctx.fillStyle='rgb('+fill.join(',')+')';ctx.fill();
  // All facets and engravings live on the rigid face, not in world space.
  for(let i=0;i<vs.length;i++){
   path([center,vs[i],vs[(i+1)%vs.length]]);ctx.fillStyle=i%2?'#ffffff0c':'#00000013';ctx.fill();
  }
  path(vs);ctx.strokeStyle='#d0dacf99';ctx.lineWidth=s*.0011;ctx.stroke();
  for(const t of [.15,.3,.5,.72]){
   path(vs.map(v=>mix(center,v,t)));ctx.strokeStyle='#d9eed93b';ctx.lineWidth=s*.0006;ctx.stroke();
  }
  if(f.id!==6){
   const start=mix(vs[0],vs[1],.5),q=project(mix(start,vs[2],.78));
   ctx.beginPath();ctx.arc(...q,s*.0023,0,Math.PI*2);ctx.fillStyle='#f5e8b7';ctx.fill();
  }
 }
}
