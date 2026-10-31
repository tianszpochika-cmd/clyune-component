import { makeCanvas, loop } from '../lib/canvas.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';

export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF云澜学习星<>/{}=+*';
  const live = () => readLiveControls([host, host.parentElement, canvas], ctrl);
  let cols = [], acc = 0, baseSize = 16;
  const seed = () => {
    const L = live();
    baseSize = (state.w < 500 ? 13 : 16) * L.size;
    const n = Math.max(8, Math.min(120, L.count || Math.ceil(state.w / Math.max(8, baseSize))));
    // prefer width-based columns scaled by count
    const byWidth = Math.ceil(state.w / Math.max(8, baseSize));
    const count = Math.max(6, Math.min(byWidth, Math.round(byWidth * (L.count / 40))));
    cols = Array.from({ length: count }, () => Math.random() * -50);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, state.w, state.h);
  };
  state.onResize = seed;
  seed();
  const stop = loop((dt) => {
    const L = live();
    const [cr, cg, cb] = colorToRgb(L.color);
    const size = Math.max(8, baseSize);
    acc += dt * L.speed;
    if (acc < 1 / 24) return;
    acc = 0;
    // live resize column count gently
    const byWidth = Math.ceil(state.w / Math.max(8, size));
    const target = Math.max(6, Math.min(byWidth, Math.round(byWidth * (L.count / 40))));
    if (cols.length !== target) seed();

    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `${size}px ui-monospace, monospace`;
    const col = `rgb(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)})`;
    for (let i = 0; i < cols.length; i++) {
      const y = cols[i] * size;
      const ch = chars[(Math.random() * chars.length) | 0];
      ctx.fillStyle = '#e8ffe8';
      ctx.fillText(ch, i * size, y);
      ctx.fillStyle = col;
      ctx.fillText(chars[(Math.random() * chars.length) | 0], i * size, y - size);
      if (y > state.h && Math.random() > 0.975) cols[i] = 0;
      else cols[i]++;
    }
  });
  return () => { stop(); dispose(); };
}
