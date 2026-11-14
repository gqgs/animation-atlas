import test from 'node:test';
import assert from 'node:assert/strict';
import {accuracySweep} from './common.mjs';
test('optimized paths, bounds, polygons and wedge clips match frozen baseline',()=>{const r=accuracySweep();assert.ok(r.pass,JSON.stringify(r));});
