import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSourcePetState,sourcePetWithIdentities,sourcePetDraw,sourcePetMerge,sourcePetEquip,sourcePetUnequip,serializeSourcePetState,decodeSourcePetState} from '../r5-pet';
import {freshSourcePetAutoState,sourcePetAutoEntryUnlocked,sourcePetEntityRef,sourcePetRefCurrent,sourcePetFindAutoPair,createSourcePetAutoScheduler,sourcePetSlotSnapshot,sourcePetAutoLimit,sourcePetAutoPosition} from '../r6-pet-auto';
import {freshSourceMetaState,runtimeSourcePetAction} from '../source-meta-runtime';
import {createSession} from '../session';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
const populated=()=>{const s=freshSourcePetState();s.owned[0]=s.owned[1]=0;s.collect[2]=true;return sourcePetWithIdentities(s);};
const pool=()=>Array.from({length:16},(_,slot)=>({slot,active:slot<2,dragging:false,autoMerging:false,reserved:false}));
const auto={requested:true,configuredDegree:6};
test('pet legacy identity migration grants no resources and preserves fixed positions; saved IDs stay stable',()=>{
 const s=populated();assert.deepEqual(s.owned.slice(0,2),[0,0]);assert.notEqual(s.ownedIDs[0],s.ownedIDs[1]);assert.deepEqual(decodeSourcePetState(serializeSourcePetState(s)),s);
 const old=JSON.parse(serializeSourcePetState(s));delete old.H5_Identity;assert.deepEqual(decodeSourcePetState(old),s);
 for(const change of [x=>x.ownedIDs[1]=x.ownedIDs[0],x=>x.nextID=0,x=>x.ownedIDs[0]='random']){const bad=structuredClone(s);change(bad);assert.throws(()=>serializeSourcePetState(bad));}
 const malformed=JSON.parse(serializeSourcePetState(s));malformed.H5_Identity.owned[2]='pet:3';assert.throws(()=>decodeSourcePetState(malformed));
 const normalized=structuredClone(s);normalized.ownedIDs[2]='pet:3';assert.equal(JSON.parse(serializeSourcePetState(normalized)).H5_Identity.owned[2],null);
});
test('pet identities and dispatch locks travel on equip/unequip; merge keeps anchor ID',()=>{
 let s=populated(),a=s.ownedIDs[0],b=s.ownedIDs[1];s.ownedLocks[0]=11;s=sourcePetEquip(s,0,0).value;assert.equal(s.selectedIDs[0],a);assert.equal(s.selectedLocks[0],11);
 s=sourcePetUnequip(s,0).value;assert.equal(s.ownedIDs[0],a);assert.equal(s.ownedLocks[0],11);assert.equal(sourcePetMerge(s,0,1).status,'blocked');s.ownedLocks[0]=-1;s=sourcePetMerge(s,0,1).value;assert.equal(s.ownedIDs[0],null);assert.equal(s.ownedIDs[1],b);assert.equal(s.owned[1],1);
});
test('source pet auto scene defaults off, visibility independent from Plus2, history caps grade',()=>{
 assert.equal(freshSourcePetAutoState(true).requested,false);assert.equal(sourcePetAutoEntryUnlocked(189),false);assert.equal(sourcePetAutoEntryUnlocked(190),true);
 const s=populated();assert.equal(sourcePetAutoLimit(s),1);assert.equal(sourcePetFindAutoPair(s,auto,false,pool()),null);assert.equal(sourcePetFindAutoPair(s,{...auto,requested:false},true,pool()),null);
 const pair=sourcePetFindAutoPair(s,auto,true,pool());assert.equal(pair.mover.index,0);assert.equal(pair.anchor.index,1);
 for(const flag of ['dragging','autoMerging','reserved']){const p=pool();p[1][flag]=true;assert.equal(sourcePetFindAutoPair(s,auto,true,p),null);}s.ownedLocks[0]=4;assert.equal(sourcePetFindAutoPair(s,auto,true,pool()),null);
});
test('pet auto moves before exactly one commit, waits for transaction, cooldown and canceled IDs',()=>{
 let s=populated();const scheduler=createSourcePetAutoScheduler(),frame=()=>({state:s,auto,plus2:true,pool:pool(),positions:[{x:0,y:0},{x:150,y:0}],dt:.01,enabled:true,dragging:false});
 let step=scheduler.tick(frame());assert.equal(step.phase,'moving');assert.ok(step.position.x>0&&step.position.x<150);
 let commits=0;for(let i=0;i<50;i++){step=scheduler.tick(frame());if(step.commit)commits++;}assert.equal(commits,1);
 scheduler.reset();step=scheduler.tick(frame());s={...s,ownedIDs:['pet:10',...s.ownedIDs.slice(1)],nextID:11};step=scheduler.tick(frame());assert.equal(step.phase,'cancelled');assert.equal(step.commit,undefined);
 scheduler.reset();step=scheduler.tick({...frame(),dragging:true});assert.equal(step.phase,'idle');assert.equal(sourcePetAutoPosition({x:0,y:0},{x:150,y:0},.25).ready,true);
});
test('same-grade replacement invalidates old pet refs and host guarded transactions; retries do not fuse twice',()=>{
 let s=populated();const ref=sourcePetEntityRef(s,'owned',0);const b={session:{...createSession(),historicMax:190},activities:createActivityState(),platform:freshPlatformState(),meta:{...freshSourceMetaState(),pet:s}};
 const payload={a:0,b:1,guards:[sourcePetSlotSnapshot(s,'owned',0),sourcePetSlotSnapshot(s,'owned',1)]};
 const done=runtimeSourcePetAction(b,'merge',payload);assert.equal(done.status,'granted');assert.equal(runtimeSourcePetAction(done,'merge',payload).status,'blocked');
 s={...s,ownedIDs:['pet:10',...s.ownedIDs.slice(1)],nextID:11};assert.equal(sourcePetRefCurrent(s,ref),false);assert.equal(runtimeSourcePetAction({...b,meta:{...b.meta,pet:s}},'merge',payload).status,'blocked');
});
