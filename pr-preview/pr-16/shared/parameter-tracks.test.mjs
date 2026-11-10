import test from 'node:test';
import assert from 'node:assert/strict';
import { EASINGS, normalizeTracks, resolveParameters, serializeTracks, parseTracks } from './parameter-tracks.mjs';

const definitions = Object.freeze({ speed: Object.freeze({ min: -10, max: 20, step: 1, defaultValue: 5 }) });
const track = easing => ({ speed: { enabled: true, min: 2, max: 12, easing } });
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

for (const easing of Object.keys(EASINGS)) {
  test(`${easing}: endpoints, negative phases, loops, symmetry and bounds`, () => {
    const sample = phase => resolveParameters({ speed: 9 }, track(easing), phase, definitions).speed;
    for (const loop of [-10, -2, -1, 0, 1, 4, 100]) {
      assert.equal(sample(loop), 2);
      assert.equal(sample(loop + 0.5), 12);
      assert.equal(sample(loop + 1), 2);
      close(sample(loop + 0.25), 7);
      close(sample(loop + 0.75), 7);
    }
    for (let i = 0; i <= 100; i++) {
      const phase = i / 100;
      close(sample(phase), sample(1 - phase));
      assert.ok(sample(phase) >= 2 && sample(phase) <= 12);
    }
    close(sample(-0.125), sample(0.875));
    close(sample(0.125), 2 + 10 * EASINGS[easing](0.25));
  });
}

test('smooth easings have flat turnarounds; linear intentionally has a cusp', () => {
  assert.ok(Object.isFrozen(EASINGS));
  const epsilon = 1e-6;
  for (const name of ['sine', 'smoothstep', 'smootherstep']) {
    assert.ok(Math.abs(EASINGS[name](epsilon) / epsilon) < 1e-4);
    assert.ok(Math.abs((1 - EASINGS[name](1 - epsilon)) / epsilon) < 1e-4);
  }
  assert.equal(EASINGS.linear(epsilon) / epsilon, 1);
});

test('no tracks and disabled tracks preserve static values exactly', () => {
  const values = { speed: 1000, other: 'unchanged' };
  for (const tracks of [undefined, null, [], {}, { speed: { enabled: false, min: 2, max: 12 } }]) {
    const result = resolveParameters(values, tracks, 0.5, definitions);
    assert.deepEqual(result, values);
    assert.notEqual(result, values);
  }
  assert.deepEqual(resolveParameters({}, {}, 0, definitions), {});
});

test('normalization clamps, sorts and defaults missing bounds/easing', () => {
  assert.deepEqual(normalizeTracks({ speed: { min: 50, max: -50, easing: 'unknown' } }, definitions), {
    speed: { enabled: true, min: -10, max: 20, easing: 'linear' },
  });
  assert.deepEqual(normalizeTracks({ speed: {} }, definitions), {
    speed: { enabled: true, min: -10, max: 20, easing: 'linear' },
  });
  assert.deepEqual(normalizeTracks({ speed: { min: 3, max: 3 } }, definitions).speed, {
    enabled: true, min: 3, max: 3, easing: 'linear',
  });
  assert.equal(resolveParameters({}, { speed: { min: 3, max: 3 } }, .321, definitions).speed, 3);
});

test('continuous samples are not quantized to control steps', () => {
  close(resolveParameters({}, track('linear'), .123, definitions).speed, 4.46);
});

test('malformed entries and definitions are ignored', () => {
  for (const value of [NaN, Infinity, -Infinity, '3', null, {}, []]) {
    assert.deepEqual(normalizeTracks({ speed: { min: value, max: 12 } }, definitions), {});
    assert.deepEqual(normalizeTracks({ speed: { min: 2, max: value } }, definitions), {});
    assert.deepEqual(normalizeTracks(track('sine'), { speed: { min: value, max: 20 } }), {});
  }
  for (const value of [null, [], 1, true, 'x']) assert.deepEqual(normalizeTracks({ speed: value }, definitions), {});
  assert.deepEqual(normalizeTracks({ unknown: { min: 1, max: 2 } }, definitions), {});
  assert.deepEqual(normalizeTracks(track('sine'), null), {});
  for (const phase of [NaN, Infinity, -Infinity, undefined, null, '0.5']) {
    assert.deepEqual(resolveParameters({ speed: 9 }, track('sine'), phase, definitions), { speed: 9 });
  }
});

