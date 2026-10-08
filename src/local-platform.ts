/** Explicit H5 developer adapter. Grants here are test grants, never platform receipts. */
import { BigValue } from "./big-value";
import { walletValue, numericMirror } from "./rules";
import uiContract from "./data/round3-ui-contract.json";
import { claimMineAdBonus } from "./meta-progression";
import { claimChallengeBonus, claimVictory, claimBossBonus, type Session } from "./session";

export interface LocalPlatformState {
  schema: 1;
  developerEnabled: boolean;
  freeAds: boolean;
  freePurchases: boolean;
  sequence: number;
  claims: string[];
  audit: { id: string; kind: "ad" | "purchase" | "resource" | "unlock"; amount: number; at: string }[];
}
export const LOCAL_PLATFORM_KEY = "catgunner-local-platform-v1";
export const freshPlatformState = (): LocalPlatformState => ({schema:1,developerEnabled:false,freeAds:true,freePurchases:true,sequence:0,claims:[],audit:[]});
export function decodePlatformState(text: string | null): LocalPlatformState {
  if (!text) return freshPlatformState();
  try {
    const x=JSON.parse(text) as LocalPlatformState;
    if(x.schema!==1 || typeof x.developerEnabled!=="boolean" || typeof x.freeAds!=="boolean" || typeof x.freePurchases!=="boolean"
      || !Number.isSafeInteger(x.sequence) || x.sequence<0 || !Array.isArray(x.claims) || !x.claims.every(id=>typeof id==="string") || !Array.isArray(x.audit))return freshPlatformState();
    return x;
  } catch {return freshPlatformState();}
}
export interface GrantResult { session: Session; platform: LocalPlatformState; status: "granted" | "unavailable" | "duplicate" | "blocked"; message: string }
const result=(session:Session,platform:LocalPlatformState,status:GrantResult["status"],message:string):GrantResult=>({session,platform,status,message});
function diamondSum(balance:number,amount:number) {
  if(!Number.isSafeInteger(balance)||balance<0||!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(balance+amount))throw new RangeError("Invalid diamond grant");
  return balance+amount;
}
function record(platform:LocalPlatformState,id:string,kind:LocalPlatformState["audit"][number]["kind"],amount:number):LocalPlatformState {
  return {...platform,sequence:platform.sequence+1,claims:[...platform.claims,id],audit:[...platform.audit,{id,kind,amount,at:new Date().toISOString()}].slice(-100)};
}
export function confirmedDeveloperGrant(session:Session,platform:LocalPlatformState,id:string,kind:"ad"|"purchase",diamonds:number):GrantResult {
  if(!platform.developerEnabled || !(kind==="ad"?platform.freeAds:platform.freePurchases))return result(session,platform,"unavailable",kind==="ad"?"启用开发者免广后可测试奖励":"启用开发者免购买后可测试商品");
  if(platform.claims.includes(id))return result(session,platform,"duplicate","本次奖励已领取");
  const next={...session,diamonds:diamondSum(session.diamonds,diamonds),notice:"",events:[]};
  return result(next,record(platform,id,kind,diamonds),"granted",kind==="ad"?`免广测试：钻石 +${diamonds}`:`测试购买：钻石 +${diamonds}`);
}
export function developerResource(session:Session,platform:LocalPlatformState,kind:"diamonds"|"coins"|"ruby"|"unlock"|"mineTickets"):GrantResult {
  if(!platform.developerEnabled)return result(session,platform,"blocked","请先启用开发者模式");
  if(session.mode!=="field")return result(session,platform,"blocked","请返回普通场景后使用");
  let next={...session,notice:"",events:[]},amount=0,message="";
  if(kind==="diamonds"){amount=1000;next.diamonds=diamondSum(session.diamonds,amount);message="测试钻石 +1000";}
  if(kind==="coins"){amount=1000000;const coinsValue=walletValue(session.battle).add(amount);next.battle={...session.battle,coinsValue,coins:numericMirror(coinsValue)};message="测试金币 +100万";}
  if(kind==="ruby"){amount=1000;next.ruby=session.ruby.add(BigValue.fromInteger(amount));message="测试红宝石 +1000";}
  if(kind==="unlock"){next.historicMax=Math.max(30,session.historicMax);next.gunUnlocked=true;message="测试开放：武器、矿场、转生、永久强化";}
  if(kind==="mineTickets"){next.mine={...session.mine,tickets:{...session.mine.tickets,used:0}};message="今日矿场次数已重置";}
  return result(next,record(platform,`developer:${platform.sequence}`,kind==="unlock"?"unlock":"resource",amount),"granted",message);
}
export function developerChallengeBonus(session:Session,platform:LocalPlatformState):GrantResult {
  if(session.mode!=="victory")return result(session,platform,"blocked","挑战尚未胜利");
  if(session.challengeSettlement){
    if(!platform.developerEnabled||!platform.freeAds)return result(session,platform,'unavailable','启用开发者免广后可本地测试奖励');
    const id=`challenge:${session.challengeSettlement.runID}:bonus`,pending={id,purpose:'challenge:bonus',kind:'ad' as const,runID:session.challengeSettlement.runID};
    const claim=claimChallengeBonus(session,pending,{...pending,status:'success',provider:'local-test',onlineVerified:false});
    return claim.status==='granted'?result(claimVictory(claim.session),record(platform,id,'ad',90),'granted','本地测试：额外90钻，共120钻'):result(session,platform,claim.status,'本次追加奖励已领取或不可用');
  }
  const id=`challenge:${session.challengeStage}:bonus`;
  // Native Reward_Clear normal30, advertising/auto branch120. Add only extra90 before base claim.
  const grant=confirmedDeveloperGrant(session,platform,id,"ad",90);
  return grant.status==="granted"?{...grant,session:claimVictory(grant.session),message:"免广测试：挑战奖励 +120 钻石"}:grant;
}
export function developerMineBonus(session:Session,platform:LocalPlatformState):GrantResult {
  if(session.mode!=="mine-result"||!session.mine.settlement)return result(session,platform,"blocked","矿场尚未结算");
  if(!platform.developerEnabled||!platform.freeAds)return result(session,platform,"unavailable","启用开发者免广后可测试奖励");
  const bonus=claimMineAdBonus(session.mine.settlement,true);
  if(bonus.status!=="supported")return result(session,platform,"duplicate","本次奖励已领取");
  const amount=bonus.value.adExtraReward;
  return result({...session,diamonds:diamondSum(session.diamonds,amount),mine:{...session.mine,settlement:bonus.value}},
    record(platform,`mine:${platform.sequence}`,"ad",amount),"granted",`免广测试：额外钻石 +${amount}`);
}

