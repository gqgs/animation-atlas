import {defaults,limits,readSettings,settingsQuery,cameraAt} from './core.mjs';
import {createRenderer} from './renderer.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),stage=$('stage');
const restored=readSettings(location.search),p=restored.parameters;
let phase=restored.phase,playing=!restored.paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer,exportController=null,last=performance.now(),dirty=true,previousKey='';
function graphicsFailure(error){playing=false;$('status').textContent=error.message;$('error').hidden=false;$('error').textContent=error.message;$('meter').textContent='GRAPHICS UNAVAILABLE';for(const id of ['play','png','record'])$(id).disabled=true;}
try {renderer=createRenderer(canvas);}catch(error){graphicsFailure(error);}
const specs=[
 ['duration','Revolution · seconds',1,0,'primary'],['glow','Luminance',.01,2,'primary'],
 ['azimuth','Azimuth · degrees',1,0,'camera'],['elevation','Elevation · degrees',1,0,'camera'],['zoom','Closeness',.01,2,'camera'],
];
for(const [key,title,step,,group] of specs){
 const label=document.createElement('label');label.textContent=title;
 const output=document.createElement('output');output.id=key+'Value';label.append(output);
 const input=document.createElement('input');Object.assign(input,{type:'range',id:key,min:limits[key][0],max:limits[key][1],step,value:p[key]});input.setAttribute('aria-label',title);
 input.oninput=()=>{p[key]=Number(input.value);markCustom();sync();};label.append(input);$(group+'-sliders').append(label);
}
function markCustom(){dirty=true;}
function sync(){
 for(const [key,,,digits] of specs){$(key).value=p[key];$(key+'Value').value=p[key].toFixed(digits);}
 for(const key of ['motion','palette','form'])$(key).value=p[key];
 $('play').textContent=playing?'Pause orbit':'Play orbit';
 $('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';dirty=true;
}
sync();
function dimensions(){const dpr=Math.min(devicePixelRatio||1,1.5),r=stage.getBoundingClientRect();return [Math.max(1,Math.round(r.width*dpr)),Math.max(1,Math.round(r.height*dpr))];}
new ResizeObserver(()=>{dirty=true;}).observe(stage);
function render(){
 if(!renderer)return;
 const [w,h]=dimensions(),key=[...Object.values(p),phase,w,h].join(',');
 if(!dirty&&key===previousKey)return;
 try{
  renderer.draw(p,phase,w,h);
  $('meter').textContent=`${p.form==='sculpture'?'CLOSED SURFACE / GENUS 2':'180,000 SAMPLES'} / ${Math.round(phase*360)}° ORBIT`;
  $('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';previousKey=key;dirty=false;
 }catch(error){graphicsFailure(error);renderer=null;sync();}
}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&!document.hidden&&!exportController)phase=(phase+dt/p.duration)%1;if(!exportController)render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function togglePlay(){if(exportController||!renderer)return;playing=!playing;sync();}
$('play').onclick=togglePlay;
$('reset').onclick=()=>{Object.assign(p,defaults);phase=0;sync();};
$('form').onchange=()=>{p.form=$('form').value;sync();};
$('palette').onchange=()=>{p.palette=$('palette').value;sync();};
$('motion').onchange=()=>{const camera=cameraAt(p,phase);p.azimuth=((camera.azimuth*180/Math.PI+180)%360+360)%360-180;p.elevation=camera.elevation*180/Math.PI;p.motion=$('motion').value;phase=0;sync();};
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');dirty=true;}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();togglePlay();}});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable here. Open the study separately.';}};
// All gestures edit the camera only; the integrated orbit remains unchanged.
let drag=null;
canvas.onpointerdown=e=>{if(exportController)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,azimuth:p.azimuth,elevation:p.elevation};};
canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||exportController)return;p.azimuth=((drag.azimuth+(e.clientX-drag.x)*.35+180)%360+360)%360-180;p.elevation=Math.max(-80,Math.min(80,drag.elevation+(e.clientY-drag.y)*.25));dirty=true;sync();};
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(drag?.id===e.pointerId)drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(exportController)return;p.zoom=Math.max(.65,Math.min(1.65,p.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.001)));sync();},{passive:false});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function sceneURL(at=phase){const url=new URL(location.href);url.search=settingsQuery(p,at);return url.href;}
$('link').onclick=async()=>{const url=sceneURL();try{await navigator.clipboard.writeText(url);$('status').textContent='Scene link copied. Opens at this frame, paused.';}catch{$('status').textContent='Copy this scene link:';const field=document.createElement('input');field.value=url;field.setAttribute('aria-label','Scene URL');$('status').append(field);field.select();}};
$('png').onclick=()=>{
 const target=document.createElement('canvas'),size=Number($('exportSize').value);let output;
 try{output=createRenderer(target);output.draw(p,phase,size,size);target.toBlob(blob=>{output.dispose();if(blob){download(blob,`chen-orbit-${size}.png`);$('status').textContent=`PNG saved at ${size} × ${size}.`;}else $('status').textContent='PNG could not be created.';});}catch(error){output?.dispose();$('status').textContent='PNG failed: '+error.message;}
};
$('record').onclick=async()=>{
 if(exportController){exportController.abort();$('status').textContent='Canceling export…';return;}
 const controller=new AbortController();exportController=controller;const scene={...p},wasPlaying=playing,size=Number($('exportSize').value),fps=Number($('exportFps').value),link=sceneURL(0);
 playing=false;drag=null;sync();
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(el=>!['record','hide','full'].includes(el.id));controls.forEach(el=>el.disabled=true);
 $('record').textContent='Cancel export';$('status').textContent='Loading MP4 encoder…';let output;
 try{
  const FrameWrap=await waitForEncoder(controller.signal);if(controller.signal.aborted)return;
  // Dedicated output-sized GPU canvas, copied 1:1 into the shared encoder canvas.
  const gpu=document.createElement('canvas');output=createRenderer(gpu);
  const blob=await exportFrames({width:size,height:size,fps,duration:scene.duration,format:'mp4',bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),
   createRecorder:options=>new FrameWrap(options),
   draw:({ctx,phase:at})=>{output.draw(scene,at,size,size);ctx.drawImage(gpu,0,0);},
   signal:controller.signal,yieldEvery:1,
   onProgress:(done,total)=>{$('status').textContent=`Encoding ${done} / ${total} · ${size}² · ${fps} fps`;},
  });
  if(controller.signal.aborted)return;
  download(blob,`chen-orbit-${size}p-${fps}fps.mp4`);download(new Blob([link+'\n'],{type:'text/plain'}),'chen-orbit-scene-url.txt');
  $('status').textContent=`MP4 saved · ${size} × ${size} · ${fps} fps · ${scene.duration} seconds.`;
 }catch(error){$('status').textContent=error.name==='AbortError'?'Export canceled.':'Export failed: '+error.message;}
 finally{output?.dispose();if(controller.signal.aborted)$('status').textContent='Export canceled.';exportController=null;playing=wasPlaying;controls.forEach(el=>el.disabled=false);$('record').textContent='Export MP4';last=performance.now();sync();}
};

// Loading a remote codec must never hold cancellation hostage to the network.
function waitForEncoder(signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>{const e=new Error('Export canceled');e.name='AbortError';reject(e);};
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  loadFrameWrap().then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
