import test from 'node:test';import assert from 'node:assert/strict';
import {sourceShopPurchase,sourceShopFirstBuy,SOURCE_SHOP_CARDS,sourceRewardAdsRemoved,sourceForcedAdsRemoved} from '../r6-shop.ts';
import {SOURCE_SHOP_CONTENT,SOURCE_SHOP_ROOT,sourceShopProjection,syncSourceShopPanel} from '../source-shop-panel.ts';
import {freshSourceEntitlements,migrateSourceEntitlements,sourceMineEntitlements,sourceBuffMultiplier,sourceApplyPackagePurchase} from '../r5-entitlements.ts';
import {createLocalRewardProvider} from '../r6-reward-provider.ts';
import {freshSourceMetaState,serializeSourceMetaState,decodeSourceMetaState} from '../source-meta-runtime.ts';
import {sourceRemoveAdsPurchase,freshSourceDiaPig,sourceDiaPigAccumulate} from '../r6-diapig.ts';
import {readFileSync} from 'node:fs';
const fresh=()=>({diamonds:12,entitlements:freshSourceEntitlements(),claims:[]});
const req=(purpose,id='txn:1')=>({id,purpose,kind:'purchase'});
const response=(r,status='success')=>({...r,status,provider:'local-test',onlineVerified:false});
for(const [product,flag,amount] of [['autoupgrade_pack','autoUpgradePack',500],['buff_pack','buffPack',1000],['dia_pack','diaPack',16000],['mine_pack','minePack',500]]){
 test(`source non-consumable ${product} first-only diamonds and idempotent restore`,()=>{
  const before=fresh(),r=req(product),a=sourceShopPurchase(before,r,response(r));assert.equal(a.status,'granted');assert.equal(a.amount,amount);assert.equal(a.state.diamonds,12+amount);assert.equal(a.state.entitlements[flag],true);assert.equal(before.entitlements[flag],false);assert.equal(before.diamonds,12);
  assert.equal(sourceShopPurchase(a.state,r,response(r)).status,'duplicate');
  const restore=req(product,'txn:restore'),b=sourceShopPurchase(a.state,restore,response(restore));assert.equal(b.status,'granted');assert.equal(b.amount,0);assert.equal(b.state.diamonds,a.state.diamonds);assert.equal(b.state.claims.length,2);
 });
 for(const status of ['failure','cancelled','unavailable'])test(`${product} ${status} callback does not change any ledger/balance/right`,()=>{const before=fresh(),r=req(product),a=sourceShopPurchase(before,r,response(r,status));assert.equal(a.status,'blocked');assert.equal(a.state,before);assert.equal(a.amount,0);});
}
for(const [i,amount] of [240,600,1500,3500,8000].entries()){
 test(`consumable dia-${i} doubles only first successful buy, all callbacks are transaction-scoped`,()=>{
  const before=fresh(),r=req(`dia-${i}`),failed=sourceShopPurchase(before,r,response(r,'failure'));assert.equal(failed.state,before);assert.equal(sourceShopFirstBuy(before.claims,`dia-${i}`),true);
  const a=sourceShopPurchase(before,r,response(r));assert.equal(a.amount,2*amount);assert.equal(sourceShopFirstBuy(a.state.claims,`dia-${i}`),false);assert.equal(sourceShopPurchase(a.state,r,response(r)).state,a.state);
  const next=req(`dia-${i}`,'txn:2'),b=sourceShopPurchase(a.state,next,response(next));assert.equal(b.amount,amount);assert.equal(b.state.diamonds,12+3*amount);
  const old={...before,claims:[`shop:dia-${i}:legacy-seq`]};assert.equal(sourceShopPurchase(old,r,response(r)).amount,amount);
 });
}
test('shop checks exact provider identity before granting and blocks unknown/prototype products',()=>{
 const r=req('dia_pack');for(const patch of [{id:'wrong'},{purpose:'buff_pack'},{kind:'ad'},{provider:'online'},{onlineVerified:true}])assert.equal(sourceShopPurchase(fresh(),r,{...response(r),...patch}).status,'blocked');
 for(const purpose of ['unknown','toString','__proto__','constructor']){const q=req(purpose);assert.equal(sourceShopPurchase(fresh(),q,response(q)).status,'blocked');}
 for(const bad of [{id:' '},{kind:'ad'},{id:'x'.repeat(241)}]){const q={...r,...bad};assert.equal(sourceShopPurchase(fresh(),q,response(q)).status,'blocked');}
 assert.throws(()=>sourceShopPurchase({...fresh(),diamonds:Number.MAX_SAFE_INTEGER},r,response(r)),RangeError);
 const q=req('dia-4');assert.throws(()=>sourceShopPurchase({...fresh(),diamonds:Number.MAX_SAFE_INTEGER},q,response(q)),RangeError);
});
test('old entitlement migration initializes diaPack false without gifting diamonds/unlocking; malformed present rejected',()=>{
 const old=freshSourceEntitlements();delete old.diaPack;assert.deepEqual(migrateSourceEntitlements(old),freshSourceEntitlements());
 const saved=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));delete saved.entitlements.diaPack;const m=decodeSourceMetaState(JSON.stringify(saved));assert.equal(m.entitlements.diaPack,false);assert.equal(m.petCoin,0);
 for(const v of [undefined,null,0,'false'])assert.throws(()=>migrateSourceEntitlements({...old,diaPack:v}));
});
test('forced ads are not reward ads; all ads source mine/pass consumers are independent of plus',()=>{
 const e=freshSourceEntitlements();e.removeAdsForced=true;assert.equal(sourceForcedAdsRemoved(e),true);assert.equal(sourceRewardAdsRemoved(e),false);assert.equal(sourceMineEntitlements(e).automaticBonus,false);
 e.removeAdsAll=true;assert.equal(sourceRewardAdsRemoved(e),true);assert.equal(sourceMineEntitlements(e).automaticBonus,true);assert.equal(sourceMineEntitlements(e).plusPack1Active,false);assert.equal(sourceBuffMultiplier(e,'money'),1);
 const m=sourceApplyPackagePurchase({diamonds:0,entitlements:e,consumedReceipts:[]},'mine_pack',{confirmed:true,receiptId:'mine'});assert.equal(m.value.entitlements.minePack,true);assert.equal(m.diamondGrant,500);
});
test('remove ads buy through original callback initializes pig before first flag; no immediate diamond grant and duplicate no mutation',()=>{
 const clock={nowUTC:100000,monoSeconds:100,canGrantTimedReward:false,pendingCount:0},state={pig:freshSourceDiaPig(),runtime:{lastTickMono:0},entitlements:freshSourceEntitlements(),claims:[]};
 const r=req('remove_forced_ads'),a=sourceRemoveAdsPurchase(state,r,response(r),clock);assert.equal(a.status,'granted');assert.equal(a.state.pig.diamonds,0);assert.equal(a.state.pig.lastTickUTC,clock.nowUTC);
 assert.equal(sourceRemoveAdsPurchase(a.state,r,response(r),clock).status,'duplicate');
 const tick=sourceDiaPigAccumulate(a.state.pig,a.state.runtime,a.state.entitlements,{...clock,nowUTC:160000,monoSeconds:160});assert.equal(tick.state.diamonds,1);
 const all=req('remove_all_ads','txn:all'),both=sourceRemoveAdsPurchase({...a.state,pig:tick.state,runtime:tick.runtime},all,response(all),{...clock,nowUTC:160000,monoSeconds:160});assert.equal(both.state.entitlements.removeAdsForced,true);assert.equal(both.state.entitlements.removeAdsAll,true);assert.equal(both.state.pig.diamonds,1);
});
test('shop projection retains original cards with specific descriptions and first-buy states, never claims real store connected',()=>{
 const state={...fresh(),localProvider:true,pending:false,notice:''},p=sourceShopProjection(state);for(const c of SOURCE_SHOP_CARDS){const path='/Canvas/SafeArea/Shop_UI/Panel/Scroll View/Viewport/Content/'+c.group+'/'+c.name;assert.equal(p.active[path+'/Purchase_Btn'],true);assert.equal(p.text[path+'/Purchase_Btn/Price_txt'],'本地测试');assert.ok(!p.text[path+'/I2_txt'].includes('暂未接入'));}
 const offline=sourceShopProjection({...state,localProvider:false});assert.ok(Object.values(offline.text).includes('服务未连接'));assert.ok(Object.values(offline.text).some(t=>t.includes('外部服务未连接')));
});
test('source constants exact product identities and raw index mapping remain traceable',()=>{
 const d=JSON.parse(readFileSync('artifacts/evidence/round6-20261002/shop-package-constants.json'));assert.equal(d.elfSHA256,'80eb8bcbebd058ffb4beac5d8d7d544066587a7a1abee8898874847ff13dc583');assert.deepEqual(d.products.map(x=>x.product),['remove_forced_ads','remove_all_ads','autoupgrade_pack','buff_pack','dia_pack','mine_pack']);
 for(const [id,idx] of [[140501,0],[140821,1],[145680,2],[146505,3],[125211,4],[123918,5]]){const raw=readFileSync(`artifacts/evidence/round6-20261002/shop-package-Inapp_Purchase_Panel-${id}.bin`);assert.equal(raw.length,60);assert.equal(raw.readInt32LE(32),idx);}
});
test('one local provider retry shares result but game persistent claims still guard second application',async()=>{
 const provider=createLocalRewardProvider(true),r=req('dia_pack');const [a,b]=await Promise.all([provider.execute(r),provider.execute(r)]);assert.deepEqual(a,b);const next=sourceShopPurchase(fresh(),r,a);assert.equal(sourceShopPurchase(next.state,r,b).status,'duplicate');await assert.rejects(async()=>provider.execute({...r,purpose:'buff_pack'}));
});

