import { Container, Graphics, Matrix, NineSlicePlane, Rectangle, Sprite, Text, TextMetrics, TextStyle, Texture, TilingSprite, type FederatedWheelEvent, type FederatedPointerEvent } from 'pixi.js';
import treeData from './data/source-ui-tree.json';
import {sourceDisplayText,sourceChineseFontFamily} from './source-localization';

export type Vec2 = [number, number];
export interface SourceUiComponent { kind: string; enabled?: boolean; data?: Record<string, any>; fields?: Record<string, any>; unknown?: string; pathID?: number; file?: string }
export interface SourceUiNode {
  id: string; name: string; path: string; file: string; gameObjectPathID: number; transformPathID: number;
  parent: string | null; siblingIndex: number; active: boolean;
  rect?: { anchorMin: Vec2; anchorMax: Vec2; anchoredPosition: Vec2; sizeDelta: Vec2; pivot: Vec2 };
  localPosition: number[]; localScale: number[]; localRotation: number[]; components: SourceUiComponent[];
}
export interface SourceUiSprite { key: string; name: string; url?: string | null; rect: { width: number; height: number }; border: number[]; pixelsPerUnit: number }
export interface SourceUiTree {
  schemaVersion: number; canvas: { root: string; scaler: Record<string, any> }; nodes: SourceUiNode[];
  sprites: Record<string, SourceUiSprite>; materials: Record<string, any>; fonts: Record<string, any>; selectedRoots?: string[];
}
export interface SourceUiViewport { width: number; height: number; dpi?: number }
export interface SourceUiTransformOverride { anchoredPosition?: Vec2; sizeDelta?: Vec2; anchorMin?: Vec2; anchorMax?: Vec2; pivot?: Vec2; localScale?: number[]; localRotation?: number[] }
export interface SourceUiLayoutOptions {
  active?: Record<string, boolean>; transforms?: Record<string, SourceUiTransformOverride>; text?: Record<string, string>;
  safeArea?: { left: number; top: number; right: number; bottom: number };
  /** Optional actual font measurement, in source Canvas units. The pure solver does not invent glyph metrics. */
  measureText?: (node: SourceUiNode, width: number) => Vec2 | undefined;
  diagnostics?: string[];
}
export interface SourceUiLayout {
  id: string; path: string; x: number; y: number; width: number; height: number;
  localX: number; localY: number; localWidth: number; localHeight: number; pivot: Vec2; localScale: Vec2;
  matrix: { a: number; b: number; c: number; d: number; tx: number; ty: number };
  localMatrix: { a: number; b: number; c: number; d: number; tx: number; ty: number };
  active: boolean; selfActive: boolean; scale: number;
}
export const sourceUiTree = treeData as unknown as SourceUiTree;
const sourceFonts:Record<string,string>={CatGunnerMitme:'/assets/generated/font/sharedassets0.assets__00000317__Mitme.ttf',CatGunnerThai:'/assets/generated/font/sharedassets0.assets__00000318__Thai.ttf','MPLUS Rounded':'/assets/generated/font/sharedassets0.assets__00000320__MPLUSRounded1c-Black.ttf',CatGunnerSC:'/assets/generated/font/sharedassets0.assets__00000321__NotoSansSC-Bold.ttf',CatGunnerJP:'/assets/generated/font/sharedassets0.assets__00000316__NotoSansJP-Bold.ttf',CatGunnerLiberation:'/assets/generated/font/sharedassets0.assets__00000319__LiberationSans.ttf'};
let fontPromise:Promise<void>|undefined;
export function loadSourceUiFonts():Promise<void>{
  if(typeof document==='undefined'||typeof FontFace==='undefined')return Promise.resolve();
  if(!fontPromise)fontPromise=Promise.all(Object.entries(sourceFonts).map(async([family,url])=>{const face=new FontFace(family,`url("${url}")`);await face.load();(document.fonts as FontFaceSet & {add(font:FontFace):FontFaceSet}).add(face);})).then(()=>undefined);
  return fontPromise;
}
const component = (n: SourceUiNode, kind: string) => n.components.find(c => c.kind === kind && c.enabled !== false);
const graphicComponent = (n: SourceUiNode) => n.components.find(c => ['Image', 'SlicedFilledImage', 'RawImage'].includes(c.kind) && c.enabled !== false);
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sourceIndex = new Map(sourceUiTree.nodes.map(n => [n.id, n]));
const sourcePathCounts = new Map<string, number>();
for (const n of sourceUiTree.nodes) sourcePathCounts.set(n.path,(sourcePathCounts.get(n.path)??0)+1);
for (const n of sourceUiTree.nodes) if(sourcePathCounts.get(n.path)===1) sourceIndex.set(n.path,n);
export const sourceUiAssetURLs = [...new Set(sourceUiTree.nodes.flatMap(n => n.components.map(c => c.data?.textureURL ?? sourceUiTree.sprites[c.data?.spriteKey]?.url).filter((v): v is string => !!v)))];
const queryCaches = new WeakMap<SourceUiTree, Map<string, SourceUiNode | undefined>>();
/** A suffix/name is accepted only when unique; duplicate panel names never silently bind to a different panel. */
export function findSourceUiNode(query: string | number, tree = sourceUiTree): SourceUiNode | undefined {
  if (tree === sourceUiTree && typeof query === 'string' && sourceIndex.has(query)) return sourceIndex.get(query);
  const exact = tree.nodes.filter(n => n.id === query || n.path === query || (typeof query === 'number' && n.gameObjectPathID === query));
  if (exact.length) return exact.length===1?exact[0]:undefined;
  if (typeof query !== 'string') return undefined;
  let cache = queryCaches.get(tree); if (!cache) { cache = new Map(); queryCaches.set(tree, cache); }
  if (cache.has(query)) return cache.get(query);
  const matches = tree.nodes.filter(n => n.name === query || n.path.endsWith(query.startsWith('/') ? query : `/${query}`));
  const value = matches.length === 1 ? matches[0] : undefined; cache.set(query,value); return value;
}
function normalize<T>(values: Record<string, T> | undefined, tree: SourceUiTree): Map<string, T> {
  const out = new Map<string, T>();
  for (const [query, value] of Object.entries(values ?? {})) { const n = findSourceUiNode(query, tree); if (n) out.set(n.id, value); }
  return out;
}
export function sourceUiCanvasScale(tree: SourceUiTree, viewport: SourceUiViewport): number {
  const s = tree.canvas.scaler;
  if (s.uiScaleMode === 1) {
    const rx = viewport.width / s.referenceResolution[0], ry = viewport.height / s.referenceResolution[1];
    if (s.screenMatchMode === 1) return Math.min(rx, ry);
    if (s.screenMatchMode === 2) return Math.max(rx, ry);
    return 2 ** lerp(Math.log2(rx), Math.log2(ry), s.matchWidthOrHeight ?? 0);
  }
  if (s.uiScaleMode === 2) return (viewport.dpi || s.fallbackScreenDPI || 96) / ([2.54, 25.4, 1, 72, 6][s.physicalUnit] ?? 1);
  return s.scaleFactor || 1;
}
function projectRotation(q: number[], scale: number[]) {
  const [x = 0, y = 0, z = 0, w = 1] = q;
  // Orthographic XY projection of the actual quaternion, including 180-degree Y flips.
  return { a: (1 - 2 * (y*y + z*z)) * scale[0], b: -2 * (x*y + z*w) * scale[0],
    c: -2 * (x*y - z*w) * scale[1], d: (1 - 2 * (x*x + z*z)) * scale[1] };
}
function multiply(p: SourceUiLayout['matrix'], n: SourceUiLayout['matrix']): SourceUiLayout['matrix'] {
  return { a: p.a*n.a+p.c*n.b, b: p.b*n.a+p.d*n.b, c: p.a*n.c+p.c*n.d, d: p.b*n.c+p.d*n.d,
    tx: p.a*n.tx+p.c*n.ty+p.tx, ty: p.b*n.tx+p.d*n.ty+p.ty };
}
function rectOf(n: SourceUiNode, overrides: Map<string, SourceUiTransformOverride>) {
  return { anchorMin: [0.5, 0.5] as Vec2, anchorMax: [0.5, 0.5] as Vec2, anchoredPosition: [n.localPosition[0], n.localPosition[1]] as Vec2,
    sizeDelta: [0, 0] as Vec2, pivot: [0.5, 0.5] as Vec2, ...n.rect, ...overrides.get(n.id) };
}
type Sizes = { min: Vec2; pref: Vec2; flex: Vec2 };
type Driven = { width?: number; height?: number; left?: number; top?: number; scaleX?: number; scaleY?: number };
/** Unity anchors, pivot, scaler, active hierarchy, layout groups and fitters. World bounds include parent transforms. */
export function solveSourceUiLayout(tree: SourceUiTree, viewport: SourceUiViewport, options: SourceUiLayoutOptions = {}): Map<string, SourceUiLayout> {
  if (!(viewport.width > 0 && viewport.height > 0)) throw new Error('Source UI viewport must have positive dimensions');
  const scale = sourceUiCanvasScale(tree, viewport), active = normalize(options.active, tree), overrides = normalize(options.transforms, tree);
  const nodes = new Map(tree.nodes.map(n => [n.id, n])), children = new Map<string, SourceUiNode[]>();
  for (const n of tree.nodes) if (n.parent) { const list = children.get(n.parent) ?? []; list.push(n); children.set(n.parent, list); }
  for (const list of children.values()) list.sort((a,b) => a.siblingIndex-b.siblingIndex);
  const fits = new Map<string, Vec2>(), driven = new Map<string, Driven>(), measured = new Map<string, Sizes>();
  const layout = new Map<string, SourceUiLayout>(), diag = new Set<string>();
  const selfActive = (n: SourceUiNode) => active.get(n.id) ?? n.active;
  const participating = (n: SourceUiNode) => (children.get(n.id) ?? []).filter(c => selfActive(c) && !component(c, 'LayoutElement')?.data?.ignoreLayout);
  function compute(n: SourceUiNode): SourceUiLayout {
    const cached = layout.get(n.id); if (cached) return cached;
    const r = rectOf(n, overrides), p = n.parent ? compute(nodes.get(n.parent)!) : undefined, d = driven.get(n.id), fit = fits.get(n.id);
    const isCanvas = n.id === tree.canvas.root;
    const width = isCanvas ? viewport.width / scale : d?.width ?? fit?.[0] ?? Math.max(0, (p?.localWidth ?? 0)*(r.anchorMax[0]-r.anchorMin[0])+r.sizeDelta[0]);
    const height = isCanvas ? viewport.height / scale : d?.height ?? fit?.[1] ?? Math.max(0, (p?.localHeight ?? 0)*(r.anchorMax[1]-r.anchorMin[1])+r.sizeDelta[1]);
    const pivot = isCanvas ? [0,0] as Vec2 : r.pivot;
    let x = isCanvas ? 0 : (lerp(r.anchorMin[0],r.anchorMax[0],pivot[0])-(p?.pivot[0] ?? 0))*(p?.localWidth ?? 0)+r.anchoredPosition[0];
    let y = isCanvas ? viewport.height : -((lerp(r.anchorMin[1],r.anchorMax[1],pivot[1])-(p?.pivot[1] ?? 0))*(p?.localHeight ?? 0)+r.anchoredPosition[1]);
    const sc = isCanvas ? [scale,scale] : overrides.get(n.id)?.localScale ?? n.localScale;
    if (d?.left !== undefined && p) x = -p.pivot[0]*p.localWidth+d.left+pivot[0]*width*(d.scaleX ?? 1);
    if (d?.top !== undefined && p) y = -(1-p.pivot[1])*p.localHeight+d.top+(1-pivot[1])*height*(d.scaleY ?? 1);
    let actualWidth = width, actualHeight = height;
    if (n.name === 'SafeArea' && options.safeArea && p) {
      const s = options.safeArea; actualWidth = width-(s.left+s.right)/scale; actualHeight=height-(s.top+s.bottom)/scale;
      x += (s.left*(1-pivot[0])-s.right*pivot[0])/scale;
      y += (s.top*pivot[1]-s.bottom*(1-pivot[1]))/scale;
    }
    const lm = { ...projectRotation(isCanvas ? [0,0,0,1] : overrides.get(n.id)?.localRotation ?? n.localRotation, sc), tx: x, ty: y };
    const matrix = p ? multiply(p.matrix,lm) : lm;
    const left=-pivot[0]*actualWidth, top=-(1-pivot[1])*actualHeight;
    const corners = [[left,top],[left+actualWidth,top],[left,top+actualHeight],[left+actualWidth,top+actualHeight]].map(([a,b])=>({x:matrix.a*a+matrix.c*b+matrix.tx,y:matrix.b*a+matrix.d*b+matrix.ty}));
    const xs=corners.map(c=>c.x),ys=corners.map(c=>c.y);
    const out: SourceUiLayout = { id:n.id,path:n.path,x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),
      localX:x,localY:y,localWidth:actualWidth,localHeight:actualHeight,pivot,localScale:[sc[0],sc[1]],matrix,localMatrix:lm,
      active:selfActive(n)&&(p?.active ?? true),selfActive:selfActive(n),scale };
    layout.set(n.id,out); return out;
  }
  function measure(n: SourceUiNode): Sizes {
    const cached=measured.get(n.id);if(cached)return cached;
    const l=layout.get(n.id)!, r=rectOf(n,overrides), result:Sizes={min:[0,0],pref:[0,0],flex:[0,0]};
    const image=graphicComponent(n);if(image?.data?.spriteKey) {
      const sprite=tree.sprites[image.data.spriteKey];
      if(sprite){const ratio=(tree.canvas.scaler.referencePixelsPerUnit??100)/(sprite.pixelsPerUnit||100)/(image.data.pixelsPerUnitMultiplier||1);
        result.pref=[sprite.rect.width*ratio,sprite.rect.height*ratio];
        if(image.data.imageType===1||image.kind==='SlicedFilledImage')result.min=[(sprite.border[0]+sprite.border[2])*ratio,(sprite.border[1]+sprite.border[3])*ratio];}
    }
    if(component(n,'TextMeshProUGUI')) {
      const metrics=options.measureText?.(n,l.localWidth);
      if(metrics)result.pref=[Math.max(result.pref[0],metrics[0]),Math.max(result.pref[1],metrics[1])];
      else if (component(n,'ContentSizeFitter') || (n.parent && nodes.get(n.parent)?.components.some(c=>c.enabled!==false&&['HorizontalLayoutGroup','VerticalLayoutGroup'].includes(c.kind)&& (c.data?.childControlWidth||c.data?.childControlHeight)))) diag.add('TMP glyph metrics unavailable: text-driven preferred size is unverified');
    }
    const group=n.components.find(c=>c.enabled!==false&&['HorizontalLayoutGroup','VerticalLayoutGroup','GridLayoutGroup'].includes(c.kind));
    if(group?.data) {
      const g=group.data,pad=g.padding??[0,0,0,0],cs=participating(n),isV=group.kind==='VerticalLayoutGroup';
      if(group.kind==='GridLayoutGroup') {
        const [cols,rows]=gridCount(g,cs.length,l.localWidth,l.localHeight);
        result.min=[pad[0]+pad[1]+(g.cellSize[0]+g.spacing[0])*cols-g.spacing[0],pad[2]+pad[3]+(g.cellSize[1]+g.spacing[1])*rows-g.spacing[1]];result.pref=[...result.min];
      } else for(let axis=0;axis<2;axis++) {
        const cross=isV!==(axis===1), padding=axis===0?pad[0]+pad[1]:pad[2]+pad[3];
        let min=padding,pref=padding,flex=0;
        for(const c of cs){const s=childSizes(c,axis,g), sc=g[axis===0?'childScaleWidth':'childScaleHeight']?c.localScale[axis]:1;
          if(cross){min=Math.max(min,padding+s.min*sc);pref=Math.max(pref,padding+s.pref*sc);flex=Math.max(flex,s.flex);}
          else {min+=s.min*sc+g.spacing;pref+=s.pref*sc+g.spacing;flex+=s.flex;}}
        if(!cross&&cs.length){min-=g.spacing;pref-=g.spacing;}
        result.min[axis]=min;result.pref[axis]=Math.max(min,pref);result.flex[axis]=flex;
      }
    }
    const el=component(n,'LayoutElement')?.data;
    if(el)for(let a=0;a<2;a++)for(const [key,label] of [['min','min'],['pref','preferred'],['flex','flexible']] as const){const v=el[`${label}${a===0?'Width':'Height'}`];if(v>=0)result[key][a]=v;}
    result.pref=[Math.max(result.min[0],result.pref[0]),Math.max(result.min[1],result.pref[1])];
    // RectTransforms without an ILayoutElement have zero preferred size when a group controls them.
    void r;measured.set(n.id,result);return result;
  }
  function childSizes(n:SourceUiNode,axis:number,g:Record<string,any>) {
    const control=g[axis===0?'childControlWidth':'childControlHeight'],expand=g[axis===0?'childForceExpandWidth':'childForceExpandHeight'];
    const m=control?measure(n):undefined,v=rectOf(n,overrides).sizeDelta[axis];
    return {min:m?.min[axis]??v,pref:m?.pref[axis]??v,flex:Math.max(m?.flex[axis]??0,expand?1:0)};
  }
  function arrange(n:SourceUiNode) {
    const group=n.components.find(c=>c.enabled!==false&&['HorizontalLayoutGroup','VerticalLayoutGroup','GridLayoutGroup'].includes(c.kind));
    if(!group?.data)return;const g=group.data,l=layout.get(n.id)!,cs=participating(n),pad=g.padding??[0,0,0,0];
    if(group.kind==='GridLayoutGroup') {
      const [cols,rows]=gridCount(g,cs.length,l.localWidth,l.localHeight),axis=g.startAxis??0;
      const needed=[cols*g.cellSize[0]+Math.max(0,cols-1)*g.spacing[0],rows*g.cellSize[1]+Math.max(0,rows-1)*g.spacing[1]];
      const start=[pad[0]+(l.localWidth-pad[0]-pad[1]-needed[0])*(g.childAlignment%3)/2,pad[2]+(l.localHeight-pad[2]-pad[3]-needed[1])*Math.floor(g.childAlignment/3)/2];
      cs.forEach((c,i)=>{let x=axis===0?i%cols:Math.floor(i/rows),y=axis===0?Math.floor(i/cols):i%rows;
        if(g.startCorner%2===1)x=cols-1-x;if(g.startCorner>=2)y=rows-1-y;
        driven.set(c.id,{width:g.cellSize[0],height:g.cellSize[1],left:start[0]+x*(g.cellSize[0]+g.spacing[0]),top:start[1]+y*(g.cellSize[1]+g.spacing[1])});});return;
    }
    const isV=group.kind==='VerticalLayoutGroup',ordered=g.reverseArrangement?[...cs].reverse():cs;
    for(let axis=0;axis<2;axis++) {
      const size=axis===0?l.localWidth:l.localHeight,padding=axis===0?pad[0]+pad[1]:pad[2]+pad[3],leading=axis===0?pad[0]:pad[2];
      const align=axis===0?(g.childAlignment%3)/2:Math.floor(g.childAlignment/3)/2,cross=isV!==(axis===1),total=measure(n);
      const surplus=size-total.pref[axis],flexMultiplier=surplus>0&&total.flex[axis]>0?surplus/total.flex[axis]:0;
      const mix=total.pref[axis]===total.min[axis]?0:clamp((size-total.min[axis])/(total.pref[axis]-total.min[axis]));
      let pos=leading;if(surplus>0&&total.flex[axis]===0)pos+=surplus*align;
      for(const c of ordered) {
        const s=childSizes(c,axis,g),control=g[axis===0?'childControlWidth':'childControlHeight'],sc=g[axis===0?'childScaleWidth':'childScaleHeight']?c.localScale[axis]:1;
        const v=rectOf(c,overrides).sizeDelta[axis];
        const required=cross?clamp(size-padding,s.min,s.flex>0?size:s.pref):lerp(s.min,s.pref,mix)+s.flex*flexMultiplier;
        const start=cross?leading+(size-padding-required*sc)*align:pos;
        const d=driven.get(c.id)??{};
        if(control)d[axis===0?'width':'height']=required;
        else d[axis===0?'width':'height']=v; // LayoutGroup also drives anchors to top-left when controlSize=false.
        d[axis===0?'left':'top']=start+(control?0:(required-v)*align);d[axis===0?'scaleX':'scaleY']=sc;
        driven.set(c.id,d);if(!cross)pos+=required*sc+g.spacing;
      }
    }
  }
  for(let pass=0;pass<6;pass++) {
    layout.clear();measured.clear();for(const n of tree.nodes)compute(n);
    for(const n of [...tree.nodes].reverse())measure(n);
    for(const n of tree.nodes){const fitter=component(n,'ContentSizeFitter')?.data;if(fitter){const l=layout.get(n.id)!,s=measure(n);fits.set(n.id,[fitter.horizontalFit===1?s.min[0]:fitter.horizontalFit===2?s.pref[0]:l.localWidth,fitter.verticalFit===1?s.min[1]:fitter.verticalFit===2?s.pref[1]:l.localHeight]);}}
    for(const n of tree.nodes)arrange(n);
  }
  layout.clear();for(const n of tree.nodes)compute(n);
  options.diagnostics?.push(...diag);return layout;
}
function gridCount(g:Record<string,any>,count:number,width:number,height:number):Vec2 {
  const p=g.padding??[0,0,0,0];let cols=1,rows=1;
  if(g.constraint===1){cols=Math.max(1,g.constraintCount);rows=Math.ceil(count/cols);}
  else if(g.constraint===2){rows=Math.max(1,g.constraintCount);cols=Math.ceil(count/rows);}
  else {cols=Math.max(1,Math.floor((width-p[0]-p[1]+g.spacing[0]+0.001)/(g.cellSize[0]+g.spacing[0])));rows=Math.max(1,Math.floor((height-p[2]-p[3]+g.spacing[1]+0.001)/(g.cellSize[1]+g.spacing[1])));if(g.startAxis===0)rows=Math.ceil(count/cols);else cols=Math.ceil(count/rows);}
  return [Math.max(1,Math.min(cols,count||1)),Math.max(1,Math.min(rows,count||1))];
}

