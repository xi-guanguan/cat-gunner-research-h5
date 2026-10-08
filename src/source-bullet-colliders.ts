import raw from './data/source-bullet-colliders.json';

/** Source world units: all 27 serialized Bullet roots have scale (1,1,1). */
export const SOURCE_BULLET_COLLIDERS = raw;
export type SourceBulletWorldScale = readonly [number, number, number];
export type SourceBulletPhase = 'pooled' | 'live' | 'died';
export interface SourceBulletCollider {
  gunNum: number;
  gunType: number;
  visualTemplateKey: string;
  shape: 'sphere';
  localCenter: readonly [number, number, number];
  localRadius: number;
  actualBulletRadius: number;
  worldScale: SourceBulletWorldScale;
  isTrigger: true;
  sourceColliderKey: string;
  sourcePoolColliderKeys: readonly string[];
}

function binding(gunNum: number) {
  if (!Number.isInteger(gunNum) || gunNum < 0 || gunNum >= raw.gunBindings.length) {
    throw new RangeError(`No source Bullet collider binding for gunNum ${gunNum}`);
  }
  const record = raw.gunBindings[gunNum];
  if (record.gunNum !== gunNum) throw new Error('Source Bullet binding index mismatch');
  return record;
}

/**
 * Original radius defaults to the serialized root's scale, never the visual skin's scale.
 * A supplied adapter scale makes a bounding sphere using max(abs(x),abs(y),abs(z)).
 * No nonuniform original Bullet scale or runtime resize was observed in this evidence.
 */
export function sourceBulletRadius(gunNum: number, worldScale?: SourceBulletWorldScale): number {
  const record = binding(gunNum);
  if (worldScale === undefined) return record.actualBulletRadius;
  if (worldScale.length !== 3 || !worldScale.every(Number.isFinite)) {
    throw new RangeError('Bullet worldScale must contain three finite values');
  }
  return raw.sharedCollider.radius * Math.max(...worldScale.map(Math.abs));
}

export function sourceBulletCollider(gunNum: number, worldScale?: SourceBulletWorldScale): SourceBulletCollider {
  const record = binding(gunNum);
  return {
    gunNum, gunType: record.gunType, visualTemplateKey: record.visualTemplateKey,
    shape: 'sphere', localCenter: [0, 0, 0], localRadius: raw.sharedCollider.radius,
    actualBulletRadius: sourceBulletRadius(gunNum, worldScale),
    worldScale: worldScale === undefined ? [1, 1, 1] : [...worldScale], isTrigger: true,
    sourceColliderKey: raw.poolRoots[0].collider,
    sourcePoolColliderKeys: raw.poolRoots.map(root => root.collider),
  };
}

/** Source ResetState => enabled, DieAndWait => disabled; inactive pool object => no collision. */
export function sourceBulletColliderEnabled(phase: SourceBulletPhase): boolean {
  switch (phase) {
    case 'live': return true;
    case 'pooled': case 'died': return false;
    default: throw new RangeError(`Unknown Bullet lifecycle phase ${phase}`);
  }
}
