#!/usr/bin/env node
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {cases,reference,optimized,geometry,rng,summary,accuracySweep,phases,seed} from './common.mjs';
const samples=Number(process.env.SAMPLES||31),warmup=Number(process.env.WARMUP||8),batch=Number(process.env.BATCH||3);
if(![samples,warmup,batch].every(n=>Number.isInteger(n)&&n>0&&n<=10000))throw Error('SAMPLES, WARMUP and BATCH must be integers in 1..10000');
const random=rng(),results=[];let checksum=0;
function run(api,test,phase){const data=geometry(api,test,phase);checksum+=data.length;}
for(const test of cases){
 const timings={reference:[],optimized:[]};
 for(let i=-warmup;i<samples;i++){
  const phase=phases[(i+warmup)%phases.length],order=random()<.5?['reference','optimized']:['optimized','reference'];
  for(const variant of order){const api=(variant==='reference'?reference:optimized)[test.kind];const start=performance.now();for(let j=0;j<batch;j++)run(api,test,phase);const elapsed=(performance.now()-start)/batch;if(i>=0)timings[variant].push(elapsed);}
 }
 const baseline=summary(timings.reference),candidate=summary(timings.optimized);
 results.push({case:test.name,settings:test.scene,shardCount:test.shards?.length,reference:baseline,optimized:candidate,medianRatio:baseline.medianMs/candidate.medianMs});
}
const accuracy=accuracySweep();
console.log(JSON.stringify({baselineCommit:reference.sourceCommit,environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,os:os.release(),cpu:os.cpus()[0]?.model},method:{samples,warmup,batch,seed,phases,units:'milliseconds per geometry construction; not FPS',order:'seeded randomized paired interleaving; same phase and batch for both variants',scope:'Unwinding makeField; Chamber polygonAt + wedge clip + color/filter, with prebuilt identical shards; excludes paint and chamber generation',speedIsNonGating:true},accuracy,results,checksum},null,2));
if(!accuracy.pass)process.exitCode=1;
