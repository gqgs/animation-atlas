# Polynomial Tides · Study 023

An animated interpretation of the quadratic polynomial strange attractors of J. C. Sprott, as collected and colorized by Paul Bourke.

Each of the 12 letters A–Y maps to a coefficient in [-1.2,1.2] at increments of .1. The map is

    x' = a0 + a1*x + a2*x*x + a3*x*y + a4*y + a5*y*y
    y' = a6 + a7*x + a8*x*x + a9*x*y + a10*y + a11*y*y

The geometry is sampled directly from the recurrence, after discarding a transient. The full portrait is a static cached layer with adjustable trace density. Four separate cached colored-filament layers are built from *actual sampled orbit segments*. Their opacity and small affine transformations vary continuously and periodically; the quadratic recurrence itself is unchanged. The motion is an artistic illumination of the invariant portrait, not a physically continuous trajectory between chaotic iterates.

### Smooth motion & performance
The original renderer advanced its filament window by thousands of orbit indices per frame, making sudden visual jumps and recomputing tens of thousands of transformed vertices and expensive glow strokes each frame. Now all paths, shadows, and the background are rasterized once per resolution/slider state; each rendered frame uses five image composites (background plus four filaments). Filaments and trail length therefore mainly affect cache rebuild time, not animation-frame cost. Sliders debounce rebuilding while dragging. The live preview caps its resolution on high-DPI/4K screens; export independently renders at the selected native output size. Loop motion uses smooth sinusoidal functions and exactly agrees at phase 0 and 1.

## Seed discovery

The original **Strange attractors** search still screens 12-letter random seeds
for finite, bounded orbits, nontrivial x/y extent, 24×24 grid coverage and
positive finite-time largest Lyapunov estimates, followed by a longer confirmation
run. These are heuristics, not formal proofs of chaos.

The new **Shape discovery** target can rank candidates using one of three
objectives:

- **Round rings:** high covariance isotropy (λ_min/λ_max) and radial
  concentration about the sample centroid, with a smaller symmetry weight.
- **Rotational symmetry:** similarity of the orbit's 8×96-bin polar occupancy
  histogram to copies rotated by 2π/m for m=2,…,8, with secondary isotropy
  and radial concentration terms.
- **Balanced geometry:** a weighted combination of all three characteristics.

Shape search does **not** impose a positive Lyapunov exponent: invariant circles
often have one near zero. It does still require substantial two-dimensional
coverage, which deliberately excludes a fixed point or a short periodic cycle,
not all possible quasiperiodic/one-dimensional invariant curves.

Search is cancellable and time-sliced. For each discovery batch, it samples up
to 1,200 random seeds, screens candidates over 9,000 steps, then verifies the
survivors with the full 52,000-point orbit used for display. It ranks up to
16 full-orbit survivors and offers the eight highest-scoring seeds. The best
candidate is shown and saved locally; other finalists can be selected and saved.
Scores are computed from *unaltered dynamical orbit points*, not the moving
visual treatment. A seeded URL can reproduce any chosen shape.

The live **shape-score / rotation-residual correlation** is the Pearson r
across the confirmed candidates from the last geometric search. A negative
value would be consistent with lower residual predicting higher shape scores
*within that selected batch*. Pool sizes are small, and this is exploratory
rather than evidence of a causal or global relationship.

The displayed **linear rotation residual** is
`sqrt((a1-a10)^2 + (a4+a7)^2)`, equal to zero for the linear matrix
`[[p,-q],[q,p]]`. It is a diagnostic to explore potential relationships
between seed coefficients and attractor shape, not a selection constraint.

Metric caveats: isotropy alone cannot distinguish triangular from circular
distributions; radial consistency can prefer thin periodic orbits; a symmetric
histogram does not prove that the map itself has exact rotational symmetry.
Histogram resolution, iteration count, the initial condition, and transient
length can affect all three scores. A generated random code is not necessarily
unpublished or globally novel.

## Recording
PNG and fixed-timestep MP4 use `../../shared/frame-export.mjs`, drawing directly to the target canvas (720, 1080 or 2160 squared). Frames use a closed phase loop; neither the encoder nor playback clock changes the actual orbit. Export supports progress and cancellation and may take longer than real time.

## Sources
- Paul Bourke: https://paulbourke.net/fractals/sprott/
- J. C. Sprott, "Automatic Generation of Strange Attractors," *Computers & Graphics* 17, 325–332 (1993).

Tests: `node --test dist/experiments/polynomial-tides/*.test.mjs`
