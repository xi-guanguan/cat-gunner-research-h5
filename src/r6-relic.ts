/** Relic_manager 1.1.61/code257. Identity is serialized ARRAY INDEX (three Skip
 * relics are distinct). Native/scene hashes and the 300-entry balance arrays
 * are retained in r6-relic-contract.json. H5 RNG is NOT Unity Random replay. */
import contract from './data/r6-relic-contract.json';
import {BigValue} from './big-value';
export interface SourceRelicItem {lv:number;count:number;unlocked:boolean}
export interface SourceRelicState {items:SourceRelicItem[]}
export interface SourceRelicTotals {damagePercent:BigValue;moneyPercent:BigValue;criticalPercent:BigValue;moveSpeedValue:number;offlineMinutes:number;rebirthPercent:number;skipPercent:number}
export interface SourceRelicDrawItem {index:number;firstUnlock:boolean}
export interface SourceRelicResult {status:'granted'|'blocked';reason:string;state:SourceRelicState;cores:number[];draws:SourceRelicDrawItem[]}
export const SOURCE_RELIC_ITEMS=contract.items;
export const SOURCE_RELIC_COST=20;
export const sourceRelicMaxLevel=(index:number)=>SOURCE_RELIC_ITEMS[index].type<9?300:50;
export const sourceRelicUpgradeCost=(lv:number)=>Math.max(2,Math.min(50,lv*2+2));
const int=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=0x7fffffff;
export function freshSourceRelicState():SourceRelicState {return {items:SOURCE_RELIC_ITEMS.map(()=>({lv:0,count:0,unlocked:false}))};}
export function decodeSourceRelicState(raw:unknown):SourceRelicState {
 if(!raw||typeof raw!=='object'||!Array.isArray((raw as SourceRelicState).items)||(raw as SourceRelicState).items.length!==15)throw Error('Invalid Relic state');
 return {items:(raw as SourceRelicState).items.map((v,index)=>{
  if(!v||!int(v.lv)||v.lv>sourceRelicMaxLevel(index)||!int(v.count)||typeof v.unlocked!=='boolean')throw Error(`Invalid Relic item ${index}`);
  // Do not invent a 301st balance value or clamp saved levels.
  if(SOURCE_RELIC_ITEMS[index].type<9&&v.lv>=contract.balances.Damage_Balance.length)throw Error(`Relic source balance boundary unclosed: index ${index}, Lv${v.lv}`);
  return {lv:v.lv,count:v.count,unlocked:v.unlocked};
 })};
}
export function sourceRelicValue(index:number,lv:number):BigValue {
 const spec=SOURCE_RELIC_ITEMS[index];if(!spec||!int(lv)||lv>sourceRelicMaxLevel(index))throw RangeError('Invalid Relic value request');
 const t=spec.type;
 if(t>=9)return BigValue.fromInteger(t===10?lv*10+10:t===11?lv*5+5:lv*2+2);
 const balance=t<3?contract.balances.Damage_Balance:t<6?contract.balances.Money_Balance:contract.balances.CriDmg_Balance;
 if(!balance[lv])throw RangeError('Relic source Lv300 array boundary is unclosed');
 const v=BigValue.fromJSON(balance[lv]);
 // 0x2b3179c invokes G@0x455a16c: truncate, NOT ceil (5×1.5=7).
 return t%3===1?v.nativeMultiply(1.5).truncateInteger():t%3===2?v.nativeMultiply(BigValue.fromInteger(2)):v;
}
export function sourceRelicTotals(raw:SourceRelicState=freshSourceRelicState()):SourceRelicTotals {
 const state=decodeSourceRelicState(raw),r:SourceRelicTotals={damagePercent:BigValue.fromInteger(100),moneyPercent:BigValue.fromInteger(100),criticalPercent:BigValue.fromInteger(100),moveSpeedValue:0,offlineMinutes:0,rebirthPercent:100,skipPercent:0};
 state.items.forEach((item,index)=>{if(!item.unlocked)return;const type=SOURCE_RELIC_ITEMS[index].type,v=sourceRelicValue(index,item.lv);
  if(type<3)r.damagePercent=r.damagePercent.nativeAdd(v);else if(type<6)r.moneyPercent=r.moneyPercent.nativeAdd(v);else if(type<9)r.criticalPercent=r.criticalPercent.nativeAdd(v);
  else if(type===9)r.moveSpeedValue+=v.toNumber();else if(type===10)r.offlineMinutes+=v.toNumber();else if(type===11)r.rebirthPercent+=v.toNumber();else r.skipPercent+=v.toNumber();
 });return r;
}
export function sourceRelicCandidates(state:SourceRelicState,coreType:number):number[] {
 if(!int(coreType)||coreType>3)throw RangeError('Invalid Relic core type');
 const group=SOURCE_RELIC_ITEMS.flatMap((v,index)=>coreType===3||v.coreType===coreType?[index]:[]);
 const notMax=group.filter(i=>state.items[i].lv<sourceRelicMaxLevel(i));return notMax.length?notMax:group;
}
/** UI probability is over the native not-max candidate list, not fixed 20%. */
export function sourceRelicProbabilities(state:SourceRelicState,coreType:number):number[] {const candidates=sourceRelicCandidates(state,coreType);return SOURCE_RELIC_ITEMS.map((_,i)=>candidates.includes(i)?100/candidates.length:0);}
function validWallet(cores:number[]):boolean {return Array.isArray(cores)&&cores.length===4&&cores.every(int);}
function validState(state:SourceRelicState):boolean {try {decodeSourceRelicState(state);return true;}catch {return false;}}
function rejected(state:SourceRelicState,cores:number[],reason:string):SourceRelicResult {return {status:'blocked',reason,state,cores,draws:[]};}
export function sourceRelicUpgrade(state:SourceRelicState,cores:number[],index:number):SourceRelicResult {
 if(!validState(state)||!validWallet(cores))return rejected(state,cores,'无效遗物或探索核心状态；未扣款');
 if(!int(index)||index>=15)return rejected(state,cores,'无效遗物身份');
 const item=state.items[index];if(!item.unlocked)return rejected(state,cores,'该遗物尚未获得');
 if(item.lv>=sourceRelicMaxLevel(index))return rejected(state,cores,'该遗物已满级');
 if(SOURCE_RELIC_ITEMS[index].type<9&&item.lv+1>=contract.balances.Damage_Balance.length)return rejected(state,cores,'源 Lv300 数组边界未闭合；未扣碎片');
 const price=sourceRelicUpgradeCost(item.lv);if(item.count<price)return rejected(state,cores,'遗物碎片不足');
 return {status:'granted',reason:'遗物升级成功',state:{items:state.items.map((v,i)=>i===index?{...v,lv:v.lv+1,count:v.count-price}:{...v})},cores:[...cores],draws:[]};
}
/** Atomic pure transaction: rejected requests and broken RNG do not debit or
 * mutate state. First unlock grants no duplicate fragment; repeat adds ONE. */
