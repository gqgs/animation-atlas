import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSurface,topology,surfaceDistance} from './surface.mjs';
test('production sculpture is one closed genus-2 manifold',()=>{const mesh=buildSurface(),report=topology(mesh);assert.equal(report.components,1);assert.equal(report.boundaryEdges,0);assert.equal(report.inconsistentEdges,0);assert.equal(report.nonmanifoldEdges,0);assert.equal(report.euler,-2);assert.equal(report.genus,2);assert.ok(mesh.positions.every(Number.isFinite));assert.ok(mesh.normals.every(Number.isFinite));for(let i=0;i<mesh.positions.length;i+=3)assert.ok(Math.abs(surfaceDistance(...mesh.positions.subarray(i,i+3)))<.003);});
test('coarser extraction preserves the two handles',()=>{const t=topology(buildSurface({nx:48,ny:40,nz:32}));assert.equal(t.components,1);assert.equal(t.nonmanifoldEdges,0);assert.equal(t.euler,-2);});
