import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, walletValue } from '../rules.ts';
import { BigValue } from '../big-value.ts';
import { makeActor, makeH5FollowState } from '../cat-actors.ts';
import { createMineBattle, tickMineBattle, mineProgress, createH5MinePerlin } from '../mine-runtime.ts';
import { generateSourceMine, createH5MineRandom, SOURCE_MINE_CONFIG, enterSourceMine } from '../mine-source.ts';
const adapters={random:{nextDouble:()=>0,nextInt:a=>a,evidence:'constant test random'},perlinNoise:()=>1,noiseEvidence:'constant test noise'};
const gun={id:'selected-heavy-gun',damage:1000000,intervalSeconds:.05,slot:0};
const base=()=>({...createLevel(7,0,12345,{power:50,money:10,speed:5}),primaryGun:gun,
 combatModifiers:{permanentDamagePercent:BigValue.from(100000),permanentMoneyPercent:BigValue.from(1000),permanentSpeedPercent:150,skinSpeedPercent:120,attackSpeedBuff:2}});
function oneOre(type=0){
 const run=createMineBattle(base(),7,{adapters,generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1}});
 const t={...run.battle.targets[0],oreType:type,scoreValue:type?10:1,health:type?5:3,maxHealth:type?5:3,
 healthValue:BigValue.from(type?5:3),maxHealthValue:BigValue.from(type?5:3),position:{x:2,y:0}};
 return {...run,battle:{...run.battle,autoMove:false,targets:[t]}};
}
test('source generation count, ore types, and deterministic H5 adapters',()=>{
 const first=createMineBattle(base(),123),second=createMineBattle(base(),123);
 assert.equal(first.generation.activeCount,first.battle.targets.length);assert(first.generation.activeCount<=1000);
 assert.deepEqual(first.battle.targets,second.battle.targets);assert(first.battle.targets.some(t=>t.oreType===0));
 for(const t of first.battle.targets){assert.equal(t.health,t.oreType?5:3);assert.equal(t.scoreValue,t.oreType?10:1);assert.equal(t.coin,0);}
 assert(first.adapterEvidence.perlin.includes('not reproduced'));assert.equal(first.battle.targetBatchSize,0);
 const perlin=createH5MinePerlin(123),again=createH5MinePerlin(123);assert.equal(perlin(2.7,-3.5),again(2.7,-3.5));
});
test('mine damage remains1 despite high gun damage and ordinary/permanent upgrades; no coins awarded',()=>{
 const original=oneOre(),first=tickMineBattle(original,.1),next=tickMineBattle(first,.1);
 assert.equal(first.battle.targets[0].health,1);assert.equal(first.events.find(e=>e.type==='hit').damage,2);
 assert(next.events.some(e=>e.type==='hit'));assert.equal(next.score,1);assert.equal(next.settled,true);
 assert.equal(next.settlementReason,'cleared');assert.equal(next.events.filter(e=>e.type==='death').length,1);
 assert.equal(walletValue(next.battle).toString(),walletValue(original.battle).toString());assert.equal(next.battle.earned,0);
 assert(next.battle.projectiles.every(p=>p.damage===1&&p.damageValue.eq(1)));
 assert.equal(original.battle.targets[0].health,3);assert.equal(original.score,0);
 assert.deepEqual(next.battle.upgradeLevels,original.battle.upgradeLevels);
 const settled=tickMineBattle(next,.1);assert.equal(settled.score,1);assert.deepEqual(settled.events,[]);
});
test('special ore takes five unit hits and scores10 exactly once',()=>{
 let run=oneOre(1);run=tickMineBattle(run,.1);assert.equal(run.settled,false);assert.equal(run.battle.targets[0].health,3);assert.equal(run.score,0);
 let hits=run.events.filter(e=>e.type==='hit').reduce((n,e)=>n+e.damage,0);
 for(let i=0;i<4&&!run.settled;i++){run=tickMineBattle(run,.1);hits+=run.events.filter(e=>e.type==='hit').reduce((n,e)=>n+e.damage,0);}
 assert.equal(hits,5);assert.equal(run.settled,true);assert.equal(run.score,10);
 assert.equal(run.events.filter(e=>e.type==='death').length,1);assert.equal(mineProgress(run).destroyedCount,1);
});
test('selected slots and source speed modifiers are reused with no stage attack penalty',()=>{
 const options={adapters,generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1},guns:[{...gun,intervalSeconds:.6},null,{...gun,id:'secondary',intervalSeconds:.3,slot:2}]};
 let run=createMineBattle(base(),1,options);run={...run,battle:{...run.battle,autoMove:false,targets:run.battle.targets.map(t=>({...t,position:{x:20,y:0}}))}};
 const a=tickMineBattle(run,.01),b=tickMineBattle({...run,battle:{...run.battle,stage:100}},.01);
 assert.deepEqual(a.battle.shotEvents.map(e=>e.gunSlot),[0,2]);assert.deepEqual(a.battle.shotEvents.map(e=>e.weaponId),['selected-heavy-gun','secondary']);
 assert.equal(a.battle.shootCooldown,b.battle.shootCooldown);assert(a.battle.shootCooldown<.3);
 assert(a.battle.projectiles.every(p=>p.damage===1));
});
test('world identity coordinates and muzzle resolver survive internal positive translation',()=>{
 let run=oneOre(1);run={...run,battle:{...run.battle,targets:run.battle.targets.map(t=>({...t,position:{x:-90,y:-20}})),player:{x:-100,y:-20},actors:undefined}};
 let calls=0;
 const resolver=(actor,_weapon,state)=>{calls++;assert(actor.position.x<0);assert(state.player.x<0);assert.equal(state.targets[0].position.x,-90);return {position:{x:actor.position.x+1,y:actor.position.y},height:3};};
 const next=tickMineBattle(run,.01,{},resolver);
 assert(calls>0);assert.equal(next.battle.player.x,-100);assert.equal(next.battle.player.y,-20);
 assert.equal(next.battle.shotEvents[0].muzzle.x,-99);assert.equal(next.battle.shotEvents[0].muzzle.y,-20);assert.equal(next.battle.shotEvents[0].height,3);
 assert.equal(run.battle.player.x,-100);
});
test('timeout clamps last step, preserves score and stops future shots or input',()=>{
 const run={...oneOre(1),durationSeconds:.05};const next=tickMineBattle(run,.1,{moveX:1});
 assert.equal(next.elapsed,.05);assert.equal(next.settled,true);assert.equal(next.settlementReason,'timeout');assert.equal(mineProgress(next).remainingSeconds,0);
 const end=tickMineBattle(next,.25,{moveX:1});assert.deepEqual(end.battle.player,next.battle.player);assert.equal(end.elapsed,.05);assert.deepEqual(end.events,[]);
 assert.throws(()=>tickMineBattle(run,.3),/0..0.25/);
});
test('inactive pool entries are not active targets, while source remaining counter persists until timeout',()=>{
 const config={...SOURCE_MINE_CONFIG,poolCapacity:4};
 const noOre={...adapters,perlinNoise:()=>0};const run=createMineBattle(base(),3,{adapters:noOre,generationConfig:config});
 assert.equal(run.battle.targets.length,0);assert.equal(mineProgress(run).activeCount,0);assert.equal(run.sourceOreCountNow,4);
 const next=tickMineBattle(run,.1);assert.equal(next.settled,false);assert.equal(next.battle.phase,'playing');
 const end=tickMineBattle({...next,durationSeconds:.15},.1);assert.equal(end.settlementReason,'timeout');
});
test('time pack affects duration only and tickets remain a separate caller-managed entry gate',()=>{
 const run=createMineBattle(base(),3,{adapters,generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1},plusTimePackActive:true});
 assert.equal(run.durationSeconds,Math.fround(60*Math.fround(1.3)));
 const blocked=enterSourceMine({used:2,storedDate:'2026-09-30'},false,'2026-09-30',null);assert.equal(blocked.status,'blocked');
});

