# Luminous Loom

A slowly turning ribbon of neighboring (p,q) torus knots. Serve the atlas `dist/` folder and open `experiments/luminous-loom/`. No runtime dependencies for playback.

The centerline is `(x,y,z) = ((1+r cos(qt+v)) cos(pt), (1+r cos(qt+v)) sin(pt), r sin(qt+v))`; neighboring fibers vary `r` and `v`. Periodic rigid rotations and a small breathing radius make a closed loop. The shared `rotation-sequence.mjs` supplies reusable major, minor and fiber angle tables; only projection runs per frame. Defaults form a (2,3) trefoil ribbon. This is translucent wire art, without hidden-surface removal or simulated light transport.

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

Browser QA covers same-path pixel comparisons, geometry replay/closure, controls, gallery lifecycle, mobile controls, actual PNG/MP4, decoded frames and repeated cancellation. Raw benchmark measurements are stored with CI artifacts; browser/device results are not universal speed claims.
