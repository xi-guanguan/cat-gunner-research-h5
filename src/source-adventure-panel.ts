import type {SourcePrismState} from './r6-prism';
import {createSourcePrismPanel} from './source-prism-panel';
import {createSourceRelicPanel,sourceRelicAssetURLs} from './source-relic-panel';
import type {SourceRelicState,SourceRelicDrawItem} from './r6-relic';
import {Sprite,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiNode,type SourceUiView,type SourceUiViewport} from './source-ui';
import scene from './data/r6-adventure-ui.json';
import coreSprites from './data/r6-adventure-core-sprites.json';
import petColors from './data/r6-pet-auto-scene.json';
import {sourcePetPanelAssetURLs} from './source-pet-panel';
import {sourcePetCanDispatch,sourcePetWithIdentities,type SourcePetState} from './r5-pet';
import {ADVENTURE_UNLOCK_LEVELS,ADVENTURE_PET_SLOT_LEVELS,ADVENTURE_TICKET_INTERVAL_TICKS,adventureDurationHours,adventureEffectiveDurationHours,adventureIsOpenDay,adventurePetSlotCount,adventureRequiredExp,adventureRewardCore,adventureRewardExp} from './r5-adventure';
import {sourceAdventureAdAble,sourceAdventureGrades,sourceAdventureMapStatus,sourceAdventureRemaining,type SourceAdventureClock,type SourceAdventureState,type SourceAdventureReward,type SourceDispatchPet} from './r6-adventure';
export type SourceAdventurePage='main'|'maps'|'enter'|'pets'|'exit'|'reward'|'relic'|'relic-info'|'relic-draw'|'prism';
export interface SourceAdventureNavigation {page:SourceAdventurePage;type:number;index:number;selected:SourceDispatchPet[];reward:SourceAdventureReward|null;relicCoreType:number;relicIndex:number;relicDraws:SourceRelicDrawItem[];relicDrawPage:number;relicStartedMs:number;prismReturn:'main'|'relic';relicReturn:'relic'|'relic-draw'}
export const freshAdventureNavigation=():SourceAdventureNavigation=>({page:'main',prismReturn:'main',type:0,index:0,selected:[],reward:null,relicCoreType:0,relicIndex:0,relicDraws:[],relicDrawPage:0,relicStartedMs:0,relicReturn:'relic'});
export interface SourceAdventurePanelOptions {coreShop:SourcePrismState;nowUTC:number;textures:Record<string,Texture>;viewport:SourceUiViewport;state:SourceAdventureState;relic:SourceRelicState;pet:SourcePetState;clock:SourceAdventureClock;navigation:SourceAdventureNavigation;plus2:boolean;pending:boolean;notice:string;fixture:boolean;action(name:string,payload?:unknown):void}
export interface SourceAdventurePanelView extends SourceUiView {syncClock(state:SourceAdventureState,clock:SourceAdventureClock):void;syncFrame?():void}
const names=['森林','沙漠','冻原'];
const coreURLs=(coreSprites).map((p:any)=>sourceUiTree.sprites[`sharedassets0.assets:${p.pathID}`]?.url).filter(Boolean) as string[];
export const sourceAdventureAssetURLs=[...coreURLs,...sourceRelicAssetURLs];
export function sourceAdventureDurationText(ticks:bigint):string {const seconds=Number((ticks>0n?ticks:0n)/10_000_000n);return `${Math.floor(seconds/3600)}时 ${Math.floor(seconds%3600/60)}分 ${seconds%60}秒`;}
export function createSourceAdventurePanel(o:SourceAdventurePanelOptions):SourceAdventurePanelView {
 if(o.navigation.page==='prism')return createSourcePrismPanel(o);
 if(o.navigation.page.startsWith('relic'))return createSourceRelicPanel(o);
 const nav=o.navigation,page=nav.page,rows=scene as any[],record=(kind:string,id?:string)=>rows.find(r=>r.kind===kind&&(!id||r.id===id));
 const main=record('Adventure_Panel'),enter=record('Adventure_Enter_popup'),maps=main.data.Adventure_Map_Info_list.map((p:any)=>record('Adventure_Map_info_item',p.id)),ticket=record('Adventure_Ticket_UI'),selector=record('Adventure_PetSelect_popup'),exit=record('Adventure_Exit_Panel'),reward=record('Adventure_Reward_popup');
 const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>({...n,components:n.components.map(c=>['Image','SlicedFilledImage'].includes(c.kind)?{...c,data:{...c.data}}:c)}))};
 const byID=new Map(tree.nodes.map(n=>[n.id,n])),byPath=new Map(tree.nodes.map(n=>[n.path,n]));
 const rootID=page==='main'||page==='relic'?main.id:page==='maps'?main.data.Adventure_Maplist_popup.id:page==='enter'?enter.id:page==='pets'?selector.id:page==='exit'?exit.id:reward.id;
 const root=byID.get(rootID)!;const active:Record<string,boolean>={},text:Record<string,string>={};
 let ancestor:SourceUiNode|undefined=root;while(ancestor){active[ancestor.id]=true;ancestor=ancestor.parent?byID.get(ancestor.parent):undefined;}
 const descendants=(id:string)=>tree.nodes.filter(n=>{let p=n.parent;while(p){if(p===id)return true;p=byID.get(p)?.parent??null;}return false;});
 const p=sourcePetWithIdentities(o.pet);let state=o.state,clock=o.clock;
 const put=(ref:any,v:string)=>{if(ref?.id)text[ref.id]=v;};const show=(ref:any,v:boolean)=>{if(ref?.id)active[ref.id]=v;};
 const relative=(base:SourceUiNode|string,suffix:string)=>byPath.get((typeof base==='string'?byID.get(base)!.path:base.path)+suffix);
 const label=(base:SourceUiNode|string,suffix:string,value:string)=>{const n=relative(base,suffix);if(n)for(const child of [n,...descendants(n.id)])if(child.components.some(c=>c.kind==='TextMeshProUGUI'))text[child.id]=value;};
 const image=(id:string,url:string|undefined)=>{const node=byID.get(id);const c=node?.components.find(c=>c.kind==='Image');if(c?.data&&url)c.data.textureURL=url;};
 const petDemo=(id:string,grade:number)=>{const demo=byID.get(id);if(!demo)return;active[id]=grade>=0;const children=descendants(id);for(const child of children){if(child.name==='Pet_img'||child.name==='Pet')image(child.id,sourcePetPanelAssetURLs[Math.max(0,grade)]);if(child.parent&&byID.get(child.parent)?.name==='Pet_Degree'){const all=tree.nodes.filter(n=>n.parent===child.parent);active[child.id]=all.indexOf(child)===grade;}if(child.name==='Panel'){const c=child.components.find(c=>c.kind==='Image');if(c?.data&&grade>=0)c.data.color=petColors.degreeColors[grade];}}};
 const core=(data:any)=>{image((data.RewardCore_img??data.Reward_Core_img).id,coreURLs[nav.type]);if(data.RewardCore_Panel_img?.id){const c=byID.get(data.RewardCore_Panel_img.id)?.components.find(c=>c.kind==='Image');if(c?.data)c.data.color=data.CorePanel_Colors[nav.type];}};
 const selectedGrades=nav.selected.map(ref=>(ref.source==='owned'?p.owned:p.selected)[ref.index]).filter(g=>g>=0);
 put(main.data.Lv_txt,`Lv.${state.level}`);put(main.data.Exp_txt,state.level>=15?'MAX':`${state.exp}/${adventureRequiredExp(state.level)}`);
 if(page==='main'||page==='relic'){
  const menu=relative(root,'/Panel/Menu_list/Menu_Map'),relic=relative(root,'/Panel/Menu_list/Menu_Relic');if(menu)active[menu.id]=page==='main';if(relic)active[relic.id]=page==='relic';
  main.data.Adventure_Map_list.forEach((ref:any,type:number)=>{const r=record('Adventure_Map_item',ref.id),n=byID.get(ref.id)!;show(r.data.Finished_obj,[0,1,2,3,4].some(i=>sourceAdventureMapStatus(state,type,i,clock.nowTicks,o.plus2)==='finished'));show(r.data.Locked_obj,!adventureIsOpenDay(type,clock.dayOfWeek));label(n,'/Enter_Btn',names[type]);});
  label(root,'/Panel/Menu_list/Btn_list/Btn','探索');label(root,'/Panel/Menu_list/Btn_list/Btn (1)','遗物');
  for(const [suffix,chosen] of [['/Panel/Menu_list/Btn_list/Btn',page==='main'],['/Panel/Menu_list/Btn_list/Btn (1)',page==='relic']] as const){const on=relative(root,suffix+'/On_obj'),off=relative(root,suffix+'/Off_obj');if(on)active[on.id]=chosen;if(off)active[off.id]=!chosen;}
  ['Forest','Desert','Tundra','ALL'].forEach((name,type)=>{const n=relative(root,`/Currency_Core/Core (${name})/Count_txt`);if(n)text[n.id]=String(state.cores[type]);});
  // Original region core balances are not PetCoin. Keep Prism (fourth currency) separate.
  for(const n of descendants(root.id))if(n.components.some(c=>c.kind==='TextMeshProUGUI')){
   if(n.path.includes('PrismCore_Panel')&&n.name.includes('Count'))text[n.id]=String(state.cores[3]);
   if(n.name==='Count_txt'&&n.path.includes('/Menu_Map/')){const parent=byID.get(n.parent!)!;const url=parent.components.find(c=>c.kind==='Image')?.data?.textureURL;const type=coreURLs.indexOf(url);if(type>=0)text[n.id]=String(state.cores[type]);}
  }
 }
 if(page==='maps'){
  label(root,'/Panel/Title_txt',names[nav.type]);
  maps.forEach((r:any,index:number)=>{const data=r.data,n=byID.get(r.id)!,status=sourceAdventureMapStatus(state,nav.type,index,clock.nowTicks,o.plus2),open=adventureIsOpenDay(nav.type,clock.dayOfWeek);
   show(data.Block_obj,status==='locked');show(data.EnterAble_obj,status==='available'&&open);show(data.Daylock_obj,status==='available'&&!open);show(data.Entered_obj,status==='running');show(data.Finish_obj,status==='finished');
   data.Map_img_objs.forEach((ref:any,t:number)=>show(ref,t===nav.type));put(data.Stage_txt,`${names[nav.type]} ${index+1}`);put(data.Time_txt,`${adventureEffectiveDurationHours(index,o.plus2)}小时`);put(data.LvLock_txt,`探索 Lv.${ADVENTURE_UNLOCK_LEVELS[index]} 开放`);put(data.Remaining_Duration_txt,sourceAdventureDurationText(sourceAdventureRemaining(state,nav.type,index,clock.nowTicks,o.plus2)));put(data.AD_Count_txt,`${Math.max(0,2-(state.adDayKey===clock.dayKey?state.adUseCount:0))}/2`);show(data.AD_Btn_obj,sourceAdventureAdAble(state,nav.type,index,clock,o.plus2));image(data.Core_img.id,coreURLs[nav.type]);
   const grades=sourceAdventureGrades(p,nav.type,index);data.Pet_imgs.forEach((ref:any,i:number)=>{show(ref,grades[i]!==undefined);image(ref.id,sourcePetPanelAssetURLs[grades[i]??0]);});
   label(n,'/EnterAble_obj/Enter_Btn','派遣');label(n,'/Entered_obj/Enter_Btn','详情 / 取消');label(n,'/Entered_obj/AD_Bonus_Btn','本地广告 -30分');label(n,'/Finish_obj/RewardGet_Btn','领取');
  });
 }
 if(page==='enter'){
  const data=enter.data;data.Map_img_objs.forEach((ref:any,t:number)=>show(ref,t===nav.type));put(data.Stage_txt,`${names[nav.type]} ${nav.index+1}`);put(data.Time_txt,`${adventureEffectiveDurationHours(nav.index,o.plus2)}小时`);put(data.Exp_txt,String(adventureRewardExp(selectedGrades.length,nav.index)));put(data.Core_txt,String(adventureRewardCore(selectedGrades,nav.index)));put(data.EnterTicket_txt,`- ${nav.selected.length}`);core(data);label(root,'/Panel/Enter_Btn/txt','派遣探索');
  data.Pet_Slot_list.forEach((ref:any,i:number)=>{const r=record('Adventure_Pet_Slot',ref.id),chosen=nav.selected[i];show(r.data.Locked_obj,i>=adventurePetSlotCount(state.level));show(r.data.Selected_obj,!!chosen);show(r.data.Empty_obj,!chosen&&i<adventurePetSlotCount(state.level));petDemo(r.data.pet_item.id,selectedGrades[i]??-1);label(byID.get(ref.id)!,'/Locked_obj',`Lv.${ADVENTURE_PET_SLOT_LEVELS[i]}`);});
 }
 if(page==='pets')selector.data.Pet_Slot_list.forEach((ref:any,i:number)=>{const r=record('Adventure_PetSelect_Slot',ref.id),source=i<3?'selected':'owned',index=i<3?i:i-3,grade=(source==='owned'?p.owned:p.selected)[index],chosen=nav.selected.some(ref=>ref.source===source&&ref.index===index),able=sourcePetCanDispatch(p,source,index)&&!chosen;show(r.data.SelectAble_obj,grade>=0&&able);show(r.data.Disable_obj,grade>=0&&!able);petDemo(r.data.pet_item_demo.id,grade);});
 if(page==='exit'){const grades=sourceAdventureGrades(p,nav.type,nav.index);put(exit.data.Reward_Exp_txt,String(adventureRewardExp(grades.length,nav.index)));put(exit.data.Reward_Core_txt,String(adventureRewardCore(grades,nav.index)));core(exit.data);label(root,'/Panel/Cancel_Btn','取消探索（不退票）');label(root,'/Panel/Exit_Btn','返回');const clear=relative(root,'/Clear_Btn_obj');if(clear){active[clear.id]=o.fixture;label(root,'/Clear_Btn_obj','QA 强制结束');}}
 if(page==='reward'&&nav.reward){const r=nav.reward;put(reward.data.Reward_Exp_txt,`+${r.exp}`);put(reward.data.Reward_Core_txt,`+${r.core}`);put(reward.data.Slider_Lv_txt,`Lv.${r.afterLevel}`);put(reward.data.Slider_Exp_txt,r.afterLevel>=15?'MAX':`${r.afterExp}/${adventureRequiredExp(r.afterLevel)}`);core(reward.data);for(const ref of [reward.data.ExpSlider_obj,reward.data.Endtxt_obj,reward.data.Exp_obj,reward.data.Core_obj,reward.data.Exit_obj])show(ref,true);label(root,'/TouchToExit','点击返回探索');}
 for(const ref of ticket.data.Count_txt)put(ref,`${state.tickets}/20`);
 for(const ref of ticket.data.Cooltime_txt)put(ref,state.tickets>=20?'已满':sourceAdventureDurationText(state.lastChargeTicks===null?ADVENTURE_TICKET_INTERVAL_TICKS:state.lastChargeTicks+ADVENTURE_TICKET_INTERVAL_TICKS-clock.nowTicks));
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[root.gameObjectPathID],tree,active,text}) as SourceAdventurePanelView;
 view.setFill(main.data.Exp_Fill.id,state.level>=15?1:state.exp/adventureRequiredExp(state.level));if(page==='reward')view.setFill(reward.data.ExpSlider_Fill.id,state.level>=15?1:state.exp/adventureRequiredExp(state.level));
 const bound=new Set<string>();const bind=(id:string|number,name:string,payload?:unknown)=>{const key=typeof id==='number'?`level0:${id}`:id;bound.add(key);view.bindAction(key,()=>o.action(name,payload));};
 const bindRel=(base:SourceUiNode,suffix:string,name:string,payload?:unknown)=>{const node=relative(base,suffix);if(node)bind(node.id,name,payload);};
 if(page==='main'||page==='relic'){bind(236,'prism-open');bind(1086,'close');bind(1839,'close');main.data.Adventure_Map_list.forEach((ref:any,type:number)=>bindRel(byID.get(ref.id)!,'/Enter_Btn','adventure-maps',type));bind(27986,'adventure-main');bind(14082,'adventure-relic');}
 if(page==='maps'){bind(1339,'adventure-main');bindRel(root,'/Background','adventure-main');maps.forEach((r:any,index:number)=>{const n=byID.get(r.id)!;bindRel(n,'/EnterAble_obj/Enter_Btn','adventure-enter',index);bindRel(n,'/Entered_obj/Enter_Btn','adventure-exit',index);bindRel(n,'/Entered_obj/AD_Bonus_Btn','adventure-ad',index);bindRel(n,'/Finish_obj/RewardGet_Btn','adventure-claim',index);});}
 if(page==='enter'){bind(2186,'adventure-maps',nav.type);bind(750,'adventure-maps',nav.type);bind(22,'adventure-start');enter.data.Pet_Slot_list.forEach((ref:any,i:number)=>{bind(ref.id,nav.selected[i]?'adventure-unselect':'adventure-pets',i);});}
 if(page==='pets'){bind(2290,'adventure-enter-return');bind(2134,'adventure-enter-return');selector.data.Pet_Slot_list.forEach((ref:any,i:number)=>bind(ref.id,'adventure-select',{source:i<3?'selected':'owned',index:i<3?i:i-3,uid:(i<3?p.selectedIDs:p.ownedIDs)[i<3?i:i-3]}));}
 if(page==='exit'){bind(1214,'adventure-maps',nav.type);bind(2058,'adventure-maps',nav.type);bind(1702,'adventure-cancel');bind(1473,'adventure-force-finish');}
 if(page==='reward')bind(2105,'adventure-maps',nav.type);
 // Never silently swallow a source button. This does not turn a missing consumer into a progress lock.
 for(const node of [root,...descendants(root.id)])if(node.components.some(c=>c.kind==='Button')&&!bound.has(node.id)){const message=`未闭合源动作：${node.path}`;view.addDiagnostic(message);bind(node.id,'unresolved',message);}
 view.syncClock=(next,now)=>{state=next;clock=now;ticket.data.Count_txt.forEach((ref:any)=>view.setText(ref.id,`${state.tickets}/20`));ticket.data.Cooltime_txt.forEach((ref:any)=>view.setText(ref.id,state.tickets>=20?'已满':sourceAdventureDurationText(state.lastChargeTicks===null?ADVENTURE_TICKET_INTERVAL_TICKS:state.lastChargeTicks+ADVENTURE_TICKET_INTERVAL_TICKS-clock.nowTicks)));if(page==='maps')maps.forEach((r:any,index:number)=>{const status=sourceAdventureMapStatus(state,nav.type,index,clock.nowTicks,o.plus2),data=r.data;view.setActive(data.Entered_obj.id,status==='running');view.setActive(data.Finish_obj.id,status==='finished');view.setText(data.Remaining_Duration_txt.id,sourceAdventureDurationText(sourceAdventureRemaining(state,nav.type,index,clock.nowTicks,o.plus2)));view.setActive(data.AD_Btn_obj.id,sourceAdventureAdAble(state,nav.type,index,clock,o.plus2));});};
 view.addDiagnostic('Original Adventure UI and sprites; source float32 rewards, region CoreByType (NOT PetCoin), pets grouped by carried locks. H5 local calendar/ticks codec; reward animation and map render-texture parity NOT_RUN. Relic local consumers connected; offline/Skip/Lv300 remain unclosed.');
 return view;
}
