import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSourcePetState,sourcePetWithIdentities,sourcePetMoveOwned,sourcePetSwapOwned,sourcePetMerge,sourcePetEquip,serializeSourcePetState,decodeSourcePetState} from '../r5-pet';
import {sourcePetOwnedDragDecision,sourcePetNearestEmpty,sourcePetDragOverlaps,SOURCE_PET_DRAG_GEOMETRY as g} from '../r6-pet-drag';
import {sourcePetSlotSnapshot} from '../r6-pet-auto';
import {createSession} from '../session';
import {createActivityState} from '../source-activities';
import {freshPlatformState} from '../local-platform';
import {freshSourceMetaState,runtimeSourcePetAction,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {freshSourceAdventureState,sourceAdventureLocalClock,sourceAdventureStart,sourceAdventureClaim,sourceAdventureCancel,sourceAdventureGrades} from '../r6-adventure';
const pet=(grades=[0,1,2,3])=>{const p=freshSourcePetState();grades.forEach((v,i)=>p.owned[i]=v);return sourcePetWithIdentities(p);};
const apply=(r)=>{assert.equal(r.status,'supported',r.reason);return r.value;};
const bundle=p=>({session:{...createSession(),historicMax:110,diamonds:1234},activities:createActivityState(),meta:{...freshSourceMetaState(),pet:p,petCoin:345},platform:freshPlatformState()});
const guards=(s,...indices)=>[...new Set(indices)].map(i=>sourcePetSlotSnapshot(s,'owned',i));
const entities=p=>p.owned.flatMap((v,i)=>v<0?[]:[{grade:v,lock:p.ownedLocks[i],uid:p.ownedIDs[i]}]).sort((a,b)=>a.uid.localeCompare(b.uid));
test('native Pet_Item overlap shrinks BOTH rectangles by40 with strict edges and original150x210 rect',()=>{
 const p=g.positions[0];assert(sourcePetDragOverlaps(p,{x:p.x+129.9,y:p.y+69.9}));
 for(const delta of [{x:130,y:0},{x:-130,y:0},{x:0,y:70},{x:0,y:-70}])assert(!sourcePetDragOverlaps(p,{x:p.x+delta.x,y:p.y+delta.y}));
 assert.throws(()=>sourcePetDragOverlaps(p,{x:NaN,y:0}));
});
test('nearest empty includes original, excludes target, float32 strict tie chooses first slot',()=>{
 const s=pet([0,1]),full=pet(Array.from({length:16},()=>1));full.owned[2]=-1;full.ownedIDs[2]=null;assert.equal(sourcePetNearestEmpty(full,g.positions[1],0,1),0);assert.equal(sourcePetNearestEmpty(s,g.positions[1],0,1),5);
 const midpoint={x:274.5,y:g.positions[0].y};assert.equal(sourcePetNearestEmpty(s,midpoint,0),0);
 assert.equal(sourcePetNearestEmpty(s,g.positions[2],0),2);assert.throws(()=>sourcePetNearestEmpty(s,{x:Infinity,y:0},0));
});
test('non-overlap drop ANYWHERE snaps nearest empty/original, not pointer slot hit or forced cancel',()=>{
 const s=pet();assert.deepEqual(sourcePetOwnedDragDecision(s,0,g.positions[5]),{kind:'move',target:5});
 assert.deepEqual(sourcePetOwnedDragDecision(s,0,{x:-10000,y:10000}),{kind:'move',target:0});
 assert.deepEqual(sourcePetOwnedDragDecision(s,0,{x:10000,y:-10000}),{kind:'move',target:15});
});
test('same unlocked grade fuses; either lock switches to swap; auto reserved target excluded',()=>{
 const s=pet([0,0,2,3]);assert.deepEqual(sourcePetOwnedDragDecision(s,0,g.positions[1]),{kind:'merge',target:1});
 for(const i of [0,1]){const p=structuredClone(s);p.ownedLocks[i]=0;assert.equal(sourcePetOwnedDragDecision(p,0,g.positions[1]).kind,'swap');}
 const decision=sourcePetOwnedDragDecision(s,0,g.positions[1],new Set([1]));assert.equal(decision.kind,'move');assert.notEqual(decision.target,1);
});
test('source three-position preview displaces target to nearest empty, NOT always mover origin',()=>{
 const s=pet([0,1,2,3]);assert.deepEqual(sourcePetOwnedDragDecision(s,0,g.positions[3]),{kind:'swap',target:3,destination:7});
 const p=apply(sourcePetSwapOwned(s,0,3,7));assert.equal(p.owned[0],-1);assert.equal(p.owned[3],0);assert.equal(p.owned[7],3);assert.deepEqual(entities(p),entities(s));
});
test('full inventory uses original as destination; explicit native -1 branch also swaps',()=>{
 const s=pet(Array.from({length:16},(_,i)=>i%10));assert.deepEqual(sourcePetOwnedDragDecision(s,0,g.positions[3]),{kind:'swap',target:3,destination:0});
 const p=apply(sourcePetSwapOwned(s,0,3,0));assert.equal(p.owned[0],3);assert.equal(p.owned[3],0);assert.deepEqual(apply(sourcePetSwapOwned(s,0,3)),p);
});
test('move and locked swaps retain grade/lock/uid, collection, daily ledger and next identity; inputs immutable',()=>{
 const s=pet();s.ownedLocks[0]=2;s.ownedLocks[3]=101;s.dailyLastDate='20261004';s.collect[3]=true;const before=structuredClone(s);
 const p=apply(sourcePetMoveOwned(s,0,15));assert.equal(p.ownedIDs[15],s.ownedIDs[0]);assert.equal(p.ownedLocks[15],2);assert.equal(p.ownedIDs[0],null);assert.equal(p.ownedLocks[0],-1);
 const q=apply(sourcePetSwapOwned(p,15,3,7));assert.deepEqual(entities(q),entities(s));assert.equal(q.nextID,s.nextID);assert.deepEqual(q.collect,s.collect);assert.equal(q.dailyLastDate,s.dailyLastDate);assert.deepEqual(s,before);assert.deepEqual(decodeSourcePetState(serializeSourcePetState(q)),q);
});
test('invalid/self/nonempty destinations do not mutate or consume entities; max-grade attempted fusion stays no-op',()=>{
 const s=pet([9,9,2]);const before=structuredClone(s);
 for(const [a,b] of [[0,0],[0,2],[-1,15],[16,15],[.1,15],[3,15]])assert.equal(sourcePetMoveOwned(s,a,b).status,'blocked');
 for(const [a,b,d] of [[0,0,-1],[0,1,1],[0,1,2],[0,1,16],[0,1,-2],[3,1,0]])assert.equal(sourcePetSwapOwned(s,a,b,d).status,'blocked');
 assert.equal(sourcePetOwnedDragDecision(s,0,g.positions[1]).kind,'merge');assert.equal(sourcePetMerge(s,0,1).reason,'pet-merge-max-grade');assert.deepEqual(s,before);
});
test('all source mover/target pairs and empty destinations preserve identity multiset including lock groups',()=>{
 for(let a=0;a<16;a++)for(let b=0;b<16;b++){
  if(a===b)continue;const s=pet(Array.from({length:16},(_,i)=>i%10));s.ownedLocks=s.owned.map((_,i)=>i%4?i:-1);
  assert.deepEqual(entities(apply(sourcePetSwapOwned(s,a,b))),entities(s));
  const c=(b+1)%16;if(c!==a){s.owned[c]=-1;s.ownedLocks[c]=-1;s.ownedIDs[c]=null;assert.deepEqual(entities(apply(sourcePetSwapOwned(s,a,b,c))),entities(s));}
 }
});
test('host requires complete three-slot snapshots and rejects stale grade/lock/ID/filled-destination',()=>{
 const s=pet(),b=bundle(s),payload={a:0,b:3,destination:7,guards:guards(s,0,3,7)};
 let n=runtimeSourcePetAction(b,'swap-owned',payload);assert.equal(n.status,'granted');assert.deepEqual(entities(n.meta.pet),entities(s));assert.equal(n.session.diamonds,1234);assert.equal(n.meta.petCoin,345);assert.equal(n.platform,b.platform);
 for(const change of [p=>p.ownedLocks[0]=4,p=>p.ownedLocks[3]=4,p=>p.owned[7]=0,p=>p.ownedIDs[3]='pet:900',p=>p.owned[3]=4]){const modified=structuredClone(s);change(modified);n=runtimeSourcePetAction(bundle(modified),'swap-owned',payload);assert.equal(n.status,'blocked');assert.equal(n.meta.pet,modified);}
 for(const wrong of [{...payload,guards:guards(s,0,3)},{...payload,guards:[]},{a:0,b:3,destination:7}])assert.equal(runtimeSourcePetAction(b,'swap-owned',wrong).status,'blocked');
 assert.equal(runtimeSourcePetAction(b,'move-owned',{a:0,b:7,guards:guards(s,0,7)}).status,'granted');b.session.historicMax=109;assert.equal(runtimeSourcePetAction(b,'swap-owned',payload).status,'blocked');
});
test('host replay after swap or move is stale; meta codec reload preserves holes and lock identities',()=>{
 const s=pet(),payload={a:0,b:3,destination:7,guards:guards(s,0,3,7)},n=runtimeSourcePetAction(bundle(s),'swap-owned',payload);
 assert.equal(runtimeSourcePetAction(n,'swap-owned',payload).status,'blocked');const meta=decodeSourceMetaState(serializeSourceMetaState(n.meta));assert.deepEqual(meta.pet,n.meta.pet);
 const m={a:3,b:15,guards:guards(n.meta.pet,3,15)},moved=runtimeSourcePetAction(n,'move-owned',m);assert.equal(moved.status,'granted');assert.equal(runtimeSourcePetAction(moved,'move-owned',m).status,'blocked');
});
test('dispatched entity reorder/swap/equip still contributes same exploration reward then unlocks current positions',()=>{
 const clock=sourceAdventureLocalClock(new Date(2026,9,4,12)),s=pet([0,1,2,3]);
 const started=sourceAdventureStart(freshSourceAdventureState(),s,0,0,[{source:'owned',index:0,uid:s.ownedIDs[0]}],clock);assert.equal(started.status,'granted');
 const p=apply(sourcePetMoveOwned(started.pet,0,15)),q=apply(sourcePetSwapOwned(p,15,3,7)),equipped=apply(sourcePetEquip(q,3,0));assert.deepEqual(sourceAdventureGrades(equipped,0,0),[0]);
 const claim=sourceAdventureClaim(started.state,equipped,0,0,{...clock,nowTicks:clock.nowTicks+100n*3600n*10000000n},false);assert.equal(claim.status,'granted');assert.equal(claim.pet.selectedLocks[0],-1);assert.equal(claim.pet.selectedIDs[0],s.ownedIDs[0]);assert.equal(claim.pet.ownedLocks[7],-1);
 const cancel=sourceAdventureCancel(started.state,q,0,0);assert.equal(cancel.status,'granted');assert.equal(cancel.pet.ownedLocks[3],-1);assert.equal(cancel.pet.ownedIDs[3],s.ownedIDs[0]);assert.equal(cancel.state.tickets,started.state.tickets);
});
