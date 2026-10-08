/** Browser input over the source TMP_InputField (GO599). Owner keeps its value across panel rebuilds. */
import type {SourceUiView, SourceUiViewport} from './source-ui';

export const SOURCE_REDEEM_INPUT_PATH='/Canvas/Setting/Redeem_UI/Panel/InputField (TMP)';
export interface SourceInputBounds {x:number;y:number;width:number;height:number}
export interface SourceInputClientRect {left:number;top:number;width:number;height:number}
/** Pixi logical pixels -> CSS pixels. Canvas backing resolution is deliberately not used. */
export function sourceInputClientRect(bounds:SourceInputBounds,canvas:SourceInputClientRect,viewport:SourceUiViewport):SourceInputClientRect|null {
  if(![bounds.x,bounds.y,bounds.width,bounds.height,canvas.left,canvas.top,canvas.width,canvas.height,viewport.width,viewport.height].every(Number.isFinite)||
    bounds.width<=0||bounds.height<=0||canvas.width<=0||canvas.height<=0||viewport.width<=0||viewport.height<=0)return null;
  const sx=canvas.width/viewport.width,sy=canvas.height/viewport.height;
  return {left:canvas.left+bounds.x*sx,top:canvas.top+bounds.y*sy,width:bounds.width*sx,height:bounds.height*sy};
}
export interface SourceRedeemInputOptions {
  view:Pick<SourceUiView,'get'>;canvas:HTMLCanvasElement;viewport:()=>SourceUiViewport;
  value?:string;disabled?:boolean;onChange?:(value:string)=>void;onSubmit:(value:string)=>void;onCancel?:()=>void;
}
export interface SourceRedeemInputOverlay {
  readonly input:HTMLInputElement;
  getValue():string;setValue(value:string):void;setDisabled(disabled:boolean):void;
  /** Call after source UI reflow or stage placement. Resize/scroll are also observed. */
  sync():void;focus():void;destroy():void;
}
export function createSourceRedeemInputOverlay(options:SourceRedeemInputOptions):SourceRedeemInputOverlay {
  const doc=options.canvas.ownerDocument,input=doc.createElement('input');
  input.type='text';input.value=options.value??'';input.disabled=options.disabled??false;
  input.placeholder='请输入兑换码';input.setAttribute('aria-label','兑换码');input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;
  input.dataset.sourceGo='599';input.dataset.sourceInput='redeem';
  Object.assign(input.style,{position:'fixed',boxSizing:'border-box',margin:'0',border:'0',borderRadius:'0',padding:'0 8px',outline:'none',
    background:'transparent',color:'#312018',textAlign:'center',fontFamily:'CatGunnerSC, sans-serif',zIndex:'1000',touchAction:'manipulation'});
  let destroyed=false,composing=false;
  const stop=(event:Event)=>event.stopPropagation();
  const change=()=>options.onChange?.(input.value);
  const compositionStart=()=>{composing=true;};const compositionEnd=()=>{composing=false;};
  const keydown=(event:KeyboardEvent)=>{
    event.stopPropagation();
    if(composing||event.isComposing)return;
    if(event.key==='Enter'&&!input.disabled){event.preventDefault();options.onSubmit(input.value);}
    else if(event.key==='Escape'){event.preventDefault();options.onCancel?.();}
  };
  const pointerEvents=['pointerdown','pointermove','pointerup','click','wheel','keyup'] as const;
  for(const type of pointerEvents)input.addEventListener(type,stop);
  input.addEventListener('input',change);input.addEventListener('keydown',keydown);
  input.addEventListener('compositionstart',compositionStart);input.addEventListener('compositionend',compositionEnd);
  const sync=()=>{
    if(destroyed)return;
    const node=options.view.get(SOURCE_REDEEM_INPUT_PATH);
    if(!node||node.destroyed||!node.worldVisible){input.hidden=true;return;}
    const rect=sourceInputClientRect(node.getBounds(),options.canvas.getBoundingClientRect(),options.viewport());
    input.hidden=!rect;if(!rect)return;
    Object.assign(input.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,fontSize:`${Math.min(26,rect.height*.5)}px`});
  };
  doc.body.appendChild(input);
  const win=doc.defaultView;win?.addEventListener('resize',sync);win?.addEventListener('scroll',sync,true);
  const ResizeObserverClass=win?.ResizeObserver;const observer=ResizeObserverClass?new ResizeObserverClass(sync):undefined;observer?.observe(options.canvas);
  sync();
  return {input,getValue:()=>input.value,setValue:value=>{input.value=value;},setDisabled:disabled=>{input.disabled=disabled;},sync,
    focus:()=>{if(!destroyed&&!input.hidden&&!input.disabled)input.focus({preventScroll:true});},
    destroy:()=>{if(destroyed)return;destroyed=true;observer?.disconnect();win?.removeEventListener('resize',sync);win?.removeEventListener('scroll',sync,true);
      for(const type of pointerEvents)input.removeEventListener(type,stop);
      input.removeEventListener('input',change);input.removeEventListener('keydown',keydown);
      input.removeEventListener('compositionstart',compositionStart);input.removeEventListener('compositionend',compositionEnd);input.remove();}};
}
