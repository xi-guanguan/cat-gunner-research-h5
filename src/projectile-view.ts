import muzzlePresentation from './data/fx-muzzle-presentation.json';
import { Assets, BLEND_MODES, Container, Rectangle, SimpleMesh, Sprite, Texture } from 'pixi.js';

/** Source-timed H5 particle presentation adapter. It is not Unity ParticleSystem. */
export const PROJECTILE_PRESENTATION_URL = '/assets/data/projectile-presentation.json';
export type Vec3 = { x:number;y:number;z:number };
export type WorldBasis = {right:Vec3;up:Vec3;forward:Vec3};
type Quaternion = readonly [number,number,number,number];
type RGBA = readonly number[];
export interface ProjectileCurve {mode:number;scalar:number;minScalar?:number;maxCurve?:CurveKey[];minCurve?:CurveKey[]}
interface CurveKey {time:number;value:number;inSlope:number;outSlope:number}
interface Gradient {mode:number;colorKeys:{time16:number;rgba:RGBA}[];alphaKeys:{time16:number;alpha:number}[]}
interface ParticleColor {mode:number;min:RGBA;max:RGBA;minGradient?:Gradient;maxGradient?:Gradient}
export interface ParticleRecord {
  name:string;chainTransformIDs:number[];durationSeconds:number;looping:boolean;activeSelf:boolean;
  startDelay:ProjectileCurve;simulationSpeed:number;simulationSpace?:number;enabledModules:string[];
  emission:{enabled:boolean;rateOverTime:ProjectileCurve;rateOverDistance:ProjectileCurve;
    bursts:{time:number;count:ProjectileCurve;cycles:number;interval:number;probability:number}[]};
  sizeOverLifetime:{enabled:boolean;separateAxes:boolean;x:ProjectileCurve;y:ProjectileCurve;z:ProjectileCurve};
  colorOverLifetime:{enabled:boolean;color:ParticleColor};
  rotationOverLifetime:{enabled:boolean;separateAxes:boolean;z:ProjectileCurve};
  shape:{enabled:boolean;type:number;angle:number;length:number;radius:number;radiusThickness:number;
    m_Position:Vec3;m_Rotation:Vec3;m_Scale:Vec3};
  initial:{startLifetime:ProjectileCurve;startSpeed:ProjectileCurve;startSize:ProjectileCurve;startSizeY:ProjectileCurve;startSizeZ:ProjectileCurve;
    startRotation:ProjectileCurve;startRotationX:ProjectileCurve;startRotationY:ProjectileCurve;
    startColor:ParticleColor;size3D:boolean;rotation3D:boolean;scalingMode:number};
  renderer:{enabled:boolean;m_RenderMode:number;m_SortingOrder:number;m_LengthScale:number;m_VelocityScale:number;
    m_FreeformStretching?:boolean;m_RotateWithStretchDirection?:boolean;
    m_Pivot:{x:number;y:number;z:number};m_Flip:{x:number;y:number;z:number};materialKeys:string[];meshKeys:string[]};
  textureSheetAnimation:{enabled:boolean;tilesX?:number;tilesY?:number;animationType?:number;rowIndex?:number;
    rowMode?:number;timeMode?:number;fps?:number;cycles?:number;frameOverTime?:ProjectileCurve;startFrame?:ProjectileCurve};
}
interface MaterialRecord {shader?:{name:string};textures:Record<string,{textureKey:string;repeat:number[];offset:number[]}>;
  colors:Record<string,RGBA>;renderProperties:Record<string,number>}
interface Template {name:string;rootParticleKey:string;allParticleKeys:string[];bodyParticleKeys?:string[];emptyExplicitBodyList?:boolean}
export interface ProjectilePresentation {
  schemaVersion:number;gunBindings:{gunNum:number;gunType:number;templateKey:string;impactFXTemplateKey:string}[];
  templates:Record<string,Template>;fxTemplates:Record<string,Template>;particles:Record<string,ParticleRecord>;
  transforms:Record<string,{position:number[];rotation:number[];scale:number[]}>;
  materials:Record<string,MaterialRecord>;textures:Record<string,{url:string;pixels:number[]}>;
  meshes:Record<string,{objURL?:string;geometryStatus?:string}>;
}
export interface ProjectileViewOptions {
  /** Quaternion of the source camera. Omitted: orthographic XY preview. */
  cameraRotation?:Quaternion;
  /** Dynamic source Bullet/FX root rotation, before relative serialized transforms. */
  rootRotation?:Quaternion;
  /** Overrides camera projection, takes a relative world vector and returns pixels. */
  projectOffset?:(offset:Vec3,pixelsPerWorldUnit:number)=>{x:number;y:number};
  seed?:number;
  /** H5 stretched-billboard adapter; actual Unity particle velocity is not simulated. */
  velocityWorldPerSecond?:number;
  directionRadians?:number;
  /** Source world position of the emitter at creation; update with advanceProjectileView. */
  rootWorldPosition?:Vec3;
  /** Parent world scale of an attached Muzzle (its own source scale remains in the particle chain). */
  rootScaleWorld?:Vec3;
  /** Exact parent matrix columns, retaining recoil scale/shear when supplied by CatRig. */
  rootBasisWorld?:WorldBasis;
}
export interface ProjectileViewInfo {
  adapter:'H5_SOURCE_RENDERER_SAMPLE_NOT_UNITY_PARTICLE_SIMULATION';gunNum:number;kind:'projectile'|'impact'|'muzzle';
  templateKey:string;selectedParticleKeys:string[];normalChildFallback:boolean;omissions:string[];
  suggestedDurationSeconds:number;ageSeconds:number;liveParticleCount:number;completed:boolean;
}
export type ProjectileView = Container & {presentation:ProjectileViewInfo};
interface ObjMesh {vertices:Vec3[];uvs:number[];indices:number[]}
interface Layer {particleKey:string;particle:ParticleRecord;material:MaterialRecord;texture:Texture;
  sprite?:Sprite;mesh?:SimpleMesh;geometry?:ObjMesh;random:number;birthSeconds:number;sampleIndex:number;birthWorld:Vec3;birthRotation:Quaternion;birthBasis?:WorldBasis;birthScale?:Vec3}
