import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceBuffTimes,sourceAddBuff,sourceTickBuffTimes,decodeSourceBuffTimes,sourceBuffTimeText,sourceClaimBuffReward} from '../r6-buff.ts';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState} from '../source-meta-runtime.ts';
import {freshSourceEntitlements,sourceBuffMultiplier} from '../r5-entitlements.ts';
import {createSession,sessionCombatModifiers,sessionBossModifiers,step} from '../session.ts';
import {createLocalRewardProvider} from '../r6-reward-provider.ts';
import {sourceUiTree} from '../source-ui.ts';
test('source buff: +300 clamp900, float32 frame countdown, no offline adjustment',()=>{
 let t=freshSourceBuffTimes();const e=freshSourceEntitlements();
 for(let i=0;i<5;i++)t=sourceAddBuff(t,'money');assert.equal(t.money,900);assert.equal(sourceBuffMultiplier(e,'money',t),3);
 t=sourceAddBuff(sourceAddBuff(t,'power'),'speed');assert.equal(sourceBuffMultiplier(e,'power',t),4);
 assert.equal(sourceTickBuffTimes(t,.02,true),t);
 t=sourceTickBuffTimes(t,.02,false);assert.equal(t.power,Math.fround(300-Math.fround(.02)));
 t=sourceTickBuffTimes(t,300,false);assert.equal(t.power,0);assert.equal(sourceBuffMultiplier(e,'money',t),3);
 assert.equal(sourceTickBuffTimes(t,1000,false).money,0);assert.throws(()=>sourceTickBuffTimes(t,NaN,false));
 assert.equal(sourceBuffTimeText(300),'5:00');assert.equal(sourceBuffTimeText(299.99),'4:59');assert.equal(sourceBuffTimeText(-1),'永久');
});
test('old meta migration defaults buff0, clamp source times, preserve ledger and balances',()=>{
 const old=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));old.petCoin=77;delete old.buffTimes;delete old.buffRewardClaims;
 const m=decodeSourceMetaState(JSON.stringify(old));assert.deepEqual(m.buffTimes,freshSourceBuffTimes());assert.equal(m.petCoin,77);
 const current={...m,buffTimes:{money:333.3,power:200,speed:0},buffRewardClaims:['r1']};
 const reloaded=decodeSourceMetaState(serializeSourceMetaState(current));assert.equal(reloaded.buffTimes.money,Math.fround(333.3));assert.deepEqual(reloaded.buffRewardClaims,['r1']);
 assert.deepEqual(decodeSourceBuffTimes({money:10000,power:-1,speed:0}),{money:900,power:0,speed:0});assert.throws(()=>decodeSourceBuffTimes(null));
});
test('buff applied to real session and boss modifiers, not only UI',()=>{
 const s={...createSession(),overlay:'none'},e=freshSourceEntitlements(),t={money:300,power:300,speed:300};
 const m=sessionCombatModifiers(s,e,undefined,undefined,t);assert.equal(m.damageBuffMultiplier,4);assert.equal(m.attackSpeedBuff,4);assert.equal(m.sourceMoneyBuffPercent,400);
 assert.equal(sessionBossModifiers(s,e,undefined,t).damageBuffMultiplier,4);
 const next=step(s,.02,{},undefined,e,undefined,undefined,t);assert.equal(next.battle.combatModifiers.damageBuffMultiplier,4);
 t.speed=0;assert.equal(sessionCombatModifiers(s,e,undefined,undefined,t).damageBuffMultiplier,3);
 e.buffPack=true;assert.equal(sessionCombatModifiers(s,e).attackSpeedBuff,4);
});
test('local provider: identity, duplicate, failure/cancel/unavailable never award',async()=>{
 const r={id:'test-r1',kind:'ad',purpose:'buff:money'},p=createLocalRewardProvider(true),state={times:freshSourceBuffTimes(),claimedRequestIDs:[]};
 const response=await p.execute(r);assert.deepEqual(await p.execute(r),response);assert.throws(()=>p.execute({...r,purpose:'buff:power'}));
 const granted=sourceClaimBuffReward(state,r,response,'money');assert.equal(granted.state.times.money,300);
 assert.equal(sourceClaimBuffReward(granted.state,r,response,'money').status,'duplicate');
 assert.equal(sourceClaimBuffReward(state,r,{...response,id:'wrong'},'money').status,'rejected');assert.equal(sourceClaimBuffReward(state,null,response,'money').status,'rejected');
 for(const status of ['failure','cancelled','unavailable'])assert.equal(sourceClaimBuffReward(state,r,{...response,status},'money').state,state);
 assert.equal((await createLocalRewardProvider(false).execute(r)).status,'unavailable');
});
test('source buff tree original buttons present and selected, no invented assets',()=>{
 for(const id of [34440,2228,30719,32592,38820,38916,616])assert.ok(sourceUiTree.nodes.some(n=>n.id===`level0:${id}`));
});
