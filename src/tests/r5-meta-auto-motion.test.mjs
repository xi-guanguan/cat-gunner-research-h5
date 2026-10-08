import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceAutoUpgradeState,decodeSourceAutoUpgradeState,sourceAutoUpgradeEnabled,sourceAutoUpgradeAdReward,sourceTickAutoUpgradeTime} from '../r5-auto.ts';
import {sourceInitFishMotion,sourceFindFishSpawnPosition,sourceTickFishMotion,sourceClampFishToTank,sourceFishFacesRight} from '../r5-fish-motion.ts';
import {sourceFishFindAutoMergePair,sourceFishAutoMergeOnce,freshSourceFishState} from '../r5-fish.ts';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,developerSourceAutoUpgradeAd,runtimeSourceAutoUpgrade,runtimeSourceAutoUpgradeSet,runtimeSourceFishAutoMergeOnce} from '../source-meta-runtime.ts';
import {createSession,createFieldLevel} from '../session.ts';import {createActivityState} from '../source-activities.ts';import {freshPlatformState} from '../local-platform.ts';
const today='h5-local:2026-10-01',time={today:()=>today,canRolloverDaily:()=>true,evidence:'test clock'};
const bundle=()=>({session:{...createSession(19),overlay:'none',battle:createFieldLevel(0,0,150,undefined,19)},activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true},meta:freshSourceMetaState()});
const item={width:100,height:80,scaleX:1,scaleY:1},tank={width:1000,height:800};
function scripted(values=[],ranges=[]){const calls=[];return {calls,value:()=>{calls.push('value');return values.shift()??.8;},range:(min,max)=>{calls.push([min,max]);return ranges.shift()??(min+max)/2;}};}
test('auto state absence migrates, defaults on, explicit invalid envelopes reject',()=>{
 const s=freshSourceAutoUpgradeState();assert.equal(s.requested,true);assert.equal(sourceAutoUpgradeEnabled(s,false),false);assert.equal(sourceAutoUpgradeEnabled(s,true),true);
 const old=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));delete old.autoUpgrade;assert.deepEqual(decodeSourceMetaState(JSON.stringify(old)).autoUpgrade,s);
 for(const bad of [null,{...s,requested:1},{...s,adRemainingSec:601},{...s,adRemainingSec:1},{...s,lastAdDate:'h5-local:2026-02-30'}])assert.throws(()=>decodeSourceAutoUpgradeState(bad));
});
test('auto ad once/day replaces600 independent switch; tick .5cap, off still consumes, permanent/ad freeze',()=>{
 const s={...freshSourceAutoUpgradeState(),requested:false};assert.equal(sourceAutoUpgradeAdReward(s,false,today,false).status,'blocked');assert.equal(sourceAutoUpgradeAdReward(s,false,null,true).status,'unsupported');assert.equal(sourceAutoUpgradeAdReward(s,true,today,true).status,'blocked');
 const r=sourceAutoUpgradeAdReward(s,false,today,true).value;assert.equal(r.adRemainingSec,600);assert.equal(r.requested,false);assert.equal(sourceAutoUpgradeAdReward(r,false,'h5-local:2026-10-02',true).reason,'auto-upgrade-ad-active');
 assert.equal(sourceTickAutoUpgradeTime(r,20).adRemainingSec,599.5);assert.equal(sourceTickAutoUpgradeTime(r,.25).adRemainingSec,599.75);assert.equal(sourceTickAutoUpgradeTime(r,1,true),r);assert.equal(sourceTickAutoUpgradeTime(r,1,false,true),r);
 const expired=sourceTickAutoUpgradeTime({...r,adRemainingSec:.25},.5);assert.equal(expired.adRemainingSec,0);assert.equal(sourceAutoUpgradeAdReward(expired,false,today,true).reason,'auto-upgrade-ad-watched-today');assert.equal(sourceAutoUpgradeAdReward(expired,false,'h5-local:2026-10-02',true).value.adRemainingSec,600);
});
test('auto ad runtime atomically grants timer audit and allowed upgrades; off/disabled provider never buys',()=>{
 const b=bundle(),blocked=developerSourceAutoUpgradeAd({...b,platform:{...b.platform,developerEnabled:false}},time);assert.equal(blocked.status,'blocked');assert.equal(blocked.session,b.session);
 const r=developerSourceAutoUpgradeAd(b,time);assert.equal(r.meta.autoUpgrade.adRemainingSec,600);assert.equal(r.platform.audit.at(-1).kind,'ad');assert.equal(r.session.events.length,3);assert.equal(developerSourceAutoUpgradeAd(r,time).status,'blocked');assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(r.meta)),r.meta);
 const off=runtimeSourceAutoUpgradeSet(b,false),ad=developerSourceAutoUpgradeAd(off,time);assert.equal(ad.session.battle,b.session.battle);assert.equal(runtimeSourceAutoUpgrade(ad).session.events.length,0);
});
test('fish native initialization and timer expiry preserve distinct random order',()=>{
 const random=scripted([.5],[20,.3,4]);const s=sourceInitFishMotion(random);assert.deepEqual(random.calls,[[15,35],'value',[Math.fround(-.3),Math.fround(.3)],[2,5]]);assert.equal(sourceFishFacesRight(s),false);assert.ok(Math.abs(s.direction.x**2+s.direction.y**2-1)<1e-6);
 const renewed=scripted([.8],[0,3,30]);const next=sourceTickFishMotion({...s,directionTimer:.1},.2,tank,item,renewed);assert.deepEqual(renewed.calls,['value',[Math.fround(-.3),Math.fround(.3)],[2,5],[15,35]]);assert.equal(next.directionTimer,3);assert.equal(next.speed,30);assert.equal(sourceFishFacesRight(next),true);
 for(const flag of ['dragging','autoMerging']){const frozen={...s,[flag]:true};assert.equal(sourceTickFishMotion(frozen,1,tank,item,random),frozen);}
});
test('fish spawn consumes fallback before accepting distance100; exhausted trials choose greatest strict distance',()=>{
 const random=scripted([],[-400,-300,100,0]);assert.deepEqual(sourceFindFishSpawnPosition(tank,item,[{x:0,y:0}],random,100,30),{x:100,y:0});assert.equal(random.calls.length,4);
 const exhausted=scripted([],[450,0,10,0,50,0,-50,0]);assert.deepEqual(sourceFindFishSpawnPosition(tank,item,[{x:0,y:0}],exhausted,100,3),{x:50,y:0});assert.equal(exhausted.calls.length,8);
 const empty=scripted([],[-400,0,200,100]);assert.deepEqual(sourceFindFishSpawnPosition(tank,item,[],empty),{x:200,y:100});assert.equal(empty.calls.length,4);
});
test('fish bounds account outer size, oversized axis centers, native clamp uses scaleX on both axes and bounces',()=>{
 assert.deepEqual(sourceClampFishToTank({x:1000,y:1000},tank,{...item,scaleX:2,scaleY:3}),{x:400,y:320});assert.deepEqual(sourceClampFishToTank({x:10,y:10},{width:50,height:50},item),{x:0,y:0});
 const s={...sourceInitFishMotion(scripted()),position:{x:449,y:0},direction:{x:1,y:0},speed:20,directionTimer:4};const n=sourceTickFishMotion(s,.2,tank,item,scripted());assert.equal(n.position.x,450);assert.equal(n.direction.x,-1);assert.equal(n.directionTimer,Math.fround(3.8));
});
const candidate=(inventoryIndex,grade,extra={})=>({inventoryIndex,grade,active:true,dragging:false,autoMerging:false,pendingDelete:false,currentAlertTarget:false,...extra});
test('auto fish pair honors grade-first then pool order and eligibility; commits only one pair atomically',()=>{
 const fish={...freshSourceFishState(),inventory:[2,0,0,2,0],autoMergeRequested:true},pool=[candidate(0,2),candidate(3,2),candidate(4,0),candidate(1,0),candidate(2,0)];assert.deepEqual(sourceFishFindAutoMergePair(fish,true,pool),{stationary:4,mover:1});
 assert.equal(sourceFishFindAutoMergePair(fish,false,pool),null);assert.equal(sourceFishFindAutoMergePair({...fish,autoMergeRequested:false},true,pool),null);
 const pair=sourceFishFindAutoMergePair(fish,true,pool.map(p=>p.inventoryIndex===4?{...p,dragging:true}:p));assert.deepEqual(pair,{stationary:1,mover:2});
 const r=sourceFishAutoMergeOnce(fish,true,pool);assert.deepEqual(r.value.fish.inventory,[2,0,2,1]);assert.deepEqual(fish.inventory,[2,0,0,2,0]);
 const b=bundle();b.meta.fish=fish;b.meta.entitlements.plusPack2Active=true;const tx=runtimeSourceFishAutoMergeOnce(b,pool);assert.equal(tx.status,'granted');assert.deepEqual(tx.meta.fish.inventory,r.value.fish.inventory);
});

test('local auto ad adapter rejects replay receipts and backwards dates without mutating state',()=>{
 const b=bundle(),today=time.today(),receipt=`meta:auto-upgrade-ad:${today}`;
 const replay={...b,platform:{...b.platform,claims:[receipt]}};assert.equal(developerSourceAutoUpgradeAd(replay,time).status,'blocked');
 const future={...b,meta:{...b.meta,autoUpgrade:{requested:true,lastAdDate:'h5-local:2026-10-03',adRemainingSec:0}}};
 const r=developerSourceAutoUpgradeAd(future,time);assert.equal(r.status,'blocked');assert.equal(r.meta,future.meta);assert.equal(r.platform,future.platform);
});
