import test from 'node:test';import assert from 'node:assert/strict';
import {SOURCE_PRISM,freshSourcePrism,decodeSourcePrism,sourcePrismRemaining,sourcePrismGate,sourcePrismReward} from '../r6-prism';
import {createLocalRewardProvider} from '../r6-reward-provider';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
const now=Date.parse('2026-10-04T12:00:00Z'),wallet=()=>[400,500,600,700];
const request=(item=0,id=`purchase:${item}`)=>({id,item,kind:'purchase',purpose:SOURCE_PRISM.products[item]});
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
const grant=(s=freshSourcePrism(),cores=wallet(),r=request(),res=response(r),n=now,history=340)=>sourcePrismReward(s,cores,r,res,n,history);
test('source seven exact products/amounts; all credit Prism core3, never PetCoin/three regional cores',()=>{
 assert.deepEqual(SOURCE_PRISM.amounts,[100,500,1050,3300,750,1750,6000]);assert.deepEqual(SOURCE_PRISM.cooldownHours,[0,0,0,0,24,168,168]);
 for(let item=0;item<7;item++){const r=request(item),x=grant(undefined,undefined,r);assert.equal(x.status,'granted');assert.deepEqual(x.cores,[400,500,600,700+SOURCE_PRISM.amounts[item]]);assert.deepEqual(x.state.rewardClaims,[r.id]);assert.equal(x.state.lastPurchasedUTC.filter(x=>x!==null).length,item<4?0:1);if(item>=4)assert.equal(x.state.lastPurchasedUTC[item-4],now);}
});
test('daily and two weekly timestamps are independent rolling cooldowns, exact >= boundary',()=>{
 const s={...freshSourcePrism(),lastPurchasedUTC:[now,now,now]};
 for(const item of [4,5,6]){const duration=SOURCE_PRISM.cooldownHours[item]*3600000;assert.equal(sourcePrismRemaining(s,item,now+duration-1),1);assert.ok(sourcePrismGate(s,item,now+duration-1,340));assert.equal(sourcePrismGate(s,item,now+duration,340),'');}
 // Monday midnight is <168h after a Sunday purchase; it never refreshes this shop.
 assert.ok(sourcePrismGate(s,5,now+12*3600000,340));assert.ok(sourcePrismGate(s,6,now+12*3600000,340));
 const daily=grant(freshSourcePrism(),wallet(),request(4));assert.equal(sourcePrismGate(daily.state,5,now,340),'');assert.equal(sourcePrismGate(daily.state,6,now,340),'');
 const week5=grant(daily.state,daily.cores,request(5));assert.equal(sourcePrismGate(week5.state,6,now,340),'');assert.ok(sourcePrismGate(week5.state,5,now,340));
});
test('clock rollback does not reset purchases or refund; no calendar-midnight reset',()=>{
 const s={...freshSourcePrism(),lastPurchasedUTC:[now,null,null]};assert.equal(sourcePrismRemaining(s,4,now-1000),86401000);assert.ok(sourcePrismGate(s,4,now+1,340));assert.deepEqual(s.lastPurchasedUTC,[now,null,null]);
});
test('ordinary packs repeat with new request identities, same request never double awards',()=>{
 let s=freshSourcePrism(),w=wallet();for(let i=0;i<4;i++){const r=request(0,`repeat:${i}`),x=grant(s,w,r);assert.equal(x.status,'granted');s=x.state;w=x.cores;const replay=grant(s,w,r);assert.equal(replay.status,'blocked');assert.equal(replay.state,s);assert.equal(replay.cores,w);}
 assert.equal(w[3],1100);assert.equal(s.rewardClaims.length,4);
});
test('failure, cancel and unavailable leave wallet/timestamp/ledger unchanged; identical retry may later succeed',()=>{
 const s=freshSourcePrism(),w=wallet(),r=request(4);for(const status of ['failure','cancelled','unavailable']){const x=grant(s,w,r,response(r,status));assert.equal(x.status,'blocked');assert.equal(x.state,s);assert.equal(x.cores,w);assert.ok(x.reason);}assert.equal(grant(s,w,r).status,'granted');
});
test('callback identity/purpose/kind/provider/online flag rejected atomically',()=>{
 const s=freshSourcePrism(),w=wallet(),r=request(0);for(const patch of [{id:'wrong'},{purpose:'wrong'},{kind:'ad'},{provider:'online'},{onlineVerified:true}]){const x=grant(s,w,r,{...response(r),...patch});assert.equal(x.status,'blocked');assert.equal(x.state,s);assert.equal(x.cores,w);}
 for(const bad of [{...r,purpose:SOURCE_PRISM.products[1]},{...r,kind:'ad'},{...r,id:''}])assert.equal(grant(s,w,bad,response(bad)).status,'blocked');
});
test('source progression gate 35th stage; no silent unlock by old-save migration',()=>{
 for(const historic of [-1,0,339])assert.equal(grant(undefined,undefined,undefined,undefined,now,historic).status,'blocked');assert.equal(grant().status,'granted');
 const meta=freshSourceMetaState(),raw=JSON.parse(serializeSourceMetaState(meta));delete raw.coreShop;raw.adventure.cores=[7,8,9,10];const old=decodeSourceMetaState(JSON.stringify(raw));assert.deepEqual(old.coreShop,freshSourcePrism());assert.deepEqual(old.adventure.cores,[7,8,9,10]);
});
test('strict malformed extension refuses; only absence migrates, no forgiving null or clamps',()=>{
 for(const raw of [null,{}, {...freshSourcePrism(),lastPurchasedUTC:[null]}, {...freshSourcePrism(),lastPurchasedUTC:[NaN,null,null]}, {...freshSourcePrism(),lastPurchasedUTC:[8640000000000001,null,null]},{...freshSourcePrism(),rewardClaims:['dup','dup']},{...freshSourcePrism(),rewardClaims:['']}])assert.throws(()=>decodeSourcePrism(raw),/Invalid/);
 const meta=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));meta.coreShop=null;assert.throws(()=>decodeSourceMetaState(JSON.stringify(meta)),/Invalid core/);
});
test('invalid wallet/item/clock and source int32 overflow never consume purchase or cooldown',()=>{
 const s=freshSourcePrism();for(const w of [[],[1,2,3],[-1,2,3,4],[1,2,3,.1],[1,2,3,0x7fffffff]]){const x=grant(s,w,request(4));assert.equal(x.status,'blocked');assert.equal(x.state,s);assert.equal(x.cores,w);}
 for(const item of [-1,7,NaN,.5])assert.equal(grant(s,wallet(),request(item)).status,'blocked');
 for(const t of [NaN,Infinity,.5,8640000000000001])assert.equal(grant(s,wallet(),request(),undefined,t).status,'blocked');
 assert.equal(grant(s,[0,0,0,0x7fffffff-100]).cores[3],0x7fffffff);
});
test('persisted core purchase timestamps/ledger/wallet and Relic identities survive isolated codec',()=>{
 const meta=freshSourceMetaState(),x=grant(meta.coreShop,meta.adventure.cores,request(6));meta.coreShop=x.state;meta.adventure.cores=x.cores;meta.relic.items[2]={unlocked:true,lv:2,count:3};const decoded=decodeSourceMetaState(serializeSourceMetaState(meta));assert.deepEqual(decoded.coreShop,x.state);assert.deepEqual(decoded.relic,meta.relic);assert.deepEqual(decoded.adventure.cores,x.cores);assert.equal(grant(decoded.coreShop,decoded.adventure.cores,request(6)).status,'blocked');
});
test('one provider request identity caches response; conflicting replay rejected',async()=>{
 const provider=createLocalRewardProvider(true),r=request(0);const a=provider.execute(r),b=provider.execute(r);assert.equal(a,b);const response=await a;const x=grant(undefined,undefined,r,response);assert.equal(grant(x.state,x.cores,r,response).status,'blocked');assert.throws(()=>provider.execute({...r,purpose:'wrong'}),/conflict/);
});
