import {normalizeTracks, parseTracks, resolveParameters} from '../../shared/parameter-tracks.mjs';

export const PANEL_COUNT = 8;
export const TAU = 2 * Math.PI;
export const definitions = {
  opening: {min:0,max:1,step:.01,defaultValue:.55},
  cascade: {min:0,max:.38,step:.01,defaultValue:.24},
  zoom: {min:.65,max:1.45,step:.01,defaultValue:1},
  rotation: {min:-180,max:180,step:1,defaultValue:0},
  elevation: {min:15,max:68,step:1,defaultValue:26},
};
export const defaults = {opening:.55,cascade:.24,zoom:1,rotation:0,elevation:26,duration:10,lighting:'bounce'};
export const defaultTracks = normalizeTracks({opening:{min:0,max:1,easing:'sine'}},definitions);
export const poseAt = (settings,tracks,phase) => resolveParameters(settings,tracks,phase,definitions);

export function readState(params) {
  const settings = {...defaults};
  for(const [key,{min,max}] of Object.entries({...definitions,duration:{min:4,max:90}})) {
    const n = Number(params.get(key));
    if(params.has(key) && params.get(key).trim() && Number.isFinite(n)) settings[key] = Math.min(max,Math.max(min,n));
  }
  if(params.get('lighting') === 'direct') settings.lighting = 'direct';
  return {settings,tracks:params.has('tracks') ? parseTracks(params.get('tracks'),definitions) : structuredClone(defaultTracks)};
}

const clamp = x => Math.min(1,Math.max(0,x));
const wrap = x => ((x%1)+1)%1;
export function hingeAngle(index,opening,cascade,phase) {
  const envelope = 4*opening*(1-opening);
  const wave = Math.sin(TAU*(index/PANEL_COUNT - wrap(phase)));
  return -.24 + 1.35*clamp(opening + cascade*envelope*wave);
}

// The point sources model diffuse reflection from inner petal faces. A face's
// receiving angle and the core-to-face distance determine its contribution.
export function bounceWeight(normalDot, distanceSquared) {
  return Math.max(0,normalDot) / Math.max(.25,distanceSquared);
}

export const HINGE_RADIUS = 1.23;
export const HINGE_HEIGHT = .48;
export const CORE_Y = 1.21;
export const OUTLINE = [[-.455,0],[.455,0],[.505,.28],[.367,1.03],[.185,1.48],[0,1.63],[-.185,1.48],[-.367,1.03],[-.505,.28]];

// Project a polygon's points below a point light onto a horizontal receiver.
// Clip against the light horizon first; otherwise the shadow would flip.
export function floorShadow(points,light,receiver=0) {
  const horizon = light[1]-.08;
  const clipped = [];
  let a = points.at(-1);
  for(const b of points) {
    if((a[1]<horizon)!==(b[1]<horizon)) {
      const u = (horizon-a[1])/(b[1]-a[1]);
      clipped.push([a[0]+u*(b[0]-a[0]),horizon,a[2]+u*(b[2]-a[2])]);
    }
    if(b[1]<horizon) clipped.push(b);
    a=b;
  }
  return clipped.map(p=>{
    const t = (light[1]-receiver)/(light[1]-p[1]);
    return [light[0]+(p[0]-light[0])*t,receiver,light[2]+(p[2]-light[2])*t];
  });
}
