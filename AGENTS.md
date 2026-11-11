# EigenDynamics Animation Atlas — standing user instruction

The user requested this hub on 2026-10-21 because animation artifacts were getting lost in conversations.

Canonical repository: https://github.com/gqgs/animation-atlas

Add new related experiments to this repository. Preserve working original artifacts and stable scene IDs. Do not create a separate hub. If an original cannot be recovered, label a repository link honestly rather than inventing a working animation.

Catalog: dist/experiments.json. Add an entry with id, title, category, date (creation date), url, description, tags, cover, and source_library_id when available. Add the actual files under dist/experiments and a static cover under dist/covers. Use variants for alternate versions. Covers are mathematical illustrations, not screenshots. Keep the gallery free of running scenes; only launch a selected iframe and destroy it on close or replacement.

This instruction is stored in source and persists with this project. It is not an automatic cross-conversation memory system. Future assistants should retrieve the Animation Atlas when creating related work.

## Animation recording and export

For new Canvas 2D experiments, **reuse the deterministic frame exporter** in `dist/shared/frame-export.mjs` instead of reimplementing `MediaRecorder`, capturing the interactive canvas, or advancing an animation based on the real-time recording clock. Reference implementation: `dist/experiments/chromatic-unwinding/main.js`; integration documentation: `dist/shared/README.md`.

1. **Make drawing independent of playback.** Expose a scene renderer that accepts the drawing target and an explicit `time` or normalized `phase`. Compute the complete visual state for that instant. Avoid advancing mutable simulation state using `requestAnimationFrame` timing during export. If randomness is needed, seed it deterministically; for stateful simulations, use a fixed-step simulation/replay approach rather than assuming a phase alone is sufficient.
2. **Render directly at output resolution.** Use a dedicated square/offscreen export canvas, not the browser viewport or a post-export upscale. Separate responsive preview sizing from export dimensions. Keep line thickness and framing consistent in *output pixels*; don't let viewport dimensions determine exported stroke width.
3. **Use the shared API.** Import `exportFrames` and `loadFrameWrap` from `dist/shared/frame-export.mjs` with the correct relative path. Lazy-load CCapture.js v2's `FrameWrap` only on export. Pass `draw({canvas,ctx,frame,time,phase,frames,fps})` and `createRecorder: options => new FrameWrap(options)`; let the shared module control the loop and encoder lifecycle. It samples `time = frame / fps`, `phase = frame / frames` and deliberately omits the duplicate endpoint frame for seamless loops. Support progress and cancellation; surface browser/WebCodecs failures clearly.
4. **Expose practical export controls.** Prefer 1080 × 1080 and 60 FPS for detailed, fast-moving square animations; also offer 30 FPS and, where feasible, 720p/2160p. Verify supported size, codec, browser performance and output duration. A slow render is acceptable: deterministic output should not drop frames merely because drawing cannot maintain real-time FPS.
5. **Keep master and distribution encodes distinct.** Current CCapture integration emits browser-encoded H.264 MP4. For offline distribution, use FFmpeg on the exported file, preferably retaining a high-quality master. A *provisional tested local result* for Chromatic Unwinding was 1080p HEVC (`libx265`), 60 FPS, CRF 30, approximately 46 MiB from a 305 MiB / 30 s input. This is an experiment-specific result, **not** a universal quality preset; compare visual fidelity and size with short samples. When uploading to X or similar platforms, test the *delivered* transcoded stream: high-frequency colored line art can degrade badly even when the local HEVC file looks good.
6. **Preserve existing behavior and document exports.** Interactive controls and the on-screen preview must keep working. When introducing an exporter, include a brief description in the experiment README, reusable code references, any needed updates to source ZIPs, and basic tests for frame timing, output dimensions, encoder lifecycle and cancellation.

Do not create another recording library merely to integrate a new study. Reuse `dist/shared/frame-export.mjs`. If another repository needs the same functionality, consider promoting the small adapter into a separately versioned package after validating its API in at least two projects; keep encoding/muxing delegated to existing libraries rather than building a new codec.

## Cyclic parameter controls for future experiments

Include opt-in cyclic animation for suitable continuous controls in new experiments, following the shared implementation used by Luminous Loom and Wild Silk. In particular, expose zoom and orientation cycles when the scene supports them. Reuse `dist/shared/parameter-tracks.mjs` and `dist/shared/parameter-controls.mjs`; do not create a separate easing or cycling system.

- Provide Cyclic toggles, lower/upper bounds and the shared easing choices. Use a smooth closed loop (lower → upper → lower), with sensible default motion where it improves the experiment.
- Keep static settings and tracks separate. Resolve values from the explicit normalized scene phase, so playback, arbitrary seeking, PNG and deterministic video export agree. Preserve tracks in scene URLs and snapshot them during export.
- Do not animate seeds, sample counts, discrete topology or the loop duration without a deliberate scene-specific strategy. Do not dispatch slider input events or rebuild simulations every frame. Reuse cached geometry or layers for interactive playback; if native-resolution export needs additional work, keep it deterministic and cancellable and document the cost.
- Verify static fallback, endpoint/seam continuity, URL round trips, busy-state controls and at least one exported cycle. Update source archives with the shared modules required by standalone experiments.
