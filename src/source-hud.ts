import {sourceWeeklyVisible} from './r6-weekly';
import {SOURCE_DIAPIG} from './r6-diapig';
import {sourceStepUpVisible,sourceStepUpTimeText,freshSourceStepUp} from './r6-stepup';
import stepupScene from './data/r6-stepup-ui.json';
import {freshSourceBuffTimes,sourceBuffTimeText} from './r6-buff';
import {freshSourceEntitlements,sourceBuffMultiplier,type SourceBuffTimes,type SourceEntitlements} from './r5-entitlements';
import { Container, Text, TextStyle, type Texture } from 'pixi.js';
import { createSourceUiView, findSourceUiNode, sourceUiTree, type SourceUiView } from './source-ui';
import { walletValue, type UpgradeKind } from './rules';
import { upgradePriceValue, upgradeStatValue } from './upgrade-tables';
import { contentGate, mineHudValue } from './meta-progression';
import type { Session } from './session';

export function createSourceHud(textures:Record<string,Texture>,width:number,height:number,action:(name:string,payload?:unknown)=>void) {
  const roots=['level0:455','level0:277','level0:1457','level0:1165'];
  const active:Record<string,boolean>={};
  for(const rid of roots){let n=findSourceUiNode(rid);while(n){active[n.id]=true;n=n.parent?findSourceUiNode(n.parent):undefined;}}
  const main='/Canvas/SafeArea/Main_UI';
  for(const name of ['GameWin_obj','GameFail_obj','GameSkip_obj','EcoMode_Panel_UI','Loading_UI'])active[`${main}/${name}`]=false;
  const view=createSourceUiView({textures,viewport:{width,height},roots,active});
  const bind=(q:string|number,name:string,payload?:unknown)=>view.bindAction(q,()=>action(name,payload));
  bind(1069,'eco-toggle');bind(1996,'eco-off');bind(174,'exit-challenge');bind(956,'exit-mine');bind(1810,'settings');bind(1511,'daily');bind(492,'missions');bind(1414,'shop');bind(1482,'permanent');bind(624,'gun');bind(1231,'mine');bind(444,'challenge');
  for(const [q,name] of [[1777,'pet'],[1773,'fish'],[595,'raid'],[1419,'adventure'],[885,'monster'],[146,'boss']] as const)bind(q,'content-open',name);
  bind(1660,'auto');bind(2228,'buff');bind(1160,'skin');
  bind(736,'freecash-open','hud');bind(339,'offerwall-open','hud');
  bind(1010,'weekly-open');bind(2180,'stepup-open');bind(19278,'diapig-open');
  const labels:Record<number,string>={10294:'矿场',10305:'挑战',10222:'商店',10331:'转生',10116:'武器',10375:'任务',10107:'省电',10111:'信息',10391:'宠物',10144:'鱼',10209:'皮肤',10197:'探索',10388:'狩猎',10068:'首领',10238:'突袭'};
  for(const [id,text]of Object.entries(labels))view.setText(Number(id),text);
  const kinds:UpgradeKind[]=['power','speed','money'];
  const cardBase='/Canvas/SafeArea/Ingame/Upgrade_List/';
  const extras=new Container();extras.eventMode='none';view.root.addChild(extras);
  const cards=kinds.map((kind,i)=>{
    const path=cardBase+['Upgrade_Panel','Upgrade_Panel (1)','Upgrade_Panel (2)'][i];bind(path,'upgrade',kind);
    const extension=new Text('',new TextStyle({fontFamily:['CatGunnerSC','MPLUS Rounded','sans-serif'],fontSize:11,fill:0xffffff,stroke:0x405941,strokeThickness:2,align:'center'}));extension.anchor.set(.5,1);extras.addChild(extension);
    view.setActive(path+'/Buff_On_obj',false);view.setActive(path+'/Buff_Icon',false);
    view.setColor('level0:'+([6068,38421,38422][i]),[0.56078434,1,0.51372552,1]);view.setColor('level0:'+([8923,32903,32904][i]),[0.28235295,0.35686275,0.26666668,1]);
    view.setText(path+'/I2_txt(Outline)',{power:'攻击',speed:'攻速',money:'金币'}[kind]);
    return {kind,path,extension,lastFill:-Infinity,lastState:''};
  });
  let visibleUpgradePose=true;
  const update=(session:Session,eco=false,buffTimes:SourceBuffTimes=freshSourceBuffTimes(),entitlements:SourceEntitlements=freshSourceEntitlements(),nowUTC=Date.now(),freeCashHud=false,offerWallHud=false)=>{
    view.setActive(main+'/Btn_list/Right_Menu/FreeCash_Btn_obj',freeCashHud);view.setActive(339,offerWallHud);
    view.setFill(28562,(session.diaPig?.diamonds??0)/SOURCE_DIAPIG.maximum);
    view.setActive(1010,sourceWeeklyVisible(session));
    const stepup=stepupScene.find(r=>r.kind==='StepUp_Hud')!;view.setActive(2208,sourceStepUpVisible(session,nowUTC));view.setActive(2180,sourceStepUpVisible(session,nowUTC));view.setText(stepup.data.Time_txt!.id!,sourceStepUpTimeText(session.stepUp??freshSourceStepUp(),nowUTC));view.setActive(stepup.data.Price_obj!.id!,false);
    const battle=session.battle,isField=session.mode==='field',isMine=session.mode==='mine'||session.mode==='mine-result';
    const progress=battle.targets.length?battle.targets.filter(t=>t.health<=0).length/battle.targets.length:0;
    view.setActive('level0:455',isField);view.setActive('level0:277',isField);extras.visible=isField&&visibleUpgradePose;
    view.setActive('level0:1457',!isField&&!isMine);view.setActive('level0:1165',isMine);
    view.setText(17253,walletValue(battle).format());view.setText(5794,String(session.diamonds));
    view.setText(5795,String(session.diamonds));view.setText(17255,walletValue(battle).format());view.setText(565,`${Math.trunc(progress*100)}%`);view.setFill(2095,progress);view.setText(1467,`${Math.ceil(session.challengeSeconds)}s`);view.setFill(1717,Math.max(0,session.challengeSeconds)/60);view.setText(1965,`${Math.ceil(session.challengeSeconds)}s`);view.setFill(261,Math.max(0,session.challengeSeconds)/60);view.setText(9837,mineHudValue(session.mine.run?.score??0));
    view.setText(1255,`Stage ${battle.stage+1}-${battle.level+1}`);view.setText(1290,`${Math.trunc(progress*100)}%`);view.setFill(1312,progress);
    // Runtime visibility is bound to the existing source-derived gates, not serialized preview state.
    view.setActive('level0:694',eco&&isField);view.setColor(1069,eco?[.5451,.9608,.5412,1]:[.651,.651,.651,1]);
    for(const [lock,feature] of [[2136,'rebirth'],[2246,'mine'],[88,'fish'],[600,'boss'],[1475,'pet'],[1692,'monster'],[1378,'adventure'],[1862,'raid']] as const)view.setActive(lock,!contentGate(session.historicMax,feature).unlocked);
    view.setActive(624,session.gunUnlocked);view.setActive(1482,true);view.setActive(2136,!contentGate(session.historicMax,'rebirth').unlocked);view.setActive(2246,!contentGate(session.historicMax,'mine').unlocked);
    const buffButton='/Canvas/SafeArea/Main_UI/Btn_list/Left_Menu/Buff_obj/Buff_Btn/Btn';
    const all=['money','power','speed'].every(k=>sourceBuffMultiplier(entitlements,k as keyof SourceBuffTimes,buffTimes)===4);
    for(const [kind,path] of [['power','Power'],['speed','Speed'],['money','Money']] as const){const on=sourceBuffMultiplier(entitlements,kind,buffTimes)>1;view.setActive(`${buffButton}/${path}/On`,on);view.setActive(`${buffButton}/${path}/Off`,!on);}
    view.setActive(buffButton+'/NormalValue_obj',!all);view.setActive(buffButton+'/SuperValue_obj',all);
    const time=Math.min(...Object.values(buffTimes).filter(t=>t>0));view.setText(buffButton+'/Cool_txt',entitlements.buffPack?'永久':Number.isFinite(time)?sourceBuffTimeText(time):'');
    for(const card of cards){
      const mult=sourceBuffMultiplier(entitlements,card.kind,buffTimes);view.setActive(card.path+'/Buff_On_obj',mult>1);view.setActive(card.path+'/Buff_Icon',mult>1);
      const level=battle.upgradeLevels[card.kind],maxed=level>=10000,price=upgradePriceValue(level),wallet=walletValue(battle),affordable=!maxed&&wallet.gte(price),fraction=wallet.fractionOf(price);
      view.setText(card.path+'/Lv_txt',`Lv.${level}`);view.setText(card.path+'/Value_txt',upgradeStatValue(card.kind,level).format());view.setText(card.path+'/Price/Price_txt',maxed?'MAX':price.format());
      const state=`${level}:${maxed}:${affordable}`,now=performance.now()/1000;
      if(card.lastState!==state){view.setActive(card.path+'/UpgradeAble_obj',affordable);view.setActive(card.path+'/Fill',!maxed&&!affordable);card.lastState=state;}
      if(now-card.lastFill>=.1){view.setFill(card.path+'/Fill',!maxed&&!affordable?fraction:0);card.lastFill=now;}
      const priceText=view.getText(card.path+'/Price/Price_txt');if(priceText)priceText.tint=affordable||maxed?0xffffff:0xff6d6d;
      card.extension.text=maxed?'已满级':affordable?'可升级':`${Math.floor(fraction*100)}% · 还差 ${price.sub(wallet).format()}`;
      const n=findSourceUiNode(card.path),l=n?view.layout.get(n.id):undefined;
      if(l)card.extension.position.set(l.x+l.width/2,l.y-34);
    }
  };
  return {view,update,setUpgradePose(y:number){view.setTransform('level0:277',{anchoredPosition:[0,y]});visibleUpgradePose=true;},diagnostics:()=>({runtimeUpgradeShowHideConsumer:"PENDING",renderer:view.diagnostics})};
}
export type SourceHud = ReturnType<typeof createSourceHud>;
