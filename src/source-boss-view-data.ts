import originalBossData from './data/source-boss-view.json';

export type SourceBossVec3 = [number,number,number];
export type SourceBossQuaternion = [number,number,number,number];
export type SourceBossMatrix = number[];
export interface SourceBossWorldPoint {x:number;y:number;z:number}
export interface SourceBossNode {id:number;parent:number;name:string;active:boolean;position:SourceBossVec3;rotation:SourceBossQuaternion;scale:SourceBossVec3}
export interface SourceBossSpriteResource {sourceKey:string;name:string;textureUrl:string;sha256:string;rect:{width:number;height:number;x:number;y:number};pivot:{x:number;y:number};pixelsPerUnit:number;textureRect:{width:number;height:number;x:number;y:number};textureRectOffset:{x:number;y:number};texturePngSize:[number,number];settingsRaw:number}
export interface SourceBossLayer {node:number;renderer:number;spriteKey:string;sortingOrder:number;sortingLayer:number;color:[number,number,number,number];enabled:boolean}
export interface SourceBossSkin {index:number;name:string;root:number;nodes:number[];headRenderer:number;layers:SourceBossLayer[]}
export type SourceBossCubicKey = [number,number,number,number,number];
export type SourceBossChannel = {constant:number;keys?:never}|{keys:SourceBossCubicKey[];constant?:never};
export interface SourceBossClip {duration:number;loop:boolean;tracks:{path:string;nodes:number[];property:'localPosition'|'localRotationQuaternion'|'localEulerAngles'|'localScale';channels:SourceBossChannel[]}[]}
export type SourceBossClipName = 'Ready'|'Walk'|'Attack'|'Death';
export type SourceBossAnimationState = 'Idle'|'Walk'|'Attack'|'Death';
interface SourceBossColliderData {node:number;type:string;fields:{m_Enabled:boolean;m_IsTrigger:boolean;m_Size?:{x:number;y:number;z:number};m_Center:{x:number;y:number;z:number};m_Radius?:number}}
export interface SourceBossViewManifest {
 schemaVersion:number;source:{bundleSha256:string;controller:string;sourceCoordinates:string;notSpine:boolean};root:number;skinFacingNode:number;defaultWorld:SourceBossVec3;
 nodes:SourceBossNode[];skins:SourceBossSkin[];resources:Record<string,SourceBossSpriteResource>;heads:Record<'normal'|'idle'|'death',string[]>;
 clips:Record<SourceBossClipName,SourceBossClip>;colliders:SourceBossColliderData[];
 map:{root:number;worldOrigin:SourceBossVec3;nodes:SourceBossNode[];layers:SourceBossLayer[];colliders:SourceBossColliderData[]};
 animator:{stateClips:Record<SourceBossAnimationState,SourceBossClipName>;transitionSeconds:number;facingYawDegrees:{left:number;right:number};facingEvidence:string};
}
/** Source evidence: level0:125471, original nine dragon rigs, controller301/clip265..268.
 * No generated replacement character or motion. Shared source data is read-only. */
