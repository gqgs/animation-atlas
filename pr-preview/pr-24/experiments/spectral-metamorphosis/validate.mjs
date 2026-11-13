import {SpectralField,fft} from './core.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const n=64,f=new SpectralField(n,16031),tolerance=1e-10,results={};
const r=Float64Array.from({length:64},(_,i)=>Math.sin(i*.74)+Math.cos(i*.29)),im=new Float64Array(64),original=r.slice();fft(r,im);fft(r,im,true);results.fftRoundtripMaxError=Math.max(...r.map((v,i)=>Math.abs(v-original[i])));assert(results.fftRoundtripMaxError<tolerance);
results.endpointExpectedVariances=[f.a,f.b].map(h=>2*h.reduce((s,v)=>s+v*v,0)/n**4);for(const e of results.endpointExpectedVariances)assert(Math.abs(e-1)<tolerance);
const field=f.synth(.43,12).slice();results.imaginaryLeakage=Math.max(...f.im.map(Math.abs));assert(results.imaginaryLeakage<tolerance);assert(field.every(Number.isFinite));
const same=new SpectralField(n,16031).synth(.43,12);assert.deepEqual(field,same);results.deterministicSeed=true;
const pa=f.power(0),pb=f.power(1),pm=f.power(.5),pc=f.power(.5,true);let geodesic=0,independent=0;for(let i=0;i<pm.length;i++){assert(Math.abs(pm[i]-(.5*Math.sqrt(pa[i])+.5*Math.sqrt(pb[i]))**2)<1e-8);assert(pm[i]+1e-8>=pc[i]);geodesic+=pm[i];independent+=pc[i];}results.midpointExpectedVariance={spectral:2*geodesic/n**4,independentPixelCrossfade:2*independent/n**4};assert(results.midpointExpectedVariance.spectral>.5);
const a=f.synth(0,3).slice(),b=f.synth(1,3).slice(),mid=f.synth(.5,3).slice();results.coupledFieldLinearityMaxError=Math.max(...mid.map((v,i)=>Math.abs(v-(a[i]+b[i])*.5)));assert(results.coupledFieldLinearityMaxError<tolerance);
const close=f.synth(.43,12.0001).slice();results.smallTimeStepRMS=Math.sqrt(close.reduce((s,v,i)=>s+(v-field[i])**2,0)/close.length);assert(results.smallTimeStepRMS<.001);
const p0=f.power(.5);f.spectra(.9,115,1);const p90=f.power(.5);results.rotationPreservesTotalPowerError=Math.abs(p0.reduce((s,v)=>s+v,0)-p90.reduce((s,v)=>s+v,0))/p0.reduce((s,v)=>s+v,0);assert(results.rotationPreservesTotalPowerError<1e-10);
// Parseval verifies synthesis against its actual (Gaussian-weighted) coefficients.
let spectralEnergy=0;for(const m of f.modes){const h=.57*f.a[m.i]+.43*f.b[m.i];spectralEnergy+=2*h*h*(m.r*m.r+m.s*m.s);}const v=f.synth(.43,8);const spatialEnergy=v.reduce((s,x)=>s+x*x,0)/v.length;results.parsevalError=Math.abs(spatialEnergy-spectralEnergy/n**4);assert(results.parsevalError<tolerance);
const production=new SpectralField(256,16031);const prod=production.synth(.5,4);results.productionGrid={size:256,finite:prod.every(Number.isFinite),imaginaryLeakage:Math.max(...production.im.map(Math.abs))};assert(results.productionGrid.finite);assert(results.productionGrid.imaginaryLeakage<tolerance);
const delta=(c)=>{const a=f.synth(.4,10,c).slice(),b=f.synth(.4,10.01,c);return Math.sqrt(b.reduce((s,v,i)=>s+(v-a[i])**2,0)/b.length);};results.temporalStepRMS={highCoherence:delta(1),lowCoherence:delta(0)};assert(results.temporalStepRMS.highCoherence<results.temporalStepRMS.lowCoherence);
writeFileSync(new URL('./validation.json',import.meta.url),JSON.stringify({method:'Scalar stationary Gaussian amplitude geodesic; procedural spectra and artistic phase dynamics',grid:n,seed:16031,passed:true,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
