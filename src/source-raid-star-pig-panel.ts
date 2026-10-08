/** Original StarGemPig_UI tree, distinct from the diamond pig. Source prices
 * are fallback labels only; this page never claims a live store price. */
import {type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {createLocalTestNotice} from './local-test-notice';
import scene from './data/r6-raid-star-pig-ui.json';
import {sourceRaidStarPigPopup,sourceRaidStarPigPanelBindings} from './raid-star-pig-ui-state';
import type {SourceRaidStarPigState} from './r6-raid-star-pig';
const popup=scene.find(r=>r.kind==='StarGem_Pig_UI')!;
export interface SourceRaidStarPigPanelState {state:SourceRaidStarPigState;historicMax:number;pending:boolean;notice:string}
export interface SourceRaidStarPigPanelOptions extends SourceRaidStarPigPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string):void}
export interface SourceRaidStarPigPanelView extends SourceUiView {sync(state:SourceRaidStarPigPanelState):void}
export function createSourceRaidStarPigPanel(o:SourceRaidStarPigPanelOptions):SourceRaidStarPigPanelView {
 const active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get(popup.id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[popup.id],active}) as SourceRaidStarPigPanelView;
 const disclosure=createLocalTestNotice(view.root),notice=disclosure.text;
 let viewport=o.viewport;const placeNotice=()=>disclosure.place(viewport);
 const reflow=view.reflow.bind(view);view.reflow=next=>{if(next)viewport=next;reflow(next);placeNotice();};
 view.sync=s=>{const projection=sourceRaidStarPigPopup(s.state,s.historicMax,s.pending);view.patch(projection);notice.text=['本地测试商店 · 不真实支付 · 线上未连接','源默认价格 · H5本地赛季时钟',s.notice||projection.reason].filter(Boolean).join('\n');placeNotice();};
 for(const binding of sourceRaidStarPigPanelBindings)view.bindAction(binding.id,e=>{e.stopPropagation();o.action(binding.action);});
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(popup.path+'/')&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false)))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.sync(o);return view;
}
