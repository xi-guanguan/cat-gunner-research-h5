import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {SourceHuntMonsterRuntime,SOURCE_HUNT_MONSTER_CONFIG as config} from '../hunt-monster-runtime';
import {sourceProjectileState,SourceGunType} from '../gun-projectiles';
import {SOURCE_BULLET_COLLIDERS,sourceBulletRadius} from '../source-bullet-colliders';
import {sourceHuntProjectileSegment,sourceHuntMissileEndpoint} from '../hunt-projectile-runtime';
const gunFor=type=>SOURCE_BULLET_COLLIDERS.gunBindings.find(g=>g.gunType===type).gunNum;
const from={x:-130,y:5,z:0},to={x:-90,y:5,z:0};
function fixture(hp=[500,500,500],positions=[-120,-112,-104]){
 const r=new SourceHuntMonsterRuntime(),input={aspect:1,random:()=>.5};r.startLevel(0,0,input);for(let i=1;i<hp.length;i++)r.advanceSpawnFrame(1,input);r.drainEvents();
 const monsters=r.spawned.map((id,i)=>{const m=r.entities.find(m=>m.id===id);m.position={x:positions[i],y:0,z:0};m.health=BigValue.fromInteger(hp[i]);m.maxHealth=m.health;return m;});return {r,monsters};
}
function settings(type,damage=100,radius=10){return {gunNum:gunFor(type),damage,explosionRadius:radius,enemyLayerMask:1<<config.colliderFilter.monsterLayer};}
for(const type of [SourceGunType.Single,SourceGunType.Shotgun])test(`type${type}: original sphere radius, earliest live hit only, real HP/knockback and no reward`,()=>{
 const {r,monsters:m}=fixture(),s=settings(type),p=sourceHuntProjectileSegment(r,sourceProjectileState(type),from,to,s);assert.equal(p.state.dead,true);
 assert.deepEqual(m.map(e=>e.health.toNumber()),[400,500,500]);assert.ok(m[0].knockback);assert.equal(r.killedCount,0);assert.equal(p.events.filter(e=>e.kind==='direct-damage').length,1);
 assert.ok(Math.abs(p.position.x-(-120-config.capsule.radius-sourceBulletRadius(s.gunNum)))<1e-5);assert.equal('petCoin'in r,false);
 const replay=sourceHuntProjectileSegment(r,p.state,from,to,s);assert.deepEqual(replay.events,[]);assert.ok(m[0].health.eq(400));
});
test('Laser hits each actual collider once, remains live; dedup survives entity reuse',()=>{
 const {r,monsters:m}=fixture(),s=settings(1),p=sourceHuntProjectileSegment(r,sourceProjectileState(1),from,to,s);assert.equal(p.state.dead,false);assert.deepEqual(p.state.hitColliderIds,m.map(m=>m.colliderID));assert.deepEqual(m.map(m=>m.health.toNumber()),[400,400,400]);assert.equal(p.events.filter(e=>e.kind==='hit-fx').length,1);
 const q=sourceHuntProjectileSegment(r,p.state,to,from,s);assert.deepEqual(q.events,[]);assert.deepEqual(m.map(m=>m.health.toNumber()),[400,400,400]);
 r.damage(r.token(m[0]),400);r.nonSpawned.splice(r.nonSpawned.indexOf(m[0].id),1);r.nonSpawned.unshift(m[0].id);r.advanceSpawnFrame(1,{aspect:1,random:()=>.5});m[0].position={x:-120,y:0,z:0};
 const reuse=sourceHuntProjectileSegment(r,q.state,from,to,s);assert.deepEqual(reuse.events,[]);assert.ok(m[0].health.eq(500));
});
for(const secondHP of [99,100,101])test(`Pierce liveHP=${secondHP}: strict greater-than before damage, second-hit stop only when damage<=HP`,()=>{
 const {r,monsters:m}=fixture([30,secondHP,300]),p=sourceHuntProjectileSegment(r,sourceProjectileState(2),from,to,settings(2));
 assert.equal(m[0].active,false);assert.equal(m[1].active,secondHP>100);assert.equal(m[2].health.toNumber(),secondHP<100?200:300);assert.equal(p.state.dead,true);assert.equal(p.state.pierceCount,secondHP<100?3:2);
});
for(const type of [SourceGunType.Explosive,SourceGunType.Missile])test(`type${type}: blast damages overlap targets once, including hit target; no doubled directDamage`,()=>{
 const {r,monsters:m}=fixture([200,200,200]),p=sourceHuntProjectileSegment(r,sourceProjectileState(type),from,to,settings(type));
 assert.deepEqual(m.map(m=>m.health.toNumber()),[100,100,200]);assert.equal(p.state.dead,true);assert.equal(p.events.filter(e=>e.kind==='direct-damage').length,0);assert.equal(p.events.filter(e=>e.kind==='explode').length,1);assert.equal(p.events.filter(e=>e.kind==='blast-damage').length,2);assert.deepEqual(p.state.hitColliderIds,[m[0].colliderID,m[1].colliderID]);
 if(type===5){const q=sourceHuntMissileEndpoint(r,p.state,{x:-104,y:5,z:0},settings(type));assert.deepEqual(q.events,[]);assert.ok(m[2].health.eq(200));}
});
test('BlastSniper first explosion kills nearby contacts, later stale contacts skipped and pierce health re-read',()=>{
 const {r,monsters:m}=fixture([30,80,100],[-120,-116,-104]),p=sourceHuntProjectileSegment(r,sourceProjectileState(6),from,to,settings(6,100,5));
 assert.deepEqual(m.map(m=>m.active),[false,false,false]);assert.equal(r.killedCount,3);assert.equal(p.state.firstHitDone,true);assert.equal(p.state.pierceCount,1);assert.equal(p.state.dead,false);assert.equal(p.events.filter(e=>e.kind==='explode').length,1);assert.equal(p.events.filter(e=>e.kind==='direct-damage').length,1);assert.equal(p.events.filter(e=>e.kind==='hit-fx').length,1);
});
test('BlastSniper equal HP first hit stops after explosion; no direct damage and no Raid first-hit override',()=>{
 const {r,monsters:m}=fixture([100]),p=sourceHuntProjectileSegment(r,sourceProjectileState(6),from,to,settings(6,100,1));assert.equal(p.state.dead,true);assert.equal(r.killedCount,1);assert.equal(m[0].health.toNumber(),0);assert.equal(p.events.filter(e=>e.kind==='direct-damage').length,0);
});
test('missile endpoint uses 3D capsule sphere overlap, layer mask, radius0, generation and repeated-callback guards',()=>{
 const {r,monsters:m}=fixture([200,200,200]),s=settings(5,100,1),point={x:-120,y:5,z:0};
 const miss=sourceHuntMissileEndpoint(r,sourceProjectileState(5),{...point,y:20},s);assert.equal(miss.state.dead,true);assert.equal(miss.events.filter(e=>e.kind==='blast-damage').length,0);
 const masked=sourceHuntMissileEndpoint(r,sourceProjectileState(5),point,{...s,enemyLayerMask:1<<8});assert.equal(masked.events.filter(e=>e.kind==='blast-damage').length,0);
 const zero=sourceHuntMissileEndpoint(r,sourceProjectileState(5),point,{...s,explosionRadius:0});assert.equal(zero.events.filter(e=>e.kind==='blast-damage').length,0);
 r.freeze(r.token(m[0]));const p=sourceHuntMissileEndpoint(r,sourceProjectileState(5),point,s);assert.ok(m[0].health.eq(100));assert.equal(m[0].frozen,false);assert.equal(p.events.filter(e=>e.kind==='blast-damage').length,1);assert.deepEqual(p.state.hitColliderIds,[m[0].colliderID]);
 assert.deepEqual(sourceHuntMissileEndpoint(r,p.state,point,s).events,[]);assert.ok(m[0].health.eq(100));
});
test('stationary trigger/vertical near misses/sweeps in reverse do not become damage-over-time',()=>{
 const {r,monsters:m}=fixture([500]),s=settings(1);
 assert.deepEqual(sourceHuntProjectileSegment(r,sourceProjectileState(1),{...from,y:30},{...to,y:30},s).events,[]);
 const point={x:-120,y:5,z:0},p=sourceHuntProjectileSegment(r,sourceProjectileState(1),point,point,s);assert.ok(m[0].health.eq(400));assert.equal(p.events.filter(e=>e.kind==='direct-damage').length,1);
 for(let i=0;i<20;i++)assert.deepEqual(sourceHuntProjectileSegment(r,p.state,point,point,s).events,[]);assert.ok(m[0].health.eq(400));
});
test('all 65 gun/type bindings, huge native BigValue damage, failed/stopped guards and invalid inputs are atomic',()=>{
 assert.equal(config.colliderFilter.collisionsEnabled,true);assert.equal(config.colliderFilter.bulletLayer,8);assert.equal(config.colliderFilter.monsterLayer,9);
 for(const gun of SOURCE_BULLET_COLLIDERS.gunBindings){const {r}=fixture([500]),s={...settings(gun.gunType),gunNum:gun.gunNum,damage:new BigValue(1n,1000)},p=sourceHuntProjectileSegment(r,sourceProjectileState(gun.gunType),from,to,s);assert.equal(r.killedCount,1);assert.ok(p.events.some(e=>e.kind.includes('damage')));}
 const {r,monsters:m}=fixture(),original=sourceProjectileState(0),s=settings(0);for(const bad of [{damage:-1},{gunNum:999},{gunNum:gunFor(1)},{explosionRadius:NaN},{explosionRadius:-1},{enemyLayerMask:NaN}]){assert.throws(()=>sourceHuntProjectileSegment(r,original,from,to,{...s,...bad}),RangeError);assert.deepEqual(m.map(m=>m.health.toNumber()),[500,500,500]);assert.deepEqual(original.hitColliderIds,[]);}
 assert.throws(()=>sourceHuntProjectileSegment(r,original,{...from,x:Infinity},to,s),RangeError);assert.throws(()=>sourceHuntMissileEndpoint(r,original,to,s),RangeError);
 r.invade(r.token(m[0]));assert.equal(r.phase,'failed');const stopped=sourceHuntProjectileSegment(r,original,from,to,s);assert.deepEqual(stopped.events,[]);assert.deepEqual(m.slice(1).map(m=>m.health.toNumber()),[500,500]);
});
