/** Original Monster_UI start/end/sweep panels. Host owns all Hunt transactions and providers. */
import type {Texture} from 'pixi.js';
import {sourceChallengeRewardBanner} from './r6-challenge';
import {sourceEntryPlusVisible,sourceEntryPlusPurchaseProjection,type SourceEntryPlusPurchaseUI} from './r6-entry-plus';
import {BigValue} from './big-value';
import {sourceHuntEntryUnlocked,sourceHuntReward,sourceHuntSweepAble,sourceHuntSweepEfficiency,sourceHuntSweepTarget,type SourceHuntState,type SourceHuntEntitlements} from './r5-hunt';
import {createSourceUiView,type SourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import treeData from './data/source-hunt-panel.json';
export const sourceHuntPanelTree=treeData as unknown as SourceUiTree;
export const sourceHuntPanelAssetURLs=[...new Set(sourceHuntPanelTree.nodes.flatMap(n=>n.components.map(c=>c.data?.textureURL??sourceHuntPanelTree.sprites[c.data?.spriteKey]?.url).filter((v):v is string=>!!v)))];
/** GameEnd_obj has a source trailing space; it is part of the original identity. */
export const SOURCE_HUNT_PANEL_ROOTS={start:'/Canvas/Contents_UI/Monster_UI/Monster_Start_UI',end:'/Canvas/Contents_UI/Monster_UI/GameEnd_obj ',sweep:'/Canvas/Contents_UI/Monster_UI/GameSweep_obj'} as const;
export const SOURCE_HUNT_ENTRY_BLOCK_REASON='hunt-source-combat-consumer-unconnected';
export const SOURCE_HUNT_ENTRY_NOTICE='狩猎战斗尚未接通；满足条件时可使用扫荡。';
export type SourceHuntPanelAction='hunt-enter'|'hunt-sweep'|'hunt-bonus'|'hunt-exit'|'result-remove-ads'|'freecash-open'|'hunt-plus-purchase';
export interface SourceHuntPanelActionContext {blockedReason?:string;notice?:string}
export interface SourceHuntPanelStateOptions {
  hunt:SourceHuntState;teamPower:BigValue;maxDisplayStage:number;entitlements:SourceHuntEntitlements;
  historicMax?:number;plusPurchase?:SourceEntryPlusPurchaseUI;notice?:string;pending?:boolean;purchasePending?:boolean;purchaseSaveFailed?:boolean;removeAdsAll?:boolean;localProvider?:boolean;freeCashBanner?:{featureEnabled:boolean;exposureTarget:boolean};/** True only after host wires the real source combat chain. */entryAvailable?:boolean;
}
export interface SourceHuntPanelOptions extends SourceHuntPanelStateOptions {
  textures:Record<string,Texture>;viewport:SourceUiViewport;
  action:(name:SourceHuntPanelAction,context?:SourceHuntPanelActionContext)=>void;
}
export interface SourceHuntPanelProjection {
  kind:keyof typeof SOURCE_HUNT_PANEL_ROOTS;rootPath:string;active:Record<string,boolean>;text:Record<string,string>;fills:Record<string,number>;
  bindings:{path:string;action:SourceHuntPanelAction;enabled:boolean;context?:SourceHuntPanelActionContext}[];limitations:string[];
}
const byPath=new Map(sourceHuntPanelTree.nodes.map(n=>[n.path,n]));
const byId=new Map(sourceHuntPanelTree.nodes.map(n=>[n.id,n]));
/** Pure layout projection. No coins, saves, ad confirmations, or battle state change here. */
export function sourceHuntPanelProjection(options:SourceHuntPanelStateOptions):SourceHuntPanelProjection|null {
  const {hunt,teamPower,entitlements:e,pending=false}=options,run=hunt.run;
  if(run?.phase==='playing')return null;
  const kind:SourceHuntPanelProjection['kind']=run?.phase==='ended'?(run.mode==='sweep'?'sweep':'end'):'start';
  const rootPath=SOURCE_HUNT_PANEL_ROOTS[kind],root=byPath.get(rootPath);
  if(!root)throw new Error(`Missing original Hunt panel ${rootPath}`);
  const active:Record<string,boolean>={},text:Record<string,string>={},fills:Record<string,number>={},bindings:SourceHuntPanelProjection['bindings']=[];
  const path=(p:string)=>rootPath+p;
  const set=(p:string,value:string)=>{if(!byPath.has(path(p)))throw new Error(`Missing Hunt text ${path(p)}`);text[path(p)]=value;};
  const show=(p:string,value:boolean)=>{if(!byPath.has(path(p)))throw new Error(`Missing Hunt node ${path(p)}`);active[path(p)]=value;};
  const bind=(p:string,action:SourceHuntPanelAction,enabled=true,context?:SourceHuntPanelActionContext)=>{if(!byPath.has(path(p)))throw new Error(`Missing Hunt action ${path(p)}`);bindings.push({path:path(p),action,enabled:enabled&&(!pending||action==='hunt-exit')&&(!options.purchasePending||action==='hunt-exit'||action==='result-remove-ads'&&options.purchaseSaveFailed===true),...(context?{context}:{})});};
  for(let n:typeof root|undefined=root;n;n=n.parent?byId.get(n.parent):undefined)active[n.id]=true;
  for(const p of Object.values(SOURCE_HUNT_PANEL_ROOTS))active[p]=p===rootPath;
  show('/Panel',true);
  if(kind==='start'){
    const unlocked=sourceHuntEntryUnlocked(options.maxDisplayStage),auto=e.plusPack2Active,able=sourceHuntSweepAble(hunt,teamPower,e);
    const efficiency=sourceHuntSweepEfficiency(hunt.wave,hunt.level,teamPower);
    const target=able?sourceHuntSweepTarget(hunt.wave,hunt.level,teamPower):hunt;
    set('/Panel/Wave_txt',`Wave ${hunt.wave+1}-${hunt.level+1}`);
    set('/Panel/Explain/I2_txt',options.notice||(!unlocked?'普通第 12 大关开放':options.entryAvailable?'击败涌来的史莱姆，获得宠物币！':SOURCE_HUNT_ENTRY_NOTICE));
    set('/Panel/Explain/I2_txt (1)','金币攻击、攻速升级不生效。');
    set('/Panel/Reward/Dia/Reward_txt',String(sourceHuntReward(e)));set('/Panel/Reward/I2_txt(Outline) (2)','每级奖励');
    // No Monster_Start_UI field/native consumer activates Power_My. Preserve its source inactive state.
    show('/Panel/NonAuto_obj',!auto);show('/Panel/Auto_obj',auto);
    const entryContext=options.entryAvailable?undefined:{blockedReason:SOURCE_HUNT_ENTRY_BLOCK_REASON,notice:SOURCE_HUNT_ENTRY_NOTICE};
    for(const p of ['/Panel/NonAuto_obj/Enter_Btn','/Panel/Auto_obj/Enter_Btn (1)']){
      set(p+'/I2_txt(Outline) (2)',pending?'处理中…':'挑战');bind(p,'hunt-enter',unlocked,entryContext);
    }
    show('/Panel/Auto_obj/Sweep_Btn/NonActive_obj',!able);show('/Panel/Auto_obj/Sweep_Btn/Active_obj',able);
    set('/Panel/Auto_obj/Sweep_Btn/Stage_txt',`${target.wave+1}-${target.level+1}`);
    set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Value_txt',`${efficiency}%`);
    set('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/I2_txt','战斗力不足');set('/Panel/Auto_obj/Sweep_Btn/Active_obj/I2_txt','立即完成！');
    fills[path('/Panel/Auto_obj/Sweep_Btn/NonActive_obj/Fill')]=able?1:efficiency/100;
    bind('/Panel/Auto_obj/Sweep_Btn','hunt-sweep',auto&&able&&unlocked);
    bind('/Background','hunt-exit');bind('/Panel/Close_Btn','hunt-exit');
    show('/Panel/Rank_Panel',false);
    const plusVisible=sourceEntryPlusVisible('hunt',options.historicMax??0,{plusPack0Active:false,plusPack2Active:e.plusPack2Active}),plus=sourceEntryPlusPurchaseProjection('hunt',options.plusPurchase);
    show('/Banner_PlusPack',plusVisible);show('/Banner_PlusPack/Plus_Auto/Active_Panel',false);show('/Banner_PlusPack/Plus_Auto/NonPurchase_Panel',true);
    set('/Banner_PlusPack/Plus_Auto/NonPurchase_Panel/Price_txt',plus.price);
    // Chinese H5 translation of serialized labels, not a newly invented entitlement.
    set('/Banner_PlusPack/Plus_Auto/Name_txt','便利套餐（7天）');
    set('/Banner_PlusPack/Plus_Auto/Explain/I2_txt(Outline) (1)','副本扫荡不限次数');
    set('/Banner_PlusPack/Plus_Auto/Explain/I2_txt(Outline) (3)','探索缩短16小时');
    set('/Banner_PlusPack/Plus_Auto/Explain/I2_txt(Outline) (2)','自动合成');
    bind('/Banner_PlusPack/Plus_Auto','hunt-plus-purchase',plusVisible&&plus.enabled);
  }else{
    const base=run!.accumulatedPetCoin,auto=run!.automaticBonus,canBonus=!auto&&!run!.bonusClaimed;
    set('/Panel/Top/I2_txt(Outline)',kind==='sweep'?'扫荡完成':'狩猎结束');set('/Panel/Reward/I2_txt(Outline)','奖励');
    set('/Panel/Reward/PetCoin/Reward_txt',String(base*2));set('/Skip_obj/Exit_Btn/PetCoin/Reward_txt',String(base));
    show('/Panel/Bonus_Objs',true);show('/Panel/Bonus_Objs/Bonus_Btn',canBonus);show('/Panel/Bonus_Objs/NoAds_Btn',auto);show('/Skip_obj',!auto);
    set('/Panel/Bonus_Objs/Bonus_Btn/I2_txt(Outline)',pending?'处理中…':'领取');set('/Panel/Bonus_Objs/Bonus_Btn/Text (TMP)','x2');
    set('/Panel/Bonus_Objs/NoAds_Btn/I2_txt(Outline)','确定');set('/Skip_obj/Exit_Btn/NoThanks','直接领取');
    bind('/Panel/Bonus_Objs/Bonus_Btn','hunt-bonus',canBonus);bind('/Panel/Bonus_Objs/NoAds_Btn','hunt-exit',auto);bind('/Skip_obj/Exit_Btn','hunt-exit',!auto);
    const banner=sourceChallengeRewardBanner(options.removeAdsAll??false,options.freeCashBanner);
    show('/Remove Ads ALL (Inapp)',banner.purchase||banner.freeCash);
    show('/Remove Ads ALL (Inapp)/Remove_AD_All',banner.purchase);
    show('/Remove Ads ALL (Inapp)/FreeCash_Banner',banner.freeCash);
    set('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn/Price_txt',options.purchaseSaveFailed?'重试保存':options.purchasePending?'本地处理中…':options.localProvider?'本地测试购买':'服务未连接');
    set('/Remove Ads ALL (Inapp)/FreeCash_Banner/Purchase_Btn/I2_txt(Outline)','查看服务状态');
    bind('/Remove Ads ALL (Inapp)/Remove_AD_All','result-remove-ads');bind('/Remove Ads ALL (Inapp)/Remove_AD_All/Purchase_Btn','result-remove-ads');
    bind('/Remove Ads ALL (Inapp)/FreeCash_Banner','freecash-open');bind('/Remove Ads ALL (Inapp)/FreeCash_Banner/Purchase_Btn','freecash-open');
  }
  return {kind,rootPath,active,text,fills,bindings,limitations:[
    'Hunt entry requires the real Game_Enter → Enter_Cor → Game_Start → StartNextLevel → level spawn/invasion host consumer; run creation alone is insufficient.',
    'Power_My stays source inactive; Monster_img retains the original static sprite pending SkinSprite_return(1) rotation mapping.',
    'Rank and Animator presentation remain unverified; Plus banner uses source type2; rewards and purchases use host-owned explicit local providers.',
    'Source-ui retains source rectangles/masks, with approximate TMP/SDF rendering and rectangular clipping.',
    'Result projects accumulated base1x and total2x. Host already granted base (or auto2x); bonus requests only additional1x.'
  ]};
}
export function createSourceHuntPanel(options:SourceHuntPanelOptions):SourceUiView|null {
  const p=sourceHuntPanelProjection(options);if(!p)return null;
  const view=createSourceUiView({tree:sourceHuntPanelTree,textures:options.textures,viewport:options.viewport,roots:[p.rootPath],active:p.active,text:p.text});
  for(const b of p.bindings)if(b.enabled)view.bindAction(b.path,event=>{event.stopPropagation();options.action(b.action,b.context);});
  for(const [path,value]of Object.entries(p.fills))view.setFill(path,value);
  view.addDiagnostic(...p.limitations);return view;
}
