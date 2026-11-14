# Broken Weave

A companion to Sine Tapestry. The same seeded ribbons now billow around moving
pockets: a region can bunch tightly or close into islands of color while a quieter
region stays open. The shape and motion are procedural, inspired by
[Stuart Smith’s Homage to the Sine](https://medium.com/artique/homage-to-the-sine-640cb9c26d2).

Open the scene through the Atlas or serve `dist/` over HTTP and visit
`/experiments/broken-weave/`. When using the source ZIP, serve the extracted root.
WebGL 2 is required. The default is seed 814066662 and Drift 1.05.
Try Drift **0** to see the original field at the same seed and framing, with new pigment, or
**1.4** for stronger movement. Each pocket shifts on a different periodic path;
local peaks and troughs let contours close without adding random pixel noise.

Rather than choosing named palettes, each seed produces a continuous set of
pigments in OKLCH. Fold compression and moving pockets shift the pigments
locally. **Color drift** controls the strength of those shifts without changing any
ribbon paths; at zero it keeps the seed's base pigments.

**Rendering style** switches between Original ribbons (unchanged default) and
Matte gouache, where overlapping strokes follow the same moving field and use
the same seeded pigments. The change preserves composition and phase. Style is
saved in the URL and in PNG and MP4 exports. Gouache costs more to render;
preview or export at a smaller size if needed.

Drift, color drift, zoom, and orientation support optional cyclic tracks. The normal motion
uses integer harmonics and all values resolve directly from loop phase, including
for arbitrary seeks. Changing duration preserves the current pose. Settings and
tracks are kept in the scene URL, including phase when paused. Reduced motion
starts playback paused.

The seed finder samples the same field and current tracks in a worker. For an
offline scan at default framing and drift, run `node scan.mjs 2718 256` here.
The 4K PNG saves the current pose. MP4 uses the shared deterministic frame
exporter and a separate WebGL canvas; it starts at phase zero and omits the
duplicate endpoint. H.264 requires a browser exposing WebCodecs encoding and
the pinned CCapture.js script. Use Cancel export to stop without saving.

Checks: `node --test dist/experiments/broken-weave/field.test.mjs dist/shared/parameter-tracks.test.mjs dist/shared/frame-export.test.mjs`.
