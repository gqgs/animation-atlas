export const fragmentShader = `
precision highp float;
uniform vec2 resolution, aim;
uniform float zoom, spacing, reflectivity, exposure, pearl, roll, orbit;
uniform int bounces, mode;
vec3 center(int i){
 if(i==0)return spacing*vec3(0.,1.15470054,.40824829);
 if(i==1)return spacing*vec3(-1.,-.57735027,.40824829);
 if(i==2)return spacing*vec3(1.,-.57735027,.40824829);
 return spacing*vec3(0.,0.,-1.22474487);
}
vec3 pigment(int i){if(i==0)return vec3(1.,.025,.06);if(i==1)return vec3(.035,1.,.09);if(i==2)return vec3(.025,.10,1.);return vec3(.008,.012,.025);}
float hit(vec3 o,vec3 d,vec3 c){vec3 q=o-c;float b=dot(q,d),h=b*b-dot(q,q)+1.;if(h<0.)return 1e6;float t=-b-sqrt(h);return t>1e-5?t:1e6;}
void main(){
 vec2 uv=(2.*gl_FragCoord.xy-resolution)/resolution.y;
 uv=mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*uv;
 vec3 o=vec3(.13*cos(orbit),.13*sin(orbit),1.85);
 // Orbit offset is cancelled at zero by aim in the UI; all poses stay outside spheres.
 vec3 target=vec3(aim,0.);vec3 f=normalize(target-o),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);
 vec3 d=normalize(f+(uv.x*r+uv.y*u)*zoom);
 vec3 light=vec3(0.);float weight=1.;int count=0;bool escaped=false;int exitFace=3;
 for(int k=0;k<128;k++){
  if(k>=bounces)break;
  float t=1e6;int id=-1;
  for(int i=0;i<4;i++){float v=hit(o,d,center(i));if(v<t){t=v;id=i;}}
  if(id<0){
   escaped=true;
   // The first outward crossing of a tetrahedron face determines the exit.
   float best=1e6;
   for(int i=0;i<4;i++){vec3 n=-normalize(center(i));float den=dot(d,n);if(den>1e-6){float tf=(spacing*.40824829-dot(o,n))/den;if(tf>=-1e-4&&tf<best){best=tf;exitFace=i;}}}
   vec3 col=pigment(exitFace);light+=weight*col*(.12+1.8*pow(max(0.,dot(d,-normalize(center(exitFace)))),18.));break;
  }
  vec3 p=o+t*d,n=normalize(p-center(id));count++;
  for(int j=0;j<3;j++){
   vec3 l=normalize(-normalize(center(j))*2.8-p);
   float spec=pow(max(dot(reflect(-l,n),-d),0.),32.);
   float diffuse=pow(max(dot(n,l),0.),3.);
   vec3 col=mix(pigment(j),vec3(.55,.58,1.),pearl*.55);
   light+=weight*col*(spec*.8+diffuse*.035);
  }
  light+=weight*pearl*vec3(.045,.04,.09)*pow(1.-abs(dot(n,d)),2.);
  weight*=reflectivity;d=reflect(d,n);o=p+n*.00002;
 }
 vec3 col;
 if(mode==1)col=escaped?pigment(exitFace):vec3(1.,0.,1.);
 else if(mode==2)col=escaped?mix(vec3(.015,.025,.07),vec3(1.,.8,.35),sqrt(float(count)/float(bounces))):vec3(1.,0.,1.);
 else col=1.-exp(-light*exposure);
 gl_FragColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);
}`;
