// Stop waiting for shared CDN initialization immediately, without canceling a
// script load that another export may already be awaiting.
export function abortable(promise,signal) {
 return new Promise((resolve,reject)=>{
  const cancel=()=>reject(new DOMException('Canceled','AbortError'));
  if(signal.aborted)cancel();
  else signal.addEventListener('abort',cancel,{once:true});
  Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
 });
}
