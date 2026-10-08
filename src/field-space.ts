import type { Point } from "./rules";

export const FIELD_UNITS_PER_POINT = { x: 50 / 9, y: 60 / 16 };
export const FIELD_SPAWN: Point = { x: 4.5, y: 16.3 };

export function fieldToWorld(point: Point) {
  return { x: -125 + point.x * FIELD_UNITS_PER_POINT.x,
    z: (point.y - FIELD_SPAWN.y) * FIELD_UNITS_PER_POINT.y };
}

export function worldToField(x: number, z: number): Point {
  return { x: (x + 125) / FIELD_UNITS_PER_POINT.x,
    y: z / FIELD_UNITS_PER_POINT.y + FIELD_SPAWN.y };
}
