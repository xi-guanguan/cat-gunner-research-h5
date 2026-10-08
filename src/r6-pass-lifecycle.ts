/** Native Mission_manager lifecycle. Clock and history are explicit H5 adapters. */
import {ACTIVITY_MISSIONS} from './source-activities';
import {sourceMissionReset,sourceSeasonReset,sourceNextSeasonEnd,sourceSeasonClosed,type SourceSeasonState,type SourcePassProgress} from './source-meta-actions';
import type {SourceMetaBundle} from './source-meta-runtime';
import constants from './data/r6-pass-contract.json';
export interface SourcePassSeasonRecord {seasonNumber:number;endedAt:string;reason:'expired'|'all-rewards';level:number;exp:number;normalClaims:number[];epicClaims:number[];vip:boolean;luxury:boolean}
export interface SourcePassLifecycle {seasonNumber:number;seasonStarted:boolean;gunSeason:boolean;seasonEnd:string|null;missionStart:string|null;lastAcceptedDay:string|null;history:SourcePassSeasonRecord[]}
export interface SourcePassClock {now:string|null;today:string|null;canGrantTimedReward:boolean|null;pendingCount:number|null;canRolloverDaily:boolean|null;evidence:string}
export interface SourcePassReward {kind:'diamonds'|'gunUnlock'|'core';amount:number;requiresAd:boolean;coreType?:3}
export const freshSourcePassLifecycle=():SourcePassLifecycle=>({seasonNumber:0,seasonStarted:false,gunSeason:true,seasonEnd:null,missionStart:null,lastAcceptedDay:null,history:[]});
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v&&v>='0001-01-01';
const stamp=(v:unknown):v is string=>typeof v==='string'&&date(v.slice(0,10))&&sourceNextSeasonEnd(v).status==='supported';
const claims=(v:unknown):v is number[]=>Array.isArray(v)&&v.length<=25&&v.every((n,i)=>n===i);
export function decodeSourcePassLifecycle(v:unknown):SourcePassLifecycle {
 const s=v as SourcePassLifecycle;
 if(!s||!integer(s.seasonNumber)||s.seasonNumber>2147483646||typeof s.seasonStarted!=='boolean'||typeof s.gunSeason!=='boolean'||!(s.lastAcceptedDay===null||date(s.lastAcceptedDay))||!(s.seasonEnd===null||stamp(s.seasonEnd))||!(s.missionStart===null||stamp(s.missionStart))||s.seasonStarted&&(!s.seasonEnd||!s.missionStart||!s.lastAcceptedDay)||!s.seasonStarted&&(s.seasonNumber!==0||s.seasonEnd!==null||s.missionStart!==null||s.lastAcceptedDay!==null||s.history?.length>0)||!Array.isArray(s.history)||s.history.length>48)throw Error('Invalid pass lifecycle');
 for(const h of s.history)if(!h||!integer(h.seasonNumber)||h.seasonNumber>=s.seasonNumber||!stamp(h.endedAt)||!['expired','all-rewards'].includes(h.reason)||!integer(h.level)||h.level>25||!integer(h.exp)||!claims(h.normalClaims)||!claims(h.epicClaims)||typeof h.vip!=='boolean'||typeof h.luxury!=='boolean'||h.luxury&&!h.vip)throw Error('Invalid pass history');
 if(s.history.some((h,i)=>i>0&&h.seasonNumber<=s.history[i-1].seasonNumber))throw Error('Invalid pass history order');
 return {...s,history:s.history.map(h=>({...h,normalClaims:[...h.normalClaims],epicClaims:[...h.epicClaims]}))};
}
/** Reward_Balance_Apply: source HighTier_Gun_Table, not initial serialized entries. */
export function sourcePassRewards(seasonNumber=0,gunSeason=true,track:0|1=0):SourcePassReward[] {
 if(!integer(seasonNumber)||![0,1].includes(track))throw RangeError('Invalid pass reward season/track');
 return Array.from({length:25},(_,index)=>{
  const requiresAd=track===0&&index>=3&&index%3===0;
  if(index%3===2){
   if(seasonNumber>0&&!gunSeason)return {kind:'core',coreType:3,amount:(400+10*index)*(track===1?3:1),requiresAd};
   const gun=seasonNumber===0?10+Math.min(19,(Math.floor(index/3)%2)*4+Math.floor(index/6)*5):constants.highTierGunTable[Math.min(Math.floor(index/3),constants.highTierGunTable.length-1)];
   return {kind:'gunUnlock',amount:gun+track*5,requiresAd};
  }
  return {kind:'diamonds',amount:(seasonNumber===0?200+40*index:600+20*index)*(track===1?3:1),requiresAd};
 });
}
export function sourcePassProgress(b:SourceMetaBundle):SourcePassProgress {
 const level=Math.min(25,Math.floor(b.activities.passExp/100));
 return {level,exp:b.activities.passExp-level*100,vip:b.meta.vip,luxury:b.meta.luxury,normalClaims:Array.from({length:25},(_,i)=>b.activities.passClaims.includes(i)),epicClaims:Array.from({length:25},(_,i)=>b.meta.epicClaims.includes(i)),pendingAdRewardIndex:-1};
}
export function sourcePutPass(b:SourceMetaBundle,p:SourcePassProgress):SourceMetaBundle {return {...b,activities:{...b.activities,passExp:p.level*100+p.exp,passClaims:p.normalClaims.flatMap((v,i)=>v?[i]:[])},meta:{...b.meta,vip:p.vip,luxury:p.luxury,epicClaims:p.epicClaims.flatMap((v,i)=>v?[i]:[])}};}
export function sourcePassAllRewards(b:SourceMetaBundle):boolean {const p=sourcePassProgress(b);return p.normalClaims.every(Boolean)&&(!p.vip||p.epicClaims.every(Boolean));}
export function sourcePassSeasonIdentity(b:SourceMetaBundle):string {const s=b.meta.passLifecycle;return JSON.stringify([s?.seasonNumber??0,s?.seasonEnd??null,s?.seasonStarted??false]);}
function state(b:SourceMetaBundle,l:SourcePassLifecycle):SourceSeasonState {return {...sourcePassProgress(b),...l,counters:[b.activities.counters['tree-destroyed'],b.activities.counters['stage-cleared'],b.activities.counters.rebirth,b.activities.counters['mine-played']],missionClaims:ACTIVITY_MISSIONS.map(m=>({normal:b.activities.missionClaims.includes(m.id)||b.meta.vipMissionClaims.includes(m.id),luxury:b.meta.luxuryMissionClaims.includes(m.id)}))};}
function put(b:SourceMetaBundle,s:SourceSeasonState,l:SourcePassLifecycle):SourceMetaBundle {const p=sourcePutPass(b,s);return {...p,activities:{...p.activities,season:s.seasonNumber>0?'later':'initial',counters:{'tree-destroyed':s.counters[0],'stage-cleared':s.counters[1],rebirth:s.counters[2],'mine-played':s.counters[3]},missionClaims:ACTIVITY_MISSIONS.flatMap((m,i)=>!m.requiresVip&&s.missionClaims[i].normal?[m.id]:[]),lastObservation:null},meta:{...p.meta,season:s.seasonNumber>0?'later':'initial',vipMissionClaims:ACTIVITY_MISSIONS.flatMap((m,i)=>m.requiresVip&&s.missionClaims[i].normal?[m.id]:[]),luxuryMissionClaims:ACTIVITY_MISSIONS.flatMap((m,i)=>s.missionClaims[i].luxury?[m.id]:[]),passLifecycle:l}};}
function usable(c:SourcePassClock,l:SourcePassLifecycle):string|null {if(!stamp(c.now)||!date(c.today)||c.now.slice(0,10)!==c.today)return '本地时间不可用；未重置';if(l.lastAcceptedDay&&c.today<l.lastAcceptedDay)return '设备日期回退；任务和赛季不重置';return null;}
export interface SourcePassLifecycleResult {bundle:SourceMetaBundle;changed:boolean;reset:'none'|'init'|'legacy-anchor'|'daily'|'season';message:string}
function resetSeason(b:SourceMetaBundle,l:SourcePassLifecycle,c:SourcePassClock,reason:'expired'|'all-rewards'|null):SourcePassLifecycleResult {
 const end=sourceNextSeasonEnd(c.now);if(end.status!=='supported')return {bundle:b,changed:false,reset:'none',message:end.reason};
 const before=state(b,l),r=sourceSeasonReset(before,{incrementSeason:l.seasonStarted,recordGain:reason==='expired',trustedNow:c.now,nextSeasonEnd:end.value});if(r.status!=='supported')return {bundle:b,changed:false,reset:'none',message:r.reason};
 const s=r.value.state,history=reason&&l.seasonStarted?[...l.history,{seasonNumber:l.seasonNumber,endedAt:c.now!,reason,level:before.level,exp:before.exp,normalClaims:[...b.activities.passClaims],epicClaims:[...b.meta.epicClaims],vip:b.meta.vip,luxury:b.meta.luxury}].slice(-48):l.history;
 const next:SourcePassLifecycle={seasonNumber:s.seasonNumber,seasonStarted:true,gunSeason:s.gunSeason,seasonEnd:s.seasonEnd,missionStart:s.missionStart,lastAcceptedDay:c.today,history};
 return {bundle:put(b,s,next),changed:true,reset:reason?'season':'init',message:reason?'新赛季已开始；任务、双轨领取和当季通行证权益已重置':'初始赛季已开始'};
}
/** Legacy H5 lacked native dates. Anchor without altering any old balances/claims. */
export function sourcePassRefresh(b:SourceMetaBundle,c:SourcePassClock):SourcePassLifecycleResult {
 let l=b.meta.passLifecycle;const missing=l===undefined;l=l??freshSourcePassLifecycle();const reason=usable(c,l);if(reason)return {bundle:b,changed:false,reset:'none',message:reason};
 if(missing){const end=sourceNextSeasonEnd(c.now);if(end.status!=='supported')return {bundle:b,changed:false,reset:'none',message:end.reason};return {bundle:{...b,meta:{...b.meta,passLifecycle:{...l,seasonNumber:b.activities.season==='later'?1:0,seasonStarted:true,seasonEnd:end.value,missionStart:c.now,lastAcceptedDay:c.today}}},changed:true,reset:'legacy-anchor',message:'旧存档补本地日期锚点；保留所有经验、领取和权益，不追补历史奖励'};}
 const closed=sourceSeasonClosed({seasonStarted:l.seasonStarted,canGrantTimedReward:c.canGrantTimedReward,pendingCount:c.pendingCount,trustedToday:c.today,seasonEndDate:l.seasonEnd?.slice(0,10)??null});
 if(closed.status==='supported'&&closed.value)return resetSeason(b,l,c,l.seasonStarted?'expired':null);
 if(closed.status!=='supported')return {bundle:b,changed:false,reset:'none',message:closed.reason};
 if(c.today!>l.missionStart!.slice(0,10)&&c.canRolloverDaily===true){const r=sourceMissionReset(state(b,l),c.now);if(r.status==='supported')return {bundle:put(b,r.value,{...l,missionStart:c.now,lastAcceptedDay:c.today}),changed:true,reset:'daily',message:'新一天任务已重置；通行证经验、奖励和权益保留'};}
 return c.today!==l.lastAcceptedDay?{bundle:{...b,meta:{...b.meta,passLifecycle:{...l,lastAcceptedDay:c.today}}},changed:true,reset:'none',message:''}:{bundle:b,changed:false,reset:'none',message:''};
}
export function sourcePassStartNext(b:SourceMetaBundle,c:SourcePassClock):SourcePassLifecycleResult {const l=b.meta.passLifecycle;if(!l?.seasonStarted)return {bundle:b,changed:false,reset:'none',message:'赛季尚未初始化'};const reason=usable(c,l);if(reason)return {bundle:b,changed:false,reset:'none',message:reason};if(!sourcePassAllRewards(b))return {bundle:b,changed:false,reset:'none',message:'请先领取当前普通轨奖励；VIP 还需领完高级轨'};return resetSeason(b,l,c,'all-rewards');}
/** Local device date is disclosed, never represented as Time_manager server trust. */
export function localSourcePassClock(d=new Date()):SourcePassClock {const z=-d.getTimezoneOffset(),sign=z>=0?'+':'-',offset=`${sign}${String(Math.floor(Math.abs(z)/60)).padStart(2,'0')}:${String(Math.abs(z)%60).padStart(2,'0')}`,day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return {now:`${day}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}${offset}`,today:day,canGrantTimedReward:true,pendingCount:0,canRolloverDaily:true,evidence:'H5 本地日期与存档日期回退保护；源服务器校时/未来收益账本未连接'};}
