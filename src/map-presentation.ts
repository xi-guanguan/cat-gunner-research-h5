import mapSceneData from "./data/map-scene.json";
export const MAP_SCENE_CONFIG = mapSceneData;

import mapSkinData from "./data/map-skins.json";

export type MapPoint = { x: number; y: number };
export type MapWorldPoint = MapPoint & { z: number };
/** Row-major Unity world Transform matrix. */
export type MapMatrix4 = readonly number[];
export type MapSpriteMetadata = {
  url: string; rect: readonly number[]; pivot: readonly number[]; pixelsPerUnit: number;
  texturePixels: readonly number[]; textureRectOffset: readonly number[];
  physicsShape?: readonly (readonly number[])[];
};
export type MapSkinData = {
  ground: readonly number[]; up: readonly number[]; down: readonly number[]; trees: readonly number[];
  exteriorColors: readonly (readonly number[])[];
  sprites: Record<string, MapSpriteMetadata>;
};
export type MapCamera = { forward: MapWorldPoint; right?: MapWorldPoint; up?: MapWorldPoint };
const SKINS: MapSkinData = mapSkinData;
const IDENTITY: MapMatrix4 = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const dot = (a: MapWorldPoint,b: MapWorldPoint) => a.x*b.x+a.y*b.y+a.z*b.z;
const subtract = (a: MapWorldPoint,b: MapWorldPoint): MapWorldPoint => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross = (a: MapWorldPoint,b: MapWorldPoint): MapWorldPoint =>
  ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function normalize(p: MapWorldPoint): MapWorldPoint {
  const n=Math.hypot(p.x,p.y,p.z);if(n<1e-8)throw new Error("Map camera direction must be nonzero");
  return {x:p.x/n,y:p.y/n,z:p.z/n};
}
/** C# remainder selection uses a nonnegative internal stage, independent of displayed labels. */
export function getMapThemeIndex(internalStage: number, data: MapSkinData = SKINS): number {
  if(!Number.isInteger(internalStage)||internalStage<0)throw new Error("Expected a nonnegative integer internal stage");
  if(data.ground.length!==10)throw new Error("Expected all ten recovered source themes");
  return internalStage%10;
}
export function getMapSpriteMetadata(spriteID: number, data: MapSkinData = SKINS): MapSpriteMetadata {
  const extra = MAP_SCENE_CONFIG.extraSprites as Record<string,MapSpriteMetadata>;
  const meta=data.sprites[String(spriteID)]??extra[String(spriteID)];
  if(!meta)throw new Error(`Unrecovered source Sprite ${spriteID}`);
  return meta;
}
/** Sprite_return index=(theme*4+variant)%40. Each theme has four serialized Sprite choices. */
export function getTreeSpriteID(internalStage: number,variant: number,data: MapSkinData = SKINS): number {
  if(!Number.isInteger(variant)||variant<0||variant>3)throw new Error("Expected recovered tree variant0..3");
  if(data.trees.length!==40)throw new Error("Expected all forty source tree Sprites");
  return data.trees[(getMapThemeIndex(internalStage,data)*4+variant)%data.trees.length];
}
export function getMapTheme(internalStage: number,data: MapSkinData = SKINS) {
  const index=getMapThemeIndex(internalStage,data);
  return {index,groundSpriteID:data.ground[index],upSpriteID:data.up[index],downSpriteID:data.down[index],
    treeSpriteIDs:data.trees.slice(index*4,index*4+4),exteriorColor:data.exteriorColors[index].slice()};
}
/** Original crop-relative pivot. Values outside0..1 are allowed and must not be clamped. */
export function getMapSpriteCropAnchor(meta: MapSpriteMetadata): MapPoint {
  return {x:(meta.pivot[0]*meta.rect[0]-meta.textureRectOffset[0])/meta.texturePixels[0],
    y:1-(meta.pivot[1]*meta.rect[1]-meta.textureRectOffset[1])/meta.texturePixels[1]};
}
/** Cropped PNG has top-down Y; source Sprite local geometry has Y up. */
export function mapSpritePixelToLocal(meta: MapSpriteMetadata,pixel: MapPoint,flipX=false,flipY=false): MapWorldPoint {
  return {x:(pixel.x+meta.textureRectOffset[0]-meta.pivot[0]*meta.rect[0])/meta.pixelsPerUnit*(flipX?-1:1),
    y:(meta.texturePixels[1]-pixel.y+meta.textureRectOffset[1]-meta.pivot[1]*meta.rect[1])/meta.pixelsPerUnit*(flipY?-1:1),z:0};
}
export function mapTransformPoint(matrix: MapMatrix4,p: MapWorldPoint): MapWorldPoint {
  return {x:matrix[0]*p.x+matrix[1]*p.y+matrix[2]*p.z+matrix[3],
    y:matrix[4]*p.x+matrix[5]*p.y+matrix[6]*p.z+matrix[7],z:matrix[8]*p.x+matrix[9]*p.y+matrix[10]*p.z+matrix[11]};
}
function multiply(a: MapMatrix4,b: MapMatrix4): number[] {
  return Array.from({length:16},(_,i)=>{
    const row=Math.floor(i/4),column=i%4;let result=0;
    for(let k=0;k<4;k++)result+=a[row*4+k]*b[k*4+column];return result;
  });
}
function localTRS(p: readonly number[],q: readonly number[],s: readonly number[]): number[] {
  const n=Math.hypot(...q),x=q[0]/n,y=q[1]/n,z=q[2]/n,w=q[3]/n;
  return [(1-2*(y*y+z*z))*s[0],2*(x*y-w*z)*s[1],2*(x*z+w*y)*s[2],p[0],
    2*(x*y+w*z)*s[0],(1-2*(x*x+z*z))*s[1],2*(y*z-w*x)*s[2],p[1],
    2*(x*z-w*y)*s[0],2*(y*z+w*x)*s[1],(1-2*(x*x+y*y))*s[2],p[2],0,0,0,1];
}
const TREE_RELATIVE_MATRIX = MAP_SCENE_CONFIG.treeTemplate.chain.reduce<MapMatrix4>(
  (m,node)=>multiply(m,localTRS(node.position,node.rotation,node.scale)),IDENTITY);
