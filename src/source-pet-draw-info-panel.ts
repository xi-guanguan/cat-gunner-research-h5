import {type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {sourceUnboundActiveButtons,sourceViewButtonCandidates} from './source-button-audit';
export interface SourcePetDrawInfoOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;action(name:string,payload?:unknown):void}
/** Info_Btn UnityEvent targets GO1050, not Pet_Info_UI GO975.
 * Keep the original D=100% row and inactive higher rows; do not invent odds. */
export function createSourcePetDrawInfoPanel(o:SourcePetDrawInfoOptions):SourceUiView {
 const active:Record<string,boolean>={};const byID=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));let n=byID.get('level0:1050');
 while(n){active[n.id]=true;n=n.parent?byID.get(n.parent):undefined;}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[1050],active,text:{'level0:10329':'宠物抽取概率'}});
 for(const id of [1087,8])view.bindAction(id,e=>{e.stopPropagation();o.action('pet-draw-info-close');});
 const buttons=sourceViewButtonCandidates(sourceUiTree.nodes,view.layout);
 for(const path of sourceUnboundActiveButtons(buttons,new Set(buttons.filter(n=>view.layout.get(n.id)?.active).map(n=>n.id)),view.boundActions)){
  view.addDiagnostic('UNBOUND_SOURCE_BUTTON:'+path);console.error('[source-pet-draw-info-panel] unbound source button: '+path);
 }
 view.addDiagnostic('Original GO1050 Draw_Info_UI: source D=100%, inactive higher ranks retained. Chinese title is H5 translation. Original device comparison NOT_RUN.');return view;
}
