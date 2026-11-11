import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveX,waveY,waveMargin} from './wave.mjs';
test('wave closes exactly, including negative and repeated phases',()=>{
 for(const f of [waveX,waveY])for(const position of [-.1,0,.3,1,1.1]){
  assert.equal(f(position,0,.65),f(position,1,.65));
  assert.equal(f(position,-.25,.65),f(position,.75,.65));
 }
});
test('wave amplitude is bounded inside overscan and zero restores identity',()=>{
 for(let i=0;i<1000;i++){
  const x=i/999,phase=(i*.618)%1;
  assert.equal(Math.abs(waveX(x,phase,0)),0);assert.equal(Math.abs(waveY(x,phase,0)),0);
  for(const f of [waveX,waveY])assert.ok(Math.abs(f(x,phase,1))*1080<waveMargin(1080,1080));
 }
});
test('composition of shears has an exact analytic inverse',()=>{
 for(let i=0;i<100;i++){
  const x=i/97,y=i/103,p=i/107;
  const X=x+waveX(y,p,.8),Y=y+waveY(X,p,.8);
  const restoredY=Y-waveY(X,p,.8),restoredX=X-waveX(restoredY,p,.8);
  assert.ok(Math.abs(restoredX-x)<1e-14);assert.ok(Math.abs(restoredY-y)<1e-14);
 }
});
