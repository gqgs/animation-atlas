import { exportFrames, loadFrameWrap } from '../../shared/frame-export.mjs';
import { createParameterControl } from '../../shared/parameter-controls.mjs';
import { parseTracks, normalizeTracks, resolveParameters, serializeTracks } from '../../shared/parameter-tracks.mjs';
import { LOOP_SECONDS, DEFAULT_SEED, definitions, makeOrientationFollower, seedParameters, UINT32_MAX } from './field.mjs';
import { createRenderer } from './renderer.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('art');
const play = byId('play');
const save = byId('save');
const record = byId('record');
const sizeInput = byId('export-size');
const fpsInput = byId('export-fps');
const progress = byId('export-progress');
const exportStatus = byId('export-status');
const phaseInput = byId('phase');
const time = byId('time');
const durationInput = byId('duration');
const durationValue = byId('duration-value');
const seedInput = byId('seed');
const error = byId('render-error');
const modeInput = byId('mode');
const modes = [7, 9, 11, 13, 15];

const initial = new URLSearchParams(location.search);
const requestedMode = Number(initial.get('mode'));
let mode = modes.includes(requestedMode) ? requestedMode : 11;
modeInput.value = mode;
const requestedSeed = Number(initial.get('seed') ?? NaN);
let seed = Number.isInteger(requestedSeed) && requestedSeed >= 0 && requestedSeed <= UINT32_MAX
  ? requestedSeed : DEFAULT_SEED;
let parameters = seedParameters(seed);
const requestedDuration = Number(initial.get('duration'));
let duration = Number.isInteger(requestedDuration) && requestedDuration >= 4 && requestedDuration <= 90
  ? requestedDuration : LOOP_SECONDS;
const settings = Object.fromEntries(Object.entries(definitions).map(([key, definition]) => {
  const value = Number(initial.get(key) ?? NaN);
  const clamped = Math.min(definition.max, Math.max(definition.min, value));
  return [key, Number.isFinite(value) ? Number((definition.min + Math.round((clamped - definition.min) / definition.step) * definition.step).toFixed(2)) : definition.defaultValue];
}));
let tracks = parseTracks(initial.get('tracks'), definitions);
let follower = makeOrientationFollower(tracks.rotation);
const phaseAtOpen = Number(initial.get('phase'));
let seconds = Number.isFinite(phaseAtOpen) ? duration * Math.max(0, Math.min(1, phaseAtOpen)) : 0;
let playing = !initial.has('phase') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
let previous = null;
let animation = 0;
let renderer = null;
let recording = null;

const controls = new Map();
const sample = (phase, source = settings, animationTracks = tracks) =>
  resolveParameters(source, animationTracks, phase, definitions);
for (const [key, label] of [['flow', 'Flow'], ['pulse', 'Pulse'], ['light', 'Light'], ['zoom', 'Zoom'], ['rotation', 'Orientation']]) {
  controls.set(key, createParameterControl({
    parent: byId('wave-controls'), key, label, definition: definitions[key],
    value: settings[key], track: tracks[key],
    onValue(value) { settings[key] = value; saveSettings(); draw(); },
    onTrack(track) {
      tracks = normalizeTracks({ ...tracks, [key]: track }, definitions);
      if (key === 'rotation') follower = makeOrientationFollower(tracks.rotation);
      saveSettings();
      draw();
    }
  }));
}
function syncTrackControls() {
  const resolved = sample(seconds / duration);
  for (const [key, control] of controls) {
    control.sync({ value: settings[key], track: tracks[key], resolved: resolved[key], disabled: !!recording });
  }
}
seedInput.value = seed;
syncTimeline();
play.textContent = playing ? 'Pause' : 'Play';

function syncControls() {
  play.disabled = !renderer || Boolean(recording);
  phaseInput.disabled = !renderer || Boolean(recording);
  modeInput.disabled = Boolean(recording);
  seedInput.disabled = byId('seed-form').querySelector('button').disabled = Boolean(recording);
  syncTrackControls();
  durationInput.disabled = Boolean(recording);
  save.disabled = !renderer || renderer.maxSize < 4096 || Boolean(recording);
  const canRecord = renderer && !sizeInput.selectedOptions[0].disabled;
  record.disabled = !recording && !canRecord;
  sizeInput.disabled = fpsInput.disabled = !renderer || Boolean(recording);
}

function setError(value) {
  error.textContent = value;
  error.hidden = !value;
  syncControls();
}

function initRenderer() {
  try {
    renderer = createRenderer(canvas);
    for (const option of sizeInput.options) {
      option.disabled = Number(option.value) > renderer.maxSize;
    }
    if (sizeInput.selectedOptions[0].disabled) {
      const available = [...sizeInput.options].find(option => !option.disabled);
      if (available) sizeInput.value = available.value;
    }
    save.title = renderer.maxSize < 4096 ? 'This device cannot render a 4096-pixel canvas.' : '';
    draw();
    setError('');
    schedule();
  } catch (cause) {
    renderer = null;
    console.error(cause);
    setError(cause.message);
  }
}

function draw() {
  syncTrackControls();
  if (!renderer) return;
  const size = Math.max(1, Math.min(renderer.maxSize, 1440,
    Math.round(canvas.clientWidth * devicePixelRatio)));
  const phase = seconds / duration;
  renderer.draw({ size, parameters, phase, pose: sample(phase), mode, follower });
}

function syncTimeline() {
  phaseInput.max = duration;
  phaseInput.value = seconds;
  durationInput.value = duration;
  durationValue.value = duration + ' s';
  time.value = `${seconds.toFixed(1)} / ${duration} s`;
}

