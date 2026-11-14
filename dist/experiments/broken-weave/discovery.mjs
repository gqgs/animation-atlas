import { resolveParameters } from '../../shared/parameter-tracks.mjs';
import { definitions, carrier, foldFrame, randomFromSeed, seedParameters } from './field.mjs';

const GRID = 15;
const FRAMES = 8;
const STEP = .003;
const VIEW_PIXELS = 720;
const COLORS_PER_CYCLE = 12;

const clamp = value => Math.max(0, Math.min(1, value));
const target = (value, center, width) => Math.exp(-((value - center) ** 2) / (2 * width ** 2));

export function assessSeed(seed, settings = {}, tracks = {}) {
  const parameters = seedParameters(seed);
  const size = GRID * GRID;
  const orientations = new Float64Array(2 * FRAMES * size);
  const descriptor = new Float64Array(3 * 3 * 2);
  let legibility = 0;
  let curves = 0;
  let turns = 0;
  let motion = 0;

  for (let frameIndex = 0; frameIndex < FRAMES; frameIndex++) {
    const phase = frameIndex / FRAMES;
    const frame = foldFrame(parameters, phase, resolveParameters(settings, tracks, phase, definitions));

    for (let row = 0; row < GRID; row++) {
      for (let column = 0; column < GRID; column++) {
        const x = 2 * (column + .5) / GRID - 1;
        const y = 2 * (row + .5) / GRID - 1;
        const gx = (carrier(x + STEP, y, frame) - carrier(x - STEP, y, frame)) / (2 * STEP);
        const gy = (carrier(x, y + STEP, frame) - carrier(x, y - STEP, frame)) / (2 * STEP);
        const magnitude = Math.max(Math.hypot(gx, gy), 1e-8);
        const projectedWidth = VIEW_PIXELS / (2 * COLORS_PER_CYCLE * magnitude);
        legibility += clamp((projectedWidth - 1.25) / 3);

        // Double the angle so opposite gradients describe the same contour.
        const ux = (gx * gx - gy * gy) / magnitude ** 2;
        const uy = 2 * gx * gy / magnitude ** 2;
        const index = 2 * (frameIndex * size + row * GRID + column);
        orientations[index] = ux;
        orientations[index + 1] = uy;
        if (column) {
          curves += (1 - ux * orientations[index - 2] - uy * orientations[index - 1]) / 2;
          turns++;
        }
        if (row) {
          const neighbor = index - 2 * GRID;
          curves += (1 - ux * orientations[neighbor] - uy * orientations[neighbor + 1]) / 2;
          turns++;
        }

        const cell = 2 * (3 * Math.floor(3 * row / GRID) + Math.floor(3 * column / GRID));
        descriptor[cell] += ux;
        descriptor[cell + 1] += uy;
      }
    }
  }

  // Include the final-to-first interval. Hue shifts alone cannot earn motion points.
  for (let index = 0; index < orientations.length; index += 2) {
    const next = (index + 2 * size) % orientations.length;
    motion += (1 - orientations[index] * orientations[next]
      - orientations[index + 1] * orientations[next + 1]) / 2;
  }

  const edgeClarity = legibility / (size * FRAMES);
  const turning = curves / turns;
  const deformation = motion / (size * FRAMES);
  const score = .38 * edgeClarity + .35 * target(turning, .22, .10)
    + .27 * target(deformation, .17, .085);

  return {
    seed,
    score,
    edgeClarity,
    turning,
    deformation,
    descriptor: descriptor.map(value => value / (FRAMES * size / 9))
  };
}

export function discoverSeeds(start, count, limit = 6, settings, tracks) {
  const random = randomFromSeed(start);
  const ranked = Array.from({ length: count }, () => assessSeed((random() * 0x100000000) >>> 0, settings, tracks));
  ranked.sort((a, b) => b.score - a.score || a.seed - b.seed);

  const shortlist = [];
  for (const result of ranked) {
    const distinct = shortlist.every(selected =>
      selected.seed !== result.seed &&
      Math.hypot(...result.descriptor.map((value, i) => value - selected.descriptor[i])) > .48
    );
    if (distinct) shortlist.push(result);
    if (shortlist.length === limit) break;
  }
  return shortlist.map(({ seed, score, edgeClarity, turning, deformation }) =>
    ({ seed, score, edgeClarity, turning, deformation }));
}
