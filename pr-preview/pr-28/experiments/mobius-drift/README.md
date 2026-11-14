# Möbius Drift — Study 019

A continuously moving pole animates the pullback construction described in Greg Egan's Schwarz (1998): https://www.gregegan.net/APPLETS/05/05.html

Independent implementation using bundled Three.js 0.180.0. No applet code or assets copied. The original radial and concentric decorations are extended with spiral rosettes, palettes, closed trajectories, and parameter snapshots.

## Run

Serve the bundle root using `python3 -m http.server 8080`, then open `/experiments/mobius-drift/`. WebGL2 required. Run checks with `node experiments/mobius-drift/validate.mjs`.

## Construction

For screen coordinate z and moving pole p, evaluate h(z) = 1 + 2(1-conj(p)z)/(z-p). This is exactly g(f(z)) for the two maps on Egan's page, away from their singularities; evaluating the composition directly removes the intermediate map's removable singularity. Decorate each unit square at h(z) with concentric circles, radial spokes, or spiral rosettes.

The derivative magnitude is 2(1-|p|²)/|z-p|² for |p|<1. Its pixel footprint attenuates high-frequency decoration and tile contrast. This is an approximate low-pass visualization; it does not recover arbitrarily fine detail or guarantee alias-free sampling. Spiral rosettes and color choices are artistic extensions.

Orbit and integer-frequency Lissajous trajectories close at phase one. The center and path are uniformly scaled when needed to keep every point within |p|<=0.96. The default 120-second orbit is deterministic; fixed-pole mode freezes geometry. Reduced-motion preference starts paused.

Save/load JSON stores all mathematical parameters and timeline phase. Loading pauses. Record loop starts at zero, locks controls, and saves WebM plus its starting parameter JSON. Recording is real-time (30 fps target, 24 Mbps requested); browser performance determines delivered frame rate. Resize during recording can change the capture viewport. PNG/video capture includes only the canvas, never controls.

No feedback, audio response, or multiple-pole blend is included: this first experiment preserves the single Möbius map.
