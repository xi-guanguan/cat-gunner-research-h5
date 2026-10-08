import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceActors,makeActor,makeH5FollowState,H5_FOLLOW_SOURCE_BINDING} from '../cat-actors.ts';
import {createFieldLevel} from '../session.ts';
import {candidateConfig} from '../config.ts';
import {worldToField,fieldToWorld} from '../field-space.ts';
const base=createFieldLevel(0,0,0,undefined,19);
const config={...candidateConfig,arena:{...candidateConfig.arena,height:100}};
function fixture(distance=7.5) {
 const player=makeActor(0,worldToField(-100,50));
 const ai=makeActor(1,worldToField(-100+distance,52.5));
 ai.followState=makeH5FollowState(1);
 return {...base,elapsed:1,autoMove:true,player:player.position,actors:[player,ai],targets:[{...base.targets[0],health:0}]};
}
test('explicit H5 source bindings preserve two-entry ring and unmapped special',()=>{
 assert.deepEqual(H5_FOLLOW_SOURCE_BINDING,{0:147400,1:136809,2:136808});
 assert.equal(makeH5FollowState(1).formationOffset.z,2.5);
 assert.equal(makeH5FollowState(2).formationOffset.z,-2.5);
 assert.equal(makeH5FollowState(3).sourceCatPathID,null);
});
test('leader history records before manual player movement and copies old world vectors',()=>{
 const state=fixture(20); state.actors[0].leaderHistory=[{time:0,position:{x:-110,y:0,z:50}}];
 const [leader]=advanceActors(state,.1,{moveX:1},config,[0,1]);
 assert.equal(leader.leaderHistory.at(-1).position.x,-100);
 assert.ok(fieldToWorld(leader.position).x>-100);
 leader.leaderHistory[0].position.x=99;
 assert.equal(state.actors[0].leaderHistory[0].position.x,-110);
});
test('strict near boundary stops below7.5 and far skips fidget exactly7.5',()=>{
 const near=advanceActors(fixture(7.4),.1,{},config,[0,1])[1];
 assert.deepEqual(near.velocity,{x:0,y:0});
 assert.ok(near.followState.fidgetTimer>0);
 const far=advanceActors(fixture(7.5),.1,{},config,[0,1])[1];
 assert.ok(far.velocity.x<0);
 assert.equal(far.followState.fidgetTimer,0);
});
test('lag target consumes latest eligible sample without interpolation',()=>{
 const state=fixture(15);
 state.actors[0].leaderHistory=[{time:.1,position:{x:-140,y:0,z:50}},{time:.6,position:{x:-110,y:0,z:50}},{time:.9,position:{x:100,y:0,z:50}}];
 state.actors[1].followState.lagSeconds=.3;
 const actor=advanceActors(state,.1,{},config,[0,1])[1];
 assert.ok(actor.velocity.x<0);
});
test('fidget near ordering uses old offset then resamples; persistence and ownership are independent',()=>{
 const state=fixture(7.4); const original=state.actors[1].followState;
 original.fidgetTimer=original.fidgetInterval-.05;
 const next=advanceActors(state,.1,{},config,[0,1]);
 assert.deepEqual(next[1].velocity,{x:0,y:0});
 assert.equal(next[1].followState.fidgetTimer,0);
 assert.notDeepEqual(next[1].followState.fidgetOffset,original.fidgetOffset);
 assert.deepEqual(original.fidgetOffset,{x:0,y:0,z:0});
 const nextState={...state,actors:next,player:next[0].position,elapsed:1.1};
 const restored=JSON.parse(JSON.stringify(nextState));
 assert.deepEqual(advanceActors(restored,.1,{},config,[0,1]),advanceActors(nextState,.1,{},config,[0,1]));
});
