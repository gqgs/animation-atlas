// Independent GLSL ES compilation/linking; install Ubuntu's glslang-tools package.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {vertexShader,fragmentShader} from '../renderer.mjs';
const directory=mkdtempSync(join(tmpdir(),'chen-shaders-'));
try{
 const vertex=join(directory,'chen.vert'),fragment=join(directory,'chen.frag');
 writeFileSync(vertex,vertexShader);writeFileSync(fragment,fragmentShader);
 execFileSync('glslangValidator',['-l',vertex,fragment],{stdio:'inherit'});
 console.log('PASS · Independent GLSL ES shader compile/link');
 // A deliberately broken, active shared uniform verifies strict precision checks.
 writeFileSync(vertex,vertexShader.replace('in highp vec4 point;','uniform highp int layer;\nin highp vec4 point;').replace('gl_Position=vec4(xy*z,0.,z);','gl_Position=vec4(xy*z,0.,z); gl_Position.x+=float(layer)*1e-30;'));
 writeFileSync(fragment,fragmentShader.replace('uniform highp int palette,pass,layer,pattern;','uniform mediump int palette,pass,layer,pattern;'));
 const negative=spawnSync('glslangValidator',['-l',vertex,fragment],{encoding:'utf8'});
 assert.notEqual(negative.status,0,'Strict linker must reject mismatched uniform precision');
 assert.match(negative.stdout+negative.stderr,/precision/i);
 console.log('PASS · Strict linker rejects the integer-precision regression');
}finally{rmSync(directory,{recursive:true,force:true});}
