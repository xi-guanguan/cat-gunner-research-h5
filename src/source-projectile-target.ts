/** Structural collision/damage port shared by source Enemy consumers.
 * No Hunt wave/pool/movement rule is part of this interface. uiMode is required:
 * Bullet's laser/pierce policy terminates on live Enemy in Raid(5), unlike Hunt(4).
 * Contact ordering/sweeps remain an explicit H5 physics adapter. */
import type {BigValue,BigValueInput} from './big-value';
import type {SourceVector3} from './cat-movement-source';
export interface SourceProjectileTargetToken {id:number;generation:number}
export interface SourceProjectileTargetContact {token:SourceProjectileTargetToken;colliderID:number;health:BigValue}
export interface SourceProjectileTargetPort {
 readonly projectileUiMode:4|5;
 readonly phase:string;
 current(token:SourceProjectileTargetToken):{health:BigValue}|null|undefined;
 damage(token:SourceProjectileTargetToken,damage:BigValueInput):boolean;
 bulletContacts(from:SourceVector3,to:SourceVector3,radius:number):(SourceProjectileTargetContact&{t:number})[];
 explosionContacts(position:SourceVector3,radius:number,layerMask:number):SourceProjectileTargetContact[];
}
