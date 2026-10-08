// Synthetic equipment contracts. Not source-device, live mode5 AI or GUI evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {createSession,sourceGun} from '../session';import {freshSourceMetaState} from '../source-meta-runtime';
import {sourceRaidCandidates} from '../r6-raid';import {bindSourceRaidEquipment,SOURCE_RAID_EQUIPMENT} from '../raid-equipment-binding';
import {sourceRaidCatDamage,sourceRaidCatCooldown,sessionRaidModifiers} from '../raid-cat-balance';
const make=()=>{const session=createSession();session.equippedGuns=[{...sourceGun(30),uid:'equipped'},null,null];session.gunInventory=[{...sourceGun(31),uid:'inventory'}];session.gunSafe={...session.gunSafe,guns:[{...sourceGun(32),uid:'safe'}]};session.bossSlotLevels=[2,7,19];return {session,meta:freshSourceMetaState()};};
test('mode5 selects equipment/inventory/safe identities, compact cats and fixed native Warp offsets',()=>{
 const b=make(),s=sourceRaidCandidates(b.session),r=bindSourceRaidEquipment(b,s,2);assert.deepEqual(r.map(c=>c.componentID),[147400,136809,136808]);assert.deepEqual(r.map(c=>c.selected.uid),['equipped','inventory','safe']);assert.deepEqual(r.map(c=>c.position),[{x:-100,y:0,z:0},{x:-106,y:0,z:-6},{x:-94,y:0,z:-6}]);assert.deepEqual(r.map(c=>c.isAI),[false,true,true]);assert.deepEqual(r.map(c=>c.gun.starLevel),[2,7,19]);assert.notDeepEqual(r[1].formationOffset,{x:-6,y:0,z:-6});
});
test('middle empty selection: compact SlotNum star, not selectionSlot or original equipment slot',()=>{
 const b=make(),s=sourceRaidCandidates(b.session),r=bindSourceRaidEquipment(b,[s[0],null,s[2]],2);assert.deepEqual(r.map(c=>c.selectionSlot),[0,2]);assert.deepEqual(r.map(c=>c.slotNum),[0,1]);assert.deepEqual(r.map(c=>c.gun.starLevel),[2,7]);assert.equal(r[1].componentID,136809);
});
test('only third selection occupied becomes leader and consumes star slot0',()=>{
 const b=make(),s=sourceRaidCandidates(b.session),r=bindSourceRaidEquipment(b,[null,null,s[2]],2);assert.equal(r.length,1);assert.equal(r[0].selectionSlot,2);assert.equal(r[0].slotNum,0);assert.equal(r[0].isAI,false);assert.equal(r[0].gun.starLevel,2);assert.deepEqual(r[0].position,{x:-100,y:0,z:0});
});
test('saved weapon numeric mirrors / ordinary power / permanent upgrades never replace source gun base',()=>{
 const b=make(),s=sourceRaidCandidates(b.session);const expected=bindSourceRaidEquipment(b,[s[0],null,null],2)[0];b.session.equippedGuns[0].damage=1e99;b.session.equippedGuns[0].damageValue='999e99';b.session.equippedGuns[0].intervalSeconds=.00001;b.session.upgradeLevel=99999;b.session.permanentLevels={damage:100,speed:100,money:100};const r=bindSourceRaidEquipment(b,[s[0],null,null],2)[0];assert.deepEqual(r.damage,expected.damage);assert.equal(r.cooldownSeconds,expected.cooldownSeconds);assert.deepEqual(r.gun.baseDamage,expected.gun.baseDamage);
});
test('balance passes source-bound Raid modifiers, star and weakness, never Boss policy',()=>{
 const b=make(),s=sourceRaidCandidates(b.session),r=bindSourceRaidEquipment(b,s,2);for(const c of r){const mods=sessionRaidModifiers(b.session,b.meta);assert.deepEqual(c.damage,sourceRaidCatDamage({...mods,baseDamage:c.gun.baseDamage,starLevel:c.gun.starLevel,gunType:c.gun.generation.type,weakType:2}));assert.equal(c.cooldownSeconds,sourceRaidCatCooldown({...mods,baseIntervalSeconds:c.gun.baseIntervalSeconds}));}
});
test('selection follows same UID/catalogue across safe relocation, never substituted occupant',()=>{
 const b=make(),s=sourceRaidCandidates(b.session),before=JSON.stringify(s);b.session.gunInventory=[];b.session.gunSafe.guns.push({...sourceGun(31),uid:'inventory'});const r=bindSourceRaidEquipment(b,[s[1],null,null],2)[0];assert.equal(r.selected.kind,'safe');assert.equal(r.selected.index,20);assert.equal(r.selected.uid,'inventory');assert.equal(JSON.stringify(s),before);b.session.gunSafe.guns[1]={...sourceGun(31),uid:'replacement'};assert.throws(()=>bindSourceRaidEquipment(b,[s[1],null,null],2),/identity/);
});
test('invalid/empty/duplicate/changed-catalogue selections and star range are rejected before scene',()=>{
 const b=make(),s=sourceRaidCandidates(b.session);for(const x of [[],[null,null,null],[s[0],s[0],null],[s[0],null,{...s[1],gunID:32}]])assert.throws(()=>bindSourceRaidEquipment(b,x,2));for(const stars of [[0,0],[0,-1,0],[0,21,0],[0,1.2,0]]){b.session.bossSlotLevels=stars;assert.throws(()=>bindSourceRaidEquipment(b,s,2));}assert.throws(()=>bindSourceRaidEquipment(make(),s,7));
});
test('source spawn z is independent zero, Warp offset z is explicit -6, not rig root',()=>{assert.deepEqual(SOURCE_RAID_EQUIPMENT.catSpawnPos,[-100,0,0]);assert.deepEqual(SOURCE_RAID_EQUIPMENT.warpOffsets,[[-6,0,-6],[6,0,-6]]);});
