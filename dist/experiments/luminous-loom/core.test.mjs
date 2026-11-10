import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize, defaults, limits, createGeometry, geometryAt, wrapPhase, TAU, counts} from './core.mjs';
import {trace, preparePaths, paint} from './renderer.mjs';

test('normalization validates bounds, defaults and enum choices',()=>{
 assert.deepEqual(normalize(),defaults);
 for(const [key,[min,max]] of Object.entries(limits)) {
  assert.equal(normalize({[key]:-Infinity})[key],defaults[key]);
  assert.equal(normalize({[key]:'bad'})[key],defaults[key]);
  assert.equal(normalize({[key]:-1e6})[key],min);
  assert.equal(normalize({[key]:1e6})[key],max);
 }
 assert.equal(normalize({fibers:9.7}).fibers,10);
 assert.equal(normalize({renderer:'invalid'}).renderer,'direct');
 assert.equal(normalize({palette:'invalid'}).palette,'aurora');
 assert.equal(normalize({glow:0}).glow,0);
 assert.equal(normalize({glow:1}).glow,1);
 assert.throws(()=>wrapPhase(NaN),RangeError);
 assert.equal(wrapPhase(-.25),.75);
});

test('geometry uses reusable storage, replays deterministically and closes phase loop',()=>{
 const w=createGeometry({fibers:12,samples:192});
 const start=geometryAt(w,0).slice();
 assert.strictEqual(geometryAt(w,.25),w.coordinates);
 assert.deepEqual(geometryAt(w,1),start);
 assert.deepEqual(geometryAt(w,-1),start);
 const sample=geometryAt(w,.125).slice();geometryAt(w,.5);
 assert.deepEqual(geometryAt(w,.125),sample);
 assert.notDeepEqual(sample,start);
 assert.ok(sample.every(Number.isFinite));
 assert.deepEqual(counts(w.settings),{fibers:12,segments:2304,passes:2,strokes:24});
});

// Deliberately independent direct trigonometry: no rotation tables or painter.
function reference(p,phase) {
 const data=[],t=TAU*wrapPhase(phase),yaw=t+.32,pitch=.67+.22*Math.sin(t),roll=.12*Math.sin(t);
 for(let j=0;j<p.fibers;j++)for(let i=0;i<p.samples;i++) {
  const u=j/(p.fibers-1),a=TAU*p.p*i/p.samples,b=TAU*p.q*i/p.samples-p.spread/2+p.spread*u;
  const r=(.4+.13*(u-.5))*(1+.055*Math.sin(2*t));
  const x=(1+r*Math.cos(b))*Math.cos(a),y=(1+r*Math.cos(b))*Math.sin(a),z=r*Math.sin(b);
  const xx=Math.cos(yaw)*x+Math.sin(yaw)*z,zz=-Math.sin(yaw)*x+Math.cos(yaw)*z;
  const yy=Math.cos(pitch)*y-Math.sin(pitch)*zz;
  data.push(Math.cos(roll)*xx-Math.sin(roll)*yy,Math.sin(roll)*xx+Math.cos(roll)*yy);
 }
 return data;
}

test('shared recurrence geometry matches independent direct trig across topology and density',()=>{
 for(const scene of [{fibers:8,samples:128,p:1,q:1},{fibers:31,samples:513,p:5,q:7,spread:1.4},{fibers:384,samples:1536,p:3,q:4}]) {
  const w=createGeometry(scene);
  for(const phase of [0,.137,.5,.999]) {
   const actual=geometryAt(w,phase),expected=reference(w.settings,phase);
   let max=0;for(let i=0;i<actual.length;i++)max=Math.max(max,Math.abs(actual[i]-expected[i]));
   assert.ok(max<2e-11,`maximum coordinate error ${max}`);
  }
 }
});

class RecordingPath {
 constructor(){this.commands=[];}
 moveTo(...args){this.commands.push(['moveTo',...args]);}
 lineTo(...args){this.commands.push(['lineTo',...args]);}
 closePath(){this.commands.push(['closePath']);}
}
function target() {
 const strokes=[],ctx=new RecordingPath();
 ctx.setTransform=()=>{};ctx.fillRect=()=>{};
 ctx.beginPath=()=>{ctx.commands=[];};
 ctx.stroke=path=>strokes.push({commands:structuredClone(path?.commands||ctx.commands),width:ctx.lineWidth,alpha:ctx.globalAlpha,color:ctx.strokeStyle,join:ctx.lineJoin,cap:ctx.lineCap});
 return {width:720,height:720,getContext:()=>ctx,strokes};
}
test('fresh Path2D and direct submission have identical closed commands, ordering and paint styles',()=>{
 for(const glow of [0,1]) {
  const w=createGeometry({fibers:17,samples:128,glow}),data=geometryAt(w,.23),a=target(),b=target();
  paint(a,data,w.settings,null,'direct');
  const paths=preparePaths(data,w.settings,'path2d',RecordingPath);
  paint(b,data,w.settings,paths,'path2d');
  assert.deepEqual(a.strokes,b.strokes);
  assert.equal(a.strokes.length,17*(glow?2:1));
  for(const stroke of a.strokes){assert.equal(stroke.commands.length,129);assert.equal(stroke.commands[0][0],'moveTo');assert.deepEqual(stroke.commands.at(-1),['closePath']);}
  const merged=preparePaths(data,w.settings,'merged',RecordingPath);
  assert.equal(merged.length,6);
  assert.equal(merged.reduce((n,p)=>n+p.commands.filter(c=>c[0]==='closePath').length,0),17);
 }
});

import {summary,pixelDifference,runBenchmark} from './benchmark.mjs';
test('benchmark statistics and RGB difference metrics are independently checkable',()=>{
 assert.deepEqual(summary([7,1,3,9,2]),{median:3,p95:9,min:1,max:9,samples:[7,1,3,9,2]});
 const a=new Uint8ClampedArray([0,0,0,255,10,20,30,255]);
 const b=new Uint8ClampedArray([0,1,2,0,14,20,30,0]);
 assert.deepEqual(pixelDifference(a,b),{maxChannelDelta:4,meanAbsoluteRGBDelta:7/6,changedPixels:2,changedFraction:1,fractionOver2:.5});
 assert.deepEqual(pixelDifference(a,a),{maxChannelDelta:0,meanAbsoluteRGBDelta:0,changedPixels:0,changedFraction:0,fractionOver2:0});
});
test('benchmark rejects invalid workload options before browser access',async()=>{
 for(const options of [{size:0},{size:2161},{samples:2},{samples:101},{warmup:-1},{warmup:21}])await assert.rejects(runBenchmark({},options),RangeError);
});
