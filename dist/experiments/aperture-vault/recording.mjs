// CCapture.js 2.0.0 exposes the WebCodecs encoder used by FrameWrap.
// Independent H.264 frames avoid predictive residue behind the moving panels.
// Keep this policy local to this scene; timing/lifecycle stay in exportFrames.
export function createIntraRecorder(FrameWrap, options) {
  const recorder = new FrameWrap(options);
  if (!Number.isFinite(recorder.encoder?.keyInterval)) {
    throw new Error('This recorder cannot request independent video frames.');
  }
  recorder.encoder.keyInterval = 1;
  return recorder;
}
