import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPlan,exportFrames} from './frame-export.mjs';

test('frame plan validates even dimensions and integral frame count',()=>{
  assert.deepEqual(exportPlan({width:1080,height:1080,fps:30,duration:2}),
    {width:1080,height:1080,fps:30,duration:2,frames:60});
  assert.throws(()=>exportPlan({width:1079}),/even integers/);
  assert.throws(()=>exportPlan({duration:Infinity}),/finite/);
});

function fakeRecorder(captured,events) {
  return {
    async start(){events.push('start');},
    async capture(canvas){captured.push(canvas.phase);},
    async stop(){events.push('stop');},
    async save(cb){events.push('save');cb(new Blob(['ok'],{type:'video/mp4'}));},
    async dispose(){events.push('dispose');},
  };
}

test('renders exact frame-index times, including midpoint, independent of wall-clock',async()=>{
  const captured=[],events=[],progress=[];
  const blob=await exportFrames({
    width:720,height:720,fps:4,duration:2,yieldEvery:0,
    canvasFactory:()=>({getContext:()=>({})}),
    createRecorder:()=>fakeRecorder(captured,events),
    draw:({canvas,frame,phase,time,frames})=>{
      assert.equal(frames,8);
      assert.equal(phase,frame/8);
      assert.equal(time,frame/4);
      canvas.phase=phase;
    },
    onProgress:(done,total)=>progress.push([done,total]),
  });
  assert.equal(blob.type,'video/mp4');
  assert.deepEqual(captured,[0,1/8,2/8,3/8,4/8,5/8,6/8,7/8]);
  assert.deepEqual(events,['start','stop','save','dispose']);
  assert.deepEqual(progress.at(-1),[8,8]);
});

test('cancel stops and disposes encoder without saving partial output',async()=>{
  const abort=new AbortController(),events=[],captured=[];
  await assert.rejects(exportFrames({
    width:720,height:720,fps:4,duration:2,yieldEvery:0,signal:abort.signal,
    canvasFactory:()=>({getContext:()=>({})}),
    createRecorder:()=>fakeRecorder(captured,events),
    draw:({frame})=>{if(frame===2) abort.abort();},
  }),{name:'AbortError'});
  assert.equal(captured.length,3);
  assert.deepEqual(events,['start','stop','dispose']);
});
