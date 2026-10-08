/** Original pooled Raid Mission UI, original scroll/Popup, no replacement art. */
import type {Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {createLocalTestNotice} from './local-test-notice';
import {SOURCE_RAID_MISSION_UI,SOURCE_RAID_MISSION_TICKET_POPUP,SOURCE_RAID_MISSION_ITEMS,sourceRaidMissionBindings,sourceRaidMissionProjection} from './raid-mission-ui-state';
import type {SourceRaidMissionState} from './r6-raid-mission';
import type {SourceRaidState} from './r6-raid';
export interface SourceRaidMissionPanelState {state:SourceRaidMissionState;raid:SourceRaidState;nowUTC:number;ticketOpen:boolean;pending:boolean;notice:string}
export interface SourceRaidMissionPanelOptions extends SourceRaidMissionPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string,payload?:unknown):void}
export interface SourceRaidMissionPanelView extends SourceUiView {sync(state:SourceRaidMissionPanelState):void}
export function createSourceRaidMissionPanel(o:SourceRaidMissionPanelOptions):SourceRaidMissionPanelView {
 // Per-view sibling mutation; the shared original tree must never change.
 const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>({...n}))},active:Record<string,boolean>={},byID=new Map(tree.nodes.map(n=>[n.id,n]));
 for(const id of [SOURCE_RAID_MISSION_UI.id,SOURCE_RAID_MISSION_TICKET_POPUP]){let n=byID.get(id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}}
 let order='',viewport=o.viewport;const view=createSourceUiView({tree,textures:o.textures,viewport,roots:[SOURCE_RAID_MISSION_UI.id,SOURCE_RAID_MISSION_TICKET_POPUP],active})as SourceRaidMissionPanelView;
 const disclosure=createLocalTestNotice(view.root),reflow=view.reflow.bind(view);view.reflow=v=>{if(v)viewport=v;reflow(v);disclosure.place(viewport);};
 view.sync=s=>{const scroll=view.captureScroll(),p=sourceRaidMissionProjection(s.state,s.raid,s.nowUTC,s.ticketOpen),key=p.order.join(',');if(key!==order){order=key;p.order.forEach((index,position)=>byID.get(SOURCE_RAID_MISSION_ITEMS[index].id)!.siblingIndex=position);view.reflow();}view.patch(p);view.restoreScroll(scroll);
  disclosure.text.text=['本地测试 · 任务票不真实支付 · 线上未连接',s.pending?'本地测试交易等待中 · 不重复发起':s.notice].filter(Boolean).join('\n');disclosure.place(viewport);};
 for(const b of sourceRaidMissionBindings)if(view.get(b.id))view.bindAction(b.id,e=>{e.stopPropagation();o.action(b.action,b.payload);});
 for(const n of tree.nodes.filter(n=>(n.path.startsWith(SOURCE_RAID_MISSION_UI.path+'/')||n.path.includes('/Mission_Ticket_Purchase_Popup/'))&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false)))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.addDiagnostic('STATIC mission8/state/sort consumers; Chinese explain/local calendar are H5 adapters. Original inactive Test_obj retained; no source device/online store proof.');view.sync(o);return view;
}
