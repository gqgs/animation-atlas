import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {projectPoint} from '../projections.mjs';
import {buildAttractor} from '../core.mjs';
import {sweptPoint, sweptBounds, depositSweep, sumField, binomialFilter, buildSweepDensity, relativeL1, encodeLogDensity} from './sweep-density.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const modelFrom = points => ({count: points.length, data: Float32Array.from(points.flatMap(p => [...p, 0]))});

test('circle identity equals existing orthogonal projections and preserves height', () => {
  for (const p of [[2, 3, -1], [0, -.5, 0], [-.2, .7, .6]]) {
    for (let k = 0; k < 71; k++) {
      const angle = k * Math.PI / 71, q = sweptPoint(p, angle), projected = projectPoint(p, angle);
      q.forEach((v, a) => near(v, projected[a]));
      near(q[1], p[1]);
      near(Math.hypot(q[0] - p[0] / 2, q[2] - p[2] / 2), Math.hypot(p[0], p[2]) / 2);
      sweptPoint(p, angle + Math.PI).forEach((v, a) => near(v, q[a]));
    }
  }
});

test('tight circle bounds contain all angles including excursions beyond source depth', () => {
  const model = modelFrom([[2, .2, 0], [-1, .3, .5]]), bounds = sweptBounds(model);
  near(bounds.max[0], 2.04); near(bounds.max[2], 1.04);
  assert.ok(bounds.min[2] < -1);
  for (let i = 0; i < model.count; i++) for (let k = 0; k < 100; k++) {
    const q = sweptPoint(model.data.subarray(4 * i, 4 * i + 3), k * Math.PI / 100);
    q.forEach((v, a) => assert.ok(v > bounds.min[a] && v < bounds.max[a]));
  }
});

test('trilinear deposition has unit mass, correct first moments, and bounded second-moment error', () => {
  const model = modelFrom([[.6, .1, -.2]]), bounds = {min: [-1, -1, -1], max: [1, 1, 1]}, size = 48;
  const {grid, spacing, accumulationRelativeError} = depositSweep(model, {size, angles: 512, bounds});
  near(sumField(grid), 1, 1e-7); assert.ok(Math.abs(accumulationRelativeError) < 1e-6);
  const first = [0, 0, 0], second = [0, 0, 0]; let mixed = 0;
  for (let i = 0; i < grid.length; i++) {
    const p = [i % size, Math.floor(i / size) % size, Math.floor(i / (size * size))].map((v, a) => bounds.min[a] + v * spacing[a]);
    for (let a = 0; a < 3; a++) { first[a] += p[a] * grid[i]; second[a] += p[a] ** 2 * grid[i]; }
    mixed += p[0] * p[2] * grid[i];
  }
  const [x, y, z] = model.data, expectedFirst = [x / 2, y, z / 2];
  expectedFirst.forEach((v, a) => near(first[a], v, 1e-7));
  const expectedSecond = [(3 * x * x + z * z) / 8, y * y, (x * x + 3 * z * z) / 8];
  expectedSecond.forEach((v, a) => assert.ok(second[a] >= v - 1e-7 && second[a] - v <= spacing[a] ** 2 / 4 + 1e-7));
  near(mixed, x * z / 4, 1e-7);
});

test('binomial filter is symmetric, normalized, and never wraps across rows', () => {
  const size = 7, field = new Float32Array(size ** 3), at = (x, y, z) => x + size * (y + size * z);
  field[at(3, 3, 3)] = 1;
  const filtered = binomialFilter(field, size);
  near(sumField(filtered), 1); near(filtered[at(3, 3, 3)], .125); near(filtered[at(2, 2, 2)], 1 / 64);
  field.fill(0); field[at(0, 3, 3)] = 1;
  const boundary = binomialFilter(field, size);
  near(boundary[at(6, 2, 3)], 0); near(sumField(boundary), .75);
});

test('zero-radius circles remain at the shared axis and filtered density has unit mass', () => {
  const model = modelFrom([[0, .2, 0]]), bounds = {min: [-1, -1, -1], max: [1, 1, 1]};
  const a = buildSweepDensity(model, {size: 16, angles: 64, bounds}), b = buildSweepDensity(model, {size: 16, angles: 128, bounds});
  near(a.mass, 1, 1e-7); assert.ok(relativeL1(a.density, b.density) < 1e-6);
  assert.ok(a.density.every(v => Number.isFinite(v) && v >= 0));
});

test('log encoding uses explicit little-endian 16-bit values and measures error', () => {
  const density = Float32Array.from([0, .00001, .1, .2, 1, 10, 100]), result = encodeLogDensity(density);
  assert.equal(result.encoded.length, 2 * density.length);
  assert.equal(result.encoded[0], 0); assert.equal(result.encoded[1], 0);
  assert.equal(result.encoded.at(-2), 255); assert.equal(result.encoded.at(-1), 255);
  let difference = 0;
  for (let i = 0; i < density.length; i++) {
    const normalized = (result.encoded[2 * i] + 256 * result.encoded[2 * i + 1]) / 65535;
    const decoded = Math.expm1(normalized * result.logMax) * result.referenceDensity;
    difference += Math.abs(decoded - density[i]);
  }
  near(result.quantizationRelativeL1, difference / sumField(density));
  assert.ok(result.quantizationRelativeL1 < .0001);
});

test('invalid dimensions, bounds, samples, and densities fail explicitly', () => {
  const model = modelFrom([[0, 0, 0]]);
  for (const size of [0, 1, 257, 4.5, NaN]) assert.throws(() => depositSweep(model, {size}), RangeError);
  for (const angles of [0, 3, 8193, 4.5, NaN]) assert.throws(() => depositSweep(model, {angles}), RangeError);
  assert.throws(() => sweptBounds(model, 0), RangeError);
  assert.throws(() => sweptBounds(modelFrom([[NaN, 0, 0]])), RangeError);
  assert.throws(() => depositSweep(model, {bounds: {min: [1, 1, 1], max: [2, 2, 2]}}), RangeError);
  assert.throws(() => binomialFilter(new Float32Array(5), 2), RangeError);
  assert.throws(() => relativeL1([1], [0]), RangeError);
  for (const values of [[0], [-1], [Infinity], [NaN]]) assert.throws(() => encodeLogDensity(values), RangeError);
});

test('checked-in density has valid hashes, full trajectory source, mass, encoding, and angular convergence', async () => {
  const metadata = JSON.parse(await readFile(new URL('../sweep-density.json', import.meta.url), 'utf8'));
  const data = gunzipSync(await readFile(new URL('../sweep-density.u16.gz', import.meta.url)));
  assert.equal(metadata.size, 160); assert.equal(metadata.angles, 512); assert.equal(metadata.samples, 180000);
  assert.equal(metadata.channels, 2); assert.equal(metadata.encoding, 'log-unorm16-le');
  assert.equal(data.length, metadata.size ** 3 * metadata.channels);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(data), metadata.dataSha256);
  assert.equal(hash(Buffer.from(buildAttractor().data.buffer)), metadata.sourceSha256);
  near(metadata.mass, 1, 1e-6); assert.ok(metadata.quantizationRelativeL1 < .001);
  assert.equal(metadata.convergenceReferenceAngles, 1024);
  assert.deepEqual(metadata.convergence.map(c => c.angles), [256, 512]);
  assert.ok(metadata.convergence.every(c => c.relativeL1 < .01));
  assert.ok(metadata.convergence[1].relativeL1 < metadata.convergence[0].relativeL1);
});
