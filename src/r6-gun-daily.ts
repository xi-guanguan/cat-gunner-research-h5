/** Weapon01/type10. Source daily callback checks DATE + empty slot, not the server,
 * progression or panel gates that ran before the ad. Local clock/RNG are explicit H5 adapters. */
import {GUN_INVENTORY_CAPACITY,sourceGun,type Gun} from './session';
import {sourceDailyGunGate,sourceClaimDailyGun} from './source-meta-actions';
import type {SourceMetaBundle} from './source-meta-runtime';
export function sourceGunDailyDateValid(day:string):boolean {
 if(!/^h5-local:\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const key=day.slice(9),d=new Date(key+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===key;
}
const reasons:Record<string,string>={'weapon01-ad-disabled':'每日广告枪未启用；真实服务器开关尚未接入','historic-stage30-required':'广告枪在历史进度 30 后开放','daily-gun-already-claimed':'今日广告枪已领取'};
export function sourceGunDailyRequestGate(b:SourceMetaBundle,day:string):string|null {
 if(b.session.mode!=='field')return '请返回普通场景领取';
 if(!sourceGunDailyDateValid(day))return '广告枪本地日期适配器无效';
 if(b.meta.adDailyGun.lastDailyGunKey!==null&&day<b.meta.adDailyGun.lastDailyGunKey)return '本地日期倒退，不能重复领取广告枪';
 const gate=sourceDailyGunGate(b.meta.adDailyGun.lastDailyGunKey,{serverWeapon01AdOn:b.meta.adDailyGun.serverWeapon01AdOn,historicStage:b.session.historicMax,trustedTodayKey:day});
 if(gate.status!=='supported')return reasons[gate.reason]??gate.reason;
 if(b.platform.claims.includes(`meta:developer-ad-daily-gun:${day}`))return '今日广告枪已领取';
 if(b.session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return '武器库存已满，广告枪未领取';return null;
}
export type SourceGunDailyGrant={status:'granted';bundle:SourceMetaBundle;gun:Gun;slot:number}|{status:'blocked'|'duplicate';reason:string};
export function sourceGunDailyReward(b:SourceMetaBundle,day:string,requestID:string):SourceGunDailyGrant {
 if(!requestID.trim()||requestID.length>128)return {status:'blocked',reason:'无效广告枪请求身份'};
 const receipt=`meta:gun-daily-provider:${requestID}`;
 if(b.platform.claims.includes(receipt))return {status:'duplicate',reason:'该广告枪已入账；不重复发奖'};
 if(!sourceGunDailyDateValid(day))return {status:'blocked',reason:'广告枪本地日期适配器无效'};
 const previous=b.meta.adDailyGun.lastDailyGunKey;
 if(previous!==null&&day<previous)return {status:'blocked',reason:'本地日期倒退，不能重复领取广告枪'};
 if(previous===day||b.platform.claims.includes(`meta:developer-ad-daily-gun:${day}`))return {status:'blocked',reason:'今日广告枪已领取'};
 // Native FindFirstEmptyOwned precedes Random.Range: full inventory must not advance RNG.
 if(b.session.gunInventory.length>=GUN_INVENTORY_CAPACITY)return {status:'blocked',reason:'武器库存已满，广告枪未领取'};
 if(!Number.isSafeInteger(b.session.gunDraws+1))return {status:'blocked',reason:'武器抽取计数超出可保存范围'};
 const rngState=(Math.imul(b.session.rngState,1664525)+1013904223)>>>0;
 const inventory=Array.from({length:GUN_INVENTORY_CAPACITY},(_,i)=>b.session.gunInventory[i]??null);
 // Only callback gates: native AD_Daily_Gun_RewardGet does not reread Weapon01AdOn/stage.
 const r=sourceClaimDailyGun({lastDailyGunKey:previous,inventory},{serverWeapon01AdOn:true,historicStage:30,trustedTodayKey:day,adConfirmed:true,roll:rngState/0x100000000},id=>({...sourceGun(id),uid:`daily:${requestID}`}));
 if(r.status!=='supported')return {status:'blocked',reason:reasons[r.reason]??r.reason};
 const gun=r.value.state.inventory[r.value.slot]!;
 const session={...b.session,gunInventory:r.value.state.inventory.filter((g):g is Gun=>g!==null),gunDraws:b.session.gunDraws+1,rngState,catalogSeen:[...new Set([...(b.session.catalogSeen??[0]),r.value.gunId])].sort((a,c)=>a-c),notice:'',events:[{type:'gunDrawn' as const,gun}]};
 return {status:'granted',gun,slot:r.value.slot,bundle:{...b,session,meta:{...b.meta,adDailyGun:{...b.meta.adDailyGun,lastDailyGunKey:day}},platform:{...b.platform,claims:[...b.platform.claims,receipt],sequence:b.platform.sequence+1,audit:[...b.platform.audit,{id:receipt,kind:'ad' as const,amount:0,at:day}].slice(-100)}}};
}
