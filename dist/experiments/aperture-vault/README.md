# Aperture Vault

Six rigid triangular glass faces close at one apex, then unfold around a hexagonal base. One carries a thick optical wedge. Near closure it intercepts a narrow white beam; the WebGL2 scene and Canvas fallback visualize the same computed ray paths.

The beam intersects the moving prism, applies Snell’s law at two nonparallel surfaces, and intersects the floor. Its index varies with wavelength using [SCHOTT N-SF11](https://media.schott.com/api/public/content/2561be5fa45d40d0b572c2de0604c1bb?v=f5c3d685) coefficients. Switch to **Single index** at closure for an otherwise identical white ray. Thin glass faces, beam haze, and soft light patches are illustrative. No path tracing, scattering simulation, or internal reflections.

Pause and scrub to inspect closure. Loop position, cyclic tracks and the glass mode are shareable. PNG samples the selected pose. MP4 renders the complete cycle from phase zero at the selected square resolution using the shared deterministic exporter and independent H.264 frames; it needs WebCodecs H.264 support.

To run the browser regression from the repo root, serve it on port 8780 and run `node dist/experiments/aperture-vault/tests/browser.cjs` with Playwright installed. Set `TEST_MP4=1` for a full 720p/30 fps cycle check with ffprobe.