test('mine missile world endpoints remain unchanged through several internal coordinate translations',()=>{
 const selected={id:'source-gun-24',sourceType:5,damage:600,intervalSeconds:2,missileSpeed:30,missileExplosionRadius:5,slot:0};
 let run=createMineBattle(base(),7,{adapters,generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1},guns:[selected],spawn:{x:-100,y:-20}});
 run={...run,battle:{...run.battle,autoMove:false,combatModifiers:undefined,upgradeLevels:{power:0,money:0,speed:0},
  actors:[{id:0,role:'player',position:{x:-100,y:-20},velocity:{x:0,y:0},aim:{x:1,y:0},breadcrumbs:[],searchTimer:.3,autoTargetId:null,aimTargetId:run.battle.targets[0].id,
   attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}],
  targets:run.battle.targets.map(t=>({...t,position:{x:-70,y:-20},health:3,maxHealth:3,healthValue:BigValue.from(3),maxHealthValue:BigValue.from(3)}))}};
 const muzzle=()=>({position:{x:-100,y:-20},height:2});
 run=tickMineBattle(run,.01,{},muzzle);
 assert.equal(run.battle.projectiles.length,1);
 const flight=run.battle.projectiles[0].flight;
 assert.deepEqual(flight.start,{x:-100,y:2,z:-20});assert.deepEqual(flight.end,{x:-70,y:0,z:-20});
 for(let step=1;step<=3;step++){
  run=tickMineBattle(run,.25,{},muzzle);
  assert.deepEqual(run.battle.projectiles[0].flight,flight);
  assert.ok(Math.abs(run.battle.projectiles[0].position.x-(-100+7.5*step))<1e-8);
  assert.equal(run.battle.projectiles[0].position.y,-20);
 }
 run=tickMineBattle(run,.25,{},muzzle);
 assert.equal(run.battle.projectiles.length,0);assert.equal(run.battle.targets[0].health,2);
 const impacts=run.events.filter(e=>e.type==='projectileImpact');assert.equal(impacts.length,1);
 assert.equal(impacts[0].position.x,-70);assert.equal(impacts[0].position.y,-20);
 assert.equal(impacts[0].weaponId,'source-gun-24');
});

