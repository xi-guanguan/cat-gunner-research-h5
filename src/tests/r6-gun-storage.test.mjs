import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,sourceGun,serializeSession,deserializeSession,applyGunDrop,fuseInventory,step} from '../session';
import {gunEntityUID,gunEntityRef,classifyGunHover} from '../gun-drag';
import {freshSourceGunSafe,sourceGunSafeUnlocked,sourceGunSafeOpenSlots,sourceGunSafeNextPrice,sourceGunDetailRef,sourceGunDetailCurrent,sourceGunProtection,sourceGunSafeDeposit,sourceGunSafeTakeOut,sourceGunSafePurchase,validateSourceGunSafe} from '../r6-gun-storage';
import {sourceGunAutoPool} from '../r5-gun-auto';
import {makeActor} from '../cat-actors';
import scene from '../data/r6-gun-info-ui.json';
const ready=()=>({...createSession(123),mode:'field',overlay:'gun',gunUnlocked:true,historicMax:390,diamonds:10000,gunInventory:[sourceGun(0),sourceGun(3),sourceGun(5)],gunSafe:freshSourceGunSafe()});
test('source safe default is sixteen vacancies, six open, stage40 gate and sequential 50..500 prices',()=>{
 let s=ready();assert.equal(sourceGunSafeUnlocked(389),false);assert.equal(sourceGunSafeUnlocked(390),true);assert.equal(s.gunSafe.guns.filter(Boolean).length,0);
 assert.equal(sourceGunSafePurchase({...s,historicMax:389},6).status,'blocked');assert.equal(sourceGunSafePurchase(s,7).session,s);
 for(let i=0;i<10;i++){assert.equal(sourceGunSafeOpenSlots(s.gunSafe),6+i);assert.equal(sourceGunSafeNextPrice(s.gunSafe),50+50*i);const before=s;const result=sourceGunSafePurchase(s,6+i);assert.equal(result.status,'granted');s=result.session;assert.equal(s.diamonds,before.diamonds-50-50*i);assert.equal(sourceGunSafePurchase(s,6+i).status,'blocked');}
 assert.equal(s.diamonds,7250);assert.equal(sourceGunSafePurchase(s,16).status,'blocked');assert.equal(sourceGunSafePurchase({...ready(),diamonds:49},6).status,'blocked');
});
test('protect/unprotect retains stable UID even for old in-memory guns without uid; stale same-kind weapon is rejected',()=>{
 const s=ready(),ref=sourceGunDetailRef(s,'inventory',0),r=sourceGunProtection(s,ref,true);assert.equal(r.status,'granted');assert.equal(s.gunInventory[0].paused,undefined);assert.equal(sourceGunDetailCurrent(r.session,ref).paused,true);assert.equal(gunEntityUID(r.session.gunInventory[0]),ref.uid);
 assert.equal(sourceGunProtection(r.session,ref,true).session,r.session);assert.equal(sourceGunProtection(r.session,ref,false).status,'granted');
 assert.equal(sourceGunProtection({...s,gunInventory:[sourceGun(0),...s.gunInventory.slice(1)]},ref,true).status,'blocked');
 assert.equal(sourceGunProtection({...s,historicMax:389},ref,true).status,'blocked');assert.equal(sourceGunProtection({...r.session,historicMax:389},ref,false).status,'granted');
 assert.equal(sourceGunProtection({...s,gunInventory:[{...s.gunInventory[0],uid:ref.uid,adReward:true}]},ref,true).status,'blocked');
});
test('deposit finds first open vacancy, clears merge-protection; takeout preserves identity and restores default protection',()=>{
 let s=ready(),ref=sourceGunDetailRef(s,'inventory',1);s=sourceGunProtection(s,ref,true).session;const result=sourceGunSafeDeposit(s,ref);assert.equal(result.status,'granted');assert.equal(result.slot,0);assert.equal(result.session.gunInventory.length,2);assert.equal(result.session.gunSafe.guns[0].paused,false);assert.equal(gunEntityUID(result.session.gunSafe.guns[0]),ref.uid);assert.equal(s.gunSafe.guns[0],null);
 const safeRef=sourceGunDetailRef(result.session,'safe',0),take=sourceGunSafeTakeOut(result.session,safeRef);assert.equal(take.status,'granted');assert.equal(take.session.gunSafe.guns[0],null);assert.equal(take.session.gunInventory.at(-1).paused,true);assert.equal(gunEntityUID(take.session.gunInventory.at(-1)),ref.uid);assert.equal(sourceGunSafeTakeOut(take.session,safeRef).status,'blocked');
 assert.equal(sourceGunSafeDeposit(take.session,ref).status,'blocked');assert.equal(sourceGunProtection(result.session,safeRef,true).status,'blocked');
});
test('full safe/full inventory/ad reward/moved weapon/closed safe deny without loss or debit',()=>{
 const s=ready(),ref=sourceGunDetailRef(s,'inventory',0);const full={...s,gunSafe:{purchased:0,guns:[...Array.from({length:6},(_,i)=>sourceGun(i)),...Array(10).fill(null)]}};assert.equal(sourceGunSafeDeposit(full,ref).session,full);
 let inSafe=sourceGunSafeDeposit(s,ref).session,safeRef=sourceGunDetailRef(inSafe,'safe',0);inSafe={...inSafe,gunInventory:Array.from({length:16},()=>sourceGun(0))};assert.equal(sourceGunSafeTakeOut(inSafe,safeRef).session,inSafe);
 const ad={...s,gunInventory:[{...s.gunInventory[0],uid:ref.uid,adReward:true}]};assert.equal(sourceGunSafeDeposit(ad,ref).session,ad);assert.equal(sourceGunSafeDeposit({...s,historicMax:389},ref).status,'blocked');assert.equal(sourceGunSafeDeposit(s,{...ref,uid:'stale'}).status,'blocked');
});
test('protection blocks manual and auto fusion, but follows weapon during movement/equipment swap, never stops firing',()=>{
 let s=ready(),ref=sourceGunDetailRef(s,'inventory',0);s=sourceGunProtection(s,ref,true).session;
 assert.equal(fuseInventory(s,0,1).gunInventory.length,3);assert.equal(sourceGunAutoPool(s)[0].paused,true);
 assert.equal(applyGunDrop(s,{from:gunEntityRef(s.gunInventory[0],'inventory',0),to:{kind:'inventory',index:1},intent:'fuse'}).accepted,false);
 assert.equal(classifyGunHover(gunEntityRef(s.gunInventory[2],'inventory',2),{kind:'inventory',index:0,sourceID:0,paused:true}).type,'swap');
 const swap=applyGunDrop(s,{from:gunEntityRef(s.gunInventory[0],'inventory',0),to:{kind:'inventory',index:2},intent:'swap'});assert.equal(swap.accepted,true);assert.equal(swap.session.gunInventory[2].paused,true);
 const equip=applyGunDrop(s,{from:gunEntityRef(s.gunInventory[0],'inventory',0),to:{kind:'equipment',index:0},intent:'swap'});assert.equal(equip.accepted,true);assert.equal(equip.session.equippedGuns[0].paused,true);
 let battle={...s,overlay:'none',equippedGuns:[{...sourceGun(0),paused:true},null,null]};battle.battle={...battle.battle,autoMove:false,actors:[{...makeActor(0,battle.battle.player),attackState:{spreadAngleDegrees:0,previousHadTarget:true,attackTimerSeconds:2}}],targets:battle.battle.targets.map((t,i)=>({...t,position:i===0?{x:battle.battle.player.x+2,y:battle.battle.player.y}:{x:100,y:100}}))};assert.ok(step(battle,1/60).battle.shotEvents.length>0);
});
test('safe/protection/UID roundtrip; old schema2 adds only source defaults, never gifts slots or guns',()=>{
 let s=ready();s=sourceGunSafeDeposit(s,sourceGunDetailRef(s,'inventory',0)).session;s=sourceGunProtection(s,sourceGunDetailRef(s,'equipment',0),true).session;s=sourceGunSafePurchase(s,6).session;
 const saved=deserializeSession(serializeSession(s));assert.equal(saved.gunSafe.purchased,1);assert.equal(saved.gunSafe.guns[0].id,'source-gun-0');assert.equal(saved.equippedGuns[0].paused,true);assert.equal(gunEntityUID(saved.gunSafe.guns[0]),gunEntityUID(s.gunSafe.guns[0]));
 const old=JSON.parse(serializeSession(s));delete old.session.gunSafe;const migrated=deserializeSession(JSON.stringify(old));assert.equal(migrated.gunSafe.purchased,0);assert.equal(migrated.gunSafe.guns.filter(Boolean).length,0);assert.equal(migrated.diamonds,s.diamonds);
});
test('corrupt storage/protection and cross-container duplicate identities fail restore',()=>{
 const s=ready(),saved=JSON.parse(serializeSession(s));saved.session.gunSafe.guns[0]=saved.session.gunInventory[0];assert.throws(()=>deserializeSession(JSON.stringify(saved)));
 for(const bad of [{purchased:11,guns:Array(16).fill(null)},{purchased:0,guns:Array(15).fill(null)},{purchased:0,guns:[...Array(6).fill(null),sourceGun(0),...Array(9).fill(null)]}])assert.throws(()=>validateSourceGunSafe(bad));
 const flags=JSON.parse(serializeSession(s));flags.session.gunInventory[0].paused=1;assert.throws(()=>deserializeSession(JSON.stringify(flags)));flags.session.gunInventory[0].paused=false;flags.session.gunInventory[0].adReward='yes';assert.throws(()=>deserializeSession(JSON.stringify(flags)));
});
test('serialized original collection/safe order assigns runtime IDs; all demo fields consumed with exact byte coverage',()=>{
 assert.equal(scene.filter(r=>r.kind==='Gun_Item_Collection').length,65);assert.equal(scene.find(r=>r.kind==='Gun_Collection_UI').data.items.length,65);assert.equal(scene.find(r=>r.kind==='Safe_UI').data.items.length,16);
 for(const row of scene){assert.equal(row.bytes,row.parsedBytes);if(row.kind==='Gun_Item_Demo'){assert.ok(row.data.Gun_img.id);assert.ok(row.data.Type_txt.id);assert.equal(row.data.Degree_objs.length,13);}}
});

 test('13 serialized degree colors retain float32 channels and one color per five source weapons',async()=>{
  const {default:d}=await import('../data/r6-gun-degree-colors.json');
  assert.equal(d.sourceComponent,123082);assert.equal(d.colors.length,13);
  const row=d.prefixFields.find(f=>f.field==='Degree_Colors');assert.equal(row.end-row.offset,4+13*16);
  for(let id=0;id<65;id++){const color=d.colors[Math.floor(id/5)];assert.equal(color.length,4);for(const channel of color){assert.ok(channel>=0&&channel<=1);assert.equal(channel,Math.fround(channel));}}
  assert.deepEqual(d.colors[9],[1,Math.fround(215/255),0,1]);
 });
