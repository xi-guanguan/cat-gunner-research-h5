import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {sourceDragCaptureTransform,sourceDragRestoreTransform,sourceDragShiftInView} from '../source-drag-transform';
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pose=(box)=>{const m=sourceDragCaptureTransform(box);return [m.a,m.b,m.c,m.d,m.tx,m.ty];};
test('drag preview converts root delta through scaled rotated translated parent',()=>{
 for(const scale of [.25,.5,1,2])for(const rotation of [0,.4]){
  const root=new Container(),parent=new Container(),box=new Container();root.addChild(parent);parent.addChild(box);root.position.set(19,51);root.scale.set(1.2,.9);parent.scale.set(scale,scale*1.1);parent.rotation=rotation;parent.position.set(39,84);box.position.set(924.5,124.7484);box.scale.set(.9,1.2);box.pivot.set(4,3);
  const matrix=sourceDragCaptureTransform(box),before=root.toLocal(box.toGlobal({x:0,y:0}));sourceDragShiftInView(box,root,{x:-130,y:87.5});const after=root.toLocal(box.toGlobal({x:0,y:0}));close(after.x-before.x,-130);close(after.y-before.y,87.5);sourceDragRestoreTransform(box,matrix);assert.deepEqual(pose(box),[matrix.a,matrix.b,matrix.c,matrix.d,matrix.tx,matrix.ty]);root.destroy({children:true});
 }
});
test('capture after restore in same frame cannot retain previous preview matrix',()=>{
 const root=new Container(),parent=new Container(),box=new Container();root.addChild(parent);parent.addChild(box);parent.scale.set(.5);box.position.set(144.5,124.7484130859375);const base=pose(box);
 for(let i=0;i<100;i++){const m=sourceDragCaptureTransform(box);sourceDragShiftInView(box,root,{x:130,y:87.5});sourceDragCaptureTransform(box);sourceDragRestoreTransform(box,m);const m2=sourceDragCaptureTransform(box);sourceDragShiftInView(box,root,{x:390,y:175});sourceDragRestoreTransform(box,m2);assert.deepEqual(pose(box),base);}root.destroy({children:true});
});
test('capture refreshes local matrix after position/press scale without renderer',()=>{
 const box=new Container();box.position.set(404.5,299.7484);box.scale.set(.9);let m=sourceDragCaptureTransform(box);close(m.tx,404.5);close(m.ty,299.7484);close(m.a,.9);box.position.set(5,8);box.scale.set(1);sourceDragRestoreTransform(box,m);close(box.x,404.5);close(box.scale.x,.9);assert.deepEqual(pose(box),[m.a,m.b,m.c,m.d,m.tx,m.ty]);box.destroy();
});
