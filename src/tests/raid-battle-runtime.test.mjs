import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {SourceRaidBattleRuntime} from '../raid-battle-runtime';
import {SourceRaidBossRuntime,SOURCE_RAID_WORLD,sourceRaidSphereSegmentEntry} from '../raid-boss-runtime';
import {freshSourceRaid} from '../r6-raid';
import {sourceProjectileState} from '../gun-projectiles';
import {sourceEnemyProjectileSegment,sourceEnemyMissileEndpoint} from '../hunt-projectile-runtime';
import guns from '../data/guns.json';

const typeID=type=>guns.guns.findIndex(g=>g.type===type);
const center={x:-120,y:4.550000190734863,z:20};
const a={...center,x:-145},b={...center,x:-95};
const emission=(type,damage=1)=>({gunNum:typeID(type),generation:{type,pelletCount:5,spreadDegrees:10,explosionRadius:5,missileExplosionRadius:7,blastSniperExplosionRadius:9,penetratingBulletLifetime:2},damage,start:a,nearHitPoint:center,targetTransform:{x:-120,y:0,z:20},camForward:{x:0,y:-1,z:1},spreadDegrees:0,missileSpeed:70,random:()=>.5});
const settings=(type,damage=1)=>({gunNum:typeID(type),damage,explosionRadius:3,enemyLayerMask:128});
test('original Raid independent world collider, Enemy identity, source type5 and transform chain',()=>{
 assert.equal(SOURCE_RAID_WORLD.enemyID,128082);assert.equal(SOURCE_RAID_WORLD.colliderID,66820);assert.equal(SOURCE_RAID_WORLD.enemyType,5);assert.equal(SOURCE_RAID_WORLD.layer,7);assert.equal(SOURCE_RAID_WORLD.sphere.radius,12);assert.equal(SOURCE_RAID_WORLD.sphere.isTrigger,false);assert.deepEqual(SOURCE_RAID_WORLD.sphere.center,[-120,4.550000190734863,20]);
});
test('Raid exact swept sphere: tangency/inside/vertical miss/zero-length; rejects invalid queries',()=>{
 assert.equal(sourceRaidSphereSegmentEntry(a,b,0),.26);assert.equal(sourceRaidSphereSegmentEntry(center,center,0),0);
 assert.equal(sourceRaidSphereSegmentEntry({...a,z:center.z+12},{...b,z:center.z+12},0),.5);
 assert.equal(sourceRaidSphereSegmentEntry({...a,y:center.y+13},{...b,y:center.y+13},0),null);
 assert.equal(sourceRaidSphereSegmentEntry(a,a,0),null);
 for(const n of [-1,NaN,Infinity])assert.throws(()=>sourceRaidSphereSegmentEntry(a,b,n));
});
test('Enemy type5 no Hunt knockback; native subtraction, stale generation and same collider across Reload',()=>{
 let deaths=0;const boss=new SourceRaidBossRuntime(()=>{deaths++;boss.spawn(30);});boss.spawn(10);const old=boss.token();
 assert.equal(boss.damage(old,3),true);assert.equal(boss.enemy.health.toNumber(),7);assert.equal('knockback'in boss.enemy,false);
 assert.equal(boss.damage(old,7),true);assert.equal(deaths,1);assert.equal(boss.enemy.health.toNumber(),30);assert.equal(boss.damage(old,100),false);assert.equal(boss.enemy.health.toNumber(),30);
 const c=boss.bulletContacts(a,b,0)[0];assert.equal(c.colliderID,66820);assert.equal(c.token.generation,2);
 assert.equal(boss.explosionContacts(center,1,0).length,0);assert.equal(boss.explosionContacts(center,1,128).length,1);assert.equal(boss.explosionContacts(center,0,128).length,0);
 boss.dispose();assert.equal(boss.damage(boss.token(),1),false);assert.equal(boss.bulletContacts(a,b,0).length,0);
});
for(const type of [0,1,2,3,4,5,6])test(`real Raid per-projectile branch${type}, no Hunt mode leakage`,()=>{
 const boss=new SourceRaidBossRuntime(()=>{});boss.spawn(100);const r=sourceEnemyProjectileSegment(boss,sourceProjectileState(type),a,b,settings(type,3));
 assert.equal(boss.enemy.health.toNumber(),97);assert.equal(r.events.filter(e=>['direct-damage','blast-damage'].includes(e.kind)).length,1);
 // Laser/pierce MUST terminate in UI5 even on the very first small hit.
 if(type===1||type===2)assert.equal(r.state.dead,true);
 assert.equal(sourceEnemyProjectileSegment(boss,r.state,a,b,settings(type,3)).events.length,0);
});
test('missile endpoint and collision cannot double explode same collider',()=>{
 const boss=new SourceRaidBossRuntime(()=>{});boss.spawn(100);const hit=sourceEnemyProjectileSegment(boss,sourceProjectileState(5),a,b,settings(5,10));assert.equal(boss.enemy.health.toNumber(),90);
 const again=sourceEnemyMissileEndpoint(boss,hit.state,center,settings(5,10));assert.equal(again.events.length,0);assert.equal(boss.enemy.health.toNumber(),90);
});
test('prepared stage does not advance/emit/debit; start once increments try and starts H0 only',()=>{
 const r=new SourceRaidBattleRuntime('run1',2,false),s=freshSourceRaid();assert.deepEqual(r.advanceFrame(1),[]);assert.equal(r.emit(emission(0)).length,0);assert.equal(r.boss.phase,'idle');assert.equal(r.remainingSeconds,60);
 const next=r.start(s);assert.equal(next.tryCount,1);assert.equal(s.tryCount,0);assert.equal(r.start(next),next);assert.equal(r.boss.enemy.health.toNumber(),1e7);assert.deepEqual(r.drainEvents(),[{kind:'start'}]);
});
test('no estimated DPS: time alone never removes HP/bars; native timer ends on next resume',()=>{
 const r=new SourceRaidBattleRuntime('clock',2,false);r.start(freshSourceRaid());r.advanceFrame(60);assert.equal(r.phase,'running');assert.equal(r.score,0);assert.equal(r.boss.enemy.health.toNumber(),1e7);assert.equal(r.result,null);
 r.advanceFrame(0);assert.equal(r.phase,'ended');assert.equal(r.result.score,0);assert.equal(r.result.starGem,0);const result=r.result;r.advanceFrame(10);assert.equal(r.result,result);assert.equal(r.drainEvents().filter(e=>e.kind==='end').length,1);
});
test('independent live flight hits actual Raid sphere, clears a bar, Reload x3; timer never extends',()=>{
 const r=new SourceRaidBattleRuntime('flight',2,true);r.start(freshSourceRaid());const initial=r.remainingSeconds;
 r.emit(emission(0,1e7));assert.equal(r.score,0);const hits=r.advanceFrame(.2);assert.equal(r.score,1);assert.equal(r.boss.enemy.health.toNumber(),3e7);assert.ok(hits.some(h=>h.event.kind==='direct-damage'));assert.equal(r.remainingSeconds,Math.fround(initial-Math.fround(.2)));assert.equal(r.maximumSeconds,70);
 assert.equal(r.projectiles.activeCount,0);assert.equal(r.drainEvents().filter(e=>e.kind==='bar-cleared').length,1);
});
test('multiple real contacts -> score32, decreasing source reward tiers, terminal freeze/cleanup',()=>{
 const r=new SourceRaidBattleRuntime('bars32',6,false);r.start(freshSourceRaid());
 for(let i=0;i<32;i++){r.emit(emission(1,new BigValue(1n,100)));r.advanceFrame(.2);}assert.equal(r.score,32);
 r.advanceFrame(60);assert.equal(r.result,null);r.advanceFrame(0);assert.equal(r.result.starGem,560);assert.equal(r.result.weakType,6);assert.ok(Object.isFrozen(r.result));assert.equal(r.projectiles.activeCount,0);
 const score=r.score;r.boss.damage(r.boss.token(),1e100);assert.equal(r.score,score);assert.equal(r.emit(emission(0)).length,0);
});
test('exit unfinished clears projectiles without rewarding/refunding; repeat exit idempotent',()=>{
 const r=new SourceRaidBattleRuntime('cancel',2,false);r.start(freshSourceRaid());r.emit(emission(5));r.exit();r.exit();assert.equal(r.projectiles.activeCount,0);assert.equal(r.result,null);assert.equal(r.drainEvents().filter(e=>e.kind==='exit').length,1);assert.deepEqual(r.advanceFrame(100),[]);
});
test('invalid clocks/run settings fail before mutation',()=>{
 for(const [id,weak,plus]of [['',2,false],['x',7,false],['x',2,1]])assert.throws(()=>new SourceRaidBattleRuntime(id,weak,plus));
 const r=new SourceRaidBattleRuntime('x',2,false);r.start(freshSourceRaid());for(const dt of [-1,NaN,Infinity])assert.throws(()=>r.advanceFrame(dt));assert.equal(r.remainingSeconds,60);assert.equal(r.boss.enemy.health.toNumber(),1e7);
});
