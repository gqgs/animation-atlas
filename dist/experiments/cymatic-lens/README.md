# Cymatic Lens

A procedural light study inspired by optical cymatics: a cyan pupil enclosed by
golden rings and braided outer lobes. No photo pixels are used. Polar harmonics,
pinched level sets and phase-shifted illumination evoke ripples and caustics;
this is not a fluid or optics simulation.

Open the scene in the Atlas, or serve `dist/` and visit `/experiments/cymatic-lens/`.
The standalone ZIP can be served from its extracted root. WebGL 2 is required.

Choose 7–15 standing-wave lobes, change the seed for new radial spacing and
illumination, or shape the flow, pulse, light, zoom and orientation with cyclic tracks. The
pulse ripples outward. Cyclic orientation drives two damped followers, with
more lag toward the outside. Their response is solved in repeating phase so
the lobes can carry through a turn without adding a jump at the loop seam.
Every pose resolves directly from loop phase. The URL stores parameters and any
paused position. The scene starts paused with reduced motion.

Save a 4K PNG of the current pose, or use the shared frame exporter for a
deterministic H.264 MP4 at 720, 1080 or 2160 pixels and 30 or 60 FPS. Recording
starts at phase zero, samples only unique loop frames, and can be canceled.
MP4 requires WebCodecs and the pinned CCapture.js script.
