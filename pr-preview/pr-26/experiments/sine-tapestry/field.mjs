export const TAU = 2 * Math.PI;
export const LOOP_SECONDS = 24;
export const UINT32_MAX = 0xffffffff;

export const palettes = {
  vermilion: [
    [0.00, '#221b35'], [0.07, '#3d3f70'], [0.16, '#708ac2'], [0.23, '#8ed0c4'],
    [0.28, '#3a8b82'], [0.35, '#1d575d'], [0.43, '#582b3d'], [0.51, '#c33732'],
    [0.63, '#ee633c'], [0.74, '#faba6b'], [0.80, '#ffe0ad'], [0.87, '#b96756'],
    [0.94, '#67364b'], [1.00, '#221b35']
  ],
  lagoon: [
    [0.00, '#101d3a'], [0.09, '#343e79'], [0.19, '#657fb9'], [0.26, '#a7c4eb'],
    [0.33, '#e3ece6'], [0.39, '#a9d8c5'], [0.49, '#4fb9a5'], [0.59, '#187c84'],
    [0.68, '#134e62'], [0.77, '#1d3454'], [0.86, '#6e4a7e'], [0.94, '#433358'],
    [1.00, '#101d3a']
  ],
  marigold: [
    [0.00, '#281b2c'], [0.08, '#60384c'], [0.16, '#b26d81'], [0.24, '#da98a2'],
    [0.33, '#8c495a'], [0.40, '#602e3a'], [0.50, '#a94034'], [0.60, '#e17b3f'],
    [0.69, '#f1b344'], [0.77, '#f8dfa2'], [0.86, '#b88845'], [0.94, '#624130'],
    [1.00, '#281b2c']
  ]
};

export function randomFromSeed(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x100000000;
  };
}

export function seedParameters(seed) {
  const random = randomFromSeed(seed);
  const range = (min, max) => min + (max - min) * random();

  return {
    // Center x/y, twist angle and radial falloff for the two opposing folds.
    foldA: [range(-.54, -.23), range(-.38, .38), range(2.6, 4.6), range(2.2, 4.8)],
    foldB: [range(.24, .61), range(-.4, .42), range(-3.9, -1.5), range(2.1, 4.4)],
    amplitudes: [range(.21, .43), range(.21, .41), range(.13, .29), range(.07, .16)],
    frequencies: [range(3, 5.2), range(2.8, 4.8), range(4.5, 7), range(5, 7.5)],
    offsets: Array.from({ length: 4 }, () => range(0, TAU)),
    angle: range(-1.5, 1.5),
    density: range(2.6, 4.2)
  };
}

export function foldFrame(parameters, phase) {
  const theta = TAU * (phase % 1);
  const { foldA, foldB, amplitudes, frequencies, offsets, angle, density } = parameters;
  const a = theta + offsets[0];
  const b = theta + offsets[1];
  const c = theta + offsets[2];
  const d = theta + offsets[3];

  return {
    foldA: [foldA[0] + .15 * Math.cos(a), foldA[1] + .16 * Math.sin(b),
      foldA[2] + .65 * Math.sin(c), foldA[3]],
    foldB: [foldB[0] + .16 * Math.cos(c), foldB[1] + .14 * Math.sin(d),
      foldB[2] + .52 * Math.sin(a), foldB[3]],
    amplitudes,
    frequencies,
    phases: [
      offsets[0] + .76 * Math.sin(b), offsets[1] + .67 * Math.sin(c),
      offsets[2] + .61 * Math.sin(d), offsets[3] + .78 * Math.sin(2 * theta + offsets[0])
    ],
    angle: angle + .21 * Math.sin(d),
    density
  };
}

function twist(x, y, fold) {
  const dx = x - fold[0];
  const dy = y - fold[1];
  const angle = fold[2] * Math.exp(-fold[3] * (dx * dx + dy * dy));
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [fold[0] + dx * cos - dy * sin, fold[1] + dx * sin + dy * cos];
}

// Keep this spatial mapping in sync with carrier() in shader.mjs.
// The same frame uniforms drive the GPU and the seed search.
export function carrier(x, y, frame) {
  const { foldA, foldB, amplitudes: a, frequencies: k, phases: p, angle, density } = frame;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  [x, y] = twist(x * cos - y * sin, x * sin + y * cos, foldA);
  [x, y] = twist(x, y, foldB);

  x += a[0] * Math.sin(k[0] * y + p[0]);
  y += a[1] * Math.sin(k[1] * x + p[1]);
  x += a[2] * Math.sin(k[2] * y + p[2]);
  y += a[3] * Math.sin(k[3] * x + p[3]);
  return density * (1.24 * y + .29 * Math.sin(3.6 * x + .66 * Math.sin(2.5 * y + p[1]))
    + .075 * Math.sin(7.2 * x - 2.7 * y + p[2]));
}

function rgb(hex) {
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

export function palettePixels(name, width = 512) {
  const stops = palettes[name].map(([position, hex]) => [position, rgb(hex)]);
  const pixels = new Uint8Array(width * 4);
  let next = 1;

  for (let i = 0; i < width; i++) {
    const t = (i + .5) / width;
    while (stops[next][0] < t) next++;
    const [lo, start] = stops[next - 1];
    const [hi, end] = stops[next];
    const f = (t - lo) / (hi - lo);
    const blend = f * f * (3 - 2 * f);
    for (let channel = 0; channel < 3; channel++) {
      pixels[4 * i + channel] = Math.round(start[channel] + (end[channel] - start[channel]) * blend);
    }
    pixels[4 * i + 3] = 255;
  }

  return pixels;
}
