import {panelsAt,poseAt} from './core.mjs';
export function draw(canvas,settings,tracks,phase){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=Math.min(w,h),p=poseAt(settings,tracks,phase);
 const yaw=p.rotation*Math.PI/180+.12,e=p.elevation*Math.PI/180;
 const transform=v=>{const x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw),z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);return [x,v[1]*Math.cos(e)-z*Math.sin(e),v[1]*Math.sin(e)+z*Math.cos(e)];};
 const project=v=>{const q=transform(v);return [w/2+q[0]*s*.079*p.zoom,h*.54-q[1]*s*.079*p.zoom];};
 ctx.fillStyle='#080e19';ctx.fillRect(0,0,w,h);const g=ctx.createRadialGradient(w/2,h*.54,0,w/2,h*.54,s*.6);g.addColorStop(0,'#293534');g.addColorStop(1,'#080e19');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 const panels=panelsAt(p.closure,p.cascade);panels.sort((a,b)=>a.vertices.reduce((n,v)=>n+transform(v)[2],0)-b.vertices.reduce((n,v)=>n+transform(v)[2],0));
 const path=vs=>{ctx.beginPath();vs.forEach((v,i)=>i?ctx.lineTo(...project(v)):ctx.moveTo(...project(v)));ctx.closePath();};
 for(const panel of panels){
  const vs=panel.vertices,a=transform(vs[1]).map((v,i)=>v-transform(vs[0])[i]),light=.36+.64*Math.abs(a[0]/Math.hypot(...a));
  const rgb=panel.id%2?[212,155,88]:[91,166,163];
  path(vs);ctx.fillStyle='rgb('+rgb.map(c=>Math.round(c*light)).join(',')+')';ctx.fill();
  // All ornamental facets use this panel's rigid local coordinates.
  for(const [i,poly] of [[[0,-1.2],[.5,0],[0,1.2]],[[1,-1.2],[.5,0],[1,1.2]],[[0,1.2],[.5,0],[.5,1.55]],[[1,1.2],[.5,0],[.5,1.55]]].entries()){
   path(poly.map(panel.transform));ctx.fillStyle=i%2?'#ffffff18':'#00000020';ctx.fill();
  }
  for(const t of [.16,.3,.44]){
   path([[.5,-1.08+t],[1-t,0],[.5,1.28-t],[t,0]].map(panel.transform));ctx.strokeStyle='#e5e3ba75';ctx.lineWidth=s*.0008;ctx.stroke();
  }
  path(vs);ctx.strokeStyle='#e9d9acb0';ctx.lineWidth=s*.0011;ctx.stroke();
  if(panel.id<9){
   ctx.beginPath();ctx.moveTo(...project(panel.right[0]));ctx.lineTo(...project(panel.right[1]));ctx.strokeStyle='#f1d49c';ctx.lineWidth=s*.0025;ctx.stroke();
   for(const y of [-.95,0,.95]){const q=project(panel.transform([1,y]));ctx.beginPath();ctx.arc(...q,s*.003,0,Math.PI*2);ctx.fillStyle='#ffe2a8';ctx.fill();}
  }
 }
}
