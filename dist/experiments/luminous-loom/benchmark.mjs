import {createGeometry,geometryAt,normalize,counts} from './core.mjs';
import {preparePaths,paint} from './renderer.mjs';
export const modes=['direct','path2d','merged'];
export function summary(values) {
 const sorted=[...values].sort((a,b)=>a-b);
 return {median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],min:sorted[0],max:sorted.at(-1),samples:values};
}
export function pixelDifference(a,b) {
 let max=0,sum=0,changed=0,over2=0;
 for(let i=0;i<a.length;i+=4) {
  let delta=0;
  for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);sum+=d;max=Math.max(max,d);delta=Math.max(delta,d);}
  if(delta)changed++;if(delta>2)over2++;
 }
 const pixels=a.length/4;
 return {maxChannelDelta:max,meanAbsoluteRGBDelta:sum/(pixels*3),changedPixels:changed,changedFraction:changed/pixels,fractionOver2:over2/pixels};
}
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal){if(signal?.aborted)throw new DOMException('Benchmark canceled','AbortError');}
export async function runBenchmark(input,{size=1080,samples=9,warmup=2,onProgress=()=>{},signal}={}) {
 if(!Number.isInteger(size)||size<64||size>2160||!Number.isInteger(samples)||samples<3||samples>100||!Number.isInteger(warmup)||warmup<0||warmup>20)throw new RangeError('Invalid benchmark dimensions or sample counts');
 const scene=normalize(input),phases=[0,.173,.381,.731];
 const setupStart=performance.now(),workspaces=Object.fromEntries(modes.map(mode=>[mode,createGeometry(scene)]));
 const setupMs=performance.now()-setupStart;
 const canvases=Object.fromEntries(modes.map(mode=>{const c=document.createElement('canvas');c.width=size;c.height=size;return [mode,c];}));
 const times=Object.fromEntries(modes.map(mode=>[mode,Object.fromEntries(['geometry','prepare','submit','rasterFence','total'].map(k=>[k,[]]))]));
 let state=13013;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const orders=[];
 for(let i=-warmup;i<samples;i++) {
  check(signal);const phase=phases[(i+warmup)%phases.length],order=[...modes];
  for(let j=order.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[order[j],order[k]]=[order[k],order[j]];}
  if(i>=0)orders.push(order);
  onProgress(`Timing ${Math.max(0,i+1)}/${samples} · ${size}²`);await yieldTask();
  for(const mode of order) {
   check(signal);
   const start=performance.now(),data=geometryAt(workspaces[mode],phase),afterGeometry=performance.now();
   const paths=preparePaths(data,scene,mode),afterPrepare=performance.now();
   paint(canvases[mode],data,scene,paths,mode);const afterSubmit=performance.now();
   // Completion fence, not a compositor/FPS measure. Readback may alter backend
   // heuristics; report this explicitly and use identical calls in every mode.
   canvases[mode].getContext('2d').getImageData(0,0,1,1);const end=performance.now();
   if(i>=0)for(const [key,value] of Object.entries({geometry:afterGeometry-start,prepare:afterPrepare-afterGeometry,submit:afterSubmit-afterPrepare,rasterFence:end-afterSubmit,total:end-start}))times[mode][key].push(value);
  }
 }
 const pixels=[];
 for(const phase of phases) {
  check(signal);onProgress(`Comparing pixels · phase ${phase}`);await yieldTask();check(signal);
  const images={};
  for(const mode of modes){check(signal);const data=geometryAt(workspaces[mode],phase);paint(canvases[mode],data,scene,preparePaths(data,scene,mode),mode);images[mode]=canvases[mode].getContext('2d').getImageData(0,0,size,size).data;}
  for(const mode of ['path2d','merged'])pixels.push({mode,phase,...pixelDifference(images.direct,images[mode])});
 }
 const tolerance={maxChannelDelta:32,meanAbsoluteRGBDelta:.05,fractionOver2:.001};
 const report={scene,workload:counts(scene),size,environment:{userAgent:navigator.userAgent,devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,visibility:document.visibilityState,date:new Date().toISOString(),context:canvases.direct.getContext('2d').getContextAttributes?.()},method:{samples,warmup,phases,seed:13013,orders,setupMs,setup:'Three reusable angular tables and coordinate buffers, excluded from repeated-frame timing.',geometry:'Explicit-phase projection into reused Float64 storage; same work in all modes.',prepare:'Fresh Path2D construction every animated frame, included in total; never cached across phases.',submit:'Canvas commands, style setup, background and both stroke passes.',rasterFence:'Synchronous 1px readback after submission; includes pending drawing and readback overhead. May change browser backend heuristics.',total:'Geometry + path preparation + drawing submission + readback; not compositor presentation, encoder time, or FPS.',merged:'Approximate: same-color paths are stroked as a union, changing overlap opacity. Not an equivalent optimization.',tolerance,speedIsNonGating:true},timings:Object.fromEntries(modes.map(mode=>[mode,Object.fromEntries(Object.entries(times[mode]).map(([k,v])=>[k,summary(v)]))])),pixels};
 report.pass=pixels.filter(p=>p.mode==='path2d').every(p=>p.maxChannelDelta<=tolerance.maxChannelDelta&&p.meanAbsoluteRGBDelta<=tolerance.meanAbsoluteRGBDelta&&p.fractionOver2<=tolerance.fractionOver2);
 check(signal);return report;
}
