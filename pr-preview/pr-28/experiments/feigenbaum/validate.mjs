import assert from 'node:assert/strict';
import {returnMap as f,quadratic,criticalReturn,LAMBDA,orbit,fixedZero} from './math.mjs';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
for(let n=2;n<=7;n++){
 assert.ok(dist(f([0,0],n),[1,0])<1e-12,'normalized critical value');
 for(const z of [[.2,.1],[.7,.2],[-.5,.3]]){
  const q=f(z,n);assert.ok(q);
  assert.ok(dist(q,f(z.map(x=>-x),n))<1e-12,'even symmetry');
  const conjugate=f([z[0],-z[1]],n);assert.ok(dist(q,[conjugate[0],-conjugate[1]])<1e-12,'real symmetry');
 }
}
assert.ok(Math.abs(-criticalReturn(7)/criticalReturn(6)-LAMBDA)<1e-6,'spatial scaling');
assert.ok(Math.abs(f([1,0],6)[0]+LAMBDA)<1e-6,'f(1) approaches -lambda');
const errors=[];for(let n=2;n<=6;n++){
 let max=0;for(const z of [[.2,.1],[.6,.2],[.9,-.1]]){const h=f(z.map(v=>v*LAMBDA),n);const lhs=f(h,n),rhs=f(z,n).map(v=>-LAMBDA*v);max=Math.max(max,dist(lhs,rhs))}errors.push(max);
}
assert.ok(errors.at(-1)<errors[0]/100,'linearization improves with order');
const x0=fixedZero(5);assert.ok(Math.abs(f([x0,0],5)[0])<1e-10,'positive zero');
const trace=orbit([.7,.32],5,true,25);assert.ok(dist(trace.at(-1),[x0,0])<1e-6,'attracting h orbit');
assert.equal(f([1e20,1e20],5),null,'unresolved overflow');
console.log('PASS: normalization, even/conjugate symmetry, scaling, functional residual convergence, zero, attracting orbit, overflow');
console.log('Linearization residuals n=2…6:',errors);
// Execute the actual field worker through its message boundary, without a browser.
let reply;globalThis.self={postMessage:d=>reply=d};
await import('./field-worker.mjs');
for(const mode of ['skeleton','puzzles','phase']){
 self.onmessage({data:{id:1,w:120,h:80,cx:0,cy:0,span:11.4,n:5,mode,depth:2}});
 assert.equal(reply.data.length,120*80*4);assert.equal(reply.id,1);
 assert.ok(reply.data.some((v,i)=>i%4!==3&&v>100),'field has visible structure');
 const first=new Uint8ClampedArray(reply.data);self.onmessage({data:{id:1,w:120,h:80,cx:0,cy:0,span:11.4,n:5,mode,depth:2}});assert.deepEqual(reply.data,first,'deterministic field');
}
delete globalThis.self;console.log('PASS: worker skeleton, nested overlays, phase rendering and deterministic replay');
const {orderFrame,advanceOrder}=await import('./timeline.mjs');
assert.deepEqual(orderFrame(2),{value:2,lo:2,hi:3,alpha:0});
assert.equal(orderFrame(3.5).alpha,.5);
assert.equal(orderFrame(3.5,false).alpha,0,'discrete playback holds the lower order');
assert.deepEqual(orderFrame(7),{value:7,lo:7,hi:7,alpha:0});
assert.equal(advanceOrder(6.9,1,3),7,'playback stops at final order');
assert.equal(advanceOrder(2,1,2),2.5,'seconds per order');
for(let v=2;v<=7;v+=.031){const f=orderFrame(v);assert.ok(f.lo>=2&&f.hi<=7);assert.ok(f.alpha>=0&&f.alpha<=1)}
console.log('PASS: order timeline endpoints, smooth crossfade, discrete mode, duration and terminal hold');