test('mine leader lag history stays in world coordinates across internal translations',()=>{
 const guns=[{id:'source-gun-0',sourceType:0,damage:100,intervalSeconds:2,slot:0},
   {id:'source-gun-1',sourceType:0,damage:80,intervalSeconds:2,slot:1}];
 let run=createMineBattle(base(),7,{adapters,generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1},guns,spawn:{x:-100,y:-20}});
 const player=makeActor(0,{x:-100,y:-20}),companion=makeActor(1,{x:-115,y:-17.5});
 player.leaderHistory=[{time:.1,position:{x:-110,y:0,z:-20}},{time:.6,position:{x:-110,y:0,z:-20}}];
 player.movementPhysics={pathClear:true,nearObjectExists:true,obstacleLayerMask:1,nearHitPoint:{x:-105,y:2,z:-19}};
 companion.followState=makeH5FollowState(1);companion.followState.lagSeconds=.3;
 const oldHistory=JSON.parse(JSON.stringify(player.leaderHistory));
 run={...run,elapsed:1,battle:{...run.battle,elapsed:1,autoMove:false,actors:[player,companion]}};
 for(let frame=0;frame<3;frame++){
  run=tickMineBattle(run,.01);
  const [leader,follower]=run.battle.actors;
  assert.deepEqual(leader.leaderHistory.slice(0,2),oldHistory);
  assert.deepEqual(leader.leaderHistory.at(-1).position,{x:-100,y:0,z:-20});
  assert.deepEqual(leader.movementPhysics.nearHitPoint,{x:-105,y:2,z:-19});
  assert.deepEqual(follower.velocity,{x:0,y:0});
  assert.deepEqual(follower.followState.formationOffset,{x:0,y:0,z:2.5});
  assert.ok(follower.followState.fidgetTimer>0);
 }
 assert.deepEqual(player.leaderHistory,oldHistory);
});
