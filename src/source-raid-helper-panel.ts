/** Original helper popup; local provider disclosure is a separate safe strip. */
import type {Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {createLocalTestNotice} from './local-test-notice';
import scene from './data/r6-raid-helper-ui.json';
import {sourceRaidHelperPopup,sourceRaidHelperPanelBindings} from './raid-helper-ui-state';
import type {SourceRaidState} from './r6-raid';
const popup=scene.find(r=>r.kind==='Raid_Helper_Purchase_Popup')!;
export interface SourceRaidHelperPanelState {state:SourceRaidState;weakType:number;historicMax:number;pending:boolean;notice:string}
export interface SourceRaidHelperPanelOptions extends SourceRaidHelperPanelState {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string):void}
export interface SourceRaidHelperPanelView extends SourceUiView {sync(state:SourceRaidHelperPanelState):void}
export function createSourceRaidHelperPanel(o:SourceRaidHelperPanelOptions):SourceRaidHelperPanelView {
 const active:Record<string,boolean>={},byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get(popup.id);while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[popup.id],active}) as SourceRaidHelperPanelView;
 const disclosure=createLocalTestNotice(view.root);let viewport=o.viewport;
 const reflow=view.reflow.bind(view);view.reflow=next=>{if(next)viewport=next;reflow(next);disclosure.place(viewport);};
 view.sync=s=>{const p=sourceRaidHelperPopup(s.state,s.weakType,s.historicMax,s.pending);view.patch(p);for(const [id,url] of Object.entries(p.textures))view.setTextureURL(id,url);for(const [id,color]of Object.entries(p.colors))view.setColor(id,color);
  disclosure.text.text=['本地测试商店 · 不真实支付 · 线上未连接','源默认价 $3.99 · 权益仅当前赛季',s.notice||p.reason].filter(Boolean).join('\n');disclosure.place(viewport);};
 for(const b of sourceRaidHelperPanelBindings)view.bindAction(b.id,e=>{e.stopPropagation();o.action(b.action);});
 for(const n of sourceUiTree.nodes.filter(n=>n.path.startsWith(popup.path+'/')&&n.components.some(c=>c.kind==='Button'&&c.enabled!==false)))if(!view.boundActions.has(n.id))view.addDiagnostic(`UNBOUND_SOURCE_BUTTON:${n.path}`);
 view.sync(o);return view;
}
