import {defaults,presets,limits,readSettings,settingsQuery,pointAt,sceneAt} from './core.mjs';
import {createRenderer} from './renderer.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),stage=$('stage');
const restored=readSettings(location.search),p=restored.parameters;
let phase=restored.phase,playing=!restored.paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer,exportController=null,last=performance.now(),dirty=true,previousKey='',activePreset='spiral';
try {renderer=createRenderer(canvas);}catch(error){$('status').textContent=error.message;$('play').disabled=true;$('png').disabled=true;$('record').disabled=true;}
const specs=[
 ['drift','Möbius tide',.01,2,'primary'],['bias','Negative branch probability',.001,3,'primary'],['duration','Loop duration · seconds',1,0,'primary'],
 ['real','c · real',.0001,4,'field'],['imaginary','c · imaginary',.0001,4,'field'],
 ['centerX','Camera center · real',.001,3,'field'],['centerY','Camera center · imaginary',.001,3,'field'],
 ['extent','View half-height',.001,3,'field'],['rotation','Rotation · degrees',1,0,'field'],
 ['iterations','Sample count',10000,0,'field'],['colorCycles','Color frequency',.01,2,'field'],
];
for(const [key,title,step,,group] of specs){
 const label=document.createElement('label');label.textContent=title;
 const output=document.createElement('output');output.id=key+'Value';label.append(output);
 const input=document.createElement('input');Object.assign(input,{type:'range',id:key,min:limits[key][0],max:limits[key][1],step,value:p[key]});input.setAttribute('aria-label',title);
 input.oninput=()=>{p[key]=Number(input.value);markCustom();sync();};label.append(input);$(group+'-sliders').append(label);
}
function markCustom(){activePreset='custom';dirty=true;}
function sync(){
 for(const [key,,,digits] of specs){$(key).value=p[key];$(key+'Value').value=p[key].toFixed(digits);}
 for(const key of ['motion','palette'])$(key).value=p[key];
 $('preset').value=activePreset;$('play').textContent=playing?'Pause':'Play';
 $('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';dirty=true;
}
if(location.search)activePreset='custom';sync();
function dimensions(){const dpr=Math.min(devicePixelRatio||1,1.5),r=stage.getBoundingClientRect();return [Math.max(1,Math.round(r.width*dpr)),Math.max(1,Math.round(r.height*dpr))];}
new ResizeObserver(()=>{dirty=true;}).observe(stage);
function render(){
 if(!renderer)return;
 const [w,h]=dimensions(),key=[...Object.values(p),phase,w,h].join(',');
 if(!dirty&&key===previousKey)return;
 try{
  const state=renderer.draw(p,phase,w,h);
  $('position').textContent=`c = ${state.real.toFixed(4)} ${state.imaginary<0?'−':'+'} ${Math.abs(state.imaginary).toFixed(4)}i`;
  $('meter').textContent=`${w} × ${h} / ${p.iterations} SAMPLES`;
  $('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';previousKey=key;dirty=false;
 }catch(error){playing=false;$('status').textContent=error.message;renderer=null;sync();}
}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&!document.hidden&&!exportController)phase=(phase+dt/p.duration)%1;if(!exportController)render();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function togglePlay(){if(exportController||!renderer)return;playing=!playing;sync();}
$('play').onclick=togglePlay;
$('preset').onchange=()=>{activePreset=$('preset').value;Object.assign(p,presets[activePreset]);phase=0;sync();};
$('reset').onclick=()=>{const preset=presets[activePreset]||defaults;Object.assign(p,preset);phase=0;sync();};
for(const key of ['motion','palette'])$(key).onchange=()=>{p[key]=$(key).value;markCustom();sync();};
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');dirty=true;}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();togglePlay();}});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable here. Open the study separately.';}};
// Pointer coordinates are measured in CSS pixels; camera scale is isotropic.
const pointers=new Map();let gesture=null;
function beginGesture(){const pts=[...pointers.values()];if(!pts.length){gesture=null;return;}const r=canvas.getBoundingClientRect();gesture={p:{...p},camera:sceneAt(p,phase),pts,rect:r,distance:pts.length>1?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};}
canvas.onpointerdown=e=>{if(exportController)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});beginGesture();};
canvas.onpointermove=e=>{if(exportController||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...pointers.values()],g=gesture,r=g.rect;
 if(pts.length===1){const a=pointAt(g.pts[0].x-r.left,g.pts[0].y-r.top,r.width,r.height,g.camera),b=pointAt(pts[0].x-r.left,pts[0].y-r.top,r.width,r.height,g.camera);p.centerX=Math.max(-2,Math.min(2,g.p.centerX+a[0]-b[0]));p.centerY=Math.max(-2,Math.min(2,g.p.centerY+a[1]-b[1]));}
 else {const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);p.extent=Math.max(limits.extent[0],Math.min(limits.extent[1],g.p.extent*g.distance/Math.max(d,1)));}
 markCustom();sync();};
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{pointers.delete(e.pointerId);beginGesture();});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(exportController)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,a=pointAt(x,y,r.width,r.height,sceneAt(p,phase));p.extent=Math.max(limits.extent[0],Math.min(limits.extent[1],p.extent*Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002)));const b=pointAt(x,y,r.width,r.height,sceneAt(p,phase));p.centerX=Math.max(-2,Math.min(2,p.centerX+a[0]-b[0]));p.centerY=Math.max(-2,Math.min(2,p.centerY+a[1]-b[1]));markCustom();sync();},{passive:false});
canvas.ondblclick=e=>{if(exportController)return;const r=canvas.getBoundingClientRect(),a=pointAt(e.clientX-r.left,e.clientY-r.top,r.width,r.height,sceneAt(p,phase));p.centerX=Math.max(-2,Math.min(2,a[0]));p.centerY=Math.max(-2,Math.min(2,a[1]));markCustom();sync();};
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function sceneURL(at=phase){const url=new URL(location.href);url.search=settingsQuery(p,at);return url.href;}
$('link').onclick=async()=>{const url=sceneURL();try{await navigator.clipboard.writeText(url);$('status').textContent='Scene link copied. Opens at this frame, paused.';}catch{$('status').textContent='Copy this scene link:';const field=document.createElement('input');field.value=url;field.setAttribute('aria-label','Scene URL');$('status').append(field);field.select();}};
$('png').onclick=()=>{
 const target=document.createElement('canvas'),size=Number($('exportSize').value);let output;
 try{output=createRenderer(target);output.draw(p,phase,size,size);target.toBlob(blob=>{output.dispose();if(blob){download(blob,`julia-drift-${size}.png`);$('status').textContent=`PNG saved at ${size} × ${size}.`;}else $('status').textContent='PNG could not be created.';});}catch(error){output?.dispose();$('status').textContent='PNG failed: '+error.message;}
};
$('record').onclick=async()=>{
 if(exportController){exportController.abort();$('status').textContent='Canceling export…';return;}
 const controller=new AbortController();exportController=controller;const scene={...p},wasPlaying=playing,size=Number($('exportSize').value),fps=Number($('exportFps').value),link=sceneURL(0);
 playing=false;pointers.clear();gesture=null;sync();
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(el=>!['record','hide','full'].includes(el.id));controls.forEach(el=>el.disabled=true);
 $('record').textContent='Cancel export';$('status').textContent='Loading MP4 encoder…';let output;
 try{
  const FrameWrap=await loadFrameWrap();if(controller.signal.aborted)return;
  // Dedicated output-sized GPU canvas, copied 1:1 into the shared encoder canvas.
  const gpu=document.createElement('canvas');output=createRenderer(gpu);
  const blob=await exportFrames({width:size,height:size,fps,duration:scene.duration,format:'mp4',bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),
   createRecorder:options=>new FrameWrap(options),
   draw:({ctx,phase:at})=>{output.draw(scene,at,size,size);ctx.drawImage(gpu,0,0);},
   signal:controller.signal,yieldEvery:1,
   onProgress:(done,total)=>{$('status').textContent=`Encoding ${done} / ${total} · ${size}² · ${fps} fps`;},
  });
  if(controller.signal.aborted)return;
  download(blob,`julia-drift-${size}p-${fps}fps.mp4`);download(new Blob([link+'\n'],{type:'text/plain'}),'julia-drift-scene-url.txt');
  $('status').textContent=`MP4 saved · ${size} × ${size} · ${fps} fps · ${scene.duration} seconds.`;
 }catch(error){$('status').textContent=error.name==='AbortError'?'Export canceled.':'Export failed: '+error.message;}
 finally{output?.dispose();if(controller.signal.aborted)$('status').textContent='Export canceled.';exportController=null;playing=wasPlaying;controls.forEach(el=>el.disabled=false);$('record').textContent='Export MP4';last=performance.now();sync();}
};
