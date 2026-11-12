# Geometric Bloom

Six rigid triangles unfold a hexagonal pyramid into a connected flower-shaped net. Opening, zoom, orientation and elevation share the atlas's cyclic controls.

Serve the repository and open this folder. Drag the loop position to inspect a pose; export PNG or a deterministic MP4 at 720², 1080² or 2160².

## Construction

Each apex rotates in its face's radial vertical plane about the fixed base-edge midpoint. With base apothem a = cos(π/6), height h and slant altitude L = √(a²+h²), its radius is a + L cos θ and height L sin θ, where θ travels from atan2(h,−a) to 0. Edge lengths remain constant. Each triangle stays within its own 60° radial sector and above the base, so face interiors do not collide during this specific bloom. Surface subdivisions are decorative, not additional hinges.

Inspired by [continuous blooming](https://erikdemaine.org/papers/Blooming_GC/), not an implementation of the general convex-polyhedron algorithm. Height changes the source pyramid. Camera and opening are display/hinge parameters; there is no elastic simulation.

## Export

Uses shared parameter tracks and deterministic frame-export. Export snapshots controls, renders at native output resolution and omits the duplicate final frame. H.264 MP4 uses browser WebCodecs; unsupported combinations report an error. Cancel restores controls. PNG captures the currently selected phase.

Run geometry and loop tests: `node --test dist/experiments/geometric-bloom/core.test.mjs`.