// No wall-clock-driven monthly first-buy reset exists in this source version.
import {SOURCE_DIA_FIRST_BUY_SEASON,freshSourceDiaFirstBuyState,sourceDiaFirstBuyLoaded,validateSourceDiaFirstBuyState} from '../r6-shop-lifecycle';
test('source first-buy season is build constant 1; mismatch resets five flags without resetting transaction history',()=>{
 assert.equal(SOURCE_DIA_FIRST_BUY_SEASON,1);const old={season:0,used:[true,true,true,true,true]},claims=['shop:dia-0:legacy','txn:previous'];
 const reset=sourceDiaFirstBuyLoaded(old,claims);assert.deepEqual(reset,freshSourceDiaFirstBuyState());assert.deepEqual(old.used,[true,true,true,true,true]);
 const s={...fresh(),shopFirstBuy:old,claims},r=req('dia-0','txn:new'),a=sourceShopPurchase(s,r,response(r));assert.equal(a.amount,480);assert.equal(a.state.shopFirstBuy.season,1);assert.deepEqual(a.state.shopFirstBuy.used,[true,false,false,false,false]);assert.ok(a.state.claims.includes('txn:previous'));
 const duplicate=req('dia-1','txn:previous');assert.equal(sourceShopPurchase(a.state,duplicate,response(duplicate)).status,'duplicate');
});
test('same season retains flags independently of lifetime receipts; older H5 receipts migrate with no re-gift',()=>{
 const claims=['shop:dia-0:older-envelope','shop:dia-3:another'];const migrate=sourceDiaFirstBuyLoaded(undefined,claims);assert.deepEqual(migrate.used,[true,false,false,true,false]);
 assert.equal(sourceShopFirstBuy(claims,'dia-0'),false);assert.equal(sourceShopFirstBuy(claims,'dia-1'),true);assert.equal(sourceShopFirstBuy(claims,'toString'),false);
 const s={...fresh(),claims},r=req('dia-0');assert.equal(sourceShopPurchase(s,r,response(r)).amount,240);
 const explicit={season:1,used:[false,false,false,false,false]};assert.equal(sourceShopFirstBuy(claims,'dia-0',explicit),true);
 for(const d of [0,1,30,366])assert.deepEqual(sourceDiaFirstBuyLoaded(migrate,claims),migrate,`elapsed ${d} days cannot change build season`);
});
test('first-buy extension validates malformed present data and roundtrip preserves balance, ownership, receipts, flags',()=>{
 for(const bad of [null,{},undefined,{season:1,used:[]},{season:1,used:[false,false,false,false,0]},{season:1.5,used:[false,false,false,false,false]}])assert.throws(()=>validateSourceDiaFirstBuyState(bad));
 const m=freshSourceMetaState();m.shopFirstBuy={season:1,used:[true,false,true,false,true]};assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(m)).shopFirstBuy,m.shopFirstBuy);
 for(const bad of [null,{season:1,used:[]}]){const raw=JSON.parse(serializeSourceMetaState(m));raw.shopFirstBuy=bad;assert.throws(()=>decodeSourceMetaState(JSON.stringify(raw)));}
 const old=JSON.parse(serializeSourceMetaState(m));delete old.shopFirstBuy;assert.equal(decodeSourceMetaState(JSON.stringify(old)).shopFirstBuy,undefined);
});

