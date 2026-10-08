/** Source Loading_UI timings; rendering and scene generation remain H5 adapters. */
export type TransitionKind = "enter" | "exit";
export class SceneTransition {
  elapsed = 0;
  active = false;
  kind: TransitionKind = "enter";
  private applied = false;
  private action: (() => void) | null = null;
  start(kind: TransitionKind, action: () => void): boolean {
    if (this.active) return false;
    this.kind = kind; this.elapsed = 0; this.active = true;
    this.applied = false; this.action = action;
    if (kind === "enter") this.apply();
    return true;
  }
  private apply() {
    if (this.applied) return;
    this.applied = true;
    const action = this.action; this.action = null; action?.();
  }
  advance(dt: number) {
    if (!this.active || !Number.isFinite(dt) || dt < 0) return;
    this.elapsed += dt;
    if (this.kind === "exit" && this.elapsed >= 1.5) this.apply();
    if (this.elapsed >= (this.kind === "enter" ? 1.5 : 1.7)) this.active = false;
  }
  get alpha() { return this.active ? Math.min(1, this.elapsed / .6) : 0; }
  reset() { this.active = false; this.action = null; this.applied = false; this.elapsed = 0; }
}
