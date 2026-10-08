import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun,serializeSession,deserializeSession} from '../session';
import {freshSourceGunSafe} from '../r6-gun-storage';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {sourceStarDamage} from '../r6-star';
import {createLocalMineTime} from '../mine-time';
import {raidEntryTypeNow} from '../r5-raid';
import {freshSourceRaid,decodeSourceRaid,sourceRaidSeason,sourceRaidTickets,sourceRaidWeakType,sourceRaidDamage,sourceRaidSlotDamage,sourceRaidCandidates,sourceRaidSorted,sourceRaidAutoSelect,sourceRaidResolve,sourceRaidSelectionRefresh,sourceRaidSelect,sourceRaidEntryGate,sourceRaidEntryPurpose,sourceRaidConsumeFree,sourceRaidEntryReward,SOURCE_RAID_TICKET_PRODUCT} from '../r6-raid';
const monday=new Date(2026,9,5),sunday=new Date(2026,9,4,23,59,59,999);
const gun=(id,uid)=>({...sourceGun(id),uid});
const ready=()=>({...createSession(1),historicMax:390,equippedGuns:[gun(0,'eq0'),gun(30,'eq1'),null],gunInventory:[gun(30,'in0'),gun(5,'in1')],gunSafe:{...freshSourceGunSafe(),guns:[gun(31,'safe0'),gun(64,'safe1'),...Array(14).fill(null)]},bossSlotLevels:[0,2,5]});
const state=()=>sourceRaidTickets(sourceRaidSeason(freshSourceRaid(),monday),createLocalMineTime(()=>monday));
const context={historicMax:390,ready:true,selectedCount:3,pending:false};
const request=(s,type=2,id='raid-r1')=>({id,kind:type===2?'ad':'purchase',purpose:sourceRaidEntryPurpose(type),entryDate:s.entryDate,seasonIndex:s.seasonIndex,entryType:type,contextID:'run1'});
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
test('source ticket product proven by literal; weak type rotation from guns30–34, negative modulo',()=>{
 assert.equal(SOURCE_RAID_TICKET_PRODUCT,'catgunner_raid_ticket');
 assert.deepEqual(Array.from({length:5},(_,i)=>sourceRaidWeakType(i)),[2,4,1,5,6]);
 assert.equal(sourceRaidWeakType(-1),6);assert.equal(sourceRaidWeakType(-5),2);assert.throws(()=>sourceRaidWeakType(1.1));
});
test('raw gun damage x10 only for weakness; no field power/speed/level consumers; stars owned by Raid slot',()=>{
 const s=ready();assert.equal(sourceRaidDamage(30,2).toString(),'240000');assert.equal(sourceRaidDamage(30,4).toString(),'24000');
 for(let i=0;i<3;i++)assert.ok(sourceRaidSlotDamage(s,i,30,2).eq(sourceStarDamage(sourceRaidDamage(30,2),s.bossSlotLevels[i])));
 const boosted={...s,permanentLevels:{power:99,speed:99,money:99},equippedGuns:s.equippedGuns.map(g=>g&&({...g,damage:1e99}))};assert.ok(sourceRaidSlotDamage(s,1,30,2).eq(sourceRaidSlotDamage(boosted,1,30,2)));
 for(const i of [-1,3,0.5])assert.throws(()=>sourceRaidSlotDamage(s,i,30,2));
 for(const i of [-1,65,NaN])assert.throws(()=>sourceRaidDamage(i,2));
});
test('index space pads native16 compact inventory; safe19 stable after draw or merge; auto can see all35',()=>{
 const s=ready(),a=sourceRaidCandidates(s);assert.deepEqual(a.map(g=>g.index),[0,1,3,4,19,20]);
 const changed={...s,gunInventory:[...s.gunInventory,gun(8,'draw')]};assert.equal(sourceRaidCandidates(changed).find(g=>g.uid==='safe0').index,19);
 assert.equal(sourceRaidCandidates({...s,gunInventory:[]}).find(g=>g.uid==='safe1').index,20);
 const auto=sourceRaidAutoSelect(s,2);assert.equal(auto.length,3);assert.ok(auto.some(g=>g.uid==='safe1'));assert.equal(new Set(auto.map(g=>g.uid)).size,3);
});
test('sort descending weakness-adjusted raw damage; same gun tie ascending source index, ignores slot stars',()=>{
 const s=ready(),rows=sourceRaidSorted(s,2);for(let i=1;i<rows.length;i++){const p=rows[i-1],n=rows[i],diff=sourceRaidDamage(p.gunID,2).compare(sourceRaidDamage(n.gunID,2));assert.ok(diff>0||diff===0&&p.index<n.index);}
 const twins=rows.filter(g=>g.gunID===30);assert.deepEqual(twins.map(g=>g.index),[1,3]);assert.deepEqual(sourceRaidSorted({...s,bossSlotLevels:[20,0,0]},2),rows);
});
test('same catalogue ID in two independent items allowed; same UID cannot fill two slots',()=>{
 const s=ready(),a=sourceRaidCandidates(s),first=a.find(g=>g.uid==='eq1'),second=a.find(g=>g.uid==='in0');
 let selected=sourceRaidSelect(s,[null,null,null],0,first).selection;const duplicate=sourceRaidSelect(s,selected,1,first);assert.match(duplicate.reason,/已用于/);
 const next=sourceRaidSelect(s,selected,1,second);assert.equal(next.reason,undefined);assert.deepEqual(next.selection.slice(0,2).map(g=>g.gunID),[30,30]);assert.notEqual(next.selection[0].uid,next.selection[1].uid);
});
test('stale click rejects replaced/moved items, refresh follows UID movement and clears consumed items',()=>{
 const s=ready(),ref=sourceRaidCandidates(s).find(g=>g.uid==='in0'),selected=[ref,null,null];
 const moved={...s,gunInventory:[s.gunInventory[1],s.gunInventory[0]]};assert.match(sourceRaidSelect(moved,selected,1,ref).reason,/变化/);assert.equal(sourceRaidResolve(moved,ref).index,4);
 assert.equal(sourceRaidSelectionRefresh({...s,gunInventory:[s.gunInventory[1]]},selected)[0],null);
 assert.match(sourceRaidSelect(s,selected,3,ref).reason,/无效/);assert.equal(sourceRaidResolve(s,null),null);
});
test('daily permission3 and date gain ledger precede resetting2/freeAD/IAP; backward clock no gifts',()=>{
 let s=state();assert.equal(sourceRaidTickets(s,createLocalMineTime(()=>monday)),s);
 s={...s,freeUseCount:2,adUsed:true,iapUsed:true};let calls=[];const t={today:()=> 'h5-local:2026-10-06',canRolloverDaily:(...args)=>{calls.push(args);return null;},evidence:'fixture'};
 assert.equal(sourceRaidTickets(s,t),s);assert.deepEqual(calls[0],[3,'h5-local:2026-10-05','h5-local:2026-10-06']);
 assert.equal(sourceRaidTickets(s,{...t,canRolloverDaily:()=>false}),s);
 const next=sourceRaidTickets(s,{...t,canRolloverDaily:()=>true});assert.equal(next.freeUseCount,0);assert.equal(next.adUsed,false);assert.equal(next.iapUsed,false);assert.equal(next.dailyGainDates.length,2);
 assert.equal(sourceRaidTickets(next,createLocalMineTime(()=>monday)),next);assert.throws(()=>sourceRaidTickets(s,{...t,today:()=> 'h5-local:2026-02-30'}));
});
test('week crossing resets season tries/best only; type records/helper/daily rights/claims survive',()=>{
 const old={...sourceRaidSeason(freshSourceRaid(),sunday),tryCount:99,bestLevel:42,bestByType:[1,2,3,4,5,6,7],helperSeasonIndex:12,freeUseCount:2,adUsed:true,entryClaims:['old']};
 const next=sourceRaidSeason(old,monday);assert.equal(next.seasonIndex,old.seasonIndex+1);assert.equal(next.tryCount,0);assert.equal(next.bestLevel,0);assert.deepEqual(next.bestByType,old.bestByType);assert.equal(next.helperSeasonIndex,12);assert.equal(next.adUsed,true);assert.deepEqual(next.entryClaims,['old']);assert.equal(sourceRaidSeason(next,monday),next);
});
test('entry sequencing free2 -> ad15 -> purchasedticket -> exhausted; unready never debits any branch',()=>{
 let s=state();for(let i=0;i<2;i++){assert.equal(raidEntryTypeNow(s),1);s=sourceRaidConsumeFree(s,context).state;}assert.equal(raidEntryTypeNow(s),2);
 let r=request(s),x=sourceRaidEntryReward(s,r,response(r),context,'run1');assert.equal(x.status,'granted');s=x.state;assert.equal(raidEntryTypeNow(s),3);
 r=request(s,3,'iap1');x=sourceRaidEntryReward(s,r,response(r),context,'run1');assert.equal(x.status,'granted');s=x.state;assert.equal(raidEntryTypeNow(s),0);assert.match(sourceRaidEntryGate(s,context),/用完/);
 for(const branch of [state(),{...state(),freeUseCount:2},{...state(),freeUseCount:2,adUsed:true}]){const c={...context,ready:false};assert.match(sourceRaidEntryGate(branch,c),/未扣次数/);assert.equal(sourceRaidConsumeFree(branch,c).state,branch);if(raidEntryTypeNow(branch)!==1){const rr=request(branch,raidEntryTypeNow(branch));assert.equal(sourceRaidEntryReward(branch,rr,response(rr),c,'run1').state,branch);}}
});
test('denials specific progress/pending/empty never consume free ticket',()=>{
 for(const [c,text] of [[{...context,historicMax:389},'40'],[{...context,pending:true},'等待'],[{...context,selectedCount:0},'至少']]){const s=state();assert.ok(sourceRaidConsumeFree(s,c).reason.includes(text));assert.equal(sourceRaidConsumeFree(s,c).state,s);}
});
for(const status of ['failure','cancelled','unavailable'])test(`provider ${status} never marks used or claims`,()=>{const s={...state(),freeUseCount:2},r=request(s);assert.equal(sourceRaidEntryReward(s,r,response(r,status),context,'run1').state,s);});
for(const patch of [{id:'other'},{purpose:'guessed-product'},{kind:'purchase'},{provider:'online'},{onlineVerified:true}])test(`callback identity ${JSON.stringify(patch)} rejected`,()=>{const s={...state(),freeUseCount:2},r=request(s);assert.equal(sourceRaidEntryReward(s,r,{...response(r),...patch},context,'run1').state,s);});
test('pending callback day/week/context/branch changed never consumes; repeated receipt across codec idempotent',()=>{
 const s={...state(),freeUseCount:2},r=request(s);for(const mutated of [{...s,entryDate:'h5-local:2026-10-06'},{...s,seasonIndex:s.seasonIndex+1},{...s,adUsed:true}])assert.equal(sourceRaidEntryReward(mutated,r,response(r),context,'run1').state,mutated);
 assert.equal(sourceRaidEntryReward(s,r,response(r),context,'run2').state,s);
 const won=decodeSourceRaid(JSON.parse(JSON.stringify(sourceRaidEntryReward(s,r,response(r),context,'run1').state)));
 assert.equal(sourceRaidEntryReward(won,r,response(r),context,'run1').status,'duplicate');
 const bad={...r,purpose:'bad'};assert.equal(sourceRaidEntryReward(won,bad,response(bad),context,'run1').status,'blocked');
});
test('old meta migration keeps wallets/entities/permanent rights, no raid gifts/unlock; malformed present rejected',()=>{
 let m=freshSourceMetaState();m.petCoin=187;m.entitlements.plusPack2Active=true;const raw=JSON.parse(serializeSourceMetaState(m));delete raw.raid;const old=decodeSourceMetaState(JSON.stringify(raw));assert.deepEqual(old.raid,freshSourceRaid());assert.equal(old.petCoin,187);assert.equal(old.entitlements.plusPack2Active,true);
 m={...old,raid:{...state(),freeUseCount:1,entryClaims:['r1'],bestByType:[1,0,0,0,5,0,0]}};assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(m)).raid,m.raid);
 for(const raid of [null,{},undefined,{...freshSourceRaid(),freeUseCount:-1},{...freshSourceRaid(),adUsed:1},{...freshSourceRaid(),seasonIndex:0.5},{...freshSourceRaid(),bestByType:[0]},{...freshSourceRaid(),entryDate:'h5-local:2026-02-30'},{...freshSourceRaid(),dailyGainDates:['x']},{...freshSourceRaid(),entryClaims:['x','x']}]){if(raid===undefined){assert.throws(()=>decodeSourceRaid(raid));continue;}assert.throws(()=>decodeSourceMetaState(JSON.stringify({...raw,raid})));}
 const s=ready(),restored=deserializeSession(serializeSession(s));assert.equal(restored.diamonds,s.diamonds);assert.deepEqual(restored.bossSlotLevels,s.bossSlotLevels);assert.equal(restored.gunSafe.guns[0].uid,'safe0');
});
