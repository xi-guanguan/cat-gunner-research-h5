import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceStarState,validateSourceStarState,sourceStarUnlocked,sourceStarCost,sourceStarSuccessRate,sourceStarQuote,sourceStarUpgrade,sourceStarDamage,SOURCE_STAR_SUCCESS_RATES} from '../r6-star';
import {createSession,sourceGun,upgradeSessionStar,serializeSession,deserializeSession,applyGunDrop,step,sessionBossPower} from '../session';
import {gunEntityRef} from '../gun-drag';import {makeActor} from '../cat-actors';
import {BigValue} from '../big-value';import {sourceBossStarDamagePercent} from '../r5-boss';
const ready=()=>({...createSession(4311),historicMax:390,overlay:'gun',gunUnlocked:true,starGem:3000});
test('exact source table, gate, prices and 18–20-star probability cap (not a guarantee)',()=>{
 assert.deepEqual(SOURCE_STAR_SUCCESS_RATES,[100,90,80,70,60,50,40,30,20,10,10,10,10,10,5,5,5,1,1,1]);assert.equal(sourceStarUnlocked(389),false);assert.equal(sourceStarUnlocked(390),true);
 for(let lv=0;lv<20;lv++){assert.equal(sourceStarCost(lv),50*(lv+1));assert.equal(sourceStarSuccessRate(lv,0),SOURCE_STAR_SUCCESS_RATES[lv]);assert.equal(sourceStarSuccessRate(lv,500),lv>=17?5:SOURCE_STAR_SUCCESS_RATES[lv]);}assert.equal(sourceStarCost(20),0);assert.equal(sourceStarSuccessRate(20,0),0);
 for(const fails of [0,1,2,3,4,100])assert.equal(sourceStarSuccessRate(17,fails),Math.min(5,1+fails));
});
test('source transaction consumes currency on failure without losing stars; random [0,100) threshold',()=>{
 const state={levels:[17,3,0],failCounts:[3,4,0],starGem:3000},before=structuredClone(state);
 const win=sourceStarUpgrade(state,0,390,()=>3);assert.equal(win.resultCode,0);assert.deepEqual(win.value,{levels:[18,3,0],failCounts:[0,4,0],starGem:2100});
 const loss=sourceStarUpgrade(state,0,390,()=>4);assert.equal(loss.resultCode,1);assert.deepEqual(loss.value,{levels:[17,3,0],failCounts:[4,4,0],starGem:2100});assert.deepEqual(state,before);
 assert.equal(sourceStarUpgrade({...state,failCounts:[999,0,0]},0,390,()=>5).succeeded,false);
 for(const roll of [-1,100,0.5,NaN])assert.throws(()=>sourceStarUpgrade(state,0,390,()=>roll));
});
test('denials do not debit or call RNG; exact native result codes',()=>{
 const state={...freshSourceStarState(),starGem:3000};
 for(const [s,slot,stage,code,reason]of [[state,-1,390,4,'invalid-slot'],[state,3,390,4,'invalid-slot'],[state,0,389,4,'stage-required'],[{...state,levels:[20,0,0]},0,390,2,'max-level'],[{...state,starGem:49},0,390,3,'insufficient-star-gem']]){const q=sourceStarUpgrade(s,slot,stage,()=>{throw Error('must not roll');});assert.equal(q.value,s);assert.equal(q.resultCode,code);assert.equal(q.reason,reason);}
});
test('old schema2 migration grants nothing; roundtrip retains slot/failures/currency and rejects corrupt arrays',()=>{
 const s=ready(),old=JSON.parse(serializeSession(s));delete old.session.bossSlotLevels;delete old.session.starFailCounts;delete old.session.starGem;
 const m=deserializeSession(JSON.stringify(old));assert.deepEqual(m.bossSlotLevels,[0,0,0]);assert.deepEqual(m.starFailCounts,[0,0,0]);assert.equal(m.starGem,0);
 const value={...s,bossSlotLevels:[17,2,20],starFailCounts:[4,9,0],starGem:2900},restored=deserializeSession(serializeSession(value));assert.deepEqual(restored.bossSlotLevels,value.bossSlotLevels);assert.deepEqual(restored.starFailCounts,value.starFailCounts);assert.equal(restored.starGem,2900);
 for(const patch of [{levels:[0,0]},{levels:[21,0,0]},{failCounts:[-1,0,0]},{starGem:0.5},{starGem:2147483648}])assert.throws(()=>validateSourceStarState({...freshSourceStarState(),...patch}));
});
test('session upgrade persists and only accepted attempts advance RNG; stars stay on slot after swapping guns',()=>{
 const s=ready(),win=upgradeSessionStar(s,1);assert.equal(win.result.succeeded,true);assert.equal(win.session.starGem,2950);assert.deepEqual(win.session.bossSlotLevels,[0,1,0]);assert.notEqual(win.session.rngState,s.rngState);
 const denied=upgradeSessionStar({...s,starGem:0},0);assert.equal(denied.session.rngState,s.rngState);assert.equal(denied.session.starGem,0);
 const a={...win.session,equippedGuns:[sourceGun(0),sourceGun(25),null]},b=applyGunDrop(a,{from:gunEntityRef(a.equippedGuns[0],'equipment',0),to:{kind:'equipment',index:1},intent:'swap'});
 // Source gun drop uses stable identity and must never carry the slot upgrade with the weapon.
 assert.equal(b.accepted,true);assert.equal(b.session.equippedGuns[0].id,a.equippedGuns[1].id);assert.equal(b.session.equippedGuns[1].id,a.equippedGuns[0].id);assert.deepEqual(b.session.bossSlotLevels,[0,1,0]);assert.equal(deserializeSession(serializeSession(win.session)).starGem,2950);
});
test('ordinary projectiles and Boss power consume shared slot stars; level zero is arithmetic identity',()=>{
 const big=new BigValue(123456789012345678901234567890123456n,300);assert.equal(sourceStarDamage(big,0),big);assert.throws(()=>sourceStarDamage(big,21));
 let s={...ready(),overlay:'none',equippedGuns:[sourceGun(0),null,null]};s.battle={...s.battle,autoMove:false,actors:[{...makeActor(0,s.battle.player),attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}],targets:s.battle.targets.map((target,index)=>({...target,position:index===0?{x:s.battle.player.x+2,y:s.battle.player.y}:{x:100,y:100}}))};
 const a=step(s,1/60),b=step({...s,bossSlotLevels:[2,0,0]},1/60);assert.ok(a.battle.shotEvents.length>0);assert.ok(b.battle.shotEvents.length>0);
 assert.ok(a.battle.projectiles.length>0);assert.ok(b.battle.projectiles.length>0);const base=a.battle.projectiles[0].damageValue,up=b.battle.projectiles[0].damageValue;assert.ok(up.eq(sourceStarDamage(base,2)));assert.ok(up.gt(base));
 assert.ok(sessionBossPower({...s,bossSlotLevels:[2,0,0]}).gt(sessionBossPower(s)));assert.equal(sourceStarQuote({levels:[2,0,0],failCounts:[0,0,0],starGem:0},0,390).currentDamagePercent.toString(),sourceBossStarDamagePercent(2).toString());
});
