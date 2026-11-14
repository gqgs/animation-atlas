import { fieldShader } from './shader.mjs';

export const gouacheShader = `${fieldShader}
// A deterministic mark lives in the moving sheet, not in screen pixels.
vec2 hash22(vec2 q) {
  vec3 p = fract(vec3(q.xyx) * vec3(.1031, .1030, .0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xx + p.yz) * p.zy);
}

vec3 inkAt(float value, float dl, float dr) {
  return textureGrad(ink, vec2(value, .5), vec2(dl, 0.0), vec2(dr, 0.0)).rgb;
}

// Overlapping capsules with an irregular mask, varied pigment for each dab,
// and a little broken color at the edge. Width is in normal band units.
vec4 brushLayer(vec2 q, vec2 cell, float bands, float offset, float offsetSeed) {
  vec2 h = hash22(cell + vec2(offsetSeed, 17.3));
  vec2 f = hash22(cell + vec2(28.7, offsetSeed));
  vec2 v = q - cell - vec2(.5) - (h - .5) * vec2(.48, .52);
  v.y += (f.y - .5) * .27 * v.x;
  float tip = (v.x - clamp(v.x, -.24 - .31*h.x, .21 + .35*f.x));
  float grit = .058 * sin(32.0 * v.x + 12.0 * v.y + 18.0 * h.x)
    + .031 * sin(59.0 * v.x - 19.0 * v.y + 28.0 * h.y);
  float d = length(vec2(1.72 * tip, v.y)) + grit;
  float w = .29 + .16 * f.x;
  float aa = clamp(.5 * length(fwidth(q)), .025, .19);
  float mask = (1.0 - smoothstep(w - aa, w + aa, d)) * (.83 + h.y * .16);
  float paint = (cell.y + .5 + (h.y - .5) * .52) / bands + offset;
  // Static per-mark hue breaks and emulsion thickness; matte, no specular.
  vec3 color = inkAt(paint + .095 * (f.x - .5), 0.0, 0.0);
  color = mix(color, vec3(.83, .72, .57), .16 + .23*h.x);
  color *= .79 + .29*f.y;
  float brushRake = sin(48.0 * (v.y + .026 * sin(11.0 * v.x + f.y * 6.28)) + 32.0 * f.x);
  color += .023 * brushRake * (1.0 - smoothstep(.14, .54, length(fwidth(q)) * 7.0));
  return vec4(color, mask);
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - resolution) / min(resolution.x, resolution.y);
  vec3 sheet = carrier(p);
  float band = sheet.x;

  float footprint = fwidth(band);
  float compression = smoothstep(2.5, 19.0, .5 * resolution.y * footprint);
  vec2 uv = rotate(p, framing.y) / framing.x;
  float t = framing.w;
  float eddies = pocket(uv, pocketA, t, .58) + pocket(uv, pocketB, -2.0 * t, -.35);
  float shift = pigmentAmount * (.075 * compression + .12 * eddies
    + .045 * sin(2.4 * uv.x - 2.1 * uv.y + t));
  float dl = dFdx(band), dr = dFdy(band);
  vec3 paper = vec3(.87, .78, .65);
  // Coarse underpainting keeps hues broad instead of tracing every rainbow
  // ridge. Loss of coverage near a band edge isn't a global reduction in opacity.
  float baseBand = band + shift;
  float cells = 3.5;
  float row = baseBand * cells;
  float fracRow = fract(row);
  float z = fracRow - .5;
  float transition = clamp(.10 + footprint*cells, .10, .31);
  float seam = smoothstep(.5-transition,.5+transition,fracRow);
  vec3 underpaint = mix(inkAt((floor(row)+.22)/cells + .08, dl, dr),
    inkAt((floor(row)+1.22)/cells + .08, dl, dr), seam);
  underpaint = mix(underpaint, paper, .19) * .88 + .04;

  // Intermittent paper at the edges of broad paint, using the moving sheet.
  float dry = (.5 + .5 * sin(51.0 * sheet.y + 19.0 * sheet.z))
    * (.5 + .5 * sin(31.0 * sheet.y - 38.0 * sheet.z + 1.4));
  float miss = .66 * smoothstep(.69, .98, dry) * (1.0 - smoothstep(.0, .18, abs(z)));
  vec3 painted = mix(underpaint, paper, miss);
  for (int layer=0; layer<2; layer++) {
    float bands = layer==0 ? 3.9 : 7.0;
    float lengthScale = layer==0 ? 7.5 : 14.5;
    vec2 q = vec2(sheet.y * lengthScale + .48 * sheet.z, band * bands)
      + (layer==0 ? vec2(.72, .33) : vec2(.14, .87));
    vec2 g = floor(q);
    // Neighboring dabs overlap across a cell boundary; no phase switching.
    float rasterGuard = 1.0 - smoothstep(.31, .77, length(fwidth(q)));
    float blend = layer==0 ? .86 : (.44 + .41 * compression);
    for (int y=-1; y<=1; y++) {
      for (int x=-1; x<=1; x++) {
        vec4 mark = brushLayer(q, g + vec2(x,y), bands,
          shift + .055 - (layer==0 ? .33 : .87)/bands, layer==0 ? 2.4 : 42.0);
        painted = mix(painted, mark.rgb, mark.a * blend * rasterGuard);
      }
    }
  }
  // Very quiet substrate texture, fixed in composition space. Can be turned
  // off to judge that the matte strokes are doing the visual work.
  float paperTooth = (hash22(floor(p * 840.0)).x - .5) * .016;
  color = vec4(clamp(painted + paperTooth, 0.0, 1.0), 1.0);
}
`;
