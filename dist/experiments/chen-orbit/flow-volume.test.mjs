import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDensity,buildFlowVolume} from './flow-volume.mjs';
import {topology} from './surface.mjs';
test('density skin follows the actual 3D samples and carries finite measured speed',()=>{const m=buildFlowVolume(),t=topology(m);assert.equal(t.components,1);assert.equal(t.boundaryEdges,0);assert.equal(t.inconsistentEdges,0);assert.equal(t.nonmanifoldEdges,0);assert.equal(t.euler,-2);assert.ok(m.positions.every(Number.isFinite));assert.ok(m.normals.every(Number.isFinite));assert.ok(m.speeds.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.equal(m.speeds.length,m.positions.length/3);assert.equal(m.texture.length,113*81*49);assert.equal(m.density.sample(10,0,0),0);});
test('cyclic forcing produces a different connected closed density mesh, without prescribing genus',()=>{const fixed=buildFlowVolume(),forced=buildFlowVolume({amplitude:3}),t=topology(forced);assert.equal(t.components,1);assert.equal(t.boundaryEdges,0);assert.equal(t.inconsistentEdges,0);assert.equal(t.nonmanifoldEdges,0);assert.notDeepEqual(forced.positions,fixed.positions);assert.ok(forced.speeds.every(Number.isFinite));});
