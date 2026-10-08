/** STATIC source: OfferWall_manager balance -> persisted pending -> SpendCurrency -> GrantGem.
 * H5 adaptation: local debit receipts persist with the wallet, recovery confirms a debit
 * before crediting (source PlayerPrefs recovery cannot disambiguate a lost SDK callback).
 * These records are NEVER online Tapjoy receipts. */
import type {SourceProviderStatus} from './r6-reward-provider';
export const SOURCE_OFFERWALL={placement:'offerwall_aos',pendingKey:'ow_pending_gem',claimTimeoutSec:20,dismissDelaySec:3.5,resumeDelaySec:5,type1MinDisplayStage:10} as const;
export interface OfferWallPending {id:string;amount:number;place:string}
export interface OfferWallDebit {id:string;amount:number;place:string}
export interface SourceOfferWallState {localBalance:number;pending:OfferWallPending|null;localDebits:OfferWallDebit[];localGrants:string[]}
export const freshSourceOfferWall=():SourceOfferWallState=>({localBalance:0,pending:null,localDebits:[],localGrants:[]});
const amountOK=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=2147483647;
const places=['shop','hud','banner_reward','qa'];
const rowOK=(p:OfferWallDebit)=>p&&typeof p.id==='string'&&!!p.id&&amountOK(p.amount)&&p.amount>0&&places.includes(p.place);
export function decodeSourceOfferWall(value:unknown):SourceOfferWallState {
 if(value===undefined)return freshSourceOfferWall();const s=value as SourceOfferWallState;
 if(!s||!amountOK(s.localBalance)||!Array.isArray(s.localDebits)||!s.localDebits.every(rowOK)||new Set(s.localDebits.map(r=>r.id)).size!==s.localDebits.length||!Array.isArray(s.localGrants)||s.localGrants.some(id=>typeof id!=='string'||!id)||new Set(s.localGrants).size!==s.localGrants.length||s.localGrants.some(id=>!s.localDebits.some(d=>d.id===id))||s.pending!==null&&(!rowOK(s.pending)||s.localGrants.includes(s.pending.id)))throw Error('Invalid OfferWall local extension');
 const debit=s.pending&&s.localDebits.find(d=>d.id===s.pending!.id);if(debit&&(debit.amount!==s.pending!.amount||debit.place!==s.pending!.place))throw Error('OfferWall pending/debit identity mismatch');
 return {...s,pending:s.pending?{...s.pending}:null,localDebits:s.localDebits.map(d=>({...d})),localGrants:[...s.localGrants]};
}
export type OfferWallOperation='connect'|'content'|'show'|'balance'|'spend';
export interface OfferWallRequest {id:string;operation:OfferWallOperation;place:string;amount:number}
export interface OfferWallResponse extends OfferWallRequest {status:SourceProviderStatus;provider:'local-test';onlineVerified:false;balance:number;contentReady:boolean}
export interface OfferWallProvider {execute(q:OfferWallRequest):Promise<OfferWallResponse>}
export function offerWallMatches(q:OfferWallRequest,r:OfferWallResponse){return r&&r.id===q.id&&r.operation===q.operation&&r.place===q.place&&r.amount===q.amount&&r.provider==='local-test'&&r.onlineVerified===false&&['success','failure','cancelled','unavailable'].includes(r.status)&&amountOK(r.balance)&&typeof r.contentReady==='boolean';}
export function sourceOfferWallDebit(s:SourceOfferWallState,q:OfferWallRequest):SourceOfferWallState {
 if(q.operation!=='spend'||!rowOK(q))throw Error('Invalid local debit');
 const old=s.localDebits.find(d=>d.id===q.id);if(old){if(old.amount!==q.amount||old.place!==q.place)throw Error('OfferWall debit identity conflict');return s;}
 if(!s.pending||s.pending.id!==q.id||s.pending.amount!==q.amount||s.pending.place!==q.place||s.localBalance<q.amount)throw Error('OfferWall debit not reserved or insufficient balance');
 return {...s,localBalance:s.localBalance-q.amount,localDebits:[...s.localDebits,{id:q.id,amount:q.amount,place:q.place}]};
}
export function sourceOfferWallGrant(s:SourceOfferWallState,diamonds:number){
 const p=s.pending,d=p&&s.localDebits.find(d=>d.id===p.id&&d.amount===p.amount&&d.place===p.place);
 if(!p||!d||s.localGrants.includes(p.id))return {state:s,diamonds,granted:false};
 if(!Number.isSafeInteger(diamonds)||diamonds<0||!Number.isSafeInteger(diamonds+p.amount))throw Error('Invalid diamond balance');
 return {state:{...s,pending:null,localGrants:[...s.localGrants,p.id]},diamonds:diamonds+p.amount,granted:true};
}
/** All operations are local. Defaults never seed earned currency. Debit persistence is
 * delegated to current-context hooks; callback retries read the durable debit ledger. */
export function createLocalOfferWallProvider(hooks:{available:boolean;outcome?:Exclude<SourceProviderStatus,'unavailable'>;read():SourceOfferWallState;debit(q:OfferWallRequest):void;contentReady?:boolean}):OfferWallProvider {
 const seen=new Map<string,string>();
 return {async execute(q){
  if(!q.id||!['connect','content','show','balance','spend'].includes(q.operation)||!places.includes(q.place)||!amountOK(q.amount)||q.operation==='spend'&&q.amount<1||q.operation!=='spend'&&q.amount!==0)throw Error('Invalid OfferWall request');
  const key=JSON.stringify([q.operation,q.place,q.amount]),old=seen.get(q.id);if(old&&old!==key)throw Error('OfferWall request identity conflict');seen.set(q.id,key);
  const status=hooks.available?(hooks.outcome??'success'):'unavailable';
  if(status==='success'&&q.operation==='spend')hooks.debit(q);
  return {...q,status,provider:'local-test',onlineVerified:false,balance:hooks.read().localBalance,contentReady:hooks.available&&(hooks.contentReady??true)};
 }};
}
export function sourceOfferWallExposure(historicMax:number,saveLoaded:boolean,connected:boolean,config:{minDisplayStage:number}|null,force=false){
 const target=force||!!config&&Math.trunc(historicMax/10)+1>=config.minDisplayStage;
 return {target,visible:saveLoaded&&target&&connected,reason:!saveLoaded?'存档尚未加载':!config&&!force?'线上曝光配置未连接':!target?`需达到显示关卡 ${config!.minDisplayStage}`:!connected?'OfferWall 线上 SDK 未连接':'本地测试入口'};
}
