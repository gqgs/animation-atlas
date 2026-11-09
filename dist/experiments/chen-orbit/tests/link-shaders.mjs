// Independent GLSL ES compilation/linking; install Ubuntu's glslang-tools package.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {vertexShader,fragmentShader} from '../renderer.mjs';
const directory=mkdtempSync(join(tmpdir(),'chen-shaders-'));
try{
 const vertex=join(directory,'chen.vert'),fragment=join(directory,'chen.frag');
 writeFileSync(vertex,vertexShader);writeFileSync(fragment,fragmentShader);
 execFileSync('glslangValidator',['-l',vertex,fragment],{stdio:'inherit'});
 console.log('PASS · Independent GLSL ES shader compile/link');
}finally{rmSync(directory,{recursive:true,force:true});}
