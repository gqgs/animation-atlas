import test from 'node:test';
import assert from 'node:assert/strict';
import {facesAt,waveAt,defaults,defaultTracks,poseAt,readState,definitions} from './core.mjs';
import {serializeTracks,normalizeTracks} from '../../shared/parameter-tracks.mjs';
const points=t=>facesAt(defaults,t).flatMap(f=>f.vertices.flat());
test('deterministic position and velocity seam, with visibly moving geometry',()=>{
 const a=points(0),b=points(1),mid=points(.25),eps=1e-5,l=points(1-eps),r=points(eps);
 assert.deepEqual(a,b);assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-mid[i])))>.5);
 assert.ok(Math.max(...a.map((v,i)=>Math.abs((v-l[i])/eps-(r[i]-v)/eps)))<.01);
 assert.deepEqual(points(.37),points(.37));
});
test('wave travels one saddle per eighth cycle; zero amplitude freezes geometry',()=>{
 for(let i=0;i<8;i++)assert.ok(Math.abs(waveAt(.17,i)-waveAt(.295,(i+1)%8))<1e-12);
 assert.deepEqual(facesAt({...defaults,amplitude:0},0),facesAt({...defaults,amplitude:0},0));
 const xyz=t=>facesAt({...defaults,amplitude:0},t).map(f=>f.vertices);
 assert.deepEqual(xyz(0),xyz(.25));
});
test('finite geometry across control extremes and phases',()=>{
 for(const fold of [.3,1.2])for(const amplitude of [0,1])for(const phase of [0,.125,.25,.5,.875,1]){
 const faces=facesAt({...defaults,fold,amplitude},phase);assert.equal(faces.length,4480);
 for(const f of faces)for(const v of f.vertices)assert.ok(v.every(Number.isFinite));
 }
});
test('shared cycles, static fallback and URL round trip',()=>{
 const tracks=normalizeTracks({zoom:{enabled:true,min:.6,max:1.2,easing:'sine'},rotation:{enabled:true,min:-30,max:30,easing:'smootherstep'}},definitions);
 assert.deepEqual(poseAt(defaults,tracks,0),poseAt(defaults,tracks,1));
 assert.deepEqual(poseAt(defaults,defaultTracks,.25),defaults);
 const state=readState(new URLSearchParams({amplitude:'.4',tracks:serializeTracks(tracks,definitions)}));
 assert.equal(state.settings.amplitude,.4);assert.deepEqual(state.tracks,tracks);
 assert.equal(readState(new URLSearchParams({fold:'99'})).settings.fold,1.2);
});
