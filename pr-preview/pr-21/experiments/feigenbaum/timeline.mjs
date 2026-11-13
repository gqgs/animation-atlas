// A display transition between integer maps, never a fractional iterate.
export function orderFrame(value,blend=true){
 const v=Math.max(2,Math.min(7,value)),lo=Math.floor(v),hi=Math.min(7,lo+1),t=blend&&hi!==lo?v-lo:0;
 return {value:v,lo,hi,alpha:t*t*(3-2*t)};
}
export function advanceOrder(value,dt,seconds){return Math.min(7,value+Math.max(0,dt)/seconds)}
