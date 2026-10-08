/** Source Fish_manager transactions. Evidence: round5-20261001/meta-fish-config.json + native disassembly. */
import {type CombatModifiers} from './rules';
export const SOURCE_FISH_CAPACITY=20;
export const SOURCE_FISH_MAX_GRADE=12;
export const SOURCE_FISH_DAILY_LIMIT=5;
export const SOURCE_FISH_NO_AD_DRAWS=3;
export const SOURCE_FISH_PREMIUM_COST=200;
export const SOURCE_FISH_CHANCES=[60,30,10,0] as const;
/** Source Balance_Reload computes these 13 rows with float powers and 2 significant figures. */
const stats=[
 [4,1,8],[12,2,20],[36,6,50],[110,16,120],[320,39,310],[970,98,780],
 [2900,100,2000],[8700,100,4900],[26000,100,12000],[79000,100,31000],
 [240000,100,76000],[710000,100,190000],[2100000,100,480000],
] as const;
const spriteIDs=[516,529,864,848,464,488,404,504,639,699,698,741,739] as const;
export const SOURCE_FISH_INFO=stats.map(([damagePercent,criticalChancePercent,criticalDamagePercent],grade)=>({grade,damagePercent,criticalChancePercent,criticalDamagePercent,spriteKey:`sharedassets0.assets:${spriteIDs[grade]}`}));
export interface SourceFishState {inventory:number[];freeDate:string|null;freeCount:number;autoMergeRequested:boolean}
export const freshSourceFishState=():SourceFishState=>({inventory:[],freeDate:null,freeCount:0,autoMergeRequested:false});
export function sourceFishDateKey(v:unknown):v is string {
 if(typeof v!=='string'||!/^h5-local:\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const s=v.slice(9),d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function decodeSourceFishState(v:unknown):SourceFishState {
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid fish state');
 const f=v as SourceFishState;
 if(!Array.isArray(f.inventory)||f.inventory.length>SOURCE_FISH_CAPACITY||f.inventory.some(g=>!Number.isSafeInteger(g)||g<0||g>SOURCE_FISH_MAX_GRADE)||!Number.isSafeInteger(f.freeCount)||f.freeCount<0||f.freeCount>SOURCE_FISH_DAILY_LIMIT||!(f.freeDate===null||sourceFishDateKey(f.freeDate))||typeof f.autoMergeRequested!=='boolean')throw new Error('Invalid fish state');
 return {...f,inventory:[...f.inventory]};
}
/** RollGrade uses cumulative float weights and strict <, returning base at the inclusive RNG endpoint100. */
export function sourceFishRollGrade(base:0|1,roll:number):number {
 if(![0,1].includes(base)||!Number.isFinite(roll)||roll<0||roll>1)throw new RangeError('Invalid fish roll');
 const r=Math.fround(Math.fround(roll)*100);let cumulative=0;
 for(let i=0;i<SOURCE_FISH_CHANCES.length;i++){cumulative=Math.fround(cumulative+SOURCE_FISH_CHANCES[i]);if(r<cumulative)return base+i;}
 return base;
}
export interface SourceFishDrawOptions {trustedTodayKey:string|null;canRolloverDaily:boolean|null;adConfirmed:boolean;roll:number}
export type SourceFishDrawResult={status:'granted'|'blocked';fish:SourceFishState;diamonds:number;recordDailyGain:boolean;grade:number|null;reason?:string}|{status:'unsupported';reason:string};
/** FreeGacha_Reload occurs before capacity/count gating; premium skips daily refresh. No blocked draw spends. */
export function sourceFishDraw(fish:SourceFishState,diamonds:number,kind:'free'|'premium',o:SourceFishDrawOptions):SourceFishDrawResult {
 decodeSourceFishState(fish);
 if(!Number.isSafeInteger(diamonds)||diamonds<0)throw new RangeError('Invalid fish draw balance');
 if(!['free','premium'].includes(kind))return {status:'unsupported',reason:'unknown-fish-draw'};
 let next=fish,recordDailyGain=false;
 if(kind==='free') {
  if(!sourceFishDateKey(o.trustedTodayKey)||o.canRolloverDaily===null)return {status:'unsupported',reason:'fish-daily-clock-unavailable'};
  // H5 local-clock adapter additionally rejects backwards dates instead of granting another daily reset.
  if(fish.freeDate!==null&&o.trustedTodayKey<fish.freeDate)return {status:'blocked',fish,diamonds,recordDailyGain,grade:null,reason:'fish-clock-went-backwards'};
  if(fish.freeDate!==o.trustedTodayKey&&o.canRolloverDaily){next={...fish,freeDate:o.trustedTodayKey,freeCount:0};recordDailyGain=true;}
 }
 const blocked=(reason:string):SourceFishDrawResult=>({status:'blocked',fish:next,diamonds,recordDailyGain,grade:null,reason});
 if(next.inventory.length>=SOURCE_FISH_CAPACITY)return blocked('fish-inventory-full');
 if(kind==='free'&&next.freeCount>=SOURCE_FISH_DAILY_LIMIT)return blocked('fish-daily-limit');
 if(kind==='free'&&next.freeCount>=SOURCE_FISH_NO_AD_DRAWS&&!o.adConfirmed)return blocked('fish-ad-unconfirmed');
 if(kind==='premium'&&diamonds<SOURCE_FISH_PREMIUM_COST)return blocked('fish-diamonds-insufficient');
 const grade=sourceFishRollGrade(kind==='free'?0:1,o.roll);
 return {status:'granted',fish:{...next,inventory:[...next.inventory,grade],freeCount:next.freeCount+(kind==='free'?1:0)},diamonds:diamonds-(kind==='premium'?SOURCE_FISH_PREMIUM_COST:0),recordDailyGain,grade};
}
export type SourceFishFusionResult={status:'supported';value:{fish:SourceFishState;grade:number;index:number}}|{status:'blocked';reason:string};
/** TryFusion removes greater index then smaller index and APPENDS upgraded grade; return index is the smaller removed index. */
export function sourceFishFusion(fish:SourceFishState,a:number,b:number):SourceFishFusionResult {
 decodeSourceFishState(fish);
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a===b||a>=fish.inventory.length||b>=fish.inventory.length)return {status:'blocked',reason:'fish-fusion-indices-invalid'};
 const grade=fish.inventory[a];if(grade!==fish.inventory[b])return {status:'blocked',reason:'fish-fusion-grade-mismatch'};
 if(grade>=SOURCE_FISH_MAX_GRADE)return {status:'blocked',reason:'fish-max-grade'};
 const inventory=[...fish.inventory];inventory.splice(Math.max(a,b),1);inventory.splice(Math.min(a,b),1);inventory.push(grade+1);
 return {status:'supported',value:{fish:{...fish,inventory},grade:grade+1,index:Math.min(a,b)}};
}
/** RecalculateTotals sums every inventory entry, including duplicates; source total chance is not clamped here. */
export function sourceFishTotals(fish:SourceFishState) {
 decodeSourceFishState(fish);
 return fish.inventory.reduce((sum,g)=>{const info=SOURCE_FISH_INFO[g];return {damagePercent:sum.damagePercent+info.damagePercent,criticalChancePercent:sum.criticalChancePercent+info.criticalChancePercent,criticalDamagePercent:sum.criticalDamagePercent+info.criticalDamagePercent};},{damagePercent:0,criticalChancePercent:0,criticalDamagePercent:0});
}
export interface SourceFishCombatFields {fishDamagePercent:number;criticalChance:number;criticalDamagePercent:number}
/** Native damage applies fishDamagePercent/100 after skin and before relic/G; empty inventory gives100.
 * CriDmg applies criticalDamagePercent/100 to the final Damage (buff/star/raid included), then relic and G.
 * Keep each native multiply/divide separate: BigValue significant rounding makes precomposition unsafe.
 */
export function sourceFishCombatModifiers<T extends CombatModifiers>(base:T,fish:SourceFishState):T & SourceFishCombatFields {
 const totals=sourceFishTotals(fish);
 return {...base,fishDamagePercent:100+totals.damagePercent,criticalChance:Math.fround(totals.criticalChancePercent/100),criticalDamagePercent:125+totals.criticalDamagePercent};
}

export interface SourceFishAutoMergeCandidate {inventoryIndex:number;grade:number;active:boolean;dragging:boolean;autoMerging:boolean;pendingDelete:boolean;currentAlertTarget:boolean}
/** Native pair search scans grades0..11 then original pool order, returns second match as mover. */
export function sourceFishFindAutoMergePair(fish:SourceFishState,plusPack2Active:boolean,pool:readonly SourceFishAutoMergeCandidate[]):{stationary:number;mover:number}|null {
 decodeSourceFishState(fish);if(!plusPack2Active||!fish.autoMergeRequested)return null;
 for(let grade=0;grade<SOURCE_FISH_MAX_GRADE;grade++){
  let stationary:number|null=null;
  for(const p of pool){if(!p.active||p.dragging||p.autoMerging||p.pendingDelete||p.currentAlertTarget||p.grade!==grade||!Number.isSafeInteger(p.inventoryIndex)||p.inventoryIndex<0||p.inventoryIndex>=fish.inventory.length||fish.inventory[p.inventoryIndex]!==grade)continue;
   if(stationary===null)stationary=p.inventoryIndex;else if(p.inventoryIndex!==stationary)return {stationary,mover:p.inventoryIndex};
  }
 }
 return null;
}
/** One committed pair per call. Render scheduler owns native .4s movement/20distance and .15s pair delay. */
export function sourceFishAutoMergeOnce(fish:SourceFishState,plusPack2Active:boolean,pool:readonly SourceFishAutoMergeCandidate[]):SourceFishFusionResult {
 const pair=sourceFishFindAutoMergePair(fish,plusPack2Active,pool);if(!pair)return {status:'blocked',reason:!plusPack2Active?'fish-auto-merge-package-required':!fish.autoMergeRequested?'fish-auto-merge-off':'fish-auto-merge-no-pair'};
 return sourceFishFusion(fish,pair.stationary,pair.mover);
}
