import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeSeed,step,inspectSeed,buildOrbit,references} from './core.mjs';
test('seed lettering encodes 0.1 steps from -1.2 to 1.2',()=>{
  assert.deepEqual(decodeSeed('AMYAAAAAAAAA').slice(0,3),[-1.2,0,1.2]);
  assert.throws(()=>decodeSeed('AAAAAAAAAAAZ'),/A to Y/);
  assert.throws(()=>decodeSeed('SHORT'),/exactly 12/);
});
test('direct quadratic recurrence is used without visual deformation',()=>{
  const a=decodeSeed('GLXOESFTTPSV'),[x,y]=step(.05,.05,a);
  const expectedX=a[0]+a[1]*.05+a[2]*.05**2+a[3]*.05**2+a[4]*.05+a[5]*.05**2;
  assert.ok(Math.abs(x-expectedX)<1e-12);
  assert.ok(Number.isFinite(y));
});
test('reference maps yield sustained bounded, distributed trajectories',()=>{
  for(const seed of references){
    const result=inspectSeed(seed,{steps:4300,burn:700});
    assert.equal(result.accepted,true,seed+': '+JSON.stringify(result));
  }
});
test('fixed point and divergent seeds are screened out',()=>{
  assert.equal(inspectSeed('MMMMMMMMMMMM').accepted,false);
  assert.equal(inspectSeed('YYYYYYYYYYYY').accepted,false);
});
test('sampled orbit is deterministic and stays within bounds',()=>{
  const first=buildOrbit(references[0],2500),second=buildOrbit(references[0],2500);
  assert.deepEqual(first.points,second.points);
  for(const v of first.points)assert.ok(Number.isFinite(v));
  assert.ok(first.bounds.maxX>first.bounds.minX);
});
