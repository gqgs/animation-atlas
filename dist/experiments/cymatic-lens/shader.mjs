export const vertexShader = `#version 300 es
void main() {
  vec2 vertices[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
  gl_Position = vec4(vertices[gl_VertexID], 0, 1);
}`;

export const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 camera;
uniform vec4 seed;
uniform vec4 wave;
out vec4 outColor;

const float TAU = 6.28318530718;

float bell(float x, float width) {
  float z = x / width;
  return exp(-z*z);
}

// Anti-alias the very thin light ridges at the actual output resolution.
float ridge(float d, float width) {
  float aa = max(fwidth(d), .00025);
  return bell(d, width + aa * .6) * width/(width + aa * .6);
}

float fringes(float x, float width) {
  // Derive footprint from the periodic embedding, not the atan branch cut.
  float aa = .5 * length(vec2(fwidth(sin(2.*x)), fwidth(cos(2.*x))));
  return bell(sin(x), width + aa * .42) * (1. - smoothstep(.8, 2.2, aa));
}

void main() {
  vec2 p = (2. * gl_FragCoord.xy - resolution) / resolution.x;
  p /= .91 * camera.x;
  float r = length(p), a = atan(p.y, p.x) - camera.y;
  float t = wave.x, n = wave.y, flow = wave.z;
  float m = n*a + seed.x;
  float drift = flow * (sin(t) + .23 * sin(2.*t + seed.y));
  // Slowly circulating light contrasts with the stationary standing-wave nodes.
  float lantern = .76 + .24 * cos(2.*a - t + seed.y);
  float crosslight = .75 + .25 * cos(3.*a + 2.*t);
  float angular = cos(m);
  float wr = r + (.012 + .011*seed.z) * cos(2.*m + 16.*r)
    * smoothstep(.06,.33,r);
  float ring = .49 + .013*cos(m + .45*drift) + .012*cos(2.*m - .35*drift);
  float irisR = .252 + .003*cos(2.*m) + .003*drift;
  float dr = r - ring;
  float ir = r - irisR;

  vec3 teal = vec3(.032,.39,.50);
  vec3 cyan = vec3(.095,.70,.95);
  vec3 amber = vec3(1.0,.57,.10);
  vec3 warm = vec3(1.0,.91,.69);
  vec3 white = vec3(.88,.97,1.);
  vec3 color = vec3(.0015,.004,.0065);

  float pupilEdge = 1. - smoothstep(irisR-.018,irisR+.022,r);
  float spokes = fringes((2.*m + 8.*r + .38*sin(4.*m - 28.*r + drift)), .21);
  float irisEnvelope = smoothstep(.041,.092,r) * pupilEdge;
  color += teal * (.13 + .33*spokes + .07*cos(7.*m + 22.*r)) * irisEnvelope;
  color += cyan * .18 * bell(r-.061,.023) * (spokes*.65 + .35);
  color += teal * .43 * ridge(r-.046-.002*angular,.0027);
  color += amber * .86 * ridge(r-.025,.0038);
  color += warm * .68 * bell(r,.013);
  color += cyan * .35 * bell(ir,.035);
  color += warm * .91 * ridge(ir,.0039);
  color += amber * .61 * ridge(ir-.014+.002*cos(3.*m),.0036);
  color += cyan * .33 * ridge(ir+.017,.0029);

  // Corrugated water between the pupil and the main rim.
  float annulus = smoothstep(irisR+.018,.31,r) * (1. - smoothstep(ring-.025,ring+.021,r));
  float warpedAngle = 2.8 * sin(11.*wr + .55*angular + .73*drift) * sin(m);
  float fan = fringes(2.*m + warpedAngle + .43*sin(4.*m - 13.*r), .19);
  float ripples = fringes(96.*wr + 1.5*cos(m+11.*r) + .82*drift, .16);
  color += teal * (.15 + .35*fan) * annulus;
  color += white * (.075 + .24*fan + .095*ripples) * annulus * lantern;
  color += amber * .51 * bell(dr,.036) * (.37+.63*pow(.5+.5*angular,3.)) * crosslight;
  color += warm * 1.64 * ridge(dr-.001,.0059);
  color += white * 1.18 * ridge(dr+.012+.007*cos(3.*m - .35*drift),.0037) * lantern;
  color += cyan * .32 * ridge(dr-.018+.006*cos(3.*m),.0027);

  // Outer ring of pinched lobes. Fold contours into each petal, then layer optical
  // fringes along the folds so the pattern reads as water rather than solid pieces.
  float v = (r - .746) / (.189 + .012*seed.w);
  float twist = .43 * sin(11.*r + .65*drift) + .13 * sin(t + m) * flow;
  float f = m + twist;
  float s = 1.85 * sin(.5*f);
  float d = (s*s + v*v + .12)*(s*s + v*v + .12) - 1.25*v*v;
  float gate = smoothstep(.49,.61,r) * (1. - smoothstep(.92,1.04,r));
  float fold = d + .051*cos(4.*f + 17.*r + .55*drift);
  float outerRibs = fringes(43.*fold + 5.*v + 1.1*drift,.17);
  float wing = bell(fold-.60,.24) * gate * bell(v+.03,.60);
  float wingRibs = fringes(54.*fold - 1.3*sin(8.*v) + .65*drift,.17);
  float petals = bell(fold-.21,.22) * gate;
  float contour = ridge(fold-.28,.038) * gate;
  float node = bell(s,.14) * bell(v-.06,.115) * gate;
  float halo = bell(s,.4) * bell(v-.06,.19) * gate;
  float torch = bell(s,.22) * bell(v+.38,.28) * gate;
  float fanCenter = .674 + .065*cos(m + .28*drift);
  float saddleR = r - fanCenter + .012*cos(3.*m + 20.*r);
  float saddleGate = gate * pow(.5-.5*cos(f),2.5) * bell(saddleR,.075);
  float saddlePhase = 92.*saddleR + 4.4*cos(m) + 1.6*sin(38.*r + m) + .65*drift;
  float saddleRibs = fringes(saddlePhase,.16);
  float outerWater = (.21 + .13*cos(3.*m + 22.*r)) * gate;
  color += teal * (outerWater + .58*petals + .51*halo);
  color += cyan * .14 * bell(fold-.29,.36) * gate;
  color += amber * .26 * bell(s,.43) * bell(v+.47,.39) * gate * crosslight;
  color += cyan * (.86*contour + .56*outerRibs*petals + wing*(.15 + .32*wingRibs)) * lantern;
  color += teal * (.41 + .19*saddleRibs) * saddleGate;
  color += white * (.27*saddleRibs + .1*ridge(saddleR,.008)) * saddleGate * crosslight;
  color += warm * .11 * bell(saddleR+.018,.018) * saddleGate;
  color += amber * (.88*torch + .68*node) * crosslight;
  color += white * (.53*node + .36*outerRibs*torch);
  color += cyan * .52 * ridge(r-.67-.097*angular,.0041) * gate
    * (.4 + .6*pow(.5+.5*cos(m + 1.2),2.));
  color += cyan * .23 * ridge(r-.872-.062*cos(m - .41*drift),.0038) * gate;

  float edge = 1. - smoothstep(.88,1.066,r);
  color *= edge * (.91 + .09*cos(a - .65 + .22*sin(t))) * wave.w;
  outColor = vec4(1. - exp(-1.25*color), 1);
}`;
