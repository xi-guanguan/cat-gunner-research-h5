/** Native AutoUpgrade_UI + Upgrade_manager. Evidence: meta-r5-source-disasm.txt. Local clock adapter is explicit. */
import {sourceFishDateKey} from './r5-fish';
export const SOURCE_AUTO_UPGRADE_AD_SECONDS=600;
export interface SourceAutoUpgradeState {requested:boolean;lastAdDate:string|null;adRemainingSec:number}
/** Setting.AutoUpgrade_Disable is zero in the static initial state. requested is its positive H5 projection. */
export const freshSourceAutoUpgradeState=():SourceAutoUpgradeState=>({requested:true,lastAdDate:null,adRemainingSec:0});
export function decodeSourceAutoUpgradeState(v:unknown):SourceAutoUpgradeState {
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid auto upgrade state');
 const s=v as SourceAutoUpgradeState;
 if(typeof s.requested!=='boolean'||!(s.lastAdDate===null||sourceFishDateKey(s.lastAdDate))||!Number.isFinite(s.adRemainingSec)||s.adRemainingSec<0||s.adRemainingSec>SOURCE_AUTO_UPGRADE_AD_SECONDS||s.adRemainingSec>0&&s.lastAdDate===null)throw new Error('Invalid auto upgrade state');
 return {...s};
}
export function sourceAutoUpgradeEnabled(s:SourceAutoUpgradeState,permanent:boolean):boolean {return s.requested&&(permanent||s.adRemainingSec>0);}
export function sourceAutoUpgradeAdAble(s:SourceAutoUpgradeState,permanent:boolean,today:string|null):boolean {return sourceFishDateKey(today)&&!permanent&&s.adRemainingSec<=0&&s.lastAdDate!==today;}
/** Legacy combined developer adapter: admission + reward. Main type12 callback now uses
 * r6-auto-upgrade-ad.ts because native RewardGet does NOT recheck these admission gates. */
export function sourceAutoUpgradeAdReward(s:SourceAutoUpgradeState,permanent:boolean,today:string|null,confirmed:boolean):{status:'supported';value:SourceAutoUpgradeState}|{status:'blocked'|'unsupported';reason:string} {
 decodeSourceAutoUpgradeState(s);
 if(!sourceFishDateKey(today))return {status:'unsupported',reason:'auto-upgrade-date-unavailable'};
 if(!confirmed)return {status:'blocked',reason:'auto-upgrade-ad-unconfirmed'};
 if(!sourceAutoUpgradeAdAble(s,permanent,today))return {status:'blocked',reason:permanent?'auto-upgrade-permanent':s.adRemainingSec>0?'auto-upgrade-ad-active':'auto-upgrade-ad-watched-today'};
 return {status:'supported',value:{...s,lastAdDate:today,adRemainingSec:SOURCE_AUTO_UPGRADE_AD_SECONDS}};
}
/** Native Update consumes min(deltaTime,.5), even if user switches off. Ad showing or permanent pack freezes it. */
export function sourceTickAutoUpgradeTime(s:SourceAutoUpgradeState,deltaSec:number,permanent=false,adShowing=false):SourceAutoUpgradeState {
 if(!Number.isFinite(deltaSec)||deltaSec<0)throw new RangeError('Invalid auto upgrade delta');
 if(permanent||adShowing||s.adRemainingSec<=0||deltaSec===0)return s;
 return {...s,adRemainingSec:Math.max(0,Math.fround(Math.fround(s.adRemainingSec)-Math.fround(Math.min(deltaSec,.5))))};
}
