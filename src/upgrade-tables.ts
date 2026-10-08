import { BigValue } from './big-value';

export type UpgradeStatKind = 'power' | 'money' | 'speed';
export const UPGRADE_TABLE_MAX_LEVEL = 10000;
export const UPGRADE_TABLE_LENGTH = UPGRADE_TABLE_MAX_LEVEL + 1;
/** Static ARM64/metadata reconstruction. No native runtime table capture yet. */
export const UPGRADE_TABLE_EVIDENCE = Object.freeze({
  precision: 'confirmed-static-truncation-toward-zero',
  doubleConversion: 'confirmed-static-invariant-G17-then-H17',
  runtimeEquality: 'not-yet-observed',
  nativeDisplaySuffixes: 'settings-resource-not-yet-recovered',
  sourceSha256: '80eb8bcbebd058ffb4beac5d8d7d544066587a7a1abee8898874847ff13dc583',
});
let prices: readonly BigValue[] | undefined;
let stats: readonly BigValue[] | undefined;
function checkedLevel(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > UPGRADE_TABLE_MAX_LEVEL)
    throw new RangeError('Upgrade level must be within 0..10000');
  return level;
}
function priceTable(): readonly BigValue[] {
  if (prices) return prices;
  // Literal binary64 operands have these invariant G17 spellings. Using their
  // rational-looking short spellings (1.38/1.08) changes the original tables.
  const growth = BigValue.parse('1.3799999999999999').significant(17);
  const doubling = BigValue.parse('2').significant(17);
  let current = BigValue.fromNumber(50);
  const table: BigValue[] = [];
  for (let level = 0; level < UPGRADE_TABLE_LENGTH; level++) {
    table.push(current.truncateInteger().significant(3));
    if (level < UPGRADE_TABLE_MAX_LEVEL)
      current = current.nativeMultiply(level < 5000 ? growth : doubling).significant(4);
  }
  prices = Object.freeze(table);
  return prices;
}
function statTable(): readonly BigValue[] {
  if (stats) return stats;
  const growth = BigValue.parse('1.0800000000000001').significant(17);
  let current = BigValue.fromInteger(100, 5);
  const table: BigValue[] = [current];
  for (let level = 1; level < UPGRADE_TABLE_LENGTH; level++) {
    current = current.nativeMultiply(growth).significant(3);
    table.push(current);
  }
  stats = Object.freeze(table);
  return stats;
}
export function upgradePriceValue(level: number): BigValue { return priceTable()[checkedLevel(level)]; }
export function upgradeStatValue(kind: UpgradeStatKind, level: number): BigValue {
  checkedLevel(level);
  if (kind === 'speed') return new BigValue(BigInt(100 + 8 * level));
  if (kind === 'power' || kind === 'money') return statTable()[level];
  throw new TypeError('Unknown upgrade stat kind');
}
export function upgradeSpeedValue(level: number): number { return 100 + 8 * checkedLevel(level); }
/** Read-only table access for directed audit, without mutable shared entries. */
export function upgradeTables(): Readonly<{
  price: readonly BigValue[]; power: readonly BigValue[]; money: readonly BigValue[]; speed: readonly number[];
}> {
  return Object.freeze({ price: priceTable(), power: statTable(), money: statTable(),
    speed: Object.freeze(Array.from({ length: UPGRADE_TABLE_LENGTH }, (_, i) => 100 + i * 8)) });
}
