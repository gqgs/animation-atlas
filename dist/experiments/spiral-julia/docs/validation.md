# Validation

## Automated local checks

Run from the repository root:

```sh
node --test dist/experiments/spiral-julia/core.test.mjs dist/shared/frame-export.test.mjs
node --check dist/experiments/spiral-julia/main.mjs
node --check dist/experiments/spiral-julia/renderer.mjs
```

The 10 focused tests cover independent complex-tangent formula agreement, poles and large imaginary values, conjugation and periodicity, bounded iteration counts, half-turn symmetry, the two requested parameter anchors, loop closure, source-state immutability, link parsing and round trips, isotropic camera mapping, deterministic frame timestamps, dimensions, recorder cleanup and cancellation.

## Browser checks

Serve `dist/` and open `experiments/spiral-julia/tests/browser.html`. It checks actual WebGL2 compilation and non-black rendering, pixel-identical loop endpoints, distinct primary presets, GPU-to-2D copying at requested export dimensions, exact phase sampling and mocked encoder cleanup/cancellation. Mocked encoder checks are not proof of H.264 codec support.

Manual checks: both primary compositions and the two close-up presets; Play/Pause; phase scrubbing; repeated preset/reset actions; pan, anchored zoom and double-click under Breathe at nonzero phase; palette changes; copy link and restore; hide/show including touch layout; PNG; actual MP4 and cancellation; gallery open/close/reopen; nested preview paths.

All 22 repository `*.test.mjs` tests pass, including the 10 focused tests above. JavaScript syntax, catalog paths, unique scene IDs and byte-for-byte source ZIP parity pass. An independent source review checked numerical stability and output integration; effective-camera gesture mapping and the touch-mode return button were corrected.

Browser verification is pending: the execution sandbox cannot launch Chromium's required Unix sockets, and the PR preview is currently not being served by GitHub Pages. The preview workflow has committed the files to `gh-pages`, but the public URL returns 404 and no Pages build has started. The repository's Pages migration settings need verification before browser review. Shader compilation in a browser, visual quality, real H.264 output, mobile interactions and cross-browser encoding must not be considered passed until that review is complete.
