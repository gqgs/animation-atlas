import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASE_Y, APEX_HEIGHT, SOURCE, defaults, defaultTracks, definitions,
  facesAt, poseAt, prismAt, readState, refract, spectrum, tracePrism, wavelengthIndex, sub, dot, unit,
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
  for(let step=1;step<=100;step++) for(const [i,f] of facesAt(step/100).entries()){
    const base=closed[i];
    assert.deepEqual(f.slice(0,2),base.slice(0,2));
    for(let j=0;j<3;j++) close(distance(f[j],f[(j+1)%3]),distance(base[j],base[(j+1)%3]));
  }
  const closedPrism=prismAt(0).vertices;
  for(const step of [0,.2,.5,1]){
    const v=prismAt(step).vertices;
    for(let i=0;i<v.length;i++)for(let j=0;j<i;j++)close(distance(v[i],v[j]),distance(closedPrism[i],closedPrism[j]));
  }
});

test('Snell conserves tangential wavevector and handles total internal reflection',()=>{
  const n=[0,1,0],dir=unit([1,-1,0]);
  const bent=refract(dir,n,1,1.6);
  close(dir[0],1.6*bent[0]);
  close(Math.hypot(...bent),1);
  assert.deepEqual(refract([0,-1,0],n,1,1.6),[0,-1,0]);
  assert.equal(refract(dir,n,1.6,1),null);
});

test('nonparallel prism splits the beam in red-to-violet order onto the floor',()=>{
  const {entry,rays}=tracePrism(0);
  assert.ok(entry);
  assert.equal(rays.length,spectrum.length);
  assert.ok(Math.abs(dot(entry.normal,rays[0].exit.normal))<.95);
  for(const [i,ray] of rays.entries()){
    assert.ok(ray.exit.face!==entry.face);
    assert.ok(ray.direction[1]<0);
    close(ray.floor[1],0);
    assert.ok(ray.floor.every(Number.isFinite));
    close(Math.hypot(...ray.direction),1);
    if(i>0){
      assert.ok(wavelengthIndex(rays[i-1].wavelength)<wavelengthIndex(ray.wavelength));
      assert.ok(rays[i-1].floor[2]>ray.floor[2]);
    }
  }
  assert.ok(distance(rays[0].floor,rays.at(-1).floor)>.40);
  const mono=tracePrism(0,'mono').rays;
  assert.equal(mono.length,1);
  assert.deepEqual(mono[0].floor,rays.find(x=>x.wavelength===550).floor);
});

test('opening moves glass out of the beam and restores the unsplit floor strike',()=>{
  for(const offset of [-.024,0,.024]){
    assert.ok(tracePrism(0,'dispersion',offset).rays.length>0);
    const open=tracePrism(.4,'dispersion',offset);
    assert.equal(open.entry,null);
    assert.equal(open.rays.length,0);
    close(open.whiteEnd[1],0);
    assert.ok(distance(open.origin,SOURCE)<=.025);
  }
  for(let i=0;i<=200;i++)for(const ray of tracePrism(i/200).rays){
    assert.ok(ray.floor.every(Number.isFinite));
  }
  assert.equal(poseAt(defaults,defaultTracks,0).opening,0);
  assert.ok(poseAt(defaults,defaultTracks,.5).opening>.8);
  assert.deepEqual(poseAt(defaults,defaultTracks,0),poseAt(defaults,defaultTracks,1));
});

test('validated URL settings retain cyclic controls and the comparison mode',()=>{
  const params=new URLSearchParams({rotation:'270',elevation:'',duration:'2',lighting:'mono',tracks:serializeTracks(defaultTracks,definitions)});
  const {settings,tracks}=readState(params);
  assert.equal(settings.rotation,180);
  assert.equal(settings.elevation,33);
  assert.equal(settings.duration,4);
  assert.equal(settings.lighting,'mono');
  assert.deepEqual(tracks,defaultTracks);
  assert.deepEqual(readState(new URLSearchParams({tracks:'{}'})).tracks,{});
});
