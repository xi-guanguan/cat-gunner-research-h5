import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSourceAdventureState,sourceAdventureLocalClock,encodeSourceAdventureState,decodeSourceAdventureState,sourceAdventureStart,sourceAdventureClaim,sourceAdventureCancel,sourceAdventureForceFinish,sourceAdventureGrades,sourceAdventureAutoSelect,sourceAdventureAdAble,sourceAdventureAdReward,sourceAdventureDayCheck,sourceAdventureRemaining,sourceAdventureMapStatus} from '../r6-adventure';
import {adventureRefreshTickets,ADVENTURE_TICKET_INTERVAL_TICKS,adventureRewardCore,adventureRewardExp} from '../r5-adventure';
import {freshSourcePetState,sourcePetWithIdentities,sourcePetEquip,sourcePetUnequip,sourcePetMerge} from '../r5-pet';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState,runtimeSourceAdventure} from '../source-meta-runtime';
import {createSession} from '../session';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {createLocalRewardProvider} from '../r6-reward-provider';
const hour=36_000_000_000n,second=10_000_000n;
const clock=()=>sourceAdventureLocalClock(new Date(2026,9,4,12,0,0));
const pets=()=>{const p=freshSourcePetState();p.owned=[0,1,2,3,4,5,...Array(10).fill(-1)];p.collect[5]=true;return sourcePetWithIdentities(p);};
const refs=(p,indices=[0])=>indices.map(index=>({source:'owned',index,uid:p.ownedIDs[index]}));
const started=(index=0,level=0,indices=[0])=>{const p=pets();return sourceAdventureStart({...freshSourceAdventureState(),level},p,0,index,refs(p,indices),clock());};
const pending=r=>({id:'adventure:test:1',purpose:'adventure:13:0:0',kind:'ad',type:0,index:0,enteredTicks:r.state.maps[0][0].enteredTicks});
test('adventure save codec roundtrip, old meta migrates no grant, malformed ticks/currency rejected',()=>{
 const m=freshSourceMetaState(),raw=JSON.parse(serializeSourceMetaState(m));delete raw.adventure;const restored=decodeSourceMetaState(JSON.stringify(raw));assert.deepEqual(restored.adventure,freshSourceAdventureState());assert.equal(restored.petCoin,0);
 const run=started();m.adventure=run.state;m.pet=run.pet;assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(m)),m);
 assert.deepEqual(decodeSourceAdventureState(encodeSourceAdventureState(run.state)),run.state);
 for(const change of [s=>s.maps[0][0].enteredTicks='-1',s=>s.maps[0][0].enteredTicks='1.5',s=>s.maps[0][0].enteredTicks='01',s=>s.cores[0]=-1,s=>s.tickets=21,s=>s.adUseCount=3,s=>s.rewardClaims=['x','x']]){const bad=encodeSourceAdventureState(run.state);change(bad);assert.throws(()=>decodeSourceAdventureState(bad));}
});
test('explicit local civil clock keeps Sunday=0 and yyyyMMdd; no implicit trusted-server claim',()=>{
 assert.equal(clock().dayOfWeek,0);assert.equal(clock().dayKey,'20261004');assert.equal(clock().adapter,'h5-local-calendar');assert.equal(sourceAdventureLocalClock(new Date(2026,9,4,13,0,0)).nowTicks-clock().nowTicks,hour);assert.throws(()=>sourceAdventureLocalClock(new Date(NaN)));
});
test('ticket refresh exact four-hour boundary, cap, remainder, backward clock and first cap use',()=>{
 const now=clock().nowTicks,s=started().state;assert.equal(s.tickets,19);assert.equal(s.lastChargeTicks,now);
 assert.equal(adventureRefreshTickets(s,now+ADVENTURE_TICKET_INTERVAL_TICKS-1n).tickets,19);
 assert.equal(adventureRefreshTickets(s,now+ADVENTURE_TICKET_INTERVAL_TICKS).tickets,20);
 const empty={tickets:0,lastChargeTicks:now};assert.deepEqual(adventureRefreshTickets(empty,now+9n*hour),{tickets:2,lastChargeTicks:now+8n*hour});assert.deepEqual(adventureRefreshTickets(empty,now-hour),empty);assert.equal(adventureRefreshTickets(empty,now+100n*hour).tickets,20);
});
test('dispatch pays requested count BEFORE level/entered/lock/stale filtering; zero valid not refunded',()=>{
 const p=pets(),s=freshSourceAdventureState();let r=sourceAdventureStart(s,p,0,1,refs(p),clock());assert.equal(r.status,'blocked');assert.equal(r.state.tickets,19);
 r=sourceAdventureStart(s,p,0,0,[{...refs(p)[0],uid:'pet:wrong'}],clock());assert.equal(r.status,'blocked');assert.equal(r.state.tickets,19);assert.equal(r.state.maps[0][0].entered,false);
 r=sourceAdventureStart(s,p,0,0,[...refs(p),...refs(p)],clock());assert.equal(r.state.tickets,18);assert.deepEqual(sourceAdventureGrades(r.pet,0,0),[0]);
 const again=sourceAdventureStart(r.state,r.pet,0,0,refs(r.pet,[1]),clock());assert.equal(again.status,'blocked');assert.equal(again.state.tickets,17);
 assert.equal(sourceAdventureStart(s,p,0,0,[],clock()).state.tickets,20);
});
test('dispatch groups follow equipment swaps; merging locked pets blocked and actual grades drive reward',()=>{
 let r=started();const uid=r.pet.ownedIDs[0];r.pet=sourcePetEquip(r.pet,0,0).value;assert.equal(r.pet.selectedIDs[0],uid);assert.deepEqual(sourceAdventureGrades(r.pet,0,0),[0]);
 r.pet=sourcePetUnequip(r.pet,0).value;assert.equal(sourcePetMerge(r.pet,0,1).status,'blocked');r=sourceAdventureForceFinish(r.state,r.pet,0,0,clock(),false);const claim=sourceAdventureClaim(r.state,r.pet,0,0,clock(),false);assert.equal(claim.pet.ownedLocks[0],-1);assert.equal(claim.state.cores[0],20);
});
test('all three regions/five maps obey level and duration; auto-select respects source slot levels',()=>{
 const p=pets(),s={...freshSourceAdventureState(),level:15};for(let type=0;type<3;type++)for(let index=0;index<5;index++){const run=sourceAdventureStart(s,p,type,index,refs(p),clock());assert.equal(run.status,'granted');assert.equal(sourceAdventureMapStatus(run.state,type,index,clock().nowTicks,false),'running');assert.equal(sourceAdventureGrades(run.pet,type,index).length,1);}
 assert.equal(sourceAdventureAutoSelect(freshSourceAdventureState(),p).length,1);assert.equal(sourceAdventureAutoSelect({...s,level:2},p).length,2);assert.equal(sourceAdventureAutoSelect({...s,level:7},p).length,3);assert.deepEqual(sourceAdventureAutoSelect({...s,level:7},p).map(r=>p.owned[r.index]),[5,4,3]);
});
test('float32 rewards retain BASE duration under Plus2; max level and region currencies not PetCoin',()=>{
 const r=started(4,10,[0,1,2]),claim=sourceAdventureClaim(r.state,r.pet,0,4,clock(),true);assert.equal(claim.status,'granted');assert.equal(claim.reward.core,adventureRewardCore([0,1,2],4));assert.equal(claim.reward.exp,adventureRewardExp(3,4));assert.equal(claim.reward.exp,480);assert.equal(claim.state.cores[1],0);assert.equal(claim.state.cores[3],0);
});
test('claim requires expiry and grants once; cancel unlocks but does not refund or grant',()=>{
 const r=started();assert.equal(sourceAdventureClaim(r.state,r.pet,0,0,clock(),false).status,'blocked');const later={...clock(),nowTicks:clock().nowTicks+hour};const c=sourceAdventureClaim(r.state,r.pet,0,0,later,false);assert.equal(c.status,'granted');assert.equal(c.state.tickets,19);assert.equal(sourceAdventureClaim(c.state,c.pet,0,0,later,false).status,'blocked');
 const cancel=sourceAdventureCancel(r.state,r.pet,0,0);assert.equal(cancel.state.tickets,19);assert.deepEqual(cancel.state.cores,[0,0,0,0]);assert.equal(cancel.pet.ownedLocks[0],-1);assert.equal(cancel.sourceDirectSave,false);
});
test('ForceFinish precise duration minus one SECOND, no direct reward; cancel/restart invalidates AD',async()=>{
 const r=started(),req=pending(r);const finished=sourceAdventureForceFinish(r.state,r.pet,0,0,clock(),false);assert.equal(finished.state.maps[0][0].enteredTicks,clock().nowTicks-hour-second);assert.deepEqual(finished.state.cores,[0,0,0,0]);assert.equal(sourceAdventureRemaining(finished.state,0,0,clock().nowTicks,false),-second);
 const cancel=sourceAdventureCancel(r.state,r.pet,0,0),restart=sourceAdventureStart(cancel.state,cancel.pet,0,0,refs(cancel.pet),{...clock(),nowTicks:clock().nowTicks+second});const res=await createLocalRewardProvider(true).execute(req);assert.equal(sourceAdventureAdReward(restart.state,restart.pet,req,res,clock()).status,'blocked');
});
test('AD eligibility max unlocked map, Plus2 excluded, yyyyMMdd two-use cap/reset',()=>{
 const r=started();assert.equal(sourceAdventureAdAble(r.state,0,0,clock(),false),true);assert.equal(sourceAdventureAdAble(r.state,0,0,clock(),true),false);assert.equal(sourceAdventureAdAble({...r.state,level:1},0,0,clock(),false),false);assert.equal(sourceAdventureAdAble({...r.state,adDayKey:clock().dayKey,adUseCount:2},0,0,clock(),false),false);
 assert.equal(sourceAdventureDayCheck({...r.state,adDayKey:'20261003',adUseCount:2},clock()).adUseCount,0);assert.equal(sourceAdventureDayCheck({...r.state,adDayKey:'20261005',adUseCount:2},clock()).adUseCount,0);
});
for(const outcome of ['success','failure','cancelled','unavailable'])test(`AD ${outcome} callback: identity, state, replay and daily ledger`,async()=>{
 const r=started(),req=pending(r),res=await createLocalRewardProvider(outcome!=='unavailable',outcome==='unavailable'?'success':outcome).execute(req),c=sourceAdventureAdReward(r.state,r.pet,req,res,clock());
 if(outcome==='success'){assert.equal(c.status,'granted');assert.equal(c.state.adUseCount,1);assert.equal(c.state.maps[0][0].enteredTicks,r.state.maps[0][0].enteredTicks-hour/2n);assert.equal(sourceAdventureAdReward(c.state,c.pet,req,res,clock()).status,'blocked');assert.equal(sourceAdventureAdReward(r.state,r.pet,req,{...res,id:'different'},clock()).status,'blocked');assert.equal(sourceAdventureAdReward(r.state,r.pet,req,{...res,purpose:'other'},clock()).status,'blocked');}
 else{assert.equal(c.status,'blocked');assert.deepEqual(c.state,r.state);}
});
test('host bundles commit tickets, locks and claim atomically; roundtrip retains identity without PetCoin grant',()=>{
 const b={session:createSession(),activities:createActivityState(),platform:freshPlatformState(),meta:{...freshSourceMetaState(),pet:pets()}};let r=runtimeSourceAdventure(b,'start',0,0,clock(),refs(b.meta.pet));assert.equal(r.status,'granted');r={...r,meta:decodeSourceMetaState(serializeSourceMetaState(r.meta))};r=runtimeSourceAdventure(r,'claim',0,0,{...clock(),nowTicks:clock().nowTicks+hour});assert.equal(r.status,'granted');assert.equal(r.meta.adventure.cores[0],20);assert.equal(r.meta.petCoin,0);assert.equal(r.meta.pet.ownedLocks[0],-1);
});
