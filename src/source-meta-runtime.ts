import {freshSourceOfferWall,decodeSourceOfferWall,type SourceOfferWallState} from './r6-offerwall';
import {freshSourceFreeCash,decodeSourceFreeCash,type SourceFreeCashState} from './r6-freecash';
import {freshSourcePassLifecycle,decodeSourcePassLifecycle,sourcePassRewards,sourcePassProgress,sourcePutPass,type SourcePassLifecycle} from './r6-pass-lifecycle';
import {freshSourceRaidMission,decodeSourceRaidMission,type SourceRaidMissionState} from './r6-raid-mission';
import {freshSourceRaidStarPig,decodeSourceRaidStarPig,type SourceRaidStarPigState} from './r6-raid-star-pig';
import {freshSourceRaid,decodeSourceRaid,type SourceRaidState} from './r6-raid';
import {freshSourcePrism,decodeSourcePrism,type SourcePrismState} from './r6-prism';
import {contentGate} from './meta-progression';
import {freshSourceRelicState,decodeSourceRelicState,sourceRelicDraw,sourceRelicUpgrade,type SourceRelicState,type SourceRelicDrawItem} from './r6-relic';
import {sourceRewardEntitlements} from './r5-entitlements';
import {validateSourceDiaFirstBuyState,type SourceDiaFirstBuyState} from './r6-shop-lifecycle';
import {freshSourceAdventureState,encodeSourceAdventureState,decodeSourceAdventureState,sourceAdventureStart,sourceAdventureClaim,sourceAdventureCancel,sourceAdventureForceFinish,type SourceAdventureState,type SourceAdventureClock,type SourceDispatchPet,type SourceAdventureResult} from './r6-adventure';
import {sourcePetGuardsCurrent} from './r6-pet-auto';
import {decodeSourceBuffTimes,freshSourceBuffTimes} from './r6-buff';
import type {SourceBuffTimes} from './r5-entitlements';
/** H5 bridge for evidence-backed meta actions. Persist session/activities/platform/meta together. */
import contract from './data/round3-ui-contract.json';
import {sourceGun,sessionBossModifiers,GUN_INVENTORY_CAPACITY,type Session} from './session';
import {ACTIVITY_MISSIONS,type ActivityState,type ActivityCounter} from './source-activities';
import type {LocalPlatformState} from './local-platform';
import {localMineTime,type MineTimeAdapter} from './mine-time';
import {sourceMineSweep,sourceMineSweepAdBonus,sourceMineSweepClose,sourceApplySeasonPass,sourcePassExpGet,sourceClaimPassReward,sourceClaimLuxuryMission,sourceClaimDailyGun,type SourceSweepSettlement,type SourcePassProgress,type SourcePassTrack,type SourceSeasonPassKind,type SourceSeasonState} from './source-meta-actions';

import {freshSourceEntitlements,migrateSourceEntitlements,SOURCE_ENTITLEMENT_KEYS,sourceApplyPackagePurchase,sourceAutoUpgradeBattle,type SourceEntitlements,type SourcePackageID} from './r5-entitlements';

import {freshSourceAutoUpgradeState,decodeSourceAutoUpgradeState,sourceAutoUpgradeEnabled,sourceAutoUpgradeAdReward,sourceTickAutoUpgradeTime,type SourceAutoUpgradeState} from './r5-auto';
import {freshSourceFishState,decodeSourceFishState,sourceFishDateKey,sourceFishDraw,sourceFishFusion,sourceFishAutoMergeOnce,SOURCE_FISH_NO_AD_DRAWS,type SourceFishState,type SourceFishAutoMergeCandidate} from './r5-fish';
import {freshSourcePetState,decodeSourcePetState,serializeSourcePetState,sourcePetDraw,sourcePetDailyAd,sourcePetMerge,sourcePetEquip,sourcePetUnequip,sourcePetSwapSelected,sourcePetMoveOwned,sourcePetSwapOwned,type SourcePetState,type SourcePetResult} from './r5-pet';
import {freshSourceHuntState,decodeSourceHuntState,serializeSourceHuntState,sourceHuntSweep,sourceHuntExit,sourceHuntTeamPower,type SourceHuntState} from './r5-hunt';
import {freshSourceGunAutoMerge,decodeSourceGunAutoMerge,sourceGunSetAutoMerge,type SourceGunAutoMergeState} from './r5-gun-auto';

