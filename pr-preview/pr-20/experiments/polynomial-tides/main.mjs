import {references,decodeSeed,inspectSeed,buildOrbit,randomSeed} from './core.mjs';
import {makePainter} from './painter.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';

const $=id=>document.getElementById(id);
const canvas=$('scene');
const settings={palette:'porcelain',strands:22,trail:300,density:.55,drift:.8,width:.85,zoom:1,duration:26};
const specs=[
  ['strands',8,44,1],['trail',100,720,10],['density',.05,1,.05],['drift',0,2,.05],
  ['width',.35,2.5,.05],['zoom',.7,1.4,.01],['duration',8,90,1],
];
const params=new URLSearchParams(location.search);
for(const [key,min,max,step] of specs)if(params.has(key)){
  const value=Number(params.get(key));
  if(Number.isFinite(value))settings[key]=Math.max(min,Math.min(max,step===1?Math.round(value):value));
}
if(['porcelain','nocturne','ember'].includes(params.get('palette')))settings.palette=params.get('palette');
let phase=Math.max(0,Math.min(1,Number(params.get('phase'))||0));
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!params.has('phase');
let last=performance.now(),seed=references[0],orbit=null,paint=null,searchToken=0,attempts=0,exportController=null;
let dirty=true,rebuildTimer=null;
const seen=new Set(references);
const storageKey='eigendynamics-polynomial-tides-saved-v1';
let saved=[];
try{
  saved=JSON.parse(localStorage.getItem(storageKey)||'[]')
    .filter(value=>typeof value==='string'&&/^[A-Y]{12}$/.test(value)).slice(-100);
}catch{}
for(const item of saved)seen.add(item);
function refreshSaved(){
  $('saved').replaceChildren(new Option('Choose a saved seed…',''));
  for(const code of [...saved].reverse())$('saved').add(new Option(code,code));
}
refreshSaved();
for(const code of references)$('references').add(new Option(code,code));
function remember(code){
  if(!saved.includes(code)){
    saved.push(code);if(saved.length>100)saved.shift();
    try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}
    refreshSaved();
  }
  seen.add(code);
}
function status(message){$('status').textContent=message;}
function sync(){
  $('palette').value=settings.palette;
  for(const [key,,,step] of specs){
    $(key).value=settings[key];
    $(key+'Value').textContent=Number(settings[key]).toFixed(step===1?0:2);
  }
  $('phase').value=phase;$('phaseValue').textContent=(phase*100).toFixed(1)+'%';
  $('play').textContent=playing?'Pause':'Play';
}
function resize(){
  // Keep the live preview lightweight on 4K displays. Exports still
  // rasterize directly at the user's selected 720/1080/2160 resolution.
  const ratio=Math.min(devicePixelRatio||1,1.5,2200/Math.max(1,innerWidth),1400/Math.max(1,innerHeight));
  canvas.width=Math.max(1,Math.round(innerWidth*ratio));
  canvas.height=Math.max(1,Math.round(innerHeight*ratio));
  dirty=true;
}
addEventListener('resize',resize);resize();
function load(code,{announce=true}={}){
  try{
    const normalized=String(code).trim().toUpperCase();
    decodeSeed(normalized);
    const next=buildOrbit(normalized);
    const inspection=inspectSeed(normalized,{steps:6500,burn:800});
    orbit=next;seed=normalized;resetPainter();
    $('seed').value=seed;$('code').textContent=seed;
    $('metric').textContent=inspection.accepted?'BOUNDED · STRETCHING':'BOUNDED · NOT CLASSIFIED';
    $('lambda').textContent=inspection.lambda===null?'—':inspection.lambda.toFixed(4);
    $('occupancy').textContent=inspection.occupancy+' / 576';
    $('references').value=references.includes(seed)?seed:'';
    if(announce)status(seed+' · '+(inspection.accepted?'promising strange-attractor candidate':'bounded orbit; chaos not established')+'.');
    return true;
  }catch(error){
    status('Could not load '+String(code).toUpperCase()+': '+error.message);
    return false;
  }
}
function resetPainter(){
  clearTimeout(rebuildTimer);rebuildTimer=null;
  if(orbit){paint=makePainter(orbit,{...settings});dirty=true;}
}
function schedulePainter(){
  // A slider can emit dozens of input events in one drag. Rebuild the cached
  // geometry after a short pause rather than on every pointer movement.
  clearTimeout(rebuildTimer);
  rebuildTimer=setTimeout(resetPainter,130);
}
sync();
load(params.get('seed')||references[0]);
if(!orbit)load(references[0]);
function draw(target,t=phase,renderer=paint){if(renderer)renderer(target,t);}
function frame(now){
  const dt=Math.min(.10,Math.max(0,(now-last)/1000));last=now;
  if(playing&&!document.hidden&&!exportController)phase=(phase+dt/settings.duration)%1;
  if(playing&&!document.hidden&&!exportController)dirty=true;
  if(dirty&&!document.hidden){
    draw(canvas,phase);dirty=false;
    $('phase').value=phase;$('phaseValue').textContent=(phase*100).toFixed(1)+'%';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function pauseToggle(){
  if(exportController)return;
  playing=!playing;sync();
}
$('play').onclick=pauseToggle;canvas.onclick=pauseToggle;
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;dirty=true;sync();};
for(const [key] of specs){
  $(key).oninput=()=>{
    if(exportController)return;
    settings[key]=Number($(key).value);
    sync();if(key!=='duration')schedulePainter();
  };
  $(key).onchange=()=>{if(key!=='duration'&&!exportController)resetPainter();};
}
$('palette').onchange=()=>{if(!exportController){settings.palette=$('palette').value;resetPainter();}};
$('apply').onclick=()=>{if(!exportController){searchToken++;$('discover').textContent='Discover new';load($('seed').value);}};
$('seed').onkeydown=event=>{if(event.key==='Enter'){$('apply').click();}};
$('references').onchange=()=>{if($('references').value&&!exportController){searchToken++;load($('references').value);$('discover').textContent='Discover new';}};
$('saved').onchange=()=>{if($('saved').value&&!exportController){searchToken++;load($('saved').value);$('discover').textContent='Discover new';}};
$('favorite').onclick=()=>{remember(seed);status('Saved '+seed+' in this browser. Copy its scene URL for portable sharing.');};
function sceneURL(){
  const url=new URL(location.href);url.search='';
  url.searchParams.set('seed',seed);
  for(const [key,value] of Object.entries(settings))url.searchParams.set(key,String(value));
  url.searchParams.set('phase',phase.toFixed(6));
  return url.href;
}
async function copy(text,success){
  try{await navigator.clipboard.writeText(text);status(success);}
  catch{const temp=document.createElement('input');temp.value=text;temp.setAttribute('aria-label','Copy manually');
    $('status').replaceChildren('Copy manually: ',temp);temp.select();}
}
$('copySeed').onclick=()=>copy(seed,'Copied '+seed+'.');
$('copyLink').onclick=()=>copy(sceneURL(),'Scene URL copied with the seed, settings and paused frame.');
$('discover').onclick=async()=>{
  if(exportController)return;
  if($('discover').textContent==='Stop search'){
    searchToken++;$('discover').textContent='Discover new';status('Discovery stopped after '+attempts+' candidates.');return;
  }
  const token=++searchToken;let tried=0,secondPass=0;
  $('discover').textContent='Stop search';
  status('Searching the 25¹² coefficient space…');
  // Time-slice the CPU work so controls, painting and cancellation stay usable.
  try{
    while(token===searchToken){
      for(let j=0;j<60&&token===searchToken;j++){
        const candidate=randomSeed();
        if(seen.has(candidate))continue;
        seen.add(candidate);attempts++;tried++;
        const first=inspectSeed(candidate,{steps:2800,burn:450});
        if(!first.accepted)continue;
        secondPass++;
        const confirmed=inspectSeed(candidate,{steps:9000,burn:1000});
        if(!confirmed.accepted)continue;
        if(load(candidate,{announce:false})){
          remember(candidate);playing=true;phase=0;sync();
          status('Discovered '+candidate+' after '+tried+' tries ('+secondPass+' second-pass candidates). Automatically saved locally. This heuristic does not establish historical novelty.');
          $('attempts').textContent=String(attempts);
          return;
        }
      }
      $('attempts').textContent=String(attempts);
      status('Screening candidates… '+tried+' checked · '+secondPass+' long-run tests · click Stop search to cancel.');
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  }catch(error){status('Discovery failed: '+error.message);}
  finally{if(token===searchToken)$('discover').textContent='Discover new';}
};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',event=>{
  if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName))return;
  if(event.code==='KeyH')hide();
  if(event.code==='Space'){event.preventDefault();pauseToggle();}
});
$('full').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();}
  catch{status('Fullscreen unavailable in this frame; open the study in a new tab.');}
};
function download(blob,name){
  const href=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=href;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(href),10000);
}
$('png').onclick=()=>{
  const size=Number($('exportSize').value),out=document.createElement('canvas');
  out.width=out.height=size;makePainter(orbit,{...settings})(out,phase);
  out.toBlob(blob=>{if(blob)download(blob,'polynomial-tides-'+seed+'.png');
    else status('PNG encoding failed.');},'image/png');
};
$('record').onclick=async()=>{
  if(exportController){exportController.abort();status('Canceling export…');return;}
  searchToken++;$('discover').textContent='Discover new';
  const controller=new AbortController();exportController=controller;
  const scene={...settings},snapshot=orbit,selectedSeed=seed;
  const size=Number($('exportSize').value),fps=Number($('exportFps').value);
  const renderer=makePainter(snapshot,scene),wasPlaying=playing;
  playing=false;sync();
  const controls=[...document.querySelectorAll('aside input,aside select,aside button')]
    .filter(el=>!['record','hide'].includes(el.id));
  controls.forEach(el=>el.disabled=true);
  $('record').textContent='Cancel export';
  status('Loading fixed-frame MP4 encoder…');
  try{
    const FrameWrap=await loadFrameWrap();
    if(controller.signal.aborted)throw new DOMException('Export canceled','AbortError');
    const blob=await exportFrames({
      width:size,height:size,duration:scene.duration,fps,
      format:'mp4',bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),
      createRecorder:options=>new FrameWrap(options),
      draw:({canvas:out,phase:position})=>renderer(out,position),
      signal:controller.signal,
      onProgress:(done,total)=>{if(done===1||done%10===0||done===total)
        status('Encoding '+done+'/'+total+' frames · '+size+'² · '+fps+' fps');},
    });
    if(controller.signal.aborted)throw new DOMException('Export canceled','AbortError');
    download(blob,'polynomial-tides-'+selectedSeed+'-'+size+'p-'+fps+'fps.mp4');
    status('Export completed · '+selectedSeed+' · '+size+'×'+size+' · '+fps+' fps.');
  }catch(error){
    status(error.name==='AbortError'?'Export canceled':'Export failed: '+error.message);
    if(error.name!=='AbortError')console.error(error);
  }finally{
    exportController=null;playing=wasPlaying;controls.forEach(el=>el.disabled=false);
    $('record').textContent='Export MP4';sync();
  }
};
