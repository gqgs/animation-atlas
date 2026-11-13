# Aperture Vault

Six rigid glass triangles meet at one apex, then unfold around their fixed hinges. Stationary studio strips travel across the faces as the glass rotates. Switch to **Direct light only** at any paused pose to isolate the reflection layer.

Each strip is a mirrored rectangle projected through the camera and clipped to its glass face. Schlick’s approximation strengthens it at grazing angles. A single ray from each light, reflected at the face centroid, positions a soft, elongated patch on the floor. These are stylized local reflections with no secondary shadows or general path tracing. The WebGL2 and Canvas 2D renderers share the reflection math.

The rotating, faceted core sits inside a three-ring cage. **Core color** and **Core intensity** drive the gem, nearby illumination, and core-derived floor patches together, without changing the studio strips. Zero intensity disables core lighting; the cage and studio lights stay visible. WebGL2 uses a point light; the Canvas renderer approximates its nearby falloff with soft projected pools. Intensity can use a cyclic track.

Cyclic tracks, loop position, core color and lighting mode are shareable. PNG samples the selected pose; MP4 renders a full cycle from phase zero at the selected resolution with the shared deterministic H.264 exporter.

For the browser regression, serve the repo root on port 8780 and run `node dist/experiments/aperture-vault/tests/browser.cjs` with Playwright installed. Set `TEST_MP4=1` to also test a complete 720p/30 fps cycle with ffprobe.