export const SOURCE_BOSS_VIEW_DATA = originalBossData as unknown as SourceBossViewManifest;
export interface SourceBossLocalTransform {position:SourceBossVec3;rotation:SourceBossQuaternion;scale:SourceBossVec3}
export type SourceBossLocalPose = Map<number,SourceBossLocalTransform>;
export interface SourceBossPose {locals:SourceBossLocalPose;matrices:Map<number,SourceBossMatrix>;skinIndex:number}
const DEG=Math.PI/180;
export function sourceBossSkinIndex(stage:number):number {
 if(!Number.isInteger(stage)||stage<0||stage>2147483647)throw new RangeError('Invalid source Boss stage');
 return stage%9;
}
export function sourceBossSampleCubic(channel:SourceBossChannel,seconds:number):number {
 if(!Number.isFinite(seconds))throw new RangeError('Invalid source Boss animation time');
 if('constant' in channel)return channel.constant!;
 const keys=channel.keys;if(!keys.length)throw new Error('Empty source Boss channel');
 let key=keys[0];for(const candidate of keys){if(candidate[0]>seconds)break;key=candidate;}
 // Native sentinel (-FLT_MAX) stores the pre-first-key default, not an evaluable interval.
 if(key[0]<-1e30)return key[4];
 const dt=seconds-key[0];return ((key[1]*dt+key[2])*dt+key[3])*dt+key[4];
}
function qMultiply(a:SourceBossQuaternion,b:SourceBossQuaternion):SourceBossQuaternion{return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
/** Matches cat-rig native world sampler: Unity Quaternion.Euler = Ry * Rx * Rz. */
function qEuler(e:SourceBossVec3):SourceBossQuaternion {const [x,y,z]=e.map(v=>v*DEG/2);return qMultiply(qMultiply([0,Math.sin(y),0,Math.cos(y)],[Math.sin(x),0,0,Math.cos(x)]),[0,0,Math.sin(z),Math.cos(z)]);}
function normalizeQ(q:SourceBossQuaternion):SourceBossQuaternion{const n=Math.hypot(...q);return n?q.map(v=>v/n) as SourceBossQuaternion:[0,0,0,1];}
function slerpQ(a:SourceBossQuaternion,b:SourceBossQuaternion,t:number):SourceBossQuaternion {
 a=normalizeQ(a);b=normalizeQ(b);let dot=a.reduce((sum,v,i)=>sum+v*b[i],0);
 if(dot<0){b=b.map(v=>-v) as SourceBossQuaternion;dot=-dot;}
 if(dot>.9995)return normalizeQ(a.map((v,i)=>v+(b[i]-v)*t) as SourceBossQuaternion);
 const angle=Math.acos(Math.max(-1,Math.min(1,dot))),s=Math.sin(angle),wa=Math.sin((1-t)*angle)/s,wb=Math.sin(t*angle)/s;
 return a.map((v,i)=>v*wa+b[i]*wb) as SourceBossQuaternion;
}
function cloneTransform(n:SourceBossNode):SourceBossLocalTransform {return {position:[...n.position],rotation:[...n.rotation],scale:[...n.scale]};}
export function sampleSourceBossLocalPose(stage:number,clipName:SourceBossClipName,seconds:number,facing:'left'|'right'='left',manifest=SOURCE_BOSS_VIEW_DATA):SourceBossLocalPose {
 const skin=sourceBossSkinIndex(stage),clip=manifest.clips[clipName];if(!clip)throw new Error('Unknown source Boss clip');
 if(!Number.isFinite(seconds))throw new RangeError('Invalid source Boss time');
 const time=clip.loop?((seconds%clip.duration)+clip.duration)%clip.duration:Math.max(0,Math.min(clip.duration,seconds));
 const locals=new Map(manifest.nodes.map(n=>[n.id,cloneTransform(n)]));
 for(const track of clip.tracks){const local=locals.get(track.nodes[skin]);if(!local)throw new Error(`Missing source Boss animation node ${track.path}`);const values=track.channels.map(c=>sourceBossSampleCubic(c,time));
  if(track.property==='localPosition')local.position=values as SourceBossVec3;
  else if(track.property==='localScale')local.scale=values as SourceBossVec3;
  else if(track.property==='localEulerAngles')local.rotation=qEuler(values as SourceBossVec3);
  else local.rotation=normalizeQ(values as SourceBossQuaternion);
 }
 applySourceBossFacing(locals,facing,manifest);
 return locals;
}
/** Native MoveToPoint sets this transform immediately, outside Animator blending. */
export function applySourceBossFacing(locals:SourceBossLocalPose,facing:'left'|'right',manifest=SOURCE_BOSS_VIEW_DATA):void {
 const direction=locals.get(manifest.skinFacingNode);if(direction)direction.rotation=qEuler([0,manifest.animator.facingYawDegrees[facing],0]);
}
export function blendSourceBossLocalPose(from:SourceBossLocalPose,to:SourceBossLocalPose,fraction:number):SourceBossLocalPose {
 const t=Math.max(0,Math.min(1,fraction)),result:SourceBossLocalPose=new Map();
 for(const [node,b] of to){const a=from.get(node)??b;result.set(node,{position:a.position.map((v,i)=>v+(b.position[i]-v)*t) as SourceBossVec3,scale:a.scale.map((v,i)=>v+(b.scale[i]-v)*t) as SourceBossVec3,rotation:slerpQ(a.rotation,b.rotation,t)});}
 return result;
}
function matrix(local:SourceBossLocalTransform):SourceBossMatrix {
 const [x,y,z,w]=normalizeQ(local.rotation),[sx,sy,sz]=local.scale,[px,py,pz]=local.position;
 return [(1-2*(y*y+z*z))*sx,2*(x*y-z*w)*sy,2*(x*z+y*w)*sz,px,2*(x*y+z*w)*sx,(1-2*(x*x+z*z))*sy,2*(y*z-x*w)*sz,py,2*(x*z-y*w)*sx,2*(y*z+x*w)*sy,(1-2*(x*x+y*y))*sz,pz,0,0,0,1];
}
function multiplyMatrix(a:SourceBossMatrix,b:SourceBossMatrix):SourceBossMatrix{const m:number[]=[];for(let row=0;row<4;row++)for(let col=0;col<4;col++)m[row*4+col]=a[row*4]*b[col]+a[row*4+1]*b[col+4]+a[row*4+2]*b[col+8]+a[row*4+3]*b[col+12];return m;}
export function sourceBossTransformPoint(m:SourceBossMatrix,p:SourceBossVec3=[0,0,0]):SourceBossWorldPoint{return {x:m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],y:m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],z:m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]};}
export function sourceBossComposePose(locals:SourceBossLocalPose,worldPosition:SourceBossWorldPoint,stage=0,manifest=SOURCE_BOSS_VIEW_DATA):SourceBossPose {
 if(![worldPosition.x,worldPosition.y,worldPosition.z].every(Number.isFinite))throw new RangeError('Invalid source Boss world position');
 const matrices=new Map<number,SourceBossMatrix>();for(const node of manifest.nodes){const local=locals.get(node.id)!;let m=matrix(node.id===manifest.root?{...local,position:[worldPosition.x,worldPosition.y,worldPosition.z]}:local);const parent=matrices.get(node.parent);if(parent)m=multiplyMatrix(parent,m);matrices.set(node.id,m);}
 return {locals,matrices,skinIndex:sourceBossSkinIndex(stage)};
}
export function sampleSourceBossPose(stage:number,clip:SourceBossClipName,seconds:number,worldPosition:SourceBossWorldPoint={x:-115,y:0,z:15},facing:'left'|'right'='left',manifest=SOURCE_BOSS_VIEW_DATA):SourceBossPose{return sourceBossComposePose(sampleSourceBossLocalPose(stage,clip,seconds,facing,manifest),worldPosition,stage,manifest);}
export function sampleSourceBossMapPose(manifest=SOURCE_BOSS_VIEW_DATA):Map<number,SourceBossMatrix>{const result=new Map<number,SourceBossMatrix>();for(const node of manifest.map.nodes){const local=cloneTransform(node);if(node.id===manifest.map.root)local.position=[...manifest.map.worldOrigin];let m=matrix(local);const p=result.get(node.parent);if(p)m=multiplyMatrix(p,m);result.set(node.id,m);}return result;}
export function sourceBossSpriteWorldCorners(resource:SourceBossSpriteResource,m:SourceBossMatrix):SourceBossWorldPoint[]{
 const ppu=resource.pixelsPerUnit,w=resource.textureRect.width/ppu,h=resource.textureRect.height/ppu;
 const left=(resource.textureRectOffset.x-resource.rect.width*resource.pivot.x)/ppu,bottom=(resource.textureRectOffset.y-resource.rect.height*resource.pivot.y)/ppu;
 // Extracted PNG is the trimmed source textureRect, not the full m_Rect. Retain
 // its original offset so each source quad preserves the original pivot.
 return [[left,bottom+h,0],[left+w,bottom+h,0],[left+w,bottom,0],[left,bottom,0]].map(p=>sourceBossTransformPoint(m,p as SourceBossVec3));
}
export interface SourceBossWorldBox {node:number;center:SourceBossWorldPoint;axes:[SourceBossVec3,SourceBossVec3,SourceBossVec3];halfExtents:SourceBossVec3}
function worldBox(c:SourceBossColliderData,m:SourceBossMatrix):SourceBossWorldBox {
 if(!c.fields.m_Size)throw new Error('Missing original Boss box dimensions');
 const lengths=[Math.hypot(m[0],m[4],m[8]),Math.hypot(m[1],m[5],m[9]),Math.hypot(m[2],m[6],m[10])];
 const axes:SourceBossVec3[]=[[m[0],m[4],m[8]],[m[1],m[5],m[9]],[m[2],m[6],m[10]]].map((a,i)=>a.map(v=>v/lengths[i]) as SourceBossVec3);
 const s=c.fields.m_Size,center=c.fields.m_Center;return {node:c.node,center:sourceBossTransformPoint(m,[center.x,center.y,center.z]),axes:axes as SourceBossWorldBox['axes'],halfExtents:[s.x*lengths[0]/2,s.y*lengths[1]/2,s.z*lengths[2]/2]};
}
/** Enemy_Coll: original active BoxCollider64999; inactive Sphere is excluded.
 * Native Skin_list facing does not rotate this sibling collider. */
