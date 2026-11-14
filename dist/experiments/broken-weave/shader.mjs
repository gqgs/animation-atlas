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
uniform vec4 framing;
uniform vec4 pocketA;
uniform vec4 pocketB;
uniform float density;
uniform float pigmentAmount;
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

float pocket(vec2 p, vec4 shape, float t, float skew) {
  vec2 d = p - shape.xy;
  vec2 v = vec2(d.x + skew * d.y + .09 * sin(8.0 * d.y + t),
    1.32 * d.y + .065 * sin(10.0 * d.x - t));
  return shape.z * exp(-shape.w * dot(v, v));
}

// In sync with carrier() in field.mjs.
float carrier(vec2 p) {
  vec2 uv = rotate(p, framing.y) / framing.x;
  p = twist(twist(uv, foldA), foldB);
  p.x += amplitudes.x * sin(frequencies.x * p.y + phases.x);
  p.y += amplitudes.y * sin(frequencies.y * p.x + phases.y);
  p.x += amplitudes.z * sin(frequencies.z * p.y + phases.z);
  p.y += amplitudes.w * sin(frequencies.w * p.x + phases.w);
  float t = framing.w;
  float crossed = .15 * sin(3.4 * p.x + 2.9 * p.y + t) * sin(2.1 * p.x - 1.9 * p.y - 2.0 * t);
  return density * (1.24 * p.y + .29 * sin(3.6 * p.x + .66 * sin(2.5 * p.y + phases.y))
    + .075 * sin(7.2 * p.x - 2.7 * p.y + phases.z) + framing.z * crossed
    + pocket(uv, pocketA, t, .58) + pocket(uv, pocketB, -2.0 * t, -.35));
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - resolution) / min(resolution.x, resolution.y);
  float band = carrier(p);

  // Normalized gradient: the color response to compression should not
  // change when a still or video is rendered at a different resolution.
  float footprint = fwidth(band);
  float compression = smoothstep(2.5, 19.0, .5 * resolution.y * footprint);
  vec2 uv = rotate(p, framing.y) / framing.x;
  float t = framing.w;
  float eddies = pocket(uv, pocketA, t, .58) + pocket(uv, pocketB, -2.0 * t, -.35);
  float shift = pigmentAmount * (.075 * compression + .12 * eddies
    + .045 * sin(2.4 * uv.x - 2.1 * uv.y + t));
  // Specify the field derivatives explicitly; implicit derivatives of shift
  // would differentiate a derivative and can produce GPU-specific artifacts.
  vec3 pigment = textureGrad(ink, vec2(band + shift, .5),
    vec2(dFdx(band), 0.0), vec2(dFdy(band), 0.0)).rgb;
  float threads = cos(6.2831853 * 19.0 * band) * (1.0 - smoothstep(.18, .58, 19.0 * footprint));
  float glaze = .94 + .07 * cos(3.3 * p.x - 2.8 * p.y + phases.y)
    + .045 * cos(6.2 * p.x + 4.6 * p.y + phases.z);
  color = vec4(clamp(pigment * (glaze + .055 * threads), 0.0, 1.0), 1.0);
}
`;
