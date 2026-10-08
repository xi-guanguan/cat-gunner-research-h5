import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value';
import {SourceHuntMonsterRuntime} from '../hunt-monster-runtime';
import {SourceHuntProjectileFlightRuntime,sourceHuntEmitGun} from '../hunt-projectile-flight';
import {SOURCE_BULLET_COLLIDERS} from '../source-bullet-colliders';
import {SourceGunType,sourceGunGenerationPolicy,sourceMissileFlight} from '../gun-projectiles';
const gunFor=type=>SOURCE_BULLET_COLLIDERS.gunBindings.find(g=>g.gunType===type).gunNum;
const settings=(type,damage=100,radius=5)=>({gunNum:gunFor(type),damage,explosionRadius:radius,enemyLayerMask:640});
const start={x:-100,y:5,z:0},direction={x:0,y:0,z:1};
function fixture(positions=[{x:-100,y:0,z:20}],health=500){const r=new SourceHuntMonsterRuntime(),input={aspect:1,random:()=>.5};r.startLevel(0,0,input);for(let i=1;i<positions.length;i++)r.advanceSpawnFrame(1,input);const monsters=[...r.activeMonsters()];for(let i=0;i<positions.length;i++){monsters[i].position=positions[i];monsters[i].health=BigValue.fromInteger(health);monsters[i].maxHealth=monsters[i].health;}r.drainEvents();return {r,monsters};}
const generation=type=>({type,pelletCount:5,spreadDegrees:10,explosionRadius:5,missileExplosionRadius:7,blastSniperExplosionRadius:9,penetratingBulletLifetime:2});
const emission=type=>({gunNum:gunFor(type),generation:generation(type),damage:100,start,nearHitPoint:{x:-100,y:5,z:20},targetTransform:{x:-100,y:0,z:25},camForward:direction,spreadDegrees:0,missileSpeed:10,random:()=>.5});
test('moving linear bullet actually hits only on contact; no dt-derived HP or rewards',()=>{
 const {r,monsters}=fixture(),pool=new SourceHuntProjectileFlightRuntime(),token=pool.emitLinear(0,start,direction,70,.7,settings(0));
 assert.equal(pool.activeCount,1);let events=pool.advanceFrame(.1,r);assert.equal(events.length,0);assert.equal(monsters[0].health.toNumber(),500);assert.equal(pool.current(token).position.z,7);
 events=pool.advanceFrame(.2,r);assert.equal(events.filter(e=>e.event.kind==='direct-damage').length,1);assert.equal(monsters[0].health.toNumber(),400);assert.equal(pool.activeCount,0);assert.equal(pool.current(token),null);
 pool.advanceFrame(50,r);assert.equal(monsters[0].health.toNumber(),400);assert.equal('petCoin'in pool,false);
});
test('lifetime clips long-frame travel, no hitting collider beyond destruction',()=>{
 const {r,monsters}=fixture([{x:-100,y:0,z:20}]),pool=new SourceHuntProjectileFlightRuntime();const t=pool.emitLinear(0,start,direction,10,.7,settings(0));
 const events=pool.advanceFrame(100,r);assert.deepEqual(events.map(e=>e.event.kind),['expired']);assert.equal(monsters[0].health.toNumber(),500);assert.equal(pool.slots[t.slot].position.z,7);assert.equal(pool.activeCount,0);
});
test('zero lifetime and frozen simulation cannot generate offline damage',()=>{
 const {r,monsters}=fixture(),pool=new SourceHuntProjectileFlightRuntime();const t=pool.emitLinear(0,start,direction,70,0,settings(0));assert.deepEqual(pool.advanceFrame(0,r),[]);assert.ok(pool.current(t));
 const events=pool.advanceFrame(.1,r);assert.equal(events[0].event.kind,'expired');assert.equal(monsters[0].health.toNumber(),500);
 const q=pool.emitLinear(0,start,direction,70,.7,settings(0));r.dispose();assert.deepEqual(pool.advanceFrame(99,r),[]);assert.equal(pool.current(q).elapsedSeconds,0);pool.dispose();assert.equal(pool.current(q),null);
});
test('missile flies arc, chosen endpoint explosion and duplicate frame guards',()=>{
 const end={x:-100,y:5,z:20},{r,monsters}=fixture(),pool=new SourceHuntProjectileFlightRuntime(),t=pool.emitMissile(start,end,20,settings(5));
 assert.deepEqual(pool.advanceFrame(.5,r),[]);const p=pool.current(t);assert.equal(p.position.z,10);assert.ok(Math.abs(p.position.y-13)<1e-5);assert.equal(monsters[0].health.toNumber(),500);
 const events=pool.advanceFrame(.5,r);assert.equal(events.filter(e=>e.event.kind==='explode').length,1);assert.equal(events.filter(e=>e.event.kind==='blast-damage').length,1);assert.equal(monsters[0].health.toNumber(),400);assert.equal(pool.current(t),null);assert.deepEqual(pool.advanceFrame(1,r),[]);assert.equal(monsters[0].health.toNumber(),400);
});
test('missile endpoint explodes even with no trigger; current target transform and cached-point fallback differ',()=>{
 const {r}=fixture([{x:-100,y:0,z:35}]),pool=new SourceHuntProjectileFlightRuntime(),end={x:-100,y:30,z:20};pool.emitMissile(start,end,20,settings(5));
 const events=pool.advanceFrame(1,r);assert.equal(events.filter(e=>e.event.kind==='explode').length,1);assert.equal(events.filter(e=>e.event.kind.includes('damage')).length,0);
 const first=sourceHuntEmitGun(pool,emission(5))[0];assert.equal(pool.current(first).end.z,25);const second=sourceHuntEmitGun(pool,{...emission(5),targetTransform:null})[0];assert.equal(pool.current(second).end.z,20);assert.equal(pool.current(second).end.y,5);
});
test('missile collision before endpoint consumes explosion once, not again at timer expiry',()=>{
 const {r,monsters}=fixture([{x:-100,y:0,z:20}]),pool=new SourceHuntProjectileFlightRuntime(),t=pool.emitMissile(start,{x:-100,y:5,z:40},40,settings(5));
 const events=pool.advanceFrame(1,r);assert.equal(events.filter(e=>e.event.kind==='explode').length,1);assert.equal(monsters[0].health.toNumber(),400);assert.equal(pool.current(t),null);assert.deepEqual(pool.advanceFrame(50,r),[]);
});
test('generation-checked reused slots cannot be cancelled by stale async tokens, no phantom 27 limit',()=>{
 const pool=new SourceHuntProjectileFlightRuntime(),old=pool.emitLinear(0,start,direction,70,.7,settings(0));assert.equal(pool.cancel(old),true);assert.equal(pool.cancel(old),false);
 const next=pool.emitLinear(0,start,direction,70,.7,settings(0));assert.equal(next.slot,old.slot);assert.equal(next.generation,old.generation+1);assert.equal(pool.current(old),null);assert.equal(pool.cancel(old),false);assert.ok(pool.current(next));
 for(let i=1;i<100;i++)pool.emitLinear(0,start,direction,70,.7,settings(0));assert.equal(pool.activeCount,100);assert.equal(pool.slots.length,100);pool.dispose();assert.equal(pool.activeCount,0);
 for(let i=0;i<100;i++)pool.emitLinear(0,start,direction,70,.7,settings(0));assert.equal(pool.slots.length,100);
});
test('all 65 source bindings consume correct type, mask640 and generation-specific lifetime/radius',()=>{
 for(const binding of SOURCE_BULLET_COLLIDERS.gunBindings){const pool=new SourceHuntProjectileFlightRuntime(),base=emission(binding.gunType),tokens=sourceHuntEmitGun(pool,{...base,gunNum:binding.gunNum});const policy=sourceGunGenerationPolicy(base.generation);
  assert.equal(tokens.length,binding.gunType===3?5:1);for(const t of tokens){const p=pool.current(t);assert.equal(p.state.type,binding.gunType);assert.equal(p.settings.enemyLayerMask,640);assert.equal(p.settings.explosionRadius,policy.explosionRadius);if(binding.gunType!==5)assert.equal(p.lifetimeSeconds,Math.fround(policy.linearLifetimeSeconds));}
 }
});
test('shotgun yaw is independent per successful pellet, capacity failure stops batch before RNG',()=>{
 const pool=new SourceHuntProjectileFlightRuntime(),rolls=[0,.5,1];let samples=0,allocations=0;
 const tokens=sourceHuntEmitGun(pool,{...emission(3),random:()=>rolls[samples++],canAllocate:()=>allocations++<3});assert.equal(tokens.length,3);assert.equal(samples,3);assert.equal(allocations,4);
 const velocities=tokens.map(t=>pool.current(t).velocity);assert.ok(velocities[0].x<0);assert.equal(velocities[1].x,0);assert.ok(velocities[2].x>0);assert.equal(velocities[0].y,0);
 const failed=sourceHuntEmitGun(pool,{...emission(3),random:()=>{throw Error('must not sample');},canAllocate:()=>false});assert.deepEqual(failed,[]);
});
test('single spread strict threshold, missile two-roll scatter, fire damage copy',()=>{
 const pool=new SourceHuntProjectileFlightRuntime();let n=0;sourceHuntEmitGun(pool,{...emission(0),random:()=>{n++;return 0;}});assert.equal(n,0);
 sourceHuntEmitGun(pool,{...emission(0),spreadDegrees:Math.fround(.01),random:()=>{n++;return 0;}});assert.equal(n,1);
 const t=sourceHuntEmitGun(pool,{...emission(5),spreadDegrees:10,random:()=>{n++;return .5;},damage:new BigValue(1n,1000)})[0];assert.equal(n,3);assert.notEqual(pool.current(t).end.x,start.x);assert.ok(pool.current(t).settings.damage.eq(new BigValue(1n,1000)));
});
test('custom linear speed is accepted and determines travel-distance cap, not a hardcoded70 type',()=>{
 const pool=new SourceHuntProjectileFlightRuntime(),t=sourceHuntEmitGun(pool,{...emission(1),linearSpeed:100})[0];assert.equal(pool.current(t).velocity.z,100);assert.equal(pool.current(t).lifetimeSeconds,.5);
});
test('invalid flight settings, emissions and deltas cannot allocate/mutate HP',()=>{
 const pool=new SourceHuntProjectileFlightRuntime(),{r,monsters}=fixture();for(const bad of [{gunNum:999},{damage:-1},{explosionRadius:NaN},{enemyLayerMask:NaN},{gunNum:gunFor(1)}])assert.throws(()=>pool.emitLinear(0,start,direction,70,.7,{...settings(0),...bad}),RangeError);
 assert.throws(()=>pool.emitLinear(5,start,direction,70,.7,settings(5)),RangeError);assert.throws(()=>pool.emitLinear(0,start,direction,0,.7,settings(0)),RangeError);assert.throws(()=>pool.emitMissile(start,start,-1,settings(5)),RangeError);
 assert.throws(()=>sourceHuntEmitGun(pool,{...emission(0),spreadDegrees:-1}),RangeError);assert.throws(()=>sourceHuntEmitGun(pool,{...emission(0),gunNum:999}),RangeError);assert.throws(()=>sourceHuntEmitGun(pool,{...emission(3),random:()=>NaN}),RangeError);assert.equal(pool.activeCount,0);
 assert.throws(()=>pool.advanceFrame(-1,r),RangeError);assert.equal(monsters[0].health.toNumber(),500);
});
