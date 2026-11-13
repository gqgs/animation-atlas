import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,angleAt,turtle,makeField,bounds} from './core.mjs';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b}`);
test('reference 101-step turtle is reproduced up to uniform scale',()=>{
 for(const angle of [0,.01,20,45,90]) {
  let x=0,y=0,heading=0;const path=turtle(angle,101);
  for(let k=0;k<=100;k++){heading+=angle*Math.PI/180;x+=k*.1*Math.cos(heading);y+=k*.1*Math.sin(heading);near(path[k+1][0]*10,x);near(path[k+1][1]*10,y);}
 }
});
test('90° path has axis-aligned square turns and 0° is a line',()=>{
 for(const steps of [101,360,800]){
 const square=turtle(90,steps),line=turtle(0,steps);
 for(let k=1;k<square.length;k++){const dx=square[k][0]-square[k-1][0],dy=square[k][1]-square[k-1][1];near(k%2===0?dy:dx,0);near(line[k][1],0);assert.ok(line[k][0]>=line[k-1][0]);}
 near(line.at(-1)[0],steps/2);
 }
});
test('loop starts at the square, reaches the line and returns continuously',()=>{
 near(angleAt(0),90);near(angleAt(.5),0);near(angleAt(1),90);
 for(let i=0;i<=100;i++){const phase=i/200;near(angleAt(phase),angleAt(1-phase));if(i)assert.ok(angleAt(phase)<=angleAt(phase-.005)+1e-10);}
 near(angleAt(1e-7),90,1e-9);near(angleAt(.5+1e-7),0,1e-9);
});
test('layer spread collapses at both endpoints and near-zero framing stays finite',()=>{
 for(const angle of [0,90]) {const field=makeField(angle,defaults);for(const path of field)for(let k=0;k<path.length;k++){near(path[k][0],field[0][k][0]);near(path[k][1],field[0][k][1]);}}
 for(const angle of [0,1e-12,.01,20,89.99,90]){const box=bounds(makeField(angle,{...defaults,spread:2,steps:800}));assert.ok(Object.values(box).every(Number.isFinite));assert.ok(box.size>0);}
 assert.equal(makeField(20,{...defaults,mode:'original'}).length,1);
});