/** Exact shared serialized Pivot/Bounce/Skin chain; runtime bounce overrides are not inferred. */
export function getTreeWorldMatrix(rootWorld: MapWorldPoint): number[] {
  const result=TREE_RELATIVE_MATRIX.slice();result[3]+=rootWorld.x;result[7]+=rootWorld.y;result[11]+=rootWorld.z;
  return result;
}
export function getMapSpriteGeometry(spriteID: number,worldMatrix: MapMatrix4,data: MapSkinData = SKINS,
  flipX=false,flipY=false) {
  const meta=getMapSpriteMetadata(spriteID,data),[width,height]=meta.texturePixels;
  const corners=[{x:0,y:0},{x:width,y:0},{x:0,y:height},{x:width,y:height}]
    .map(p=>mapTransformPoint(worldMatrix,mapSpritePixelToLocal(meta,p,flipX,flipY)));
  const outline=meta.physicsShape?.map(p=>mapTransformPoint(worldMatrix,
    {x:p[0]*(flipX?-1:1),y:p[1]*(flipY?-1:1),z:0}))??[];
  return {spriteID,meta,url:meta.url,textureSize:{width,height},anchor:getMapSpriteCropAnchor(meta),
    corners,outline,pivotWorld:mapTransformPoint(worldMatrix,{x:0,y:0,z:0}),worldMatrix};
}
/** Exact root/pivot depth position; Sprite height and crop do not change this world point. */
export function getTreeDepthWorld(rootWorld: MapWorldPoint): MapWorldPoint { return {...rootWorld}; }
function treeTemplateMatrix(chain: readonly {position: readonly number[];rotation: readonly number[];scale: readonly number[]}[],
  rootWorld: MapWorldPoint) {
  const relative=chain.reduce<MapMatrix4>((m,n)=>multiply(m,localTRS(n.position,n.rotation,n.scale)),IDENTITY);
  return multiply([1,0,0,rootWorld.x,0,1,0,rootWorld.y,0,0,1,rootWorld.z,0,0,0,1],relative);
}
/** Slider is a sibling of Skin beneath Bounce; it does not inherit Skin's1.6 scale. */
export function getTreeHPPresentation(rootWorld: MapWorldPoint,data: MapSkinData = SKINS) {
  const present=(template: typeof MAP_SCENE_CONFIG.treeHP.slider) => ({
    ...getMapSpriteGeometry(template.spriteID,treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),sortingOrder:template.sortingOrder,evidence:"serialized HP template" as const});
  return {slider:present(MAP_SCENE_CONFIG.treeHP.slider),fill:present(MAP_SCENE_CONFIG.treeHP.fill)};
}
export function getTreePresentation(internalStage: number,variant: number,rootWorld: MapWorldPoint,data: MapSkinData = SKINS) {
  return {...getMapSpriteGeometry(getTreeSpriteID(internalStage,variant,data),getTreeWorldMatrix(rootWorld),data),
    color:MAP_SCENE_CONFIG.treeTemplate.color.slice(),depthWorld:getTreeDepthWorld(rootWorld),evidence:"serialized tree template" as const};
}
export function getMapCameraBasis(camera: MapCamera) {
  const forward=normalize(camera.forward),right=camera.right?normalize(camera.right):normalize(cross({x:0,y:1,z:0},forward));
  const up=camera.up?normalize(camera.up):normalize(cross(forward,right));return {right,up,forward};
}
export function projectMapWorld(point: MapWorldPoint,camera: MapCamera,pixelsPerWorldUnit: number,
  cameraRoot: MapWorldPoint={x:0,y:0,z:0},screenOrigin: MapPoint={x:0,y:0}): MapPoint {
  const b=getMapCameraBasis(camera),p=subtract(point,cameraRoot);
  return {x:screenOrigin.x+dot(b.right,p)*pixelsPerWorldUnit,y:screenOrigin.y-dot(b.up,p)*pixelsPerWorldUnit};
}
/** Affine maps unanchored cropped PNG pixel coordinates directly into parent screen coordinates. */
export function projectMapSprite(geometry: ReturnType<typeof getMapSpriteGeometry>,camera: MapCamera,
  pixelsPerWorldUnit: number,cameraRoot: MapWorldPoint={x:0,y:0,z:0},screenOrigin: MapPoint={x:0,y:0}) {
  const corners=geometry.corners.map(p=>projectMapWorld(p,camera,pixelsPerWorldUnit,cameraRoot,screenOrigin));
  const [tl,tr,bl]=corners,{width,height}=geometry.textureSize;
  const transform={a:(tr.x-tl.x)/width,b:(tr.y-tl.y)/width,c:(bl.x-tl.x)/height,d:(bl.y-tl.y)/height,tx:tl.x,ty:tl.y};
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  return {transform,corners,pivot:projectMapWorld(geometry.pivotWorld,camera,pixelsPerWorldUnit,cameraRoot,screenOrigin),
    bounds:{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}};
}
/** Source values remain unmodified floats; tintRGB is an8-bit Pixi adapter, without gamma conversion. */
export function mapColorToPixi(color: readonly number[]) {
  const byte=(value:number)=>Math.round(Math.max(0,Math.min(1,value))*255);
  return {tintRGB:(byte(color[0])<<16)|(byte(color[1])<<8)|byte(color[2]),alpha:color[3],sourceRGBA:color.slice()};
}
export function getMapBorderColor(rendererID: number) {
  const color=(MAP_SCENE_CONFIG.borderColors as Record<string,number[]>)[String(rendererID)];
  if(!color)throw new Error(`Unrecovered border renderer ${rendererID}`);
  return mapColorToPixi(color);
}
export function getMapSpawn() {
  const p=MAP_SCENE_CONFIG.spawn.worldPosition;
  return {position:{x:p[0],y:p[1],z:p[2]},worldMatrix:MAP_SCENE_CONFIG.spawn.worldMatrix.slice(),
    transformID:MAP_SCENE_CONFIG.spawn.transformID,evidence:MAP_SCENE_CONFIG.spawn.scope};
}
export function getMapGroundPresentation(internalStage: number,data: MapSkinData = SKINS) {
  return {...getMapSpriteGeometry(getMapTheme(internalStage,data).groundSpriteID,MAP_SCENE_CONFIG.ground.worldMatrix,data),
    ...mapColorToPixi(MAP_SCENE_CONFIG.ground.color),textureRepeat:MAP_SCENE_CONFIG.ground.textureRepeat.slice(),
    textureOffset:MAP_SCENE_CONFIG.ground.textureOffset.slice(),sortingOrder:MAP_SCENE_CONFIG.ground.sortingOrder,
    materialID:MAP_SCENE_CONFIG.ground.materialID};
}
/**
 * Full source texture pixels -> world -> screen for a serialized full-Sprite UV repeat candidate.
 * Material UV is uv*repeat+offset (Y up); tile pixels are top-down. This is not a live shader claim.
 */
