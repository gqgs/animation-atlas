# Duffing Sky — bounded atmosphere study 013

Related: gqgs/eigendynamics #98, #99, #100, #103; contract #47.
Isolated cosmetic experiment, explicitly requested 2026-10-24. No game engine changes.

## Run and replay
From the bundle root: `python -m http.server 8000`, then open
`http://localhost:8000/experiments/duffing-sky/index.html`.
Local Three.js 0.180.0 is included with its MIT license; no CDN dependencies.
Run numerical checks: `node experiments/duffing-sky/validate.mjs`.
Optional JSON fixture output: add an output path to that command.

State schema: {preset: gentle|folding, seed: integer 0..999999,
seek: seconds 0..600, view: 0|1|2|3, quality: .45|.7|1, speed: 1|10}.
Copy state link serializes these values; a linked time loads paused. PNG exports
include the comparison currently selected, without HTML controls.

## Dynamics / materialization
x'' + delta*x' - x + x^3 = gamma*cos(1.2t).
Gentle: delta=.3, gamma=.12. Folding: delta=.2, gamma=.30.
RK4 at 1/120 s, 100 s warm-up, 600 s precomputed trajectory, 2.5 s exponential
smoothing, linear interpolation. Cache: 864012 bytes. Seed sets initial x
and the field hash; motion is deterministic for the same implementation.
Three smoothed controls: x -> warp; v -> shear; quadratic energy -> coverage.
No spatial simulation, fluid conservation, or literal phase portrait geometry.
No stochastic forcing or coupled oscillators in this milestone.
Regime names describe intended artistic use, not certified chaos/bifurcation.
GPU sine-hash noise is repeatable on one device, not bit-exact across GPU vendors.

## Matched comparison
All modes use the same spatial field, five-octave noise, shading, seed and pixel
budget. Frozen uses zero time/control. Scrolling uses slow drift plus sinusoidal
warp controls. Duffing uses the same drift plus smoothed oscillator controls.
Triptych evaluates a single full-screen shader; it does not triple pixel count.
CPU controller overhead is paid in all modes. Renderer capped at 1.5M pixels;
DPR <=1.5, quality multipliers .45/.7/1. No raymarch, field allocation, or dynamic
physics. NaN/Inf and runaway state guards stop precomputation.

## Validation, 2026-10-24
- Deterministic full-trajectory replay, finite values, seek clamps/endpoints: PASS
  for both presets, seed 98.
- RK4 step-halving over 10 s: final state errors 2.19e-10 (gentle), 5.83e-10
  (folding). Long chaotic trajectories are not expected to agree indefinitely.
- Shader compiled/linked/rendered through Mesa llvmpipe OpenGL, LLVM 20.1.2;
  inspected stills at t=0,120,360. This validates the field's rendered appearance,
  not the Three.js browser integration or real hardware performance.
- Preview browser cannot create a WebGL context. Browser animation, GPU timers,
  exports and full interaction flow remain UNVERIFIED. It renders an explicit
  WebGL fallback. No unsupported performance figures are claimed.
- Reduced-motion starts paused; no flashes; muted palette, semantic labeled
  controls and visible focus. Gameplay readability remains untested.

## Evaluation recipe and decision
Seed 98, folding, balanced: compare all three at 1x for a minute; then 10x for
one minute (600 s replay). Inspect t=0,120,360 at balanced and low. Record GPU,
resolution, CPU submit ms, GPU timer ms if supported, and observed artifacts.
CPU submit is not total CPU utilization; frame time/FPS includes browser overhead.
GPU timer availability is device-dependent. Compare individual full-width views
for composition, triptych for motion character. Repeat gentle with the same seed.

Keep/defer/reject rubric: retain only if observers identify more structural memory
and interesting occasional rearrangement without flicker or silhouette interference.
Current verdict: KEEP as standalone artwork; DEFER engine adoption and any claim
of superiority until side-by-side motion and target-hardware review. #98's full
acceptance is not asserted. Do not auto-close its child tickets.
