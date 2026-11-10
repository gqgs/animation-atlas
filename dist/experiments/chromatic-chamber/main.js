import {paintChamber} from './painter.mjs';
import {defaults,makeChamber,polygonAt,clipWedge,colorFor} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),p={...defaults};
const specs=[['symmetry','Rotational symmetry',3,32,1],['sides','Polygon sides',3,8,1],['density','Glass density',.3,2.5,.05],['size','Shard radius',.035,.14,.005],['drift','Drift amplitude',0,.24,.005],['duration','Loop duration · seconds',8,120,1],['zoom','Magnification',.65,2,.01]];
let phase=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,chamber=[],last=performance.now(),recording=null,recordStart=0,recordDuration=0,frames=0,fpsStart=last;
const share=new URLSearchParams(location.search);
for(const [key,,min,max] of specs){const v=Number(share.get(key));if(share.has(key)&&Number.isFinite(v))p[key]=Math.min(max,Math.max(min,v));}
p.symmetry=Math.round(p.symmetry);p.sides=Math.round(p.sides);
if(share.has('seed')&&Number.isFinite(Number(share.get('seed'))))p.seed=Number(share.get('seed'))>>>0;
if(['jewel','ember','lagoon','porcelain'].includes(share.get('palette')))p.palette=share.get('palette');
p.rotation=share.get('rotation')==='1'?1:0;p.mirrors=share.get('mirrors')==='1';
if(share.size){const v=Number(share.get('phase'));phase=Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;playing=false;}
for(const [key,label,min,max,step] of specs){const l=document.createElement('label');l.textContent=label;const out=document.createElement('output');out.id=key+'Value';l.append(out);const input=document.createElement('input');Object.assign(input,{id:key,type:'range',min,max,step,value:p[key]});input.setAttribute('aria-label',label);input.oninput=()=>{p[key]=Number(input.value);if(['symmetry','density','size','drift'].includes(key))rebuild();sync();};l.append(input);$('sliders').append(l);}
function rebuild(){chamber=makeChamber(p);}
function sync(){for(const [key,,,,step] of specs){$(key).value=p[key];$(key+'Value').value=p[key].toFixed(step===1?0:3);}for(const key of ['rotation','mirrors'])$(key).checked=!!p[key];$('seed').value=p.seed;$('palette').value=p.palette;$('play').textContent=playing?'Pause':'Play';}
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
addEventListener('resize',resize);resize();rebuild();sync();
function render(){
 const polygons=chamber.map(g=>({points:clipWedge(polygonAt(g,p,phase),p.symmetry),color:colorFor(g,p)})).filter(g=>g.points.length>2);
 paintChamber(canvas,polygons,p,phase);
 $('phase').value=phase;$('phaseValue').value=`${(phase*100).toFixed(1)}%`;
}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(recording)phase=Math.min(1,(now-recordStart)/recordDuration);else if(playing&&!document.hidden)phase=(phase+dt/p.duration)%1;render();if(recording&&phase>=1)recording.stop();frames++;if(now-fpsStart>1000){$('meter').textContent=`${p.symmetry} FOLD · ${Math.round(frames*1000/(now-fpsStart))} FPS`;frames=0;fpsStart=now;}requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function play(){if(recording)return;playing=!playing;sync();}
$('play').onclick=play;canvas.onclick=play;$('reset').onclick=()=>{phase=0;};$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;sync();};
for(const key of ['rotation','mirrors'])$(key).onchange=()=>{p[key]=key==='rotation'?Number($(key).checked):$(key).checked;};
$('palette').onchange=()=>{p.palette=$('palette').value;};
$('seed').onchange=()=>{p.seed=Number($('seed').value)>>>0;phase=0;rebuild();sync();};
$('new').onclick=()=>{p.seed=crypto.getRandomValues(new Uint32Array(1))[0];phase=0;rebuild();sync();};
const presets={jewel:{},ember:{symmetry:9,sides:3,size:.105,density:1.3,drift:.14,palette:'ember',seed:42},lagoon:{symmetry:16,sides:6,size:.065,density:1.15,drift:.1,palette:'lagoon',seed:314159},porcelain:{symmetry:8,sides:4,size:.085,density:.8,drift:.12,palette:'porcelain',seed:161803}};
$('preset').onchange=()=>{Object.assign(p,defaults,presets[$('preset').value]);phase=0;rebuild();sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();play();}});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable in this frame. Open the study separately.';}};
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('png').onclick=()=>{render();canvas.toBlob(b=>{if(b)download(b,'chromatic-chamber.png');});};
function sceneURL(at=phase){const url=new URL(location.href);url.search='';for(const [key,value] of Object.entries(p))url.searchParams.set(key,typeof value==='boolean'?Number(value):value);url.searchParams.set('phase',at.toFixed(6));return url.href;}
$('link').onclick=async()=>{try{await navigator.clipboard.writeText(sceneURL());$('status').textContent='Scene link copied · settings, seed and paused frame.';}catch{$('status').textContent='Copy this scene URL:';const input=document.createElement('input');input.value=sceneURL();input.setAttribute('aria-label','Scene URL');$('status').append(input);input.select();}};
$('record').onclick=()=>{
 if(recording){recording.stop();return;}
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>window.MediaRecorder?.isTypeSupported(x));
 if(!mime||!canvas.captureStream){$('status').textContent='WebM recording is unavailable in this browser. Save a PNG or use screen capture.';return;}
 const stream=canvas.captureStream(30),chunks=[],wasPlaying=playing,link=sceneURL(0);
 try{recording=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:24000000});}catch{stream.getTracks().forEach(t=>t.stop());recording=null;$('status').textContent='Could not start recording.';return;}
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide','full'].includes(e.id));controls.forEach(e=>e.disabled=true);
 recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recording.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(chunks.length){download(new Blob(chunks,{type:mime}),'chromatic-chamber-loop.webm');download(new Blob([link+'\n'],{type:'text/plain'}),'chromatic-chamber-scene-url.txt');}recording=null;playing=wasPlaying;controls.forEach(e=>e.disabled=false);$('record').textContent='Record loop';$('status').textContent='Capture saved · real-time 30 fps target';sync();};
 recording.onerror=()=>{$('status').textContent='Recording interrupted.';};phase=0;playing=false;render();recordDuration=p.duration*1000;recordStart=performance.now();recording.start();$('record').textContent='Stop recording';$('status').textContent='Recording one loop · scene only';sync();
};
