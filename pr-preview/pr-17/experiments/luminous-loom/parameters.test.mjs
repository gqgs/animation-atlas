import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,createGeometry,geometryAt} from './core.mjs';
import {trackDefinitions,readScene,resolveScene,snapshotScene,writeSceneQuery} from './parameters.mjs';
import {exportFrames} from '../../shared/frame-export.mjs';
const tracks={spread:{enabled:true,min:.15,max:1.2,easing:'sine'},width:{enabled:true,min:.5,max:1.8,easing:'smoothstep'},opacity:{enabled:true,min:.2,max:.8,easing:'smootherstep'},zoom:{enabled:true,min:.7,max:1.1,easing:'linear'}};
test('scene state round trips tracks, static values and paused phase without mutating inputs',()=>{
 const settings={...defaults,spread:.77},query=writeSceneQuery(settings,tracks,.375),loaded=readScene(query);
 assert.deepEqual(loaded.settings,settings);assert.deepEqual(loaded.tracks,tracks);assert.equal(query.get('phase'),'0.375000');
 const frozen=snapshotScene(settings,tracks);frozen.tracks.spread.min=.9;assert.equal(tracks.spread.min,.15);assert.equal(settings.spread,.77);
 assert.deepEqual(resolveScene(settings,{},.5),settings);
 assert.deepEqual(readScene(new URLSearchParams('tracks=broken')).tracks,{});
});
test('all opted-in controls evaluate together and are unchanged by loop duration',()=>{
 assert.deepEqual(Object.keys(trackDefinitions),['spread','width','opacity','zoom']);
 for(const phase of [0,.125,.5,.75,1]){
  const a=resolveScene({...defaults,duration:4},tracks,phase),b=resolveScene({...defaults,duration:60},tracks,phase);
  for(const key of Object.keys(tracks))assert.equal(a[key],b[key]);
  for(const key of ['fibers','samples','p','q'])assert.equal(a[key],defaults[key]);
 }
 for(const key of Object.keys(tracks)){
  assert.equal(resolveScene(defaults,tracks,0)[key],tracks[key].min);assert.equal(resolveScene(defaults,tracks,.5)[key],tracks[key].max);assert.equal(resolveScene(defaults,tracks,1)[key],tracks[key].min);
 }
 const hostile={fibers:{enabled:true,min:1,max:100000,easing:'linear'},duration:{enabled:true,min:0,max:Infinity}};
 assert.deepEqual(resolveScene(defaults,hostile,.5),defaults);
});
test('spread reuses buffers and matches fresh geometry at arbitrary seek order',()=>{
 const settings={...defaults,fibers:12,samples:128},workspace=createGeometry(settings),storage=[workspace.around,workspace.coordinates,workspace.major,workspace.minor];
 for(const phase of [.7,.2,0,.5,1,.2]){
  const scene=resolveScene(settings,tracks,phase),expected=geometryAt(createGeometry(scene),phase).slice();
  assert.deepEqual(geometryAt(workspace,phase,scene),expected);
  assert.deepEqual([workspace.around,workspace.coordinates,workspace.major,workspace.minor],storage);
  for(let i=0;i<4;i++)assert.strictEqual([workspace.around,workspace.coordinates,workspace.major,workspace.minor][i],storage[i]);
 }
 // Calling the legacy two-argument API restores the static spread.
 assert.deepEqual(geometryAt(workspace,.2),geometryAt(createGeometry(settings),.2));
 assert.equal(workspace.settings.spread,settings.spread);
});
test('deterministic exporter samples tracks from exact phase, not preview state',async()=>{
 const seen=[],settings={...defaults,duration:4},saved=snapshotScene(settings,tracks);
 const recorder={start(){},capture(){},stop(){},save:callback=>callback(new Blob(['test'])),dispose(){}};
 await exportFrames({width:16,height:16,fps:30,duration:settings.duration,canvasFactory:()=>({getContext:()=>({})}),createRecorder:()=>recorder,
  draw:({frame,phase,time})=>seen.push({frame,phase,time,scene:resolveScene(saved.settings,saved.tracks,phase)}),yieldEvery:0});
 assert.equal(seen.length,120);assert.equal(seen[0].phase,0);assert.equal(seen[60].phase,.5);assert.equal(seen[119].phase,119/120);
 assert.equal(seen[0].scene.spread,.15);assert.equal(seen[60].scene.spread,1.2);
 for(const row of seen)assert.deepEqual(row.scene,resolveScene(settings,tracks,row.frame/120));
 assert.deepEqual(saved,snapshotScene(settings,tracks));
});
