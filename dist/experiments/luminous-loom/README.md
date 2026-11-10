# Luminous Loom

A slowly turning ribbon of neighboring (p,q) torus knots. Serve the atlas `dist/` folder and open `experiments/luminous-loom/`. No runtime dependencies for playback.

The centerline is `(x,y,z) = ((1+r cos(qt+v)) cos(pt), (1+r cos(qt+v)) sin(pt), r sin(qt+v))`; neighboring fibers vary `r` and `v`. Periodic rigid rotations and a small breathing radius make a closed loop. The shared `rotation-sequence.mjs` supplies reusable major, minor and fiber angle tables; only projection runs per frame. Defaults form a (2,3) trefoil ribbon. This is translucent wire art, without hidden-surface removal or simulated light transport.

## Cyclic parameter controls

Ribbon spread, stroke width, opacity and magnification each have a **Cyclic** toggle, lower/upper sliders and a choice of Linear, Sine, Smoothstep or Smootherstep easing. The displayed value is the current sample. A complete **Loop · seconds** goes lower → upper → lower, reaching the upper bound at 50%. All tracks share that phase. Sine is the UI default; linear has intentional sharp turnarounds. Equal bounds are constant. The highlighted section of both sliders shows the selected interval. Drag either slider, or use arrow keys/Home/End; the moving bound stops at the other bound rather than crossing it. URL bounds are sorted and clamped to the control's legal range.

Turning Cyclic off restores the stored static slider value, rather than capturing the current animation value. Bounds/easing survive off/on during the session; links preserve active tracks plus static values, not inactive drafts. Selecting a composition clears tracks. Bounds update immediately while dragging or using the keyboard, including during playback. Each slider keeps an exact numeric readout. Numeric output is rounded for display, but the sampled value is continuous.

Only these four continuous controls are migrated in this first scene. **Fibers and samples stay static** because they change discrete geometry and allocation size; **duration stays static** because it defines the clock itself. Palette, renderer and glow are discrete choices. Other Atlas studies have not been migrated. The [shared track API and migration audit](../../shared/parameter-tracks.md) explain how to opt in more scene properties safely.

Pause holds both the scene and tracks; scrub/reset directly evaluate the selected phase, without replaying prior frames. Visible playback advances by elapsed time (slow frames can be skipped), and hidden tabs pause. PNG evaluates the selected phase; MP4 snapshots settings/tracks and evaluates every exact exported phase with no dropped frames or duplicate endpoint. Export does not edit the stored static values or leave controls incorrectly unlocked. Scene links and exported URL sidecars include tracks and start paused.

The benchmark freezes resolved parameter values at the selected phase for all comparison frames. Its report records the static settings, tracks and selected phase separately from the frozen measured scene. It measures renderer cost, not the cost of animating tracks.

## Drawing study

- **Direct:** one closed Canvas path per fiber, drawn once per stroke pass.
- **Path2D:** identical ordered paths/styles, freshly constructed each frame. Preparation is counted; there is no unfair reuse of frozen geometry.
- **Merged:** one compound path per palette band. This deliberately changes overlap opacity and is labeled approximate. Fewer stroke calls are not a promise of better performance.

The comparison pauses playback and uses identical settings, phases and 1080² canvases, two warmups and nine paired measurements in seeded shuffled order (dense runs use one warmup and three measurements). Raw JSON reports median/p95 and samples for geometry, preparation, submission, full-image readback and total. A synchronous full-canvas RGBA readback includes every output pixel, pending drawing, allocation and copy overhead, and can affect browser backend heuristics. A one-pixel corner readback is not sufficient to establish whole-image completion. These are exploratory CPU/raster-complete measurements, **not FPS, compositor presentation, pure GPU time, or export throughput**. Four phase comparisons quantify pixel error; only the same-path mode has a correctness tolerance. With three samples, p95 is just the maximum, not a robust tail estimate. Separate wall-clock accounting covers setup, warmups, measured rounds and pixel verification. Speed never gates tests. Live counters show CPU submission only.

Stress preset: 384 fibers × 1536 samples × two passes = 1,179,648 submitted segments per frame. Drawing can be much slower than real time. Benchmark cancellation is checked between bounded frames.

## Capture & validation

Scene URLs retain settings and paused phase. Reduced motion starts paused. PNG and MP4 render to a separate 720/1080/2160-square canvas with resolution-relative strokes. MP4 reuses `../../shared/frame-export.mjs`, samples exact frame indices at 30/60 fps, omits the duplicate endpoint, and supports cancellation/progress. FrameWrap loads on demand and needs WebCodecs. A dense 2160p loop can be expensive. The source ZIP preserves shared import paths.

`node --test $(find dist -name '*.test.mjs' -print) .github/tests/*.test.mjs`

`PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/luminous-loom/tests/browser-test.cjs`

`PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/luminous-loom/tests/parameter-tracks-browser.cjs`

Set `CHROMIUM_PATH` if using a separately installed Chromium. The cyclic suite checks noncrossing bounds, range highlighting, keyboard/touch editing, every easing, editing during playback, toggle/static retention, seek/seam/URL replay, benchmark freezing, presets, mobile layout, repeated cancellation and an actual 720²/30 FPS/4-second H.264 export with decoded frames compared to reference PNGs. Video comparison allows mean RGB error below 5/255 for lossy H.264 color conversion/chroma subsampling and requires each frame to match its own reference phase more closely than every other sampled phase.

Browser QA covers same-path pixel comparisons, geometry replay/closure, controls, gallery lifecycle, mobile controls, actual PNG/MP4, decoded frames and repeated cancellation. Raw benchmark measurements are stored with CI artifacts; browser/device results are not universal speed claims.
