export const fragmentShader = `
precision highp float;
uniform vec2 resolution,pole;
uniform float zoom,density,bands,rotation;
uniform int pattern,palette;
const float TAU=6.28318530718;
vec3 ink(float t){
 if(palette==1)return mix(vec3(.035,.025,.07),vec3(1.,.66,.34),t);
 if(palette==2)return mix(vec3(.015),vec3(.93),t);
 return .52+.43*cos(TAU*(vec3(.02,.35,.56)+t*.65));
}
void main(){
 vec2 z=(2.*gl_FragCoord.xy-resolution)/resolution.y*zoom;
 vec2 d=z-pole;
 float r2=dot(d,d);
 // g(f(z)) = 1 + 2(1 - conjugate(z0) z)/(z-z0).
 // Evaluate the composition directly, avoiding a removable singularity in f.
 vec2 n=vec2(1.-dot(pole,z),pole.y*z.x-pole.x*z.y);
 vec2 w=vec2(1.,0.)+2.*vec2(dot(n,d),n.y*d.x-n.x*d.y)/max(r2,1e-12);
 float c=cos(rotation),s=sin(rotation);
 w=mat2(c,s,-s,c)*w*density;
 // Exact conformal magnification gives a footprint even across tile seams.
 float footprint=4.*zoom*density*(1.-dot(pole,pole))/(resolution.y*max(r2,1e-12));
 vec2 cell=floor(w),q=fract(w)-.5;
 float radius=length(q),angle=atan(q.y,q.x);
 float cycles=pattern==0?radius*bands:angle/TAU*bands;
 if(pattern==2)cycles=radius*bands+angle/TAU*bands;
 float freq=pattern==0?bands:bands/max(TAU*radius,.001);
 if(pattern==2)freq+=bands;
 float visible=exp(-2.*pow(footprint*freq,2.));
 float wave=.5+.5*cos(TAU*cycles)*visible;
 float parity=mod(cell.x+cell.y,2.);
 float tileVisible=exp(-3.*footprint*footprint);
 vec3 col=mix(ink(.5),ink(.16+wave*.65+parity*.16),tileVisible);
 float edge=.5-max(abs(q.x),abs(q.y));
 float grid=(1.-smoothstep(0.,max(.008,footprint),edge))*tileVisible;
 col*=1.-.48*grid;
 // The pole has no finite image: use the unresolved field's mean color.
 col=mix(ink(.5),col,smoothstep(0.,1e-9,r2));
 gl_FragColor=vec4(col,1.);
}`;
