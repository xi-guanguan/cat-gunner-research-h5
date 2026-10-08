import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,closeOverlay,openMine,startMine,exitMine,step,serializeSession,deserializeSession} from '../session.ts';
import {BigValue} from '../big-value.ts';
import {walletValue} from '../rules.ts';
import {createLocalMineTime} from '../mine-time.ts';
const day=createLocalMineTime(()=>new Date(2026,8,30,12));
const next=createLocalMineTime(()=>new Date(2026,9,1,12));
const previous=createLocalMineTime(()=>new Date(2026,8,29,12));
const ready=()=>({...closeOverlay(createSession(3)),historicMax:30,diamonds:70,
  mine:{tickets:{used:0,storedDate:day.today()},bestReward:0,run:null,settlement:null}});
const enter=()=>startMine(openMine(ready()),day);
test('mine gate, entry ticket, and duplicate entry are enforced',()=>{
  const locked=openMine({...ready(),historicMax:29});assert.equal(locked.overlay,'none');
  const panel=openMine(ready()),run=startMine(panel,day);
  assert.equal(run.mode,'mine');assert.equal(run.mine.tickets.used,1);assert.equal(run.diamonds,70);
  assert.equal(startMine(run,day),run);assert.equal(run.fieldBattle,panel.battle);
});
test('daily ticket adapter allows forward dates and does not refill on clock rollback',()=>{
  const exhausted={...ready(),mine:{...ready().mine,tickets:{used:2,storedDate:day.today()}}};
  assert.equal(startMine(openMine(exhausted),day).mode,'field');
  assert.equal(startMine(openMine(exhausted),previous).mode,'field');
  const reset=startMine(openMine(exhausted),next);assert.equal(reset.mode,'mine');assert.equal(reset.mine.tickets.used,1);
});
test('early exit spends ticket, restores field, and never pays mine score',()=>{
  const run=enter();run.mine.run.score=450;
  const field=exitMine({...run,battle:{...run.battle,coins:68,coinsValue:BigValue.from(68),upgradeLevels:{power:1,money:0,speed:0}}});
  assert.equal(field.mode,'field');assert.equal(field.diamonds,70);assert.equal(field.mine.tickets.used,1);
  assert.equal(field.mine.run,null);assert.equal(field.fieldBattle,null);
  assert.ok(walletValue(field.battle).eq(68));assert.equal(field.battle.upgradeLevels.power,1);
  assert.equal(exitMine(field),field);
});
test('timeout settlement pays once and survives result persistence and return',()=>{
  const initial=enter(),run={...initial.mine.run,score:135,elapsed:59.99};
  run.battle={...run.battle,elapsed:59.99,targets:run.battle.targets.map(t=>({...t,position:{x:10000,y:10000}})),autoMove:false};
  const result=step({...initial,battle:run.battle,mine:{...initial.mine,run}},.02);
  assert.equal(result.mode,'mine-result');assert.equal(result.diamonds,83);assert.equal(result.mine.bestReward,13);
  const restored=deserializeSession(serializeSession(result));
  assert.equal(step(restored,1).diamonds,83);assert.equal(exitMine(restored).diamonds,83);
  assert.equal(restored.mine.run.battle,restored.battle);
});
test('active mine persistence resumes elapsed score and prevents corrupt settlement state',()=>{
  const run=step(enter(),.1,{move:{x:0,y:1}}),restored=deserializeSession(serializeSession(run));
  assert.equal(restored.mode,'mine');assert.equal(restored.mine.run.elapsed,run.mine.run.elapsed);
  assert.ok(step(restored,.1).mine.run.elapsed>restored.mine.run.elapsed);
  for(const mutate of [s=>s.mine.run.bounds.minimum.x=NaN,s=>s.mine.run.durationSeconds=-1,
    s=>s.mine.run.settled=true,s=>s.mine.run.sourceOreCountNow=-1]) {
    const state=deserializeSession(serializeSession(run));mutate(state);
    assert.throws(()=>deserializeSession(serializeSession(state)));
  }
});
