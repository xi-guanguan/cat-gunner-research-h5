import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {SOURCE_HUNT_MONSTER_CONFIG as config,SourceHuntMonsterRuntime,sourceHuntMonsterSpawnPosition,sourceHuntMonsterVelocity,sourceHuntBarrierContact,sourceHuntCapsuleSegmentEntry} from '../hunt-monster-runtime';
import {sourceHuntWaveHealth,sourceHuntLevelHealth,SOURCE_HUNT_MONSTER_COUNTS,SOURCE_HUNT_SPAWN_INTERVALS} from '../r5-hunt';
const f=Math.fround,spawn={aspect:390/844,random:()=>.5};
const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function setup(level=0,wave=0,input=spawn){const r=new SourceHuntMonsterRuntime();r.startLevel(wave,level,input);return r;}
const first=r=>r.current(r.drainEvents().find(e=>e.kind==='spawn').token);
function snapshot(r){return JSON.stringify({phase:r.phase,wave:r.wave,level:r.level,pool:r.nonSpawned,active:r.spawned,counter:r.regularSpawnCounter,pending:r.invasionPending,wait:r.spawnWait,entities:r.entities});}

test('serialized native pool order/240 unique collider pairs is preserved, not sorted',()=>{
 const r=new SourceHuntMonsterRuntime();assert.equal(config.managerParsedBytes,27608);assert.equal(config.serializedPoolOffset,24712);
 assert.equal(r.entities.length,240);assert.equal(new Set(r.nonSpawned).size,240);assert.equal(new Set(r.entities.map(m=>m.colliderID)).size,240);
 assert.deepEqual(r.nonSpawned.slice(0,4),[128004,130039,130035,130107]);assert.notDeepEqual(r.nonSpawned,[...r.nonSpawned].sort((a,b)=>a-b));
 r.startLevel(0,4,spawn);for(let i=1;i<240;i++)r.advanceSpawnFrame(1,spawn);
 assert.deepEqual(r.spawned,config.poolIDs);assert.equal(r.nonSpawned.length,0);
 for(const m of r.entities)assert.equal(r.damage(r.token(m),m.health),true);
 assert.equal(r.killedCount,240);assert.deepEqual(r.nonSpawned,config.poolIDs);assert.equal(r.spawned.length,0);r.advanceSpawnFrame(1,spawn);assert.equal(r.phase,'cleared');
});
for(let level=0;level<5;level++)test(`level${level}: exact count, binary32 waits, immediate first spawn, clear only after real deaths`,()=>{
 const r=setup(level),m=first(r);assert.equal(r.regularSpawnCounter,1);assert.equal(r.spawned[0],config.poolIDs[0]);assert.equal(m.active,true);
 assert.equal(r.spawnWait,f(.04));r.advanceSpawnFrame(.04,spawn);assert.equal(r.regularSpawnCounter,2);assert.equal(r.spawnWait,f(.04));r.advanceSpawnFrame(.04,spawn);assert.equal(r.spawnWait,SOURCE_HUNT_SPAWN_INTERVALS[level]);
 while(r.regularSpawnCounter<r.total)r.advanceSpawnFrame(5,spawn);
 assert.equal(r.total,SOURCE_HUNT_MONSTER_COUNTS[level]);r.advanceSpawnFrame(5,spawn);assert.equal(r.phase,'running');assert.equal(r.spawnWait,f(.1));
 for(const id of [...r.spawned]){const entity=r.entities.find(m=>m.id===id);r.damage(r.token(entity),entity.health);}
 assert.equal(r.progress,1);assert.equal(r.phase,'running');r.advanceSpawnFrame(.1,spawn);assert.equal(r.phase,'cleared');assert.equal(r.drainEvents().filter(e=>e.kind==='level-clear').length,1);
 r.advanceSpawnFrame(1000,spawn);assert.deepEqual(r.drainEvents(),[]);
});
for(let level=0;level<5;level++)test(`level${level}: live HP is waveHealth, NOT sweep 40%-per-level HP; big <= threshold`,()=>{
 const wave=21,threshold=f(level*f(.2));
 for(const [roll,big] of [[threshold,true],[threshold+1e-6,false]]){
  let n=0;const r=setup(level,wave,{aspect:1,random:()=>++n%3===0?roll:.5}),m=first(r),base=sourceHuntWaveHealth(wave);
  assert.equal(m.big,big);assert.ok(m.health.eq(big?base.nativeMultiply(3).significant(2):base));assert.ok(m.maxHealth.eq(m.health));
  if(level>0&&!big)assert.ok(!m.health.eq(sourceHuntLevelHealth(wave,level)));
 }
});
test('large frame resumes exactly once; zero frame pauses; counter advances on empty pool without random',()=>{
 const r=setup();r.advanceSpawnFrame(1000,spawn);assert.equal(r.regularSpawnCounter,2);const before=snapshot(r);r.advanceSpawnFrame(0,spawn);assert.equal(snapshot(r),before);
 r.nonSpawned.length=0;r.advanceSpawnFrame(1000,{aspect:1,random:()=>{throw Error('must not draw');}});assert.equal(r.regularSpawnCounter,3);assert.equal(r.spawned.length,2);assert.deepEqual(r.drainEvents().at(-1),{kind:'pool-empty',replacement:false});
});
test('nonfatal invasion returns append, schedules replacement first, no kill; fatal initialHP1 does NOT return/pending',()=>{
 const r=setup(),m=first(r),old=r.token(m);r.hp=r.hpMax=2;assert.equal(r.invade(old),true);assert.equal(r.hp,1);assert.equal(r.hpDiscDegrees,180);assert.equal(r.killedCount,0);assert.equal(r.invasionPending,1);assert.equal(r.nonSpawned.at(-1),old.id);
 r.advanceSpawnFrame(.04,spawn);assert.equal(r.regularSpawnCounter,1);assert.equal(r.invasionPending,0);assert.equal(r.drainEvents().at(-1).replacement,true);assert.equal(r.damage(old,999),false);
 const fatal=setup(),fm=first(fatal),ft=fatal.token(fm),pool=[...fatal.nonSpawned];fatal.invade(ft);assert.equal(fatal.phase,'failed');assert.equal(fatal.hp,0);assert.equal(fatal.hpDiscDegrees,0);assert.deepEqual(fatal.nonSpawned,pool);assert.deepEqual(fatal.spawned,[fm.id]);assert.equal(fatal.invasionPending,0);assert.equal(fatal.killedCount,0);assert.equal(fatal.current(ft),undefined);
 const before=snapshot(fatal);fatal.integrateH5(50);fatal.advanceSpawnFrame(50,spawn);assert.equal(snapshot(fatal),before);
});
test('reused entity increments generation, late hits rejected, inactive/fatal cannot be consumed twice',()=>{
 const r=setup(),m=first(r),t=r.token(m);r.damage(t,m.health);assert.equal(r.damage(t,100),false);assert.equal(r.killedCount,1);
 // QA reorders available pool solely to exercise immediate reuse; not a production path.
 r.nonSpawned.splice(r.nonSpawned.indexOf(m.id),1);r.nonSpawned.unshift(m.id);r.advanceSpawnFrame(1,spawn);
 const next=r.token(m);assert.equal(next.id,t.id);assert.equal(next.generation,t.generation+1);assert.equal(r.damage(t,100),false);assert.ok(m.health.eq(500));assert.equal(r.damage(next,100),true);assert.ok(m.health.eq(400));
});
test('spawn ellipse/45 degree rotation and velocity chosen once use float32 and small/big divisor',()=>{
 const p=sourceHuntMonsterSpawnPosition(1,0,.5);near(p.x,-100+60*f(.70710677));near(p.z,60*f(.70710677));assert.equal(p.y,0);
 const short=sourceHuntMonsterSpawnPosition(.1,0,.5),clamped=sourceHuntMonsterSpawnPosition(.5,0,.5);assert.deepEqual(short,clamped);
 assert.deepEqual(sourceHuntMonsterSpawnPosition(2,.25,.5),sourceHuntMonsterSpawnPosition(1,.25,.5));
 const pos={x:-60,y:0,z:0};near(sourceHuntMonsterVelocity(pos,false).x,-20/37.5);near(sourceHuntMonsterVelocity(pos,true).x,-20/50);
 assert.deepEqual(sourceHuntMonsterVelocity({x:-100,y:0,z:0},false),{x:0,y:0,z:0});
 const r=setup(),m=first(r),v={...m.moveVelocity};r.integrateH5(1,false);assert.deepEqual(m.moveVelocity,v);assert.deepEqual(m.velocity,v);
});
test('actual damage uses native subtraction/ratio; knockback replacement, clamp0/1 and freeze remain damageable',()=>{
 const r=setup(),m=first(r),t=r.token(m);r.damage(t,100);assert.ok(m.health.eq(400));near(m.knockback.duration,f(f(f(.299999982)*f(.2))+f(.05)));
 const k=m.knockback;r.advanceKnockbackFrame(.01);assert.ok(k.elapsed>0);const oldVelocity={...m.velocity};r.damage(t,50);assert.notEqual(m.knockback,k);assert.equal(m.knockback.elapsed,0);
 r.advanceKnockbackFrame(1);for(const axis of ['x','y','z'])near(m.velocity[axis],m.moveVelocity[axis]);assert.ok(m.knockback);r.advanceKnockbackFrame(.01);assert.equal(m.knockback,null);assert.deepEqual(m.velocity,m.moveVelocity);
 r.knockback(t,-2);assert.equal(m.knockback.duration,f(.05));assert.deepEqual(Object.values(m.knockback.outwardVelocity).map(v=>Math.abs(v)),[0,0,0]);
 r.knockback(t,2);assert.equal(m.knockback.duration,f(f(.299999982)+f(.05)));near(Math.hypot(...Object.values(m.knockback.outwardVelocity)),20);
 r.freeze(t);const frozen={...m.position};r.integrateH5(1,false);assert.deepEqual(m.position,frozen);assert.ok(r.bulletContacts({...m.position,y:5},{...m.position,y:5},.42).length);r.damage(t,1);assert.equal(m.frozen,false);assert.ok(m.health.eq(349));assert.notDeepEqual(oldVelocity,{x:0,y:0,z:0});
 r.damage(t,new BigValue(1n,2000));assert.equal(m.active,false);assert.equal(m.knockback,null);assert.deepEqual(m.velocity,{x:0,y:0,z:0});assert.equal(r.drainEvents().filter(e=>e.kind==='death').at(-1).fxType,5);
});
test('three-dimensional capsule has rounded ends and vertical misses; earliest contact, stationary overlap, reversal',()=>{
 const p={x:0,y:0,z:0},r=config.capsule.radius,lo=config.capsule.centerOffset[1]-config.capsule.halfSegment;
 near(sourceHuntCapsuleSegmentEntry({x:-10,y:5,z:0},{x:10,y:5,z:0},p,.5),(10-r-.5)/20);
 near(sourceHuntCapsuleSegmentEntry({x:0,y:15,z:0},{x:0,y:-5,z:0},p,0),(15-(config.capsule.centerOffset[1]+config.capsule.halfSegment+r))/20);
 assert.equal(sourceHuntCapsuleSegmentEntry({x:-10,y:-1,z:0},{x:10,y:-1,z:0},p,0),null);
 assert.equal(sourceHuntCapsuleSegmentEntry({x:0,y:5,z:0},{x:0,y:5,z:0},p,0),0);assert.equal(sourceHuntCapsuleSegmentEntry({x:4,y:5,z:0},{x:4,y:5,z:0},p,0),null);
 near(sourceHuntCapsuleSegmentEntry({x:-10,y:lo-1,z:0},{x:10,y:lo-1,z:0},p,0),(10-Math.sqrt(r*r-1))/20);
 near(sourceHuntCapsuleSegmentEntry({x:10,y:5,z:0},{x:-10,y:5,z:0},p,0),(10-r)/20);
});
test('barrier sphere-capsule not root point radius15; integration invokes fatal source branch',()=>{
 assert.equal(sourceHuntBarrierContact({x:-84,y:0,z:0}),true);assert.equal(sourceHuntBarrierContact({x:-82,y:0,z:0}),false);assert.equal(sourceHuntBarrierContact({x:-100,y:25,z:0}),false);
 const r=setup(),m=first(r);m.position={x:-84,y:0,z:0};r.integrateH5(.01);assert.equal(r.phase,'failed');assert.equal(r.killedCount,0);assert.equal(r.drainEvents().at(-1).fatal,true);
});
test('contact query sorts along segment, retains equal-time spawned order, excludes inactive/generation and has no wallet consumer',()=>{
 const r=setup();r.advanceSpawnFrame(1,spawn);r.advanceSpawnFrame(1,spawn);r.drainEvents();
 const [a,b,c]=r.spawned.map(id=>r.entities.find(m=>m.id===id));a.position={x:-100,y:0,z:0};b.position={x:-110,y:0,z:0};c.position={...b.position};
 const query=()=>r.bulletContacts({x:-120,y:5,z:0},{x:-90,y:5,z:0},.42);assert.deepEqual(query().map(h=>h.token.id),[b.id,c.id,a.id]);r.damage(r.token(b),b.health);assert.deepEqual(query().map(h=>h.token.id),[c.id,a.id]);
 assert.equal('petCoin' in r,false);assert.equal('wallet' in r,false);
});
test('invalid input rejection is atomic for starting and pending spawn, dispose clears and stops clocks',()=>{
 for(const bad of [{aspect:0,random:()=>.5},{aspect:1,random:()=>NaN},{aspect:1,random:()=>2},{aspect:1,random:()=>{throw Error('RNG failure');}}]){
  const r=new SourceHuntMonsterRuntime(),before=snapshot(r);assert.throws(()=>r.startLevel(0,0,bad));assert.equal(snapshot(r),before);assert.deepEqual(r.drainEvents(),[]);
  const running=setup(),saved=snapshot(running);assert.throws(()=>running.advanceSpawnFrame(1,bad));assert.equal(snapshot(running),saved);
 }
 const r=setup();for(const dt of [-1,NaN,Infinity,1e40]){assert.throws(()=>r.advanceSpawnFrame(dt,spawn),RangeError);assert.throws(()=>r.advanceKnockbackFrame(dt),RangeError);assert.throws(()=>r.integrateH5(dt),RangeError);}
 assert.throws(()=>r.startLevel(0,0,spawn));assert.throws(()=>new SourceHuntMonsterRuntime().startLevel(0,5,spawn),RangeError);assert.throws(()=>sourceHuntCapsuleSegmentEntry({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:0},-1),RangeError);
 const m=r.entities.find(m=>m.active),t=r.token(m),health=m.health;assert.throws(()=>r.damage(t,-1),RangeError);assert.ok(m.health.eq(health));
 r.dispose();assert.equal(r.phase,'stopped');assert.deepEqual(r.nonSpawned,config.poolIDs);assert.deepEqual(r.spawned,[]);assert.deepEqual(r.drainEvents(),[]);assert.equal(r.damage(t,1000),false);r.advanceSpawnFrame(10,spawn);assert.deepEqual(r.spawned,[]);
});
