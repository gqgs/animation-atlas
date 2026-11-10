# Rotation recurrence validation

Run from the repository root:

```
node --test dist/shared/benchmarks/equivalence.test.mjs
node dist/shared/benchmarks/geometry.mjs
SAMPLES=61 WARMUP=12 BATCH=5 node dist/shared/benchmarks/geometry.mjs
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/shared/benchmarks/canvas.html and click Run, keeping the tab foregrounded. Download the complete JSON report. For automation, install Playwright and Chromium, then run:

```
QA_OUTPUT=/tmp/rotation-qa-output node dist/shared/benchmarks/tests/browser-test.cjs
```

`PLAYWRIGHT_MODULE` may point to an installed Playwright module. The runner serves `dist` on an ephemeral loopback port, runs the bounded benchmark, writes `rotation-canvas-results.json` inside the `QA_OUTPUT` directory, and gates only geometry/pixel correctness, never performance.

## Controls and measurements

`reference-unwinding.mjs` and `reference-chamber.mjs` preserve the original core files verbatim (except provenance comments). `reference.mjs` identifies their source commit and preserves original drawing bodies, only parameterizing the target canvas and prepared geometry. Both variants construct the same output shapes and render the same settings. Chamber scene initialization is outside timing for both. Core geometry covers field construction or polygon construction, wedge clipping, colors and filtering. Bounds remain in Unwinding drawing, as in production.

Cases include real defaults, all sliders at maximum, and Chamber's largest geometry workload: minimum symmetry and shard radius, maximum density and polygon sides. All-max sliders alone would miss that case. Phases and randomized pair order have fixed seeds. Warmups precede recorded samples; output includes sample count, median, p95, min and max. Node defaults: 31 samples, 8 warmup pairs, 3 constructions per measured sample. Browser defaults: 9 samples, 2 warmup pairs, one 1080-square frame each. Low-resolution browser timing can be noisy and no speed threshold gates the tests.

Browser geometry, draw and full-frame times are separately reported. Draw and full include synchronous one-pixel `getImageData` to force Canvas work completion; this also adds readback cost and can influence browser backing strategy. Full timing excludes scheduling, compositor presentation, UI, encoding and video capture. Neither geometry ratios nor these offscreen frame costs are claimed as user-visible FPS gains.

Pixel comparisons use independently frozen original painters against production extracted painters, not the same painter twice. Every case compares phases 0, .173, .5, .731 at 1080-square and .173 at 2160-square. Reports disclose exact changed-pixel counts and errors. Tolerance: maximum channel difference 32, at most 0.01% of pixels differ by more than 2, and mean absolute channel difference at most .01 (8-bit channels). This permits sparse antialiasing edge changes without hiding broad differences. Geometry checks require finite coordinates, identical topology and metadata, and absolute error at most 1e-9; they cover complete fields, bounds, raw polygons and clipped wedges, endpoint/near-endpoint phases, a half-degree angle sweep plus explicit negative, near-zero and endpoint angles at 101/360/800 steps, and 1,000 seeded randomized polygons.

`geometry-results.json` is an observed local Node run, including its environment, not a guarantee. Browser results must be obtained in a browser-capable environment; absence of a report is not a pass.

## Shared-math audit scope

Accepted: a shared unit-direction rotation sequence for the fixed-angle turtle steps and regular-polygon vertices. These consumers repeatedly evaluate evenly spaced angles, so recurrence with periodic trigonometric rebasing can remove repeated trigonometry while preserving their public geometry shapes. This benchmark validates those two integrations only.

Deferred: RK4 integrators, Julia view-coordinate transforms, and contour extraction. They are separate candidate reuse areas, not consumers of the fixed-angle rotation sequence. Their equations, coordinate conventions and topology requirements need independent contracts and equivalence tests before extraction. No benchmark result here establishes their performance or correctness, and this change does not broadly consolidate those algorithms.
