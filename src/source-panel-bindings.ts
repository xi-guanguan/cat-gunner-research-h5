import passSlots from './data/r6-pass-slots.json';
import {sourceAutoAdPanelProjection} from './r6-auto-upgrade-ad';
import {createLocalTestNotice} from './local-test-notice';
import {sourcePassAllRewards} from './r6-pass-lifecycle';
import {SOURCE_PASS_POPUP_ROOTS,sourcePassPopupProjection,type SourcePassPopup} from './pass-popup-projection';
import {sourceChallengeSweepAble,sourceChallengeSweepEfficiency,sourceChallengePlusBannerVisible,sourceChallengeRewardBanner} from './r6-challenge';
import {sessionChallengePower} from './session';
import {sourceRewardEntitlements} from './r5-entitlements';
import {sourceMinePlusBannerVisible} from './r6-mine-entry';
import {sourceBuffMultiplier} from './r5-entitlements';
import {SOURCE_SHOP_CARDS,sourceRewardAdsRemoved} from './r6-shop';
import {sourceShopProjection} from './source-shop-panel';
import {SOURCE_BUFF_PANEL_ACTIONS,syncSourceBuffPanel} from './source-buff-panel';
/** Original Unity panel trees with live H5 state. Callers own transactions and persistence. */
import type {Texture} from 'pixi.js';
import {createSourceUiView, sourceUiTree, type SourceUiView, type SourceUiViewport} from './source-ui';
import {sessionRebirthReward, type Session} from './session';
import {ACTIVITY_MISSIONS, DAILY_REWARDS, type ActivityState, type ActivityCounter} from './source-activities';
import type {LocalPlatformState} from './local-platform';
import type {BrowserPreferences} from './browser-preferences';
import {freshSourceMetaState, sourceMetaPassView, type SourceMetaState} from './source-meta-runtime';
import {contentGate, permanentUpgradeQuote, type PermanentUpgradeKind} from './meta-progression';
import {challengeQuote} from './challenge-source';
import {refreshSourceMineTickets} from './mine-source';
import {localMineTime} from './mine-time';
import {walletValue} from './rules';
import {sourcePassClaimGate} from './source-meta-actions';
import shopContract from './data/round3-ui-contract.json';
import guns from './data/guns.json';
import {SOURCE_FISH_INFO,sourceFishTotals,type SourceFishAutoMergeCandidate} from './r5-fish';
import {createSourceFishAutoDelay,createSourceFishAutoMergeScheduler,type SourceFishAutoDelay} from './source-fish-auto-motion';
import {SOURCE_FISH_TANK_SIZE,SOURCE_FISH_REAL_SPRITE_KEYS,SOURCE_FISH_REAL_SIZES,sourceFishMotionRandom,sourceInitFishMotion,sourceFindFishSpawnPosition,sourceTickFishMotion,sourceFishFacesRight,type SourceFishMotion} from './r5-fish-motion';

export interface SourcePlatformUI {
  signedIn:boolean; pending:boolean; offerWallBanner?:{visible:boolean};freeCashBanner?:{featureEnabled:boolean;exposureTarget:boolean}; confirmation?:'cloud-save'|'cloud-load';
  preview?:{maxStage:number;savedAt:string};
}
export interface SourcePanelOptions {
  textures:Record<string,Texture>; viewport:SourceUiViewport; panel:string;
  session:Session; activities:ActivityState; platform:LocalPlatformState; preferences:BrowserPreferences;
  autoAdUI?:{today:string;pending:boolean;saveFailed:boolean}; passPopup?:SourcePassPopup; passPending?:boolean; passSaveFailed?:boolean; purchaseSaveFailed?:boolean; purchaseSaveFailedProduct?:string; purchasePending?:boolean; rewardPending?:boolean; qaLocalProvider?:boolean; purchaseLocalProvider?:boolean; meta?:SourceMetaState; platformUI?:SourcePlatformUI; notice?:string; action:(name:string,payload?:any)=>void;
}
/** Action contract: close, preference(key), developer, claim-daily, permanent,
 * confirm-rebirth, permanent-upgrade(damage|speed|money), start-challenge, start-mine,
 * shop-purchase(offerID), mission-claim({id,luxury?}), pass-claim({track,index}),
 * pass-purchase(vip|luxury|luxury-upgrade), mine-sweep, sweep-bonus, sweep-close,
 * rebirth (from permanent dispatches close then rebirth), claim-victory, challenge-bonus,
 * acknowledge-defeat, mine-bonus, exit-mine, redeem-open,
 * platform(google-login|cloud-save|cloud-load|redeem|support|restore-purchases),
 * platform-confirm, platform-cancel, unresolved(message). Unknown/provider-dependent actions never mutate state here. */
export const SOURCE_PANEL_ROOTS:Readonly<Record<string,string>>={
  settings:'/Canvas/Setting/Setting_UI',
  buff:'/Canvas/Buff_manager/Buff_UI',
  auto:'/Canvas/Shop_manager/AutoUpgrade_UI',
  fish:'/Canvas/SafeArea/Fish_UI  (SafeArea)/Fish_UI',
  boss:'/Canvas/Contents_UI/Boss_UI/Boss_Start_UI',
  pet:'/Canvas/SafeArea/Pet_UI (SafeArea)/Pet_UI',
  monster:'/Canvas/Contents_UI/Monster_UI/Monster_Start_UI',
  adventure:'/Canvas/SafeArea/Adventure_UI (SafeArea)/Adventure_Panel',
  raid:'/Canvas/Contents_UI/Raid_UI/Raid_Start_UI',
  redeem:'/Canvas/Setting/Redeem_UI',
  challenge:'/Canvas/Contents_UI/SpeedRun_UI/SpeedRun_Start_UI',
  mine:'/Canvas/Contents_UI/Mine_UI/Mine_Start_UI',
  'mine-pack':'/Canvas/Contents_UI/Mine_UI/MinePack_Purchase_UI',
  'challenge-sweep':'/Canvas/Contents_UI/SpeedRun_UI/GameSweep_obj',
  'challenge-win':'/Canvas/Contents_UI/SpeedRun_UI/GameWin_obj',
  'challenge-fail':'/Canvas/Contents_UI/SpeedRun_UI/GameFail_obj',
  'mine-result':'/Canvas/Contents_UI/Mine_UI/GameEnd_obj',
  rebirth:'/Canvas/Rebirth_manager/Rebirth_Popup_UI',
  permanent:'/Canvas/Rebirth_manager/RubyUpgrade_UI',
  daily:'/Canvas/SafeArea/DailyCheck',
  shop:'/Canvas/SafeArea/Shop_UI',
  missions:'/Canvas/SafeArea/Mission_maanger/Mission_UI',
  pass:'/Canvas/SafeArea/Mission_maanger/Mission_UI',
};
const byPath=new Map(sourceUiTree.nodes.map(n=>[n.path,n]));
const byId=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));
const fishAutoDelays=new WeakMap<SourcePanelOptions['action'],SourceFishAutoDelay>();
const dailyDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