export function developerShopPurchase(session:Session,platform:LocalPlatformState,offerId:string,requestId:string):GrantResult {
  if(session.mode!=="field")return result(session,platform,"blocked","请返回普通场景购买");
  const offer=uiContract.shop.offerings.find(item=>item.id===offerId);
  if(!offer)return result(session,platform,"blocked","商品不存在");
  const first=!platform.claims.some(id=>id.startsWith(`shop:${offer.id}:`));
  const amount=offer.reward.amount*(first?offer.firstPurchaseMultiplier:1);
  const grant=confirmedDeveloperGrant(session,platform,`shop:${offer.id}:${requestId}`,"purchase",amount);
  return grant.status==="granted"?{...grant,message:`免购买测试：钻石 +${amount}${first?"（首次双倍）":""}`} : grant;
}

/** Original Boss extra2x, explicitly receipted local ad test. */
export function developerBossBonus(session:Session,platform:LocalPlatformState):GrantResult {
  const run=session.boss.run;
  if(session.mode!=='boss-result'||!run||run.phase!=='won'||run.automaticBonus||run.bonusClaimed)return result(session,platform,'blocked','本次首领奖励不能追加');
  const next=claimBossBonus(session,true);if(next.mode!=='field')return result(session,platform,'blocked',next.notice||'首领奖励尚未结算');
  const grant=confirmedDeveloperGrant(session,platform,`boss:${run.playedStage}:bonus`,'ad',next.diamonds-session.diamonds);
  return grant.status==='granted'?{...grant,session:next,message:`免广测试：首领奖励共 ${run.rewardThisRun*3} 钻石`}:grant;
}
