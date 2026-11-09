import test from 'node:test';
import assert from 'node:assert/strict';
import {planeAngles,planeDirection,projectPoint,projectionSamples,projectionStride} from './projections.mjs';
import {buildAttractor,defaults,readSettings,settingsQuery} from './core.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('plane sequence starts xz, adds yz, then inserts angular bisectors modulo pi',()=>{
 assert.deepEqual(planeAngles(0),[0]);assert.deepEqual(planeAngles(1),[0,Math.PI/2]);assert.deepEqual(planeAngles(2),[0,Math.PI/4,Math.PI/2,3*Math.PI/4]);
 for(let level=0;level<4;level++){const a=planeAngles(level),b=planeAngles(level+1);assert.deepEqual(b.filter((_,i)=>i%2===0),a);for(let i=0;i<b.length;i++)near((b[(i+1)%b.length]-b[i]+Math.PI)%Math.PI,Math.PI/b.length);}
 for(const level of [-1,1.5,5,NaN])assert.throws(()=>planeAngles(level),RangeError);
});
test('orthogonal projection preserves original z, is in-plane and idempotent',()=>{
 const p=[1.3,.4,-.7];for(const theta of planeAngles(4)){const d=planeDirection(theta),q=projectPoint(p,theta),r=projectPoint(q,theta);near(d[0]**2+d[2]**2,1);near(q[1],p[1]);near(q[0]*-d[2]+q[2]*d[0],0);q.forEach((v,i)=>near(v,r[i]));near((p[0]-q[0])*d[0]+(p[2]-q[2])*d[2],0);}
});
test('xz and yz projections match original Chen axes, not rotated silhouettes',()=>{
 const x=3,y=5,z=19,p=[(x+y)/Math.SQRT2*.038,(z-22)*.038,(y-x)/Math.SQRT2*.038];
 const a=projectPoint(p,0),b=projectPoint(p,Math.PI/2);near(a[0],x/Math.SQRT2*.038);near(a[2],-x/Math.SQRT2*.038);near(b[0],y/Math.SQRT2*.038);near(b[2],y/Math.SQRT2*.038);
 assert.notEqual(Math.hypot(a[0],a[2]),Math.hypot(b[0],b[2]));
});
test('all planes share one bounded deterministic sample subset in source order',()=>{
 const model=buildAttractor({count:12000}),samples=projectionSamples(model);assert.equal(samples.count,Math.ceil(model.count/projectionStride));assert.deepEqual(projectionSamples(model).data,samples.data);
 for(let i=0;i<samples.count;i++)assert.deepEqual(samples.data.subarray(i*4,i*4+4),model.data.subarray(i*projectionStride*4,i*projectionStride*4+4));
 assert.ok((Math.ceil(180000/projectionStride)+12000)*16<=560000);
});
test('projection links round-trip and invalid controls retain safe defaults',()=>{
 const p={...defaults,study:'planes',level:4,guides:true};assert.deepEqual(readSettings(settingsQuery(p,.3)).parameters,p);
 for(const level of ['-1','5','1.5','Infinity','bad',''])assert.equal(readSettings('?study=planes&level='+level).parameters.level,2);
 assert.equal(readSettings('?study=bad&guides=no').parameters.study,'trajectory');assert.equal(readSettings('?study=bad&guides=no').parameters.guides,false);
});
test('all sample densities preserve exact source samples and nested order',()=>{
 const model=buildAttractor({count:12000});
 for(const stride of [8,4,2,1]){
  const samples=projectionSamples(model,stride);assert.equal(samples.count,Math.ceil(model.count/stride));
  for(let i=0;i<samples.count;i++)assert.deepEqual(samples.data.subarray(i*4,i*4+4),model.data.subarray(i*stride*4,i*stride*4+4));
  if(stride===1)assert.equal(samples.data,model.data,'full density reuses the original data');
 }
 for(const stride of [0,3,16,-1,NaN])assert.throws(()=>projectionSamples(model,stride),RangeError);
});
test('density and connecting lines round-trip without changing default mode',()=>{
 for(const stride of [8,4,2,1])for(const lines of [false,true])for(const opacity of ['scaled','fixed']){const p={...defaults,study:'planes',stride,lines,opacity};assert.deepEqual(readSettings(settingsQuery(p,.25)).parameters,p);}
 for(const stride of ['0','3','9','1.5','Infinity','bad',''])assert.equal(readSettings('?stride='+stride).parameters.stride,8);
 assert.equal(readSettings('?opacity=bad').parameters.opacity,'scaled');assert.equal(defaults.stride,8);assert.equal(defaults.lines,false);assert.equal(readSettings('?lines=yes').parameters.lines,false);assert.equal(defaults.study,'trajectory');
});
