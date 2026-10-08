import type { TickInput } from "./rules";

export function screenInputToWorld(input: TickInput): TickInput {
  const screenX = Math.max(-1, Math.min(1, input.moveX ?? 0));
  const screenY = Math.max(-1, Math.min(1, input.moveY ?? 0));
  const worldX = screenX / 1.2 + screenY * 1.2;
  const worldZ = screenX / 1.2 - screenY * 1.2;
  // Preserve native X/1.2, Y*1.2 then -45-degree magnitude; joystick normalization belongs upstream.
  return { moveX: worldX * Math.SQRT1_2, moveY: worldZ * Math.SQRT1_2 };
}
