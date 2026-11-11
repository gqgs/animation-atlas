import * as THREE from '../../vendor/0.180.0/build/three.module.js';
import {fragmentShader} from './shader.js';
const $=id=>document.getElementById(id),canvas=$('scene');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});}catch(e){$('status').textContent='WebGL2 is unavailable. Enable hardware acceleration to run this study.';throw e;}
renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const values={zoom:.23,spacing:1,bounces:48,reflectivity:.94,exposure:1.8,pearl:0,aimX:0,aimY:0,amplitude:.07};
const specs=[['zoom','Field of view',.025,.7,.001],['spacing','Sphere spacing',1,1.18,.001],['bounces','Reflection limit',1,128,1],['reflectivity','Mirror retention',.5,1,.001],['exposure','Radiance',.2,5,.01],['pearl','Pearlescence',0,1,.01],['aimX','Aim · horizontal',-.45,.45,.001],['aimY','Aim · vertical',-.45,.45,.001],['amplitude','Motion amplitude',0,.2,.001]];
for(const [key,label,min,max,step] of specs){const l=document.createElement('label');l.textContent=label;const o=document.createElement('output');o.id=key+'Value';l.append(o);const input=document.createElement('input');Object.assign(input,{type:'range',id:key,min,max,step,value:values[key]});input.setAttribute('aria-label',label);input.oninput=()=>{values[key]=Number(input.value);sync();};l.append(input);$('sliders').append(l);}
function sync(){for(const [key] of specs){$(key).value=values[key];$(key+'Value').value=Number(values[key]).toFixed(key==='bounces'?0:3);}}
sync();
const uniforms={resolution:{value:new THREE.Vector2()},aim:{value:new THREE.Vector2()},zoom:{value:.23},spacing:{value:1},bounces:{value:48},reflectivity:{value:.94},exposure:{value:1.8},pearl:{value:0},mode:{value:0},roll:{value:0},orbit:{value:0}};
const scene=new THREE.Scene(),camera=new THREE.Camera(),material=new THREE.ShaderMaterial({uniforms,fragmentShader,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}'});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,phase=0,last=performance.now(),recorder=null,recordStart=0,frames=0,fpsStart=last;
function resize(){renderer.setPixelRatio(Number($('quality').value));renderer.setSize(innerWidth,innerHeight,false);uniforms.resolution.value.set(canvas.width,canvas.height);}
addEventListener('resize',resize);$('quality').onchange=resize;resize();
function render(){const t=phase*Math.PI*2,motion=$('motion').value.split('+'),a=values.amplitude;for(const key of ['spacing','bounces','reflectivity','exposure','pearl'])uniforms[key].value=values[key];uniforms.mode.value=Number($('mode').value);uniforms.aim.value.set(values.aimX+(motion.includes('orbit')?a*Math.cos(t):0),values.aimY+(motion.includes('orbit')?a*Math.sin(t):0));uniforms.orbit.value=motion.includes('orbit')?t:0;uniforms.roll.value=motion.includes('roll')?t:0;uniforms.zoom.value=values.zoom*(motion.includes('breathe')?Math.exp(a*3*Math.sin(t)):1);renderer.render(scene,camera);}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(recorder){const elapsed=(now-recordStart)/1000;phase=Math.min(elapsed/Number($('duration').value),1);}else if(playing)phase=(phase+dt/Number($('duration').value))%1;$('phase').value=phase;render();if(recorder&&phase>=1)recorder.stop();frames++;if(now-fpsStart>1000){$('meter').textContent=`${Math.round(frames*1000/(now-fpsStart))} FPS · ${canvas.width} × ${canvas.height}`;frames=0;fpsStart=now;}requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function play(){if(recorder)return;playing=!playing;$('play').textContent=playing?'Pause':'Play';}$('play').textContent=playing?'Pause':'Play';$('play').onclick=play;$('reset').onclick=()=>{phase=0;};$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;$('play').textContent='Play';};
const presets={prism:{zoom:.23,pearl:0,exposure:1.8,aimX:0,aimY:0,amplitude:.07,mode:0,motion:'orbit'},pearl:{zoom:.29,pearl:1,exposure:2.6,aimX:0,aimY:0,amplitude:.04,mode:0,motion:'breathe'},edge:{zoom:.11,pearl:0,exposure:2.2,aimX:.24,aimY:-.13,amplitude:.025,mode:0,motion:'orbit'},map:{zoom:.23,pearl:0,exposure:1.8,aimX:0,aimY:0,amplitude:0,mode:1,motion:'still'}};
$('preset').onchange=()=>{const p=presets[$('preset').value];Object.assign(values,{spacing:1,bounces:48,reflectivity:.94},p);$('mode').value=p.mode;$('motion').value=p.motion;phase=0;sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}$('hide').onclick=hide;$('show').onclick=hide;$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable here. Open the study directly in a tab.';}};
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();play();}});
let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ax:values.aimX,ay:values.aimY};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag||recorder)return;values.aimX=THREE.MathUtils.clamp(drag.ax-(e.clientX-drag.x)/innerHeight*values.zoom*3,-.45,.45);values.aimY=THREE.MathUtils.clamp(drag.ay+(e.clientY-drag.y)/innerHeight*values.zoom*3,-.45,.45);sync();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();if(recorder)return;values.zoom=THREE.MathUtils.clamp(values.zoom*Math.exp(e.deltaY*.001),.025,.7);sync();};
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('png').onclick=()=>{render();canvas.toBlob(b=>{if(b)download(b,'wada-mirrors.png');});};
$('record').onclick=()=>{
 if(recorder){recorder.stop();return;}
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>window.MediaRecorder?.isTypeSupported(x));
 if(!mime||!canvas.captureStream){$('status').textContent='WebM recording is unavailable in this browser. Use screen capture or save a PNG.';return;}
 const stream=canvas.captureStream(30),chunks=[];
 try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:24000000});}catch{stream.getTracks().forEach(t=>t.stop());recorder=null;$('status').textContent='Recording could not start in this browser.';return;}
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide','full'].includes(e.id));controls.forEach(e=>e.disabled=true);
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());download(new Blob(chunks,{type:mime}),'wada-loop.webm');recorder=null;controls.forEach(e=>e.disabled=false);$('record').textContent='Record loop';$('status').textContent='Video saved · real-time 30 fps target · 24 Mbps requested';};recorder.onerror=()=>{$('status').textContent='Recording failed. Try a lower render scale.';};phase=0;recordStart=performance.now();recorder.start();$('record').textContent='Stop recording';$('status').textContent='Recording one loop from its start; the video contains only the scene.';
};
