import {orderFrame,advanceOrder} from './timeline.mjs';
import {returnMap,orbit,LAMBDA,fixedZero} from './math.mjs';
const $=id=>document.getElementById(id),field=$('field'),canvas=$('overlay'),ctx=canvas.getContext('2d'),im=$('imagePlane'),ic=im.getContext('2d');
const worker=new Worker(new URL('./field-worker.mjs',import.meta.url),{type:'module'});
let busy=false,pending=null,orderTour=null,exportUrl=null,fieldReady=false;
function dispatch(d){busy=true;worker.postMessage(d)}
let view={cx:0,cy:0,span:11.4},mode='skeleton',n=5,depth=0,seed=[.7,.32],points=[],running=!matchMedia('(prefers-reduced-motion: reduce)').matches,clock=0,speed=2,requestId=0,timer,drag=null,tour=false,tourTime=0,last=0,dirty=true;
const texts={skeleton:['Where does the real axis come from?','Each luminous curve is a numerical preimage of the real axis. Nearby points are sent to opposite half-planes. Follow a point to see the geometry become dynamics.'],puzzles:['The same geometry, one scale deeper.','Move the scale slider to overlay the computed skeleton at λ, then λ², then λ³. Zoom toward zero to compare the repeating structures with Figures 6–7.'],phase:['What does the map do to each point?','Hue records the argument of fₙ(z). Bands record log(1 + |fₙ(z)|). The skeleton is where the image crosses the positive or negative real axis.']};
function rebuildOrbit(){points=orbit(seed,n,$('dynamics').value==='basin');clock=0;dirty=true}
function render(){stopOrderTour();fieldReady=false;clearTimeout(timer);timer=setTimeout(()=>{const w=Math.min(1000,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(w*canvas.clientHeight/canvas.clientWidth));$('renderStatus').textContent='Computing…';const d={...view,w,h,n,mode,depth,id:++requestId};if(busy)pending=d;else dispatch(d);$('viewScale').textContent=`width ${view.span.toPrecision(4)}`},80);dirty=true}
worker.onmessage=({data:d})=>{busy=false;if(pending){const next=pending;pending=null;dispatch(next)}if(d.id!==requestId||orderTour)return;field.width=d.w;field.height=d.h;field.getContext('2d').putImageData(new ImageData(d.data,d.w,d.h),0,0);fieldReady=true;$('renderStatus').textContent=`order ${n} · ${2**n} folds`;dirty=true};
worker.onerror=()=>{$('renderStatus').textContent='Computation failed. Reload to retry.'};
function resize(){const dpr=Math.min(devicePixelRatio,2);canvas.width=canvas.clientWidth*dpr;canvas.height=canvas.clientHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);im.width=im.clientWidth*dpr;im.height=im.clientHeight*dpr;ic.setTransform(dpr,0,0,dpr,0,0);render()}
const toScreen=([x,y])=>[(x-view.cx)/view.span*canvas.clientWidth+canvas.clientWidth/2,(view.cy-y)/view.span*canvas.clientWidth+canvas.clientHeight/2];
function fromScreen(x,y){return [view.cx+(x-canvas.clientWidth/2)/canvas.clientWidth*view.span,view.cy-(y-canvas.clientHeight/2)/canvas.clientWidth*view.span]}
function line(c,p,q,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke()}
function dot(c,p,r,color){c.fillStyle=color;c.beginPath();c.arc(...p,r,0,Math.PI*2);c.fill()}
const fmt=z=>`${z[0].toFixed(5)} ${z[1]<0?'−':'+'} ${Math.abs(z[1]).toFixed(5)}i`;
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);const origin=toScreen([0,0]);line(ctx,[0,origin[1]],[w,origin[1]],'#8ba8c82c');line(ctx,[origin[0],0],[origin[0],h],'#8ba8c82c');const tick=10**Math.floor(Math.log10(view.span/5))*2;ctx.font='9px monospace';ctx.fillStyle='#8697ad';for(let x=Math.ceil((view.cx-view.span/2)/tick)*tick;x<view.cx+view.span/2;x+=tick){const p=toScreen([x,0]);if(origin[1]>30&&origin[1]<h-35){line(ctx,[p[0],p[1]-3],[p[0],p[1]+3],'#8697ad55');ctx.fillText(Math.abs(x)<tick*1e-5?0:Number(x.toPrecision(3)),p[0]+4,p[1]+13)}}
const x0=fixedZero(n);const p0=toScreen([x0,0]);dot(ctx,p0,3,'#a6e2aa');ctx.fillStyle='#a6e2aa';ctx.fillText('x₀',p0[0]+7,p0[1]-7);
const limit=Math.min(points.length-1,Math.floor(clock));for(let i=1;i<=limit;i++)line(ctx,toScreen(points[i-1]),toScreen(points[i]),'#ffe7ab66',1);for(let i=0;i<=limit;i++)dot(ctx,toScreen(points[i]),i===0?4:2,'#ffe5ac');
const next=Math.min(limit+1,points.length-1),t=clock-Math.floor(clock),p=points[limit],q=points[next];if(p&&q){const current=p.map((v,j)=>v+(q[j]-v)*t);dot(ctx,toScreen(current),6,'#fff0c7');dot(ctx,toScreen(current),10,'#fff0c722')}
$('orbitReadout').textContent=`z${limit} = ${fmt(points[limit])}${points.length<29&&limit===points.length-1?' · cutoff':''}`;
const iw=im.clientWidth,ih=im.clientHeight;ic.clearRect(0,0,iw,ih);const images=points.slice(0,limit+1).map(p=>returnMap(p,n));const valid=images.filter(Boolean),range=Math.max(.05,...valid.map(p=>Math.hypot(...p)));const pos=p=>[iw/2+p[0]/range*iw*.4,ih/2-p[1]/range*ih*.4];line(ic,[0,ih/2],[iw,ih/2],'#8ba8c833');line(ic,[iw/2,0],[iw/2,ih],'#8ba8c833');for(let i=0;i<images.length;i++){if(!images[i])continue;if(i&&images[i-1])line(ic,pos(images[i-1]),pos(images[i]),'#7fdfcf88');dot(ic,pos(images[i]),i===images.length-1?4:2,'#7fdfcf')}
let residual='';if($('dynamics').value==='basin'&&images[limit]&&images[next]&&next!==limit){const r=Math.hypot(images[next][0]+LAMBDA*images[limit][0],images[next][1]+LAMBDA*images[limit][1]);residual=` · residual ${r.toExponential(1)}`}$('linearReadout').textContent=`f(zₖ) image plane${residual}`;
}
function setMode(m){mode=m;for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b.dataset.mode===m);$('modeTitle').textContent=texts[m][0];$('modeText').textContent=texts[m][1];$('depthBox').hidden=m!=='puzzles';document.querySelector('.legend').style.display=m==='phase'?'none':'';render()}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
$('order').oninput=e=>{n=+e.target.value;$('orderValue').textContent=`${n} · ${2**n} folds`;rebuildOrbit();render()};$('depth').oninput=e=>{depth=+e.target.value;$('depthValue').textContent=depth;render()};$('dynamics').onchange=rebuildOrbit;$('speed').oninput=e=>{speed=+e.target.value;$('speedValue').textContent=`${speed} steps/s`};
function updatePlay(){$('play').textContent=running?'Pause orbit':'Play orbit'}
$('play').onclick=()=>{running=!running;updatePlay()};$('step').onclick=()=>{running=false;updatePlay();clock=(Math.floor(clock)+1)%points.length;dirty=true};$('reset').onclick=()=>{view={cx:0,cy:0,span:11.4};render()};
function zoom(f,anchor=[canvas.clientWidth/2,canvas.clientHeight/2]){const before=fromScreen(...anchor);view.span=Math.max(.0001,Math.min(30,view.span*f));const after=fromScreen(...anchor);view.cx+=before[0]-after[0];view.cy+=before[1]-after[1];render()}
$('zoomIn').onclick=()=>zoom(.65);$('zoomOut').onclick=()=>zoom(1/.65);canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(Math.max(-.4,Math.min(.4,e.deltaY*.001))),[e.clientX-r.left,e.clientY-r.top])};
canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,cx:view.cx,cy:view.cy,moved:false};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){view.cx=drag.cx-dx/canvas.clientWidth*view.span;view.cy=drag.cy+dy/canvas.clientWidth*view.span;render()}};canvas.onpointerup=e=>{if(drag&&!drag.moved){const r=canvas.getBoundingClientRect();seed=fromScreen(e.clientX-r.left,e.clientY-r.top);rebuildOrbit()}drag=null};canvas.onpointercancel=()=>drag=null;
canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')view.cx-=view.span*.1;if(e.key==='ArrowRight')view.cx+=view.span*.1;if(e.key==='ArrowUp')view.cy+=view.span*.1;if(e.key==='ArrowDown')view.cy-=view.span*.1;if(e.key==='+'||e.key==='=')zoom(.7);else if(e.key==='-')zoom(1/.7);else if(e.key===' ')$('play').click();else render()};
for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{tour=false;$('scaleTour').textContent='Animate rescaling';const key=b.dataset.preset;if(key==='origin'){seed=[0,0];view={cx:0,cy:0,span:3.5};setMode('skeleton')}if(key==='detail'){seed=[3.1,1.5];view={cx:3,cy:1.7,span:5};setMode('skeleton')}if(key==='nested'){seed=[.1,.05];view={cx:0,cy:0,span:11.4};depth=2;$('depth').value=depth;$('depthValue').textContent=depth;setMode('puzzles')}rebuildOrbit();render()};
$('scaleTour').onclick=()=>{tour=!tour;tourTime=0;view={cx:0,cy:0,span:11.4*LAMBDA**depth};$('scaleTour').textContent=tour?'Stop rescaling':'Animate rescaling';render()};
function stopOrderTour(){
 if(!orderTour)return;
 orderTour.worker?.terminate();orderTour=null;
 $('animateOrder').textContent='Animate order 2 → 7';$('exitOrder').hidden=true;$('orderTimeline').disabled=true;
 $('orderProgress').textContent='Compute six frames once, then play them smoothly.';
}
function paintOrder(){
 if(!orderTour||orderTour.frames.length!==6)return;
 const f=orderFrame(orderTour.value,$('blendOrders').checked),a=orderTour.frames[f.lo-2],b=orderTour.frames[f.hi-2];
 if(field.width!==a.width||field.height!==a.height){field.width=a.width;field.height=a.height}
 fieldReady=true;const c=field.getContext('2d');c.globalAlpha=1;c.drawImage(a,0,0);if(f.alpha>0){c.globalAlpha=f.alpha;c.drawImage(b,0,0);c.globalAlpha=1}
 if(n!==f.lo){n=f.lo;rebuildOrbit()}
 $('order').value=n;$('orderValue').textContent=`${n} · ${2**n} folds`;
 $('orderTimeline').value=f.value;$('timelineValue').textContent=f.value.toFixed(2);
 const label=f.alpha>0?`orders ${f.lo} → ${f.hi} · blend ${Math.round(f.alpha*100)}%`:`order ${f.lo} · ${2**f.lo} folds`;
 $('renderStatus').textContent=label;$('orderProgress').textContent=f.value===7?'Order 7 reached. Replay or scrub the timeline.':label;
 dirty=true;
}
$('animateOrder').onclick=()=>{
 if(orderTour?.frames.length===6){if(orderTour.value===7)orderTour.value=2;orderTour.playing=!orderTour.playing;$('animateOrder').textContent=orderTour.playing?'Pause order animation':'Resume order animation';paintOrder();return}
 if(orderTour){stopOrderTour();render();return}
 clearTimeout(timer);pending=null;requestId++;tour=false;$('scaleTour').textContent='Animate rescaling';running=false;updatePlay();
 const w=Math.min(800,Math.round(canvas.clientWidth)),h=Math.max(1,Math.round(w*canvas.clientHeight/canvas.clientWidth));
 const calc=new Worker(new URL('./field-worker.mjs',import.meta.url),{type:'module'});
 const state={worker:calc,frames:[],value:2,playing:false};orderTour=state;
 $('animateOrder').textContent='Cancel preparation';$('exitOrder').hidden=false;$('orderTimeline').disabled=true;
 const request=order=>{$('orderProgress').textContent=`Preparing order ${order} of 7 · ${state.frames.length}/6 frames ready…`;calc.postMessage({...view,w,h,n:order,mode,depth,id:order})};
 calc.onmessage=({data:d})=>{if(orderTour!==state)return;const frame=document.createElement('canvas');frame.width=d.w;frame.height=d.h;frame.getContext('2d').putImageData(new ImageData(d.data,d.w,d.h),0,0);state.frames.push(frame);
 if(d.id<7)request(d.id+1);else{calc.terminate();state.worker=null;state.playing=true;$('orderTimeline').disabled=false;$('animateOrder').textContent='Pause order animation';paintOrder()}};
 calc.onerror=()=>{if(orderTour!==state)return;stopOrderTour();$('orderProgress').textContent='Frame preparation failed. Try a smaller view or reload.'};
 request(2);
};
$('exitOrder').onclick=()=>{stopOrderTour();render()};
$('orderTimeline').oninput=e=>{if(orderTour?.frames.length!==6)return;orderTour.value=+e.target.value;orderTour.playing=false;$('animateOrder').textContent=orderTour.value===7?'Replay order animation':'Resume order animation';paintOrder()};
$('transitionTime').oninput=e=>$('transitionValue').textContent=`${e.target.value} s`;
$('blendOrders').onchange=paintOrder;
// Keep the actual download in the top document when the scene is embedded in
// the same-origin Atlas. This preserves the click's user activation and makes
// the download originate from the viewer rather than a nested frame.
$('downloadPng').onclick=e=>{
 if(window.parent===window)return;
 try{const doc=window.parent.document,a=doc.createElement('a');a.href=$('downloadPng').href;a.download=$('downloadPng').download;doc.body.append(a);e.preventDefault();a.click();a.remove()}catch{/* Cross-origin embeds keep the ordinary download link. */}
};
$('closeExport').onclick=()=>$('exportDialog').close();
$('exportDialog').onclose=()=>{if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null}$('exportPreview').hidden=true;$('exportPreview').removeAttribute('src');for(const id of ['downloadPng','openPng']){$(id).hidden=true;$(id).removeAttribute('href')}};
$('save').onclick=()=>{
 const dialog=$('exportDialog');$('exportStatus').textContent='Preparing PNG…';dialog.showModal();
 try{
  if(!fieldReady)throw Error('Wait for the field to finish rendering.');
  const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const c=out.getContext('2d');c.drawImage(field,0,0,out.width,out.height);c.drawImage(canvas,0,0);
  const label=$('renderStatus').textContent;c.fillStyle='#080d17df';c.fillRect(0,out.height-38,out.width,38);c.fillStyle='#c2e9e4';c.font='14px monospace';c.fillText(`Feigenbaum · ${mode} · ${label}`,14,out.height-14);
  const name=`feigenbaum-${mode}-order-${orderTour?.frames.length===6?orderTour.value.toFixed(2):n}.png`;
  out.toBlob(blob=>{if(!dialog.open)return;if(!blob){$('exportStatus').textContent='PNG encoding failed. Try again.';return}
   exportUrl=URL.createObjectURL(blob);$('exportPreview').src=exportUrl;$('exportPreview').hidden=false;
   $('downloadPng').href=exportUrl;$('downloadPng').download=name;$('downloadPng').hidden=false;
   $('openPng').href=exportUrl;$('openPng').hidden=false;$('exportStatus').textContent=`${name} · ${out.width} × ${out.height} · ${(blob.size/1024).toFixed(0)} KB`;
  },'image/png');
 }catch(e){$('exportStatus').textContent=`Could not export: ${e.message}`}
};
function frame(ts){const dt=Math.min(.05,(ts-last)/1000||0);last=ts;if(!document.hidden){if(orderTour?.playing){orderTour.value=advanceOrder(orderTour.value,dt,+$('transitionTime').value);if(orderTour.value===7){orderTour.playing=false;$('animateOrder').textContent='Replay order animation'}paintOrder()}if(running){clock+=dt*speed;if(clock>=points.length)clock=0;dirty=true}if(tour){tourTime+=dt;if(tourTime>.7&&!busy){tourTime=0;view.span*=.95;if(view.span<.018){view.span=11.4;depth=(depth+1)%4;$('depth').value=depth;$('depthValue').textContent=depth}render()}}if(dirty){draw();dirty=false}}requestAnimationFrame(frame)}
rebuildOrbit();updatePlay();new ResizeObserver(resize).observe($('viewport'));requestAnimationFrame(frame);
