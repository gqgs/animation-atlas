import {decode,encode,rng,candidate,inspect,sample,score} from './core.mjs?v=4';
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
            const full=sample(a,1200000);
            const points=new Float64Array(200000);
            for(let i=0;i<100000;i++){const j=i*12;points[2*i]=full.points[2*j];points[2*i+1]=full.points[2*j+1];}
            const orbit={...full,count:100000,points};
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
