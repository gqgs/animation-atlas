import * as T from '../../vendor/0.180.0/build/three.module.js';
import {BASE_Y,BASE_RADIUS,SOURCE,TAU,facesAt,poseAt,coreAt,coreRings,coreRingPoint,coreLightAt,colorScale} from './core.mjs';
import {CAMERA_TARGET,cameraPose,drawFallback,drawReflections,projector} from './fallback.mjs';

const renderers=new WeakMap();
const surfaceStyle=(color,roughness,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const glassStyle=(color,opacity)=>new T.MeshPhysicalMaterial({
  color,roughness:.19,metalness:.10,transparent:true,opacity,depthWrite:false,
  side:T.DoubleSide,clearcoat:.85,clearcoatRoughness:.12,
});

function build(){
  const surface=document.createElement('canvas');
  const context=surface.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
  if(!context) return null;
  const renderer=new T.WebGLRenderer({canvas:surface,context});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.23;
  renderer.setClearColor(0x080d19);
  const scene=new T.Scene();
  scene.fog=new T.FogExp2(0x080d19,.048);
  const camera=new T.PerspectiveCamera(32,1,.08,58);
  function mesh(geometry,material){
    const m=new T.Mesh(geometry,material);scene.add(m);return m;
  }
  function shape(count,mat){
    const geometry=new T.BufferGeometry();
    const verts=new Float32Array(9*(count-2));
    geometry.setAttribute('position',new T.BufferAttribute(verts,3));
    const face=mesh(geometry,mat);
    face.frustumCulled=false;
    return points=>{
      for(let i=1;i<count-1;i++){
        verts.set(points[0],9*(i-1));verts.set(points[i],9*(i-1)+3);verts.set(points[i+1],9*(i-1)+6);
      }
      geometry.attributes.position.needsUpdate=true;
      geometry.computeVertexNormals();
      const center=points.reduce((v,p)=>v.add(new T.Vector3(...p)),new T.Vector3()).multiplyScalar(1/count);
      face.renderOrder=10+center.distanceTo(camera.position)*-.1;
    };
  }

  const graphite=surfaceStyle(0x242c3c,.90);
  const alloy=surfaceStyle(0x435775,.54,.37);
  const inset=surfaceStyle(0x536482,.55,.23);
  const rim=surfaceStyle(0x92a6b8,.42,.55);
  const floor=mesh(new T.PlaneGeometry(80,80),graphite);
  floor.rotation.x=-Math.PI/2;
  const markings=surfaceStyle(0x495465,.77);
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
  const mainGlass=glassStyle(0xabc9e8,.13);
  const nearGlass=glassStyle(0xbde1f5,.16);
  const faces=Array.from({length:6},(_,i)=>shape(3,i===0?nearGlass:mainGlass));
  const coreGeometry=new T.BufferGeometry();
  const nTriangles=coreAt(0).reduce((sum,f)=>sum+f.verts.length-2,0);
  const vertices=new Float32Array(9*nTriangles),colors=new Float32Array(9*nTriangles);
  coreGeometry.setAttribute('position',new T.BufferAttribute(vertices,3));
  coreGeometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const core=mesh(coreGeometry,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}));
  core.frustumCulled=false;
  const cage=new T.MeshStandardMaterial({color:0xac9374,metalness:.63,roughness:.32});
  for(const [i,ring] of coreRings.entries()){
    const path=new T.CatmullRomCurve3(Array.from({length:48},(_,k)=>new T.Vector3(...coreRingPoint(ring,TAU*k/48))),true);
    mesh(new T.TubeGeometry(path,72,i===2?.011:.008,6,true),cage);
    if(i===2){
      const beadGeometry=new T.SphereGeometry(.018,8,6);
      for(let k=0;k<8;k++)mesh(beadGeometry,cage).position.set(...coreRingPoint(ring,k*TAU/8));
    }
  }
  const lamp=new T.PointLight(0xffcf91,7.4,8,2);
  lamp.position.set(...SOURCE);scene.add(lamp);
  scene.add(new T.HemisphereLight(0xb8d5ff,0x233657,1.60));
  const softbox=new T.DirectionalLight(0xadc3ea,1.28);softbox.position.set(0,6,5);scene.add(softbox);
  const edgeLight=new T.DirectionalLight(0x8899bc,1.25);edgeLight.position.set(-5,3,-4);scene.add(edgeLight);

  return {
    surface,
    render(p,panels,phase,w,h){
      if(context.isContextLost()) throw new Error('Graphics context lost. Reload to restore the vault.');
      if(surface.width!==w||surface.height!==h)renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.zoom=p.zoom*Math.min(1,w/h);
      camera.updateProjectionMatrix();
      camera.position.set(...cameraPose(p).position);
      camera.lookAt(...CAMERA_TARGET);
      const light=coreLightAt(p);
      lamp.color.set(light.color);
      lamp.intensity=light.pointPower;
      let k=0;
      for(const {verts,shade} of coreAt(phase)){
        const color=new T.Color(colorScale(light.color,.105+.98*light.emission*shade,.02+.12*light.emission*shade));
        for(let i=1;i<verts.length-1;i++)for(const q of [verts[0],verts[i],verts[i+1]]){
          vertices.set(q,k);color.toArray(colors,k);k+=3;
        }
      }
      coreGeometry.attributes.position.needsUpdate=true;
      coreGeometry.attributes.color.needsUpdate=true;
      for(const [i,f] of panels.entries()) faces[i](f);
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
  const panels=facesAt(p.opening),w=target.width,h=target.height;
  const ctx=target.getContext('2d');
  if(r)ctx.drawImage(r.render(p,panels,phase,w,h),0,0);
  else drawFallback(target,p,panels,phase);
  drawReflections(ctx,p,panels,projector(p,w,h),Math.min(w,h)/850);
  return r?'WebGL2 · planar reflections':'Canvas 2D · planar reflections';
}
export function dispose(target){
  renderers.get(target)?.dispose();
  renderers.delete(target);
}
