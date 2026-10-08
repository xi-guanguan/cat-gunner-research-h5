/** Native field identities recovered from Pet_Reload@0x2b7c524 and
 * Relic_manager.Value_Reload@0x2b31f8c. Evidence: hunt-movement-stat-binding-extract.json.
 * Relic runtime/save is NOT yet closed: require an explicit, already resolved
 * MoveSpeed_Value, never silently substitute zero for an ordinary player. */
import {sourcePetSelectedStats,type SourcePetState} from './r5-pet';
import type {SourceRawMovementStatSlots} from './cat-movement-source';
export function bindSourceHuntMovementStats(pet:SourcePetState,relicMoveSpeedValue:number):SourceRawMovementStatSlots {
 if(!Number.isInteger(relicMoveSpeedValue)||relicMoveSpeedValue<-2147483648||relicMoveSpeedValue>2147483647)throw RangeError('Unresolved or invalid Relic MoveSpeed_Value');
 return {slot5d5d4d0Static20:sourcePetSelectedStats(pet).moveSpeedMultiplierPercent|0,slot5d5d4d8Static60:relicMoveSpeedValue};
}
