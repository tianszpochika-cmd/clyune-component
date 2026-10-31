import { makeCanvas, loop, localPoint } from '../lib/canvas.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';

export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const rockets = [], sparks = [];
  const live = () => readLiveControls([host, host.parentElement, canvas], ctrl);

  const launch = (tx, ty) => {
    const L = live();
    const [cr, cg, cb] = colorToRgb(L.color);
    const x = state.w * (0.2 + Math.random() * 0.6);
    tx ??= state.w * (0.15 + Math.random() * 0.7);
    ty ??= state.h * (0.12 + Math.random() * 0.35);
    rockets.push({
      x, y: state.h, tx, ty,
      hue: Math.random() * 360,
      rgb: [cr, cg, cb],
      trail: [],
    });
  };
  const burst = (r) => {
    const L = live();
    const n = Math.round((40 + Math.random() * 40) * (L.count / 40));
    const ring = Math.random() < 0.3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (ring ? 160 : 40 + Math.random() * 180) * L.size;
      sparks.push({
        x: r.x, y: r.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, decay: 0.5 + Math.random() * 0.6,
        hue: r.hue + (Math.random() * 40 - 20),
        rgb: r.rgb, px: r.x, py: r.y,
      });
    }
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = localPoint(canvas, e);
    launch(p.x, p.y);
  });
  let auto = 0;
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, state.w || 1, state.h || 1);
  const stop = loop((dt) => {
    const L = live();
    const dtp = dt * L.speed;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5,7,15,.22)';
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.globalCompositeOperation = 'lighter';
    auto -= dtp;
    if (auto <= 0) { launch(); auto = 0.5 + Math.random() * 1.1; }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i], dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      const sp = Math.max(260, d * 3) * dtp;
      if (d <= sp) { burst(r); rockets.splice(i, 1); continue; }
      const px = r.x, py = r.y;
      r.x += dx / d * sp; r.y += dy / d * sp;
      const [cr, cg, cb] = r.rgb;
      ctx.strokeStyle = `rgb(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)})`;
      ctx.lineWidth = 2 * L.size;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.px = s.x; s.py = s.y;
      s.vx *= 0.985; s.vy = s.vy * 0.985 + 120 * dtp;
      s.x += s.vx * dtp; s.y += s.vy * dtp; s.life -= s.decay * dtp;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      const [cr, cg, cb] = s.rgb || colorToRgb(L.color);
      ctx.strokeStyle = `rgba(${Math.round(cr*255)},${Math.round(cg*255)},${Math.round(cb*255)},${s.life})`;
      ctx.lineWidth = 1.6 * L.size;
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
  });
  return () => { stop(); dispose(); };
}
