import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAssetReplacement,validateAssetReplacementManifest,resolveAssetReplacement} from '../asset-replacement.ts';
const root='artifacts/evidence/round5-20261001/';
const hash='a'.repeat(64);
const geometry={width:32,height:32,pivot:[.5,.5],border:[0,0,0,0],pixelsPerUnit:100,alpha:'present'};
const base=(type='Sprite',kind='static')=>({sourceKey:'fixture.assets:1',sourceFile:'fixture.assets',pathID:1,type,sourceSha256:hash,geometry,animation:{kind,rigSignature:kind==='Spine'?'c'.repeat(64):null,durationSeconds:null,frameRate:null},evidence:['synthetic unit fixture, not source proof'],exports:[{url:'/assets/source.png'}],replacementContract:{status:'ready-for-candidate',validatorSupported:true,missing:[],sourceKey:'fixture.assets:1',sourceSha256:hash,media:null}});
const candidate=source=>({sourceKey:source.sourceKey,expectedSourceSha256:source.sourceSha256,url:'/assets/example.png',sha256:'b'.repeat(64),geometry:structuredClone(source.geometry),animation:structuredClone(source.animation),media:structuredClone(source.replacementContract.media),provenance:{kind:'manual',description:'Synthetic unit candidate, never installed'}});
const manifest=entries=>({schemaVersion:1,sourceInventory:{path:'fixture-inventory.json',sha256:hash},entries});
test('manifest maps stable keys and fails the entire resolve on duplicate, stale hash or absent source evidence/provenance',()=>{
 const source=base(),c=candidate(source),inventory={assets:[source]},m=manifest([c]);
 assert.equal(validateAssetReplacementManifest(m,inventory,hash).valid,true);
 assert.equal(resolveAssetReplacement(m,inventory,hash,source.sourceKey).status,'replaced');
 for(const changed of [manifest([c,c]),{...m,sourceInventory:{path:'fixture',sha256:'d'.repeat(64)}},{...m,sourceInventory:{sha256:hash}},manifest([{...c,expectedSourceSha256:'d'.repeat(64)}]),manifest([{...c,provenance:null}]),manifest([{...c,sourceKey:'absent:2'}])]){
  assert.equal(validateAssetReplacementManifest(changed,inventory,hash).valid,false);assert.equal(resolveAssetReplacement(changed,inventory,hash,source.sourceKey).status,'blocked');
 }
 assert.equal(validateAssetReplacementManifest(m,{assets:[{...source,evidence:[]}]},hash).valid,false);
 assert.equal(validateAssetReplacementManifest(m,{assets:[source,source]},hash).valid,false);
 assert.equal(validateAssetReplacementManifest(m,{assets:[{...source,replacementContract:{...source.replacementContract,missing:['consumerBindings'],status:'blocked'}}]},hash).valid,false);
 assert.equal(resolveAssetReplacement(manifest([]),inventory,hash,source.sourceKey).status,'original');
 assert.equal(resolveAssetReplacement(manifest([]),inventory,hash,'absent').status,'blocked');
 c.expectedSourceSha256='e'.repeat(64);assert.equal(resolveAssetReplacement(m,inventory,hash,source.sourceKey).status,'blocked');
});
test('audio checks every known field and blocks unknown loop points or loudness',()=>{
 const source=base('AudioClip');source.replacementContract.media={kind:'audio',sampleRate:48000,channels:2,duration:3,loopPoints:[0,3],loudness:{method:'fixture measurement',value:-20,unit:'dBFS'}};
 const c=candidate(source);assert.equal(validateAssetReplacement(source,c).compatible,true);
 for(const changed of [{sampleRate:44100},{channels:1},{duration:2},{loopPoints:[0,2]},{loudness:{method:'fixture measurement',value:-10,unit:'dBFS'}}])assert.equal(validateAssetReplacement(source,{...c,media:{...c.media,...changed}}).compatible,false);
 source.replacementContract.media.loopPoints=null;assert.ok(validateAssetReplacement(source,c).errors.includes('media.loopPoints-unknown'));
});
test('Spine preserves rig, version, atlas, attachments and event timeline, with hashed local companion files',()=>{
 const source=base('TextAsset','Spine');source.replacementContract.media={kind:'spine',skeletonVersion:'4.1.24',atlasPages:[{name:'page.png',width:128,height:128,pma:true,filter:'Linear,Linear'}],slotAttachments:[],animationEventTimeline:{Idle:[],Attack:[{time:.2,name:'Attack'}]}};
 const c=candidate(source);c.files=[{role:'atlas',name:'skeleton.atlas',url:'/assets/skeleton.atlas',sha256:hash},{role:'texture',name:'page.png',url:'/assets/page.png',sha256:hash}];assert.equal(validateAssetReplacement(source,c).compatible,true);
 for(const changed of [{skeletonVersion:'3.8'},{atlasPages:[{...c.media.atlasPages[0],width:256}]},{slotAttachments:[{skin:'default',slot:'body',attachment:'body',type:'region',path:null}]},{animationEventTimeline:{Idle:[],Attack:[]}}])assert.equal(validateAssetReplacement(source,{...c,media:{...c.media,...changed}}).compatible,false);
 assert.equal(validateAssetReplacement(source,{...c,files:[]}).compatible,false);
 source.replacementContract.media.atlasPages=null;assert.equal(validateAssetReplacement(source,c).compatible,false);
});
test('sequence and particle contracts reject changed timing, geometry, topology or unknown consumer bindings',()=>{
 const sequence=base('Sprite','sequence');sequence.replacementContract.media={kind:'sequence',frameKeys:['fixture.assets:1','fixture.assets:2'],frameRate:12,loop:true,frameGeometry:[geometry,geometry]};const c=candidate(sequence);assert.equal(validateAssetReplacement(sequence,c).compatible,true);
 assert.equal(validateAssetReplacement(sequence,{...c,media:{...c.media,frameRate:24}}).compatible,false);
 sequence.replacementContract.media.frameGeometry=null;assert.equal(validateAssetReplacement(sequence,c).compatible,false);
 const particle=base('ParticleSystem','particle');particle.replacementContract.media={kind:'particle',duration:1,loop:true,simulationSpace:1,emissionSignature:hash,renderSignature:hash,consumerBindingsSignature:hash};const pc=candidate(particle);assert.equal(validateAssetReplacement(particle,pc).compatible,true);
 assert.equal(validateAssetReplacement(particle,{...pc,media:{...pc.media,emissionSignature:'d'.repeat(64)}}).compatible,false);
 particle.replacementContract.media.consumerBindingsSignature=null;assert.equal(validateAssetReplacement(particle,pc).compatible,false);
});
test('real source inventory example validates and resolves only declarations; it never installs or claims byte verification',()=>{
 const bytes=readFileSync(root+'assets-inventory.json'),inventory=JSON.parse(bytes),inventoryHash=createHash('sha256').update(bytes).digest('hex'),m=JSON.parse(readFileSync(root+'assets-replacement-manifest.example.json'));
 assert.equal(validateAssetReplacementManifest(m,inventory,inventoryHash).valid,true);
 const result=resolveAssetReplacement(m,inventory,inventoryHash,m.entries[0].sourceKey);assert.equal(result.status,'replaced');assert.equal(result.fileBytesVerified,false);assert.equal(result.replacementApplied,false);
 for(const source of inventory.assets.filter(s=>s.type==='AudioClip')){assert.equal(source.replacementContract.media.kind,'audio');assert.equal(source.replacementContract.media.loopPoints,null);assert.equal(source.replacementContract.status,'blocked');assert.equal(validateAssetReplacement(source,candidate(source)).compatible,false);}
 const spines=inventory.assets.filter(s=>s.animation.kind==='Spine');assert.equal(spines.length,13);for(const source of spines){assert.equal(source.replacementContract.media.kind,'spine');assert.ok(source.replacementContract.media.skeletonVersion);assert.ok(source.replacementContract.media.slotAttachments);assert.ok(source.replacementContract.media.animationEventTimeline);}
});
