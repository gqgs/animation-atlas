import test from 'node:test';
import assert from 'node:assert/strict';
import {exportPngSequence} from './png-sequence-export.mjs';

function frameDirectory(){
 const files=new Map(),writes=[];
 return {
  files,writes,
  async getFileHandle(name,{create}={}){
   assert.equal(create,true);
   return {async createWritable(){
    let contents;
    return {
     async write(blob){contents=blob;writes.push(name);},
     async close(){files.set(name,contents);},
     async abort(){contents=undefined;},
    };
   }};
  },
 };
}
function pngCanvas(){
 return {width:0,height:0,phase:0,getContext:()=>({}),
  toBlob(callback,type){assert.equal(type,'image/png');callback(new Blob([String(this.phase)],{type}));}};
}
test('lossless PNG sequence saves exactly indexed PNGs incrementally without an encoder',async()=>{
 const directory=frameDirectory(),steps=[],progress=[];
 const plan=await exportPngSequence({
  width:128,height:128,fps:4,duration:2,yieldEvery:0,directory,
  canvasFactory:pngCanvas,
  draw:({canvas,frame,phase,time,frames})=>{
   assert.equal(frames,8);assert.equal(phase,frame/8);assert.equal(time,frame/4);
   canvas.phase=phase;steps.push(phase);
  },
  onProgress:(done,total)=>{
   progress.push(done);assert.equal(total,8);
   assert.equal(directory.files.size,done);
  },
 });
 assert.equal(plan.frames,8);
 assert.deepEqual(steps,[0,1/8,2/8,3/8,4/8,5/8,6/8,7/8]);
 assert.deepEqual([...directory.files.keys()],Array.from({length:8},(_,i)=>'frame-'+String(i).padStart(6,'0')+'.png'));
 assert.equal(directory.files.size,8);
 assert.equal(await directory.files.get('frame-000004.png').text(),'0.5');
 assert.equal(directory.files.get('frame-000004.png').type,'image/png');
 assert.deepEqual(progress,[1,2,3,4,5,6,7,8]);
});
test('PNG sequence cancellation leaves only fully completed frames and never draws the next one',async()=>{
 const abort=new AbortController(),directory=frameDirectory(),drawn=[];
 await assert.rejects(exportPngSequence({
  width:128,height:128,fps:4,duration:2,yieldEvery:0,signal:abort.signal,
  directory,canvasFactory:pngCanvas,
  draw:({frame})=>drawn.push(frame),
  onProgress:done=>{if(done===2)abort.abort();},
 }),{name:'AbortError'});
 assert.deepEqual(drawn,[0,1]);assert.deepEqual([...directory.files.keys()],['frame-000000.png','frame-000001.png']);
});
test('PNG sequence rejects invalid writer and failed PNG encoding',async()=>{
 await assert.rejects(exportPngSequence({directory:{},draw:()=>{}}),TypeError);
 const directory=frameDirectory();
 await assert.rejects(exportPngSequence({
  width:128,height:128,fps:1,duration:1,directory,
  canvasFactory:()=>({getContext:()=>({}),toBlob:callback=>callback(null)}),
  draw:()=>{},
 }),/PNG encoding returned no image/);
 assert.equal(directory.files.size,0);
});
