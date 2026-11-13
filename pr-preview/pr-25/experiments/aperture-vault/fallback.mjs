import {PANEL_COUNT,TAU,HINGE_RADIUS,HINGE_HEIGHT,CORE_Y,OUTLINE,hingeAngle,bounceWeight,floorShadow} from './core.mjs';

const layers = new WeakMap();
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const light = [0,CORE_Y,0];
const rad = Math.PI/180;
const circle = (r,y=0,n=64) => Array.from({length:n},(_,i)=>[r*Math.cos(TAU*i/n),y,r*Math.sin(TAU*i/n)]);

function camera(p,w,h) {
  const a=(21+p.rotation)*rad,e=p.elevation*rad,r=9.1;
  const toward=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
  const right=[Math.cos(a),0,-Math.sin(a)];
  const up=[-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e)];
  const f=Math.min(w,h)*p.zoom/(2*Math.tan(17.5*rad));
  return ([x,y,z])=>{
    const v=[x,y-.63,z], d=dot(v,toward), scale=f/Math.max(1,r-d);
    return [w/2+dot(v,right)*scale,h/2-dot(v,up)*scale,d];
  };
}

function polygon(ctx,points,fill,stroke,width=1) {
  ctx.beginPath();
  for(const [i,[x,y]] of points.entries()) i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}

function panelAt(i,p,phase) {
  const a=TAU*i/PANEL_COUNT, angle=hingeAngle(i,p.opening,p.cascade,phase);
  const sa=Math.sin(a),ca=Math.cos(a),s=Math.sin(angle),c=Math.cos(angle);
  const transform=([x,y,z=0])=>[sa*(HINGE_RADIUS+s*y+c*z)+ca*x,HINGE_HEIGHT+c*y-s*z,ca*(HINGE_RADIUS+s*y+c*z)-sa*x];
  const n=[-sa*c,s,-ca*c], center=transform([0,.83]);
  const delta=light.map((v,k)=>v-center[k]);
  const d2=dot(delta,delta);
  return {transform,n,center,weight:bounceWeight(dot(n,delta)/Math.sqrt(d2),d2)};
}

// Approximate a soft, circular floor illuminance with closely spaced projected
// contours. All contours and shadow silhouettes use the same world camera.
function pool(ctx,project,x,z,r,strength,color) {
  for(let i=40;i>=1;i--) {
    const q=i/40;
    const falloff = t=>Math.exp(-4.5*t*t);
    const alpha=strength*(falloff((i-1)/40)-falloff(q));
    const ring=circle(r*q,.003,48).map(([u,y,v])=>project([u+x,y,v+z]));
    polygon(ctx,ring,`rgba(${color},${alpha})`);
  }
}

