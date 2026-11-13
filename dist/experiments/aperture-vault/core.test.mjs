import assert from 'node:assert/strict';
import test from 'node:test';
import {PANEL_COUNT, bounceWeight, floorShadow, defaults, defaultTracks, definitions, hingeAngle, poseAt, readState} from './core.mjs';
import {serializeTracks} from '../../shared/parameter-tracks.mjs';

test('opening moves smoothly from closed to open and returns at the seam',()=>{
  assert.equal(poseAt(defaults,defaultTracks,0).opening,0);
  assert.equal(poseAt(defaults,defaultTracks,.5).opening,1);
  assert.deepEqual(poseAt(defaults,defaultTracks,0),poseAt(defaults,defaultTracks,1));
  for(let i=0;i<PANEL_COUNT;i++){
    assert.equal(hingeAngle(i,.55,.25,0),hingeAngle(i,.55,.25,1));
    for(let step=0;step<=360;step++){
      const phase=step/360;
      const a=hingeAngle(i,poseAt(defaults,defaultTracks,phase).opening,.38,phase);
      assert.ok(a>=-.24 && a<=1.11);
    }
  }
});
test('static settings and lighting are validated and tracks round-trip',()=>{
  const params=new URLSearchParams({rotation:'270',elevation:'',duration:'2',lighting:'direct',tracks:serializeTracks(defaultTracks,definitions)});
  const {settings,tracks}=readState(params);
  assert.equal(settings.rotation,180);
  assert.equal(settings.elevation,26);
  assert.equal(settings.duration,4);
  assert.equal(settings.lighting,'direct');
  assert.deepEqual(tracks,defaultTracks);
  assert.deepEqual(readState(new URLSearchParams({tracks:'{}'})).tracks,{});
});
test('diffuse bounce proxy weakens with distance and is zero for back-facing panels',()=>{
  assert.equal(bounceWeight(-.1,1),0);
  assert.equal(bounceWeight(.5,2),.25);
  assert.equal(bounceWeight(1,8),.125);
});
test('floor projection follows point-light rays and clips the horizon',()=>{
  const lamp=[0,2,0];
  assert.deepEqual(floorShadow([[1,1,0],[1,1,1],[2,1,0]],lamp),[[2,0,0],[2,0,2],[4,0,0]]);
  assert.deepEqual(floorShadow([[1,3,0],[1,3,1],[2,3,0]],lamp),[]);
  const partiallyAbove=floorShadow([[1,1,0],[1,1,1],[2,3,0]],lamp);
  assert.equal(partiallyAbove.length,4);
  assert.ok(partiallyAbove.every(p=>p[1]===0&&p.every(Number.isFinite)));
});
