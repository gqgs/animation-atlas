import {bounds,colorAt} from './core.mjs';
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
