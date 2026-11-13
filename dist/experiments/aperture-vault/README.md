# Aperture Vault

Eight hinged shutters uncover a small incandescent core. Its WebGL2 point-light shadow maps move over the floor as the shutters open. **Direct only** retains the same cool fill and camera as **Direct + approximate bounce**, which adds one diffuse reflection proxy per inner face. Each proxy scales by the face’s angle and distance to the core; it is unshadowed, so light leaks are possible. Without WebGL2, Canvas 2D projects the panel outlines from the light onto the floor and approximates the bounce with painted light pools. Neither path performs ThreeRT hardware tracing or general global illumination.

Pause or scrub before switching lighting for an A/B at the same pose. The opening track and staggered hinges return to their initial state at the seam. Zoom, camera angles, and motion tracks are shareable in the scene URL.

PNG samples the current phase. MP4 renders a full cycle from phase zero at the selected square resolution and frame rate using the shared deterministic exporter and independently encoded H.264 frames. It requires a browser with WebCodecs H.264 support.

To run the browser regression from the repo root, serve it on port 8780 and run `node dist/experiments/aperture-vault/tests/browser.cjs` with Playwright installed. Set `TEST_MP4=1` for a full 720p/30 fps cycle check with ffprobe.
