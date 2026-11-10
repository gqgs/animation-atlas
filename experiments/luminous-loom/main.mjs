import {defaults,limits,normalize,createGeometry,geometryAt,counts} from './core.mjs';
import {preparePaths,paint} from './renderer.mjs';
import {abortable} from './abortable.mjs';
import {runBenchmark} from './benchmark.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
import {createParameterControl} from '../../shared/parameter-controls.mjs';
import {normalizeTracks} from '../../shared/parameter-tracks.mjs';
import {parameterSpecs,trackDefinitions,readScene,resolveScene,snapshotScene,writeSceneQuery} from './parameters.mjs';
const $=id=>document.getElementById(id),canvas=$('scene');
const query=new URLSearchParams(location.search);let {settings:p,tracks}=readScene(query);
let phase=Number(query.get('phase'))||0;phase=Math.max(0,Math.min(1,phase));
let playing=!query.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now(),dirty=true,workspace=createGeometry(p),busy=null,report=null;
const controls=new Map();
for(const [key,label] of parameterSpecs){
 const [min,max,step]=limits[key],definition=trackDefinitions[key]||{min,max,step,animatable:false,note:key==='duration'?'One shared clock for every cyclic control.':'Static density · changes geometry allocation.'};
 controls.set(key,createParameterControl({parent:$('sliders'),key,label,definition,value:p[key],track:tracks[key],
  onValue:value=>{p[key]=value;$('preset').value='custom';rebuild();},
  onTrack:track=>{tracks=normalizeTracks({...tracks,[key]:track},trackDefinitions);$('preset').value='custom';invalidateReport();dirty=true;sync();},
 }));
}
function sync(){
 const resolved=resolveScene(p,tracks,phase);
 for(const [key,control] of controls)control.sync({value:p[key],track:tracks[key],resolved:resolved[key],disabled:!!busy});
 const active=Object.keys(tracks).length;$('trackSummary').textContent=active?`${active} cyclic ${active===1?'control':'controls'} · ${p.duration} s per loop · values shown live`:'Static values · enable Cyclic to animate a control';
 for(const key of ['palette','renderer'])$(key).value=p[key];$('glow').checked=!!p.glow;
 $('play').textContent=playing?'Pause':'Play';$('phase').value=phase;$('phaseValue').value=(100*phase).toFixed(1)+'%';
 $('knot').textContent=`T(${p.p},${p.q})`;const c=counts(p);$('workload').textContent=`${c.fibers} FIBERS / ${(c.segments/1000).toFixed(1)}k SEGMENTS × ${c.passes}`;
 $('modeNote').textContent=p.renderer==='merged'?'Approximation: merging same-color paths changes overlap brightness. Fewer strokes do not guarantee a faster frame.':p.renderer==='path2d'?'Same ordered paths and styles. Paths are rebuilt every frame; preparation cost is included.':'Reference: submit each closed fiber directly to Canvas, preserving every overlap.';
}
function invalidateReport(){report=null;window.loomBenchmarkResult=null;$('report').hidden=true;$('benchSummary').textContent='Settings changed. Compare matched frames to measure this configuration.';}
function rebuild(){invalidateReport();p=normalize(p);workspace=createGeometry(p);dirty=true;sync();}
function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;dirty=true;renderAt(canvas,phase,p,workspace,tracks);}}
new ResizeObserver(resize).observe(canvas);resize();sync();if(query.size)$('preset').value='custom';
function renderAt(target,position,settings,space,animation={}){const scene=resolveScene(settings,animation,position),data=geometryAt(space,position,scene);const paths=preparePaths(data,scene);paint(target,data,scene,paths);}
function frame(now){
 const dt=Math.max(0,(now-last)/1000);last=now;
 if(playing&&!busy&&!document.hidden){phase=(phase+dt/p.duration)%1;dirty=true;}
 if(dirty&&!busy){
  const start=performance.now(),scene=resolveScene(p,tracks,phase),data=geometryAt(workspace,phase,scene),g=performance.now(),paths=preparePaths(data,scene),r=performance.now();paint(canvas,data,scene,paths);const end=performance.now();
  $('geometryTime').textContent=(g-start).toFixed(1)+' ms';$('prepareTime').textContent=(r-g).toFixed(1)+' ms';$('drawTime').textContent=(end-r).toFixed(1)+' ms';dirty=false;sync();
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Background tabs pause the clock rather than jumping on return. Slow visible
// frames still advance by elapsed time; deterministic export never skips frames.
addEventListener('visibilitychange',()=>{last=performance.now();});
$('play').onclick=()=>{if(!busy){playing=!playing;last=performance.now();sync();}};
$('reset').onclick=()=>{phase=0;playing=false;dirty=true;sync();};
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;dirty=true;sync();};
for(const key of ['palette','renderer'])$(key).onchange=()=>{p[key]=$(key).value;$('preset').value='custom';invalidateReport();dirty=true;sync();};
$('glow').onchange=()=>{p.glow=Number($('glow').checked);$('preset').value='custom';invalidateReport();dirty=true;sync();};
const presets={ribbon:{...defaults},cinquefoil:{...defaults,p:2,q:5,spread:.45,palette:'ember',fibers:112},orbital:{...defaults,p:3,q:4,spread:.95,palette:'glacier',fibers:144,width:.75},stress:{...defaults,fibers:384,samples:1536,width:.55,opacity:.38}};
$('preset').onchange=()=>{p={...presets[$('preset').value]};tracks={};for(const control of controls.values())control.reset();phase=0;rebuild();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();$('play').click();}});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function sceneURL(position=phase){const url=new URL(location.href);url.search=writeSceneQuery(p,tracks,position).toString();return url.href;}
$('link').onclick=async()=>{try{await navigator.clipboard.writeText(sceneURL());$('status').textContent='Scene link copied with static values, cyclic tracks and paused phase.';}catch{$('status').textContent='Copy this scene URL:';const input=document.createElement('input');input.value=sceneURL();input.setAttribute('aria-label','Scene URL');$('status').append(input);input.select();}};
$('png').onclick=()=>{const size=Number($('exportSize').value),output=document.createElement('canvas');output.width=output.height=size;renderAt(output,phase,p,createGeometry(p),tracks);output.toBlob(blob=>{if(blob){download(blob,'luminous-loom-'+size+'.png');$('status').textContent=`PNG saved at ${size} × ${size}.`;}});};
function lock(except){for(const el of document.querySelectorAll('aside button,aside input,aside select'))el.disabled=!['hide',except].includes(el.id);}
function unlock(){for(const el of document.querySelectorAll('aside button,aside input,aside select'))el.disabled=false;sync();}
$('benchmark').onclick=async()=>{
 if(busy?.kind==='benchmark'){busy.controller.abort();$('benchSummary').textContent='Canceling comparison…';return;}
 if(busy)return;
 const controller=new AbortController();busy={kind:'benchmark',controller};playing=false;sync();lock('benchmark');$('benchmark').textContent='Cancel comparison';$('report').hidden=true;
 try{
  const frozenScene=resolveScene(p,tracks,phase),trackSnapshot=snapshotScene(p,tracks);
  report=await runBenchmark(frozenScene,{samples:p.fibers*p.samples>200000?3:9,warmup:p.fibers*p.samples>200000?1:2,signal:controller.signal,onProgress:message=>{$('benchSummary').textContent=message;}});
  report.parameterTracks={...trackSnapshot,phase,method:'Freeze resolved values at the selected phase for all matched benchmark frames.'};
  window.loomBenchmarkResult=report;
  const t=report.timings,delta=Math.max(...report.pixels.filter(x=>x.mode==='merged').map(x=>x.meanAbsoluteRGBDelta));
  $('benchSummary').textContent=`${Object.keys(tracks).length?'Tracks frozen at '+(100*phase).toFixed(1)+'% phase. ':''}1080² median total: Direct ${t.direct.total.median.toFixed(1)} ms · Path2D ${t.path2d.total.median.toFixed(1)} ms · Merged ${t.merged.total.median.toFixed(1)} ms. Same-path pixel check ${report.pass?'passed':'FAILED'}. Merged mean RGB error up to ${delta.toFixed(2)}/255. Exploratory, not FPS.`;
  $('report').hidden=false;
 }catch(error){$('benchSummary').textContent=error.name==='AbortError'?'Comparison canceled.':'Comparison failed: '+error.message;}
 finally{busy=null;unlock();$('benchmark').textContent='Compare matched frames';dirty=true;}
};
$('report').onclick=()=>download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'luminous-loom-benchmark.json');
$('record').onclick=async()=>{
 if(busy?.kind==='export'){busy.controller.abort();$('status').textContent='Canceling export…';return;}
 if(busy)return;
 const controller=new AbortController();busy={kind:'export',controller};const {settings:scene,tracks:animation}=snapshotScene(p,tracks),space=createGeometry(scene),wasPlaying=playing,size=Number($('exportSize').value),fps=Number($('exportFps').value),link=sceneURL(0);
 playing=false;sync();lock('record');$('record').textContent='Cancel export';$('status').textContent='Loading deterministic MP4 encoder…';
 try{
  const FrameWrap=await abortable(loadFrameWrap(),controller.signal);if(controller.signal.aborted)throw new DOMException('Canceled','AbortError');
  const blob=await exportFrames({width:size,height:size,fps,duration:scene.duration,format:'mp4',bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),createRecorder:options=>new FrameWrap(options),signal:controller.signal,draw:({canvas:output,phase:position})=>renderAt(output,position,scene,space,animation),onProgress:(done,total)=>{if(done===1||done%10===0||done===total)$('status').textContent=`Encoding ${done}/${total} frames · ${size}² · ${fps} fps`;}});
  if(controller.signal.aborted)throw new DOMException('Canceled','AbortError');
  download(blob,`luminous-loom-${size}p-${fps}fps.mp4`);download(new Blob([link+'\n'],{type:'text/plain'}),'luminous-loom-scene-url.txt');$('status').textContent=`MP4 exported · ${size} × ${size} · ${fps} fps · exact frame steps`;
 }catch(error){$('status').textContent=error.name==='AbortError'?'Export canceled':'Export failed: '+error.message;if(error.name!=='AbortError')console.error(error);}
 finally{busy=null;playing=wasPlaying;last=performance.now();unlock();$('record').textContent='Export MP4';dirty=true;sync();}
};
