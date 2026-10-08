/** H5 disclosure, NOT replacement source art. Fixed top safe strip avoids the
 * source popup's overhanging illustrations; scalable text at both QA sizes. */
import {Container,Graphics,Text} from 'pixi.js';
import type {SourceUiViewport} from './source-ui';
export function createLocalTestNotice(parent:Container){
 const root=new Container(),back=new Graphics(),text=new Text('',{fontFamily:'CatGunnerSC,sans-serif',fill:0xffe5a5,align:'center',wordWrap:true});
 root.eventMode='none';text.anchor.set(.5,0);root.addChild(back,text);parent.addChild(root);
 return {root,text,place(viewport:SourceUiViewport){const scale=Math.min(viewport.width/390,viewport.height/844),pad=8*scale;
  text.style.fontSize=12*scale;text.style.wordWrapWidth=viewport.width-4*pad;text.position.set(viewport.width/2,pad);
  back.clear().beginFill(0x15171b,.96).drawRoundedRect(pad/2,pad/2,viewport.width-pad,text.height+pad,4*scale).endFill();
 }};
}
