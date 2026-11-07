import {defaults,angleAt,makeField,bounds,colorAt} from './core.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),p={...defaults};
const specs=[['steps','Steps',101,800,1],['filaments','Color filaments',4,64,1],['spread','Angle spread',0,2,.01],['width','Stroke width',.4,4,.1],['duration','Loop duration · seconds',12,120,1],['zoom','Magnification',.5,2,.01]];
let phase=0,manual=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=performance.now(),exportController=null;
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
let paintKey='';
function paint(target,angle,scene,{fit=.82}={}) {
 const g=target.getContext('2d',{alpha:false}),w=target.width,h=target.height;
 const paths=makeField(angle,scene),bb=bounds(paths);
 g.setTransform(1,0,0,1,0,0);
 g.fillStyle=scene.palette==='neon'?'#080a16':'#f6f2f7';g.fillRect(0,0,w,h);
 const scale=Math.min(w,h)*fit*scene.zoom/bb.size;
 g.setTransform(scale,0,0,scale,w/2-bb.x*scale,h/2-bb.y*scale);
 g.lineCap='round';g.lineJoin='round';
 // Scale strokes with output dimensions rather than preserving viewport pixel sizes.
 const strokePixels=scene.width*Math.min(w,h)/1080; // Pixel width at a 1080px short side.
 g.lineWidth=strokePixels/scale;g.globalAlpha=scene.mode==='original'?1:.8;
 for(let j=0;j<paths.length;j++) {
  const path=paths[j];
  for(let k=1;k<path.length;k++) {
   g.strokeStyle=colorAt(k/(path.length-1),j,scene);
   g.beginPath();g.moveTo(...path[k-1]);g.lineTo(...path[k]);g.stroke();
  }
 }
 g.globalAlpha=1;g.setTransform(1,0,0,1,0,0);
}
function render(){
 const angle=manual??angleAt(phase);
 const key=[angle,phase,...Object.values(p),canvas.width,canvas.height].join(',');
 if(key===paintKey)return;
 paintKey=key;paint(canvas,angle,p);
 $('turn').value=angle;$('turnValue').value=angle.toFixed(2)+'°';
 $('angleValue').textContent=angle.toFixed(2)+'°';
 $('shape').textContent=angle>89.99?'SQUARE':angle<.01?'LINE':'UNWINDING';
 $('phase').value=phase;$('phaseValue').value=(phase*100).toFixed(1)+'%';
}
function animate(now){
 const dt=Math.min((now-last)/1000,.1);last=now;
 if(playing&&!document.hidden)phase=(phase+dt/p.duration)%1;
 render();requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
function play(){if(exportController)return;if(manual!==null){const t=1-Math.log1p(manual/90*Math.expm1(3.2))/3.2;phase=Math.acos(Math.max(-1,Math.min(1,1-2*t)))/(2*Math.PI);manual=null;}playing=!playing;sync();}
$('play').onclick=play;canvas.onclick=play;
function setAngle(angle){if(exportController)return;manual=angle;playing=false;sync();}
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
$('record').onclick=async()=>{
 if(exportController){exportController.abort();$('status').textContent='Canceling export…';return;}
 const controller=new AbortController();exportController=controller;
 const size=Number($('exportSize').value),fps=Number($('exportFps').value);
 const scene={...p},wasPlaying=playing;
 const link=new URL(sceneURL(0));link.searchParams.delete('angle');
 playing=false;sync();
 const controls=[...document.querySelectorAll('aside input,aside select,aside button')]
   .filter(e=>!['record','hide','full'].includes(e.id));
 controls.forEach(e=>e.disabled=true);
 $('record').textContent='Cancel export';
 $('status').textContent='Loading deterministic MP4 encoder…';
 try {
  const FrameWrap=await loadFrameWrap();
  if(controller.signal.aborted){$('status').textContent='Export canceled';return;}
  const blob=await exportFrames({
   width:size,height:size,fps,duration:scene.duration,format:'mp4',
   bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),
   createRecorder:options=>new FrameWrap(options),
   draw:({canvas:output,phase:position})=>paint(output,angleAt(position),scene,{fit:.96}),
   signal:controller.signal,
   onProgress:(done,total)=>{
    if(done===1||done%10===0||done===total)
     $('status').textContent='Encoding '+done+'/'+total+' frames · '+size+'² · '+fps+' fps';
   },
  });
  if(controller.signal.aborted){$('status').textContent='Export canceled';return;}
  download(blob,'chromatic-unwinding-'+size+'p-'+fps+'fps.mp4');
  download(new Blob([link+'\n'],{type:'text/plain'}),'chromatic-unwinding-scene-url.txt');
  $('status').textContent='MP4 exported · '+size+'×'+size+' · '+fps+' fps · exact frame steps';
 }catch(e){
  $('status').textContent=e.name==='AbortError'?'Export canceled':'Export failed: '+e.message;
  if(e.name!=='AbortError')console.error(e);
 }finally{
  exportController=null;playing=wasPlaying;controls.forEach(e=>e.disabled=false);
  $('record').textContent='Export MP4';sync();
 }
};