export function getMapGroundTileProjection(internalStage: number,camera: MapCamera,pixelsPerWorldUnit: number,
  data: MapSkinData = SKINS,cameraRoot: MapWorldPoint={x:0,y:0,z:0},screenOrigin: MapPoint={x:0,y:0}) {
  return projectGroundRepeat(getMapGroundPresentation(internalStage,data),MAP_SCENE_CONFIG.ground.sourceTransform.scale,
    camera,pixelsPerWorldUnit,cameraRoot,screenOrigin);
}
export function projectGroundRepeat(ground:ReturnType<typeof getMapGroundPresentation>,sourceScale:readonly number[],
  camera:MapCamera,pixelsPerWorldUnit:number,cameraRoot:MapWorldPoint,screenOrigin:MapPoint) {
  const m=ground.worldMatrix,meta=ground.meta;
  const [repeatX,repeatY]=ground.textureRepeat,[offsetX,offsetY]=ground.textureOffset;
  const [width,height]=meta.rect,ppu=meta.pixelsPerUnit;
  // The repeating tile uses the full source Sprite rect, not an arbitrarily trimmed texture.
  const topLeftLocal={x:(-offsetX/repeatX-meta.pivot[0])*width/ppu,
    y:((1-offsetY)/repeatY-meta.pivot[1])*height/ppu,z:0};
  const tileOriginWorld=mapTransformPoint(m,topLeftLocal);
  const origin=mapTransformPoint(m,{x:0,y:0,z:0});
  const xAxis=subtract(mapTransformPoint(m,{x:1/(ppu*repeatX),y:0,z:0}),origin);
  const yAxis=subtract(mapTransformPoint(m,{x:0,y:-1/(ppu*repeatY),z:0}),origin);
  const pixelToWorld=[xAxis.x,yAxis.x,0,tileOriginWorld.x,xAxis.y,yAxis.y,0,tileOriginWorld.y,
    xAxis.z,yAxis.z,0,tileOriginWorld.z,0,0,0,1];
  const p=projectMapWorld(tileOriginWorld,camera,pixelsPerWorldUnit,cameraRoot,screenOrigin);
  const basis=getMapCameraBasis(camera);
  const transform={a:dot(basis.right,xAxis)*pixelsPerWorldUnit,b:-dot(basis.up,xAxis)*pixelsPerWorldUnit,
    c:dot(basis.right,yAxis)*pixelsPerWorldUnit,d:-dot(basis.up,yAxis)*pixelsPerWorldUnit,tx:p.x,ty:p.y};
  const fullSpriteTopLeftWorld=mapTransformPoint(m,{x:-meta.pivot[0]*width/ppu,y:(1-meta.pivot[1])*height/ppu,z:0});
  const tileX={x:transform.a*width,y:transform.b*width},tileY={x:transform.c*height,y:transform.d*height};
  const worldAxes={x:subtract(mapTransformPoint(m,{x:1,y:0,z:0}),origin),
    y:subtract(mapTransformPoint(m,{x:0,y:1,z:0}),origin),z:subtract(mapTransformPoint(m,{x:0,y:0,z:1}),origin)};
  return {transform,pixelToWorld,tileX,tileY,tileOriginWorld,worldAxes,
    fullSpriteTopLeftWorld,fullSpriteTopLeftTilePixel:{x:offsetX*width,y:(1-repeatY-offsetY)*height},
    sourceRect:meta.rect.slice(),sourcePPU:ppu,sourceScale:sourceScale.slice(),
    sourcePivot:meta.pivot.slice(),sourceCropOffset:meta.textureRectOffset.slice(),sourceTexturePixels:meta.texturePixels.slice(),
    sourceWorldMatrix:m.slice(),repeat:ground.textureRepeat.slice(),offset:ground.textureOffset.slice(),
    tintRGB:ground.tintRGB,alpha:ground.alpha,sourceRGBA:ground.sourceRGBA,
    evidence:"serialized material repeat; live shader UV not observed" as const};
}
/** Near surface is a black alpha rectangle. Far surface takes the selected theme's exterior color. */
export function getMapSurfacePresentations(internalStage: number,data: MapSkinData = SKINS) {
  const theme=getMapTheme(internalStage,data);
  const near=MAP_SCENE_CONFIG.nearSurfaces.map(r=>({...getMapSpriteGeometry(r.spriteID,r.worldMatrix,data),
    rendererID:r.rendererID,gridTransformID:r.gridTransformID,sortingOrder:r.sortingOrder,...mapColorToPixi(r.color)}));
  const far=MAP_SCENE_CONFIG.farSurfaces.map(r=>({...getMapSpriteGeometry(r.spriteID,r.worldMatrix,data),
    rendererID:r.rendererID,gridTransformID:r.gridTransformID,sortingOrder:r.sortingOrder,...mapColorToPixi(theme.exteriorColor)}));
  return {near,far};
}

