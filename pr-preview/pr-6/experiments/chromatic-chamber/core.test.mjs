import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,makeChamber,polygonAt,clipWedge,reflectPoint,TAU} from './core.mjs';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('clipping stays inside both mirrors for every allowed symmetry',()=>{
 for(let n=3;n<=32;n++){
  const p={...defaults,symmetry:n,drift:.24},angle=Math.PI/n;
  for(const g of makeChamber(p))for(const phase of [0,.17,.51,1])for(const [x,y] of clipWedge(polygonAt(g,p,phase),n)){
   assert.ok(y>=-1e-12);assert.ok(x*Math.sin(angle)-y*Math.cos(angle)>=-1e-12);
  }
 }
});
test('loop endpoints are the same polygon, with vertices cyclically permuted',()=>{
 for(let sides=3;sides<=8;sides++){
  const p={...defaults,sides};
  for(const g of makeChamber(p)){
   const start=polygonAt(g,p,0),end=polygonAt(g,p,1);
   end.forEach((v,i)=>assert.ok(distance(v,start[(i+1)%sides])<1e-12));
  }
 }
});
test('mirror copies join continuously at both wedge edges',()=>{
 for(let n=3;n<=32;n++)for(const r of [.1,1,2.6]){
  assert.ok(distance(reflectPoint([r,0],n,0),reflectPoint([r,0],n,1))<1e-12);
  const edge=[r*Math.cos(Math.PI/n),r*Math.sin(Math.PI/n)];
  assert.ok(distance(reflectPoint(edge,n,0),reflectPoint(edge,n,3))<1e-12);
  const p=[r*.9,r*.1],a=reflectPoint(p,n,2),b=[p[0]*Math.cos(TAU/n)-p[1]*Math.sin(TAU/n),p[0]*Math.sin(TAU/n)+p[1]*Math.cos(TAU/n)];
  assert.ok(distance(a,b)<1e-12);
 }
});
test('seeded arrangements replay exactly and different seeds differ',()=>{
 assert.deepEqual(makeChamber(defaults),makeChamber(defaults));
 assert.notDeepEqual(makeChamber(defaults),makeChamber({...defaults,seed:1}));
});
