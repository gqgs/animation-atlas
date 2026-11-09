// Pure numerical helpers for the offline angular-average density.
// Packed trajectory points have display coordinates [x, y, z, phase].
// Display y is the original Chen z axis; all circles lie in display x/z.

function validateModel(model) {
  if (!Number.isInteger(model?.count) || model.count < 1 || model.data?.length !== 4 * model.count) {
    throw new RangeError('Expected packed [x, y, z, phase] trajectory samples');
  }
}

export function sweptPoint([x, y, z], theta) {
  // Original plane angle theta is rotated by -pi/4 in the display basis.
  const alpha = 2 * theta - Math.PI / 2, c = Math.cos(alpha), s = Math.sin(alpha);
  return [(x + x * c + z * s) / 2, y, (z + x * s - z * c) / 2];
}

export function sweptBounds(model, margin = .04) {
  validateModel(model);
  if (!Number.isFinite(margin) || margin <= 0) throw new RangeError('Margin must be positive');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < model.count; i++) {
    const x = model.data[4 * i], y = model.data[4 * i + 1], z = model.data[4 * i + 2];
    if (![x, y, z].every(Number.isFinite)) throw new RangeError('Trajectory must be finite');
    const r = Math.hypot(x, z);
    const lo = [(x - r) / 2, y, (z - r) / 2], hi = [(x + r) / 2, y, (z + r) / 2];
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], lo[a]); max[a] = Math.max(max[a], hi[a]); }
  }
  return {min: min.map(v => v - margin), max: max.map(v => v + margin)};
}

export function sumField(field) {
  let sum = 0;
  for (const value of field) sum += value;
  return sum;
}

export function voxelSpacing(bounds, size) {
  return bounds.min.map((v, a) => (bounds.max[a] - v) / (size - 1));
}

export function depositSweep(model, {size = 160, angles = 512, bounds = sweptBounds(model)} = {}) {
  validateModel(model);
  if (!Number.isInteger(size) || size < 2 || size > 256) throw new RangeError('Grid size must be 2–256');
  if (!Number.isInteger(angles) || angles < 4 || angles > 8192) throw new RangeError('Angle count must be 4–8192');
  if (bounds.min?.length !== 3 || bounds.max?.length !== 3) throw new RangeError('Expected three-dimensional bounds');
  const spacing = voxelSpacing(bounds, size);
  if (!spacing.every(v => Number.isFinite(v) && v > 0)) throw new RangeError('Bounds must have positive finite extent');
  const scale = spacing.map(v => 1 / v), grid = new Float32Array(size ** 3);
  const cos = new Float64Array(angles), sin = new Float64Array(angles);
  for (let k = 0; k < angles; k++) {
    const alpha = 2 * Math.PI * k / angles - Math.PI / 2;
    cos[k] = Math.cos(alpha); sin[k] = Math.sin(alpha);
  }
  const sy = size, sz = size * size;
  for (let i = 0; i < model.count; i++) {
    const x = model.data[4 * i], y = model.data[4 * i + 1], z = model.data[4 * i + 2];
    const gy = (y - bounds.min[1]) * scale[1], iy = Math.floor(gy), fy = gy - iy, y0 = 1 - fy;
    if (!Number.isFinite(x + y + z) || iy < 0 || iy >= size - 1) throw new RangeError('Sample is outside padded bounds');
    for (let k = 0; k < angles; k++) {
      const gx = ((x + x * cos[k] + z * sin[k]) / 2 - bounds.min[0]) * scale[0];
      const gz = ((z + x * sin[k] - z * cos[k]) / 2 - bounds.min[2]) * scale[2];
      const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, x0 = 1 - fx, z0 = 1 - fz;
      if (ix < 0 || ix >= size - 1 || iz < 0 || iz >= size - 1) throw new RangeError('Circle is outside padded bounds');
      const o = ix + iy * sy + iz * sz;
      grid[o] += x0 * y0 * z0; grid[o + 1] += fx * y0 * z0;
      grid[o + sy] += x0 * fy * z0; grid[o + sy + 1] += fx * fy * z0;
      grid[o + sz] += x0 * y0 * fz; grid[o + sz + 1] += fx * y0 * fz;
      grid[o + sz + sy] += x0 * fy * fz; grid[o + sz + sy + 1] += fx * fy * fz;
    }
  }
  // Normalize observed mass, removing small Float32 accumulation drift.
  const depositedMass = sumField(grid), expectedMass = model.count * angles;
  for (let i = 0; i < grid.length; i++) grid[i] /= depositedMass;
  return {grid, spacing, depositedMass, expectedMass, accumulationRelativeError: depositedMass / expectedMass - 1};
}

export function binomialFilter(field, size) {
  if (!Number.isInteger(size) || size < 2 || field.length !== size ** 3) throw new RangeError('Field size mismatch');
  let input = field;
  for (const stride of [1, size, size * size]) {
    const output = new Float32Array(field.length);
    for (let i = 0; i < input.length; i++) {
      const coordinate = Math.floor(i / stride) % size;
      output[i] = .5 * input[i] + (coordinate > 0 ? .25 * input[i - stride] : 0) + (coordinate < size - 1 ? .25 * input[i + stride] : 0);
    }
    input = output;
  }
  return input;
}

export function buildSweepDensity(model, options = {}) {
  const size = options.size ?? 160, deposited = depositSweep(model, options);
  const filtered = binomialFilter(deposited.grid, size), retainedMass = sumField(filtered);
  const volume = deposited.spacing.reduce((a, b) => a * b, 1);
  // Padding normally prevents boundary loss. Keep the emitted field at unit mass
  // even for a smaller custom grid, and report its pre-renormalization mass.
  for (let i = 0; i < filtered.length; i++) filtered[i] /= retainedMass * volume;
  const {grid, ...statistics} = deposited;
  return {...statistics, density: filtered, retainedMass, mass: sumField(filtered) * volume};
}

export function relativeL1(field, reference) {
  if (field.length !== reference.length) throw new RangeError('Field size mismatch');
  let difference = 0, total = 0;
  for (let i = 0; i < field.length; i++) { difference += Math.abs(field[i] - reference[i]); total += reference[i]; }
  if (!(total > 0)) throw new RangeError('Reference must have positive mass');
  return difference / total;
}

export function encodeLogDensity(density) {
  const positive = [];
  for (const value of density) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Density must be finite and nonnegative');
    if (value > 0) positive.push(value);
  }
  if (!positive.length) throw new RangeError('Density must have positive mass');
  positive.sort((a, b) => a - b);
  const at = .99 * (positive.length - 1), lower = Math.floor(at), fraction = at - lower;
  const referenceDensity = positive[lower] * (1 - fraction) + positive[Math.min(lower + 1, positive.length - 1)] * fraction;
  const logMax = Math.log1p(positive.at(-1) / referenceDensity), encoded = new Uint8Array(density.length * 2);
  let difference = 0, total = 0, decodedMass = 0;
  for (let i = 0; i < density.length; i++) {
    const quantized = Math.round(Math.log1p(density[i] / referenceDensity) / logMax * 65535);
    // Explicit byte order, independent of the host CPU. Upload as WebGL2 RG8.
    encoded[2 * i] = quantized & 255; encoded[2 * i + 1] = quantized >>> 8;
    const decoded = Math.expm1(quantized / 65535 * logMax) * referenceDensity;
    difference += Math.abs(decoded - density[i]); total += density[i]; decodedMass += decoded;
  }
  return {encoded, referenceDensity, logMax, quantizationRelativeL1: difference / total, quantizedMassRatio: decodedMass / total};
}
