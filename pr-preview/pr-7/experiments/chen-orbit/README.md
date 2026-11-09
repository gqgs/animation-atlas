# Chen Orbit

Study 023. A folded, illuminated density skin generated directly from the Chen–Čelikovský trajectory, with a slow 48-second camera orbit. Compare the original equations with cyclic x-origin forcing. The earlier designed genus-2 sculpture and original trace both remain available under **Form**. Inspired by the equations and violet/coral/amber image in [Paul Bourke's October 2010 reference](https://paulbourke.net/fractals/chen_celi/).

## Run

From the repository root: `python3 -m http.server 8080 --directory dist`, then open `/experiments/chen-orbit/`. No build or runtime dependencies. WebGL2 is required; only the optional MP4 encoder requests a CDN resource.

## Attractor-grown skin (default)

The integrated samples are trilinearly splatted into a 113 × 81 × 49 grid, then smoothed with an isotropic Gaussian of world-space standard deviation 0.025. Marching tetrahedra extracts density level 1.5. These choices give a thin finite neighbourhood to the chaotic folds: no template torus or hand-authored holes. Actual trajectory speed, averaged locally with the same kernel, controls the violet-to-amber palette. Normals, real depth occlusion, density-based self-shadowing and rim light reveal the crossover and rolled edges.

The fixed-origin mesh has 29,456 vertices and 58,916 triangles, one component, no boundary or non-manifold edges, and Euler characteristic −2. This is the topology of this particular sampled, smoothed level set, **not** proof that the attractor is a smooth invariant genus-2 surface. Resolution, density threshold and forcing can change topology. The cyclic variant is also one closed component, but has Euler characteristic −4; its geometry is not forced to match the baseline.

### Cyclic origin experiment

The control selects `X′ = F(X − s(t)e_x)`, `s(t) = 3 sin(0.5t)`, with RK4 forcing evaluated at each substep. There is **no** added `s′(t)` in the lab-frame equation. In moving-origin coordinates, `U′ = F(U) − s′(t)e_x`, so this changes the dynamics rather than rigidly translating a fixed attractor. The same 360 integration-time-unit sample interval accumulates about 29 forcing cycles into a static density skin. The camera/illumination loop, not the chaotic state.

A bounded nine-case check of A={1,3,5}, ω={0.5,1.5,3} retained finite trajectories and both lobes over that interval. A=3, ω=0.5 adds a visible but restrained sweep. Much of its added world-space volume comes from spatial sweeping rather than intrinsically thickened folds. A separate 27-case coefficient sweep did not offer a clear visual advantage, so a=36, b=3, c=20 remain unchanged.

## Earlier comparison forms

**Genus-2 sculpture** is the previous designed manifold: two unequal thick elliptical toroidal lobes joined and twisted through depth, with Chen density etched into the skin. Its 37,528 vertices / 75,060 triangles form a closed connected genus-2 mesh. It is attractor-inspired, not attractor-derived geometry. **Original trajectory** retains the unforced 180,000-point trace. Origin forcing applies only to the new density form, so these remain honest baselines.

## Attractor math and original trace

- `dx/dt = 36(y − x)`, `dy/dt = 20y − xz`, `dz/dt = xy − 3z`.
- RK4 with a fixed step of 0.002, initial state (0.1, 0.1, 0.1), 6,000 discarded transient steps, then 180,000 samples. This is a numerical visualization, not a proof of the system's long-term dynamics.
- Display coordinates are a rigid basis change `(x+y, √2(z−22), y−x)` scaled uniformly by `0.038/√2`. Depth is the integrated third dimension, not invented displacement of a 2D image.
- In the alternate trace mode, a fixed trajectory is drawn as additive soft points and fine connected lines. Height drives the limited palette; repeating illumination pulses are artistic, not physical tracers.
- Camera azimuth, elevation and illumination are periodic in normalized phase. The chaotic trajectory itself is not claimed to be periodic. No history-dependent accumulation or randomness.

## Controls and capture

Drag to orbit; scroll to zoom. Camera sliders provide keyboard alternatives. Space pauses and H hides the interface. Reduced-motion users start paused. Scene links save the settings and open at the selected frame, paused.

PNG and MP4 render directly into a dedicated square WebGL canvas at 720, 1080 or 2160 pixels, independent of the viewport. MP4 uses the shared `../../shared/frame-export.mjs` adapter and lazy-loaded CCapture.js 2.0.0 FrameWrap at 30 or 60 fps. Export samples the full loop at `i / frameCount` without a duplicate endpoint, supports cancellation, and saves a replay link. H.264/WebCodecs support and feasible size depend on the browser; failures are shown in the capture panel. High-resolution exports may take longer than playback.

## Checks

- `node --test $(find dist -name '*.test.mjs' -print)`
- `PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/chen-orbit/tests/browser-test.cjs`

Browser QA covers actual WebGL frames, exact loop closure, state-independent rendering, different viewpoints, palettes, camera gestures, pause/scrub/reset, reduced motion, mobile, gallery close/reopen, direct-resolution PNG, a real short H.264 export, and repeated cancellation. The workflow saves visual evidence as an artifact and small image chunks in its log for review.
