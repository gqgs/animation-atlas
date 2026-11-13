# Aperture Vault

Six rigid glass triangles meet at one apex, then unfold around their fixed hinges. Stationary studio strips travel across the faces as the glass rotates. Switch to **Direct light only** at any paused pose to isolate the reflection layer.

Each strip is a mirrored rectangle projected through the camera and clipped to its glass face. Schlick’s approximation strengthens it at grazing angles. A single ray from each light, reflected at the face centroid, positions a soft, elongated patch on the floor. These are stylized local reflections with no secondary shadows or general path tracing. The WebGL2 and Canvas 2D renderers share the reflection math.

Cyclic tracks, loop position and lighting mode are shareable. PNG samples the selected pose; MP4 renders a full cycle from phase zero at the selected resolution with the shared deterministic H.264 exporter.

For the browser regression, serve the repo root on port 8780 and run `node dist/experiments/aperture-vault/tests/browser.cjs` with Playwright installed. Set `TEST_MP4=1` to also test a complete 720p/30 fps cycle with ffprobe.
