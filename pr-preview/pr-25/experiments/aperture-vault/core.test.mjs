import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_Y, APEX_HEIGHT, defaults, defaultTracks, definitions, facesAt,
  poseAt, readState, sub, dot, mul, add, unit, normalAt, reflect, mirrorPoint,
  fresnel, reflectionAt, floorReflection, softboxes, centerOf, coreAt, coreLightAt, coreRings, coreRingPoint, SOURCE,
} from './core.mjs';
import {serializeTracks} from '../../shared/parameter-tracks.mjs';

const distance=(a,b)=>Math.hypot(...sub(a,b));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('six rigid triangles share one apex at closure and retain edge lengths and hinges',()=>{
  const closed=facesAt(0);
  assert.equal(closed.length,6);
  for(const [i,f] of closed.entries()){
    assert.deepEqual(f[2],[0,BASE_Y+APEX_HEIGHT,0]);
    assert.deepEqual(f[1],closed[(i+1)%6][0]);
  }
  for(let step=1;step<=100;step++)for(const [i,f] of facesAt(step/100).entries()){
    const base=closed[i];
    assert.deepEqual(f.slice(0,2),base.slice(0,2));
    for(let j=0;j<3;j++)close(distance(f[j],f[(j+1)%3]),distance(base[j],base[(j+1)%3]));
  }
  assert.deepEqual(poseAt(defaults,defaultTracks,0),poseAt(defaults,defaultTracks,1));
});

test('plane mirroring reverses only the normal component and is its own inverse',()=>{
  const face=facesAt(.31)[0],n=normalAt(face),p=[4.1,3.2,-2.3];
  const m=mirrorPoint(p,face,n);
  close(dot(sub(p,face[0]),n),-dot(sub(m,face[0]),n));
  close(distance(mirrorPoint(m,face,n),p),0);
  const d=unit([1,-1,0]),r=reflect(d,[0,1,0]);
  close(r[0],d[0]);close(r[1],-d[1]);close(Math.hypot(...r),1);
});

test('a mirrored strip changes with hinge angle and disappears across the face plane',()=>{
  const eye=[9,7,2];
  const box=softboxes[0];
  const first=reflectionAt(facesAt(0)[0],eye,box);
  const next=reflectionAt(facesAt(.12)[0],eye,box);
  assert.ok(first&&next);
  assert.notDeepEqual(first.points,next.points);
  const f=facesAt(.12)[0],n=normalAt(f),c=centerOf(f);
  assert.equal(reflectionAt(f,add(c,mul(n,2)),{...box,center:add(c,mul(n,-2))}),null);
  close(fresnel(1),.04);
  close(fresnel(0),1);
  assert.ok(fresnel(.2)>fresnel(.8));
});

test('representative floor reflections shift on the ground with the shutters',()=>{
  const collect=o=>facesAt(o).flatMap(f=>softboxes.map(box=>floorReflection(f,box.center)).filter(Boolean));
  const closed=collect(0),open=collect(.40);
  assert.ok(closed.length>0&&open.length>0);
  assert.notDeepEqual(closed,open);
  for(const p of [...closed,...open]){
    close(p.point[1],0);
    assert.ok(p.direction[1]<0&&p.strength>0&&p.strength<=1);
  }
});

test('validated URL settings retain cyclic controls and the lighting mode',()=>{
  const params=new URLSearchParams({rotation:'270',elevation:'',duration:'2',lighting:'direct',tracks:serializeTracks(defaultTracks,definitions)});
  const {settings,tracks}=readState(params);
  assert.equal(settings.rotation,180);
  assert.equal(settings.elevation,33);
  assert.equal(settings.duration,4);
  assert.equal(settings.lighting,'direct');
  assert.deepEqual(tracks,defaultTracks);
  assert.deepEqual(readState(new URLSearchParams({tracks:'{}'})).tracks,{});
});

test('core light strength and validated color travel through pose and cyclic state',()=>{
  const params=new URLSearchParams({intensity:'1.7',coreColor:'#5BC2FF',tracks:'{"v":1,"t":{"intensity":[0,2,"sine"]}}'});
  const {settings,tracks}=readState(params);
  assert.equal(settings.intensity,1.7);
  assert.equal(settings.coreColor,'#5bc2ff');
  const low=coreLightAt(poseAt(settings,tracks,0));
  const high=coreLightAt(poseAt(settings,tracks,.5));
  assert.deepEqual(low,{color:'#5bc2ff',strength:0,pointPower:0,emission:0});
  assert.equal(high.color,low.color);
  assert.ok(high.pointPower>0&&high.emission>0);
  assert.deepEqual(low,coreLightAt(poseAt(settings,tracks,1)));
  assert.equal(readState(new URLSearchParams({coreColor:'#xyz',intensity:'100'})).settings.coreColor,defaults.coreColor);
  assert.equal(readState(new URLSearchParams({intensity:'100'})).settings.intensity,2.4);
});

test('faceted core loops and the cage stays centered at the light source',()=>{
  assert.deepEqual(coreAt(0),coreAt(1));
  assert.notDeepEqual(coreAt(.2),coreAt(0));
  assert.ok(coreAt(0).length>20);
  for(const ring of coreRings){
    const a=coreRingPoint(ring,0),b=coreRingPoint(ring,Math.PI);
    close(distance(a,b),2*ring.radius);
    const center=mul(add(a,b),.5);
    close(center[0],SOURCE[0]);close(center[1],SOURCE[1]+ring.offset);close(center[2],SOURCE[2]);
  }
});
