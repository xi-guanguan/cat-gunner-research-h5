import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel,tick as tickRules} from '../rules.ts';
import {makeActor} from '../cat-actors.ts';
import {candidateConfig} from '../config.ts';
import {sourceCatSpreadMaxAngle,SOURCE_CAT_SPREAD_SERIALIZED_CONFIG} from '../gun-projectiles.ts';
import {sourceGun,createSession,serializeSession,deserializeSession} from '../session.ts';
const tick=(s,dt,input,c)=>tickRules(s,dt,input,c,[],()=>({position:{x:0,y:0},height:2}));
const cfg={...candidateConfig,player:{...candidateConfig.player,attackRange:100}};
function setup(type,scale={x:10,y:5},ready=false) {
  const s=createLevel();s.player={x:0,y:0};s.worldUnitsPerPoint=scale;s.targetBatchSize=0;
  s.autoMove=false;s.actors=[makeActor(0,s.player)];
  // Movement/trajectory probes explicitly preload a continuously acquired target.
  if(ready)s.actors[0].attackState={spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2};
  s.targets=[{id:1,position:{x:3,y:0},radius:.01,health:10000,maxHealth:10000,coin:1}];
  s.primaryGun={id:'source-probe',sourceType:type,damage:10,intervalSeconds:2,pelletCount:5,spreadDegrees:10,
    penetratingBulletLifetime:2,missileSpeed:30,missileExplosionRadius:5};return s;
}
test('source linear speed is 70 world units per second under anisotropic point scale',()=>{
  const emitted=tick(setup(0,undefined,true),.1,{},cfg);assert.equal(emitted.projectiles.length,1);
  const next=tick(emitted,.1,{},cfg);
  assert.ok(Math.abs(next.projectiles[0].position.x-.7)<1e-9);
  assert.equal(next.projectiles[0].position.y,0);assert.ok(Math.abs(next.projectiles[0].distanceTraveled-7)<1e-9);
  assert.equal(emitted.shotEvents[0].projectileIds.length,1); // type0 ignores pelletCount5
});
test('source shotgun independently scatters each pellet in world space, with replayable adapter seed',()=>{
  const a=tick(setup(3,undefined,true),.01,{},cfg),b=tick(setup(3,undefined,true),.01,{},cfg);
  assert.equal(a.projectiles.length,5);assert.deepEqual(a.projectiles,b.projectiles);
  const angles=a.projectiles.map(p=>Math.atan2(-p.velocity.y*5,p.velocity.x*10)*180/Math.PI);
  assert.equal(new Set(angles).size,5);assert.ok(angles.every(a=>a>=-10&&a<=10));
  assert.ok(a.projectiles.every(p=>Math.abs(Math.hypot(p.velocity.x*10,p.velocity.y*5)-70)<1e-9));
});
test('source missile follows the height arc, detonates at endpoint and pays once',()=>{
  let s=setup(5,undefined,true);s.targets[0].health=s.targets[0].maxHealth=10;
  s=tick(s,.25,{},cfg);assert.equal(s.targets[0].health,10);assert.equal(s.projectiles[0].height,2);
  s=tick(s,.25,{},cfg);assert.ok(s.projectiles[0].height>2);
  s=tick(s,.25,{},cfg);assert.ok(Math.abs(s.projectiles[0].position.x-1.5)<1e-9);
  assert.ok(Math.abs(s.projectiles[0].height-13)<1e-5);
  s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);
  assert.equal(s.projectiles.length,0);assert.equal(s.targets[0].health,0);assert.equal(s.coins,1);
  assert.equal(tick(s,.1,{},cfg).coins,1);
});
test('source lifetime removes an uncollided single and survives decimal save reload with trajectory metadata',()=>{
  let s=setup(0,undefined,true);s.targets[0].position={x:9,y:0};s=tick(s,.25,{},cfg);
  s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);assert.equal(s.projectiles.length,0);
  const session=createSession(17);session.battle=tick(setup(5,undefined,true),.1,{},cfg);session.equippedGuns=[sourceGun(18),null,null];
  const restored=deserializeSession(serializeSession(session));
  assert.deepEqual(restored.battle.projectiles[0].flight,session.battle.projectiles[0].flight);
  assert.equal(restored.battle.projectileRngState,session.battle.projectileRngState);
});

test('source single cannot hit beyond its 0.7 second lifetime even when a fixed step straddles expiry',()=>{
  let s=setup(0,undefined,true);s.targets[0].position={x:4.97,y:0};s.targets[0].radius=.001;
  s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);s=tick(s,.25,{},cfg);
  assert.equal(s.targets[0].health,10000);assert.equal(s.projectiles.length,0);
});


