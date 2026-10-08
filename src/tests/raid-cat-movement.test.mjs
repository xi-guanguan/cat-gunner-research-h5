// Source-derived math/dispatch contracts, no native device/PhysX equivalence.
import test from 'node:test';import assert from 'node:assert/strict';
import {sourceRaidApproachPosition as approach,sourceRaidCatAIMovementFrame as advance,SOURCE_RAID_AI as constants} from '../raid-cat-movement';
import {freshSourceHuntCatMovementState} from '../hunt-cat-movement';
import native from '../data/raid-ai-source.json';
const f=Math.fround,zero=()=>({x:0,y:0,z:0});
const state=(extra={})=>({...freshSourceHuntCatMovementState(zero()),...extra});
const frame=(extra={})=>({dt:.125,moveSpeed:17,speedMultiplier:1,rayOrigin:{x:0,y:2,z:0},targetPosition:null,offScreenTargetPosition:null,
 mapCenter:{x:-100,y:0,z:0},breadcrumbs:[],leaderPosition:zero(),leaderTargetPosition:null,nearHitPoint:zero(),autoStopDistance:12,attackLength:40,
 laggedLeaderPosition:zero(),formationOffset:zero(),fidgetOffset:zero(),...extra});
const adapter={screenSpeedMultiplier:()=>1,correctDirection:p=>p,pathClear:()=>true};
const near=(a,b,eps=.00002)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function forced(which,s=state(),input=frame(),a=adapter){return advance(s,{state:which,timer:0},input,a);}
test('source literals prove right fallback, .85 assist, .4 drift, .3 squared gate',()=>{
 assert.equal(native.nativeSha256,'80eb8bcbebd058ffb4beac5d8d7d544066587a7a1abee8898874847ff13dc583');assert.deepEqual(native.fallbackVector,[1,0,0]);
 assert.equal(constants.assistRadiusRatio,f(.85));assert.equal(constants.attackStayDriftMultiplier,f(.4));assert.equal(constants.attackStaySeparationSquared,f(.3));
});
test('GetApproachPosition uses target Y, current-target XZ and Vector3.right at coincidence',()=>{
 assert.deepEqual(approach({x:3,y:99,z:4},{x:0,y:7,z:0},10),{x:6,y:7,z:8});
 assert.deepEqual(approach({x:5,y:1,z:6},{x:5,y:9,z:6},2),{x:7,y:9,z:6});
 assert.deepEqual(approach({x:5,y:1,z:6},{x:5,y:9,z:6},0),{x:5,y:9,z:6});
});
test('fallback comparison is on float32 XZ square .001, not distance .001 or magnitude .01',()=>{
 assert.deepEqual(approach({x:0,y:99,z:.03},zero(),5),{x:5,y:0,z:0});
 assert.deepEqual(approach({x:0,y:99,z:.04},zero(),5),{x:0,y:0,z:5});
});
test('desired state adoption waits minimum .3 then resets clock and dispatches new state',()=>{
 const input=frame({targetPosition:{x:10,y:0,z:0},nearHitPoint:{x:10,y:0,z:0}});
 const a=advance(state(),{state:0,timer:0},input,adapter);assert.equal(a.desiredState,2);assert.equal(a.ai.state,0);assert.equal(a.ai.timer,.125);
 const b=advance(state(),a.ai,input,adapter),c=advance(state(),b.ai,input,adapter);assert.equal(b.ai.state,0);assert.equal(c.ai.state,2);assert.equal(c.ai.timer,0);assert.equal(c.action,'stop');
});
test('desired-state approach radius is AttackLength*.85, not .8',()=>{
 const input=frame({targetPosition:{x:55,y:0,z:0},nearHitPoint:{x:40,y:0,z:0}});
 const a=advance(state(),{state:0,timer:1},input,adapter);assert.equal(a.desiredState,0); // goal21>20; .8 would goal23, use boundary below
 const b=advance(state(),{state:0,timer:1},frame({...input,targetPosition:{x:54,y:0,z:0}}),adapter);assert.equal(b.desiredState,1); // goal20<=20; .8 ->22 -> follow
});
test('Follow goal preserves source lag+formation+fidget; near calls fidget and stop',()=>{
 const input=frame({laggedLeaderPosition:{x:1,y:2,z:3},formationOffset:{x:0,y:0,z:2.5},fidgetOffset:{x:.4,y:0,z:.2}});
 const r=forced(0,state({smoothVelocity:{x:1,y:0,z:1},bodyVelocity:{x:5,y:7,z:2}}),input);
 assert.deepEqual(r.goal,{x:f(1+f(.4)),y:2,z:f(f(3+2.5)+f(.2))});assert.equal(r.action,'stop');assert.equal(r.runFidget,true);assert.deepEqual(r.movement.bodyVelocity,{x:0,y:7,z:0});
});
test('Follow near separation .1 squared gate calls drift .3; far skips fidget',()=>{
 const r=forced(0,state({separationForce:{x:1,y:0,z:0}}));assert.equal(r.action,'drift');near(r.movement.bodyVelocity.x,17*f(.3));assert.equal(r.runFidget,true);
 const far=forced(0,state(),frame({laggedLeaderPosition:{x:7.5,y:0,z:0}}));assert.equal(far.action,'move');assert.equal(far.runFidget,false); // equality is far
});
test('Follow target-facing persists even when movement stops and source radius14 is NOT applied',()=>{
 const s=state({position:{x:-130,y:0,z:0}}),r=forced(0,s,frame({leaderPosition:s.position,laggedLeaderPosition:s.position,targetPosition:{x:-140,y:0,z:0},nearHitPoint:{x:-140,y:0,z:0}}));
 assert.equal(r.movement.position.x,-130);assert.equal(r.movement.flipX,true);assert.equal(r.action,'stop');
});
test('Chase uses nearHitPoint rather than live target; no-target is no-write',()=>{
 const r=forced(1,state(),frame({targetPosition:{x:100,y:0,z:0},nearHitPoint:{x:20,y:0,z:0}}));assert.deepEqual(r.goal,{x:8,y:0,z:0});assert.equal(r.action,'move');
 const s=state({bodyVelocity:{x:8,y:7,z:2},running:true}),none=forced(1,s);assert.equal(none.movement,s);assert.equal(none.action,'no-target');
});
test('Chase arrival uses 3D distance strict .5 and preserves rbY',()=>{
 const input=frame({targetPosition:{x:50,y:0,z:0},nearHitPoint:{x:12.25,y:0,z:0}}),r=forced(1,state({bodyVelocity:{x:1,y:7,z:2}}),input);
 assert.equal(r.action,'stop');assert.equal(r.movement.bodyVelocity.y,7);
 assert.equal(forced(1,state(),frame({...input,nearHitPoint:{x:12.5,y:0,z:0}})).action,'move');
 assert.equal(forced(1,state(),frame({...input,nearHitPoint:{x:12.25,y:1,z:0}})).action,'move');
});
test('AttackStay separation gate .3 is squared full Vector3; drift .4 and face live target',()=>{
 const r=forced(2,state({separationForce:{x:.6,y:0,z:0}}),frame({targetPosition:{x:-10,y:0,z:5}}));assert.equal(r.action,'drift');near(r.movement.bodyVelocity.x,17*f(.4));assert.equal(r.movement.flipX,true);
 assert.equal(forced(2,state({separationForce:{x:.5,y:0,z:0}})).action,'stop');
 // Full square opens branch while XZ drift is too tiny: preserve state, not invented stop.
 const s=state({separationForce:{x:0,y:1,z:0},bodyVelocity:{x:9,y:7,z:4}}),tiny=forced(2,s);assert.equal(tiny.action,'drift-no-write');assert.equal(tiny.movement,s);
});
test('Reposition uses cached hit plus MinEnemyDist+.5 and same right fallback',()=>{
 const r=forced(3,state(),frame({targetPosition:{x:99,y:0,z:0},nearHitPoint:zero()}));assert.deepEqual(r.goal,{x:5.5,y:0,z:0});assert.equal(r.action,'move');
 const s=state({running:true});assert.equal(forced(3,s).movement,s);
});
test('Assist uses leader TARGET transform, caps full3D radius to max*.85, stops without target',()=>{
 const r=forced(4,state(),frame({leaderTargetPosition:{x:100,y:0,z:0},nearHitPoint:{x:-80,y:0,z:0}}));near(r.goal.x,17);assert.equal(r.action,'move');
 const no=forced(4,state({bodyVelocity:{x:4,y:7,z:3}}));assert.equal(no.action,'stop');assert.equal(no.movement.bodyVelocity.y,7);
 const high=forced(4,state(),frame({leaderTargetPosition:{x:0,y:100,z:0}}));near(Math.hypot(high.goal.x,high.goal.y,high.goal.z),17,.0001);
});
test('ordinary move still uses native obstacle129 query and breadcrumb fallback',()=>{
 let query;const r=forced(1,state(),frame({targetPosition:{x:100,y:0,z:0},nearHitPoint:{x:20,y:0,z:0},rayOrigin:{x:1,y:2,z:3},breadcrumbs:[zero(),...Array.from({length:4},()=>({x:100,y:0,z:0})),{x:-1,y:0,z:2}]}),{...adapter,pathClear:(...args)=>{query=args;return false;}});
 assert.equal(query[3],129);assert.deepEqual(query[0],{x:1,y:2,z:3});assert.equal(r.usedBreadcrumb,true);assert.deepEqual(r.goal,{x:-1,y:0,z:2});
});
test('invalid ordinary AI inputs reject; source state is not mutated',()=>{
 const s=state();for(const delta of [-1,NaN,Infinity])assert.throws(()=>forced(0,s,frame({dt:delta})),RangeError);
 assert.throws(()=>advance(s,{state:5,timer:0},frame(),adapter),RangeError);assert.throws(()=>approach(zero(),zero(),-1),RangeError);assert.deepEqual(s.position,zero());
});
