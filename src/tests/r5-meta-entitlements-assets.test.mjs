import {readFileSync} from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
import {freshSourceEntitlements,migrateSourceEntitlements,sourceApplyPackagePurchase,sourceBuffMultiplier,sourceEntitlementCombatModifiers,sourceMineEntitlements,sourceAutoUpgradeBattle} from '../r5-entitlements.ts';
import {validateAssetReplacement} from '../asset-replacement.ts';
import {createSession,createFieldLevel,sessionCombatModifiers} from '../session.ts';
import {freshSourceMetaState,decodeSourceMetaState,serializeSourceMetaState,developerSourcePackagePurchase,runtimeSourceAutoUpgrade,developerSourceMetaEntitlement} from '../source-meta-runtime.ts';
import {freshPlatformState} from '../local-platform.ts';import {createActivityState} from '../source-activities.ts';
const bundle=()=>({session:{...createSession(19),overlay:'none'},activities:createActivityState(),platform:{...freshPlatformState(),developerEnabled:true},meta:freshSourceMetaState()});
test('old v1 entitlements migrate only absent new fields and explicitly malformed state is rejected',()=>{
 const old=freshSourceEntitlements();for(const key of ['plusPack0Active','autoUpgradePack','buffPack'])delete old[key];
 assert.deepEqual(migrateSourceEntitlements(old),freshSourceEntitlements());
 const envelope=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));envelope.entitlements=old;delete envelope.fish;delete envelope.fishDailyGainDates;
 assert.deepEqual(decodeSourceMetaState(JSON.stringify(envelope)),freshSourceMetaState());
 for(const bad of [null,0,'true',undefined])assert.throws(()=>migrateSourceEntitlements({...old,buffPack:bad}));
 assert.throws(()=>migrateSourceEntitlements({...old,minePack:undefined}));
});
test('source package confirmed receipt grants only first500/1000 diamonds and never mutates caller',()=>{
 const initial={diamonds:12,entitlements:freshSourceEntitlements(),consumedReceipts:[]};
 assert.equal(sourceApplyPackagePurchase(initial,'autoupgrade_pack',{confirmed:false,receiptId:'a'}).status,'blocked');
 assert.equal(sourceApplyPackagePurchase(initial,'other',{confirmed:true,receiptId:'a'}).reason,'unknown-product');
 const first=sourceApplyPackagePurchase(initial,'autoupgrade_pack',{confirmed:true,receiptId:'a'});assert.equal(first.value.diamonds,512);assert.equal(first.value.entitlements.autoUpgradePack,true);
 assert.equal(sourceApplyPackagePurchase(first.value,'autoupgrade_pack',{confirmed:true,receiptId:'a'}).reason,'receipt-already-applied');
 const second=sourceApplyPackagePurchase(first.value,'autoupgrade_pack',{confirmed:true,receiptId:'b'});assert.equal(second.diamondGrant,0);assert.equal(second.value.diamonds,512);
 const buff=sourceApplyPackagePurchase(second.value,'buff_pack',{confirmed:true,receiptId:'c'});assert.equal(buff.value.diamonds,1512);assert.equal(buff.value.entitlements.buffPack,true);
 assert.deepEqual(initial,{diamonds:12,entitlements:freshSourceEntitlements(),consumedReceipts:[]});
 assert.throws(()=>sourceApplyPackagePurchase({...initial,diamonds:Number.MAX_SAFE_INTEGER},'buff_pack',{confirmed:true,receiptId:'x'}),RangeError);
});
test('package runtime applies session meta and developer provider audit atomically',()=>{
 const b=bundle();assert.equal(developerSourcePackagePurchase({...b,platform:{...b.platform,freePurchases:false}},'buff_pack','1').status,'blocked');
 const r=developerSourcePackagePurchase(b,'buff_pack','1');assert.equal(r.status,'granted');assert.equal(r.session.diamonds,b.session.diamonds+1000);assert.equal(r.meta.entitlements.buffPack,true);assert.equal(r.platform.audit.at(-1).amount,1000);
 assert.equal(developerSourcePackagePurchase(r,'buff_pack','1').status,'blocked');assert.equal(developerSourcePackagePurchase(r,'buff_pack','2').session.diamonds,r.session.diamonds);
 assert.deepEqual(decodeSourceMetaState(serializeSourceMetaState(r.meta)),r.meta);
});
test('individual temporary buff3, all temporary buff4 and permanent pack4 are independent from mine bonus',()=>{
 const e=freshSourceEntitlements(),t={money:10,power:0,speed:0};assert.equal(sourceBuffMultiplier(e,'power',t),1);assert.equal(sourceBuffMultiplier(e,'money',t),3);
 assert.equal(sourceBuffMultiplier(e,'money',{money:1,power:1,speed:1}),4);
 e.buffPack=true;for(const kind of ['money','power','speed'])assert.equal(sourceBuffMultiplier(e,kind),4);
 const base=sessionCombatModifiers(createSession(19)),buff=sourceEntitlementCombatModifiers(base,e);assert.equal(buff.permanentDamagePercent,base.permanentDamagePercent);assert.equal(buff.damageBuffMultiplier,4);assert.ok(buff.permanentMoneyPercent.eq(base.permanentMoneyPercent.nativeMultiply(4)));assert.equal(buff.attackSpeedBuff,4);
 assert.equal(sourceMineEntitlements(e).automaticBonus,false);e.automaticBonus=true;e.buffPack=false;assert.equal(sourceBuffMultiplier(e,'power'),1);
});
test('auto upgrade affordable lowest level, serialized Power Speed Money tie order, cap and pause',()=>{
 const b=createFieldLevel(0,0,150,undefined,19),r=sourceAutoUpgradeBattle(b,true);
 assert.deepEqual(r.purchases,[{kind:'power',level:1},{kind:'speed',level:1},{kind:'money',level:1}]);assert.deepEqual(b.upgradeLevels,{power:0,speed:0,money:0});
 const uneven=createFieldLevel(0,0,50,{power:2,speed:0,money:1},19);assert.equal(sourceAutoUpgradeBattle(uneven,true).purchases[0].kind,'speed');
 assert.equal(sourceAutoUpgradeBattle(b,true,true).battle,b);assert.equal(sourceAutoUpgradeBattle(b,false).battle,b);assert.equal(sourceAutoUpgradeBattle({...b,phase:'success'},true).purchases.length,0);
 assert.equal(sourceAutoUpgradeBattle(createFieldLevel(0,0,49,undefined,19),true).purchases.length,0);
 assert.equal(sourceAutoUpgradeBattle({...b,upgradeLevels:{power:10000,speed:10000,money:10000}},true).purchases.length,0);
 const bridge=bundle();bridge.session.battle=b;bridge.meta.entitlements.autoUpgradePack=true;assert.equal(runtimeSourceAutoUpgrade(bridge).session.events.length,3);
});
const asset=()=>({sourceKey:'sharedassets0.assets:516',sourceFile:'sharedassets0.assets',pathID:516,type:'Sprite',sourceSha256:'a'.repeat(64),geometry:{width:128,height:128,pivot:[.5,.5],border:[0,0,0,0],pixelsPerUnit:100,alpha:'present'},animation:{kind:'static',rigSignature:null,durationSeconds:null,frameRate:null}});
const candidate=o=>({sourceKey:o.sourceKey,expectedSourceSha256:o.sourceSha256,url:'/assets/replaced.png',sha256:'b'.repeat(64),geometry:structuredClone(o.geometry),animation:structuredClone(o.animation),provenance:{kind:'manual',description:'painted sprite preserving source contract'}});
test('asset replacement blocks stale source key hash and geometry mismatch including slice pivot alpha and rig',()=>{
 const o=asset(),c=candidate(o);assert.equal(validateAssetReplacement(o,c).compatible,true);
 for(const change of [{sourceKey:'other:516'},{expectedSourceSha256:'c'.repeat(64)},{url:'/assets/%2e%2e/f.png'},{url:'https://a/f.png'},{sha256:'a'}])assert.equal(validateAssetReplacement(o,{...c,...change}).compatible,false);
 for(const change of [{width:127},{pivot:[.6,.5]},{border:[1,0,0,0]},{pixelsPerUnit:50},{alpha:'opaque'}])assert.equal(validateAssetReplacement(o,{...c,geometry:{...c.geometry,...change}}).compatible,false);
 o.animation={...o.animation,kind:'SpriteSkin',rigSignature:'d'.repeat(64)};const rig=candidate(o);assert.equal(validateAssetReplacement(o,rig).compatible,true);assert.equal(validateAssetReplacement(o,{...rig,animation:{...rig.animation,rigSignature:'e'.repeat(64)}}).compatible,false);
});
test('asset registration does not imply font audio shader material spine or animation compatibility',()=>{
 for(const type of ['Font','Material','Shader','TextAsset','Mesh','Cubemap']){const o={...asset(),type};assert.ok(validateAssetReplacement(o,candidate(o)).errors.includes('resource-replacement-contract-unsupported'));}
 const clip={...asset(),type:'AnimationClip',animation:{kind:'clip',rigSignature:null,durationSeconds:1,frameRate:60}},c=candidate(clip);assert.equal(validateAssetReplacement(clip,c).compatible,true);assert.equal(validateAssetReplacement(clip,{...c,animation:{...c.animation,durationSeconds:2}}).compatible,false);
 const o=asset();assert.equal(validateAssetReplacement(o,{...candidate(o),provenance:{kind:'generated',generation:{prompt:'fish',model:'m',provider:'p',references:[],generatedAt:'2026-10-01T00:00:00Z',seed:null}}}).compatible,true);
 assert.equal(validateAssetReplacement(o,{...candidate(o),provenance:{kind:'generated',generation:null}}).compatible,false);assert.equal(validateAssetReplacement(o,null).compatible,false);
});

