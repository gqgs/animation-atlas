import {cases,reference,optimized,geometry,rng,summary,accuracySweep,seed} from './common.mjs';
import {paintField} from '../../experiments/chromatic-unwinding/painter.mjs';
import {paintChamber} from '../../experiments/chromatic-chamber/painter.mjs';
const $=id=>document.getElementById(id),canvases={reference:$('baseline'),optimized:$('candidate')};
const paint={reference:{unwinding:reference.paintField,chamber:reference.paintChamber},optimized:{unwinding:paintField,chamber:paintChamber}};
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function draw(variant,test,paths,phase){const canvas=canvases[variant];if(test.kind==='unwinding')paint[variant][test.kind](canvas,paths,test.scene);else paint[variant][test.kind](canvas,paths,test.scene,phase);}
function flush(variant){canvases[variant].getContext('2d').getImageData(0,0,1,1);}
function pixelDifference(){const a=canvases.reference.getContext('2d').getImageData(0,0,canvases.reference.width,canvases.reference.height).data,b=canvases.optimized.getContext('2d').getImageData(0,0,canvases.optimized.width,canvases.optimized.height).data;let max=0,sum=0,changed=0,over2=0;for(let i=0;i<a.length;i+=4){let delta=0;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);max=Math.max(max,d);sum+=d;delta=Math.max(delta,d);}if(delta)changed++;if(delta>2)over2++;}const pixels=a.length/4;return {maxChannelDelta:max,meanAbsoluteChannelDelta:sum/a.length,changedPixels:changed,changedFraction:changed/pixels,pixelsOver2:over2,fractionOver2:over2/pixels,pass:max<=32&&over2/pixels<=.0001&&sum/a.length<=.01};}
let report;
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rotation-canvas-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('run').onclick=async()=>{
 $('run').disabled=true;$('download').disabled=true;
 try{
 const samples=9,warmup=2,phases=[0,.173,.5,.731],random=rng(),results=[],pixels=[];
 for(const test of cases){
  $('status').textContent='Timing '+test.name;await pause();
  const times={reference:{geometry:[],draw:[],full:[]},optimized:{geometry:[],draw:[],full:[]}};
  for(const c of Object.values(canvases)){c.width=1080;c.height=1080;}
  for(let i=-warmup;i<samples;i++){
   const phase=phases[(i+warmup)%phases.length];
   for(const variant of random()<.5?['reference','optimized']:['optimized','reference']){
    const api=(variant==='reference'?reference:optimized)[test.kind];
    const start=performance.now(),data=geometry(api,test,phase),middle=performance.now();draw(variant,test,data,phase);flush(variant);const end=performance.now();
    if(i>=0){times[variant].geometry.push(middle-start);times[variant].draw.push(end-middle);times[variant].full.push(end-start);}
   }
   await pause();
  }
  results.push({case:test.name,settings:test.scene,reference:Object.fromEntries(Object.entries(times.reference).map(([k,v])=>[k,summary(v)])),optimized:Object.fromEntries(Object.entries(times.optimized).map(([k,v])=>[k,summary(v)]))});
  for(const size of [1080,2160])for(const phase of size===1080?phases:[.173]){
   $('status').textContent=`Comparing ${test.name} at ${size}², phase ${phase}`;await pause();
   for(const variant of ['reference','optimized']){canvases[variant].width=size;canvases[variant].height=size;draw(variant,test,geometry((variant==='reference'?reference:optimized)[test.kind],test,phase),phase);}
   pixels.push({case:test.name,size,phase,...pixelDifference()});
  }
 }
 report={baselineCommit:reference.sourceCommit,environment:{userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,devicePixelRatio,visibility:document.visibilityState,date:new Date().toISOString()},method:{samples,warmup,seed,phases,resolution:1080,pixelResolutions:[1080,2160],order:'seeded randomized paired interleaving',geometry:'same phase and shards; excludes chamber generation',draw:'production Canvas2D commands plus synchronous 1px readback flush; includes bounds/color costs in painters',full:'geometry + draw + flush, not FPS and not compositor presentation',pixelTolerance:{maxChannelDelta:32,maxFractionPixelsOver2:.0001,maxMeanAbsoluteChannelDelta:.01},speedIsNonGating:true},geometryAccuracy:accuracySweep(),results,pixels};
 report.pass=report.geometryAccuracy.pass&&pixels.every(p=>p.pass);window.benchmarkResult=report;
 $('output').textContent=JSON.stringify(report,null,2);$('status').textContent=report.pass?'Complete: equivalence passed.':'Complete: equivalence FAILED; inspect differences.';$('download').disabled=false;
 }catch(error){$('status').textContent='Failed: '+error.message;window.benchmarkError=String(error);console.error(error);}finally{$('run').disabled=false;}
};
