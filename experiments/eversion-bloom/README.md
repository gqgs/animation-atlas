# Eversion Bloom

A continuous seven-lobed annular shell rolls its rim past vertical in counter-traveling waves. Fine radial flutes catch light; teal and plum-copper identify the actual two material sides. The default camera and zoom are fixed. The shell changes its silhouette, rather than merely rotating a static object.

This is a stylized deforming surface inversion, **not rigid origami or a topological sphere eversion**. The sheet stretches. Reversal and Pleat relief are the only shape controls; zoom, orientation and elevation follow the shared opt-in cyclic controls.

## Geometry

Let θ be angle around the collar, u∈[0,1] the radial sheet coordinate, and t=2π phase. Define k = depth [0.65 sin(θ−t) + 0.35 sin(2θ+t)]. The two waves travel in opposite directions, so the motion is not a rigid rotation. A positive sheet length L(θ) combines a seven-lobe cosine with 56 triangular flutes.

The meridian is a signed circular arc:

- r = 1.05 + L sin(ku)/k
- y = L (1−cos(ku))/k
- position = (r cos θ, y, r sin θ)

Stable series handle k≈0. At |ku|>π/2 the radial tangent reverses and the rim rolls back inward, revealing the opposite material side. The collar remains fixed. All time dependence is integer-frequency trigonometry; phase 1 equals phase 0 with matching velocity. Cached topology uses 224 angular and 32 radial intervals.

For the analytic zero-thickness surface, |k|≤2.95<π and L>0 ensure r≥1.05. Distinct angular meridians therefore cannot meet. On each nonflat meridian signed height is strictly monotonic in u; the flat case has strictly increasing radius. Thus the analytic surface is injective modulo the welded angular seam. This argument does not certify finite-thickness fabrication or the piecewise-linear tessellation at arbitrary resolutions. Tests check positive radii, angular seam, nondegenerate triangles and meridian monotonicity across sampled settings. There is no reliance on accidental self-intersections.

## Rendering and export

WebGL2 renders both sides with a depth buffer and derivative-based facet normals. No transparent surface layers or painter-order sorting. The static topology and GPU buffers are reused. A dedicated GPU canvas renders at the target resolution and is copied into the Canvas 2D target accepted by the existing shared deterministic exporter; no post-export upscaling or new recorder library.

PNG captures the current pose. MP4 starts at phase zero (the shared URL’s paused phase only selects the preview/PNG). It snapshots settings/tracks at native 720²/1080²/2160² and 30/60 FPS, omitting the duplicate endpoint. Progress, cancellation and browser codec errors follow Atlas conventions. GPU availability is required; unavailable/lost WebGL contexts show an explicit message. High-resolution software-rendered export can be slow. No media binaries are committed.

Run `node --test dist/experiments/eversion-bloom/core.test.mjs`. The browser CI checks six fixed-camera phases, pixel-identical endpoints, scene URLs, mobile layout, PNG, complete 720p/30fps MP4 and cancellation. Visual screenshots are retained as temporary CI artifacts.

### Recording artifact regression

Eversion Bloom requests an H.264 keyframe for every output frame using the pinned FrameWrap encoder’s `keyInterval`. This removes predictive-frame residue reproduced in empty background pixels with the supplied 5-second cyclic scene. The geometry, renderer, bitrate, exact frame times and shared exporter are unchanged. Independently encoded frames can affect file size and encoding cost; MP4 remains lossy.

The recording CI exports the reported scene twice at 1080² and 2160²/60 FPS: a baseline predictive encode with saved raw inputs, then a normal UI export with the scene’s independent-frame policy. FFmpeg verifies all 300 output frames are keyframes and compares decoded pixels at 11 phases with raw frames and an independently projected silhouette. It checks the two reported timestamps (1.417 s and 3.983 s), adjacent frames, the URL’s preview phase and the loop endpoints. Saved image/numerical artifacts expire; videos are not committed or uploaded. The regression checks software Chromium/FFmpeg, not every hardware encoder or player. The larger intermittent block trails in the second user screenshot have not yet been reproduced; user verification is still required.
