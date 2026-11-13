import test from 'node:test';import assert from 'node:assert/strict';
import {panelsAt,poseAt,defaults,defaultTracks,readState,definitions} from './core.mjs';
import {serializeTracks} from '../../shared/parameter-tracks.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const points=phase=>{const p=poseAt(defaults,defaultTracks,phase);return panelsAt(p.closure,p.cascade).flatMap(f=>f.vertices.flat());};
test('all panel pairwise distances stay rigid and neighboring hinge edges coincide',()=>{
 const reference=panelsAt(0);
 for(const cascade of [0,.65,1])for(let step=0;step<=200;step++){
  const panels=panelsAt(step/200,cascade);
  for(let i=0;i<panels.length;i++){
   for(let j=0;j<5;j++)for(let k=0;k<5;k++)assert.ok(Math.abs(distance(panels[i].vertices[j],panels[i].vertices[k])-distance(reference[i].vertices[j],reference[i].vertices[k]))<1e-12);
   if(i<panels.length-1)for(let j=0;j<2;j++)assert.ok(distance(panels[i].right[j],panels[i+1].left[j])<1e-12);
  }
 }
});
test('distinct endpoints: straight strip and closed decagonal perimeter',()=>{
 const open=panelsAt(0),closed=panelsAt(1);
 assert.ok(distance(open[0].left[0],open[9].right[0])>9.99);
 assert.ok(distance(closed[0].left[0],closed[9].right[0])<1e-12);
 for(const p of open)for(const v of p.vertices)assert.equal(v[2],0);
});
test('sampled zero-thickness panel interiors do not cross in the ground plane',()=>{
 const orient=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
 for(const cascade of [0,.25,.5,.75,1])for(let step=0;step<=500;step++){
  const panels=panelsAt(step/500,cascade);
  for(let i=0;i<10;i++)for(let j=i+2;j<10;j++){
   const [a,b,c,d]=[panels[i].left[0],panels[i].right[0],panels[j].left[0],panels[j].right[0]];
   assert.ok(!(orient(a,b,c)*orient(a,b,d)<-1e-12&&orient(c,d,a)*orient(c,d,b)<-1e-12));
  }
 }
});
test('deterministic seam positions and velocities; static and scene URL roundtrip',()=>{
 const a=points(0),b=points(1),l=points(1-1e-5),r=points(1e-5);
 assert.deepEqual(a,b);assert.ok(Math.max(...a.map((v,i)=>Math.abs((v-l[i])/1e-5-(r[i]-v)/1e-5)))<1e-6);
 assert.notDeepEqual(points(0),points(.5));assert.deepEqual(poseAt(defaults,{},.37),defaults);
 const state=readState(new URLSearchParams({cascade:'.4',tracks:serializeTracks(defaultTracks,definitions)}));assert.equal(state.settings.cascade,.4);assert.deepEqual(state.tracks,defaultTracks);
});
