import {defaults,angleAt,makeField,bounds,colorAt} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false}),p={...defaults};
const specs=[['steps','Steps',101,800,1],['filaments','Color filaments',4,64,1],['spread','Angle spread',0,2,.01],['width','Stroke width',.4,4,.1],['duration','Loop duration · seconds',12,120,1],['zoom','Magnification',.5,2,.01]];
let phase=0,manual=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now(),recording=null,recordStart=0,recordDuration=0;
const share=new URLSearchParams(location.search);
for(const [key,,min,max,step] of specs){const v=Number(share.get(key));if(share.has(key)&&Number.isFinite(v))p[key]=Math.max(min,Math.min(max,step===1?Math.round(v):v));}
if(['iridescent','lagoon','neon'].includes(share.get('palette')))p.palette=share.get('palette');
if(share.get('mode')==='original')p.mode='original';
if(share.size){const v=Number(share.get('phase'));phase=Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;playing=false;}
if(share.has('angle')&&Number.isFinite(Number(share.get('angle'))))manual=Math.max(0,Math.min(90,Number(share.get('angle'))));
for(const [key,label,min,max,step] of specs){const l=document.createElement('label');l.textContent=label;const out=document.createElement('output');out.id=key+'Value';l.append(out);const input=document.createElement('input');Object.assign(input,{id:key,type:'range',min,max,step,value:p[key]});input.setAttribute('aria-label',label);input.oninput=()=>{p[key]=Number(input.value);sync();};l.append(input);$('sliders').append(l);}
function sync(){for(const [key,,,,step] of specs){$(key).value=p[key];$(key+'Value').value=p[key].toFixed(step===1?0:2);}for(const key of ['mode','palette'])$(key).value=p[key];$('play').textContent=playing?'Pause':'Play';}
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
addEventListener('resize',resize);resize();sync();
let cachedKey='',paintKey='',paths=[],box;
function render(){
 const angle=manual??angleAt(phase),w=canvas.width,h=canvas.height,dpr=w/innerWidth;
 const key=[angle,p.steps,p.filaments,p.spread,p.mode].join(',');
 const nextPaint=[key,phase,p.palette,p.width,p.zoom,w,h].join(',');
 if(nextPaint===paintKey)return;paintKey=nextPaint;
 if(key!==cachedKey){paths=makeField(angle,p);box=bounds(paths);cachedKey=key;}
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=p.palette==='neon'?'#080a16':'#f6f2f7';ctx.fillRect(0,0,w,h);
 const scale=Math.min(w,h)*.82*p.zoom/box.size;
 ctx.setTransform(scale,0,0,scale,w/2-box.x*scale,h/2-box.y*scale);ctx.lineCap='round';ctx.lineJoin='round';
 // Color varies along the path and between close angular trajectories.
 ctx.lineWidth=p.width*dpr/scale;ctx.globalAlpha=p.mode==='original'?1:.8;
 for(let j=0;j<paths.length;j++){
  const path=paths[j];
  for(let k=1;k<path.length;k++){
   ctx.strokeStyle=colorAt(k/(path.length-1),j,p);ctx.beginPath();ctx.moveTo(...path[k-1]);ctx.lineTo(...path[k]);ctx.stroke();
  }
 }
 ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
 $('turn').value=angle;$('turnValue').value=angle.toFixed(2)+'°';$('angleValue').textContent=angle.toFixed(2)+'°';$('shape').textContent=angle>89.99?'SQUARE':angle<.01?'LINE':'UNWINDING';$('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';
}
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;if(recording)phase=Math.min(1,(now-recordStart)/recordDuration);else if(playing&&!document.hidden)phase=(phase+dt/p.duration)%1;render();if(recording&&phase>=1&&recording.state==='recording')recording.stop();requestAnimationFrame(animate);}
requestAnimationFrame(animate);
function play(){if(recording)return;if(manual!==null){const t=1-Math.log1p(manual/90*Math.expm1(3.2))/3.2;phase=Math.acos(Math.max(-1,Math.min(1,1-2*t)))/(2*Math.PI);manual=null;}playing=!playing;sync();}
$('play').onclick=play;canvas.onclick=play;
function setAngle(angle){if(recording)return;manual=angle;playing=false;sync();}
$('turn').oninput=()=>setAngle(Number($('turn').value));
for(const [id,angle] of [['square',90],['spiral',20],['line',0]])$(id).onclick=()=>setAngle(angle);
$('reset').onclick=()=>{phase=0;manual=null;sync();};
$('phase').oninput=()=>{phase=Number($('phase').value);manual=null;playing=false;sync();};
for(const key of ['mode','palette'])$(key).onchange=()=>{p[key]=$(key).value;};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();play();}});
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='Fullscreen is unavailable in this frame. Open the study separately.';}};
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('png').onclick=()=>{render();canvas.toBlob(b=>{if(b)download(b,'chromatic-unwinding.png');});};
function sceneURL(at=phase){const url=new URL(location.href);url.search='';for(const [key,value] of Object.entries(p))url.searchParams.set(key,typeof value==='boolean'?Number(value):value);url.searchParams.set('phase',at.toFixed(6));if(manual!==null)url.searchParams.set('angle',manual);return url.href;}
$('link').onclick=async()=>{try{await navigator.clipboard.writeText(sceneURL());$('status').textContent='Scene link copied · settings and paused frame.';}catch{$('status').textContent='Copy this scene URL:';const input=document.createElement('input');input.value=sceneURL();input.setAttribute('aria-label','Scene URL');$('status').append(input);input.select();}};
$('record').onclick=()=>{
 if(recording){recording.stop();return;}
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>window.MediaRecorder?.isTypeSupported(x));
 if(!mime||!canvas.captureStream){$('status').textContent='WebM recording is unavailable in this browser. Save a PNG or use screen capture.';return;}
 const stream=canvas.captureStream(30),chunks=[],wasPlaying=playing,link=new URL(sceneURL(0));link.searchParams.delete('angle');
 try{recording=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:24000000});}catch{stream.getTracks().forEach(t=>t.stop());recording=null;$('status').textContent='Could not start recording.';return;}
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide','full'].includes(e.id));controls.forEach(e=>e.disabled=true);
 recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recording.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(chunks.length){download(new Blob(chunks,{type:mime}),'chromatic-unwinding-loop.webm');download(new Blob([link+'\n'],{type:'text/plain'}),'chromatic-unwinding-scene-url.txt');}recording=null;playing=wasPlaying;controls.forEach(e=>e.disabled=false);$('record').textContent='Record loop';$('status').textContent='Capture saved · real-time 30 fps target';sync();};
 recording.onerror=()=>{$('status').textContent='Recording interrupted.';};phase=0;manual=null;playing=false;render();recordDuration=p.duration*1000;recordStart=performance.now();recording.start();$('record').textContent='Stop recording';$('status').textContent='Recording one loop · scene only';sync();
};
