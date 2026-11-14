import {resolveParameters,normalizeTracks,parseTracks} from '../../shared/parameter-tracks.mjs';
export const definitions={
 opening:{min:0,max:1,step:.01,defaultValue:0},
 zoom:{min:.5,max:1.5,step:.01,defaultValue:1},
 rotation:{min:-180,max:180,step:1,defaultValue:0},
 elevation:{min:10,max:85,step:1,defaultValue:42},
};
export const defaults={opening:0,zoom:1,rotation:0,elevation:42,duration:20,height:1.65};
export const defaultTracks=normalizeTracks({
 opening:{enabled:true,min:0,max:1,easing:'smootherstep'},
 rotation:{enabled:true,min:-25,max:25,easing:'sine'},
},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
 const settings={...defaults};
 for(const [k,d]of Object.entries({...definitions,duration:{min:4,max:90},height:{min:.5,max:2.5}})){
  const n=Number(params.get(k));if(params.has(k)&&Number.isFinite(n))settings[k]=Math.max(d.min,Math.min(d.max,n));
 }
 return {settings,tracks:params.has('tracks')?parseTracks(params.get('tracks'),definitions):structuredClone(defaultTracks)};
}
// Hexagonal pyramid cut along its six apex edges. Each rigid triangular face
// rotates about its own base edge; the central hexagon is never cut.
export function facesAt(opening,height=1.65){
 const a=Math.cos(Math.PI/6),length=Math.hypot(a,height);
 const angle=Math.atan2(height,-a)*(1-Math.max(0,Math.min(1,opening)));
 const ring=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3),0,Math.sin(i*Math.PI/3)]);
 const faces=[{id:6,vertices:ring}];
 for(let i=0;i<6;i++){
  const theta=(i+.5)*Math.PI/3,r=a+length*Math.cos(angle);
  faces.push({id:i,vertices:[ring[i],ring[(i+1)%6],[r*Math.cos(theta),length*Math.sin(angle),r*Math.sin(theta)]]});
 }
 return faces;
}
