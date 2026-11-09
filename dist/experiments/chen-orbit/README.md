# Chen Orbit

Study 023. A closed, asymmetrical genus-2 sculpture with two genuine through-tunnels, thick rims, self-shadowing and a slow 48-second camera orbit. The original trajectory remains available under **Form → Original trajectory**. Inspired by the equations and violet/coral/amber image in [Paul Bourke's October 2010 reference](https://paulbourke.net/fractals/chen_celi/).

## Run

From the repository root: `python3 -m http.server 8080 --directory dist`, then open `/experiments/chen-orbit/`. No build or runtime dependencies. WebGL2 is required; only the optional MP4 encoder requests a CDN resource.

## Surface and topology

The sculpture is a designed manifold inspired by the attractor, not the exact chaotic invariant set. Two unequal, thick elliptical toroidal lobes are smoothly joined and twisted through depth. A deterministic marching-tetrahedra extraction creates 37,528 vertices and 75,060 triangles. The production mesh has one connected component, no boundary or non-manifold edges, and Euler characteristic −2: a closed genus-2 surface. A coarser mesh independently retains that topology.

Normals, key/rim lighting, ambient occlusion and implicit-surface self-shadowing reveal the solid and its tunnel walls. A smoothed density texture made from the actual integrated Chen trajectories supplies the luminous grain on the skin. The two handles are deliberately preserved; simply thickening a chaotic path would not guarantee this topology.

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