test('FreeCash shop source exposure stays distinct from SDK unavailable, progression lock and owned state',()=>{
 const s={diamonds:0,entitlements:freshSourceEntitlements(),claims:[],localProvider:true,pending:false,notice:''},path=SOURCE_SHOP_CONTENT+'/Free Reward/FreeCash_Banner';
 for(const freeCashBanner of [undefined,{featureEnabled:false,exposureTarget:false},{featureEnabled:true,exposureTarget:false}])assert.equal(sourceShopProjection({...s,freeCashBanner}).active[path],false);
 assert.equal(sourceShopProjection({...s,freeCashBanner:{featureEnabled:true,exposureTarget:true}}).active[path],true);
});

test('retained source shop refreshes its actual top currency on committed wallet changes',()=>{
 const top=SOURCE_SHOP_ROOT+'/Panel/TopBar/Currency/Dia/Price_txt',state={...fresh(),localProvider:true,pending:false,notice:''},texts={};
 const view={setText:(k,v)=>texts[k]=v,setActive:()=>{}};syncSourceShopPanel(view,{...state,diamonds:123456789});assert.equal(texts[top],'123456789');
 syncSourceShopPanel(view,{...state,diamonds:123457289});assert.equal(texts[top],'123457289');assert.equal(sourceShopProjection({...state,diamonds:0}).text[top],'0');
});
