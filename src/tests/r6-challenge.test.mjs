import test from 'node:test';
import assert from 'node:assert/strict';
import {BigValue} from '../big-value.ts';
import {sourceChallengeSettlement,validateSourceChallengeSettlement,sourceChallengeBonusReward,sourceChallengeSweepRequiredPower,sourceChallengeSweepAble,sourceChallengeSweepEfficiency,sourceChallengeTypeMultiplier,sourceChallengePowerFromCats,sourceChallengePlusBannerVisible,sourceChallengeRewardBanner} from '../r6-challenge.ts';
import {createSession,closeOverlay,openChallenge,startChallenge,exitChallenge,settleChallengeVictory,claimVictory,claimChallengeBonus,sweepChallenge,closeChallengeSweep,acknowledgeDefeat,sessionChallengePower,serializeSession,deserializeSession,sourceGun,createFieldLevel,step} from '../session.ts';
import {freshSourceEntitlements} from '../r5-entitlements.ts';
import {sourceGunCooldown,sourceGunDamageStats} from '../rules.ts';
import {challengeQuote,MAX_CHALLENGE_STAGE} from '../challenge-source.ts';
import {developerChallengeBonus,freshPlatformState} from '../local-platform.ts';
const plain=freshSourceEntitlements(),plus={...plain,plusPack2Active:true},auto={...plus,removeAdsAll:true};
const ready=()=>({...closeOverlay(createSession(83)),historicMax:190,diamonds:7,gunUnlocked:true,challengeStage:3});
const entry=()=>openChallenge(ready()),fight=()=>startChallenge(entry()),win=(e=plain)=>settleChallengeVictory(fight(),e);
const powerful=()=>({...entry(),equippedGuns:[sourceGun(25),sourceGun(25),sourceGun(25)]});
const req=s=>({id:'reward:challenge:1',purpose:'challenge:bonus',kind:'ad',runID:s.challengeRunID});
const response=(r,status='success',patch={})=>({...r,status,provider:'local-test',onlineVerified:false,...patch});
const cat=(patch={})=>({active:true,normalDamage:100,criticalDamage:250,criticalProbability:.25,cooldownSeconds:.6,type:0,pelletCount:1,...patch});
test('native win immediately grants 30 and advances once before panel; base exit adds nothing',()=>{
 const before=fight(),s=settleChallengeVictory(before);assert.equal(s.mode,'victory');assert.equal(s.diamonds,37);assert.equal(s.challengeStage,4);assert.equal(s.challengeSettlement.completedStage,3);assert.equal(s.challengeSettlement.kind,'fight');assert.equal(settleChallengeVictory(s),s);
 const loaded=deserializeSession(serializeSession(s));assert.equal(loaded.challengeStage,4);assert.equal(loaded.battle.stage,2);assert.equal(loaded.diamonds,37);
 const left=claimVictory(loaded);assert.equal(left.diamonds,37);assert.equal(left.challengeStage,4);assert.equal(left.challengeRunID,null);assert.equal(claimVictory(left),left);assert.deepEqual(left.battle.targets,before.fieldBattle.targets);
});
for(const [flag,amount] of [['removeAdsAll',120],['automaticBonus',120],['plusPack1Active',30],['removeAdsForced',30]])test(`native automatic challenge reward ${flag} = ${amount}`,()=>{
 const s=win({...plain,[flag]:true});assert.equal(s.diamonds,7+amount);assert.equal(s.challengeSettlement.initialReward,amount);assert.equal(s.challengeSettlement.bonusClaimed,amount===120);const r=req(s);const a=claimChallengeBonus(s,r,response(r));assert.equal(a.status,amount===120?'blocked':'granted');
});
test('real terminal step reaches immediate settlement; does not depend on result button',()=>{
 const s=fight();s.battle.targets=s.battle.targets.map(t=>({...t,health:0,healthValue:BigValue.ZERO}));const terminal=step(s,.01,{},undefined,auto);assert.equal(terminal.mode,'victory');assert.equal(terminal.diamonds,127);assert.equal(terminal.challengeStage,4);
});
test('bonus validates callback identity, adds 90 once, saves ledger, never replays on reload',()=>{
 const before=win(),r=req(before),a=claimChallengeBonus(before,r,response(r));assert.equal(a.status,'granted');assert.equal(a.session.diamonds,127);assert.equal(a.session.challengeStage,4);assert.equal(a.session.challengeSettlement.totalReward,120);assert.deepEqual(a.session.challengeRewardClaims,[r.id]);
 const saved=deserializeSession(serializeSession(a.session)),again=claimChallengeBonus(saved,r,response(r));assert.equal(again.status,'duplicate');assert.equal(again.session,saved);assert.equal(claimVictory(saved).diamonds,127);
});
for(const status of ['failure','cancelled','unavailable'])test(`challenge callback ${status} keeps initial reward, stage and ledger intact`,()=>{const s=win(),r=req(s),a=claimChallengeBonus(s,r,response(r,status));assert.equal(a.status,'blocked');assert.equal(a.session,s);assert.equal(s.diamonds,37);assert.deepEqual(s.challengeRewardClaims,[]);});
test('challenge callback request/purpose/kind/provider/run mismatch rejected; closed/stale result never pays',()=>{
 const s=win(),r=req(s);for(const patch of [{id:'another'},{purpose:'buff:power'},{kind:'purchase'},{provider:'online'},{onlineVerified:true}])assert.equal(claimChallengeBonus(s,r,response(r,'success',patch)).session,s);
 for(const patch of [{id:' '},{runID:'old-run'},{purpose:'other'},{kind:'purchase'}])assert.equal(claimChallengeBonus(s,{...r,...patch},response({...r,...patch})).session,s);
 for(const state of [claimVictory(s),{...s,challengeRunID:'new-run'},{...s,mode:'challenge'}])assert.equal(claimChallengeBonus(state,r,response(r)).session,state);
 assert.equal(sourceChallengeBonusReward(s.challengeSettlement,null,response(r),[]).status,'blocked');
});
test('sweep respects Plus2 gate, strict power boundary, one stage and result return context',()=>{
 const s=powerful();assert.equal(sweepChallenge(s).overlay,'challenge');assert.match(sweepChallenge(s).notice,/Plus2/);
 const swept=sweepChallenge(s,plus);assert.equal(swept.overlay,'challenge-sweep');assert.equal(swept.mode,'field');assert.equal(swept.challengeStage,4);assert.equal(swept.diamonds,37);assert.equal(swept.battle,s.battle);assert.equal(swept.challengeSettlement.kind,'sweep');assert.equal(sweepChallenge(swept,plus),swept);
 const saved=deserializeSession(serializeSession(swept));assert.equal(saved.overlay,'challenge-sweep');const left=closeChallengeSweep(saved);assert.equal(left.overlay,'challenge');assert.equal(left.diamonds,37);assert.equal(left.challengeStage,4);assert.equal(left.challengeSettlement,null);
 const close=closeOverlay(swept);assert.equal(close.overlay,'challenge');assert.equal(close.challengeSettlement,null);assert.equal(closeChallengeSweep(left),left);
 const low=sweepChallenge(entry(),plus);assert.equal(low.challengeStage,3);assert.equal(low.diamonds,7);assert.match(low.notice,/严格大于/);
});
test('sweep ad and automatic rewards use identical immediate/extra ledger; no double reward',()=>{
 const s=sweepChallenge(powerful(),plus),r=req(s),a=claimChallengeBonus(s,r,response(r));assert.equal(a.session.diamonds,127);const closed=closeChallengeSweep(a.session);assert.equal(closed.challengeStage,4);assert.equal(closed.overlay,'challenge');assert.equal(claimChallengeBonus(closed,r,response(r)).status,'blocked');
 const automatic=sweepChallenge(powerful(),auto);assert.equal(automatic.diamonds,127);assert.equal(automatic.challengeSettlement.bonusClaimed,true);assert.equal(claimChallengeBonus(automatic,req(automatic),response(req(automatic))).status,'blocked');
});
test('strict sweep threshold and native multiply/divide/floor efficiency order',()=>{
 for(const stage of [1,3,13,999,5001]){
  const q=challengeQuote(stage).value,required=q.healthByTier[0].nativeMultiply(q.targetCount).nativeMultiply(193).nativeDivide(100).nativeDivide(24).significant(5);assert.ok(sourceChallengeSweepRequiredPower(stage).eq(required));assert.equal(sourceChallengeSweepAble(stage,required),false);assert.equal(sourceChallengeSweepAble(stage,required.nativeMultiply(101).nativeDivide(100)),true);
  for(const fraction of [0,13,99,100,200]){const power=required.nativeMultiply(fraction).nativeDivide(100),ratio=power.nativeMultiply(100).nativeDivide(required);assert.equal(sourceChallengeSweepEfficiency(stage,power),Math.min(100,Math.max(0,Math.floor(Math.fround(ratio.toNumber())))));}
 }
 assert.throws(()=>sourceChallengeSweepRequiredPower(MAX_CHALLENGE_STAGE+1));
});
for(const [type,mul]of [[0,1],[1,7],[2,5],[3,3],[4,5],[5,5],[6,10],[7,1]])test(`native power type ${type} multiplier ${mul}`,()=>{
 assert.equal(sourceChallengeTypeMultiplier(type,3),mul);const expected=BigValue.from(100).nativeMultiply(75).nativeAdd(BigValue.from(250).nativeMultiply(25)).nativeDivide(100).nativeMultiply(mul*100).nativeDivide(60).significant(5);assert.ok(sourceChallengePowerFromCats([cat({type,pelletCount:3})]).eq(expected));
});
test('power rounds critical chance to even, skips inactive/tiny cooldown and truncates float32 cooldown',()=>{
 assert.equal(sourceChallengeTypeMultiplier(3,0),1);assert.ok(sourceChallengePowerFromCats([cat({active:false}),cat({cooldownSeconds:.001})]).eq(0));
 for(const [chance,p]of [[.125,12],[.375,38],[-1,0],[2,100]]){const expected=BigValue.from(100).nativeMultiply(100-p).nativeAdd(BigValue.from(250).nativeMultiply(p)).nativeDivide(100).nativeMultiply(100).nativeDivide(60).significant(5);assert.ok(sourceChallengePowerFromCats([cat({criticalProbability:chance})]).eq(expected));}
 assert.throws(()=>sourceChallengePowerFromCats([cat({cooldownSeconds:NaN})]));
});
test('challenge power uses actual upgrade/permanent/skin/star/buff damage and cooldown; ordinary penalty remains',()=>{
 const s=entry(),base=sessionChallengePower(s);s.battle.upgradeLevels.power=10;s.battle.upgradeLevels.speed=10;assert.ok(sessionChallengePower(s).gt(base));s.permanentLevels.damage=2;s.permanentLevels.speed=2;s.bossSlotLevels=[3,0,0];assert.ok(sessionChallengePower(s).gt(base));
 const g=sourceGun(0);assert.ok(sourceGunDamageStats(g,10).normalDamage.gt(sourceGunDamageStats(g,0).normalDamage));assert.ok(sourceGunCooldown(g,20)<sourceGunCooldown(g,0));assert.ok(sourceGunCooldown(g,20,undefined,30)>sourceGunCooldown(g,20));
 assert.notEqual(createFieldLevel(10,0).sourceStagePenalty,false);assert.equal(startChallenge(s).battle.sourceStagePenalty,false);
});
test('challenge exit and defeat discard run identity and never advance or award; retry generates new ID',()=>{
 const s=fight(),left=exitChallenge(s);assert.equal(left.challengeStage,3);assert.equal(left.diamonds,7);assert.equal(left.challengeRunID,null);const retry=startChallenge(openChallenge(left));assert.notEqual(retry.challengeRunID,s.challengeRunID);assert.ok(retry.challengeRunSequence>s.challengeRunSequence);
 const failed=acknowledgeDefeat({...s,mode:'defeat'});assert.equal(failed.challengeRunID,null);assert.equal(failed.challengeStage,3);assert.equal(failed.diamonds,7);
});
test('old schema migration preserves balance and legacy victory; malformed present state rejected',()=>{
 const old=JSON.parse(serializeSession({...fight(),mode:'victory'}));for(const key of ['challengeSettlement','challengeRunID','challengeRunSequence','challengeRewardClaims'])delete old.session[key];const loaded=deserializeSession(JSON.stringify(old));assert.equal(loaded.diamonds,7);assert.deepEqual(loaded.challengeRewardClaims,[]);assert.equal(claimVictory(loaded).diamonds,37);assert.equal(claimVictory(loaded).challengeStage,4);
 for(const patch of [{challengeSettlement:{}},{challengeRunSequence:null},{challengeRewardClaims:null},{challengeRewardClaims:['x','x']},{challengeStage:3},{challengeRunID:'wrong'}])assert.throws(()=>deserializeSession(serializeSession({...win(),...patch})));
 for(const patch of [{initialReward:120},{completedStage:0},{runID:' '},{totalReward:90},{automaticBonus:true}])assert.throws(()=>validateSourceChallengeSettlement({...sourceChallengeSettlement('challenge:run:1',3,'fight',false),...patch}));
});
test('safe integer overflow does not consume identity or grant wallet; final stage closes without exceeding version cap',()=>{
 assert.throws(()=>startChallenge({...entry(),challengeRunSequence:Number.MAX_SAFE_INTEGER}),RangeError);assert.throws(()=>settleChallengeVictory({...fight(),diamonds:Number.MAX_SAFE_INTEGER}),RangeError);assert.throws(()=>sweepChallenge({...powerful(),diamonds:Number.MAX_SAFE_INTEGER},plus),RangeError);
 const last=startChallenge({...entry(),challengeStage:MAX_CHALLENGE_STAGE});const done=settleChallengeVictory(last);assert.equal(done.challengeStage,MAX_CHALLENGE_STAGE+1);assert.equal(deserializeSession(serializeSession(done)).diamonds,37);assert.equal(startChallenge(openChallenge(claimVictory(done))).mode,'field');
});
test('Plus auto source banner gate is independent from all-ad reward entitlement',()=>{assert.equal(sourceChallengePlusBannerVisible(189,false),false);assert.equal(sourceChallengePlusBannerVisible(190,false),true);assert.equal(sourceChallengePlusBannerVisible(999,true),false);});
test('legacy developer shortcut cannot re-award automatic reward and handles new ledger correctly',()=>{
 const platform={...freshPlatformState(),developerEnabled:true,freeAds:true};const blocked=developerChallengeBonus(win(auto),platform);assert.equal(blocked.status,'blocked');assert.equal(blocked.session.diamonds,127);
 const a=developerChallengeBonus(win(),platform);assert.equal(a.status,'granted');assert.equal(a.session.diamonds,127);assert.equal(a.session.challengeStage,4);assert.equal(a.session.mode,'field');assert.equal(developerChallengeBonus(a.session,a.platform).status,'blocked');
});

