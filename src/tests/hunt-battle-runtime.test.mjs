import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {SourceHuntBattleRuntime,SOURCE_HUNT_HOST_WAITS} from '../hunt-battle-runtime';
import {freshSourceHuntState,sourceHuntWaveHealth} from '../r5-hunt';
import {SOURCE_BULLET_COLLIDERS} from '../source-bullet-colliders';
import {sourceHuntMonsterRaycast} from '../hunt-cat-runtime';
import {sourceHuntGunSockets} from '../hunt-gun-sockets';
import {sourceCatScreenSpeedMultiplierH5,sourceCatCorrectDirectionH5} from '../source-cat-quaternion';
const f=Math.fround,center={x:-100,y:0,z:0},modifiers={rebirthDamagePercent:100,skinDamagePercent:100,fishDamagePercent:0,relicDamagePercent:100,damageBuffMultiplier:1,
 fishCriticalValuePercent:0,relicCriticalDamagePercent:100,fishCriticalChancePercent:0,skinSpeedPercent:100,rebirthSpeedPercent:100,speedBuffMultiplier:1};
const entitlements={plusPack1Active:false,plusPack2Active:false,automaticBonus:false},movementStats={slot5d5d4d0Static20:100,slot5d5d4d8Static60:0};
const frame={joystick:{x:0,y:0},resourcesReady:true,simulate:true,acceptInput:true};
const gun=(type=0,extra={})=>({gunNum:SOURCE_BULLET_COLLIDERS.gunBindings.find(g=>g.gunType===type).gunNum,
 generation:{type,pelletCount:5,spreadDegrees:10,explosionRadius:5,missileExplosionRadius:7,blastSniperExplosionRadius:9,penetratingBulletLifetime:2},baseDamage:100,baseIntervalSeconds:.1,missileSpeed:20,starLevel:0,...extra});
