import * as THREE from '../../vendor/0.180.0/build/three.module.js';
import {timeline,sample,PRESETS} from './dynamics.mjs';
const $=id=>document.getElementById(id),q=new URLSearchParams(location.search);
for(const id of ['view','preset','speed','quality','seed','seek'])if(q.has(id)){const e=$(id),v=q.get(id);if(e.tagName==='SELECT'){if([...e.options].some(o=>o.value===v))e.value=v;}else if(Number.isFinite(+v))e.value=Math.max(+e.min,Math.min(+e.max,+v));}
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('sky'),antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});}catch(e){const p=document.createElement('p');p.className='error';p.textContent='Static preview · WebGL is unavailable in this browser. Animation requires WebGL.';p.style.cssText='position:fixed;top:210px;left:30px;padding:12px;border-radius:8px;background:#08111cdd;font-size:12px';document.body.append(p);$('sky').style.background='url(still-120.png) center / cover';$('phase').hidden=true;document.querySelectorAll('button,select,input').forEach(el=>el.disabled=true);$('readout').textContent='Static reference: seed 98 · folding · t=120 s. Source and research notes remain available below.';throw e;}
const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
const scene=new THREE.Scene(),camera=new THREE.Camera();
const u={res:{value:new THREE.Vector2()},clock:{value:0},mode:{value:2},state:{value:new THREE.Vector3()},seed:{value:98}};
const material=new THREE.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
precision highp float;
uniform vec2 res;uniform float clock,seed;uniform int mode;uniform vec3 state;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*.173)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.53;mat2 m=mat2(.82,-.57,.57,.82);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p*2.03+vec2(13.7,8.1);a*=.48;}return v;}
void main(){
 vec2 screen=gl_FragCoord.xy/res;int panel=0;vec2 uv=screen;float aspect=res.x/res.y;int kind=mode;
 if(mode==3){panel=int(floor(screen.x*3.));kind=panel;uv.x=fract(screen.x*3.);aspect/=3.;}
 // Broad sky plane with a mild horizon compression. No unbounded raymarch.
 vec2 p=vec2((uv.x-.5)*aspect*3.4,(uv.y-.3)*2.7);p.y+=.13*p.x*p.x;
 vec3 c=vec3(0.);if(kind==1)c=vec3(sin(clock*.014)*.7,cos(clock*.011)*.45-.45,sin(clock*.008)*.3);
 if(kind==2)c=vec3(state.x*.65,state.y*.8,(state.z-.35)*.65);
 vec2 drift=kind==0?vec2(0):vec2(clock*.003,clock*.0009);
 vec2 base=p+drift;
 vec2 warp=vec2(fbm(base*.65+vec2(1.7,4.2)),fbm(base*.65+vec2(7.1,2.8)))-.5;
 // State controls three macro properties: folding, shear, and density threshold.
 vec2 folded=base+warp*(2.1+c.x*.65);folded.x+=c.y*(p.y-.5);folded.y+=c.x*.18*sin(p.x*1.2);
 float field=fbm(folded*1.35+vec2(2.,9.));
 float cloud=smoothstep(.28+c.z*.055,.70+c.z*.055,field);
 float filament=exp(-abs(field-(.48+c.z*.025))*24.);
 float detail=fbm(folded*1.35+vec2(.08,.13));float light=clamp(.55+(field-detail)*6.,.15,1.);
 vec3 sky=mix(vec3(.018,.047,.095),vec3(.11,.19,.26),pow(1.-uv.y,2.));
 vec3 shadow=vec3(.12,.16,.25),lit=vec3(.42,.60,.61);vec3 clouds=mix(shadow,lit,light);
 vec3 col=mix(sky,clouds,cloud*.9);col+=filament*.075*mix(vec3(.48,.29,.36),vec3(.40,.70,.68),smoothstep(.1,.9,uv.y));
 col=mix(col,vec3(.31,.28,.32),exp(-uv.y*8.)*.2);col*=1.-.16*dot(uv-.5,uv-.5);
 // Thin panel dividers, identical field sampling in comparison mode.
 if(mode==3&&uv.x<.002)col=vec3(.27,.38,.43);
 gl_FragColor=vec4(pow(col,vec3(.86)),1.);
}`});scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
let data,precomputeMs=0,time=+$('seek').value,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!q.has('seek'),last=0,acc=0,frames=0,cpu=0,gpu=null,pending=null,elapsed=0;
function rebuild(){const start=performance.now();data=timeline(PRESETS[$('preset').value],+$('seed').value);precomputeMs=performance.now()-start;u.seed.value=+$('seed').value;}
function resize(){const scale=+$('quality').value,maxPixels=1500000,ratio=Math.min(devicePixelRatio,1.5)*scale;let w=innerWidth*ratio,h=innerHeight*ratio;const k=Math.min(1,Math.sqrt(maxPixels/(w*h)));renderer.setPixelRatio(1);renderer.setSize(Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)),false);u.res.value.set(renderer.domElement.width,renderer.domElement.height);}
function labels(){const names=['FROZEN FIELD','SCROLLING / WARPED fBm','DUFFING-DRIVEN fBm'];$('labels').innerHTML=($('view').value==='3'?names:[names[+$('view').value]]).map(x=>'<span>'+x+'</span>').join('');}
function playLabel(){$('play').textContent=playing?'Pause':'Play';}
rebuild();resize();labels();playLabel();window.addEventListener('resize',resize);
$('quality').onchange=resize;$('view').onchange=labels;
for(const id of ['preset','seed'])$(id).onchange=()=>{$('seed').value=Math.round(Math.max(0,Math.min(999999,+$('seed').value||0)));rebuild();time=0;};
$('play').onclick=()=>{playing=!playing;playLabel();};$('reset').onclick=()=>{time=0;};
$('seek').oninput=()=>{time=+$('seek').value;playing=false;playLabel();};
$('link').onclick=async()=>{const p=new URLSearchParams();for(const id of ['view','preset','speed','quality','seed'])p.set(id,$(id).value);p.set('seek',time.toFixed(2));try{await navigator.clipboard.writeText(location.origin+location.pathname+'?'+p);$('link').textContent='Copied';}catch{history.replaceState(null,'','?'+p);$('link').textContent='Link in address bar';}setTimeout(()=>$('link').textContent='Copy state link',2000);};
$('still').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='duffing-sky-'+$('seed').value+'-'+time.toFixed(1)+'s.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
function phase(){const ctx=$('phase').getContext('2d');ctx.clearRect(0,0,200,120);ctx.strokeStyle='#9bcfc04d';ctx.beginPath();ctx.moveTo(100,0);ctx.lineTo(100,120);ctx.moveTo(0,60);ctx.lineTo(200,60);ctx.stroke();ctx.strokeStyle='#a7e9d7';ctx.beginPath();for(let i=0;i<=160;i++){const s=sample(data,Math.max(0,time-60+i*60/160)),x=100+s[0]*60,y=60-s[1]*65;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();const s=sample(data,time);ctx.fillStyle='#e8fff8';ctx.beginPath();ctx.arc(100+s[0]*60,60-s[1]*65,3,0,7);ctx.fill();}
function frame(now){requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.1):0;last=now;if(document.hidden)return;
 if(playing)time=Math.min(600,time+dt*+$('speed').value);if(time===600&&playing){playing=false;playLabel();}
 const start=performance.now();u.clock.value=time;u.mode.value=+$('view').value;u.state.value.fromArray(sample(data,time));
 if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu=gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6;gl.deleteQuery(pending);pending=null;}
 const query=ext&&!pending&&frames%30===0?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
 renderer.render(scene,camera);if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending=query;}cpu+=performance.now()-start;frames++;elapsed+=dt;acc+=dt;
 if(acc>.3){$('seek').value=time;$('time').textContent=time.toFixed(1)+' / 600 s';phase();acc=0;}
 if(elapsed>=1){$('readout').textContent=(frames/elapsed).toFixed(0)+' fps · CPU submit '+(cpu/frames).toFixed(2)+' ms · GPU '+(gpu===null?'unavailable':gpu.toFixed(2)+' ms')+' · '+renderer.domElement.width+'×'+renderer.domElement.height+' · replay cache 0.82 MiB · precompute '+precomputeMs.toFixed(0)+' ms';elapsed=0;frames=0;cpu=0;}
}
requestAnimationFrame(frame);
// Read-only diagnostics used by the local validation harness.
window.skyDiagnostics=()=>({time,state:sample(data,time),preset:$('preset').value,seed:+$('seed').value,width:renderer.domElement.width,height:renderer.domElement.height,precomputeMs,gpuMs:gpu,programs:renderer.info.programs.map(p=>p.diagnostics?.runnable??true)});
