/** Sticky 「自动演示」 preference. Default OFF — no synthetic pointer / auto-scroll / ghost paths. */
const KEY = 'cc-auto-demo';
const EVT = 'cc-auto-demo';
export function isAutoDemo() {
  try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
}
export function setAutoDemo(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: !!on })); } catch (_) { /* ignore */ }
  return !!on;
}
export function onAutoDemoChange(fn) {
  const h = (e) => fn(!!(e?.detail ?? isAutoDemo()));
  window.addEventListener(EVT, h);
  window.addEventListener('storage', (e) => { if (e.key === KEY) fn(isAutoDemo()); });
  return () => window.removeEventListener(EVT, h);
}
