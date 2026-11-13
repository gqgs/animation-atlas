import {normalizeTracks, parseTracks, resolveParameters} from '../../shared/parameter-tracks.mjs';

export const TAU = 2*Math.PI;
export const BASE_Y=.34, BASE_RADIUS=1.50, APEX_HEIGHT=2.03;
export const definitions = {
  intensity:{min:0,max:2.4,step:.05,defaultValue:1},
  opening:{min:0,max:1,step:.01,defaultValue:0},
  zoom:{min:.58,max:1.40,step:.01,defaultValue:1},
  rotation:{min:-180,max:180,step:1,defaultValue:0},
  elevation:{min:15,max:75,step:1,defaultValue:33},
};
export const defaults={opening:0,zoom:1,rotation:0,elevation:33,duration:12,lighting:'reflections',intensity:1,coreColor:'#ffcf91'};
export const defaultTracks=normalizeTracks({opening:{min:0,max:.86,easing:'smootherstep'}},definitions);
export const poseAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,definitions);
export function readState(params){
  const settings={...defaults};
  for(const [key,{min,max}] of Object.entries({...definitions,duration:{min:4,max:90}})){
    const n=Number(params.get(key));
    if(params.has(key)&&params.get(key).trim()&&Number.isFinite(n)) settings[key]=Math.min(max,Math.max(min,n));
  }
  if(params.get('lighting')==='direct') settings.lighting='direct';
  if(/^#[0-9a-f]{6}$/i.test(params.get('coreColor')||'')) settings.coreColor=params.get('coreColor').toLowerCase();
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

export const SOURCE=[0,1.42,0];
export const normalAt=([a,b,c])=>unit(cross(sub(b,a),sub(c,a)));
export const reflect=(dir,n)=>sub(dir,mul(n,2*dot(dir,n)));
export const mirrorPoint=(point,face,n=normalAt(face))=>add(face[0],reflect(sub(point,face[0]),n));
export const fresnel=cosine=>.04+.96*(1-Math.abs(cosine))**5;
export function centerOf(points){
  return mul(points.reduce(add,[0,0,0]),1/points.length);
}

// The softboxes are out of frame. Each rectangular emitter is specified
// by its center and full edge vectors. Mirror images are clipped to the face.
export const softboxes=[
  {center:[3.34,1.97,3.10],u:[-.50,0,.54],v:[0,3.42,0],color:'#c6e5ff',gain:10.2},
  {center:[2.13,1.45,-4.10],u:[.72,0,.38],v:[0,3.30,0],color:'#ffc78b',gain:8.2},
  {center:[-3.40,1.27,.05],u:[0,0,.77],v:[0,3.04,0],color:'#96cedf',gain:5.1},
  {center:[-1.95,4.55,-.67],u:[2.34,0,.61],v:[-.18,0,.69],color:'#b4d4ff',gain:5.3},
  {center:[.57,3.45,1.20],u:[1.75,0,-.14],v:[.10,0,1.12],color:'#edf1ff',gain:5.4},
];
export function reflectionAt(face,eye,box){
  const n=normalAt(face),f=face[0];
  const eyeSide=dot(sub(eye,f),n);
  const sourceSide=dot(sub(box.center,f),n);
  if(eyeSide*sourceSide<=0) return null;
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>add(box.center,add(mul(box.u,u/2),mul(box.v,v/2))));
  return {
    points:corners.map(p=>mirrorPoint(p,face,n)),
    opacity:Math.min(.84,box.gain*fresnel(dot(unit(sub(eye,centerOf(face))),n))),
  };
}

// One representative specular reflection from the central emitter per face.
// Reflect toward the receiver through the centroid; reject upward and
// degenerate rays. The renderer paints a broad lobe rather than a hard caustic.
export function floorReflection(face,source=SOURCE){
  const n=normalAt(face),c=centerOf(face);
  const start=c, d=unit(sub(start,source));
  const incoming=dot(n,d),r=reflect(d,n);
  if(r[1]>=-.06) return null;
  const t=-start[1]/r[1];
  const point=add(start,mul(r,t));
  const extent=Math.hypot(point[0],point[2]);
  if(extent<1.43||extent>8.5) return null;
  const boundary=clamp((extent-1.43)/.50)*clamp((8.5-extent)/2);
  return {
    point, direction:r,
    strength:boundary*(.25+.75*Math.abs(incoming))*Math.min(1,4/(1+t*t)),
    radius:Math.min(.64,.26+t*.08), length:Math.min(1.45,.45+t*.14),
  };
}

export function coreLightAt(p){
  const strength=clamp(p.intensity/2.4)*2.4;
  return {
    color:p.coreColor,
    strength,
    pointPower:7.4*strength,
    // Gradual highlight compression for drawing an emissive surface in SDR.
    emission:1-Math.exp(-1.35*strength),
  };
}

export function colorScale(hex,scale,white=0){
  const channels=hex.slice(1).match(/../g).map(v=>parseInt(v,16));
  return '#'+channels.map(v=>Math.round(Math.max(0,Math.min(255,v*scale*(1-white)+255*white))).toString(16).padStart(2,'0')).join('');
}

const coreLayers=[[-.198,.085],[-.118,.173],[.104,.173],[.198,.073]];
const facets=8;
const gemRing=(y,r,phase)=>Array.from({length:facets},(_,i)=>{
  const a=TAU*i/facets+phase;
  return add(SOURCE,[r*Math.cos(a),y,r*Math.sin(a)]);
});
export const coreRings=[
  {radius:.280,tilt:.46,azimuth:.26,offset:.023},
  {radius:.280,tilt:-.48,azimuth:1.24,offset:-.023},
  {radius:.234,tilt:.08,azimuth:0,offset:0},
];
export function coreAt(phase){
  const angle=TAU*(((phase%1)+1)%1);
  const layers=coreLayers.map(([y,r])=>gemRing(y,r,angle));
  const panels=[];
  for(let l=0;l<layers.length-1;l++)for(let i=0;i<facets;i++){
    const j=(i+1)%facets;
    panels.push({verts:[layers[l][i],layers[l][j],layers[l+1][j],layers[l+1][i]],shade:(l===1?.76:1)*(1-(i%3)*.10)});
  }
  panels.push({verts:layers[0].slice().reverse(),shade:.62},{verts:layers.at(-1),shade:1.0});
  return panels;
}

export function coreRingPoint(ring,angle){
  const {radius,tilt,azimuth,offset}=ring,c=Math.cos(azimuth),s=Math.sin(azimuth);
  const x=radius*Math.cos(angle),z=radius*Math.sin(angle);
  const zTilt=z*Math.cos(tilt),y=offset-z*Math.sin(tilt);
  return add(SOURCE,[x*c+zTilt*s,y,-x*s+zTilt*c]);
}