export function createSourcePanel(options:SourcePanelOptions):SourceUiView|null {
  const {session,activities,platform,preferences,action}=options,meta=options.meta??freshSourceMetaState();
  const sweep=options.panel==='mine'&&!!meta.sweep?.pending;
  const confirmation=options.panel==='settings'?options.platformUI?.confirmation:undefined;
  const rootPath=confirmation?`/Canvas/Setting/${confirmation==='cloud-save'?'DataSave_UI':'DataLoad_UI'}`:sweep?'/Canvas/Contents_UI/Mine_UI/GameSweep_obj':SOURCE_PANEL_ROOTS[options.panel],rootNode=byPath.get(rootPath);
  if(!rootNode)return null;
  const active:Record<string,boolean>={},text:Record<string,string>={},fills:Record<string,number>={};
  const bindings=new Map<string,{name:string;payload?:any}>(),sprites=new Map<string,string>();
  const path=(relative:string)=>rootPath+relative;
  const set=(relative:string,value:string)=>{if(byPath.has(path(relative)))text[path(relative)]=value;};
  const show=(relative:string,value:boolean)=>{if(byPath.has(path(relative)))active[path(relative)]=value;};
  const bind=(relative:string,name:string,payload?:any)=>{if(byPath.has(path(relative)))bindings.set(path(relative),{name,payload});};
  const unresolved=(relative:string,message:string)=>bind(relative,'unresolved',message);
  const labels=(relative:string,value:string)=>{
    const prefix=path(relative)+'/';
    for(const n of sourceUiTree.nodes)if(n.path.startsWith(prefix)&&n.components.some(c=>c.kind==='TextMeshProUGUI')&&!n.path.includes('/Price'))text[n.path]=value;
  };
  // Selecting a subtree must also activate its serialized inactive manager ancestors.
  for(let n:typeof rootNode|undefined=rootNode;n;n=n.parent?byId.get(n.parent):undefined)active[n.id]=true;
  // Required presentation layers are explicit; samples and reward states stay business driven.
  for(const layer of options.panel==='daily'?['/DailyCheck_empty']:options.panel==='missions'||options.panel==='pass'?['/Reward','/Mission_Panel']:['/Panel'])show(layer,true);
  function bindResultBanner(){
      const banner=sourceChallengeRewardBanner(meta.entitlements.removeAdsAll,options.platformUI?.freeCashBanner);
      show('/Remove Ads ALL (Inapp)',banner.purchase||banner.freeCash);
      show('/Remove Ads ALL (Inapp)/Remove_AD_All',banner.purchase);
      show('/Remove Ads ALL (Inapp)/FreeCash_Banner',banner.freeCash);
      show('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchased_obj',meta.entitlements.removeAdsAll);
      bind('/Remove Ads ALL (Inapp)/Remove_AD_All','result-remove-ads');bind('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn','result-remove-ads');
      set('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn/Price_txt',options.purchaseSaveFailedProduct==='remove_all_ads'?'重试保存':options.purchasePending?'本地处理中…':options.purchaseLocalProvider||options.qaLocalProvider||platform.developerEnabled&&platform.freePurchases?'本地测试购买':'服务未连接');
      set('/Remove Ads ALL (Inapp)/FreeCash_Banner/I2_txt(Outline)','FreeCash · 本地测试／线上未连接');
      set('/Remove Ads ALL (Inapp)/FreeCash_Banner/Purchase_Btn/I2_txt(Outline)','查看服务状态');
      bind('/Remove Ads ALL (Inapp)/FreeCash_Banner','freecash-open','banner_reward');bind('/Remove Ads ALL (Inapp)/FreeCash_Banner/Purchase_Btn','freecash-open','banner_reward');
  }
  const closeAction=options.panel==='mine-pack'?'mine-pack-close':confirmation?'platform-cancel':sweep?'sweep-close':options.panel==='challenge-sweep'?'challenge-sweep-close':options.panel==='challenge-win'?'claim-victory':options.panel==='challenge-fail'?'acknowledge-defeat':options.panel==='mine-result'?'exit-mine':'close';
  bind('/Fish_Panel/Close_Btn',closeAction);bind('/Background',closeAction);bind('/Close_Btn',closeAction);bind('/Panel/Close_Btn',closeAction);
  for(const n of sourceUiTree.nodes)if(n.path.startsWith(rootPath+'/')&&n.path.endsWith('/Currency/Dia/Price_txt'))text[n.path]=String(session.diamonds);
  for(const n of sourceUiTree.nodes)if(n.path.startsWith(rootPath+'/')&&n.path.endsWith('/Currency/Money/Price_txt'))text[n.path]=walletValue(session.battle).format();

  if(options.panel==='buff'){
    for(const entry of SOURCE_BUFF_PANEL_ACTIONS)bindings.set(entry.path,{name:'buff-ad',payload:entry.kind});
    bind('/Close/Close_Btn','close');
    bind('/InApp & FREECASH/BuffPack (Inapp)/BuffPack','package-purchase','buff_pack');
    bind('/InApp & FREECASH/FreeCash/FreeCash_Banner','freecash-open','banner');bind('/InApp & FREECASH/FreeCash/FreeCash_Banner/Purchase_Btn','freecash-open','banner');
    for(const entry of SOURCE_BUFF_PANEL_ACTIONS)labels(entry.path.slice(rootPath.length),platform.developerEnabled&&platform.freeAds?'测试 +5分':'+5分钟');
    for(const [path,value] of [['/Buff_list/Buff_Panel/I2_txt(Outline)','金币增益'],['/Buff_list/Buff_Panel (1)/I2_txt(Outline)','攻击增益'],['/Buff_list/Buff_Panel (2)/I2_txt(Outline)','攻速增益'],['/Buff_list/Super_Buff_Panel/NonActive_obj/I2_txt(Outline)','同时激活三项，效果提升至 ×4'],['/Buff_list/Super_Buff_Panel/Active_obj/I2_txt(Outline)','三项已激活！\\n效果提升至 ×4'],['/InApp & FREECASH/BuffPack (Inapp)/BuffPack/I2_txt(Outline)','永久增益套餐'],['/InApp & FREECASH/BuffPack (Inapp)/BuffPack/I2_txt','永久激活三项增益，实际消费者 ×4。'],['/InApp & FREECASH/BuffPack (Inapp)/BuffPack/Purchase_Btn/Price_txt','本地测试'],['/InApp & FREECASH/FreeCash/FreeCash_Banner/Purchase_Btn/I2_txt(Outline)','查看服务'],['/InApp & FREECASH/FreeCash/FreeCash_Banner/I2_txt(Outline)','FreeCash · 本地测试／线上未连接']] as const)set(path,value);
    // Native BannerReward.Reload hides both once purchased, otherwise tests
    // FreeCash_manager.Banner_ShouldShow; only confirmed SDK exposure or explicit QA.
    show('/InApp & FREECASH',!meta.entitlements.buffPack);
    show('/InApp & FREECASH/FreeCash',!meta.entitlements.buffPack&&!!options.platformUI?.freeCashBanner?.exposureTarget);
    show('/InApp & FREECASH/BuffPack (Inapp)',!meta.entitlements.buffPack);
  } else if(options.panel==='auto'){
    set('/Panel/I2_txt(Outline)','自动强化');set('/Panel/Explain_txt','自动强化攻击、攻速和金币收益');
    const p=sourceAutoAdPanelProjection(meta.autoUpgrade,meta.entitlements.autoUpgradePack,options.autoAdUI?.today??localMineTime.today());
    show('/Panel/NonPurchase_obj',p.nonPurchase);show('/Panel/Purchase_obj',p.purchase);
    show('/Panel/NonPurchase_obj/Shop_Btn',p.shop);show('/Panel/NonPurchase_obj/AD_Bonus_Btn',p.ad);
    set('/Panel/NonPurchase_obj/Shop_Btn/I2_txt(Outline)','今日已领 · 查看套餐');bind('/Panel/NonPurchase_obj/Shop_Btn','shop');
    bind('/Panel/NonPurchase_obj/AD_Bonus_Btn','auto-ad');
    set('/Panel/NonPurchase_obj/AD_Bonus_Btn/I2_txt(Outline)',options.autoAdUI?.saveFailed?'重试保存 · 不重看广告':options.autoAdUI?.pending?'本地测试处理中':'本地测试广告 · 10分钟');
    show('/Panel/Purchase_obj/Time_txt',p.time);set('/Panel/Purchase_obj/Time_txt',`${Math.ceil(meta.autoUpgrade.adRemainingSec)} 秒`);
    show('/Panel/Purchase_obj/On_obj',p.on);show('/Panel/Purchase_obj/Off_obj',p.off);
    bind('/Panel/Purchase_obj/On_obj','auto-set',false);bind('/Panel/Purchase_obj/Off_obj','auto-set',true);
    // Source Inapp_Purchase_Popup kind2: unowned popup, original product autoupgrade_pack.
    show('/AutoUpgrade (InApp)',p.inApp);bind('/AutoUpgrade (InApp)/AutoUpgrade','shop-purchase','autoupgrade_pack');
    set('/AutoUpgrade (InApp)/AutoUpgrade/Purchase_Btn/Price_txt',options.purchaseSaveFailedProduct==='autoupgrade_pack'?'重试保存':options.purchasePending?'处理中':'本地测试');
    set('/AutoUpgrade (InApp)/AutoUpgrade/Dia/Price_txt','500');
    set('/AutoUpgrade (InApp)/AutoUpgrade/I2_txt(Outline)','永久自动强化');set('/AutoUpgrade (InApp)/AutoUpgrade/I2_txt','本地测试购买 · 不真实支付');
  } else if(options.panel==='fish'){
    const totals=sourceFishTotals(meta.fish),remaining=Math.max(0,5-meta.fish.freeCount),needsAd=meta.fish.freeCount>=3;
    show('/Fish_Panel',true);set('/Fish_Panel/TopBar/I2_txt(Outline)','鱼');
    for(const [id,title,value] of [['Damage','攻击',totals.damagePercent],['CriPer','暴击率',totals.criticalChancePercent],['CriDmg','暴击伤害',totals.criticalDamagePercent]] as const){set(`/Fish_Panel/Stats/${id}/I2_txt`,title);set(`/Fish_Panel/Stats/${id}/Value_txt`,`${value}%`);}
    set('/Fish_Panel/Background/Count_txt',`${meta.fish.inventory.length} / 20`);
    show('/Fish_Panel/Free_Gacha_Btn',!needsAd);show('/Fish_Panel/AD_Gacha_Btn',needsAd);
    set('/Fish_Panel/Free_Gacha_Btn/I2_txt(Outline)','免费获取');set('/Fish_Panel/Free_Gacha_Btn/Price (1)/Price_txt',String(remaining));
    set('/Fish_Panel/AD_Gacha_Btn/I2_txt(Outline)',platform.developerEnabled&&platform.freeAds?'测试广告获取':'广告获取');set('/Fish_Panel/AD_Gacha_Btn/Count_txt',`x${remaining}`);
    set('/Fish_Panel/Fish_Draw_Btn (Epic)/I2_txt(Outline)','高级获取');set('/Fish_Panel/Fish_Draw_Btn (Epic)/Price/Price_txt','200');
    bind('/Fish_Panel/Free_Gacha_Btn','fish-draw','free');bind('/Fish_Panel/AD_Gacha_Btn','fish-draw','free');bind('/Fish_Panel/Fish_Draw_Btn (Epic)','fish-draw','premium');
    const autoAllowed=meta.entitlements.plusPack2Active,autoEnabled=autoAllowed&&meta.fish.autoMergeRequested;
    show('/Fish_Panel/OnOff',true);show('/Fish_Panel/OnOff/On',autoEnabled);show('/Fish_Panel/OnOff/Off',!autoEnabled);
    set('/Fish_Panel/OnOff/Text (TMP)','自动');bind('/Fish_Panel/OnOff','fish-auto-set',!autoEnabled);
    show('/Fish_Panel/Auto_Explain',autoEnabled);set('/Fish_Panel/Auto_Explain','相同等级的鱼会自动合成');
    set('/Fish_Panel/Explain',options.notice||(autoEnabled?'':'拖动相同等级的鱼合成'));show('/Fish_Panel/Explain',!autoEnabled||!!options.notice);
    for(let i=0;i<20;i++){
      const p='/Fish_Panel/Background/FishTank/Fish_item'+(i?` (${i})`:''),grade=meta.fish.inventory[i];
      show(p,grade!==undefined);show(p+'/Bounce_Start/Skin_image/FusionAlert_obj',false);
      if(grade!==undefined){const sprite=sourceUiTree.sprites[SOURCE_FISH_REAL_SPRITE_KEYS[grade]];if(sprite?.url)sprites.set(path(p+'/Bounce_Start/Skin_image'),sprite.url);}
    }
  } else if(options.panel==='challenge-fail'){
    set('/Panel/Top/I2_txt(Outline)',options.notice||'挑战失败');set('/Panel/Reward/I2_txt(Outline)','钻石奖励');set('/Panel/Reward/Dia/Reward_txt','0');
    set('/Panel/Exit/Exit_Btn/I2_txt(Outline)','返回');bind('/Panel/Exit/Exit_Btn','acknowledge-defeat');bindResultBanner();
  } else if(options.panel==='challenge-win'||options.panel==='challenge-sweep'||options.panel==='mine-result'){
    const mine=options.panel==='mine-result',challengeSweep=options.panel==='challenge-sweep',settlement=mine?session.mine.settlement:session.challengeSettlement,bonusAvailable=!!settlement&&!settlement.bonusClaimed;
    const base=settlement?.totalReward??(mine?0:30),bonusAction=mine?'mine-bonus':'challenge-bonus',exitAction=mine?'exit-mine':challengeSweep?'challenge-sweep-close':'claim-victory';
    set('/Panel/Top/I2_txt(Outline)',options.notice||(mine?'开采完成':challengeSweep?'挑战扫荡完成':'挑战胜利'));set('/Panel/Reward/I2_txt(Outline)','已获得钻石');set('/Panel/Reward/Dia/Reward_txt',String(base));
    show('/Panel/Bonus_Objs/Bonus_Btn',bonusAvailable);show('/Panel/Bonus_Objs/NoAds_Btn',!bonusAvailable);
    set('/Panel/Bonus_Objs/Bonus_Btn/I2_txt(Outline)',options.rewardPending?'本地处理中…':options.qaLocalProvider||platform.developerEnabled&&platform.freeAds?'本地测试 ×4':'广告 ×4（未连接）');bind('/Panel/Bonus_Objs/Bonus_Btn',bonusAction);
    set('/Panel/Bonus_Objs/NoAds_Btn/I2_txt(Outline)','确定');bind('/Panel/Bonus_Objs/NoAds_Btn',exitAction);
    show('/Skip_obj',true);show('/Panel/Bonus_Objs',true);
    set('/Skip_obj/Exit_Btn/Dia/Reward_txt',String(base));set('/Skip_obj/Exit_Btn/NoThanks','确定');bind('/Skip_obj/Exit_Btn',exitAction);
    bindResultBanner();
  } else if(sweep&&meta.sweep){
    const settlement=meta.sweep;
    set('/Panel/Top/I2_txt(Outline)',options.notice||'矿场扫荡完成');set('/Panel/Reward/I2_txt(Outline)','已获得钻石');
    set('/Panel/Reward/Dia/Reward_txt',String(settlement.totalReward));
    const bonusAvailable=!settlement.bonusClaimed;
    show('/Panel/Bonus_Objs/Bonus_Btn',bonusAvailable);show('/Panel/Bonus_Objs/NoAds_Btn',!bonusAvailable);
    set('/Panel/Bonus_Objs/Bonus_Btn/I2_txt(Outline)',options.rewardPending?'本地处理中…':options.qaLocalProvider||platform.developerEnabled&&platform.freeAds?'本地测试 ×4':'广告 ×4（未连接）');
    bind('/Panel/Bonus_Objs/Bonus_Btn','sweep-bonus');set('/Panel/Bonus_Objs/NoAds_Btn/I2_txt(Outline)','确定');bind('/Panel/Bonus_Objs/NoAds_Btn','sweep-close');
    show('/Skip_obj',true);show('/Panel/Bonus_Objs',true);
    set('/Skip_obj/Exit_Btn/Dia/Reward_txt',String(settlement.totalReward));set('/Skip_obj/Exit_Btn/NoThanks','确定');bind('/Skip_obj/Exit_Btn','sweep-close');
    bindResultBanner();
  } else if(options.panel==='settings'){
    const prefs:[string,keyof BrowserPreferences,string][]=[['BGM','music','音乐'],['SFX','sound','音效'],['Vibration','vibration','振动']];
    for(const [button,key,label] of prefs){const p=`/Panel/${button}_Btn`;set(p+'/I2_txt',label);show(p+'/On',preferences[key]);show(p+'/Off',!preferences[key]);bind(p,'preference',key);}
    const ui=options.platformUI??{signedIn:false,pending:false};
    if(confirmation){
      set('/Panel/I2_txt(Outline)',confirmation==='cloud-save'?'覆盖已保存的存档？':'读取已保存的存档？');
      set(confirmation==='cloud-save'?'/Panel/I2_txt':'/Panel/I2_txt(Outline) (1)',confirmation==='cloud-save'?'保存后将替换目标存档':'读取后将替换当前游戏进度');
      set('/Panel/SaveTime/I2_txt','保存时间');set('/Panel/MaxStage/I2_txt (1)','最大关卡');
      const savedAt=ui.preview?.savedAt;const date=savedAt?new Date(savedAt):undefined;const timeText=date&&Number.isFinite(date.getTime())?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`:'未知';
      set('/Panel/SaveTime/Stage_txt',timeText);set('/Panel/MaxStage/Stage_txt',ui.preview?String(ui.preview.maxStage):'未知');
      labels('/Panel/Load_Btn',confirmation==='cloud-save'?'确认保存':'确认读取');labels('/Panel/Cancel_Btn','取消');
      bind('/Panel/Load_Btn','platform-confirm');bind('/Panel/Cancel_Btn','platform-cancel');
    }else{
      labels('/Panel/RedeemOpen_Btn','兑换码');bind('/Panel/RedeemOpen_Btn','redeem-open');
      const commands:[string,string,string][]=[['Login','登录','google-login'],['Restore','恢复购买','restore-purchases'],['WriteUs','客服','support']];
      for(const [name,label,command] of commands){labels(`/Panel/${name}_Btn`,label);bind(`/Panel/${name}_Btn`,'platform',command);}
      show('/Panel/Login_Btn',!ui.signedIn&&!ui.pending);show('/Panel/Login_Btn (ios)',false);show('/Panel/Logined_obj',ui.signedIn||ui.pending);
      show('/Panel/Logined_obj/Save_Btn',ui.signedIn&&!ui.pending);show('/Panel/Logined_obj/Load_Btn',ui.signedIn&&!ui.pending);show('/Panel/Logined_obj/Loading_Txt',ui.pending);
      labels('/Panel/Logined_obj/Save_Btn','保存');labels('/Panel/Logined_obj/Load_Btn','读取');set('/Panel/Logined_obj/Loading_Txt','处理中…');
      bind('/Panel/Logined_obj/Save_Btn','platform','cloud-save');bind('/Panel/Logined_obj/Load_Btn','platform','cloud-load');
    }
  } else if(options.panel==='redeem'){
    set('/Panel/I2_txt(Outline)','兑换码');
    labels('/Panel/Redeem_Btn',options.platformUI?.pending?'处理中…':'兑换');bind('/Panel/Redeem_Btn','platform','redeem');
    // Native TMP input is provided by createSourceRedeemInputOverlay; hide its raster text to avoid duplicate glyphs.
    show('/Panel/InputField (TMP)/Text Area/Placeholder',false);show('/Panel/InputField (TMP)/Text Area/Text',false);
  } else if(options.panel==='challenge'){
    const quote=challengeQuote(session.challengeStage),auto=meta.entitlements.plusPack2Active,power=sessionChallengePower(session,meta.entitlements,meta.fish,meta.buffTimes,meta.relic);
    const supported=quote.status==='supported',able=supported&&sourceChallengeSweepAble(session.challengeStage,power),efficiency=supported?sourceChallengeSweepEfficiency(session.challengeStage,power):0;
    set('/Panel/Stage_txt',`挑战第 ${session.challengeStage} 关`);
    set('/Panel/Explain (1)/I2_txt',options.notice||(supported?`在 ${quote.value.seconds} 秒内清理目标\n攻击力和攻速升级生效，不受普通关卡攻速惩罚`:quote.reason));
    set('/Panel/Reward/Dia/Reward_txt',sourceRewardEntitlements(meta.entitlements).automaticBonus?'120':'30');set('/Panel/Reward/I2_txt(Outline) (2)','胜利已入账奖励');
    set('/Panel/Power_My/I2_txt(Outline) (2)','挑战战力');set('/Panel/Power_My/Value_txt',power.format());
    // Only the local saved player is displayed; never fabricate global leaderboard entries.
    show('/Rank_Panel',true);
    for(let i=0;i<7;i++)show('/Rank_Panel/Scroll View/Viewport/Content/User_Rank_Info'+(i?` (${i})`:''),i===0);
    const row='/Rank_Panel/Scroll View/Viewport/Content/User_Rank_Info';set(row+'/Left_Panel/Num_Txt','—');set(row+'/Nickname_txt','本地测试 · 非全球榜');set(row+'/Lv_txt',`已通关 ${session.challengeStage-1}`);
    show('/Panel/NonAuto_obj',!auto);show('/Panel/Auto_obj',auto);
    for(const branch of ['NonAuto_obj','Auto_obj']){labels(`/Panel/${branch}/Enter_Btn`,supported?'开始挑战':'版本阶段上限');bind(`/Panel/${branch}/Enter_Btn`,'start-challenge');}
    show('/Panel/Auto_obj/Sweep_Btn/NonActive_obj',!able);show('/Panel/Auto_obj/Sweep_Btn/Active_obj',able);
    set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Value_txt',`${efficiency}%`);fills[path('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Fill')]=efficiency/100;
    bind('/Panel/Auto_obj/Sweep_Btn','challenge-sweep');
    show('/Banner_PlusPack',sourceChallengePlusBannerVisible(session.historicMax,auto));
    show('/Banner_PlusPack/Plus_Auto/NonPurchase_Panel',true);show('/Banner_PlusPack/Plus_Auto/Active_Panel',false);
    set('/Banner_PlusPack/Plus_Auto/NonPurchase_Panel/Price_txt',options.purchaseLocalProvider||options.qaLocalProvider||platform.developerEnabled&&platform.freePurchases?'本地测试购买':'购买未连接');
    bind('/Banner_PlusPack/Plus_Auto','challenge-plus-purchase');
  } else if(options.panel==='mine'){
    const gate=contentGate(session.historicMax,'mine'),maximum=meta.entitlements.minePack?6:2,today=localMineTime.today();
    const refreshed=refreshSourceMineTickets(session.mine.tickets,today,localMineTime.canRolloverDaily(3,session.mine.tickets.storedDate,today));
    const used=refreshed.status==='supported'?refreshed.state.used:session.mine.tickets.used,remaining=Math.max(0,maximum-used);
    const auto=meta.entitlements.plusPack2Active;
    set('/Panel/I2_txt(Outline)','钻石矿场');
    set('/Panel/Explain (1)/I2_txt',options.notice||(gate.unlocked?'在 60 秒内尽可能开采钻石':'普通第 4 大关开放'));
    set('/Panel/Explain (1)/I2_txt (1)','矿石每次受到 1 点伤害，与攻击力无关');
    set('/Panel/Reward/I2_txt(Outline) (2)','历史最佳奖励');set('/Panel/Reward/Dia/Reward_txt',String(session.mine.bestReward));
    set('/Panel/Power_My/I2_txt(Outline) (2)','伤害 / 命中');set('/Panel/Power_My/Value_txt','1');
    set('/Panel/Ticket/I2_txt','今日可入场次数');set('/Panel/Ticket/TicketCount_txt',`${remaining}/${maximum}`);
    show('/Panel/NonAuto_obj',!auto);show('/Panel/Auto_obj',auto);
    for(const p of ['/Panel/NonAuto_obj','/Panel/Auto_obj']){show(p+'/AD_Bonus_obj',remaining>0&&sourceBuffMultiplier(meta.entitlements,'speed',meta.buffTimes)===1);bind(p+'/AD_Bonus_obj','mine-speed-ad');labels(p+'/Enter_Btn',!gate.unlocked?'未开放':remaining>0?'进入矿场':'次数已用完');bind(p+'/Enter_Btn','start-mine');}
    const reward=Math.trunc(Math.fround(session.mine.bestReward*(meta.entitlements.plusPack1Active?1.5:1)));
    set('/Panel/Auto_obj/Sweep_Btn/Active_obj/I2_txt',reward>0?'立即完成':'先完成一次开采');
    set('/Panel/Auto_obj/Sweep_Btn/Active_obj/Value_txt',String(reward*(meta.entitlements.automaticBonus||meta.entitlements.removeAdsAll?4:1)));
    bind('/Panel/Auto_obj/Sweep_Btn','mine-sweep');
    // Inapp_Purchase_Popup.Reload: purchased hides banner; Purchase -> original product popup.
    show('/MinePack',!meta.entitlements.minePack);show('/Banner_PlusPack',sourceMinePlusBannerVisible(session.historicMax,meta.entitlements));bind('/Banner_PlusPack/Plus_Reward','mine-plus-purchase',1);
    bind('/MinePack/MinePack_Panel','mine-pack-open');
    set('/MinePack/MinePack_Panel/Panel/Top/I2_txt(Outline)','矿场礼包');
    set('/MinePack/MinePack_Panel/Panel/Dia/Price_txt','500');
    set('/MinePack/MinePack_Panel/Panel/Ticket/Image/Text (TMP)','6');
    set('/MinePack/MinePack_Panel/Panel/Purchase_Btn (1)/Price_txt','查看礼包');
  } else if(options.panel==='mine-pack'){
    set('/Panel/I2_txt(Outline)',options.notice||'矿场礼包');
    set('/Panel/MinePack/I2_txt(Outline)','每日 6 次矿场');
    set('/Panel/MinePack/I2_txt','永久增加每日矿场次数至 6；首次赠送 500 钻石。');
    set('/Panel/MinePack/Dia/Price_txt','500');
    set('/Panel/MinePack/Profile/Image/Text (TMP)','6');
    set('/Panel/MinePack/Purchase_Btn/Price_txt',options.purchasePending?'处理中':options.purchaseLocalProvider||options.qaLocalProvider||platform.developerEnabled&&platform.freePurchases?'本地测试':'服务未连接');
    show('/Panel/MinePack/Purchased_obj',meta.entitlements.minePack);show('/Panel/MinePack/Purchase_Btn',!meta.entitlements.minePack);
    // Both original Buttons invoke Inapp_Purchase_Panel.Purchase (123920 / child).
    bind('/Panel/MinePack','package-purchase','mine_pack');bind('/Panel/MinePack/Purchase_Btn','package-purchase','mine_pack');
  } else if(options.panel==='rebirth'){
    set('/Panel/Explain/I2_txt(Outline)',options.notice||'重置普通关卡、金币与普通升级\n获得用于永久强化的红宝石');
    set('/Panel/Reward/Reward_txt',sessionRebirthReward(session,meta.relic).format());set('/Panel/Reward/I2_txt(Outline)','可获得红宝石');
    labels('/Panel/Rebirth_btn','确认转生');bind('/Panel/Rebirth_btn','confirm-rebirth');
  } else if(options.panel==='permanent'){
    set('/Panel/Panel/Ruby/Value_txt',session.ruby.format());
    set('/Panel/Panel/Rebirth_Reward_Panel/Value_txt',sessionRebirthReward(session,meta.relic).format());
    set('/Panel/Panel/Rebirth_Reward_Panel/I2_txt(Outline)',options.notice||'转生可获得红宝石');
    labels('/Panel/Panel/Rebirth_Reward_Panel/Rebirth_Btn','转生');bind('/Panel/Panel/Rebirth_Reward_Panel/Rebirth_Btn','rebirth');
    show('/Panel/Panel/Rebirth_Reward_Panel  (AD)',false);
    const kinds:PermanentUpgradeKind[]=['damage','speed','money'],names=['永久攻击力','永久攻击速度','永久金币收益'];
    kinds.forEach((kind,i)=>{
      const p='/Panel/Panel/Ruby_Upgrade_Panel '+(i?` (${i})`:''),quote=permanentUpgradeQuote(kind,session.permanentLevels[kind],session.ruby);
      set(p+'/Name_txt',names[i]);set(p+'/Icon/Lv_txt',`Lv.${session.permanentLevels[kind]}`);
      if(quote.status==='supported'){show(p+'/UpgradeAble_obj',quote.value.canPurchase===true);set(p+'/Value_txt',`+${quote.value.currentBonusPercent.format()}%`);set(p+'/Upgrade_Btn/Price/Price_txt',quote.value.price.format());set(p+'/Upgrade_Btn/Name_txt',quote.value.atMaximum?'已满级':quote.value.canPurchase?'升级':'红宝石不足');}
      bind(p+'/Upgrade_Btn','permanent-upgrade',kind);
    });
  } else if(options.panel==='daily'){
    const ready=activities.dailyClaims<7&&(activities.lastDailyDate===null||dailyDate()>activities.lastDailyDate);
    DAILY_REWARDS.forEach((amount,i)=>{
      const p='/DailyCheck_empty/Reward_list/Check_Reward'+(i?` (${i})`:''),claimed=i<activities.dailyClaims,available=ready&&i===activities.dailyClaims;
      set(p+'/Reward/Dia/Value_txt',String(amount));set(p+'/Date_txt',claimed?'已领取':available?'今日领取':`第 ${i+1} 天`);
      show(p+'/Geted_obj',claimed);show(p+'/GetAble_obj',available);
      if(available)bind(p,'claim-daily');else unresolved(p,claimed?'此奖励已领取':'每天只能领取一次，按顺序签到');
    });
    bind('/DailyCheck_empty/Close_Btn','close');show('/DailyCheck_empty/Coupang',false);show('/DailyCheck_empty/Test_obj',false);
  }
  if(options.panel==='shop'){
    const content='/Panel/Scroll View/Viewport/Content';
    const projection=sourceShopProjection({diamonds:session.diamonds,entitlements:meta.entitlements,claims:platform.claims,shopFirstBuy:meta.shopFirstBuy,offerWallBanner:options.platformUI?.offerWallBanner,freeCashBanner:options.platformUI?.freeCashBanner,localProvider:options.purchaseLocalProvider===true||options.qaLocalProvider===true||platform.developerEnabled&&platform.freePurchases,pending:options.purchasePending===true,saveFailedProduct:options.purchaseSaveFailedProduct,notice:options.notice??''});
    Object.assign(text,projection.text);Object.assign(active,projection.active);
    for(const card of SOURCE_SHOP_CARDS){bind(`${content}/${card.group}/${card.name}`,'package-purchase',card.product);bind(`${content}/${card.group}/${card.name}/Purchase_Btn`,'package-purchase',card.product);}
    shopContract.shop.offerings.forEach((offer,i)=>bind(content+'/Dia (List)/Dia_Pack'+(i?` (${i})`:''),'shop-purchase',offer.id));
    bind(content+'/Free Reward/OfferWall_Bannner','offerwall-open','shop');bind(content+'/Free Reward/OfferWall_Bannner/Purchase_Btn','offerwall-open','shop');
    bind(content+'/Free Reward/FreeCash_Banner','freecash-open','shop');
  } else if(options.panel==='missions'||options.panel==='pass'){
    const projection=sourceMissionPanelProjection(options);
    Object.assign(active,projection.active);Object.assign(text,projection.text);Object.assign(fills,projection.fills);
    for(const [p,b] of projection.bindings)bindings.set(p,b);
    for(const [p,url] of projection.sprites)sprites.set(p,url);
  }
  const tree=sprites.size?{...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>sprites.has(n.path)?{...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data,textureURL:sprites.get(n.path)}}:c)}:n)}:sourceUiTree;
  const transforms:Record<string,import('./source-ui').SourceUiTransformOverride>={};
  if(options.panel==='fish')for(let i=0;i<meta.fish.inventory.length;i++){const size=SOURCE_FISH_REAL_SIZES[meta.fish.inventory[i]],p=path('/Fish_Panel/Background/FishTank/Fish_item'+(i?` (${i})`:''));transforms[p]={sizeDelta:[size.width,size.height]};transforms[p+'/Bounce_Start']={sizeDelta:[size.width,size.height]};transforms[p+'/Bounce_Start/Skin_image']={sizeDelta:[size.width,size.height]};}
  const view=createSourceUiView({textures:options.textures,viewport:options.viewport,roots:[rootNode.id,...((options.panel==='missions'||options.panel==='pass')?Object.values(SOURCE_PASS_POPUP_ROOTS):[])],active,text,transforms,tree});
  for(const n of sourceUiTree.nodes){
    if(![rootPath,...((options.panel==='missions'||options.panel==='pass')?Object.values(SOURCE_PASS_POPUP_ROOTS):[])].some(p=>n.path.startsWith(p+'/'))||!n.components.some(c=>c.kind==='Button'&&c.enabled!==false))continue;
    if(!bindings.has(n.path)){
      const excluded=(options.panel==='missions'||options.panel==='pass')?passSlots.excludedButtons.find(b=>b.path===n.path):undefined;
      if(excluded){view.addDiagnostic(`SOURCE_UNREACHABLE_BUTTON:${excluded.reason}:${n.path}`);continue;}
      view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
      bindings.set(n.path,{name:'unresolved',payload:`实现尚未闭合：${n.path}`});
    }
  }
  if(options.panel==='buff')syncSourceBuffPanel(view,meta.buffTimes,meta.entitlements);
  if(options.panel==='missions'||options.panel==='pass'){missionBindings.set(view,bindings);const strip=createLocalTestNotice(view.root);missionNotices.set(view,strip);strip.root.on('pointertap',e=>{e.stopPropagation();action('pass-retry-save');});syncMissionNotice(view,options);}
  let cancelFishAuto:(resetDelay?:boolean)=>void=()=>{};
  for(const [p] of bindings)view.bindAction(p,event=>{const binding=bindings.get(p)!;event.stopPropagation();if(options.platformUI?.pending&&(binding.name==='platform'||binding.name==='platform-confirm'))return;if(options.panel==='fish'&&(binding.name==='close'||binding.name==='fish-auto-set'))cancelFishAuto(true);if(options.panel==='permanent'&&binding.name==='rebirth')action('close');action(binding.name,binding.payload);});
  if(options.panel==='fish'){
    const fishPath=(i:number)=>path('/Fish_Panel/Background/FishTank/Fish_item'+(i?` (${i})`:''));
    const fishNodes=Array.from({length:meta.fish.inventory.length},(_,i)=>view.get(fishPath(i)));
    let motionSeed=0xf151; // Presentation-only local provider, independent of wallet/draw RNG.
    const random=sourceFishMotionRandom(()=>{motionSeed=(Math.imul(motionSeed,1664525)+1013904223)>>>0;return motionSeed/0x100000000;});
    const motions:SourceFishMotion[]=[],sizes=meta.fish.inventory.map(g=>({...SOURCE_FISH_REAL_SIZES[g],scaleX:1,scaleY:1}));
    const drawFish=(index:number)=>{const node=fishNodes[index],state=motions[index];if(!node||!state||state.dragging)return;node.position.set(state.position.x,-state.position.y);const skin=view.get(fishPath(index)+'/Bounce_Start/Skin_image');if(skin)skin.scale.x=Math.abs(skin.scale.x)*(sourceFishFacesRight(state)?1:-1);};
    fishNodes.forEach((node,index)=>{if(!node)return;const state=sourceInitFishMotion(random);state.position=sourceFindFishSpawnPosition(SOURCE_FISH_TANK_SIZE,sizes[index],motions.map(m=>m.position),random);motions[index]=state;drawFish(index);});
    let delay=fishAutoDelays.get(action);if(!delay){delay=createSourceFishAutoDelay();fishAutoDelays.set(action,delay);}
    const scheduler=createSourceFishAutoMergeScheduler(delay);let destroyed=false;
    const releasePair=(pair?:{stationary:number;mover:number})=>{if(pair)for(const index of [pair.stationary,pair.mover])if(motions[index])motions[index]={...motions[index],autoMerging:false};};
    cancelFishAuto=resetDelay=>{releasePair(scheduler.cancel(resetDelay));};
    const pool=():SourceFishAutoMergeCandidate[]=>motions.map((state,index)=>({inventoryIndex:index,grade:meta.fish.inventory[index],active:state.active&&!!fishNodes[index]?.worldVisible,dragging:state.dragging,autoMerging:state.autoMerging,pendingDelete:false,currentAlertTarget:false}));
    const baseUpdate=view.update.bind(view);view.update=dt=>{
      if(destroyed)return;baseUpdate(dt);
      const step=scheduler.tick({fish:meta.fish,plusPack2Active:meta.entitlements.plusPack2Active,pool:pool(),positions:motions.map(m=>m.position),deltaSec:dt,enabled:session.mode==='field'&&view.root.worldVisible});
      releasePair(step.releasedPair);
      if(step.pair){for(const index of [step.pair.stationary,step.pair.mover])motions[index]={...motions[index],autoMerging:true};if(step.position){const index=step.pair.mover,state=motions[index],target=motions[step.pair.stationary].position;motions[index]={...state,position:step.position,direction:{...state.direction,x:target.x>=step.position.x?1:-1}};}}
      motions.forEach((state,index)=>{motions[index]=sourceTickFishMotion(state,dt,SOURCE_FISH_TANK_SIZE,sizes[index],random);drawFish(index);});
      // Dispatch last: the caller can atomically commit then synchronously destroy/rebuild this view.
      if(step.commit){releasePair(step.commit.pair);action('fish-auto-fuse',step.commit);}
    };
    const baseDestroy=view.destroy.bind(view);view.destroy=()=>{if(destroyed)return;destroyed=true;cancelFishAuto();baseDestroy();};
    let dragging:{index:number;pointerId:number;x:number;y:number;ox:number;oy:number}|null=null;
    const restore=()=>{if(dragging){const index=dragging.index;motions[index]={...motions[index],dragging:false};drawFish(index);}dragging=null;};
    fishNodes.forEach((node,index)=>{if(!node)return;node.eventMode='static';node.cursor='grab';
      node.on('pointerdown',event=>{if(dragging||destroyed||motions[index].autoMerging)return;event.stopPropagation();motions[index]={...motions[index],dragging:true};dragging={index,pointerId:event.pointerId,x:event.global.x,y:event.global.y,ox:node.x,oy:node.y};});
      node.on('globalpointermove',event=>{if(!dragging||dragging.index!==index||dragging.pointerId!==event.pointerId)return;const parent=node.parent;const start=parent.toLocal({x:dragging.x,y:dragging.y}),now=parent.toLocal(event.global);node.position.set(dragging.ox+now.x-start.x,dragging.oy+now.y-start.y);});
      node.on('pointerup',event=>{if(!dragging||dragging.index!==index||dragging.pointerId!==event.pointerId)return;event.stopPropagation();const target=fishNodes.findIndex((n,i)=>i!==index&&!motions[i].autoMerging&&!!n?.getBounds().contains(event.global.x,event.global.y));restore();if(target>=0)action('fish-fusion',{a:index,b:target});});
      node.on('pointerupoutside',restore);node.on('pointercancel',restore);
    });
  }
  for(const [p,fraction] of Object.entries(fills))view.setFill(p,fraction);
  return view;
}

/** Pure live projection; claim checks still belong to the transactional host. */
export function sourceMissionPanelProjection(options:SourcePanelOptions) {
  const {session,activities,platform}=options,meta=options.meta??freshSourceMetaState();
  const rootPath=SOURCE_PANEL_ROOTS.pass;
  const active:Record<string,boolean>={},text:Record<string,string>={},fills:Record<string,number>={};
  const bindings=new Map<string,{name:string;payload?:any}>(),sprites=new Map<string,string>();
  const path=(relative:string)=>rootPath+relative;
  const set=(relative:string,value:string)=>{if(byPath.has(path(relative)))text[path(relative)]=value;};
  const show=(relative:string,value:boolean)=>{if(byPath.has(path(relative)))active[path(relative)]=value;};
  const bind=(relative:string,name:string,payload?:any)=>{if(byPath.has(path(relative)))bindings.set(path(relative),{name,payload});};
  const unresolved=(relative:string,message:string)=>bind(relative,'unresolved',message);
  const labels=(relative:string,value:string)=>{for(const n of sourceUiTree.nodes)if(n.path.startsWith(path(relative)+'/')&&n.components.some(c=>c.kind==='TextMeshProUGUI')&&!n.path.includes('/Price'))text[n.path]=value;};
    const pass=sourceMetaPassView({session,activities,platform,meta});
    // Both views use the original combined pass/mission panel and its real scroll areas.
    set('/I2_txt(Outline)','成长通行证');set('/Reward/EXP_Slider/Lv_txt',`Lv.${pass.level+1}`);
    set('/Reward/EXP_Slider/Exp_txt',`${pass.exp} / 100`);fills[path('/Reward/EXP_Slider/Fill')]=Math.min(1,pass.exp/100);
    set('/Mission_Panel/I2_txt(Outline)','成长任务');set('/Mission_Panel/Mission_Cooltime_txt',`任务日期 ${meta.passLifecycle?.missionStart?.slice(0,10)??'待初始化'} · 本地日期适配`);
    set('/Reward/Season_EndDate_txt',`第${pass.seasonNumber+1}季 · ${pass.seasonEnd?.slice(0,10)??'待初始化'}结束 · 本地日期`);
    show('/Reward/NewSeason_Btn',sourcePassAllRewards({session,activities,platform,meta}));bind('/Reward/NewSeason_Btn','pass-popup-open','next');show('/Test_obj',false);
    set('/Reward/Pass_Purchase_Btn/I2_txt(Outline)',meta.luxury?'豪华已开通':meta.vip?'升级豪华':'VIP 通行证');
    bind('/Reward/Pass_Purchase_Btn','pass-popup-open',meta.vip?'luxury':'vip');
    ACTIVITY_MISSIONS.forEach((mission,i)=>{
      const p='/Mission_Panel/Scroll View/Viewport/Content/Mission_Item'+(i?` (${i})`:''),count=activities.counters[mission.counter as ActivityCounter];
      const claimed=mission.requiresVip?meta.vipMissionClaims.includes(mission.id):activities.missionClaims.includes(mission.id);
      const locked=mission.requiresVip&&!meta.vip,complete=count>=mission.goal,ready=complete&&!claimed&&!locked;
      const luxury=claimed&&meta.luxury&&!meta.luxuryMissionClaims.includes(mission.id);
      set(p+'/Name_txt',mission.label);set(p+'/Explain_txt',`${mission.label} ${mission.goal}${mission.requiresVip?' · VIP':''}`);set(p+'/Exp/Exp_txt',String(mission.reward.amount));
      set(p+'/Slider/Value_txt',`${Math.min(count,mission.goal)}/${mission.goal}`);fills[path(p+'/Slider/Fill')]=Math.min(1,count/mission.goal);
      show(p+'/VIP_Panel',mission.requiresVip);show(p+'/Star (VIP)',mission.requiresVip);show(p+'/Star (VIP)/Text (TMP)',mission.requiresVip);show(p+'/Luxury_Panel',meta.luxury);
      show(p+'/NonClear_obj',!complete&&!claimed);show(p+'/GetAble_obj',complete&&!claimed);show(p+'/Get_obj',claimed&&!luxury);show(p+'/LuxuryBonus_obj',luxury);
      show(p+'/GetAble_obj/Reward_Get_Btn/VIPLocked_obj',locked);show(p+'/LuxuryBonus_obj/Reward_Get_Btn/LuxuryLocked_obj',false);
      labels(p+'/NonClear_obj/Reward_Get_Btn','进行中');labels(p+'/GetAble_obj/Reward_Get_Btn',locked?'VIP 未开通':ready?'领取':'已领取');labels(p+'/LuxuryBonus_obj/Reward_Get_Btn','豪华追加');
      bind(p+'/NonClear_obj/Reward_Get_Btn','mission-claim',{id:mission.id});bind(p+'/GetAble_obj/Reward_Get_Btn','mission-claim',{id:mission.id});bind(p+'/LuxuryBonus_obj/Reward_Get_Btn','mission-claim',{id:mission.id,luxury:true});
    });
    const reasons:Record<string,string>={'vip-required':'VIP 未开通','already-claimed':'已领取','level-required':'等级不足','previous-reward-required':'先领取前面的奖励','ad-unconfirmed':'广告暂不可用'};
    for(const sourceSlot of passSlots.slots){
      const index=sourceSlot.index,slot=sourceSlot.path.slice(rootPath.length);
      set(slot+'/Slot/Lv_txt',String(sourceSlot.displayLevel));show(slot+'/Slot/Locked_obj',pass.level<=index);show(slot+'/Fill',pass.level>index);
      for(const track of [0,1] as const){
        const reward=(track===0?pass.normalRewards:pass.epicRewards)[index],p=slot+(track===0?'/Mission_Reward_Normal':'/Mission_Reward_Epic');
        if(!reward){show(p,false);continue;}
        const claimed=(track===0?pass.normalClaims:pass.epicClaims)[index];
        const gate=sourcePassClaimGate(pass,track,index,{adConfirmed:true,adRemoved:sourceRewardAdsRemoved(meta.entitlements)});
        const levelLocked=pass.level<=index,vipLocked=track===1&&!meta.vip,sequenceLocked=!claimed&&!levelLocked&&!vipLocked&&gate.status!=='supported'&&gate.reason==='previous-reward-required';
        show(p,true);show(p+'/Dia',reward.kind==='diamonds');show(p+'/Core',reward.kind==='core');set(p+'/Core/Core_Value',String(reward.amount));show(p+'/Gun',reward.kind==='gunUnlock');set(p+'/Dia/Dia_Value',String(reward.amount));
        show(p+'/Get_obj',claimed);show(p+'/GetAble_obj',!claimed&&gate.status==='supported');show(p+'/NonClear_obj',levelLocked);show(p+'/Locked_obj',vipLocked);show(p+'/SequenceLocked_obj',sequenceLocked);show(p+'/SequenceLocked_obj2',sequenceLocked);
        show(p+'/AD_Icon',reward.requiresAd&&!claimed&&!sourceRewardAdsRemoved(meta.entitlements));
        if(reward.kind==='gunUnlock'){
          const gun=guns.guns.find(g=>g.sourceID===reward.amount);if(gun)sprites.set(path(p+'/Gun/Gun/Gun_img'),gun.spriteURL);
          const title=claimed?'已领取':gate.status==='supported'?`武器 #${reward.amount+1}`:reasons[gate.reason]??'未解锁';set(p+'/Gun/Type_txt',title);
          const grades=['D','C','B','A','S','SS','SSS','X','XX','XXX','Z','ZZ','ZZZ'];const degree=Math.min(grades.length-1,Math.floor(reward.amount/5));
          grades.forEach((grade,i)=>show(p+'/Gun/Degree (2)/'+grade,i===degree));
        }
        bind(p,'pass-claim',{track,index});
      }
    }
  const popup=sourcePassPopupProjection(sourceUiTree,{session,activities,platform,meta},options.passPopup??'none',options.passPending);
  Object.assign(active,popup.active);Object.assign(text,popup.text);for(const [p,v]of popup.bindings)bindings.set(p,v);for(const[p,v]of popup.sprites)sprites.set(p,v);
  active[rootPath]=(options.passPopup??'none')==='none';
  return {active,text,fills,bindings,sprites};
}
const missionNotices=new WeakMap<SourceUiView,ReturnType<typeof createLocalTestNotice>>();
function syncMissionNotice(view:SourceUiView,options:SourcePanelOptions){const strip=missionNotices.get(view);if(!strip)return;strip.text.text='H5本地日期 · 本地测试provider，线上未连接'+(options.notice?'\n'+options.notice:'')+(options.passSaveFailed?'\n点击此处重试保存（不重复请求provider）':'');strip.root.eventMode=options.passSaveFailed?'static':'none';strip.root.cursor=options.passSaveFailed?'pointer':'default';strip.place(options.viewport);strip.root.y=24*Math.min(options.viewport.width/390,options.viewport.height/844);}
const missionBindings=new WeakMap<SourceUiView,Map<string,{name:string;payload?:any}>>();
/** Updates the same panel, ScrollRects and handlers; no destroy/recreate on a claim. */
export function syncSourceMissionPanel(view:SourceUiView,options:SourcePanelOptions):boolean {
  const bindings=missionBindings.get(view);if(!bindings)return false;
  const projection=sourceMissionPanelProjection(options);
  for(const [path,binding] of projection.bindings)bindings.set(path,binding);
  view.patch({active:projection.active,text:projection.text,fills:projection.fills});
  for(const [path,url]of projection.sprites)view.setTextureURL(path,url);
  syncMissionNotice(view,options);
  return true;
}
