import { makeCanvas, loop, bar, hsl, defaultParams, readLiveControls, colorToRgb, rand } from './_shared.js';
import { withControls } from './withControls.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-generative',
    title: '生成艺术实验室',
    fallbackVariant: 'gen-lab',
    params: defaultParams({ color: true, speed: true, count: true }),
    remountKeys: ['count'],
    mapVariant: (_family, n) => `g-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'g-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id, `<button class="btn" data-regen>Regenerate</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  let seed = Math.random() * 1e9;
  const regen = () => { seed = Math.random() * 1e9; };
  host.querySelector('[data-regen]')?.addEventListener('click', regen);
  const hash = (x, y) => {
    let s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return s - Math.floor(s);
  };
  const kind = (n - 1) % 25;
  const stop = loop((_dt, t) => {
    const L = live();
    const [cr, cg, cb] = colorToRgb(L.color);
    const d = Math.max(1, Math.min(10, Math.round(L.count / 20)));
    const spd = L.speed;
    const tt = t * spd;
    const { w, h } = state;
    ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, w, h);
    const tint = (a = 0.85) => `rgba(${(cr*255)|0},${(cg*255)|0},${(cb*255)|0},${a})`;
    if (kind === 0 || kind === 13 || kind === 21) {
      const step = Math.max(4, 14 - d);
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        const v = hash(x * 0.02, y * 0.02 + tt * 0.05);
        ctx.fillStyle = kind === 21
          ? `hsla(${(v * 360 + n * 20 + tt * 30) % 360} 70% 55% / .85)`
          : tint(0.5 + v * 0.5);
        ctx.fillRect(x, y, step - 1, step - 1);
      }
    } else if (kind === 3) {
      const cols = 40 + d * 2, rows = 24 + d; const cw = w / cols, ch = h / rows;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const alive = hash(x + (tt * 2 | 0), y) > 0.62;
        if (alive) { ctx.fillStyle = tint(0.8); ctx.fillRect(x * cw, y * ch, cw - 1, ch - 1); }
      }
    } else if (kind === 5 || kind === 6) {
      const draw = (x, y, len, ang, depth) => {
        if (depth <= 0 || len < 2) return;
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        ctx.strokeStyle = tint(0.7); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        draw(x2, y2, len * 0.72, ang - 0.45, depth - 1);
        draw(x2, y2, len * 0.72, ang + 0.45, depth - 1);
      };
      ctx.lineWidth = 1.2; draw(w / 2, h - 10, 50 + d * 4, -Math.PI / 2, 6 + (d / 3 | 0));
    } else if (kind === 9) {
      let x = w / 2, y = h / 2; ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 800 + d * 80; i++) { x += rand(-3, 3); y += rand(-3, 3); ctx.lineTo(x, y); }
      ctx.strokeStyle = L.color; ctx.stroke();
    } else if (kind === 1 || kind === 2) {
      const step = Math.max(3, 10 - d);
      for (let py = 0; py < h; py += step) for (let px = 0; px < w; px += step) {
        let x = (px / w) * 3.2 - 1.6, y = (py / h) * 2.4 - 1.2; let zx = x, zy = y, i = 0;
        const cx = Math.sin(tt * 0.2) * 0.7, cy = Math.cos(tt * 0.17) * 0.5;
        for (; i < 24; i++) {
          const zx2 = zx * zx - zy * zy + (kind === 1 ? cx : x);
          const zy2 = 2 * zx * zy + (kind === 1 ? cy : y);
          zx = zx2; zy = zy2; if (zx * zx + zy * zy > 4) break;
        }
        const a = i / 24;
        ctx.fillStyle = `rgba(${(cr*255*(0.3+a))|0},${(cg*255*(0.3+a))|0},${(cb*255*(0.3+a))|0},1)`;
        ctx.fillRect(px, py, step, step);
      }
    } else {
      for (let i = 0; i < 30 + d * 4; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h, r = 4 + hash(i, 3) * (10 + d * 2);
        ctx.beginPath(); ctx.strokeStyle = tint(0.8); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });
  return () => { stop(); dispose(); host.innerHTML = ''; };
}