test('registered asset plans cover every row and explicitly block unresolved contracts',()=>{
 const m=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/assets-inventory.json','utf8'));
 const index=JSON.parse(readFileSync('artifacts/evidence/round5-20261001/assets-contract-index.json','utf8'));assert.equal(index.rows.length,m.assets.length);assert.equal(m.summary.runtimeConsumerUnknown,m.assets.length);assert.equal(m.summary.runtimeConsumerVerified,0);assert.equal(index.runtimeConsumptionUnverified.length,m.assets.length);
 assert.equal(m.schemaVersion,2);assert.equal(m.assets.length,m.summary.registered);assert.equal(m.summary.promptSpecs,m.assets.length);
 assert.equal(m.summary.replacementContracts,m.assets.length);const missing=new Map(m.missingIndex.map(r=>[r.sourceKey,r.fields]));
 for(const a of m.assets){const p=a.promptSpec,c=a.replacementContract;assert.ok(m.sharedStyles[p.sharedStyleRef]);assert.ok(p.prompt.length>0);assert.equal(a.generation,null);assert.equal(c.sourceKey,a.sourceKey);assert.equal(c.sourceSha256,a.sourceSha256);assert.equal(c.fileBytesVerified,false);assert.equal(c.replacementApplied,false);assert.deepEqual(p.assetConstraints.geometry,a.geometry);assert.deepEqual(p.assetConstraints.animation,a.animation);assert.deepEqual(p.missing,c.missing.concat(m.sharedStyles[p.sharedStyleRef].approved?[]:['promptSpec.sharedStyleApproval']));assert.equal(a.consumerEvidence.runtimeConsumerVerified,false);
  assert.equal(index.rows[index.sourceKeyToRow[a.sourceKey]].sourceKey,a.sourceKey);for(const field of c.missing)assert.ok(index.byReplacementMissingField[field].includes(a.sourceKey));for(const field of p.missing)assert.ok(index.byPromptMissingField[field].includes(a.sourceKey));
  if(c.status==='ready-for-candidate'){assert.ok(c.validatorSupported);assert.equal(c.missing.length,0);assert.ok(a.consumers.length>0);assert.ok(a.exports.length>0);}
  else {assert.ok(c.missing.length>0);assert.deepEqual(missing.get(a.sourceKey),c.missing);}
  if(!['Sprite','Texture2D','AnimationClip','AudioClip'].includes(a.type)&&!(a.type==='TextAsset'&&a.animation.kind==='Spine')){assert.equal(c.validatorSupported,false);assert.equal(c.status,'blocked');}
 }
});

