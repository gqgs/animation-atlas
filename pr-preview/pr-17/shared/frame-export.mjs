// Reusable fixed-timestep browser exporter. Renderers own all visual state;
 // FrameWrap (CCapture.js 2.x) owns encoding, not the browser clock.
export function exportPlan({width=1080,height=1080,fps=30,duration=10}={}) {
  for (const [name,value] of Object.entries({width,height,fps,duration})) {
    if (!Number.isFinite(value) || value<=0) throw new RangeError(name+' must be positive and finite');
  }
  if (![width,height].every(n=>Number.isInteger(n)&&n%2===0)) throw new RangeError('Video dimensions must be even integers');
  const frames=Math.round(duration*fps);
  if (!Number.isSafeInteger(frames)||frames<1) throw new RangeError('Invalid frame count');
  return {width,height,fps,duration,frames};
}


/**
 * Lossless, constant-memory PNG sequence export. The caller supplies a
 * FileSystemDirectoryHandle (or compatible sink) so PNG blobs never accumulate
 * into a huge in-memory ZIP. Completed frames remain on disk if canceled.
 * Frame numbers start at zero, and the loop endpoint is deliberately omitted.
 */
export async function exportPngSequence({
  width=1080,height=1080,fps=30,duration=10,draw,directory,
  canvasFactory,onProgress=()=>{},signal,yieldEvery=8,
}={}) {
  const plan=exportPlan({width,height,fps,duration});
  if(typeof draw!=='function')throw new TypeError('draw callback is required');
  if(!directory||typeof directory.getFileHandle!=='function')
    throw new TypeError('A writable directory handle is required');
  const canvas=canvasFactory?canvasFactory(width,height):document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Could not create PNG export canvas');
  const digits=Math.max(6,String(plan.frames-1).length);
  function check(){if(signal?.aborted)throw abortError();}
  for(let frame=0;frame<plan.frames;frame++) {
    check();
    await draw({canvas,ctx,frame,time:frame/fps,phase:frame/plan.frames,
      frames:plan.frames,fps});
    check();
    const blob=await new Promise((resolve,reject)=>{
      try{canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding returned no image')),'image/png');}
      catch(error){reject(error);}
    });
    check();
    if(blob.type!=='image/png')throw new Error('Browser did not encode a PNG');
    const name='frame-'+String(frame).padStart(digits,'0')+'.png';
    const handle=await directory.getFileHandle(name,{create:true});
    check();
    const writable=await handle.createWritable();
    try{
      check();
      await writable.write(blob);
      check();
      await writable.close();
    }catch(error){
      try{await writable.abort?.();}catch{}
      throw error;
    }
    onProgress(frame+1,plan.frames);
    check();
    if(yieldEvery>0&&(frame+1)%yieldEvery===0)
      await new Promise(resolve=>setTimeout(resolve,0));
  }
  check();
  return plan;
}

// Lazy-load the pinned prebuilt UMD distribution. No runtime/npm build required by atlas.
let loading;
export function loadFrameWrap(url='https://cdn.jsdelivr.net/npm/ccapture.js@2.0.0/build/ccapture.umd.min.js') {
  if (globalThis.CCapture?.FrameWrap) return Promise.resolve(globalThis.CCapture.FrameWrap);
  if (!loading) loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url;
    script.onload=()=>globalThis.CCapture?.FrameWrap
      ? resolve(globalThis.CCapture.FrameWrap)
      : reject(new Error('CCapture loaded without FrameWrap'));
    script.onerror=()=>reject(new Error('Could not load CCapture.js; check your connection'));
    document.head.append(script);
  }).catch(e=>{loading=null;throw e;});
  return loading;
}

