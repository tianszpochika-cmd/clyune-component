import { makeCanvas, loop, localPoint, bar, defaultParams, readLiveControls, colorToRgb } from './_shared.js';
import { withControls } from './withControls.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-particles',
    title: '粒子实验室',
    fallbackVariant: 'particles-lab',
    params: defaultParams({ color: true, speed: true, size: true, count: true }),
    remountKeys: ['count'],
    mapVariant: (_family, n) => `p-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'p-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id, `<button class="btn" data-burst>Burst</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const mouse = { x: 0, y: 0 };
  let parts = [];
  const kind = (n - 1) % 25;
  const liveRoots = [host, stage, host.parentElement, canvas];
  const live = () => readLiveControls(liveRoots, ctrl);

  const seed = () => {
    const L = live();
    const count = Math.max(12, Math.min(400, L.count));
    parts = Array.from({ length: count }, () => ({
      x: Math.random() * (state.w || 400),
      y: Math.random() * (state.h || 300),
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      r: 1 + Math.random() * 2,
      life: 0.4 + Math.random() * 0.6,
      hue: (n * 37 + Math.random() * 80) % 360,
    }));
  };
  state.onResize = seed;
  seed();

  const burst = () => {
    const L = live();
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 180;
      parts.push({
        x: mouse.x || state.w / 2,
        y: mouse.y || state.h / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 1.5 + Math.random() * 2.5,
        life: 1,
        hue: (n * 40 + i * 10) % 360,
      });
    }
    const max = Math.max(80, L.count * 2);
    if (parts.length > max) parts.splice(0, parts.length - max);
  };

  canvas.addEventListener('pointermove', (e) => Object.assign(mouse, localPoint(canvas, e)));
  canvas.addEventListener('pointerdown', burst);
  host.querySelector('[data-burst]')?.addEventListener('click', burst);

  const stop = loop((dt) => {
    const L = live();
    const spd = L.speed;
    const sz = L.size;
    const [cr, cg, cb] = colorToRgb(L.color);
    const { w, h } = state;
    if (!w || !h) return;

    const target = Math.max(12, Math.min(400, L.count));
    if (Math.abs(parts.length - target) > 8) {
      if (parts.length < target) {
        while (parts.length < target) {
          parts.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
            r: 1 + Math.random() * 2, life: 0.4 + Math.random() * 0.6,
            hue: (n * 37 + Math.random() * 80) % 360,
          });
        }
      } else {
        parts.length = target;
      }
    }

    ctx.fillStyle = kind === 0 ? 'rgba(6,10,20,0.35)' : '#060a14';
    ctx.fillRect(0, 0, w, h);
    const dtp = dt * spd;
    const t = performance.now() * 0.001;

    for (const p of parts) {
      if (kind === 0) { p.vy = Math.sin(t * spd + p.x) * 4; }
      else if (kind === 1) { p.vy += 30 * dtp; p.vx += Math.sin(t + p.x) * 5 * dtp; if (p.y > h) { p.y = -2; p.x = Math.random() * w; } }
      else if (kind === 2) { p.vy += 50 * dtp; if (p.y > h) { p.y = -2; p.x = Math.random() * w; } }
      else if (kind === 3) { p.vy -= 20 * dtp; p.life -= dtp * 0.2; if (p.life <= 0) { p.y = h; p.life = 1; p.x = w / 2 + (Math.random() - 0.5) * 40; } }
      else if (kind === 6 || kind === 8) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1;
        const f = kind === 6 ? 80 : -60;
        p.vx += (dx / d) * f * dtp; p.vy += (dy / d) * f * dtp;
      } else if (kind === 7) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx -= (dx / d) * 70 * dtp; p.vy -= (dy / d) * 70 * dtp;
      } else if (kind === 10) {
        const dx = p.x - w / 2, dy = p.y - h / 2;
        p.vx += -dy * 0.4 * dtp; p.vy += dx * 0.4 * dtp;
      } else if (kind === 11) {
        const ang = Math.atan2(p.y - h / 2, p.x - w / 2);
        const hx = w / 2 + 16 * Math.pow(Math.sin(ang), 3) * 8;
        const hy = h / 2 - (13 * Math.cos(ang) - 5 * Math.cos(2 * ang) - 2 * Math.cos(3 * ang) - Math.cos(4 * ang)) * 8;
        p.vx += (hx - p.x) * 0.5 * dtp; p.vy += (hy - p.y) * 0.5 * dtp;
      } else if (kind === 14) {
        p.y += Math.sin(t * 2 * spd + p.x * 0.05) * 20 * dtp;
      } else {
        p.vx *= 0.99; p.vy *= 0.99;
      }
      p.x += p.vx * dtp; p.y += p.vy * dtp;
      if (![1, 2, 3].includes(kind)) {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      const pr = p.r * sz;
      ctx.beginPath();
      if (kind === 2) {
        ctx.fillStyle = `hsla(45 90% 60% / ${0.5 + p.life * 0.5})`;
      } else if (kind === 24) {
        ctx.fillStyle = `hsla(${(p.hue + t * 50 * spd) % 360} 85% 60% / ${0.5 + p.life * 0.5})`;
      } else if (kind === 0) {
        ctx.fillStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},${0.35 + p.life * 0.55})`;
      } else {
        ctx.fillStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},${0.35 + p.life * 0.55})`;
      }
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    if (kind === 22) {
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < i + 8 && j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) {
            ctx.strokeStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},${1 - d / 90})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
    }
  });

  return () => { stop(); dispose(); host.innerHTML = ''; };
}