const cat=(extra={})=>({componentID:147400,slotNum:0,active:true,position:center,gun:gun(),...extra});
function fixture(inputs=[cat()],e=entitlements){
 const h=new SourceHuntBattleRuntime('fixture-run',freshSourceHuntState(),inputs,e,modifiers,movementStats);
 const trace=[];let rng=.5;
 const a={aspect:1,random:()=>{trace.push('float');return rng;},rangeInt:(min,max)=>{trace.push('int');return max-1;},
  // MODEL ONLY, explicit viewport fixture. Real page uses its camera projection.
  project:p=>({x:.5+p.x/1000,y:.5+p.z/1000,z:100}),raycast:(...args)=>sourceHuntMonsterRaycast(h.monsters,...args),
  movement:{screenSpeedMultiplier:sourceCatScreenSpeedMultiplierH5,correctDirection:sourceCatCorrectDirectionH5,pathClear:()=>true},
  rayOrigin:c=>({...c.movement.position,y:2}),beforeAttack:()=>trace.push('pose'),
  transformWorld:(c,id)=>{trace.push(['socket',id]);return {...c.movement.position,y:2};},camForward:{x:-.5,y:-.6,z:.5}};
 return {h,a,trace,setRng:n=>rng=n};
}
function start(x){assert.equal(x.h.enter().status,'supported');x.h.drainEvents();x.h.advanceFrame(2,frame,x.a);assert.equal(x.h.phase,'playing');x.h.drainEvents();}
function target(x,z=20,health=500){const m=[...x.h.monsters.activeMonsters()][0];m.position={x:-100,y:0,z};m.moveVelocity={x:0,y:0,z:0};m.velocity={x:0,y:0,z:0};m.health=BigValue.fromInteger(health);m.maxHealth=m.health;return m;}
test('source enter waits for resources and2s; no firing, spawning or paying behind loading',()=>{
 const x=fixture();x.h.enter();const state=x.h.state;x.h.drainEvents();x.h.advanceFrame(100,{...frame,resourcesReady:false},x.a);
 assert.equal(x.h.phase,'enter-loading');assert.equal(x.h.waitSeconds,2);assert.equal([...x.h.monsters.activeMonsters()].length,0);assert.equal(x.h.elapsedSeconds,0);assert.deepEqual(x.h.state,state);assert.deepEqual(x.h.drainEvents(),[]);
 x.h.advanceFrame(1.5,frame,x.a);assert.equal(x.h.phase,'enter-loading');x.h.advanceFrame(.5,frame,x.a);assert.equal(x.h.phase,'playing');assert.equal(x.h.projectiles.activeCount,0);assert.equal(x.h.elapsedSeconds,0);
 assert.equal(x.h.enter().status,'blocked');assert.equal(x.h.petCoinGranted,0);
});
test('real attack, projectile flight and capsule contact change HP only when a bullet reaches it',()=>{
 const x=fixture();start(x);const m=target(x);x.h.advanceFrame(.1,frame,x.a);
 const events=x.h.drainEvents();assert.equal(events.filter(e=>e.kind==='attack').length,1);assert.equal(m.health.toNumber(),500);assert.equal(x.h.projectiles.activeCount,1);
 x.h.advanceFrame(.2,frame,x.a);assert.ok(m.health.lt(500));const hits=x.h.drainEvents().filter(e=>e.kind==='projectile'&&e.event.event.kind==='direct-damage');assert.ok(hits.length>0);assert.equal(x.h.petCoinGranted,0);assert.equal(x.h.monsters.killedCount,0);
});
test('source socket BEFORE critical RNG, once per whole shotgun volley, one damage for all pellets',()=>{
 const sg=gun(3,{gunNum:10});sg.generation={...sg.generation,type:SOURCE_BULLET_COLLIDERS.gunBindings[10].gunType};
 // Native10 uses random socket but its actual GunType, never pretend gun/type.
 const x=fixture([cat({gun:sg})]);start(x);target(x);x.trace.length=0;x.h.monsters.spawnWait=100;
 x.h.advanceFrame(.1,frame,x.a);const attack=x.h.drainEvents().find(e=>e.kind==='attack');assert.ok(attack);
 assert.deepEqual(x.trace.slice(0,4),['pose','int',['socket',sourceHuntGunSockets(147400,10).shootRandom.at(-1)],'float']);
 assert.equal(x.trace.filter(v=>v==='int').length,1);
 const damage=x.h.projectiles.slots.filter(p=>p.active).map(p=>p.settings.damage.toString());assert.ok(damage.every(d=>d===attack.damage.toString()));
});
test('all7 weapon types emit original policies, never assign damage from team power',()=>{
 for(let type=0;type<=6;type++){const x=fixture([cat({gun:gun(type)})]);start(x);const m=target(x);x.h.advanceFrame(.1,frame,x.a);assert.ok(x.h.drainEvents().some(e=>e.kind==='attack'));assert.equal(m.health.toNumber(),500);assert.equal('teamPower'in x.h,false);}
});
test('failed allocation restores cooldown minus failed frame delta; short next frame cannot invent a retry',()=>{
 const x=fixture();start(x);target(x);x.a.canAllocate=()=>false;x.h.advanceFrame(.1,frame,x.a);assert.equal(x.h.projectiles.activeCount,0);assert.equal(x.h.petCoinGranted,0);assert.equal(x.h.drainEvents().filter(e=>e.kind==='attack').length,0);
 x.a.canAllocate=()=>true;x.h.advanceFrame(.02,frame,x.a);assert.equal(x.h.drainEvents().filter(e=>e.kind==='attack').length,0);
 x.h.advanceFrame(.09,frame,x.a);assert.equal(x.h.drainEvents().filter(e=>e.kind==='attack').length,1);
});
test('pause freezes loading, projectiles, actors, spawn clock, rewards; input disabled does not freeze combat',()=>{
 const x=fixture();start(x);target(x);x.h.advanceFrame(.1,frame,x.a);x.h.drainEvents();const before={p:x.h.projectiles.slots[0].elapsedSeconds,t:x.h.elapsedSeconds,spawn:x.h.monsters.spawnWait,c:x.h.cats[0].movement};
 x.h.advanceFrame(999,{...frame,simulate:false,joystick:{x:1,y:1}},x.a);assert.equal(x.h.projectiles.slots[0].elapsedSeconds,before.p);assert.equal(x.h.elapsedSeconds,before.t);assert.equal(x.h.monsters.spawnWait,before.spawn);assert.equal(x.h.cats[0].movement,before.c);assert.deepEqual(x.h.drainEvents(),[]);
 x.h.advanceFrame(.1,{...frame,acceptInput:false,joystick:{x:1,y:0}},x.a);assert.deepEqual(x.h.cats[0].movement.position,center);assert.ok(x.h.elapsedSeconds>before.t);
 x.h.advanceFrame(.1,{...frame,joystick:{x:1,y:0}},x.a);assert.notEqual(x.h.cats[0].movement.position.x,center.x);
});
test('stale generation ray target cannot hit a reused monster or emit another attack',()=>{
 const x=fixture();start(x);const m=target(x);x.h.advanceFrame(.1,frame,x.a);x.h.drainEvents();const hit=x.h.cats[0].target.nearObj;x.h.monsters.kill(hit.token);x.h.projectiles.dispose();
 x.h.monsters.spawnWait=100;x.h.advanceFrame(.01,frame,x.a);assert.equal(x.h.cats[0].target.nearObj,null);assert.equal(x.h.drainEvents().filter(e=>e.kind==='attack').length,0);assert.equal(x.h.petCoinGranted,0);
});
test('AI refreshes ray in HandleAIMonster before moving; original Cat_list ordering restored',()=>{
 const x=fixture([cat({componentID:136808,slotNum:2,position:center}),cat(),cat({componentID:136809,slotNum:1,position:center})]);start(x);target(x);
 assert.deepEqual(x.h.cats.map(c=>c.componentID),[147400,136809,136808]);x.h.advanceFrame(.1,frame,x.a);
 for(const ai of x.h.cats.filter(c=>c.isAI)){assert.ok(ai.target.nearObj);assert.equal(ai.movement.running,true);assert.ok(ai.movement.position.z>0);}
});
test('one invasion fails HP1 without counting kill, awarding coin, or replacing fatal monster',()=>{
 const x=fixture();start(x);const m=target(x,0);x.h.advanceFrame(.01,frame,x.a);
 assert.equal(x.h.phase,'ended');assert.equal(x.h.state.run.hp,0);assert.equal(x.h.monsters.killedCount,0);assert.equal(x.h.monsters.invasionPending,0);assert.equal(x.h.petCoinGranted,0);assert.equal(m.active,false);
 const payments=x.h.drainEvents().filter(e=>e.kind==='settlement');assert.equal(payments.length,1);assert.equal(payments[0].result.resultCode,1);assert.equal(x.h.giveUp().status,'blocked');
 x.h.advanceFrame(1000,frame,x.a);assert.deepEqual(x.h.drainEvents(),[]);
});
test('clear is90 actual projectile kills, pays once, waits2s then starts next level with no catch-up',()=>{
 const x=fixture([cat({gun:gun(0,{baseDamage:1000,baseIntervalSeconds:.1})})]);start(x);
 let clear=null,damageCount=0;
 for(let i=0;i<2000&&!clear;i++){
  // Deliberate MODEL fixture: every spawned enemy enters ray at z20. Never call kill/clear directly.
  for(const m of x.h.monsters.activeMonsters()){if(!m.knockback){m.position={x:-100,y:0,z:20};m.velocity={x:0,y:0,z:0};m.moveVelocity=m.velocity;}}
  x.h.advanceFrame(.1,frame,x.a);for(const e of x.h.drainEvents()){if(e.kind==='projectile'&&e.event.event.kind==='direct-damage')damageCount++;if(e.kind==='settlement'&&e.action==='level-clear')clear=e;}
 }
 assert.ok(clear);assert.ok(damageCount>=90);assert.equal(x.h.monsters.killedCount,90);assert.equal(x.h.state.level,1);assert.equal(x.h.petCoinGranted,30);assert.equal(x.h.state.run.clearedLevels,1);assert.equal(x.h.phase,'next-level-wait');
 x.h.advanceFrame(1.9,frame,x.a);assert.equal(x.h.phase,'next-level-wait');assert.equal(x.h.petCoinGranted,30);assert.equal(x.h.drainEvents().filter(e=>e.kind==='settlement').length,0);
 x.h.advanceFrame(100,frame,x.a);assert.equal(x.h.phase,'playing');assert.equal(x.h.monsters.level,1);assert.equal(x.h.monsters.killedCount,0);assert.equal(x.h.petCoinGranted,30);
});
test('giveup then bonus/exit are single settlements, source1.5+.2 masks, field restore emitted once',()=>{
 const x=fixture();start(x);x.h.giveUp();assert.equal(x.h.phase,'ended');assert.equal(x.h.bonus(false).status,'blocked');assert.equal(x.h.state.run.bonusClaimed,false);
 assert.equal(x.h.bonus(true).status,'supported');assert.equal(x.h.bonus(true).status,'blocked');assert.equal(x.h.exit().status,'blocked');assert.equal(x.h.state.run,null);
 assert.equal(x.h.phase,'exit-field-wait');x.h.advanceFrame(1.5,frame,x.a);assert.equal(x.h.phase,'exit-mask-wait');assert.equal(x.h.waitSeconds,f(.2));x.h.advanceFrame(.2,frame,x.a);assert.equal(x.h.phase,'disposed');
 const events=x.h.drainEvents();assert.equal(events.filter(e=>e.kind==='restore-field').length,1);const settlements=events.filter(e=>e.kind==='settlement');assert.deepEqual(settlements.map(e=>e.action),['give-up','bonus']);assert.equal(new Set(settlements.map(e=>e.requestID)).size,settlements.length);
 x.h.advanceFrame(100,frame,x.a);assert.deepEqual(x.h.drainEvents(),[]);
});
test('exit during2s next-level transition cancels future spawns; caller state is copied not mutated',()=>{
 const initial=freshSourceHuntState(),x=new SourceHuntBattleRuntime('copy',initial,[cat()],entitlements,modifiers,movementStats);x.enter();assert.deepEqual(initial,freshSourceHuntState());const exported=x.state;exported.run.hp=99;assert.equal(x.state.run.hp,1);
 assert.equal(x.exit().status,'supported');assert.equal(x.phase,'exit-field-wait');const fake=fixture().a;x.advanceFrame(5,frame,fake);x.advanceFrame(5,frame,fake);assert.equal(x.phase,'disposed');assert.equal(x.monsters.spawned.length,0);
});
test('constructor refuses missing leader, unknown source cat, duplicate cat and GunType mismatch',()=>{
 for(const cats of [[],[cat({componentID:7})],[cat(),cat()],[cat({gun:gun(0,{generation:{...gun().generation,type:3}})})],[cat({slotNum:-1})]])assert.throws(()=>fixture(cats));
 const x=fixture();assert.throws(()=>x.h.advanceFrame(-1,frame,x.a),RangeError);assert.throws(()=>x.h.advanceFrame(NaN,frame,x.a),RangeError);
});
