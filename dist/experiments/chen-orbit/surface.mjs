// A topology-controlled, attractor-inspired solid, not the invariant chaotic set.
export function surfaceDistance(x,y,z){
 const twist=.22*x+.12*Math.sin(1.7*x),c=Math.cos(twist),s=Math.sin(twist);
 const yy=c*y+s*z,zz=-s*y+c*z;
 const lx=x+.66,ly=(yy-.06)/1.1,lz=zz/1.38;
 const rx=(x-.67)/1.02,ry=(yy+.10)/.92,rz=(zz-.025)/1.42;
 const left=Math.hypot(Math.hypot(lx,ly)-.66,lz)-.245;
 const right=Math.hypot(Math.hypot(rx,ry)-.62,rz)-.285;
 const h=Math.max(0,Math.min(1,.5+.5*(right-left)/.22));
 return (right*(1-h)+left*h-.22*h*(1-h))*.85;
}
export const surfaceGLSL=`
float surfaceDistance(vec3 p){
 float a=.22*p.x+.12*sin(1.7*p.x),c=cos(a),s=sin(a);
 vec3 q=vec3(p.x,c*p.y+s*p.z,-s*p.y+c*p.z);
 vec3 l=vec3(q.x+.66,(q.y-.06)/1.1,q.z/1.38);
 vec3 r=vec3((q.x-.67)/1.02,(q.y+.10)/.92,(q.z-.025)/1.42);
 float d1=length(vec2(length(l.xy)-.66,l.z))-.245;
 float d2=length(vec2(length(r.xy)-.62,r.z))-.285;
 float h=clamp(.5+.5*(d2-d1)/.22,0.,1.);
 return (mix(d2,d1,h)-.22*h*(1.-h))*.85;
}`;
export function buildSurface({nx=80,ny=64,nz=48,distance=surfaceDistance,bounds=[[-1.8,1.8],[-1.3,1.3],[-.95,.95]]}={}){
 const total=(nx+1)*(ny+1)*(nz+1),values=new Float32Array(total),vertices=[],normals=[],indices=[],edges=new Map();
 const strideY=nx+1,strideZ=(nx+1)*(ny+1),position=id=>{const k=Math.floor(id/strideZ),j=Math.floor((id-k*strideZ)/strideY),i=id-k*strideZ-j*strideY;return [bounds[0][0]+(bounds[0][1]-bounds[0][0])*i/nx,bounds[1][0]+(bounds[1][1]-bounds[1][0])*j/ny,bounds[2][0]+(bounds[2][1]-bounds[2][0])*k/nz];};
 for(let id=0;id<total;id++)values[id]=distance(...position(id));
 function edge(a,b){if(a>b)[a,b]=[b,a];const key=a*total+b;if(edges.has(key))return edges.get(key);const pa=position(a),pb=position(b),t=values[a]/(values[a]-values[b]),p=pa.map((v,i)=>v+t*(pb[i]-v)),e=.001;
 const n=[distance(p[0]+e,p[1],p[2])-distance(p[0]-e,p[1],p[2]),distance(p[0],p[1]+e,p[2])-distance(p[0],p[1]-e,p[2]),distance(p[0],p[1],p[2]+e)-distance(p[0],p[1],p[2]-e)],length=Math.hypot(...n),index=vertices.length/3;
 vertices.push(...p);normals.push(...n.map(v=>v/length));edges.set(key,index);return index;}
 function triangle(a,b,c,outward){const p=[a,b,c].map(i=>vertices.slice(i*3,i*3+3)),u=p[1].map((v,i)=>v-p[0][i]),v=p[2].map((v,i)=>v-p[0][i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n.reduce((sum,x,i)=>sum+x*outward[i],0)<0)[b,c]=[c,b];indices.push(a,b,c);}
 const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const a=i+j*strideY+k*strideZ,cube=[a,a+1,a+1+strideY,a+strideY,a+strideZ,a+1+strideZ,a+1+strideY+strideZ,a+strideY+strideZ];
  if(cube.every(id=>values[id]>=0)||cube.every(id=>values[id]<0))continue;
  for(const tet of tets){const inside=tet.map(t=>cube[t]).filter(id=>values[id]<0),outside=tet.map(t=>cube[t]).filter(id=>values[id]>=0);if(inside.length===0||inside.length===4)continue;
   // Classify winding against this tetrahedron's own linear cut, not a
   // smoothed shading normal which can disagree near a sharp density fold.
   const pin=position(inside[0]),pout=position(outside[0]),outward=pout.map((v,i)=>v-pin[i]);
   if(inside.length===1||inside.length===3){const single=inside.length===1?inside:outside,other=inside.length===1?outside:inside;triangle(...other.map(b=>edge(single[0],b)),outward);}
   else{const [a,b]=inside,[c,d]=outside,ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);triangle(ac,ad,bc,outward);triangle(ad,bd,bc,outward);}
  }
 }
 return {positions:new Float32Array(vertices),normals:new Float32Array(normals),indices:new Uint32Array(indices)};
}
export function topology(mesh){
 const vertices=mesh.positions.length/3,faces=mesh.indices.length/3,edgeCounts=new Map(),edgeDirections=new Map(),parent=Array.from({length:vertices},(_,i)=>i);
 const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 for(let i=0;i<mesh.indices.length;i+=3){const t=mesh.indices.subarray(i,i+3);for(let j=0;j<3;j++){let a=t[j],b=t[(j+1)%3];parent[find(a)]=find(b);const direction=a<b?1:-1;if(a>b)[a,b]=[b,a];const key=a*vertices+b;edgeDirections.set(key,(edgeDirections.get(key)||0)+direction);edgeCounts.set(key,(edgeCounts.get(key)||0)+1);}}
 const components=new Set(parent.map((_,i)=>find(i))).size,edges=edgeCounts.size,euler=vertices-edges+faces;
 return {vertices,edges,faces,components,inconsistentEdges:[...edgeDirections.values()].filter(n=>n!==0).length,boundaryEdges:[...edgeCounts.values()].filter(n=>n===1).length,nonmanifoldEdges:[...edgeCounts.values()].filter(n=>n!==2).length,euler,genus:(2-euler)/2};
}
