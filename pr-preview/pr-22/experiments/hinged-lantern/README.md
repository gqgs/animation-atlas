# Hinged Lantern

A connected ribbon of ten rigid panels curls into a decagonal lantern and returns. Nine vertical hinge edges remain shared throughout. At full closure the two free ends meet; they are not joined by a tenth hinge. This is a 3D articulated strip, not a planar hinged dissection. Inspired by the linkages and folding concepts of [MIT 6.849](https://ocw.mit.edu/courses/6-849-geometric-folding-algorithms-linkages-origami-polyhedra-fall-2012/), checked 2026-11-13.

## Exact kinematics

Each panel has a fixed pentagonal outline with unit width, 2.4-unit vertical sides and a pointed cap. For closure c in [0,1] and cascade k in [0,1], hinge j (0…8) turns by β_j = (2π/10)[c + k c(1−c)(2j/8−1)]. Each panel angle is the sum of upstream hinge angles. The next hinge is placed exactly one unit along the preceding panel’s rotated horizontal axis. Local vertices and ornaments share that rigid transform. A global centering and orientation transform keeps the sculpture in view without changing distances or hinges.

At c=0 all joints are straight; at c=1 every exterior turn is 36°, closing the ten-edge perimeter. Cascade staggers intermediate turns without changing either endpoint. The default shared smootherstep track travels 0 → 1 → 0 in 18 seconds, with zero endpoint velocity. Default zoom also cycles 1 → 1.65 → 1 to keep the compact lantern legible; disable Zoom Cyclic for a fixed camera scale. Orientation and elevation are static by default and support opt-in cycles.

## Validation and limits

Tests check every pairwise vertex distance in every panel and both endpoints of every shared hinge over 603 poses. Endpoint closure, deterministic seeking, loop position/velocity seam and scene URL tracks are checked. A ground-plane segment intersection sweep checks 2,505 poses across closure/cascade bounds for proper interior crossings of nonadjacent zero-thickness panels. This finite sweep is not a general collision-free proof; it does not model panel thickness, hinge hardware or contact. Canvas uses depth-sorted panels and may show visibility artifacts at extreme camera angles. Gold hinge pins and facet lines are illustrative ornament, not extra joints.

## Controls and export

Closure and Hinge cascade are the motion controls. Each continuous parameter uses the shared opt-in cyclic controls. Seek to inspect a pose, share its complete URL, or save a native-resolution PNG. MP4 reuses `shared/frame-export.mjs`, snapshots settings/tracks, samples explicit phase and omits the duplicate endpoint. Offers 720²/1080²/2160² and 30/60 FPS with progress/cancel and explicit WebCodecs errors. Videos remain temporary QA artifacts.

Run `node --test dist/experiments/hinged-lantern/core.test.mjs`. Browser CI checks six phases, pixel-identical loop endpoints, URL tracks, mobile layout, PNG, full 720p/30fps cycle and cancellation. Run it with `PLAYWRIGHT_MODULE=/path/to/playwright node dist/experiments/hinged-lantern/tests/browser.cjs`.
