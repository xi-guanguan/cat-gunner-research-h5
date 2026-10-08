/** Cat.Start reseeds shared Unity Random with GetInstanceID for each AI, then
 * draws lag/speed/fidget interval/attack delay in that order. AIFidget draws
 * interval/angle/radius and writes X=sin*radius, Z=cos*radius. H5 libm and RNG
 * are explicit adapters; neither is asserted bit-identical to native Unity.
 * Evidence: raid-cat-random-extract.json + raid-leader-native.txt.
 */
import source from './data/raid-cat-random-source.json';
import type {SourceVector3} from './cat-movement-source';
import type {SourceRaidCatFollowSettings} from './raid-cat-runtime';
export const SOURCE_RAID_CAT_RANDOM=Object.freeze(source.constants);
export interface SourceRaidRandomPort {
 initState(instanceID:number):void;
 rangeFloat(minInclusive:number,maxInclusive:number):number;
}
const f=Math.fround;
function identity(v:number):void {if(!Number.isInteger(v)||v<-2147483648||v>2147483647)throw RangeError('Invalid Raid Cat instance ID');}
function range(rng:SourceRaidRandomPort,min:number,max:number):number {
 const value=rng.rangeFloat(f(min),f(max));
 if(!Number.isFinite(value)||value<f(min)||value>f(max))throw RangeError('Raid Random.Range out of bounds');return f(value);
}
export function sourceRaidCatStartRandom(instanceID:number,rng:SourceRaidRandomPort):SourceRaidCatFollowSettings {
 identity(instanceID);const c=SOURCE_RAID_CAT_RANDOM;rng.initState(instanceID);
 const lagSeconds=range(rng,c.lagMin,c.lagMax),speedMultiplier=range(rng,c.speedMin,c.speedMax),
  fidgetInterval=range(rng,c.intervalMin,c.intervalMax),attackDelayOffset=range(rng,c.attackOffsetMin,c.attackOffsetMax);
 return {lagSeconds,speedMultiplier,fidgetInterval,attackDelayOffset,fidgetTimer:0,fidgetOffset:{x:0,y:0,z:0},ai:{state:0,timer:0}};
}
export function sourceRaidCatFidgetRandom(rng:SourceRaidRandomPort):{interval:number;offset:SourceVector3} {
 const c=SOURCE_RAID_CAT_RANDOM,interval=range(rng,c.intervalMin,c.intervalMax),angle=f(range(rng,c.angleMin,c.angleMax)*c.degreesToRadians),radius=range(rng,c.radiusMin,c.radiusMax);
 return {interval,offset:{x:f(radius*f(Math.sin(angle))),y:0,z:f(radius*f(Math.cos(angle)))}};
}
/** Named LOCAL TEST adapter. It preserves API draw/reseed order, NOT Unity RNG
 * sequences or Unity InstanceIDs. Never used for rewards, storage or services. */
export class LocalTestRaidRandom implements SourceRaidRandomPort {
 readonly identity='local-test-xorshift32';private state=1;
 initState(instanceID:number):void {identity(instanceID);this.state=(instanceID>>>0)||1;}
 unit():number {let n=this.state;n^=n<<13;n^=n>>>17;n^=n<<5;this.state=n>>>0;return this.state/4294967295;}
 rangeFloat(min:number,max:number):number {return f(f(min)+f(f(f(max)-f(min))*f(this.unit())));}
 rangeInt(min:number,maxExclusive:number):number {
  if(!Number.isInteger(min)||!Number.isInteger(maxExclusive)||maxExclusive<=min)throw RangeError('Invalid Raid local random integer range');
  return Math.min(maxExclusive-1,min+Math.floor(this.unit()*(maxExclusive-min)));
 }
}