test('source first target acquisition resets preloaded spread and clock before this frame adds dt',()=>{
  const initial=setup(0);initial.primaryGun.intervalSeconds=.125;
  initial.actors[0].attackState={spreadAngleDegrees:9,previousHadTarget:false,attackTimerSeconds:2};
  const acquired=tick(initial,.03125,{},cfg);
  assert.equal(acquired.projectiles.length,0);
  assert.deepEqual(acquired.actors[0].attackState,{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:.03125});
  const waiting=tick(acquired,.0625,{},cfg);assert.equal(waiting.projectiles.length,0);
  const fired=tick(waiting,.03125,{},cfg);assert.equal(fired.projectiles.length,1);
  assert.equal(fired.actors[0].attackState.attackTimerSeconds,0);
  assert.ok(fired.actors[0].attackState.spreadAngleDegrees>0);
  assert.equal(initial.actors[0].attackState.attackTimerSeconds,2);
});
test('source switching between nonempty targets keeps spread and elapsed attack time',()=>{
  const initial=setup(0,undefined,true);
  initial.actors[0].aimTargetId=1;initial.actors[0].autoTargetId=1;
  initial.actors[0].attackState={spreadAngleDegrees:6,previousHadTarget:true,attackTimerSeconds:.5};
  initial.targets[0].id=2;
  const next=tick(initial,.125,{},cfg);
  assert.equal(next.actors[0].aimTargetId,2);assert.equal(next.projectiles.length,0);
  assert.deepEqual(next.actors[0].attackState,{spreadAngleDegrees:6,previousHadTarget:true,attackTimerSeconds:.625});
});
test('source losing a target decays spread while advancing the independent attack clock',()=>{
  const initial=setup(0,undefined,true);initial.targets[0].position={x:200,y:0};
  initial.actors[0].attackState={spreadAngleDegrees:9,previousHadTarget:true,attackTimerSeconds:.5};
  const next=tick(initial,.125,{},cfg);
  const expected=9-Math.max(sourceCatSpreadMaxAngle(2,SOURCE_CAT_SPREAD_SERIALIZED_CONFIG),1)*3*.125;
  assert.equal(next.actors[0].aimTargetId,null);assert.equal(next.projectiles.length,0);
  assert.equal(next.actors[0].attackState.spreadAngleDegrees,expected);
  assert.equal(next.actors[0].attackState.previousHadTarget,false);
  assert.equal(next.actors[0].attackState.attackTimerSeconds,.625);
  const reacquired=tick({...next,targets:initial.targets.map(t=>({...t,position:{x:3,y:0}}))},.125,{},cfg);
  assert.deepEqual(reacquired.actors[0].attackState,{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:.125});
});
test('source three cats keep independent spread and clocks and attempt at most once per frame',()=>{
  const initial=setup(0);initial.primaryGun.intervalSeconds=.125;
  const timers=[.09375,.03125,.3125];
  initial.actors=timers.map((attackTimerSeconds,id)=>({...makeActor(id,{x:-id,y:0}),
    attackState:{spreadAngleDegrees:id,previousHadTarget:true,attackTimerSeconds}}));
  const extra=[{...initial.primaryGun,slot:1,intervalSeconds:.25},{...initial.primaryGun,slot:2,intervalSeconds:.5}];
  const first=tickRules(initial,.03125,{},cfg,extra,()=>({position:{x:0,y:0},height:2}));
  assert.deepEqual(first.shotEvents.map(e=>e.gunSlot),[0]);
  assert.deepEqual(first.actors.map(a=>a.attackState.attackTimerSeconds),[0,.0625,.34375]);
  assert.equal(first.actors[1].attackState.spreadAngleDegrees,1);
  assert.equal(first.actors[2].attackState.spreadAngleDegrees,2);
  assert.notEqual(first.actors[0].attackState,first.actors[1].attackState);
  const second=tickRules(first,.1875,{},cfg,extra,()=>({position:{x:0,y:0},height:2}));
  assert.deepEqual(second.shotEvents.map(e=>e.gunSlot),[0,1,2]);
  assert.deepEqual(second.actors.map(a=>a.attackState.attackTimerSeconds),[0,0,0]);
  assert.deepEqual(initial.actors.map(a=>a.attackState.attackTimerSeconds),timers);
});
test('source emitted projectiles have age zero at their muzzle and move on the following tick',()=>{
  for(const type of [0,3,5]) {
    const emitted=tick(setup(type,undefined,true),.125,{},cfg);
    assert.ok(emitted.projectiles.length>0);
    for(const p of emitted.projectiles) {
      assert.equal(emitted.elapsed-p.spawnTime,0);assert.deepEqual(p.position,{x:0,y:0});
      assert.equal(p.distanceTraveled,0);assert.equal(p.height,2);
    }
    const advanced=tick(emitted,.125,{},cfg);
    assert.ok(advanced.projectiles.every(p=>p.position.x>0));
    if(type===5)assert.ok(advanced.projectiles[0].height>2);
    else assert.ok(advanced.projectiles.every(p=>Math.abs(p.distanceTraveled-8.75)<1e-9));
  }
});
test('save reload preserves per-cat attack state and deterministic next emission',()=>{
  const session=createSession(17);session.battle=setup(5);session.equippedGuns=[sourceGun(18),null,null];
  session.battle.actors=[0,1,2].map(id=>({...makeActor(id,{x:-id,y:0}),
    attackState:{spreadAngleDegrees:id+.5,previousHadTarget:id!==2,attackTimerSeconds:.5+id}}));
  const restored=deserializeSession(serializeSession(session));
  assert.deepEqual(restored.battle.actors.map(a=>a.attackState),session.battle.actors.map(a=>a.attackState));
  assert.deepEqual(tick(restored.battle,.125,{},cfg),tick(session.battle,.125,{},cfg));
});
