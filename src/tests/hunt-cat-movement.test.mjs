import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_HUNT_MOVE_PARAMETERS as C,freshSourceHuntCatMovementState,sourceHuntCatSmoothStop,
 sourceHuntCatSeparationDrift,sourceHuntCatPathClear,sourceHuntCatMoveToward,sourceHuntCatAIMovementFrame,
 sourceHuntComputeSeparation,sourceHuntLeaderVelocity} from '../hunt-cat-movement.ts';
import {SOURCE_CAT_CAMERA_INPUTS as camera,SOURCE_CAT_CORRECTION_YAW_H5,SOURCE_CAT_JOYSTICK_YAW_H5,
 sourceCatYawQuaternionH5,sourceCatRotateVector,sourceCatCorrectDirectionH5,sourceCatScreenSpeedMultiplierH5} from '../source-cat-quaternion.ts';
import source from '../data/hunt-cat-source.json';
const f=Math.fround,zero=()=>({x:0,y:0,z:0}),center={x:-100,y:0,z:0};
const adapter={screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,pathClear:()=>true};
const frame=(extra={})=>({dt:.125,moveSpeed:17,speedMultiplier:1,rayOrigin:{x:-100,y:2,z:0},targetPosition:null,offScreenTargetPosition:null,mapCenter:center,breadcrumbs:[],...extra});
const state=(extra={})=>({...freshSourceHuntCatMovementState(center),...extra});
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const participant=(x,isAI=true,extra={})=>({valid:true,isAI,position:{x,y:0,z:0},separationForce:zero(),...extra});
test('all four1460-byte Cat and108-byte manager fully parsed; Vector3 does not shift movement fields',()=>{
 assert.equal(source.cats.length,4);assert.ok(source.cats.every(c=>c.parsedBytes===1460));
 assert.equal(C.separationRadius,f(1.8));assert.equal(C.separationStrength,3);assert.equal(C.obstacleLayerMask,129);
 assert.equal(C.minSpeedRatio,f(.15));assert.equal(C.velocitySmoothSpeed,8);assert.deepEqual(source.manager.Cat_list.map(x=>x.pathID),[147400,136809,136808]);
});
test('Quaternion wrapper identifies RADIANS; yaw-only correction and joystick inverse are not .785 degrees',()=>{
 assert.ok(camera.eulerIcall.includes('Internal_FromEulerRad_Injected'));assert.equal(camera.joystickYawRadians,f(-Math.PI/4));assert.equal(camera.camCorrectionYawRadians,f(Math.PI/4));
 const q=sourceCatYawQuaternionH5(camera.camCorrectionYawRadians);assert.deepEqual(q,SOURCE_CAT_CORRECTION_YAW_H5);
 const v=sourceCatRotateVector(q,{x:0,y:2,z:1});near(v.x,Math.SQRT1_2);near(v.z,Math.SQRT1_2);assert.equal(v.y,2);
 const original={x:2,y:7,z:3};const corrected=sourceCatCorrectDirectionH5(original);const back=sourceCatRotateVector(SOURCE_CAT_JOYSTICK_YAW_H5,corrected);
 near(back.x,original.x);near(back.y,original.y);near(back.z,original.z);
 assert.throws(()=>sourceCatYawQuaternionH5(NaN),RangeError);assert.throws(()=>sourceCatRotateVector(q,{x:Infinity,y:0,z:0}),RangeError);
});
test('screen-speed contract corrects direction before using pitchSin, does not return constant1',()=>{
 near(sourceCatScreenSpeedMultiplierH5({x:1,y:0,z:0}),1.0206207);near(sourceCatScreenSpeedMultiplierH5({x:0,y:0,z:1}),1.0206207);
 const a=sourceCatScreenSpeedMultiplierH5({x:Math.SQRT1_2,y:0,z:Math.SQRT1_2}),b=sourceCatScreenSpeedMultiplierH5({x:-Math.SQRT1_2,y:0,z:Math.SQRT1_2});
 near(a,1/1.2);near(b,1/(1.2*camera.screenPitchSin));assert.notEqual(a,b);assert.equal(sourceCatScreenSpeedMultiplierH5(zero()),1);
});
test('SmoothStop private 3D velocity decays and Run stops only below post-lerp square .01; rbY survives',()=>{
 const s=state({smoothVelocity:{x:1,y:.4,z:2},bodyVelocity:{x:9,y:7,z:4},aiMoveDir:{x:1,y:0,z:0},running:true});
 const a=sourceHuntCatSmoothStop(s,.0625);assert.deepEqual(a.smoothVelocity,{x:.5,y:f(.2),z:1});assert.deepEqual(a.bodyVelocity,{x:.5,y:7,z:1});assert.equal(a.running,true);assert.deepEqual(a.aiMoveDir,zero());
 const b=sourceHuntCatSmoothStop(s,1);assert.deepEqual(b.smoothVelocity,zero());assert.deepEqual(b.bodyVelocity,{x:0,y:7,z:0});assert.equal(b.running,false);
 assert.equal(sourceHuntCatSmoothStop(state({smoothVelocity:{x:.1,y:0,z:0}}),0).running,true);
 assert.equal(sourceHuntCatSmoothStop(state({smoothVelocity:{x:.09,y:0,z:0}}),0).running,false);
 assert.deepEqual(s.smoothVelocity,{x:1,y:.4,z:2});assert.throws(()=>sourceHuntCatSmoothStop(s,-1),RangeError);
});
test('separation drift tiny XZ force is NO-WRITE, not stop; y epsilon reaches screen adapter',()=>{
 const s=state({bodyVelocity:{x:5,y:7,z:2},smoothVelocity:{x:4,y:1,z:3},separationForce:{x:.001,y:100,z:.001},running:true});
 const tiny=sourceHuntCatSeparationDrift(s,1,17,.5,adapter);assert.equal(tiny.didWrite,false);assert.equal(tiny.state,s);
 let received;const drift=sourceHuntCatSeparationDrift({...s,separationForce:{x:3,y:55,z:4}},.125,17,.5,{screenSpeedMultiplier:v=>{received=v;return 2;}});
 assert.deepEqual(received,{x:f(3/5),y:f(f(.00001)/5),z:f(4/5)});assert.equal(drift.didWrite,true);near(drift.state.bodyVelocity.x,10.2);near(drift.state.bodyVelocity.z,13.6);assert.equal(drift.state.bodyVelocity.y,7);assert.equal(drift.state.running,true);assert.deepEqual(drift.state.aiMoveDir,s.aiMoveDir);
});
test('IsPathClear uses actual Ray_trans origin, source CAT-goal distance and obstacle129 only',()=>{
 let query;const p={x:-100,y:0,z:0},goal={x:-97,y:99,z:4},origin={x:-101,y:2,z:8};
 assert.equal(sourceHuntCatPathClear(p,goal,origin,{pathClear:(...args)=>{query=args;return false;}}),false);
 assert.deepEqual(query,[origin,{x:f(3/5),y:0,z:f(4/5)},5,129]);
 assert.equal(sourceHuntCatPathClear(p,{x:p.x+.005,y:900,z:0},origin,{pathClear:()=>{throw Error('short path does not query');}}),true);
});
test('approach uses source smoothstep minimum .15, multiplicative speed then raw separation*move',()=>{
 const s=state({bodyVelocity:{x:0,y:7,z:0},separationForce:{x:.2,y:99,z:.3}});
 const r=sourceHuntCatMoveToward(s,{x:-99,y:44,z:0},frame({speedMultiplier:2}),{...adapter,screenSpeedMultiplier:()=>3});
 assert.equal(r.speedRatio,f(.5+f(.5*f(.15))));near(r.state.bodyVelocity.x,17*2*r.speedRatio*3+f(.2)*17);near(r.state.bodyVelocity.z,f(.3)*17);assert.equal(r.state.bodyVelocity.y,7);assert.equal(r.state.smoothVelocity.y,0);assert.deepEqual(r.state.aiMoveDir,{x:1,y:0,z:0});assert.equal(r.state.running,true);
 const far=sourceHuntCatMoveToward(s,{x:-98,y:0,z:0},frame(),{...adapter,screenSpeedMultiplier:()=>1});assert.equal(far.speedRatio,1);
});
test('blocked path uses breadcrumb nearest+5, not invented avoidance tangent or ray36',()=>{
 const history=Array.from({length:10},(_,i)=>({x:-100+i,y:0,z:0}));const r=sourceHuntCatMoveToward(state(),{x:-100,y:0,z:10},frame({breadcrumbs:history}),{...adapter,pathClear:()=>false});
 assert.equal(r.usedBreadcrumb,true);assert.deepEqual(r.goal,history[5]);assert.deepEqual(r.state.aiMoveDir,{x:1,y:0,z:0});
 const stopped=sourceHuntCatMoveToward(state(),{x:-90,y:0,z:0},frame(),{...adapter,pathClear:()=>false});assert.equal(stopped.branch,'tiny-stop');assert.deepEqual(stopped.goal,center);
});
test('tiny direction uses3D separation square >.01; pureY can choose drift then perform no writes',()=>{
 const s=state({separationForce:{x:0,y:1,z:0},running:true,bodyVelocity:{x:3,y:7,z:4}});
 const r=sourceHuntCatMoveToward(s,center,frame(),adapter);assert.equal(r.branch,'drift-no-write');assert.equal(r.state,s);
 const stopped=sourceHuntCatMoveToward({...s,separationForce:zero()},center,frame(),adapter);assert.equal(stopped.branch,'tiny-stop');assert.equal(stopped.state.running,false);
 const drift=sourceHuntCatMoveToward({...s,separationForce:{x:1,y:0,z:0}},center,frame(),adapter);assert.equal(drift.branch,'drift');near(drift.state.bodyVelocity.x,17*.5*sourceCatScreenSpeedMultiplierH5({x:1,y:f(.00001),z:0}));
});
test('Hunt goal prioritizes LIVE transform; offscreen cache only when no near target; goalY stays CatY',()=>{
 const s=state({position:{x:-100,y:3,z:0}});
 const r=sourceHuntCatAIMovementFrame(s,frame({targetPosition:{x:-100,y:99,z:40},offScreenTargetPosition:{x:-140,y:2,z:0}}),adapter);assert.deepEqual(r.goal,{x:-100,y:3,z:14});assert.equal(r.branch,'approach');
 const cached=sourceHuntCatAIMovementFrame(s,frame({offScreenTargetPosition:{x:-140,y:2,z:0}}),adapter);assert.deepEqual(cached.goal,{x:-114,y:3,z:0});
 const tiny=sourceHuntCatAIMovementFrame(s,frame({targetPosition:{x:-100,y:999,z:.01}}),adapter);assert.deepEqual(tiny.goal,{x:-100,y:3,z:0});
});
test('arrival <1 forcibly stops rbXZ but does not discard private smooth velocity; distance1 moves',()=>{
 const s=state({position:{x:-100,y:3,z:13.5},smoothVelocity:{x:4,y:1,z:6},bodyVelocity:{x:4,y:7,z:6},running:true});
 const r=sourceHuntCatAIMovementFrame(s,frame({dt:.01,targetPosition:{x:-100,y:0,z:50}}),adapter);assert.equal(r.branch,'arrived');assert.deepEqual(r.state.bodyVelocity,{x:0,y:7,z:0});assert.ok(r.state.smoothVelocity.z>5);assert.equal(r.state.running,false);
 const atOne=sourceHuntCatAIMovementFrame({...s,position:{x:-100,y:3,z:13}},frame({targetPosition:{x:-100,y:0,z:50}}),adapter);assert.equal(atOne.branch,'approach');
});
test('AI radius clamps source position/outward velocity, not private velocity or Y',()=>{
 const r=sourceHuntCatAIMovementFrame(state({position:{x:-80,y:3,z:0},bodyVelocity:{x:4,y:7,z:0}}),frame({targetPosition:{x:-50,y:0,z:0}}),adapter);
 assert.equal(r.state.position.x,-86);assert.equal(r.state.position.y,3);assert.equal(r.state.bodyVelocity.y,7);assert.ok(r.state.bodyVelocity.x<=0);
});
test('ComputeSeparation <2 leaves old forces; invalid AI not cleared, validAI cleared including no near pair',()=>{
 const only=participant(0,true,{separationForce:{x:99,y:7,z:88}});assert.equal(sourceHuntComputeSeparation([only])[0],only);
 const invalid=participant(0,true,{valid:false,separationForce:{x:8,y:7,z:6}}),valid=participant(99,true,{separationForce:{x:99,y:8,z:9}});
 const a=sourceHuntComputeSeparation([invalid,valid]);assert.equal(a[0],invalid);assert.deepEqual(a[1].separationForce,zero());
 const player=participant(0,false,{separationForce:{x:4,y:5,z:6}});assert.equal(sourceHuntComputeSeparation([player,valid])[0],player);
});
test('pair separation uses exact radius1.8/strength3, excludes overlaps<.001 and player only affects AI',()=>{
 const r=sourceHuntComputeSeparation([participant(0,false),participant(1)]);assert.deepEqual(r[0].separationForce,zero());near(r[1].separationForce.x,f(f(1-f(1/f(1.8)))*3));assert.equal(r[1].separationForce.y,0);
 const both=sourceHuntComputeSeparation([participant(0),participant(1)]);assert.equal(both[0].separationForce.x,-both[1].separationForce.x);
 assert.deepEqual(sourceHuntComputeSeparation([participant(0),participant(.0005)])[0].separationForce,zero());assert.deepEqual(sourceHuntComputeSeparation([participant(0),participant(f(1.8))])[0].separationForce,zero());
 const helper=sourceHuntComputeSeparation([participant(0,false),participant(1),participant(-1),participant(.2)]);assert.ok(helper[3].separationForce.x!==0);assert.equal(helper[0].separationForce.x,0);
});
test('leader joystick threshold is strict, x/1.2 and y*1.2 before native-radians yaw, rbY preserved',()=>{
 assert.deepEqual(sourceHuntLeaderVelocity({x:0,y:0},15,7,()=>{throw Error('no rotation at rest');}),{x:0,y:7,z:0});
 let passed;const a=sourceHuntLeaderVelocity({x:1,y:.5},15,7,v=>{passed=v;return v;});assert.deepEqual(passed,{x:f(1/f(1.2)),y:0,z:f(.5*f(1.2))});assert.equal(a.y,7);
 const b=sourceHuntLeaderVelocity({x:1,y:0},15,7,v=>sourceCatRotateVector(SOURCE_CAT_JOYSTICK_YAW_H5,v));near(b.x,15*Math.SQRT1_2/1.2);near(b.z,15*Math.SQRT1_2/1.2);assert.equal(b.y,7);
 assert.throws(()=>sourceHuntLeaderVelocity({x:NaN,y:0},15,7,v=>v),RangeError);
});
test('invalid AI frame is rejected without mutating caller state or querying scene',()=>{
 const s=state();const before=JSON.stringify(s);for(const extra of [{dt:-1},{moveSpeed:-1},{speedMultiplier:NaN},{mapCenter:{x:NaN,y:0,z:0}}])assert.throws(()=>sourceHuntCatAIMovementFrame(s,frame(extra),{...adapter,pathClear:()=>{throw Error('must reject first');}}),RangeError);
 assert.equal(JSON.stringify(s),before);
});
