import {sourceRaidMissionHUD} from './raid-mission-ui-state';
import {freshSourceRaidMission,type SourceRaidMissionState} from './r6-raid-mission';
/** Original Raid_Start_UI + Raid_GunSelect_Panel records, source button events,
 * and GunSlot.Reload consumers. This panel does not substitute a Boss/DPS run. */
import {Text,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {sourceRaidHelperSlot} from './raid-helper-ui-state';
import scene from './data/r6-raid-ui.json';
import guns from './data/guns.json';
import colors from './data/r6-gun-degree-colors.json';
import {sourceWeekOffset,sourceWeeklyRemaining} from './r6-weekly';
import {raidEntryTypeNow} from './r5-raid';
import {sourceRaidWeakType,sourceRaidCandidates,sourceRaidSelectionRefresh,sourceRaidSlotDamage,type SourceRaidState,type SourceRaidSelection,type SourceRaidGunRef} from './r6-raid';
import {freshSourceRaidStarPig,type SourceRaidStarPigState} from './r6-raid-star-pig';
import {sourceRaidStarPigHUD} from './raid-star-pig-ui-state';
import type {Session} from './session';
const start=scene.find(r=>r.kind==='Raid_Start_UI')!,picker=scene.find(r=>r.kind==='Raid_GunSelect_Panel')!;
const slots=start.data.Gun_Slot_list!.map(ref=>scene.find(r=>r.id===ref.id)!);
const items=picker.data.item_list!.map(ref=>scene.find(r=>r.id===ref.id)!);
/** Serialized alternatives are not necessarily the Image's initial sprite. Preload all originals. */
export const sourceRaidAssetURLs=[...new Set([...guns.guns.slice(50,55).map(g=>g.spriteURL),...start.data.Boss_Sprites!.map(p=>sourceUiTree.sprites[p.spriteKey!]?.url).filter((url):url is string=>!!url)])];
const typeNames=['单发','激光','穿透','散弹','爆破','导弹','爆狙'];
export interface SourceRaidPanelState {session:Session;state:SourceRaidState;selection:SourceRaidSelection;selectingSlot:number|null;nowUTC:number;notice:string;ready:boolean;pig?:SourceRaidStarPigState;mission?:SourceRaidMissionState}
export interface SourceRaidPanelOptions extends SourceRaidPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string,payload?:unknown):void}
export interface SourceRaidPanelView extends SourceUiView {sync(state:SourceRaidPanelState):void}
/** Stable exact-path bindings are exported for the coverage ledger; a binding alone is not closure. */
export const sourceRaidPanelBindings=()=>{
 const rows:{id:string;action:string;payload?:unknown}[]=[];const add=(id:string|number,action:string,payload?:unknown)=>rows.push({id:typeof id==='number'?`level0:${id}`:id,action,payload});
 for(const id of [1240,708])add(id,'raid-close');for(const id of [1014,1699])add(id,'raid-select-close');
 for(const id of [691,560,1975,654])add(id,'raid-enter');
 slots.forEach(r=>{add(r.id,'raid-slot',r.data.SlotNum);add(r.data.UnEquip_Btn_obj!.id!,'raid-unselect',r.data.SlotNum);add(r.data.StarUpgrade_obj!.id!,'raid-star',r.data.SlotNum);});
 // All serialized inner Demo Buttons are disabled in this source prefab. Do NOT
 // re-enable their persistent Touch event: it would intercept the reachable outer select.
 items.forEach((r,i)=>add(r.id,'raid-select',i));
 add(17199,'raid-helper');add(36993,'raid-source-orphan','helper-star');add(1934,'raid-mission');
 add(718,'raid-star-pig');return rows;
};
export function createSourceRaidPanel(o:SourceRaidPanelOptions):SourceRaidPanelView {
 const byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n])),active:Record<string,boolean>={};
 for(const id of [start.id,picker.id]){let n=byID.get(id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}}
 active[picker.id]=o.selectingSlot!==null;
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[1280,1022],active}) as SourceRaidPanelView;
 const notice=new Text('',{fontFamily:'CatGunnerSC,sans-serif',fontSize:12,fill:0xffe5a5,align:'center',wordWrap:true,wordWrapWidth:o.viewport.width-28});notice.anchor.set(.5,1);notice.position.set(o.viewport.width/2,o.viewport.height-20);notice.eventMode='none';view.root.addChild(notice);
 let current=o;
 view.sync=s=>{
  current={...o,...s};const a:Record<string,boolean>={},text:Record<string,string>={},selection=sourceRaidSelectionRefresh(s.session,s.selection),weak=sourceRaidWeakType(s.state.seasonIndex),entry=raidEntryTypeNow(s.state);
  a[picker.id]=s.selectingSlot!==null;
  for(const [key,type]of [['Enter_Normal_obj',1],['Enter_AD_obj',2],['Enter_IAP_obj',3],['Enter_Disable_obj',0]] as const)a[start.data[key]!.id!]=entry===type;
  text[start.data.MaxScore_txt!.id!]=String(s.state.bestLevel);text[start.data.Enter_Ticket_txt!.id!]=`${Math.max(0,2-s.state.freeUseCount)}/2`;
  text[start.data.WeakType_txt!.id!]=typeNames[weak];
  const seconds=Math.ceil(sourceWeeklyRemaining(new Date(s.nowUTC))/1000);text[start.data.Remain_Time_txt!.id!]=`${Math.floor(seconds/86400)}天 ${String(Math.floor(seconds%86400/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const bossKey=start.data.Boss_Sprites![sourceWeekOffset(new Date(s.nowUTC))].spriteKey;if(bossKey){const url=sourceUiTree.sprites[bossKey]?.url;if(url)view.setTextureURL(start.data.Boss_img!.id!,url);}
  // Online rank data is not fabricated; the source serialized label remains, and explicit status is shown below.
  slots.forEach((r,i)=>{
   const d=r.data,ref=selection[i],g=ref?guns.guns[ref.gunID]:null,isWeak=g?.type===weak;
   a[d.Selected_obj!.id!]=!!g;a[d.UnSelected_obj!.id!]=!g;a[d.UnEquip_Btn_obj!.id!]=!!g;
   a[d.Weak_obj!.id!]=!!g&&isWeak;a[d.Weak_Icon_obj!.id!]=!!g&&isWeak;a[d.Weak_Dmg_Panel!.id!]=!!g&&isWeak;
   text[d.StarUpgrade_Lv_txt!.id!]=String(s.session.bossSlotLevels?.[i]??0);
   if(g){view.setTextureURL(d.Gun_img!.id!,g.spriteURL);view.setTextureURL(d.Shadow_img!.id!,g.spriteURL);view.setColor(d.Panel_img!.id!,colors.colors[Math.floor(ref!.gunID/5)]);text[d.Type_txt!.id!]=typeNames[g.type];text[d.Speed_txt!.id!]=String(Number(g.intervalSeconds.toFixed(3)));text[d.Damage_txt!.id!]=sourceRaidSlotDamage(s.session,i,ref!.gunID,weak).format();view.setColor(d.Damage_txt!.id!,isWeak?d.SpecialDamage_Color!:[1,1,1,1]);}
   d.Degree_objs!.forEach((ref,j)=>a[ref.id!]=!!g&&j===Math.floor(g.sourceID/5));
  });
  const candidates=sourceRaidCandidates(s.session);
  items.forEach((r,i)=>{
   const d=r.data,ref=candidates.find(g=>g.index===i),demo=scene.find(row=>row.id===d.gun_item_demo!.id)!.data,g=ref?guns.guns[ref.gunID]:null;
   a[d.gun_item_demo!.id!]=!!g;a[d.Disable_obj!.id!]=!!ref&&selection.some(g=>g?.uid===ref.uid);a[d.Weak_obj!.id!]=!!g&&g.type===weak;
   if(g){view.setTextureURL(demo.Gun_img!.id!,g.spriteURL);view.setTextureURL(demo.Shadow_img!.id!,g.spriteURL);view.setColor(demo.Panel_img!.id!,colors.colors[Math.floor(ref!.gunID/5)]);text[demo.Type_txt!.id!]=typeNames[g.type];}demo.Degree_objs!.forEach((p,j)=>a[p.id!]=!!g&&j===Math.floor(g.sourceID/5));
  });
  const helper=sourceRaidHelperSlot(s.state,s.session,weak);view.patch(helper);for(const [id,url]of Object.entries(helper.textures))view.setTextureURL(id,url);for(const [id,color]of Object.entries(helper.colors))view.setColor(id,color);
  view.patch(sourceRaidMissionHUD(s.mission??freshSourceRaidMission()));view.patch(sourceRaidStarPigHUD(s.pig??freshSourceRaidStarPig()));
  notice.text=[s.ready?'':'突袭实时战斗未接通 · 不扣次数、不发起交易','H5 本地周历 · 在线排行未连接',s.notice].filter(Boolean).join('\n');view.patch({active:a,text});
 };
 const bindings=sourceRaidPanelBindings(),bindingMap=new Map(bindings.map(r=>[r.id,r]));
 for(const n of sourceUiTree.nodes.filter(n=>(n.path.startsWith(start.path+'/')||n.path.startsWith(picker.path+'/'))&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false))){
  const binding=bindingMap.get(n.id);if(!binding){view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);continue;}
  view.bindAction(n.id,e=>{e.stopPropagation();if(binding.action==='raid-select'||binding.action==='raid-detail'){
   const ref:SourceRaidGunRef|undefined=sourceRaidCandidates(current.session).find(r=>r.index===binding.payload);
   if(ref)o.action(binding.action,ref);else o.action('raid-empty-slot');
  }else o.action(binding.action,binding.payload);});
 }
 view.addDiagnostic('Raid Mission original8 state/claim/season consumers; helper-star36993 SOURCE_ORPHAN_EVENT_TARGET:0 (no fourth upgrade). Native rank/physics/device parity NOT_RUN. Manual20 source items retained; auto sees all35. Inner Demo Buttons including helper-popup17916 source-disabled, never revived.');
 view.sync(o);return view;
}
