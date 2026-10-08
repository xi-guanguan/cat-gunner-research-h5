/** Cat static camera correction and joystick quaternion contract.
 * Internal_FromEulerRad icall identification closes the radians-vs-degrees gap.
 * op_Multiply operations follow 0x56cdb04 (binary32, no FMA). The yaw-only
 * sin/cos construction uses H5 libm, NOT an asserted Unity engine bit match.
 * This is not a replacement for Camera.WorldToViewportPoint / source scene rig.
 */
import evidence from './data/hunt-cat-camera-source.json';
import {sourceScreenSpeedMultiplierFromCorrectedDirection,type SourceVector3} from './cat-movement-source';
export const SOURCE_CAT_CAMERA_INPUTS=evidence;
export interface SourceQuaternion {readonly x:number;readonly y:number;readonly z:number;readonly w:number}
const f=Math.fround;
function scalar(v:number):number {if(!Number.isFinite(v)||!Number.isFinite(f(v)))throw new RangeError('Invalid Cat quaternion input');return f(v);}
export function sourceCatYawQuaternionH5(radians:number):SourceQuaternion {
 const half=f(scalar(radians)*.5);return {x:0,y:f(Math.sin(half)),z:0,w:f(Math.cos(half))};
}
/** Quaternion.op_Multiply(Vector3), source instruction grouping retained. */
export function sourceCatRotateVector(q:SourceQuaternion,p:SourceVector3):SourceVector3 {
 const x=scalar(q.x),y=scalar(q.y),z=scalar(q.z),w=scalar(q.w),vx=scalar(p.x),vy=scalar(p.y),vz=scalar(p.z);
 const x2=f(x+x),y2=f(y+y),z2=f(z+z),xx=f(x*x2),yy=f(y*y2),zz=f(z*z2),xy=f(x*y2),xz=f(x*z2),yz=f(y*z2),wx=f(w*x2),wy=f(w*y2),wz=f(w*z2);
 return {x:f(f(f(vy*f(xy-wz))+f(vx*f(1-f(yy+zz))))+f(vz*f(xz+wy))),
  y:f(f(vz*f(yz-wx))+f(f(vx*f(xy+wz))+f(vy*f(1-f(xx+zz))))),
  z:f(f(f(vx*f(xz-wy))+f(vy*f(yz+wx)))+f(vz*f(1-f(xx+yy))))};
}
export const SOURCE_CAT_CORRECTION_YAW_H5=Object.freeze(sourceCatYawQuaternionH5(evidence.camCorrectionYawRadians));
export const SOURCE_CAT_JOYSTICK_YAW_H5=Object.freeze(sourceCatYawQuaternionH5(evidence.joystickYawRadians));
export function sourceCatCorrectDirectionH5(direction:SourceVector3):SourceVector3 {return sourceCatRotateVector(SOURCE_CAT_CORRECTION_YAW_H5,direction);}
export function sourceCatScreenSpeedMultiplierH5(direction:SourceVector3):number {return sourceScreenSpeedMultiplierFromCorrectedDirection(sourceCatCorrectDirectionH5(direction));}
