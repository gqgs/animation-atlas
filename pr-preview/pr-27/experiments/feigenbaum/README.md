# Feigenbaum — Geometry of a limit

Interactive study of Xavier Buff, *Geometry of the Feigenbaum map*, arXiv:math/9711216v2 (11 August 1998), https://arxiv.org/pdf/math/9711216.

Open `index.html` through a static HTTP server (ES module worker requires HTTP). No external dependencies, network services or WebGL required. Canvas 2D visualization with worker-based double-precision computation. Atlas scene ID: `feigenbaum`.

## Explore

- Skeleton: sampled Im(f_n)=0 boundaries, separated by positive/negative real image.
- Nested scales: overlay those boundaries at 1, lambda, lambda² and lambda³, inspired by Figures 6–7. Purple/slate lines are previous scales, cyan/orange the selected scale.
- Image plane: domain coloring by arg(f_n), with log-magnitude bands.
- Click the plane for an orbit under f_n or h_n(z)=f_n(lambda*z). Its image under f_n appears in the inset; in the exact limit this obeys w_next=-lambda*w.
- Drag, wheel zoom, keyboard arrows / +/-; pause, single-step, critical-point/detail/nested presets, animated camera rescaling, PNG export.
- Order 2–7 changes the number of underlying quadratic iterates, 4–128. Compare orders to assess stability.

## Numerical construction and limits

P(z)=1-a*z², a=1.4011551890920506, is conjugate to z²+c with c=-a by z=-a*x. Set s_n=P^(2^n)(0), f_n(z)=P^(2^n)(s_n*z)/s_n. These normalized return maps approach the quadratic renormalization fixed point near zero. lambda=0.3995352805231345 is the positive reciprocal magnitude of the usual negative spatial alpha.

We evaluate finite polynomials directly, not an unvalidated global Taylor series or a decorative fractal substitute. Symmetries and local functional-equation convergence are checked. The orbit h_n is a finite approximation and its attracting fixed point need not equal the zero of f_n exactly. Trajectory segments interpolate between discrete iterates for visibility; they are not continuous-time flow lines.

No claim is made that all displayed curves are accurate curves of the maximal extension. Large arguments, high order, cutoff and boundary undersampling introduce artifacts. Dark pixels mean evaluation exceeded magnitude 1e12 or was nonfinite, not membership in the complement of the dense domain. No rigorous basin/domain classifier is implemented. Overlaying scaled finite skeletons illustrates the puzzle construction but does not compute or certify all chess squares or puzzle pieces. The critical point degree is fixed at 2; changing it requires a different fixed point and constants.

## Validate

`node validate.mjs`

Checks: normalization; even and complex-conjugation symmetry; spatial scaling from successive returns; f_n(1) approaching -lambda; improving linearization residual at three complex probes; positive zero; attracting orbit; overflow handling. Typical maximum residual for n=2…6: 2.73e-4, 6.14e-5, 7.24e-6, 1.43e-6, 1.91e-7.

The browser does not run a scene in the atlas gallery until selected. Closing its iframe terminates the worker and animation. Source bundle contains all experiment files and these checks.

## Order playback and PNG export

Animate order 2 → 7 precomputes all six integer-order fields for the current camera/mode/depth, up to 800 pixels wide. It then plays cached frames without recomputing on every display frame. Control seconds per order, pause/resume/replay, or scrub the timeline. Optional smoothstep crossfades blend images; they do not define fractional iterates or additional mathematical maps. Disable crossfades to hold integer frames. The orbit uses the lower integer order during blends. Pan, zoom, mode, depth, resize or manual order changes exit playback and invalidate the cache. Preparation has visible progress and is cancellable; exiting terminates its worker.

Save PNG now opens a visible preview dialog. Download PNG is a real, user-clicked link to the encoded Blob; Open image and right-click saving provide fallbacks. This avoids relying on an invisible automatic click after asynchronous encoding. In the same-origin Atlas iframe, the explicit click creates the download in the parent document; standalone views use the ordinary link. Export rejects an unfinished field rather than silently downloading a blank canvas. The output captures the displayed field, orbit overlay and an order/blend caption, including intermediate crossfades. Browser download preferences determine whether a native save prompt appears.
