import {resolveParameters,normalizeTracks,parseTracks} from '../../shared/parameter-tracks.mjs';
export const definitions={
 amplitude:{min:0,max:1,step:.01,defaultValue:.8},
 fold:{min:.3,max:1.2,step:.01,defaultValue:.75},
 zoom:{min:.5,max:1.4,step:.01,defaultValue:1},
 rotation:{min:-180,max:180,step:1,defaultValue:0},
 elevation:{min:15,max:85,step:1,defaultValue:52},
};
export const defaults={amplitude:.8,fold:.75,zoom:1,rotation:0,elevation:52,duration:12};
export const defaultTracks=normalizeTracks({},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
 const settings={...defaults};
 for(const [k,d]of Object.entries({...definitions,duration:{min:4,max:90}})){
  const n=Number(params.get(k));if(params.has(k)&&Number.isFinite(n))settings[k]=Math.max(d.min,Math.min(d.max,n));
 }
 return {settings,tracks:params.has('tracks')?parseTracks(params.get('tracks'),definitions):structuredClone(defaultTracks)};
}
const TAU=2*Math.PI;
export function waveAt(phase,index){return Math.sin(TAU*((phase%1+1)%1)-index*TAU/8);}
// Cached square-ring topology: alternating ridges align with concentric squares.
const rings=18, sides=16;
const samples=Array.from({length:rings+1},(_,j)=>Array.from({length:sides},(_,k)=>{
 const side=Math.floor(k/4),t=(k%4)/4,r=j/rings;
 return [[-1+2*t,-1],[1,-1+2*t],[1-2*t,1],[-1,1-2*t]][side].map(v=>v*r);
}));
export function facesAt(p,phase){
 const faces=[];
 for(let id=0;id<8;id++){
  const angle=id*TAU/8,wave=waveAt(phase,id),a=p.amplitude;
  const twist=.48*a*wave,c=Math.cos(twist),s=Math.sin(twist),radius=2.65+.14*a*wave;
  const points=samples.map((ring,j)=>ring.map(([u,v])=>{
   const r=j/rings,pleat=(j%2?1:-1)*.075*r*(1+.3*a*wave);
   const x=.94*u*(1+.12*a*wave),z=.94*v*(1-.12*a*wave);
   const y=p.fold*(1+.65*a*wave)*(u*u-v*v)+pleat+.42*a*wave;
   const xx=x*c-y*s,yy=x*s+y*c;
   return [(radius+xx)*Math.cos(angle)-z*Math.sin(angle),yy,(radius+xx)*Math.sin(angle)+z*Math.cos(angle)];
  }));
  for(let j=1;j<=rings;j++)for(let k=0;k<sides;k++){
   const n=(k+1)%sides,vs=[points[j-1][k],points[j][k],points[j][n],points[j-1][n]];
   faces.push({id,ring:j,wave,vertices:[vs[0],vs[1],vs[2]]});
   if(j>1)faces.push({id,ring:j,wave,vertices:[vs[0],vs[2],vs[3]]});
  }
 }
 return faces;
}
