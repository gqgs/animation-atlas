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
    framerate:fps,bitrate,quality:95});
  let started=false,stopped=false;
  try {
    if (signal?.aborted) throw abortError();
    await recorder.start();started=true;
    for (let frame=0;frame<plan.frames;frame++) {
      if (signal?.aborted) throw abortError();
      await draw({canvas,ctx,frame,time:frame/fps,phase:frame/plan.frames,
        frames:plan.frames,fps});
      await recorder.capture(canvas);
      onProgress(frame+1,plan.frames);
      // Yield to the UI, not to the animation clock.
      if (yieldEvery>0&&(frame+1)%yieldEvery===0)
        await new Promise(resolve=>setTimeout(resolve,0));
    }
    if (signal?.aborted) throw abortError();
    await recorder.stop();stopped=true;
    let result;
    await recorder.save(blob=>{result=blob;});
    if (!result?.size) throw new Error('Encoder returned an empty video');
    return result;
  } finally {
    if (started&&!stopped) {
      try {await recorder.stop();}catch { /* original failure takes priority */ }
    }
    try {await recorder.dispose?.();}catch { /* avoid masking original errors */ }
  }
}
function abortError(){const e=new Error('Export canceled');e.name='AbortError';return e;}
