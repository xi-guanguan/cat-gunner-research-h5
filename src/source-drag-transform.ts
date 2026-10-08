import {Container,Matrix} from 'pixi.js';
/** Pixi 7 caches localTransform until an update/render. Pointer callbacks may
 * restore and re-capture in the same frame; never snapshot the stale cache. */
export function sourceDragCaptureTransform(box:Container):Matrix {
 box.transform.updateLocalTransform();return box.localTransform.clone();
}
export function sourceDragRestoreTransform(box:Container,matrix:Matrix):void {
 box.transform.setFromMatrix(matrix);box.transform.updateLocalTransform();
}
/** Layout deltas are in view-root units; a slot's parent can be scaled/rotated.
 * Convert a vector through both coordinate spaces instead of adding root
 * pixels to local position (which scales the displacement a second time). */
export function sourceDragShiftInView(box:Container,viewRoot:Container,delta:{x:number;y:number}):void {
 const parent=box.parent;if(!parent)throw Error('Drag preview has no parent');
 const a=parent.toLocal(viewRoot.toGlobal({x:0,y:0})),b=parent.toLocal(viewRoot.toGlobal(delta));
 box.position.set(box.x+b.x-a.x,box.y+b.y-a.y);
}
