# Spectral Metamorphosis · Study 016

A dependency-free, browser-local scalar Gaussian texture study, inspired by:
Gui-Song Xia, Sira Ferradans, Gabriel Peyré and Jean-François Aujol,
*Synthesizing and Mixing Stationary Gaussian Texture Models*, SIAM Journal on
Imaging Sciences 7(1), 476–508 (2014). https://doi.org/10.1137/130918010

The publisher's abstract describes stationary Gaussian texture models and
optimal-transport interpolation. This implementation independently derives and
implements the scalar commuting-covariance case on a periodic discrete grid;
it does not reproduce exemplar fitting, multichannel covariance interpolation,
or the learned autoregressive dynamics of the full paper.

For analytic power spectra PA and PB, the shared-noise scalar Gaussian W2 path
has Hm = (1-m) sqrt(PA) + m sqrt(PB), Pm = Hm². Synthesis uses independent
complex Gaussian modes with conjugate symmetry and a normalized inverse 2D FFT.
The two endpoints have equal expected variance. The same random Fourier
realization is retained across the morph; its phases evolve continuously.
Directional lobes yield filaments. An isotropic low-pass spectrum yields clouds.
The default automatic sweep runs a complete A→B→A cycle in 32 simulation seconds.

The comparison uses independent endpoint realizations and blends scalar values
before the same nonlinear display map. With a shared realization, the optimal
amplitude interpolation is also a linear blend of *coupled* endpoint fields.
There is no frequency-mass advection. Phase drift/modulation and the display
palette are artistic extensions. No per-frame variance normalization is used.
The spectral thumbnail is analytic log model power, normalized for readability;
its brightness should not be read as absolute variance. Changing coherence or
orientation uses a short smooth transition. At fixed parameters and time,
rotation of each circular complex Gaussian coefficient preserves its marginal law.

## Run and verify

Serve this directory with any static HTTP server and open index.html.
No network calls, packages, GPU features, or external fonts are required.

    node validate.mjs

This writes validation.json and checks the FFT round trip, endpoint expected
variance, realness, seeded reproducibility, geodesic amplitudes, independent
crossfade variance, shared-coupling linearity, small temporal steps, 90° rotation,
and Parseval energy. Additional production-grid checks use a 256² field.

Controls: pause/play (Space when outside controls), manual/automatic morph,
anisotropy, orientation, phase evolution, temporal coherence, cycle duration,
comparison view, palette, resolution, contrast, deterministic reseeding, PNG
export, fullscreen, and a collapsible control panel. Double-click the field to
hide/show its title overlay. Reduced-motion preference starts paused.

128² is the light setting; 256² is default; 512² is the optional fine setting.
The loop targets 30 fps (20 at 512²), pauses progression in hidden documents,
and caps large frame steps. Actual speed depends on the browser and CPU.
