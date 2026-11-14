import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTracks, parseTracks, resolveParameters, serializeTracks } from '../../shared/parameter-tracks.mjs';
import { DEFAULT_SEED, definitions, frameUniforms, makeOrientationFollower, seedParameters, wrapPhase } from './field.mjs';

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

test('weighted lobes carry through both turns, lagging the inner bands', () => {
  const follow = makeOrientationFollower({ enabled: true, min: -16, max: 16, easing: 'sine' });
  const plus = follow(.5001), minus = follow(.4999), turn = follow(.5);
  assert.ok(plus[1] > minus[1], 'outer still moving forward at the upper command turn');
  assert.ok(follow(.0001)[1] < follow(.9999)[1], 'outer still moving back at the lower turn');
  assert.ok(turn[1] < turn[0] && turn[0] < 16, 'outer lags the middle, which lags the command');
  assert.ok(follow(.59)[1] > 16, 'lightly damped outer band overshoots');
  assert.deepEqual(follow(0), follow(1));
});

test('orientation export snapshot and URL replay are independent of seek order', () => {
  const tracks = normalizeTracks({
    rotation: { enabled: true, min: -21, max: 18, easing: 'linear' },
    pulse: { enabled: true, min: .3, max: 1.2, easing: 'smoothstep' },
  }, definitions);
  const fromUrl = parseTracks(serializeTracks(tracks, definitions), definitions);
  const sample = source => {
    const follow = makeOrientationFollower(source.rotation);
    return phase => frameUniforms(seedParameters(DEFAULT_SEED), phase,
      resolveParameters(fixed, source, phase, definitions), 11, follow);
  };
  const preview = sample(tracks), encoded = sample(fromUrl);
  assert.deepEqual(preview(1), encoded(0));
  for (const phase of [.501, .98, .125, .501, .31, 0]) {
    assert.deepEqual(preview(phase), encoded(phase));
  }
  const eps = 1e-6;
  const follow = makeOrientationFollower(fromUrl.rotation);
  for (const [before, seam, after] of [[1-eps, 1, eps], [.5-eps, .5, .5+eps]]) {
    for (let i = 0; i < 2; i++) {
      assert.ok(Math.abs((follow(after)[i] - follow(seam)[i]) -
        (follow(seam)[i] - follow(before)[i])) < 1e-6);
    }
  }
});

test('fixed orientation is rigid and does not use an inertial follower', () => {
  assert.equal(makeOrientationFollower(undefined), null);
  assert.equal(makeOrientationFollower({ enabled: true, min: 18, max: 18 }), null);
  const frame = frameUniforms(seedParameters(DEFAULT_SEED), .37, { ...fixed, rotation: 12 }, 9);
  assert.deepEqual(frame.motion.slice(0,2), [frame.camera[1], frame.camera[1]]);
});