test('finite extreme bounds interpolate without overflow', () => {
  const defs = { speed: { min: -Number.MAX_VALUE, max: Number.MAX_VALUE } };
  assert.equal(resolveParameters({}, { speed: {} }, .25, defs).speed, 0);
});

test('serialization is compact, versioned, stable and round-trips through URLSearchParams', () => {
  const defs = { z: { min: 0, max: 10 }, a: { min: 0, max: 10 } };
  const input = { z: { min: 3, max: 8, easing: 'sine' }, a: { min: 1, max: 9, easing: 'smoothstep' } };
  const serialized = serializeTracks(input, defs);
  assert.equal(serialized, '{"v":1,"t":{"a":[1,9,"smoothstep"],"z":[3,8,"sine"]}}');
  const url = new URL('https://example.com/');
  url.searchParams.set('tracks', serialized);
  const parsed = parseTracks(url.searchParams.get('tracks'), defs);
  assert.deepEqual(parsed, normalizeTracks(input, defs));
  assert.equal(serializeTracks(parsed, defs), serialized);
  assert.equal(serializeTracks({}, defs), '');
});

test('malformed, unsupported and oversized serialized inputs fail safely', () => {
  for (const value of [undefined, null, 12, '', '{', 'null', '[]', '{}', '{"v":2,"t":{}}', 'x'.repeat(16385)]) {
    assert.deepEqual(parseTracks(value, definitions), {});
  }
  for (const tuple of [[1, 2], [1, 2, 'bad'], [null, 2, 'sine'], ['1', 2, 'sine'], [1, 2, 'sine', 3]]) {
    assert.deepEqual(parseTracks(JSON.stringify({ v: 1, t: { speed: tuple } }), definitions), {});
  }
  const name = 'x'.repeat(17000);
  assert.equal(serializeTracks({ [name]: {} }, { [name]: { min: 0, max: 1 } }), '');
});

test('prototype keys and inherited tracks/definitions are excluded', () => {
  const malicious = JSON.parse('{"__proto__":{"min":0,"max":1},"constructor":{"min":0,"max":1},"prototype":{"min":0,"max":1}}');
  assert.deepEqual(normalizeTracks(malicious, malicious), {});
  assert.deepEqual(resolveParameters(malicious, {}, 0, {}), {});
  assert.deepEqual(normalizeTracks(Object.create(track('sine')), definitions), {});
  assert.deepEqual(normalizeTracks(track('sine'), Object.create(definitions)), {});
  assert.deepEqual(parseTracks('{"v":1,"t":{"__proto__":[0,1,"linear"]}}', malicious), {});
  assert.equal({}.enabled, undefined);
});

test('all operations are deterministic and leave frozen inputs unchanged', () => {
  const tracks = Object.freeze({ speed: Object.freeze({ enabled: true, min: 12, max: 2, easing: 'sine' }) });
  const staticValues = Object.freeze({ speed: 9 });
  const before = JSON.stringify({ tracks, definitions, staticValues });
  const first = resolveParameters(staticValues, tracks, .135, definitions);
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(resolveParameters(staticValues, tracks, .135, definitions), first);
    parseTracks(serializeTracks(tracks, definitions), definitions);
  }
  assert.equal(JSON.stringify({ tracks, definitions, staticValues }), before);
  const normalized = normalizeTracks(tracks, definitions);
  assert.notEqual(normalized.speed, tracks.speed);
});
