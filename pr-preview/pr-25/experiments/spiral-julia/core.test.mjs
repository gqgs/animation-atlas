import test from 'node:test';
import assert from 'node:assert/strict';
import {complexTan,iterate,defaults,presets,sceneAt,readSettings,settingsQuery,pointAt} from './core.mjs';
const close=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('scaled complex tangent agrees with independent hyperbolic formula',()=>{
 for(let x=-3;x<=3;x+=.23)for(let y=-2;y<=2;y+=.31){
  const [re,im]=complexTan(x,y),den=Math.cos(2*x)+Math.cosh(2*y);
  close(re,Math.sin(2*x)/den,1e-9);close(im,Math.sinh(2*y)/den,1e-9);
 }
});
test('real axis, conjugation, periodicity and large imaginary inputs',()=>{
 close(complexTan(.4,0)[0],Math.tan(.4));
 for(const y of [-1000,-50,50,1000]){const z=complexTan(.9,y);assert.ok(z.every(Number.isFinite));close(z[0],0);close(z[1],Math.sign(y));}
 assert.equal(complexTan(Math.PI/2,0),null);
 const z=complexTan(.7,.3),w=complexTan(.7+Math.PI,-.3);close(z[0],w[0]);close(z[1],-w[1]);
});
test('iteration bounds and half-turn symmetry',()=>{
 assert.deepEqual(iterate([3,0],[2,.1]),{count:0,stopped:true,pole:false});
 assert.deepEqual(iterate([0,0],[0,0],32),{count:32,stopped:false,pole:false});
 assert.equal(iterate([0,0],[Math.PI/2,0],32).pole,true);
 for(const p of Object.values(presets))for(const z of [[.2,.4],[.788,1.34],[.9,-.6],[1.3,.1]]){
  const a=iterate(z,[p.real,p.imaginary],p.iterations),b=iterate(z.map(v=>-v),[p.real,p.imaginary],p.iterations);assert.deepEqual(a,b);assert.ok(a.count<=p.iterations);
 }
});
test('reference presets preserve both supplied parameter anchors',()=>{
 assert.equal(presets.spiral.real,2.0625);assert.equal(presets.spiral.imaginary,.1425);
 assert.equal(presets.lace.real,1);assert.equal(presets.lace.imaginary,-.38);
 assert.equal(presets.original.centerX,.788);assert.equal(presets.original.centerY,1.34690909);
});
test('motion is periodic, starts at exact c and leaves inputs unchanged',()=>{
 for(const p of Object.values(presets)){
  const before=JSON.stringify(p);assert.deepEqual(sceneAt(p,0),sceneAt(p,1));assert.deepEqual(sceneAt(p,.25),sceneAt(p,1.25));
  close(sceneAt(p,0).real,p.real);close(sceneAt(p,0).imaginary,p.imaginary);assert.equal(JSON.stringify(p),before);
  const a=sceneAt(p,1-1e-6),b=sceneAt(p,1e-6);close(a.real,b.real,1e-9);close(a.extent,b.extent,1e-9);close(a.imaginary,b.imaginary,1e-6);
 }
});
test('scene links round trip and reject non-finite or unknown values',()=>{
 const a={...defaults,real:1,imaginary:-.38,palette:'ember',extent:.08};
 assert.deepEqual(readSettings(settingsQuery(a,.37)),{parameters:a,phase:.37,paused:true});
 const {parameters:p,phase}=readSettings('real=Infinity&imaginary=NaN&extent=-1&iterations=9999&palette=evil&phase=99&duration=');
 assert.equal(p.real,defaults.real);assert.equal(p.imaginary,defaults.imaginary);assert.equal(p.extent,.015);assert.equal(p.iterations,512);assert.equal(p.palette,'opal');assert.equal(p.duration,defaults.duration);assert.equal(phase,1);
});
test('camera uses isotropic scale and exact centered coordinate',()=>{
 const p={...defaults,centerX:.4,centerY:.9,rotation:0,extent:1};
 assert.deepEqual(pointAt(800,450,1600,900,p),[.4,.9]);
 const x=pointAt(900,450,1600,900,p),y=pointAt(800,350,1600,900,p);close(x[0]-.4,y[1]-.9);
 const rotated=pointAt(900,450,1600,900,{...p,rotation:90});close(rotated[0],.4);close(rotated[1]-.9,x[0]-.4);
});
