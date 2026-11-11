import {createParameterControl} from '../../shared/parameter-controls.mjs';
import {normalizeTracks,serializeTracks} from '../../shared/parameter-tracks.mjs';
import {trackDefinitions,readTracks,cameraAt} from './parameters.mjs?v=4';
import {presets,encode,decode,inspect,sample} from './core.mjs?v=4';
import {makePainter} from './painter.mjs?v=4';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
const $=id=>document.getElementById(id),canvas=$('scene');
const settings={palette:'pearl',framing:'core',exposure:1.6,zoom:.8,rotation:0,motion:.6,wave:.65,duration:24};
const specs=[['exposure',.2,4,.1],['zoom',.5,2,.01],['rotation',-180,180,1],['motion',0,1,.01],['wave',0,1,.01],['duration',8,90,1]];
const params=new URLSearchParams(location.search);
let tracks=readTracks(params);const cameraControls=new Map();
for(const [k,min,max] of specs){const v=Number(params.get(k));if(params.has(k)&&Number.isFinite(v))settings[k]=Math.max(min,Math.min(max,v));}
if(['pearl','copper','iris'].includes(params.get('palette')))settings.palette=params.get('palette');
if(params.get('framing')==='full')settings.framing='full';
let phase=Math.max(0,Math.min(1,Number(params.get('phase'))||0)),playing=!params.has('phase')&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed,orbit,paint,worker=null,controller=null,dirty=true,last=performance.now(),timer;
const storage='eigendynamics-wild-silk-v1';let saved=[];
try{saved=JSON.parse(localStorage.getItem(storage)||'[]').filter(s=>{try{decode(s);return true;}catch{return false;}}).slice(-100);}catch{}
const status=s=>$('status').textContent=s;
function refreshSaved(){
  $('saved').replaceChildren(new Option('Choose a saved seed…',''));
  saved.slice().reverse().forEach((s,i)=>$('saved').add(new Option('Saved '+(saved.length-i)+' · '+s.slice(-9),s)));
}
function remember(s){if(!saved.includes(s)){saved.push(s);saved=saved.slice(-100);try{localStorage.setItem(storage,JSON.stringify(saved));}catch{status('Browser storage unavailable; copy the scene URL to keep this seed.');}refreshSaved();}}
refreshSaved();presets.forEach(([name,a])=>$('presets').add(new Option(name,encode(a))));
for(const [key,label] of [['zoom','Zoom'],['rotation','Orientation']]){
  cameraControls.set(key,createParameterControl({parent:$('cameraControls'),key,label,
    definition:trackDefinitions[key],value:settings[key],track:tracks[key],
    onValue:value=>{settings[key]=value;paint?.setCamera(settings,tracks);dirty=true;sync();},
    onTrack:track=>{tracks=normalizeTracks({...tracks,[key]:track},trackDefinitions);paint?.setCamera(settings,tracks);dirty=true;sync();},
  }));
}
function syncCamera(){
  const pose=cameraAt(settings,tracks,phase);
  for(const [key,c]of cameraControls)c.sync({value:settings[key],track:tracks[key],resolved:pose[key],disabled:!!controller});
}
function sync(){
  for(const [k,,,step] of specs){if(cameraControls.has(k))continue;$(k).value=settings[k];$(k+'Value').textContent=settings[k].toFixed(step===1?0:2);}
  $('palette').value=settings.palette;$('framing').value=settings.framing;$('play').textContent=playing?'Pause':'Play';$('phase').value=phase;syncCamera();
}
function rebuild(){clearTimeout(timer);if(orbit)paint=makePainter(orbit,settings,tracks);dirty=true;}
function load(code){
  try{
    const a=decode(code.trim()),next=sample(a,1200000),m=inspect(a,16000);
    seed=encode(a);orbit=next;rebuild();$('seed').value=seed;$('presets').value=seed;
    $('metrics').textContent=m.lambda===undefined?'Bounded sample · unclassified':`λ ${m.lambda.toFixed(3)} · roundness ${(m.roundness*100).toFixed(0)}% · balance ${(m.balance*100).toFixed(0)}%`;
    $('coefficients').textContent=a.slice(0,7).join(', ')+'\n'+a.slice(7).join(', ');
    phase=0;sync();status(m.accepted?'Bounded sample with positive finite-time stretching.':'Bounded sample; discovery criteria not met.');return true;
  }catch(e){status('Could not load seed: '+e.message);return false;}
}
if(!load(params.get('seed')||encode(presets[1][1]))){const error=$('status').textContent;load(encode(presets[1][1]));status(error+' Showing Veil.');}
phase=Math.max(0,Math.min(1,Number(params.get('phase'))||0));sync();
function resize(){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5,850/Math.max(rect.width,rect.height));
  canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));dirty=true;
}
new ResizeObserver(resize).observe(canvas);resize();
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(playing&&!controller&&!document.hidden){phase=(phase+dt/settings.duration)%1;dirty=true;}
  if(dirty&&!document.hidden){paint(canvas,phase);$('phase').value=phase;syncCamera();dirty=false;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function stopSearch(){worker?.terminate();worker=null;$('discover').textContent='Find candidates';}
function toggle(){if(!controller){playing=!playing;sync();}}
$('play').onclick=toggle;canvas.onclick=toggle;
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;dirty=true;sync();};
for(const [k] of specs)if(!cameraControls.has(k))$(k).oninput=()=>{settings[k]=Number($(k).value);sync();clearTimeout(timer);timer=setTimeout(rebuild,120);};
$('framing').onchange=()=>{settings.framing=$('framing').value;rebuild();};
$('palette').onchange=()=>{settings.palette=$('palette').value;rebuild();};
$('apply').onclick=()=>{stopSearch();load($('seed').value);};
$('seed').onkeydown=e=>{if(e.key==='Enter')$('apply').click();};
$('presets').onchange=()=>{if($('presets').value){stopSearch();load($('presets').value);}};
$('saved').onchange=()=>{if($('saved').value){stopSearch();load($('saved').value);}};
$('favorite').onclick=()=>{status('Seed saved in this browser.');remember(seed);};
let results=[];
function showResults(){
  $('results').replaceChildren();
  for(const item of results){
    const button=document.createElement('button'),thumb=document.createElement('canvas');thumb.width=thumb.height=144;
    makePainter(item.orbit,{...settings,zoom:1,rotation:0},{},{exact:true})(thumb,0);
    const label=document.createElement('span');label.textContent=`${(item.metrics.roundness*100).toFixed(0)}% round · ${(item.metrics.balance*100).toFixed(0)}% balanced`;
    button.append(thumb,label);button.title=item.seed;button.onclick=()=>{stopSearch();if(load(item.seed)){remember(item.seed);}};
    button.disabled=!!controller;$('results').append(button);
  }
}
$('discover').onclick=()=>{
  if(worker){stopSearch();status('Search stopped. Candidates remain available.');return;}
  results=[];showResults();
  try{worker=new Worker(new URL('./search-worker.mjs?v=4',import.meta.url),{type:'module'});}catch(e){status('Search unavailable: '+e.message);return;}
  $('discover').textContent='Stop search';status('Searching…');
  worker.onmessage=({data:d})=>{
    if(d.type==='candidate'){results.push(d);results.sort((a,b)=>b.score-a.score);showResults();}
    if(d.attempts)status(`${d.attempts.toLocaleString()} tested · ${results.length} candidates · ranked by ${$('target').selectedOptions[0].textContent.toLowerCase()}`);
    if(d.type==='done'){stopSearch();status(`Search complete: ${results.length} candidates from ${d.attempts.toLocaleString()} tests. Select a thumbnail to load and save it.`);}
    if(d.type==='error'){stopSearch();status('Search failed: '+d.message);}
  };
  worker.onerror=e=>{stopSearch();status('Search failed: '+e.message);};
  worker.postMessage({seed,mode:$('mode').value,target:$('target').value,randomSeed:crypto.getRandomValues(new Uint32Array(1))[0]});
};
for(const id of ['mode','target'])$(id).onchange=()=>{if(worker){stopSearch();status('Search settings changed. Start a new search.');}};
async function copy(text){try{await navigator.clipboard.writeText(text);status('Copied.');}catch{const input=document.createElement('textarea');input.value=text;$('status').replaceChildren('Copy manually: ',input);input.select();}}
$('copyLink').onclick=()=>{
  const url=new URL(location.href);url.search='';url.searchParams.set('seed',seed);
  Object.entries(settings).forEach(([k,v])=>url.searchParams.set(k,v));
  const encoded=serializeTracks(tracks,trackDefinitions);if(encoded)url.searchParams.set('tracks',encoded);url.searchParams.set('phase',phase.toFixed(8));copy(url.href);
};
$('copySeed').onclick=()=>copy(seed);
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');resize();}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();toggle();}});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('png').onclick=()=>{
  const out=document.createElement('canvas');out.width=out.height=Number($('exportSize').value);
  makePainter(orbit,settings,tracks,{exact:true})(out,phase);out.toBlob(b=>b?download(b,'wild-silk-'+seed+'.png'):status('PNG encoding failed.'));
};
$('record').onclick=async()=>{
  if(controller){controller.abort();return;}
  stopSearch();controller=new AbortController();const signal=controller.signal,wasPlaying=playing,snapshot={...settings};
  const renderer=makePainter(orbit,snapshot,normalizeTracks(tracks,trackDefinitions),{exact:true}),selectedSeed=seed,size=Number($('exportSize').value),fps=Number($('exportFps').value);
  const controls=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide'].includes(e.id));
  controls.forEach(e=>e.disabled=true);playing=false;sync();$('record').textContent='Cancel export';status('Loading MP4 encoder…');
  try{
    const FrameWrap=await loadFrameWrap();if(signal.aborted)throw new DOMException('Canceled','AbortError');
    const blob=await exportFrames({width:size,height:size,fps,duration:snapshot.duration,signal,yieldEvery:1,
      bitrate:Math.round(32000000*(size/1080)**2*(fps/30)),createRecorder:options=>new FrameWrap(options),
      draw:({canvas,phase})=>renderer(canvas,phase),onProgress:(n,total)=>status(`Encoding ${n}/${total} frames`)});
    download(blob,'wild-silk-'+selectedSeed+'-'+size+'p.mp4');status('MP4 export complete.');
  }catch(e){status(e.name==='AbortError'?'Export canceled.':'Export failed: '+e.message);}
  finally{controller=null;playing=wasPlaying;controls.forEach(e=>e.disabled=false);$('record').textContent='Export MP4';sync();}
};
addEventListener('pagehide',()=>{stopSearch();controller?.abort();});
