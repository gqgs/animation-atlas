import {facesAt,poseAt} from './core.mjs';
export function draw(canvas,settings,tracks,phase){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=Math.min(w,h);
 const p=poseAt(settings,tracks,phase),yaw=p.rotation*Math.PI/180+.16,e=p.elevation*Math.PI/180;
 const transform=v=>{const x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw),z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);return [x,v[1]*Math.cos(e)-z*Math.sin(e),v[1]*Math.sin(e)+z*Math.cos(e)];};
 const project=q=>[w/2+q[0]*s*.112*p.zoom,h*.54-q[1]*s*.112*p.zoom];
 ctx.fillStyle='#080e19';ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,s*.6);glow.addColorStop(0,'#243939');glow.addColorStop(1,'#080e19');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 const faces=facesAt(p,phase).map(f=>({...f,vs:f.vertices.map(transform)}));
 faces.sort((a,b)=>a.vs.reduce((n,v)=>n+v[2],0)-b.vs.reduce((n,v)=>n+v[2],0));
 for(const f of faces){
  const vs=f.vs,a=vs[1].map((v,i)=>v-vs[0][i]),b=vs[2].map((v,i)=>v-vs[0][i]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=Math.hypot(...n)||1;
  const light=.3+.7*Math.abs((n[0]*-.35+n[1]*.65+n[2]*.67)/len);
  const warm=(f.wave+1)/2,colors=[102+110*warm,174+15*warm,174-65*warm];
  ctx.fillStyle='rgb('+colors.map(c=>Math.round(c*light)).join(',')+')';
  ctx.beginPath();vs.forEach((v,i)=>i?ctx.lineTo(...project(v)):ctx.moveTo(...project(v)));ctx.closePath();ctx.fill();
  // Same-color subpixel stroke closes Canvas triangle antialiasing cracks.
  ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=s*.00045;ctx.stroke();
 }
}
