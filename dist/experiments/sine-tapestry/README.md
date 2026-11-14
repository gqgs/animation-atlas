# Sine Tapestry

An animated study of interacting waves and folded color ribbons, inspired by
[Stuart Smith's Homage to the Sine](https://medium.com/artique/homage-to-the-sine-640cb9c26d2).
The source supplies the idea of overlapping sine curves and a square composition.
The folds, palettes and animation are procedural.

Serve the Atlas with `python3 -m http.server 8080 --directory dist` and open
`http://localhost:8080/#scene=sine-tapestry`. For the standalone scene, open
`http://localhost:8080/experiments/sine-tapestry/`. The scene requires WebGL 2. To run it from the source archive, serve the
extracted root over HTTP and open `/experiments/sine-tapestry/`.

## How the image is made

Two localized rotations pull the square into opposing swirls. Four alternating
sine shears bend and stretch the coordinates through both folds. A smooth scalar
field in the warped coordinates indexes a repeating color ramp. Its level sets
are the ribbons. The shader evaluates the field at the canvas resolution and
uses a mipmapped ramp and derivative-filtered threads to soften details that
compress below a pixel.

Fold centers, rotation strengths and wave offsets follow periodic paths with
integer frequencies. The geometry and its motion repeat every 24 seconds.
Scrubbing pauses playback. The scene URL preserves seed and palette. The PNG
export renders the current frame at 4096 × 4096 pixels. Reduced-motion
preferences start playback paused.

## Capturing a loop

**Record loop → Export MP4** renders one 24-second loop at 720, 1080, or
2160 pixels square and 30 or 60 fps. It starts at phase zero and omits the
duplicate closing frame. The renderer snapshots the current seed and palette,
then uses the shared fixed-timestep exporter with a dedicated WebGL canvas.
The on-screen timeline holds its position during recording. Use **Cancel
export** to stop without saving a partial video. MP4 export requires a browser
with WebCodecs H.264 encoding and loads CCapture.js on demand.

## Discovering seeds

The in-scene finder scores 256 deterministic candidate seeds per batch in a
separate worker. Selecting a candidate applies it at the current loop position
and palette, so several compositions can be compared at the same moment.

The search probes a 15 × 15 grid at eight evenly spaced phases:

- Ribbon definition estimates how much of the square supports distinguishable
  bands at a 720-pixel viewing size.
- Contour turning measures the change in contour orientation between neighboring
  points. The score favors moderate turning.
- Deformation measures change in contour orientation from one sampled phase to
  the next, including the loop seam. The score favors moderate change.

Totals weight definition at 38%, turning at 35%, and deformation at 27%.
A coarse map of contour orientations over the loop filters similar candidates
out of the shortlist. These measurements encode an artistic preference for
readable folds and varied motion. The ranking is independent of palette choice.

Run the same search offline with Node.js:

```sh
node dist/experiments/sine-tapestry/scan.mjs 2718 1024
```

The arguments are the starting seed and candidate count. With no arguments, the
scanner matches the first browser batch. Output is JSON with each shortlisted
seed, its total score, and its three raw measurements. The default scene seed
comes from the first batch.