/** Independent BossTree body TRS. Theme variant3 is explicit; live Sprite selection remains unobserved. */
export function getBossTreePresentation(internalStage:number,rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  const template=MAP_SCENE_CONFIG.boss.body;
  return {...getMapSpriteGeometry(getTreeSpriteID(internalStage,3,data),treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),color:template.color.slice(),depthWorld:{...rootWorld},
    sortingOrder:template.sortingOrder,evidence:"serialized BossTree TRS; source theme variant3 candidate" as const};
}
export function getBossHP(rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  const present=(template:typeof MAP_SCENE_CONFIG.boss.hp.slider)=>({
    ...getMapSpriteGeometry(template.spriteID,treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),sortingOrder:template.sortingOrder,evidence:"serialized BossTree HP" as const});
  return {slider:present(MAP_SCENE_CONFIG.boss.hp.slider),fill:present(MAP_SCENE_CONFIG.boss.hp.fill)};
}
/** Mine ore type is the source Ore.Spawn choice0(normal)/1(diamond); root is absolute world position. */
export function getMineOrePresentation(oreType:number,rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  if(oreType!==0&&oreType!==1)throw new Error("Expected source mine oreType0 or1");
  const spriteID=MAP_SCENE_CONFIG.mine.oreSprites[oreType];
  const template=MAP_SCENE_CONFIG.mine.templates.skin.profiles.find(t=>t.spriteID===spriteID);
  if(!template)throw new Error(`Unrecovered source ore Sprite ${spriteID}`);
  return {...getMapSpriteGeometry(spriteID,treeTemplateMatrix(template.chain,rootWorld),data),
    url:MAP_SCENE_CONFIG.mine.oreURLs[oreType],...mapColorToPixi(template.color),color:template.color.slice(),
    depthWorld:{...rootWorld},sortingOrder:template.sortingOrder,evidence:"serialized mine ore template" as const};
}
export function getMineOreHP(rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  const present=(template:typeof MAP_SCENE_CONFIG.mine.templates.slider.profiles[number])=>({
    ...getMapSpriteGeometry(template.spriteID,treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),sortingOrder:template.sortingOrder,evidence:"serialized mine HP template" as const});
  return {slider:present(MAP_SCENE_CONFIG.mine.templates.slider.profiles[0]),
    fill:present(MAP_SCENE_CONFIG.mine.templates.fill.profiles[0])};
}
export function getMineGroundPresentation(data:MapSkinData=SKINS) {
  const source=MAP_SCENE_CONFIG.mine.ground;
  return {...getMapSpriteGeometry(source.spriteID,source.worldMatrix,data),...mapColorToPixi(source.color),
    textureRepeat:source.textureRepeat.slice(),textureOffset:source.textureOffset.slice(),
    sortingOrder:source.sortingOrder,materialID:source.materialID};
}
export function getMineGroundTileProjection(camera:MapCamera,pixelsPerWorldUnit:number,data:MapSkinData=SKINS,
  cameraRoot:MapWorldPoint={x:0,y:0,z:0},screenOrigin:MapPoint={x:0,y:0}) {
  return {...projectGroundRepeat(getMineGroundPresentation(data),MAP_SCENE_CONFIG.mine.ground.sourceTransform.scale,
    camera,pixelsPerWorldUnit,cameraRoot,screenOrigin),
    evidence:"serialized Mine material repeat; live shader UV not observed" as const};
}
/** Source190 SpeedRun trees share ordinary body TRS; their live variant distribution is not captured. */
export function getChallengeTreePresentation(internalStage:number,variant:number,rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  const template=MAP_SCENE_CONFIG.challenge.profiles[0];
  return {...getMapSpriteGeometry(getTreeSpriteID(internalStage,variant,data),treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),color:template.color.slice(),depthWorld:{...rootWorld},sortingOrder:template.sortingOrder,
    evidence:"serialized SpeedRun body TRS; live variant distribution not observed" as const};
}
/** SpeedRun Slider is under Pivot directly, outside Bounce, unlike ordinary HP. */
export function getChallengeHP(rootWorld:MapWorldPoint,data:MapSkinData=SKINS) {
  const present=(template:typeof MAP_SCENE_CONFIG.challenge.hp.slider)=>({
    ...getMapSpriteGeometry(template.spriteID,treeTemplateMatrix(template.chain,rootWorld),data),
    ...mapColorToPixi(template.color),sortingOrder:template.sortingOrder,evidence:"serialized SpeedRun HP" as const});
  return {slider:present(MAP_SCENE_CONFIG.challenge.hp.slider),fill:present(MAP_SCENE_CONFIG.challenge.hp.fill)};
}

