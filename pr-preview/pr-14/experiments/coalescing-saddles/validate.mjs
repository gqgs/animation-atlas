import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {halfTable,caustic,phaseZeros,blendField,TAU} from './math.mjs';
const base=new URL('./',import.meta.url),meta=JSON.parse(readFileSync(new URL('field.json',base)));
const raw=Buffer.concat(meta.chunks.map(name=>readFileSync(new URL(name,base))));
assert.equal(raw.length,meta.width*meta.height*meta.frames*4);
const data=new Uint16Array(raw.buffer,raw.byteOffset,raw.length/2),table=halfTable();
assert.equal(table[0x3c00],1);assert.equal(table[0xbc00],-1);assert.equal(table[1],2**-24);
for(const h of data)assert(Number.isFinite(table[h]));
const field=new Float32Array(meta.width*meta.height*2),n=meta.width;
blendField(data,table,meta,0,field);
assert(Math.abs(field[((n*n-1)/2)*2]-3.2886794109041237)<.001);
assert(Math.max(...field.filter((_,i)=>i%2).subarray(0,50000).map(Math.abs))<1e-8);
blendField(data,table,meta,4,field);let symmetry=0;
for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let c=0;c<2;c++)symmetry=Math.max(symmetry,Math.abs(field[(y*n+x)*2+c]-field[((n-1-y)*n+x)*2+c]));
assert(symmetry<.001);
const positive=field.slice();blendField(data,table,meta,-4,field);
for(let k=0;k<field.length;k++)assert.equal(field[k],positive[k]*(k%2?-1:1));
// Parametric caustic must satisfy both stationary equations and Hessian degeneracy.
for(const z of [-4,-2,0,2,4])for(let j=0;j<30;j++){
  const a=j/30*TAU,s=z/3*Math.cos(a),t=z/3*Math.sin(a),[x,y]=caustic(z,a);
  assert(Math.abs(3*s*s-3*t*t+2*z*s+x)<1e-10);
  assert(Math.abs(-6*s*t+2*z*t+y)<1e-10);
  assert(Math.abs((6*s+2*z)*(-6*s+2*z)-36*t*t)<1e-10);
}
const vortex=new Float32Array(8);vortex.set([-0.3,-0.6,0.7,-0.6,-0.3,0.4,0.7,0.4]);
const roots=phaseZeros(vortex,2);assert.equal(roots.length,1);assert(Math.abs(roots[0].x-.3)<1e-6&&Math.abs(roots[0].y-.6)<1e-6);
const report=JSON.parse(readFileSync(new URL('validation.json',base)));
assert(report.origin.abs_error<1e-3);assert(report.checks.every(c=>c.max_abs<.01));
const catalog=JSON.parse(readFileSync(new URL('../../experiments.json',base))),entry=catalog.find(e=>e.id==='coalescing-saddles');assert(entry);
for(const path of [entry.url,entry.cover,entry.source])assert(existsSync(new URL('../../'+path,base)),path);
assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length);
console.log('PASS: binary integrity; finite samples; analytic origin; reflection/conjugacy; caustic stationary equations; vortex localization; numerical report; Atlas assets.');
