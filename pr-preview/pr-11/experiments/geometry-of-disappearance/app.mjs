import {interpolate,totalMass} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d'),chart=$('mass-chart'),cc=chart.getContext('2d');
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
let plan=null,a=[],b=[],requested=0,phase=0,clock=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,auto=true,dirty=true,last=0,lastPaint=0,solveTimer;
const palettes={tide:[[100,230,218],[255,167,102]],orchid:[[207,140,255],[138,225,255]],silver:[[207,221,235],[255,244,224]]};
let sprites=[];
function makeSprites(){sprites=palettes[$('palette').value].map(color=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,`rgba(${color},1)`);r.addColorStop(.12,`rgba(${color},.8)`);r.addColorStop(.4,`rgba(${color},.22)`);r.addColorStop(1,`rgba(${color},0)`);g.fillStyle=r;g.fillRect(0,0,64,64);return c;});dirty=true;}
function solve(){const id=++requested;$('status').textContent='Solving the geometry…';worker.postMessage({id,shape:$('shape').value,scale:+$('scale').value,mass:+$('target').value});}
worker.onmessage=({data:d})=>{if(d.id!==requested)return;if(d.error){fail(d.error);return;}plan=d.plan;a=d.a;b=d.b;dirty=true;$('status').textContent=`${a.length} × ${b.length} atoms · ${plan.steps} solver steps`;$('error').hidden=true;};
worker.onerror=e=>fail(e.message||'The transport solver could not start.');
function fail(message){$('error').textContent=message;$('error').hidden=false;$('status').textContent='Unable to solve this field';}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);dirty=true;}
new ResizeObserver(resize).observe(canvas);
function point(p,alpha,origin,scale,sprite){if(p.m<=1e-14)return;const size=scale*.12;ctx.globalAlpha=Math.min(1,p.m*alpha);ctx.drawImage(sprite,origin[0]+p.x*scale-size/2,origin[1]+p.y*scale-size/2,size,size);}
function field(mode,x,w){
 const H=canvas.height,scale=Math.min(w*.49,H*.43),origin=[x+w/2,H*.45];
 ctx.save();ctx.beginPath();ctx.rect(x,0,w,H);ctx.clip();
 if($('guides').checked){ctx.globalAlpha=.22;ctx.strokeStyle='#6e8caa';ctx.lineWidth=.6;for(const p of plan.paths.filter(p=>p.A>1e-5&&p.B>1e-5).sort((p,q)=>q.A+q.B-p.A-p.B).slice(0,200)){ctx.beginPath();ctx.moveTo(origin[0]+p.a.x*scale,origin[1]+p.a.y*scale);ctx.lineTo(origin[0]+p.b.x*scale,origin[1]+p.b.y*scale);ctx.stroke();}ctx.globalAlpha=.4;for(const set of [a,b])for(const p of set){ctx.beginPath();ctx.arc(origin[0]+p.x*scale,origin[1]+p.y*scale,1.3,0,7);ctx.stroke();}}
 ctx.globalCompositeOperation='lighter';
 // Fixed kernels; summed intensity is linear in branch mass before clipping.
 const gain=a.length===1?1.3:56;
 if(mode==='reaction'){for(const p of a)point({...p,m:p.m*(1-phase)**2},gain,origin,scale,sprites[0]);for(const p of b)point({...p,m:p.m*phase**2},gain,origin,scale,sprites[1]);}
 else for(const p of plan.paths){const z=interpolate(p,phase);point(z,gain*(1-phase),origin,scale,sprites[0]);point(z,gain*phase,origin,scale,sprites[1]);}
 ctx.restore();
}
function drawChart(){const W=chart.width,H=chart.height,pad=10,max=Math.max(1,+$('target').value)*1.1,yp=m=>H-pad-m/max*(H-2*pad),mass=t=>$('view').value==='reaction'?(1-t)**2+t*t*(+$('target').value):totalMass(plan,t);
 cc.clearRect(0,0,W,H);cc.strokeStyle='#314253';cc.lineWidth=1;cc.beginPath();cc.moveTo(pad,yp(1));cc.lineTo(W-pad,yp(1));cc.stroke();
 for(const reaction of [true,false]){cc.strokeStyle=reaction?'#4e7380':'#dfb184';cc.setLineDash(reaction?[5,5]:[]);cc.lineWidth=2;cc.beginPath();for(let i=0;i<=100;i++){const t=i/100,m=reaction?(1-t)**2+t*t*(+$('target').value):totalMass(plan,t);const x=pad+t*(W-2*pad),y=yp(m);i?cc.lineTo(x,y):cc.moveTo(x,y);}cc.stroke();}cc.setLineDash([]);
 const m=mass(phase),x=pad+phase*(W-2*pad);cc.fillStyle='#fff0db';cc.beginPath();cc.arc(x,yp(m),4,0,7);cc.fill();$('mass-out').value=m.toFixed(3);$('midpoint').textContent=`½: ${mass(.5).toFixed(3)}`;
}
function paint(){if(!plan)return;const W=canvas.width,H=canvas.height;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#050b13';ctx.fillRect(0,0,W,H);
 // Quiet spatial grid, independent of the interpolation.
 ctx.strokeStyle='#162637';ctx.lineWidth=.5;ctx.globalAlpha=.4;const step=Math.min(W,H)/12;ctx.beginPath();for(let x=W/2%step;x<W;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=H/2%step;y<H;y+=step){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();ctx.globalAlpha=1;
 if($('view').value==='compare'){field('hk',0,W/2);field('reaction',W/2,W/2);ctx.strokeStyle='#314557';ctx.beginPath();ctx.moveTo(W/2,100);ctx.lineTo(W/2,H-80);ctx.stroke();}else field($('view').value,0,W);
 drawChart();$('phase-out').value=phase.toFixed(3);$('phase').value=phase;dirty=false;}
function tick(now){const dt=last?Math.min((now-last)/1000,.06):0;last=now;if(!document.hidden&&playing&&auto&&plan){clock+=dt;phase=(1-Math.cos(clock*2*Math.PI/(+$('duration').value)))/2;dirty=true;}if(dirty&&!document.hidden&&now-lastPaint>32){paint();lastPaint=now;}requestAnimationFrame(tick);}
function syncButtons(){$('play').textContent=playing?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-pressed',playing);$('auto').setAttribute('aria-pressed',auto);}
$('play').onclick=()=>{playing=!playing;syncButtons();};$('auto').onclick=()=>{auto=!auto;syncButtons();};$('reset').onclick=()=>{clock=0;phase=0;dirty=true;};
$('phase').oninput=()=>{phase=+$('phase').value;clock=Math.acos(1-2*phase)/(2*Math.PI)*(+$('duration').value);auto=false;syncButtons();dirty=true;};
for(const id of ['scale','target'])$(id).oninput=()=>{$(id==='scale'?'scale-out':'target-out').value=(+$(id).value).toFixed(2);$('cutoff').textContent=(+$('scale').value*Math.PI/2).toFixed(2);clearTimeout(solveTimer);solveTimer=setTimeout(solve,120);};
$('shape').onchange=solve;$('palette').onchange=makeSprites;
$('view').onchange=()=>{$('view-label').textContent=$('view').value==='compare'?'TRANSPORT + REACTION     /     PURE REACTION':$('view').value==='reaction'?'PURE FISHER–RAO · LOCAL EXTINCTION & CREATION':'WASSERSTEIN–FISHER–RAO · DISCRETE STUDY';dirty=true;};
$('duration').oninput=()=>{$('duration-out').value=$('duration').value+' s';};$('guides').onchange=()=>dirty=true;
$('titles').onchange=()=>document.querySelector('.caption').classList.toggle('off',!$('titles').checked);
canvas.ondblclick=()=>{$('titles').checked=!$('titles').checked;$('titles').onchange();};
$('panel-toggle').onclick=()=>{const hidden=document.body.classList.toggle('hide-panel');$('panel-toggle').setAttribute('aria-expanded',!hidden);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.stage').requestFullscreen();}catch{fail('Fullscreen is unavailable here. Open the experiment separately.');}};
$('capture').onclick=()=>{paint();canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='geometry-of-disappearance.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|BUTTON|TEXTAREA|SUMMARY/.test(e.target.tagName)){e.preventDefault();$('play').click();}});
document.addEventListener('visibilitychange',()=>last=0);
window.addEventListener('pagehide',()=>worker.terminate());
makeSprites();syncButtons();solve();requestAnimationFrame(tick);
