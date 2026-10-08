export interface SourceLoadingAnimation {
  clips: { Walk: { duration: number } };
  curves: { keys: [number, [number,number,number,number]][] }[];
  bindings: {nodePath:string;property:string;curveOffset:number;dimensions:number}[];
}
/** Replay exported Unity streamed cubic coefficients at a looped engine time. */
export function loadingPose(source:SourceLoadingAnimation,time:number) {
  const duration=source.clips.Walk.duration;
  const t=((time%duration)+duration)%duration;
  const pose=new Map<string,Record<string,number[]>>();
  for(const binding of source.bindings) {
    const values=Array.from({length:binding.dimensions},(_,dimension)=>{
      const keys=source.curves[binding.curveOffset+dimension].keys;
      let key=keys[0];
      for(const candidate of keys) {if(candidate[0]>t)break;key=candidate;}
      const dt=t-key[0], [a,b,c,d]=key[1];
      return ((a*dt+b)*dt+c)*dt+d;
    });
    const node=pose.get(binding.nodePath)??{};
    node[binding.property]=values;pose.set(binding.nodePath,node);
  }
  return pose;
}
