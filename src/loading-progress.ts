/** Lightweight DOM overlay: runs before Pixi and never touches game storage. */
let shown = 0;
export const assetLoadPercent = (ratio:number):number => 10 + Math.floor(Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 70);
export function setBootProgress(value:number, message:string):void {
  if (!Number.isFinite(value)) return;
  shown = Math.max(shown, Math.min(99, Math.max(0, Math.floor(value))));
  const track = document.getElementById('boot-progress');
  if (!track) return;
  track.setAttribute('aria-valuenow', String(shown));
  const bar = document.getElementById('boot-bar');
  if (bar) bar.style.width = `${shown}%`;
  const percent = document.getElementById('boot-percent');
  if (percent) percent.textContent = `${shown}%`;
  const status = document.getElementById('boot-status');
  if (status && status.textContent !== message) status.textContent = message;
}
export function finishBoot():void {
  const track = document.getElementById('boot-progress');
  if (!track) return;
  track.setAttribute('aria-valuenow', '100');
  const bar = document.getElementById('boot-bar');
  if (bar) bar.style.width = '100%';
  const percent = document.getElementById('boot-percent');
  if (percent) percent.textContent = '100%';
  const status = document.getElementById('boot-status');
  if (status) status.textContent = '进入游戏…';
  // Give the engine at least one paint before uncovering its canvas.
  requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('boot-loading')?.remove()));
}
export function failBoot(error:unknown):void {
  console.error('Game startup failed', error);
  const status = document.getElementById('boot-status');
  if (status) status.textContent = '加载失败，请检查网络后重试';
  const retry = document.getElementById('boot-retry');
  if (retry) { retry.hidden = false; retry.onclick = () => location.reload(); }
}
