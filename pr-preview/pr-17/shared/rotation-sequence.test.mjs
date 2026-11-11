import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationSequence} from './rotation-sequence.mjs';

const near=(a,b,tolerance=3e-12)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
test('matches direct angular samples through repeated rebases',()=>{
 for(const count of [0,1,3,8,63,64,65,101,360,800,4096]) {
  for(const start of [-Math.PI,.123,0,2*Math.PI]) {
   for(const step of [-Math.PI/2,-.02,0,1e-12,Math.PI/180,Math.PI/2,2*Math.PI/3]) {
    const data=rotationSequence(count,start,step);
    assert.equal(data.length,count*2);
    for(let i=0;i<count;i++) {
     near(data[2*i],Math.cos(start+i*step));
     near(data[2*i+1],Math.sin(start+i*step));
     near(Math.hypot(data[2*i],data[2*i+1]),1);
    }
   }
  }
 }
});
test('reuses caller storage, preserves its tail and returns independent fresh results',()=>{
 const output=new Float64Array(18).fill(99);
 assert.equal(rotationSequence(8,.3,.1,output),output);
 assert.equal(output[16],99);assert.equal(output[17],99);
 const a=rotationSequence(8,.3,.1),b=rotationSequence(8,.3,.1);
 assert.deepEqual(a,b);a[0]=99;assert.notEqual(a[0],b[0]);
});
test('out-of-order evaluations do not accumulate animation state',()=>{
 const output=new Float64Array(720),first=rotationSequence(360,.1,.31);
 for(const phase of [.8,.2,1,0,-2])rotationSequence(360,phase,.7,output);
 assert.deepEqual(rotationSequence(360,.1,.31,output),first);
});
test('rejects invalid angles, counts and output buffers',()=>{
 for(const count of [-1,1.2,NaN,Infinity])assert.throws(()=>rotationSequence(count,0,.1),RangeError);
 for(const value of [NaN,Infinity,-Infinity]) {
  assert.throws(()=>rotationSequence(3,value,.1),RangeError);
  assert.throws(()=>rotationSequence(3,0,value),RangeError);
 }
 for(const output of [new Float32Array(8),new Float64Array(5),[]]) {
  assert.throws(()=>rotationSequence(3,0,.1,output),RangeError);
 }
});
