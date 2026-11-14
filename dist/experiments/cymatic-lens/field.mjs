export const DEFAULT_SEED = 121025;
export const UINT32_MAX = 4294967295;
export const LOOP_SECONDS = 12;
export const definitions = {
  flow: { min: 0, max: 1.5, step: .01, defaultValue: .78, digit: 2 },
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

export function frameUniforms(parameters, phase, pose, mode) {
  return {
    seed: parameters,
    wave: [TAU * wrapPhase(phase), mode, pose.flow, pose.light],
    camera: [pose.zoom, pose.rotation * Math.PI / 180],
  };
}
