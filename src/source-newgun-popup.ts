import type {Texture} from 'pixi.js';
import {createSourceUiView,sourceUiTree,type SourceUiViewport} from './source-ui';
import {SourceNewItemOpenMotion} from './source-motion';
import {sourceGunID,type Gun} from './session';
import guns from './data/guns.json';
/** NewGun_UI GO20203, original node hierarchy and Open clip. */
export function createSourceNewGunPopup(options:{textures:Record<string,Texture>;viewport:SourceUiViewport;gun:Gun;close:()=>void}){
  const root=sourceUiTree.nodes.find(n=>n.gameObjectPathID===20203);
  if(!root)throw new Error('Source NewGun_UI is not projected');
  const raw=guns.guns[sourceGunID(options.gun)],active:Record<string,boolean>={};
  const ids=new Map(sourceUiTree.nodes.map(n=>[n.id,n]));
  for(let n:typeof root|undefined=root;n;n=n.parent?ids.get(n.parent):undefined)active[n.id]=true;
  active['level0:35150']=true;
  const degree=sourceUiTree.nodes.find(n=>n.gameObjectPathID===16546);
  sourceUiTree.nodes.filter(n=>n.parent===degree?.id).sort((a,b)=>a.siblingIndex-b.siblingIndex).forEach((n,i)=>active[n.id]=i===Math.floor(raw.sourceID/5));
  const tree={...sourceUiTree,nodes:sourceUiTree.nodes.map(n=>n.gameObjectPathID===34100?{...n,components:n.components.map(c=>c.kind==='Image'?{...c,data:{...c.data,textureURL:raw.spriteURL}}:c)}:n)};
  const view=createSourceUiView({textures:options.textures,viewport:options.viewport,roots:[root.id],active,tree,text:{'level0:9251':options.gun.name,'level0:10390':['单发','激光','穿透','散弹','爆破','导弹','爆狙'][raw.type]}});
  const motion=new SourceNewItemOpenMotion({'Panel':view.get(37266)!,'Panel/Glow':view.get(19309)!});
  motion.play();view.bindAction(35150,event=>{event.stopPropagation();options.close();});
  return {root:view.root,layout:view.layout,update:(dt:number)=>{motion.update(dt);view.update(dt);},reflow:(v:SourceUiViewport)=>view.reflow(v),destroy:()=>{motion.stop();view.root.parent?.removeChild(view.root);view.destroy();}};
}