// draw receives {canvas, ctx, frame, time, phase, frames, fps} for every output frame.
// Frame times are exact i/fps; the last frame deliberately precedes duration for a loop.
// createRecorder is injected for tests or to replace the codec with another backend.
export async function exportFrames({
  width=1080,height=1080,fps=30,duration=10,format='mp4',
  bitrate=24000000,draw,createRecorder,canvasFactory,
  onProgress=()=>{},signal,yieldEvery=8,
}={}) {
  const plan=exportPlan({width,height,fps,duration});
  if (typeof draw!=='function'||typeof createRecorder!=='function')
    throw new TypeError('draw and createRecorder callbacks are required');
  const canvas=canvasFactory?canvasFactory(width,height):document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if (!ctx) throw new Error('Could not create export canvas');
  const recorder=createRecorder({format,codec:format==='mp4'?'avc':'vp9',
    framerate:fps,bitrate,quality:95,maxQueueSize:2});
  let started=false,stopped=false,failure=null;
  const pending=new Set();
  let rejectFailure;
  const failed=new Promise((_,reject)=>{rejectFailure=reject;});
  // A failure may arrive between awaits; always observe its rejection.
  failed.catch(()=>{});
  function fail(error){if(!failure){failure=error;rejectFailure(error);}}
  const onAbort=()=>fail(abortError());
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  recorder.on?.('error',error=>fail(error instanceof Error?error:new Error(String(error))));
  function invoke(operation,track=true){
    // Invoke synchronously so stop/dispose begin even when an earlier await hangs.
    let promise;
    try{promise=Promise.resolve(operation());}catch(error){promise=Promise.reject(error);}
    if(track)pending.add(promise);
    promise.then(()=>pending.delete(promise),()=>pending.delete(promise));
    return promise;
  }
  async function step(operation){
    if(failure)throw failure;
    const result=await Promise.race([invoke(operation),failed]);
    if(failure)throw failure;
    return result;
  }
  function disposeLater(){
    // A pending start/configure can allocate resources after the first disposal.
    try{Promise.resolve(recorder.dispose?.()).catch(()=>{});}catch{}
  }
  try {
    await step(()=>recorder.start());started=true;
    for (let frame=0;frame<plan.frames;frame++) {
      await step(()=>draw({canvas,ctx,frame,time:frame/fps,phase:frame/plan.frames,
        frames:plan.frames,fps}));
      await step(()=>recorder.capture(canvas));
      // FrameWrap exposes this hook but does not call it in capture(). Bound
      // native GPU/codec work so cancellation cannot inherit a whole clip queue.
      if (typeof recorder.encoder?.backpressure==='function')
        await step(()=>recorder.encoder.backpressure());
      onProgress(frame+1,plan.frames);
      // Yield to the UI, not to the animation clock; abort also interrupts this wait.
      if (yieldEvery>0&&(frame+1)%yieldEvery===0)
        await step(()=>new Promise(resolve=>setTimeout(resolve,0)));
    }
    // Mark before awaiting: do not invoke stop twice if its promise is interrupted.
    await step(()=>{stopped=true;return recorder.stop();});
    let result;
    await step(()=>recorder.save(blob=>{if(!failure)result=blob;}));
    if (!result?.size) throw new Error('Encoder returned an empty video');
    return result;
  } catch(error) {
    fail(error);
    throw failure;
  } finally {
    // In the normal path preserve stop -> save -> dispose ordering. On failure,
    // start cleanup immediately, but never hold the UI hostage to its promises.
    if (!stopped&&(started||failure)) {
      stopped=true;
      const stopping=invoke(()=>recorder.stop(),false);
      if(!failure){try{await Promise.race([stopping,failed]);}catch{}}
    }
    const disposing=invoke(()=>recorder.dispose?.(),false);
    if(!failure){try{await Promise.race([disposing,failed]);}catch{}}
    if(failure){
      for(const operation of pending)operation.then(disposeLater,disposeLater);
    }
    signal?.removeEventListener('abort',onAbort);
    // In particular, an abort while final disposal is pending must reject too.
    if(failure)throw failure;
  }
}
function abortError(){const e=new Error('Export canceled');e.name='AbortError';return e;}