let data:ProjectilePresentation|undefined;
let loading:Promise<ProjectilePresentation>|undefined;
let assetsLoading:Promise<void>|undefined;
const objMeshes = new Map<string,ObjMesh>();
const frameTextures = new Map<string,Texture>();
interface Emitter {particleKey:string;particle:ParticleRecord;random:number;distanceRemainder:number;sequence:number;spawn:(birth:number,world:Vec3,rotation:Quaternion)=>Layer|undefined}
interface ViewState {layers:Layer[];emitters:Emitter[];options:ProjectileViewOptions;age:number;world:Vec3;stoppedAt:number|null;clearOnStop:Set<string>}
const liveViews = new WeakMap<ProjectileView,ViewState>();
const identity:Quaternion=[0,0,0,1];
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const fract=(n:number)=>n-Math.floor(n);

export async function loadProjectilePresentation(url=PROJECTILE_PRESENTATION_URL):Promise<ProjectilePresentation> {
  if(data)return data;
  if(!loading)loading=fetch(url).then(async response=>{
    if(!response.ok)throw new Error(`Projectile presentation HTTP ${response.status}`);
    const parsed = await response.json() as ProjectilePresentation;
    if(parsed.schemaVersion!==1||parsed.gunBindings.length!==65)throw new Error('Unsupported projectile presentation contract');
    Object.assign(parsed.particles,muzzlePresentation.particles);Object.assign(parsed.transforms,muzzlePresentation.transforms);
    Object.assign(parsed.materials,muzzlePresentation.materials);Object.assign(parsed.textures,muzzlePresentation.textures);
    data=parsed;return parsed;
  }).catch(error=>{loading=undefined;throw error;});
  return loading;
}
function requiredData():ProjectilePresentation {
  if(!data)throw new Error('Call and await loadProjectileViewAssets() before creating projectile views');
  return data;
}
export function getProjectileTextureURLs(presentation=requiredData()):string[] {
  return [...new Set(Object.values(presentation.textures).map(t=>t.url))];
}
export function getProjectileMeshURLs(presentation=requiredData()):string[] {
  return [...new Set(Object.values(presentation.meshes).flatMap(m=>m.objURL?[m.objURL]:[]))];
}
/** Loads compact public JSON, original PNGs and available original OBJ meshes; no JSON bundle import. */
export async function loadProjectileViewAssets():Promise<void> {
  if(!assetsLoading)assetsLoading=(async()=>{
    const source=await loadProjectilePresentation();
    await Promise.all([Assets.load(getProjectileTextureURLs(source)),...getProjectileMeshURLs(source).map(async url=>{
      const response=await fetch(url);if(!response.ok)throw new Error(`Projectile OBJ ${url}: HTTP ${response.status}`);
      objMeshes.set(url,parseOBJ(await response.text()));
    })]);
  })().catch(error=>{assetsLoading=undefined;throw error;});
  return assetsLoading;
}
/** The starter-single-d alias is explicitly mapped to source gun 0. Invalid IDs throw. */
export function resolveProjectileGunNum(weaponId:string|number|{sourceGunNum:number}):number {
  const value=typeof weaponId==='object'?weaponId.sourceGunNum:typeof weaponId==='number'?weaponId:
    weaponId==='starter-single-d'?0:Number(weaponId.match(/^source-gun-(\d+)$/)?.[1]??NaN);
  if(!Number.isInteger(value)||value<0||value>64)throw new Error(`Unknown source gun: ${String(weaponId)}`);
  return value;
}
function curveAt(keys:CurveKey[]|undefined,t:number):number {
  if(!keys?.length)return 0;
  if(t<=keys[0].time)return keys[0].value;
  for(let i=1;i<keys.length;i++)if(t<=keys[i].time){
    const a=keys[i-1],b=keys[i],span=b.time-a.time;if(span<=0)return b.value;
    if(!Number.isFinite(a.outSlope)||!Number.isFinite(b.inSlope))return a.value;
    const u=(t-a.time)/span,u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*a.value+(u3-2*u2+u)*span*a.outSlope+(-2*u3+3*u2)*b.value+(u3-u2)*span*b.inSlope;
  }
  return keys[keys.length-1].value;
}
/** Unity serialized MinMaxCurve modes: constant / curve / two curves / two constants. */
export function evaluateProjectileCurve(c:ProjectileCurve,t:number,random=.5):number {
  if(c.mode===0)return c.scalar;
  if(c.mode===1)return c.scalar*curveAt(c.maxCurve,t);
  if(c.mode===2)return mix((c.minScalar??c.scalar)*curveAt(c.minCurve,t),c.scalar*curveAt(c.maxCurve,t),random);
  if(c.mode===3)return mix(c.minScalar??c.scalar,c.scalar,random);
  return c.scalar;
}
function gradientAt(g:Gradient|undefined,t:number,fallback:RGBA):number[] {
  if(!g)return [...fallback];
  const sample=<T>(keys:T[],time:(key:T)=>number,value:(key:T)=>number[]):number[]=>{
    if(!keys.length)return [...fallback];if(t<=time(keys[0]))return value(keys[0]);
    for(let i=1;i<keys.length;i++)if(t<=time(keys[i])){
      const a=keys[i-1],b=keys[i],f=g.mode===1?0:clamp((t-time(a))/(time(b)-time(a)||1));
      return value(a).map((v,j)=>mix(v,value(b)[j],f));
    }return value(keys[keys.length-1]);
  };
  const color=sample(g.colorKeys,k=>k.time16/65535,k=>[...k.rgba]);
  color[3]=sample(g.alphaKeys,k=>k.time16/65535,k=>[k.alpha])[0];return color;
}
function colorAt(c:ParticleColor,t:number,r:number):number[] {
  if(c.mode===0)return [...c.max];
  if(c.mode===2)return c.min.map((v,i)=>mix(v,c.max[i],r));
  if(c.mode===3){const a=gradientAt(c.minGradient,t,c.min),b=gradientAt(c.maxGradient,t,c.max);return a.map((v,i)=>mix(v,b[i],r));}
  return gradientAt(c.maxGradient,c.mode===4?r:t,c.max);
}
/** Start curves use emitter birth phase; life modules and UV use individual particle phase. */
export function sampleProjectileParticle(p:ParticleRecord,ageSeconds:number,random=.5,birthSeconds:number|null=0,repeatLoop=true) {
  const speed=Math.max(.0001,p.simulationSpeed),delay=Math.max(0,evaluateProjectileCurve(p.startDelay,0,random));
  const local=ageSeconds*speed-delay,duration=Math.max(.001,p.durationSeconds);
  const rate=Math.max(0,evaluateProjectileCurve(p.emission.rateOverTime,0,random));
  // A continuous emitter's one representative follows its newest actual scheduled birth.
  let birth=birthSeconds;
  if(birth===null){const emissionAge=p.looping?Math.max(0,local):Math.min(Math.max(0,local),duration-1e-8);
    birth=rate>0?Math.floor(emissionAge*rate)/rate:Infinity;
    if(birth<1/rate)birth=Infinity;}
  else if(repeatLoop&&p.looping&&local>=birth)birth+=Math.floor((local-birth)/duration)*duration;
  const emitterPhase=clamp((birth%duration)/duration),particleAge=local-birth;
  const lifetime=Math.max(0,evaluateProjectileCurve(p.initial.startLifetime,emitterPhase,random));
  const alive=p.renderer.enabled&&p.emission.enabled&&local>=0&&particleAge>=0&&particleAge<lifetime;
  const lifePhase=lifetime>0?clamp(particleAge/lifetime):1;
  const size=evaluateProjectileCurve(p.initial.startSize,emitterPhase,random);
  const y=p.initial.size3D?evaluateProjectileCurve(p.initial.startSizeY,emitterPhase,random):size;
  const z=p.initial.size3D?evaluateProjectileCurve(p.initial.startSizeZ,emitterPhase,random):size;
  const over=p.sizeOverLifetime,mx=over.enabled?evaluateProjectileCurve(over.x,lifePhase,random):1;
  const my=over.enabled&&over.separateAxes?evaluateProjectileCurve(over.y,lifePhase,random):mx;
  const mz=over.enabled&&over.separateAxes?evaluateProjectileCurve(over.z,lifePhase,random):mx;
  const startColor=colorAt(p.initial.startColor,emitterPhase,random);
  const lifeColor=p.colorOverLifetime.enabled?colorAt(p.colorOverLifetime.color,lifePhase,random):[1,1,1,1];
  return {alive,particleAge,lifetime,lifePhase,emitterPhase,size:Math.abs(size*mx),sizeY:Math.abs(y*my),
    sizeZ:Math.abs(z*mz),color:startColor.map((v,i)=>v*lifeColor[i]),
    endSeconds:(delay+birth+lifetime)/speed};
}
export function projectileBurstBirths(p:ParticleRecord,random=.5):number[] {
  if(!p.emission.enabled)return [];
  const births:number[]=[];
  for(const b of p.emission.bursts){
    if(random>b.probability)continue;
    const cycles=b.cycles>0?b.cycles:Math.ceil(Math.max(0,p.durationSeconds-b.time)/Math.max(.001,b.interval));
    for(let i=0;i<cycles;i++){const birth=b.time+i*b.interval;if(birth>=p.durationSeconds)break;
      const count=Math.max(0,Math.round(evaluateProjectileCurve(b.count,birth/p.durationSeconds,random)));
      for(let j=0;j<count;j++)births.push(birth);}
  }return births;
}
export interface ProjectileEmissionBirth {localSeconds:number;world:Vec3}
/** Source emission rates are constants in all inspected projectile/Muzzle records. Distance is WORLD distance. */
export function projectileEmissionSegment(p:ParticleRecord,fromSeconds:number,toSeconds:number,fromWorld:Vec3,toWorld:Vec3,distanceRemainder=0,random=.5):{births:ProjectileEmissionBirth[];distanceRemainder:number} {
  const births:ProjectileEmissionBirth[]=[];if(!p.emission.enabled||toSeconds<fromSeconds)return {births,distanceRemainder};
  const speed=Math.max(.0001,p.simulationSpeed),delay=evaluateProjectileCurve(p.startDelay,0,random),duration=Math.max(.001,p.durationSeconds);
  const from=fromSeconds*speed-delay,to=toSeconds*speed-delay,lo=Math.max(0,from),hi=p.looping?to:Math.min(to,duration-1e-9);
  // A fixed step can publish birth and collision at the same authoritative timestamp.
  // Its measured path still owns distance emission; it creates no fictitious time burst.
  if(toSeconds===fromSeconds){
    const rate=evaluateProjectileCurve(p.emission.rateOverDistance,0,random),distance=Math.hypot(toWorld.x-fromWorld.x,toWorld.y-fromWorld.y,toWorld.z-fromWorld.z);
    if(from<0||(!p.looping&&from>=duration)||rate<=0||distance===0)return {births,distanceRemainder};
    const total=distanceRemainder+distance*rate,count=Math.floor(total+1e-8);
    for(let n=1;n<=count;n++){const f=(n-distanceRemainder)/(distance*rate);births.push({localSeconds:from,world:{x:mix(fromWorld.x,toWorld.x,f),y:mix(fromWorld.y,toWorld.y,f),z:mix(fromWorld.z,toWorld.z,f)}});}
    return {births,distanceRemainder:total-count};
  }
  if(hi<=lo)return {births,distanceRemainder};
  const at=(local:number)=>{const fraction=clamp((local-from)/(to-from));return {x:mix(fromWorld.x,toWorld.x,fraction),y:mix(fromWorld.y,toWorld.y,fraction),z:mix(fromWorld.z,toWorld.z,fraction)};};
  const add=(localSeconds:number,count=1)=>{for(let i=0;i<count;i++)births.push({localSeconds,world:at(localSeconds)});};
  const rate=evaluateProjectileCurve(p.emission.rateOverTime,0,random);
  if(rate>0)for(let n=Math.floor(lo*rate+1e-8)+1;n/rate<=hi+1e-8;n++)add(n/rate);
  const distanceRate=evaluateProjectileCurve(p.emission.rateOverDistance,0,random),a=at(lo),b=at(hi),distance=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  if(distanceRate>0&&distance>0){const total=distanceRemainder+distance*distanceRate,count=Math.floor(total+1e-8);
    for(let n=1;n<=count;n++)add(mix(lo,hi,(n-distanceRemainder)/(distance*distanceRate)));
    distanceRemainder=total-count;}
  const firstLoop=p.looping?Math.max(0,Math.floor(lo/duration)):0,lastLoop=p.looping?Math.floor(hi/duration):0;
  for(let loop=firstLoop;loop<=lastLoop;loop++)for(const burst of p.emission.bursts){if(random>burst.probability)continue;
    const cycles=burst.cycles>0?burst.cycles:Math.ceil((duration-burst.time)/Math.max(.001,burst.interval));
    for(let cycle=0;cycle<cycles;cycle++){const local=burst.time+cycle*burst.interval;if(local>=duration)break;
      const birth=loop*duration+local;if(birth>from+1e-8&&birth<=hi+1e-8)add(birth,Math.max(0,Math.round(evaluateProjectileCurve(burst.count,local/duration,random))));}}
  return {births:births.sort((a,b)=>a.localSeconds-b.localSeconds),distanceRemainder};
}
/** Skin_Reload activates the selected root; inactive descendants stay inactive. */
export function shouldPresentProjectileParticle(p:ParticleRecord,isSelectedRoot:boolean):boolean {
  return p.renderer.enabled&&(p.activeSelf||isSelectedRoot);
}
export function projectileMaterialBlend(material:MaterialRecord):BLEND_MODES {
  // APK sharedassets0.assets Shader:221 parsed pass rtBlend0 is hardcoded 5/10,
  // zWrite=0 and culling=0. This legacy shader does NOT consume the material's
  // stale _SrcBlend=1/_DstBlend=0 saved values. NONE would overwrite every mesh
  // face's transparent texels, exposing opaque triangle/UV bands.
  if(material.shader?.name==='Legacy Shaders/Particles/Alpha Blended')return BLEND_MODES.NORMAL;
  // URP consumes saved blend properties. Asset names such as ADD are not authoritative.
  return material.renderProperties._DstBlend===0?BLEND_MODES.NONE:
    material.renderProperties._DstBlend===1?BLEND_MODES.ADD:BLEND_MODES.NORMAL;
}
function rotate(q:readonly number[],v:Vec3):Vec3 {
  const [x,y,z,w]=q,tx=2*(y*v.z-z*v.y),ty=2*(z*v.x-x*v.z),tz=2*(x*v.y-y*v.x);
  return {x:v.x+w*tx+y*tz-z*ty,y:v.y+w*ty+z*tx-x*tz,z:v.z+w*tz+x*ty-y*tx};
}
function particlePoint(p:ParticleRecord,v:Vec3,o:ProjectileViewOptions,translate=true):Vec3 {
  const source=requiredData();let result=v;
  for(let i=p.chainTransformIDs.length-1;i>=0;i--){
    const trs=source.transforms[String(p.chainTransformIDs[i])];
    result=rotate(trs.rotation,{x:result.x*trs.scale[0],y:result.y*trs.scale[1],z:result.z*trs.scale[2]});
    if(translate)result={x:result.x+trs.position[0],y:result.y+trs.position[1],z:result.z+trs.position[2]};
  }
  const basis=o.rootBasisWorld;
  if(basis)return {x:basis.right.x*result.x+basis.up.x*result.y+basis.forward.x*result.z,y:basis.right.y*result.x+basis.up.y*result.y+basis.forward.y*result.z,z:basis.right.z*result.x+basis.up.z*result.y+basis.forward.z*result.z};
  const scale=o.rootScaleWorld??{x:1,y:1,z:1};
  return rotate(o.rootRotation??identity,{x:result.x*scale.x,y:result.y*scale.y,z:result.z*scale.z});
}
function project(v:Vec3,scale:number,o:ProjectileViewOptions):{x:number;y:number} {
  if(o.projectOffset)return o.projectOffset(v,scale);
  const q=o.cameraRotation??identity,local=rotate([-q[0],-q[1],-q[2],q[3]],v);
  return {x:local.x*scale,y:-local.y*scale};
}
function axisLength(p:ParticleRecord,axis:Vec3,o:ProjectileViewOptions):number {
  const v=particlePoint(p,axis,o,false);return Math.hypot(v.x,v.y,v.z);
}
function parseOBJ(text:string):ObjMesh {
  const vertices:Vec3[]=[],uv:number[][]=[],expanded:Vec3[]=[],uvs:number[]=[],indices:number[]=[];
  for(const line of text.split(/\r?\n/)){
    const fields=line.trim().split(/\s+/);
    // UnityPy OBJ exporter negates Unity X; restore it before source TRS/camera projection.
    if(fields[0]==='v')vertices.push({x:-Number(fields[1]),y:Number(fields[2]),z:Number(fields[3])});
    else if(fields[0]==='vt')uv.push([Number(fields[1]),1-Number(fields[2])]);
    else if(fields[0]==='f'){
      const face=fields.slice(1).map(token=>{
        const [v,t]=token.split('/').map(Number),index=expanded.length;
        const point=vertices[v<0?vertices.length+v:v-1];if(!point)throw new Error('Invalid source OBJ vertex');
        expanded.push(point);uvs.push(...(uv[t<0?uv.length+t:t-1]??[0,0]));return index;
      });
      for(let i=1;i+1<face.length;i++)indices.push(face[0],face[i],face[i+1]);
    }
  }
  if(expanded.length>65535)throw new Error('Source OBJ exceeds adapter Uint16 vertex limit');
  return {vertices:expanded,uvs,indices};
}
/** Unity ZXY Euler order. Shape rotation changes both spawn position and direction. */
function rotateShapeEuler(v:Vec3,degrees:Vec3):Vec3 {
  let result=v;
  for(const [axis,angle] of [[{x:0,y:0,z:1},degrees.z],[{x:1,y:0,z:0},degrees.x],[{x:0,y:1,z:0},degrees.y]] as const){
    const half=angle*Math.PI/360,s=Math.sin(half);
    result=rotate([axis.x*s,axis.y*s,axis.z*s,Math.cos(half)],result);
  }return result;
}
/** Independent deterministic draws, not Unity's native RNG sequence. */
function shapeRandom(seed:number,stream:number):number {
  return fract(Math.sin(seed*91.733+stream*17.177)*43758.5453);
}
/** Source shape enum: sphere=0, hemisphere=2, cone=4, box=5.
 * Ballistic birth sample only; enabled velocity/force/noise modules require a Unity simulation.
 */
