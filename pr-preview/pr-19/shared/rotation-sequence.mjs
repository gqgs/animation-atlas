// Equally spaced unit-circle directions, written into caller-owned storage.
// Geometry is evaluated from explicit angles, never from previous animation frames.
export function rotationSequence(count, start, step, output = new Float64Array(count * 2)) {
  if (!Number.isInteger(count) || count < 0 || !Number.isFinite(start) || !Number.isFinite(step)) {
    throw new RangeError('Expected a nonnegative integer count and finite angles');
  }
  if (!(output instanceof Float64Array) || output.length < count * 2) {
    throw new RangeError('Rotation output must be a sufficiently large Float64Array');
  }
  const dc = Math.cos(step), ds = Math.sin(step);
  let c = 0, s = 0;
  for (let i = 0; i < count; i++) {
    // Rebase every 64 samples: bounded roundoff without a trig call per vertex.
    if (i % 64 === 0) {
      const angle = start + i * step;
      c = Math.cos(angle); s = Math.sin(angle);
    }
    output[2 * i] = c; output[2 * i + 1] = s;
    const next = c * dc - s * ds;
    s = s * dc + c * ds; c = next;
  }
  return output;
}
