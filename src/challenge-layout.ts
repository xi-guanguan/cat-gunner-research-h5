import source from './data/challenge-layout.json';
import type { Point } from './rules';

export const challengeLayoutEvidence = 'artifacts/evidence/round3-20261001/challenge-RECEIPT.md';
/** Existing H5 projection adapter; source coordinates below are Unity local/world units. */
export const CHALLENGE_UNITS_PER_POINT = { x: 12, y: 6 };
export const CHALLENGE_SPAWN: Point = { x: 4.5, y: 8 };
const f = Math.fround;
/** Mathf.RoundToInt lowers to midpoint-to-even rounding in the native body. */
function roundToEven(value: number): number {
  const low = Math.floor(value), fraction = value - low;
  return fraction === .5 ? low % 2 === 0 ? low : low + 1 : Math.round(value);
}
export interface ChallengeRing { index: number; radius: number; count: number; angleStepDegrees: number; startAngleDegrees: number }
export interface ChallengeSlot { index: number; ring: number; local: { x: number; z: number }; world: { x: number; z: number }; position: Point }

/** SpeedRun_manager.Tree_Batch 0x2baa234, including single-precision allocation. */
export function challengeRings(targetCount: number): ChallengeRing[] {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > source.poolCount)
    throw new RangeError('challenge target count outside original pool');
  const width = f(source.outerRadius - source.innerRadius);
  const area = f(f(f(source.outerRadius * source.outerRadius) - f(source.innerRadius * source.innerRadius)) * source.piFloat);
  const spacing = f(Math.sqrt(f(area / f(targetCount))));
  const count = Math.max(1, roundToEven(f(width / spacing)));
  const step = f(width / f(count));
  const radii = Array.from({ length: count }, (_, i) => f(f(step * f(i + .5)) + source.innerRadius));
  const circumference = radii.reduce((sum, radius) => f(sum + f(radius * source.twoPiFloat)), 0);
  const allocated = radii.map(radius => Math.max(1, roundToEven(f(f(f(radius * source.twoPiFloat) / circumference) * f(targetCount)))));
  allocated[count - 1] = Math.max(1, allocated[count - 1] + targetCount - allocated.reduce((a,b) => a+b,0));
  return radii.map((radius,index) => {
    const angleStepDegrees = f(360 / f(allocated[index]));
    return { index, radius, count: allocated[index], angleStepDegrees,
      startAngleDegrees: index % 2 ? f(angleStepDegrees * .5) : 0 };
  });
}

/** Native layout is sampled once on entry. No tick, kill, or visibility operation resamples it. */
export function challengeSlots(targetCount: number, random01: () => number): ChallengeSlot[] {
  const slots: ChallengeSlot[] = [];
  const sample = (range: number) => {
    const value = random01();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('challenge RNG requires [0,1)');
    return f(-range + f(f(range * 2) * f(value)));
  };
  for (const ring of challengeRings(targetCount)) {
    for (let i=0; i<ring.count && slots.length<targetCount; i++) {
      const angle = f(f(f(f(i) * ring.angleStepDegrees) + ring.startAngleDegrees) * source.degreesToRadiansFloat);
      const cosine=f(Math.cos(angle)), sine=f(Math.sin(angle));
      const radial=sample(source.radialOffset), tangential=sample(source.tangentialOffset);
      const x=f(f(f(ring.radius*cosine)+f(cosine*radial))-f(sine*tangential));
      const z=f(f(f(ring.radius*sine)+f(sine*radial))+f(cosine*tangential));
      slots.push({index:slots.length,ring:ring.index,local:{x,z},
        world:{x:f(source.originWorld.x+x),z:f(source.originWorld.z+z)},
        position:{x:x/CHALLENGE_UNITS_PER_POINT.x+CHALLENGE_SPAWN.x,y:z/CHALLENGE_UNITS_PER_POINT.y+CHALLENGE_SPAWN.y}});
    }
  }
  return slots;
}