export function sampleProjectileMotion(p:ParticleRecord,age:number,emitterPhase:number,random:number):{position:Vec3;velocity:Vec3} {
  const s=p.shape;let birth:Vec3={x:0,y:0,z:0},direction:Vec3={x:0,y:0,z:1};
  if(s.enabled){
    const u=shapeRandom(random,1),v=shapeRandom(random,2),w=shapeRandom(random,3),theta=u*Math.PI*2;
    const inner=1-clamp(s.radiusThickness);
    if(s.type===0||s.type===2){
      const z=s.type===2?v:2*v-1,r=Math.sqrt(Math.max(0,1-z*z));
      direction={x:Math.cos(theta)*r,y:Math.sin(theta)*r,z};
      const radius=s.radius*Math.cbrt(mix(inner**3,1,w));
      birth={x:direction.x*radius,y:direction.y*radius,z:direction.z*radius};
    }else if(s.type===4){
      const radius=s.radius*Math.sqrt(mix(inner**2,1,v));
      birth={x:Math.cos(theta)*radius,y:Math.sin(theta)*radius,z:0};
      // Interior cone rays interpolate the source cone angle from the central axis.
      const tangent=Math.tan(s.angle*Math.PI/180)*(s.radius?radius/s.radius:0),norm=Math.hypot(tangent,1);
      direction={x:Math.cos(theta)*tangent/norm,y:Math.sin(theta)*tangent/norm,z:1/norm};
    }else if(s.type===5){birth={x:u-.5,y:v-.5,z:w-.5};}
    birth=rotateShapeEuler({x:birth.x*s.m_Scale.x,y:birth.y*s.m_Scale.y,z:birth.z*s.m_Scale.z},s.m_Rotation);
    direction=rotateShapeEuler(direction,s.m_Rotation);
    birth={x:birth.x+s.m_Position.x,y:birth.y+s.m_Position.y,z:birth.z+s.m_Position.z};
  }
  const speed=evaluateProjectileCurve(p.initial.startSpeed,emitterPhase,random);
  const velocity={x:direction.x*speed,y:direction.y*speed,z:direction.z*speed};
  return {position:{x:birth.x+velocity.x*age,y:birth.y+velocity.y*age,z:birth.z+velocity.z*age},velocity};
}
/** Stretched billboard's long axis follows each particle's projected velocity.
 * LengthScale applies to size and VelocityScale to speed; these contributions add.
 */
