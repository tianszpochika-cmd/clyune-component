/**
 * createCanvasStage — shared Canvas 2D lab scaffold (canvas + physics categories).
 *  - splits the host into canvas + info panel (live readout + 公式/说明/参数/步骤)
 *  - HiDPI canvas sized only on real size changes (no mid-run clears)
 *  - one rAF loop, speed-scaled simulation clock, dt clamped (no teleports after tab switch)
 *  - pointer state (down/drag/up) with an idle "auto pointer" so demos stay alive untouched
 *  - live knob values read straight from the panel state (extras included)
 */
import { createInfoPanel, alignDocParams, fmt } from './info-panel.js';
import { readLiveControls } from './_shared.js';
import { isAutoDemo } from '../../lib/autoDemo.js';

export { fmt };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const TAU = Math.PI * 2;
export function hexRgb(c, fb = [129, 140, 248]) {
  const s = String(c || '').trim();
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = /^#?([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) { const p = m[1].split(/[ ,/]+/).map(Number); return [p[0] | 0, p[1] | 0, p[2] | 0]; }
  return fb;
}
export const rgba = (c, a = 1) => { const [r, g, b] = Array.isArray(c) ? c : hexRgb(c); return `rgba(${r},${g},${b},${a})`; };
export function rgbHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s * 100, l * 100];
}
export const hueOf = (c) => rgbHsl(hexRgb(c))[0];
/** deterministic PRNG so resets / remounts look the same */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** smooth value noise 2D/3D (deterministic) */
export function makeNoise(seed = 7) {
  const R = rng(seed); const P = new Uint8Array(512); const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = new Float32Array(256).map(() => R());
  const sm = (t) => t * t * (3 - 2 * t);
  const n3 = (x, y, z = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi; const u = sm(xf), v = sm(yf), w = sm(zf);
    const X = xi & 255, Y = yi & 255, Z = zi & 255;
    const h = (a, b, c) => V[P[P[P[a] + b] + c]];
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(X, Y, Z), h(X + 1, Y, Z), u), l(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      l(l(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), l(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
  };
  const fbm = (x, y, z = 0, oct = 4) => { let s = 0, a = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2; } return s / norm; };
  return { n3, fbm };
}

export function createCanvasStage(host, opts = {}, { doc, spec = {}, bg = '#060a14', auto = true, autoPath, cursor = 'crosshair' } = {}) {
  const ctrl = opts._controls || {};
  const info = createInfoPanel(host, { doc: alignDocParams(doc, spec) });
  const view = info.canvasBox;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `display:block;width:100%;height:100%;touch-action:none;cursor:${cursor}`;
  view.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const stageEl = host.parentElement;
  const get = () => {
    let s = null;
    try { s = stageEl?.__getControls?.(); } catch (_) { s = null; }
    const L = readLiveControls([host, stageEl], ctrl);
    return { ...ctrl, ...(s || {}), color: (s && s.color) || L.color, speed: Number(s?.speed ?? L.speed ?? 1), size: Number(s?.size ?? L.size ?? 1), count: Number(s?.count ?? L.count ?? 40) };
  };

  let W = 0, H = 0, dpr = 1;
  const resizeFns = [];
  const resize = () => {
    const r = view.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    const first = !W;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    resizeFns.forEach((f) => f(W, H, first));
  };
  const ro = new ResizeObserver(resize); ro.observe(view);

  // pointer: user-driven once touched, else an idle Lissajous path
  const P = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, down: false, user: false, inside: false, lastUser: -1e9 };
  const downFns = [], upFns = [], moveFns = [];
  const loc = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    [P.x, P.y] = loc(e); P.down = true; P.user = true; P.lastUser = wall;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    downFns.forEach((f) => f(P, e));
  };
  const onMove = (e) => {
    const [x, y] = loc(e);
    if (e.pointerType === 'touch' && !P.down) return;
    P.x = x; P.y = y; P.inside = true; P.user = true; P.lastUser = wall;
    moveFns.forEach((f) => f(P, e));
  };
  const onUp = (e) => { if (!P.down) return; P.down = false; P.lastUser = wall; upFns.forEach((f) => f(P, e)); };
  const onLeave = () => { P.inside = false; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  const frames = [];
  let raf = 0, alive = true, last = -1, sim = 0, wall = 0;
  const api = {
    canvas, ctx, view, info, get, P, bg,
    get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
    get t() { return sim; },
    isAutoDemo, onFrame(fn) { frames.push(fn); },
    onResize(fn) { resizeFns.push(fn); if (W) fn(W, H, true); },
    onDown(fn) { downFns.push(fn); }, onUp(fn) { upFns.push(fn); }, onMove(fn) { moveFns.push(fn); },
    clear(a = 1) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = a >= 1 ? bg : rgba(bg, a); ctx.fillRect(0, 0, W, H); },
    disposers: [],
  };
  const idlePath = autoPath || ((t, w, h) => [w * 0.5 + Math.cos(t * 0.55) * w * 0.28, h * 0.5 + Math.sin(t * 0.83) * h * 0.24]);
  const tick = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (!W || !H) { resize(); if (!W || !H) return; }
    const dtw = last < 0 ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const C = get();
    const spd = Number.isFinite(C.speed) ? C.speed : 1;
    sim += dtw * spd; wall += dtw;
    // idle pointer: Lissajous path only when 「自动演示」 is on (and this stage opts in)
    if (auto && isAutoDemo() && !P.down && (!P.user || wall - P.lastUser > 6)) {
      const [ax, ay] = (api.autoPath || idlePath)(sim, W, H);
      const k = P.user ? 1 - Math.exp(-dtw * 3) : 1;
      P.x += (ax - P.x) * k; P.y += (ay - P.y) * k;
      if (P.user && Math.hypot(ax - P.x, ay - P.y) < 2) P.user = false;
    } else if (!P.user && !P.down && !isAutoDemo()) {
      // off-stage rest: no synthetic hover/hit when 「自动演示」 is off
      P.x = -1e3; P.y = -1e3; P.px = P.x; P.py = P.y; P.vx = 0; P.vy = 0;
    }
    if (P.user || P.down || isAutoDemo()) { P.x = clamp(P.x, 0, W); P.y = clamp(P.y, 0, H); }
    if (dtw > 0) { P.vx = (P.x - P.px) / dtw; P.vy = (P.y - P.py) / dtw; }
    P.px = P.x; P.py = P.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let v = {}; let ix = '';
    for (const fn of frames) {
      const r = fn({ ctx, W, H, dt: dtw * spd, dtw, t: sim, wall, C, P });
      if (r) { if (r.ix != null) { ix += r.ix; delete r.ix; } Object.assign(v, r); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hx = v.hx ?? P.x, hy = v.hy ?? P.y;
    info.update(v, {
      ix: `${Math.round(P.x)},${Math.round(P.y)},${P.down ? 1 : 0}|${ix}`,
      handle: `${Math.round(hx)},${Math.round(hy)}`,
      ctl: [[P.user ? '指针 (x, y)' : '自动指针 (x, y)', (P.user || isAutoDemo()) ? `${Math.round(P.x)}, ${Math.round(P.y)}${P.down ? ' · 按下' : ''}` : '关（真实指针）']],
    });
  };
  raf = requestAnimationFrame(tick);

  api.destroy = () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    api.disposers.forEach((f) => { try { f(); } catch (_) { /* ignore */ } });
    info.destroy();
    host.innerHTML = '';
  };
  return api;
}

/** offscreen layer (for trails / pixel fields) sized in CSS px × scale */
export function makeLayer(w, h, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
  const x = c.getContext('2d');
  return { c, x, w: c.width, h: c.height, scale };
}
/** frame-rate independent fade factor: alpha per 1/60 s → alpha for dt */
export const fadeA = (a, dt) => 1 - Math.pow(1 - a, dt * 60);
