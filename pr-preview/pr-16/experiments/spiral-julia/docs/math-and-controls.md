# Spiral Julia: math and controls

## Sources and interpretation

The requested reference is [Paul Bourke, Spiral Julia (March 2022)](https://paulbourke.net/fractals/spiraljulia/), inspired by Paul Nylander. The formula and traditional parameter follow [Nylander's original Spiral-Shaped Julia Set Fractal (March 14, 2004)](https://nylander.wordpress.com/2004/03/14/spiral-shaped-julia-set-fractal/).

This study independently computes the field. No reference images, source code, or palettes are bundled. The two primary compositions use the reference parameter families, with original framing and color design rather than claiming a pixel-identical reproduction:

- **Pearl spirals:** c = 2.0625 + 0.1425i. A rotated central field of pale cells and nested spiral chains.
- **Ember lace:** c = 1 − 0.38i. A denser cellular field with porcelain islands, charcoal pockets and warm fine detail.
- **Into the spiral:** the traditional parameter near Nylander's spiral crop.
- **Nylander's crop:** the traditional parameter, no motion, monochrome, center (0.788, 1.34690909) and square half-extent 0.14181818. Nylander's published rectangle has a slightly different aspect ratio; our square preserves isotropic scale rather than stretching it.

## Orbit calculation

Each pixel supplies an initial complex point z₀. Repeatedly evaluate zₙ₊₁ = tan(zₙ² + c), stopping at the first observed |z| > 2 or the iteration cap. Nylander's example uses a magnitude-two stopping test and 250 iterations. We make the tested initial point and terminal step explicit in `core.mjs` and `renderer.mjs`.

**This is a finite threshold visualization, not a rigorous escape classifier.** Unlike a quadratic polynomial, the meromorphic tangent map has no general radius-two escape guarantee. Large values can return. An unclassified pixel merely did not cross the threshold before the cap. Increasing the cap changes some fine boundaries. We do not claim proof of membership in the mathematical Julia set.

Writing z²+c = u+iv, tan(u+iv) has real numerator sin(2u), imaginary numerator sinh(2v), and denominator cos(2u)+cosh(2v). The implementation scales by exp(−2|v|). With e = exp(−2|v|), it uses denominator (1−e)² + 4e cos²(u), real numerator 2e sin(2u), and imaginary numerator sign(v)(1−e²). This avoids hyperbolic overflow and cancellation near a pole. CPU and GPU use small denominator guards appropriate to their precision; unresolved boundaries and pole neighborhoods are approximate.

Color is based on log(1 + crossing count), with artistic interpolation between the last in-range radius and the first crossing. This interpolation is not a polynomial smooth-escape potential. Four subpixel samples soften boundaries. GPU `highp` floats limit deep magnification; extent is bounded at 0.015, not marketed as unlimited zoom. The even map gives half-turn symmetry in centered compositions.

## Motion and navigation

With phase φ and t = 2πφ, motion follows c(t) = c₀ + drift · [(cos t − 1) + i sin t]. It begins at the selected exact parameter and closes with matching velocity. Breathe additionally multiplies the camera extent by exp[0.08(1−cos t)]. Camera center and rotation remain fixed. There is no random or accumulated simulation state.

- Pause/Play or Space changes playback. Reduced-motion preference starts paused.
- Choose Still for the exact static parameter. Choose parameter-only motion to avoid camera breathing.
- Drag to pan, scroll to zoom around the pointer, pinch to zoom, double-click to center. Keyboard-accessible sliders provide equivalent camera control.
- H hides controls; the return button remains visible on touch devices.
- Links store parameter values, camera, palette and phase, and restore a paused view.
- Reset view returns the current named composition to its defaults; a custom composition resets to Pearl spirals.

## Capture

PNG and MP4 use the chosen square output size, separate from the responsive preview. A dedicated WebGL2 canvas renders directly at 720², 1080² or 2160². MP4 copies that canvas pixel-for-pixel to the existing shared 2D exporter; it never upscales the viewport or records a real-time canvas stream.

MP4 uses `../../shared/frame-export.mjs`, including the existing lazy-loaded CCapture.js v2 FrameWrap. Export samples phase = frame / frames and omits the duplicate endpoint. Choose 30 or 60 FPS, with 1080²/60 FPS offered by default. Parameters are frozen during export, controls are disabled, progress updates each frame, cancellation discards incomplete output, and prior playback resumes afterward. The whole loop starts at phase zero even if the preview is paused elsewhere. A companion text file saves its replay URL.

Interactive rendering and PNG need no network. MP4 requires an internet connection for the existing pinned jsDelivr encoder, WebCodecs/H.264 support and enough memory for the selected output. Failure is shown in the capture status. 2160²/60 FPS can be slow and memory-intensive; start with 720²/30 FPS for compatibility. Export is allowed to run slower than real time without dropping frames. Compressed output may differ across GPU/codec implementations.

## Source bundle

`downloads/spiral-julia-source.zip` includes this experiment under `experiments/spiral-julia/` plus `shared/frame-export.mjs` and its tests. Serve the extracted root with `python3 -m http.server 8080`, then visit `/experiments/spiral-julia/`. The back-to-gallery link only resolves inside the full Atlas.
