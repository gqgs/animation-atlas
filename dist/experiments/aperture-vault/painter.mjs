import * as T from '../../vendor/0.180.0/build/three.module.js';
import {BASE_Y,BASE_RADIUS,SOURCE,TAU,facesAt,poseAt} from './core.mjs';
import {CAMERA_TARGET,cameraPose,drawFallback,drawOptics,opticalFrame,projector} from './fallback.mjs';

const renderers=new WeakMap();
const surfaceStyle=(color,roughness,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const glassStyle=(color,opacity)=>new T.MeshPhysicalMaterial({
  color,roughness:.19,metalness:.10,transparent:true,opacity,depthWrite:false,
  side:T.DoubleSide,clearcoat:.85,clearcoatRoughness:.12,
});
const lineStyle=(color,opacity)=>new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});

function build(){
  const surface=document.createElement('canvas');
  const context=surface.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
  if(!context) return null;
  const renderer=new T.WebGLRenderer({canvas:surface,context});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.42;
  renderer.setClearColor(0x080d19);
  const scene=new T.Scene();
  scene.fog=new T.FogExp2(0x080d19,.048);
  const camera=new T.PerspectiveCamera(32,1,.08,58);
  function mesh(geometry,material){
    const m=new T.Mesh(geometry,material);scene.add(m);return m;
  }
  function shape(count,mat,edgeMat){
    const geometry=new T.BufferGeometry();
    const edges=new T.BufferGeometry();
    const verts=new Float32Array(9*(count-2)),lineVerts=new Float32Array(6*count);
    geometry.setAttribute('position',new T.BufferAttribute(verts,3));
    edges.setAttribute('position',new T.BufferAttribute(lineVerts,3));
    const face=mesh(geometry,mat),border=new T.LineSegments(edges,edgeMat);
    face.frustumCulled=false;border.frustumCulled=false;scene.add(border);
    return points=>{
      for(let i=1;i<count-1;i++){
        verts.set(points[0],9*(i-1));verts.set(points[i],9*(i-1)+3);verts.set(points[i+1],9*(i-1)+6);
      }
      for(let i=0;i<count;i++){
        lineVerts.set(points[i],i*6);lineVerts.set(points[(i+1)%count],i*6+3);
      }
      geometry.attributes.position.needsUpdate=true;
      geometry.computeVertexNormals();
      edges.attributes.position.needsUpdate=true;
      const center=points.reduce((v,p)=>v.add(new T.Vector3(...p)),new T.Vector3()).multiplyScalar(1/count);
      face.renderOrder=10+center.distanceTo(camera.position)*-.1;
      border.renderOrder=20+center.distanceTo(camera.position)*-.1;
    };
  }

  const graphite=surfaceStyle(0x263346,.85);
  const alloy=surfaceStyle(0x435775,.54,.37);
  const inset=surfaceStyle(0x536482,.55,.23);
  const rim=surfaceStyle(0x92a6b8,.42,.55);
  const floor=mesh(new T.PlaneGeometry(80,80),graphite);
  floor.rotation.x=-Math.PI/2;
  const markings=surfaceStyle(0x65748a,.77);
  for(const [i,r] of [1.8,2.02,2.8,3.44,4.1,4.2,5.02,6.12].entries()){
    const m=mesh(new T.RingGeometry(r,r+(i%3===0?.026:.011),128),markings);
    m.rotation.x=-Math.PI/2;m.position.y=.003;
  }
  const ticks=new T.InstancedMesh(new T.BoxGeometry(.012,.007,.19),markings,60);
  const dummy=new T.Object3D();
  for(let i=0;i<60;i++){
    const a=i*TAU/60;
    dummy.position.set(Math.sin(a)*4.32,.006,Math.cos(a)*4.32);
    dummy.rotation.y=a;dummy.scale.z=i%5===0?1.6:1;dummy.updateMatrix();
    ticks.setMatrixAt(i,dummy.matrix);
  }
  scene.add(ticks);
  for(const [top,bottom,y,h,sides,mat] of [
    [1.60,1.64,.095,.19,6,alloy],[1.54,1.60,.207,.044,6,rim],
    [1.50,1.54,.284,.112,6,inset],[.36,.43,.385,.09,24,alloy],
    [.23,.36,.50,.14,24,rim],[.15,.22,.64,.16,24,alloy],
  ]){
    const m=mesh(new T.CylinderGeometry(top,bottom,h,sides),mat);
    m.rotation.y=Math.PI/2;m.position.y=y;
  }
  const hinges=Array.from({length:6},()=>mesh(new T.CylinderGeometry(.023,.023,BASE_RADIUS,10),rim));
  const up=new T.Vector3(0,1,0);
  for(const [i,[a,b]] of facesAt(0).entries()){
    const va=new T.Vector3(...a),vb=new T.Vector3(...b);
    hinges[i].position.copy(va).lerp(vb,.5);
    hinges[i].quaternion.setFromUnitVectors(up,vb.sub(va).normalize());
  }
  const mainGlass=glassStyle(0xa2c4ef,.15);
  const nearGlass=glassStyle(0xc3e6ff,.20);
  const mainEdge=lineStyle(0x94b7ed,.76);
  const frontEdge=lineStyle(0xe3f2ff,.94);
  const faces=Array.from({length:6},(_,i)=>shape(3,i===0?nearGlass:mainGlass,i===0?frontEdge:mainEdge));
  const thickGlass=glassStyle(0xc1e6fc,.36);
  const thickEdge=lineStyle(0xe1f4ff,.96);
  const prism=[3,3,4,4,4].map(n=>shape(n,thickGlass,thickEdge));
  const core=mesh(new T.IcosahedronGeometry(.148,0),new T.MeshBasicMaterial({color:0xffefd9,toneMapped:false}));
  core.position.set(...SOURCE);
  const wire=mesh(new T.IcosahedronGeometry(.207,0),new T.MeshBasicMaterial({color:0xbecdf5,wireframe:true}));
  wire.position.copy(core.position);
  const lamp=new T.PointLight(0xffe6c7,4.8,7,2);
  lamp.position.copy(core.position);scene.add(lamp);
  scene.add(new T.HemisphereLight(0xb8d5ff,0x233657,1.60));
  const softbox=new T.DirectionalLight(0x8cabf8,1.55);softbox.position.set(0,6,5);scene.add(softbox);
  const edgeLight=new T.DirectionalLight(0x6e99ed,1.65);edgeLight.position.set(-5,3,-4);scene.add(edgeLight);

  return {
    surface,
    render(p,frame,phase,w,h){
      if(context.isContextLost()) throw new Error('Graphics context lost. Reload to restore the vault.');
      if(surface.width!==w||surface.height!==h)renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.zoom=p.zoom*Math.min(1,w/h);
      camera.updateProjectionMatrix();
      camera.position.set(...cameraPose(p).position);
      camera.lookAt(...CAMERA_TARGET);
      core.rotation.set(.35,TAU*(((phase%1)+1)%1),.14);
      wire.rotation.set(.17,-core.rotation.y,.32);
      for(const [i,f] of frame.faces.entries()) faces[i](f);
      for(const [i,poly] of frame.optics.prism.polygons.entries()) prism[i](poly);
      renderer.render(scene,camera);
      return surface;
    },
    dispose(){
      const resources=new Set();
      scene.traverse(o=>{
        if(o.geometry) resources.add(o.geometry);
        if(o.material) resources.add(o.material);
      });
      for(const resource of resources)resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export function draw(target,settings,tracks,phase){
  if(!target.width||!target.height) return;
  if(!renderers.has(target))renderers.set(target,build());
  const r=renderers.get(target),p=poseAt(settings,tracks,phase);
  const frame={faces:facesAt(p.opening),...opticalFrame(p)};
  const w=target.width,h=target.height;
  if(!r){drawFallback(target,p,frame);return 'Canvas 2D · analytic optics';}
  const ctx=target.getContext('2d');
  ctx.drawImage(r.render(p,frame,phase,w,h),0,0);
  drawOptics(ctx,p,frame,projector(p,w,h),Math.min(w,h)/850);
  return 'WebGL2 · analytic optics';
}
export function dispose(target){
  renderers.get(target)?.dispose();
  renderers.delete(target);
}
