// STATIC/MODEL only: native constants/projections and local transaction owner.
// Real store/server/source-device/human listening remain NOT_RUN.
import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceRaidStarPig,decodeSourceRaidStarPig,sourceRaidStarPigView,sourceRaidStarPigSeason,sourceRaidStarPigAdd,sourceRaidStarPigEnter,sourceRaidStarPigBar,sourceRaidStarPigApplyNative,sourceRaidStarPigRequest,sourceRaidStarPigReward,sourceRaidStarPigGate,SOURCE_RAID_STAR_PIG as source} from '../r6-raid-star-pig';
import {SourceRaidStarPigClient} from '../raid-star-pig-client';
import {sourceRaidStarPigHUD,sourceRaidStarPigPopup,sourceRaidStarPigPanelBindings} from '../raid-star-pig-ui-state';
import {sourceUiTree,solveSourceUiLayout} from '../source-ui';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {sourceRaidPanelBindings} from '../source-raid-panel';
const fresh=()=>sourceRaidStarPigSeason(freshSourceRaidStarPig(),7);
const full=(lv=1,count=0)=>({...fresh(),lv,gem:source.capacity[lv-1],purchaseCount:count});
const request=(s,id='buy')=>sourceRaidStarPigRequest(s,390,id);
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
const deferred=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),get resolve(){return resolve;},get reject(){return reject;}};};
function client(o={}){
 let state=o.state??full(),starGem=20,contextID='A',historicMax=390,fail=false,seq=0;const writes=[],requests=[],notices=[];
 const owner=new SourceRaidStarPigClient({read:()=>({state,starGem,contextID,historicMax}),write(s,w){if(fail)throw Error('quota');writes.push({s,w});state=s;starGem=w;},execute(r){requests.push(r);return o.execute?.(r)??Promise.resolve(response(r,o.outcome??'success'));},requestID:()=>`request:${++seq}`,notice:n=>notices.push(n)});
 return {owner,writes,requests,notices,get state(){return state;},set state(v){state=v;},get starGem(){return starGem;},set starGem(v){starGem=v;},set contextID(v){contextID=v;},set historicMax(v){historicMax=v;},set fail(v){fail=v;}};
}
test('exact source capacities/prices/purchase maxima, fresh/load do not gift stars or unlock progress',()=>{
 assert.deepEqual(source.capacity,[660,1500,2500]);assert.deepEqual(source.purchaseMax,[2,2,1]);assert.deepEqual(source.salePercent,[50,35,35]);assert.deepEqual(source.defaultPrices,['$0.99','$2.99','$4.99']);assert.equal(source.productPrefix,'catgunner_stargem_pig_');
 const m=freshSourceMetaState(),old=JSON.parse(serializeSourceMetaState(m));delete old.raidStarPig;const next=decodeSourceMetaState(JSON.stringify(old));assert.deepEqual(next.raidStarPig,freshSourceRaidStarPig());assert.deepEqual(next.raid,m.raid);assert.equal(next.petCoin,m.petCoin);
 for(const bad of [null,{...fresh(),gem:-1},{...fresh(),lv:4},{...fresh(),purchaseCount:1.1},{...fresh(),rewardClaims:['a','a']}])assert.throws(()=>decodeSourceRaidStarPig(bad));
});
test('native entry+50, cleared bar+25, capacity clamp, nonpositive no-op, only level3 soldout blocks Add',()=>{
 let s=sourceRaidStarPigEnter(freshSourceRaidStarPig(),7);assert.equal(s.gem,50);assert.equal(s.seasonIndex,7);s=sourceRaidStarPigBar(s);assert.equal(s.gem,75);
 for(let lv=1;lv<=3;lv++){const v={...s,lv,purchaseCount:0};assert.equal(sourceRaidStarPigAdd(v,9999).gem,source.capacity[lv-1]);assert.equal(sourceRaidStarPigAdd(v,0),v);assert.equal(sourceRaidStarPigAdd(v,-1),v);}
 const sold=full(3,1);assert.equal(sourceRaidStarPigAdd(sold,25),sold);assert.equal(sourceRaidStarPigView(sold).soldOut,true);assert.equal(sourceRaidStarPigView(full(2,2)).soldOut,false);
});
test('native product reward grants capacity, equal-level count/promote and cross-product semantic preserved',()=>{
 let s=full();const total=[];
 for(const lv of [1,1,2,2,3]){s={...s,gem:source.capacity[lv-1]};const r=sourceRaidStarPigApplyNative(s,lv);total.push(r.amount);s=r.state;assert.equal(s.gem,0);}
 assert.deepEqual(total,[660,660,1500,1500,2500]);assert.equal(s.lv,3);assert.equal(s.purchaseCount,1);assert.equal(sourceRaidStarPigView(s).purchasable,false);
 const cross=sourceRaidStarPigApplyNative(full(2),1);assert.equal(cross.amount,660);assert.deepEqual(cross.state,full(2));
});
test('weekly reset clears pig but retains adapter replay ledger; same season no-op',()=>{
 const s={...full(3,1),rewardClaims:['old']};assert.equal(sourceRaidStarPigSeason(s,7),s);assert.deepEqual(sourceRaidStarPigSeason(s,8),{lv:1,gem:0,purchaseCount:0,seasonIndex:8,rewardClaims:['old']});
});
test('local transaction success once, duplicate/mismatch/late-season/changed-level/overflow rejected with no grant',()=>{
 const s=full(),r=request(s),res=response(r),win=sourceRaidStarPigReward(s,20,r,res,390);assert.equal(win.amount,660);assert.equal(win.starGem,680);assert.deepEqual(win.state.rewardClaims,['buy']);assert.match(win.reason,/未真实支付/);
 for(const [state,wallet,req,reply,max]of [[win.state,680,r,res,390],[s,20,r,{...res,id:'wrong'},390],[s,20,r,{...res,purpose:'wrong'},390],[sourceRaidStarPigSeason(s,8),20,r,res,390],[full(2),20,r,res,390],[s,2147483647,r,res,390],[s,20,r,res,389],[s,20,{...r,kind:'ad'},res,390],[s,20,r,{...res,onlineVerified:true},390]]){const no=sourceRaidStarPigReward(state,wallet,req,reply,max);assert.equal(no.status,'blocked');assert.equal(no.starGem,wallet);assert.equal(no.state,state);}
 for(const status of ['failure','cancelled','unavailable']){const no=sourceRaidStarPigReward(s,20,r,response(r,status),390);assert.equal(no.status,'blocked');assert.equal(no.state,s);assert.equal(no.starGem,20);}
});
test('business gates distinguish progress/pending/empty/soldout, no common unimplemented fallback',()=>{
 assert.match(sourceRaidStarPigGate(full(),389),/40/);assert.match(sourceRaidStarPigGate(full(),390,true),/等待/);assert.match(sourceRaidStarPigGate(fresh(),390),/尚未装满/);assert.match(sourceRaidStarPigGate(full(3,1),390),/售罄/);assert.equal(sourceRaidStarPigGate(full(),390),'');assert.equal(request(fresh()),null);
});
test('source Reload flags/float32 percentages/default prices; full/empty/soldout are distinct',()=>{
 const h=sourceRaidStarPigHUD({...fresh(),gem:50});assert.equal(h.text['level0:76'],'7%');assert.equal(h.active['level0:974'],false);assert.equal(h.fills['level0:343'],Math.fround(50/660));
 for(const [s,purchase,sold,sale,locked]of [[fresh(),true,false,false,true],[full(),true,false,true,false],[full(3,1),false,true,false,true]]){const p=sourceRaidStarPigPopup(s,390);assert.equal(p.active['level0:1220'],purchase);assert.equal(p.active['level0:10289'],sold);assert.equal(p.active['level0:1723'],sale);assert.equal(p.active['level0:546'],locked);assert.equal(p.text['level0:612'],`Lv.${s.lv}`);assert.equal(p.text['level0:651'],`${Math.min(s.gem,source.capacity[s.lv-1])}/${source.capacity[s.lv-1]}`);assert.equal(p.text['level0:11923'],source.defaultPrices[s.lv-1]);assert.equal(p.text['level0:1823'],`Sale ${source.salePercent[s.lv-1]}%`);}
 assert.equal(sourceRaidStarPigHUD(full()).active['level0:974'],true);
});
test('all source-enabled pig buttons bound, popup real source assets/layout at both requested sizes',()=>{
 const root='/Canvas/Contents_UI/Raid_UI/StarGem_Pig/StarGemPig_UI',map=new Map(sourceRaidStarPigPanelBindings.map(r=>[r.id,r]));
 const buttons=sourceUiTree.nodes.filter(n=>n.path.startsWith(root+'/')&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false));assert.equal(buttons.length,3);for(const n of buttons)assert.ok(map.has(n.id),n.path);
 assert.equal(sourceRaidPanelBindings().find(b=>b.id==='level0:718').action,'raid-star-pig');
 const ids=new Map(sourceUiTree.nodes.map(n=>[n.id,n])),active={};let node=ids.get('level0:1664');while(node){active[node.id]=true;node=ids.get(node.parent);}
 for(const [width,height]of [[390,844],[1080,1920]]){const layouts=solveSourceUiLayout(sourceUiTree,{width,height},{active});for(const {id}of map.values()){const p=layouts.get(id);assert.ok(p.active);assert.ok(p.width>0&&p.height>0);assert.ok(p.x<width&&p.y<height);}}
});
test('client failure/cancel/unavailable/exception never consumes pig or credits balance; fresh retry identity',async()=>{
 for(const outcome of ['failure','cancelled','unavailable']){const s=client({outcome});assert.equal(await s.owner.purchase(),false);assert.deepEqual(s.state,full());assert.equal(s.starGem,20);assert.equal(s.writes.length,0);assert.equal(s.owner.pending,false);await s.owner.purchase();assert.notEqual(s.requests[0].id,s.requests[1].id);}
 const s=client({execute:()=>Promise.reject(Error('transport'))});assert.equal(await s.owner.purchase(),false);assert.equal(s.writes.length,0);assert.match(s.notices.at(-1),/异常/);
});
test('client duplicate click, late reset/context/season/level and ledger replay cannot grant to another save',async()=>{
 for(const change of ['invalidate','context','season','level','ledger']){const d=deferred(),s=client({execute:()=>d.promise});const pending=s.owner.purchase();assert.equal(s.owner.pending,true);assert.equal(await s.owner.purchase(),false);assert.equal(s.requests.length,1);
  if(change==='invalidate'){s.owner.invalidate();s.state=full();}if(change==='context')s.contextID='B';if(change==='season')s.state=sourceRaidStarPigSeason(s.state,8);if(change==='level')s.state=full(2);if(change==='ledger')s.state={...s.state,rewardClaims:[s.requests[0].id]};
  const before=JSON.stringify(s.state);d.resolve(response(s.requests[0]));assert.equal(await pending,false,change);assert.equal(JSON.stringify(s.state),before);assert.equal(s.starGem,20);assert.equal(s.writes.length,0);assert.equal(s.owner.pending,false);
 }
});
test('atomic storage failure retry merges current wallet, does not repeat provider or credit; reset cancels recovery',async()=>{
 const s=client();s.fail=true;assert.equal(await s.owner.purchase(),false);assert.equal(s.owner.saveFailed,true);assert.deepEqual(s.state,full());assert.equal(s.starGem,20);assert.equal(await s.owner.purchase(),false);s.starGem=200;s.fail=false;assert.equal(s.owner.retrySave(),true);assert.equal(s.starGem,860);assert.equal(s.state.purchaseCount,1);assert.equal(s.state.gem,0);assert.equal(s.owner.retrySave(),false);assert.equal(s.requests.length,1);assert.equal(s.writes.length,1);
 const t=client();t.fail=true;await t.owner.purchase();t.owner.invalidate();t.fail=false;assert.equal(t.owner.retrySave(),false);assert.equal(t.starGem,20);
});
