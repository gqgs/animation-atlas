/** Pure scalar tracks sampled from an explicit loop phase (no clock or DOM).
 * A normalized track is { enabled: true, min, max, easing }.
 * Definitions are own properties: { min, max, step?, defaultValue? }.
 * step/defaultValue describe UI controls; they never quantize track samples.
 */
export const EASINGS = Object.freeze({
  linear: t => t,
  sine: t => (1 - Math.cos(Math.PI * t)) / 2,
  smoothstep: t => t * t * (3 - 2 * t),
  smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10),
});

const MAX_SERIALIZED_LENGTH = 16384;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const safeKeys = value => record(value) ? Object.keys(value).filter(key => !forbidden.has(key)).sort() : [];

/** Return fresh, clamped tracks for known finite scalar definitions only.
 * Missing bounds use the definition's extent; explicitly malformed bounds,
 * malformed definitions, disabled entries, and unknown names are omitted.
 * Missing/unknown easing uses linear. Reversed bounds are sorted.
 */
export function normalizeTracks(input, definitions) {
  const result = {};
  if (!record(input)) return result;
  for (const key of safeKeys(definitions)) {
    if (!own(input, key)) continue;
    const definition = definitions[key];
    const track = input[key];
    if (!record(definition) || !own(definition, 'min') || !own(definition, 'max') ||
        !finite(definition.min) || !finite(definition.max) || !record(track) ||
        (own(track, 'enabled') && track.enabled !== true)) continue;
    const lower = Math.min(definition.min, definition.max);
    const upper = Math.max(definition.min, definition.max);
    const a = own(track, 'min') ? track.min : lower;
    const b = own(track, 'max') ? track.max : upper;
    if (!finite(a) || !finite(b)) continue;
    const clamp = value => Math.max(lower, Math.min(upper, value));
    const min = clamp(Math.min(a, b));
    const max = clamp(Math.max(a, b));
    const easing = own(track, 'easing') && typeof track.easing === 'string' && own(EASINGS, track.easing)
      ? track.easing : 'linear';
    result[key] = { enabled: true, min, max, easing };
  }
  return result;
}

/** Shallow-copy static values and override enabled tracks at a repeating phase.
 * Phase 0/1 is min; phase .5 is max. Negative phases wrap normally.
 * Invalid phases leave the entire static snapshot unchanged. Static values
 * are preserved verbatim, even outside definitions; missing static keys are
 * only added for enabled tracks. No input objects are mutated.
 */
export function resolveParameters(staticValues, tracks, phase, definitions) {
  const result = {};
  for (const key of safeKeys(staticValues)) result[key] = staticValues[key];
  if (!finite(phase)) return result;
  const wrapped = phase - Math.floor(phase);
  const half = wrapped <= 0.5 ? wrapped * 2 : (1 - wrapped) * 2;
  for (const [key, track] of Object.entries(normalizeTracks(tracks, definitions))) {
    const amount = Math.max(0, Math.min(1, EASINGS[track.easing](half)));
    // Weighted interpolation avoids overflow when finite bounds straddle zero.
    result[key] = amount === 0 ? track.min : amount === 1 ? track.max
      : (1 - amount) * track.min + amount * track.max;
  }
  return result;
}

/** Encode for the URL query parameter `tracks` using URLSearchParams.
 * Format: {v:1,t:{name:[min,max,easing]}}. Keys are sorted for stable URLs.
 * No tracks (or a payload over 16 KiB) yields ''; callers can omit the query.
 */
export function serializeTracks(tracks, definitions) {
  const normalized = normalizeTracks(tracks, definitions);
  const t = {};
  for (const [key, track] of Object.entries(normalized)) t[key] = [track.min, track.max, track.easing];
  if (!Object.keys(t).length) return '';
  const serialized = JSON.stringify({ v: 1, t });
  return serialized.length <= MAX_SERIALIZED_LENGTH ? serialized : '';
}

/** Decode the value returned by URLSearchParams.get('tracks').
 * Unsupported versions, malformed/oversized JSON, and invalid tuples safely
 * yield no tracks. Valid entries in an otherwise valid payload are retained.
 */
export function parseTracks(serialized, definitions) {
  if (typeof serialized !== 'string' || !serialized.length || serialized.length > MAX_SERIALIZED_LENGTH) return {};
  let payload;
  try { payload = JSON.parse(serialized); } catch { return {}; }
  if (!record(payload) || payload.v !== 1 || !record(payload.t)) return {};
  const tracks = {};
  for (const key of safeKeys(payload.t)) {
    const tuple = payload.t[key];
    if (!Array.isArray(tuple) || tuple.length !== 3 || !finite(tuple[0]) || !finite(tuple[1]) ||
        typeof tuple[2] !== 'string' || !own(EASINGS, tuple[2])) continue;
    tracks[key] = { enabled: true, min: tuple[0], max: tuple[1], easing: tuple[2] };
  }
  return normalizeTracks(tracks, definitions);
}
