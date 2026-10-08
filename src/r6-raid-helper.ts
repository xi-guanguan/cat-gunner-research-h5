/** STATIC source helper consumers. Local callback ledger/context/old-week
 * rejection are H5 adapters, not native store receipt recovery. */
import source from './data/r6-raid-helper-contract.json';
import guns from './data/guns.json';
import type {SourceRaidState} from './r6-raid';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
export const SOURCE_RAID_HELPER=source;
export const sourceRaidHelperActive=(s:SourceRaidState)=>s.helperSeasonIndex!==-1&&s.helperSeasonIndex===s.seasonIndex;
export function sourceRaidHelperGun(weakType:number):number {
 if(!Number.isInteger(weakType)||weakType<0||weakType>6)throw RangeError('Invalid Raid helper weak type');
 for(let id=source.helperGunRange[0];id<=source.helperGunRange[1];id++)if(guns.guns[id]?.type===weakType)return id;
 const index=source.gunTypeCodes.indexOf(weakType),id=50+Math.max(0,Math.min(4,index));return guns.guns[id]?id:-1;
}
/** ALL three star slots, regardless of empty selection or compact Cat count. */
export function sourceRaidHelperStars(levels:readonly number[]|undefined):number {
 if(!levels?.length)return 0;
 if(levels.length!==source.starSlotCount||levels.some(v=>!Number.isInteger(v)||v<0||v>20))throw RangeError('Invalid Raid helper star slots');
 return Math.min(...levels);
}
export interface SourceRaidHelperRequest extends SourceRewardRequest {kind:'purchase';seasonIndex:number}
export function sourceRaidHelperGate(s:SourceRaidState,historicMax:number,pending=false):string {
 return historicMax<390?'普通第40大关开放突袭助手':pending?'正在等待助手本地测试交易':s.seasonIndex===-1?'本地赛季时钟尚未初始化':sourceRaidHelperActive(s)?'本赛季助手已购买':'';
}
export function sourceRaidHelperRequest(s:SourceRaidState,historicMax:number,id:string):SourceRaidHelperRequest|null {
 return !id.trim()||sourceRaidHelperGate(s,historicMax)?null:{id,kind:'purchase',purpose:source.product,seasonIndex:s.seasonIndex};
}
export function sourceRaidHelperReward(s:SourceRaidState,request:SourceRaidHelperRequest,response:SourceRewardResponse,historicMax:number){
 const deny=(reason:string)=>({state:s,status:'blocked' as const,reason});
 if(!request.id?.trim()||request.kind!=='purchase'||request.purpose!==source.product||!sourceRewardMatches(request,response))return deny('助手回调身份不匹配；未授予权益');
 if((s.helperClaims??[]).includes(request.id))return deny('本地助手交易已处理；未重复授予');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；本地测试 provider 不可用':response.status==='cancelled'?'本地测试交易已取消；未授予助手':'本地测试交易失败；未授予助手');
 if(request.seasonIndex!==s.seasonIndex)return deny('赛季已变化；旧本地测试回调不授予助手（H5适配）');
 const gate=sourceRaidHelperGate(s,historicMax);if(gate)return deny(gate);
 return {state:{...s,helperSeasonIndex:s.seasonIndex,helperClaims:[...(s.helperClaims??[]),request.id]},status:'granted' as const,reason:'本地测试交易：本赛季助手已获得；未真实支付／线上未连接'};
}
