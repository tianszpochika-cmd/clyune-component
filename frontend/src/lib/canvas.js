// Shared helpers for canvas / animation demos
import { maxDpr as mobileMaxDpr } from './mobile.js';
export function makeCanvas(host, { webgl = false, maxDpr = 2 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);
  const ctx = webgl ? (canvas.getContext('webgl', { antialias: false }) || canvas.getContext('experimental-webgl')) : canvas.getContext('2d');
  const state = { w: 1, h: 1, dpr: 1, onResize: null };
  const resize = () => {
    const r = host.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, mobileMaxDpr(maxDpr));
    state.w = Math.max(1, Math.floor(r.width));
    state.h = Math.max(1, Math.floor(r.height));
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    if (!webgl && ctx) ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.onResize && state.onResize(state);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  // Absolute kit-inner often measures 0 on first paint — retry a couple frames.
  if (state.w <= 1 || state.h <= 1) {
    requestAnimationFrame(() => {
      resize();
      if (state.w <= 1 || state.h <= 1) requestAnimationFrame(resize);
    });
  }
  return { canvas, ctx, state, resize, dispose: () => { ro.disconnect(); canvas.remove(); } };
}

export function loop(fn) {
  let id = 0, last = performance.now(), running = true;
  const tick = (t) => {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    fn(dt, t / 1000);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => { running = false; cancelAnimationFrame(id); };
}

export function localPoint(el, e) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Inject a scoped <style> block, returns remover
export function addStyle(css) {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
  return () => s.remove();
}
