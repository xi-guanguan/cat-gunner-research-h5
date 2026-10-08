/** Browser scheduling adapter. Game page's RAF starvation trigger remains unresolved.
 * Timer fallback preserves real elapsed timestamps; it does not imply 60fps delivery.
 */
export interface FrameClockApp {
  ticker: { started: boolean; start(): void; stop(): void; update(time: number): void };
}
export interface FrameClockEnvironment {
  now(): number;
  isHidden(): boolean;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  setTimer(callback: () => void, milliseconds: number): number;
  clearTimer(id: number): void;
  onVisibility(callback: () => void): () => void;
}
const browserEnvironment: FrameClockEnvironment = {
  now: () => performance.now(),
  isHidden: () => document.hidden,
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: id => cancelAnimationFrame(id),
  setTimer: (callback, milliseconds) => window.setInterval(callback, milliseconds),
  clearTimer: id => window.clearInterval(id),
  onVisibility: callback => {
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  }
};
export function installFrameClock(app: FrameClockApp, environment: FrameClockEnvironment = browserEnvironment) {
  const originallyStarted = app.ticker.started;
  const diagnostics = {
    mode: 'raf' as 'raf' | 'timer' | 'hidden' | 'disposed',
    fallbackCount: 0, recoveryCount: 0, timerUpdates: 0, rafCallbacks: 0,
    stableFrames: 0, lastRafTime: environment.now(), lastRafGapMs: 0,
    fallbackSince: null as number | null,
    starvationThresholdMs: 600, timerIntervalMs: 16,
    recoveryFrames: 12, recoveryMaxGapMs: 50, recoveryCooldownMs: 1000,
    schedulingCause: 'UNRESOLVED_GAME_PAGE_BEGINFRAME_STARVATION'
  };
  let disposed = false;
  let frameId: number;
  function resumeNormal(now: number) {
    diagnostics.mode = 'raf';
    diagnostics.lastRafTime = now;
    diagnostics.stableFrames = 0;
    diagnostics.fallbackSince = null;
    if (originallyStarted) app.ticker.start();
  }
  function visibilityChanged() {
    if (disposed) return;
    if (environment.isHidden()) {
      diagnostics.mode = 'hidden';
      diagnostics.stableFrames = 0;
      app.ticker.stop();
    } else resumeNormal(environment.now());
  }
  const removeVisibility = environment.onVisibility(visibilityChanged);
  if (environment.isHidden()) visibilityChanged();
  function observeFrame() {
    if (disposed) return;
    const now = environment.now();
    diagnostics.rafCallbacks++;
    diagnostics.lastRafGapMs = now - diagnostics.lastRafTime;
    if (!environment.isHidden()) {
      if (diagnostics.mode === 'timer') {
        diagnostics.stableFrames = diagnostics.lastRafGapMs <= diagnostics.recoveryMaxGapMs
          ? diagnostics.stableFrames + 1 : 0;
        if (diagnostics.stableFrames >= diagnostics.recoveryFrames &&
          now - (diagnostics.fallbackSince ?? now) >= diagnostics.recoveryCooldownMs) {
          diagnostics.recoveryCount++;
          // Switching mode disables manual updates before restarting Pixi's RAF ticker.
          resumeNormal(now);
        }
      }
      diagnostics.lastRafTime = now;
    }
    frameId = environment.requestFrame(observeFrame);
  }
  frameId = environment.requestFrame(observeFrame);
  const timerId = environment.setTimer(() => {
    if (disposed || environment.isHidden() || !originallyStarted) return;
    const now = environment.now();
    if (diagnostics.mode === 'raf' && now - diagnostics.lastRafTime > diagnostics.starvationThresholdMs) {
      app.ticker.stop(); // Cancels Pixi's pending RAF before any manual update.
      diagnostics.mode = 'timer';
      diagnostics.fallbackSince = now;
      diagnostics.stableFrames = 0;
      diagnostics.fallbackCount++;
    }
    if (diagnostics.mode === 'timer') {
      app.ticker.update(now);
      diagnostics.timerUpdates++;
    }
  }, diagnostics.timerIntervalMs);
  return {
    diagnostics,
    dispose() {
      if (disposed) return;
      disposed = true;
      environment.cancelFrame(frameId);
      environment.clearTimer(timerId);
      removeVisibility();
      const shouldResume = originallyStarted && !environment.isHidden();
      diagnostics.mode = 'disposed';
      if (shouldResume) app.ticker.start();
      else app.ticker.stop();
    }
  };
}
