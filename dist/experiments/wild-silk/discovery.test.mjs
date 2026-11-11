import test from 'node:test';import assert from 'node:assert/strict';
import {propose,normalizeConfig,evaluateFrames,chooseGallery} from './discovery.mjs';
import {encode,presets} from './core.mjs';import {defaultTracks} from './parameters.mjs';
const seed=encode(presets[0][1]),base=normalizeConfig({seed,tracks:defaultTracks});
test('loop proposals are reproducible, valid and preserve source config',()=>{
 const snapshot=JSON.stringify(base),a=propose(base,[seed],42),b=propose(base,[seed],42);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(base),snapshot);assert.equal(a.length,32);
 for(const c of a){assert.equal(c.seed,seed);assert.ok(c.tracks.zoom.min<=c.tracks.zoom.max);assert.deepEqual(c,normalizeConfig(c));}
 assert.notDeepEqual(a,propose(base,[seed],43));
});
test('near search retains exact seed and limits motion mutation',()=>{for(const c of propose(base,[encode(presets[1][1])],7,true)){assert.equal(c.seed,seed);assert.ok(Math.abs(c.settings.wave-base.settings.wave)<=.185);}});
const image=(offset=0)=>{const data=new Uint8ClampedArray(24*24*4);for(let y=7;y<17;y++)for(let x=7+offset;x<14+offset;x++)data[(y*24+x)*4]=180;return {data,width:24,height:24};};
test('screen rejects static/blank/seam and isolates intrinsic motion',()=>{
 const a=image(),b=image(1),c=image(2),frames=[a,b,c,b];
 assert.ok(evaluateFrames(frames,frames,a).accepted);
 assert.ok(evaluateFrames([a,a,a,a],[a,a,a,a],a).reasons.includes('nearly static'));
 const camera=evaluateFrames(frames,[a,a,a,a],a);assert.equal(camera.deformation,0);assert.ok(camera.motion>0);
 assert.ok(evaluateFrames(frames,frames,c).reasons.includes('loop seam'));
 const blank={...a,data:new Uint8ClampedArray(a.data.length)};assert.ok(evaluateFrames([blank,blank],[blank,blank],blank).reasons.includes('sparse'));
});
test('selection spreads across descriptor cells without maximizing motion',()=>{
 const candidates=Array.from({length:12},(_,i)=>({id:i,metrics:{accepted:i!==11,cell:i<8?'0:0':'2:2'}}));
 const chosen=chooseGallery(candidates,4);assert.deepEqual(chosen.map(x=>x.id),[0,8,1,9]);assert.equal(candidates.length,12);
});

test('local variation respects favorites beyond broad search bounds',()=>{const c=normalizeConfig({...base,tracks:{zoom:{enabled:true,min:1.8,max:2,easing:'sine'},rotation:{enabled:true,min:140,max:180,easing:'sine'}}});for(const n of propose(c,[seed],42,true)){assert.ok(n.tracks.zoom.min>1.5);assert.ok(n.tracks.rotation.max>110);}});
