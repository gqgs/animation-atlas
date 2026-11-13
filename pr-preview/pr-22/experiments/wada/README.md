# Wada · Mirrors of Infinity — Study 018

Serve the atlas root with a static HTTP server and open experiments/wada/.
Three.js r180 is vendored at vendor/0.180.0; no external requests or build required.

The fragment shader traces analytic intersections with four unit spheres at the
vertices of a regular tetrahedron (edge length 2 × spacing). Rays reflect with
`d' = d - 2 dot(d,n) n`. The default touching configuration is inspired by
https://paulbourke.net/fractals/wada/ . Original implementation, no copied images.

Radiant mode accumulates stylized RGB surface lighting with geometric attenuation.
Escape mode labels outward tetrahedron-face crossings after the final reflection;
rays not crossing a forward face are assigned the dark entrance/background.
Reflection-depth mode maps hit counts; unresolved rays are magenta in diagnostics.
Changing spacing changes the scattering system. Finite sampling does not establish
Wada boundaries, and the artistic RGB contributions are not basin membership.

Four presets; aim by dragging, zoom by wheel; H hides UI, space pauses. Timeline
uses a periodic phase. The Motion menu includes all three pairs of breathing,
orbit and rotation, plus all three together; each component shares the same loop
phase so combined modes also close seamlessly. Motion amplitude controls orbit
aim displacement and breathing depth; rotation completes one turn per loop. Record loop resets phase and records one real-time cycle
at a requested 30 fps / 24 Mbps, using supported WebM codecs. UI is not captured.
Browser scheduling and GPU speed determine actual cadence; this is not lossless.
PNG uses the selected render scale. All dependencies are local.

Validation: `node --test experiments/wada/math.test.mjs` (from atlas dist/).
Checks cover tetrahedron tangency, intersection roots, reflection invariants,
and multiple-scattering behavior. JS syntax checks passed. The managed preview
browser reported WebGL2 unavailable, so shader compilation, rendered appearance,
and actual video capture remain unverified on a GPU-capable browser.
