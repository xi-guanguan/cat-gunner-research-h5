// MODEL / panel projection / client codecs only; NOT browser, natural Storage, native or live purchase proof.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {sourceEntryPlusVisible,sourceEntryPlusPurchaseGate,sourceEntryPlusPurchaseProjection,SOURCE_ENTRY_PLUS_ITEM} from '../r6-entry-plus';
import {sourceBossPanelProjection,SOURCE_BOSS_PANEL_ROOTS} from '../source-boss-panel';
import {sourceHuntPanelProjection,SOURCE_HUNT_PANEL_ROOTS} from '../source-hunt-panel';
import {freshSourceBossState,sourceBossTimeMax,sourceBossEnter,sourceBossWin} from '../r5-boss';
import {freshSourceHuntState,sourceHuntSweepAble,sourceHuntSweep,sourceHuntReward} from '../r5-hunt';
import {SourceActivityPurchaseClient} from '../activity-purchase-client';
import {createSession,serializeSession,deserializeSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {createActivityState} from '../source-activities';import {freshPlatformState,decodePlatformState} from '../local-platform';
import {SOURCE_WEEKLY,SOURCE_PLUS_DURATION_MS,freshSourcePlus,sourcePlusEntitlements} from '../r6-weekly';
import {BigValue} from '../big-value';
const NOW=new Date(2026,9,6,12).getTime(),e=freshSourceMetaState().entitlements;
const ctx=kind=>({historicMax:190,mode:'field',overlay:'none',localPanel:kind==='boss'?'boss':'monster',running:false});
const root=kind=>(kind==='boss'?SOURCE_BOSS_PANEL_ROOTS:SOURCE_HUNT_PANEL_ROOTS).start;
const itemPath=kind=>root(kind)+'/Banner_PlusPack/'+(kind==='boss'?'Plus_Time':'Plus_Auto');
function projection(kind,{historicMax=190,rights=e,ui={pending:false,localProvider:true},pending=false}={}){
 const common={entitlements: {...rights,automaticBonus:false},historicMax,plusPurchase:ui,pending};
 return kind==='boss'?sourceBossPanelProjection({...common,boss:freshSourceBossState(),realPower:BigValue.from(1e12)}):sourceHuntPanelProjection({...common,hunt:freshSourceHuntState(),maxDisplayStage:Math.floor(historicMax/10)+1,teamPower:BigValue.from(1e12),entryAvailable:true});
}
function harness(kind,status='success'){
 const c={now:NOW,fail:false,ctx:'A',attempts:0,writes:0,requests:[],encoded:null,notes:[],b:{session:{...createSession(),overlay:'none',historicMax:190,plusPack:freshSourcePlus()},meta:freshSourceMetaState(),activities:createActivityState(),platform:freshPlatformState()}};
 let resolve;c.response=new Promise(r=>resolve=r);c.release=()=>resolve();
 c.owner=new SourceActivityPurchaseClient({read:()=>({bundle:c.b,contextID:c.ctx}),clock:()=>c.now,requestID:()=>kind+'-receipt',execute:async q=>{c.requests.push(q);await c.response;return {...q,status,provider:'local-test',onlineVerified:false};},write:b=>{c.attempts++;if(c.fail)throw Error('quota');assert.equal(c.b.meta.entitlements[kind==='boss'?'plusPack0Active':'plusPack2Active'],false);const envelope=JSON.parse(serializeSession(b.session));envelope.meta=JSON.parse(serializeSourceMetaState(b.meta));envelope.activities=b.activities;envelope.platform=b.platform;c.encoded=JSON.stringify(envelope);c.writes++;c.b=b;},notice:n=>c.notes.push(n)});return c;
}
for(const kind of ['boss','hunt']){
 const index=SOURCE_ENTRY_PLUS_ITEM[kind],flag=kind==='boss'?'plusPack0Active':'plusPack2Active',other=kind==='boss'?'plusPack2Active':'plusPack0Active',action=kind+'-plus-purchase';
 for(const stage of [109,110,189,190,191,999])test(`${kind} source banner stage ${stage}`,()=>{assert.equal(sourceEntryPlusVisible(kind,stage,e),stage>=190);const p=projection(kind,{historicMax:stage});assert.equal(p.active[root(kind)+'/Banner_PlusPack'],stage>=190);assert.equal(p.bindings.find(b=>b.action===action).enabled,stage>=190);});
 test(`${kind} only its own Plus type hides the banner`,()=>{assert(!sourceEntryPlusVisible(kind,190,{...e,[flag]:true}));assert(sourceEntryPlusVisible(kind,190,{...e,[other]:true}));const p=projection(kind,{rights:{...e,[flag]:true}});assert.equal(p.active[root(kind)+'/Banner_PlusPack'],false);assert(!p.bindings.find(b=>b.action===action).enabled);});
 test(`${kind} admission validates source product, context, run and independent rights`,()=>{
  assert.equal(sourceEntryPlusPurchaseGate(kind,index,ctx(kind),e),undefined);
  for(const patch of [{localPanel:'weekly'},{localPanel:'none'},{mode:'boss'},{mode:'boss-result'},{overlay:'gun'},{running:true},{historicMax:189}])assert(sourceEntryPlusPurchaseGate(kind,index,{...ctx(kind),...patch},e));
  assert(sourceEntryPlusPurchaseGate(kind,1,ctx(kind),e));assert(sourceEntryPlusPurchaseGate(kind,index,ctx(kind),{...e,[flag]:true}));assert.equal(sourceEntryPlusPurchaseGate(kind,index,ctx(kind),{...e,[other]:true}),undefined);
 });
 for(const ui of [{pending:false,localProvider:true},{pending:false,localProvider:false},{pending:true,localProvider:true},{pending:true,saveFailedProduct:SOURCE_WEEKLY.plusProducts[index]},{pending:true,saveFailedProduct:SOURCE_WEEKLY.plusProducts[1]}])test(`${kind} exact product retry/price ${JSON.stringify(ui)}`,()=>{
  const p=projection(kind,{ui}),q=sourceEntryPlusPurchaseProjection(kind,ui),retry=ui.saveFailedProduct===SOURCE_WEEKLY.plusProducts[index];
  assert.equal(p.text[itemPath(kind)+'/NonPurchase_Panel/Price_txt'],q.price);assert.equal(q.price,retry?'重试保存':ui.pending?'等待回调':ui.localProvider?'本地测试购买':'服务未连接');assert.equal(p.bindings.find(b=>b.path===itemPath(kind)).enabled,!ui.pending||retry);assert.equal(p.active[itemPath(kind)+'/Active_Panel'],false);assert.equal(p.active[itemPath(kind)+'/NonPurchase_Panel'],true);
 });
 test(`${kind} preparing/other blocking operations disable actions without hiding source banner`,()=>{const p=projection(kind,{pending:true});assert(p.active[root(kind)+'/Banner_PlusPack']);assert(p.bindings.filter(b=>b.action!=='hunt-exit').every(b=>!b.enabled));});
 test(`${kind} seven-day expiry exposes original entry again without shortening legacy rights`,()=>{
  const s={...freshSourcePlus(),purchasedUTC:[null,null,null]};s.purchasedUTC[index]=NOW;
  assert.equal(projection(kind,{rights:sourcePlusEntitlements(s,e,NOW+SOURCE_PLUS_DURATION_MS-1)}).active[root(kind)+'/Banner_PlusPack'],false);
  assert.equal(projection(kind,{rights:sourcePlusEntitlements(s,e,NOW+SOURCE_PLUS_DURATION_MS)}).active[root(kind)+'/Banner_PlusPack'],true);
  assert.equal(projection(kind,{rights:sourcePlusEntitlements(freshSourcePlus(),{...e,[flag]:true},NOW+SOURCE_PLUS_DURATION_MS)}).active[root(kind)+'/Banner_PlusPack'],false);
 });
 for(const status of ['success','failure','cancelled','unavailable'])test(`${kind} local provider ${status} across panel close; persist-first/codec/consumer`,async()=>{
  const c=harness(kind,status),before=c.b;assert.equal(sourceEntryPlusPurchaseGate(kind,index,ctx(kind),e),undefined);
  const result=c.owner.request('plus',index);assert(c.owner.pending);const closed={...ctx(kind),localPanel:'none'};assert(sourceEntryPlusPurchaseGate(kind,index,closed,e));assert.equal(c.b,before);c.release();assert.equal(await result,status==='success');assert.equal(c.requests.length,1);
  assert.equal(c.writes,status==='success'?1:0);if(status!=='success'){assert.equal(c.b,before);return;}
  const decoded=JSON.parse(c.encoded),session=deserializeSession(c.encoded),meta=decodeSourceMetaState(JSON.stringify(decoded.meta)),platform=decodePlatformState(JSON.stringify(decoded.platform));
  assert(meta.entitlements[flag]);assert(!meta.entitlements[other]);assert.equal(session.plusPack.purchasedUTC[index],NOW);assert.deepEqual(platform.claims,[kind+'-receipt']);assert(!c.owner.retrySave('plus',index));
  if(kind==='boss'){assert.equal(sourceBossTimeMax(meta.entitlements),120);assert.equal(sourceBossEnter(freshSourceBossState(),{...meta.entitlements,automaticBonus:false}).value.run.remainingSec,120);assert(!meta.entitlements.plusPack2Active);}else{const he={...meta.entitlements,automaticBonus:false};assert(sourceHuntSweepAble(freshSourceHuntState(),1e12,he));const swept=sourceHuntSweep(freshSourceHuntState(),1e12,he);assert.equal(swept.status,'supported');assert(swept.petCoinGrant>0);assert.equal(sourceHuntReward(he),30);}
 });
 test(`${kind} failed save retries same receipt/product, current wallet, no second provider`,async()=>{
  const c=harness(kind),before=c.b;c.fail=true;const result=c.owner.request('plus',index);c.release();assert(!await result);assert.equal(c.b,before);assert(c.owner.saveFailed);assert.equal(c.writes,0);
  c.fail=false;assert(!c.owner.retrySave('plus',1));assert.equal(c.attempts,1);c.now+=5000;c.b={...c.b,session:{...c.b.session,diamonds:321}};assert(c.owner.retrySave('plus',index));assert.equal(c.requests.length,1);assert.equal(c.writes,1);assert.equal(c.b.session.diamonds,321);assert.equal(c.b.session.plusPack.purchasedUTC[index],NOW+5000);assert.equal(projection(kind,{rights:c.b.meta.entitlements}).active[root(kind)+'/Banner_PlusPack'],false);
 });
 for(const invalidate of [false,true])test(`${kind} reset/context rejects stale callback ${invalidate}`,async()=>{
  const c=harness(kind),before=c.b,r=c.owner.request('plus',index);if(invalidate)c.owner.invalidate();else c.ctx='B';c.release();assert(!await r);assert.equal(c.b,before);assert.equal(c.writes,0);
 });
}
test('banner source contract matches original serialized types and native SetActive guard',()=>{
 const raw=JSON.parse(readFileSync('artifacts/evidence/round6-20261002/entry-plus-methods.json'));
 assert.equal(raw.elfSha256,'80eb8bcbebd058ffb4beac5d8d7d544066587a7a1abee8898874847ff13dc583');assert.deepEqual(raw.items.map(x=>[x.component,x.type,x.is_banner]),[[126114,0,true],[146256,2,true]]);assert.match(raw.setActiveICall,/GameObject::SetActive_Injected/);
});
test('results never acquire a start-banner purchase action',()=>{const entitlements={...e,automaticBonus:false},won=sourceBossWin(sourceBossEnter(freshSourceBossState(),entitlements).value,entitlements).value;const p=sourceBossPanelProjection({boss:won,realPower:BigValue.from(1e12),historicMax:190,entitlements});assert(!p.bindings.some(b=>b.action==='boss-plus-purchase'));});

test('newly exposed banners translate serialized labels, preserving original benefit values',()=>{
 const labels={boss:['时间套餐（7天）','关卡时间上限','首领时间上限','矿场时间上限'],hunt:['便利套餐（7天）','副本扫荡不限次数','探索缩短16小时','自动合成']};
 for(const kind of ['boss','hunt']){
  const p=projection(kind),base=itemPath(kind),paths=['/Name_txt',...['1','3','2'].map(i=>`/Explain/I2_txt(Outline) (${i})`)];
  assert.deepEqual(paths.map(path=>p.text[base+path]),labels[kind]);
  assert(!Object.keys(p.text).some(path=>path.startsWith(base)&&path.endsWith('Value_txxt')));
 }
});
