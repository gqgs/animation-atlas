# Hypar

Eight pleated saddle sheets breathe and twist in a traveling wave. Default camera is fixed; the motion comes from the vertices. Wave strength zero freezes the sculpture. Zoom, orientation, elevation, saddle depth and wave strength support opt-in shared cyclic controls. Seek, share a scene URL, save PNG or export a deterministic MP4.

## Construction

Inspired by [Erik Demaine, Martin Demaine and Anna Lubiw’s hypars](https://erikdemaine.org/hypar/) (reference checked 2026-11-13), especially alternating concentric square creases and rings of saddles; see also [MIT 6.849](https://ocw.mit.edu/courses/6-849-geometric-folding-algorithms-linkages-origami-polyhedra-fall-2012/).

The sheet samples y = depth (u² − v²), adding alternating height offsets on 18 square rings. Eight separate sheets sit on a circular arrangement. For sheet i, w = sin(2π phase − 2π i/8) controls saddle depth, anisotropic opening, tilt and height. This is a stylized deforming surface, **not a validated rigid origami simulation**: edge lengths change, sheets are not glued and collision freedom is not claimed across every control combination. Cached square-ring sampling keeps topology fixed. Canvas depth sorting is an illustrative surface renderer, not an exact visibility solver for intersecting sheets.

All geometry and lighting are functions of explicit phase; there is no accumulated simulation or randomness. Integer-frequency sine motion has matching positions and derivatives at the seam. The default 12-second cycle moves one crest around the ring. Shared cyclic tracks also close smoothly. Color follows the wave, while changing surface normals produce light-catching pleats.

## Export and verification

Uses the existing shared parameter controls/tracks and frame exporter. PNG captures the selected pose. MP4 snapshots settings and tracks, renders at native 720²/1080²/2160² and 30/60 FPS, and excludes the duplicate endpoint. Encoding requires browser WebCodecs; progress, cancellation and failures are surfaced. High resolution exports may be slow.

Run `node --test dist/experiments/hypar/core.test.mjs` and `PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/hypar/tests/browser.cjs`. Browser verification covers phase renders, controls, share state, mobile layout, PNG, a complete 720p/30fps cycle and cancellation. Videos are temporary QA artifacts, not repository assets.
