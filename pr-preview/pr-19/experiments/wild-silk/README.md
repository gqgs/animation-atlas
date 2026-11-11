# Wild Silk · Study 027

Absolute-power attractors from Antonio Sánchez's General 2D Map, via [Paul Bourke's “Having a bad hair day”](https://paulbourke.net/fractals/2dmap/). Filigree and Veil are Atlas search results, initially exploring neighborhoods of Bourke's second parameter set. Descriptive names were assigned here. Fragile early candidates were omitted after cross-platform and perturbed-start checks revealed late escapes or collapse.

```
x' = a0 + a1*x + a2*y + a3*abs(x)^a4 + a5*abs(y)^a6
y' = b0 + b1*x + b2*y + b3*abs(x)^b4 + b5*abs(y)^b6
```

The initial point is (0.05, 0.05). Each portrait samples 1,200,000 iterates after 1,800 transient steps. Negative exponents are evaluated literally: singular/nonfinite values and coordinates outside ±1000 reject the orbit. No clamping changes the map. Long bounded samples are not proofs of permanent boundedness. Floating-point power implementations differ between engines: chaotic sample sequences and finite-time screening scores can differ across platforms, even with identical coefficients. Seeds reproduce coefficients, not bit-identical cross-platform trajectories.

## Rendering

Actual iterates accumulate with bilinear splats into four overlapping angular density layers. A bounded exponential response reveals thin structures. Four cached composites animate a continuous periodic lighting sweep; coefficients and orbit geometry stay fixed. Shared cyclic controls also move the camera: zoom 0.65–1.05 and orientation −18°–18° use sine easing by default. Each can be disabled or given independent bounds/easing. All cycles use the same explicit phase and duration. This is artistic illumination of the sampled invariant measure, not continuous physical motion between iterates. Set wave strength and light motion to zero and disable both camera cycles for a static portrait.

Rare excursions can dwarf the core. Default framing uses the 1st–99th coordinate percentiles from a deterministic subsample; points outside the viewport are clipped, never modified. Full sampled extent is available. Zoom and orientation affect presentation only. The preview caps its longest edge at 850 pixels and transforms density textures with 3.25× overscan, without rebuilding geometry or textures as the camera moves. PNG/MP4 rasterize the resolved camera pose directly at output resolution, avoiding enlarged preview pixels. Animated camera exports are consequently slower than playback; each frame yields for cancellation. Native export may look sharper than the cached preview.

## Seed discovery

WS1 codes encode all fourteen coefficients on a 0.001 grid in [-2,2], using fourteen three-character base-36 integers offset by 2000. Codes include a version and are independent of the random search stream. URLs preserve the seed, presentation, cyclic tracks and paused phase. Old URLs without tracks retain their static camera; new bare visits enable the default cycles. Favorites stay in browser storage.

A module worker explores either broad uniform [-1.5,1.5] coefficients or a neighborhood of the current seed. Neighborhood sampling uses triangular perturbations up to ±0.16 for each coefficient, with 7% broad replacements per coefficient. Both modes quantize to the seed grid. The search collects up to eight distinct candidates or tests 25,000 proposals, and can be stopped immediately by terminating its worker. Selecting a thumbnail loads and saves it; candidates never silently replace the current portrait.

Screening requires finite trajectories, positive largest finite-time Lyapunov estimate from an analytic Jacobian, nontrivial extent and at least 70 occupied cells of a 32² square histogram. Candidates get 2,400-step and 16,000-step inspections (plus transient), then the full 1,200,000-point portrait check before displaying a decimated thumbnail. Loading repeats that same horizon.

Ranking is among the accepted batch, not an optimizer or hard guarantee. Roundness is the covariance eigenvalue ratio; balance compares square-root density with its 180° rotation about the bounding-box center. Neither enforces symmetry. Sprawling favors anisotropy and coverage; spatial variety favors coverage and stretching. Metrics use full bounds, not the cropped display. These heuristics do not prove chaos, artistic value or historical novelty.

## Export and checks

PNG renders directly at 720², 1080² or 2160². MP4 uses `../../shared/frame-export.mjs` and its pinned CCapture FrameWrap encoder, with exact frame phases, progress and cancellation. 1080² / 60 fps is the default. MP4 requires the external encoder download and browser H.264/WebCodecs support. A separate renderer captures immutable settings and normalized tracks during export. The sampled endpoint excludes a duplicate phase-one frame. High-resolution caches can consume substantial memory.

Run `node --test dist/experiments/wild-silk/*.test.mjs dist/shared/frame-export.test.mjs`.
`tests/browser-test.cjs` uses Playwright with `BASE_URL` and optional `CHROMIUM_PATH` to exercise controls, search, seed reload, PNG, responsive layout, and deterministic export via a recorder test double. Actual H.264 encoding remains a separate browser capability check.


## Traveling-wave motion

Wave strength defaults to 0.65. Two smooth, time-periodic shears deform the rendered portrait: a horizontal wave varying with y, followed by a vertical wave varying with the displaced x. Their composition is invertible and area preserving, so neighboring structures flow coherently without folds. Integer temporal harmonics close exactly after one loop. This is an artistic display transformation; the map, orbit, seeds and discovery metrics are unchanged.

The same strip compositor is used by preview, seeking, PNG and MP4. It reuses one scratch canvas and processes one-pixel strips with fractional interpolation, without iterating the attractor again. An overscanned source supplies pixels outside the viewport so waves do not reveal blank border strips. Zero strength bypasses this stage entirely. Camera motion and lighting can be disabled to see the wave deformation alone.

## Loop discovery

“Find a moving loop” searches motion and camera settings on known seeds, with broad and nearby modes, sampled previews, complete-loop favorites and an unfiltered comparison. See [screening and limitations](docs/loop-discovery.md). Load a candidate for smooth full-detail playback and export.
