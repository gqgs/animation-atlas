// Unoriented vertical planes through the original z axis; orientations modulo pi.
export const projectionLevels = [0,1,2,3,4];
export const projectionStride = 8;
export const projectionStrides = [8,4,2,1];
export function planeAngles(level){
 if(!projectionLevels.includes(level))throw new RangeError('Projection level must be 0–4');
 const count=2**level;return Array.from({length:count},(_,i)=>i*Math.PI/count);
}
export function planeDirection(theta){return [(Math.cos(theta)+Math.sin(theta))/Math.SQRT2,0,(Math.sin(theta)-Math.cos(theta))/Math.SQRT2];}
export function projectPoint(point,theta){const d=planeDirection(theta),u=point[0]*d[0]+point[2]*d[2];return [u*d[0],point[1],u*d[2]];}
// Every plane uses exactly the same evenly sampled subset, including original order.
export function projectionSamples(model,stride=projectionStride){
 if(!projectionStrides.includes(stride))throw new RangeError('Sample stride must be 1, 2, 4 or 8');
 if(stride===1)return {data:model.data,count:model.count};
 const count=Math.ceil(model.count/stride),data=new Float32Array(count*4);
 for(let i=0;i<count;i++)data.set(model.data.subarray(i*stride*4,i*stride*4+4),i*4);
 return {data,count};
}
export function guideVertices(){
 const vertices=[],line=(a,b)=>vertices.push(...a,0,...b,0);
 // A restrained frame and three horizontal crossbars in plane-local coordinates.
 for(const y of [-.85,-.25,.35,.95,1.25])line([-1.8,y,0],[1.8,y,0]);
 for(const x of [-1.8,0,1.8])line([x,-.85,0],[x,1.25,0]);
 return new Float32Array(vertices);
}
