/** Raid source preflight rules. Native methods and full UI records:
 * artifacts/evidence/round6-20261002/raid-foundation-{contract.json,native.txt}.
 * No battle/DPS simulation here; an unready client never consumes an entry. */
import guns from './data/guns.json';
import contract from './data/r6-raid-contract.json';
export const SOURCE_RAID_TICKET_PRODUCT=contract.ticketProduct.value;
import {BigValue} from './big-value';
import {gunEntityUID} from './gun-drag';
import {GUN_INVENTORY_CAPACITY,sourceGunID,type Session,type Gun} from './session';
import {sourceWeekIndex,SOURCE_WEEKLY} from './r6-weekly';
import {sourceStarDamage} from './r6-star';
import {raidEntryTypeNow,type RaidEntries} from './r5-raid';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import type {MineTimeAdapter} from './mine-time';
export const SOURCE_RAID_DAILY_KEY='raid_ticket';
export interface SourceRaidState extends RaidEntries {
 entryDate:string|null;seasonIndex:number;tryCount:number;bestLevel:number;bestByType:number[];helperSeasonIndex:number;
 /** H5 idempotency ledger; not a native online receipt. Selection stays runtime-only. */
 entryClaims:string[];dailyGainDates:string[];
 /** Local once-only live result receipts. Missing in older saves means empty, never a reward. */
 settlementClaims?:string[];
 /** H5 local helper receipt IDs, missing older saves migrate empty. */
 helperClaims?:string[];
}
export const freshSourceRaid=():SourceRaidState=>({entryDate:null,freeUseCount:0,adUsed:false,iapUsed:false,seasonIndex:-1,tryCount:0,bestLevel:0,bestByType:Array(7).fill(0),helperSeasonIndex:-1,entryClaims:[],dailyGainDates:[],settlementClaims:[],helperClaims:[]});
const int=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=2147483647;
const signed=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=-2147483648&&Number(v)<=2147483647;
function dateKey(v:unknown):v is string {if(typeof v!=='string'||!/^h5-local:\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v.slice(9)+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v.slice(9);}
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string'&&s.trim().length>0)&&new Set(v).size===v.length;
export function decodeSourceRaid(raw:unknown):SourceRaidState {
 const s=raw as SourceRaidState;
 if(!s||!(s.entryDate===null||dateKey(s.entryDate))||!int(s.freeUseCount)||typeof s.adUsed!=='boolean'||typeof s.iapUsed!=='boolean'||!signed(s.seasonIndex)||!int(s.tryCount)||!int(s.bestLevel)||!Array.isArray(s.bestByType)||s.bestByType.length!==7||!s.bestByType.every(int)||!signed(s.helperSeasonIndex)||!ids(s.entryClaims)||!ids(s.dailyGainDates)||!s.dailyGainDates.every(dateKey)||(s.settlementClaims!==undefined&&!ids(s.settlementClaims))||(s.helperClaims!==undefined&&!ids(s.helperClaims)))throw Error('Invalid Raid save');
 return {...s,bestByType:[...s.bestByType],entryClaims:[...s.entryClaims],dailyGainDates:[...s.dailyGainDates],settlementClaims:[...(s.settlementClaims??[])],helperClaims:[...(s.helperClaims??[])]};
}
/** Source Season_Check only resets season tries/best, not all-time type records or helper. */
export function sourceRaidSeason(s:SourceRaidState,date:Date):SourceRaidState {
 const seasonIndex=sourceWeekIndex(date);return seasonIndex===s.seasonIndex?s:{...s,seasonIndex,tryCount:0,bestLevel:0};
}
/** Ticket_Reload: date mismatch -> category3 permission -> RecordGain -> reset all entry branches.
 * MineTimeAdapter is explicitly a local calendar adapter, not trusted server parity. */
export function sourceRaidTickets(s:SourceRaidState,time:MineTimeAdapter):SourceRaidState {
 const today=time.today();if(!dateKey(today))throw RangeError('Invalid Raid local date');
 if(s.entryDate===today||s.dailyGainDates.includes(today)||time.canRolloverDaily(3,s.entryDate??'',today)!==true)return s;
 return {...s,entryDate:today,freeUseCount:0,adUsed:false,iapUsed:false,dailyGainDates:[...s.dailyGainDates,today]};
}
export function sourceRaidWeakType(seasonIndex:number):number {
 if(!signed(seasonIndex))throw RangeError('Invalid Raid season');
 const offset=((seasonIndex%5)+5)%5;return guns.guns[SOURCE_WEEKLY.gunBase[1]+offset]?.type??2;
}
export const sourceRaidWeakTypeNow=(date:Date)=>sourceRaidWeakType(sourceWeekIndex(date));
export function sourceRaidDamage(gunID:number,weakType:number):BigValue {
 const g=guns.guns[gunID];if(!Number.isInteger(gunID)||!g)throw RangeError('Invalid Raid gun');
 const base=BigValue.from(`${g.damage}e${g.damageExponent}`);return g.type===weakType?base.nativeMultiply(10):base;
}
export function sourceRaidSlotDamage(session:Session,slot:number,gunID:number,weakType:number):BigValue {
 if(!Number.isInteger(slot)||slot<0||slot>2)throw RangeError('Invalid Raid slot');
 return sourceStarDamage(sourceRaidDamage(gunID,weakType),session.bossSlotLevels?.[slot]??0);
}
export interface SourceRaidGunRef {index:number;kind:'equipment'|'inventory'|'safe';localIndex:number;uid:string;gunID:number}
/** Native GunList is a fixed16 array; H5 inventory is compact. Pad BEFORE assigning safe indices.
 * Safe_Base must not shift when a draw/merge changes H5's compact length. */
export function sourceRaidCandidates(session:Session):SourceRaidGunRef[] {
 const result:SourceRaidGunRef[]=[];
 const add=(gun:Gun|null|undefined,kind:SourceRaidGunRef['kind'],localIndex:number,index:number)=>{if(gun)result.push({index,kind,localIndex,uid:gunEntityUID(gun),gunID:sourceGunID(gun)});};
 for(let i=0;i<3;i++)add(session.equippedGuns[i],'equipment',i,i);
 for(let i=0;i<GUN_INVENTORY_CAPACITY;i++)add(session.gunInventory[i],'inventory',i,i+3);
 session.gunSafe?.guns.forEach((g,i)=>add(g,'safe',i,GUN_INVENTORY_CAPACITY+3+i));return result;
}
/** Source comparison: damage descending, equal damage index.CompareTo ascending.
 * Do NOT sort by DPS, star level, degree, or catalogue identity. */
export function sourceRaidSorted(session:Session,weakType:number):SourceRaidGunRef[] {
 return sourceRaidCandidates(session).sort((a,b)=>sourceRaidDamage(b.gunID,weakType).compare(sourceRaidDamage(a.gunID,weakType))||a.index-b.index);
}
export type SourceRaidSelection=(SourceRaidGunRef|null)[];
export const sourceRaidAutoSelect=(session:Session,weakType:number):SourceRaidSelection=>{const sorted=sourceRaidSorted(session,weakType);return Array.from({length:3},(_,i)=>sorted[i]??null);};
export function sourceRaidResolve(session:Session,ref:SourceRaidGunRef|null):SourceRaidGunRef|null {
 if(!ref)return null;const current=sourceRaidCandidates(session).find(g=>g.uid===ref.uid&&g.gunID===ref.gunID);return current??null;
}
export function sourceRaidSelectionRefresh(session:Session,selection:SourceRaidSelection):SourceRaidSelection {return Array.from({length:3},(_,i)=>sourceRaidResolve(session,selection[i]??null));}
export function sourceRaidSelect(session:Session,selection:SourceRaidSelection,slot:number,ref:SourceRaidGunRef):{selection:SourceRaidSelection;reason?:string} {
 if(!Number.isInteger(slot)||slot<0||slot>2)return {selection,reason:'无效突袭枪槽'};
 // An old click may never select a different gun which now occupies that index.
 const current=sourceRaidCandidates(session).find(g=>g.index===ref.index&&g.uid===ref.uid&&g.gunID===ref.gunID);
 if(!current)return {selection,reason:'武器位置或身份已变化，请重新选择'};
 const refreshed=sourceRaidSelectionRefresh(session,selection);
 if(refreshed.some(g=>g?.uid===current.uid))return {selection:refreshed,reason:'此武器已用于突袭枪槽'};
 const next=[...refreshed];next[slot]=current;return {selection:next};
}
export interface SourceRaidEntryContext {historicMax:number;ready:boolean;selectedCount:number;pending:boolean}
export function sourceRaidEntryGate(s:SourceRaidState,c:SourceRaidEntryContext):string|undefined {
 if(c.historicMax<390)return '普通第40大关开放突袭';
 if(c.pending)return '正在等待突袭入场回调';
 if(!c.ready)return '突袭实时战斗尚未接通；未扣次数、未请求广告或购买';
 if(c.selectedCount<1)return '至少选择一把武器';
 if(raidEntryTypeNow(s)===0)return '今日突袭次数已用完';
}
export interface SourceRaidEntryRequest extends SourceRewardRequest {entryDate:string;seasonIndex:number;entryType:2|3;contextID:string}
export function sourceRaidEntryPurpose(type:2|3):string {return type===2?'raid-entry-placement-15':SOURCE_RAID_TICKET_PRODUCT;}
export function sourceRaidConsumeFree(s:SourceRaidState,c:SourceRaidEntryContext):{state:SourceRaidState;reason?:string} {
 const reason=sourceRaidEntryGate(s,c);if(reason)return {state:s,reason};if(raidEntryTypeNow(s)!==1)return {state:s,reason:'当前不是免费入场分支'};
 return {state:{...s,freeUseCount:s.freeUseCount+1}};
}
/** Transport identity AND current daily/season/context ownership are required before a debit.
 * Duplicate/late callbacks cannot open another run. Caller prepares runtime before making the request. */
export function sourceRaidEntryReward(s:SourceRaidState,request:SourceRaidEntryRequest,response:SourceRewardResponse,c:SourceRaidEntryContext,contextID:string):{state:SourceRaidState;status:'granted'|'blocked'|'duplicate';reason:string} {
 const deny=(reason:string)=>({state:s,status:'blocked' as const,reason});
 if(!request.id?.trim()||![2,3].includes(request.entryType)||request.purpose!==sourceRaidEntryPurpose(request.entryType)||request.kind!==(request.entryType===2?'ad':'purchase')||!sourceRewardMatches(request,response))return deny('突袭回调身份不匹配');
 if(s.entryClaims.includes(request.id))return {state:s,status:'duplicate',reason:'重复突袭回调；未重复入场'};
 if(request.contextID!==contextID||request.entryDate!==s.entryDate||request.seasonIndex!==s.seasonIndex)return deny('突袭上下文或日/赛季已变化；未入场');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实广告/商店未连接；未消耗突袭次数':`本地测试回调${response.status==='cancelled'?'取消':'失败'}；未入场`);
 const gate=sourceRaidEntryGate(s,{...c,pending:false});if(gate)return deny(gate);
 if(raidEntryTypeNow(s)!==request.entryType)return deny('突袭入场分支已变化；未消耗次数');
 return {state:{...s,...(request.entryType===2?{adUsed:true}:{iapUsed:true}),entryClaims:[...s.entryClaims,request.id]},status:'granted',reason:'本地测试入场；线上未连接'};
}
