import assert from 'node:assert/strict';
import test from 'node:test';
import { carrier, definitions, foldFrame, seedParameters, weavePigment } from './field.mjs';
import { carrier as originalCarrier, foldFrame as originalFrame, seedParameters as originalSeed } from '../sine-tapestry/field.mjs';
import { normalizeTracks, parseTracks, resolveParameters, serializeTracks } from '../../shared/parameter-tracks.mjs';
import { discoverSeeds } from './discovery.mjs';

const seed = 814066662;
const points = [[-.78, -.5], [0, 0], [.31, .6], [-.28, .44], [.75, -.6]];

test('drift zero reproduces the original field at matched framing', () => {
  for (const phase of [0, .08679, .34, .68, 1]) {
    const a = foldFrame(seedParameters(seed), phase, { drift: 0 });
    const b = originalFrame(originalSeed(seed), phase);
    for (const [x, y] of points) assert.ok(Math.abs(carrier(x, y, a) - originalCarrier(x, y, b)) < 1e-12);
  }
});

test('the published composition changes at nonzero drift', () => {
  const p = seedParameters(seed);
  const phase = .08679;
  const a = foldFrame(p, phase, { drift: 0 });
  const b = foldFrame(p, phase);
  const differences = points.map(([x, y]) => Math.abs(carrier(x, y, a) - carrier(x, y, b)));
  assert.ok(differences.some(x => x > .5));
});

test('cyclic settings round-trip and render exactly the same at phase 0 and 1', () => {
  const p = seedParameters(seed);
  const settings = { drift: .7, zoom: 1, rotation: 0 };
  const tracks = normalizeTracks({
    drift: { enabled: true, min: .7, max: 1.2, easing: 'sine' },
    rotation: { enabled: true, min: -30, max: 20, easing: 'sine' },
    zoom: { enabled: true, min: .9, max: 1.33, easing: 'smoothstep' },
  }, definitions);
  const reread = parseTracks(serializeTracks(tracks, definitions), definitions);
  assert.deepEqual(reread, tracks);
  const frame = phase => foldFrame(p, phase, resolveParameters(settings, reread, phase, definitions));
  const start = frame(0);
  assert.deepEqual(start, frame(1));
  assert.deepEqual(frame(.253), frame(.253));
  const peak = frame(.5), finish = frame(1 - 1e-7);
  assert.notDeepEqual(start, peak);
  for (const [x, y] of points) assert.ok(Math.abs(carrier(x, y, start) - carrier(x, y, finish)) < .0001);
});

test('seed ranking is deterministic and uses the chosen drift', () => {
  const original = discoverSeeds(2718, 24, 4, { drift: 0 });
  const drifted = discoverSeeds(2718, 24, 4, { drift: 1.4 });
  assert.ok(drifted.length > 0);
  assert.deepEqual(drifted, discoverSeeds(2718, 24, 4, { drift: 1.4 }));
  assert.notDeepEqual(drifted, original);
  assert.equal(new Set(drifted.map(x => x.seed)).size, drifted.length);
});

test('color is seeded, periodic, and decoupled from ribbon geometry', () => {
  const ink = weavePigment(seed);
  assert.deepEqual(ink, weavePigment(seed));
  assert.notDeepEqual(ink, weavePigment(seed + 1));
  assert.ok(new Set(ink.filter((_, i) => i % 4 !== 3)).size > 100);
  for (let ch = 0; ch < 3; ch++) assert.ok(Math.abs(ink[ch] - ink[ink.length - 4 + ch]) < 8);
  const shape = seedParameters(seed);
  assert.deepEqual(foldFrame(shape, .34, { pigment: 0 }), foldFrame(shape, .34, { pigment: 1.5 }));
});

test('render style is opt-in, and switching reuses the seeded texture', async () => {
  const { createRenderer, normalizeStyle } = await import('./renderer.mjs');
  const { fragmentShader, vertexShader } = await import('./shader.mjs');
  const { gouacheShader } = await import('./gouache.mjs');
  assert.equal(normalizeStyle(null), 'original');
  assert.equal(normalizeStyle('unknown'), 'original');
  assert.equal(normalizeStyle('gouache'), 'gouache');

  const shaders = [], draws = [], removed = [];
  let textureUploads = 0, activeProgram;
  const gl = {
    drawingBufferWidth: 640, drawingBufferHeight: 640,
    createShader() { return {}; },
    shaderSource(shader, source) { shader.source = source; shaders.push(source); },
    compileShader() {}, getShaderParameter: () => true,
    createProgram() { return {}; },
    attachShader(program, shader) { program.fragment = shader.source; },
    linkProgram() {}, getProgramParameter: () => true,
    deleteShader() {}, deleteProgram(program) { removed.push(program.fragment); },
    getUniformLocation() {}, createVertexArray() {}, bindVertexArray() {},
    activeTexture() {}, createTexture() {}, bindTexture() {}, texParameteri() {},
    MAX_VIEWPORT_DIMS: 1, MAX_RENDERBUFFER_SIZE: 2,
    getParameter(key) { return key === 1 ? [4096, 4096] : 4096; },
    isContextLost: () => false,
    useProgram(program) { activeProgram = program; },
    texImage2D() { textureUploads++; }, generateMipmap() {},
    viewport() {}, uniform2f() {}, uniform4fv() {}, uniform1f() {}, uniform1i() {},
    drawArrays() { draws.push(activeProgram.fragment); },
    deleteTexture() {}, deleteVertexArray() {}, getExtension: () => null,
  };
  const renderer = createRenderer({ width: 640, height: 640, getContext: () => gl });
  const frame = { size: 640, seed, phase: .34, parameters: seedParameters(seed), pose: { pigment: 1 } };
  renderer.draw(frame);
  renderer.draw({ ...frame, style: 'gouache' });
  renderer.draw({ ...frame, style: 'original' });
  assert.deepEqual(shaders, [vertexShader, fragmentShader, vertexShader, gouacheShader]);
  assert.deepEqual(draws, [fragmentShader, gouacheShader, fragmentShader]);
  assert.equal(textureUploads, 1);
  renderer.dispose();
  assert.deepEqual(removed, [fragmentShader, gouacheShader]);
});
