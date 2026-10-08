import {sourceHuntGunFirePosition} from './hunt-gun-sockets';
import sourceSkinRig from './data/r6-skin-rig.json';
import { Assets, Container, SimpleMesh, Texture } from "pixi.js";

/** Original Cat_Bone-local XY uses Y up; Pixi global screen XY uses Y down. */
export type RigPoint = { x: number; y: number };
export type RigWorldPoint = RigPoint & { z: number };
type Tuple3 = [number, number, number];
type Tuple4 = [number, number, number, number];
type Affine = [number, number, number, number, number, number];
type RigNode = { id: number; parent: number | null; name: string; position: Tuple3; rotation: Tuple4; scale: Tuple3 };
type BoneLocal = { position: Tuple3; rotation_xyzw: Tuple4; scale: Tuple3 };
export type RigLayer = {
  node: number; sprite: number; spriteName: string; texture: string; order: number;
  positions: Tuple3[]; indices: number[]; uvs: number[]; color: Tuple4; flipX: boolean; flipY: boolean;
  weaponId?: number;
  skin?: { bones: number[]; bindposes: number[][][]; weights: Tuple4[]; boneIndices: Tuple4[] };
};
export type CatRigManifest = {
  schemaVersion: number;
  source: { apkSha256: string; hierarchySha256: string; sourceCoordinates: string; unityRootScale: number; unityRootPositionY: number; notSpine: boolean };
  nodes: RigNode[]; layers: RigLayer[];
  guns: { id: number; node: number; shoot: number; muzzle: number; sprite: number; shootRandom?: number[]; shootLocal: Tuple3; type?: number }[];
  clips: Record<"Idle" | "Walk", { duration: number; fps: number; frames: { time: number; bones: Record<string, BoneLocal> }[] }>;
};
export type CatRigAssets = { manifest: CatRigManifest; textures: Map<number, Texture> };
export type CatRigSkinAssets={layers:RigLayer[];textures:Map<number,Texture>;colors:Tuple4[]};
export async function loadCatRigSkinAssets(base='/assets/cat-rig'):Promise<CatRigSkinAssets>{const layers=sourceSkinRig.layers as unknown as RigLayer[],textures=new Map<number,Texture>();await Promise.all(layers.map(async layer=>textures.set(layer.sprite,await Assets.load<Texture>(`${base}/${layer.texture}`))));return {layers,textures,colors:sourceSkinRig.colors as Tuple4[]};}
export const CAT_RIG_SOURCE_NODES = {
  root: 42416, spine: 58805, head: 49366, facePivot: 49510, faceTarget: 49773,
  faceSprite: 44780, handBone: 47858, rebound: 63621, hand: 43393, outline: 53013,
  leftHandBone: 53219, gunPivot: 52975, gunBounce: 58355, defaultGun: 61182, defaultShoot: 49459,
  defaultMuzzle: 42329,
} as const;
const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrapAngle = (radians: number) => ((radians + Math.PI) % TAU + TAU) % TAU - Math.PI;
function rotationZ(q: Tuple4): number {
  return Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
}
function affine(position: Tuple3, rotation: number, scale: Tuple3): Affine {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [c * scale[0], s * scale[0], -s * scale[1], c * scale[1], position[0], position[1]];
}
function multiply(a: Affine, b: Affine): Affine {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function transform(m: Affine, x: number, y: number): RigPoint {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function interpolate(a: number, b: number, t: number) { return a + (b - a) * t; }
function interpolate3(a: Tuple3, b: Tuple3, t: number): Tuple3 {
  return [interpolate(a[0], b[0], t), interpolate(a[1], b[1], t), interpolate(a[2], b[2], t)];
}
export type CatRigPoseOptions = {
  /** Native ApplyHandZ changes localEulerAngles.z (radians, Unity Y up). */
  handLocalAngle?: number;
  /** Compatibility screen-plane angle; converted relative to parent. Prefer handLocalAngle. */
  handWorldAngle?: number;
  /** Original Face_Pivot local Z in radians; original face limits are 20..160 degrees. */
  faceLocalAngle?: number;
  /** 0 = rest, 1 = source WantPos/WantSize; each source component lasts 0.2 s. */
  recoil?: number;
};
/** Pure hierarchy sampler. Root scene TRS is excluded, matching research bake. */
export function sampleCatRigPose(manifest: CatRigManifest, clipName: "Idle" | "Walk", timeSeconds: number,
  options: CatRigPoseOptions = {}): Map<number, Affine> {
  const clip = manifest.clips[clipName];
  const time = ((timeSeconds % clip.duration) + clip.duration) % clip.duration;
  const frame = time * clip.fps, index = Math.min(Math.floor(frame), clip.frames.length - 2);
  const first = clip.frames[index].bones, second = clip.frames[index + 1].bones, fraction = frame - index;
  const pose = new Map<number, Affine>();
  for (const node of manifest.nodes) {
    if (node.parent === null) { pose.set(node.id, [...IDENTITY]); continue; }
    const a = first[String(node.id)], b = second[String(node.id)];
    let position = node.position, scale = node.scale, angle = rotationZ(node.rotation);
    if (a && b) {
      position = interpolate3(a.position, b.position, fraction); scale = interpolate3(a.scale, b.scale, fraction);
      angle = rotationZ(a.rotation_xyzw) + wrapAngle(rotationZ(b.rotation_xyzw) - rotationZ(a.rotation_xyzw)) * fraction;
    }
    const parent = pose.get(node.parent)!;
    if (node.id === CAT_RIG_SOURCE_NODES.handBone) {
      if (options.handLocalAngle !== undefined) angle = options.handLocalAngle;
      else if (options.handWorldAngle !== undefined) angle = options.handWorldAngle - Math.atan2(parent[1], parent[0]);
    }
    if (node.id === CAT_RIG_SOURCE_NODES.facePivot && options.faceLocalAngle !== undefined) angle = options.faceLocalAngle;
    if (node.id === CAT_RIG_SOURCE_NODES.rebound && options.recoil) {
      // Unity Bounce_Position serialized WantPos=(-0.6,0,0), not a screen translation.
      position = [position[0] - 0.6 * options.recoil, position[1], position[2]];
    }
    if (node.id === CAT_RIG_SOURCE_NODES.gunBounce && options.recoil) {
      // Unity Bounce_Custom serialized WantSize=(0.7,1.1,1), separate from body.
      scale = [scale[0] * (1 - 0.3 * options.recoil), scale[1] * (1 + 0.1 * options.recoil), scale[2]];
    }
    pose.set(node.id, multiply(parent, affine(position, angle, scale)));
  }
  // Follow.Update copies world position from face_trans, but keeps the sprite's world rotation.
  const face = pose.get(CAT_RIG_SOURCE_NODES.faceSprite)!;
  const follow = pose.get(CAT_RIG_SOURCE_NODES.faceTarget)!;
  pose.set(CAT_RIG_SOURCE_NODES.faceSprite, [face[0], face[1], face[2], face[3], follow[4], follow[5]]);
  return pose;
}
/** Vertex skinning retains original per-vertex 4 weights, inverse bindposes and triangle topology. */
export function catRigLayerPositions(layer: RigLayer, pose: Map<number, Affine>): Float32Array {
  const result = new Float32Array(layer.positions.length * 2);
  const skin = layer.skin;
  const skinMatrices = skin?.bones.map((bone, index) => {
    const b = skin.bindposes[index];
    return multiply(pose.get(bone)!, [b[0][0], b[1][0], b[0][1], b[1][1], b[0][3], b[1][3]]);
  });
  layer.positions.forEach((vertex, index) => {
    let x = 0, y = 0;
    if (skin && skinMatrices) {
      for (let influence = 0; influence < 4; influence++) {
        const weight = skin.weights[index][influence];
        if (!weight) continue;
        const p = transform(skinMatrices[skin.boneIndices[index][influence]], vertex[0], vertex[1]);
        x += p.x * weight; y += p.y * weight;
      }
    } else {
      const p = transform(pose.get(layer.node)!, vertex[0] * (layer.flipX ? -1 : 1), vertex[1] * (layer.flipY ? -1 : 1));
      x = p.x; y = p.y;
    }
    result[index * 2] = x; result[index * 2 + 1] = y;
  });
  return result;
}
/** Static IL2CPP CalcBulletSpawnPos / GetFirePosition: intersect camera-forward line with world Y=2. */
export function projectMuzzleToWorldY2(position: RigWorldPoint, cameraForward: RigWorldPoint): RigWorldPoint {
  if (Math.abs(cameraForward.y) < 1e-8) throw new Error("Camera forward is parallel to the worldY=2 plane");
  const t = (2 - position.y) / cameraForward.y;
  return { x: position.x + cameraForward.x * t, y: 2, z: position.z + cameraForward.z * t };
}
/** Source Cat.Pivot: left Euler(40,-45,0), right Euler(-40,135,0), Unity ZXY order. */
export type CatRigBasis = { right: RigWorldPoint; up: RigWorldPoint; forward: RigWorldPoint };
export type CatRigCamera = { forward: RigWorldPoint; right?: RigWorldPoint; up?: RigWorldPoint };
const dot3 = (a: RigWorldPoint, b: RigWorldPoint) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub3 = (a: RigWorldPoint, b: RigWorldPoint): RigWorldPoint => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross3 = (a: RigWorldPoint, b: RigWorldPoint): RigWorldPoint =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
function normalize3(a: RigWorldPoint): RigWorldPoint {
  const length = Math.hypot(a.x, a.y, a.z);
  if (length < 1e-8) throw new Error("Cannot normalize a zero rig direction");
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}
export function getCatRigSourceBasis(facing: "left" | "right" = "left"): CatRigBasis {
  const pitch = 40 * DEG, yaw = -45 * DEG, sign = facing === "right" ? -1 : 1;
  return { right: { x: Math.cos(yaw) * sign, y: 0, z: -Math.sin(yaw) * sign },
    up: { x: Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: Math.cos(yaw) * Math.sin(pitch) },
    forward: { x: Math.sin(yaw) * Math.cos(pitch) * sign, y: -Math.sin(pitch) * sign,
      z: Math.cos(yaw) * Math.cos(pitch) * sign } };
}
/** Unmirrored source axes; actor mirroring already applies the opposite right axis. */
export const CAT_RIG_SOURCE_BASIS = getCatRigSourceBasis();
export function getCatRigCameraBasis(camera: CatRigCamera): CatRigBasis {
  const forward = normalize3(camera.forward);
  const right = camera.right ? normalize3(camera.right) : normalize3(cross3({ x: 0, y: 1, z: 0 }, forward));
  const up = camera.up ? normalize3(camera.up) : normalize3(cross3(forward, right));
  return { right, up, forward };
}
/** actorRootWorld is Cat transform origin, before Pivot and Cat_Bone local TRS. */
export function getCatRigProjectionConfig(manifest: CatRigManifest, actorRootWorld: RigWorldPoint,
  camera: CatRigCamera, pixelsPerWorldUnit: number) {
  const source = CAT_RIG_SOURCE_BASIS, basis = getCatRigCameraBasis(camera), offset = manifest.source.unityRootPositionY;
  return { originWorld: { x: actorRootWorld.x + source.up.x * offset,
    y: actorRootWorld.y + source.up.y * offset, z: actorRootWorld.z + source.up.z * offset },
    pixelsPerUnit: pixelsPerWorldUnit * manifest.source.unityRootScale,
    sourceBasis: source, cameraBasis: basis,
    // Pixi mesh input has Y down. Apply this 2x2 to its coordinates; project originWorld for translation.
    viewMatrix: { a: dot3(basis.right, source.right), b: -dot3(basis.up, source.right),
      c: -dot3(basis.right, source.up), d: dot3(basis.up, source.up) },
    viewScale: { x: dot3(basis.right, source.right), y: dot3(basis.up, source.up) } };
}

type RigMatrix4 = number[];
export type CatRigWorldPose = { matrices: Map<number, RigMatrix4>; rotations: Map<number, Tuple4>; localRotations: Map<number, Tuple4> };
export type CatRigWorldPoseOptions = { rootWorld: RigWorldPoint; facing?: "left" | "right"; recoil?: number;
  handLocalZ?: number; faceLocalZ?: number; leftHandLocalZ?: number; localRotations?: Map<number, Tuple4> };
function qMultiply(a: Tuple4, b: Tuple4): Tuple4 {
  return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
}
function qInverse(q: Tuple4): Tuple4 { const n = q.reduce((sum,v)=>sum+v*v,0); return [-q[0]/n,-q[1]/n,-q[2]/n,q[3]/n]; }
function qNormalize(q: Tuple4): Tuple4 { const n = Math.hypot(...q); return q.map(v=>v/n) as Tuple4; }
/** Unity Quaternion.Euler is R_y * R_x * R_z (ZXY intrinsic order). */
function qEuler(x: number, y: number, z: number): Tuple4 {
  const qx: Tuple4 = [Math.sin(x/2),0,0,Math.cos(x/2)], qy: Tuple4 = [0,Math.sin(y/2),0,Math.cos(y/2)],
    qz: Tuple4 = [0,0,Math.sin(z/2),Math.cos(z/2)]; return qMultiply(qMultiply(qy,qx),qz);
}
function qSlerp(a: Tuple4, b: Tuple4, t: number): Tuple4 {
  a=qNormalize(a); b=qNormalize(b); let cosine=a.reduce((sum,v,i)=>sum+v*b[i],0);
  if (cosine<0) { b=b.map(v=>-v) as Tuple4; cosine=-cosine; }
  if (cosine>.9995) return qNormalize(a.map((v,i)=>interpolate(v,b[i],t)) as Tuple4);
  const theta=Math.acos(clamp(cosine,-1,1)), sine=Math.sin(theta);
  return a.map((v,i)=>(v*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/sine) as Tuple4;
}
function matrixTRS(p: RigWorldPoint, q: Tuple4, s: Tuple3): RigMatrix4 {
  const [x,y,z,w]=qNormalize(q), xx=x*x, yy=y*y, zz=z*z, xy=x*y, xz=x*z, yz=y*z, wx=w*x, wy=w*y, wz=w*z;
  return [(1-2*(yy+zz))*s[0],2*(xy-wz)*s[1],2*(xz+wy)*s[2],p.x,
    2*(xy+wz)*s[0],(1-2*(xx+zz))*s[1],2*(yz-wx)*s[2],p.y,
    2*(xz-wy)*s[0],2*(yz+wx)*s[1],(1-2*(xx+yy))*s[2],p.z,0,0,0,1];
}
function matrixMultiply(a: RigMatrix4, b: RigMatrix4): RigMatrix4 {
  const r=new Array<number>(16).fill(0);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[i*4+j]+=a[i*4+k]*b[k*4+j];
  return r;
}
function matrixPoint(m: RigMatrix4, p: RigWorldPoint): RigWorldPoint {
  return { x:m[0]*p.x+m[1]*p.y+m[2]*p.z+m[3],y:m[4]*p.x+m[5]*p.y+m[6]*p.z+m[7],
    z:m[8]*p.x+m[9]*p.y+m[10]*p.z+m[11] };
}
function qDirection(q: Tuple4, p: RigWorldPoint): RigWorldPoint { return matrixPoint(matrixTRS({x:0,y:0,z:0},q,[1,1,1]),p); }
function qToEuler(q: Tuple4): Tuple3 {
  const m=matrixTRS({x:0,y:0,z:0},q,[1,1,1]), x=Math.asin(clamp(-m[6],-1,1));
  if(Math.abs(Math.cos(x))<1e-6)return [x,Math.atan2(-m[8],m[0]),0];
  return [x,Math.atan2(m[2],m[10]),Math.atan2(m[4],m[5])];
}
function matrixOrigin(m: RigMatrix4): RigWorldPoint { return {x:m[3],y:m[7],z:m[11]}; }
/** Full Unity Transform chain, preserving Z and native local Euler overrides. All angles are radians. */
export function sampleCatRigWorldPose(manifest: CatRigManifest, clipName: "Idle"|"Walk", timeSeconds: number,
  options: CatRigWorldPoseOptions): CatRigWorldPose {
  const clip=manifest.clips[clipName], time=((timeSeconds%clip.duration)+clip.duration)%clip.duration;
  const f=time*clip.fps, i=Math.min(Math.floor(f),clip.frames.length-2), t=f-i;
  const a=clip.frames[i].bones,b=clip.frames[i+1].bones, matrices=new Map<number,RigMatrix4>(),
    rotations=new Map<number,Tuple4>(),locals=new Map<number,Tuple4>();
  const sourceBasis=getCatRigSourceBasis(options.facing), pitch=options.facing==="right"?-40:40,
    yaw=options.facing==="right"?135:-45, sourceQ=qEuler(pitch*DEG,yaw*DEG,0);
  for(const node of manifest.nodes){
    if(node.parent===null){
      const scale=manifest.source.unityRootScale,offset=manifest.source.unityRootPositionY;
      matrices.set(node.id,matrixTRS({x:options.rootWorld.x+sourceBasis.up.x*offset,
        y:options.rootWorld.y+sourceBasis.up.y*offset,z:options.rootWorld.z+sourceBasis.up.z*offset},sourceQ,[scale,scale,scale]));
      rotations.set(node.id,sourceQ);locals.set(node.id,sourceQ);continue;
    }
    let p=node.position,s=node.scale,q=node.rotation;
    const first=a[String(node.id)],second=b[String(node.id)];
    if(first&&second){p=interpolate3(first.position,second.position,t);s=interpolate3(first.scale,second.scale,t);q=qSlerp(first.rotation_xyzw,second.rotation_xyzw,t);}
    // Native clips contain no rotation channels for right hand, left hand or Face_Pivot.
    // Their procedural local quaternions survive animation ticks and moving parent transforms.
    if(node.id===CAT_RIG_SOURCE_NODES.handBone||node.id===CAT_RIG_SOURCE_NODES.leftHandBone||node.id===CAT_RIG_SOURCE_NODES.facePivot)
      q=options.localRotations?.get(node.id)??q;
    const parentQ=rotations.get(node.parent)!;
    const override=node.id===CAT_RIG_SOURCE_NODES.handBone?options.handLocalZ:
      node.id===CAT_RIG_SOURCE_NODES.leftHandBone?options.leftHandLocalZ:
      node.id===CAT_RIG_SOURCE_NODES.facePivot?options.faceLocalZ:undefined;
    if(override!==undefined){const [x,y]=qToEuler(q);q=qEuler(x,y,override);}
    if(node.id===CAT_RIG_SOURCE_NODES.rebound&&options.recoil)p=[p[0]-.6*options.recoil,p[1],p[2]];
    if(node.id===CAT_RIG_SOURCE_NODES.gunBounce&&options.recoil)s=[s[0]*(1-.3*options.recoil),s[1]*(1+.1*options.recoil),s[2]];
    matrices.set(node.id,matrixMultiply(matrices.get(node.parent)!,matrixTRS({x:p[0],y:p[1],z:p[2]},q,s)));
    rotations.set(node.id,qNormalize(qMultiply(parentQ,q)));locals.set(node.id,qNormalize(q));
  }
  const face=matrices.get(CAT_RIG_SOURCE_NODES.faceSprite)!.slice(),follow=matrices.get(CAT_RIG_SOURCE_NODES.faceTarget)!;
  face[3]=follow[3];face[7]=follow[7];face[11]=follow[11];matrices.set(CAT_RIG_SOURCE_NODES.faceSprite,face);
  return {matrices,rotations,localRotations:locals};
}
/** Full original four influence skinning, now in Unity world XYZ. */
export function catRigLayerWorldPositions(layer: RigLayer, pose: CatRigWorldPose): Float64Array {
  const result=new Float64Array(layer.positions.length*3),skin=layer.skin;
  const skinMatrices=skin?.bones.map((bone,index)=>matrixMultiply(pose.matrices.get(bone)!,skin.bindposes[index].flat()));
  for(let i=0;i<layer.positions.length;i++){
    const v=layer.positions[i];let p:RigWorldPoint={x:0,y:0,z:0};
    if(skin&&skinMatrices){for(let influence=0;influence<4;influence++){
      const w=skin.weights[i][influence];if(!w)continue;
      const q=matrixPoint(skinMatrices[skin.boneIndices[i][influence]],{x:v[0],y:v[1],z:v[2]});
      p.x+=q.x*w;p.y+=q.y*w;p.z+=q.z*w;
    }}else p=matrixPoint(pose.matrices.get(layer.node)!,{x:v[0]*(layer.flipX?-1:1),y:v[1]*(layer.flipY?-1:1),z:v[2]});
    result[3*i]=p.x;result[3*i+1]=p.y;result[3*i+2]=p.z;
  }
  return result;
}
export type CatRigNativeAimInput = { rootWorld: RigWorldPoint; aimWorld: RigWorldPoint|null;
  /** Gun_Info.type=5 (missile): lift by1.6 times horizontal distance and extend10 world units. */
  gunType?: number; targetWorld?: RigWorldPoint|null; movementWorld?: RigWorldPoint; facing: "left"|"right"; currentHandZ: number };
/** Recovered UpdateHandRotation math; inverse parent rotation matches Transform.InverseTransformDirection. */
export function solveCatRigNativeHandAim(manifest:CatRigManifest,pose:CatRigWorldPose,input:CatRigNativeAimInput) {
  const hand=matrixOrigin(pose.matrices.get(CAT_RIG_SOURCE_NODES.handBone)!);
  if(!input.aimWorld)return {desiredLocalZ:130*DEG,accepted:true,virtualTarget:null};
  let target=input.aimWorld;
  if(input.gunType === 5){
    const d=sub3(input.targetWorld ?? target,hand);d.y+=1.6*Math.hypot(d.x,d.z);
    const length=Math.hypot(d.x,d.y,d.z),n=length>1e-5?{x:d.x/length,y:d.y/length,z:d.z/length}:{x:0,y:0,z:0};
    target={x:hand.x+10*n.x,y:hand.y+10*n.y,z:hand.z+10*n.z};
  }
  const delta=sub3(target,hand),distance=Math.hypot(delta.x,delta.y,delta.z),rootDelta=sub3(input.rootWorld,hand);
  if(distance<=Math.hypot(rootDelta.x,rootDelta.y,rootDelta.z)||dot3(delta,delta)<=1e-4)
    return {desiredLocalZ:input.currentHandZ,accepted:false,virtualTarget:target};
  const parent=manifest.nodes.find(n=>n.id===CAT_RIG_SOURCE_NODES.handBone)!.parent!;
  const direction=qDirection(qInverse(pose.rotations.get(parent)!),normalize3(delta));
  return {desiredLocalZ:Math.atan2(direction.y,direction.x),accepted:true,virtualTarget:target};
}
/** Recovered UpdateFaceRotation: yaw+45 correction of X/Z, atan2(X,Z), then original20..160 mapping. */
export function solveCatRigNativeFaceAim(input:CatRigNativeAimInput):number {
  const raw=input.aimWorld?sub3(input.aimWorld,input.rootWorld):input.movementWorld??{x:0,y:0,z:0};
  const d=input.aimWorld?{x:raw.x,y:0,z:raw.z}:raw;
  let angle=90*DEG;
  if(dot3(d,d)>1e-4){const corrected=qDirection(qEuler(0,45*DEG,0),normalize3(d));
    angle=Math.atan2(corrected.x,corrected.z)*(input.facing==="left"?-1:1);}
  return (20+clamp(angle/Math.PI,0,1)*140)*DEG;
}

export async function loadCatRigAssets(baseUrl = "/assets/cat-rig"): Promise<CatRigAssets> {
  const base = baseUrl.replace(/\/$/, "");
  const manifest = await Assets.load<CatRigManifest>(`${base}/rig.json`);
  const textures = new Map<number, Texture>();
  await Promise.all(manifest.layers.map(async layer => {
    textures.set(layer.sprite, await Assets.load<Texture>(`${base}/${layer.texture}`));
  }));
  return { manifest, textures };
}
export type CatRigUpdate = {
  dtSeconds: number; moving: boolean; aimScreen?: RigPoint | null; weaponId?: number;
  /** Native source branch: rootWorld is Cat origin before local Pivot/Cat_Bone transforms. */
  rootWorld?: RigWorldPoint; aimWorld?: RigWorldPoint | null; camera?: CatRigCamera;
  gunType?: number; targetWorld?: RigWorldPoint | null; movementWorld?: RigWorldPoint;
  /** Optional facing; native branch projects world target/movement onto source right. Source unmirrored faces left. */
  facing?: "left" | "right";
  immediateAim?: boolean;
  /** Fixed steps keep native aiming/muzzle state current; upload visible geometry once per render. */
  uploadGeometry?: boolean;
};
export type CatRigActorOptions = {
  /** Screen pixels per Cat_Bone local unit. Existing basic baked height105 yields11.1258. */
  pixelsPerUnit?: number;
  /** Visual anchor in source Cat_Bone XY, Y up. Default origin is the genuine root. */
  originSource?: RigPoint;
  weaponId?: number;
  facing?: "left" | "right";
  /** Original Cat constructor uses12 for both angle interpolation speeds. */
  handRotateSpeed?: number; faceRotateSpeed?: number;
};
export class CatRigActor {
  readonly view = new Container();
  readonly manifest: CatRigManifest;
  readonly pixelsPerUnit: number;
  readonly originSource: RigPoint;
  readonly layers: { layer: RigLayer; mesh: SimpleMesh }[];
  private pose: Map<number, Affine>;
  private clip: "Idle" | "Walk" = "Idle";
  private time = 0;
  private weaponId: number;
  private mirrored: boolean;
  private target: RigPoint | null = null;
  private handWorldAngle: number | undefined;
  private faceLocalAngle: number | undefined;
  private recoilTime = Infinity;
  private handSpeed: number;
  private faceSpeed: number;
  private worldContext: { rootWorld: RigWorldPoint; camera: CatRigCamera } | undefined;
  private worldTarget: RigWorldPoint | null = null;
  private worldGunType: number | undefined;
  private worldTargetObject: RigWorldPoint | null | undefined;
  private movementWorld: RigWorldPoint = { x: 0, y: 0, z: 0 };
  private worldPose: CatRigWorldPose | undefined;
  private proceduralRotations = new Map<number, Tuple4>();
  private nativeHandZ = 130 * DEG;
  private nativeAimDebug: unknown;
  private selectedSkin=-1;
  private sampledInput: string | undefined;
  private projectionConfig: ReturnType<typeof getCatRigProjectionConfig> | undefined;

  constructor(assets: CatRigAssets, options: CatRigActorOptions = {}) {
    this.manifest = assets.manifest;
    this.pixelsPerUnit = options.pixelsPerUnit ?? 11.1258;
    this.originSource = options.originSource ?? { x: 0, y: 0 };
    this.weaponId = options.weaponId ?? 0;
    this.mirrored = options.facing === "right";
    this.handSpeed = options.handRotateSpeed ?? 12; this.faceSpeed = options.faceRotateSpeed ?? 12;
    this.pose = sampleCatRigPose(this.manifest, "Idle", 0);
    this.layers = this.manifest.layers.map(layer => {
      const mesh = new SimpleMesh(assets.textures.get(layer.sprite)!, new Float32Array(layer.positions.length * 2),
        new Float32Array(layer.uvs), new Uint16Array(layer.indices));
      mesh.autoUpdate = false;
      mesh.alpha = layer.color[3]; mesh.tint = (Math.round(layer.color[0] * 255) << 16) |
        (Math.round(layer.color[1] * 255) << 8) | Math.round(layer.color[2] * 255);
      this.view.addChild(mesh);
      return { layer, mesh };
    });
    this.refresh();
  }
  /** Cat.Skin_Reload swaps the body SpriteSkin and tints only the hand renderer. */
  setSkin(assets:CatRigSkinAssets,index:number) {
    if(this.selectedSkin===index)return;
    const layer=assets.layers[index],color=assets.colors[index];if(!layer||!color)throw RangeError('Invalid skin rig identity');
    const entry=this.layers.find(e=>e.layer.node===CAT_RIG_SOURCE_NODES.root)!;
    const mesh=new SimpleMesh(assets.textures.get(layer.sprite)!,new Float32Array(layer.positions.length*2),new Float32Array(layer.uvs),new Uint16Array(layer.indices));mesh.autoUpdate=false;mesh.alpha=layer.color[3];mesh.tint=(Math.round(layer.color[0]*255)<<16)|(Math.round(layer.color[1]*255)<<8)|Math.round(layer.color[2]*255);
    const order=this.view.getChildIndex(entry.mesh);this.view.removeChild(entry.mesh);entry.mesh.destroy({texture:false,baseTexture:false});this.view.addChildAt(mesh,order);entry.layer=layer;entry.mesh=mesh;
    const hand=this.layers.find(e=>e.layer.node===CAT_RIG_SOURCE_NODES.hand)!;hand.mesh.tint=(Math.round(color[0]*255)<<16)|(Math.round(color[1]*255)<<8)|Math.round(color[2]*255);hand.mesh.alpha=color[3];this.selectedSkin=index;this.refresh();
  }
  setWeapon(weaponId: number) {
    this.sampledInput = undefined;
    this.weaponId = this.manifest.guns.some(gun => gun.id === weaponId) ? weaponId : 0;
    this.refresh();
  }
  setAim(aimScreen: RigPoint | null, immediate = false) {
    this.target = aimScreen;
    this.update({ dtSeconds: 0, moving: this.clip === "Walk", immediateAim: immediate });
  }
  /** Trigger only from a real shot event; resetting reproduces Bounce_Start's reset of time. */
  fire(uploadGeometry = true) { this.sampledInput = undefined; this.recoilTime = 0; this.refresh(uploadGeometry); }
  update(input: CatRigUpdate) {
    const dt = clamp(input.dtSeconds, 0, 0.1);
    const nextClip = input.moving ? "Walk" : "Idle";
    if (nextClip !== this.clip) { this.clip = nextClip; this.time = 0; }
    this.time += dt; this.recoilTime += dt;
    if (input.weaponId !== undefined) this.weaponId = this.manifest.guns.some(g => g.id === input.weaponId) ? input.weaponId : 0;
    if (input.aimScreen !== undefined) this.target = input.aimScreen;
    if (input.rootWorld || input.camera) {
      const rootWorld = input.rootWorld ?? this.worldContext?.rootWorld;
      const camera = input.camera ?? this.worldContext?.camera;
      if (!rootWorld || !camera) throw new Error("Native rig aiming requires both rootWorld and camera on the first update");
      this.worldContext = { rootWorld, camera };
    }
    if (input.aimWorld !== undefined) this.worldTarget = input.aimWorld;
    if (input.gunType !== undefined) this.worldGunType = input.gunType;
    if (input.targetWorld !== undefined) this.worldTargetObject = input.targetWorld;
    if (input.movementWorld !== undefined) this.movementWorld = input.movementWorld;
    if (this.worldContext) {
      // Repeated zero-time projection/muzzle queries must reuse the same solved pose.
      // Include every native input; real fixed steps still advance the procedural chain.
      const point=(p:RigWorldPoint|null|undefined)=>p?[p.x,p.y,p.z]:null;
      const key=JSON.stringify([this.clip,this.time,this.recoilTime,this.weaponId,input.facing,input.immediateAim,
        point(this.worldContext.rootWorld),this.worldContext.camera,point(this.worldTarget),this.worldGunType,
        point(this.worldTargetObject),point(this.movementWorld)]);
      if(dt!==0||key!==this.sampledInput){this.updateNativeAim(input,dt);this.sampledInput=key;}
      this.refresh(input.uploadGeometry !== false,true);
      return;
    }
    if (input.facing) this.mirrored = input.facing === "right";
    else if (this.target) {
      const origin = this.view.toGlobal({ x: 0, y: 0 });
      if (Math.abs(this.target.x - origin.x) > 2) this.mirrored = this.target.x > origin.x;
    }
    if (this.target) {
      const target = this.view.toLocal(this.target);
      const targetSource = { x: target.x / this.pixelsPerUnit * (this.mirrored ? -1 : 1) + this.originSource.x,
        y: -target.y / this.pixelsPerUnit + this.originSource.y };
      const base = sampleCatRigPose(this.manifest, this.clip, this.time);
      const pivot = base.get(CAT_RIG_SOURCE_NODES.handBone)!;
      const desired = Math.atan2(targetSource.y - pivot[5], targetSource.x - pivot[4]);
      const hand = this.handWorldAngle ?? Math.atan2(pivot[1], pivot[0]);
      this.handWorldAngle = hand + wrapAngle(desired - hand) * (input.immediateAim ? 1 : clamp(dt * this.handSpeed, 0, 1));
      // Original face20..160 degree range. Neutral90; elevate only the face follower.
      const head = base.get(CAT_RIG_SOURCE_NODES.facePivot)!;
      const elevation = Math.atan2(targetSource.y - head[5], Math.abs(targetSource.x - head[4]));
      const desiredFace = clamp(Math.PI / 2 - elevation * (140 / 180), 20 * DEG, 160 * DEG);
      const face = this.faceLocalAngle ?? Math.PI / 2;
      this.faceLocalAngle = face + wrapAngle(desiredFace - face) * (input.immediateAim ? 1 : clamp(dt * this.faceSpeed, 0, 1));
    }
    this.refresh(input.uploadGeometry !== false);
  }
  private recoilEnvelope() {
    const phase = this.recoilTime / .1;
    return phase >= 0 && phase <= 2 ? 1 - Math.abs(phase - 1) : 0;
  }
  private updateNativeAim(input: CatRigUpdate, dt: number) {
    const context = this.worldContext!;
    if (input.facing) this.mirrored = input.facing === "right";
    else {
      const d = this.worldTarget ? sub3(this.worldTarget, context.rootWorld) : this.movementWorld;
      if (Math.abs(dot3(d, CAT_RIG_SOURCE_BASIS.right)) > 1e-8)
        this.mirrored = dot3(d, CAT_RIG_SOURCE_BASIS.right) > 0;
    }
    const facing = this.mirrored ? "right" : "left";
    const options: CatRigWorldPoseOptions = { rootWorld: context.rootWorld, facing,
      recoil: this.recoilEnvelope(), localRotations: this.proceduralRotations };
    let base = sampleCatRigWorldPose(this.manifest, this.clip, this.time, options);
    if (!this.worldPose) {
      // Cat.Start initializes both hands to local Euler Z130; Animator has no hand rotation channels.
      base = sampleCatRigWorldPose(this.manifest, this.clip, this.time,
        { ...options, handLocalZ: this.nativeHandZ, leftHandLocalZ: this.nativeHandZ });
      options.localRotations = base.localRotations;
    }
    const aim: CatRigNativeAimInput = { rootWorld: context.rootWorld, aimWorld: this.worldTarget,
      gunType: this.worldGunType ?? this.manifest.guns.find(g => g.id === this.weaponId)?.type ?? 0,
      targetWorld: this.worldTargetObject, movementWorld: this.movementWorld, facing, currentHandZ: this.nativeHandZ };
    const hand = solveCatRigNativeHandAim(this.manifest, base, aim);
    const lerpAngle = (from: number, to: number, amount: number) => {
      let delta = ((to - from) % TAU + TAU) % TAU;
      if (delta > Math.PI) delta -= TAU;
      return from + delta * amount;
    };
    this.nativeHandZ = lerpAngle(this.nativeHandZ, hand.desiredLocalZ,
      input.immediateAim ? 1 : clamp(dt * this.handSpeed, 0, 1));
    let pose = sampleCatRigWorldPose(this.manifest, this.clip, this.time, { ...options, handLocalZ: this.nativeHandZ });
    // ApplyLeftHandTowardGunPivot is an immediate parent-direction atan2 after ApplyHandZ.
    const left = matrixOrigin(pose.matrices.get(CAT_RIG_SOURCE_NODES.leftHandBone)!);
    const gun = matrixOrigin(pose.matrices.get(CAT_RIG_SOURCE_NODES.gunPivot)!);
    const delta = sub3(gun, left);
    if (dot3(delta, delta) >= 1e-4) {
      const parent = this.manifest.nodes.find(n => n.id === CAT_RIG_SOURCE_NODES.leftHandBone)!.parent!;
      const direction = qDirection(qInverse(pose.rotations.get(parent)!), delta);
      pose = sampleCatRigWorldPose(this.manifest, this.clip, this.time,
        { ...options, localRotations: pose.localRotations, leftHandLocalZ: Math.atan2(direction.y, direction.x) });
    }
    const faceTarget = solveCatRigNativeFaceAim(aim);
    const faceCurrent = qToEuler(pose.localRotations.get(CAT_RIG_SOURCE_NODES.facePivot)!)[2];
    const faceLocalZ = lerpAngle(faceCurrent, faceTarget, input.immediateAim ? 1 : clamp(dt * this.faceSpeed, 0, 1));
    pose = sampleCatRigWorldPose(this.manifest, this.clip, this.time,
      { ...options, localRotations: pose.localRotations, faceLocalZ });
    this.proceduralRotations = pose.localRotations;
    this.worldPose = pose;
    this.nativeAimDebug = { ...hand, handLocalZ: this.nativeHandZ, faceLocalZ, faceTarget, rootWorld: context.rootWorld };
  }
  /** Project full3D vertices back into the view coordinates consumed by the source projection matrix. */
  private worldPointToView(point: RigWorldPoint): RigPoint {
    const context = this.worldContext!;
    const config = this.projectionConfig ?? getCatRigProjectionConfig(this.manifest, context.rootWorld, context.camera,
      this.pixelsPerUnit / this.manifest.source.unityRootScale);
    const relative = sub3(point, config.originWorld), ppm = this.pixelsPerUnit / this.manifest.source.unityRootScale;
    const x = dot3(config.cameraBasis.right, relative) * ppm, y = -dot3(config.cameraBasis.up, relative) * ppm;
    const m = config.viewMatrix, determinant = m.a * m.d - m.b * m.c;
    if (Math.abs(determinant) < 1e-8) throw new Error("Source character plane projects to an edge at this camera angle");
    return { x: (m.d * x - m.c * y) / determinant - this.originSource.x * this.pixelsPerUnit,
      y: (-m.b * x + m.a * y) / determinant + this.originSource.y * this.pixelsPerUnit };
  }
  private refresh(uploadGeometry = true, solvedWorldPose = false) {
    // Source Bounce_Position and Bounce_Custom each ramp to their target then return in0.2 seconds.
    const recoil = this.recoilEnvelope();
    if (this.worldContext) {
      this.projectionConfig = getCatRigProjectionConfig(this.manifest, this.worldContext.rootWorld,
        this.worldContext.camera, this.pixelsPerUnit / this.manifest.source.unityRootScale);
      if(!solvedWorldPose) this.worldPose = sampleCatRigWorldPose(this.manifest, this.clip, this.time,
        { rootWorld: this.worldContext.rootWorld, facing: this.mirrored ? "right" : "left",
          localRotations: this.proceduralRotations, recoil });
      if (!uploadGeometry) return;
      for (const { layer, mesh } of this.layers) {
        mesh.visible = layer.weaponId === undefined || layer.weaponId === this.weaponId;
        if (!mesh.visible) continue;
        const source = catRigLayerWorldPositions(layer, this.worldPose!), output = mesh.vertices;
        for (let i = 0; i < source.length / 3; i++) {
          const point = this.worldPointToView({ x: source[i * 3], y: source[i * 3 + 1], z: source[i * 3 + 2] });
          output[i * 2] = point.x; output[i * 2 + 1] = point.y;
        }
        mesh.geometry.getBuffer("aVertexPosition").update();
      }
      return;
    }
    this.pose = sampleCatRigPose(this.manifest, this.clip, this.time,
      { handWorldAngle: this.handWorldAngle, faceLocalAngle: this.faceLocalAngle, recoil });
    if (!uploadGeometry) return;
    for (const { layer, mesh } of this.layers) {
      mesh.visible = layer.weaponId === undefined || layer.weaponId === this.weaponId;
      if (!mesh.visible) continue;
      const source = catRigLayerPositions(layer, this.pose), output = mesh.vertices;
      for (let i = 0; i < source.length; i += 2) {
        output[i] = (source[i] - this.originSource.x) * this.pixelsPerUnit * (this.mirrored ? -1 : 1);
        output[i + 1] = -(source[i + 1] - this.originSource.y) * this.pixelsPerUnit;
      }
      mesh.geometry.getBuffer("aVertexPosition").update();
    }
  }
  getSourcePoint(node: number): RigPoint {
    if (this.worldPose && this.worldContext) {
      const matrix = this.worldPose.matrices.get(node);
      if (!matrix) throw new Error(`Unknown Cat rig source transform ${node}`);
      const root = this.projectionConfig!.originWorld;
      const delta = sub3(matrixOrigin(matrix), root), basis = getCatRigSourceBasis(this.mirrored ? "right" : "left");
      return { x: dot3(delta, basis.right) / this.manifest.source.unityRootScale,
        y: dot3(delta, basis.up) / this.manifest.source.unityRootScale };
    }
    const matrix = this.pose.get(node);
    if (!matrix) throw new Error(`Unknown Cat rig source transform ${node}`);
    return { x: matrix[4], y: matrix[5] };
  }
  getShootSource(): RigPoint {
    const gun = this.manifest.guns.find(g => g.id === this.weaponId)!;
    return this.getSourcePoint(gun.shoot);
  }
  /** Genuine Shoot_trans world position before camera-forward intersection with Y2. */
  /** Attack's FaceTowardEnemy changes Pivot facing immediately, NOT the
   * hand/face angle lerp or Animator time. Hunt AI attacks before its hand pass. */
  faceTowardEnemy(target:RigWorldPoint):void {
    if(!this.worldContext)throw Error("FaceTowardEnemy requires a world pose");
    this.worldTarget=target;
    const delta=sub3(target,this.worldContext.rootWorld),right=dot3(delta,CAT_RIG_SOURCE_BASIS.right);
    if(Math.abs(right)>1e-8)this.mirrored=right>0;
    this.worldPose=sampleCatRigWorldPose(this.manifest,this.clip,this.time,{rootWorld:this.worldContext.rootWorld,
      facing:this.mirrored?"right":"left",recoil:this.recoilEnvelope(),localRotations:this.proceduralRotations,handLocalZ:this.nativeHandZ});
    this.sampledInput=undefined;
    this.refresh(false,true);
  }
  /** Strict live original Transform read. Used by multi-Cat Hunt socket maps.
   * Never falls back to a visible Sprite or to another weapon's socket. */
  getTransformWorld(transformID:number):RigWorldPoint {
    const m=this.worldPose?.matrices.get(transformID);
    if(!m)throw new Error(`Unbound live Cat Transform ${transformID}`);
    return {x:m[3],y:m[7],z:m[11]};
  }
  getShootRawWorld(): RigWorldPoint {
    if (!this.worldPose) throw new Error("getShootRawWorld requires a native world update");
    const gun = this.manifest.guns.find(g => g.id === this.weaponId)!;
    return matrixOrigin(this.worldPose.matrices.get(gun.shoot)!);
  }
  /** Cat.GetFirePosition: choose one original random Transform per ATTACK,
   * then project its live world position along CamForward. Not a flash socket.
   * Explicit host integer RNG; don't sample for a gun without random sockets. */
  getFireWorld(camForward: RigWorldPoint, rangeInt: (min:number,maxExclusive:number)=>number): RigWorldPoint {
    if(!this.worldPose)throw new Error("getFireWorld requires a native world update");
    const gun=this.manifest.guns.find(g=>g.id===this.weaponId)!;
    return sourceHuntGunFirePosition({shoot:gun.shoot,shootRandom:gun.shootRandom??[]},camForward,
      id=>{const matrix=this.worldPose!.matrices.get(id);if(!matrix)throw new Error(`Missing original gun Transform ${id}`);return matrixOrigin(matrix);},rangeInt);
  }
  getShootScreen(): RigPoint {
    if (this.worldPose) return this.view.toGlobal(this.worldPointToView(this.getShootRawWorld()));
    const source = this.getShootSource();
    return this.view.toGlobal({ x: (source.x - this.originSource.x) * this.pixelsPerUnit * (this.mirrored ? -1 : 1),
      y: -(source.y - this.originSource.y) * this.pixelsPerUnit });
  }
  /** rootWorld is original actor origin. Source Pivot rotates Cat_Bone offset and mesh with its original40 degree pitch. */
  getShootWorld(rootWorld: RigWorldPoint, cameraForward: RigWorldPoint): RigWorldPoint {
    if (this.worldPose && this.worldContext) {
      const raw = this.getShootRawWorld(), delta = sub3(rootWorld, this.worldContext.rootWorld);
      return projectMuzzleToWorldY2({ x: raw.x + delta.x, y: raw.y + delta.y, z: raw.z + delta.z }, cameraForward);
    }
    const local = this.getShootSource(), scale = this.manifest.source.unityRootScale;
    const basis = getCatRigSourceBasis(this.mirrored ? "right" : "left");
    const x = local.x * scale, y = this.manifest.source.unityRootPositionY + local.y * scale;
    return projectMuzzleToWorldY2({ x: rootWorld.x + basis.right.x * x + basis.up.x * y,
      y: rootWorld.y + basis.right.y * x + basis.up.y * y,
      z: rootWorld.z + basis.right.z * x + basis.up.z * y }, cameraForward);
  }
  /** Flash root is Muzzle origin, inheriting Shoot_trans rotation/scale exactly once. */
  getMuzzleEmissionTransform(): {rootWorldPosition:RigWorldPoint;rootRotation:Tuple4;rootScaleWorld:RigWorldPoint;rootBasisWorld:{right:RigWorldPoint;up:RigWorldPoint;forward:RigWorldPoint}} {
    if(!this.worldPose)throw new Error("getMuzzleEmissionTransform requires native world pose");
    const gun=this.manifest.guns.find(g=>g.id===this.weaponId)!,matrix=this.worldPose.matrices.get(gun.shoot)!;
    return {rootWorldPosition:this.getMuzzleRawWorld(),rootRotation:this.worldPose.rotations.get(gun.shoot)!,
      rootScaleWorld:{x:Math.hypot(matrix[0],matrix[4],matrix[8]),y:Math.hypot(matrix[1],matrix[5],matrix[9]),z:Math.hypot(matrix[2],matrix[6],matrix[10])},
      rootBasisWorld:{right:{x:matrix[0],y:matrix[4],z:matrix[8]},up:{x:matrix[1],y:matrix[5],z:matrix[9]},forward:{x:matrix[2],y:matrix[6],z:matrix[10]}}};
  }
  /** Source Muzzle transform owns the flash scale and differs from projectile Shoot_trans. */
  getMuzzleSource(): RigPoint {
    const gun=this.manifest.guns.find(g=>g.id===this.weaponId)!;
    return this.getSourcePoint(gun.muzzle);
  }
  getMuzzleRawWorld(): RigWorldPoint {
    if(!this.worldPose)throw new Error("getMuzzleRawWorld requires a native world update");
    const gun=this.manifest.guns.find(g=>g.id===this.weaponId)!;
    return matrixOrigin(this.worldPose.matrices.get(gun.muzzle)!);
  }
  getMuzzleScreen(): RigPoint {
    if(this.worldPose)return this.view.toGlobal(this.worldPointToView(this.getMuzzleRawWorld()));
    const source=this.getMuzzleSource();
    return this.view.toGlobal({x:(source.x-this.originSource.x)*this.pixelsPerUnit*(this.mirrored?-1:1),y:-(source.y-this.originSource.y)*this.pixelsPerUnit});
  }
  /** Kept for callers asking for projected Muzzle position; projectile spawning uses getShootWorld. */
  getMuzzleWorld(rootWorld:RigWorldPoint,cameraForward:RigWorldPoint):RigWorldPoint {
    if(this.worldPose&&this.worldContext){const raw=this.getMuzzleRawWorld(),delta=sub3(rootWorld,this.worldContext.rootWorld);
      return projectMuzzleToWorldY2({x:raw.x+delta.x,y:raw.y+delta.y,z:raw.z+delta.z},cameraForward);}
    const local=this.getMuzzleSource(),scale=this.manifest.source.unityRootScale,basis=getCatRigSourceBasis(this.mirrored?"right":"left");
    const x=local.x*scale,y=this.manifest.source.unityRootPositionY+local.y*scale;
    return projectMuzzleToWorldY2({x:rootWorld.x+basis.right.x*x+basis.up.x*y,y:rootWorld.y+basis.right.y*x+basis.up.y*y,z:rootWorld.z+basis.right.z*x+basis.up.z*y},cameraForward);
  }
  debugPose() { return { skin:this.selectedSkin,bodySprite:this.layers.find(e=>e.layer.node===CAT_RIG_SOURCE_NODES.root)?.layer.sprite,bodyVertices:this.layers.find(e=>e.layer.node===CAT_RIG_SOURCE_NODES.root)?.layer.positions.length,handTint:this.layers.find(e=>e.layer.node===CAT_RIG_SOURCE_NODES.hand)?.mesh.tint,clip: this.clip, timeSeconds: this.time, weaponId: this.weaponId, facing: this.mirrored ? "right" : "left",
    handWorldAngle: this.handWorldAngle, faceLocalAngle: this.faceLocalAngle, recoilTime: this.recoilTime,
    nativeAim: this.nativeAimDebug, shootSource:this.getShootSource(),shootScreen:this.getShootScreen(),muzzleRawWorld: this.worldPose ? this.getMuzzleRawWorld() : null,
    muzzleSource: this.getMuzzleSource(), muzzleScreen: this.getMuzzleScreen() }; }
  destroy() { this.view.destroy({ children: true }); }
}
export function createCatRigActor(assets: CatRigAssets, options: CatRigActorOptions = {}) {
  return new CatRigActor(assets, options);
}
