import test from 'node:test';
import assert from 'node:assert/strict';
import {vertexShader as originalVertex,fragmentShader as originalFragment} from './renderer.mjs';

import {vertexShader as projectionVertex,fragmentShader as projectionFragment} from './projection-renderer.mjs';

import {vertexShader as sweepVertex,fragmentShader as sweepFragment} from './sweep-renderer.mjs';

// GLSL ES defaults differ by stage: int is highp in vertex, mediump in fragment.
// Catch interface mismatches even when a permissive driver drops an unused uniform.
function declarations(source,storage,stage){
 const result=new Map();
 const defaults={float:stage==='vertex'?'highp':null,int:stage==='vertex'?'highp':'mediump'};
 for(const [,precision,type] of source.matchAll(/precision\s+(lowp|mediump|highp)\s+(float|int)\s*;/g))defaults[type]=precision;
 const regex=new RegExp(`\\b${storage}\\s+(?:(lowp|mediump|highp)\\s+)?(\\w+)\\s+([^;]+);`,'g');
 for(const [,explicit,type,names] of source.matchAll(regex))for(const name of names.split(',').map(s=>s.trim())){
  const base=/^(?:int|uint|[iu]vec)/.test(type)?'int':'float';
  result.set(name,{type,precision:explicit||defaults[base],explicit:!!explicit});
 }
 return result;
}
function uniformMismatches(vertex,fragment){
 const a=declarations(vertex,'uniform','vertex'),b=declarations(fragment,'uniform','fragment');
 return [...a].filter(([name,value])=>b.has(name)&&(value.type!==b.get(name).type||value.precision!==b.get(name).precision)).map(([name])=>name);
}
for(const [name,vertexShader,fragmentShader] of [['trajectory',originalVertex,originalFragment],['projections',projectionVertex,projectionFragment],['sweep',sweepVertex,sweepFragment]])test(`${name}: all linked shader interfaces specify matching precision explicitly`,()=>{
 for(const [stage,source] of [['vertex',vertexShader],['fragment',fragmentShader]]){
  assert.match(source,/precision highp float;/);assert.match(source,/precision highp int;/);
  for(const storage of ['uniform','in','out'])for(const [name,value] of declarations(source,storage,stage))assert.ok(value.explicit,`${stage} ${storage} ${name} needs explicit precision`);
 }
 assert.deepEqual(uniformMismatches(vertexShader,fragmentShader),[]);
 const outputs=declarations(vertexShader,'out','vertex'),inputs=declarations(fragmentShader,'in','fragment');
 for(const [name,value] of inputs)assert.deepEqual(outputs.get(name),value,`varying ${name} must match`);
 assert.ok(!declarations(vertexShader,'uniform','vertex').has('layer'),'unused fragment-only layer must not be redeclared in vertex');
});
test('regression detects the reported default integer-precision mismatch',()=>{
 const vertex=originalVertex.replace('precision highp int;','')+'\nuniform int layer;';
 const fragment=originalFragment.replace('precision highp int;','').replace('uniform highp int palette,pass,layer,pattern;','uniform int palette,pass,layer,pattern;');
 assert.deepEqual(uniformMismatches(vertex,fragment),['layer']);
});
