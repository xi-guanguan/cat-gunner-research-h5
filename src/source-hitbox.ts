/** World-space segment/OBB adapter for the original Unity BoxCollider.
 * Source Bullet spheres use a segment sweep; Rigidbody contact replay remains separate. */
export interface SourceBoxHitbox {centerOffset:{x:number;y:number;z:number};halfExtents:{x:number;y:number;z:number};yawRadians:number}
export function sourceBoxSegmentEntry(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},box:SourceBoxHitbox):number|null {
 const c=Math.cos(box.yawRadians),s=Math.sin(box.yawRadians);
 const local=(p:typeof from)=>{const x=p.x-box.centerOffset.x,z=p.z-box.centerOffset.z;return {x:c*x-s*z,y:p.y-box.centerOffset.y,z:s*x+c*z};};
 const a=local(from),b=local(to);let enter=0,leave=1;
 for(const axis of ['x','y','z'] as const){const d=b[axis]-a[axis],h=box.halfExtents[axis];if(Math.abs(d)<1e-12){if(a[axis]<-h||a[axis]>h)return null;continue;}
  let lo=(-h-a[axis])/d,hi=(h-a[axis])/d;if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);leave=Math.min(leave,hi);if(enter>leave)return null;}
 return enter;
}

/** Earliest contact with the rounded Minkowski boundary. Expanding only the
 * box slabs produces false corner hits, so solve distance² in each segment region. */
export function sourceSphereBoxSegmentEntry(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},box:SourceBoxHitbox,radius:number):number|null {
 if(!Number.isFinite(radius)||radius<0)throw new RangeError('Invalid bullet sphere radius');
 if(radius===0)return sourceBoxSegmentEntry(from,to,box);
 const c=Math.cos(box.yawRadians),s=Math.sin(box.yawRadians);
 const local=(p:typeof from)=>{const x=p.x-box.centerOffset.x,z=p.z-box.centerOffset.z;return [c*x-s*z,p.y-box.centerOffset.y,s*x+c*z];};
 const p=local(from),q=local(to),d=q.map((v,i)=>v-p[i]),h=[box.halfExtents.x,box.halfExtents.y,box.halfExtents.z],cuts=[0,1],rr=radius*radius;
 for(let i=0;i<3;i++)if(d[i]!==0)for(const edge of [-h[i],h[i]]){const t=(edge-p[i])/d[i];if(t>0&&t<1)cuts.push(t);}
 cuts.sort((a,b)=>a-b);
 for(let j=0;j<cuts.length-1;j++){
  const lo=cuts[j],hi=cuts[j+1],mid=(lo+hi)/2;let aa=0,bb=0,cc=-rr;
  for(let i=0;i<3;i++){const value=p[i]+d[i]*mid;if(value>=-h[i]&&value<=h[i])continue;const intercept=p[i]-(value>h[i]?h[i]:-h[i]);aa+=d[i]*d[i];bb+=2*d[i]*intercept;cc+=intercept*intercept;}
  if(aa*lo*lo+bb*lo+cc<=1e-12)return lo;
  if(aa===0)continue;
  const disc=bb*bb-4*aa*cc;if(disc<-1e-12)continue;
  const entry=(-bb-Math.sqrt(Math.max(0,disc)))/(2*aa);
  if(entry>=lo-1e-12&&entry<=hi+1e-12)return Math.max(lo,Math.min(hi,entry));
 }
 return null;
}
