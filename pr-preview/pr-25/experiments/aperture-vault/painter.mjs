import * as T from '../../vendor/0.180.0/build/three.module.js';
import {PANEL_COUNT, TAU, HINGE_RADIUS, HINGE_HEIGHT, CORE_Y, OUTLINE, bounceWeight, hingeAngle, poseAt} from './core.mjs';
import {drawFallback} from './fallback.mjs';

const renderers = new WeakMap();
const rad = degrees => degrees * Math.PI / 180;

function build() {
  const surface = document.createElement('canvas');
  const context = surface.getContext('webgl2', {
    alpha:false, antialias:true, preserveDrawingBuffer:true,
  });
  if(!context) return null;
  const renderer = new T.WebGLRenderer({canvas:surface,context});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setClearColor(0x090f19);

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x090f19,.072);
  const camera = new T.PerspectiveCamera(35,1,.07,40);
  const material = (color,roughness,metalness=0) => new T.MeshStandardMaterial({color,roughness,metalness});
  function mesh(g,m,parent=scene,{shadow=false,receive=true}={}) {
    const result = new T.Mesh(g,m);
    result.castShadow = shadow;
    result.receiveShadow = receive;
    parent.add(result);
    return result;
  }
  const rim = material(0x9a603b,.34,.52);
  const panelOutside = material(0x25404d,.35,.36);
  const inner = material(0xb56d35,.49,.31);
  const seam = material(0x5d9998,.48,.37);
  const stone = material(0x252939,.88,.08);
  const plinth = material(0x1f2937,.57,.32);
  const etched = material(0x424854,.73,.18);

  const ground = mesh(new T.PlaneGeometry(80,80),stone);
  ground.rotation.x = -Math.PI/2;
  // Fine floor engraving makes the moving pools legible without screen-space bloom.
  const rings = [1.68,1.74,2.30,2.36,3.32,3.38,4.42,5.40,6.52];
  for(const [i,r] of rings.entries()) {
    const line = mesh(new T.RingGeometry(r,r+([0,3,5,8].includes(i)?.027:.013),96),etched);
    line.rotation.x = -Math.PI/2;
    line.position.y = .002;
  }
  const ticks = new T.InstancedMesh(new T.BoxGeometry(.015,.005,.19),etched,64);
  ticks.receiveShadow = true;
  const mark = new T.Object3D();
  for(let i=0;i<64;i++) {
    const a = TAU*i/64;
    mark.position.set(3.51*Math.sin(a),.003,3.51*Math.cos(a));
    mark.rotation.y = a;
    mark.scale.z = i%8===0?2:1;
    mark.updateMatrix();
    ticks.setMatrixAt(i,mark.matrix);
  }
  scene.add(ticks);
  for(const [rTop,rBottom,height,y,m] of [
    [1.45,1.6,.19,.095,plinth],
    [1.37,1.45,.08,.23,rim],
    [1.33,1.37,.20,.37,plinth],
    [.39,.50,.13,.535,stone],
    [.17,.37,.22,.675,rim],
  ]) {
    const disk = mesh(new T.CylinderGeometry(rTop,rBottom,height,64),m,scene,{shadow:true});
    disk.position.y=y;
  }

  const shell = new T.Shape();
  const outline = OUTLINE;
  for(const [i,[x,y]] of outline.entries()) i ? shell.lineTo(x,y) : shell.moveTo(x,y);
  shell.closePath();
  const shellGeo = new T.ExtrudeGeometry(shell,{
    depth:.045, bevelEnabled:true, bevelSegments:1, bevelSize:.018, bevelThickness:.018, steps:1,
  });
  const inset = new T.Shape();
  for(const [i,[x,y]] of outline.entries()) i ? inset.lineTo(.81*x,.09+.88*y) : inset.moveTo(.81*x,.09+.88*y);
  inset.closePath();
  const insetGeo = new T.ShapeGeometry(inset);
  const insetInside = insetGeo.clone();
  insetInside.rotateY(Math.PI);
  const ribGeometry = new T.CylinderGeometry(.018,.018,1,6);
  const orient = new T.Vector3(0,1,0);
  function rib(parent,a,b,m) {
    const p = new T.Vector3(...a),q = new T.Vector3(...b);
    const r = mesh(ribGeometry,m,parent);
    r.position.copy(p).lerp(q,.5);
    r.quaternion.setFromUnitVectors(orient,q.clone().sub(p).normalize());
    r.scale.y=p.distanceTo(q);
  }
  const panels = [];
  for(let i=0;i<PANEL_COUNT;i++) {
    const joint = new T.Group();
    const a = TAU*i/PANEL_COUNT;
    joint.position.set(Math.sin(a)*HINGE_RADIUS,HINGE_HEIGHT,Math.cos(a)*HINGE_RADIUS);
    joint.rotation.y = a;
    scene.add(joint);
    const axis = mesh(new T.CylinderGeometry(.063,.063,.83,12),rim,joint,{shadow:true});
    axis.rotation.z = Math.PI/2;
    const leaf = new T.Group();
    joint.add(leaf);
    mesh(shellGeo,rim,leaf,{shadow:true});
    mesh(insetGeo,panelOutside,leaf).position.z = .047;
    mesh(insetInside,inner,leaf).position.z = -.002;
    for(const z of [.053,-.006]) {
      const m = z>0?seam:rim;
      rib(leaf,[0,.19,z],[0,1.47,z],m);
      for(const x of [-1,1]) {
        rib(leaf,[0,1.08,z],[x*.294,.59,z],m);
        rib(leaf,[0,.58,z],[x*.26,.30,z],m);
      }
    }
    const bounce = new T.SpotLight(0xffa05b,0,6.5,1.0,.85,2);
    scene.add(bounce,bounce.target);
    panels.push({leaf,bounce});
  }

  const corePosition = new T.Vector3(0,CORE_Y,0);
  const direct = new T.PointLight(0xffc07b,72,10,2);
  direct.position.copy(corePosition);
  direct.castShadow = true;
  direct.shadow.mapSize.set(256,256);
  direct.shadow.camera.near = .10;
  direct.shadow.camera.far = 10;
  direct.shadow.bias = -.0006;
  direct.shadow.normalBias = .02;
  direct.shadow.radius = 2;
  scene.add(direct);

  const core = mesh(new T.IcosahedronGeometry(.28,1),new T.MeshBasicMaterial({color:new T.Color(5.2,2.7,.85)}),scene,{receive:false});
  core.position.copy(corePosition);
  const wire = mesh(new T.IcosahedronGeometry(.35,0),new T.MeshBasicMaterial({color:0xffc779,wireframe:true}),scene,{receive:false});
  wire.position.copy(corePosition);
  const hemi = new T.HemisphereLight(0xaac7f5,0x293b56,1.18);
  const cool = new T.DirectionalLight(0xb4d8ff,1.35);
  cool.position.set(-4,6,1.3);
  const edge = new T.DirectionalLight(0x629fe4,1.20);
  edge.position.set(3,4,-5);
  scene.add(hemi,cool,edge);

  const normal=new T.Vector3(),point=new T.Vector3(),towardCore=new T.Vector3();
  const quat=new T.Quaternion();
  return {
    surface,
    render(p,phase,width,height) {
      if(context.isContextLost()) throw new Error('Graphics context lost. Reload to restore the vault.');
      if(surface.width!==width||surface.height!==height) renderer.setSize(width,height,false);
      const sizeScale = Math.min(1,width/height);
      camera.aspect=width/height;
      camera.zoom=p.zoom*sizeScale;
      camera.updateProjectionMatrix();
      const a=rad(21+p.rotation), e=rad(p.elevation), r=9.1;
      camera.position.set(r*Math.sin(a)*Math.cos(e),.63+r*Math.sin(e),r*Math.cos(a)*Math.cos(e));
      camera.lookAt(0,.63,0);
      const wrapped = ((phase%1)+1)%1;
      core.rotation.y = TAU * wrapped;
      wire.rotation.set(.35,-TAU*wrapped,.18);
      for(const [i,{leaf,bounce}] of panels.entries()) {
        leaf.rotation.x=hingeAngle(i,p.opening,p.cascade,phase);
        leaf.updateWorldMatrix(true,false);
        leaf.getWorldQuaternion(quat);
        normal.set(0,0,-1).applyQuaternion(quat);
        point.set(0,.83,-.033);
        leaf.localToWorld(point);
        towardCore.copy(corePosition).sub(point);
        const distanceSquared=towardCore.lengthSq();
        bounce.intensity = p.lighting==='bounce' ? 23*bounceWeight(normal.dot(towardCore.normalize()),distanceSquared) : 0;
        bounce.position.copy(point).addScaledVector(normal,.08);
        bounce.target.position.copy(bounce.position).addScaledVector(normal,1.4);
      }
      renderer.render(scene,camera);
      return surface;
    },
    dispose() {
      const resources=new Set();
      scene.traverse(o=>{
        if(o.geometry) resources.add(o.geometry);
        if(o.material) resources.add(o.material);
        if(o.shadow) resources.add(o.shadow);
      });
      for(const resource of resources) resource.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export function draw(target,settings,tracks,phase) {
  if(!target.width||!target.height) return;
  let r=renderers.get(target);
  if(!renderers.has(target)) { r=build();renderers.set(target,r); }
  const p=poseAt(settings,tracks,phase);
  if(!r) {drawFallback(target,p,phase);return 'Canvas 2D · analytic floor shadows';}
  const ctx=target.getContext('2d');
  ctx.drawImage(r.render(p,phase,target.width,target.height),0,0);
  return 'WebGL2 · point-light shadows';
}

export function dispose(target) {
  renderers.get(target)?.dispose();
  renderers.delete(target);
}
