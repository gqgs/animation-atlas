import { EASINGS } from '../../shared/parameter-tracks.mjs';

export const DEFAULT_SEED = 121025;
export const UINT32_MAX = 4294967295;
export const LOOP_SECONDS = 12;
export const definitions = {
  flow: { min: 0, max: 1.5, step: .01, defaultValue: .78, digit: 2 },
  pulse: { min: 0, max: 1.5, step: .01, defaultValue: .93 },
  light: { min: .15, max: 1.65, step: .01, defaultValue: .86, digit: 2 },
  zoom: { min: .65, max: 1.5, step: .01, defaultValue: 1, digit: 2 },
  rotation: { min: -180, max: 180, step: 1, defaultValue: 0, digit: 0 },
};

export const TAU = Math.PI * 2;
export const wrapPhase = phase => ((phase % 1) + 1) % 1;

export function seedParameters(seed) {
  // Small independent words drive illumination and radial spacing, not frame noise.
  let word = seed >>> 0;
  const next = () => {
    word = (word + 0x6d2b79f5) >>> 0;
    let bits = word;
    bits = Math.imul(bits ^ bits >>> 15, bits | 1);
    bits ^= bits + Math.imul(bits ^ bits >>> 7, bits | 61);
    return ((bits ^ bits >>> 14) >>> 0) / 4294967296;
  };
  return [TAU * next(), TAU * next(), next(), next()];
}

// A periodic steady-state response to an orientation track. The Fourier response
// of a damped second-order follower avoids warm-up, history or a seam after
// seeks. Time constants are fractions of the loop, not wall-clock seconds.
export function makeOrientationFollower(track) {
  if (!track?.enabled || track.min === track.max) return null;
  const { min, max, easing } = track;
  const mean = (min + max) / 2;
  const radius = (max - min) / 2;
  const coefficients = [];
  const samples = 96;
  const ease = EASINGS[easing];
  const command = Array.from({ length: samples }, (_, j) => {
    const half = 2 * Math.min(j / samples, 1 - j / samples);
    return 2 * ease(half) - 1;
  });
  for (let n = 1; n <= 24; n++) {
    // The drive is even around its initial position, so only cosine terms.
    const drive = 2 / samples * command.reduce((sum, value, j) =>
      sum + value * Math.cos(TAU * n * j / samples), 0);
    coefficients.push([5.2, 2.7].map((frequency, band) => {
      const ratio = n / frequency;
      const re = 1 - ratio * ratio;
      const im = 2 * [.74, .59][band] * ratio;
      const norm = re * re + im * im;
      return [drive * re / norm, drive * im / norm];
    }));
  }
  return phase => {
    const t = TAU * wrapPhase(phase);
    const result = [0, 0];
    coefficients.forEach((bands, i) => {
      const c = Math.cos((i + 1) * t), s = Math.sin((i + 1) * t);
      bands.forEach(([a, b], band) => { result[band] += a * c + b * s; });
    });
    return result.map(value => mean + radius * value);
  };
}

export function frameUniforms(parameters, phase, pose, mode, follower = null) {
  const [middle, outer] = follower ? follower(phase) : [pose.rotation, pose.rotation];
  return {
    seed: parameters,
    wave: [TAU * wrapPhase(phase), mode, pose.flow, pose.light],
    camera: [pose.zoom, pose.rotation * Math.PI / 180],
    motion: [middle * Math.PI / 180, outer * Math.PI / 180, pose.pulse],
  };
}
