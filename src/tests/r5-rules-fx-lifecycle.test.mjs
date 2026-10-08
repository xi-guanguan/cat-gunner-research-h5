import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel,tick} from '../rules.ts';
import {SourceGunType,sourceProjectileState} from '../gun-projectiles.ts';
import {createMineBattle,tickMineBattle} from '../mine-runtime.ts';
import {SOURCE_MINE_CONFIG} from '../mine-source.ts';
import {BigValue} from '../big-value.ts';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const target=(id,x,y=5,health=1000)=>({id,position:{x,y},radius:.1,health,maxHealth:health,coin:0});
function probe(type=SourceGunType.Single,overrides={}) {
  return {...createLevel(),shootCooldown:999,targetBatchSize:0,targets:[target(1,100)],
    projectiles:[{id:90,weaponId:'probe',position:{x:0,y:5},velocity:{x:15,y:0},damage:100,
      remainingRange:50,distanceTraveled:0,gunSlot:2,spawnTime:0,height:2,source:sourceProjectileState(type),...overrides}]};
}
const lifecycle=(state,id=90)=>state.projectileLifecycleEvents.filter(e=>e.projectileId===id);
test('native same-step birth and hit survive removal, with authoritative zero age and compatible shot/impact',()=>{
  const original={...createLevel(),targets:[target(1,10,10)],
    primaryGun:{id:'native',sourceType:SourceGunType.Single,damage:10,intervalSeconds:.05}};
  const result=tick(original,.1,{},undefined,[],()=>({position:{x:10,y:10},height:2}));
  assert.equal(result.projectiles.length,0);assert.equal(result.shotEvents.length,1);assert.equal(result.impactEvents.length,1);
  const events=lifecycle(result,result.shotEvents[0].projectileIds[0]);
  assert.deepEqual(events.map(e=>e.type),['projectileBorn','projectilePath','projectileStopped']);
  for(const e of events){assert.equal(e.time,.1);assert.equal(e.spawnTime,.1);assert.deepEqual(e.position,{x:10,y:10});assert.equal(e.actorId,0);}
  assert.equal(events[2].reason,'hit');assert.deepEqual(events[1].fromPosition,events[0].position);
  assert.equal(original.projectileLifecycleEvents.length,0);
});
test('legacy same-step swept hit stops at entry contact instead of full intended endpoint',()=>{
  const original={...createLevel(),targets:[target(1,1,5)],primaryGun:{id:'legacy',damage:10,intervalSeconds:2}};
  const result=tick(original,.1,{},undefined,[],()=>({position:{x:0,y:5},height:2}));
  assert.equal(result.projectiles.length,0);
  const events=lifecycle(result,result.shotEvents[0].projectileIds[0]);
  assert.deepEqual(events.map(e=>e.type),['projectileBorn','projectilePath','projectileStopped']);
  close(events[1].position.x,.9);assert.deepEqual(events[2].position,events[1].position);
  assert.deepEqual(result.impactEvents[0].position,events[2].position);assert.equal(events[0].time,0);
});
test('pierce continues after first hit and clips terminal second hit even when impact already spawned',()=>{
  const first={...probe(SourceGunType.Pierce),targets:[target(1,1),target(2,2)]};
  const step1=tick(first,.08);assert.equal(step1.projectiles.length,1);
  assert.deepEqual(lifecycle(step1).map(e=>e.type),['projectilePath']);close(lifecycle(step1)[0].position.x,1.2);
  const step2=tick(step1,.08);assert.equal(step2.projectiles.length,0);assert.equal(step2.impactEvents.length,0);
  assert.deepEqual(lifecycle(step2).map(e=>e.type),['projectilePath','projectileStopped']);
  close(lifecycle(step2)[0].position.x,1.9);assert.equal(lifecycle(step2)[1].reason,'hit');
  const laser=tick({...probe(SourceGunType.Laser),targets:[target(1,1),target(2,2)]},.2);
  assert.equal(laser.projectiles.length,1);assert.equal(lifecycle(laser).length,1);close(lifecycle(laser)[0].position.x,3);
});
test('range and lifetime removal retain measured terminal endpoints and distinct reasons',()=>{
  const range=tick(probe(SourceGunType.Single,{velocity:{x:70,y:0},lifetimeSeconds:2,remainingRange:3}),.1);
  assert.deepEqual(lifecycle(range).map(e=>e.type),['projectilePath','projectileStopped']);
  close(lifecycle(range)[0].position.x,3);assert.equal(lifecycle(range)[1].reason,'range');
  const lifetime=tick(probe(SourceGunType.Single,{velocity:{x:70,y:0},lifetimeSeconds:.03}),.1);
  close(lifecycle(lifetime)[0].position.x,2.1);assert.equal(lifecycle(lifetime)[1].reason,'lifetime');
  assert.equal(range.projectiles.length,0);assert.equal(lifetime.projectiles.length,0);
});
test('missile endpoint detonation forwards final three-dimensional path height and stops emission',()=>{
  const flight={start:{x:0,y:2,z:5},end:{x:3,y:0,z:5},durationSeconds:.1,arcHeight:1.2,destroyAfterSeconds:.6};
  const next=tick(probe(SourceGunType.Missile,{flight,lifetimeSeconds:.6,explosionRadius:1}),.2);
  assert.equal(next.projectiles.length,0);assert.equal(next.impactEvents.length,1);
  const events=lifecycle(next);assert.deepEqual(events.map(e=>e.type),['projectilePath','projectileStopped']);
  assert.equal(events[0].fromHeight,2);assert.equal(events[0].height,0);close(events[0].position.x,3);
  assert.equal(events[1].reason,'hit');assert.deepEqual(events[1].position,next.impactEvents[0].position);
});
test('each tick clears lifecycle queues, never repeats stopped IDs and keeps prior snapshots immutable',()=>{
  const first=tick(probe(),.1),saved=structuredClone(first.projectileLifecycleEvents);
  const second=tick(first,.1);assert.equal(second.projectileLifecycleEvents.length,1);
  assert.deepEqual(first.projectileLifecycleEvents,saved);assert.deepEqual(lifecycle(second)[0].fromPosition,{x:1.5,y:5});
  const stopped=tick(probe(SourceGunType.Single,{remainingRange:.5}),.1);
  assert.deepEqual(tick(stopped,.1).projectileLifecycleEvents,[]);
  assert.deepEqual(tick({...first,phase:'lost'},.1).projectileLifecycleEvents,[]);
});
test('mine forwards lifecycle in source coordinates, including both segment endpoints and settled reset',()=>{
  const adapters={random:{nextDouble:()=>0,nextInt:a=>a,evidence:'test'},perlinNoise:()=>1,noiseEvidence:'test'};
  let run=createMineBattle(createLevel(),7,{adapters,spawn:{x:-10,y:-7},
    guns:[{id:'mine-gun',damage:1,intervalSeconds:2}],generationConfig:{...SOURCE_MINE_CONFIG,poolCapacity:1}});
  run={...run,battle:{...run.battle,autoMove:false,targets:[{...run.battle.targets[0],
    position:{x:-6,y:-7},radius:.1,health:100,maxHealth:100,healthValue:BigValue.from(100),maxHealthValue:BigValue.from(100)}]}};
  const next=tickMineBattle(run,.1,{},()=>({position:{x:-8,y:-7},height:2}));
  const events=next.events.filter(e=>e.type.startsWith('projectile')&&e.type!=='projectileImpact');
  assert.deepEqual(events.map(e=>e.type),['projectileBorn','projectilePath','projectileStopped']);
  assert.deepEqual(events[0].position,{x:-8,y:-7});assert.deepEqual(events[1].fromPosition,{x:-8,y:-7});
  close(events[1].position.x,-6.1);assert.equal(events[1].position.y,-7);
  assert.deepEqual(events,next.battle.projectileLifecycleEvents);assert.equal(events[2].reason,'hit');
  const settled=tickMineBattle({...next,settled:true},.1);assert.deepEqual(settled.events,[]);assert.deepEqual(settled.battle.projectileLifecycleEvents,[]);
});
