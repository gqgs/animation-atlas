import test from 'node:test';
import assert from 'node:assert/strict';
import {facesAt,defaults,defaultTracks,poseAt,readState,definitions} from './core.mjs';
import {serializeTracks} from '../../shared/parameter-tracks.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('hinges fixed, all face edges rigid throughout bloom at all height limits',()=>{
 for(const height of [.5,1.65,2.5]){
 const closed=facesAt(0,height);
 for(let step=0;step<=100;step++){
 const faces=facesAt(step/100,height);
 assert.equal(faces.length,7);
 for(let j=1;j<7;j++){
 assert.deepEqual(faces[j].vertices.slice(0,2),closed[j].vertices.slice(0,2));
 for(let i=0;i<3;i++)assert.ok(Math.abs(distance(faces[j].vertices[i],faces[j].vertices[(i+1)%3])-distance(closed[j].vertices[i],closed[j].vertices[(i+1)%3]))<1e-10);
 // Nonnegative radial apex: every petal stays in its own 60-degree sector.
 const apex=faces[j].vertices[2],theta=(j-.5)*Math.PI/3;
 assert.ok(apex[0]*Math.cos(theta)+apex[2]*Math.sin(theta)>-1e-10);
 assert.ok(apex[1]>=-1e-10);
 }
 }
 }
});
test('closed apex and planar open net',()=>{
 for(const f of facesAt(0).slice(1)){assert.ok(distance(f.vertices[2],[0,1.65,0])<1e-10);}
 for(const f of facesAt(1))for(const v of f.vertices)assert.equal(v[1],0);
});
test('loop endpoints, static fallback and URL track round trip',()=>{
 assert.deepEqual(poseAt(defaults,defaultTracks,0),poseAt(defaults,defaultTracks,1));
 assert.equal(poseAt(defaults,defaultTracks,.5).opening,1);
 assert.deepEqual(poseAt(defaults,{},.25),defaults);
 const p=new URLSearchParams({zoom:'1.2',tracks:serializeTracks(defaultTracks,definitions)});
 const state=readState(p);assert.equal(state.settings.zoom,1.2);assert.deepEqual(state.tracks,defaultTracks);
 assert.deepEqual(readState(new URLSearchParams({tracks:'{"v":1,"t":{}}'})).tracks,{});
});
