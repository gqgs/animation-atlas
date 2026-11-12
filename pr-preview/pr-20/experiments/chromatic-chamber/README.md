# Chromatic Chamber · Study 020

A dihedral polygon kaleidoscope inspired by Greg Egan’s [Kaleidoscope (2000)](https://www.gregegan.net/APPLETS/13/13.html). This is an independent Canvas 2D implementation; no Egan code or artwork is included.

Serve the atlas `dist/` folder over HTTP and open `experiments/chromatic-chamber/`. No dependencies or build step. Inside a downloaded source bundle, serve its folder directly and open `index.html`.

## Geometry

The fundamental wedge has angle π/n. Each regular polygon is clipped against y ≥ 0 and x sin(π/n) − y cos(π/n) ≥ 0 using half-plane clipping. Copies R(2πk/n)P and R(2πk/n)diag(1,−1)P tile the plane for k = 0…n−1. The result has n-fold rotational symmetry and n mirror axes. Geometry outside the wedge is never painted; shapes crossing its boundaries join their reflections.

Polygon centers follow seed-selected elliptical paths. Polygon rotation advances by 2π/m per loop, where m is the number of sides. Endpoint vertices are cyclically permuted, producing exactly the same shape. Optional whole-chamber rotation adds one full turn per loop. Colors and painter order stay constant, avoiding temporal discontinuities.

`core.mjs` exposes the geometry, seeded generator and palettes. `painter.mjs` draws supplied polygons at an explicit phase; `main.js` handles timeline, scene URLs and export. Regular polygon bases reuse `../../shared/rotation-sequence.mjs`; the source bundle includes this dependency. See `../../shared/benchmarks/README.md` for original-versus-optimized comparisons. The finite polygon field is generated to radius 2.6 in chamber coordinates; very wide views or low magnification may expose its outer edge. Subpixel fill-colored strokes close antialias cracks along mirrors. CPU Canvas performance depends on density, polygon size and resolution; device pixel ratio is capped at 2.

## Controls and captures

- Four compositions: Jewel chamber, Ember bloom, Tidal glass, Porcelain snow.
- Symmetry 3–32, polygon sides 3–8, density, radius, drift, loop duration, magnification, optional whole rotation and mirror guides.
- Seed reproduces an arrangement. New arrangement chooses a new seed.
- Click canvas / Space pauses; H hides controls. Reduced-motion preference starts paused.
- Copy scene link encodes all settings and phase in URL query parameters. Opening it restores a paused frame.
- Save PNG captures the scene without controls at the current canvas size.
- Record loop captures a full loop from zero as WebM, plus a text file containing its replay URL. Real-time recording targets 30 fps and may drop frames. Stopping early saves a partial capture.

## Checks

Run `node --test core.test.mjs`. Checks cover wedge containment for all supported symmetry counts, both mirror joins, rotational copies, seeded replay and loop closure for each polygon family. Browser checks should cover presets, scrubbing, mirror guides, hiding controls and PNG/WebM export.
