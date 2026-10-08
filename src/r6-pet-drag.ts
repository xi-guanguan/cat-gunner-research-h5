/** Native Pet_Item overlap/nearest decisions. Geometry is original anchored space,
 * not pointer hit-testing of a slot rectangle. See pet-drag-source-contract.json. */
import geometry from './data/r6-pet-drag-scene.json';
import type {SourcePetState} from './r5-pet';
export interface SourcePetDragPoint {x:number;y:number}
export const SOURCE_PET_DRAG_GEOMETRY=geometry;
const f=Math.fround;
function distance(a:SourcePetDragPoint,b:SourcePetDragPoint):number {
 const x=f(a.x-b.x),y=f(a.y-b.y);return f(Math.sqrt(f(f(x*x)+f(y*y))));
}
function validPoints(points:readonly SourcePetDragPoint[],p:SourcePetDragPoint):void {
 if(points.length!==16||![p,...points].every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)))throw new RangeError('Pet drag geometry');
}
/** IsOverlappingSlot shrinks both rectangles by OverlapShrink, strict edges. */
export function sourcePetDragOverlaps(a:SourcePetDragPoint,b:SourcePetDragPoint,size={x:geometry.size[0],y:geometry.size[1]},shrink=geometry.overlapShrink):boolean {
 if(![a.x,a.y,b.x,b.y,size.x,size.y,shrink].every(Number.isFinite)||shrink<0)throw new RangeError('Pet overlap geometry');
 const hx=f(size.x*.5),hy=f(size.y*.5);
 return f(f(a.x-hx)+shrink)<f(f(b.x+hx)-shrink)&&f(f(a.x+hx)-shrink)>f(f(b.x-hx)+shrink)&&f(f(a.y+hy)-shrink)>f(f(b.y-hy)+shrink)&&f(f(a.y-hy)+shrink)<f(f(b.y+hy)-shrink);
}
export function sourcePetNearestEmpty(s:SourcePetState,point:SourcePetDragPoint,original:number,exclude=-1,positions:readonly SourcePetDragPoint[]=geometry.positions):number {
 validPoints(positions,point);let best=-1,minimum=3.4028234663852886e38;
 for(let i=0;i<16;i++){
  if(i===exclude||(s.owned[i]!==-1&&i!==original))continue;
  const d=distance(point,positions[i]);if(d<minimum){best=i;minimum=d;}
 }
 return best;
}
export type SourcePetOwnedDragDecision={kind:'merge';target:number}|{kind:'swap';target:number;destination:number}|{kind:'move';target:number};
/** CheckOverlap picks nearest active non-auto item in pool order. SetSwapTarget
 * excludes the target and treats mover's original position as an empty candidate. */
export function sourcePetOwnedDragDecision(s:SourcePetState,from:number,point:SourcePetDragPoint,reserved:ReadonlySet<number>=new Set(),positions:readonly SourcePetDragPoint[]=geometry.positions):SourcePetOwnedDragDecision {
 validPoints(positions,point);if(!Number.isInteger(from)||from<0||from>=16||s.owned[from]<0)throw new RangeError('Pet drag mover');
 let target=-1,minimum=3.4028234663852886e38;
 for(let i=0;i<16;i++){
  if(i===from||s.owned[i]<0||reserved.has(i)||!sourcePetDragOverlaps(point,positions[i]))continue;
  const d=distance(point,positions[i]);if(d<minimum){target=i;minimum=d;}
 }
 if(target<0)return {kind:'move',target:sourcePetNearestEmpty(s,point,from,-1,positions)};
 if(s.owned[from]===s.owned[target]&&s.ownedLocks[from]===-1&&s.ownedLocks[target]===-1)return {kind:'merge',target};
 return {kind:'swap',target,destination:sourcePetNearestEmpty(s,positions[target],from,target,positions)};
}
