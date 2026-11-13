import * as reference from './reference.mjs';
import * as unwinding from '../../experiments/chromatic-unwinding/core.mjs';
import * as chamber from '../../experiments/chromatic-chamber/core.mjs';
export {reference};
export const optimized={unwinding,chamber};
export const seed=0x51a7;
export const phases=[0,.03125,.173,.25,.499999,.5,.731,1];
export const cases=[
 {name:'unwinding/default',kind:'unwinding',scene:{...reference.unwinding.defaults}},
 {name:'unwinding/max-ui',kind:'unwinding',scene:{...reference.unwinding.defaults,steps:800,filaments:64,spread:2,width:4,duration:120,zoom:2}},
 {name:'chamber/default',kind:'chamber',scene:{...reference.chamber.defaults}},
 {name:'chamber/max-ui',kind:'chamber',scene:{...reference.chamber.defaults,symmetry:32,sides:8,density:2.5,size:.14,drift:.24,duration:120,zoom:2,rotation:1,mirrors:true}},
 {name:'chamber/max-workload',kind:'chamber',scene:{...reference.chamber.defaults,symmetry:3,sides:8,density:2.5,size:.035,drift:.24,duration:120,zoom:2,rotation:1,mirrors:true}},
];
export function geometry(api,test,phase){
 const p=test.scene;
 if(test.kind==='unwinding')return api.makeField(api.angleAt(phase),p);
 return test.shards.map(g=>({points:api.clipWedge(api.polygonAt(g,p,phase),p.symmetry),color:api.colorFor(g,p)})).filter(g=>g.points.length>2);
}
for(const test of cases)if(test.kind==='chamber')test.shards=reference.chamber.makeChamber(test.scene);
export function rng(start=seed){let s=start>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function summary(values){const a=[...values].sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.ceil(a.length*.95)-1],minMs:a[0],maxMs:a.at(-1)};}
export function compare(a,b){let max=0,scalars=0;function visit(x,y){if(typeof x==='number'){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Nonfinite coordinate');max=Math.max(max,Math.abs(x-y));scalars++;}else if(Array.isArray(x)){if(!Array.isArray(y)||x.length!==y.length)throw Error('Geometry topology differs');x.forEach((v,i)=>visit(v,y[i]));}else if(x&&typeof x==='object'){for(const key of Object.keys(x))visit(x[key],y[key]);}else if(x!==y)throw Error('Geometry metadata differs');}visit(a,b);return {maxAbsoluteError:max,scalars};}
export function accuracySweep(){
 let max=0,scalars=0,comparisons=0;
 const check=(a,b)=>{const result=compare(a,b);max=Math.max(max,result.maxAbsoluteError);scalars+=result.scalars;comparisons++;};
 for(const test of cases)for(const phase of phases){const a=geometry(reference[test.kind],test,phase),b=geometry(optimized[test.kind],test,phase);check(a,b);if(test.kind==='unwinding')check(reference.unwinding.bounds(a),unwinding.bounds(b));}
 // Dense angular/step sweep includes square, line, near-line and negative spread angles.
 for(const steps of [101,360,800])for(let i=0;i<=180;i++){const angle=i/2;const a=reference.unwinding.turtle(angle,steps),b=unwinding.turtle(angle,steps);check(a,b);check(reference.unwinding.bounds([a]),unwinding.bounds([b]));}
 for(const steps of [101,360,800])for(const angle of [-180,-90,-2,-.5,-1e-8,-1e-12,0,1e-12,1e-8,89.999999,90,180]){const a=reference.unwinding.turtle(angle,steps),b=unwinding.turtle(angle,steps);check(a,b);check(reference.unwinding.bounds([a]),unwinding.bounds([b]));}
 const random=rng();
 for(let i=0;i<1000;i++){const p={...chamber.defaults,sides:3+i%6,symmetry:3+i%30},g={x:random()*3,y:random()*.2,dx:random()*.24,dy:random()*.24,phase:random()*Math.PI*2,orientation:random()*Math.PI*2,radius:.035+random()*.105},phase=random();const a=reference.chamber.polygonAt(g,p,phase),b=chamber.polygonAt(g,p,phase);check(a,b);check(reference.chamber.clipWedge(a,p.symmetry),chamber.clipWedge(b,p.symmetry));}
 return {comparisons,scalars,maxAbsoluteError:max,tolerance:1e-9,pass:max<=1e-9};
}
