import {decode,encode,rng,candidate,inspect,sample,score} from './core.mjs';
self.onmessage=({data})=>{
  try{
    const random=rng(data.randomSeed),base=decode(data.seed),seen=new Set([data.seed]);
    let found=0;
    for(let attempts=1;attempts<=25000;attempts++){
      const a=candidate(random,base,data.mode),seed=encode(a);
      if(seen.has(seed))continue;seen.add(seed);
      const quick=inspect(a,2400);
      if(quick.accepted){
        const metrics=inspect(a,16000);
        if(metrics.accepted){
          try{
            const orbit=sample(a,100000);
            self.postMessage({type:'candidate',seed,metrics,score:score(metrics,data.target),orbit,attempts},[orbit.points.buffer]);
            if(++found>=8){self.postMessage({type:'done',attempts,found});return;}
          }catch{/* Reject late escape; do not regularize the recurrence. */}
        }
      }
      if(attempts%100===0)self.postMessage({type:'progress',attempts,found});
    }
    self.postMessage({type:'done',attempts:25000,found});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
