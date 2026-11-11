import {normalizeTracks,resolveParameters,parseTracks} from '../../shared/parameter-tracks.mjs';
export const trackDefinitions={
  zoom:{min:.5,max:2,step:.01,defaultValue:.8},
  rotation:{min:-180,max:180,step:1,defaultValue:0},
};
export const defaultTracks={
  zoom:{enabled:true,min:.65,max:1.05,easing:'sine'},
  rotation:{enabled:true,min:-18,max:18,easing:'sine'},
};
export function readTracks(params){
  // Old scene URLs retain their original static camera; new visits move by default.
  return params.size===0?normalizeTracks(defaultTracks,trackDefinitions):parseTracks(params.get('tracks'),trackDefinitions);
}
export const cameraAt=(settings,tracks,phase)=>resolveParameters(settings,tracks,phase,trackDefinitions);
