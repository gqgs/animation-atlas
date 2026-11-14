# Geometry of Disappearance · Study 017

A browser-local unbalanced optimal transport experiment, following the Atlas's
Spectral Metamorphosis study. Adjust the relative cost of reaction to reveal
whether mass moves, or disappears here and emerges elsewhere.

## Mathematical model

Wasserstein–Fisher–Rao / Hellinger–Kantorovich with action
∫ρ(|v|² + κ²α²/4), subject to ∂tρ + div(ρv) = ρα. Distance is displayed
in normalized scene units. The travel cutoff is πκ/2.

For weighted endpoint atoms a_i and b_j, solve entropy transport with cost
c_ij = −2 log cos(distance/κ) inside the cutoff, infinity outside:

    min_γ <c,γ> + KL(γ1 | a) + KL(γᵀ1 | b) + ε KL(γ | a⊗b)

ε = 0.035. Log-domain unbalanced Sinkhorn updates use exponent 1/(1+ε),
up to 320 iterations, stopping when the scaling update is below 1e−9.
No spatial pairing is prescribed. Each accepted edge supplies two semi-coupling
masses A_ij = γ_ij a_i / row_i and B_ij = γ_ij b_j / col_j.
These give the exact endpoint marginals. Cone interpolation uses angle
θ_ij = distance/κ, radial coordinate r=√mass, and straight lines in the
unfolded two-dimensional cone sector. Physical spatial paths remain straight;
their time parameter is nonlinear. Disconnected endpoint mass follows quadratic
reaction at fixed positions. Branches with min(A,B)<1e−9 are replaced with
local reactions; endpoint mass is retained. Tiny floating-point remainders
below 1e−14 are ignored.

The coupling is entropically regularized, so the shape path is an approximation
to an HK geodesic. It is not an exact continuum optimizer. The two-atom preset
recovers the exact HK formula below cutoff and pure reaction above it. At exact
cutoff the implementation selects pure reaction among non-unique geodesics.
No continuum accuracy or rigorous error bound is claimed.

Rendering uses fixed additive glow kernels. The scalar mass graph is calculated
from the branch masses independently of rendering; no per-frame normalization
is applied. Glow, palette, clipping and kernel smoothing are display choices.
The comparison is quadratic local Fisher–Rao reaction, not a linear opacity
crossfade. Endpoint supports in the supplied presets are distinct. The graph's
solid amber curve is the computed path, dashed teal is the reaction comparison.

## Interaction

Four distribution presets, manual or automatic phase, reaction-cost scale,
unequal destination mass, three palettes, comparison, endpoint/path guides,
cycle duration, title visibility, panel toggle, fullscreen, and PNG export.
Reduced-motion starts paused; hidden documents do not advance simulation time.
Space toggles playback outside form controls. Double-click the field to hide
the title. Solver runs in a module worker with stale-response rejection.
The sampling is deterministic. No external runtime dependencies or requests.
Serve the Atlas's dist directory with a static HTTP server; workers need HTTP.

    node validate.mjs

Checks exact atoms, cutoff, quadratic reaction, coincident square-root mass,
near-conservative large-scale limit, endpoint masses and positions, finite
intermediates, time-reversal mass symmetry, solver residual, control response,
and full 144-atom production grids. Results are saved to validation.json.

## References

Chizat, Peyré, Schmitzer & Vialard, Unbalanced Optimal Transport:
Dynamic and Kantorovich Formulations. https://arxiv.org/abs/1508.05216

Liero, Mielke & Savaré, Optimal Transport in Competition with Reaction:
The Hellinger–Kantorovich Distance and Geodesic Curves.
https://doi.org/10.1137/15M1041420

The implementation is an independent finite numerical study inspired by this
framework; it does not reproduce every algorithm or theorem in these papers.
