import type {Gun} from './session';
import {sourceGunID} from './session';
export type GunLocationKind='inventory'|'equipment';
export interface GunEntityRef {kind:GunLocationKind;index:number;uid:string;sourceID:number;paused?:boolean}
export interface GunDestination {kind:GunLocationKind;index:number;uid?:string;sourceID?:number;locked?:boolean;paused?:boolean;autoMerging?:boolean;adReward?:boolean}
export type GunDropIntent='fuse'|'swap'|'equip'|'move';
export interface GunDropRequest {from:GunEntityRef;to:GunDestination;intent:GunDropIntent}
export type GunHover={type:'none'|'self'|'reject';target?:GunDestination;reason?:string}|{type:GunDropIntent;target:GunDestination};
export interface DragPoint {x:number;y:number}
export interface DragRect {x:number;y:number;width:number;height:number}
export interface GunDropTarget {ref:GunDestination;rect:DragRect}
const identities=new WeakMap<Gun,string>();
const runtimeUID=()=>{
  if(typeof globalThis.crypto.randomUUID==='function')return `gun-runtime-${globalThis.crypto.randomUUID()}`;
  // getRandomValues also works on non-secure local previews where randomUUID is absent.
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `gun-runtime-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
/** Catalogue id is not entity identity: duplicate source-gun-0 weapons differ.
 * Persisted uid wins; older sessions receive a stable UUID per object, safe across reloads. */
export function gunEntityUID(gun:Gun):string {
  const uid=(gun as Gun & {uid?:string}).uid;if(uid)return uid;
  let known=identities.get(gun);if(!known){known=runtimeUID();identities.set(gun,known);}return known;
}
export function gunEntityRef(gun:Gun,kind:GunLocationKind,index:number):GunEntityRef{return {kind,index,uid:gunEntityUID(gun),sourceID:sourceGunID(gun),paused:gun.paused};}
export function classifyGunHover(from:GunEntityRef,to:GunDestination|undefined,gunCount=65):GunHover {
  if(!to)return {type:'none'};
  if(from.kind===to.kind&&from.index===to.index)return {type:'self',target:to};
  if(to.locked||to.autoMerging||to.adReward)return {type:'reject',target:to,reason:to.locked?'装备槽未解锁':'武器暂时无法移动'};
  if(to.uid===from.uid)return {type:'reject',target:to,reason:'武器位置已变化'};
  if(from.kind==='inventory'&&to.kind==='inventory'&&to.sourceID!==undefined){
    if(Math.floor(from.sourceID/5)===Math.floor(to.sourceID/5)){
      if(from.paused||to.paused)return {type:'reject',target:to,reason:'受保护武器不可合成'};
      if((Math.floor(from.sourceID/5)+1)*5>=gunCount)return {type:'reject',target:to,reason:'已达最高武器等级'};
      return {type:'fuse',target:to};
    }
    return {type:'swap',target:to};
  }
  if(to.sourceID!==undefined)return {type:'swap',target:to};
  return {type:to.kind==='equipment'?'equip':'move',target:to};
}
export function gunDropRequest(from:GunEntityRef,hover:GunHover):GunDropRequest|undefined {
  return ['fuse','swap','equip','move'].includes(hover.type)&&hover.target?{from,to:hover.target,intent:hover.type as GunDropIntent}:undefined;
}
function overlap(a:DragRect,b:DragRect){return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}
/** Source CheckOverlap shrinks the carried item by OverlapShrink source units;
 * screen scale converts it once. Self is skipped so its broad rectangle cannot
 * obscure another target. Equipment raycast accepts the pointer rectangle. */
export function raycastGunTargets(from:GunEntityRef,point:DragPoint,carried:DragRect,targets:GunDropTarget[],shrink=40,scale=1):GunDestination|undefined {
  const inset=Math.min(Math.max(0,shrink*scale/2),Math.min(carried.width,carried.height)/2);
  const rect={x:carried.x+inset,y:carried.y+inset,width:Math.max(0,carried.width-2*inset),height:Math.max(0,carried.height-2*inset)};
  const contains=(r:DragRect)=>point.x>=r.x&&point.x<=r.x+r.width&&point.y>=r.y&&point.y<=r.y+r.height;
  const equipment=targets.find(t=>t.ref.kind==='equipment'&&contains(t.rect)&&!(from.kind==='equipment'&&from.index===t.ref.index));
  if(equipment)return equipment.ref;
  let best:GunDropTarget|undefined,bestArea=0;
  for(const target of targets){if(target.ref.kind!=='inventory'||from.kind===target.ref.kind&&from.index===target.ref.index)continue;const area=overlap(rect,target.rect);if(area>bestArea){best=target;bestArea=area;}}
  return best?.ref;
}
export interface GunDragState {pointerId:number;from:GunEntityRef;point:DragPoint;hover:GunHover}
/** One pointer owns a drag. Cancellation never emits a transaction. */
export class GunDragController {
  state:GunDragState|null=null;
  begin(pointerId:number,from:GunEntityRef,point:DragPoint){if(this.state)return false;this.state={pointerId,from,point,hover:{type:'none'}};return true;}
  move(pointerId:number,point:DragPoint,target?:GunDestination){if(!this.state||this.state.pointerId!==pointerId)return false;this.state.point=point;this.state.hover=classifyGunHover(this.state.from,target);return true;}
  end(pointerId:number):GunDropRequest|undefined {if(!this.state||this.state.pointerId!==pointerId)return;const request=gunDropRequest(this.state.from,this.state.hover);this.state=null;return request;}
  cancel(pointerId?:number){if(pointerId!==undefined&&this.state?.pointerId!==pointerId)return false;const had=!!this.state;this.state=null;return had;}
}
