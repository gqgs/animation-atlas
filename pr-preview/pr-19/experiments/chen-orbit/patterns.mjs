import {wrap} from './core.mjs';
export const trailStart=36000,trailCount=12000;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Two soft-ended light trains advance along the real, contiguous sample order.
// The finite path fades at both ends: no invented last-to-first connector.
export function lightMask(u,phase){
 const packet=a=>smooth(0,.008,a)*Math.exp(-((a/.065)**2));
 return (packet(wrap(phase-u))+.65*packet(wrap(phase+.5-u)))*smooth(0,.035,u)*(1-smooth(.965,1,u));
}
export function buildLightTrail(model){
 if(model.count<trailStart+trailCount)throw new RangeError('Trajectory is too short for light trail');
 const data=model.data.slice(trailStart*4,(trailStart+trailCount)*4);
 for(let i=0;i<trailCount;i++)data[i*4+3]=i/(trailCount-1);
 return {data,count:trailCount};
}