export function sourceRelicDraw(state:SourceRelicState,cores:number[],coreType:number,count:number|'max',random:()=>number):SourceRelicResult {
 if(!validState(state)||!int(coreType)||coreType>3||!validWallet(cores))return rejected(state,cores,'无效探索核心余额');
 const size=count==='max'?Math.floor(cores[coreType]/SOURCE_RELIC_COST):count;
 if(!int(size)||size<1)return rejected(state,cores,'核心不足；每次消耗20核心');
 if(size>100_000)return rejected(state,cores,'超出 H5 单次抽取安全容量（100000）；未扣核心');
 const cost=SOURCE_RELIC_COST*size;if(cost>cores[coreType])return rejected(state,cores,'核心不足；每次消耗20核心');
 const next=decodeSourceRelicState(state),wallet=[...cores],draws:SourceRelicDrawItem[]=[];wallet[coreType]-=cost;
 for(let n=0;n<size;n++){
  const candidates=sourceRelicCandidates(next,coreType),roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)return rejected(state,cores,'无效抽取随机数；未扣核心');
  const index=candidates[Math.floor(roll*candidates.length)],item=next.items[index],firstUnlock=!item.unlocked;
  if(!firstUnlock&&item.count===0x7fffffff)return rejected(state,cores,'遗物碎片达到 int32 上限；未扣核心');
  next.items[index]={...item,unlocked:true,count:item.count+(firstUnlock?0:1)};draws.push({index,firstUnlock});
 }
 return {status:'granted',reason:`遗物抽取 ${size} 次，核心 -${cost}`,state:next,cores:wallet,draws};
}
export function sourceRelicOfflineMaxSeconds(base:number,state:SourceRelicState):number {return base+Math.fround(sourceRelicTotals(state).offlineMinutes*60);}
export const sourceRelicNames=['攻击遗物 I','攻击遗物 II','攻击遗物 III','转生遗物','森林跳关遗物','金币遗物 I','金币遗物 II','金币遗物 III','离线遗物','沙漠跳关遗物','暴伤遗物 I','暴伤遗物 II','暴伤遗物 III','移速遗物','冻原跳关遗物'];
export function sourceRelicDescription(index:number,lv:number):string {
 const type=SOURCE_RELIC_ITEMS[index].type,value=sourceRelicValue(index,lv).format();
 return `${type<3?'攻击加成':type<6?'金币加成':type<9?'暴击伤害加成':type===9?'移速加成':type===10?'离线时长增加':type===11?'转生红宝石加成':'跳关概率增加'} +${value}${type===10?'分钟':'%'}${type===10?'（离线补算宿主仍未接通）':type===12?'（普通关卡历史边界消费者仍未闭合）':''}`;
}
