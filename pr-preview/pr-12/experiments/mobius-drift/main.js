import * as THREE from '../../vendor/0.180.0/build/three.module.js';
import {defaults,poleAt,validateState} from './core.mjs';
import {fragmentShader} from './shader.js';
const $=id=>document.getElementById(id),canvas=$('scene'),p={...defaults};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});}catch(e){$('status').textContent='WebGL2 is unavailable. Enable hardware acceleration to run this study.';throw e;}
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const specs=[['duration','Loop duration · seconds',20,300,1],['radius','Path radius',0,.8,.005],['cx','Center · real',-.65,.65,.005],['cy','Center · imaginary',-.65,.65,.005],['fx','Lissajous · x frequency',1,5,1],['fy','Lissajous · y frequency',1,5,1],['offset','Lissajous · phase offset',0,1,.01],['zoom','View extent',.5,3,.01],['density','Tile density',.15,2,.01],['bands','Decoration bands',1,12,1],['rotation','Tiling rotation · degrees',0,360,1]];
for(const [key,label,min,max,step] of specs){const l=document.createElement('label');l.textContent=label;const out=document.createElement('output');out.id=key+'Value';l.append(out);const input=document.createElement('input');Object.assign(input,{type:'range',id:key,min,max,step,value:p[key]});input.setAttribute('aria-label',label);input.oninput=()=>{p[key]=Number(input.value);sync();};l.append(input);$('sliders').append(l);}
const uniforms={resolution:{value:new THREE.Vector2()},pole:{value:new THREE.Vector2()},zoom:{value:p.zoom},density:{value:p.density},bands:{value:p.bands},rotation:{value:0},pattern:{value:0},palette:{value:0}};
const scene=new THREE.Scene(),camera=new THREE.Camera(),material=new THREE.ShaderMaterial({uniforms,fragmentShader,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}'});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,phase=0,last=performance.now(),recorder=null,recordStart=0,recordDuration=0,frames=0,fpsStart=last;
function sync(){for(const [key,,,,step] of specs){$(key).value=p[key];$(key+'Value').value=p[key].toFixed(step===1?0:2);}for(const key of ['pattern','palette','motion'])$(key).value=p[key];$('play').textContent=playing?'Pause':'Play';}
for(const key of ['pattern','palette','motion'])$(key).onchange=()=>{p[key]=key==='motion'?$(key).value:Number($(key).value);};
function resize(){renderer.setPixelRatio(Number($('quality').value));renderer.setSize(innerWidth,innerHeight,false);uniforms.resolution.value.set(canvas.width,canvas.height);}
addEventListener('resize',resize);$('quality').onchange=resize;resize();sync();
function render(){const pole=poleAt(p,phase);uniforms.pole.value.set(...pole);for(const key of ['zoom','density','bands','pattern','palette'])uniforms[key].value=p[key];uniforms.rotation.value=p.rotation*Math.PI/180;renderer.render(scene,camera);$('position').textContent=`z₀ = ${pole[0].toFixed(3)} ${pole[1]<0?'−':'+'} ${Math.abs(pole[1]).toFixed(3)}i`;}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(recorder?.state==='recording'){phase=Math.min((now-recordStart)/(1000*recordDuration),1);}else if(playing)phase=(phase+dt/p.duration)%1;$('phase').value=phase;render();if(recorder?.state==='recording'&&phase>=1)recorder.stop();if(now-fpsStart>1000){$('meter').textContent=`${Math.round(frames*1000/(now-fpsStart))} FPS · ${canvas.width} × ${canvas.height}`;frames=0;fpsStart=now;}frames++;requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function play(){if(recorder)return;playing=!playing;sync();}$('play').onclick=play;$('reset').onclick=()=>{phase=0;};$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;sync();};
const presets={tide:{},petals:{pattern:1,bands:10,palette:1,radius:.3,density:.55},braid:{motion:'lissajous',pattern:2,radius:.45,density:.75,bands:4,fx:2,fy:3,duration:180},etch:{palette:2,pattern:0,bands:7,radius:.55,density:1}};
$('preset').onchange=()=>{Object.assign(p,defaults,presets[$('preset').value]);phase=0;sync();};
canvas.onpointerdown=e=>{if(recorder)return;const r=canvas.getBoundingClientRect();p.cx=THREE.MathUtils.clamp((2*(e.clientX-r.left)-r.width)/r.height*p.zoom,-.65,.65);p.cy=THREE.MathUtils.clamp((r.height-2*(e.clientY-r.top))/r.height*p.zoom,-.65,.65);sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}$('hide').onclick=hide;$('show').onclick=hide;
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable here. Open the study separately.';}};
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();play();}});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function snapshot(at=phase){return {study:'mobius-drift',version:1,parameters:{...p},phase:at};}
function saveState(state=snapshot()){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'mobius-drift-parameters.json');}
$('save').onclick=()=>saveState();$('load').onclick=()=>$('file').click();
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>100000)throw Error('File too large');const state=validateState(JSON.parse(await f.text()));Object.assign(p,state.parameters);phase=state.phase;playing=false;sync();$('status').textContent='Parameters restored · paused at saved phase';}catch(e){$('status').textContent='Could not load parameters: '+e.message;}$('file').value='';};
$('png').onclick=()=>{render();canvas.toBlob(b=>{if(b)download(b,'mobius-drift.png');});};
$('record').onclick=()=>{
 if(recorder){if(recorder.state==='recording')recorder.stop();return;}
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>window.MediaRecorder?.isTypeSupported(x));
 if(!mime||!canvas.captureStream){$('status').textContent='WebM recording is unavailable. Save a PNG or use screen capture.';return;}
 const stream=canvas.captureStream(30),chunks=[],state=snapshot(0),wasPlaying=playing;
 try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:24000000});}catch{stream.getTracks().forEach(t=>t.stop());recorder=null;$('status').textContent='Recording could not start.';return;}
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide','full'].includes(e.id));controls.forEach(e=>e.disabled=true);
 let failed=false;
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(chunks.length){download(new Blob(chunks,{type:mime}),'mobius-drift-loop.webm');saveState(state);}recorder=null;playing=wasPlaying;controls.forEach(e=>e.disabled=false);sync();$('record').textContent='Record loop';$('status').textContent=failed?'Recording interrupted. Try a lower render scale.':'Video and parameters saved · real-time 30 fps target';};
 recorder.onerror=()=>{failed=true;};phase=0;playing=false;render();recordDuration=p.duration;recordStart=performance.now();recorder.start();$('record').textContent='Stop recording';$('status').textContent='Recording one loop from zero · scene only';
};
