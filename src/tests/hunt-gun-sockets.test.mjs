import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_HUNT_GUN_SOCKETS as source,sourceHuntGunSockets,sourceHuntGunFirePosition} from '../hunt-gun-sockets';
import {sourceHuntCatBulletSpawnPosition} from '../hunt-cat-runtime';
const forward={x:-.5416752,y:-.64278764,z:.5416752};
test('260 Gun field layouts consumed completely; all12 random weapons retain native sockets',()=>{
 assert.equal(source.cats.length,4);
 for(const cat of source.cats){assert.equal(cat.guns.length,65);for(const gun of cat.guns){assert.equal(gun.parsedBytes,60+12*gun.shootRandom.length);assert.equal(gun.gunNum,cat.guns.indexOf(gun));}}
 const canonical=source.cats.find(c=>c.catComponentID===147400);
 assert.deepEqual(canonical.guns.filter(g=>g.shootRandom.length).map(g=>g.gunNum),[10,11,15,20,28,33,35,43,48,53,58,63]);
 assert.equal(canonical.guns.reduce((sum,g)=>sum+g.shootRandom.length,0),32);
 const rig=JSON.parse(readFileSync('public/assets/cat-rig/rig.json','utf8')),ids=new Set(rig.nodes.map(n=>n.id));
 for(const g of rig.guns){const native=sourceHuntGunSockets(147400,g.id);assert.equal(g.shoot,native.shoot);assert.deepEqual(g.shootRandom,native.shootRandom);assert.ok(native.shootRandom.every(id=>ids.has(id)));}
});
test('empty sockets do NOT roll Random.Range and use real Shoot_trans, not flash Muzzle',()=>{
 const gun=sourceHuntGunSockets(147400,0),raw={x:-100,y:5,z:10};let reads=[];
 const actual=sourceHuntGunFirePosition(gun,forward,id=>{reads.push(id);return raw;},()=>assert.fail('unexpected RNG'));
 assert.deepEqual(reads,[gun.shoot]);assert.deepEqual(actual,sourceHuntCatBulletSpawnPosition(raw,forward));assert.equal(actual.y,2);
});
test('all original random sockets selectable; one live transform read and one integer roll per attack',()=>{
 const gun=sourceHuntGunSockets(147400,10);assert.ok(gun.shootRandom.length>1);
 for(let index=0;index<gun.shootRandom.length;index++){let reads=[],rolls=[];const raw={x:index,y:4,z:index+7};
 const actual=sourceHuntGunFirePosition(gun,forward,id=>{reads.push(id);return raw;},(min,max)=>{rolls.push([min,max]);return index;});
 assert.deepEqual(rolls,[[0,gun.shootRandom.length]]);assert.deepEqual(reads,[gun.shootRandom[index]]);assert.deepEqual(actual,sourceHuntCatBulletSpawnPosition(raw,forward));}
});
test('invalid identity/index/camera raises rather than secretly falling back to first socket',()=>{
 for(const args of [[-1,0],[147400,-1],[147400,65],[147400,.1]])assert.throws(()=>sourceHuntGunSockets(...args),RangeError);
 const gun=sourceHuntGunSockets(147400,10);for(const i of [-1,.5,gun.shootRandom.length,NaN])assert.throws(()=>sourceHuntGunFirePosition(gun,forward,()=>assert.fail('must not read'),()=>i),RangeError);
 assert.throws(()=>sourceHuntGunFirePosition({shoot:0,shootRandom:[]},forward,()=>({x:0,y:0,z:0}),()=>0),RangeError);
 assert.throws(()=>sourceHuntGunFirePosition(sourceHuntGunSockets(147400,0),{x:0,y:0,z:1},()=>({x:0,y:3,z:0}),()=>0),/CamForward/);
});
