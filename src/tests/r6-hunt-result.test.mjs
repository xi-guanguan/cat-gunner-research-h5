import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceHuntResultReward} from '../r6-hunt-result';
import {freshSourceHuntState,sourceHuntEnter,sourceHuntLevelClear,sourceHuntGiveUp,sourceHuntSweep,sourceHuntExit} from '../r5-hunt';
import {sourceResultContext,sourceResultContextMatches} from '../r6-result-context';
import {createSession} from '../session';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime';
import {sourceHuntPanelProjection,SOURCE_HUNT_PANEL_ROOTS} from '../source-hunt-panel';
import {BigValue} from '../big-value';
const e={plusPack1Active:false,plusPack2Active:true,automaticBonus:false};
function fixture(mode='sweep',auto=false,plus=false){
 const ent={...e,automaticBonus:auto,plusPack1Active:plus};
 let r=mode==='sweep'?sourceHuntSweep(freshSourceHuntState(),10000,ent):sourceHuntGiveUp(sourceHuntLevelClear(sourceHuntEnter(freshSourceHuntState(),ent).value,ent).value);
 const base=r.value.run.accumulatedPetCoin;return {hunt:r.value,petCoin:base*(auto?2:1),claims:[]};
}
const request=s=>({id:'hunt-reward:test',purpose:'hunt:bonus',kind:'ad',run:s.hunt.run});
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
for(const mode of ['sweep','fight'])for(const plus of [false,true]){
 test(`${mode} Plus1=${plus}: async grant is exactly additional1x, closes run and cannot replay`,()=>{
  const s=fixture(mode,false,plus),r=request(s),base=s.petCoin,q=sourceHuntResultReward(s,r,response(r));assert.equal(q.status,'granted');assert.equal(q.amount,base);assert.equal(q.state.petCoin,base*2);assert.equal(q.state.hunt.run,null);assert.equal(s.petCoin,base);assert.equal(s.hunt.run,r.run);
  assert.equal(sourceHuntResultReward(q.state,r,response(r)).status,'duplicate');const r2={...r,id:'other'};assert.equal(sourceHuntResultReward(q.state,r2,response(r2)).status,'blocked');
  const meta={...freshSourceMetaState(),hunt:q.state.hunt,petCoin:q.state.petCoin};const saved=decodeSourceMetaState(serializeSourceMetaState(meta));assert.equal(saved.petCoin,base*2);assert.equal(saved.hunt.run,null);assert.equal(saved.hunt.wave,q.state.hunt.wave);assert.equal(saved.hunt.level,q.state.hunt.level);
 });
}
test('provider four outcomes, identity, purpose, run replacement/close and playing guards are atomic',()=>{
 const s=fixture(),r=request(s);
 for(const status of ['failure','cancelled','unavailable'])assert.equal(sourceHuntResultReward(s,r,response(r,status)).state,s);
 for(const patch of [{id:'wrong'},{purpose:'wrong'},{kind:'purchase'},{provider:'other'},{onlineVerified:true}])assert.equal(sourceHuntResultReward(s,r,{...response(r),...patch}).status,'blocked');
 for(const patch of [{purpose:'wrong'},{kind:'purchase'},{id:' '}]){const r2={...r,...patch};assert.equal(sourceHuntResultReward(s,r2,response(r2)).status,'blocked');}
 for(const hunt of [{...s.hunt,run:{...s.hunt.run}},{...s.hunt,run:null},sourceHuntEnter(freshSourceHuntState()).value])assert.equal(sourceHuntResultReward({...s,hunt},r,response(r)).status,'blocked');
 assert.deepEqual(s.claims,[]);
});
test('automatic2x never gets additional ad1x; overflow does not commit or close',()=>{
 const s=fixture('sweep',true),r=request(s);assert.equal(sourceHuntResultReward(s,r,response(r)).state,s);
 const over={...fixture(),petCoin:Number.MAX_SAFE_INTEGER},rq=request(over);assert.throws(()=>sourceHuntResultReward(over,rq,response(rq)),RangeError);assert.equal(over.hunt.run,rq.run);assert.deepEqual(over.claims,[]);
});
test('result ownership requires actual Hunt panel and exact transient run; reload, transition and new result revoke it',()=>{
 const s=fixture(),session=createSession(),meta={...freshSourceMetaState(),hunt:s.hunt};session.overlay='none';
 assert.equal(sourceResultContext(session,meta),null);const ctx=sourceResultContext(session,meta,true);assert.equal(ctx.kind,'hunt');assert.equal(sourceResultContextMatches(ctx,session,meta,false,true),true);
 for(const [m,transition,panel]of [[meta,false,false],[meta,true,true],[{...meta,hunt:sourceHuntExit(meta.hunt).value},false,true],[decodeSourceMetaState(serializeSourceMetaState(meta)),false,true],[{...meta,hunt:{...meta.hunt,run:{...meta.hunt.run}}},false,true]])assert.equal(sourceResultContextMatches(ctx,session,m,transition,panel),false);
});
test('source Hunt result keeps exits active while reward/purchase pending; mutually exclusive purchase/service banners',()=>{
 const s=fixture(),options={hunt:s.hunt,teamPower:BigValue.fromInteger(10000),maxDisplayStage:12,entitlements:e};const root=SOURCE_HUNT_PANEL_ROOTS.sweep;
 for(const flags of [{pending:true},{purchasePending:true}]){
  const p=sourceHuntPanelProjection({...options,...flags});assert.equal(p.bindings.find(b=>b.path===root+'/Skip_obj/Exit_Btn').enabled,true);assert.equal(p.bindings.find(b=>b.action==='hunt-bonus').enabled,false);assert.equal(p.bindings.find(b=>b.action==='result-remove-ads').enabled,false);
 }
 const purchase=sourceHuntPanelProjection(options),service=sourceHuntPanelProjection({...options,freeCashBanner:{featureEnabled:true,exposureTarget:true}}),owned=sourceHuntPanelProjection({...options,removeAdsAll:true});
 assert.equal(purchase.active[root+'/Remove Ads ALL (Inapp)/Remove_AD_All'],true);assert.equal(purchase.active[root+'/Remove Ads ALL (Inapp)/FreeCash_Banner'],false);assert.equal(service.active[root+'/Remove Ads ALL (Inapp)/Remove_AD_All'],false);assert.equal(service.active[root+'/Remove Ads ALL (Inapp)/FreeCash_Banner'],true);assert.equal(owned.active[root+'/Remove Ads ALL (Inapp)'],false);
});

test('Hunt remove-ads failed persistence leaves original purchase hit region retryable',()=>{
 const f=fixture(),options={hunt:f.hunt,teamPower:BigValue.ZERO,maxDisplayStage:190,entitlements:e,removeAdsAll:false,localProvider:true,purchasePending:true};
 const waiting=sourceHuntPanelProjection(options),retry=sourceHuntPanelProjection({...options,purchaseSaveFailed:true});
 assert(waiting.bindings.filter(b=>b.action==='result-remove-ads').every(b=>!b.enabled));
 assert(retry.bindings.filter(b=>b.action==='result-remove-ads').every(b=>b.enabled));
 assert.equal(retry.text[retry.rootPath+'/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn/Price_txt'],'重试保存');
});
