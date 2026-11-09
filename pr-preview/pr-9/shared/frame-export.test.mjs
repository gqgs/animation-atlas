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
  assert.equal(captured.length,2);
  assert.deepEqual(events,['start','stop','dispose']);
});

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){
  const events=[],recorder=fakeRecorder([],events);
  Object.assign(recorder,overrides);
  return {events,recorder,options:{width:2,height:2,fps:1,duration:1,yieldEvery:0,
    canvasFactory:()=>({getContext:()=>({})}),createRecorder:()=>recorder,draw:()=>{}}};
}
for(const stage of ['start','draw','capture','stop','save','dispose']){
  test(`abort interrupts pending ${stage} and restores caller promptly`,async()=>{
    const entered=deferred(),blocked=deferred(),abort=new AbortController();
    const f=fixture(),operation=()=>{entered.resolve();return blocked.promise;};
    if(stage==='draw')f.options.draw=operation;else f.recorder[stage]=operation;
    const result=exportFrames({...f.options,signal:abort.signal});
    await entered.promise;abort.abort();
    await assert.rejects(Promise.race([result,new Promise((_,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Cancellation hung')),250);timer.unref();
    })]),{name:'AbortError'});
    if(stage!=='dispose')assert.ok(f.events.includes('dispose'));
    if(!['save','dispose'].includes(stage))assert.ok(!f.events.includes('save'));
    blocked.resolve();await tick();
  });
}
test('late setup allocation is disposed after cancellation',async()=>{
  const setup=deferred(),entered=deferred(),abort=new AbortController();let resource=false,disposals=0;
  const f=fixture({start:async()=>{entered.resolve();await setup.promise;resource=true;},
    dispose:()=>{disposals++;resource=false;}});
  const result=exportFrames({...f.options,signal:abort.signal});await entered.promise;abort.abort();
  await assert.rejects(result,{name:'AbortError'});assert.equal(disposals,1);
  setup.resolve();await tick();assert.equal(resource,false);assert.equal(disposals,2);
});
test('late save callback cannot turn cancellation into success',async()=>{
  const entered=deferred(),saving=deferred(),abort=new AbortController();let callback;
  const f=fixture({save:cb=>{callback=cb;entered.resolve();return saving.promise;}});
  const result=exportFrames({...f.options,signal:abort.signal});await entered.promise;abort.abort();
  await assert.rejects(result,{name:'AbortError'});callback(new Blob(['late']));saving.resolve();await tick();
});
test('emitted codec errors reject even when capture resolves successfully',async()=>{
  let emit;const codecError=new Error('codec failed');
  const f=fixture({on:(event,handler)=>{assert.equal(event,'error');emit=handler;},capture:()=>emit(codecError)});
  await assert.rejects(exportFrames(f.options),error=>error===codecError);
  assert.deepEqual(f.events,['start','stop','dispose']);
});
test('aborting inside progress interrupts UI yield before another frame',async()=>{
  const abort=new AbortController();const f=fixture();
  await assert.rejects(exportFrames({...f.options,duration:2,yieldEvery:1,signal:abort.signal,
    onProgress:()=>abort.abort()}),{name:'AbortError'});
  assert.deepEqual(f.events,['start','stop','dispose']);
});

test('abort interrupts an already pending UI yield',async()=>{
  const original=globalThis.setTimeout,entered=deferred(),abort=new AbortController(),f=fixture();
  globalThis.setTimeout=(callback,delay,...args)=>{
    if(delay===0){entered.resolve();return 0;}
    return original(callback,delay,...args);
  };
  try{
    const result=exportFrames({...f.options,yieldEvery:1,signal:abort.signal});
    await entered.promise;abort.abort();await assert.rejects(result,{name:'AbortError'});
    assert.deepEqual(f.events,['start','stop','dispose']);
  }finally{globalThis.setTimeout=original;}
});
test('codec error interrupts an unresolved capture',async()=>{
  const entered=deferred(),blocked=deferred();let emit;
  const error=new Error('async encoder failure');
  const f=fixture({on:(_,handler)=>{emit=handler;},capture:()=>{entered.resolve();return blocked.promise;}});
  const result=exportFrames(f.options);await entered.promise;emit(error);
  await assert.rejects(result,cause=>cause===error);assert.deepEqual(f.events,['start','stop','dispose']);
  blocked.resolve();await tick();
});
