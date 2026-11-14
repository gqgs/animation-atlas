import { foldFrame, LOOP_SECONDS, palettePixels, palettes, seedParameters, UINT32_MAX } from './field.mjs';
import { fragmentShader, vertexShader } from './shader.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('art');
const play = byId('play');
const save = byId('save');
const phaseInput = byId('phase');
const time = byId('time');
const seedInput = byId('seed');
const paletteInput = byId('palette');
const search = byId('search');
const results = byId('results');
const status = byId('status');
const error = byId('render-error');

const initial = new URLSearchParams(location.search);
const requestedSeed = Number(initial.get('seed') ?? NaN);
let seed = Number.isInteger(requestedSeed) && requestedSeed >= 0 && requestedSeed <= UINT32_MAX
  ? requestedSeed : 3932820960;
let palette = Object.hasOwn(palettes, initial.get('palette')) ? initial.get('palette') : 'vermilion';
let parameters = seedParameters(seed);
let seconds = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let previous = null;
let animation = 0;
let batch = 2718;
let renderer = null;
const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });

seedInput.value = seed;
paletteInput.value = palette;
play.textContent = playing ? 'Pause' : 'Play';

function message(value) {
  status.textContent = value;
  status.hidden = !value;
}

function setError(value) {
  error.textContent = value;
  error.hidden = !value;
  play.disabled = save.disabled = phaseInput.disabled = Boolean(value);
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function initRenderer() {
  if (!gl) {
    setError('This experiment requires WebGL 2.');
    return;
  }

  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());
    const uniforms = Object.fromEntries(
      ['resolution', 'foldA', 'foldB', 'amplitudes', 'frequencies', 'phases', 'angle', 'density', 'ink']
        .map(name => [name, gl.getUniformLocation(program, name)])
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniforms.ink, 0);
    renderer = { uniforms, maxSize: Math.min(...gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) };
    setError('');
    save.disabled = renderer.maxSize < 4096;
    if (save.disabled) save.title = 'This device cannot render a 4096-pixel canvas.';
    updatePalette();
    draw();
    schedule();
  } catch (cause) {
    console.error(cause);
    renderer = null;
    setError('The WebGL shader could not start.');
  }
}

function updatePalette() {
  if (!renderer) return;

  const samples = palettePixels(palette);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, samples.length / 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, samples);
  gl.generateMipmap(gl.TEXTURE_2D);
}

function draw(exportSize) {
  if (!renderer) return false;

  const cssSize = canvas.clientWidth;
  const size = exportSize ?? Math.max(1, Math.min(renderer.maxSize, 3072,
    Math.round(cssSize * devicePixelRatio)));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (!width || !height || (exportSize && (width !== size || height !== size))) return false;

  const { uniforms } = renderer;
  const frame = foldFrame(parameters, seconds / LOOP_SECONDS);
  gl.viewport(0, 0, width, height);
  gl.uniform2f(uniforms.resolution, width, height);
  for (const key of ['foldA', 'foldB', 'amplitudes', 'frequencies', 'phases']) {
    gl.uniform4fv(uniforms[key], frame[key]);
  }
  gl.uniform1f(uniforms.angle, frame.angle);
  gl.uniform1f(uniforms.density, frame.density);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return true;
}

function syncTimeline() {
  phaseInput.value = seconds;
  time.value = `${seconds.toFixed(1)} / ${LOOP_SECONDS} s`;
}

function tick(now) {
  animation = 0;
  if (previous !== null) seconds = (seconds + (now - previous) / 1000) % LOOP_SECONDS;
  previous = now;
  draw();
  syncTimeline();
  schedule();
}

function schedule() {
  if (playing && renderer && !document.hidden && !animation) animation = requestAnimationFrame(tick);
}

function stopClock() {
  cancelAnimationFrame(animation);
  animation = 0;
  previous = null;
}

function setPlaying(value) {
  playing = value;
  play.textContent = value ? 'Pause' : 'Play';
  if (value) schedule();
  else stopClock();
}

function saveSettings() {
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  url.searchParams.set('palette', palette);
  history.replaceState(null, '', url);
}

function applySeed(value) {
  seed = value;
  seedInput.value = value;
  parameters = seedParameters(value);
  for (const button of results.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.seed) === seed));
  }
  saveSettings();
  draw();
}

play.addEventListener('click', () => setPlaying(!playing));
phaseInput.addEventListener('input', () => {
  setPlaying(false);
  seconds = phaseInput.valueAsNumber;
  syncTimeline();
  draw();
});
paletteInput.addEventListener('change', () => {
  palette = paletteInput.value;
  saveSettings();
  updatePalette();
  draw();
});
byId('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  if (seedInput.checkValidity()) applySeed(seedInput.valueAsNumber);
});

save.addEventListener('click', () => {
  if (!draw(4096)) {
    message('A 4096 × 4096 image could not be rendered on this device.');
    draw();
    return;
  }
  const filename = `sine-tapestry-${seed}-${palette}-${Math.round(seconds * 100)}.png`;
  canvas.toBlob(blob => {
    if (!blob) {
      message('PNG export failed.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, 'image/png');
  draw();
});

function showCandidates(candidates) {
  results.replaceChildren();
  for (const candidate of candidates) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const score = document.createElement('span');
    button.className = 'candidate';
    button.dataset.seed = candidate.seed;
    button.setAttribute('aria-pressed', String(candidate.seed === seed));
    button.textContent = candidate.seed;
    score.textContent = `${Math.round(100 * candidate.score)} / 100`;
    button.append(score);
    button.addEventListener('click', () => applySeed(candidate.seed));
    item.append(button);
    results.append(item);
  }
  results.hidden = false;
}

search.addEventListener('click', () => {
  search.disabled = true;
  message('Scoring 256 candidates…');

  const finish = () => {
    search.disabled = false;
    worker?.terminate();
  };
  let worker;
  try {
    worker = new Worker(new URL('./search-worker.mjs', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      showCandidates(data);
      message(`${data.length} distinct candidates. Select a seed to view it.`);
      batch = (batch + 1) >>> 0;
      finish();
    };
    worker.onerror = () => {
      message('The seed scan could not finish.');
      finish();
    };
    worker.postMessage({ start: batch, count: 256 });
  } catch {
    message('The seed scan could not start.');
    finish();
  }
});

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
