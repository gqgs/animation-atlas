import {resolveParameters,normalizeTracks,parseTracks} from '../../shared/parameter-tracks.mjs';
export const definitions={depth:{min:0,max:2.95,step:.01,defaultValue:2.9},pleats:{min:0,max:.22,step:.01,defaultValue:.14},zoom:{min:.5,max:1.5,step:.01,defaultValue:1},rotation:{min:-180,max:180,step:1,defaultValue:0},elevation:{min:10,max:85,step:1,defaultValue:43}};
export const defaults={depth:2.9,pleats:.14,zoom:1,rotation:0,elevation:43,duration:16};
export const defaultTracks=normalizeTracks({},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
 const settings={...defaults};
 for(const [k,d]of Object.entries({...definitions,duration:{min:4,max:90}})){const n=Number(params.get(k));if(params.has(k)&&Number.isFinite(n))settings[k]=Math.max(d.min,Math.min(d.max,n));}
 return {settings,tracks:params.has('tracks')?parseTracks(params.get('tracks'),definitions):structuredClone(defaultTracks)};
}
export const TAU=2*Math.PI,ANGULAR=224,RADIAL=32,ROOT=1.05;
export const wrap=phase=>((phase%1)+1)%1;
export function surfaceAt(theta,u,p,phase){
 theta=wrap(theta/TAU)*TAU;
 const t=wrap(phase)*TAU;
 const k=p.depth*(.65*Math.sin(theta-t)+.35*Math.sin(2*theta+t));
 // 56 triangular flutes, four angular samples each. Positive length at all settings.
 const ridge=1-4*Math.abs(wrap(theta/TAU*56)-.5);
 const length=1.9*(1+.22*Math.cos(7*theta)+p.pleats*ridge);
 const angle=k*u;
 // Stable limits at k=0 avoid cancellation at the traveling zero-curvature line.
 const r=ROOT+length*u*(Math.abs(angle)<1e-4?1-angle*angle/6:Math.sin(angle)/angle);
 const y=length*k*u*u*(Math.abs(angle)<1e-4?.5-angle*angle/24:(1-Math.cos(angle))/(angle*angle))||0;
 return [r*Math.cos(theta),y,r*Math.sin(theta)];
}
export function geometryAt(p,phase,target=new Float32Array((ANGULAR+1)*(RADIAL+1)*3)){
 for(let i=0;i<=ANGULAR;i++)for(let j=0;j<=RADIAL;j++)target.set(surfaceAt(i/ANGULAR*TAU,j/RADIAL,p,phase),(i*(RADIAL+1)+j)*3);
 return target;
}
export const indices=new Uint16Array(ANGULAR*RADIAL*6);
for(let i=0,n=0;i<ANGULAR;i++)for(let j=0;j<RADIAL;j++){
 const a=i*(RADIAL+1)+j,b=(i+1)*(RADIAL+1)+j;
 indices.set([a,b,a+1,b,b+1,a+1],n);n+=6;
}
