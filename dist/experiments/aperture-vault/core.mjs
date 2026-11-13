import {normalizeTracks, parseTracks, resolveParameters} from '../../shared/parameter-tracks.mjs';

export const TAU = 2*Math.PI;
export const BASE_Y=.34, BASE_RADIUS=1.50, APEX_HEIGHT=2.03;
export const definitions = {
  opening:{min:0,max:1,step:.01,defaultValue:0},
  zoom:{min:.58,max:1.40,step:.01,defaultValue:1},
  rotation:{min:-180,max:180,step:1,defaultValue:0},
  elevation:{min:15,max:75,step:1,defaultValue:33},
};
export const defaults={opening:0,zoom:1,rotation:0,elevation:33,duration:12,lighting:'dispersion'};
export const defaultTracks=normalizeTracks({opening:{min:0,max:.86,easing:'smootherstep'}},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
  const settings={...defaults};
  for(const [key,{min,max}] of Object.entries({...definitions,duration:{min:4,max:90}})){
    const n=Number(params.get(key));
    if(params.has(key)&&params.get(key).trim()&&Number.isFinite(n)) settings[key]=Math.min(max,Math.max(min,n));
  }
  if(params.get('lighting')==='mono') settings.lighting='mono';
  return {settings,tracks:params.has('tracks')?parseTracks(params.get('tracks'),definitions):structuredClone(defaultTracks)};
}

export const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>mul(a,1/Math.hypot(...a));
const clamp=x=>Math.max(0,Math.min(1,x));
const a=BASE_RADIUS*Math.cos(Math.PI/6);
const closedAngle=Math.atan2(APEX_HEIGHT,-a);
const slant=Math.hypot(a,APEX_HEIGHT);
const ring=Array.from({length:6},(_,i)=>{
  const theta=i*TAU/6;
  return [BASE_RADIUS*Math.cos(theta),BASE_Y,BASE_RADIUS*Math.sin(theta)];
});
const apex=[0,BASE_Y+APEX_HEIGHT,0];
export const facesAt=opening=>{
  const t=clamp(opening), angle=closedAngle*(1-t);
  return ring.map((p,i)=>{
    const theta=(i+.5)*TAU/6,r=a+slant*Math.cos(angle);
    return [p,ring[(i+1)%6],t===0?apex:[r*Math.cos(theta),BASE_Y+slant*Math.sin(angle),r*Math.sin(theta)]];
  });
};

const theta=TAU/12, radial=[Math.cos(theta),0,Math.sin(theta)];
const tangent=[-Math.sin(theta),0,Math.cos(theta)];
const local=(r,y,z)=>add(add(mul(radial,r),[0,y,0]),mul(tangent,z));
export const SOURCE=[0,1.55,0];
const aim=unit(local(1,-.39,0));

// Closed wedge section (radial, tangential); the prism extrudes vertically.
// Its two optical planes are nonparallel and the whole prism rotates about face 0's hinge.
const section=[[.57,-.19],[.57,.21],[.812,-.19]];
const yLow=1.24,yHigh=1.55;
export function prismAt(opening){
  const angle=closedAngle*clamp(opening),c=Math.cos(angle),s=Math.sin(angle);
  const rotate=([r,y,z])=>{
    const dy=y-BASE_Y,dr=r-a;
    return local(a+dr*c+dy*s,BASE_Y+dy*c-dr*s,z);
  };
  const v=[...section.map(([r,z])=>rotate([r,yLow,z])),...section.map(([r,z])=>rotate([r,yHigh,z]))];
  const polygons=[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]].map(p=>p.map(i=>v[i]));
  return {vertices:v,polygons};
}

function rayTriangle(origin,dir,a,b,c){
  const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);
  if(Math.abs(det)<1e-8) return null;
  const s=sub(origin,a),u=dot(s,h)/det;
  if(u<0||u>1) return null;
  const q=cross(s,e1),v=dot(dir,q)/det;
  if(v<0||u+v>1) return null;
  const t=dot(e2,q)/det;
  return t>1e-5?{t,point:add(origin,mul(dir,t)),normal:unit(cross(e1,e2))}:null;
}

function firstHit(origin,dir,{polygons}){
  let nearest=null;
  for(const [face,p] of polygons.entries()) for(let i=1;i<p.length-1;i++){
    const hit=rayTriangle(origin,dir,p[0],p[i],p[i+1]);
    if(hit&&(!nearest||hit.t<nearest.t)) nearest={...hit,face};
  }
  return nearest;
}

// Snell's law in vector form. Orient the interface normal toward the incoming
// ray; nFrom/nTo determines the critical angle and direction change.
export function refract(dir,normal,nFrom,nTo){
  if(dot(dir,normal)>0) normal=mul(normal,-1);
  const ratio=nFrom/nTo,c=-dot(dir,normal),k=1-ratio*ratio*(1-c*c);
  return k<0?null:unit(add(mul(dir,ratio),mul(normal,ratio*c-Math.sqrt(k))));
}

// SCHOTT N-SF11 Sellmeier coefficients. Wavelength is in micrometres here.
export const wavelengthIndex=nm=>{
  const l2=(nm/1000)**2;
  return Math.sqrt(1+1.73759695*l2/(l2-.013188707)+.313747346*l2/(l2-.0623068142)+1.89878101*l2/(l2-155.23629));
};
export const spectrum=[
  [650,'#ff3c42'],[610,'#ff732e'],[580,'#ffd54a'],[550,'#9bf86b'],
  [510,'#42f9cb'],[470,'#559bff'],[435,'#a96dff'],
];

export function tracePrism(opening,mode='dispersion',offsetY=0){
  const prism=prismAt(opening);
  const origin=add(SOURCE,[0,offsetY,0]);
  const whiteFloor=add(origin,mul(aim,-origin[1]/aim[1]));
  const entry=firstHit(origin,aim,prism);
  if(!entry) return {prism,entry:null,rays:[],whiteEnd:whiteFloor,origin};
  const rays=[];
  const samples=mode==='mono'?[[550,'#fff4dc']]:spectrum;
  for(const [wavelength,color] of samples){
    const n=wavelengthIndex(wavelength);
    const inside=refract(aim,entry.normal,1,n);
    if(!inside) continue;
    const exit=firstHit(add(entry.point,mul(inside,1e-4)),inside,prism);
    if(!exit) continue;
    const direction=refract(inside,exit.normal,n,1);
    if(!direction||direction[1]>=-.04) continue;
    const distance=-exit.point[1]/direction[1];
    if(distance>24) continue;
    const floor=add(exit.point,mul(direction,distance));
    rays.push({wavelength,color,exit,direction,floor});
  }
  return {prism,entry,rays,whiteEnd:entry.point,origin};
}
