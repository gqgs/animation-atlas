import {rotationSequence} from '../../shared/rotation-sequence.mjs';
export const defaults = {steps:360, filaments:48, spread:1.2, width:2.4, duration:48, zoom:1, palette:'iridescent', mode:'silk'};
export function angleAt(phase) {
  // Cosine return gives exact endpoints and zero velocity at square and line.
  const t=(1-Math.cos(2*Math.PI*phase))/2;
  return 90*Math.expm1(3.2*(1-t))/Math.expm1(3.2);
}
export function turtle(angle, steps=101, directions=new Float64Array(steps*2)) {
  rotationSequence(steps,angle*Math.PI/180,angle*Math.PI/180,directions);
  const points=[[0,0]];let x=0,y=0;
  for(let k=0;k<steps;k++) {x+=k/(steps-1)*directions[2*k];y+=k/(steps-1)*directions[2*k+1];points.push([x,y]);}
  return points;
}
export function makeField(angle,p) {
  const count=p.mode==='original'?1:p.filaments;
  // Reuse one direction buffer across filaments; returned paths own their points.
  const directions=new Float64Array(p.steps*2);
  return Array.from({length:count},(_,j)=>{
    const u=count===1?0:j/(count-1)-.5;
    return turtle(angle+u*p.spread*Math.sin(Math.PI*angle/90),p.steps,directions);
  });
}
export function bounds(paths) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const path of paths) for(const [x,y] of path){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,size:Math.max(maxX-minX,maxY-minY,1e-8)};
}
export function colorAt(t,j,p) {
  const hue=p.palette==='lagoon'?165+105*t+20*Math.sin(j*2.4):360*(t*3+j/p.filaments*.42);
  const light=p.palette==='neon'?54:57+24*Math.sin(j*.17+t*12)**2;
  return `hsl(${hue} 95% ${light}%)`;
}
