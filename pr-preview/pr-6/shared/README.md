# Deterministic browser frame export

`frame-export.mjs` is deliberately scene-agnostic. It samples frames at `frame / fps` instead of relying on wall-clock time or `canvas.captureStream()`. An injected `createRecorder` adapter owns codec selection, buffering and muxing.

## API

```js
import {exportFrames,loadFrameWrap} from './frame-export.mjs';

const FrameWrap = await loadFrameWrap();
const video = await exportFrames({
  width:1080, height:1080, fps:30, duration:10,
  createRecorder:opts=>new FrameWrap(opts),
  draw:({canvas,ctx,frame,time,phase})=>{
    // Produce the entire frame from time/phase; do not advance by real elapsed time.
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // drawScene(ctx, phase);
  },
  onProgress:(completed,total)=>console.log(completed,total),
});
```

The returned Blob is not downloaded automatically. The consumer owns file naming and saving. A `signal: AbortSignal` cancels without saving a partial video. For unsupported browsers, `loadFrameWrap` or encoding may reject; surface that error to the UI.

## Why CCapture.js v2?

It already provides MP4/WebM WebCodecs encoding and a backpressured `FrameWrap` that does **not** monkeypatch time. This module avoids modifying the page's `requestAnimationFrame` or `Date`. Browser-only CDN loading is optional: `createRecorder` can inject an npm-installed `FrameWrap` (or another compatible encoder).

For future reuse, keep render callbacks pure in `(time, phase)`; derive deterministic random seeds if randomness is involved. Frame sampling is repeatable; compressed bytes are not guaranteed identical across encoders, operating systems and GPU drivers.

Test: `node --test dist/shared/frame-export.test.mjs`

If another project uses this helper, consider extracting it to a separate package with explicit dependencies and integration tests rather than creating a new video codec implementation.
