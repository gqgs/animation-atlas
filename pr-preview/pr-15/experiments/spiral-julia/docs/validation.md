# Validation

## Automated local checks

Run from the repository root:

```sh
node --test dist/experiments/spiral-julia/core.test.mjs dist/shared/frame-export.test.mjs
node --check dist/experiments/spiral-julia/main.mjs
node --check dist/experiments/spiral-julia/renderer.mjs
```

The 22 focused tests cover independent complex-tangent formula agreement, poles and large imaginary values, conjugation and periodicity, bounded iteration counts, half-turn symmetry, the two requested parameter anchors, loop closure, source-state immutability, link parsing and round trips, isotropic camera mapping, deterministic frame timestamps, dimensions, recorder cleanup, cancellation during pending work, and emitted codec errors.

## Browser checks

Serve `dist/` and open `experiments/spiral-julia/tests/browser.html`. It checks actual WebGL2 compilation and non-black rendering, pixel-identical loop endpoints, distinct primary presets, GPU-to-2D copying at requested export dimensions, exact phase sampling and mocked encoder cleanup/cancellation. Mocked encoder checks are not proof of H.264 codec support.

## Recorded verification

On 2026-11-08, all 34 repository `*.test.mjs` tests passed, including the 22 focused tests above. JavaScript syntax, catalog paths, unique scene IDs and byte-for-byte source ZIP parity passed. An independent source review checked numerical stability and output integration; effective-camera gesture mapping and the touch-mode return button were corrected. A repeated-export cancellation hang found in browser CI led to abort-aware waits and codec-error propagation in the shared exporter, with regression tests.

The [browser CI run](https://github.com/gqgs/animation-atlas/actions/workflows/test-spiral-julia.yml) runs Chromium with SwiftShader through pinned Playwright 1.62.1. The workflow is `.github/workflows/test-spiral-julia.yml`; its full integration check is `tests/browser-test.cjs`. It verifies:

- Actual shader compilation, non-black rendering, pixel-identical loop endpoints and distinct primary presets.
- Pixel-exact GPU-to-2D export copying, requested dimensions, exact phase sampling and mocked encoder cleanup/cancellation.
- Preset changes, playback pause/resume, hide/show, double-click camera mapping at nonzero Breathe phase, palette changes and replay-link controls.
- A downloaded 1080 × 1080 PNG, independent of viewport size.
- A real H.264 MP4 at 720 × 720, 30 FPS, exactly 240 frames and 8 seconds. FFprobe checks its metadata; FFmpeg decodes the beginning, midpoint and final frame to check nonblank imagery and visible motion. This short test uses 32 iterations to keep software-rendered CI practical.
- Repeated cancellation of real exports without a partial MP4, restoration of controls, mobile-width layout with a visible touch return button, and gallery launch/close/reopen.
- No uncaught page errors.

Rendered screenshots of Pearl spirals, Ember lace, Into the spiral, Nylander's crop and the mobile layout were visually inspected. The [live PR preview](https://gqgs.github.io/animation-atlas/pr-preview/pr-6/) serves the gallery and nested experiment paths.

## Remaining limits

This is Chromium software-renderer verification, not a physical-device compatibility or performance guarantee. Safari, Firefox, hardware-specific drivers, physical multitouch gestures, and long 1080²/2160² exports have not been exhaustively tested. WebGL2 is required; unsupported browsers show a clear error. The actual encoder is the shared pinned CDN dependency, so an offline or blocked CDN prevents MP4 capture while interactive rendering and PNG still work. Mathematical cutoff and floating-point limits are described in [math and controls](math-and-controls.md).