/** Full source SpeedRun ground TRS and exact Sprite render mesh boundary (local plane units). */
export function getChallengeGroundPresentation(data:MapSkinData=SKINS) {
  const source=MAP_SCENE_CONFIG.challenge.ground,mesh=source.renderMesh;
  const geometry=getMapSpriteGeometry(source.spriteID,source.worldMatrix,data,source.flipX,source.flipY);
  const verticesLocal=mesh.vertices.map(v=>({x:v[0],y:v[1],z:v[2]}));
  const verticesWorld=verticesLocal.map(v=>mapTransformPoint(source.worldMatrix,v));
  return {...geometry,...mapColorToPixi(source.color),rendererID:source.rendererID,
    textureRepeat:source.textureRepeat.slice(),textureOffset:source.textureOffset.slice(),
    sortingOrder:source.sortingOrder,materialID:source.materialID,materialShaderID:source.materialShaderID,
    renderMesh:{verticesLocal,verticesWorld,indices:mesh.indices.slice(),
      boundaryVertexIndices:mesh.boundaryVertexIndices.slice(),sourceUV0:mesh.sourceUV0.map(v=>v.slice())},
    boundaryWorld:mesh.boundaryVertexIndices.map(i=>({...verticesWorld[i]})),
    boundaryShape:mesh.shape,textureAlphaExtrema:mesh.textureAlphaExtrema.slice(),
    evidence:"serialized SpeedRun ground TRS and Sprite.m_RD render mesh; live shader not observed" as const};
}
/** Source material repeat over the full rectangular SpeedRun Sprite plane; boundary is screen polygon. */
export function getChallengeGroundTileProjection(camera:MapCamera,pixelsPerWorldUnit:number,data:MapSkinData=SKINS,
  cameraRoot:MapWorldPoint={x:0,y:0,z:0},screenOrigin:MapPoint={x:0,y:0}) {
  const ground=getChallengeGroundPresentation(data);
  return {...projectGroundRepeat(ground,MAP_SCENE_CONFIG.challenge.ground.sourceTransform.scale,
    camera,pixelsPerWorldUnit,cameraRoot,screenOrigin),
    boundaryWorld:ground.boundaryWorld,boundaryScreen:ground.boundaryWorld.map(v=>
      projectMapWorld(v,camera,pixelsPerWorldUnit,cameraRoot,screenOrigin)),
    renderMesh:ground.renderMesh,boundaryShape:ground.boundaryShape,
    evidence:"serialized SpeedRun material repeat and rectangular Sprite render mesh; live shader not observed" as const};
}
