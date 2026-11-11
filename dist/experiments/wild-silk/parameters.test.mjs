import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readTracks,defaultTracks,cameraAt,trackDefinitions} from './parameters.mjs';
import {serializeTracks} from '../../shared/parameter-tracks.mjs';
test('new visits animate; old URLs preserve the static camera',()=>{
 assert.deepEqual(readTracks(new URLSearchParams()),defaultTracks);
 assert.deepEqual(readTracks(new URLSearchParams('seed=legacy&phase=.25')),{});
});
test('camera seeks close exactly and leave static settings untouched',()=>{
 const settings=Object.freeze({zoom:.8,rotation:0,motion:.6});
 const lower=cameraAt(settings,defaultTracks,0),upper=cameraAt(settings,defaultTracks,.5);
 assert.equal(lower.zoom,.65);assert.equal(lower.rotation,-18);
 assert.equal(upper.zoom,1.05);assert.equal(upper.rotation,18);
 assert.deepEqual(cameraAt(settings,defaultTracks,1),lower);
 assert.deepEqual(cameraAt(settings,{},.5),settings);
 assert.deepEqual(cameraAt(settings,defaultTracks,.25),cameraAt(settings,defaultTracks,.75));
});
test('camera tracks round trip in URLs and exclude structural parameters',()=>{
 const q=new URLSearchParams({tracks:serializeTracks({...defaultTracks,duration:{min:8,max:90}},trackDefinitions)});
 assert.deepEqual(readTracks(q),defaultTracks);
 assert.deepEqual(readTracks(new URLSearchParams('tracks=invalid')),{});
});
