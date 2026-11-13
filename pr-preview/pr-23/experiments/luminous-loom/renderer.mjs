import {colorIndex,palettes} from './core.mjs';
export function trace(path,data,start,samples) {
 path.moveTo(data[start],data[start+1]);
 for(let i=1;i<samples;i++)path.lineTo(data[start+2*i],data[start+2*i+1]);
 path.closePath();
}
export function preparePaths(data,p,mode=p.renderer,Path=globalThis.Path2D) {
 if(mode==='direct')return null;
 const paths=Array.from({length:mode==='merged'?6:p.fibers},()=>new Path());
 for(let j=0;j<p.fibers;j++)trace(paths[mode==='merged'?colorIndex(j,p.fibers):j],data,2*j*p.samples,p.samples);
 return paths;
}
// All exact modes draw the same closed paths, in the same order and styles.
// Merged is intentionally approximate: one stroke unions same-color overlaps.
export function paint(target,data,p,paths=null,mode=p.renderer) {
 const ctx=target.getContext('2d',{alpha:false}),w=target.width,h=target.height,size=Math.min(w,h),scale=size*.30*p.zoom;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='#060b15';ctx.fillRect(0,0,w,h);
 ctx.setTransform(scale,0,0,scale,w/2,h/2);
 ctx.lineJoin='round';ctx.lineCap='round';
 const passes=p.glow?[[3.8,.12],[1,1]]:[[1,1]];
 for(const [width,alpha] of passes) {
  ctx.lineWidth=p.width*(size/1080)/scale*width;ctx.globalAlpha=p.opacity*alpha;
  const total=mode==='merged'?6:p.fibers;
  for(let j=0;j<total;j++) {
   ctx.strokeStyle=palettes[p.palette][mode==='merged'?j:colorIndex(j,p.fibers)];
   if(mode==='direct'){ctx.beginPath();trace(ctx,data,2*j*p.samples,p.samples);ctx.stroke();}
   else ctx.stroke(paths[j]);
  }
 }
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
}