export function sourceBossWorldCollider(worldPosition:SourceBossWorldPoint,manifest=SOURCE_BOSS_VIEW_DATA):SourceBossWorldBox {
 const c=manifest.colliders.find(c=>c.type==='BoxCollider'&&c.fields.m_Enabled);if(!c)throw new Error('Missing original Boss BoxCollider');
 const pose=sampleSourceBossPose(0,'Ready',0,worldPosition,'left',manifest);return worldBox(c,pose.matrices.get(c.node)!);
}
/** Minimum squared distance of segment to native oriented box. This is an exact
 * swept sphere-vs-box test; expanding box slabs would over-hit rounded corners. */
export function sourceBossProjectileHitsBox(box:SourceBossWorldBox,start:SourceBossWorldPoint,end:SourceBossWorldPoint,radius=0):boolean {
 if(![start.x,start.y,start.z,end.x,end.y,end.z,radius].every(Number.isFinite)||radius<0)throw new RangeError('Invalid Boss projectile geometry');
 const relative=(p:SourceBossWorldPoint)=>[p.x-box.center.x,p.y-box.center.y,p.z-box.center.z];const a=relative(start),b=relative(end);
 const local=(p:number[])=>box.axes.map(v=>p[0]*v[0]+p[1]*v[1]+p[2]*v[2]);const p=local(a),q=local(b),d=q.map((v,i)=>v-p[i]),breaks=[0,1];
 for(let i=0;i<3;i++)if(d[i]!==0)for(const edge of [-box.halfExtents[i],box.halfExtents[i]]){const t=(edge-p[i])/d[i];if(t>0&&t<1)breaks.push(t);}
 breaks.sort((a,b)=>a-b);const limit=radius*radius;
 const distance=(t:number)=>p.reduce((sum,v,i)=>{const excess=Math.max(0,Math.abs(v+d[i]*t)-box.halfExtents[i]);return sum+excess*excess;},0);
 for(let j=0;j<breaks.length-1;j++){const lo=breaks[j],hi=breaks[j+1],mid=(lo+hi)/2;let aa=0,ab=0;
  for(let i=0;i<3;i++){const v=p[i]+d[i]*mid,h=box.halfExtents[i];if(v>=-h&&v<=h)continue;const intercept=p[i]-(v>h?h:-h);aa+=d[i]*d[i];ab+=d[i]*intercept;}
  const t=aa?Math.max(lo,Math.min(hi,-ab/aa)):lo;if(distance(t)<=limit+1e-12)return true;
 }
 return false;
}
export function sourceBossProjectileHits(worldPosition:SourceBossWorldPoint,start:SourceBossWorldPoint,end:SourceBossWorldPoint,radius=0):boolean{return sourceBossProjectileHitsBox(sourceBossWorldCollider(worldPosition),start,end,radius);}
export function sourceBossGroundCollider(manifest=SOURCE_BOSS_VIEW_DATA):SourceBossWorldBox {const c=manifest.map.colliders.find(c=>c.type==='BoxCollider'&&c.fields.m_Enabled);if(!c)throw new Error('Missing source Boss ground collider');return worldBox(c,sampleSourceBossMapPose(manifest).get(c.node)!);}
export function sourceBossTextureDependencies(stage?:number,includeBackground=true,manifest=SOURCE_BOSS_VIEW_DATA):string[]{
 const keys=new Set<string>();for(const skin of stage===undefined?manifest.skins:[manifest.skins[sourceBossSkinIndex(stage)]]){skin.layers.forEach(l=>keys.add(l.spriteKey));for(const group of Object.values(manifest.heads))keys.add(group[skin.index]);}
 if(includeBackground)manifest.map.layers.forEach(l=>keys.add(l.spriteKey));return [...keys].map(key=>manifest.resources[key].textureUrl);
}
export const SOURCE_BOSS_TEXTURE_URLS=Object.freeze(sourceBossTextureDependencies());
