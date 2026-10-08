import test from 'node:test';import assert from 'node:assert/strict';
import {sourceMineSpeedEntryGate,sourceMineSpeedEntryReward,sourceMinePlusBannerVisible} from '../r6-mine-entry.ts';
import {createSession,openMine,serializeSession,deserializeSession,sweepBoss,sourceGun,step,startMine,settleChallengeVictory} from '../session.ts';
import {freshSourceEntitlements,sourceRewardEntitlements} from '../r5-entitlements.ts';
import {freshSourceBuffTimes} from '../r6-buff.ts';
import {freshSourceMetaState,runtimeSourceHuntAction,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime.ts';
import {freshPlatformState} from '../local-platform.ts';import {createActivityState} from '../source-activities.ts';
const time={today:()=> '2026-10-02',canRolloverDaily:()=>true,evidence:'isolated fixed clock'};
const req={id:'mine-speed:1',purpose:'buff:speed',kind:'ad'},response=(patch={})=>({...req,status:'success',provider:'local-test',onlineVerified:false,...patch});
function fixture(){const session=openMine({...createSession(),historicMax:190,overlay:'none'});session.mine.tickets={used:0,storedDate:time.today()};return {session,reward:{times:freshSourceBuffTimes(),claimedRequestIDs:[]}};}
test('source mine speed ad commits buff, one ticket and real battle together; duplicate never grants twice',()=>{
 const before=fixture(),e=freshSourceEntitlements(),r=sourceMineSpeedEntryReward(before,e,req,response(),time);
 assert.equal(r.status,'granted');assert.equal(r.state.session.mode,'mine');assert.equal(r.state.session.mine.tickets.used,1);assert.ok(r.state.session.mine.run);assert.equal(r.state.reward.times.speed,300);assert.equal(before.session.mine.tickets.used,0);
 const dup=sourceMineSpeedEntryReward(r.state,e,req,response(),time);assert.equal(dup.status,'duplicate');assert.equal(dup.state,r.state);
 const saved=deserializeSession(serializeSession(r.state.session));assert.equal(saved.mine.tickets.used,1);
 const meta={...freshSourceMetaState(),buffTimes:r.state.reward.times,buffRewardClaims:r.state.reward.claimedRequestIDs};const restored=decodeSourceMetaState(serializeSourceMetaState(meta));assert.equal(restored.buffTimes.speed,300);assert.deepEqual(restored.buffRewardClaims,[req.id]);
});
for(const status of ['failure','cancelled','unavailable'])test(`mine speed ${status}: no buff, ticket, claims or world commit`,()=>{const before=fixture(),r=sourceMineSpeedEntryReward(before,freshSourceEntitlements(),req,response({status}),time);assert.equal(r.status,'blocked');assert.equal(r.state,before);});
test('mine speed validates request identity and rechecks tickets/context/date at callback',()=>{
 const e=freshSourceEntitlements(),before=fixture();
 for(const patch of [{id:'wrong'},{purpose:'buff:power'},{kind:'purchase'},{provider:'online'},{onlineVerified:true}])assert.equal(sourceMineSpeedEntryReward(before,e,req,response(patch),time).state,before);
 for(const mutate of [s=>s.session.mine.tickets.used=2,s=>s.session.overlay='none',s=>s.session.historicMax=0,s=>s.reward.times.speed=300]){const b=fixture();mutate(b);assert.equal(sourceMineSpeedEntryReward(b,e,req,response(),time).state,b);}
 const unknownDate=fixture();unknownDate.session.mine.tickets.storedDate='2026-10-01';assert.equal(sourceMineSpeedEntryReward(unknownDate,e,req,response(),{...time,canRolloverDaily:()=>null}).state,unknownDate);
 const six=fixture();six.session.mine.tickets.used=5;assert.equal(sourceMineSpeedEntryReward(six,{...e,minePack:true},req,response(),time).state.session.mine.tickets.used,6);
 assert.match(sourceMineSpeedEntryGate(before.session,{...e,buffPack:true},before.reward.times,time),/已生效/);
});
test('mine reward Plus banner: owns MinePack, stage >189, reward entitlement inactive; forced/all ads irrelevant',()=>{
 const e=freshSourceEntitlements();assert.equal(sourceMinePlusBannerVisible(190,e),false);e.minePack=true;assert.equal(sourceMinePlusBannerVisible(189,e),false);assert.equal(sourceMinePlusBannerVisible(190,e),true);e.plusPack1Active=true;assert.equal(sourceMinePlusBannerVisible(999,e),false);
});
test('all-ad reward projection is derived only, and real Boss sweep and Hunt sweep consumers pay automatically',()=>{
 const e={...freshSourceEntitlements(),plusPack2Active:true,removeAdsAll:true};assert.equal(e.automaticBonus,false);assert.equal(sourceRewardEntitlements(e).automaticBonus,true);assert.equal(sourceRewardEntitlements({...e,removeAdsAll:false,removeAdsForced:true}).automaticBonus,false);
 const s={...createSession(),mode:'field',overlay:'none',historicMax:190,equippedGuns:[sourceGun(25),sourceGun(25),sourceGun(25)]};
 const plain=sweepBoss(s,{...e,removeAdsAll:false}),all=sweepBoss(s,e);assert.equal(all.mode,'boss-result');assert.equal(all.diamonds-s.diamonds,(plain.diamonds-s.diamonds)*3);assert.equal(e.automaticBonus,false);
 const b={session:s,activities:createActivityState(),platform:freshPlatformState(),meta:{...freshSourceMetaState(),entitlements:e}};
 const normal=runtimeSourceHuntAction({...b,meta:{...b.meta,entitlements:{...e,removeAdsAll:false}}},'sweep'),auto=runtimeSourceHuntAction(b,'sweep');assert.equal(auto.status,'granted');assert.equal(auto.meta.petCoin,normal.meta.petCoin*2);assert.equal(auto.meta.hunt.run.automaticBonus,true);
});
test('all-ad mine battle settlement uses the same real 4x automatic consumer as sweep',()=>{
 const run=(all)=>{const e={...freshSourceEntitlements(),removeAdsAll:all},s=startMine(fixture().session,time,false,e);s.mine.run.score=300;s.mine.run.elapsed=59.99;s.battle.elapsed=59.99;return step(s,.02,{},undefined,e);};
 const one=run(false),four=run(true);assert.equal(four.diamonds-one.diamonds,one.mine.settlement.initialReward*3);assert.equal(four.mine.settlement.initialReward,one.mine.settlement.initialReward*4);
});

for(const right of ['adRemoved','removeAdsAll'])test(`${right}: real Challenge, Boss and Hunt settlement consumers and repeat guards`,()=>{
 const e={...freshSourceEntitlements(),plusPack2Active:true,[right]:true},base={...e,[right]:false};
 const s={...createSession(),mode:'field',overlay:'none',historicMax:190,equippedGuns:[sourceGun(25),sourceGun(25),sourceGun(25)]};
 const challenge={...s,mode:'challenge',challengeStage:1,challengeRunID:'challenge:freecash-consumer'};
 const one=settleChallengeVictory(challenge,base),auto=settleChallengeVictory(challenge,e);
 assert.equal(auto.diamonds-s.diamonds,(one.diamonds-s.diamonds)*4);assert.equal(settleChallengeVictory(auto,e),auto);
 const bossOne=sweepBoss(s,base),bossAuto=sweepBoss(s,e);assert.equal(bossAuto.mode,'boss-result');assert.equal(bossAuto.diamonds-s.diamonds,(bossOne.diamonds-s.diamonds)*3);assert.equal(sweepBoss(bossAuto,e).diamonds,bossAuto.diamonds);
 const b={session:s,activities:createActivityState(),platform:freshPlatformState(),meta:{...freshSourceMetaState(),entitlements:e}};
 const normal=runtimeSourceHuntAction({...b,meta:{...b.meta,entitlements:base}},'sweep'),hunt=runtimeSourceHuntAction(b,'sweep');
 assert.equal(hunt.status,'granted');assert.equal(hunt.meta.petCoin,normal.meta.petCoin*2);assert.equal(hunt.meta.hunt.run.automaticBonus,true);
 assert.equal(runtimeSourceHuntAction(hunt,'sweep').meta.petCoin,hunt.meta.petCoin);assert.equal(e.automaticBonus,false);
});
test('FreeCash reward entitlement consumed by live Mine timeout settlement, not just sweep UI',()=>{
 const run=adRemoved=>{const e={...freshSourceEntitlements(),adRemoved},s=startMine(fixture().session,time,false,e);s.mine.run.score=300;s.mine.run.elapsed=59.99;s.battle.elapsed=59.99;return step(s,.02,{},undefined,e);};
 const one=run(false),auto=run(true);assert.equal(auto.mode,'mine-result');assert.equal(auto.mine.settlement.initialReward,one.mine.settlement.initialReward*4);assert.equal(auto.diamonds-one.diamonds,one.mine.settlement.initialReward*3);
 assert.equal(step(auto,.02,{},undefined,{...freshSourceEntitlements(),adRemoved:true}).diamonds,auto.diamonds);
});
