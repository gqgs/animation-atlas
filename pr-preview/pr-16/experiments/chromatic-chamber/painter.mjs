import {TAU} from './core.mjs';
export function paintChamber(target,polygons,p,phase){
 const ctx=target.getContext('2d',{alpha:false});
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
