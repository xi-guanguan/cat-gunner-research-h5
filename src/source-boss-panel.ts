/** Original Boss Start/Win/Fail/Sweep layouts. The host owns battle transactions, ads and saving. */
import type {Texture} from 'pixi.js';
import {sourceEntryPlusVisible,sourceEntryPlusPurchaseProjection,type SourceEntryPlusPurchaseUI} from './r6-entry-plus';
import {BigValue} from './big-value';
import {sourceChallengeRewardBanner} from './r6-challenge';
import {contentGate} from './meta-progression';
import {sourceBossHealth,sourceBossTimeMax,sourceBossReward,sourceBossSweepAble,sourceBossSweepEfficiency,type SourceBossState,type SourceBossEntitlements} from './r5-boss';
import {createSourceUiView,type SourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import bossTree from '../artifacts/evidence/round5-20261001/meta-boss-panel-source-tree.json';
/** The shared projection currently contains Start only. This bounded tree retains all four source roots. */
export const sourceBossPanelTree=bossTree as unknown as SourceUiTree;
/** Preload with the shared source UI URLs before creating any of the four panels. */
export const sourceBossPanelAssetURLs=[...new Set(sourceBossPanelTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??sourceBossPanelTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v)))];
export const SOURCE_BOSS_PANEL_ROOTS={start:'/Canvas/Contents_UI/Boss_UI/Boss_Start_UI',win:'/Canvas/Contents_UI/Boss_UI/GameWin_obj',fail:'/Canvas/Contents_UI/Boss_UI/GameFail_obj',sweep:'/Canvas/Contents_UI/Boss_UI/GameSweep_obj'} as const;
export interface SourceBossPanelStateOptions {
  boss:SourceBossState;realPower:BigValue;historicMax:number;
  entitlements:SourceBossEntitlements&{plusPack2Active:boolean};notice?:string;pending?:boolean;
  plusPurchase?:SourceEntryPlusPurchaseUI;
  bonusPending?:boolean;bonusSaveFailed?:boolean;removeAdsAll?:boolean;freeCashBanner?:{featureEnabled:boolean;exposureTarget:boolean};purchasePending?:boolean;purchaseSaveFailed?:boolean;localProvider?:boolean;
}
export interface SourceBossPanelOptions extends SourceBossPanelStateOptions {
  textures:Record<string,Texture>;viewport:SourceUiViewport;
  action:(name:'close'|'start-boss'|'boss-sweep'|'boss-bonus'|'exit-boss'|'result-remove-ads'|'freecash-open'|'boss-plus-purchase',place?:string)=>void;
}
export interface SourceBossPanelProjection {
  kind:keyof typeof SOURCE_BOSS_PANEL_ROOTS;rootPath:string;active:Record<string,boolean>;text:Record<string,string>;fills:Record<string,number>;
  bindings:{path:string;action:Parameters<SourceBossPanelOptions['action']>[0];enabled:boolean}[];
  limitations:string[];
}
const byPath=new Map(sourceBossPanelTree.nodes.map(n=>[n.path,n]));
const byId=new Map(sourceBossPanelTree.nodes.map(n=>[n.id,n]));
/** Pure UI contract. No grant, sweep, ad confirmation, clock tick, or battle mutation occurs here. */
export function sourceBossPanelProjection(options:SourceBossPanelStateOptions):SourceBossPanelProjection|null {
  const {boss,realPower,entitlements:e,pending=false}=options,run=boss.run;
  if(run?.phase==='playing')return null;
  const kind:SourceBossPanelProjection['kind']=run?.phase==='failed'?'fail':run?.phase==='won'?(run.mode==='sweep'?'sweep':'win'):'start';
  const rootPath=SOURCE_BOSS_PANEL_ROOTS[kind],root=byPath.get(rootPath);
  if(!root)throw new Error(`Missing original Boss panel ${rootPath}`);
  const active:Record<string,boolean>={},text:Record<string,string>={},fills:Record<string,number>={},bindings:SourceBossPanelProjection['bindings']=[];
  const path=(p:string)=>rootPath+p;
  const set=(p:string,value:string)=>{if(!byPath.has(path(p)))throw new Error(`Missing source Boss text ${path(p)}`);text[path(p)]=value;};
  const show=(p:string,value:boolean)=>{if(byPath.has(path(p)))active[path(p)]=value;};
  const bind=(p:string,action:SourceBossPanelProjection['bindings'][number]['action'],enabled=true)=>{if(!byPath.has(path(p)))throw new Error(`Missing source Boss action ${path(p)}`);bindings.push({path:path(p),action,enabled:enabled&&!pending});};
  for(let n:typeof root|undefined=root;n;n=n.parent?byId.get(n.parent):undefined)active[n.id]=true;
  for(const p of Object.values(SOURCE_BOSS_PANEL_ROOTS))active[p]=p===rootPath;
  show('/Panel',true);
  if(kind==='start'){
    const gate=contentGate(options.historicMax,'boss'),auto=e.plusPack2Active,able=sourceBossSweepAble(boss.stage,realPower,e);
    set('/Panel/Stage_txt',`Lv.${boss.stage+1}`);set('/Panel/HP_Slider/HP_txt',sourceBossHealth(boss.stage).format());fills[path('/Panel/HP_Slider')]=1;
    set('/Panel/Explain/I2_txt',options.notice||(gate.unlocked?`在 ${sourceBossTimeMax(e)} 秒内击败首领！\n金币攻击、攻速升级不生效。`:'普通第 10 大关开放'));
    set('/Panel/Reward/Dia/Reward_txt',String(sourceBossReward(e)));set('/Panel/Reward/I2_txt(Outline) (2)','奖励');
    // Source Power_My is inactive; no native activation/layout consumer is established.
    // Preserve its source state instead of forcing it over the challenge/sweep buttons.
    show('/Panel/NonAuto_obj',!auto);show('/Panel/Auto_obj',auto);
    for(const branch of ['/Panel/NonAuto_obj','/Panel/Auto_obj']){set(branch+'/Enter_Btn/I2_txt(Outline) (2)',pending?'处理中…':'挑战');bind(branch+'/Enter_Btn','start-boss',gate.unlocked);}
    show('/Panel/Auto_obj/Sweep_Btn/Active_obj',able);show('/Panel/Auto_obj/Sweep_Btn/NonActive_obj',!able);
    set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Value_txt',`${sourceBossSweepEfficiency(boss.stage,realPower,e)}%`);
    set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/I2_txt','战斗力不足');set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/I2_txt(Outline) (2)','首领扫荡');
    set('/Panel/Auto_obj/Sweep_Btn/Active_obj/I2_txt','立即完成！');set('/Panel/Auto_obj/Sweep_Btn/Active_obj/I2_txt(Outline) (2)','首领扫荡');
    bind('/Panel/Auto_obj/Sweep_Btn','boss-sweep',auto&&able&&gate.unlocked);
    bind('/Background','close');bind('/Panel/Close_Btn','close');
    // Ranking remains unconnected; Plus uses its own source type0, not sweep's type2.
    show('/Panel/Rank_Panel',false);
    const plusVisible=sourceEntryPlusVisible('boss',options.historicMax,e),plus=sourceEntryPlusPurchaseProjection('boss',options.plusPurchase);
    show('/Banner_PlusPack',plusVisible);show('/Banner_PlusPack/Plus_Time/Active_Panel',false);show('/Banner_PlusPack/Plus_Time/NonPurchase_Panel',true);
    set('/Banner_PlusPack/Plus_Time/NonPurchase_Panel/Price_txt',plus.price);
    // Chinese H5 translation of the serialized Korean labels; original Value_txxt remains untouched.
    set('/Banner_PlusPack/Plus_Time/Name_txt','时间套餐（7天）');
    set('/Banner_PlusPack/Plus_Time/Explain/I2_txt(Outline) (1)','关卡时间上限');
    set('/Banner_PlusPack/Plus_Time/Explain/I2_txt(Outline) (3)','首领时间上限');
    set('/Banner_PlusPack/Plus_Time/Explain/I2_txt(Outline) (2)','矿场时间上限');
    bind('/Banner_PlusPack/Plus_Time','boss-plus-purchase',plusVisible&&plus.enabled);
  } else {
    const won=run?.phase==='won',base=won?run.rewardThisRun:0,total=base*3;
    set('/Panel/Top/I2_txt(Outline)',won?'胜利':'挑战失败');set('/Panel/Reward/I2_txt(Outline)','奖励');
    set('/Panel/Reward/Dia/Reward_txt',String(won?total:0));
    const banner=sourceChallengeRewardBanner(options.removeAdsAll??false,options.freeCashBanner);
    show('/Remove Ads ALL (Inapp)',banner.purchase||banner.freeCash);
    show('/Remove Ads ALL (Inapp)/Remove_AD_All',banner.purchase);
    show('/Remove Ads ALL (Inapp)/FreeCash_Banner',banner.freeCash);
    show('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchased_obj',options.removeAdsAll??false);
    set('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn/Price_txt',options.purchaseSaveFailed?'重试保存':options.purchasePending?'本地处理中…':options.localProvider?'本地测试购买':'服务未连接');
    set('/Remove Ads ALL (Inapp)/FreeCash_Banner/Purchase_Btn/I2_txt(Outline)','查看服务状态');
    // Serialized Button lives on the parent; child is its original visual hit region.
    bind('/Remove Ads ALL (Inapp)/Remove_AD_All','result-remove-ads',!options.purchasePending||options.purchaseSaveFailed===true);
    bind('/Remove Ads ALL (Inapp)/FreeCash_Banner','freecash-open');
    if(kind==='fail'){
      set('/Panel/Exit/Exit_Btn/I2_txt(Outline)','确定');bind('/Panel/Exit/Exit_Btn','exit-boss');
    }else{
      const canBonus=!!run&&!run.automaticBonus&&!run.bonusClaimed;
      show('/Panel/Bonus_Objs',canBonus);show('/Panel/Bonus_Objs/Bonus_Btn',canBonus);show('/Panel/Bonus_Objs/NoAds_Btn',false);show('/Skip_obj',true);
      set('/Panel/Bonus_Objs/Bonus_Btn/I2_txt(Outline)',options.bonusSaveFailed?'重试保存':options.bonusPending?'本地处理中…':pending?'处理中…':'领取');set('/Panel/Bonus_Objs/Bonus_Btn/Text (TMP)','x3');
      set('/Skip_obj/Exit_Btn/Dia/Reward_txt',String(run?.automaticBonus?total:base));set('/Skip_obj/Exit_Btn/NoThanks',run?.automaticBonus?'确定':'直接领取');
      bind('/Panel/Bonus_Objs/Bonus_Btn','boss-bonus',canBonus&&(!options.bonusPending||options.bonusSaveFailed===true));bind('/Skip_obj/Exit_Btn','exit-boss');
    }
  }
  return {kind,rootPath,active,text,fills,bindings,limitations:['Power_My preserves source inactive state; its original activation/layout consumer remains unverified.','Source Mask/RectMask2D component geometry is retained; source-ui uses rectangular clipping and does not reproduce alpha silhouettes/softness.','Original Animator/Rank remain unverified; Plus and reward providers are owned by the host. Real services are not connected.','Result shows total3x and the already granted base1x; boss-bonus requests additional2x through the host. This view never grants diamonds.']};
}
export function createSourceBossPanel(options:SourceBossPanelOptions):SourceUiView|null {
  const projection=sourceBossPanelProjection(options);if(!projection)return null;
  const view=createSourceUiView({tree:sourceBossPanelTree,textures:options.textures,viewport:options.viewport,roots:[projection.rootPath],active:projection.active,text:projection.text});
  for(const binding of projection.bindings)if(binding.enabled)view.bindAction(binding.path,event=>{event.stopPropagation();options.action(binding.action,binding.action==='freecash-open'?'banner_reward':undefined);});
  for(const [path,value]of Object.entries(projection.fills))view.setFill(path,value);
  view.addDiagnostic(...projection.limitations);
  return view;
}
