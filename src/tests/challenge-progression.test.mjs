import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeQuote, MAX_CHALLENGE_STAGE } from '../challenge-source.ts';
import { createSession, claimDaily, closeOverlay, openChallenge, startChallenge, exitChallenge,
  step, claimVictory, acknowledgeDefeat, openGun, drawGun, openMine, serializeSession, deserializeSession } from '../session.ts';
import { BigValue } from '../big-value.ts';
import { healthValue, walletValue } from '../rules.ts';

const ready = seed => closeOverlay(claimDaily(createSession(seed ?? 23)));
const enter = session => startChallenge(openChallenge(session));
// Terminal fixtures test settlement and progression; they do not claim a played win.
const winFixture = session => step({ ...session, battle: { ...session.battle, autoMove:false,
  targets:session.battle.targets.map(target=>({...target, health:0, healthValue:BigValue.ZERO})) } }, .01);
const quote = stage => {const result=challengeQuote(stage);assert.equal(result.status,'supported');return result.value;};

test('native challenge stage counts continue past two and cap at 190',()=>{
  for(const [stage,count] of [[1,20],[2,35],[3,50],[12,185],[13,190],[14,190],[5000,190],[5001,190]]) {
    assert.equal(quote(stage).targetCount,count);
    assert.equal(quote(stage).sourceIndex,stage-1);
  }
  assert.equal(challengeQuote(0).status,'unsupported');
  assert.equal(challengeQuote(2.5).status,'unsupported');
  assert.equal(challengeQuote(MAX_CHALLENGE_STAGE+1).status,'unsupported');
});

test('source constructors preserve full tier HP and paired spawn money',()=>{
  for(const [stage,hp,coins] of [[1,[250,450,750],[20,36,60]],
    [2,[750,1350,2250],[60,108,180]],[3,[2200,3960,6600],[180,324,540]]]) {
    const value=quote(stage);
    value.healthByTier.forEach((health,tier)=>assert.ok(health.eq(hp[tier])));
    value.coinByTier.forEach((coin,tier)=>assert.ok(coin.eq(coins[tier])));
    const session=enter({...ready(),challengeStage:stage});
    assert.equal(session.battle.targets.length,value.targetCount);
    assert.deepEqual(new Set(session.battle.targets.map(target=>target.tier)),new Set([0,1,2]));
    for(const target of session.battle.targets) {
      assert.ok(healthValue(target).eq(value.healthByTier[target.tier]));
      assert.ok(target.maxHealthValue.eq(value.healthByTier[target.tier]));
      assert.ok(target.coinValue.eq(value.coinByTier[target.tier]));
      assert.equal(target.health,hp[target.tier]);assert.equal(target.maxHealth,hp[target.tier]);
      assert.equal(target.coin,coins[target.tier]);
    }
  }
});

test('table continuation follows native PowOfThree and never clamps to its last value',()=>{
  const last=quote(5000),next=quote(5001),third=quote(5002);
  assert.equal(last.valueOrigin,'serialized-table');assert.equal(next.valueOrigin,'native-extrapolation');
  assert.ok(last.healthByTier[0].eq('8.1e2354'));
  assert.ok(next.healthByTier[0].eq('2.4e2355'));
  assert.ok(next.coinByTier[0].eq('1.8e2354'));
  assert.ok(third.healthByTier[0].eq('7.2e2355'));
  assert.equal(quote(MAX_CHALLENGE_STAGE).targetCount,190);
});

test('daily 70 plus first 30 unlocks a real 100-diamond draw, with later wins funding more draws',()=>{
  let session=ready();assert.equal(session.diamonds,70);assert.equal(session.gunUnlocked,false);
  const field=session.battle;
  session=claimVictory(winFixture(enter(session)));
  assert.equal(session.diamonds,100);assert.equal(session.challengeStage,2);assert.equal(session.gunUnlocked,true);
  assert.deepEqual(session.battle.targets,field.targets);
  assert.equal(claimVictory(session),session);
  session=drawGun(openGun(session));assert.equal(session.diamonds,0);assert.equal(session.gunInventory.length,1);
  session=closeOverlay(session);
  for(const stage of [2,3,4,5]) {
    const before=session.diamonds;
    const run=enter(session);assert.equal(run.mode,'challenge');assert.equal(run.battle.stage,stage-1);
    session=claimVictory(winFixture(run));assert.equal(session.diamonds,before+30);
  }
  assert.equal(session.challengeStage,6);assert.equal(session.diamonds,120);
  session=drawGun(openGun(session));assert.equal(session.diamonds,20);assert.equal(session.gunInventory.length,2);
  assert.equal(session.historicMax,0);assert.equal(openMine(closeOverlay(session)).overlay,'none');
});

