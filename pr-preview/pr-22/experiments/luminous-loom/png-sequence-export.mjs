import {exportPlan} from '../../shared/frame-export.mjs';

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


function abortError(){const e=new Error('PNG export canceled');e.name='AbortError';return e;}
