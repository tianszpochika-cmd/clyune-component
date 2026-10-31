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
    } else if (kind === 4) {
      const pts = Array.from({ length: 18 + d }, (_, i) => [hash(i, 1) * w, hash(i, 2) * h, hash(i, 3)]);
      const step = Math.max(4, 12 - d);
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        let best = 0, bd = 1e9;
        for (let i = 0; i < pts.length; i++) { const dd = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (dd < bd) { bd = dd; best = i; } }
        ctx.fillStyle = `hsla(${(pts[best][2] * 360 + n * 20) % 360} 65% 45% / .9)`; ctx.fillRect(x, y, step, step);
      }
    } else if (kind === 7) {
      for (let i = 0; i < 40 + d * 3; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h, r = 6 + hash(i, 3) * (18 + d);
        ctx.beginPath(); ctx.strokeStyle = tint(0.85); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (kind === 8) {
      const step = 8;
      for (let y = 20; y < h; y += step) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 4) {
          const v = hash(x * 0.03, y * 0.03 + tt * 0.05) * 24;
          x ? ctx.lineTo(x, y + v) : ctx.moveTo(x, y + v);
        }
        ctx.strokeStyle = tint(0.55); ctx.stroke();
      }
    } else if (kind === 10) {
      ctx.strokeStyle = tint(0.8); ctx.lineWidth = 1;
      for (let i = 0; i < 40 + d * 2; i++) {
        let x = (i / (40 + d * 2)) * w, y = h - 4, ang = -Math.PI / 2 + (hash(i, 1) - 0.5) * 0.4;
        for (let s = 0; s < 8; s++) {
          const len = 8 + hash(i, s) * 10; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          x = x2; y = y2; ang += (hash(i, s + 3) - 0.5) * 0.6 + Math.sin(tt + i) * 0.05;
        }
      }
    } else if (kind === 11) {
      const step = Math.max(3, 10 - d);
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        const v = Math.sin(Math.hypot(x - w / 2, y - h / 2) * 0.05 - tt * 2) * Math.sin(x * 0.04 + tt);
        ctx.fillStyle = tint(0.4 + v * 0.4); ctx.fillRect(x, y, step, step);
      }
    } else if (kind === 12) {
      for (let i = 0; i < 12 + d; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 40 + d * 4);
        g.addColorStop(0, tint(0.7)); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + Math.sin(tt + i) * 10, y + Math.cos(tt + i) * 10, 50 + d * 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 14) {
      ctx.save(); ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.02) {
        const r = 40 + 30 * Math.sin(6 * a + tt) + 10 * Math.sin(12 * a);
        const x = Math.cos(a) * r * (1 + d * 0.05), y = Math.sin(a) * r * (1 + d * 0.05);
        a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.strokeStyle = L.color; ctx.stroke(); ctx.restore();
    } else if (kind === 15) {
      for (let i = 0; i < 20 + d; i++) {
        const x1 = hash(i, 1) * w, y1 = hash(i, 2) * h, x2 = hash(i, 3) * w, y2 = hash(i, 4) * h, x3 = hash(i, 5) * w, y3 = hash(i, 6) * h;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
        ctx.strokeStyle = tint(0.7); ctx.stroke();
      }
    } else if (kind === 16) {
      const cells = [{ x: 0, y: 0, s: Math.min(w, h) }];
      while (cells.length < 30 + d * 2) {
        const c = cells.pop(); if (!c || c.s < 16) { if (c) cells.unshift(c); break; }
        const hs = c.s / 2;
        cells.push({ x: c.x, y: c.y, s: hs }, { x: c.x + hs, y: c.y, s: hs }, { x: c.x, y: c.y + hs, s: hs }, { x: c.x + hs, y: c.y + hs, s: hs });
      }
      const offx = (w - Math.min(w, h)) / 2, offy = (h - Math.min(w, h)) / 2;
      cells.forEach((c, i) => { ctx.strokeStyle = tint(0.6 + hash(i, 1) * 0.3); ctx.strokeRect(c.x + offx, c.y + offy, c.s, c.s); });
    } else if (kind === 17) {
      const step = 6;
      for (let level = 0; level < 8; level++) {
        ctx.beginPath(); let pen = false;
        for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
          const v = hash(x * 0.025, y * 0.025 + tt * 0.02);
          if (Math.abs(v - level / 8) < 0.04) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
        }
        ctx.strokeStyle = tint(0.45 + level * 0.05); ctx.stroke();
      }
    } else if (kind === 18) {
      for (let i = 0; i < 8 + d; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h;
        for (let r = 4; r < 40; r += 4) {
          ctx.beginPath(); ctx.strokeStyle = tint(0.7 - r / 80); ctx.arc(x, y, r + Math.sin(tt + i) * 2, 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else if (kind === 19) {
      for (let i = 0; i < 25 + d * 2; i++) {
        ctx.beginPath();
        let x = hash(i, 1) * w, y = 0;
        ctx.moveTo(x, y);
        for (let k = 0; k < 20; k++) { x += (hash(i, k) - 0.5) * 18; y += h / 20; ctx.lineTo(x, y); }
        ctx.strokeStyle = tint(0.55); ctx.stroke();
      }
    } else if (kind === 20) {
      const step = Math.max(3, 9 - d);
      for (let y = 0; y < h; y += step) {
        const shift = (hash(y, tt | 0) - 0.5) * 80;
        for (let x = 0; x < w; x += step) {
          const v = hash(x * 0.04 + shift, y * 0.04);
          ctx.fillStyle = tint(0.35 + v * 0.6); ctx.fillRect(x + shift, y, step, step);
        }
      }
    } else if (kind === 22) {
      for (let i = 0; i < 20 + d; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h;
        const r = 8 + (0.5 + 0.5 * Math.sin(tt + i)) * (20 + d * 2);
        ctx.beginPath(); ctx.fillStyle = tint(0.35); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = tint(0.8); ctx.stroke();
      }
    } else if (kind === 23) {
      const cx = w / 2 + Math.sin(tt) * 40, cy = h / 2;
      for (let i = 0; i < 60; i++) {
        let x = hash(i, 1) * w, y = hash(i, 2) * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 12; k++) {
          const dx = cx - x, dy = cy - y, dist = Math.hypot(dx, dy) || 1;
          x += dx / dist * 8; y += dy / dist * 8; ctx.lineTo(x, y);
        }
        ctx.strokeStyle = tint(0.5); ctx.stroke();
      }
    } else if (kind === 24) {
      ctx.beginPath();
      for (let i = 0; i < 600; i++) {
        const a = i * 0.15 + tt, r = i * 0.18;
        const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = L.color; ctx.stroke();
    } else {
      for (let i = 0; i < 30 + d * 4; i++) {
        const x = hash(i, 1) * w, y = hash(i, 2) * h, r = 4 + hash(i, 3) * (10 + d * 2);
        ctx.beginPath(); ctx.strokeStyle = tint(0.8); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
    }
  });
  return () => { stop(); dispose(); host.innerHTML = ''; };
}
