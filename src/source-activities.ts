import contract from './data/round3-ui-contract.json';
import {sourceGun, GUN_INVENTORY_CAPACITY, type Session} from './session';
export const ACTIVITY_STORAGE_KEY='catgunner.source-activities.v1';
export const DAILY_REWARDS=contract.activities.daily.rewards;
export const ACTIVITY_MISSIONS=contract.activities.missions;
export type ActivityCounter='tree-destroyed'|'stage-cleared'|'rebirth'|'mine-played';
const counters:ActivityCounter[]=['tree-destroyed','stage-cleared','rebirth','mine-played'];
export interface ActivityState {version:1;season:'initial'|'later';dailyClaims:number;lastDailyDate:string|null;counters:Record<ActivityCounter,number>;missionClaims:string[];passExp:number;passClaims:number[];lastObservation:string|null}
export function createActivityState(legacy?:Pick<Session,'dailyClaimed'>,today?:string):ActivityState {
  if(legacy?.dailyClaimed&&!validDate(today))throw new Error('Migration needs a valid local date');
  return {version:1,season:'initial',dailyClaims:legacy?.dailyClaimed?1:0,lastDailyDate:legacy?.dailyClaimed?today!:null,counters:{'tree-destroyed':0,'stage-cleared':0,rebirth:0,'mine-played':0},missionClaims:[],passExp:0,passClaims:[],lastObservation:null};
}
function validDate(value:unknown):value is string {if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function integer(n:unknown):n is number{return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;}
function add(a:number,b:number):number {if(!integer(a)||!integer(b)||!integer(a+b))throw new RangeError('Activity balance overflow');return a+b;}
export function decodeActivityState(raw:string):ActivityState {
  const s=JSON.parse(raw) as ActivityState;
  if(!s||s.version!==1||!['initial','later'].includes(s.season)||!integer(s.dailyClaims)||s.dailyClaims>7||!(s.dailyClaims===0?s.lastDailyDate===null:validDate(s.lastDailyDate))||!s.counters||counters.some(k=>!integer(s.counters[k]))||!integer(s.passExp)||!Array.isArray(s.missionClaims)||new Set(s.missionClaims).size!==s.missionClaims.length||s.missionClaims.some(id=>!ACTIVITY_MISSIONS.some(m=>m.id===id&&!m.requiresVip))||!Array.isArray(s.passClaims)||s.passClaims.some((v,i)=>v!==i)||s.passClaims.length>25||!(s.lastObservation===null||typeof s.lastObservation==='string'&&s.lastObservation.length<4096))throw new Error('Invalid activity save');
  if(s.missionClaims.some(id=>{const m=ACTIVITY_MISSIONS.find(m=>m.id===id)!;return s.counters[m.counter as ActivityCounter]<m.goal;})||s.passExp<s.missionClaims.length*10||s.passClaims.length>Math.floor(s.passExp/100))throw new Error('Inconsistent activity save');
  return {version:1,season:s.season,dailyClaims:s.dailyClaims,lastDailyDate:s.lastDailyDate,counters:{...s.counters},missionClaims:[...s.missionClaims],passExp:s.passExp,passClaims:[...s.passClaims],lastObservation:s.lastObservation};
}
export function serializeActivityState(state:ActivityState):string {const raw=JSON.stringify(state);decodeActivityState(raw);return raw;}
export function claimDaily(session:Session,state:ActivityState,today:string):{session:Session;state:ActivityState;claimed:boolean;reason?:string} {
  if(!validDate(today))throw new Error('Invalid calendar date');
  if(state.dailyClaims>=7||state.lastDailyDate!==null&&today<=state.lastDailyDate)return {session,state,claimed:false,reason:state.dailyClaims>=7?'complete':'date-locked'};
  const amount=DAILY_REWARDS[state.dailyClaims];const diamonds=add(session.diamonds,amount);
  return {session:{...session,diamonds,dailyClaimed:true},state:{...state,dailyClaims:state.dailyClaims+1,lastDailyDate:today},claimed:true};
}
/** Native-verified counterHooks mapped to H5 session transitions: ordinary field deaths/stage wins, actual rebirth and successful mine entry. No historic backfill. Feed once after each session operation. Mine sweep is not exposed by this adapter. */
export function observeActivities(state:ActivityState,previousSession:Session,nextSession:Session):ActivityState {
  const p=previousSession,n=nextSession;
  if(p===n)return state;
  const deaths=p.mode==='field'?n.events.filter(e=>e.type==='death'&&p.battle.targets.some(t=>t.id===e.id&&t.health>0)).map(e=>e.type==='death'?e.id:0):[];
  const stages=p.mode==='field'?n.events.filter(e=>e.type==='stageWon'):[];
  const rebirth=Math.max(0,n.rebirthCount-p.rebirthCount),mine=p.mode!=='mine'&&n.mode==='mine'?1:0;
  if(!deaths.length&&!stages.length&&!rebirth&&!mine)return state;
  const key=JSON.stringify([p.mode,n.mode,p.battle.stage,p.battle.level,p.battle.elapsed,n.battle.elapsed,p.rebirthCount,n.rebirthCount,p.mine.tickets,n.mine.tickets,[...new Set(deaths)],stages]);
  if(key===state.lastObservation)return state;
  return {...state,lastObservation:key,counters:{'tree-destroyed':add(state.counters['tree-destroyed'],new Set(deaths).size),'stage-cleared':add(state.counters['stage-cleared'],stages.length?1:0),rebirth:add(state.counters.rebirth,rebirth),'mine-played':add(state.counters['mine-played'],mine)}};
}
export function claimMission(state:ActivityState,id:string):{state:ActivityState;claimed:boolean;reason?:string} {
  const mission=ACTIVITY_MISSIONS.find(m=>m.id===id);
  if(!mission||mission.requiresVip||state.missionClaims.includes(id)||state.counters[mission.counter as ActivityCounter]<mission.goal)return {state,claimed:false,reason:!mission?'unknown':mission.requiresVip?'vip-unavailable':state.missionClaims.includes(id)?'claimed':'progress'};
  return {state:{...state,missionClaims:[...state.missionClaims,id],passExp:add(state.passExp,mission.reward.amount)},claimed:true};
}
const normal=contract.activities.pass.tracks.find(t=>t.track==='normal')!.serializedInitialSeason;
export function passView(state:ActivityState) {return {level:Math.min(25,Math.floor(state.passExp/100)),exp:state.passExp%100,totalExp:state.passExp,maxLevel:25,rewards:normal,claims:state.passClaims,epicLocked:true};}
export function claimPass(session:Session,state:ActivityState,index:number,options:{freeAdConfirmed:boolean}):{session:Session;state:ActivityState;claimed:boolean;reason?:string} {
  const reward=normal[index];let reason:string|undefined;
  if(!Number.isInteger(index)||!reward)reason='unknown';else if(state.passClaims.includes(index))reason='claimed';else if(passView(state).level<=index)reason='level';else if(state.passClaims.length!==index)reason='sequence';else if(reward.kind==='gunUnlock'&&session.gunInventory.length>=GUN_INVENTORY_CAPACITY)reason='inventory-full';else if(reward.requiresAd&&!options.freeAdConfirmed)reason='ad-confirmation';
  if(reason)return {session,state,claimed:false,reason};
  const updatedSession=reward.kind==='gunUnlock'?{...session,gunInventory:[...session.gunInventory,sourceGun(reward.amount)]}:{...session,diamonds:add(session.diamonds,reward.amount)};
  return {session:updatedSession,state:{...state,passClaims:[...state.passClaims,index]},claimed:true};
}
/** Explicit development capability; callers must pass their development-mode flag. */
export function developerActivityExp(state:ActivityState,enabled:boolean):ActivityState{return enabled?{...state,passExp:add(state.passExp,100)}:state;}
