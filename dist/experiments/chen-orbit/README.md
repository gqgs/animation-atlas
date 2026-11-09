# Chen Orbit

The original Chen–Čelikovský point cloud, with two periodic light trains following a real contiguous trajectory segment. Compare **Traveling light** with **Original glow**, or hold the camera to isolate the illumination. The rejected surface studies remain recoverable in Git history.

## Run

Serve `dist` with `python3 -m http.server 8080 --directory dist` and open `/experiments/chen-orbit/`. WebGL2 is required. No build step.

## Math and motion

- `x′=36(y−x)`, `y′=20y−xz`, `z′=xy−3z`, from [Paul Bourke’s reference](https://paulbourke.net/fractals/chen_celi/).
- Fixed-step RK4: dt=.002, seed (.1,.1,.1), discard 6,000 steps, then 180,000 samples. Display is a rigid basis change and uniform scale.
- Light follows samples 36,000–47,999 in their actual order, with soft heads and fading tails. Both finite ends fade; no invented last-to-first connector. The complete cloud preserves the silhouette beneath the light.
- Camera and illumination are deterministic functions of loop phase. The illumination is designed, not a claim that the chaotic trajectory is periodic.

## Projection study

Choose **Bisecting projection planes** to compare 1, 2, 4, 8 or 16 vertical planes through the original z axis. Start at xz (0°), add yz (90°), then insert 45°/135° and keep bisecting angular gaps modulo 180°. “Equidistant” means equal angular spacing: intersecting planes have zero physical distance.

For angle θ, use d=(cos θ,sin θ,0) and project each original point to (x cos θ+y sin θ)d+(0,0,z). These are different orthogonal views of the same orbit, not rotated copies of one silhouette. Compare 1/8, 1/4, 1/2 or all 180,000 samples per plane, independently enabling connecting lines. Compare scaled opacity (divided by relative sample count) with fixed individual point opacity. Scaled opacity can darken faint points because of framebuffer rounding; fixed opacity reveals the raw density change, including increased brightness and clipping. Line opacity is unchanged because the path length is approximately the same. Lines join selected samples in time order, with no last-to-first connector. The original ordered light segment is shared by every plane. Dense settings increase GPU work; all densities remain available for comparison. Guides reveal the construction. This is a superposition of projections, not a new attractor or invariant surface. The original 3D mode remains the default.

## Continuous angular sweep

**Continuous angular sweep** displays a precomputed, voxel-smoothed angular-average density. As a vertical projection plane turns, each original point sweeps the circumference of a circle whose diameter runs from the shared axis to that point. Accumulating those circles avoids drawing thousands of planes in real time. The density is normalized by sample and angle count; an unnormalized infinite additive sum would diverge.

The finite approximation uses all 180,000 samples, 512 angles, trilinear deposition on a padded 160³ grid, and one separable binomial smoothing pass. A 16-bit logarithmic texture retains faint densities; front-to-back raymarching shows overlap and depth. Exposure and cutoff change the display transfer function, not the dynamics. The field is static and the camera loops. No topology or new invariant attractor is claimed.

Rebuild with `node dist/experiments/chen-orbit/tools/precompute-sweep.mjs`. `sweep-density.json` records input/data hashes, angular convergence against 1,024 angles on the same grid, mass and encoding error. These checks do not establish convergence of spatial resolution or trajectory sampling.

## Capture and checks

**Vertical orbit** makes a full 360° overhead-to-underside camera circuit in every study. Its continuous frame avoids sudden pole flips; the back half naturally rotates the view. Switching between horizontal, vertical and held camera preserves the current view and light phase. Scene links and deterministic exports retain the selected path.

Drag/scroll to compose; Space pauses; H hides controls. Scene links preserve settings. Reduced motion starts paused. PNG and MP4 render to a dedicated output-size canvas, at 720/1080/2160 square and 30/60 fps, using `../../shared/frame-export.mjs`; MP4 lazily loads FrameWrap and supports cancellation.

Run `node --test $(find dist -name '*.test.mjs' -print)`. Optional browser QA: `PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/chen-orbit/tests/browser-test.cjs`. CI checks multiple phases with the camera held, loop seams, original comparison, PNG, actual H.264 capture and cancellation, mobile and Atlas lifecycle.
