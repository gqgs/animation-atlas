// Independent implementation of Nylander's tan(z² + c) spiral family.
export const TAU = 2 * Math.PI;
export const limits = {
  real: [-3, 3], imaginary: [-1, 1], drift: [0, .04],
  centerX: [-2, 2], centerY: [-2, 2], extent: [.015, 2.5],
  iterations: [32, 512], duration: [8, 180], rotation: [0, 360],
  colorCycles: [.2, 2.5], phase: [0, 1],
};
export const defaults = Object.freeze({real:2.0625, imaginary:.1425, drift:.0012,
  centerX:0, centerY:0, extent:.85, iterations:250,
  duration:40, rotation:45, colorCycles:1, palette:'opal', motion:'breathe'});
export const presets = Object.freeze({
  spiral: {...defaults},
  lace: {...defaults, real:1, imaginary:-.38, drift:.003, centerX:0, centerY:0, extent:1.05, rotation:0, palette:'ember'},
  detail: {...defaults, centerX:.788, centerY:1.34690909, extent:.155, rotation:0},
  original: {...defaults, drift:0, centerX:.788, centerY:1.34690909, rotation:0, extent:.14181818, palette:'ink', motion:'still'},
});
export const paletteNames = ['opal', 'lagoon', 'ember', 'ink'];
export const motionNames = ['breathe', 'orbit', 'still'];
export function wrapPhase(phase) { return ((phase % 1) + 1) % 1; }
export function sceneAt(parameters, phase) {
  const t = TAU * wrapPhase(phase), p = {...parameters};
  // Both paths start at the exact selected c and close without a velocity seam.
  if (p.motion !== 'still') {
    p.real += p.drift * (Math.cos(t) - 1);
    p.imaginary += p.drift * Math.sin(t);
  }
  if (p.motion === 'breathe') p.extent *= Math.exp(.08 * (1 - Math.cos(t)));
  return p;
}
export function complexTan(x, y) {
  // Scale away cosh/sinh; this stays finite even for very large |y|.
  const e = Math.exp(-2 * Math.abs(y)), c = Math.cos(x);
  const d = (1 - e) ** 2 + 4 * e * c * c;
  if (d < 1e-24) return null; // numerical neighbourhood of a tangent pole
  return [2 * e * Math.sin(2 * x) / d, Math.sign(y) * (1 - e * e) / d];
}
export function iterate(z, parameter, iterations=250) {
  let [x,y] = z;
  for (let n=0; n<iterations; n++) {
    if (x*x+y*y > 4) return {count:n, stopped:true, pole:false};
    const next=complexTan(x*x-y*y+parameter[0], 2*x*y+parameter[1]);
    if (!next) return {count:n+1, stopped:true, pole:true};
    [x,y]=next;
  }
  return {count:iterations, stopped:x*x+y*y > 4, pole:false};
}
export function readSettings(search) {
  const query = new URLSearchParams(search), parameters = {...defaults};
  for (const [key,[lo,hi]] of Object.entries(limits)) {
    if (key==='phase' || !query.has(key)) continue;
    const raw = query.get(key), v = Number(raw);
    if (raw.trim() && Number.isFinite(v)) parameters[key]=Math.max(lo,Math.min(hi,key==='iterations'?Math.round(v):v));
  }
  if (paletteNames.includes(query.get('palette'))) parameters.palette=query.get('palette');
  if (motionNames.includes(query.get('motion'))) parameters.motion=query.get('motion');
  const raw=query.get('phase'), v=Number(raw);
  return {parameters, phase:raw && Number.isFinite(v)?Math.max(0,Math.min(1,v)):0,
    paused:query.has('phase')};
}
export function settingsQuery(parameters,phase) {
  return new URLSearchParams({...parameters,phase:Math.max(0,Math.min(1,phase))}).toString();
}
export function pointAt(pixelX,pixelY,width,height,p) {
  const unit=2*p.extent/Math.min(width,height), x=(pixelX-width/2)*unit,y=(height/2-pixelY)*unit;
  const a=p.rotation*Math.PI/180, c=Math.cos(a),s=Math.sin(a);
  return [p.centerX+c*x-s*y,p.centerY+s*x+c*y];
}
