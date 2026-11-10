import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {timeline,sample,step,PRESETS,DT} from './dynamics.mjs';
for(const [name,p] of Object.entries(PRESETS)){
 const a=timeline(p,98),b=timeline(p,98);assert.deepEqual(a,b);assert(a.every(Number.isFinite));assert(Math.max(...sample(a,600).map(Math.abs))<5);
 assert.deepEqual(sample(a,33.7),sample(b,33.7));assert.deepEqual(sample(a,0),sample(a,-1));assert.deepEqual(sample(a,600),sample(a,601));
 let x=.15,v=0,y=x,w=0;for(let i=0;i<1200;i++){[x,v]=step(x,v,i*DT,p);[y,w]=step(y,w,i*DT,p,DT/2);[y,w]=step(y,w,i*DT+DT/2,p,DT/2);}assert(Math.hypot(x-y,v-w)<1e-5);
 console.log(name,'replay, finite bounds, seek endpoints, RK4 step-halving PASS; 10s error',Math.hypot(x-y,v-w));
 if(name==='folding'&&process.argv[2])writeFileSync(process.argv[2],JSON.stringify(Object.fromEntries([0,120,360].map(t=>[t,sample(a,t)]))));
}