export type SourceUiGraphic = Container;
export interface SourceUiViewOptions extends SourceUiLayoutOptions {
  textures: Record<string, Texture>; viewport: SourceUiViewport; roots?: (string|number)[]; tree?: SourceUiTree;
  /** Source TMP font assets mapped to CSS font families. Glyph/SDF rendering is an explicit Canvas approximation. */
  fontFamilies?: Record<string,string>;
}
export type SourceScrollSnapshot = Record<string,{x:number;y:number}>;
let sourceUiInstanceSequence=0;
export interface SourceUiView {
  readonly instanceId:number;
  root: Container; nodes: Map<string,Container>; graphics: Map<string,SourceUiGraphic>; texts: Map<string,Text>;
  layout: Map<string,SourceUiLayout>; diagnostics: string[]; addDiagnostic(...messages:string[]):void;
  get(query:string|number):Container|undefined; getText(query:string|number):Text|undefined; getGraphic(query:string|number):SourceUiGraphic|undefined;
  setText(query:string|number,value:string):void; setActive(query:string|number,value:boolean,activateAncestors?:boolean):void;
  setTextureURL(query:string|number,url:string):void; setSprite(query:string|number,spriteKey:string):void; setFill(query:string|number,fraction:number):void; setColor(query:string|number,rgba:number[]):void; setTransform(query:string|number,value:SourceUiTransformOverride):void;
  bindAction(query:string|number,action:(event:FederatedPointerEvent)=>void):()=>void;
  captureScroll():SourceScrollSnapshot; restoreScroll(snapshot:SourceScrollSnapshot):void;
  /** Batch business projection; at most one reflow, keeping scroll/drag state. */
  patch(values:{active?:Record<string,boolean>;text?:Record<string,string>;fills?:Record<string,number>}):void;
  boundActions: Set<string>;
  reflow(viewport?:SourceUiViewport):void; update(deltaSeconds:number):void; destroy():void;
}
function colorOf(v:number[]|undefined):number { const c=v??[1,1,1,1];return (Math.round(clamp(c[0])*255)<<16)|(Math.round(clamp(c[1])*255)<<8)|Math.round(clamp(c[2])*255); }
/** Unity scales opposing borders proportionally when the destination cannot fit them. */
export function sourceUiSliceBorders(border:number[],width:number,height:number,ratio=1):[number,number,number,number] {
  let [l,b,r,t]=border.map(v=>Math.max(0,v*ratio));const sx=l+r>width?width/(l+r):1,sy=t+b>height?height/(t+b):1;
  return [l*sx,t*sy,r*sx,b*sy];
}
function fontFamily(n:SourceUiNode,tree:SourceUiTree,families:Record<string,string>) {
  const key=component(n,'TextMeshProUGUI')?.data?.fontKey,name=tree.fonts[key]?.name??'';
  return families[key]??families[name]??(/CN/.test(name)?'CatGunnerSC, sans-serif':/MPLUS/.test(name)?'MPLUS Rounded, sans-serif':/Thai/.test(name)?'CatGunnerThai, sans-serif':/JP/.test(name)?'CatGunnerJP, sans-serif':/Mitme/.test(name)?'CatGunnerMitme, sans-serif':/Liberation/.test(name)?'CatGunnerLiberation, sans-serif':'Arial, sans-serif');
}
function textStyle(n:SourceUiNode,tree:SourceUiTree,families:Record<string,string>,width:number,displayText:string):TextStyle {
  const d=component(n,'TextMeshProUGUI')!.data!,mat=tree.materials[d.materialKey],floats=Object.fromEntries(mat?.m_SavedProperties?.m_Floats??[]),colors=Object.fromEntries(mat?.m_SavedProperties?.m_Colors??[]),oc=colors._OutlineColor;
  const margin=d.margin??[0,0,0,0],size=d.fontSize||36;
  return new TextStyle({fontFamily:sourceChineseFontFamily(displayText,fontFamily(n,tree,families)),fontSize:size,fontWeight:d.fontWeight>=700||d.fontStyle&1?'bold':'normal',fontStyle:d.fontStyle&2?'italic':'normal',
    fill:colorOf(d.fontColor),align:d.horizontalAlignment===4?'right':d.horizontalAlignment===2?'center':'left',wordWrap:d.wrappingMode!==0,wordWrapWidth:Math.max(1,width-margin[0]-margin[2]),
    breakWords:true,letterSpacing:(d.characterSpacing??0)*size/100,lineHeight:undefined,
    stroke:oc?colorOf([oc.r,oc.g,oc.b,oc.a]):undefined,strokeThickness:Math.max(0,(floats._OutlineWidth??0)*(floats._ScaleRatioA??1)*size*0.1),lineJoin:'round',padding:Math.ceil(size*0.15)});
}
export function createSourceUiView(options:SourceUiViewOptions):SourceUiView {
  const tree=options.tree??sourceUiTree,root=new Container(),nodes=new Map<string,Container>(),graphics=new Map<string,Container>(),texts=new Map<string,Text>(),diagnostics:string[]=[],persistentDiagnostics:string[]=[];
  // Unity RectTransform buttons do not clip their children. Pixi hitArea does:
  // use containsPoint for a Button's own surface, reserving hitArea for ScrollRect.
  const actionBounds=new Map<string,Rectangle>();
  const spriteOverrides=new Map<string,string>();
  const textureOverrides=new Map<string,string>();
  // Canonicalize aliases once. Keeping an initial path alongside a later ID patch
  // lets the stale path win during layout normalization (popup close stayed hidden).
  const active=Object.fromEntries(normalize(options.active,tree)),transforms=Object.fromEntries(normalize(options.transforms,tree)),strings=Object.fromEntries(normalize(options.text,tree)),fills=new Map<string,number>(),colorOverrides=new Map<string,number[]>(),families=options.fontFamilies??{},selected=new Set<string>(),drawable=new Set<string>();
  let viewport=options.viewport,destroyed=false;
  const textOverrides=normalize(strings,tree);
  const byId=new Map(tree.nodes.map(n=>[n.id,n])),children=new Map<string,SourceUiNode[]>();
  for(const n of tree.nodes)if(n.parent){const list=children.get(n.parent)??[];list.push(n);children.set(n.parent,list);}
  for(const list of children.values())list.sort((a,b)=>a.siblingIndex-b.siblingIndex);
  function include(n:SourceUiNode){selected.add(n.id);drawable.add(n.id);for(const c of children.get(n.id)??[])include(c);}
  const roots=options.roots??[tree.canvas.root];
  for(const q of roots){const n=findSourceUiNode(q,tree);if(!n){diagnostics.push(`Unknown or ambiguous UI root: ${q}`);continue;}include(n);let p=n.parent;while(p){selected.add(p);p=byId.get(p)?.parent??null;}}
  const drawLayers=new Map<string,Container>(),fillMasks=new Map<string,Graphics>(),clipMasks=new Map<string,Graphics>();
  // Cache static identity only; Map keeps numeric and string queries distinct, including misses.
  const resolvedIds=new Map<string|number,string|undefined>(),fillTargets=new Map<string,SourceUiNode|undefined>();
  const id=(q:string|number)=>{if(resolvedIds.has(q))return resolvedIds.get(q);const value=findSourceUiNode(q,tree)?.id;resolvedIds.set(q,value);return value;};
  function fillTarget(k:string){
    if(fillTargets.has(k))return fillTargets.get(k);
    let n:SourceUiNode|undefined=byId.get(k)!;
    if(!component(n,'SlicedFilledImage')&&component(n,'Image')?.data?.imageType!==3){const path=n.path;const descendants=tree.nodes.filter(c=>c.path.startsWith(path+'/')&&(component(c,'SlicedFilledImage')||component(c,'Image')?.data?.imageType===3));n=descendants.length===1?descendants[0]:undefined;}
    fillTargets.set(k,n);return n;
  }
  const pathCounts=new Map<string,number>();for(const n of tree.nodes)pathCounts.set(n.path,(pathCounts.get(n.path)??0)+1);
  const alias=<T>(map:Map<string,T>,n:SourceUiNode,value:T)=>{map.set(n.id,value);if(pathCounts.get(n.path)===1)map.set(n.path,value);};
  function build(n:SourceUiNode,parent:Container){if(!selected.has(n.id))return;const box=new Container();box.name=n.path;alias(nodes,n,box);parent.addChild(box);
    const group=component(n,'CanvasGroup')?.fields;if(group)box.alpha=group.m_Alpha??1;
    if(drawable.has(n.id)){
      const g=graphicComponent(n);if(g){const layer=new Container();alias(graphics,n,layer);box.addChild(layer);drawLayers.set(n.id,layer);}
      if(component(n,'TextMeshProUGUI')){const text=new Text('');alias(texts,n,text);box.addChild(text);}
      if(component(n,'Mask')||component(n,'RectMask2D')){const mask=new Graphics();mask.name='SourceMask';box.addChild(mask);clipMasks.set(n.id,mask);}
    }
    for(const c of children.get(n.id)??[])build(c,box);
  }
  build(byId.get(tree.canvas.root)!,root);
  function bounds(l:SourceUiLayout){return {left:-l.pivot[0]*l.localWidth,top:-(1-l.pivot[1])*l.localHeight,width:l.localWidth,height:l.localHeight};}
  function drawGraphic(n:SourceUiNode,l:SourceUiLayout){const layer=drawLayers.get(n.id);if(!layer)return;const g=graphicComponent(n)!,d:Record<string,any>={...g.data,spriteKey:spriteOverrides.get(n.id)??g.data?.spriteKey,color:colorOverrides.get(n.id)??g.data?.color},b=bounds(l),sprite=tree.sprites[d.spriteKey],texture=textureOverrides.has(n.id)?options.textures[textureOverrides.get(n.id)!]:d.textureURL?options.textures[d.textureURL]:sprite?.url?options.textures[sprite.url]:undefined;
    for(const c of layer.removeChildren())c.destroy({children:true,texture:false,baseTexture:false});fillMasks.delete(n.id);
    let display:Container;
    if(texture){
      if(g.kind==='RawImage') {
        const uv=d.uvRect??[0,0,1,1],tile=new TilingSprite(texture,b.width,b.height);
        tile.tileScale.set(b.width/(texture.width*(uv[2]||1)),b.height/(texture.height*(uv[3]||1)));
        tile.tilePosition.set(-uv[0]*texture.width*tile.tileScale.x,-(1-uv[1]-uv[3])*texture.height*tile.tileScale.y);display=tile;
      } else if(d.imageType===1||g.kind==='SlicedFilledImage'){
        // Border units differ from texture pixels when sprite PPU or pixelsPerUnitMultiplier differs.
        const ratio=(tree.canvas.scaler.referencePixelsPerUnit??100)/(sprite.pixelsPerUnit||100)/(d.pixelsPerUnitMultiplier||1);
        const [left,top,right,bottom]=sourceUiSliceBorders(sprite.border,b.width,b.height,ratio);
        const plane=new NineSlicePlane(texture,sprite.border[0],sprite.border[3],sprite.border[2],sprite.border[1]);plane.width=b.width;plane.height=b.height;
        // Pixi's border values are texture UV pixels AND destination pixels. Adjust destination vertex positions only.
        plane.vertices[2]=plane.vertices[10]=plane.vertices[18]=plane.vertices[26]=left;
        plane.vertices[4]=plane.vertices[12]=plane.vertices[20]=plane.vertices[28]=b.width-right;
        plane.vertices[9]=plane.vertices[11]=plane.vertices[13]=plane.vertices[15]=top;
        plane.vertices[17]=plane.vertices[19]=plane.vertices[21]=plane.vertices[23]=b.height-bottom;
        plane.geometry.getBuffer('aVertexPosition').update();display=plane;
        if(d.fillCenter===false) {const buffer=plane.geometry.getIndex(),indices=Array.from(buffer.data as Uint16Array);buffer.update(new Uint16Array([...indices.slice(0,24),...indices.slice(30)]));}
      } else if(d.imageType===2) {display=new TilingSprite(texture,b.width,b.height);}
      else {const s=new Sprite(texture);s.width=b.width;s.height=b.height;if(d.preserveAspect&&texture.width&&texture.height){const ratio=Math.min(b.width/texture.width,b.height/texture.height);s.width=texture.width*ratio;s.height=texture.height*ratio;}display=s;}
    } else if(g.kind==='RawImage') {display=new Container();diagnostics.push(`RawImage texture reference unresolved: ${n.path}`);}
    else {const shape=new Graphics();shape.beginFill(colorOf(d.color)).drawRect(0,0,b.width,b.height).endFill();display=shape;if(d.spriteKey)diagnostics.push(`Missing source texture: ${n.path} (${d.spriteKey})`);}
    display.position.set(b.left+(b.width-display.width)*l.pivot[0],b.top+(b.height-display.height)*(1-l.pivot[1]));
    if('tint' in display)(display as Sprite).tint=colorOf(d.color);display.alpha=d.color?.[3]??1;layer.addChild(display);
    const fill=fills.get(n.id)??d.fillAmount??1;
    if(g.kind==='SlicedFilledImage'||d.imageType===3){const mask=new Graphics();mask.name='SourceFillMask';layer.addChild(mask);fillMasks.set(n.id,mask);drawFill(mask,b,d,g.kind,fill);display.mask=mask;}
  }
  function drawFill(mask:Graphics,b:{left:number;top:number;width:number;height:number},d:Record<string,any>,kind:string,amount:number){
    const f=clamp(amount);mask.clear().beginFill(0xffffff);
    if(f>=1){mask.drawRect(b.left,b.top,b.width,b.height);}
    else if(f>0){
      if(kind==='SlicedFilledImage'){
        const dir=d.fillDirection??0; if(dir===0)mask.drawRect(b.left,b.top,b.width*f,b.height);else if(dir===1)mask.drawRect(b.left+b.width*(1-f),b.top,b.width*f,b.height);else if(dir===2)mask.drawRect(b.left,b.top+b.height*(1-f),b.width,b.height*f);else mask.drawRect(b.left,b.top,b.width,b.height*f);
      }else if(d.fillMethod===0){mask.drawRect(b.left+(d.fillOrigin===1?b.width*(1-f):0),b.top,b.width*f,b.height);}
      else if(d.fillMethod===1){mask.drawRect(b.left,b.top+(d.fillOrigin===0?b.height*(1-f):0),b.width,b.height*f);}
      else {
        // Radial360 geometry. Radial90/180 use their actual pivot and sweep, clipped by the rectangle.
        const method=d.fillMethod??4,origin=d.fillOrigin??0,clock=d.fillClockwise!==false;
        let cx=b.left+b.width/2,cy=b.top+b.height/2,start=[Math.PI/2,Math.PI,Math.PI*1.5,0][origin%4],sweep=Math.PI*2;
        if(method===2){cx=b.left+([0,0,1,1][origin%4])*b.width;cy=b.top+([1,0,0,1][origin%4])*b.height;start=[-Math.PI/2,0,Math.PI/2,Math.PI][origin%4];sweep=Math.PI/2;}
        else if(method===3){cx=b.left+([.5,0,.5,1][origin%4])*b.width;cy=b.top+([1,.5,0,.5][origin%4])*b.height;start=[Math.PI,-Math.PI/2,0,Math.PI/2][origin%4];sweep=Math.PI;}
        if(!clock)start+=sweep;const sign=clock?1:-1,points=[cx,cy];
        const ray=(a:number)=>{const dx=Math.cos(a),dy=Math.sin(a),ts=[dx>1e-10?(b.left+b.width-cx)/dx:dx<-1e-10?(b.left-cx)/dx:Infinity,dy>1e-10?(b.top+b.height-cy)/dy:dy<-1e-10?(b.top-cy)/dy:Infinity];const t=Math.min(...ts.filter(v=>v>=-1e-8));points.push(cx+dx*t,cy+dy*t);};
        ray(start);const corners=[[b.left,b.top],[b.left+b.width,b.top],[b.left+b.width,b.top+b.height],[b.left,b.top+b.height]].map(([x,y])=>({x,y,a:((sign*(Math.atan2(y-cy,x-cx)-start))%(Math.PI*2)+Math.PI*2)%(Math.PI*2)})).filter(c=>c.a>1e-8&&c.a<sweep*f).sort((a,b)=>a.a-b.a);for(const c of corners)points.push(c.x,c.y);ray(start+sign*sweep*f);mask.drawPolygon(points);
      }
    }mask.endFill();
  }
  function updateText(n:SourceUiNode,l:SourceUiLayout){const t=texts.get(n.id);if(!t)return;const d=component(n,'TextMeshProUGUI')!.data!,b=bounds(l),m=d.margin??[0,0,0,0],override=textOverrides.get(n.id);
    t.text=sourceDisplayText(override??d.text??'',d.isRichText!==false,n.path);const style=textStyle(n,tree,families,l.localWidth,t.text);t.style=style;
    const maxWidth=Math.max(0,b.width-m[0]-m[2]),maxHeight=Math.max(0,b.height-m[1]-m[3]);
    if(d.autoSize){let lo=d.fontSizeMin??style.fontSize,hi=d.fontSizeMax??style.fontSize;for(let i=0;i<8;i++){const size=(lo+hi)/2;style.fontSize=size;const metrics=TextMetrics.measureText(t.text,style);if(metrics.width<=maxWidth&&metrics.height<=maxHeight)lo=size;else hi=size;}style.fontSize=lo;}
    const h=d.horizontalAlignment??1,v=d.verticalAlignment??256;
    t.position.set(b.left+m[0]+(h===4?maxWidth-t.width:h===2?(maxWidth-t.width)/2:0),b.top+m[1]+(v===1024?maxHeight-t.height:v===512?(maxHeight-t.height)/2:0));t.alpha=(colorOverrides.get(n.id)??d.fontColor)?.[3]??1;t.tint=colorOverrides.has(n.id)?colorOf(colorOverrides.get(n.id)):0xffffff;
  }
  type ScrollState={node:SourceUiNode;content:SourceUiNode;viewport:SourceUiNode;data:Record<string,any>;x:number;y:number;vx:number;vy:number;dragging:boolean;lastX:number;lastY:number;lastTime:number;moved:boolean};
  const scrolls=new Map<string,ScrollState>();let lastDragEnd=0;
  function applyScroll(s:ScrollState,x:number,y:number){
    const content=nodes.get(s.content.id),base=view.layout.get(s.content.id),vp=view.layout.get(s.viewport.id);if(!content||!base||!vp)return;
    const oldX=s.x,oldY=s.y,axisScale=base.scale;
    // Serialized content and viewport transforms are axis-aligned in these five source scroll views.
    const baseLeft=base.x-oldX*axisScale,baseTop=base.y-oldY*axisScale;
    if(s.data.movementType!==0){x=clamp(x,Math.min(0,(vp.x+vp.width-baseLeft-base.width)/axisScale),Math.max(0,(vp.x-baseLeft)/axisScale));y=clamp(y,Math.min(0,(vp.y+vp.height-baseTop-base.height)/axisScale),Math.max(0,(vp.y-baseTop)/axisScale));}
    s.x=s.data.horizontal?x:0;s.y=s.data.vertical?y:0;
    const dx=s.x-oldX,dy=s.y-oldY;content.x+=dx;content.y+=dy;
    for(const [key,l]of view.layout){if(key===s.content.id||l.path.startsWith(s.content.path+'/')){l.x+=dx*axisScale;l.y+=dy*axisScale;l.matrix={...l.matrix,tx:l.matrix.tx+dx*axisScale,ty:l.matrix.ty+dy*axisScale};if(key===s.content.id){l.localX+=dx;l.localY+=dy;l.localMatrix={...l.localMatrix,tx:l.localMatrix.tx+dx,ty:l.localMatrix.ty+dy};}}}
    if(s.data.movementType===1) { /* Elastic overscroll is clamped; native spring behavior remains a documented adapter limit. */ }
  }
  for(const n of tree.nodes){if(!selected.has(n.id))continue;const d=component(n,'ScrollRect')?.data,box=nodes.get(n.id);if(!d||!box)continue;
    const content=tree.nodes.find(c=>c.transformPathID===d.content?.m_PathID),vp=tree.nodes.find(c=>c.transformPathID===d.viewport?.m_PathID)??n;
    if(!content||!nodes.has(content.id)){diagnostics.push(`ScrollRect content missing: ${n.path}`);continue;}
    const s:ScrollState={node:n,content,viewport:vp,data:d,x:0,y:0,vx:0,vy:0,dragging:false,lastX:0,lastY:0,lastTime:0,moved:false};scrolls.set(n.id,s);box.eventMode='static';
    box.on('wheel',(e:FederatedWheelEvent)=>{const sensitivity=d.scrollSensitivity??1,scale=view.layout.get(content.id)?.scale??1;applyScroll(s,s.x-e.deltaX*sensitivity/scale,s.y-e.deltaY*sensitivity/scale);s.vx=s.vy=0;e.preventDefault();});
    box.on('pointerdown',(e:FederatedPointerEvent)=>{const p=nodes.get(content.id)!.parent.toLocal(e.global);s.dragging=true;s.moved=false;s.lastX=p.x;s.lastY=p.y;s.lastTime=Date.now();s.vx=s.vy=0;});
    box.on('globalpointermove',(e:FederatedPointerEvent)=>{if(!s.dragging)return;const p=nodes.get(content.id)!.parent.toLocal(e.global),dx=p.x-s.lastX,dy=p.y-s.lastY,now=Date.now(),dt=Math.max(.016,(now-s.lastTime)/1000);if(Math.abs(dx)+Math.abs(dy)>2)s.moved=true;applyScroll(s,s.x+dx,s.y+dy);s.vx=dx/dt;s.vy=dy/dt;s.lastX=p.x;s.lastY=p.y;s.lastTime=now;});
    const stop=()=>{if(s.dragging&&s.moved)lastDragEnd=Date.now();s.dragging=false;};box.on('pointerup',stop);box.on('pointerupoutside',stop);
  }
  function reflow(next?:SourceUiViewport){if(destroyed)return;if(next)viewport=next;diagnostics.length=0;
    const layoutTree={...tree,nodes:tree.nodes.filter(n=>selected.has(n.id))};
    const newLayout=solveSourceUiLayout(layoutTree,viewport,{...options,active,transforms,text:strings,diagnostics,
      measureText:(n,width)=>{const d=component(n,'TextMeshProUGUI')?.data;if(!d)return undefined;const text=sourceDisplayText(textOverrides.get(n.id)??d.text??'',d.isRichText!==false,n.path),style=textStyle(n,tree,families,width,text),metrics=TextMetrics.measureText(text,style);const m=d.margin??[0,0,0,0];return [metrics.width+m[0]+m[2],metrics.height+m[1]+m[3]];}});
    view.layout=newLayout;
    for(const n of tree.nodes){const box=nodes.get(n.id);if(!box)continue;const l=newLayout.get(n.id)!;box.visible=l.selfActive;const m=l.localMatrix;box.transform.setFromMatrix(new Matrix(m.a,m.b,m.c,m.d,m.tx,m.ty));const b=bounds(l),r=new Rectangle(b.left,b.top,b.width,b.height);if(actionBounds.has(n.id))actionBounds.set(n.id,r);box.hitArea=box.eventMode==='static'&&!actionBounds.has(n.id)?r:null;
      drawGraphic(n,l);updateText(n,l);
      const mask=clipMasks.get(n.id);if(mask){const g=graphicComponent(n);if(component(n,'Mask')&&g&&(g.kind==='SlicedFilledImage'||g.data?.imageType===3)){drawFill(mask,b,g.data??{},g.kind,fills.get(n.id)??g.data?.fillAmount??1);}else{const p=component(n,'RectMask2D')?.data?.padding??[0,0,0,0];mask.clear().beginFill(0xffffff).drawRect(b.left+p[0],b.top+p[3],Math.max(0,b.width-p[0]-p[2]),Math.max(0,b.height-p[1]-p[3])).endFill();}for(const c of children.get(n.id)??[]){const child=nodes.get(c.id);if(child)child.mask=mask;}if(component(n,'Mask')?.data?.showMaskGraphic===false){const g=drawLayers.get(n.id);if(g)g.visible=false;}}
    }
    for(const s of scrolls.values()){const x=s.x,y=s.y;s.x=s.y=0;applyScroll(s,x,y);}
    if(clipMasks.size)diagnostics.push('Mask adapters clip to RectTransform; image alpha silhouette and RectMask2D softness are not reproduced');
    if(scrolls.size)diagnostics.push('ScrollRect elastic spring and native scrollbar auto-layout are not reproduced; bounds, drag, wheel and inertia are supported');
    diagnostics.push('TMP text uses Canvas glyph rendering; SDF material effects, rich tag styles and native font metrics are approximate');diagnostics.push(...persistentDiagnostics);
  }
  const view:SourceUiView={instanceId:++sourceUiInstanceSequence,root,nodes,graphics,texts,layout:new Map(),diagnostics,addDiagnostic(...messages){persistentDiagnostics.push(...messages);diagnostics.push(...messages);},get:q=>{const k=id(q);return k?nodes.get(k):undefined;},getText:q=>{const k=id(q);return k?texts.get(k):undefined;},getGraphic:q=>{const k=id(q);return k?graphics.get(k):undefined;},
    setText(q,value){const k=id(q);if(!k||textOverrides.get(k)===value)return;strings[k]=value;textOverrides.set(k,value);const n=byId.get(k)!,l=view.layout.get(k);if(l)updateText(n,l);},
    setActive(q,value,ancestors=false){const k=id(q);if(!k)return;let changed=(active[k]??byId.get(k)!.active)!==value;active[k]=value;if(value&&ancestors){let p=byId.get(k)?.parent;while(p){if((active[p]??byId.get(p)!.active)!==true)changed=true;active[p]=true;p=byId.get(p)?.parent;}}if(changed)reflow();},
    setFill(q,fraction){const k=id(q);if(!k)return;const n=fillTarget(k);if(!n)return;const amount=clamp(fraction);if(fills.get(n.id)===amount)return;
      // Reflow/drawGraphic always redraw from fills, even when the next setFill is unchanged.
      fills.set(n.id,amount);const mask=fillMasks.get(n.id),g=graphicComponent(n),l=view.layout.get(n.id);if(mask&&g&&l)drawFill(mask,bounds(l),g.data??{},g.kind,amount);const childMask=clipMasks.get(n.id);if(childMask&&component(n,'Mask')&&g&&l)drawFill(childMask,bounds(l),g.data??{},g.kind,amount);},
    setColor(q,rgba){const k=id(q);if(!k)return;const previous=colorOverrides.get(k);if(previous&&rgba.every((v,i)=>v===previous[i]))return;colorOverrides.set(k,[...rgba]);const n=byId.get(k)!,l=view.layout.get(k);if(l&&graphicComponent(n))drawGraphic(n,l);const t=texts.get(k);if(t){t.tint=colorOf(rgba);t.alpha=rgba[3]??1;}},
    setTransform(q,value){const k=id(q);if(k){transforms[k]={...transforms[k],...value};reflow();}},
    patch(values){
      let changed=false;
      for(const [q,value] of Object.entries(values.active??{})){const k=id(q);if(!k)continue;if((active[k]??byId.get(k)!.active)!==value)changed=true;active[k]=value;}
      for(const [q,value] of Object.entries(values.text??{}))view.setText(q,value);
      for(const [q,value] of Object.entries(values.fills??{}))view.setFill(q,value);
      if(changed)reflow();
    },
    setTextureURL(q,url){const k=id(q);if(!k||textureOverrides.get(k)===url)return;if(!options.textures[url]){view.addDiagnostic(`MISSING_SOURCE_TEXTURE:${url}`);return;}textureOverrides.set(k,url);const n=byId.get(k)!,l=view.layout.get(k);if(l&&graphicComponent(n))drawGraphic(n,l);},
    setSprite(q,key){const k=id(q);if(!k||spriteOverrides.get(k)===key)return;if(!tree.sprites[key]){view.addDiagnostic(`MISSING_SOURCE_SPRITE:${key}`);return;}spriteOverrides.set(k,key);const n=byId.get(k)!,l=view.layout.get(k);if(l&&graphicComponent(n))drawGraphic(n,l);},
    boundActions:new Set<string>(),
    captureScroll(){return Object.fromEntries([...scrolls].map(([id,s])=>[id,{x:s.x,y:s.y}]));},
    restoreScroll(snapshot){for(const [id,position] of Object.entries(snapshot)){const s=scrolls.get(id);if(s&&Number.isFinite(position.x)&&Number.isFinite(position.y)){s.vx=s.vy=0;applyScroll(s,position.x,position.y);}}},
    bindAction(q,action){const box=view.get(q);if(!box){diagnostics.push(`MISSING_ACTION_TARGET:${String(q)}`);console.error(`[source-ui] missing action target: ${String(q)}`);return()=>{};}view.boundActions.add(id(q)!);box.eventMode='static';box.cursor='pointer';const key=id(q)!,l=view.layout.get(key);if(l){const b=bounds(l);actionBounds.set(key,new Rectangle(b.left,b.top,b.width,b.height));}box.hitArea=null;Object.assign(box,{containsPoint:(p:{x:number;y:number})=>{const local=box.worldTransform.applyInverse(p),r=actionBounds.get(key);return !!r&&r.contains(local.x,local.y);}});const handler=(e:FederatedPointerEvent)=>{if(Date.now()-lastDragEnd>120)action(e);};box.on('pointertap',handler);return()=>box.off('pointertap',handler);},reflow,
    update(dt){for(const scroll of scrolls.values()){if(scroll.dragging)continue;if(!scroll.data.inertia){scroll.vx=scroll.vy=0;continue;}const factor=Math.pow(scroll.data.decelerationRate??.135,Math.min(.1,Math.max(0,dt)));scroll.vx*=factor;scroll.vy*=factor;if(Math.abs(scroll.vx)<1)scroll.vx=0;if(Math.abs(scroll.vy)<1)scroll.vy=0;if(scroll.vx||scroll.vy)applyScroll(scroll,scroll.x+scroll.vx*dt,scroll.y+scroll.vy*dt);}},
    destroy(){destroyed=true;root.destroy({children:true,texture:false,baseTexture:false});nodes.clear();graphics.clear();texts.clear();resolvedIds.clear();fillTargets.clear();view.layout.clear();}};
  reflow();void loadSourceUiFonts().then(()=>{if(!destroyed)reflow();}).catch(error=>diagnostics.push(`Source font load failed: ${String(error)}`));return view;
}
