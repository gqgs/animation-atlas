import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrbit} from './core.mjs';
import {filamentWindow,layerMotion,makePainter} from './painter.mjs';

const close=(a,b,tolerance=1e-12)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}`);

test('loop motion is periodic, including velocity near its endpoint',()=>{
  for(let band=0;band<4;band++){
    const first=layerMotion(0,band,1.6),end=layerMotion(1,band,1.6);
    for(const k of Object.keys(first))close(first[k],end[k]);
    // A loop must also avoid the discontinuous orbit-index jumps that the
    // previous renderer introduced between consecutive frames.
    const seamA=layerMotion(1-1/3600,band,1.6);
    const seamB=layerMotion(0,band,1.6);
    assert.ok(Math.hypot(seamA.x-seamB.x,seamA.y-seamB.y)<.01);
  }
});

test('filament windows stay inside the real sampled orbit',()=>{
  for(const [count,strands,trail] of [[52000,8,100],[52000,44,720],[1000,12,900]]){
    for(let i=0;i<strands;i++){
      const window=filamentWindow(count,strands,trail,i);
      assert.ok(window.start>=0);
      assert.ok(window.length>0);
      assert.ok(window.start+window.length<=count);
    }
  }
});

class StubCanvas{
  constructor(tally){this.width=0;this.height=0;this.tally=tally;this.context=new StubContext(tally);}
  getContext(type){assert.equal(type,'2d');return this.context;}
}
class StubContext{
  constructor(tally){this.tally=tally;}
  beginPath(){this.tally.paths++;}
  moveTo(){}
  lineTo(){this.tally.segments++;}
  stroke(){this.tally.strokes++;}
  fillRect(){}
  save(){}
  restore(){}
  translate(){}
  rotate(){}
  scale(){}
  setTransform(){}
  drawImage(){this.tally.draws++;}
  createRadialGradient(){return {addColorStop(){}};}
}

test('expensive geometry is cached: animation frames perform only five composites',()=>{
  const tally={created:0,paths:0,segments:0,strokes:0,draws:0};
  const before=globalThis.document;
  globalThis.document={createElement(type){
    assert.equal(type,'canvas');
    tally.created++;
    return new StubCanvas(tally);
  }};
  try{
    const orbit=buildOrbit('GLXOESFTTPSV',1800,300);
    const p={palette:'porcelain',strands:44,trail:720,drift:1.2,
      width:.85,zoom:1,density:.55};
    const painter=makePainter(orbit,p);
    const target=new StubCanvas(tally);target.width=320;target.height=240;
    painter(target,0);
    assert.equal(tally.created,5); // background + four filament layers
    assert.ok(tally.segments>=44*720);
    assert.ok(tally.strokes>0);
    assert.equal(tally.draws,5);
    const {strokes,segments,created}=tally;
    for(const phase of [.001,.126,.5,.75,.999,1])painter(target,phase);
    assert.equal(tally.created,created);
    assert.equal(tally.strokes,strokes);
    assert.equal(tally.segments,segments);
    assert.equal(tally.draws,5*7);

    // Changing output resolution deliberately rebuilds the raster cache.
    target.width=640;target.height=480;
    painter(target,.25);
    assert.equal(tally.created,10);
    assert.ok(tally.strokes>strokes);
    assert.equal(tally.draws,5*8);
  }finally{globalThis.document=before;}
});
