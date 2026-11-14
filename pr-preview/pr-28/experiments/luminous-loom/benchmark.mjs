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
 const runStart=performance.now();
 const scene=normalize(input),phases=[0,.173,.381,.731];
 const setupStart=performance.now(),workspaces=Object.fromEntries(modes.map(mode=>[mode,createGeometry(scene)]));
 const setupMs=performance.now()-setupStart;
 const canvases=Object.fromEntries(modes.map(mode=>{const c=document.createElement('canvas');c.width=size;c.height=size;return [mode,c];}));
 const times=Object.fromEntries(modes.map(mode=>[mode,Object.fromEntries(['geometry','prepare','submit','readback','total'].map(k=>[k,[]]))]));
 let state=13013;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 const orders=[],pixelRows=new Map();
 const wall={setupMs:performance.now()-runStart,warmupMs:0,measuredRoundsMs:0,validationOnlyRenderMs:0,pixelComparisonMs:0};
 function sample(mode,phase,record) {
  check(signal);
  const start=performance.now(),data=geometryAt(workspaces[mode],phase),afterGeometry=performance.now();
  const paths=preparePaths(data,scene,mode),afterPrepare=performance.now();
  paint(canvases[mode],data,scene,paths,mode);const afterSubmit=performance.now();
  // Read the ENTIRE output. A corner-only readback may rasterize just that
  // region and substantially undercount drawing. Include allocation/copy cost.
  const pixels=canvases[mode].getContext('2d').getImageData(0,0,size,size).data,end=performance.now();
  if(record)for(const [key,value] of Object.entries({geometry:afterGeometry-start,prepare:afterPrepare-afterGeometry,submit:afterSubmit-afterPrepare,readback:end-afterSubmit,total:end-start}))times[mode][key].push(value);
  return pixels;
 }
 async function compare(phase,images) {
  const start=performance.now();
  onProgress(`Comparing pixels · phase ${phase}`);await yieldTask();check(signal);
  pixelRows.set(phase,['path2d','merged'].map(mode=>({mode,phase,...pixelDifference(images.direct,images[mode])})));
  wall.pixelComparisonMs+=performance.now()-start;
 }
 for(let i=-warmup;i<samples;i++) {
  const roundStart=performance.now();
  check(signal);const phase=phases[(i+warmup)%phases.length],order=[...modes];
  for(let j=order.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[order[j],order[k]]=[order[k],order[j]];}
  if(i>=0)orders.push(order);
  onProgress(`Timing ${Math.max(0,i+1)}/${samples} · ${size}²`);await yieldTask();
  const images={};
  for(const mode of order)images[mode]=sample(mode,phase,i>=0);
  wall[i<0?'warmupMs':'measuredRoundsMs']+=performance.now()-roundStart;
  if(!pixelRows.has(phase))await compare(phase,images);
 }
 // Reuse timed readbacks for correctness checks. Render only phases not covered
 // by unusually short runs, without mixing these checks into the timing sample.
 for(const phase of phases)if(!pixelRows.has(phase)) {
  const start=performance.now();check(signal);await yieldTask();const images={};
  for(const mode of modes)images[mode]=sample(mode,phase,false);
  wall.validationOnlyRenderMs+=performance.now()-start;
  await compare(phase,images);
 }
 const pixels=phases.flatMap(phase=>pixelRows.get(phase));
 const tolerance={maxChannelDelta:32,meanAbsoluteRGBDelta:.05,fractionOver2:.001};
 const report={wallTiming:wall,scene,workload:counts(scene),size,environment:{userAgent:navigator.userAgent,devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,visibility:document.visibilityState,date:new Date().toISOString(),context:canvases.direct.getContext('2d').getContextAttributes?.()},method:{samples,warmup,phases,seed:13013,orders,setupMs,setup:'Three reusable angular tables and coordinate buffers, excluded from repeated-frame timing.',geometry:'Explicit-phase projection into reused Float64 storage; same work in all modes.',prepare:'Fresh Path2D construction every animated frame, included in total; never cached across phases.',submit:'Canvas commands, style setup, background and both stroke passes.',readback:'Full-canvas synchronous RGBA readback after submission; includes all output pixels, pending raster work, allocation and copy overhead. May change browser backend heuristics.',total:'Geometry + path preparation + drawing submission + complete-image readback; not compositor presentation, pure GPU time, encoder time, or FPS.',merged:'Approximate: same-color paths are stroked as a union, changing overlap opacity. Not an equivalent optimization.',tolerance,speedIsNonGating:true},timings:Object.fromEntries(modes.map(mode=>[mode,Object.fromEntries(Object.entries(times[mode]).map(([k,v])=>[k,summary(v)]))])),pixels};
 report.pass=pixels.filter(p=>p.mode==='path2d').every(p=>p.maxChannelDelta<=tolerance.maxChannelDelta&&p.meanAbsoluteRGBDelta<=tolerance.meanAbsoluteRGBDelta&&p.fractionOver2<=tolerance.fractionOver2);
 wall.totalMs=performance.now()-runStart;wall.unaccountedMs=wall.totalMs-wall.setupMs-wall.warmupMs-wall.measuredRoundsMs-wall.validationOnlyRenderMs-wall.pixelComparisonMs;
 check(signal);return report;
}
