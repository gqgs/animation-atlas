import {
  TAU, BASE_Y, BASE_RADIUS, SOURCE, add, sub, mul, dot, unit,
  normalAt, centerOf, reflectionAt, softboxes, floorReflection, fresnel, coreLightAt, colorScale, coreAt, coreRings, coreRingPoint,
} from './core.mjs';

const rad=Math.PI/180;
export const CAMERA_TARGET=[0,.66,0];
export function cameraPose(p){
  const a=(76+p.rotation)*rad,e=p.elevation*rad,r=11.0;
  const toward=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];
  return {position:add(CAMERA_TARGET,mul(toward,r)),toward,r,a,e};
}

export function projector(p,w,h){
  const {toward,r,a,e}=cameraPose(p);
  const right=[Math.cos(a),0,-Math.sin(a)];
  const up=[-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e)];
  const focal=Math.min(w,h)*p.zoom/(2*Math.tan(16*rad));
  return q=>{
    const v=sub(q,CAMERA_TARGET),d=dot(v,toward),f=focal/Math.max(.55,r-d);
    return [w/2+dot(v,right)*f,h/2-dot(v,up)*f,d];
  };
}

function path(ctx,points){
  for(const [i,[x,y]] of points.entries())i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  ctx.closePath();
}
export function polygon(ctx,points,fill,stroke,width=1){
  if(!points.length)return;
  ctx.beginPath();path(ctx,points);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
const loop=(r,y=0,n=6)=>Array.from({length:n},(_,i)=>[r*Math.cos(i*TAU/n),y,r*Math.sin(i*TAU/n)]);
const depth=points=>points.reduce((s,q)=>s+q[2],0)/points.length;
const line=(ctx,a,b,color,width)=>{
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
};
function glow(ctx,p,r,color,opacity){
  const [x,y]=p;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();
}

function clipNear(points,camera){
  const ds=p=>camera.r-.60-dot(sub(p,CAMERA_TARGET),camera.toward);
  const out=[];
  let a=points.at(-1),ad=ds(a);
  for(const b of points){
    const bd=ds(b);
    if((ad>0)!==(bd>0)) out.push(add(a,mul(sub(b,a),ad/(ad-bd))));
    if(bd>0)out.push(b);
    a=b;ad=bd;
  }
  return out;
}

function softboxImage(ctx,face,camera,project,box){
  const image=reflectionAt(face,camera.position,box);
  if(!image||image.opacity<.03)return;
  // Nested rectangles stand in for a diffused strip with soft edges.
  const center=centerOf(image.points);
  for(let i=14;i>=1;i--){
    const s=.56+.44*i/14;
    const points=clipNear(image.points.map(p=>add(center,mul(sub(p,center),s))),camera);
    if(points.length<3)continue;
    ctx.globalAlpha=image.opacity*(i===1?.40:.051);
    polygon(ctx,points.map(project),box.color);
  }
}

function drawPatch(ctx,project,patch,color,weight){
  const a=unit([patch.direction[0],0,patch.direction[2]]),b=[-a[2],0,a[0]];
  const [x,y]=project(patch.point);
  const u=project(add(patch.point,mul(a,patch.length)));
  const v=project(add(patch.point,mul(b,patch.radius)));
  const ax=u[0]-x,ay=u[1]-y,bx=v[0]-x,by=v[1]-y;
  if(Math.abs(ax*by-ay*bx)<1e-3)return;
  ctx.save();
  ctx.transform(ax,ay,bx,by,x,y);
  const grad=ctx.createRadialGradient(0,0,0,0,0,1);
  grad.addColorStop(0,color);grad.addColorStop(.42,color+'73');
  grad.addColorStop(.76,color+'16');grad.addColorStop(1,color+'00');
  ctx.globalAlpha=Math.min(.85,patch.strength*weight);
  ctx.fillStyle=grad;ctx.fillRect(-1,-1,2,2);
  ctx.restore();
}
// Common analytic reflection overlay, composed over either scene renderer.
export function drawReflections(ctx,p,faces,project,scale){
  const w=ctx.canvas.width,h=ctx.canvas.height;
  const camera=cameraPose(p);
  const eye=camera.position, light=coreLightAt(p);
  if(p.lighting!=='direct'){
    ctx.save();
    ctx.globalCompositeOperation='screen';
    // No secondary shadow rays: keep the representative floor lobes off the
    // opaque pedestal with a screen mask so the light remains on the receiver.
    ctx.beginPath();ctx.rect(0,0,w,h);path(ctx,loop(1.65,BASE_Y).map(project));ctx.clip('evenodd');
    for(const face of faces){
      const core=floorReflection(face);
      if(core&&light.strength>0)drawPatch(ctx,project,core,light.color,.67*light.strength);
      for(const box of softboxes){
        const patch=floorReflection(face,box.center);
        if(patch)drawPatch(ctx,project,patch,box.color,box.color==='#ffc78b'?.87:.62);
      }
    }
    ctx.restore();
  }

  const panels=faces.map(f=>({f,pts:f.map(project)})).sort((a,b)=>depth(a.pts)-depth(b.pts));
  for(const {f,pts} of panels){
    const n=normalAt(f),facing=fresnel(dot(unit(sub(eye,centerOf(f))),n));
    if(p.lighting!=='direct'){
      ctx.save();
      ctx.beginPath();path(ctx,pts);ctx.clip();
      ctx.globalCompositeOperation='screen';
      for(const box of softboxes)softboxImage(ctx,f,camera,project,box);
      ctx.restore();
    }
    // Thin edge definition stays visible when reflections are disabled.
    const amount=p.lighting==='direct'?.23:Math.min(.72,.25+.63*facing);
    polygon(ctx,pts,null,`rgba(172,209,234,${amount})`,scale*(.65+.75*facing));
  }

  const from=project(SOURCE);
  ctx.save();ctx.globalCompositeOperation='screen';
  if(light.strength>0){
    glow(ctx,from,(37+12*light.emission)*scale,light.color,.32*light.emission);
    glow(ctx,from,17*scale,colorScale(light.color,1,.24),.67*light.emission);
  }
  ctx.restore();
}

export function drawFallback(canvas,p,faces,phase){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const project=projector(p,w,h),scale=Math.min(w,h)/850,light=coreLightAt(p);
  const bg=ctx.createRadialGradient(w*.48,h*.52,0,w*.48,h*.52,Math.max(w,h)*.65);
  bg.addColorStop(0,'#253049');bg.addColorStop(.62,'#121b2d');bg.addColorStop(1,'#080d17');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Project a broad nearby light footprint. This matches the light controls,
  // not the precise PBR falloff of the WebGL point light.
  if(light.strength>0){
    ctx.save();ctx.globalCompositeOperation='screen';
    drawPatch(ctx,project,{point:[0,0,0],direction:[1,0,0],length:3.85,radius:3.85,strength:light.emission},light.color,.53);
    ctx.restore();
  }
  for(const [i,r] of [1.8,2.02,2.8,3.44,4.1,4.2,5.02,6.12].entries()){
    polygon(ctx,loop(r,0,96).map(project),null,i%3===0?'#68769256':'#586e9130',.8*scale);
  }
  for(let i=0;i<60;i++){
    const a=i*TAU/60,r=i%5===0?4.50:4.39;
    line(ctx,project([4.26*Math.cos(a),0,4.26*Math.sin(a)]),project([r*Math.cos(a),0,r*Math.sin(a)]),'#64729369',scale);
  }
  for(const [radius,y,fill,stroke] of [
    [1.62,.035,'#111827','#354363'],[1.60,.13,'#202b40','#455475'],
    [1.54,.23,'#273146','#6b819f'],[BASE_RADIUS,BASE_Y,'#303d55','#879aab'],
  ])polygon(ctx,loop(radius,y).map(project),fill,stroke,1.2*scale);

  if(light.strength>0){
    ctx.save();
    ctx.beginPath();path(ctx,loop(BASE_RADIUS,BASE_Y).map(project));ctx.clip();
    ctx.globalCompositeOperation='screen';
    drawPatch(ctx,project,{point:[0,BASE_Y,0],direction:[1,0,0],length:1.70,radius:1.70,strength:light.emission},light.color,.64);
    ctx.restore();
  }
  const from=project(SOURCE),camera=cameraPose(p);
  const panels=faces.map(f=>({f,pts:f.map(project)})).sort((a,b)=>depth(a.pts)-depth(b.pts));
  const glass=({f,pts})=>{
    const n=normalAt(f);
    const amount=fresnel(dot(unit(sub(camera.position,centerOf(f))),n));
    const gradient=ctx.createLinearGradient(pts[0][0],pts[0][1],pts[2][0],pts[2][1]);
    gradient.addColorStop(0,`rgba(85,148,194,${.075+amount*.12})`);
    gradient.addColorStop(.50,'rgba(145,194,230,.035)');
    gradient.addColorStop(1,`rgba(151,184,231,${.085+amount*.13})`);
    polygon(ctx,pts,gradient);
  };
  for(const panel of panels)if(depth(panel.pts)<from[2])glass(panel);
  for(const [r,y,fill,stroke] of [[.33,.40,'#6d7482','#c7cde1'],[.21,.61,'#2e3a58','#889ab1']]){
    polygon(ctx,loop(r,y,16).map(project),fill,stroke,scale);
  }
  const segments=[];
  for(const [i,ring] of coreRings.entries()){
    for(let k=0;k<64;k++){
      const a=project(coreRingPoint(ring,k*TAU/64)),b=project(coreRingPoint(ring,(k+1)*TAU/64));
      segments.push({a,b,front:(a[2]+b[2])/2>=from[2],i,k});
    }
  }
  const cage=front=>{
    for(const {a,b,front:f,i,k} of segments)if(f===front){
      line(ctx,a,b,front?'#b9a483':'#897c6b',scale*(i===2?2.1:1.4));
      if(i===2&&k%8===0){
        ctx.beginPath();ctx.arc(a[0],a[1],1.7*scale,0,TAU);ctx.fillStyle='#d6bf98';ctx.fill();
      }
    }
  };
  cage(false);
  const gem=coreAt(phase).map(({verts,shade})=>({points:verts.map(project),shade})).sort((a,b)=>depth(a.points)-depth(b.points));
  for(const {points,shade} of gem){
    const fill=colorScale(light.color,.105+.98*light.emission*shade,.02+.12*light.emission*shade);
    polygon(ctx,points,fill,light.strength>0?colorScale(light.color,.49+.61*light.emission,.09):'#3b3c42',.50*scale);
  }
  cage(true);
  for(const panel of panels)if(depth(panel.pts)>=from[2])glass(panel);
}
