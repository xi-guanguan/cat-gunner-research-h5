/** Declarative replacement contracts. Validation never installs or applies an asset. */
export type AssetCategory='ui'|'character'|'weapon'|'projectile'|'enemy'|'environment'|'audio'|'font'|'animation'|'material'|'atlas'|'shader'|'data'|'unassigned';
export type AssetAnimationKind='static'|'SpriteSkin'|'Spine'|'clip'|'sequence'|'particle'|'unknown';
export interface AssetGeometry {width:number|null;height:number|null;pivot:[number,number]|null;border:[number,number,number,number]|null;pixelsPerUnit:number|null;alpha:'present'|'opaque'|'unknown'}
export interface AssetAnimation {kind:AssetAnimationKind;rigSignature:string|null;durationSeconds:number|null;frameRate:number|null}
/** Source facts only. null blocks compatibility; empty collections mean a proven empty collection. */
export interface AssetAudioMedia {
  kind:'audio';sampleRate:number|null;channels:number|null;duration:number|null;
  loopPoints:[number,number]|null;loudness:{method:string;value:number;unit:string}|null;
}
export interface AssetSequenceMedia {
  kind:'sequence';frameKeys:string[]|null;frameRate:number|null;loop:boolean|null;
  frameGeometry:AssetGeometry[]|null;
}
export interface AssetSpineMedia {
  kind:'spine';skeletonVersion:string|null;
  atlasPages:{name:string;width:number;height:number;pma:boolean|null;filter:string|null}[]|null;
  slotAttachments:{skin:string;slot:string;attachment:string;type:string;path:string|null}[]|null;
  animationEventTimeline:Record<string,{time:number;name:string;int?:number;float?:number;string?:string}[]>|null;
}
export interface AssetParticleMedia {
  kind:'particle';duration:number|null;loop:boolean|null;simulationSpace:number|null;
  emissionSignature:string|null;renderSignature:string|null;consumerBindingsSignature:string|null;
}
export type AssetMedia=AssetAudioMedia|AssetSequenceMedia|AssetSpineMedia|AssetParticleMedia|{kind:'unsupported';constraints:Record<string,unknown>};
export interface AssetConsumer {path:string;role:string;evidence:string;status:'source-reference'|'h5-reference'}
/** A source/H5 reference is not proof of executed runtime consumption or native effect parity. */
export interface AssetConsumerEvidence {sourceReferenceCount:number;h5ReferenceCount:number;runtimeConsumerVerified:false;nativeEffectParity:null;meaning:string}
/** Planning is explicit and remains separate from generation provenance. Unknown constraints stay null. */
export interface AssetPromptSpec {
  schemaVersion:1;sharedStyleRef:string;subject:string;sourceReferences:string[];
  assetConstraints:{geometry:AssetGeometry;animation:AssetAnimation;consumerRoles:string[]|null;media:AssetMedia|null};
  prompt:string;negativePrompt:string;missing:string[];
}
export interface AssetReplacementContract {
  schemaVersion:1;sourceKey:string;sourceSha256:string;validatorSupported:boolean;status:'ready-for-candidate'|'blocked';
  geometry:AssetGeometry;animation:AssetAnimation;consumerBindings:AssetConsumer[]|null;
  media:AssetMedia|null;preserve:string[];missing:string[];
  fileBytesVerified:false;replacementApplied:false;
}
export interface RegisteredAssetInventory {
  schemaVersion:2;scope:Record<string,unknown>;inputs:{path:string;sha256:string}[];
  sharedStyles:Record<string,{description:string;referencePolicy:string;approved:boolean}>;
  summary:Record<string,unknown>;assets:RegisteredSourceAsset[];
  missingIndex:{sourceKey:string;fields:string[]}[];promptMissingIndex:{sourceKey:string;fields:string[]}[];
  indexFiles:{resourceLookup:string;flatResourceLookup:string;missingSummary:string};limitations:string[];
}
export interface RegisteredSourceAsset {
  sourceKey:string;sourceFile:string;pathID:number;type:string;name:string;category:AssetCategory;
  sourceSha256:string;sourceBytes:number;geometry:AssetGeometry;animation:AssetAnimation;
  exports:{url:string;sha256:string;bytes:number;width:number|null;height:number|null}[];
  consumers:AssetConsumer[];consumerStatus:'known'|'unknown';consumerEvidence:AssetConsumerEvidence;evidence:string[];unknown:string[];
  promptSpec:AssetPromptSpec;replacementContract:AssetReplacementContract;
  generation:AssetGeneration|null;replacementStatus:'original'|'planned'|'validated';
}
export interface AssetGeneration {prompt:string;model:string;provider:string;references:string[];generatedAt:string;seed:string|null}
export interface AssetReplacementCandidate {
  sourceKey:string;expectedSourceSha256:string;url:string;sha256:string;geometry:AssetGeometry;animation:AssetAnimation;
  media?:AssetMedia|null;files?:{role:'atlas'|'texture';name:string;url:string;sha256:string}[];
  provenance:{kind:'generated';generation:AssetGeneration}|{kind:'manual';description:string};
}
export interface AssetReplacementValidation {compatible:boolean;errors:string[]}
const hash=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const pairEqual=(a:readonly number[]|null,b:readonly number[]|null,length:number)=>Array.isArray(a)&&Array.isArray(b)&&a.length===length&&b.length===length&&a.every((n,i)=>Number.isFinite(n)&&n===b[i]);
/** A stale hash or missing geometry/rig evidence blocks replacement, even if a PNG looks plausible. */
export function validateAssetReplacement(original:RegisteredSourceAsset,candidate:AssetReplacementCandidate):AssetReplacementValidation {
  const errors:string[]=[];
  if(!original||!candidate||!original.geometry||!candidate.geometry||!original.animation||!candidate.animation||!candidate.provenance)return {compatible:false,errors:['malformed-replacement-contract']};
  // Other registered source types need their own media/font/material/topology contracts.
  if(!['Sprite','Texture2D','AnimationClip','AudioClip'].includes(original.type)&&!(original.type==='TextAsset'&&original.animation.kind==='Spine')&&!(original.type==='ParticleSystem'&&original.animation.kind==='particle'))errors.push('resource-replacement-contract-unsupported');
  if(original.sourceKey!==`${original.sourceFile}:${original.pathID}`||candidate.sourceKey!==original.sourceKey)errors.push('source-key-mismatch');
  if(!hash(original.sourceSha256)||candidate.expectedSourceSha256!==original.sourceSha256)errors.push('source-hash-mismatch');
  if(!hash(candidate.sha256))errors.push('invalid-replacement-hash');
  if(!localUrl(candidate.url))errors.push('invalid-local-asset-url');
  const raster=original.type==='Sprite'||original.type==='Texture2D'||original.type==='RenderTexture'||original.type==='Cubemap';
  if(raster) {
    for(const k of ['width','height'] as const) {
      const dimension=original.geometry[k];
      if(dimension===null||!Number.isInteger(dimension)||dimension<=0||dimension!==candidate.geometry[k])errors.push(`${k}-mismatch-or-unknown`);
    }
    if(!['present','opaque'].includes(original.geometry.alpha))errors.push('source-alpha-unknown');
    else if(candidate.geometry.alpha!==original.geometry.alpha)errors.push('alpha-contract-mismatch');
  }
  if(original.type==='Sprite') {
    if(!pairEqual(original.geometry.pivot,candidate.geometry.pivot,2))errors.push('pivot-mismatch-or-unknown');
    if(!pairEqual(original.geometry.border,candidate.geometry.border,4))errors.push('nine-slice-mismatch-or-unknown');
    if(original.geometry.pixelsPerUnit===null||!Number.isFinite(original.geometry.pixelsPerUnit)||original.geometry.pixelsPerUnit<=0||candidate.geometry.pixelsPerUnit!==original.geometry.pixelsPerUnit)errors.push('pixels-per-unit-mismatch-or-unknown');
  }
  const allowedAnimation=original.type==='Sprite'?['static','SpriteSkin','sequence']:original.type==='Texture2D'?['static']:original.type==='AnimationClip'?['clip']:original.type==='AudioClip'?['static']:original.type==='TextAsset'?['Spine']:original.type==='ParticleSystem'?['particle']:[];
  if(!allowedAnimation.includes(original.animation.kind)||candidate.animation.kind!==original.animation.kind)errors.push('animation-kind-mismatch-or-unknown');
  if(['SpriteSkin','Spine'].includes(original.animation.kind)&&(!hash(original.animation.rigSignature)||candidate.animation.rigSignature!==original.animation.rigSignature))errors.push('rig-mismatch-or-unknown');
  if(original.animation.kind==='clip') {
    for(const k of ['durationSeconds','frameRate'] as const)if(original.animation[k]===null||!Number.isFinite(original.animation[k])||candidate.animation[k]!==original.animation[k])errors.push(`${k}-mismatch-or-unknown`);
  }
  validateMedia(original,candidate,errors);
  if(candidate.provenance.kind==='generated') {
    const g=candidate.provenance.generation;
    if(!g||typeof g.prompt!=='string'||!g.prompt.trim()||typeof g.model!=='string'||!g.model.trim()||typeof g.provider!=='string'||!g.provider.trim()||!Array.isArray(g.references)||g.references.some(r=>typeof r!=='string'||!r.trim())||typeof g.generatedAt!=='string'||!Number.isFinite(Date.parse(g.generatedAt))||!(g.seed===null||typeof g.seed==='string'))errors.push('incomplete-generation-provenance');
  } else if(candidate.provenance.kind!=='manual'||typeof candidate.provenance.description!=='string'||!candidate.provenance.description.trim())errors.push('incomplete-manual-provenance');
  return {compatible:errors.length===0,errors};
}

