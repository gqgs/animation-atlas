import { foldFrame, weavePigment } from './field.mjs';
import { fragmentShader, vertexShader } from './shader.mjs';
import { gouacheShader } from './gouache.mjs';

export const normalizeStyle = value => value === 'gouache' ? 'gouache' : 'original';
const shaderFor = style => style === 'gouache' ? gouacheShader : fragmentShader;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = new Error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw error;
  }
  return shader;
}

const vectors = ['foldA', 'foldB', 'amplitudes', 'frequencies', 'phases', 'framing', 'pocketA', 'pocketB'];

function prepareProgram(gl, style) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const program = gl.createProgram();
  try {
    const fragment = compile(gl, gl.FRAGMENT_SHADER, shaderFor(style));
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.deleteShader(fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    gl.deleteShader(vertex);
  }

  const uniforms = Object.fromEntries(
    ['resolution', ...vectors, 'density', 'ink', 'pigmentAmount']
      .map(name => [name, gl.getUniformLocation(program, name)])
  );
  return { program, uniforms };
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
  if (!gl) throw new Error('This experiment requires WebGL 2.');

  const programs = new Map();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.activeTexture(gl.TEXTURE0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const maxSize = Math.min(...gl.getParameter(gl.MAX_VIEWPORT_DIMS), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  let activeSeed;

  return {
    maxSize,
    draw({ size, parameters, seed, phase, pose, style }) {
      if (size > maxSize) throw new Error(`This device cannot render a ${size} × ${size} canvas.`);
      if (gl.isContextLost()) throw new Error('The WebGL context was lost.');
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      if (gl.drawingBufferWidth !== size || gl.drawingBufferHeight !== size) {
        throw new Error(`The browser could not allocate a ${size} × ${size} drawing buffer.`);
      }
      style = normalizeStyle(style);
      if (!programs.has(style)) programs.set(style, prepareProgram(gl, style));
      const { program, uniforms } = programs.get(style);
      gl.useProgram(program);
      gl.uniform1i(uniforms.ink, 0);
      if (seed !== activeSeed) {
        const samples = weavePigment(seed);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, samples.length / 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, samples);
        gl.generateMipmap(gl.TEXTURE_2D);
        activeSeed = seed;
      }
      const frame = foldFrame(parameters, phase, pose);
      gl.viewport(0, 0, size, size);
      gl.uniform2f(uniforms.resolution, size, size);
      for (const name of vectors) gl.uniform4fv(uniforms[name], frame[name]);
      gl.uniform1f(uniforms.density, frame.density);
      gl.uniform1f(uniforms.pigmentAmount, pose.pigment);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vao);
      for (const {program} of programs.values()) gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
