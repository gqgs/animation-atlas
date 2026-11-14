import { frameUniforms } from './field.mjs';
import { fragmentShader, vertexShader } from './shader.mjs';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const error = new Error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  throw error;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
  if (!gl) throw new Error('This experiment requires WebGL 2.');
  let vertex, fragment;
  const program = gl.createProgram();
  try {
    vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
    fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }
  const uniforms = Object.fromEntries(
    ['resolution', 'camera', 'seed', 'wave'].map(name => [name, gl.getUniformLocation(program, name)])
  );
  const vao = gl.createVertexArray();
  const maxSize = Math.min(...gl.getParameter(gl.MAX_VIEWPORT_DIMS), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  return {
    maxSize,
    draw({ size, parameters, phase, pose, mode }) {
      if (size > maxSize) throw new Error(`This device cannot render a ${size} × ${size} canvas.`);
      if (gl.isContextLost()) throw new Error('The WebGL context was lost.');
      if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
      if (gl.drawingBufferWidth !== size || gl.drawingBufferHeight !== size) {
        throw new Error(`The browser could not allocate a ${size} × ${size} drawing buffer.`);
      }
      const frame = frameUniforms(parameters, phase, pose, mode);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.viewport(0, 0, size, size);
      gl.uniform2f(uniforms.resolution, size, size);
      gl.uniform2fv(uniforms.camera, frame.camera);
      gl.uniform4fv(uniforms.seed, frame.seed);
      gl.uniform4fv(uniforms.wave, frame.wave);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
