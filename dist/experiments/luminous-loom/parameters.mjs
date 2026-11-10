import {defaults,limits,normalize} from './core.mjs';
import {normalizeTracks,resolveParameters,parseTracks,serializeTracks} from '../../shared/parameter-tracks.mjs';
// Density is discrete and reallocates the angular/coordinate workspace. It is
// intentionally not animated. The loop duration must not animate its own clock.
export const parameterSpecs=Object.freeze([
 ['spread','Ribbon spread'],['width','Stroke at 1080p'],['opacity','Opacity'],['zoom','Magnification'],
 ['fibers','Fibers'],['samples','Samples / fiber'],['duration','Loop · seconds'],
]);
export const trackDefinitions=Object.freeze(Object.fromEntries(['spread','width','opacity','zoom'].map(key=>[key,Object.freeze({min:limits[key][0],max:limits[key][1],step:limits[key][2],defaultValue:defaults[key]})])));
export function readScene(query){return {settings:normalize(Object.fromEntries(query)),tracks:parseTracks(query.get('tracks'),trackDefinitions)};}
export function resolveScene(settings,tracks,phase){return resolveParameters(settings,tracks,phase,trackDefinitions);}
export function snapshotScene(settings,tracks){return {settings:normalize(settings),tracks:normalizeTracks(tracks,trackDefinitions)};}
export function writeSceneQuery(settings,tracks,phase){
 const query=new URLSearchParams();for(const [key,value] of Object.entries(normalize(settings)))query.set(key,value);
 const encoded=serializeTracks(tracks,trackDefinitions);if(Object.keys(normalizeTracks(tracks,trackDefinitions)).length)query.set('tracks',encoded);
 query.set('phase',Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0)).toFixed(6));return query;
}
