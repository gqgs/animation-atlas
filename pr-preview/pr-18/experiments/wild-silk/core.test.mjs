import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presets,encode,decode,step,jacobian,sample,inspect,rng,candidate,score} from './core.mjs';
import {illumination} from './painter.mjs';
test('seed encodes all fourteen coefficients without drift',()=>{
  for(const [,a]of presets)assert.deepEqual(decode(encode(a)),a);
  assert.throws(()=>decode('WS1.'+'zzz'.repeat(14)));
  assert.throws(()=>decode('GLXOESFTTPSV'));
  assert.throws(()=>encode(Array(14).fill(Infinity)));
});
test('recurrence agrees with independent absolute-power calculation',()=>{
  const a=[1,.2,.3,.4,2,.5,3,-1,.4,.2,.3,1,.6,2];
  assert.deepEqual(step(-2,3,a),[1+.2*-2+.3*3+.4*4+.5*27,-1+.4*-2+.2*3+.3*2+.6*9]);
});
test('analytic Jacobian agrees with finite differences away from singularities',()=>{
  const a=presets[0][1],x=-.7,y=.9,e=1e-6,j=jacobian(x,y,a);
  const xp=step(x+e,y,a),xm=step(x-e,y,a),yp=step(x,y+e,a),ym=step(x,y-e,a);
  const fd=[(xp[0]-xm[0])/(2*e),(yp[0]-ym[0])/(2*e),(xp[1]-xm[1])/(2*e),(yp[1]-ym[1])/(2*e)];
  j.forEach((v,i)=>assert.ok(Math.abs(v-fd[i])<1e-6));
});
test('rejects collapse and escape without clamping the map',()=>{
  assert.equal(inspect(Array(14).fill(0)).accepted,false);
  const a=Array(14).fill(0);a[1]=2;a[8]=2;a[9]=2;
  assert.equal(inspect(a).accepted,false);
  assert.throws(()=>sample(a,100));
  assert.equal(Number.isFinite(step(0,1,presets[0][1])[0]),false);
});
test('all presets pass long screening and the full render horizon',()=>{
  for(const [,a]of presets){assert.equal(inspect(a,16000).accepted,true);const orbit=sample(a,1200000);assert.equal(orbit.points.length,2400000);assert.ok(orbit.coreBounds.minX>=orbit.bounds.minX);assert.ok(orbit.coreBounds.maxX<=orbit.bounds.maxX);}
});
test('nearby and broad candidate streams are reproducible and valid',()=>{
  for(const mode of ['nearby','global']){const r=rng(42),s=rng(42);for(let i=0;i<40;i++){const a=candidate(r,presets[0][1],mode);assert.deepEqual(a,candidate(s,presets[0][1],mode));assert.deepEqual(decode(encode(a)),a);}}
});
test('round preference rewards isotropy and balance; light loop closes smoothly',()=>{
  assert.ok(score({roundness:.9,balance:.8},'round')>score({roundness:.2,balance:.3},'round'));
  for(let i=0;i<4;i++){assert.ok(Math.abs(illumination(0,i,.6)-illumination(1,i,.6))<1e-12);assert.equal(illumination(.27,i,0),1);}
});
test('real search worker emits reproducible, scored candidates',async()=>{
  const messages=[];globalThis.self={postMessage:m=>messages.push(m)};
  try{
    await import('./search-worker.mjs');
    self.onmessage({data:{seed:encode(presets[0][1]),mode:'nearby',target:'round',randomSeed:8421}});
    const candidates=messages.filter(m=>m.type==='candidate');
    assert.equal(candidates.length,8);assert.equal(messages.at(-1).type,'done');
    for(const c of candidates){assert.equal(c.metrics.accepted,true);assert.equal(c.score,score(c.metrics,'round'));assert.equal(c.orbit.count,100000);}
  }finally{delete globalThis.self;}
});
