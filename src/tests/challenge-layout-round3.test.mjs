import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeRings, challengeSlots, CHALLENGE_SPAWN } from '../challenge-layout.ts';
import { createSession, claimDaily, closeOverlay, openChallenge, startChallenge, step, sourceGun, serializeSession, deserializeSession } from '../session.ts';
import { BigValue } from '../big-value.ts';
import { walletValue } from '../rules.ts';
const enter=(seed=37,stage=1)=>startChallenge(openChallenge({...closeOverlay(claimDaily(createSession(seed))),challengeStage:stage}));
const snapshot=run=>run.battle.targets.map(t=>({id:t.id,position:{...t.position},tier:t.tier}));

test('native ring allocation, alternating angular half-step, and scene origin',()=>{
  for(const [count,counts,radii] of [[20,[7,13],[34,58]],[35,[13,22],[34,58]],
    [50,[11,17,22],[30,46,62]],[190,[18,23,29,34,40,46],[26,34,42,50,58,66]]]) {
    const rings=challengeRings(count);
    assert.deepEqual(rings.map(r=>r.count),counts);
    assert.deepEqual(rings.map(r=>r.radius),radii);
    assert.equal(rings.reduce((sum,r)=>sum+r.count,0),count);
    assert.equal(rings[0].startAngleDegrees,0);
    assert.equal(rings[1].startAngleDegrees,Math.fround(rings[1].angleStepDegrees*.5));
  }
  const slots=challengeSlots(20,()=>.5);
  assert.equal(slots.length,20);
  assert.deepEqual(slots[0].local,{x:34,z:0});
  assert.deepEqual(slots[0].world,{x:-66,z:0});
  assert.deepEqual(slots[0].position,{x:CHALLENGE_SPAWN.x+34/12,y:CHALLENGE_SPAWN.y});
  assert.throws(()=>challengeRings(191));
});

test('layout consumes two bounded source jitter draws once for every initial target',()=>{
  let calls=0;
  const slots=challengeSlots(50,()=>{calls++;return calls%2?0:1-1e-10;});
  assert.equal(calls,100);
  for(const slot of slots) {
    const ring=challengeRings(50)[slot.ring],radius=Math.hypot(slot.local.x,slot.local.z);
    assert.ok(radius>=ring.radius-3-1e-5 && radius<=Math.hypot(ring.radius+3,2)+1e-5);
  }
  const first=enter(37,3),repeat=enter(37,3);
  assert.deepEqual(snapshot(first),snapshot(repeat));
  assert.equal(first.battle.targetBatchSize,0);
  assert.equal(first.battle.targets.length,50);
  assert.deepEqual(first.battle.player,CHALLENGE_SPAWN);
  assert.equal(new Set(first.battle.targets.map(t=>`${t.position.x}:${t.position.y}`)).size,50);
});

test('source challenge collision includes a target outside the old five-tree batch',()=>{
  let run=enter();
  const victim=run.battle.targets[10];
  run={...run,battle:{...run.battle,autoMove:false,targetBatchSize:5,
    targets:run.battle.targets.map(t=>({...t,position:t.id===victim.id?{x:4.8,y:8}:{x:1000+t.id,y:1000}})),
    projectiles:[{id:100,position:{x:4.5,y:8},velocity:{x:20,y:0},damage:1e6,damageValue:BigValue.fromInteger(1e6),
      remainingRange:100,distanceTraveled:0,gunSlot:0}]}};
  const advanced=step(run,.1);
  assert.equal(advanced.battle.targets[10].health,0);
  assert.equal(advanced.battle.targetBatchSize,0);
  assert.equal(advanced.events.filter(e=>e.type==='death').length,1);
});

test('actual shot simulation eliminates a fixed forest once, persists removals, and wins on clear',()=>{
  let run=enter();
  const initial=snapshot(run),dead=new Set();
  const expectedReward=run.battle.targets.reduce((sum,t)=>sum.nativeAdd(t.coinValue),BigValue.ZERO);
  const initialCoins=walletValue(run.battle);
  // Real serialized weapon and stat slots; stronger slots keep this a bounded combat regression.
  run={...run,equippedGuns:[sourceGun(0),null,null],battle:{...run.battle,
    upgradeLevels:{...run.battle.upgradeLevels,power:49,speed:50}}};
  let deathEvents=0,saved=false;
  for(let frame=0;frame<1200 && run.mode==='challenge';frame++) {
    run=step(run,.05);
    assert.deepEqual(snapshot(run),initial);
    for(const id of dead)assert.equal(run.battle.targets.find(t=>t.id===id).health,0);
    for(const event of run.events.filter(e=>e.type==='death')) {
      assert.equal(dead.has(event.id),false,'a dead tree must never be spawned or paid again');
      dead.add(event.id);deathEvents++;
    }
    if(!saved && dead.size>=3 && run.mode==='challenge') {
      run=deserializeSession(serializeSession(run));saved=true;
      assert.equal(run.battle.targetBatchSize,0);
      assert.deepEqual(snapshot(run),initial);
      for(const id of dead)assert.equal(run.battle.targets.find(t=>t.id===id).health,0);
    }
  }
  assert.equal(saved,true);
  assert.equal(run.mode,'victory');
  assert.equal(run.battle.phase,'won');
  assert.equal(deathEvents,20);
  assert.equal(run.battle.targets.length,20);
  assert.ok(run.battle.targets.every(t=>t.health===0));
  assert.ok(walletValue(run.battle).eq(initialCoins.nativeAdd(expectedReward)));
  assert.equal(run.events.filter(e=>e.type==='stageWon').length,1);
  assert.equal(step(run,.05).mode,'victory');
});
