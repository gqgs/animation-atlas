# Chromatic Unwinding · Study 021

An independent Canvas 2D study inspired by fonsi’s “Een coole spiraal” (2020), as presented in [Snapshot.jl’s turtle notebook](https://grouptherapyorg.github.io/Snapshot.jl/notebooks/turtles-art/). No Julia runtime, dependencies or build step. Serve the atlas `dist/` folder and open `experiments/chromatic-unwinding/`, or serve this source bundle directly.

## Construction

For k = 0…N−1, turn clockwise by θ and advance k/(N−1). In screen coordinates the heading is (k+1)θ, with positive y pointing down. With N = 101 this matches the reference’s 0, 0.1, …, 10 step lengths after uniform scaling by 10. At θ = 90° all segments are axis-aligned, tracing an expanding square spiral. At θ = 0° every step points right, producing a line of length N/2.

The colored version overlays paths with angles θ + u·spread·sin(πθ/90), with u evenly spaced across [−1/2, 1/2]. Thus the variation vanishes at both endpoints. Hue varies along each path and across the filament family; no time trails are accumulated. Single turtle path mode removes the extra paths. Choose 101 steps for the reference geometry.

For phase φ, t = (1−cos(2πφ))/2 and θ = 90·expm1(3.2(1−t))/expm1(3.2). A full loop moves square → spiral → line → spiral → square, with zero velocity at its endpoints. The exponential remapping gives low angles more screen time. The combined path bounds are centered and scaled into the viewport every frame; auto framing is a visual choice rather than fixed world-space motion.

## Controls

- Autoplay defaults to a 48-second loop; reduced-motion preference starts paused at the square.
- Angle slider and exact square / 20° spiral / line buttons pause the sweep. Play resumes from that angle on the outbound half of the loop.
- Timeline, step count, filament count, spread, stroke width, duration, magnification, three palettes and a single-path comparison mode.
- Space or click canvas pauses. H hides all controls; H restores them. The hidden show-controls button also appears on hover or keyboard focus.
- Save PNG exports just the canvas at its current resolution (device pixel ratio capped at 2).
- Copy scene link stores parameters and a paused phase or manual angle.
- Record loop records square → line → square as real-time WebM with a 30 fps target and a replay-URL text file. Early stop saves a partial capture. Device load can cause dropped frames. Canvas-only capture excludes controls.

Canvas 2D cost grows with steps × filaments; reduce these for slower machines. Default rendering uses 17,280 colored segments. Paused, unchanged frames reuse the existing image. The line and square endpoints intentionally collapse the filament family, so they look thinner than intermediate ribbons.

## Validation

Run `node --test core.test.mjs`. Checks compare the 101-step reference, square turns and line lengths, loop symmetry/closure, endpoint layer collapse and finite bounds near zero at maximum step count.

During development, an offline Canvas runtime harness also exercised angle presets, scrubbing, play/resume, hiding controls, PNG export, link serialization and palette changes. Square, spiral and line frames were rendered and visually inspected. Browser automation was blocked by the execution environment's socket restrictions and browser URL policy; live browser layout, fullscreen, clipboard permissions and MediaRecorder output remain to be verified in a browser.
