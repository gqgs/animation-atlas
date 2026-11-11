import {caustic,TAU} from './math.mjs';
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d'),overlay=$('overlay'),oc=overlay.getContext('2d');
const params=new URLSearchParams(location.hash.slice(1)),num=(key,fallback,min,max)=>{const raw=params.get(key);const v=raw===null?fallback:Number(raw);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback};
const state={z:num('z',4,-4,4),view:['phase','luminous','intensity'].includes(params.get('view'))?params.get('view'):'phase',exposure:num('exposure',1,.2,2.5),seconds:[30,60,100].includes(Number(params.get('seconds')))?Number(params.get('seconds')):60,zeros:params.get('zeros')==='1',caustic:params.get('caustic')==='1',contours:params.get('contours')==='1',size:512};
let playing=!params.has('z')&&!matchMedia('(prefers-reduced-motion: reduce)').matches,ready=false,pending=false,dirty=true,worker,meta,angle=Math.acos(state.z/4),last=0,lastDraw=0,renderedZ=state.z,renderedView=state.view;
function labels(){
  $('z').value=state.z;$('z-value').textContent=state.z.toFixed(3);$('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===state.view));
  $('view-caption').textContent=state.view==='intensity'?'Brightness = intensity |Ψ|² · fixed exposure':state.view==='luminous'?'Hue = phase · brightness = tone-mapped |Ψ|²':'Hue = phase · one turn = 2π';
  document.querySelector('.phase-key').hidden=state.view==='intensity';$('exposure').disabled=state.view==='phase';
}
for(const id of ['zeros','caustic','contours']){$(id).checked=state[id];$(id).onchange=()=>{state[id]=$(id).checked;dirty=true;};}
$('speed').value=state.seconds;$('speed').onchange=()=>{state.seconds=Number($('speed').value);};
$('exposure').value=state.exposure;$('exposure').oninput=()=>{state.exposure=Number($('exposure').value);dirty=true;};
$('play').onclick=()=>{playing=!playing;last=0;labels();};
function seek(z){state.z=z;angle=Math.acos(z/4);playing=false;dirty=true;labels();}
$('z').oninput=()=>seek(Number($('z').value));
for(const b of document.querySelectorAll('[data-z]'))b.onclick=()=>seek(Number(b.dataset.z));
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{state.view=b.dataset.view;dirty=true;labels();};
$('quiet').onclick=()=>{const quiet=document.body.classList.toggle('quiet');$('quiet').textContent=quiet?'Show controls':'Hide controls';$('quiet').setAttribute('aria-pressed',String(quiet));};
function notice(t){$('notice').textContent=t;}
$('copy').onclick=async()=>{
  const u=new URL(location.href);u.hash=new URLSearchParams({z:state.z.toFixed(3),view:state.view,exposure:state.exposure,seconds:state.seconds,zeros:+state.zeros,caustic:+state.caustic,contours:+state.contours});
  try{await navigator.clipboard.writeText(u.href);notice('State link copied. Opens paused.');}catch{$('state-link').hidden=false;$('state-link').value=u.href;$('state-link').focus();$('state-link').select();notice('Select and copy the state link below.');}
};
$('save').onclick=()=>{
  const out=document.createElement('canvas');out.width=1200;out.height=1280;const c=out.getContext('2d');c.fillStyle='#101114';c.fillRect(0,0,1200,1280);c.drawImage(canvas,0,0,1200,1200);c.drawImage(overlay,0,0,1200,1200);c.fillStyle='#e7d6b9';c.font='20px sans-serif';c.fillText(`Coalescing Saddles · elliptic umbilic · z = ${renderedZ.toFixed(3)} · ${renderedView}`,30,1248);
  out.toBlob(blob=>{if(!blob){notice('PNG export failed.');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`coalescing-saddles-z${renderedZ.toFixed(3)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('PNG saved.');});
};
function drawOverlay(z,zeros){
  const n=1000;oc.clearRect(0,0,n,n);const coord=v=>(v-meta.xyMin)/(meta.xyMax-meta.xyMin)*n;
  if(state.caustic){oc.beginPath();for(let j=0;j<=600;j++){const [x,y]=caustic(z,j/600*TAU),u=coord(x),v=n-coord(y);j?oc.lineTo(u,v):oc.moveTo(u,v);}oc.lineWidth=5;oc.strokeStyle='#1b120bd9';oc.stroke();oc.lineWidth=2.2;oc.strokeStyle='#ffd48b';oc.stroke();}
  if(state.zeros){for(const p of zeros){const x=p.x/(meta.width-1)*n,y=(1-p.y/(meta.height-1))*n;oc.beginPath();oc.arc(x,y,4,0,TAU);oc.lineWidth=4;oc.strokeStyle='#080b10cc';oc.stroke();oc.lineWidth=1.7;oc.strokeStyle=p.charge>0?'#fff':'#20232a';oc.stroke();}
    $('zero-count').textContent=Math.abs(z)<=.015?'z ≈ 0: the real field has nodal curves; isolated-zero markers are hidden.':`${zeros.length} grid-resolved phase zeros · rings locate zeros, gold traces saddle mergers.`;
  }else $('zero-count').textContent='Stationary-point mergers and field zeros are different objects.';
}
function init(){
  worker?.terminate();ready=false;pending=false;$('loading').hidden=false;$('retry').hidden=true;$('play').disabled=true;$('save').disabled=true;
  worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data:d})=>{
    if(d.type==='progress')$('progress').textContent=`Loading samples · ${Math.round(d.loaded/d.total*100)}% · ${(d.total/1e6).toFixed(1)} MB`;
    if(d.type==='error'){fail(d.message);return;}
    if(d.type==='ready'){meta=d.meta;ready=true;dirty=true;$('loading').hidden=true;$('play').disabled=false;last=0;labels();}
    if(d.type==='frame'){
      if(canvas.width!==d.size){canvas.width=d.size;canvas.height=d.size;}
      ctx.putImageData(new ImageData(new Uint8ClampedArray(d.buffer),d.size,d.size),0,0);renderedZ=d.z;renderedView=d.view;$('save').disabled=false;canvas.dataset.renderedZ=d.z.toFixed(4);canvas.dataset.frame=String(Number(canvas.dataset.frame||0)+1);drawOverlay(d.z,d.zeros);pending=false;
    }
  };
  worker.onerror=()=>fail('Could not render the field. Retry loading.');worker.postMessage({type:'load'});
}
function fail(message){ready=false;pending=false;playing=false;$('loading').hidden=false;$('progress').textContent=message;$('retry').hidden=false;$('play').disabled=true;$('save').disabled=true;labels();}
$('retry').onclick=init;
function tick(now){
  const dt=last?Math.min((now-last)/1000,.1):0;last=now;
  if(ready&&!document.hidden){
    if(playing){angle=(angle+dt*TAU/state.seconds)%TAU;state.z=4*Math.cos(angle);dirty=true;labels();}
    if(dirty&&!pending&&now-lastDraw>=33){pending=true;dirty=false;lastDraw=now;worker.postMessage({type:'render',state:{...state}});}
  }
  requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=1-(e.clientY-r.top)/r.height;if(meta)$('sample-readout').textContent=`x = ${(meta.xyMin+x*(meta.xyMax-meta.xyMin)).toFixed(2)} · y = ${(meta.xyMin+y*(meta.xyMax-meta.xyMin)).toFixed(2)}`;};
canvas.onpointerleave=()=>$('sample-readout').textContent='x, y ∈ [−15.05, 15.05]';
labels();init();requestAnimationFrame(tick);
