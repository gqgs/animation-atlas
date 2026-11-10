# Julia Drift

A seeded inverse-quadratic Julia point cloud carried through a closed Möbius orbit. Open `index.html` through an HTTP server; WebGL2 is required. No build or runtime dependencies for playback.

## Mathematics

Inspired by Roger Bagula / Paul Bourke’s [Adjusted probability reverse Julia](https://paulbourke.net/fractals/reversejulia/) (1998), and the atlas’s Spiral Julia and Möbius Drift studies.

We iterate `z_next = ±sqrt(z - c)`, with `c = -0.75 + 0.10i` by default. A seeded xorshift32 sequence chooses the negative branch with probability R. After 256 burn-in steps, points are retained and uploaded once to the GPU. R affects the sampled measure, not the underlying Julia set. Extreme R values undersample some branches. The screenshot’s printed angle is arg(P_n); this implementation explicitly uses arg(P_n - c), so it is the actual inverse of z²+c, not a literal transcription of that displayed variant.

The default R = 0.99 and close crop around −0.5 + 0.05i reveal the fine spiral garden; balanced branch sampling mainly reveals the outer boundary.

The animated map is `w = (z + a)/(1 - conjugate(a) z)`, where `a = drift * exp(2πi phase)`. It acts on local coordinates `(z - focus)/0.35`, then transforms back, with focus = −0.5 + 0.05i so the tide remains centered on the spiral garden. Its determinant is `1 + |a|²`, hence nonzero. Its pole is sent to infinity; the shader excludes a small numerical neighborhood. Camera breathing is periodic too. Still selects the unwarped cloud. No parameter morphing or per-frame resampling is used. Color follows the original point angle and logarithmic radius around that focus, so color stays attached to the geometry. This is finite point sampling, not a continuous escape-time image; deep crops benefit from higher sample counts.

## Controls and capture

Four compositions, four palettes, branch probability, Möbius amplitude, complex parameter, sample count, pan/zoom and phase scrub. Space pauses, H hides controls. Scene links serialize all parameters and the paused phase. Reduced-motion preferences start paused.

PNG and MP4 use a separate GPU canvas at 720, 1080 or 2160 square pixels. MP4 reuses `../../shared/frame-export.mjs`, samples exact frame indices, omits the duplicate endpoint, and supports cancellation and progress. FrameWrap loads on demand; MP4 requires browser WebCodecs support. The UI offers 30/60 FPS; 4K and dense clouds can render substantially slower than playback. A source bundle includes the shared exporter at its original relative path.

## Validation

`node --test dist/experiments/julia-drift/core.test.mjs dist/shared/frame-export.test.mjs`

`PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/julia-drift/tests/browser-test.cjs`

The browser test verifies shader rendering, pixel-exact loop closure and replay, controls, mobile layout, gallery lifecycle, a real 1080 PNG, an eight-second 720p H.264 export, frame count and decoded motion, and repeated export cancellation. It runs in GitHub Actions because this workspace blocks Chromium’s process-singleton socket.