function tick(now) {
  animation = 0;
  if (previous !== null) seconds = (seconds + (now - previous) / 1000) % duration;
  previous = now;
  draw();
  syncTimeline();
  schedule();
}

function schedule() {
  if (playing && renderer && !recording && !document.hidden && !animation) animation = requestAnimationFrame(tick);
}

function stopClock() {
  cancelAnimationFrame(animation);
  animation = 0;
  previous = null;
}

function setPlaying(value) {
  if (recording) return;
  playing = value;
  play.textContent = value ? 'Pause' : 'Play';
  if (value) schedule();
  else stopClock();
}

function saveSettings() {
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  url.searchParams.set('duration', duration);
  url.searchParams.set('mode', mode);
  for (const [key, value] of Object.entries(settings)) url.searchParams.set(key, value);
  const serialized = serializeTracks(tracks, definitions);
  if (serialized) url.searchParams.set('tracks', serialized);
  else url.searchParams.delete('tracks');
  if (playing) url.searchParams.delete('phase');
  else url.searchParams.set('phase', (seconds / duration).toFixed(8));
  history.replaceState(null, '', url);
}

function applySeed(value) {
  seed = value;
  seedInput.value = value;
  parameters = seedParameters(value);
  saveSettings();
  draw();
}

durationInput.addEventListener('input', () => {
  const nextDuration = durationInput.valueAsNumber;
  if (recording || !Number.isInteger(nextDuration) || nextDuration < 4 || nextDuration > 90) return;
  seconds = seconds / duration * nextDuration;
  duration = nextDuration;
  previous = null;
  syncTimeline();
  saveSettings();
  draw();
});

play.addEventListener('click', () => { setPlaying(!playing); saveSettings(); });
phaseInput.addEventListener('input', () => {
  setPlaying(false);
  seconds = phaseInput.valueAsNumber;
  saveSettings();
  syncTimeline();
  draw();
});
modeInput.addEventListener('change', () => {
  if (recording || !modes.includes(Number(modeInput.value))) return;
  mode = Number(modeInput.value);
  saveSettings();
  draw();
});
byId('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  if (seedInput.checkValidity()) applySeed(seedInput.valueAsNumber);
});

function captureMessage(value) {
  exportStatus.textContent = value;
  exportStatus.hidden = !value;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

save.addEventListener('click', async () => {
  captureMessage('');
  const target = document.createElement('canvas');
  const filename = `cymatic-lens-${seed}-${mode}-${Math.round(seconds * 100)}.png`;
  let output;
  try {
    output = createRenderer(target);
    output.draw({ size: 4096, parameters, phase: seconds / duration, pose: sample(seconds / duration), mode, follower });
    const blob = await new Promise(resolve => target.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser did not encode a PNG.');
    download(blob, filename);
  } catch (cause) {
    captureMessage(`PNG export failed. ${cause.message}`);
  } finally {
    output?.dispose();
  }
});

record.addEventListener('click', async () => {
  if (recording) {
    recording.abort();
    return;
  }
  if (typeof VideoEncoder === 'undefined') {
    captureMessage('MP4 export requires a browser with WebCodecs video encoding.');
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;
  const snapshot = { parameters, duration, mode, follower, settings: { ...settings }, tracks: normalizeTracks(tracks, definitions) };
  const size = Number(sizeInput.value);
  const fps = Number(fpsInput.value);
  const filename = `cymatic-lens-${seed}-${mode}-${size}-${fps}fps.mp4`;
  recording = controller;
  stopClock();
  syncControls();
  record.textContent = 'Cancel export';
  captureMessage('Loading MP4 encoder…');
  let output;

  try {
    let cancelLoading;
    const canceled = new Promise((_, reject) => {
      cancelLoading = () => reject(new DOMException('Export canceled', 'AbortError'));
      signal.addEventListener('abort', cancelLoading, { once: true });
    });
    const FrameWrap = await Promise.race([loadFrameWrap(), canceled])
      .finally(() => signal.removeEventListener('abort', cancelLoading));
    signal.throwIfAborted();

    const target = document.createElement('canvas');
    output = createRenderer(target);
    captureMessage('Encoding loop…');
    progress.max = snapshot.duration * fps;
    progress.value = 0;
    progress.hidden = false;
    const blob = await exportFrames({
      width: size, height: size, fps, duration: snapshot.duration, signal, yieldEvery: 1,
      bitrate: Math.round(24_000_000 * (size / 1080) ** 2 * (fps / 30)),
      createRecorder: options => new FrameWrap(options),
      draw: ({ ctx, phase }) => {
        output.draw({ size, parameters: snapshot.parameters, phase,
          pose: sample(phase, snapshot.settings, snapshot.tracks), mode: snapshot.mode, follower: snapshot.follower });
        ctx.drawImage(target, 0, 0);
      },
      onProgress: (done, total) => {
        progress.max = total;
        progress.value = done;
      }
    });
    signal.throwIfAborted();
    download(blob, filename);
    captureMessage('MP4 export complete.');
  } catch (cause) {
    captureMessage(signal.aborted ? 'Export canceled.' : `MP4 export failed. ${cause.message}`);
  } finally {
    output?.dispose();
    recording = null;
    progress.hidden = true;
    record.textContent = 'Export MP4';
    syncControls();
    schedule();
  }
});

addEventListener('pagehide', () => recording?.abort());

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  stopClock();
  renderer = null;
  setError('The graphics context was lost. Waiting for it to recover…');
});
canvas.addEventListener('webglcontextrestored', initRenderer);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopClock();
  else schedule();
});
new ResizeObserver(() => draw()).observe(canvas);

initRenderer();