export function drawFallback(canvas,p,phase) {
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const project=camera(p,w,h), one=Math.min(w,h)/850;
  const backdrop=ctx.createRadialGradient(w*.5,h*.52,0,w*.5,h*.53,Math.max(w,h)*.69);
  backdrop.addColorStop(0,'#212b3d');backdrop.addColorStop(.53,'#151e2c');backdrop.addColorStop(1,'#090f19');
  ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);
  let layer=layers.get(canvas);
  if(!layer) {layer=document.createElement('canvas');layers.set(canvas,layer);}
  if(layer.width!==w||layer.height!==h){layer.width=w;layer.height=h;}
  const lc=layer.getContext('2d');
  lc.clearRect(0,0,w,h);
  const leaves=Array.from({length:PANEL_COUNT},(_,i)=>panelAt(i,p,phase));
  pool(lc,project,0,0,6.0,1.28,'255,167,88');
  lc.globalCompositeOperation='destination-out';
  for(const leaf of leaves) polygon(lc,floorShadow(OUTLINE.map(leaf.transform),light).map(project),'rgba(0,0,0,.97)');
  lc.globalCompositeOperation='source-over';
  if(p.lighting==='bounce') {
    for(const {center,n,weight} of leaves) {
      const x=center[0]+n[0]*3.8,z=center[2]+n[2]*3.8;
      pool(lc,project,x,z,2.65,.52*weight,'244,118,70');
    }
  }
  ctx.globalCompositeOperation='screen';ctx.drawImage(layer,0,0);ctx.globalCompositeOperation='source-over';

  for(const [i,r] of [1.68,1.74,2.30,2.36,3.32,3.38,4.42,5.40,6.52].entries()) {
    polygon(ctx,circle(r).map(project),null,i%3===0?'rgba(189,192,184,.39)':'rgba(163,177,190,.23)',one);
  }
  for(let i=0;i<64;i++) {
    const a=i*TAU/64, q=[Math.cos(a),0,Math.sin(a)], b=i%8===0?3.76:3.64;
    const from=project(q.map(v=>v*3.48)),to=project(q.map(v=>v*b));
    ctx.beginPath();ctx.moveTo(...from.slice(0,2));ctx.lineTo(...to.slice(0,2));ctx.strokeStyle='#6c7481';ctx.lineWidth=one;ctx.stroke();
  }
  const shape=(r,y,n=64)=>circle(r,y,n).map(project);
  // Draw the platform under every shutter and an optional halo under the core.
  for(const [r,y,fill,stroke] of [[1.6,0,'#111724','#515461'],[1.53,.12,'#202636','#54515b'],[1.48,.2,'#393445','#a27959'],[1.41,.28,'#333745','#665d5d'],[1.33,.46,'#37414b','#8a7d6f']]) {
    polygon(ctx,shape(r,y),fill,stroke,1.3*one);
  }

  const queue=[];
  const depth=points=>points.reduce((s,q)=>s+q[2],0)/points.length;
  for(const {transform,n,center,weight} of leaves) {
    const hull=OUTLINE.map(v=>project(transform(v)));
    const insert=OUTLINE.map(([x,y])=>project(transform([x*.82,.09+y*.87])));
    const facing=dot(n,cameraFacing(p,center))>0;
    queue.push([depth(hull),()=>{
      polygon(ctx,hull,facing?'#5e3b32':'#243740',facing?'#e3a667':'#a97b59',2.1*one);
      const v= Math.min(1,weight*.62);
      const tone=facing
        ? [102+130*v,52+105*v,36+58*v]
        : [34+12*weight,60+9*weight,73+4*weight];
      const shade=ctx.createLinearGradient(hull[0][0],hull[0][1],hull[5][0],hull[5][1]);
      shade.addColorStop(0,`rgb(${tone.map(Math.round).join(',')})`);
      shade.addColorStop(1,`rgb(${tone.map(x=>Math.round(x*.65)).join(',')})`);
      polygon(ctx,insert,shade,facing?'#d18b5b':'#64828d',one);
      const trace=(points,color)=>{
        ctx.beginPath();
        for(const [i,[x,y]] of points.map(transform).map(project).entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
        ctx.strokeStyle=color;ctx.lineWidth=1.6*one;ctx.stroke();
      };
      for(const sign of [-1,1])trace([[.26*sign,.29],[0,.6],[.29*sign,.62],[0,1.1]],facing?'#d29565':'#719394');
      trace([[0,.17],[0,1.5]],facing?'#ffe0a2':'#9ab7b0');
      trace([[-.38,.02],[.38,.02]],'#b98464');
    }]);
  }

  const c=project(light);
  queue.push([c[2],()=>{
    polygon(ctx,shape(.40,.51),'#453732','#c89059',1.5*one);
    polygon(ctx,shape(.20,.75),'#735035','#e7ba71',one);
    const r=70*one*p.zoom;
    const halo=ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],r);
    halo.addColorStop(0,'rgba(255,194,102,.88)');halo.addColorStop(.30,'rgba(251,162,73,.26)');halo.addColorStop(1,'rgba(251,162,73,0)');
    ctx.fillStyle=halo;ctx.fillRect(c[0]-r,c[1]-r,2*r,2*r);
    const a=TAU*(((phase%1)+1)%1);
    const v=Array.from({length:6},(_,i)=>[Math.cos(a+i*TAU/6)*.24,CORE_Y,Math.sin(a+i*TAU/6)*.24]);
    const points=[...v,[0,CORE_Y+.30,0],[0,CORE_Y-.24,0]].map(project);
    const triangles=[];
    for(let i=0;i<6;i++)for(const j of [6,7]){
      const tri=[points[i],points[(i+1)%6],points[j]];
      triangles.push([depth(tri),tri,i+j]);
    }
    for(const [,tri,i] of triangles.sort((a,b)=>a[0]-b[0])) polygon(ctx,tri,['#fff5cc','#ffc874','#ffe0a0'][i%3],'#fff2c9',one);
  }]);
  for(const [,render] of queue.sort((a,b)=>a[0]-b[0])) render();
}
function cameraFacing(p,center) {
  const a=(21+p.rotation)*rad,e=p.elevation*rad,r=9.1;
  return [r*Math.sin(a)*Math.cos(e)-center[0],.63+r*Math.sin(e)-center[1],r*Math.cos(a)*Math.cos(e)-center[2]];
}
