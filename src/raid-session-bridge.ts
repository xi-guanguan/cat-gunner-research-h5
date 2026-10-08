import {freshSourceRaidMission,decodeSourceRaidMission,sourceRaidMissionRefresh} from './r6-raid-mission';
import {freshSourceRaidStarPig,decodeSourceRaidStarPig,sourceRaidStarPigEnter,sourceRaidStarPigBar,sourceRaidStarPigSeason} from './r6-raid-star-pig';
/** Live Raid save/wallet boundary. Resource readiness belongs to the client;
 * free/ad/IAP debit occurs AFTER readiness; the scene owner may defer Start
 * across the source two-second enter coroutine. A result
 * can only come from this host's real contacts/clock, never a UI score argument.
 * Runtime selections, cats and unfinished games are intentionally not saved.
 */
import {SourceRaidBattleRuntime,type SourceRaidBattleEvent} from './raid-battle-runtime';
import {sourceRaidEntryGate,sourceRaidConsumeFree,sourceRaidEntryReward,sourceRaidEntryPurpose,sourceRaidWeakType,
 sourceRaidSelectionRefresh,sourceRaidTickets,sourceRaidSeason,decodeSourceRaid,type SourceRaidSelection,type SourceRaidEntryRequest} from './r6-raid';
import {raidEntryTypeNow} from './r5-raid';
import {sourceRewardEntitlements} from './r5-entitlements';
import type {SourceRewardResponse} from './r6-reward-provider';
import type {SourceMetaBundle} from './source-meta-runtime';
import type {MineTimeAdapter} from './mine-time';
export interface SourceRaidBridgeCommit {bundle:SourceMetaBundle;events:SourceRaidBattleEvent[];status:'applied'|'blocked';reason:string;granted:number}
const snapshot=(b:SourceMetaBundle)=>JSON.stringify({raid:decodeSourceRaid(b.meta.raid),mission:decodeSourceRaidMission(b.meta.raidMission??freshSourceRaidMission()),pig:decodeSourceRaidStarPig(b.meta.raidStarPig??freshSourceRaidStarPig())});
export class SourceRaidSessionBridge {
 readonly host:SourceRaidBattleRuntime;readonly selection:SourceRaidSelection;
 private expected:string;private valid=true;private ready=false;private request:SourceRaidEntryRequest|null=null;
 private sequence=0;private admitted=false;private started=false;private committedResult=false;private backlog:SourceRaidBattleEvent[]=[];
 constructor(readonly runID:string,b:SourceMetaBundle,selection:SourceRaidSelection){
  if(!runID.trim()||b.session.mode!=='field')throw Error('请先返回普通场景');
  this.selection=sourceRaidSelectionRefresh(b.session,selection);
  if(selection.length!==3||selection.some((s,i)=>s&&!this.selection[i])||new Set(this.selection.filter(Boolean).map(s=>s!.uid)).size!==this.selection.filter(Boolean).length)throw Error('突袭武器身份已变化或重复');
  const gate=sourceRaidEntryGate(b.meta.raid,{historicMax:b.session.historicMax,ready:true,selectedCount:this.selection.filter(Boolean).length,pending:false});if(gate)throw Error(gate);
  this.expected=snapshot(b);
  this.host=new SourceRaidBattleRuntime(runID,sourceRaidWeakType(b.meta.raid.seasonIndex),sourceRewardEntitlements(b.meta.entitlements).plusPack0Active);
 }
 get pending(){return this.request!==null;}
 /** Client calls only after scene prepare completed in this save context. */
 prepared():void {if(this.valid&&!this.started)this.ready=true;}
 private reason(b:SourceMetaBundle,requireReady=true):string|undefined {
  if(!this.valid||snapshot(b)!==this.expected||b.session.mode!=='field')return '突袭运行身份已失效；不写入其他存档';
  if(requireReady&&!this.ready)return '突袭资源尚未准备完成；未消耗次数';
  // A UID cannot silently move to another gun or disappear during loading/provider.
  const refreshed=sourceRaidSelectionRefresh(b.session,this.selection);
  if(this.selection.some((s,i)=>s&&(!refreshed[i]||refreshed[i]!.index!==s.index)))return '突袭武器位置或身份已变化；未入场';
 }
 private deny(b:SourceMetaBundle,reason:string,events:SourceRaidBattleEvent[]=[]):SourceRaidBridgeCommit {return {bundle:b,events,status:'blocked',reason,granted:0};}
 beginProvider(b:SourceMetaBundle):SourceRaidEntryRequest|null {
  if(this.admitted||this.started||this.request||this.reason(b))return null;
  const entryType=raidEntryTypeNow(b.meta.raid);if(entryType!==2&&entryType!==3)return null;
  return this.request={id:`${this.runID}:entry:${++this.sequence}`,kind:entryType===2?'ad':'purchase',purpose:sourceRaidEntryPurpose(entryType),
   entryType,entryDate:b.meta.raid.entryDate!,seasonIndex:b.meta.raid.seasonIndex,contextID:this.runID};
 }
 private context(b:SourceMetaBundle){return {historicMax:b.session.historicMax,ready:this.ready,selectedCount:this.selection.filter(Boolean).length,pending:false};}
 private start(b:SourceMetaBundle):SourceRaidBridgeCommit {
  const state=this.host.start(b.meta.raid),bundle={...b,meta:{...b.meta,raid:state,raidMission:sourceRaidMissionRefresh(b.meta.raidMission??freshSourceRaidMission(),state),raidStarPig:sourceRaidStarPigEnter(b.meta.raidStarPig??freshSourceRaidStarPig(),state.seasonIndex)}};
  this.started=true;this.expected=snapshot(bundle);return {bundle,events:this.host.drainEvents(),status:'applied',reason:'',granted:0};
 }
 /** Admit once after preparation. Default immediate activation preserves the pure
  * host API; the live client MUST use deferred=true for Enter_Cor's source wait. */
 private admit(b:SourceMetaBundle,deferred:boolean):SourceRaidBridgeCommit {
  this.admitted=true;this.expected=snapshot(b);
  return deferred?{bundle:b,events:[],status:'applied',reason:'',granted:0}:this.start(b);
 }
 activate(b:SourceMetaBundle):SourceRaidBridgeCommit {
  if(!this.admitted||this.started)return this.deny(b,'突袭未获准入场或已经启动');
  const reason=this.reason(b);if(reason)return this.deny(b,reason);
  if(b.meta.raid.tryCount>=2147483647)return this.deny(b,'突袭赛季次数达到上限');
  return this.start(b);
 }
 startFree(b:SourceMetaBundle,deferred=false):SourceRaidBridgeCommit {
  if(this.admitted||this.started||this.request)return this.deny(b,'突袭已入场或正在等待回调');
  const reason=this.reason(b);if(reason)return this.deny(b,reason);
  if(b.meta.raid.tryCount>=2147483647)return this.deny(b,'突袭赛季次数达到上限');
  const r=sourceRaidConsumeFree(b.meta.raid,this.context(b));if(r.reason)return this.deny(b,r.reason);
  return this.admit({...b,meta:{...b.meta,raid:r.state}},deferred);
 }
 finishProvider(b:SourceMetaBundle,request:SourceRaidEntryRequest,response:SourceRewardResponse,deferred=false):SourceRaidBridgeCommit {
  if(this.admitted||this.started||this.request!==request)return this.deny(b,'突袭回调已过期或已处理；未重复入场');
  this.request=null;const reason=this.reason(b);if(reason)return this.deny(b,reason);
  if(b.meta.raid.tryCount>=2147483647)return this.deny(b,'突袭赛季次数达到上限');
  const r=sourceRaidEntryReward(b.meta.raid,request,response,this.context(b),this.runID);if(r.status!=='granted')return this.deny(b,r.reason);
  const started=this.admit({...b,meta:{...b.meta,raid:r.state}},deferred);return {...started,reason:r.reason};
 }
 /** Explicit calendar ownership transition. Pending provider is invalidated;
  * running battle keeps its original weakType/time. Native Game_End updates the
  * CURRENT season record; a rollover may reset tries before an old run ends. */
 refreshClock(b:SourceMetaBundle,time:MineTimeAdapter,date:Date):SourceRaidBridgeCommit {
  const reason=this.reason(b,false);if(reason)return this.deny(b,reason);
  const raid=sourceRaidSeason(sourceRaidTickets(b.meta.raid,time),date),bundle={...b,meta:{...b.meta,raid,raidMission:sourceRaidMissionRefresh(b.meta.raidMission??freshSourceRaidMission(),raid),raidStarPig:sourceRaidStarPigSeason(b.meta.raidStarPig??freshSourceRaidStarPig(),raid.seasonIndex)}};
  if(snapshot(bundle)!==this.expected)this.request=null;
  if(!this.started&&raid.seasonIndex!==b.meta.raid.seasonIndex){this.cancel();return this.deny(b,'突袭赛季已变化，请重新准备战斗');}
  this.expected=snapshot(bundle);return {bundle,events:[],status:'applied',reason:'',granted:0};
 }
 commit(b:SourceMetaBundle):SourceRaidBridgeCommit {
  const events=this.backlog=[...this.backlog,...this.host.drainEvents()],reason=this.reason(b,false);if(reason){this.cancel();return this.deny(b,reason,events);}
  let pig=b.meta.raidStarPig??freshSourceRaidStarPig();for(const e of events)if(e.kind==='bar-cleared')pig=sourceRaidStarPigBar(pig);
  const progress=pig===b.meta.raidStarPig?b:{...b,meta:{...b.meta,raidStarPig:pig}};
  if(!events.some(e=>e.kind==='end')){this.backlog=[];this.expected=snapshot(progress);return {bundle:progress,events,status:'applied',reason:'',granted:0};}
  const result=this.host.result;if(!this.started||!result||this.committedResult)return this.deny(b,'无有效突袭结算；未重复发奖',events);
  const receipt=`${this.runID}:result`;
  if((b.meta.raid.settlementClaims??[]).includes(receipt))return this.deny(b,'重复突袭结算身份；未重复发奖',events);
  const next=(b.session.starGem??0)+result.starGem;if(!Number.isSafeInteger(next)||next<0)throw RangeError('Raid wallet overflow');
  const bestByType=[...b.meta.raid.bestByType];bestByType[result.weakType]=Math.max(bestByType[result.weakType],result.score);
  const raid={...b.meta.raid,bestLevel:Math.max(b.meta.raid.bestLevel,result.score),bestByType,settlementClaims:[...(b.meta.raid.settlementClaims??[]),receipt]};
  const bundle={...b,session:{...b.session,starGem:next},meta:{...b.meta,raid,raidMission:sourceRaidMissionRefresh(b.meta.raidMission??freshSourceRaidMission(),raid),raidStarPig:pig}};
  this.committedResult=true;this.backlog=[];this.expected=snapshot(bundle);return {bundle,events,status:'applied',reason:'',granted:result.starGem};
 }
 cancel():void {if(!this.valid)return;this.valid=false;this.ready=false;this.request=null;this.host.exit();}
}
