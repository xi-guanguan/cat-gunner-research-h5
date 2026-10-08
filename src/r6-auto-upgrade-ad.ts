/** Source type12: admission uses Able; RewardGet unconditionally stores callback date and 600f.
 * Evidence auto-ad-native.json. Local calendar rollback and persisted request ledger are H5 adaptations. */
import {sourceAutoUpgradeAdAble,SOURCE_AUTO_UPGRADE_AD_SECONDS,type SourceAutoUpgradeState} from './r5-auto';
import {sourceFishDateKey} from './r5-fish';
import {sourceAutoUpgradeBattle} from './r5-entitlements';
import type {SourceMetaBundle} from './source-meta-runtime';
export function sourceAutoAdRequestGate(b:SourceMetaBundle,today:string):string|null {
 if(b.session.mode!=='field')return '请返回普通场景领取自动强化增益';
 if(!sourceFishDateKey(today))return '本地自动强化日期不可用；未连接可信服务时间';
 if(b.meta.entitlements.autoUpgradePack)return '已拥有永久自动强化';
 if(b.meta.autoUpgrade.adRemainingSec>0)return '自动强化广告增益仍在生效';
 if(b.meta.autoUpgrade.lastAdDate===today)return '今日自动强化广告已领取';
 if(b.meta.autoUpgrade.lastAdDate&&today<b.meta.autoUpgrade.lastAdDate)return '本地日期倒退；未再次发放增益';
 return sourceAutoUpgradeAdAble(b.meta.autoUpgrade,false,today)?null:'当前不能领取自动强化广告';
}
export function sourceAutoAdReward(b:SourceMetaBundle,today:string,id:string):{status:'granted';bundle:SourceMetaBundle}|{status:'blocked';reason:string} {
 if(!id.trim()||id.length>128)return {status:'blocked',reason:'无效自动强化广告请求身份'};
 const receipt=`meta:auto-ad-provider:${id}`;
 if(b.platform.claims.includes(receipt))return {status:'blocked',reason:'此自动强化广告回调已处理'};
 if(!sourceFishDateKey(today))return {status:'blocked',reason:'本地日期不可用；未发布增益'};
 if(b.meta.autoUpgrade.lastAdDate&&today<b.meta.autoUpgrade.lastAdDate)return {status:'blocked',reason:'本地日期倒退；未发布增益'};
 // Do not reuse request gate: source callback has no permanent/day/remain/switch/panel guard.
 const upgrades=sourceAutoUpgradeBattle(b.session.battle,b.meta.autoUpgrade.requested);
 return {status:'granted',bundle:{...b,session:{...b.session,battle:upgrades.battle,events:[...b.session.events,...upgrades.purchases.map(p=>({type:'upgradeSucceeded' as const,...p}))]},meta:{...b.meta,autoUpgrade:{...b.meta.autoUpgrade,lastAdDate:today,adRemainingSec:SOURCE_AUTO_UPGRADE_AD_SECONDS}},platform:{...b.platform,sequence:b.platform.sequence+1,claims:[...b.platform.claims,receipt],audit:[...b.platform.audit,{id:receipt,kind:'ad',amount:0,at:today}]}}};
}

/** AutoUpgrade_UI.Reload + serialized PPtr order: see auto-ad-scene-fields.json. */
export function sourceAutoAdPanelProjection(s:SourceAutoUpgradeState,permanent:boolean,today:string){
 const timed=!permanent&&s.adRemainingSec>0,active=permanent||timed,watched=s.lastAdDate===today;
 return {nonPurchase:!active,purchase:active,shop:!active&&watched,ad:!active&&!watched,on:active&&s.requested,off:active&&!s.requested,time:timed,inApp:!permanent};
}