export function projectileStretch(p:ParticleRecord,widthWorld:number,velocity:Vec3,scale:number,o:ProjectileViewOptions):{height:number;rotation:number} {
  const projected=project(velocity,scale,o),speed=Math.hypot(velocity.x,velocity.y,velocity.z),screenSpeed=Math.hypot(projected.x,projected.y);
  const projectionRatio=speed>1e-8?screenSpeed/(speed*scale):1;
  const sizeLength=widthWorld*Math.abs(p.renderer.m_LengthScale)*scale;
  return {height:sizeLength*(p.renderer.m_FreeformStretching?1:projectionRatio)+screenSpeed*Math.abs(p.renderer.m_VelocityScale),
    rotation:screenSpeed>1e-8?Math.atan2(projected.y,projected.x)+Math.PI/2:(o.directionRadians??0)+Math.PI/2};
}
function integratedRotation(p:ParticleRecord,t:number,lifetime:number,r:number):number {
  const curve=p.rotationOverLifetime.z;if(curve.mode===0||curve.mode===3)return evaluateProjectileCurve(curve,t,r)*t*lifetime;
  let area=0;const steps=16;for(let i=0;i<steps;i++)area+=evaluateProjectileCurve(curve,t*(i+.5)/steps,r)*t/steps;
  return area*lifetime;
}
function frameTexture(layer:Layer,age:number,t:number):Texture {
  const sheet=layer.particle.textureSheetAnimation;if(!sheet.enabled)return layer.texture;
  const cols=Math.max(1,sheet.tilesX??1),rows=Math.max(1,sheet.tilesY??1),single=sheet.animationType===1;
  const count=single?cols:cols*rows,start=sheet.startFrame?evaluateProjectileCurve(sheet.startFrame,t,layer.random):0;
  let n:number;
  if(sheet.timeMode===1)n=start+age*(sheet.fps??30);
  else {const phase=fract(Math.min(t,1-1e-7)*(sheet.cycles??1));n=(start+(sheet.frameOverTime?evaluateProjectileCurve(sheet.frameOverTime,phase,layer.random):phase))*count;}
  const frame=((Math.floor(n)%count)+count)%count;
  const row=single?(sheet.rowMode===0?sheet.rowIndex??0:Math.floor(layer.random*rows)):Math.floor(frame/cols),col=frame%cols;
  const base=layer.texture,key=`${base.baseTexture.uid}:${cols}:${rows}:${col}:${row}`;
  let texture=frameTextures.get(key);
  if(!texture){const w=base.frame.width/cols,h=base.frame.height/rows;
    texture=new Texture(base.baseTexture,new Rectangle(base.frame.x+col*w,base.frame.y+(row%rows)*h,w,h));frameTextures.set(key,texture);}
  return texture;
}
function appearance(layer:Layer,color:number[]):{tint:number;alpha:number;blend:BLEND_MODES} {
  const m=layer.material;
  const materialColor=m.shader?.name.startsWith('Universal')?m.colors._BaseColor??m.colors._Color:
    m.colors._TintColor??m.colors._Color;const c=color.map((v,i)=>v*(materialColor?.[i]??1));
  return {tint:(Math.round(clamp(c[0])*255)<<16)|(Math.round(clamp(c[1])*255)<<8)|Math.round(clamp(c[2])*255),
    alpha:clamp(c[3]),blend:projectileMaterialBlend(m)};
}
export interface ProjectileViewFrame {ageSeconds:number;rootWorldPosition?:Vec3;rootRotation?:Quaternion;rootScaleWorld?:Vec3;rootBasisWorld?:WorldBasis;/** Stop after this path endpoint; body systems clear, trail particles finish naturally. */emitting?:boolean}
/** Ordered birth/path/death calls survive a projectile born and killed within one fixed step. */
export function advanceProjectileView(view:ProjectileView,frame:ProjectileViewFrame,pixelsPerWorldUnit:number):void {
  const {ageSeconds}=frame;
  if(!Number.isFinite(ageSeconds)||!Number.isFinite(pixelsPerWorldUnit)||pixelsPerWorldUnit<=0)throw new Error('Invalid projectile preview time/scale');
  const state=liveViews.get(view);if(!state)throw new Error('Unknown projectile view');view.presentation.ageSeconds=Math.max(0,ageSeconds);
  if(ageSeconds<state.age)throw new Error('Projectile view time must be monotonic');
  if(frame.rootRotation)state.options.rootRotation=frame.rootRotation;
  if(frame.rootScaleWorld)state.options.rootScaleWorld=frame.rootScaleWorld;
  if(frame.rootBasisWorld)state.options.rootBasisWorld=frame.rootBasisWorld;
  const rotation=state.options.rootRotation??identity;
  const offset=rotate(rotation,{x:0,y:0,z:ageSeconds*(state.options.velocityWorldPerSecond??0)}),origin=state.options.rootWorldPosition??{x:0,y:0,z:0};
  const world=frame.rootWorldPosition??{x:origin.x+offset.x,y:origin.y+offset.y,z:origin.z+offset.z};
  if(state.stoppedAt===null)for(const emitter of state.emitters){
    const segment=projectileEmissionSegment(emitter.particle,state.age,ageSeconds,state.world,world,emitter.distanceRemainder,emitter.random);
    emitter.distanceRemainder=segment.distanceRemainder;
    for(const birth of segment.births){const layer=emitter.spawn(birth.localSeconds,birth.world,rotation);if(layer){layer.birthBasis=state.options.rootBasisWorld?structuredClone(state.options.rootBasisWorld):undefined;layer.birthScale=state.options.rootScaleWorld?{...state.options.rootScaleWorld}:undefined;state.layers.push(layer);}}
  }
  state.world={...world};state.age=ageSeconds;
  if(frame.emitting===false&&state.stoppedAt===null){
    state.stoppedAt=ageSeconds;
    // DieAndWait @0x2b66468 -> Bullet_Mesh.Stop explicitly Stop(true) + Clear(true).
    // Only those body systems clear; distance-emitted trails drain at the stopped origin.
    state.layers=state.layers.filter(layer=>{if(!state.clearOnStop.has(layer.particleKey))return true;
      const display=layer.sprite??layer.mesh!;view.removeChild(display);display.destroy();return false;});
  }
  let live=0;
  for(const layer of state.layers){
    const p=layer.particle,o=p.simulationSpace===1?{...state.options,rootRotation:layer.birthRotation,rootBasisWorld:layer.birthBasis,rootScaleWorld:layer.birthScale}:state.options,sample=sampleProjectileParticle(p,Math.max(0,ageSeconds),layer.random,layer.birthSeconds,false);
    const display=layer.sprite??layer.mesh!;display.visible=sample.alive;if(!sample.alive)continue;live++;
    const t=sample.emitterPhase,size=sample.size,sx=size,sy=sample.sizeY,sz=sample.sizeZ;
    const motion=sampleProjectileMotion(p,sample.particleAge,t,layer.random);
    const point=(local:Vec3)=>{
      const v=particlePoint(p,local,o);
      return p.simulationSpace===1?{x:v.x+layer.birthWorld.x-world.x,y:v.y+layer.birthWorld.y-world.y,z:v.z+layer.birthWorld.z-world.z}:v;
    };
    const texture=frameTexture(layer,sample.particleAge,sample.lifePhase),color=appearance(layer,sample.color);
    display.tint=color.tint;display.alpha=color.alpha;display.blendMode=color.blend;
    if(layer.sprite){
      const sprite=layer.sprite; sprite.texture=texture;
      const center=project(point(motion.position),pixelsPerWorldUnit,o);sprite.position.set(center.x,center.y);
      const x=size*axisLength(p,{x:1,y:0,z:0},o),y=sy*axisLength(p,{x:0,y:1,z:0},o);
      sprite.width=x*pixelsPerWorldUnit;sprite.height=y*pixelsPerWorldUnit;
      sprite.rotation=evaluateProjectileCurve(p.initial.startRotation,t,layer.random);
      if(p.rotationOverLifetime.enabled)sprite.rotation+=integratedRotation(p,sample.lifePhase,sample.lifetime,layer.random);
      if(p.renderer.m_RenderMode===1){
        let velocity=particlePoint(p,motion.velocity,o,false);
        // Body projectiles with zero local speed can inherit the caller's source root motion.
        if(Math.hypot(velocity.x,velocity.y,velocity.z)<1e-8&&o.velocityWorldPerSecond){
          velocity=rotate(o.rootRotation??identity,{x:0,y:0,z:o.velocityWorldPerSecond});
        }
        const stretch=projectileStretch(p,x,velocity,pixelsPerWorldUnit,o);
        sprite.height=stretch.height;
        if(p.renderer.m_RotateWithStretchDirection!==false)sprite.rotation=stretch.rotation;
      }
    }else if(layer.mesh&&layer.geometry){
      layer.mesh.texture=texture;let rotation=evaluateProjectileCurve(p.initial.startRotation,t,layer.random);
      if(p.rotationOverLifetime.enabled)rotation+=integratedRotation(p,sample.lifePhase,sample.lifetime,layer.random);
      const angleQ:Quaternion=[0,0,Math.sin(rotation/2),Math.cos(rotation/2)];
      layer.mesh.vertices=new Float32Array(layer.geometry.vertices.flatMap(vertex=>{
        const local=rotate(angleQ,{x:vertex.x*sx,y:vertex.y*sy,z:vertex.z*sz});
        const shifted={x:local.x+motion.position.x,y:local.y+motion.position.y,z:local.z+motion.position.z};
        const screen=project(point(shifted),pixelsPerWorldUnit,o);return [screen.x,screen.y];
      }));
    }
  }
  view.presentation.liveParticleCount=live;
  // Remove finished instances; an active emitter can still create future particles.
  state.layers=state.layers.filter(layer=>{const sample=sampleProjectileParticle(layer.particle,ageSeconds,layer.random,layer.birthSeconds,false);
    if(ageSeconds>=sample.endSeconds){const display=layer.sprite??layer.mesh!;view.removeChild(display);display.destroy();return false;}return true;});
  const exhausted=state.emitters.every(e=>{const p=e.particle;if(p.looping)return false;
    const end=evaluateProjectileCurve(p.emission.rateOverTime,0,e.random)>0||evaluateProjectileCurve(p.emission.rateOverDistance,0,e.random)>0?p.durationSeconds:
      Math.max(0,...projectileBurstBirths(p,e.random));
    return ageSeconds*p.simulationSpeed-evaluateProjectileCurve(p.startDelay,0,e.random)>=end;
  });
  view.presentation.completed=(state.stoppedAt!==null||exhausted)&&state.layers.length===0;
}
/** Legacy callers receive source-speed straight path sampling. Runtime should pass explicit path endpoints. */
export function updateProjectileView(view:ProjectileView,ageSeconds:number,pixelsPerWorldUnit:number):void {
  advanceProjectileView(view,{ageSeconds},pixelsPerWorldUnit);
}
export function stopProjectileView(view:ProjectileView,ageSeconds:number,pixelsPerWorldUnit:number,rootWorldPosition?:Vec3):void {
  advanceProjectileView(view,{ageSeconds,rootWorldPosition,emitting:false},pixelsPerWorldUnit);
}
function createView(weaponId:string|number|{sourceGunNum:number},age:number,scale:number,kind:'projectile'|'impact'|'muzzle',options:ProjectileViewOptions):ProjectileView {
  const source=requiredData(),gunNum=resolveProjectileGunNum(weaponId),binding=source.gunBindings[gunNum];
  const key=kind==='muzzle'?muzzlePresentation.gunBindings[gunNum].templateKey:kind==='projectile'?binding.templateKey:binding.impactFXTemplateKey;
  const template:Template=kind==='muzzle'?muzzlePresentation.templates[key as keyof typeof muzzlePresentation.templates]:(kind==='projectile'?source.templates:source.fxTemplates)[key];
  // APK Bullet.SetupLinear @0x2b65950 calls selected particle Play(true).
  // Bullet_Mesh.body is an additional Play/Stop list, not the renderer selection.
  // Active descendants (Trail/SparkTrail/Glow) therefore belong to the shot too.
  const keys=[...template.allParticleKeys];
  const root=new Container() as ProjectileView;root.sortableChildren=true;
  root.presentation={adapter:'H5_SOURCE_RENDERER_SAMPLE_NOT_UNITY_PARTICLE_SIMULATION',gunNum,kind,templateKey:key,
    selectedParticleKeys:keys,normalChildFallback:false,omissions:['Source burst/time/distance births with deterministic samples; individual world/local particle instances', 'Camera-facing billboards use source TRS axis lengths; ballistic sphere/hemisphere/cone/box shape samples; velocity limits/noise, lighting/HDR and full shader color modes remain H5 adapters'],suggestedDurationSeconds:0,ageSeconds:age,liveParticleCount:0,completed:false};
  const omit=(reason:string)=>{if(!root.presentation.omissions.includes(reason))root.presentation.omissions.push(reason);};
  const layers:Layer[]=[],emitters:Emitter[]=[];
  for(const particleKey of keys){
    const particle=source.particles[particleKey],baseRandom=fract(Math.sin((options.seed??gunNum+1)+Number(particleKey.split(':').at(-1)))*43758.5453);
    if(!shouldPresentProjectileParticle(particle,particleKey===template.rootParticleKey)){
      omit(`${particleKey}: source renderer/GameObject disabled; omitted`);continue;}
    if(!particle.emission.enabled||(!particle.emission.bursts.length&&evaluateProjectileCurve(particle.emission.rateOverTime,0,baseRandom)<=0&&evaluateProjectileCurve(particle.emission.rateOverDistance,0,baseRandom)<=0)){omit(`${particleKey}: source emission disabled/zero; omitted`);continue;}
    const emitter:Emitter={particleKey,particle,random:baseRandom,distanceRemainder:0,sequence:0,spawn:(birthSeconds,birthWorld,birthRotation)=>{
    const sampleIndex=emitter.sequence++,random=sampleIndex===0?baseRandom:fract(Math.sin(baseRandom*89.17+sampleIndex)*43758.5453);
    const sample=sampleProjectileParticle(particle,0,random,birthSeconds,false);
    root.presentation.suggestedDurationSeconds=Math.max(root.presentation.suggestedDurationSeconds,sample.endSeconds);
    const materials=particle.renderer.materialKeys;
    if(materials.length>1)omit(`${particleKey}: only first source material/submesh is sampled`);
    const material=source.materials[materials[0]];
    const texBinding=material?.textures._BaseMap??material?.textures._MainTex??(material&&Object.values(material.textures)[0]);
    if(!material||!texBinding){omit(`${particleKey}: no source main texture; no replacement supplied`);return undefined;}
    const texture=Assets.get<Texture>(source.textures[texBinding.textureKey].url);
    if(!texture)throw new Error('Await loadProjectileViewAssets() before rendering');
    const layer:Layer={particleKey,particle,material,texture,random,birthSeconds,sampleIndex,birthWorld:{...birthWorld},birthRotation:[...birthRotation] as Quaternion,birthBasis:options.rootBasisWorld?structuredClone(options.rootBasisWorld):undefined,birthScale:options.rootScaleWorld?{...options.rootScaleWorld}:undefined};
    const mode=particle.renderer.m_RenderMode;
    if(mode===4){
      if(particle.renderer.meshKeys.length>1)omit(`${particleKey}: first source mesh selected; native random mesh selection not simulated`);
      const meshKey=particle.renderer.meshKeys[0],record=source.meshes[meshKey],geometry=record?.objURL?objMeshes.get(record.objURL):undefined;
      if(!geometry){omit(`${particleKey}: mesh ${meshKey} UNKNOWN/unloaded; no substitute geometry supplied`);return undefined;}
      layer.geometry=geometry;
    }else if(mode===2||mode===3){
      layer.geometry={vertices:mode===2?[{x:-.5,y:0,z:-.5},{x:.5,y:0,z:-.5},{x:.5,y:0,z:.5},{x:-.5,y:0,z:.5}]:
        [{x:-.5,y:.5,z:0},{x:.5,y:.5,z:0},{x:.5,y:-.5,z:0},{x:-.5,y:-.5,z:0}],uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3]};
    }else if(mode===0||mode===1){layer.sprite=new Sprite(texture);layer.sprite.anchor.set(.5+particle.renderer.m_Pivot.x,.5-particle.renderer.m_Pivot.y);}
    else {omit(`${particleKey}: unsupported renderer mode ${mode}`);return undefined;}
    if(layer.geometry){const repeat=texBinding.repeat,offset=texBinding.offset;
      const uvs=layer.geometry.uvs.map((value,i)=>value*(repeat[i%2]??1)+(offset[i%2]??0));
      layer.mesh=new SimpleMesh(texture,new Float32Array(layer.geometry.vertices.length*2),new Float32Array(uvs),new Uint16Array(layer.geometry.indices));}
    if(texBinding.repeat.some(v=>v!==1)||texBinding.offset.some(v=>v!==0))omit(`${particleKey}: sprite texture repeat/offset requires additional shader support`);
    if(particle.shape.enabled&&![0,2,4,5].includes(particle.shape.type))omit(`${particleKey}: unsupported source shape ${particle.shape.type}; central forward ballistic sample`);
    if(particle.initial.rotation3D)omit(`${particleKey}: 3D startRotationX/Y not sampled`);
    if(particle.renderer.m_Flip.x||particle.renderer.m_Flip.y)omit(`${particleKey}: probabilistic renderer flip not simulated`);
    const display=layer.sprite??layer.mesh!;display.zIndex=particle.renderer.m_SortingOrder;display.name=particleKey;root.addChild(display);return layer;
    }};
    emitters.push(emitter);
    for(const birth of projectileBurstBirths(particle,baseRandom).filter(t=>t===0&&evaluateProjectileCurve(particle.startDelay,0,baseRandom)===0)){const layer=emitter.spawn(birth,options.rootWorldPosition??{x:0,y:0,z:0},options.rootRotation??identity);if(layer)layers.push(layer);}
  }
  const maxLifetime=emitters.reduce((m,e)=>Math.max(m,e.particle.initial.startLifetime.scalar,e.particle.initial.startLifetime.minScalar??0),0);
  for(const e of emitters){const p=e.particle,delay=evaluateProjectileCurve(p.startDelay,0,e.random),future=projectileBurstBirths(p,e.random).filter(t=>t>0||delay>0);
    if(future.length)root.presentation.suggestedDurationSeconds=Math.max(root.presentation.suggestedDurationSeconds,(delay+Math.max(...future)+maxLifetime)/p.simulationSpeed);
    if(!p.looping&&evaluateProjectileCurve(p.emission.rateOverTime,0,e.random)>0)root.presentation.suggestedDurationSeconds=Math.max(root.presentation.suggestedDurationSeconds,(delay+p.durationSeconds+maxLifetime)/p.simulationSpeed);
  }
  const bodyTransforms=kind==='projectile'?(template.bodyParticleKeys??[]).map(k=>source.particles[k].chainTransformIDs.at(-1)!):[];
  const clearOnStop=new Set(keys.filter(k=>source.particles[k].chainTransformIDs.some(id=>bodyTransforms.includes(id))));
  liveViews.set(root,{clearOnStop,layers,emitters,options:{...options},age:0,world:{...(options.rootWorldPosition??{x:0,y:0,z:0})},stoppedAt:null});
  advanceProjectileView(root,{ageSeconds:age,rootWorldPosition:options.rootWorldPosition},scale);return root;
}
export function createProjectileView(weaponId:string|number|{sourceGunNum:number},ageSeconds:number,pixelsPerWorldUnit:number,options:ProjectileViewOptions={}):ProjectileView {
  return createView(weaponId,ageSeconds,pixelsPerWorldUnit,'projectile',options);
}
export function createImpactView(weaponId:string|number|{sourceGunNum:number},ageSeconds:number,pixelsPerWorldUnit:number,options:ProjectileViewOptions={}):ProjectileView {
  return createView(weaponId,ageSeconds,pixelsPerWorldUnit,'impact',options);
}

/** Per-gun source Muzzle particle hierarchy; root anchor is gun.muzzle, distinct from Shoot_trans. */
export function createMuzzleView(weaponId:string|number|{sourceGunNum:number},ageSeconds:number,pixelsPerWorldUnit:number,options:ProjectileViewOptions={}):ProjectileView {
  return createView(weaponId,ageSeconds,pixelsPerWorldUnit,'muzzle',options);
}