test('source reward banners are mutually exclusive, gated by purchased-all and two FreeCash runtime flags',()=>{
 assert.deepEqual(sourceChallengeRewardBanner(false),{purchase:true,freeCash:false});
 for(const featureEnabled of [false,true])for(const exposureTarget of [false,true]){
  const b=sourceChallengeRewardBanner(false,{featureEnabled,exposureTarget});assert.notEqual(b.purchase,b.freeCash);assert.equal(b.freeCash,featureEnabled&&exposureTarget);
  assert.deepEqual(sourceChallengeRewardBanner(true,{featureEnabled,exposureTarget}),{purchase:false,freeCash:false});
 }
});
test('migrated active challenge missing runID consumes a sequence before settlement; next run cannot reuse it',()=>{
 const s={...fight(),challengeRunID:null,challengeRunSequence:4},done=settleChallengeVictory(s);assert.equal(done.challengeRunSequence,5);assert.equal(done.challengeRunID,'challenge:5:3');
 const next=startChallenge(openChallenge(claimVictory(done)));assert.equal(next.challengeRunSequence,6);assert.notEqual(next.challengeRunID,done.challengeRunID);
});

test('source result purchase context accepts defeat, victory and sweep but rejects live fight and closed result',async()=>{
 const {sourceChallengeResultRun}=await import('../r6-challenge');
 for(const [mode,overlay]of [['victory','none'],['defeat','none'],['field','challenge-sweep']])assert.equal(sourceChallengeResultRun(mode,overlay,'challenge:1:3'),'challenge:1:3');
 for(const [mode,overlay,id]of [['challenge','none','challenge:1:3'],['field','challenge','challenge:1:3'],['field','none','challenge:1:3'],['defeat','none',null],['victory','none',undefined]])assert.equal(sourceChallengeResultRun(mode,overlay,id),null);
});
