/** Native R5 entitlements. Real store confirmation remains the platform adapter's responsibility. */
import {type CombatModifiers,type State,type UpgradeKind,buyUpgrade} from './rules';
import {upgradePriceValue} from './upgrade-tables';
import {walletValue} from './rules';

export interface SourceEntitlements {
  plusPack0Active:boolean;plusPack1Active:boolean;plusPack2Active:boolean;
  minePack:boolean;automaticBonus:boolean;adRemoved:boolean;
  autoUpgradePack:boolean;buffPack:boolean;diaPack:boolean;removeAdsForced:boolean;removeAdsAll:boolean;
}
export const SOURCE_ENTITLEMENT_KEYS=['plusPack0Active','plusPack1Active','plusPack2Active','minePack','automaticBonus','adRemoved','autoUpgradePack','buffPack','diaPack','removeAdsForced','removeAdsAll'] as const;
export const SOURCE_PACKAGE_OFFERS={
  autoupgrade_pack:{entitlement:'autoUpgradePack',firstDiamonds:500,nativeMethod:'Shop_manager.ApplyNonConsumable@0x2b967e4',panelPathID:19290},
  buff_pack:{entitlement:'buffPack',firstDiamonds:1000,nativeMethod:'Shop_manager.ApplyNonConsumable@0x2b967e4',panelPathID:null},
  dia_pack:{entitlement:'diaPack',firstDiamonds:16000,nativeMethod:'Shop_manager.ApplyNonConsumable@0x2b967e4',panelPathID:125211},
  mine_pack:{entitlement:'minePack',firstDiamonds:500,nativeMethod:'Shop_manager.ApplyNonConsumable@0x2b967e4',panelPathID:123918},
} as const;
export type SourcePackageID=keyof typeof SOURCE_PACKAGE_OFFERS;
export function freshSourceEntitlements():SourceEntitlements {return {plusPack0Active:false,plusPack1Active:false,plusPack2Active:false,minePack:false,automaticBonus:false,adRemoved:false,autoUpgradePack:false,buffPack:false,diaPack:false,removeAdsForced:false,removeAdsAll:false};}
/** Migration accepts absent new fields only; malformed present values never become false silently. */
export function migrateSourceEntitlements(value:unknown):SourceEntitlements {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid source entitlements');
  const e=value as Record<string,unknown>,next=freshSourceEntitlements();
  const added=['plusPack0Active','autoUpgradePack','buffPack','diaPack','removeAdsForced','removeAdsAll'];
  for(const key of SOURCE_ENTITLEMENT_KEYS) {
    if(e[key]===undefined&&added.includes(key)&&!Object.prototype.hasOwnProperty.call(e,key))continue;
    if(typeof e[key]!=='boolean')throw new Error(`Invalid source entitlement ${key}`);
    next[key]=e[key] as boolean;
  }
  return next;
}
export interface SourcePackageState {diamonds:number;entitlements:SourceEntitlements;consumedReceipts:string[]}
export type SourcePackageResult={status:'supported';value:SourcePackageState;diamondGrant:number;productId:SourcePackageID}|{status:'blocked';reason:string};
/** Native non-consumable grants diamonds only when the package flag was previously false. */
export function sourceApplyPackagePurchase(state:SourcePackageState,productId:SourcePackageID,options:{confirmed:boolean;receiptId:string}):SourcePackageResult {
  if(!Object.prototype.hasOwnProperty.call(SOURCE_PACKAGE_OFFERS,productId))return {status:'blocked',reason:'unknown-product'};
  if(!options.confirmed)return {status:'blocked',reason:'purchase-unconfirmed'};
  if(typeof options.receiptId!=='string'||!options.receiptId.trim()||options.receiptId.length>240)return {status:'blocked',reason:'invalid-receipt'};
  if(state.consumedReceipts.includes(options.receiptId))return {status:'blocked',reason:'receipt-already-applied'};
  const offer=SOURCE_PACKAGE_OFFERS[productId],entitlements=migrateSourceEntitlements(state.entitlements);
  const diamondGrant=entitlements[offer.entitlement]?0:offer.firstDiamonds;
  if(!Number.isSafeInteger(state.diamonds)||state.diamonds<0||!Number.isSafeInteger(state.diamonds+diamondGrant))throw new RangeError('Package balance overflow');
  return {status:'supported',productId,diamondGrant,value:{diamonds:state.diamonds+diamondGrant,entitlements:{...entitlements,[offer.entitlement]:true},consumedReceipts:[...state.consumedReceipts,options.receiptId]}};
}
export type SourceBuffKind='money'|'power'|'speed';
export type SourceBuffTimes=Readonly<Record<SourceBuffKind,number>>;
const noBuffs:SourceBuffTimes={money:0,power:0,speed:0};
/** GetMult: inactive1, individual3, all active4. Permanent pack forces all active and Super. */
export function sourceBuffMultiplier(e:Pick<SourceEntitlements,'buffPack'>,kind:SourceBuffKind,times:SourceBuffTimes=noBuffs):1|3|4 {
  if(!['money','power','speed'].includes(kind)||Object.values(times).length!==3||['money','power','speed'].some(k=>!Number.isFinite(times[k as SourceBuffKind])||times[k as SourceBuffKind]<0))throw new RangeError('Invalid buff state');
  if(e.buffPack)return 4;
  if(times[kind]<=0)return 1;
  return Object.values(times).every(t=>t>0)?4:3;
}
/** Apply damageBuffMultiplier only AFTER ordinary damage G (truncateInteger), before star/raid and CriDmg. */
export interface SourceEntitlementCombatFields {damageBuffMultiplier:1|3|4}
/** Fresh base required. Power remains separate: precombining it changes the native G→Buff order. */
export function sourceEntitlementCombatModifiers<T extends CombatModifiers>(base:T,e:Pick<SourceEntitlements,'buffPack'>,times:SourceBuffTimes=noBuffs):T & SourceEntitlementCombatFields {
  return {...base,damageBuffMultiplier:sourceBuffMultiplier(e,'power',times),
    permanentMoneyPercent:base.permanentMoneyPercent.nativeMultiply(sourceBuffMultiplier(e,'money',times)),attackSpeedBuff:sourceBuffMultiplier(e,'speed',times)};
}
/** Shop_manager.Is_RewardBonus_Auto: all-ad removal (or FreeCash reward entitlement), not forced-only removal. */
/** Shop_manager.get_Is_RewardBonus_Auto@0x2b92704: all-ads OR FreeCash rewarded-ad removal. Forced-only never qualifies. */
export function sourceRewardEntitlements(e:SourceEntitlements):SourceEntitlements {return (e.removeAdsAll||e.adRemoved)&&!e.automaticBonus?{...e,automaticBonus:true}:e;}
export function sourceMineEntitlements(e:SourceEntitlements) {return {plusPack0Active:e.plusPack0Active,plusPack1Active:e.plusPack1Active,plusPack2Active:e.plusPack2Active,minePack:e.minePack,automaticBonus:e.automaticBonus||e.removeAdsAll||e.adRemoved};}
export interface SourceAutoUpgradeResult {battle:State;purchases:{kind:UpgradeKind;level:number}[]}
/** AutoUpgrade_All: affordable lowest level, serialized order Power/Speed/Money on ties, cap10000.
 * Native Upgrade_list.Update invokes this on dirty refresh while enabled and unpaused. */
export function sourceAutoUpgradeBattle(battle:State,enabled:boolean,paused=false):SourceAutoUpgradeResult {
  if(!enabled||paused||battle.phase!=='playing')return {battle,purchases:[]};
  const order:UpgradeKind[]=['power','speed','money'];
  if(order.some(k=>!Number.isSafeInteger(battle.upgradeLevels[k])||battle.upgradeLevels[k]<0||battle.upgradeLevels[k]>10000))throw new RangeError('Invalid auto upgrade levels');
  let next=battle;const purchases:SourceAutoUpgradeResult['purchases']=[];
  // At most30000 successful level increments; each iteration has strict progress.
  while(true) {
    const available=order.filter(k=>next.upgradeLevels[k]<10000&&walletValue(next).gte(upgradePriceValue(next.upgradeLevels[k])));
    available.sort((a,b)=>next.upgradeLevels[a]-next.upgradeLevels[b]||order.indexOf(a)-order.indexOf(b));
    const kind=available[0];if(!kind)break;
    const changed=buyUpgrade(next,kind);if(changed===next)break;
    next=changed;purchases.push({kind,level:next.upgradeLevels[kind]});
  }
  return {battle:next,purchases};
}
