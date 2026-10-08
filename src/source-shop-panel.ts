/** Original shop resources, scoped text/state projection; no transactions here. */
import type {SourceUiView} from './source-ui';
import {SOURCE_SHOP_CARDS,sourceShopFirstBuy,type SourceShopState} from './r6-shop';
import contract from './data/round3-ui-contract.json';
export const SOURCE_SHOP_ROOT='/Canvas/SafeArea/Shop_UI';
export const SOURCE_SHOP_CONTENT=SOURCE_SHOP_ROOT+'/Panel/Scroll View/Viewport/Content';
export interface SourceShopPanelState extends SourceShopState {localProvider:boolean;pending:boolean;saveFailedProduct?:string;notice:string;offerWallBanner?:{visible:boolean};freeCashBanner?:{featureEnabled:boolean;exposureTarget:boolean}}
export function sourceShopProjection(s:SourceShopPanelState){
 const text:Record<string,string>={},active:Record<string,boolean>={};
 // The retained Shop instance must refresh its own currency, not only the hidden field HUD.
 text[SOURCE_SHOP_ROOT+'/Panel/TopBar/Currency/Dia/Price_txt']=String(s.diamonds);
 const set=(p:string,v:string)=>{text[SOURCE_SHOP_CONTENT+p]=v;},show=(p:string,v:boolean)=>{active[SOURCE_SHOP_CONTENT+p]=v;};
 set('/Free Reward/TOP/I2_txt','免费奖励 · 外部服务未连接');set('/Remove Ads/Remove_AD/I2_txt','广告权益');set('/Package/License/I2_txt','特殊礼包');set('/Dia (List)/Dia/I2_txt',s.notice||'钻石 · 本地测试交易，不真实支付');
 for(const card of SOURCE_SHOP_CARDS){
  const p=`/${card.group}/${card.name}`,owned=s.entitlements[card.flag];
  set(p+'/I2_txt(Outline)',card.title);set(p+'/I2_txt',owned?'已拥有':card.description);
  set(p+'/Purchase_Btn/Price_txt',s.saveFailedProduct===card.product?'重试保存':s.pending?'处理中':s.localProvider?'本地测试':'服务未连接');show(p+'/Purchased_obj',owned);show(p+'/Purchase_Btn',!owned);show(p+'/Event_obj',false);
 }
 contract.shop.offerings.forEach((o,i)=>{const p='/Dia (List)/Dia_Pack'+(i?` (${i})`:''),first=sourceShopFirstBuy(s.claims,o.id,s.shopFirstBuy);set(p+'/Value_txt',String(o.reward.amount));set(p+'/Image/Value_txt (1)',s.saveFailedProduct===o.id?'重试保存':s.pending?'处理中':s.localProvider?'本地测试':o.priceText);show(p+'/FirstPurchase_obj',first);set(p+'/FirstPurchase_obj/I2_txt(Outline)',`首次额外 +${o.reward.amount}`);});
 show('/Free Reward/OfferWall_Bannner',!!s.offerWallBanner?.visible);
 show('/Free Reward/FreeCash_Banner',!!s.freeCashBanner?.featureEnabled&&!!s.freeCashBanner?.exposureTarget);
 // These are real external service entries, NOT invented free-diamond buttons.
 for(const name of ['OfferWall_Bannner','FreeCash_Banner']){const p='/Free Reward/'+name;set(p+'/I2_txt(Outline)',name==='OfferWall_Bannner'?'OfferWall':'FreeCash');set(p+'/Text (TMP)',name==='FreeCash_Banner'?'本地测试链接／线上未连接':'本地测试任务页／线上未连接');set(p+'/Purchase_Btn/I2_txt(Outline)','查看服务状态');}
 return {text,active};
}
export function syncSourceShopPanel(view:SourceUiView,s:SourceShopPanelState){const projection=sourceShopProjection(s);for(const [p,v] of Object.entries(projection.text))view.setText(p,v);for(const [p,v] of Object.entries(projection.active))view.setActive(p,v);}
