#!/usr/bin/env node
// Rebuild the normalized continuous-plane approximation using only Node built-ins.
// Run: node dist/experiments/chen-orbit/tools/precompute-sweep.mjs
import {writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildAttractor} from '../core.mjs';
import {sweptBounds, buildSweepDensity, relativeL1, encodeLogDensity} from './sweep-density.mjs';

const args = process.argv.slice(2), options = {size: 160, angles: 512};
for (let i = 0; i < args.length; i += 2) {
  if (!['--size', '--angles'].includes(args[i]) || args[i + 1] === undefined) throw new Error('Usage: precompute-sweep.mjs [--size 32..256] [--angles 64..4096]');
  options[args[i].slice(2)] = Number(args[i + 1]);
}
if (!Number.isInteger(options.size) || options.size < 32 || options.size > 256 || !Number.isInteger(options.angles) || options.angles < 64 || options.angles > 4096 || options.angles % 4) {
  throw new RangeError('Size must be 32–256; angles must be 64–4096 and divisible by four');
}
const model = buildAttractor(), bounds = sweptBounds(model, .04), fields = new Map();
for (const angles of [options.angles / 2, options.angles, options.angles * 2]) {
  const start = performance.now();
  fields.set(angles, buildSweepDensity(model, {...options, angles, bounds}));
  console.error(`${options.size}³, ${angles} angles: ${((performance.now() - start) / 1000).toFixed(2)} s`);
}
const field = fields.get(options.angles), reference = fields.get(options.angles * 2);
const {encoded, ...encoding} = encodeLogDensity(field.density), compressed = gzipSync(encoded, {level: 9});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const metadata = {
  size: options.size, angles: options.angles, samples: model.count,
  channels: 2, encoding: 'log-unorm16-le',
  boundsMin: bounds.min, boundsMax: bounds.max,
  sigmaVoxels: Math.SQRT1_2, voxelSpacing: field.spacing,
  referenceDensity: encoding.referenceDensity, logMax: encoding.logMax,
  convention: 'x fastest, then display y (original z), then display z',
  normalization: 'angular average and unit trajectory mass per world volume',
  mass: field.mass,
  quantizationRelativeL1: encoding.quantizationRelativeL1,
  convergence: [options.angles / 2, options.angles].map(angles => ({angles, relativeL1: relativeL1(fields.get(angles).density, reference.density)})),
  sourceSha256: sha256(Buffer.from(model.data.buffer, model.data.byteOffset, model.data.byteLength)),
  dataSha256: sha256(encoded),
  version: 1,
  deposition: 'Float32 trilinear splat; exact swept-circle bounds with 0.04 world-unit margin',
  filter: 'one separable [1, 2, 1] / 4 binomial pass on each axis',
  gridConvention: 'sample nodes span bounds inclusively; voxel spacing is extent / (size - 1)',
  convergenceReferenceAngles: options.angles * 2,
  convergenceScope: 'angular quadrature only, at fixed trajectory, grid, bounds, and smoothing; before 16-bit quantization',
  accumulationRelativeError: field.accumulationRelativeError,
  filteredMassBeforeRenormalization: field.retainedMass,
  quantizedMass: field.mass * encoding.quantizedMassRatio,
  compressedBytes: compressed.length,
};
await writeFile(new URL('../sweep-density.u16.gz', import.meta.url), compressed);
await writeFile(new URL('../sweep-density.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
await rm(new URL('../sweep-density.u8.gz', import.meta.url), {force: true});
console.log(JSON.stringify(metadata, null, 2));
