import {resolveParameters,normalizeTracks,parseTracks} from '../../shared/parameter-tracks.mjs';
export const definitions={closure:{min:0,max:1,step:.01,defaultValue:0},cascade:{min:0,max:1,step:.01,defaultValue:.65},zoom:{min:.5,max:2.5,step:.01,defaultValue:1},rotation:{min:-180,max:180,step:1,defaultValue:0},elevation:{min:10,max:85,step:1,defaultValue:28}};
export const defaults={closure:0,cascade:.65,zoom:1,rotation:0,elevation:28,duration:18};
export const defaultTracks=normalizeTracks({closure:{enabled:true,min:0,max:1,easing:'smootherstep'},zoom:{enabled:true,min:1,max:1.65,easing:'smootherstep'}},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
 const settings={...defaults};
 for(const [k,d] of Object.entries({...definitions,duration:{min:4,max:90}})){const n=Number(params.get(k));if(params.has(k)&&Number.isFinite(n))settings[k]=Math.max(d.min,Math.min(d.max,n));}
 return {settings,tracks:params.has('tracks')?parseTracks(params.get('tracks'),definitions):structuredClone(defaultTracks)};
}
export const COUNT=10;
export const outline=[[0,-1.2],[1,-1.2],[1,1.2],[.5,1.55],[0,1.2]];
export function panelsAt(closure,cascade=.65){
 const c=Math.max(0,Math.min(1,closure)),joints=[[0,0]],angles=[];
 let angle=0;
 for(let i=0;i<COUNT;i++){
  if(i)angle+=2*Math.PI/COUNT*(c+cascade*c*(1-c)*(2*(i-1)/(COUNT-2)-1));
  angles.push(angle);const v=joints[i];joints.push([v[0]+Math.cos(angle),v[1]+Math.sin(angle)]);
 }
 const center=joints.slice(0,COUNT).reduce((a,v,i)=>[a[0]+(v[0]+joints[i+1][0])/(2*COUNT),a[1]+(v[1]+joints[i+1][1])/(2*COUNT)],[0,0]);
 // Rotate the whole chain symmetrically; this does not alter any joint angle.
 const yaw=-angles[COUNT-1]/2,co=Math.cos(yaw),si=Math.sin(yaw);
 const rotate=(x,y,z)=>[(x-center[0])*co-(z-center[1])*si,y,(x-center[0])*si+(z-center[1])*co];
 return angles.map((a,id)=>{
  const transform=([u,v])=>rotate(joints[id][0]+u*Math.cos(a),v,joints[id][1]+u*Math.sin(a));
  return {id,vertices:outline.map(transform),left:[transform([0,-1.2]),transform([0,1.2])],right:[transform([1,-1.2]),transform([1,1.2])],transform};
 });
}
