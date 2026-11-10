# Polynomial Tides · Study 023

An animated interpretation of the quadratic polynomial strange attractors of J. C. Sprott, as collected and colorized by Paul Bourke.

Each of the 12 letters A–Y maps to a coefficient in [-1.2,1.2] at increments of .1. The map is

    x' = a0 + a1*x + a2*x*x + a3*x*y + a4*y + a5*y*y
    y' = a6 + a7*x + a8*x*x + a9*x*y + a10*y + a11*y*y

The geometry is sampled directly from the recurrence, after discarding a transient. The full portrait is a static cached layer with adjustable trace density. Four separate cached colored-filament layers are built from *actual sampled orbit segments*. Their opacity and small affine transformations vary continuously and periodically; the quadratic recurrence itself is unchanged. The motion is an artistic illumination of the invariant portrait, not a physically continuous trajectory between chaotic iterates.

### Smooth motion & performance
The original renderer advanced its filament window by thousands of orbit indices per frame, making sudden visual jumps and recomputing tens of thousands of transformed vertices and expensive glow strokes each frame. Now all paths, shadows, and the background are rasterized once per resolution/slider state; each rendered frame uses five image composites (background plus four filaments). Filaments and trail length therefore mainly affect cache rebuild time, not animation-frame cost. Sliders debounce rebuilding while dragging. The live preview caps its resolution on high-DPI/4K screens; export independently renders at the selected native output size. Loop motion uses smooth sinusoidal functions and exactly agrees at phase 0 and 1.

## Seed discovery
Use **Discover** to sample unbiased random 12-letter seeds. Candidates are filtered for finite bounded trajectories, nontrivial x/y extent, spatial coverage in a 24×24 histogram and positive finite-time largest Lyapunov estimate. Promising candidates are tested over a longer trajectory, then displayed. These are *heuristics*, not a rigorous proof of chaos, persistent boundedness, artistic quality, or historical novelty. Exploration is cancellable. Copy seeds or bookmark scene URLs for reproducibility. The reference selector includes Bourke's example codes.

## Recording
PNG and fixed-timestep MP4 use `../../shared/frame-export.mjs`, drawing directly to the target canvas (720, 1080 or 2160 squared). Frames use a closed phase loop; neither the encoder nor playback clock changes the actual orbit. Export supports progress and cancellation and may take longer than real time.

## Sources
- Paul Bourke: https://paulbourke.net/fractals/sprott/
- J. C. Sprott, "Automatic Generation of Strange Attractors," *Computers & Graphics* 17, 325–332 (1993).

Tests: `node --test dist/experiments/polynomial-tides/core.test.mjs`
