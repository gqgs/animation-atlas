# Wild Silk · Study 027

Absolute-power attractors from Antonio Sánchez's General 2D Map, via [Paul Bourke's “Having a bad hair day”](https://paulbourke.net/fractals/2dmap/). Filigree and Veil are Atlas search results, initially exploring neighborhoods of Bourke's second parameter set. Descriptive names were assigned here. Fragile early candidates were omitted after cross-platform and perturbed-start checks revealed late escapes or collapse.

```
x' = a0 + a1*x + a2*y + a3*abs(x)^a4 + a5*abs(y)^a6
y' = b0 + b1*x + b2*y + b3*abs(x)^b4 + b5*abs(y)^b6
```

The initial point is (0.05, 0.05). Each portrait samples 1,200,000 iterates after 1,800 transient steps. Negative exponents are evaluated literally: singular/nonfinite values and coordinates outside ±1000 reject the orbit. No clamping changes the map. Long bounded samples are not proofs of permanent boundedness. Floating-point power implementations differ between engines: chaotic sample sequences and finite-time screening scores can differ across platforms, even with identical coefficients. Seeds reproduce coefficients, not bit-identical cross-platform trajectories.

## Rendering

Actual iterates accumulate with bilinear splats into four overlapping angular density layers. A bounded exponential response reveals thin structures. Four cached composites animate a continuous periodic lighting sweep; geometry and coefficients stay fixed. This is artistic illumination of the sampled invariant measure, not continuous physical motion between iterates. Set light motion to zero for a static portrait.

Rare excursions can dwarf the core. Default framing uses the 1st–99th coordinate percentiles from a deterministic subsample; points outside the viewport are clipped, never modified. Full sampled extent is available. Zoom and orientation affect presentation only. The preview caps its longest edge at 1200 pixels; exports rebuild density layers at the requested resolution.

## Seed discovery

WS1 codes encode all fourteen coefficients on a 0.001 grid in [-2,2], using fourteen three-character base-36 integers offset by 2000. Codes include a version and are independent of the random search stream. URLs preserve the seed, presentation and paused phase. Favorites stay in browser storage.

A module worker explores either broad uniform [-1.5,1.5] coefficients or a neighborhood of the current seed. Neighborhood sampling uses triangular perturbations up to ±0.16 for each coefficient, with 7% broad replacements per coefficient. Both modes quantize to the seed grid. The search collects up to eight distinct candidates or tests 25,000 proposals, and can be stopped immediately by terminating its worker. Selecting a thumbnail loads and saves it; candidates never silently replace the current portrait.

Screening requires finite trajectories, positive largest finite-time Lyapunov estimate from an analytic Jacobian, nontrivial extent and at least 70 occupied cells of a 32² square histogram. Candidates get 2,400-step and 16,000-step inspections (plus transient), then the full 1,200,000-point portrait check before displaying a decimated thumbnail. Loading repeats that same horizon.

Ranking is among the accepted batch, not an optimizer or hard guarantee. Roundness is the covariance eigenvalue ratio; balance compares square-root density with its 180° rotation about the bounding-box center. Neither enforces symmetry. Sprawling favors anisotropy and coverage; spatial variety favors coverage and stretching. Metrics use full bounds, not the cropped display. These heuristics do not prove chaos, artistic value or historical novelty.

## Export and checks

PNG renders directly at 720², 1080² or 2160². MP4 uses `../../shared/frame-export.mjs` and its pinned CCapture FrameWrap encoder, with exact frame phases, progress and cancellation. 1080² / 60 fps is the default. MP4 requires the external encoder download and browser H.264/WebCodecs support. A separate renderer captures immutable settings during export. The sampled endpoint excludes a duplicate phase-one frame. High-resolution caches can consume substantial memory.

Run `node --test dist/experiments/wild-silk/core.test.mjs dist/shared/frame-export.test.mjs`.
`tests/browser-test.cjs` uses Playwright with `BASE_URL` and optional `CHROMIUM_PATH` to exercise controls, search, seed reload, PNG, responsive layout, and deterministic export via a recorder test double. Actual H.264 encoding remains a separate browser capability check.