test('gun auto merge migration stores only native requested/degree fields and loss of Plus2 closes request',()=>{
 const old=JSON.parse(serializeSourceMetaState(freshSourceMetaState()));delete old.gunAutoMerge;
 assert.deepEqual(decodeSourceMetaState(JSON.stringify(old)).gunAutoMerge,{autoMergeRequested:false,configuredDegree:6});
 const b=bundle();b.meta.entitlements.plusPack2Active=true;b.meta.gunAutoMerge={autoMergeRequested:true,configuredDegree:4,motion:{x:100},remainingCooldown:.2};
 const saved=JSON.parse(serializeSourceMetaState(b.meta));assert.deepEqual(saved.gunAutoMerge,{autoMergeRequested:true,configuredDegree:4});
 const lost=developerSourceMetaEntitlement(b,'plusPack2Active',false);assert.equal(lost.meta.gunAutoMerge.autoMergeRequested,false);assert.equal(lost.meta.gunAutoMerge.configuredDegree,4);
 saved.entitlements.plusPack2Active=false;assert.equal(decodeSourceMetaState(JSON.stringify(saved)).gunAutoMerge.autoMergeRequested,false);
 saved.gunAutoMerge.configuredDegree=99;assert.throws(()=>decodeSourceMetaState(JSON.stringify(saved)),/Invalid gun auto merge/);
});
