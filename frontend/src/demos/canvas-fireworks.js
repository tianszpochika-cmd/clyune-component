import { makeCanvas, loop, localPoint } from '../lib/canvas.js';
export function mount(host) {
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const rockets = [], sparks = [];
  const launch = (tx, ty) => {
    const x = state.w * (.2 + Math.random() * .6);
    tx ??= state.w * (.15 + Math.random() * .7); ty ??= state.h * (.12 + Math.random() * .35);
    rockets.push({ x, y: state.h, tx, ty, hue: Math.random() * 360, trail: [] });
  };
  const burst = (r) => {
    const n = 70 + (Math.random() * 50 | 0), ring = Math.random() < .3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = ring ? 160 : 40 + Math.random() * 180;
      sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: .5 + Math.random() * .6, hue: r.hue + (Math.random() * 40 - 20), px: r.x, py: r.y });
    }
  };
  canvas.addEventListener('pointerdown', (e) => { const p = localPoint(canvas, e); launch(p.x, p.y); });
  let auto = 0;
  ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, state.w, state.h);
  const stop = loop((dt) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5,7,15,.22)'; ctx.fillRect(0, 0, state.w, state.h);
    ctx.globalCompositeOperation = 'lighter';
    auto -= dt; if (auto <= 0) { launch(); auto = .5 + Math.random() * 1.1; }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i], dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      const sp = Math.max(260, d * 3) * dt;
      if (d <= sp) { burst(r); rockets.splice(i, 1); continue; }
      const px = r.x, py = r.y;
      r.x += dx / d * sp; r.y += dy / d * sp;
      ctx.strokeStyle = `hsl(${r.hue},100%,75%)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.px = s.x; s.py = s.y;
      s.vx *= .985; s.vy = s.vy * .985 + 120 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= s.decay * dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.strokeStyle = `hsla(${s.hue},100%,${50 + s.life * 30}%,${s.life})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
  });
  return () => { stop(); dispose(); };
}
