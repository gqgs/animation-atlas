# Loop discovery

“Find a moving loop” complements the existing coefficient search. Broad loop search draws from the current seed, the most recent shape results and saved forms, and the two built-in presets (up to eight distinct seeds). It does not invent new equations. First find forms with the original broad/near-seed search, then explore their motion here.

Each batch proposes 32 complete configurations: seed, wave strength, light motion, camera track bounds and easing. Near-current and card Variations keep the exact seed and make smaller mutations of motion settings. Palette, exposure, framing and duration retain the starting configuration. Favorites save the whole configuration locally, not just the seed. Load a favorite and copy its scene URL for a portable copy. No previews are uploaded.

## Screening, not taste

Each proposal uses 120,000 iterates and 24 frames at 96². The same preview painter is sampled at explicit phases, with a separate phase-one endpoint check. A fixed-camera/fixed-light pass measures wave deformation independently of camera/illumination. The final-composition pass measures frame differences, coverage change and border crowding. Very sparse, nearly static, seam-mismatched or border-heavy candidates are omitted from the curated view. Border crowding is a proxy for possible clipping, not a precise clipping detector. Smoothness between the sampled phases is not guaranteed.

The gallery retains variety by round-robin across a 3×3 descriptor grid (intrinsic deformation × coverage change). It does not maximize complexity or claim an aesthetic score. The unfiltered view shows the first nine random proposals from **the same evaluated batch**, including screening failures. Compare keepers in both views rather than assuming curation is better. Preview playback holds sampled frames at the original loop timing, so load a candidate to see smooth playback. The saved-loop list loads configurations without rebuilding all saved previews.

The lower sampling budget can miss late orbit escapes or fine-detail aliasing. Loading repeats the regular 1.2-million-point validation; full-size inspection and export remain required. Existing PNG/MP4 output renders from the selected configuration, not the gallery thumbnails. Seeds preserve coefficients but floating-point trajectories can differ across engines. The printed batch number identifies the deterministic proposal RNG; favorites/scene URLs are the supported way to preserve individual results.

Stop, a newer batch, form-search restart and export cancel pending loop analysis. Partial completed candidates remain available after Stop. Changing main sliders during a batch does not mutate its snapshot. Two batches cannot publish stale results over one another. No workers or continuous background discovery run after the page closes.
