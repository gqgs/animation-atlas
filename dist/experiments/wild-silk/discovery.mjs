import {rng,decode} from './core.mjs';
import {normalizeTracks} from '../../shared/parameter-tracks.mjs';
import {trackDefinitions} from './parameters.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=['linear','sine','smoothstep','smootherstep'];
export function normalizeConfig(c){
  decode(c.seed);const s=c.settings||{};
  const ranges={wave:[0,1,.65],motion:[0,1,.6],zoom:[.5,2,.8],rotation:[-180,180,0],exposure:[.2,4,1.6],duration:[8,90,24]};
  const settings={palette:['pearl','iris','copper'].includes(s.palette)?s.palette:'pearl',framing:s.framing==='full'?'full':'core'};
  for(const [k,[lo,hi,d]]of Object.entries(ranges))settings[k]=clamp(Number.isFinite(s[k])?s[k]:d,lo,hi);
  return {version:1,seed:c.seed,settings,tracks:normalizeTracks(c.tracks,trackDefinitions)};
}
export function propose(base,seeds,randomSeed,near=false,count=32){
  base=normalizeConfig(base);const random=rng(randomSeed),pick=a=>a[Math.floor(random()*a.length)];
  const change=(value,lo,hi)=>Math.round(clamp(near?value+(random()+random()-1)*(hi-lo)*.18:lo+random()*(hi-lo),lo,hi)*100)/100;
  return Array.from({length:count},()=>{
    const s={...base.settings,wave:change(base.settings.wave,near?0:.1,1),motion:change(base.settings.motion,0,1)};
    const tracks={};
    for(const key of ['zoom','rotation']){
      const old=base.tracks[key],lo=key==='zoom'?(near?.5:.55):(near?-180:-80),hi=key==='zoom'?(near?2:1.15):(near?180:80);
      let a=change(old?.min??s[key],lo,hi),b=change(old?.max??s[key],lo,hi);if(key==='rotation'){a=Math.round(a);b=Math.round(b);}if(a>b)[a,b]=[b,a];
      tracks[key]={enabled:true,min:a,max:b,easing:near&&random()<.7?old?.easing||'sine':pick(ease)};
    }
    return normalizeConfig({seed:near?base.seed:pick(seeds),settings:s,tracks});
  });
}
export function frameSummary(image){
  const {data,width:w,height:h}=image;let mass=0,edge=0,coverage=0;const gray=new Float32Array(w*h);
  // Remove the dark background; geometry rather than alpha fills every frame.
  for(let i=0;i<gray.length;i++){
    const v=Math.max(0,Math.max(data[i*4],data[i*4+1],data[i*4+2])-30)/225;
    gray[i]=v;mass+=v;if(v>.06)coverage++;
    const x=i%w,y=Math.floor(i/w);if(x<2||y<2||x>=w-2||y>=h-2)edge+=v;
  }
  return {gray,coverage:coverage/gray.length,edge:edge/Math.max(mass,1e-9),mass:mass/gray.length};
}
export function difference(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;}
export function evaluateFrames(frames,intrinsic,endpoint){
  const summaries=frames.map(frameSummary),fixed=intrinsic.map(frameSummary);
  const deltas=summaries.map((s,i)=>difference(s.gray,summaries[(i+1)%summaries.length].gray));
  const motion=deltas.reduce((a,b)=>a+b,0)/deltas.length;
  const deformation=fixed.reduce((sum,s,i)=>sum+difference(s.gray,fixed[(i+1)%fixed.length].gray),0)/fixed.length;
  const coverage=summaries.map(s=>s.coverage),change=Math.max(...coverage)-Math.min(...coverage);
  const seam=difference(summaries[0].gray,frameSummary(endpoint).gray);
  const edge=Math.max(...summaries.map(s=>s.edge));
  const reasons=[];
  if(Math.min(...coverage)<.01)reasons.push('sparse');
  if(edge>.13)reasons.push('edge crowding');
  if(motion<.00025)reasons.push('nearly static');
  if(seam>.002)reasons.push('loop seam');
  return {accepted:reasons.length===0,reasons,motion,deformation,change,edge,seam,
    cell:`${Math.min(2,Math.floor(deformation/.007))}:${Math.min(2,Math.floor(change/.04))}`};
}
export function chooseGallery(evaluated,limit=9){
  const accepted=evaluated.filter(x=>x.metrics.accepted),groups=new Map();
  for(const c of accepted){const key=c.metrics.cell;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
  // Round robin, not a beauty maximum. Stable first-in selection is reproducible.
  const gallery=[];while(gallery.length<limit&&[...groups.values()].some(a=>a.length))for(const a of groups.values()){if(a.length&&gallery.length<limit)gallery.push(a.shift());}
  return gallery;
}
