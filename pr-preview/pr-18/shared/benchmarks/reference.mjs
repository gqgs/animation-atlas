// Frozen baseline source: dffcf34ef2c5b4e4995fb6358521f1db6990f5c0 (core modules remain verbatim).
export const sourceCommit = 'dffcf34ef2c5b4e4995fb6358521f1db6990f5c0';
export * as unwinding from './reference-unwinding.mjs';
export * as chamber from './reference-chamber.mjs';
import {bounds,colorAt} from './reference-unwinding.mjs';
import {TAU} from './reference-chamber.mjs';
// Baseline render bodies, parameterized only to accept prepared geometry.
export function paintField(target,paths,scene,{fit=.82}={}) {
 const g=target.getContext('2d',{alpha:false}),w=target.width,h=target.height;
 const bb=bounds(paths);
 g.setTransform(1,0,0,1,0,0);
 g.fillStyle=scene.palette==='neon'?'#080a16':'#f6f2f7';g.fillRect(0,0,w,h);
 const scale=Math.min(w,h)*fit*scene.zoom/bb.size;
 g.setTransform(scale,0,0,scale,w/2-bb.x*scale,h/2-bb.y*scale);
 g.lineCap='round';g.lineJoin='round';
 // Scale strokes with output dimensions rather than preserving viewport pixel sizes.
 const strokePixels=scene.width*Math.min(w,h)/1080; // Pixel width at a 1080px short side.
 g.lineWidth=strokePixels/scale;g.globalAlpha=scene.mode==='original'?1:.8;
 for(let j=0;j<paths.length;j++) {
  const path=paths[j];
  for(let k=1;k<path.length;k++) {
   g.strokeStyle=colorAt(k/(path.length-1),j,scene);
   g.beginPath();g.moveTo(...path[k-1]);g.lineTo(...path[k]);g.stroke();
  }
 }
 g.globalAlpha=1;g.setTransform(1,0,0,1,0,0);

}
export function paintChamber(target,polygons,scene,phase) {
 const ctx=target.getContext("2d",{alpha:false}),p=scene;
 const w=target.width,h=target.height,scale=Math.min(w,h)*.46*p.zoom, angle=TAU*phase*p.rotation;
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#030508';ctx.fillRect(0,0,w,h);
 for(let sector=0;sector<2*p.symmetry;sector++){
   const a=angle+TAU*Math.floor(sector/2)/p.symmetry,c=Math.cos(a),s=Math.sin(a),flip=sector%2?-1:1;
   ctx.setTransform(scale*c,scale*s,-scale*s*flip,scale*c*flip,w/2,h/2);
   // A subpixel stroke in the fill color closes raster cracks between mirror copies.
   ctx.lineWidth=.55/scale;ctx.lineJoin='round';
   for(const g of polygons){ctx.beginPath();ctx.moveTo(...g.points[0]);for(let i=1;i<g.points.length;i++)ctx.lineTo(...g.points[i]);ctx.closePath();ctx.fillStyle=ctx.strokeStyle=g.color;ctx.fill();ctx.stroke();}
 }
 if(p.mirrors){ctx.setTransform(1,0,0,1,0,0);ctx.strokeStyle='#ffffff50';ctx.lineWidth=1;ctx.setLineDash([5,8]);for(let i=0;i<2*p.symmetry;i++){const a=angle+i*Math.PI/p.symmetry;ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(w/2+Math.cos(a)*Math.hypot(w,h),h/2+Math.sin(a)*Math.hypot(w,h));ctx.stroke();}ctx.setLineDash([]);}
 ctx.setTransform(1,0,0,1,0,0);

}
