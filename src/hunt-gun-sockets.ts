/** Original Gun serialized socket identities, not generated offsets.
 * Cat.GetFirePosition@0x2b41b8c / CalcBulletSpawnPos@0x2b424cc share the
 * CamForward (static+0x38), NOT CamCorrection (yaw quaternion static+0x44).
 * Integer Random.Range(0,length) is sampled ONCE per Attack before critical RNG.
 */
import source from './data/hunt-gun-sockets-source.json';
import {sourceHuntCatBulletSpawnPosition} from './hunt-cat-runtime';
import type {SourceVector3} from './cat-movement-source';
export const SOURCE_HUNT_GUN_SOCKETS=source;
export interface SourceHuntGunSockets {readonly shoot:number;readonly shootRandom:readonly number[]}
export function sourceHuntGunSockets(catComponentID:number,gunNum:number):SourceHuntGunSockets {
 const cat=source.cats.find(c=>c.catComponentID===catComponentID);
 if(!cat||!Number.isInteger(gunNum)||gunNum<0||gunNum>=cat.guns.length)throw new RangeError('Unknown original Cat/Gun socket binding');
 return cat.guns[gunNum];
}
export function sourceHuntGunFirePosition(sockets:SourceHuntGunSockets,camForward:SourceVector3,
 readWorld:(transformID:number)=>SourceVector3,rangeInt:(min:number,maxExclusive:number)=>number):SourceVector3 {
 if(!Number.isSafeInteger(sockets.shoot)||sockets.shoot<=0||sockets.shootRandom.some(id=>!Number.isSafeInteger(id)||id<=0))throw new RangeError('Invalid original gun Transform identity');
 let id=sockets.shoot;
 if(sockets.shootRandom.length){const i=rangeInt(0,sockets.shootRandom.length);
  if(!Number.isInteger(i)||i<0||i>=sockets.shootRandom.length)throw new RangeError('Invalid integer gun socket Random.Range result');
  id=sockets.shootRandom[i];
 }
 return sourceHuntCatBulletSpawnPosition(readWorld(id),camForward);
}
