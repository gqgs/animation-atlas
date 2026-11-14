import { foldFrame as baseFrame, seedParameters as baseParameters, randomFromSeed, TAU } from '../sine-tapestry/field.mjs';
export { LOOP_SECONDS, randomFromSeed, UINT32_MAX } from '../sine-tapestry/field.mjs';

export const definitions = {
  pigment: { min: 0, max: 1.5, step: .01, defaultValue: 1 },
  drift: { min: 0, max: 1.4, step: .01, defaultValue: 1.05 },
  zoom: { min: .85, max: 1.65, step: .01, defaultValue: 1 },
  rotation: { min: -180, max: 180, step: 1, defaultValue: 0 },
};

export function seedParameters(seed) {
  const random = randomFromSeed(seed ^ 0x936052cf);
  const range = (min, max) => min + (max - min) * random();
  return {
    ...baseParameters(seed),
    pocketA: [range(-.58, -.34), range(-.45, .1), range(.83, 1.02), range(6, 11)],
    pocketB: [range(.12, .48), range(.18, .43), range(-.86, -.61), range(9, 16)],
    driftOffset: range(0, TAU)
  };
}

export function foldFrame(parameters, phase, {drift = definitions.drift.defaultValue, zoom = 1, rotation = 0} = {}) {
  const frame = baseFrame(parameters, phase);
  const theta = TAU * (phase % 1);
  const t = theta + parameters.driftOffset;
  const a = frame.foldA, b = frame.foldB;
  const p = parameters.pocketA, q = parameters.pocketB;
  return {
    ...frame,
    foldA: [a[0] + drift * .13 * Math.cos(2 * t), a[1] + drift * .17 * Math.sin(t), a[2] + drift * .37 * Math.cos(t), a[3]],
    foldB: [b[0] + drift * .11 * Math.cos(3 * t), b[1] + drift * .10 * Math.sin(2 * t), b[2] + drift * .5 * Math.sin(-2 * t), b[3]],
    pocketA: [p[0] + drift * .13 * Math.cos(t), p[1] + drift * .17 * Math.sin(t), drift * p[2], p[3]],
    pocketB: [q[0] + drift * .11 * Math.sin(-2 * t), q[1] + drift * .13 * Math.cos(2 * t), drift * q[2], q[3]],
    framing: [zoom, frame.angle + rotation * TAU / 360, drift, t],
  };
}

function twist(x, y, fold) {
  const dx = x - fold[0], dy = y - fold[1];
  const angle = fold[2] * Math.exp(-fold[3] * (dx * dx + dy * dy));
  const c = Math.cos(angle), s = Math.sin(angle);
  return [fold[0] + dx * c - dy * s, fold[1] + dx * s + dy * c];
}

function pocket(x, y, [cx, cy, strength, focus], t, skew) {
  const dx = x - cx, dy = y - cy;
  const u = dx + skew * dy + .09 * Math.sin(8 * dy + t);
  const v = 1.32 * dy + .065 * Math.sin(10 * dx - t);
  return strength * Math.exp(-focus * (u * u + v * v));
}

// Keep this field in step with shader.mjs; the scanner samples the same bands.
export function carrier(x, y, frame) {
  const { foldA, foldB, amplitudes: a, frequencies: k, phases: p, density,
    pocketA, pocketB, framing: [zoom, angle, drift, t] } = frame;
  const c = Math.cos(angle), s = Math.sin(angle);
  const u = (x * c - y * s) / zoom;
  const v = (x * s + y * c) / zoom;
  [x, y] = twist(u, v, foldA);
  [x, y] = twist(x, y, foldB);
  x += a[0] * Math.sin(k[0] * y + p[0]);
  y += a[1] * Math.sin(k[1] * x + p[1]);
  x += a[2] * Math.sin(k[2] * y + p[2]);
  y += a[3] * Math.sin(k[3] * x + p[3]);
  const cross = .15 * Math.sin(3.4 * x + 2.9 * y + t) * Math.sin(2.1 * x - 1.9 * y - 2 * t);
  return density * (1.24 * y + .29 * Math.sin(3.6 * x + .66 * Math.sin(2.5 * y + p[1]))
    + .075 * Math.sin(7.2 * x - 2.7 * y + p[2]) + drift * cross
    + pocket(u, v, pocketA, t, .58) + pocket(u, v, pocketB, -2 * t, -.35));
}

// Seeded, periodic pigment in OKLCH. Reduce chroma before converting to sRGB
// rather than clipping saturated colors to unrelated hues.
function linearRgb(light, chroma, hue) {
  const a = chroma * Math.cos(hue), b = chroma * Math.sin(hue);
  const l = (light + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (light - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (light - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621*l - 3.3077115913*m + .2309699292*s,
    -1.2684380046*l + 2.6097574011*m - .3413193965*s,
    -.0041960863*l - .7034186147*m + 1.7076147010*s];
}

export function weavePigment(seed, width = 512) {
  const random = randomFromSeed(seed ^ 0xc1bd4d35);
  const anchor = TAU * random();
  const span = 1 + .55 * random();
  const bias = .78 + 1.65 * random();
  const chroma = .15 + .045 * random();
  const offset = TAU * random();
  const pixels = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = TAU * (i + .5) / width;
    const ridge = (.5 + .5 * Math.cos(t + offset)) ** 2;
    const reflection = (.5 + .5 * Math.sin(2 * t + bias)) ** 4;
    const light = .30 + .46 * ridge + .14 * reflection;
    const hue = anchor + span * (.8 * Math.sin(t) + .36 * Math.sin(2 * t + bias));
    let c = chroma * (.8 + .2 * Math.sin(t + bias));
    let rgb = linearRgb(light, c, hue);
    while (rgb.some(ch => ch < 0 || ch > 1)) rgb = linearRgb(light, c *= .86, hue);
    for (let ch = 0; ch < 3; ch++) {
      const v = rgb[ch];
      pixels[i * 4 + ch] = Math.round(255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055));
    }
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
