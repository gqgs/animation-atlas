import {distributions,solve} from './core.mjs';
self.onmessage=({data:d})=>{try { const [a,b]=distributions(d.shape,144,d.mass);self.postMessage({id:d.id,a,b,plan:solve(a,b,d.scale)}); }catch(e){self.postMessage({id:d.id,error:e.message});}};
