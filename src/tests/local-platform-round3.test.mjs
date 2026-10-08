import test from 'node:test';
import assert from 'node:assert/strict';
import { freshPlatformState,decodePlatformState,localPurchaseSimulationEnabled,confirmedDeveloperGrant,developerResource,developerChallengeBonus,developerMineBonus,developerShopPurchase } from '../local-platform.ts';
import { createSession,openChallenge,startChallenge,serializeSession,deserializeSession } from '../session.ts';
import { mineSettlement } from '../meta-progression.ts';
const ready=()=>({...freshPlatformState(),developerEnabled:true});
test('normal provider cannot grant a pretend purchase or ad',()=>{
 const s=createSession(2),p=freshPlatformState();for(const kind of ['purchase','ad']){const r=confirmedDeveloperGrant(s,p,'a',kind,100);assert.equal(r.status,'unavailable');assert.equal(r.session,s);assert.equal(r.platform,p);}
});
test('confirmed developer purchase is exact, audited, persistent and idempotent',()=>{
 let r=confirmedDeveloperGrant(createSession(2),ready(),'pack:1','purchase',100);assert.equal(r.session.diamonds,100);assert.equal(r.platform.audit[0].kind,'purchase');
 assert.equal(decodePlatformState(JSON.stringify(r.platform)).claims[0],'pack:1');
 const duplicate=confirmedDeveloperGrant(r.session,r.platform,'pack:1','purchase',100);assert.equal(duplicate.status,'duplicate');assert.equal(duplicate.session.diamonds,100);
 assert.throws(()=>confirmedDeveloperGrant(r.session,r.platform,'overflow','ad',Number.MAX_SAFE_INTEGER));
});
test('test wallet and content gates do not replace combat progress',()=>{
 const s=createSession(2);let r=developerResource(s,ready(),'unlock');assert.equal(r.session.historicMax,30);assert.equal(r.session.battle,s.battle);assert.equal(r.session.gunUnlocked,true);
 r=developerResource(r.session,r.platform,'diamonds');assert.equal(r.session.diamonds,1000);
 r=developerResource(r.session,r.platform,'coins');assert.equal(r.session.battle.coinsValue.toNumber(),1000000);
 assert.equal(deserializeSession(serializeSession(r.session)).diamonds,1000);
 const blocked=developerResource({...s,mode:'challenge'},ready(),'diamonds');assert.equal(blocked.status,'blocked');
});
test('challenge 4x claims exactly once and advances stage',()=>{
 let s=createSession(2);s.overlay='none';s=startChallenge(openChallenge(s));s.mode='victory';
 const r=developerChallengeBonus(s,ready());assert.equal(r.session.diamonds,120);assert.equal(r.session.challengeStage,2);
 assert.equal(developerChallengeBonus(r.session,r.platform).status,'blocked');
});
test('mine ad uses native extra3x and cannot double claim',()=>{
 const s=createSession(2);s.mode='mine-result';s.mine.settlement=mineSettlement({diaScore:90,bestReward:0}).value;
 const r=developerMineBonus(s,ready());assert.equal(r.session.diamonds,27);assert.equal(r.session.mine.settlement.totalReward,36);
 assert.equal(developerMineBonus(r.session,r.platform).status,'duplicate');
});

test('source shop five packs double only the first purchase, replay cannot pay again',()=>{
 for(const [i,amount] of [240,600,1500,3500,8000].entries()) {
  const initial=createSession(2),id=`dia-${i}`;
  assert.equal(developerShopPurchase(initial,freshPlatformState(),id,'0').status,'unavailable');
  let r=developerShopPurchase(initial,ready(),id,'0');assert.equal(r.session.diamonds,amount*2);
  assert.equal(developerShopPurchase(r.session,r.platform,id,'0').status,'duplicate');
  r=developerShopPurchase(r.session,r.platform,id,'1');assert.equal(r.session.diamonds,amount*3);
  assert.equal(developerShopPurchase(r.session,{...r.platform,freePurchases:false},id,'2').status,'unavailable');
 }
});

test('Pages free IAP preview does not enable developer grants and respects existing opt-out',()=>{
 const fresh=freshPlatformState();assert.equal(localPurchaseSimulationEnabled(fresh,false),false);
 assert.equal(localPurchaseSimulationEnabled(fresh,true),true);
 assert.equal(confirmedDeveloperGrant(createSession(2),fresh,'preview:no-dev','ad',1).status,'unavailable');
 assert.equal(confirmedDeveloperGrant(createSession(2),fresh,'preview:no-dev','purchase',1).status,'unavailable');
 const optedOut=decodePlatformState(JSON.stringify({...fresh,freePurchases:false}));
 assert.equal(localPurchaseSimulationEnabled(optedOut,true),false);
 assert.equal(localPurchaseSimulationEnabled({...fresh,developerEnabled:true},false),true);
});
