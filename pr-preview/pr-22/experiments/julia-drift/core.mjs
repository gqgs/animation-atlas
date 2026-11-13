export const TAU=2*Math.PI;
export const limits={real:[-1.2,.4],imaginary:[-.6,.6],drift:[0,.8],bias:[.05,.99],centerX:[-2,2],centerY:[-2,2],extent:[.015,2.5],iterations:[100000,2000000],duration:[8,180],rotation:[0,360],colorCycles:[.2,2.5],phase:[0,1]};
export const defaults=Object.freeze({real:-.75,imaginary:.1,drift:.32,bias:.99,centerX:-.5,centerY:.05,extent:.19,iterations:1500000,duration:60,rotation:20,colorCycles:1,palette:'opal',motion:'breathe'});
export const presets=Object.freeze({spiral:{...defaults},lace:{...defaults,drift:.48,bias:.985,palette:'ember',rotation:120},detail:{...defaults,centerX:-.5,centerY:.05,extent:.07,drift:.18,iterations:2000000},original:{...defaults,drift:0,bias:.99,motion:'still',rotation:0}});
export const paletteNames=['opal','lagoon','ember','ink'];
export const motionNames=['breathe','orbit','still'];
export function wrapPhase(phase){return ((phase%1)+1)%1;}
export function sceneAt(parameters,phase){
 const t=TAU*wrapPhase(phase),p={...parameters};
 p.warpX=p.motion==='still'?0:p.drift*Math.cos(t);
 p.warpY=p.motion==='still'?0:p.drift*Math.sin(t);
 if(p.motion==='breathe')p.extent*=Math.exp(.07*(1-Math.cos(t)));
 return p;
}
export function inverseStep(x,y,cx,cy,negative){
 const a=x-cx,b=y-cy,r=Math.sqrt(Math.hypot(a,b)),theta=Math.atan2(b,a)/2,s=negative?-1:1;
 return [s*r*Math.cos(theta),s*r*Math.sin(theta)];
}
// A fixed seed, fixed burn-in and fixed samples make both playback and export reproducible.
export function sampleJulia(p){
 const data=new Float32Array(p.iterations*3);let seed=731993,x=.123,y=.456;
 for(let i=-256;i<p.iterations;i++){
  seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
  [x,y]=inverseStep(x,y,p.real,p.imaginary,(seed>>>0)/4294967296<p.bias);
  if(i>=0){data[i*3]=x;data[i*3+1]=y;data[i*3+2]=Math.atan2(y-.05,x+.5)/TAU+.5+.12*Math.log(Math.max(1e-8,Math.hypot(x+.5,y-.05)));}
 }
 return data;
}
// (z + a) / (1 - conjugate(a) z), determinant 1 + |a|².
export function mobius(x,y,ax,ay){
 const nx=x+ax,ny=y+ay,dx=1-ax*x-ay*y,dy=ay*x-ax*y,d=dx*dx+dy*dy;
 return d<1e-16?null:[(nx*dx+ny*dy)/d,(ny*dx-nx*dy)/d];
}
export function readSettings(search) {
  const query = new URLSearchParams(search), parameters = {...defaults};
  for (const [key,[lo,hi]] of Object.entries(limits)) {
    if (key==='phase' || !query.has(key)) continue;
    const raw = query.get(key), v = Number(raw);
    if (raw.trim() && Number.isFinite(v)) parameters[key]=Math.max(lo,Math.min(hi,key==='iterations'?Math.round(v):v));
  }
  if (paletteNames.includes(query.get('palette'))) parameters.palette=query.get('palette');
  if (motionNames.includes(query.get('motion'))) parameters.motion=query.get('motion');
  const raw=query.get('phase'), v=Number(raw);
  return {parameters, phase:raw && Number.isFinite(v)?Math.max(0,Math.min(1,v)):0,
    paused:query.has('phase')};
}
export function settingsQuery(parameters,phase) {
  return new URLSearchParams({...parameters,phase:Math.max(0,Math.min(1,phase))}).toString();
}
export function pointAt(pixelX,pixelY,width,height,p) {
  const unit=2*p.extent/Math.min(width,height), x=(pixelX-width/2)*unit,y=(height/2-pixelY)*unit;
  const a=p.rotation*Math.PI/180, c=Math.cos(a),s=Math.sin(a);
  return [p.centerX+c*x-s*y,p.centerY+s*x+c*y];
}
