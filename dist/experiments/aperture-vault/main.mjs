import {createParameterControl} from '../../shared/parameter-controls.mjs';
import {normalizeTracks,serializeTracks} from '../../shared/parameter-tracks.mjs';
import {exportFrames,loadFrameWrap} from '../../shared/frame-export.mjs';
import {createIntraRecorder} from './recording.mjs';
import {definitions,readState,poseAt} from './core.mjs';
import {draw,dispose} from './painter.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),params=new URLSearchParams(location.search);
let {settings,tracks}=readState(params),phase=Math.max(0,Math.min(1,Number(params.get('phase'))||0));
let playing=!params.has('phase')&&!matchMedia('(prefers-reduced-motion: reduce)').matches,controller=null,dirty=true,last=performance.now();
const controls=new Map(),status=s=>$('status').textContent=s;
for(const [key,label] of [['opening','Opening'],['cascade','Hinge cascade'],['zoom','Zoom'],['rotation','Orientation'],['elevation','Elevation']]){
 controls.set(key,createParameterControl({parent:$('sliders'),key,label,definition:definitions[key],value:settings[key],track:tracks[key],
 onValue:value=>{settings[key]=value;dirty=true;sync();},
 onTrack:track=>{tracks=normalizeTracks({...tracks,[key]:track},definitions);dirty=true;sync();}}));
}
function sync(){
 const pose=poseAt(settings,tracks,phase);
 for(const [key,c]of controls)c.sync({value:settings[key],track:tracks[key],resolved:pose[key],disabled:!!controller});
 for(const key of ['duration']){$(key).value=settings[key];$(key+'Value').textContent=settings[key];}
 $('lighting').value=settings.lighting;
 $('play').textContent=playing?'Pause':'Play';$('phase').value=phase;
}
function resize(){const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);dirty=true;}
new ResizeObserver(resize).observe(canvas);resize();sync();
function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing&&!controller&&!document.hidden){phase=(phase+dt/settings.duration)%1;dirty=true;}if(dirty&&!document.hidden){try{const renderer=draw(canvas,settings,tracks,phase);if(renderer&&$('renderer').textContent!==renderer)$('renderer').textContent=renderer;}catch(e){playing=false;status(e.message);}sync();dirty=false;}requestAnimationFrame(tick);}
requestAnimationFrame(tick);
function toggle(){if(!controller){playing=!playing;sync();}}
$('play').onclick=toggle;canvas.onclick=toggle;
$('lighting').onchange=()=>{settings.lighting=$('lighting').value;dirty=true;sync();};
$('phase').oninput=()=>{phase=Number($('phase').value);playing=false;dirty=true;sync();};
for(const key of ['duration'])$(key).oninput=()=>{settings[key]=Number($(key).value);dirty=true;sync();};
function hide(){document.body.classList.toggle('clean');$('show').hidden=!document.body.classList.contains('clean');resize();}
$('hide').onclick=hide;$('show').onclick=hide;
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='KeyH')hide();if(e.code==='Space'){e.preventDefault();toggle();}});
$('copyLink').onclick=async()=>{
 const url=new URL(location.href);url.search='';for(const [key,v]of Object.entries(settings))url.searchParams.set(key,v);
 url.searchParams.set('tracks',serializeTracks(tracks,definitions)||'{"v":1,"t":{}}');url.searchParams.set('phase',phase.toFixed(8));
 try{await navigator.clipboard.writeText(url.href);status('Scene URL copied.');}catch{const t=document.createElement('textarea');t.value=url.href;$('status').replaceChildren('Copy this URL: ',t);t.select();}
};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('png').onclick=()=>{const out=document.createElement('canvas');out.width=out.height=Number($('exportSize').value);try{draw(out,settings,tracks,phase);out.toBlob(b=>b?download(b,'aperture-vault.png'):status('PNG encoding failed.'));}catch(e){status(e.message);}finally{dispose(out);}};
$('record').onclick=async()=>{
 if(controller){controller.abort();return;}
 controller=new AbortController();const signal=controller.signal,wasPlaying=playing,snapshot={...settings},savedTracks=normalizeTracks(tracks,definitions);
 const size=Number($('exportSize').value),fps=Number($('exportFps').value),inputs=[...document.querySelectorAll('aside input,aside select,aside button')].filter(e=>!['record','hide'].includes(e.id));
 inputs.forEach(e=>e.disabled=true);playing=false;sync();$('record').textContent='Cancel export';status('Loading MP4 encoder…');
 let exportTarget;
 try{
 const FrameWrap=await loadFrameWrap();if(signal.aborted)throw new DOMException('Canceled','AbortError');
 const blob=await exportFrames({width:size,height:size,fps,duration:snapshot.duration,signal,yieldEvery:1,bitrate:Math.round(24000000*(size/1080)**2*(fps/30)),createRecorder:options=>createIntraRecorder(FrameWrap,options),
 draw:({canvas,phase})=>{exportTarget=canvas;draw(canvas,snapshot,savedTracks,phase);},onProgress:(n,total)=>status(`Encoding ${n}/${total} frames`)});
 download(blob,'aperture-vault-'+size+'p.mp4');status('MP4 export complete.');
 }catch(e){status(e.name==='AbortError'?'Export canceled.':'Export failed: '+e.message);}
 finally{if(exportTarget)dispose(exportTarget);controller=null;playing=wasPlaying;inputs.forEach(e=>e.disabled=false);$('record').textContent='Export MP4';sync();dirty=true;}
};
addEventListener('pagehide',()=>controller?.abort());
