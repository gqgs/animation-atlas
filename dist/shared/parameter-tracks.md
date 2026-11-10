# Reusable cyclic scalar parameters

`parameter-tracks.mjs` is a pure, scene-independent layer between stored values and an explicit-phase renderer. `parameter-controls.mjs` is a small optional DOM adapter. Luminous Loom is the first consumer; the rest of the Atlas is unchanged.

## Contract

```js
import {normalizeTracks, resolveParameters, parseTracks, serializeTracks}
  from './parameter-tracks.mjs';
const definitions = {width:{min:.3, max:2.4, step:.05, defaultValue:1.05}};
const settings = {width:1.05}; // Remains the static setting, never overwritten.
const tracks = normalizeTracks({
  width:{enabled:true, min:.5, max:1.8, easing:'sine'},
}, definitions);
const sampled = resolveParameters(settings, tracks, phase, definitions);
// drawScene(target, sampled, phase);
```

For repeating phase `p`, the triangular amount is `2p` up to .5 and `2(1-p)` afterward. Easing maps this amount before interpolation. Every track starts at its lower bound, reaches its upper bound halfway, and returns to the lower bound at the next integer phase. Linear has a cusp at turnarounds; Sine, Smoothstep and Smootherstep soften them. These curves have no overshoot. There are no per-track offsets, durations, keyframes or one-way ramps in this version.

Definitions are an explicit scene-owned allowlist. Track values are clamped and reversed bounds sorted. A missing bound defaults to the definition extent; explicitly malformed/nonfinite bounds disable that entry. Equal bounds are valid. Unknown parameters, malformed definitions and prototype-related keys are ignored. `step` is a UI hint, not quantization: samples remain continuous. The static object is copied, not normalized or mutated; normalize a scene's static settings before resolving tracks. Invalid phase leaves the static snapshot untouched.

Supported names are `linear`, `sine`, `smoothstep`, `smootherstep`. The programmatic default is linear; the DOM control deliberately offers sine initially. Parsing uses versioned compact JSON `{v:1,t:{width:[.5,1.8,"sine"]}}`, passed through `URLSearchParams` rather than manual URL concatenation. Invalid or oversized (over 16 KiB) payloads fail safely. Only active tracks are serialized; disabled draft values can be kept locally by a UI.

## Control adapter

`createParameterControl({parent,key,label,definition,value,track,onValue,onTrack})` creates a static range, live output, cyclic checkbox, lower/upper numeric fields and easing selector. Set `definition.animatable=false` for structural or clock parameters and supply a short `note`. The caller owns state and normalizes edits in `onTrack`; call `sync({value,track,resolved,disabled})` after edits and phase changes. `reset()` clears inactive bounds/easing drafts for a new preset. Numeric fields commit on change/blur and are not overwritten by per-frame live sync while being edited. Every control has an accessible label. Use unique safe keys controlled by the scene, not arbitrary user strings. CSS classes are intentionally scene-styled; Luminous Loom supplies an example layout for narrow panels and phones.

## Architecture audit and migration rules

The Atlas maintains standalone scenes, rather than a single scene/property registry. Luminous Loom has module-based, explicit-phase geometry and separate painting; Chromatic Unwinding/Chamber also have explicit drawing paths; other studies include HTML-embedded control handlers, procedural formulas, workers, precomputed density and stateful simulations. A global scan that replaces every range input or dispatches synthetic input events each frame would run scene-specific side effects and cannot safely provide universal animation.

1. Audit the scene's actual value consumers, normalization, loop time and exporter. Define animatable continuous parameters explicitly; omit the clock, export size/FPS, sample counts, seeds and discrete topology unless a scene-specific strategy handles them.
2. Keep static settings and tracks separate. Resolve a fresh view from the same normalized phase used by geometry. Pass that view directly to rendering; never mutate DOM values or invoke ordinary input/rebuild handlers to animate.
3. Separate shape allocation from continuous geometry. Loom reuses its coordinate/angle buffers and only rewrites the small fiber-direction table when spread changes. Width, opacity and zoom only affect painting. No per-frame topology rebuild is introduced.
4. Use the same sampling in preview, seeking, PNG and `frame-export.mjs`. Snapshot both settings and normalized tracks before export. A standalone shared track function does not make a stateful simulation seekable; fixed-step replay or a different model remains necessary there.
5. Decide whether benchmarks measure an animated scene or a frozen parameter sample. Loom explicitly freezes the current resolved values and saves provenance, avoiding changing workloads between matched renderer measurements.
6. Cover defaults/static compatibility, all curve endpoints, arbitrary seek, seam, URL validation, busy-state controls, reset/presets, narrow panels and actual decoded exports. Preserve standalone source bundles and original scene IDs.

Current migration: **Luminous Loom spread, width, opacity, zoom only**. Fibers/samples are structural integers and remain static; duration remains the timebase. A generic scalar math API can be reused across future scenes, but each scene still needs a deliberate rendering/state adapter.

## Checks

- `node --test dist/shared/parameter-tracks.test.mjs`
- `node --test dist/experiments/luminous-loom/parameters.test.mjs`
- `node dist/experiments/luminous-loom/tests/parameter-tracks-browser.cjs` (Playwright, Chromium, FFmpeg)
