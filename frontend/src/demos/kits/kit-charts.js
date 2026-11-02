/**
 * kit-charts — classic chart types as interactive canvas labs.
 * Hover a mark → live readout; knobs drive real geometry; soft motion from speed.
 * Docs: 公式/说明/参数/用法 in beginner Chinese. No in-canvas control overlays.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt, rng } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '数据呼吸速度', max = 2.5) => ({ label, min: 0, max, step: 0.05, value: 0.9 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const yes = (x) => (on(x) ? '开' : '关');
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const fsz = (W, H, k = 1) => clamp(Math.min(W, H) / 28, 10, 14) * k;
const text = (ctx, s, x, y, o = {}) => {
  const { size = 12, col = '#cbd5e1', align = 'left', base = 'middle', bold = false } = o;
  ctx.font = `${bold ? '600 ' : ''}${size}px ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(String(s), x, y);
};
const rrect = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const tip = (ctx, W, H, x, y, lines, accent = '#818cf8') => {
  if (!lines?.length) return;
  const s = fsz(W, H, 0.9); ctx.font = `${s}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16, h = lines.length * (s + 5) + 10;
  let bx = x + 12, by = y + 12; if (bx + w > W - 4) bx = x - w - 12; if (by + h > H - 4) by = y - h - 12;
  bx = clamp(bx, 4, Math.max(4, W - w - 4)); by = clamp(by, 4, Math.max(4, H - h - 4));
  ctx.fillStyle = 'rgba(8,13,26,.92)'; rrect(ctx, bx, by, w, h, 7); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
  lines.forEach((l, i) => text(ctx, l, bx + 8, by + 5 + (s + 5) * i + s / 2 + 1, { size: s, col: i ? '#cbd5e1' : '#f8fafc', bold: !i }));
};
const pal = (C, i, n = 8, a = 1) => hsla(hueOf(C.color || '#818cf8') + i * (300 / Math.max(1, n)), 78, 58, a);
const padBox = (W, H, leftExtra = 1.8) => { const fs = fsz(W, H); return { fs, ml: fs * leftExtra, mt: fs * 1.8, mr: fs * 1.4, mb: fs * 2.2, iw: 0, ih: 0, finish() { this.iw = W - this.ml - this.mr; this.ih = H - this.mt - this.mb; return this; } }; };
const WEEK = ['周一','周二','周三','周四','周五','周六','周日'];
const MON = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const CAT = ['A','B','C','D','E','F','G','H'];
const series = (n, seed, t, amp = 0.18) => {
  const r = rng(seed); let v = 40 + r() * 30; const out = [];
  for (let i = 0; i < n; i++) { v = clamp(v + (r() - 0.48) * 18, 8, 100); out.push(v * (1 + amp * Math.sin(t * 0.7 + i * 0.45 + seed))); }
  return out;
};
const axes = (ctx, box, C, labels, yMax) => {
  const { ml, mt, iw, ih, fs } = box;
  ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) { const y = mt + ih * (1 - g / 4); ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + iw, y); ctx.stroke(); text(ctx, fmt((yMax * g) / 4, 0), ml - 6, y, { size: fs * 0.75, col: '#64748b', align: 'right' }); }
  ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ih); ctx.lineTo(ml + iw, mt + ih); ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.stroke();
  const n = labels.length; for (let i = 0; i < n; i++) { const x = ml + ((i + 0.5) / n) * iw; text(ctx, labels[i], x, mt + ih + fs * 1.1, { size: fs * 0.7, col: '#94a3b8', align: 'center' }); }
};
const chip = (ctx, W, H, C) => { ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, 0, 0, W, 8, 0); ctx.fill(); rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.stroke(); };

export const FAM = {};


function lineLike(mode) {
  return (S) => {
    let seed = 7;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 12)), 4, 36);
      const tension = num(C.ten, 0.35), lw = num(C.size, 2), fill = on(C.fill), legend = on(C.leg);
      const spd = num(C.speed, 0.9); const box = padBox(W, H).finish();
      const labels = n <= 7 ? WEEK.slice(0, n) : Array.from({ length: n }, (_, i) => String(i + 1));
      const seriesN = mode === 'multiline' || mode === 'stackedarea' || mode === 'areaRange' || mode === 'mixed' || mode === 'combo' || mode === 'barline' ? (mode === 'multiline' ? 3 : 2) : 1;
      const data = Array.from({ length: seriesN }, (_, s) => series(n, seed + s * 17, t * spd, 0.12 + s * 0.03));
      if (mode === 'logline') for (const d of data) for (let i = 0; i < d.length; i++) d[i] = Math.max(1, d[i]);
      let yMax = Math.max(...data.flat(), 1) * 1.15;
      if (mode === 'logline') yMax = Math.max(yMax, 10);
      const yAt = (v) => {
        if (mode === 'logline') { const lo = Math.log10(1), hi = Math.log10(yMax); return box.mt + box.ih * (1 - (Math.log10(Math.max(1, v)) - lo) / (hi - lo || 1)); }
        return box.mt + box.ih * (1 - v / yMax);
      };
      const xAt = (i) => box.ml + ((i + 0.5) / n) * box.iw;
      axes(ctx, box, C, labels, yMax);
      const path = (ds, stepped) => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = xAt(i), y = yAt(ds[i]);
          if (!stepped) {
            if (i === 0) ctx.moveTo(x, y);
            else {
              const x0 = xAt(i - 1), y0 = yAt(ds[i - 1]);
              const c = tension * (x - x0);
              ctx.bezierCurveTo(x0 + c, y0, x - c, y, x, y);
            }
          } else {
            if (i === 0) ctx.moveTo(x, y); else { ctx.lineTo(x, yAt(ds[i - 1])); ctx.lineTo(x, y); }
          }
        }
      };
      // stacked area
      if (mode === 'stackedarea') {
        const stack = data[0].map(() => 0);
        for (let s = 0; s < seriesN; s++) {
          ctx.beginPath();
          for (let i = 0; i < n; i++) { const y0 = yAt(stack[i]); const y1 = yAt(stack[i] + data[s][i]); const x = xAt(i); i ? ctx.lineTo(x, y1) : ctx.moveTo(x, y1); stack[i] += data[s][i]; }
          for (let i = n - 1; i >= 0; i--) { stack[i] -= data[s][i]; ctx.lineTo(xAt(i), yAt(stack[i])); stack[i] += data[s][i]; }
          ctx.closePath(); ctx.fillStyle = pal(C, s, seriesN, 0.55); ctx.fill();
        }
      } else if (mode === 'areaRange') {
        const lo = data[0].map((v, i) => v * 0.7); const hi = data[0];
        ctx.beginPath(); for (let i = 0; i < n; i++) { const x = xAt(i); i ? ctx.lineTo(x, yAt(hi[i])) : ctx.moveTo(x, yAt(hi[i])); }
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(xAt(i), yAt(lo[i]));
        ctx.closePath(); ctx.fillStyle = pal(C, 0, 3, 0.35); ctx.fill();
        path(hi, false); ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = lw; ctx.stroke();
      } else {
        for (let s = 0; s < seriesN; s++) {
          const ds = data[s];
          if (fill || mode === 'area' || mode === 'sparkline') {
            path(ds, mode === 'stepline'); ctx.lineTo(xAt(n - 1), box.mt + box.ih); ctx.lineTo(xAt(0), box.mt + box.ih); ctx.closePath();
            ctx.fillStyle = pal(C, s, seriesN, 0.28); ctx.fill();
          }
          path(ds, mode === 'stepline'); ctx.strokeStyle = s ? pal(C, s, seriesN) : (C.color || '#818cf8'); ctx.lineWidth = lw; ctx.stroke();
          for (let i = 0; i < n; i++) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(xAt(i), yAt(ds[i]), 3.2, 0, TAU); ctx.fill(); }
        }
      }
      // bars overlay for mixed/combo/barline
      if (mode === 'mixed' || mode === 'combo' || mode === 'barline') {
        const bw = box.iw / n * 0.45;
        for (let i = 0; i < n; i++) {
          const h = (data[0][i] / yMax) * box.ih; const x = xAt(i) - bw / 2, y = box.mt + box.ih - h;
          ctx.fillStyle = pal(C, 0, 4, 0.75); rrect(ctx, x, y, bw, h, 4); ctx.fill();
        }
        path(data[1] || data[0], false); ctx.strokeStyle = pal(C, 2, 4); ctx.lineWidth = lw + 0.5; ctx.stroke();
      }
      if (legend) {
        for (let s = 0; s < Math.max(1, seriesN); s++) {
          ctx.fillStyle = pal(C, s, seriesN); rrect(ctx, box.ml + s * 72, 10, 10, 10, 2); ctx.fill();
          text(ctx, `序列${s + 1}`, box.ml + 14 + s * 72, 15, { size: box.fs * 0.75, col: '#94a3b8' });
        }
      }
      let hit = null; let best = 1e9;
      for (let s = 0; s < seriesN; s++) for (let i = 0; i < n; i++) {
        const x = xAt(i), y = yAt(data[s][i]); const d = Math.hypot(P.x - x, P.y - y);
        if (d < best && d < 28) { best = d; hit = { s, i, x, y, v: data[s][i] }; }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hit.x, hit.y, 6, 0, TAU); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`${labels[hit.i]} · 序列${hit.s + 1}`, fmt(hit.v, 1)], C.color); }
      text(ctx, mode, box.ml, box.fs * 0.65, { size: box.fs * 0.8, col: '#64748b' });
      return { n, tension, lw, fill: yes(fill), legend: yes(legend), cell: hit ? `${labels[hit.i]} / S${hit.s + 1}` : '（移到点上）', val: hit ? fmt(hit.v, 1) : '—', yMax: fmt(yMax, 0), spd: fmt(spd, 2), hx: hit ? hit.x : W / 2, hy: hit ? hit.y : H / 2, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}
function barLike(mode) {
  return (S) => {
    const seed = 11;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 8)), 3, 24);
      const gap = num(C.gap, 0.2), rad = num(C.rad, 6), spd = num(C.speed, 0.9), stacked = mode.includes('stack') || mode === 'waterfall' || mode === 'horizstack';
      const horiz = mode === 'hbar' || mode === 'horizstack';
      let groups = mode === 'groupedbar' ? 3 : (stacked && mode !== 'waterfall' ? 3 : 1);
      const box = padBox(W, H, horiz ? 2.6 : 1.8).finish();
      const labels = n <= 7 ? WEEK.slice(0, n) : (mode === 'density' ? MON.slice(0, Math.min(n, 12)) : Array.from({ length: n }, (_, i) => CAT[i % CAT.length] + (i >= CAT.length ? i : '')));
      const data = Array.from({ length: Math.max(1, groups) }, (_, s) => series(n, seed + s * 13, t * spd, 0.1));
      let yMax = Math.max(...data.flat(), 1) * 1.2;
      if (stacked && mode !== 'waterfall') {
        yMax = 0; for (let i = 0; i < n; i++) { let s = 0; for (let g = 0; g < groups; g++) s += data[g][i]; yMax = Math.max(yMax, s); }
        yMax *= 1.1;
      }
      if (mode === 'waterfall') {
        // rebuild as deltas
        const base = series(n, seed, t * spd, 0.05); let acc = 50;
        for (let i = 0; i < n; i++) { data[0][i] = (i === 0 || i === n - 1) ? (i === 0 ? 50 : acc) : (base[i] - 50); if (i > 0 && i < n - 1) acc += data[0][i]; }
        yMax = Math.max(80, acc) * 1.2; groups = 1;
      }
      if (!horiz) axes(ctx, box, C, labels, yMax);
      else {
        ctx.strokeStyle = 'rgba(148,163,184,.2)';
        for (let g = 0; g <= 4; g++) { const x = box.ml + box.iw * (g / 4); ctx.beginPath(); ctx.moveTo(x, box.mt); ctx.lineTo(x, box.mt + box.ih); ctx.stroke(); text(ctx, fmt(yMax * g / 4, 0), x, box.mt + box.ih + box.fs, { size: box.fs * 0.7, col: '#64748b', align: 'center' }); }
        for (let i = 0; i < n; i++) text(ctx, labels[i], box.ml - 6, box.mt + ((i + 0.5) / n) * box.ih, { size: box.fs * 0.75, col: '#94a3b8', align: 'right' });
      }
      const marks = [];
      if (horiz) {
        const bh = box.ih / n * (1 - gap);
        for (let i = 0; i < n; i++) {
          let x0 = box.ml; const y = box.mt + (i + gap / 2) * (box.ih / n);
          if (mode === 'horizstack') {
            for (let g = 0; g < groups; g++) {
              const w = (data[g][i] / yMax) * box.iw; ctx.fillStyle = pal(C, g, groups); rrect(ctx, x0, y, Math.max(1, w), bh, rad); ctx.fill();
              marks.push({ i, g, x: x0, y, w, h: bh, v: data[g][i] }); x0 += w;
            }
          } else {
            const w = (data[0][i] / yMax) * box.iw; ctx.fillStyle = pal(C, i, n); rrect(ctx, x0, y, Math.max(1, w), bh, rad); ctx.fill();
            marks.push({ i, g: 0, x: x0, y, w, h: bh, v: data[0][i] });
          }
        }
      } else if (mode === 'groupedbar') {
        const slot = box.iw / n, bw = slot * (1 - gap) / groups;
        for (let i = 0; i < n; i++) for (let g = 0; g < groups; g++) {
          const h = (data[g][i] / yMax) * box.ih, x = box.ml + i * slot + slot * gap / 2 + g * bw, y = box.mt + box.ih - h;
          ctx.fillStyle = pal(C, g, groups); rrect(ctx, x, y, Math.max(1, bw - 1), h, rad); ctx.fill();
          marks.push({ i, g, x, y, w: bw, h, v: data[g][i] });
        }
      } else if (stacked && mode !== 'waterfall') {
        const slot = box.iw / n, bw = slot * (1 - gap);
        for (let i = 0; i < n; i++) {
          let y = box.mt + box.ih; const x = box.ml + i * slot + slot * gap / 2;
          for (let g = 0; g < groups; g++) {
            const h = (data[g][i] / yMax) * box.ih; y -= h;
            ctx.fillStyle = pal(C, g, groups); rrect(ctx, x, y, Math.max(1, bw), h, g === groups - 1 ? rad : 0); ctx.fill();
            marks.push({ i, g, x, y, w: bw, h, v: data[g][i] });
          }
        }
      } else if (mode === 'waterfall') {
        const slot = box.iw / n, bw = slot * (1 - gap); let acc = 0;
        for (let i = 0; i < n; i++) {
          const v = data[0][i]; const base = (i === 0 || i === n - 1) ? 0 : acc;
          if (i > 0 && i < n - 1) acc += v;
          const top = (i === 0 || i === n - 1) ? v : base + Math.max(0, v);
          const bot = (i === 0 || i === n - 1) ? 0 : base + Math.min(0, v);
          const h = ((top - bot) / yMax) * box.ih; const x = box.ml + i * slot + slot * gap / 2; const y = box.mt + box.ih - (top / yMax) * box.ih;
          ctx.fillStyle = (i === 0 || i === n - 1) ? pal(C, 0, 3) : (v >= 0 ? pal(C, 1, 3) : pal(C, 2, 3));
          rrect(ctx, x, y, Math.max(1, bw), Math.max(1, h), rad); ctx.fill();
          marks.push({ i, g: 0, x, y, w: bw, h, v });
        }
      } else {
        const slot = box.iw / n, bw = slot * (1 - gap);
        for (let i = 0; i < n; i++) {
          const h = (data[0][i] / yMax) * box.ih, x = box.ml + i * slot + slot * gap / 2, y = box.mt + box.ih - h;
          ctx.fillStyle = pal(C, i, n); rrect(ctx, x, y, Math.max(1, bw), h, rad); ctx.fill();
          marks.push({ i, g: 0, x, y, w: bw, h, v: data[0][i] });
        }
      }
      let hit = null;
      for (const m of marks) if (P.x >= m.x && P.x <= m.x + m.w && P.y >= m.y && P.y <= m.y + m.h) hit = m;
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, rad); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`${labels[hit.i]}${groups > 1 ? ' · G' + (hit.g + 1) : ''}`, fmt(hit.v, 1)], C.color); }
      text(ctx, mode, box.ml, box.fs * 0.65, { size: box.fs * 0.8, col: '#64748b' });
      return { n, gap: fmt(gap, 2), rad, cell: hit ? labels[hit.i] : '（移到柱上）', val: hit ? fmt(hit.v, 1) : '—', yMax: fmt(yMax, 0), groups, hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}

function pieLike(mode) {
  return (S) => {
    const seed = 21;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 5)), 3, 10);
      const hole = mode.includes('doughnut') || mode === 'progress' || mode === 'kpi' || mode === 'gauge' ? num(C.hole, 0.55) : (mode === 'pieexplode' ? 0 : 0);
      const explode = mode === 'pieexplode' ? num(C.exp, 0.12) : 0;
      const spd = num(C.speed, 0.9); const legend = on(C.leg);
      const box = padBox(W, H).finish();
      const labels = CAT.slice(0, n);
      const raw = series(n, seed, t * spd * 0.4, 0.08); const sum = raw.reduce((a, b) => a + b, 0) || 1;
      const cx = W * (legend && mode.includes('legend') ? 0.38 : 0.5), cy = H * 0.52;
      const R = Math.min(W, H) * 0.32;
      let a0 = -Math.PI / 2 + t * spd * 0.05; const slices = [];
      if (mode === 'gauge' || mode === 'progress' || mode === 'kpi') {
        const v = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * spd));
        const start = mode === 'gauge' ? Math.PI : -Math.PI / 2; const span = mode === 'gauge' ? Math.PI : TAU;
        ctx.beginPath(); ctx.arc(cx, cy, R, start, start + span); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = R * (1 - hole) * 0.9; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, R, start, start + span * v); ctx.strokeStyle = C.color || '#818cf8'; ctx.stroke();
        text(ctx, `${Math.round(v * 100)}%`, cx, cy - (mode === 'gauge' ? R * 0.15 : 0), { size: fsz(W, H, 1.6), col: '#f8fafc', align: 'center', bold: true });
        if (mode === 'kpi') text(ctx, '目标完成', cx, cy + fsz(W, H), { size: fsz(W, H, 0.85), col: '#94a3b8', align: 'center' });
        const ang = start + span * v; const hx = cx + Math.cos(ang) * R, hy = cy + Math.sin(ang) * R;
        return { n: 1, hole: fmt(hole, 2), cell: '进度', val: `${Math.round(v * 100)}%`, pct: fmt(v, 3), hx, hy, colorHex: String(C.color || '').toLowerCase() };
      }
      if (mode === 'polar') {
        const max = Math.max(...raw);
        for (let i = 0; i < n; i++) {
          const a1 = a0 + TAU / n; const r = R * (0.35 + 0.65 * raw[i] / max);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
          ctx.fillStyle = pal(C, i, n, 0.85); ctx.fill();
          slices.push({ i, a0, a1, r }); a0 = a1;
        }
      } else {
        for (let i = 0; i < n; i++) {
          const a1 = a0 + TAU * (raw[i] / sum); const mid = (a0 + a1) / 2;
          const off = (explode && (mode === 'pieexplode' ? (i === 0 || explode > 0.2) : false)) ? R * explode : (explode && i === Math.floor(t * 0.5) % n ? R * explode : 0);
          const ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
          ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.arc(cx + ox, cy + oy, R, a0, a1);
          if (hole > 0.05) ctx.arc(cx + ox, cy + oy, R * hole, a1, a0, true);
          ctx.closePath(); ctx.fillStyle = pal(C, i, n); ctx.fill();
          slices.push({ i, a0, a1, ox, oy, mid }); a0 = a1;
        }
      }
      let hit = null; const dx = P.x - cx, dy = P.y - cy; const ang = Math.atan2(dy, dx); const dist = Math.hypot(dx, dy);
      for (const s of slices) {
        let a = ang; while (a < s.a0) a += TAU; while (a > s.a0 + TAU) a -= TAU;
        if (a >= s.a0 && a <= s.a1 && dist <= (s.r || R) && dist >= R * hole * 0.9) hit = s;
      }
      if (hit) tip(ctx, W, H, P.x, P.y, [labels[hit.i], `${fmt(100 * raw[hit.i] / sum, 1)}% · ${fmt(raw[hit.i], 1)}`], C.color);
      if (legend || mode === 'doughnutlegend') {
        for (let i = 0; i < n; i++) {
          const x = mode.includes('legend') ? W * 0.68 : box.ml, y = (mode.includes('legend') ? H * 0.28 : 14) + i * (box.fs * 1.4);
          ctx.fillStyle = pal(C, i, n); rrect(ctx, x, y, 10, 10, 2); ctx.fill();
          text(ctx, `${labels[i]} ${fmt(100 * raw[i] / sum, 0)}%`, x + 14, y + 5, { size: box.fs * 0.8, col: '#cbd5e1' });
        }
      }
      text(ctx, mode, 12, box.fs * 0.65, { size: box.fs * 0.8, col: '#64748b' });
      return { n, hole: fmt(hole, 2), cell: hit ? labels[hit.i] : '（移到扇区）', val: hit ? `${fmt(100 * raw[hit.i] / sum, 1)}%` : '—', sum: fmt(sum, 0), hx: hit ? cx + Math.cos(hit.mid || 0) * R * 0.7 : cx, hy: hit ? cy + Math.sin(hit.mid || 0) * R * 0.7 : cy, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}

function radarLike(mode) {
  return (S) => {
    const seed = 33;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 6)), 3, 10), layers = mode === 'radarfill' ? 2 : 1;
      const spd = num(C.speed, 0.9), fill = on(C.fill) || mode === 'radarfill';
      const cx = W / 2, cy = H / 2 + 8, R = Math.min(W, H) * 0.34; const labels = CAT.slice(0, n);
      const data = Array.from({ length: layers }, (_, s) => series(n, seed + s * 9, t * spd, 0.1).map((v) => v / 100));
      for (let g = 1; g <= 4; g++) { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i % n) * TAU / n; const x = cx + Math.cos(a) * R * g / 4, y = cy + Math.sin(a) * R * g / 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.stroke(); }
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * TAU / n; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.stroke(); text(ctx, labels[i], cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16), { size: fsz(W, H, 0.8), col: '#94a3b8', align: 'center' }); }
      let hit = null, best = 1e9;
      for (let s = 0; s < layers; s++) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i % n) * TAU / n; const r = R * data[s][i % n]; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); if (i < n) { const d = Math.hypot(P.x - x, P.y - y); if (d < best) { best = d; hit = { s, i, x, y, v: data[s][i] }; } } }
        if (fill) { ctx.fillStyle = pal(C, s, layers, 0.25); ctx.fill(); }
        ctx.strokeStyle = pal(C, s, layers); ctx.lineWidth = num(C.size, 2); ctx.stroke();
      }
      if (hit && best < 24) tip(ctx, W, H, P.x, P.y, [`${labels[hit.i]} · L${hit.s + 1}`, fmt(hit.v * 100, 1)], C.color);
      return { n, layers, cell: hit && best < 24 ? labels[hit.i] : '（移到顶点）', val: hit && best < 24 ? fmt(hit.v * 100, 1) : '—', fill: yes(fill), hx: hit ? hit.x : cx, hy: hit ? hit.y : cy, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}

function scatterLike(mode) {
  return (S) => {
    const seed0 = 41;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 40)), 8, 120), spd = num(C.speed, 0.9);
      const box = padBox(W, H).finish(); axes(ctx, box, C, ['低', '', '', '', '高'], 100);
      const r = rng(seed0); const pts = [];
      for (let i = 0; i < n; i++) {
        const x = r(), y = r() * 0.7 + x * 0.25 + 0.05 * Math.sin(t * spd + i);
        const rad = mode === 'bubble' || mode === 'bubblepack' ? 4 + r() * num(C.size, 16) : num(C.size, 4);
        const px = box.ml + x * box.iw, py = box.mt + box.ih * (1 - clamp(y, 0, 1));
        pts.push({ i, px, py, rad, x, y });
      }
      let hit = null, best = 1e9;
      for (const p of pts) {
        ctx.fillStyle = pal(C, p.i, n, 0.8); ctx.beginPath(); ctx.arc(p.px, p.py, p.rad, 0, TAU); ctx.fill();
        const d = Math.hypot(P.x - p.px, P.y - p.py); if (d < best && d < p.rad + 8) { best = d; hit = p; }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hit.px, hit.py, hit.rad + 2, 0, TAU); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`点 #${hit.i + 1}`, `x=${fmt(hit.x, 2)} y=${fmt(hit.y, 2)}`], C.color); }
      return { n, cell: hit ? `#${hit.i + 1}` : '（移到点上）', val: hit ? `${fmt(hit.x, 2)},${fmt(hit.y, 2)}` : '—', hx: hit ? hit.px : W / 2, hy: hit ? hit.py : H / 2, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}

function sparkLike(mode) {
  return (S) => {
    const seed = 55;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);
      const n = clamp(Math.round(num(C.count, 24)), 8, 60), spd = num(C.speed, 0.9);
      const data = series(n, seed, t * spd, 0.15); const max = Math.max(...data), min = Math.min(...data);
      const pad = 24, iw = W - pad * 2, ih = H - pad * 2;
      let hit = null;
      if (mode === 'sparkbar' || mode === 'stack-canvas') {
        const groups = mode === 'stack-canvas' ? 3 : 1; const slot = iw / n;
        const seriesN = Array.from({ length: groups }, (_, s) => series(n, seed + s * 3, t * spd, 0.1));
        for (let i = 0; i < n; i++) {
          let y = pad + ih; const x = pad + i * slot + slot * 0.15;
          for (let g = 0; g < groups; g++) {
            const h = ((seriesN[g][i] - 0) / (max * (groups > 1 ? 1.8 : 1))) * ih * 0.85; y -= h;
            ctx.fillStyle = pal(C, g, Math.max(3, groups)); rrect(ctx, x, y, slot * 0.7, Math.max(1, h), 3); ctx.fill();
            if (P.x >= x && P.x <= x + slot * 0.7 && P.y >= y && P.y <= y + h) hit = { i, v: seriesN[g][i], x: x + slot * 0.35, y };
          }
        }
      } else {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const x = pad + (i / (n - 1)) * iw, y = pad + ih - ((data[i] - min) / (max - min || 1)) * ih; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = num(C.size, 2); ctx.stroke();
        ctx.lineTo(pad + iw, pad + ih); ctx.lineTo(pad, pad + ih); ctx.closePath(); ctx.fillStyle = pal(C, 0, 3, 0.25); ctx.fill();
        for (let i = 0; i < n; i++) {
          const x = pad + (i / (n - 1)) * iw, y = pad + ih - ((data[i] - min) / (max - min || 1)) * ih;
          if (Math.hypot(P.x - x, P.y - y) < 16) hit = { i, v: data[i], x, y };
        }
      }
      if (hit) tip(ctx, W, H, P.x, P.y, [`#${hit.i + 1}`, fmt(hit.v, 1)], C.color);
      text(ctx, mode, pad, 14, { size: 11, col: '#64748b' });
      return { n, cell: hit ? `#${hit.i + 1}` : '（移到点/柱）', val: hit ? fmt(hit.v, 1) : '—', hx: hit ? hit.x : W / 2, hy: hit ? hit.y : H / 2, colorHex: String(C.color || '').toLowerCase() };
    };
  };
}
FAM['line'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '平滑': { ten: 0.55 }, '折线': { ten: 0 }, '粗线': { size: 4.5 }, '填充': { fill: true }, '多点': { count: 24 } },
  doc: {
    title: '折线图 · 趋势',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p><b>折线图</b>用折线连接各时刻的数值，最适合看趋势升降。张力越大曲线越圆滑；打开填充可变成面积感。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("line"),
};

FAM['multiline'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '双线感': { count: 10 }, '密点': { count: 20 }, '粗线': { size: 3.5 }, '填充': { fill: true }, '高张力': { ten: 0.7 } },
  doc: {
    title: '多序列折线',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>多条折线画在同一坐标里，方便对比几个系列是否同涨同跌。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("multiline"),
};

FAM['area'] = {
  spec: { color: { label: '主色', value: '#34d399' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.4), T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '渐变感': { ten: 0.55 }, '硬折': { ten: 0 }, '透明': { size: 1.5 }, '多点': { count: 20 }, '慢': { speed: 0.3 } },
  doc: {
    title: '面积图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>面积图 = 折线 + 下方填色，强调累计体量而不只是走势。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("area"),
};

FAM['stepline'] = {
  spec: { color: { label: '主色', value: '#fbbf24' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '填充': { fill: true }, '粗线': { size: 3.5 }, '多点': { count: 16 }, '慢': { speed: 0.35 }, '快': { speed: 1.8 } },
  doc: {
    title: '阶梯折线',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>阶梯线在下一个点之前保持水平，适合股价开盘价、费率档位这类「突然跳变」的数据。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("stepline"),
};

FAM['stackedarea'] = {
  spec: { color: { label: '主色', value: '#a78bfa' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '三层感': { count: 10 }, '平滑': { ten: 0.6 }, '多点': { count: 18 }, '慢': { speed: 0.3 }, '快': { speed: 1.6 } },
  doc: {
    title: '堆叠面积',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>多层面积上下相叠，总高度是总和，颜色带表示各部分贡献。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("stackedarea"),
};

FAM['areaRange'] = {
  spec: { color: { label: '主色', value: '#38bdf8' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '宽带': { count: 12 }, '窄带': { count: 20 }, '慢': { speed: 0.3 }, '快': { speed: 1.7 }, '粗边': { size: 3 } },
  doc: {
    title: '区间面积',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>上下两条边界围成的带状区域，常表示置信区间或温度高低范围。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("areaRange"),
};

FAM['logline'] = {
  spec: { color: { label: '主色', value: '#f472b6' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '平滑': { ten: 0.5 }, '面积': { fill: true }, '多点': { count: 20 }, '慢': { speed: 0.3 }, '快': { speed: 1.8 } },
  doc: {
    title: '对数折线',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>Y 轴用对数刻度，指数增长会变成近似直线，方便看跨越数量级的变化。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("logline"),
};

FAM['sparkline'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '采样点', min: 4, max: 36, step: 1, value: 24 }, extras: [T('leg','图例',false)], remountKeys: [] },
  presets: { 默认: {}, '细线': { size: 1 }, '粗线': { size: 3.5 }, '多点': { count: 40 }, '少点': { count: 12 }, '慢': { speed: 0.3 } },
  doc: {
    title: '迷你折线',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>去掉坐标轴的迷你折线，嵌在表格或 KPI 旁一眼看趋势。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: sparkLike("sparkline"),
};

FAM['realtime'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 20 }, extras: [R('ten','曲线张力',0,1,0.05,0.25), T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '滚动快': { speed: 2 }, '慢流': { speed: 0.35 }, '面积': { fill: true }, '多点': { count: 28 }, '粗线': { size: 3 } },
  doc: {
    title: '实时流图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>数据随时间推移不断更新，右侧涌入新点、左侧旧点离开，像心电图。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("line"),
};

FAM['mixed'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '柱线': { count: 8 }, '多点': { count: 14 }, '粗线': { size: 3 }, '慢': { speed: 0.3 }, '快': { speed: 1.7 } },
  doc: {
    title: '混合图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>柱表示量、线表示率，两种几何叠在一起读「量质」关系。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("mixed"),
};

FAM['combo'] = {
  spec: { color: { label: '主色', value: '#34d399' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '面积线': { fill: true }, '柱线': { fill: false }, '多点': { count: 12 }, '慢': { speed: 0.3 }, '快': { speed: 1.6 } },
  doc: {
    title: '组合图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>组合图把柱与线（或面积）编在同一坐标系，适合仪表盘总览。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("combo"),
};

FAM['barline'] = {
  spec: { color: { label: '主色', value: '#f59e0b' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '数据点', min: 4, max: 36, step: 1, value: 12 }, extras: [R('ten','曲线张力',0,1,0.05,0.35), T('fill','填充',false), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '对比': { count: 8 }, '密': { count: 14 }, '粗线': { size: 3.5 }, '慢': { speed: 0.3 }, '快': { speed: 1.8 } },
  doc: {
    title: '柱线双轴感',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>柱与线共用类别轴，线常表示比率或均价，柱表示销量。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: lineLike("barline"),
};

FAM['bar'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '圆角', min: 0, max: 20, step: 1, value: 8 }, count: { label: '柱数', min: 4, max: 20, step: 1, value: 8 }, extras: [R('gap','柱间隙',0.05,0.5,0.01,0.22), R('rad','圆角',0,20,1,8)], remountKeys: [] },
  presets: { 默认: {}, '圆角': { rad: 14 }, '扁平': { rad: 0 }, '细缝': { gap: 0.08 }, '宽缝': { gap: 0.4 }, '少柱': { count: 5 } },
  doc: {
    title: '柱状图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>柱高表示数值大小，类别排在横轴。是最常见的对比图。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("bar"),
};

FAM['hbar'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '圆角', min: 0, max: 20, step: 1, value: 8 }, count: { label: '条数', min: 4, max: 36, step: 1, value: 7 }, extras: [R('gap','条间隙',0.05,0.5,0.01,0.2), R('rad','圆角',0,20,1,8)], remountKeys: [] },
  presets: { 默认: {}, '圆角': { rad: 12 }, '细条': { gap: 0.35 }, '密': { count: 10 }, '少': { count: 5 }, '慢': { speed: 0.3 } },
  doc: {
    title: '横向柱图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>把柱横过来，类别名更易读，适合排名榜。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("hbar"),
};

FAM['stackedbar'] = {
  spec: { color: { label: '主色', value: '#a78bfa' }, speed: SPD(), size: { label: '圆角', min: 0, max: 16, step: 0.5, value: 6 }, count: { label: '柱数', min: 4, max: 36, step: 1, value: 7 }, extras: [R('gap','柱间隙',0.05,0.45,0.01,0.2), R('rad','圆角',0,16,1,6)], remountKeys: [] },
  presets: { 默认: {}, '三层': { count: 6 }, '多类': { count: 10 }, '圆角': { rad: 10 }, '宽缝': { gap: 0.35 }, '慢': { speed: 0.3 } },
  doc: {
    title: '堆叠柱图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>一根柱里叠多种构成，总高是合计，颜色分段是部分。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("stackedbar"),
};

FAM['groupedbar'] = {
  spec: { color: { label: '主色', value: '#f472b6' }, speed: SPD(), size: { label: '圆角', min: 0, max: 16, step: 0.5, value: 6 }, count: { label: '组数', min: 4, max: 36, step: 1, value: 6 }, extras: [R('gap','组间隙',0.05,0.45,0.01,0.18), R('rad','圆角',0,16,1,6)], remountKeys: [] },
  presets: { 默认: {}, '双组感': { count: 5 }, '多组': { count: 8 }, '窄缝': { gap: 0.1 }, '宽缝': { gap: 0.35 }, '慢': { speed: 0.3 } },
  doc: {
    title: '分组柱图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>同一类别并排多根柱，直接比不同系列在该类别上的差异。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("groupedbar"),
};

FAM['horizstack'] = {
  spec: { color: { label: '主色', value: '#34d399' }, speed: SPD(), size: { label: '圆角', min: 0, max: 16, step: 0.5, value: 6 }, count: { label: '行数', min: 4, max: 36, step: 1, value: 6 }, extras: [R('gap','行间隙',0.05,0.45,0.01,0.2), R('rad','圆角',0,16,1,6)], remountKeys: [] },
  presets: { 默认: {}, '三层': { count: 5 }, '多行': { count: 9 }, '圆角': { rad: 10 }, '慢': { speed: 0.3 }, '快': { speed: 1.7 } },
  doc: {
    title: '横向堆叠',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>横向的堆叠条，常用于份额构成的排行。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("horizstack"),
};

FAM['waterfall'] = {
  spec: { color: { label: '主色', value: '#fbbf24' }, speed: SPD(), size: { label: '圆角', min: 0, max: 16, step: 0.5, value: 6 }, count: { label: '步骤', min: 5, max: 36, step: 1, value: 8 }, extras: [R('gap','柱间隙',0.05,0.45,0.01,0.2), R('rad','圆角',0,16,1,6)], remountKeys: [] },
  presets: { 默认: {}, '盈亏': { count: 7 }, '多步': { count: 10 }, '细缝': { gap: 0.12 }, '慢': { speed: 0.3 }, '快': { speed: 1.6 } },
  doc: {
    title: '瀑布图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>从起点出发，每一步加减，最后落到终点，用来拆解利润变化。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("waterfall"),
};

FAM['density'] = {
  spec: { color: { label: '主色', value: '#38bdf8' }, speed: SPD(), size: { label: '圆角', min: 0, max: 12, step: 0.5, value: 4 }, count: { label: '柱数', min: 4, max: 24, step: 1, value: 12 }, extras: [R('gap','柱间隙',0.02,0.35,0.01,0.08), R('rad','圆角',0,12,1,4)], remountKeys: [] },
  presets: { 默认: {}, '日感': { count: 24, gap: 0.05 }, '周': { count: 7 }, '月': { count: 12 }, '热力': { gap: 0.04, rad: 2 }, '慢': { speed: 0.3 } },
  doc: {
    title: '密度柱',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>很多细柱排在一起，像直方图，看出分布疏密。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("bar"),
};

FAM['weekday'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '圆角', min: 0, max: 14, step: 0.5, value: 6 }, count: { label: '天', min: 5, max: 7, step: 1, value: 7 }, extras: [R('gap','间隙',0.05,0.4,0.01,0.2), R('rad','圆角',0,14,1,6)], remountKeys: [] },
  presets: { 默认: {}, '柱': { count: 7 }, '密': { gap: 0.1 }, '疏': { gap: 0.35 }, '慢': { speed: 0.3 }, '快': { speed: 1.7 } },
  doc: {
    title: '工作日对比',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>周一到周日的分组对比，适合看工作日/周末差异。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: barLike("groupedbar"),
};

FAM['sparkbar'] = {
  spec: { color: { label: '主色', value: '#a78bfa' }, speed: SPD(), size: { label: '柱感', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '柱数', min: 4, max: 40, step: 1, value: 20 }, extras: [], remountKeys: [] },
  presets: { 默认: {}, '细': { count: 28 }, '中': { count: 16 }, '少': { count: 10 }, '慢': { speed: 0.3 }, '快': { speed: 1.8 } },
  doc: {
    title: '迷你柱列',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>迷你柱列嵌在报表里，比数字更直观的近期波动。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: sparkLike("sparkbar"),
};

FAM['spark-canvas'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '采样', min: 4, max: 36, step: 1, value: 24 }, extras: [], remountKeys: [] },
  presets: { 默认: {}, '细线': { size: 1.2 }, '粗线': { size: 3 }, '多点': { count: 36 }, '慢': { speed: 0.3 }, '快': { speed: 1.8 } },
  doc: {
    title: '迷你趋势画布',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>纯画布实现的迷你趋势，无 Chart.js 依赖。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: sparkLike("sparkline"),
};

FAM['stack-canvas'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '柱数', min: 4, max: 36, step: 1, value: 16 }, extras: [], remountKeys: [] },
  presets: { 默认: {}, '少': { count: 10 }, '多': { count: 22 }, '慢': { speed: 0.3 }, '快': { speed: 1.7 }, '中': { count: 14 } },
  doc: {
    title: '堆叠图画布',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>多层堆叠柱的画布版，展示构成随类别变化。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: sparkLike("stack-canvas"),
};

FAM['pie'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '描边感', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '扇区', min: 3, max: 9, step: 1, value: 5 }, extras: [R('hole','内径',0,0.3,0.01,0), T('leg','图例',true), R('exp','分离',0,0.2,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '标准': { count: 5 }, '多扇': { count: 8 }, '图例': { leg: true }, '少扇': { count: 3 }, '慢': { speed: 0.25 } },
  doc: {
    title: '饼图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>圆被切成扇形，角度 ∝ 占比。适合看「部分占整体」。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("pie"),
};

FAM['doughnut'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '环感', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '扇区', min: 3, max: 9, step: 1, value: 5 }, extras: [R('hole','内径',0.35,0.8,0.01,0.58), T('leg','图例',true), R('exp','分离',0,0.15,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '细环': { hole: 0.72 }, '粗环': { hole: 0.4 }, '多扇': { count: 7 }, '慢': { speed: 0.25 }, '快': { speed: 1.5 } },
  doc: {
    title: '环形图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>挖空的饼图，中间可放总计数字，更现代。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("doughnut"),
};

FAM['doughnutlegend'] = {
  spec: { color: { label: '主色', value: '#34d399' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '扇区', min: 4, max: 36, step: 1, value: 6 }, extras: [R('hole','内径',0.35,0.8,0.01,0.6), T('leg','图例',true), R('exp','分离',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '右图例': { count: 6 }, '多扇': { count: 8 }, '细环': { hole: 0.7 }, '慢': { speed: 0.25 }, '快': { speed: 1.4 } },
  doc: {
    title: '图例环形',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>环形图 + 右侧图例，会议投影时更清晰。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("doughnutlegend"),
};

FAM['pieexplode'] = {
  spec: { color: { label: '主色', value: '#f472b6' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '扇区', min: 4, max: 36, step: 1, value: 5 }, extras: [R('hole','内径',0,0.2,0.01,0), T('leg','图例',true), R('exp','分离量',0.05,0.28,0.01,0.14)], remountKeys: [] },
  presets: { 默认: {}, '突出': { exp: 0.2 }, '轻分': { exp: 0.08 }, '多扇': { count: 7 }, '慢': { speed: 0.25 }, '快': { speed: 1.5 } },
  doc: {
    title: '分离饼图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>某一扇略微弹出，强调重点类别。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("pieexplode"),
};

FAM['categoryPie'] = {
  spec: { color: { label: '主色', value: '#a78bfa' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '类别', min: 4, max: 36, step: 1, value: 6 }, extras: [R('hole','内径',0,0.55,0.01,0.2), T('leg','图例',true), R('exp','分离',0,0.15,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '6类': { count: 6 }, '环形感': { hole: 0.5 }, '描边感': { size: 3 }, '慢': { speed: 0.25 }, '快': { speed: 1.5 } },
  doc: {
    title: '分类占比',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>面向品类/渠道占比的饼图预设。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("pie"),
};

FAM['polar'] = {
  spec: { color: { label: '主色', value: '#fbbf24' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '瓣数', min: 4, max: 36, step: 1, value: 6 }, extras: [R('hole','内径',0,0.2,0.01,0), T('leg','图例',true), R('exp','分离',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '标准': { count: 6 }, '多瓣': { count: 8 }, '少瓣': { count: 4 }, '慢': { speed: 0.25 }, '快': { speed: 1.5 } },
  doc: {
    title: '极坐标面积',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>每瓣半径表示数值，角度均分，像雷达的「饼」版本。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("polar"),
};

FAM['gauge'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '轨宽感', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '刻度感', min: 3, max: 8, step: 1, value: 5 }, extras: [R('hole','内径',0.55,0.85,0.01,0.7), T('leg','图例',false), R('exp','unused',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '半环': { hole: 0.72 }, '粗轨': { hole: 0.58 }, '细针感': { hole: 0.8 }, '慢': { speed: 0.35 }, '快': { speed: 1.8 } },
  doc: {
    title: '仪表盘',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>半圆轨道上的进度，像汽车时速表，适合单一 KPI。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("gauge"),
};

FAM['progress'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '分段感', min: 4, max: 36, step: 1, value: 4 }, extras: [R('hole','内径',0.55,0.85,0.01,0.68), T('leg','图例',false), R('exp','unused',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '单环': { hole: 0.7 }, '粗': { hole: 0.55 }, '细': { hole: 0.8 }, '慢': { speed: 0.35 }, '快': { speed: 1.8 } },
  doc: {
    title: '进度环',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>完整圆环表示 0~100% 完成度。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("progress"),
};

FAM['kpi'] = {
  spec: { color: { label: '主色', value: '#34d399' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '档', min: 4, max: 36, step: 1, value: 4 }, extras: [R('hole','内径',0.55,0.85,0.01,0.66), T('leg','图例',false), R('exp','unused',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '目标': { hole: 0.65 }, '完成感': { speed: 1.2 }, '粗环': { hole: 0.55 }, '慢': { speed: 0.3 }, '快': { speed: 1.9 } },
  doc: {
    title: 'KPI 环',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>中间显示百分比文案的 KPI 环，看板常用。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("kpi"),
};

FAM['gauge-canvas'] = {
  spec: { color: { label: '主色', value: '#f59e0b' }, speed: SPD(), size: { label: '线宽/尺寸', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '档', min: 4, max: 36, step: 1, value: 5 }, extras: [R('hole','内径',0.55,0.85,0.01,0.7), T('leg','图例',false), R('exp','unused',0,0.1,0.01,0)], remountKeys: [] },
  presets: { 默认: {}, '半环': { hole: 0.72 }, '粗轨': { hole: 0.58 }, '慢': { speed: 0.35 }, '快': { speed: 1.8 }, '细': { hole: 0.8 } },
  doc: {
    title: '仪表盘画布',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>画布实现的仪表盘，与 Chart.js 版对照。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: pieLike("gauge"),
};

FAM['radar'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '维度', min: 3, max: 10, step: 1, value: 6 }, extras: [T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '填充': { fill: true }, '描边': { fill: false }, '多维': { count: 8 }, '少维': { count: 4 }, '慢': { speed: 0.3 } },
  doc: {
    title: '雷达图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>多个维度围成多边形，形状越满综合越强，适合能力模型。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: radarLike("radar"),
};

FAM['radarfill'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(), size: { label: '线宽', min: 1, max: 8, step: 0.5, value: 2 }, count: { label: '维度', min: 3, max: 10, step: 1, value: 6 }, extras: [T('fill','填充',true), T('leg','图例',true)], remountKeys: [] },
  presets: { 默认: {}, '填充': { fill: true }, '描边': { fill: false }, '多维': { count: 8 }, '少维': { count: 4 }, '慢': { speed: 0.3 } },
  doc: {
    title: '雷达填充对比',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>两层雷达叠加，对比两组评分的覆盖差异。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: radarLike("radarfill"),
};

FAM['scatter'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '点/泡大小', min: 2, max: 22, step: 0.5, value: 4 }, count: { label: '点数', min: 8, max: 100, step: 1, value: 40 }, extras: [T('leg','图例',false)], remountKeys: [] },
  presets: { 默认: {}, '疏': { count: 20 }, '密': { count: 70 }, '大点': { size: 12 }, '小点': { size: 3 }, '慢': { speed: 0.3 } },
  doc: {
    title: '散点图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>每个点是一个样本的 (x,y)，看相关与离群点。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: scatterLike("scatter"),
};

FAM['bubble'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '点/泡大小', min: 2, max: 22, step: 0.5, value: 6 }, count: { label: '点数', min: 8, max: 100, step: 1, value: 40 }, extras: [T('leg','图例',false)], remountKeys: [] },
  presets: { 默认: {}, '疏': { count: 20 }, '密': { count: 70 }, '大点': { size: 12 }, '小点': { size: 3 }, '慢': { speed: 0.3 } },
  doc: {
    title: '气泡图',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>散点 + 半径表示第三变量，气泡越大该维越大。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: scatterLike("bubble"),
};

FAM['bubblepack'] = {
  spec: { color: { label: '主色', value: '#22d3ee' }, speed: SPD(), size: { label: '点/泡大小', min: 2, max: 22, step: 0.5, value: 6 }, count: { label: '点数', min: 8, max: 100, step: 1, value: 40 }, extras: [T('leg','图例',false)], remountKeys: [] },
  presets: { 默认: {}, '疏': { count: 20 }, '密': { count: 70 }, '大点': { size: 12 }, '小点': { size: 3 }, '慢': { speed: 0.3 } },
  doc: {
    title: '气泡矩阵',
    rows: (v) => [['点数/类数', v.n], ['悬停', v.cell, 'cell'], ['数值', v.val, 'val'], ['主色', v.colorHex]],
    formula: () => F('值映射到画布坐标：x = pad + (i+0.5)/n × 宽') + F('y = pad + 高 × (1 − v / yMax)'),
    explain: '<p>更密集的气泡散布，观察聚集与分层。</p>',
    params: [['主色','系列颜色'],['速度','呼吸/动画快慢'],['尺寸/线宽','几何粗细'],['点数','类别或采样数']],
    example: (v) => `<ol><li>悬停：${v.cell} = ${v.val}</li><li>n=${v.n}</li></ol>`,
    tip: '悬停数据点查看数值；拖动滑条观察几何变化。',
  },
  build: scatterLike("bubblepack"),
};


const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, (v.doc.title || k).split('·')[0].trim()]));

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'line');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'line';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-charts',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count', 'ten', 'fill', 'leg', 'gap', 'rad', 'hole', 'exp'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    presetDefaults: F0.presets && { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => {
      const S = createCanvasStage(box, o, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: 'crosshair' });
      S.onFrame(F0.build(S));
      return () => S.destroy();
    },
  });
}
