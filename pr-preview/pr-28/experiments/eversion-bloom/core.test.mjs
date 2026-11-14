import test from 'node:test';import assert from 'node:assert/strict';
import {surfaceAt,geometryAt,indices,defaults,defaultTracks,poseAt,readState,definitions,TAU,ANGULAR,RADIAL,ROOT} from './core.mjs';
import {serializeTracks,normalizeTracks} from '../../shared/parameter-tracks.mjs';
test('deterministic loop positions, velocities and welded angular seam',()=>{
 assert.deepEqual(geometryAt(defaults,0),geometryAt(defaults,1));assert.deepEqual(geometryAt(defaults,.37),geometryAt(defaults,1.37));
 for(let i=0;i<=100;i++){
  const theta=i/100*TAU,u=.83,eps=1e-5,a=surfaceAt(theta,u,defaults,0),l=surfaceAt(theta,u,defaults,1-eps),r=surfaceAt(theta,u,defaults,eps);
  for(let j=0;j<3;j++)assert.ok(Math.abs((a[j]-l[j])/eps-(r[j]-a[j])/eps)<.002);
 }
 for(const t of [0,.125,.25,.5,.75])for(let j=0;j<=RADIAL;j++)assert.deepEqual(surfaceAt(0,j/RADIAL,defaults,t),surfaceAt(TAU,j/RADIAL,defaults,t));
});
test('positive radii, finite nondegenerate mesh across settings and phases',()=>{
 for(const depth of [0,1.5,2.95])for(const pleats of [0,.22])for(const phase of [0,.125,.25,.375,.5,.75]){
  const xyz=geometryAt({...defaults,depth,pleats},phase);assert.equal(xyz.length,(ANGULAR+1)*(RADIAL+1)*3);
  for(let i=0;i<xyz.length;i+=3){assert.ok(Number.isFinite(xyz[i]+xyz[i+1]+xyz[i+2]));assert.ok(Math.hypot(xyz[i],xyz[i+2])>=ROOT-1e-6);}
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,u=[0,1,2].map(j=>xyz[b+j]-xyz[a+j]),v=[0,1,2].map(j=>xyz[c+j]-xyz[a+j]);
   assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-6);
  }
 }
});
test('fixed inner collar, zero reversal flatness, and real rim reversal',()=>{
 for(let i=0;i<100;i++){
  const theta=i/100*TAU;assert.equal(surfaceAt(theta,.8,{...defaults,depth:0},.3)[1],0);
  const a=surfaceAt(theta,0,defaults,.1),b=surfaceAt(theta,0,defaults,.7);assert.deepEqual(a,b);
 }
 const theta=Math.PI/3,a=surfaceAt(theta,.99,defaults,0),b=surfaceAt(theta,1,defaults,0);
 assert.ok(Math.hypot(b[0],b[2])<Math.hypot(a[0],a[2]),'rim curls back inward');
 assert.ok(Math.abs(geometryAt(defaults,0)[1000]-geometryAt(defaults,.25)[1000])>.01);
});
test('each analytic meridian is simple: signed height monotonic unless flat',()=>{
 for(let t=0;t<16;t++)for(let i=0;i<64;i++){
  const theta=i/64*TAU,phase=t/16,tip=surfaceAt(theta,1,defaults,phase);let prev=0;
  for(let j=1;j<=100;j++){const p=surfaceAt(theta,j/100,defaults,phase);assert.ok(Math.abs(p[1])>=prev-1e-12);prev=Math.abs(p[1]);}
  assert.ok(Number.isFinite(tip[1]));
 }
});
test('static camera and URL tracks round trip',()=>{
 assert.deepEqual(poseAt(defaults,defaultTracks,.27),defaults);
 const tracks=normalizeTracks({zoom:{enabled:true,min:.8,max:1.2,easing:'sine'}},definitions);
 assert.deepEqual(poseAt(defaults,tracks,0),poseAt(defaults,tracks,1));
 const state=readState(new URLSearchParams({depth:'2.5',tracks:serializeTracks(tracks,definitions)}));assert.equal(state.settings.depth,2.5);assert.deepEqual(state.tracks,tracks);
});
