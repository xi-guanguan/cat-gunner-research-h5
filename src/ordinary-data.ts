/** Static original-source values. Numeric library identity and Unity RNG are unverified. */
export interface OrdinaryDecimal { digits: string; exponent: number }
export interface OrdinaryGrid {
  index: number; file_id: number; path_id: number; tree_count: number; tree_refs: number[];
  grid_anchor: { world_translation: number[] };
  tree_list_anchor: { world_translation: number[] };
}
export interface OrdinaryValues {
  schema_version: number;
  source: Record<string, string>;
  stage_health: OrdinaryDecimal[];
  stage_money: OrdinaryDecimal[];
  degree_rates: { shape: number[]; rows: number[][]; blob_sha256: string };
  tree_grids: { entries: OrdinaryGrid[]; count: number };
  degree_factors: { health: OrdinaryDecimal[]; money: OrdinaryDecimal[] };
  random_seed: string; active_pool_subset: string; coordinate_semantics: string;
}
function index(value: number, maximum: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value >= maximum) throw new RangeError(`${name} out of range`);
  return value;
}
/** Native GetStageHealth/GetStageMoney use the last entry beyond the table. */
export function ordinaryStageBase(data: OrdinaryValues, stage: number) {
  if (!Number.isInteger(stage) || stage < 0) throw new RangeError("stage must be a zero-based nonnegative integer");
  const i = Math.min(stage, data.stage_health.length - 1);
  return { health: { ...data.stage_health[i] }, money: { ...data.stage_money[i] } };
}
export function ordinaryLevelLayout(data: OrdinaryValues, stage: number, level: number) {
  ordinaryStageBase(data, stage);
  index(level, 5, "level");
  const perGrid = Math.max(30, Math.min(100, 10 * stage + 30));
  const ordinaryCount = perGrid * (level + 1);
  return { perGrid, ordinaryCount, bossCount: level === 4 ? 1 : 0,
    progressDenominator: ordinaryCount + (level === 4 ? 1 : 0),
    grids: data.tree_grids.entries.slice(0, level + 1),
    degreeWeights: [...data.degree_rates.rows[level]], randomSeed: data.random_seed };
}
export function ordinaryDegreeFactors(data: OrdinaryValues, degree: number) {
  index(degree, 4, "degree");
  return { health: { ...data.degree_factors.health[degree] }, money: { ...data.degree_factors.money[degree] } };
}
/** Candidate local spawn coordinate; caller supplies source-compatible jitter, never implicit RNG. */
export function ordinaryCell(data: OrdinaryValues, grid: number, poolIndex: number, jitterX = 0, jitterZ = 0) {
  index(grid, data.tree_grids.entries.length, "grid");
  const g = data.tree_grids.entries[grid];
  index(poolIndex, g.tree_count, "pool index");
  if (![jitterX, jitterZ].every(v => Number.isFinite(v) && Math.abs(v) <= 1.5)) throw new RangeError("jitter outside [-1.5,1.5]");
  return { local: { x: 5 * (poolIndex % 10) + jitterX, y: 0, z: 5 * Math.floor(poolIndex / 10) + jitterZ },
    treePathID: g.tree_refs[poolIndex], treeListAnchor: [...g.tree_list_anchor.world_translation],
    coordinateSemantics: data.coordinate_semantics };
}
export async function loadOrdinaryValues(url = `${import.meta.env.BASE_URL}assets/data/ordinary-values.json`): Promise<OrdinaryValues> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ordinary values HTTP ${response.status}`);
  const data = await response.json() as OrdinaryValues;
  if (data.schema_version !== 1 || data.stage_health?.length !== 5000 || data.stage_money?.length !== 5000 ||
      data.tree_grids?.entries?.length !== 5 || data.degree_rates?.rows?.length !== 5) throw new Error("invalid ordinary data dimensions");
  for (const table of [data.stage_health, data.stage_money, data.degree_factors.health, data.degree_factors.money]) {
    if (!table.every(v => /^-?\d+$/.test(v.digits) && Number.isInteger(v.exponent))) throw new Error("invalid ordinary decimal");
  }
  return data;
}
