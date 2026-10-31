import { makeCanvas, loop, localPoint } from '../lib/canvas.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';

export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  let pts = [];
  const mouse = { x: -9999, y: -9999 };
  const live = () => readLiveControls([host, host.parentElement, canvas], ctrl);

  const seed = (count) => {
    const n = Math.max(8, Math.min(300, count ?? Math.round(Math.min(140, (state.w * state.h) / 9000))));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * (state.w || 400),
      y: Math.random() * (state.h || 300),
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
    }));
  };
  state.onResize = () => seed(live().count);
  seed(live().count);

  const move = (e) => Object.assign(mouse, localPoint(canvas, e));
  const out = () => { mouse.x = mouse.y = -9999; };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', out);
  canvas.addEventListener('pointerdown', (e) => {
    const p = localPoint(canvas, e);
    for (let i = 0; i < 6; i++) {
      pts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 });
    }
  });

  const LINK = 120;
  const stop = loop((dt) => {
    const L = live();
    const spd = L.speed;
    const sz = L.size;
    const [cr, cg, cb] = colorToRgb(L.color);
    const { w, h } = state;
    if (!w || !h) return;

    const target = Math.max(8, Math.min(300, L.count));
    if (Math.abs(pts.length - target) > 6) {
      if (pts.length < target) {
        while (pts.length < target) {
          pts.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
          });
        }
      } else pts.length = target;
    }

    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    const dtp = dt * spd;
    for (const p of pts) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
      if (d < 180 && d > 1) { p.vx += (dx / d) * 60 * dtp; p.vy += (dy / d) * 60 * dtp; }
      const sp = Math.hypot(p.vx, p.vy); if (sp > 70) { p.vx *= 0.98; p.vy *= 0.98; }
      p.x += p.vx * dtp; p.y += p.vy * dtp;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));
    }
    ctx.lineWidth = Math.max(0.5, sz);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)},${1 - d / LINK})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (dm < 180) {
        ctx.strokeStyle = `rgba(34,211,238,${1 - dm / 180})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    ctx.fillStyle = `rgb(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)})`;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5 * sz, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return () => { stop(); dispose(); };
}
