import test from 'node:test';
import assert from 'node:assert/strict';
import {GunDragController,gunEntityRef,gunEntityUID,classifyGunHover,raycastGunTargets,gunDropRequest} from '../gun-drag.ts';
import {SOURCE_GUN_PRESS,SOURCE_GUN_RELEASE_SECONDS,SOURCE_GUN_RELEASE_STAGES,SOURCE_GUN_SPAWN_SECONDS,SOURCE_GUN_SPAWN_STAGES,SourceMotion,SourceBounceMotion,SOURCE_GUN_PANEL_BOUNCE,sourceOpenScale,SourceNewItemOpenMotion} from '../source-motion.ts';
const ref=(kind,index,id,uid=`${kind}-${index}`)=>({kind,index,sourceID:id,uid});
const from=ref('inventory',0,0);
test('source CheckOverlap merges a group rather than requiring identical catalogue IDs',()=>{
 assert.equal(classifyGunHover(from,ref('inventory',1,4)).type,'fuse');
 assert.equal(classifyGunHover(from,ref('inventory',1,5)).type,'swap');
 assert.equal(classifyGunHover(from,ref('equipment',1,4)).type,'swap');
 assert.equal(classifyGunHover(ref('inventory',0,64),ref('inventory',1,60)).type,'reject');
});
test('equipment/empty inventory destinations and protected state are distinct',()=>{
 assert.equal(classifyGunHover(from,{kind:'equipment',index:1}).type,'equip');
 assert.equal(classifyGunHover(ref('equipment',1,3),{kind:'inventory',index:4}).type,'move');
 for(const state of ['locked','paused','autoMerging','adReward'])assert.equal(classifyGunHover(from,{...ref('inventory',1,4),[state]:true}).type,'reject');
 assert.equal(classifyGunHover(from,ref('inventory',0,0)).type,'self');
 assert.equal(classifyGunHover(from,{...ref('inventory',1,0),uid:from.uid}).type,'reject');
 assert.equal(gunDropRequest(from,{type:'reject',target:ref('inventory',1,0)}),undefined);
});
test('identical catalogue guns have separate runtime identity; persistent uid wins',()=>{
 const a={id:'source-gun-0'},b={id:'source-gun-0'};assert.notEqual(gunEntityUID(a),gunEntityUID(b));assert.equal(gunEntityUID(a),gunEntityUID(a));
 assert.equal(gunEntityRef({...a,uid:'persisted-17'},'inventory',2).uid,'persisted-17');
 assert.match(gunEntityUID(a),/^gun-runtime-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.notEqual(gunEntityUID({...a,uid:'gun-runtime-1'}),gunEntityUID({id:a.id}));
});
test('single-pointer drag rejects another pointer, cancels without transaction and emits once',()=>{
 const controller=new GunDragController();assert.equal(controller.begin(4,from,{x:0,y:0}),true);assert.equal(controller.begin(5,from,{x:0,y:0}),false);
 assert.equal(controller.move(5,{x:1,y:1},ref('inventory',1,0)),false);assert.equal(controller.end(5),undefined);assert.equal(controller.state.pointerId,4);
 controller.move(4,{x:1,y:1},ref('inventory',1,4));assert.equal(controller.end(4).intent,'fuse');assert.equal(controller.end(4),undefined);
 controller.begin(4,from,{x:0,y:0});controller.move(4,{x:1,y:1},ref('inventory',1,4));controller.cancel();assert.equal(controller.end(4),undefined);
});
test('40 source-unit overlap shrink rejects a grazing edge and scales with viewport',()=>{
 const carried={x:0,y:0,width:100,height:100};const targets=[{ref:ref('inventory',1,5),rect:{x:0,y:0,width:15,height:100}}];
 assert.equal(raycastGunTargets(from,{x:10,y:50},carried,targets),undefined);
 assert.equal(raycastGunTargets(from,{x:10,y:50},carried,targets,40,.5).index,1);
 const same=[{ref:from,rect:carried},...targets];assert.equal(raycastGunTargets(from,{x:50,y:50},carried,same),undefined);
});
test('equipment uses continuous pointer raycast and takes priority over broad inventory overlap',()=>{
 const targets=[{ref:ref('inventory',1,5),rect:{x:0,y:0,width:100,height:100}},{ref:{kind:'equipment',index:1},rect:{x:40,y:40,width:20,height:20}}];
 assert.equal(raycastGunTargets(from,{x:50,y:50},{x:0,y:0,width:100,height:100},targets).kind,'equipment');
 const controller=new GunDragController();controller.begin(1,from,{x:50,y:50});controller.move(1,{x:50,y:50},ref('inventory',1,4));assert.equal(controller.state.hover.type,'fuse');controller.move(1,{x:50,y:50},ref('inventory',1,5));assert.equal(controller.state.hover.type,'swap');controller.move(1,{x:-20,y:50});assert.equal(controller.state.hover.type,'none');
});
const scaleTarget=()=>({scale:{x:2,y:3,set(x,y=x){this.x=x;this.y=y;}}});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
test('Gun_Item press follows recovered SmoothStep including off-midpoint samples',()=>{
 const target=scaleTarget(),motion=new SourceMotion(target);motion.press();motion.update(SOURCE_GUN_PRESS.pressSeconds/4);near(motion.value,1+(.9-1)*.15625);motion.update(SOURCE_GUN_PRESS.pressSeconds/4);near(target.scale.x,1.9);motion.update(SOURCE_GUN_PRESS.pressSeconds/2);near(target.scale.x,1.8);assert.equal(motion.active,false);
});
test('native click release uses all three overshoot/recovery stages rather than serialized .15s',()=>{
 const target=scaleTarget(),motion=new SourceMotion(target);motion.press();motion.update(1);let completed=0;motion.release(undefined,()=>completed++);
 motion.update(SOURCE_GUN_RELEASE_STAGES[0].seconds/4);near(motion.value,.9+(1.05-.9)*.15625);motion.update(SOURCE_GUN_RELEASE_STAGES[0].seconds*3/4);near(motion.value,1.05);
 motion.update(SOURCE_GUN_RELEASE_STAGES[1].seconds);near(motion.value,.98);assert.equal(completed,0);
 motion.update(SOURCE_GUN_RELEASE_STAGES[2].seconds);assert.equal(target.scale.x,2);assert.equal(target.scale.y,3);assert.equal(completed,1);motion.update(1);assert.equal(completed,1);near(SOURCE_GUN_RELEASE_SECONDS,.19);
});
test('native spawn starts at zero and traverses four confirmed stages in .34s',()=>{
 const target=scaleTarget(),motion=new SourceMotion(target);let completed=0;motion.spawn(()=>completed++);assert.equal(target.scale.x,0);motion.update(SOURCE_GUN_SPAWN_STAGES[0].seconds/4);near(motion.value,1.1*.15625);motion.update(SOURCE_GUN_SPAWN_STAGES[0].seconds*3/4);near(motion.value,1.1);
 for(const stage of SOURCE_GUN_SPAWN_STAGES.slice(1)){motion.update(stage.seconds);near(motion.value,stage.scale);}
 assert.equal(completed,1);assert.equal(target.scale.x,2);near(SOURCE_GUN_SPAWN_SECONDS,.34);
 const whole=new SourceMotion(scaleTarget());whole.spawn();whole.update(SOURCE_GUN_SPAWN_SECONDS+.1);assert.equal(whole.value,1);assert.equal(whole.active,false);
});
test('motion interruptions retain current scale and reset cancels pending completion',()=>{
 const target=scaleTarget(),motion=new SourceMotion(target);let complete=0;motion.spawn(()=>complete++);motion.update(.1);const before=motion.value;motion.press();assert.equal(motion.value,before);motion.update(1);near(motion.value,.9);assert.equal(complete,0);motion.release(undefined,()=>complete++);motion.reset();motion.update(1);assert.equal(complete,0);assert.equal(target.scale.x,2);
});
test('Open streamed curves belong to the item popup, with pet-only binding and separate glow ending',()=>{
 near(sourceOpenScale('Panel',0)[0],0);near(sourceOpenScale('Panel',Math.fround(1/3))[0],1.1);near(sourceOpenScale('Panel',.5)[0],.98);near(sourceOpenScale('Panel',1/6)[0],.55);near(sourceOpenScale('Panel',2)[0],1);
 near(sourceOpenScale('Panel/Glow',.5)[0],1.1);near(sourceOpenScale('Panel/Glow',2)[0],0);assert.equal(sourceOpenScale('Panel/Glow',2)[2],1);
 near(sourceOpenScale('Panel/Pet_Item',0)[0],1.2);near(sourceOpenScale('Panel/Pet_Item',Math.fround(5/3))[0],1.3);near(sourceOpenScale('Panel/Pet_Item',2)[0],0);
 const panel=scaleTarget(),glow=scaleTarget(),motion=new SourceNewItemOpenMotion({'Panel':panel,'Panel/Glow':glow});let complete=0;motion.play(()=>complete++);assert.equal(panel.scale.x,0);motion.update(.5);near(panel.scale.x,.98);near(glow.scale.x,1.1);motion.update(1.5);assert.equal(panel.scale.x,1);assert.equal(glow.scale.x,0);assert.equal(complete,1);motion.update(1);assert.equal(complete,1);motion.play(()=>complete++);motion.stop();motion.update(2);assert.equal(complete,1);
});
test('serialized BounceBtn uses 0.1 seconds for both branches and permits rapid presses',()=>{
 const target=scaleTarget(),motion=new SourceBounceMotion(target,SOURCE_GUN_PANEL_BOUNCE[123932]);motion.pointerDown();motion.update(.05);assert.ok(Math.abs(target.scale.x-1.9)<1e-6);motion.update(.05);assert.ok(Math.abs(target.scale.x-1.8)<1e-6);motion.pointerUp();motion.update(.1);assert.equal(target.scale.x,2);motion.pointerDown();motion.update(.1);motion.pointerUp();motion.update(.1);assert.equal(target.scale.x,2);motion.reset();assert.equal(motion.pressed,false);
 assert.ok(Math.abs(SOURCE_GUN_PANEL_BOUNCE[125154]-.95)<1e-6);
});
