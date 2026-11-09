import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeMetrics,scoreShape,rankCandidates,coefficientResidual} from './shape.mjs';
import {inspectSeed} from './core.mjs';

const TAU=2*Math.PI;
function curve(fn,n=4000){
  const out=new Float64Array(n*2);
  for(let i=0;i<n;i++){
    const t=i*TAU/n,[x,y]=fn(t);
    out[2*i]=x;out[2*i+1]=y;
  }
  return out;
}
const circular=curve(t=>[Math.cos(t),Math.sin(t)]);
const elongated=curve(t=>[3*Math.cos(t),.3*Math.sin(t)]);
const threefold=curve(t=>{
  const r=1+.35*Math.cos(3*t);
  return [r*Math.cos(t),r*Math.sin(t)];
});
const irregular=curve(t=>{
  const r=1+.4*Math.cos(3*t)+.22*Math.cos(5*t+.3);
  return [r*Math.cos(t),r*Math.sin(t)];
});

test('rotation-covariance isotropy separates circular and elongated clouds',()=>{
  const ring=shapeMetrics(circular),ellipse=shapeMetrics(elongated);
  assert.ok(ring.isotropy>.99);
  assert.ok(ellipse.isotropy<.03);
  assert.ok(ring.radial>.99);
  assert.ok(ellipse.radial<.70);
  assert.ok(scoreShape(ring,'ring')>scoreShape(ellipse,'ring')+.35);
  assert.equal(ring.order,null);
});
test('rotational comparison rewards threefold structures over asymmetric distortions',()=>{
  const three=shapeMetrics(threefold),other=shapeMetrics(irregular);
  assert.ok(three.perOrder[3]>.85,JSON.stringify(three));
  assert.ok(three.perOrder[3]>three.perOrder[5]);
  assert.ok(three.symmetry>other.symmetry,JSON.stringify({three,other}));
  assert.ok(scoreShape(three,'symmetry')>scoreShape(other,'symmetry'));
});
test('scores are bounded, stable under translation and uniform rescaling',()=>{
  const original=shapeMetrics(threefold);
  const shifted=curve(t=>{
    const r=1+.35*Math.cos(3*t);
    return [8+3*r*Math.cos(t),-7+3*r*Math.sin(t)];
  });
  const other=shapeMetrics(shifted);
  for(const key of ['isotropy','radial','symmetry']){
    assert.ok(Math.abs(original[key]-other[key])<.02,`${key}: ${original[key]} vs ${other[key]}`);
  }
  for(const mode of ['ring','symmetry','balanced']){
    assert.ok(scoreShape(other,mode)>=0&&scoreShape(other,mode)<=1);
  }
  assert.throws(()=>scoreShape(original,'undefined'),RangeError);
});
test('ranking is deterministic and returns only the best entries',()=>{
  const xs=[
    {seed:'BBBBBBBBBBBB',metrics:shapeMetrics(elongated)},
    {seed:'AAAAAAAAAAAA',metrics:shapeMetrics(circular)},
    {seed:'CCCCCCCCCCCC',metrics:shapeMetrics(irregular)},
  ];
  const ranked=rankCandidates(xs,'ring',2);
  assert.equal(ranked.length,2);
  assert.equal(ranked[0].seed,'AAAAAAAAAAAA');
});
test('linear rotation residual diagnoses, but does not filter, seeds',()=>{
  // Matrix [[0,-1],[1,0]], with all quadratic coefficients zero.
  const seed='MMMM LMM MWMMM'.replaceAll(' ','');
  const rotation=[0,0,0,0,-1,0,0,1,0,0,0,0];
  const letters=rotation.map(x=>String.fromCharCode(77+10*x)).join('');
  assert.equal(letters.length,12);
  assert.ok(coefficientResidual(letters)<1e-9);
  assert.ok(coefficientResidual('GLXOESFTTPSV')>=0);
});
test('neutral irrational rotation is retained by shape search but excluded by chaos search',()=>{
  // cos(theta)=3/5 and sin(theta)=4/5: an exact unit-modulus
  // rotation, with an irrational angle/π (Niven's theorem).
  const a=[0,.6,0,0,-.8,0,0,.8,0,0,.6,0];
  const seed=a.map(x=>String.fromCharCode(77+Math.round(x*10))).join('');
  const opts={steps:3800,burn:500};
  const classic=inspectSeed(seed,{...opts,filter:'chaos'});
  const shape=inspectSeed(seed,{...opts,filter:'geometry',withPoints:true});
  assert.ok(Math.abs(shape.lambda)<1e-8,shape.lambda);
  assert.equal(classic.accepted,false);
  assert.equal(shape.accepted,true,JSON.stringify({...shape,points:undefined}));
  const metrics=shapeMetrics(shape.points);
  assert.ok(metrics.isotropy>.9);
  assert.ok(metrics.radial>.95);
  assert.equal(metrics.order,null);
});

test('geometric filter does not require a positive Lyapunov exponent',()=>{
  const seed='GLXOESFTTPSV';
  const chaos=inspectSeed(seed,{steps:4000,burn:500,filter:'chaos'});
  const geometry=inspectSeed(seed,{steps:4000,burn:500,filter:'geometry',withPoints:true});
  assert.equal(chaos.accepted,true);
  assert.equal(geometry.accepted,true);
  assert.equal(geometry.points.length,(4000-500)*2);
  assert.throws(()=>inspectSeed(seed,{filter:'garbage'}),RangeError);
});
