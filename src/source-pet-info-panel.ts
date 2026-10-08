import {sourceUnboundActiveButtons} from './source-button-audit';
import {Sprite,type Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiView,type SourceUiViewport} from './source-ui';
import {sourcePetStats,SOURCE_PET_GRADE_COUNT} from './r5-pet';
import {sourcePetPanelAssetURLs} from './source-pet-panel';
import scene from './data/r6-pet-info-ui.json';
import autoScene from './data/r6-pet-auto-scene.json';
export interface SourcePetInfoPanelOptions {textures:Record<string,Texture>;viewport:SourceUiViewport;grade:number;action(name:string,payload?:unknown):void}
/** Pet_Info_UI.Reload/Show_LowerPet/Show_HigherPet, original GO975 and original artwork. */
export function createSourcePetInfoPanel(o:SourcePetInfoPanelOptions):SourceUiView {
 let grade=Math.max(0,Math.min(SOURCE_PET_GRADE_COUNT-1,Math.trunc(o.grade)));
 const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>({...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data}}:c)}))};
 for(const id of [scene.Pet_img.id,scene.Shadow_img.id]){const image=tree.nodes.find(n=>n.id===id)!.components.find(c=>c.kind==='Image');if(image?.data)image.data.textureURL=sourcePetPanelAssetURLs[grade];}
 const active:Record<string,boolean>={};let n=tree.nodes.find(n=>n.id==='level0:975');while(n){active[n.id]=true;n=tree.nodes.find(x=>x.id===n!.parent);}
 const view=createSourceUiView({textures:o.textures,viewport:o.viewport,roots:[975],tree,active,text:{'level0:10259':'金币加成','level0:10089':'移动速度'}});
 const sync=()=>{
  const stat=sourcePetStats(grade);view.setText(scene.Money_txt.id,`${stat.money.format()}%`);view.setText(scene.MoveSpeed_txt.id,`${stat.moveSpeed}%`);
  view.setColor(scene.Panel_img.id,autoScene.degreeColors[grade]);scene.Degree_objs.forEach((n,i)=>view.setActive(n.id,i===grade));
  for(const id of [scene.Pet_img.id,scene.Shadow_img.id]){const image=tree.nodes.find(n=>n.id===id)!.components.find(c=>c.kind==='Image');if(image?.data)image.data.textureURL=sourcePetPanelAssetURLs[grade];}
  view.setActive(scene.LeftBtn_obj.id,grade>0);view.setActive(scene.RightBtn_obj.id,grade<SOURCE_PET_GRADE_COUNT-1);
  for(const id of [scene.Pet_img.id,scene.Shadow_img.id])for(const child of view.getGraphic(id)?.children??[])if(child instanceof Sprite){const w=child.width,h=child.height;child.texture=o.textures[sourcePetPanelAssetURLs[grade]];child.width=w;child.height=h;}
 };
 view.bindAction(scene.LeftBtn_obj.id,()=>{if(grade>0){grade--;sync();o.action('pet-info-grade',grade);}});view.bindAction(scene.RightBtn_obj.id,()=>{if(grade<SOURCE_PET_GRADE_COUNT-1){grade++;sync();o.action('pet-info-grade',grade);}});
 for(const id of [1158,1556])view.bindAction(id,()=>o.action('pet-info-close'));
 sync();for(const path of sourceUnboundActiveButtons(tree.nodes,new Set([...view.layout].filter(([,l])=>l.active).map(([id])=>id)),view.boundActions)){view.addDiagnostic('UNBOUND_SOURCE_BUTTON:'+path);console.error('[source-pet-info-panel] unbound source button: '+path);}
 view.addDiagnostic('Original Pet_Info_UI root975; source stat, sprite, colour and degree consumers. Ten source balance rows; original thirteen visual ranks do not create three extra pets.');return view;
}