export const SOURCE_META_STORAGE_KEY='catgunner.source-meta.v1';
export interface SourceMetaState {
  freeCash?:SourceFreeCashState;
  offerWall?:SourceOfferWallState;
  coreShop:SourcePrismState;
  raid:SourceRaidState;
  raidStarPig?:SourceRaidStarPigState;
  raidMission?:SourceRaidMissionState;
  passLifecycle?:SourcePassLifecycle;
  version:1;season:'initial'|'later';vip:boolean;luxury:boolean;epicClaims:number[];vipMissionClaims:string[];luxuryMissionClaims:string[];
  entitlements:SourceEntitlements;
  fish:SourceFishState;fishDailyGainDates:string[];
  pet:SourcePetState;petCoin:number;hunt:SourceHuntState;adventure:SourceAdventureState;relic:SourceRelicState;
  buffTimes:SourceBuffTimes;buffRewardClaims:string[];
  /** Local host receipts, not source runtime pools or online ad proofs. */
  huntSettlementClaims?:string[];
  autoUpgrade:SourceAutoUpgradeState;
  gunAutoMerge:SourceGunAutoMergeState;
  sweep:SourceSweepSettlement|null;sweepSequence:number;mineDailyGainDates:string[];
  /** H5 developer override; false never claims a real server switch has been fetched. */
  adDailyGun:{serverWeapon01AdOn:boolean;lastDailyGunKey:string|null};
  /** Explicit local config only; never pretends to fetch Weapon02 from a server. */
  adTemporaryGunServer?:boolean;
  /** Missing only in older H5 envelopes: migrate from platform claims at the consumer. */
  shopFirstBuy?:SourceDiaFirstBuyState;
}
export interface SourceMetaBundle {session:Session;activities:ActivityState;platform:LocalPlatformState;meta:SourceMetaState}
export interface SourceMetaRuntimeResult extends SourceMetaBundle {status:'granted'|'blocked'|'unsupported';message:string}
export function freshSourceMetaState():SourceMetaState {return {offerWall:freshSourceOfferWall(),freeCash:freshSourceFreeCash(),passLifecycle:freshSourcePassLifecycle(),raidMission:freshSourceRaidMission(),raidStarPig:freshSourceRaidStarPig(),raid:freshSourceRaid(),coreShop:freshSourcePrism(),version:1,season:'initial',vip:false,luxury:false,epicClaims:[],vipMissionClaims:[],luxuryMissionClaims:[],entitlements:freshSourceEntitlements(),fish:freshSourceFishState(),fishDailyGainDates:[],pet:freshSourcePetState(),petCoin:0,hunt:freshSourceHuntState(),adventure:freshSourceAdventureState(),relic:freshSourceRelicState(),buffTimes:freshSourceBuffTimes(),buffRewardClaims:[],autoUpgrade:freshSourceAutoUpgradeState(),gunAutoMerge:freshSourceGunAutoMerge(),sweep:null,sweepSequence:0,mineDailyGainDates:[],adDailyGun:{serverWeapon01AdOn:false,lastDailyGunKey:null},adTemporaryGunServer:false};}
const isInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const localDateKey=(value:unknown):value is string=>{if(typeof value!=='string'||!/^h5-local:\d{4}-\d{2}-\d{2}$/.test(value))return false;const key=value.slice(9),d=new Date(key+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===key;};
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string')&&new Set(v).size===v.length;
export function decodeSourceMetaState(raw:string|null):SourceMetaState {
  if(!raw)return freshSourceMetaState();const s=JSON.parse(raw) as SourceMetaState;
  if(s?.version!==1||!['initial','later'].includes(s.season)||typeof s.vip!=='boolean'||typeof s.luxury!=='boolean'||s.luxury&&!s.vip||!Array.isArray(s.epicClaims)||s.epicClaims.length>25||s.epicClaims.some((v,i)=>v!==i)||!ids(s.vipMissionClaims)||s.vipMissionClaims.some(id=>!ACTIVITY_MISSIONS.some(m=>m.id===id&&m.requiresVip))||!ids(s.luxuryMissionClaims)||s.luxuryMissionClaims.some(id=>!ACTIVITY_MISSIONS.some(m=>m.id===id))||!isInt(s.sweepSequence)||!ids(s.mineDailyGainDates)||!s.entitlements||['plusPack1Active','plusPack2Active','minePack','automaticBonus','adRemoved'].some(k=>typeof s.entitlements[k as keyof SourceMetaState['entitlements']]!=='boolean'))throw new Error('Invalid source meta extension');
  if(s.sweep!==null){const w=s.sweep;if(!w||![w.rewardValue,w.initialReward,w.totalReward].every(isInt)||typeof w.automaticBonus!=='boolean'||typeof w.bonusClaimed!=='boolean'||typeof w.pending!=='boolean'||w.initialReward!==w.rewardValue*(w.automaticBonus?4:1)||w.totalReward!==w.rewardValue*(w.bonusClaimed?4:1)||w.automaticBonus&&!w.bonusClaimed)throw new Error('Invalid sweep extension');}
  s.freeCash=decodeSourceFreeCash(s.freeCash);s.offerWall=decodeSourceOfferWall(s.offerWall);if(s.freeCash.isRewardAdRemoved)s.entitlements={...s.entitlements,adRemoved:true};
  // Older version-1 envelopes have no advertisement-gun extension. Migrate only absence.
  const adDailyGun=s.adDailyGun===undefined?{serverWeapon01AdOn:false,lastDailyGunKey:null}:s.adDailyGun;
  if(!adDailyGun||typeof adDailyGun.serverWeapon01AdOn!=='boolean'||!(adDailyGun.lastDailyGunKey===null||localDateKey(adDailyGun.lastDailyGunKey)))throw new Error('Invalid daily advertising gun extension');
  if(s.adTemporaryGunServer!==undefined&&typeof s.adTemporaryGunServer!=='boolean')throw Error('Invalid temporary advertising gun config');
  const fishDailyGainDates=Object.prototype.hasOwnProperty.call(s,'fishDailyGainDates')?s.fishDailyGainDates:[];
  if(!ids(fishDailyGainDates)||fishDailyGainDates.some(d=>!sourceFishDateKey(d)))throw new Error('Invalid fish daily gain log');
  if(Object.prototype.hasOwnProperty.call(s,'shopFirstBuy'))validateSourceDiaFirstBuyState(s.shopFirstBuy);
  const entitlements=migrateSourceEntitlements(s.entitlements),gunAutoMerge=decodeSourceGunAutoMerge(s.gunAutoMerge);
  const pet=Object.prototype.hasOwnProperty.call(s,'pet')?decodeMetaPet(s.pet):freshSourcePetState();
  const hunt=Object.prototype.hasOwnProperty.call(s,'hunt')?decodeMetaHunt(s.hunt):freshSourceHuntState();
  const petCoin=Object.prototype.hasOwnProperty.call(s,'petCoin')?s.petCoin:0;if(!isInt(petCoin))throw new Error('Invalid pet coin');
  if(s.huntSettlementClaims!==undefined&&!ids(s.huntSettlementClaims))throw new Error('Invalid Hunt settlement ledger');
  const buffTimes=decodeSourceBuffTimes(s.buffTimes),buffRewardClaims=s.buffRewardClaims===undefined?[]:s.buffRewardClaims;
  if(!ids(buffRewardClaims))throw new Error("Invalid buff reward ledger");
  return {...s,...(s.passLifecycle===undefined?{}:{passLifecycle:decodeSourcePassLifecycle(s.passLifecycle)}),raidMission:Object.prototype.hasOwnProperty.call(s,'raidMission')?decodeSourceRaidMission(s.raidMission):freshSourceRaidMission(),raidStarPig:Object.prototype.hasOwnProperty.call(s,'raidStarPig')?decodeSourceRaidStarPig(s.raidStarPig):freshSourceRaidStarPig(),raid:Object.prototype.hasOwnProperty.call(s,'raid')?decodeSourceRaid(s.raid):freshSourceRaid(),coreShop:Object.prototype.hasOwnProperty.call(s,'coreShop')?decodeSourcePrism(s.coreShop):freshSourcePrism(),adTemporaryGunServer:s.adTemporaryGunServer??false,adventure:decodeSourceAdventureState(s.adventure),relic:Object.prototype.hasOwnProperty.call(s,'relic')?decodeSourceRelicState(s.relic):freshSourceRelicState(),buffTimes,buffRewardClaims,pet,hunt,petCoin,adDailyGun,fishDailyGainDates,gunAutoMerge:sourceGunSetAutoMerge(gunAutoMerge,gunAutoMerge.autoMergeRequested,entitlements.plusPack2Active),autoUpgrade:Object.prototype.hasOwnProperty.call(s,'autoUpgrade')?decodeSourceAutoUpgradeState(s.autoUpgrade):freshSourceAutoUpgradeState(),fish:Object.prototype.hasOwnProperty.call(s,'fish')?decodeSourceFishState(s.fish):freshSourceFishState(),entitlements};
}
function decodeMetaPet(p:SourcePetState):SourcePetState {
 if(!p||!Array.isArray(p.ownedLocks)||p.ownedLocks.length!==16||!Array.isArray(p.selectedLocks)||p.selectedLocks.length!==3||typeof p.dailyLastDate!=='string')throw new Error('Invalid pet extension');
 return decodeSourcePetState(serializeSourcePetState(p));
}
function decodeMetaHunt(h:SourceHuntState):SourceHuntState {
 if(!h||h.run!==null)throw new Error('Invalid persisted hunt extension');return decodeSourceHuntState(serializeSourceHuntState(h));
}
export function serializeSourceMetaState(meta:SourceMetaState):string {const gun=decodeSourceGunAutoMerge(meta.gunAutoMerge),raw=JSON.stringify({...meta,adventure:encodeSourceAdventureState(meta.adventure),pet:decodeMetaPet(meta.pet),hunt:decodeSourceHuntState(serializeSourceHuntState(meta.hunt)),gunAutoMerge:sourceGunSetAutoMerge(gun,gun.autoMergeRequested,meta.entitlements.plusPack2Active)});decodeSourceMetaState(raw);return raw;}
const result=(b:SourceMetaBundle,status:SourceMetaRuntimeResult['status'],message:string):SourceMetaRuntimeResult=>({...b,status,message});
const add=(a:number,b:number)=>{if(!isInt(a)||!isInt(b)||!isInt(a+b))throw new RangeError('Meta balance overflow');return a+b;};
const passState=sourcePassProgress,putPass=sourcePutPass;
function audit(platform:LocalPlatformState,id:string,kind:'ad'|'purchase'|'unlock',amount:number):LocalPlatformState {return {...platform,sequence:platform.sequence+1,claims:[...platform.claims,id],audit:[...platform.audit,{id,kind,amount,at:new Date().toISOString()}].slice(-100)};}
const provider=(p:LocalPlatformState,kind:'ad'|'purchase')=>p.developerEnabled&&(kind==='ad'?p.freeAds:p.freePurchases);
export function sourceMetaPassView(b:SourceMetaBundle) {return {...passState(b),seasonNumber:b.meta.passLifecycle?.seasonNumber??0,seasonEnd:b.meta.passLifecycle?.seasonEnd??null,normalRewards:sourcePassRewards(b.meta.passLifecycle?.seasonNumber??0,b.meta.passLifecycle?.gunSeason??true,0),epicRewards:sourcePassRewards(b.meta.passLifecycle?.seasonNumber??0,b.meta.passLifecycle?.gunSeason??true,1)};}
/** Explicit development purchase only; it does not simulate a real store callback. */
export function developerSourceMetaPass(b:SourceMetaBundle,kind:SourceSeasonPassKind):SourceMetaRuntimeResult {
  if(!provider(b.platform,'purchase'))return result(b,'blocked','请先启用开发者模式和免购买');
  const id=`meta:developer-pass:${kind}:${b.platform.sequence}`;
  const r=sourceApplySeasonPass({diamonds:b.session.diamonds,pass:passState(b),consumedReceipts:b.platform.claims},kind,{confirmed:true,receiptId:id});
  if(r.status!=='supported')return result(b,r.status,r.reason);
  const next=putPass({...b,session:{...b.session,diamonds:r.value.diamonds,events:[],notice:''},platform:audit(b.platform,id,'purchase',kind==='vip'?500:1000)},r.value.pass);
  return result(next,'granted',kind==='vip'?'开发免购买：VIP，钻石 +500':'开发免购买：VIP + Luxury，钻石 +1000、通行证经验 +300');
}
/** Test entitlement flag with a visible developer audit. No real purchase is fabricated. */
export function developerSourceMetaEntitlement(b:SourceMetaBundle,key:keyof SourceMetaState['entitlements'],active=true):SourceMetaRuntimeResult {
  if(!provider(b.platform,'purchase'))return result(b,'blocked','请先启用开发者模式和免购买');
  if(!SOURCE_ENTITLEMENT_KEYS.includes(key)||typeof active!=='boolean')return result(b,'blocked','无效权益字段');
  const id=`meta:developer-entitlement:${key}:${b.platform.sequence}`;
  return result({...b,meta:{...b.meta,entitlements:{...b.meta.entitlements,[key]:active},gunAutoMerge:key==='plusPack2Active'?sourceGunSetAutoMerge(b.meta.gunAutoMerge,b.meta.gunAutoMerge.autoMergeRequested,active):b.meta.gunAutoMerge},platform:audit(b.platform,id,'unlock',0)},'granted',`开发权益测试：${key} ${active?'开启':'关闭'}`);
}
export function runtimeSourceMineSweep(b:SourceMetaBundle,time:MineTimeAdapter=localMineTime):SourceMetaRuntimeResult {
  if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景后扫荡');
  if(b.meta.sweep?.pending)return result(b,'blocked','请先完成当前扫荡结算');
  const today=time.today(),e=b.meta.entitlements;
  const r=sourceMineSweep({diamonds:b.session.diamonds,tickets:b.session.mine.tickets,bestReward:b.session.mine.bestReward,sweep:b.meta.sweep},{...e,trustedToday:today,canRolloverDaily:time.canRolloverDaily(3,b.session.mine.tickets.storedDate,today)});
  if(r.status==='unsupported')return result(b,'unsupported',r.reason);
  const meta={...b.meta,sweep:r.state.sweep,sweepSequence:b.meta.sweepSequence+(r.status==='granted'?1:0),mineDailyGainDates:r.recordDailyGain&&!b.meta.mineDailyGainDates.includes(today)?[...b.meta.mineDailyGainDates,today]:b.meta.mineDailyGainDates};
  const next={...b,session:{...b.session,diamonds:r.state.diamonds,mine:{...b.session.mine,tickets:r.state.tickets},events:[],notice:''},meta,activities:r.missionEvent?{...b.activities,counters:{...b.activities.counters,'mine-played':add(b.activities.counters['mine-played'],1)}}:b.activities};
  return result(next,r.status,r.status==='granted'?`扫荡获得 ${r.state.sweep!.initialReward} 钻石`:r.reason==='plus-pack-2-required'?'扫荡需要 Plus2 权益':r.reason==='best-reward-required'?'先完成矿场并记录最佳奖励':'今日矿场次数已用完');
}
export function developerSourceMineSweepBonus(b:SourceMetaBundle):SourceMetaRuntimeResult {
  if(!provider(b.platform,'ad'))return result(b,'blocked','请先启用开发者模式和免广告');
  const id=`meta:developer-sweep:${b.meta.sweepSequence}:bonus`;if(b.platform.claims.includes(id))return result(b,'blocked','当前扫荡加成已领取');
  const r=sourceMineSweepAdBonus({diamonds:b.session.diamonds,tickets:b.session.mine.tickets,bestReward:b.session.mine.bestReward,sweep:b.meta.sweep},true);
  if(r.status!=='supported')return result(b,r.status,r.reason);
  const amount=r.value.diamonds-b.session.diamonds;
  return result({...b,session:{...b.session,diamonds:r.value.diamonds,notice:'',events:[]},meta:{...b.meta,sweep:r.value.sweep},platform:audit(b.platform,id,'ad',amount)},'granted',`开发免广告：追加 ${amount} 钻石`);
}
export function closeSourceMineSweep(b:SourceMetaBundle):SourceMetaBundle {const r=sourceMineSweepClose({diamonds:b.session.diamonds,tickets:b.session.mine.tickets,bestReward:b.session.mine.bestReward,sweep:b.meta.sweep});return {...b,meta:{...b.meta,sweep:r.sweep}};}
export function runtimeSourcePassClaim(b:SourceMetaBundle,track:SourcePassTrack,index:number,options?:{adConfirmed:boolean;requestID?:string}):SourceMetaRuntimeResult {
  const adConfirmed=options?.adConfirmed??provider(b.platform,'ad');
  const r=sourceClaimPassReward(passState(b),b.session,track,index,{adConfirmed,adRemoved:b.meta.entitlements.adRemoved||b.meta.entitlements.removeAdsAll},(session,t,i)=>{
    const reward=sourcePassRewards(b.meta.passLifecycle?.seasonNumber??0,b.meta.passLifecycle?.gunSeason??true,t)[i];if(!reward)return null;
    if(reward.kind==='core')return session;
    if(reward.kind==='gunUnlock')return session.gunInventory.length>=GUN_INVENTORY_CAPACITY?null:{...session,gunInventory:[...session.gunInventory,sourceGun(reward.amount)],notice:'',events:[]};
    return {...session,diamonds:add(session.diamonds,reward.amount),notice:'',events:[]};
  });
  if(r.status!=='supported')return result(b,r.status,r.reason==='already-claimed'?'本格奖励已领取，不重复发奖':r.reason==='level-required'?'通行证等级不足，尚未达到本格奖励等级':r.reason==='reward-consumer-failed'?'武器库存已满，奖励未领取':r.reason==='vip-required'?'高级轨需要 VIP':r.reason==='ad-unconfirmed'?'需完成广告回调后领取本格':r.reason==='previous-reward-required'?'请先领齐此前普通轨和 VIP 高级轨奖励':r.reason);
  const reward=sourcePassRewards(b.meta.passLifecycle?.seasonNumber??0,b.meta.passLifecycle?.gunSeason??true,track)[index];
  if(reward.kind==='core'&&!isInt(b.meta.adventure.cores[3]+reward.amount))return result(b,'blocked','棱晶余额超出可保存范围');
  let next=putPass({...b,session:r.value.wallet,meta:reward.kind==='core'?{...b.meta,adventure:{...b.meta.adventure,cores:b.meta.adventure.cores.map((v,i)=>i===3?v+reward.amount:v)}}:b.meta},r.value.pass);
  if(track===0&&index>=3&&index%3===0&&!(b.meta.entitlements.adRemoved||b.meta.entitlements.removeAdsAll))next={...next,platform:audit(b.platform,options?.requestID?`meta:local-pass:${options.requestID}`:`meta:developer-pass-ad:${b.meta.passLifecycle?.seasonNumber??0}:${b.meta.passLifecycle?.seasonEnd??'legacy'}:${index}`,'ad',0)};
  return result(next,'granted',`${track===0?'普通':'高级'}轨第 ${index+1} 格奖励已领取`);
}
export function runtimeSourceMissionClaim(b:SourceMetaBundle,id:string,luxury=false):SourceMetaRuntimeResult {
  const mission=ACTIVITY_MISSIONS.find(m=>m.id===id);if(!mission)return result(b,'blocked','任务不存在');
  if(luxury){
    const state:SourceSeasonState={...passState(b),seasonNumber:0,seasonStarted:true,gunSeason:true,seasonEnd:null,missionStart:null,counters:[0,0,0,0],missionClaims:ACTIVITY_MISSIONS.map(m=>({normal:b.activities.missionClaims.includes(m.id)||b.meta.vipMissionClaims.includes(m.id),luxury:b.meta.luxuryMissionClaims.includes(m.id)}))};
    const r=sourceClaimLuxuryMission(state,ACTIVITY_MISSIONS.indexOf(mission),mission.reward.amount);if(r.status!=='supported')return result(b,r.status,r.reason);
    return result(putPass({...b,meta:{...b.meta,luxuryMissionClaims:[...b.meta.luxuryMissionClaims,id]}},r.value.state),'granted',`Luxury 任务经验 +${r.value.grantedExp}`);
  }
  if(mission.requiresVip&&!b.meta.vip)return result(b,'blocked','任务需要 VIP');
  if(b.activities.missionClaims.includes(id)||b.meta.vipMissionClaims.includes(id))return result(b,'blocked','任务已领取');
  if(b.activities.counters[mission.counter as ActivityCounter]<mission.goal)return result(b,'blocked','任务进度未达标');
  const claimed=mission.requiresVip?{...b,meta:{...b.meta,vipMissionClaims:[...b.meta.vipMissionClaims,id]}}:{...b,activities:{...b.activities,missionClaims:[...b.activities.missionClaims,id]}};
  const next=putPass(claimed,sourcePassExpGet(passState(b),mission.reward.amount));
  return result(next,'granted',`任务经验 +${mission.reward.amount}`);
}

/** Explicit developer server-flag override; this is not fetched server configuration. */
export function developerSourceAdDailyGunServer(b:SourceMetaBundle,enabled=true):SourceMetaRuntimeResult {
  if(!b.platform.developerEnabled)return result(b,'blocked','请先启用开发者模式');
  if(typeof enabled!=='boolean')return result(b,'blocked','广告枪开关必须是布尔值');
  const id=`meta:developer-ad-daily-gun-server:${b.platform.sequence}`;
  return result({...b,meta:{...b.meta,adDailyGun:{...b.meta.adDailyGun,serverWeapon01AdOn:enabled}},platform:audit(b.platform,id,'unlock',0)},'granted',`开发者广告枪开关：${enabled?'开启':'关闭'}（非真实服务器配置）`);
}
/** Local calendar + confirmed developer advertising adapter. Native RNG/clock parity is not claimed. */
export function runtimeSourceAdDailyGun(b:SourceMetaBundle,time:MineTimeAdapter=localMineTime):SourceMetaRuntimeResult {
  if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景领取');
  if(!b.meta.adDailyGun.serverWeapon01AdOn)return result(b,'blocked','每日广告枪未启用；真实服务器开关尚未接入');
  if(!provider(b.platform,'ad'))return result(b,'blocked','请先启用开发者模式和免广告');
  const today=time.today(),previous=b.meta.adDailyGun.lastDailyGunKey;
  if(!localDateKey(today))return result(b,'unsupported','广告枪本地日期适配器无效');
  if(previous!==null&&today<previous)return result(b,'blocked','本地日期倒退，不能重复领取广告枪');
  const receipt=`meta:developer-ad-daily-gun:${today}`;
  if(b.platform.claims.includes(receipt))return result(b,'blocked','今日广告枪已领取');
  const rngState=(Math.imul(b.session.rngState,1664525)+1013904223)>>>0;
  const inventory=Array.from({length:GUN_INVENTORY_CAPACITY},(_,i)=>b.session.gunInventory[i]??null);
  const r=sourceClaimDailyGun({lastDailyGunKey:previous,inventory},{serverWeapon01AdOn:true,historicStage:b.session.historicMax,trustedTodayKey:today,adConfirmed:true,roll:rngState/0x100000000},id=>sourceGun(id));
  if(r.status!=='supported')return result(b,r.status,r.reason==='inventory-full'?'武器库存已满，广告枪未领取':r.reason==='daily-gun-already-claimed'?'今日广告枪已领取':r.reason==='historic-stage30-required'?'广告枪在历史进度 30 后开放':r.reason);
  const gun=r.value.state.inventory[r.value.slot]!;
  return result({...b,session:{...b.session,gunInventory:r.value.state.inventory.filter((g):g is NonNullable<typeof g>=>g!==null),gunDraws:add(b.session.gunDraws,1),rngState,notice:'',events:[{type:'gunDrawn',gun}]},meta:{...b.meta,adDailyGun:{...b.meta.adDailyGun,lastDailyGunKey:today}},platform:audit(b.platform,receipt,'ad',0)},'granted',`开发免广告：获得武器 #${r.value.gunId+1}`);
}

/** Developer provider confirms a source product; diamonds, entitlement and audit update together. */
export function developerSourcePackagePurchase(b:SourceMetaBundle,productId:SourcePackageID,requestId:string):SourceMetaRuntimeResult {
  if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景购买');
  if(!provider(b.platform,'purchase'))return result(b,'blocked','请先启用开发者模式和免购买');
  if(typeof requestId!=='string'||!requestId.trim()||requestId.length>128)return result(b,'blocked','无效购买请求');
  const id=`meta:developer-package:${productId}:${requestId}`;
  const r=sourceApplyPackagePurchase({diamonds:b.session.diamonds,entitlements:b.meta.entitlements,consumedReceipts:b.platform.claims},productId,{confirmed:true,receiptId:id});
  if(r.status!=='supported')return result(b,'blocked',r.reason==='receipt-already-applied'?'本次购买已处理':r.reason);
  return result({...b,session:{...b.session,diamonds:r.value.diamonds,events:[],notice:''},meta:{...b.meta,entitlements:r.value.entitlements},platform:audit(b.platform,id,'purchase',r.diamondGrant)},'granted',`开发免购买：${productId==='autoupgrade_pack'?'自动强化':'永久增益'}${r.diamondGrant?`，钻石 +${r.diamondGrant}`:'（已拥有）'}`);
}
/** Called after ordinary currency/level changes. Root owns dirty tracking and pause policy. */
export function runtimeSourceAutoUpgrade(b:SourceMetaBundle,paused=false):SourceMetaRuntimeResult {
  if(b.session.mode!=='field')return result(b,'blocked','普通场景外不执行自动强化');
  const r=sourceAutoUpgradeBattle(b.session.battle,sourceAutoUpgradeEnabled(b.meta.autoUpgrade,b.meta.entitlements.autoUpgradePack),paused);
  return result({...b,session:{...b.session,battle:r.battle,events:r.purchases.map(p=>({type:'upgradeSucceeded' as const,...p}))}},'granted',r.purchases.length?`自动强化 ${r.purchases.length} 次`:'');
}

/** Atomic native fish draw with explicitly local clock/RNG and confirmed developer advertisement adapter. */
export function runtimeSourceFishDraw(b:SourceMetaBundle,kind:'free'|'premium',time:MineTimeAdapter=localMineTime,requestId=String(b.platform.sequence)):SourceMetaRuntimeResult {
 if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景抽鱼');
 if(typeof requestId!=='string'||!requestId.trim()||requestId.length>128)return result(b,'blocked','无效抽鱼请求');
 const today=time.today(),receipt=`meta:fish-draw:${kind}:${requestId}`;
 if(b.platform.claims.includes(receipt))return result(b,'blocked','本次抽鱼已处理');
 const rngState=(Math.imul(b.session.rngState,1664525)+1013904223)>>>0;
 const r=sourceFishDraw(b.meta.fish,b.session.diamonds,kind,{trustedTodayKey:today,canRolloverDaily:time.canRolloverDaily(3,b.meta.fish.freeDate??'',today),adConfirmed:provider(b.platform,'ad'),roll:rngState/0x100000000});
 if(r.status==='unsupported')return result(b,'unsupported',r.reason);
 const dates=r.recordDailyGain&&!b.meta.fishDailyGainDates.includes(today)?[...b.meta.fishDailyGainDates,today]:b.meta.fishDailyGainDates;
 const refreshed={...b,meta:{...b.meta,fish:r.fish,fishDailyGainDates:dates}};
 const reasons:Record<string,string>={'fish-inventory-full':'鱼库存已满（20）','fish-daily-limit':'今日抽鱼次数已用完（5）','fish-ad-unconfirmed':'后两次抽鱼需启用开发者免广告','fish-diamonds-insufficient':'抽鱼需要 200 钻石','fish-clock-went-backwards':'本地日期倒退，不能重复领取'};
 if(r.status==='blocked')return result(refreshed,'blocked',reasons[r.reason!]??r.reason!);
 const wasAd=kind==='free'&&r.fish.freeCount>SOURCE_FISH_NO_AD_DRAWS;
 return result({...refreshed,session:{...b.session,diamonds:r.diamonds,rngState,events:[],notice:''},platform:audit(b.platform,receipt,wasAd?'ad':'unlock',0)},'granted',`${wasAd?'开发免广告：':''}获得等级 ${r.grade!+1} 鱼${kind==='premium'?'（钻石 -200）':''}`);
}
export function runtimeSourceFishFusion(b:SourceMetaBundle,a:number,c:number):SourceMetaRuntimeResult {
 if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景合成鱼');
 const r=sourceFishFusion(b.meta.fish,a,c);
 if(r.status!=='supported')return result(b,'blocked',r.reason==='fish-max-grade'?'已达到鱼的最高等级':r.reason==='fish-fusion-grade-mismatch'?'只能合成同等级鱼':'请选择两条不同的鱼');
 return result({...b,meta:{...b.meta,fish:r.value.fish},session:{...b.session,events:[],notice:''}},'granted',`合成等级 ${r.value.grade+1} 鱼`);
}

/** Source UI switch is independent of ownership and advertisement remaining time. */
export function runtimeSourceAutoUpgradeSet(b:SourceMetaBundle,requested:boolean):SourceMetaRuntimeResult {
 if(typeof requested!=='boolean')return result(b,'blocked','无效自动强化开关');
 const next={...b,meta:{...b.meta,autoUpgrade:{...b.meta.autoUpgrade,requested}}};
 return result(next,'granted',`自动强化${requested?'开启':'关闭'}`);
}
/** Root calls once per rendered frame, not as offline elapsed credit. Returns the same bundle if no time changed. */
export function runtimeSourceAutoUpgradeTick(b:SourceMetaBundle,deltaSec:number,adShowing=false):SourceMetaBundle {
 const autoUpgrade=sourceTickAutoUpgradeTime(b.meta.autoUpgrade,deltaSec,b.meta.entitlements.autoUpgradePack,adShowing);
 return autoUpgrade===b.meta.autoUpgrade?b:{...b,meta:{...b.meta,autoUpgrade}};
}
export function developerSourceAutoUpgradeAd(b:SourceMetaBundle,time:MineTimeAdapter=localMineTime):SourceMetaRuntimeResult {
 if(b.session.mode!=='field')return result(b,'blocked','请返回普通场景领取自动强化广告增益');
 const today=time.today(),receipt=`meta:auto-upgrade-ad:${today}`;
 // Local receipt/date protection is adapter policy, separate from native lastDate != today.
 if(b.platform.claims.includes(receipt))return result(b,'blocked','今日自动强化广告已领取');
 if(today&&b.meta.autoUpgrade.lastAdDate&&today<b.meta.autoUpgrade.lastAdDate)return result(b,'blocked','本地日期倒退，不能重复领取');
 const r=sourceAutoUpgradeAdReward(b.meta.autoUpgrade,b.meta.entitlements.autoUpgradePack,today,provider(b.platform,'ad'));
 if(r.status!=='supported')return result(b,r.status,r.reason==='auto-upgrade-ad-unconfirmed'?'请先启用开发者模式和免广告':r.reason);
 const next={...b,meta:{...b.meta,autoUpgrade:r.value},platform:audit(b.platform,receipt,'ad',0)};
 const upgraded=runtimeSourceAutoUpgrade(next);
 return result(upgraded,'granted','开发免广告：自动强化 10 分钟');
}

/** Source toggle requires PlusPack2; absent ownership forces off and directs UI to package purchase. */
export function runtimeSourceFishAutoMergeSet(b:SourceMetaBundle,requested:boolean):SourceMetaRuntimeResult {
 if(typeof requested!=='boolean')return result(b,'blocked','无效鱼自动合成开关');
 const allowed=b.meta.entitlements.plusPack2Active,next={...b,meta:{...b.meta,fish:{...b.meta.fish,autoMergeRequested:allowed&&requested}}};
 return result(next,allowed?'granted':'blocked',allowed?`鱼自动合成${requested?'开启':'关闭'}`:'鱼自动合成需要PlusPack2');
}
export function runtimeSourceFishAutoMergeOnce(b:SourceMetaBundle,pool:readonly SourceFishAutoMergeCandidate[]):SourceMetaRuntimeResult {
 if(b.session.mode!=='field')return result(b,'blocked','普通场景外不执行鱼自动合成');
 const r=sourceFishAutoMergeOnce(b.meta.fish,b.meta.entitlements.plusPack2Active,pool);
 return r.status==='supported'?result({...b,meta:{...b.meta,fish:r.value.fish}},'granted',`自动合成等级 ${r.value.grade+1} 鱼`):result(b,'blocked',r.reason);
}

/** Pet wallet and inventory commit together; native dispatch locks travel with pets. */
export function runtimeSourcePetAction(b:SourceMetaBundle,action:'draw'|'merge'|'equip'|'unequip'|'swap-selected'|'move-owned'|'swap-owned'|'daily-ad',payload:unknown,time:MineTimeAdapter=localMineTime,requestId=String(b.platform.sequence)):SourceMetaRuntimeResult {
 if(b.session.mode!=='field'||b.session.historicMax<110)return result(b,'blocked','宠物在第12大关开放，请返回普通场景');
 let r:SourcePetResult;const p=payload as {a:number;b:number;index?:number;destination?:number;guards?:unknown};let receipt:string|undefined;
 if(p&&typeof p==='object'&&'guards'in p&&!sourcePetGuardsCurrent(b.meta.pet,p.guards))return result(b,'blocked','宠物已变化，请重新操作');
 if(action==='move-owned'||action==='swap-owned'){
  const indices=action==='move-owned'?[p?.a,p?.b]:[p?.a,p?.b,...(p?.destination!==undefined&&p.destination!==-1?[p.destination]:[])];
  if(!Array.isArray(p?.guards)||!indices.every(index=>(p.guards as any[]).some(g=>g.kind==='owned'&&g.index===index)))return result(b,'blocked','宠物位置快照不完整，请重新拖动');
 }
 if(action==='draw'){
  if(payload!=='petCoin'&&payload!=='diamonds')return result(b,'blocked','无效宠物购买方式');
  r=sourcePetDraw(b.meta.pet,{petCoin:b.meta.petCoin,diamonds:b.session.diamonds},payload);
 }else if(action==='daily-ad'){
  if(typeof requestId!=='string'||!requestId.trim()||requestId.length>128)return result(b,'blocked','无效宠物广告请求');
  receipt=`meta:pet-daily:${time.today()}:${requestId}`;
  if(b.platform.claims.includes(receipt))return result(b,'blocked','本次宠物领取已处理');
  r=sourcePetDailyAd(b.meta.pet,{wave:b.meta.hunt.wave,level:b.meta.hunt.level,todayKey:sourcePetLocalDate(time.today()),confirmed:provider(b.platform,'ad')});
 }else if(action==='unequip')r=sourcePetUnequip(b.meta.pet,typeof payload==='number'?payload:p?.index as number);
 else if(!p||typeof p!=='object')return result(b,'blocked','无效宠物操作');
 else if(action==='merge')r=sourcePetMerge(b.meta.pet,p.a,p.b);
 else if(action==='equip')r=sourcePetEquip(b.meta.pet,p.a,p.b);
 else if(action==='swap-selected')r=sourcePetSwapSelected(b.meta.pet,p.a,p.b);
 else if(action==='move-owned')r=sourcePetMoveOwned(b.meta.pet,p.a,p.b);
 else if(action==='swap-owned')r=sourcePetSwapOwned(b.meta.pet,p.a,p.b,p.destination);
 else return result(b,'unsupported','尚未接入的宠物操作');
 if(r.status!=='supported'){
  const messages:Record<string,string>={'pet-inventory-full':'宠物库存已满','pet-petCoin-insufficient':'宠物币不足','pet-diamonds-insufficient':'钻石不足','pet-merge-grade-mismatch':'只能合成同等级宠物','pet-merge-locked':'派遣中的宠物不能合成','pet-merge-max-grade':'已达最高宠物等级','pet-daily-ad-locked':'先完成一关狩猎','pet-daily-ad-used':'今日已领取','pet-ad-unconfirmed':'请先启用开发者模式和免广告'};
  return result(b,'blocked',messages[r.reason]??r.reason);
 }
 return result({...b,session:{...b.session,diamonds:petWalletDelta(b.session.diamonds,r.diamondDelta),events:[],notice:''},meta:{...b.meta,pet:r.value,petCoin:petWalletDelta(b.meta.petCoin,r.petCoinDelta)},platform:receipt?audit(b.platform,receipt,'ad',0):b.platform},'granted',action==='draw'?'获得宠物':action==='merge'?'宠物合成成功':action==='daily-ad'?'开发免广告：领取宠物':action==='move-owned'||action==='swap-owned'?'宠物库存位置已更新':'宠物装备已更新');
}

function petWalletDelta(balance:number,delta:number):number {const next=balance+delta;if(!isInt(balance)||!Number.isSafeInteger(delta)||!isInt(next))throw new RangeError('Pet balance overflow');return next;}

/** Source Time_manager date is yyyyMMdd; the host clock remains explicitly local. */
export function sourcePetLocalDate(key:string):string {const raw=key.startsWith('h5-local:')?key.slice(9):key;if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return '';const date=new Date(raw+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw?raw.replaceAll('-',''):'';}

/** Monster Power uses source type multipliers, independent of ordinary upgrade power. */
export function runtimeSourceHuntPower(b:SourceMetaBundle) {
 return sourceHuntTeamPower(b.session.equippedGuns.map((gun,slot)=>({active:!!gun,baseDamage:gun?.damageValue??gun?.damage??0,baseIntervalSeconds:gun?.intervalSeconds??1,starLevel:b.session.bossSlotLevels?.[slot]??0,gunType:gun?.sourceType??0,shotgunPelletCount:gun?.pelletCount??1})),sessionBossModifiers(b.session,b.meta.entitlements,b.meta.fish,b.meta.buffTimes,b.meta.relic));
}
/** Only recovered sweep/settlement transactions. Battle generation is a separate contract. */
export function runtimeSourceHuntAction(b:SourceMetaBundle,action:'sweep'|'exit'):SourceMetaRuntimeResult {
 if(b.session.mode!=='field'||b.session.historicMax<110)return result(b,'blocked','狩猎在第12大关开放，请返回普通场景');
 const e=sourceRewardEntitlements(b.meta.entitlements);
 const r=action==='sweep'?sourceHuntSweep(b.meta.hunt,runtimeSourceHuntPower(b),e):sourceHuntExit(b.meta.hunt);
 if(r.status!=='supported'){
  const messages:Record<string,string>={'hunt-sweep-plus2-required':'狩猎扫荡需要PlusPack2','hunt-sweep-power-insufficient':'狩猎战力不足','hunt-run-open':'请先关闭上次狩猎结算','hunt-no-open-run':'没有待关闭的狩猎结算'};
  return result(b,r.status,messages[r.reason]??r.reason);
 }
 return result({...b,meta:{...b.meta,hunt:r.value,petCoin:petWalletDelta(b.meta.petCoin,r.petCoinGrant)}},'granted',action==='sweep'?`狩猎扫荡${r.value.run!.clearedLevels}关，宠物币 +${r.petCoinGrant}`:'狩猎结算已关闭');
}

/** H5 atomic host envelope includes pet locks and map/reward state; source cancel/clear
 * direct-save absence remains in the transaction evidence, not claimed equivalent. */
export function runtimeSourceAdventure(b:SourceMetaBundle,action:'start'|'claim'|'cancel'|'force-finish',type:number,index:number,clock:SourceAdventureClock,selected:readonly SourceDispatchPet[]=[]):SourceMetaRuntimeResult & {adventureResult:SourceAdventureResult} {
 const s=b.meta.adventure,p=b.meta.pet,e=b.meta.entitlements.plusPack2Active;
 const r=action==='start'?sourceAdventureStart(s,p,type,index,selected,clock):action==='claim'?sourceAdventureClaim(s,p,type,index,clock,e):action==='cancel'?sourceAdventureCancel(s,p,type,index):sourceAdventureForceFinish(s,p,type,index,clock,e);
 return {...result({...b,meta:{...b.meta,adventure:r.state,pet:r.pet}},r.status,r.reason),adventureResult:r};
}

/** CoreByType is separate from PetCoin. Session RNG is committed only together
 * with the successful relic + core wallet transaction. No external provider. */
export function runtimeSourceRelic(b:SourceMetaBundle,action:'draw'|'upgrade',coreType:number,count:number|'max'=1,index=0):SourceMetaRuntimeResult & {draws:SourceRelicDrawItem[]} {
 if(b.session.mode!=='field'||!contentGate(b.session.historicMax,'adventure').unlocked)return {...result(b,'blocked','遗物在探索入口（第35大关）开放，请返回普通场景'),draws:[]};
 let rngState=b.session.rngState;const random=()=>{rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/0x100000000;};
 const r=action==='draw'?sourceRelicDraw(b.meta.relic,b.meta.adventure.cores,coreType,count,random):sourceRelicUpgrade(b.meta.relic,b.meta.adventure.cores,index);
 if(r.status==='blocked')return {...result(b,'blocked',r.reason),draws:[]};
 return {...result({...b,session:{...b.session,rngState,events:[],notice:''},meta:{...b.meta,relic:r.state,adventure:{...b.meta.adventure,cores:r.cores}}},'granted',r.reason),draws:r.draws};
}
