export const vertexShader = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(2.0 * p - 1.0, 0.0, 1.0);
}
`;

export const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform vec4 foldA;
uniform vec4 foldB;
uniform vec4 amplitudes;
uniform vec4 frequencies;
uniform vec4 phases;
uniform float angle;
uniform float density;
uniform sampler2D ink;
out vec4 color;

vec2 rotate(vec2 p, float theta) {
  float c = cos(theta), s = sin(theta);
  return mat2(c, s, -s, c) * p;
}

vec2 twist(vec2 p, vec4 fold) {
  vec2 d = p - fold.xy;
  return fold.xy + rotate(d, fold.z * exp(-fold.w * dot(d, d)));
}

// In sync with carrier() in field.mjs.
float carrier(vec2 p) {
  p = twist(twist(rotate(p, angle), foldA), foldB);
  p.x += amplitudes.x * sin(frequencies.x * p.y + phases.x);
  p.y += amplitudes.y * sin(frequencies.y * p.x + phases.y);
  p.x += amplitudes.z * sin(frequencies.z * p.y + phases.z);
  p.y += amplitudes.w * sin(frequencies.w * p.x + phases.w);
  return density * (1.24 * p.y + .29 * sin(3.6 * p.x + .66 * sin(2.5 * p.y + phases.y))
    + .075 * sin(7.2 * p.x - 2.7 * p.y + phases.z));
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - resolution) / min(resolution.x, resolution.y);
  float band = carrier(p);

  // Take derivatives before the repeating palette wraps. Mipmaps blend
  // compressed ribbons toward their average instead of undersampling them.
  vec3 pigment = texture(ink, vec2(band, .5)).rgb;
  float footprint = fwidth(band);
  float threads = cos(6.2831853 * 19.0 * band) * (1.0 - smoothstep(.18, .58, 19.0 * footprint));
  float glaze = .94 + .07 * cos(3.3 * p.x - 2.8 * p.y + phases.y)
    + .045 * cos(6.2 * p.x + 4.6 * p.y + phases.z);
  color = vec4(clamp(pigment * (glaze + .055 * threads), 0.0, 1.0), 1.0);
}
`;
