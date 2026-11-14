import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTracks, resolveParameters } from '../../shared/parameter-tracks.mjs';
import { DEFAULT_SEED, definitions, frameUniforms, seedParameters, wrapPhase } from './field.mjs';

const fixed = Object.fromEntries(Object.entries(definitions).map(([key, d]) => [key, d.defaultValue]));
test('seed variants are stable, bounded and distinct', () => {
  const seed = seedParameters(DEFAULT_SEED);
  assert.deepEqual(seed, seedParameters(DEFAULT_SEED));
  assert.notDeepEqual(seed, seedParameters(DEFAULT_SEED + 1));
  assert.deepEqual(seedParameters(0), seedParameters(2 ** 32));
  for (const x of [...seed, ...seedParameters(2 ** 32 - 1)]) assert.ok(Number.isFinite(x) && x >= 0);
});
test('cyclic view and shader poses match at both endpoints', () => {
  const tracks = normalizeTracks({
    zoom: { enabled: true, min: .83, max: 1.21, easing: 'sine' },
    rotation: { enabled: true, min: -25, max: 18, easing: 'smoothstep' },
    flow: { enabled: true, min: .4, max: 1.1, easing: 'linear' },
  }, definitions);
  const render = phase => frameUniforms(seedParameters(DEFAULT_SEED), phase,
    resolveParameters(fixed, tracks, phase, definitions), 11);
  assert.deepEqual(render(0), render(1));
  assert.notDeepEqual(render(0), render(.5));
  assert.equal(wrapPhase(-.25), .75);
  assert.equal(wrapPhase(8.25), .25);
});
