/** Source 1.1.61 shop callbacks. External store is deliberately NOT connected.
 * Static evidence: shop-package-disasm.txt and shop-package-constants.json.
 * First-buy season rollover uses the source build constant, never a guessed calendar. */
import {SOURCE_PACKAGE_OFFERS,sourceApplyPackagePurchase,type SourceEntitlements,type SourcePackageID} from './r5-entitlements';
import {sourceRewardMatches,type SourceRewardRequest,type SourceRewardResponse} from './r6-reward-provider';
import contract from './data/round3-ui-contract.json';
import {sourceDiaFirstBuyLoaded,sourceDiaProductIndex,type SourceDiaFirstBuyState} from './r6-shop-lifecycle';
export interface SourceShopState {diamonds:number;entitlements:SourceEntitlements;claims:string[];shopFirstBuy?:SourceDiaFirstBuyState}
export type SourceShopResult={state:SourceShopState;status:'granted'|'blocked'|'duplicate';amount:number;reason:string};
export const SOURCE_SHOP_CARDS=[
 {group:'Remove Ads',name:'Remove_AD_Forced',product:'remove_forced_ads',flag:'removeAdsForced',title:'移除强制广告',description:'移除强制广告；奖励广告仍需确认。存钱罐每分钟 +1。'},
 {group:'Remove Ads',name:'Remove_AD_All',product:'remove_all_ads',flag:'removeAdsAll',title:'移除所有广告',description:'奖励广告权益与强制广告分开保存。存钱罐每分钟 +1。'},
 {group:'Package',name:'AutoUpgrade',product:'autoupgrade_pack',flag:'autoUpgradePack',title:'自动强化礼包',description:'永久自动强化；首次赠送 500 钻石。'},
 {group:'Package',name:'BuffPack',product:'buff_pack',flag:'buffPack',title:'永久增益礼包',description:'永久激活三项增益 ×4；首次赠送 1,000 钻石。'},
 {group:'Package',name:'DiaPack',product:'dia_pack',flag:'diaPack',title:'钻石礼包',description:'首次获得 16,000 钻石；非重复消耗品。'},
] as const;
/** Forced removals never imply reward-ad removal. FreeCash rights have their own source consumer. */
export const sourceRewardAdsRemoved=(e:SourceEntitlements)=>e.removeAdsAll||e.adRemoved;
export const sourceForcedAdsRemoved=(e:SourceEntitlements)=>e.removeAdsForced||e.removeAdsAll;
export function sourceShopFirstBuy(claims:string[],id:string,saved?:SourceDiaFirstBuyState){const i=sourceDiaProductIndex(id);return i>=0&&!sourceDiaFirstBuyLoaded(saved,claims).used[i];}
export function sourceShopPurchase(s:SourceShopState,request:SourceRewardRequest,response:SourceRewardResponse):SourceShopResult {
 const deny=(reason:string,status:'blocked'|'duplicate'='blocked'):SourceShopResult=>({state:s,status,amount:0,reason});
 const packageOffer=Object.prototype.hasOwnProperty.call(SOURCE_PACKAGE_OFFERS,request.purpose),diamondOffer=contract.shop.offerings.find(o=>o.id===request.purpose);
 if(!packageOffer&&!diamondOffer)return deny('商品不存在');
 if(!request.id.trim()||request.id.length>240||request.kind!=='purchase'||!sourceRewardMatches(request,response))return deny('交易回调身份不匹配');
 if(s.claims.includes(request.id))return deny('已处理交易，不重复发奖','duplicate');
 if(response.status!=='success')return deny(response.status==='unavailable'?'真实商店未连接；未发奖':`本地测试交易${response.status==='cancelled'?'已取消':'失败'}；未发奖`);
 if(packageOffer){
  const result=sourceApplyPackagePurchase({diamonds:s.diamonds,entitlements:s.entitlements,consumedReceipts:s.claims},request.purpose as SourcePackageID,{confirmed:true,receiptId:request.id});
  if(result.status==='blocked')return deny(result.reason);
  return {state:{...s,diamonds:result.value.diamonds,entitlements:result.value.entitlements,claims:result.value.consumedReceipts},status:'granted',amount:result.diamondGrant,reason:result.diamondGrant?`本地测试权益已记录 · 钻石 +${result.diamondGrant} · 不真实支付`:'已拥有权益；本地恢复，不重复赠送钻石'};
 }
 const first=sourceShopFirstBuy(s.claims,diamondOffer!.id,s.shopFirstBuy),amount=diamondOffer!.reward.amount*(first?diamondOffer!.firstPurchaseMultiplier:1);
 if(!Number.isSafeInteger(s.diamonds)||s.diamonds<0||!Number.isSafeInteger(s.diamonds+amount))throw new RangeError('Shop diamond overflow');
 const shopFirstBuy=sourceDiaFirstBuyLoaded(s.shopFirstBuy,s.claims);shopFirstBuy.used[sourceDiaProductIndex(diamondOffer!.id)]=true;
 return {state:{...s,shopFirstBuy,diamonds:s.diamonds+amount,claims:[...s.claims,request.id,`shop:${diamondOffer!.id}:${request.id}`]},status:'granted',amount,reason:`本地测试钻石 +${amount}${first?'（首次双倍）':''} · 不真实支付`};
}
