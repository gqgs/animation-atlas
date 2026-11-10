# Coalescing Saddles — Catastrophe Interference / Atlas 015

Elliptic umbilic canonical integral from NIST DLMF 36.2.2 and 36.2.5:

    Ψ(x,y,z) = ∬ exp(i [s³ − 3st² + z(s²+t²) + xs + yt]) ds dt

A 60-second cosine sweep z=4 cos(2πt/60) traverses −4≤z≤4. This is a control-parameter animation, not physical time evolution. Reduced-motion users start paused. Reference buttons select z=0,2,4 and pause. Scrubbing pauses; state links open paused. All runtime assets are local, no CDN or GPU requirement. The gallery launches the scene only on demand.

## Views and overlays

- Phase: fixed cyclic hue of arg Ψ; −π/+π red, 0 cyan. Brightness fixed.
- Luminous: same phase hue, brightness .08+.92(1−exp(−exposure |Ψ|²)).
- Intensity: fixed-exposure tone mapping of |Ψ|², with a dark-indigo/copper/cream palette. No per-frame normalization.
- Caustic: exact analytic parameterization from DLMF 36.4.10. It marks saddle mergers, not zeros of Ψ.
- Phase zeros: cell winding with Newton refinement on bilinear complex samples. Rings are grid-resolved estimates, without claims of exhaustive zero counts or conserved tracked identities. At |z|≤.015 isolated-vortex markers are suppressed because the z=0 field is real, with nodal curves.
- Optional phase contours at π/4, PNG export, quiet mode, shareable state.

## Reproduce

Python 3 with NumPy and SciPy, about 2 minutes and 2 GB working memory on this environment:

    python generate.py
    python generate.py --validate
    node validate.mjs

The standalone source ZIP omits the 34.4 MB generated field chunks; reproduce with generate.py, or copy the field-*.bin chunks from the deployed experiment directory. Place the directory under experiments/coalescing-saddles in a static root; the gallery and source links expect the Atlas directory structure. Serve the root with a static HTTP server. Modules/workers require HTTP(S), not file://. In the source ZIP, validate.mjs's final Atlas integration check also requires the parent experiments.json and source ZIP. The field is split into nine chunks under the hosting asset-size limit. The canonical complete source is the Atlas Site's Git repository.

## Numerical method and limitations

A C∞ radial aperture is 1 for r≤6 and 0 for r≥8. Positive-sign FFT quadrature uses 4096² points in [−24,24)². The window is applied to the integrand; it is not a mask on the displayed x,y plane. Output frequencies kπ/24, k=−115…115, give 231² samples over [−15.05346,15.05346]². Complex samples at 161 slices z=0…4, Δz=.025, are stored as little-endian IEEE binary16 real/imaginary pairs. Ψ(x,y,−z)=conj Ψ(x,y,z), derived by (s,t)→(−s,−t).

Between z slices the Cartesian complex field is linearly interpolated; spatial interpolation is separable Catmull–Rom. Hue is computed only after interpolation. Both introduce visual approximation, especially near zeros and fine fringes. This is a numerical artwork, not a special-function evaluator. Zero extraction uses the underlying 231² grid, not interpolated display pixels.

Validation in validation.json compares z=0,2,4 with 6144² quadrature, then independently expands the unit aperture to r=8 and its outer radius to 10. Maximum observed aperture change: 2.284e−7 in complex amplitude. Resolution differences: <1.5e−15. At the origin, the independent analytic value 2π Γ(1/3)/(3·2^(1/3) Γ(2/3)) = 3.2886794109041237 agrees to 3.08e−12 before storage. Binary16 error at z=4: maximum .000988, relative L2 .000208. A midpoint near z=4 has temporal interpolation relative L2 error .00544, max amplitude error .00912. These are sampled checks, not uniform error bounds. Relative phase error is unbounded near a true zero.

Rendering uses Canvas 2D from a worker, capped at a 512² raster and at most 30 requested frames/s; actual frame rate depends on the browser/CPU. No unsupported performance guarantee. Worker terminates with its iframe. Hidden documents stop requesting frames; hidden duration does not advance the sweep.

## Primary references

- https://dlmf.nist.gov/36.2 — normal form and canonical integral
- https://dlmf.nist.gov/36.3#F17 — phase at z=4, motivating this experiment
- https://dlmf.nist.gov/36.4#E10 — analytic caustic
- https://dlmf.nist.gov/36.15 — numerical-computation context

Created 2026-10-29. Generated from the integral; no NIST images are embedded or recolored.
