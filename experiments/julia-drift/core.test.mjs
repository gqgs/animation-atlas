import test from 'node:test';
import assert from 'node:assert/strict';
import {inverseStep,mobius,sampleJulia,defaults,sceneAt,readSettings,settingsQuery} from './core.mjs';
test('both square root branches invert z²+c, including negative-real cut',()=>{
 for(const z of [[.3,.7],[-2,.1],[0,0],[3,-4]])for(const negative of [false,true]){
  const [x,y]=inverseStep(...z,-.75,.1,negative);
  assert.ok(Math.abs(x*x-y*y-.75-z[0])<1e-12);assert.ok(Math.abs(2*x*y+.1-z[1])<1e-12);
 }
});
test('fixed sampling is repeatable, bounded, and responds to branch probability',()=>{
 const p={...defaults,iterations:10000},a=sampleJulia(p);assert.deepEqual(a,sampleJulia(p));
 assert.notDeepEqual(a,sampleJulia({...p,bias:.9}));assert.ok(a.every(Number.isFinite));
 for(let i=0;i<a.length;i+=3)assert.ok(Math.hypot(a[i],a[i+1])<2);
});
test('Möbius inverse and loop closure',()=>{
 const z=mobius(.3,.7,.2,-.1),back=mobius(...z,-.2,.1);
 assert.ok(Math.hypot(back[0]-.3,back[1]-.7)<1e-12);
 assert.deepEqual(sceneAt(defaults,0),sceneAt(defaults,1));assert.notDeepEqual(sceneAt(defaults,0),sceneAt(defaults,.5));
 assert.equal(mobius(2,0,.5,0),null);
});
test('scene links round-trip and malformed values are clamped',()=>{
 assert.deepEqual(readSettings(settingsQuery(defaults,.25)).parameters,defaults);
 const {parameters:p}=readSettings('?bias=8&iterations=Infinity&extent=-2');assert.equal(p.bias,.99);assert.equal(p.iterations,defaults.iterations);assert.equal(p.extent,.015);
});
