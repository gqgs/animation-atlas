import assert from 'node:assert/strict';
import {defaults,poleAt,pullback,validateState} from './core.mjs';
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],div=(a,b)=>{const d=b[0]**2+b[1]**2;return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];};
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-9));
let comparisons=0;
for(const motion of ['orbit','lissajous','still'])for(const radius of [0,.42,.8])for(const cx of [-.65,0,.65]){
 const p={...defaults,motion,radius,cx,cy:.65};near(poleAt(p,0),poleAt(p,1));
 for(let k=0;k<100;k++){const pole=poleAt(p,k/100);assert.ok(Math.hypot(...pole)<=.96000001);const z=[1.2+k/80,-.73];const cz=mul([pole[0],-pole[1]],z);const f=div([z[0]-pole[0],z[1]-pole[1]],[1-cz[0],-cz[1]]);f[0]+=1;const composed=div([f[0]+1,f[1]],[f[0]-1,f[1]]);near(pullback(z,pole),composed);comparisons++;}
}
assert.equal(pullback([.2,.3],[.2,.3]),null);
near(pullback([1,0],[0,0]),[3,0]);
const state={study:'mobius-drift',version:1,parameters:{...defaults},phase:.37};assert.deepEqual(validateState(state),{parameters:defaults,phase:.37});
for(const bad of [NaN,-1,2])assert.throws(()=>validateState({...state,phase:bad}));
assert.throws(()=>validateState({...state,parameters:{...defaults,fx:1.5}}));
console.log(`PASS: ${comparisons} map comparisons; closed bounded trajectories; exact pole; parameter round-trip and invalid inputs.`);
