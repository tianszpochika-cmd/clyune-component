import { makeCanvas, loop, localPoint, bar, defaultParams, readLiveControls, colorToRgb } from './_shared.js';
import { withControls } from './withControls.js';

const SIM_PRESETS = ['弹球墙','多重力','弹簧链','碰撞盒','漂浮气泡','摆锤','沙漏粒子','磁力点','弹性绳','台球'];
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-physics',
    title: '物理模拟实验室',
    fallbackVariant: 'sim',
    presets: SIM_PRESETS,
    params: defaultParams({ color: true, speed: true, size: true, count: true }),
    remountKeys: ['count'],
    mapVariant: (_f, n) => `sim-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'sim-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id, `<button class="btn" data-add>Add</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const liveRoots = [host, stage, host.parentElement, canvas];
  const live = () => readLiveControls(liveRoots, ctrl);
  const balls = [];
  const kind = (n - 1) % 10;

  const spawn = (x, y) => {
    const L = live();
    const baseR = 8 + Math.random() * 8;
    balls.push({
      x: x ?? (40 + Math.random() * Math.max(40, (state.w || 400) - 80)),
      y: y ?? 40,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 40,
      _baseR: baseR,
      r: baseR * L.size,
      hue: (n * 40 + balls.length * 20) % 360,
    });
  };

  const targetCount = () => Math.max(2, Math.min(120, live().count));
  for (let i = 0; i < targetCount(); i++) spawn();

  const mouse = { x: 0, y: 0, down: false };
  canvas.addEventListener('pointermove', (e) => Object.assign(mouse, localPoint(canvas, e)));
  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true;
    Object.assign(mouse, localPoint(canvas, e));
    spawn(mouse.x, mouse.y);
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });
  host.querySelector('[data-add]')?.addEventListener('click', () => spawn());

  const stop = loop((dt) => {
    const L = live();
    const spd = L.speed;
    const [cr, cg, cb] = colorToRgb(L.color);
    const { w, h } = state;
    if (!w || !h) return;
    const dtp = dt * spd;

    const target = targetCount();
    while (balls.length < target) spawn();
    while (balls.length > target) balls.pop();

    for (const b of balls) b.r = (b._baseR || 10) * L.size;

    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    const g = kind === 1 ? 0 : kind === 4 ? -20 : 420;
    for (const b of balls) {
      if (kind === 2) {
        b.vx += (mouse.x - b.x) * 3 * dtp;
        b.vy += (mouse.y - b.y) * 3 * dtp;
      } else if (kind === 5) {
        b.vx += Math.sin((b.x - w / 2) / 80) * -200 * dtp;
      } else if (kind === 7) {
        const dx = mouse.x - b.x, dy = mouse.y - b.y, d = Math.hypot(dx, dy) || 1;
        b.vx += (dx / d) * 120 * dtp; b.vy += (dy / d) * 120 * dtp;
      } else if (kind === 8) {
        b.vx += (w / 2 - b.x) * 0.8 * dtp; b.vy += (h / 2 - b.y) * 0.8 * dtp;
      }
      b.vy += g * dtp; b.vx *= 0.995; b.vy *= 0.995;
      b.x += b.vx * dtp; b.y += b.vy * dtp;
      if (b.x < b.r) { b.x = b.r; b.vx *= -0.85; }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -0.85; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -0.85; }
      if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -0.85; }
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = a.r + b.r;
        if (d < min) {
          const nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
          const dv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          a.vx -= dv * nx; a.vy -= dv * ny; b.vx += dv * nx; b.vy += dv * ny;
        }
      }
    }
    for (const b of balls) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},0.9)`;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = `hsla(${b.hue} 80% 70% / 0.35)`;
      ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 2 || kind === 8) {
        ctx.strokeStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},0.35)`;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    if (kind === 9) {
      ctx.strokeStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(balls[0]?.x || 0, balls[0]?.y || 0);
      ctx.stroke();
    }
  });

  return () => { stop(); dispose(); host.innerHTML = ''; };
}