test('timeout and early exit preserve stage, diamonds, field, and retry values',()=>{
  const initial={...ready(),challengeStage:3};
  const run=enter(initial),exited=exitChallenge(run);
  assert.equal(exited.challengeStage,3);assert.equal(exited.diamonds,70);
  assert.deepEqual(exited.battle.targets,initial.battle.targets);
  const failed=step({...run,battle:{...run.battle,autoMove:false,elapsed:59.99,
    targets:run.battle.targets.map(target=>({...target,position:{x:10000,y:10000}}))}},.02);
  assert.equal(failed.mode,'defeat');assert.equal(claimVictory(failed),failed);
  const field=acknowledgeDefeat(failed);assert.equal(field.challengeStage,3);assert.equal(field.diamonds,70);
  const retry=enter(field);assert.equal(retry.mode,'challenge');
  assert.equal(retry.battle.targets.length,50);
  assert.ok(retry.battle.targets.every(target=>quote(3).healthByTier.some(health=>health.eq(healthValue(target)))));
  assert.equal(startChallenge(run),run);
});

test('ordinary history uses decade encoding; only Stage 4 opens mine',()=>{
  assert.equal(openMine({...ready(),historicMax:29}).overlay,'none');
  assert.equal(openMine({...ready(),historicMax:30}).overlay,'mine');
  const initial={...ready(),historicMax:24};
  const cleared=step({...initial,battle:{...initial.battle,stage:2,level:4,autoMove:false,
    targets:initial.battle.targets.map(target=>({...target,health:0,healthValue:BigValue.ZERO}))}},.01);
  assert.equal(cleared.battle.stage,3);assert.equal(cleared.battle.level,0);assert.equal(cleared.historicMax,30);
  assert.equal(openMine(cleared).overlay,'mine');
});

test('active challenge and settled persistence retain authoritative values and prevent duplicate payout',()=>{
  const active=enter({...ready(),challengeStage:5001});
  const restored=deserializeSession(serializeSession(active));assert.equal(restored.mode,'challenge');
  assert.equal(restored.challengeStage,5001);assert.equal(restored.battle.targets.length,190);
  assert.ok(healthValue(restored.battle.targets[0]).eq(healthValue(active.battle.targets[0])));
  assert.ok(walletValue(restored.battle).eq(walletValue(active.battle)));
  const victory=deserializeSession(serializeSession(winFixture(enter(ready()))));
  const paid=deserializeSession(serializeSession(claimVictory(victory)));
  assert.equal(paid.diamonds,100);assert.equal(claimVictory(paid),paid);
  for(const challengeStage of [0,-1,2.5,MAX_CHALLENGE_STAGE+2])
    assert.throws(()=>deserializeSession(serializeSession({...ready(),challengeStage})));
  assert.throws(()=>deserializeSession(serializeSession({...active,challengeStage:2})));
});

test('unsupported numeric boundary leaves currency and field progress available',()=>{
  const initial={...ready(),challengeStage:MAX_CHALLENGE_STAGE+1};
  const panel=openChallenge(initial);assert.equal(panel.overlay,'challenge');
  const result=startChallenge(panel);assert.equal(result.mode,'field');assert.equal(result.challengeStage,initial.challengeStage);
  assert.equal(result.diamonds,initial.diamonds);assert.equal(result.battle,initial.battle);
  assert.match(result.notice,/保留进度/);
  const restored=deserializeSession(serializeSession(closeOverlay(result)));
  assert.equal(restored.challengeStage,initial.challengeStage);assert.equal(restored.diamonds,70);
});