const localUrl=(url:unknown)=>typeof url==='string'&&/^\/assets\/[A-Za-z0-9_./ -]+$/.test(url)&&!url.includes('..')&&!url.endsWith('/');
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
function validateMedia(original:RegisteredSourceAsset,candidate:AssetReplacementCandidate,errors:string[]):void {
  const required=original.type==='AudioClip'?'audio':original.animation.kind==='Spine'?'spine':original.animation.kind==='sequence'?'sequence':original.animation.kind==='particle'?'particle':null;
  if(!required)return;
  const source=original.replacementContract?.media,replacement=candidate.media;
  if(!source||source.kind!==required||!replacement||replacement.kind!==required){errors.push('media-kind-mismatch-or-unknown');return;}
  const fields=required==='audio'?['sampleRate','channels','duration','loopPoints','loudness']:required==='spine'?['skeletonVersion','atlasPages','slotAttachments','animationEventTimeline']:required==='sequence'?['frameKeys','frameRate','loop','frameGeometry']:['duration','loop','simulationSpace','emissionSignature','renderSignature','consumerBindingsSignature'];
  if(source.kind==='spine'&&((source.atlasPages!==null&&!Array.isArray(source.atlasPages))||(source.slotAttachments!==null&&!Array.isArray(source.slotAttachments))||(source.animationEventTimeline!==null&&(typeof source.animationEventTimeline!=='object'||Array.isArray(source.animationEventTimeline))))){errors.push('malformed-source-spine');return;}
  if(source.kind==='sequence'&&((source.frameKeys!==null&&!Array.isArray(source.frameKeys))||(source.frameGeometry!==null&&!Array.isArray(source.frameGeometry)))){errors.push('malformed-source-sequence');return;}
  const sourceRecord=source as unknown as Record<string,unknown>;
  const replacementRecord=replacement as unknown as Record<string,unknown>;
  for(const field of fields){const value=sourceRecord[field];if(value===null||value===undefined)errors.push(`media.${field}-unknown`);else if(canonical(value)!==canonical(replacementRecord[field]))errors.push(`media.${field}-mismatch`);}
  const finite=(v:unknown,min:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min;
  if(source.kind==='audio'){
    if(!Number.isInteger(source.sampleRate)||!finite(source.sampleRate,1)||!Number.isInteger(source.channels)||!finite(source.channels,1)||!finite(source.duration,0))errors.push('invalid-source-audio-facts');
    if(source.loopPoints&&(!pairEqual(source.loopPoints,source.loopPoints,2)||source.loopPoints[0]<0||source.loopPoints[1]<source.loopPoints[0]||source.loopPoints[1]>(source.duration??0)))errors.push('invalid-source-loop-points');
    if(source.loudness&&(typeof source.loudness.method!=='string'||!source.loudness.method.trim()||typeof source.loudness.unit!=='string'||!source.loudness.unit.trim()||!Number.isFinite(source.loudness.value)))errors.push('invalid-source-loudness');
  } else if(source.kind==='spine'){
    if(typeof source.skeletonVersion!=='string'||!source.skeletonVersion.trim()||!Array.isArray(source.atlasPages)||source.atlasPages.length===0||source.atlasPages.some(p=>!p||typeof p.name!=='string'||!p.name.trim()||!Number.isInteger(p.width)||p.width<=0||!Number.isInteger(p.height)||p.height<=0||typeof p.pma!=='boolean'||typeof p.filter!=='string'||!p.filter.trim()))errors.push('invalid-or-incomplete-source-atlas');
    if(!Array.isArray(source.slotAttachments)||source.slotAttachments.some(a=>!a||typeof a.skin!=='string'||!a.skin.trim()||typeof a.slot!=='string'||!a.slot.trim()||typeof a.attachment!=='string'||!a.attachment.trim()||typeof a.type!=='string'||!a.type.trim()))errors.push('invalid-source-attachments');
    if(!source.animationEventTimeline||!Object.keys(source.animationEventTimeline).length||Object.values(source.animationEventTimeline).some(events=>!Array.isArray(events)||events.some(e=>!e||!finite(e.time,0)||typeof e.name!=='string'||!e.name.trim())))errors.push('invalid-source-event-timeline');
    const files=candidate.files;
    if(!Array.isArray(files)||!files.some(f=>f?.role==='atlas')||source.atlasPages?.some(p=>!p||!files.some(f=>f?.role==='texture'&&f.name===p.name)))errors.push('missing-spine-companion-files');
  } else if(source.kind==='sequence'){
    if(!Array.isArray(source.frameKeys)||source.frameKeys.length===0||source.frameKeys.some(k=>typeof k!=='string'||!k.trim())||!finite(source.frameRate,Number.MIN_VALUE)||typeof source.loop!=='boolean'||!Array.isArray(source.frameGeometry)||source.frameGeometry.length!==source.frameKeys?.length||source.frameGeometry.some(g=>!g||!finite(g.width,1)||!finite(g.height,1)||!pairEqual(g.pivot,g.pivot,2)||!pairEqual(g.border,g.border,4)||!finite(g.pixelsPerUnit,Number.MIN_VALUE)||g.alpha==='unknown'))errors.push('invalid-or-incomplete-source-sequence');
  } else if(source.kind==='particle'){
    if(!finite(source.duration,0)||typeof source.loop!=='boolean'||!Number.isInteger(source.simulationSpace)||!hash(source.emissionSignature)||!hash(source.renderSignature)||!hash(source.consumerBindingsSignature))errors.push('invalid-or-incomplete-source-particle');
  }
  if(candidate.files&&!Array.isArray(candidate.files)){errors.push('invalid-companion-files');return;}
  if(candidate.files){
    const seen=new Set<string>();
    for(const f of candidate.files){if(!f||!['atlas','texture'].includes(f.role)||typeof f.name!=='string'||!f.name.trim()||!localUrl(f.url)||!hash(f.sha256))errors.push('invalid-companion-file');else{if(seen.has(f.url))errors.push('duplicate-companion-file-url');seen.add(f.url);}}
  }
}
/** Actual optional appearance substitutions, keyed by the source inventory's stable identity.
 * sha256 values are declarations. Callers must hash inventory bytes; this API never reads asset bytes.
 */
export interface AssetReplacementManifest {
  schemaVersion:1;sourceInventory:{path:string;sha256:string};entries:AssetReplacementCandidate[];
}
export interface AssetReplacementManifestValidation {valid:boolean;errors:string[];entries:number;fileBytesVerified:false;replacementApplied:false}
export function validateAssetReplacementManifest(manifest:AssetReplacementManifest,inventory:RegisteredAssetInventory,inventorySha256:string):AssetReplacementManifestValidation {
  const errors:string[]=[];
  const result=()=>({valid:errors.length===0,errors,entries:Array.isArray(manifest?.entries)?manifest.entries.length:0,fileBytesVerified:false as const,replacementApplied:false as const});
  if(!manifest||manifest.schemaVersion!==1||!Array.isArray(manifest.entries)||!inventory||!Array.isArray(inventory.assets)){errors.push('malformed-replacement-manifest');return result();}
  if(!manifest.sourceInventory||typeof manifest.sourceInventory.path!=='string'||!manifest.sourceInventory.path.trim())errors.push('missing-source-inventory-reference');
  if(!hash(inventorySha256)||!hash(manifest.sourceInventory?.sha256)||manifest.sourceInventory?.sha256!==inventorySha256)errors.push('stale-source-inventory-hash');
  const sources=new Map<string,RegisteredSourceAsset>();
  for(const original of inventory.assets){if(!original||typeof original.sourceKey!=='string'){errors.push('malformed-inventory-source');continue;}if(sources.has(original.sourceKey))errors.push(`duplicate-inventory-source-key:${original.sourceKey}`);sources.set(original.sourceKey,original);}
  const seen=new Set<string>();
  for(const candidate of manifest.entries){
    if(!candidate||typeof candidate.sourceKey!=='string'){errors.push('malformed-manifest-entry');continue;}
    const key=candidate.sourceKey;
    if(seen.has(key))errors.push(`duplicate-replacement-source-key:${key}`);seen.add(key);
    const original=sources.get(key);if(!original){errors.push(`unknown-source-key:${key}`);continue;}
    if(!Array.isArray(original.evidence)||original.evidence.length===0||!original.evidence.every(e=>typeof e==='string'&&e.trim()))errors.push(`${key}:missing-source-evidence`);
    const contract=original.replacementContract;
    if(!contract||contract.status!=='ready-for-candidate'||(!Array.isArray(contract.missing)||contract.missing.length)||!contract.validatorSupported||contract.sourceKey!==key||contract.sourceSha256!==original.sourceSha256)errors.push(`${key}:source-contract-blocked`);
    for(const error of validateAssetReplacement(original,candidate).errors)errors.push(`${key}:${error}`);
  }
  return result();
}
export type AssetReplacementResolution=
  {status:'blocked';sourceKey:string;errors:string[]}|{status:'original';sourceKey:string;urls:string[]}|{status:'replaced';sourceKey:string;url:string;sha256:string;files:NonNullable<AssetReplacementCandidate['files']>;fileBytesVerified:false;replacementApplied:false};
/** Fail closed for the entire mapping. No cached validation can survive a mutated manifest/inventory. */
export function resolveAssetReplacement(manifest:AssetReplacementManifest,inventory:RegisteredAssetInventory,inventorySha256:string,sourceKey:string):AssetReplacementResolution {
  const validation=validateAssetReplacementManifest(manifest,inventory,inventorySha256);
  if(!validation.valid)return {status:'blocked',sourceKey,errors:validation.errors};
  const source=inventory.assets.find(a=>a.sourceKey===sourceKey);
  if(!source)return {status:'blocked',sourceKey,errors:[`unknown-source-key:${sourceKey}`]};
  const candidate=manifest.entries.find(a=>a.sourceKey===sourceKey);
  return candidate?{status:'replaced',sourceKey,url:candidate.url,sha256:candidate.sha256,files:structuredClone(candidate.files??[]),fileBytesVerified:false,replacementApplied:false}:{status:'original',sourceKey,urls:source.exports.map(e=>e.url)};
}
