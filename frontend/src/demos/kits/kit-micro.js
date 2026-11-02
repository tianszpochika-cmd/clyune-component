/**
 * kit-micro — 19 canvas micro-interaction families (Lottie-style keyframes, like burst, toggles, checkbox,
 * send, copy, download, skeleton, toast, badge, drag, long-press, shake, slide-verify, double-tap zoom,
 * magnetic hover, press ripple, spring toggle). Each loops automatically with a demo cursor; clicking
 * restarts the interaction from the pointer. All knobs are live (no remount).
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '动画速度', max = 2.5) => ({ label, min: 0, max, step: 0.05, value: 0.9 });
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
const chip = (ctx, W, H, C) => {
  ctx.fillStyle = C.color || '#818cf8';
  rrect(ctx, 0, 0, W, 8, 0); ctx.fill();
  rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, W - 48, H - 48, 38, 38, 9); ctx.stroke();
};
const pastel = (C, i, n = 8, a = 1) => hsla(hueOf(C.color || '#818cf8') + i * (300 / Math.max(1, n)), 72, 58, a);
const easeFn = (name, t) => {
  t = clamp(t, 0, 1);
  switch (name) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'back': { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
    case 'bounce': return t < 0.5 ? 4 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'steps': return Math.floor(t * 5) / 5;
    default: return t * t * (3 - 2 * t); // ease
  }
};


export const FAM = {};
const hh = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const fract = (x) => x - Math.floor(x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const backE = (x, c) => { x = clamp(x, 0, 1); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, p) => a + (b - a) * p;
const FONT = (fs, w = 800) => `${w} ${Math.round(fs)}px "PingFang SC","Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif`;
const polyU = (V) => (u) => { const n = V.length, f = fract(u) * n, i = Math.floor(f) % n, a = V[i], b = V[(i + 1) % n], r = f - Math.floor(f); return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]; };
const openU = (V) => (u) => { const n = V.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), r = f - i, a = V[i], b = V[i + 1]; return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]; };
const ngon = (n, alt = 0) => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (TAU * i) / n, r = alt && i % 2 ? alt : 1; return [Math.cos(a) * r, Math.sin(a) * r]; });
const UN = {
  circle: (u) => [Math.cos(TAU * u - Math.PI / 2), Math.sin(TAU * u - Math.PI / 2)],
  star: polyU(ngon(10, 0.45)),
  heart: (u) => { const a = TAU * u, s = Math.sin(a); return [(16 * s * s * s) / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17 - 0.2]; },
  hex: polyU(ngon(6)),
  inf: (u) => { const a = TAU * u, s = Math.sin(a), d = 1 + s * s; return [(Math.cos(a) / d) * 1.15, ((s * Math.cos(a)) / d) * 1.5]; },
  gear: (u) => { const a = TAU * u - Math.PI / 2, r = 0.8 + 0.18 * clamp(Math.cos(a * 9) * 3, -1, 1); return [Math.cos(a) * r, Math.sin(a) * r]; },
  spiral: (u) => { const a = u * TAU * 3.2, r = 0.08 + 0.92 * u; return [Math.cos(a) * r, Math.sin(a) * r]; },
  wave: (u) => [-1 + 2 * u, 0.45 * Math.sin(u * TAU * 2)],
  sig: (u) => [-0.95 + 1.9 * u + 0.12 * Math.cos(u * TAU * 7), 0.28 * Math.sin(u * TAU * 7) + 0.18 * Math.sin(u * TAU * 1.3)],
  mount: openU([[-1, 0.6], [-0.6, -0.2], [-0.35, 0.2], [0, -0.7], [0.3, 0.1], [0.55, -0.3], [1, 0.6]]),
  zig: openU([[-1, 0.3], [-0.66, -0.3], [-0.33, 0.3], [0, -0.3], [0.33, 0.3], [0.66, -0.3], [1, 0.3]]),
};
const OPEN = new Set(['spiral', 'wave', 'sig', 'mount', 'zig']);
const SHN = { circle: '圆形', star: '五角星', heart: '心形', hex: '六边形', inf: '无穷符号', gear: '齿轮', spiral: '螺旋', wave: '波浪', sig: '签名曲线', mount: '山脉', zig: '折线' };
const PC = new Map();
/** sampled SVG-like path: { p: Path2D, L, pts, cum, open } */
function shape(name, cx, cy, R, N = 180) {
  const key = `${name}|${N}|${Math.round(cx)}|${Math.round(cy)}|${Math.round(R)}`; let v = PC.get(key); if (v) return v;
  const open = OPEN.has(name), pts = [];
  for (let i = 0; i < (open ? N + 1 : N); i++) { const [x, y] = UN[name](i / N); pts.push([cx + x * R, cy + y * R]); }
  const p = new Path2D(), cum = [0]; let L = 0;
  pts.forEach(([x, y], i) => { if (i) { L += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]); cum.push(L); p.lineTo(x, y); } else p.moveTo(x, y); });
  if (!open) { L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); cum.push(L); p.closePath(); }
  v = { p, L, pts, cum, open }; if (PC.size > 400) PC.clear(); PC.set(key, v); return v;
}
/** getPointAtLength(f·L) with tangent angle */
function along(s, f) {
  const { pts, cum, L } = s, n = pts.length, tg = (s.open ? clamp(f, 0, 1) : fract(f)) * L;
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= tg) lo = m; else hi = m; }
  const a = pts[lo], b = pts[(lo + 1) % n] || a, seg = Math.max(1e-6, cum[lo + 1] - cum[lo]), r = clamp((tg - cum[lo]) / seg, 0, 1);
  return { x: a[0] + (b[0] - a[0]) * r, y: a[1] + (b[1] - a[1]) * r, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
/** draw visible part [a, b] (fractions of L) — the stroke-dasharray / dashoffset trick */
function dashSeg(ctx, s, a, b) {
  if (b - a <= 0.0005) return;
  ctx.setLineDash([(b - a) * s.L, s.L * 2 + 1]); ctx.lineDashOffset = -a * s.L; ctx.stroke(s.p); ctx.setLineDash([]); ctx.lineDashOffset = 0;
}
const minDist = (P, pts) => { let m = 1e9; for (const [x, y] of pts) { const d = (x - P.x) ** 2 + (y - P.y) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
function grid(n, W, H) {
  const top = 12, h = H - top - 10, cols = clamp(Math.round(Math.sqrt((n * W) / h)), 1, n), rows = Math.ceil(n / cols), cw = W / cols, ch = h / rows, out = [];
  for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols, off = ((cols - inRow) * cw) / 2;
    out.push({ x: off + ((i % cols) + 0.5) * cw, y: top + (r + 0.5) * ch, r: Math.min(cw, ch) * 0.38, i }); }
  return out;
}
const tog = (t, gap, i) => { const cyc = gap * 2, l = (((t + i * 0.3) % cyc) + cyc) % cyc; return smooth(l / 0.35) - smooth((l - gap) / 0.35); };
const inCell = (P, c, k = 1.25) => Math.abs(P.x - c.x) < c.r * k && Math.abs(P.y - c.y) < c.r * k;
const eo = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const bars = (ctx, x, y, w, n, lh, col, seed = 0) => { ctx.fillStyle = col; for (let i = 0; i < n; i++) { rrect(ctx, x, y + i * lh, w * (i === n - 1 ? 0.55 : 0.75 + 0.25 * hh(i, seed)), lh * 0.42, lh * 0.2); ctx.fill(); } };
const spr = (u, damp = 0.5) => (u <= 0 ? 0 : 1 - Math.exp(-u * (3 + 10 * damp)) * Math.cos(u * 16 * (1.1 - damp)));
const win = (u, a, b) => clamp((u - a) / Math.max(1e-6, b - a), 0, 1);
const heartP = (ctx, x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45); ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35); ctx.closePath(); };
const cursorAt = (ctx, x, y, press = 0) => {
  if (press > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * press})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6 + 10 * (1 - press), 0, TAU); ctx.stroke(); }
  ctx.save(); ctx.translate(x, y); ctx.scale(1 - 0.12 * press, 1 - 0.12 * press); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.5, 13); ctx.lineTo(8, 20); ctx.lineTo(10.5, 19); ctx.lineTo(7.2, 12.2); ctx.lineTo(13, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
};
const checkMark = (ctx, x, y, s, f, col, lw) => { if (f <= 0) return; const p = [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.55, y - s * 0.4]], l1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), l2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]), L = (l1 + l2) * f;
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...p[0]); if (L <= l1) ctx.lineTo(p[0][0] + ((p[1][0] - p[0][0]) * L) / l1, p[0][1] + ((p[1][1] - p[0][1]) * L) / l1); else { ctx.lineTo(...p[1]); const r = (L - l1) / l2; ctx.lineTo(p[1][0] + (p[2][0] - p[1][0]) * r, p[1][1] + (p[2][1] - p[1][1]) * r); } ctx.stroke(); };
const MCP = '<p>这里没有用到真实的 DOM 控件：每个微交互都在画布上逐帧画出来。动画按固定周期自动循环播放，并用一个「演示指针」模拟用户的点击、按住或拖动；你在画布上点一下，动画就会从头重新播放一遍。右侧滑条改动后立刻生效，下方信息面板实时显示当前状态。</p>';

/** mFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k, st) returns { mode?, n?, cell? } */
function mFam(d) {
  const ex = d.extra, per = d.period || 3;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动效速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key] ?? ex.value) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key] ?? ex.value)}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>${MCP}`,
      params: [['主色', '强调色，其他颜色由它在色环上偏移得到'], [spec.speed.label, '动画播放的快慢，0 表示停在当前画面'], [spec.size.label, d.sizeDoc || '元素的大小'], [d.count.label, d.countDoc || '元素的数量'], [ex.label, d.extraDoc || '该效果特有的参数']],
      example: (v) => `<ol><li>当前：${v.mode}</li><li>${d.count.label}：${v.n}；指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖动右侧滑条立即看到变化；点击画布重新播放</li></ol>`,
      tip: d.tip || '动画会自动循环；点击画布从头重播，移动指针查看各元素状态。',
    },
    build(S) {
      const st = { now: 0 };
      S.onDown((P) => { st.tc = st.now; st.dx = P.x; st.dy = P.y; st.down = st.now; d.onDown?.(st, P); });
      S.onUp((P) => { st.up = st.now; d.onUp?.(st, P); });
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', tt = t * num(C.speed, 0.9); st.now = tt;
        const user = st.tc != null && tt - st.tc < per && tt >= st.tc, u = user ? (tt - st.tc) / per : fract(tt / per);
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), cx: W / 2, cy: (H + 8) / 2, u, user, tt, per, cyc: Math.floor(tt / per) };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        ctx.fillStyle = hsla(k.hue, 80, 65, 0.7); ctx.fillRect(0, H - 4, (W - 56) * u, 4);
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: r.cell || '指针不在控件上', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const SZ = (label, min, max, value, step = 1) => ({ label, min, max, step, value });

const kf = (u, ts, vs, e) => { let i = 0; while (i < ts.length - 2 && u > ts[i + 1]) i++; const r = win(u, ts[i], ts[i + 1]), m = lerp(r, smooth(r), e); return vs[i] + (vs[i + 1] - vs[i]) * m; };
FAM.lottie = mFam({ title: 'Lottie 关键帧', count: NC('图层数', 2, 8, 4), extra: R('ease', '缓动强度', 0, 1, 0.01, 0.8), size: SZ('图形大小', 20, 100, 60), color: '#22d3ee', period: 4,
  countDoc: '动画里独立运动的图层数量（每层一条轨道）', extraDoc: '关键帧之间的插值方式：0 为匀速直线插值，1 为缓入缓出', sizeDoc: '图形大小（占轨道高度的百分比）',
  presets: { 两层: { count: 2 }, 八层: { count: 8 }, 线性: { ease: 0 }, 缓动: { ease: 1 }, 大图形: { size: 98 } },
  explain: 'Lottie 动画本质上是一份 JSON：里面记录了每个图层在若干「关键帧」时刻的位置、缩放、旋转。播放器在两个关键帧之间做插值，算出每一帧的数值再画出来。下方的时间轴上，菱形是关键帧，竖线是播放头。',
  formula: '值(t) = 值ₐ + (值ᵦ − 值ₐ) · 缓动((t − tₐ) / (tᵦ − tₐ))', formula2: '缓动(r) = (1 − 强度) · r + 强度 · r²(3 − 2r)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, top = 16, tlH = Math.min(H * 0.32, 22 * n + 24), sh = H - tlH - top - 14, lane = sh / n, tlY = H - tlH - 8, u = k.u; let cell = null;
    for (let i = 0; i < n; i++) {
      const ts = [0, 0.25 + 0.04 * i, 0.6 + 0.03 * i, 1], y = top + (i + 0.5) * lane, sz = Math.min(lane * 0.5, W * 0.08) * (k.s / 60), x = kf(u, ts, [0.12, 0.82, 0.5, 0.12], k.x) * (W - 60) + 20, sc = kf(u, ts, [0.6, 1.2, 0.8, 0.6], k.x), rot = kf(u, ts, [0, Math.PI, Math.PI * 1.5, TAU], k.x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.fillStyle = hsla(k.hue + i * 40, 80, 60); const sp = ['circle', 'square', 'tri', 'star'][i % 4];
      ctx.beginPath(); if (sp === 'circle') ctx.arc(0, 0, sz, 0, TAU); else if (sp === 'square') rrect(ctx, -sz, -sz, sz * 2, sz * 2, sz * 0.3); else { const m = sp === 'tri' ? 3 : 5; for (let j = 0; j < m * (sp === 'star' ? 2 : 1); j++) { const a = -Math.PI / 2 + (j * TAU) / (m * (sp === 'star' ? 2 : 1)), rr = sp === 'star' && j % 2 ? sz * 0.45 : sz * 1.1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
      ctx.fill(); ctx.restore();
      const ty = tlY + 16 + i * ((tlH - 20) / n); ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(70, ty - 1, W - 140, 2); text(ctx, `图层 ${i + 1}`, 12, ty, { size: 11, col: '#94a3b8' });
      ts.forEach((q) => { const kx = 70 + q * (W - 140); ctx.fillStyle = Math.abs(u - q) < 0.02 ? '#fff' : hsla(k.hue + i * 40, 70, 60); ctx.save(); ctx.translate(kx, ty); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); });
      if (Math.hypot(P.x - x, P.y - y) < sz * 1.3) cell = `图层 ${i + 1}：x ${Math.round(x)} · 缩放 ${fmt(sc, 2)}`;
    }
    const px = 70 + u * (W - 140); ctx.fillStyle = '#f8fafc'; ctx.fillRect(px - 1, tlY + 4, 2, tlH - 8); text(ctx, `${Math.round(u * k.per * 30)}帧`, px, tlY + 2, { size: 10, col: '#f8fafc', align: 'center' });
    if (P.y > tlY && P.x > 70 && P.x < W - 70) cell = `时间轴 ${Math.round(((P.x - 70) / (W - 140)) * 100)}%`;
    return { mode: `第 ${Math.round(u * k.per * 30)} / ${k.per * 30} 帧 · 缓动 ${fmt(k.x, 2)}`, cell };
  } });

FAM.like = mFam({ title: '点赞与反馈', count: NC('粒子数', 6, 40, 16), extra: R('burst', '爆发半径', 20, 160, 1, 70), size: SZ('爱心大小', 20, 100, 50), color: '#f43f5e', period: 2.6,
  countDoc: '点赞时向外飞散的小粒子数量', extraDoc: '粒子飞出的最远距离（像素）', sizeDoc: '爱心按钮的大小（占画面的百分比）',
  presets: { 少粒子: { count: 6 }, 多粒子: { count: 40 }, 小爆发: { burst: 24 }, 大爆发: { burst: 156 }, 大爱心: { size: 98 } },
  explain: '点赞反馈：点击爱心的一瞬间，爱心先缩小再弹大（弹簧效果），同时一圈小粒子从中心向外飞散并逐渐变淡，旁边的点赞数字向上滚动 +1。几个小动画叠在一起，让一次点击显得有分量。',
  formula: '粒子 i 位置 = 中心 + 半径 · 缓出(e) · (cos θᵢ, sin θᵢ)，θᵢ = 2πi / n', formula2: '爱心缩放 = 0.7 + 0.3 · 弹簧(e)',
  draw(ctx, W, H, t, C, P, k) {
    const u = k.u, e = win(u, 0.15, 0.75), liked = u > 0.15, s = Math.min(W, H - 20) * 0.22 * (k.s / 50), cx = W / 2 - s * 0.6, cy = k.cy, base = 1280 + k.cyc;
    if (liked) for (let i = 0; i < k.n; i++) { const a = (i * TAU) / k.n + hh(i, 2) * 0.3, rr = (s * 0.9 + k.x) * eo(e) * (0.7 + 0.3 * hh(i, 5)); ctx.globalAlpha = 1 - e; ctx.fillStyle = hsla(k.hue + i * 23, 90, 65); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3 + 3 * hh(i, 9), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; const ring = win(u, 0.15, 0.45); if (ring > 0 && ring < 1) { ctx.strokeStyle = hsla(k.hue, 90, 70, 1 - ring); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, s * (0.6 + ring), 0, TAU); ctx.stroke(); }
    const sc = u < 0.15 ? 1 - 0.25 * smooth(win(u, 0.05, 0.15)) : 0.75 + 0.25 * spr(win(u, 0.15, 0.6), 0.35);
    heartP(ctx, cx, cy, s * sc); if (liked) { ctx.fillStyle = hsla(k.hue, 85, 58); ctx.fill(); } else { ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.stroke(); }
    const nx = cx + s * 1.4, roll = eo(win(u, 0.2, 0.45)), fs = clamp(s * 0.5, 14, 48);
    ctx.save(); ctx.beginPath(); ctx.rect(nx, cy - fs, W, fs * 2); ctx.clip(); text(ctx, String(base), nx, cy - roll * fs * 1.2, { size: fs, col: '#94a3b8', bold: true }); text(ctx, String(base + 1), nx, cy + (1 - roll) * fs * 1.2, { size: fs, col: hsla(k.hue, 85, 70), bold: true }); ctx.restore();
    if (!k.user) cursorAt(ctx, cx + 6, cy + 6, u > 0.08 && u < 0.2 ? 1 : 0);
    const over = Math.hypot(P.x - cx, P.y - cy) < s;
    return { mode: `${liked ? '已赞' : '未赞'} · 爆发半径 ${Math.round(k.x)}px · 赞数 ${liked && roll > 0.5 ? base + 1 : base}`, cell: over ? `爱心按钮（${liked ? '已点亮' : '点击点赞'}）` : null };
  } });

const CTL = ['开关', '复选框', '涟漪按钮', '加载按钮', '单选', '星标'];
FAM.controls = mFam({ title: '开关与涟漪', count: NC('控件数', 1, 6, 4), extra: T('ripple', '点击涟漪', true), size: SZ('控件大小', 30, 100, 70), color: '#6366f1', period: 3.2,
  countDoc: '画面中控件的数量（开关、复选框、涟漪按钮、加载按钮……）', extraDoc: '点击时是否从点击处扩散出一圈涟漪', sizeDoc: '控件大小（占格子的百分比）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 无涟漪: { ripple: false }, 大控件: { size: 98 } },
  explain: '开关与涟漪：常见的表单控件在状态变化时都有小动画。开关的圆钮滑到另一侧并给轨道上色；复选框画出对勾；Material 风格按钮从点击点扩散一圈涟漪；加载按钮变成旋转的圆环再变回对勾。每个控件的切换时间错开一点，形成节奏。',
  formula: '开关圆钮 x = 左端 + (右端 − 左端) · 缓动(e)', formula2: '涟漪半径 = 按钮宽 · 缓出(e)，透明度 = 1 − e',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(k.n, W, H - 6); let cell = null, onN = 0;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 70), e = tog(t, k.per / 2, i), ty = CTL[i], pe = fract((t + i * 0.3) / (k.per / 2)), col = hsla(k.hue + i * 30, 80, 60); if (e > 0.5) onN++;
      if (ty === '开关' || ty === '单选') { if (ty === '开关') { const w = s * 1.6, h = s * 0.8; ctx.fillStyle = e > 0 ? hsla(k.hue + i * 30, 70, 20 + 35 * e) : '#334155'; rrect(ctx, c.x - w / 2, c.y - h / 2, w, h, h / 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x - w / 2 + h / 2 + (w - h) * e, c.y, h * 0.4, 0, TAU); ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.45, 0, TAU); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.28 * e, 0, TAU); ctx.fill(); } }
      else if (ty === '复选框' || ty === '星标') { const b = s * 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3; rrect(ctx, c.x - b / 2, c.y - b / 2, b, b, b * 0.2); if (e > 0) { ctx.fillStyle = hsla(k.hue + i * 30, 80, 60, e); ctx.fill(); } ctx.stroke(); if (ty === '复选框') checkMark(ctx, c.x, c.y, b * 0.55, e, '#fff', 3); else { ctx.fillStyle = e > 0.5 ? '#fff' : '#94a3b8'; ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * TAU) / 10, rr = j % 2 ? b * 0.15 : b * 0.34; ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr); } ctx.fill(); } }
      else { const w = s * 2, h = s * 0.8; ctx.save(); rrect(ctx, c.x - w / 2, c.y - h / 2, w, h, h * 0.25); ctx.fillStyle = col; ctx.fill(); ctx.clip();
        if (k.x) { const re = win(pe, 0.02, 0.5); if (re > 0 && re < 1) { ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - re)})`; ctx.beginPath(); ctx.arc(c.x - w * 0.2, c.y, w * eo(re), 0, TAU); ctx.fill(); } }
        ctx.restore(); if (ty === '加载按钮' && pe > 0.05 && pe < 0.4) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, h * 0.25, t * 8, t * 8 + 4); ctx.stroke(); } else if (ty === '加载按钮' && pe >= 0.4) checkMark(ctx, c.x, c.y, h * 0.4, win(pe, 0.4, 0.55), '#fff', 3); else text(ctx, ty === '加载按钮' ? '提交' : '按钮', c.x, c.y, { size: clamp(h * 0.38, 10, 20), col: '#fff', align: 'center', bold: true }); }
      text(ctx, ty, c.x, c.y + s * 0.9, { size: 12, col: '#94a3b8', align: 'center' });
      if (inCell(P, c)) cell = `${ty}：${e > 0.5 ? '开启 / 已选' : '关闭 / 未选'}`;
    });
    return { mode: `已开启 ${onN}/${k.n} · 点击涟漪：${yes(k.x)}`, cell };
  } });

FAM.heart = mFam({ title: '心跳赞', count: NC('心跳次数', 1, 4, 2), extra: R('beat', '放大倍数', 1, 2, 0.01, 1.35), size: SZ('爱心大小', 20, 100, 55), color: '#ec4899', period: 2.4,
  countDoc: '每个周期里爱心跳动的次数', extraDoc: '每次心跳时爱心放大到原来的几倍', sizeDoc: '爱心的大小（占画面的百分比）',
  presets: { 单跳: { count: 1 }, 四连跳: { count: 4 }, 轻跳: { beat: 1.08 }, 猛跳: { beat: 1.95 }, 大爱心: { size: 98 } },
  explain: '心跳赞：已点赞的爱心像心脏一样有节奏地跳动——快速放大再回落，像「扑通」一声。每一次跳动是一个先快后慢的脉冲，爱心外面同时扩散一圈淡淡的光晕，下方的心电图线在跳动时出现尖峰。',
  formula: '缩放 = 1 + (倍数 − 1) · 脉冲(相位)', formula2: '脉冲(p) = sin(π · p)²，p 为每次心跳内的进度',
  draw(ctx, W, H, t, C, P, k) {
    const u = k.u, n = k.n, bw = 0.6 / n, j = Math.floor(u / bw), p = j < n ? fract(u / bw) : 0, pulse = j < n ? Math.sin(Math.PI * p) ** 2 : 0, s = Math.min(W, H - 40) * 0.2 * (k.s / 55), cy = k.cy - (H - 8) * 0.08, sc = 1 + (k.x - 1) * pulse;
    if (j < n && p > 0.2) { const g = win(p, 0.2, 1); ctx.strokeStyle = hsla(k.hue, 90, 70, 0.6 * (1 - g)); ctx.lineWidth = 3; heartP(ctx, W / 2, cy, s * (1 + g * 0.8)); ctx.stroke(); }
    ctx.save(); ctx.shadowColor = hsla(k.hue, 90, 60); ctx.shadowBlur = 20 * pulse; heartP(ctx, W / 2, cy, s * sc); ctx.fillStyle = hsla(k.hue, 85, 55 + 10 * pulse); ctx.fill(); ctx.restore();
    const ey = cy + s * 1.2 + 30, ew = Math.min(W * 0.8, 600), ex0 = (W - ew) / 2; ctx.strokeStyle = hsla(k.hue, 80, 65); ctx.lineWidth = 2; ctx.beginPath();
    for (let q = 0; q <= 120; q++) { const uu = fract(u - 0.5 + q / 120 * 0.5 + 0.5), jj = Math.floor(uu / bw), pp = jj < n ? fract(uu / bw) : 1, spk = jj < n ? Math.sin(TAU * pp) * Math.exp(-((pp - 0.25) ** 2) * 60) : 0; ctx.lineTo(ex0 + (q / 120) * ew, ey - spk * 26); }
    ctx.stroke();
    return { mode: `第 ${Math.min(j, n - 1) + 1}/${n} 跳 · 放大 ${fmt(k.x, 2)} 倍 · 当前 ${fmt(sc, 2)}`, cell: Math.hypot(P.x - W / 2, P.y - cy) < s * sc ? `爱心（缩放 ${fmt(sc, 2)}）` : null };
  } });

FAM.check = mFam({ title: '勾选弹跳', count: NC('勾选框数', 1, 8, 4), extra: R('bounce', '弹跳幅度', 0, 0.6, 0.01, 0.3), size: SZ('框大小', 30, 100, 60), color: '#10b981', period: 3,
  countDoc: '待办清单里勾选框的数量', extraDoc: '勾选瞬间方框放大回弹的幅度；0 为不弹', sizeDoc: '勾选框大小（占格子的百分比）',
  presets: { 单项: { count: 1 }, 八项: { count: 8 }, 不弹: { bounce: 0 }, 大弹: { bounce: 0.58 }, 大框: { size: 98 } },
  explain: '勾选弹跳：点击复选框时，方框先缩小一下、再超过原大小弹回来（弹簧），同时对勾沿着笔画从左到右「画」出来，文字加上删除线变灰。多个框依次勾选，形成待办清单完成的感觉。',
  formula: '框缩放 = 1 + 幅度 · (弹簧(e) − 1) 的反向回弹', formula2: '对勾长度 = 笔画总长 · 缓出(e)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cols = W > 520 && n > 4 ? 2 : 1, rows = Math.ceil(n / cols), rh = (H - 30) / rows, cw = W / cols, b = Math.min(rh * 0.55, 60) * (k.s / 60); let cell = null, done = 0;
    for (let i = 0; i < n; i++) {
      const x = (i % cols) * cw + cw * 0.18, y = 16 + (Math.floor(i / cols) + 0.5) * rh, e = win(k.u, 0.08 + (i * 0.6) / n, 0.08 + (i * 0.6) / n + 0.22), sc = e > 0 ? 1 + k.x * (1 - spr(e, 0.45)) * (e < 0.15 ? -1 : 1) : 1, on2 = e > 0 && k.u < 0.94; if (on2) done++;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); rrect(ctx, -b / 2, -b / 2, b, b, b * 0.22); ctx.fillStyle = on2 ? hsla(k.hue + i * 15, 70, 45) : '#1e293b'; ctx.fill(); ctx.strokeStyle = hsla(k.hue + i * 15, 70, 60); ctx.lineWidth = 2.5; ctx.stroke(); if (on2) checkMark(ctx, 0, 0, b * 0.55, eo(win(e, 0.1, 0.6)), '#fff', Math.max(2, b * 0.1)); ctx.restore();
      const tx = x + b * 0.8 + 10, fs = clamp(b * 0.45, 12, 22); text(ctx, `待办事项 ${i + 1}`, tx, y, { size: fs, col: on2 ? '#64748b' : '#e2e8f0' }); if (on2) { ctx.font = `${fs}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`; ctx.fillStyle = '#64748b'; ctx.fillRect(tx, y, ctx.measureText(`待办事项 ${i + 1}`).width * eo(win(e, 0.3, 0.8)), 2); }
      if (Math.abs(P.y - y) < rh / 2 && P.x > (i % cols) * cw && P.x < (i % cols + 1) * cw) cell = `待办 ${i + 1}：${on2 ? '已完成' : '未完成'}`;
    }
    return { mode: `已完成 ${done}/${n} · 弹跳 ${fmt(k.x, 2)}`, cell };
  } });

FAM.send = mFam({ title: '发送纸飞机', count: NC('尾迹点数', 0, 30, 12), extra: R('arc', '飞行弧度', 0, 1, 0.01, 0.5), size: SZ('按钮大小', 20, 100, 55), color: '#3b82f6', period: 3,
  countDoc: '纸飞机身后留下的尾迹圆点数量', extraDoc: '纸飞机飞出时路径向上拱起的程度；0 为直线飞出', sizeDoc: '发送按钮的大小（占画面的百分比）',
  presets: { 无尾迹: { count: 0 }, 长尾迹: { count: 30 }, 直飞: { arc: 0 }, 高弧: { arc: 1 }, 大按钮: { size: 98 } },
  explain: '发送纸飞机：点击「发送」后，按钮里的纸飞机图标沿一条二次贝塞尔曲线飞出画面并留下尾迹，按钮文字变成「已发送 ✓」，稍后恢复原样。曲线的控制点高度决定飞行弧度。',
  formula: 'B(e) = (1 − e)² · 起点 + 2e(1 − e) · 控制点 + e² · 终点', formula2: '控制点高度 = 弧度 · 0.6 · 画面高',
  draw(ctx, W, H, t, C, P, k) {
    const u = k.u, s = Math.min(W, H) * 0.25 * (k.s / 55), bw = s * 2.2, bh = s * 0.75, bx = W / 2 - bw / 2, by = k.cy + (H - 8) * 0.18 - bh / 2, e = win(u, 0.15, 0.6), sent = u > 0.25 && u < 0.9;
    const p0 = [bx + bh * 0.6, by + bh / 2], p2 = [W + 40, 8 + (H - 8) * 0.12], c1 = [W * 0.45, p0[1] - k.x * (H - 8) * 0.6 - 20], B = (q) => [(1 - q) ** 2 * p0[0] + 2 * q * (1 - q) * c1[0] + q * q * p2[0], (1 - q) ** 2 * p0[1] + 2 * q * (1 - q) * c1[1] + q * q * p2[1]];
    const pr = u > 0.1 && u < 0.17 ? 1 : 0; ctx.save(); ctx.translate(W / 2, by + bh / 2); ctx.scale(1 - 0.05 * pr, 1 - 0.05 * pr); rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = sent ? hsla(k.hue + 100, 65, 42) : hsla(k.hue, 75, 52); ctx.fill(); ctx.restore();
    text(ctx, sent ? '已发送 ✓' : '发送', W / 2 + bh * 0.25, by + bh / 2, { size: clamp(bh * 0.36, 12, 30), col: '#fff', align: 'center', bold: true });
    const plane = (x, y, a, sz) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz, -sz * 0.7); ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz, sz * 0.7); ctx.closePath(); ctx.fill(); ctx.restore(); };
    for (let i = 1; i <= k.n; i++) { const q = e - i * 0.025; if (q <= 0 || e >= 1) continue; const [x, y] = B(q); ctx.fillStyle = hsla(k.hue + i * 6, 80, 70, 0.8 * (1 - i / (k.n + 1))); ctx.beginPath(); ctx.arc(x, y, 3 * (1 - i / (k.n + 2)) + 1, 0, TAU); ctx.fill(); }
    if (e <= 0) plane(...p0, 0, bh * 0.2); else if (e < 1) { const [x, y] = B(e), [x2, y2] = B(Math.min(1, e + 0.01)); plane(x, y, Math.atan2(y2 - y, x2 - x), bh * 0.22 * (1 + e * 0.4)); } else if (u > 0.85) { ctx.globalAlpha = win(u, 0.85, 0.95); plane(...p0, 0, bh * 0.2); ctx.globalAlpha = 1; }
    if (!k.user) cursorAt(ctx, W / 2 + 10, by + bh / 2 + 6, pr);
    const over = P.x > bx && P.x < bx + bw && P.y > by && P.y < by + bh;
    return { mode: `${sent ? '已发送' : e > 0 ? '飞行中' : '待发送'} · 弧度 ${fmt(k.x, 2)} · 尾迹 ${k.n} 点`, cell: over ? `发送按钮（${sent ? '已发送' : '可点击'}）` : null };
  } });

const CODE = ['npm install clyune', "import { copy } from 'clyune'", 'await copy(text)', "toast('已复制')", 'const ok = true', 'export default ok', '// 复制到剪贴板', 'console.log(ok)'];
FAM.copy = mFam({ title: '复制成功', count: NC('代码行数', 1, 8, 3), extra: R('stay', 'Toast 停留', 0.2, 2, 0.05, 1), size: SZ('代码字号', 11, 28, 16), color: '#a855f7', period: 3.6,
  countDoc: '代码块里的行数', extraDoc: '「已复制」提示停留多少秒后淡出', sizeDoc: '代码文字的字号',
  presets: { 一行: { count: 1 }, 八行: { count: 8 }, 闪现: { stay: 0.25 }, 久留: { stay: 1.95 }, 大字: { size: 27 } },
  explain: '复制成功：点击代码块右上角的复制按钮，代码会被高亮扫过一次（表示已选中），按钮图标从「两张纸」变成「对勾」，底部弹出「已复制到剪贴板」的提示，停留一段时间后淡出，按钮再恢复原样。',
  formula: '提示透明度 = 进入(0.25 秒) · (1 − 退出(停留时间之后 0.3 秒))', formula2: '实际代码：navigator.clipboard.writeText(text)',
  draw(ctx, W, H, t, C, P, k) {
    const ts = k.u * k.per, fs = k.s, lh = fs * 1.7, bw = Math.min(W * 0.86, 640), bh = k.n * lh + 40, bx = (W - bw) / 2, by = k.cy - bh / 2 - 20, clk = 0.5, done = ts > clk && ts < clk + k.x + 0.8;
    ctx.fillStyle = '#0f172a'; rrect(ctx, bx, by, bw, bh, 12); ctx.fill(); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1; ctx.stroke();
    const sw = win(ts, clk, clk + 0.35); if (sw > 0 && sw < 1) { ctx.fillStyle = hsla(k.hue, 80, 60, 0.18); ctx.fillRect(bx + 8, by + 20, (bw - 16) * eo(sw), k.n * lh); }
    for (let i = 0; i < k.n; i++) { ctx.font = `${fs}px ui-monospace,Menlo,monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = i % 2 ? '#e2e8f0' : hsla(k.hue + 30, 70, 75); ctx.fillText(CODE[i], bx + 18, by + 20 + (i + 0.5) * lh); }
    const ib = 30, ix = bx + bw - ib - 10, iy = by + 8; ctx.fillStyle = done ? hsla(k.hue + 100, 60, 40) : '#1e293b'; rrect(ctx, ix, iy, ib, ib, 7); ctx.fill();
    if (done) checkMark(ctx, ix + ib / 2, iy + ib / 2, 12, eo(win(ts, clk, clk + 0.3)), '#fff', 2.5); else { ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.6; ctx.strokeRect(ix + 8, iy + 10, 10, 12); ctx.strokeRect(ix + 12, iy + 6, 10, 12); }
    const ta = smooth(win(ts, clk, clk + 0.25)) * (1 - smooth(win(ts, clk + 0.25 + k.x, clk + 0.55 + k.x))); if (ta > 0) { const tw = 170, tx = W / 2 - tw / 2, ty = by + bh + 16 + (1 - ta) * 14; ctx.globalAlpha = ta; ctx.fillStyle = 'rgba(15,23,42,.95)'; rrect(ctx, tx, ty, tw, 36, 18); ctx.fill(); ctx.strokeStyle = hsla(k.hue, 80, 65); ctx.stroke(); text(ctx, '✓ 已复制到剪贴板', W / 2, ty + 18, { size: 13, col: '#f8fafc', align: 'center', bold: true }); ctx.globalAlpha = 1; }
    if (!k.user) cursorAt(ctx, ix + ib / 2, iy + ib / 2, ts > clk - 0.1 && ts < clk + 0.1 ? 1 : 0);
    const cell = P.x > ix && P.x < ix + ib && P.y > iy && P.y < iy + ib ? '复制按钮' : P.x > bx && P.x < bx + bw && P.y > by && P.y < by + bh ? `代码第 ${clamp(Math.floor((P.y - by - 20) / lh) + 1, 1, k.n)} 行` : null;
    return { mode: `${done ? '已复制' : '待复制'} · 提示停留 ${fmt(k.x, 2)} 秒`, cell };
  } });

const FILES = ['设计稿.fig', '报告.pdf', '照片.zip', '视频.mp4', '音乐.flac'];
FAM.download = mFam({ title: '下载进度', count: NC('文件数', 1, 5, 3), extra: R('jitter', '网速波动', 0, 1, 0.01, 0.4), size: SZ('进度条粗细', 2, 24, 8), color: '#0ea5e9', period: 4,
  countDoc: '同时下载的文件数量', extraDoc: '下载速度忽快忽慢的程度；0 为匀速', sizeDoc: '进度条的高度（像素）',
  presets: { 单文件: { count: 1 }, 五文件: { count: 5 }, 匀速: { jitter: 0 }, 波动大: { jitter: 1 }, 粗条: { size: 22 } },
  explain: '下载进度：每个文件一条进度条，进度从 0% 增长到 100%。真实网络的速度会波动，所以进度不是匀速前进：这里在匀速进度上叠加一个随机起伏（但保证只增不减）。完成后进度条变成对勾，并显示「已完成」。',
  formula: '进度 = 基础进度 + 波动 · 0.12 · sin(9 · 基础进度 + 文件序号)（保持单调）', formula2: '剩余时间 ≈ 剩余大小 / 当前速度',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, rh = Math.min((H - 30) / n, 110), bw = Math.min(W * 0.84, 640), x0 = (W - bw) / 2, y0 = k.cy - (n * rh) / 2; let cell = null, fin = 0;
    for (let i = 0; i < n; i++) {
      const b = win(k.u, 0.05 + i * 0.06, 0.75 + i * 0.04), p = clamp(b + k.x * 0.12 * Math.sin(9 * b + i * 2) * Math.sin(Math.PI * b), 0, 1), y = y0 + i * rh + rh * 0.35, ok = p >= 0.999; if (ok) fin++;
      ctx.fillStyle = hsla(k.hue + i * 35, 70, 55); rrect(ctx, x0, y - 16, 28, 32, 5); ctx.fill(); text(ctx, FILES[i].split('.')[1].toUpperCase(), x0 + 14, y, { size: 8, col: '#fff', align: 'center', bold: true });
      text(ctx, FILES[i], x0 + 40, y - 8, { size: 14, col: '#e2e8f0', bold: true }); text(ctx, ok ? '已完成 ✓' : `${Math.round(p * 100)}% · ${fmt(p * (12 + i * 30), 1)} / ${12 + i * 30} MB`, x0 + bw, y - 8, { size: 12, col: ok ? hsla(k.hue + 100, 70, 65) : '#94a3b8', align: 'right' });
      const by = y + 10; ctx.fillStyle = '#1e293b'; rrect(ctx, x0 + 40, by, bw - 40, k.s, k.s / 2); ctx.fill(); if (p > 0) { const g = ctx.createLinearGradient(x0 + 40, 0, x0 + bw, 0); g.addColorStop(0, hsla(k.hue + i * 35, 80, 55)); g.addColorStop(1, hsla(k.hue + i * 35 + 40, 80, 65)); ctx.fillStyle = ok ? hsla(k.hue + 100, 65, 50) : g; rrect(ctx, x0 + 40, by, Math.max(k.s, (bw - 40) * p), k.s, k.s / 2); ctx.fill(); }
      if (Math.abs(P.y - y) < rh / 2 && P.x > x0 && P.x < x0 + bw) cell = `${FILES[i]}：${Math.round(p * 100)}%`;
    }
    return { mode: `已完成 ${fin}/${n} · 网速波动 ${fmt(k.x, 2)}`, cell };
  } });

FAM.skeleton = mFam({ title: '骨架屏', count: NC('行数', 2, 10, 4), extra: R('band', '闪光宽度', 0.1, 0.6, 0.01, 0.3), size: SZ('头像大小', 16, 80, 40), color: '#64748b', period: 3.4,
  countDoc: '列表里骨架占位的条数', extraDoc: '扫过骨架的高光带宽度（占屏幕宽的比例）', sizeDoc: '左侧圆形头像占位的直径',
  presets: { 两行: { count: 2 }, 十行: { count: 10 }, 窄光: { band: 0.1 }, 宽光: { band: 0.6 }, 大头像: { size: 78 } },
  explain: '骨架屏：数据还在加载时，先用灰色的圆和长条画出页面的大致轮廓，再让一道高光从左往右扫过，告诉用户「正在加载」。加载完成后骨架淡出，真实内容淡入，避免页面突然跳变。',
  formula: '高光中心 x = (相位 · 1.6 − 0.3) · 宽', formula2: '高光 = 线性渐变：透明 → 白 → 透明，宽度 = 闪光宽度 · 屏宽',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, rh = Math.max(k.s + 14, (H - 24) / n), bw = Math.min(W * 0.86, 680), x0 = (W - bw) / 2, rv = smooth(win(k.u, 0.72, 0.82)) * (1 - smooth(win(k.u, 0.95, 1))), sx = (fract(k.u * 2.2) * 1.6 - 0.3) * W, bd = k.x * W; let cell = null;
    for (let i = 0; i < n; i++) {
      const y = 12 + i * rh + rh / 2; if (y > H + rh) break; const ax = x0 + k.s / 2, tx = x0 + k.s + 14, tw = bw - k.s - 14;
      const shape = (fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(ax, y, k.s / 2, 0, TAU); ctx.fill(); rrect(ctx, tx, y - 12, tw * (0.5 + 0.2 * hh(i, 3)), 10, 5); ctx.fill(); rrect(ctx, tx, y + 4, tw * (0.75 + 0.2 * hh(i, 7)), 8, 4); ctx.fill(); };
      ctx.globalAlpha = 1 - rv; shape(hsla(k.hue, 15, 22)); const g = ctx.createLinearGradient(sx - bd / 2, 0, sx + bd / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); shape(g);
      ctx.globalAlpha = rv; ctx.fillStyle = hsla(k.hue + i * 40, 70, 55); ctx.beginPath(); ctx.arc(ax, y, k.s / 2, 0, TAU); ctx.fill(); text(ctx, `用户 ${i + 1}`, tx, y - 7, { size: 13, col: '#f1f5f9', bold: true }); text(ctx, '这是一条加载完成后的真实内容', tx, y + 9, { size: 12, col: '#94a3b8' }); ctx.globalAlpha = 1;
      if (Math.abs(P.y - y) < rh / 2 && P.x > x0 && P.x < x0 + bw) cell = `第 ${i + 1} 行：${rv > 0.5 ? '真实内容' : '骨架占位'}`;
    }
    return { mode: `${rv > 0.5 ? '已加载' : '加载中'} · 闪光宽度 ${fmt(k.x, 2)}`, cell };
  } });

const TMSG = [['成功', '保存成功', 140], ['信息', '有 3 条新消息', 210], ['警告', '网络不太稳定', 40], ['错误', '上传失败，请重试', 0], ['成功', '已加入收藏', 160]];
FAM.toast = mFam({ title: 'Toast 提示', count: NC('提示条数', 1, 5, 3), extra: R('stay', '停留时长', 0.5, 3, 0.05, 1.4), size: SZ('提示宽度', 30, 100, 60), color: '#22c55e', period: 4.5,
  countDoc: '一个周期里依次弹出的提示数量（会向上堆叠）', extraDoc: '每条提示停留多少秒后滑出', sizeDoc: '提示条宽度（占画面宽的百分比）',
  presets: { 单条: { count: 1 }, 五条: { count: 5 }, 短停: { stay: 0.5 }, 长停: { stay: 2.9 }, 宽条: { size: 98 } },
  explain: 'Toast 提示：操作后在屏幕底部弹出一条短提示，几秒后自动消失，不打断用户。多条提示同时存在时，新的出现在最下面，旧的被平滑地推上去；每条右侧的细线是剩余停留时间的倒计时。',
  formula: '第 i 条：出现时刻 tᵢ = 0.35 · i 秒，消失时刻 = tᵢ + 停留时长', formula2: '堆叠 y = 底部 − (之后仍在显示的条数) · 条高',
  draw(ctx, W, H, t, C, P, k) {
    const ts = k.u * k.per, n = k.n, tw = Math.max(160, (W * k.s) / 100 - 20), th = 44, x0 = (W - tw) / 2, alive = []; let cell = null;
    for (let i = 0; i < n; i++) { const a = 0.3 + i * 0.35, inn = smooth(win(ts, a, a + 0.25)), out = smooth(win(ts, a + k.x, a + k.x + 0.3)), v = inn * (1 - out); alive.push({ i, v, a, inn, out }); }
    text(ctx, '页面内容', W / 2, 8 + (H - 8) * 0.2, { size: 16, col: '#334155', align: 'center', bold: true });
    let stack = 0;
    for (let q = n - 1; q >= 0; q--) { const o = alive[q]; if (o.v <= 0) { continue; } const y = H - 24 - th - stack * (th + 8) + (1 - o.inn) * 30; stack += o.v; const [ty, msg, hu] = TMSG[o.i];
      ctx.globalAlpha = o.v; ctx.fillStyle = 'rgba(15,23,42,.96)'; rrect(ctx, x0, y, tw, th, 10); ctx.fill(); ctx.fillStyle = hsla(k.hue + hu, 75, 55); rrect(ctx, x0, y, 5, th, 2); ctx.fill();
      text(ctx, ty, x0 + 18, y + th / 2, { size: 12, col: hsla(k.hue + hu, 80, 70), bold: true }); text(ctx, msg, x0 + 56, y + th / 2, { size: 13, col: '#f1f5f9' }); ctx.fillStyle = hsla(k.hue + hu, 70, 60, 0.6); ctx.fillRect(x0 + 8, y + th - 3, (tw - 16) * clamp(1 - (ts - o.a) / k.x, 0, 1), 2); ctx.globalAlpha = 1;
      if (P.x > x0 && P.x < x0 + tw && P.y > y && P.y < y + th) cell = `「${msg}」剩余 ${fmt(Math.max(0, o.a + k.x - ts), 1)} 秒`; }
    return { mode: `显示中 ${alive.filter((o) => o.v > 0.5).length} 条 · 停留 ${fmt(k.x, 2)} 秒`, cell };
  } });

const ICN = ['铃铛', '邮件', '聊天'];
FAM.badge = mFam({ title: '徽章跳动', count: NC('未读数', 1, 120, 8), extra: R('bounce', '弹跳幅度', 0, 1, 0.01, 0.5), size: SZ('图标大小', 20, 100, 55), color: '#ef4444', period: 2.8,
  countDoc: '第一个图标的未读数（超过 99 显示 99+）', extraDoc: '新消息到达时徽章弹起的高度', sizeDoc: '图标的大小（占格子的百分比）',
  presets: { 一条: { count: 1 }, 很多: { count: 120 }, 不弹: { bounce: 0 }, 大弹: { bounce: 1 }, 大图标: { size: 98 } },
  explain: '徽章跳动：图标右上角的红色小圆显示未读数量。新消息到来时，数字加一，徽章先弹起再回落（弹簧），图标也轻轻摇一下以吸引注意。数量太大时显示「99+」，徽章宽度随数字位数变宽。',
  formula: '徽章位移 y = −幅度 · 16 · |sin(π · 弹簧进度)| · 衰减', formula2: '显示文字 = 数量 > 99 ? "99+" : 数量',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(3, W, H - 6); let cell = null;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 55), ph = fract(k.u + i * 0.25), e = win(ph, 0.1, 0.7), base = Math.max(1, Math.round(k.n / (i + 1))), cnt = base + (ph > 0.1 ? 1 : 0), lab = cnt > 99 ? '99+' : String(cnt), wob = Math.sin(e * 25) * (1 - e) * 0.25 * (e > 0 ? 1 : 0);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(wob); ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = Math.max(2, s * 0.08);
      if (i === 0) { ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.3); ctx.quadraticCurveTo(-s * 0.4, -s * 0.5, 0, -s * 0.5); ctx.quadraticCurveTo(s * 0.4, -s * 0.5, s * 0.45, s * 0.3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, s * 0.38, s * 0.1, 0, TAU); ctx.fill(); }
      else if (i === 1) { ctx.strokeRect(-s * 0.5, -s * 0.33, s, s * 0.66); ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.33); ctx.lineTo(0, s * 0.08); ctx.lineTo(s * 0.5, -s * 0.33); ctx.stroke(); }
      else { rrect(ctx, -s * 0.5, -s * 0.4, s, s * 0.65, s * 0.15); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.24); ctx.lineTo(-s * 0.35, s * 0.5); ctx.lineTo(0, s * 0.24); ctx.fill(); }
      ctx.restore();
      const by = c.y - s * 0.45 - k.x * s * 0.35 * Math.abs(Math.sin(Math.PI * e * 3)) * (1 - e), bh = Math.max(16, s * 0.42), fs = bh * 0.62; ctx.font = `600 ${fs}px ui-sans-serif,system-ui,sans-serif`; const bw = Math.max(bh, ctx.measureText(lab).width + bh * 0.5), bx = c.x + s * 0.4;
      ctx.fillStyle = hsla(k.hue + i * 10, 85, 55); rrect(ctx, bx - bw / 2, by - bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.strokeStyle = '#060a14'; ctx.lineWidth = 2; ctx.stroke(); text(ctx, lab, bx, by + 1, { size: fs, col: '#fff', align: 'center', bold: true });
      text(ctx, ICN[i], c.x, c.y + s * 0.8, { size: 12, col: '#94a3b8', align: 'center' }); if (inCell(P, c)) cell = `${ICN[i]}：${cnt} 条未读`;
    });
    return { mode: `未读 ${k.n > 99 ? '99+' : k.n} · 弹跳 ${fmt(k.x, 2)}`, cell };
  } });

FAM.drag = mFam({ title: '拖动卡片', count: NC('卡片数', 1, 6, 3), extra: R('spring', '回弹强度', 0, 1, 0.01, 0.6), size: SZ('卡片大小', 30, 100, 65), color: '#f59e0b', period: 3.2,
  countDoc: '可拖动的卡片数量', extraDoc: '松手后卡片弹回原位的力度：越大回得越快越干脆，越小越慢越晃', sizeDoc: '卡片大小（占格子的百分比）',
  presets: { 单卡: { count: 1 }, 六卡: { count: 6 }, 软弹: { spring: 0.05 }, 硬弹: { spring: 1 }, 大卡: { size: 98 } },
  explain: '拖动卡片：按住卡片可以拖着走，卡片会稍微放大、加深阴影并跟随拖动方向倾斜；松手后，卡片像被弹簧拉着一样弹回原来的位置。按住画布上任意一张卡片试试。',
  formula: '倾斜角 = 水平速度 · 0.0015（限制在 ±0.3 弧度）', formula2: '回弹位移 = 松手位移 · (1 − 弹簧(t, 强度))',
  onDown(st, P) { st.grab = st.hit ?? null; st.gx = P.x; st.gy = P.y; },
  onUp(st) { if (st.grab != null) { st.rel = { i: st.grab, t: st.now, dx: st.ldx, dy: st.ldy }; } st.grab = null; },
  draw(ctx, W, H, t, C, P, k, st) {
    const cells = grid(k.n, W, H - 6); let cell = null; st.hit = null;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 65), w = s * 1.5, h = s * 1.1; let dx = 0, dy = 0, lift = 0, tilt = 0;
      if (st.grab === i && P.down) { dx = P.x - st.gx; dy = P.y - st.gy; lift = 1; tilt = clamp(P.vx * 0.0015, -0.3, 0.3); st.ldx = dx; st.ldy = dy; }
      else if (st.rel && st.rel.i === i && st.now - st.rel.t < 2.5) { const f = 1 - spr((st.now - st.rel.t) * (0.6 + k.x), k.x); dx = st.rel.dx * f; dy = st.rel.dy * f; lift = clamp(Math.abs(f), 0, 1); }
      else if (!k.user || st.grab == null) { const ph = fract(k.u + i * 0.21), g = win(ph, 0.1, 0.45), r2 = ph > 0.45 ? 1 - spr((ph - 0.45) * k.per * (0.6 + k.x), k.x) : 1, a = i * 1.3 + 0.6, amp = c.r * 0.9 * smooth(g) * r2; dx = Math.cos(a) * amp; dy = Math.sin(a) * amp * 0.6; lift = ph > 0.1 && ph < 0.45 ? 1 : clamp(r2, 0, 1); tilt = ph > 0.1 && ph < 0.45 ? 0.12 * Math.cos(a) * (1 - g) : 0; if (i === 0 && !k.user) cursorAt(ctx, c.x + dx + 6, c.y + dy + 6, lift > 0.5 ? 1 : 0); }
      ctx.save(); ctx.translate(c.x + dx, c.y + dy); ctx.rotate(tilt); ctx.scale(1 + 0.06 * lift, 1 + 0.06 * lift); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8 + 24 * lift; ctx.shadowOffsetY = 4 + 10 * lift;
      ctx.fillStyle = hsla(k.hue + i * 40, 65, 50); rrect(ctx, -w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.shadowColor = 'transparent'; text(ctx, `卡片 ${i + 1}`, -w / 2 + 14, -h / 2 + 20, { size: clamp(s * 0.22, 11, 18), col: '#fff', bold: true }); bars(ctx, -w / 2 + 14, -h / 2 + 40, w - 28, 2, 18, 'rgba(255,255,255,.35)', i); ctx.restore();
      if (Math.abs(P.x - c.x - dx) < w / 2 && Math.abs(P.y - c.y - dy) < h / 2) { st.hit = i; cell = `卡片 ${i + 1}：偏移 (${Math.round(dx)}, ${Math.round(dy)})`; }
    });
    return { mode: `${st.grab != null ? `正在拖动卡片 ${st.grab + 1}` : '演示拖动'} · 回弹强度 ${fmt(k.x, 2)}`, cell };
  } });

FAM.longpress = mFam({ title: '长按确认', count: NC('按钮数', 1, 4, 2), extra: R('hold', '长按阈值', 0.3, 2, 0.05, 0.9), size: SZ('按钮大小', 30, 100, 60), color: '#f97316', period: 3.4,
  countDoc: '需要长按确认的按钮数量', extraDoc: '需要按住多少秒才算确认；演示指针每次按住 1.4 秒', sizeDoc: '圆形按钮的大小（占格子的百分比）',
  presets: { 单钮: { count: 1 }, 四钮: { count: 4 }, 短阈: { hold: 0.35 }, 长阈: { hold: 1.95 }, 大钮: { size: 98 } },
  explain: '长按确认：危险操作（比如删除）不希望被误点，于是要求按住一段时间。按住时外圈进度环逐渐走满，走满即确认，按钮变成对勾；如果中途松手，进度环会快速退回。阈值大于演示按住的 1.4 秒时，演示会因为「松手太早」而失败。也可以自己在按钮上按住试试。',
  formula: '进度 = min(按住时长 / 阈值, 1)', formula2: '松手后：进度 = 进度ₒ · (1 − 缓出(松手后时长 / 0.3))',
  draw(ctx, W, H, t, C, P, k, st) {
    const cells = grid(k.n, W, H - 6), ts = k.u * k.per, hold = 1.4, act = k.cyc % k.n; let cell = null, okN = 0;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 60) * 0.75; let held = 0, rel = 0;
      if (P.down && st.down != null && Math.hypot(st.dx - c.x, st.dy - c.y) < s) held = st.now - st.down;
      else if (!k.user && i === act) { held = clamp(ts - 0.3, 0, hold); rel = ts > 0.3 + hold ? ts - 0.3 - hold : 0; }
      const p = Math.min(held / k.x, 1), ok = p >= 1, shown = rel > 0 && !ok ? p * (1 - eo(rel / 0.3)) : p; if (ok) okN++;
      ctx.fillStyle = ok ? hsla(k.hue + 110, 60, 40) : hsla(k.hue + i * 30, 70, 45 - 8 * (held > 0 && !rel ? 1 : 0)); ctx.beginPath(); ctx.arc(c.x, c.y, s * (1 - 0.06 * (held > 0 && !rel ? 1 : 0)), 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(3, s * 0.1); ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.beginPath(); ctx.arc(c.x, c.y, s + 8, 0, TAU); ctx.stroke(); ctx.strokeStyle = ok ? hsla(k.hue + 110, 70, 60) : hsla(k.hue, 90, 62); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(c.x, c.y, s + 8, -Math.PI / 2, -Math.PI / 2 + TAU * shown); ctx.stroke();
      if (ok) checkMark(ctx, c.x, c.y, s * 0.6, 1, '#fff', Math.max(3, s * 0.1)); else text(ctx, held > 0 && !rel ? `${fmt(held, 1)}s` : rel > 0 ? '松手太早' : '长按删除', c.x, c.y, { size: clamp(s * 0.28, 11, 22), col: '#fff', align: 'center', bold: true });
      if (!k.user && i === act) cursorAt(ctx, c.x + 4, c.y + 4, held > 0 && !rel ? 1 : 0);
      if (Math.hypot(P.x - c.x, P.y - c.y) < s + 10) cell = `按钮 ${i + 1}：进度 ${Math.round(shown * 100)}%`;
    });
    return { mode: `阈值 ${fmt(k.x, 2)} 秒 · ${okN ? '已确认' : '未确认'}`, cell };
  } });

FAM.shake = mFam({ title: '摇一摇提示', count: NC('抖动次数', 2, 12, 5), extra: R('amp', '抖动幅度', 2, 30, 0.5, 12), size: SZ('输入框大小', 30, 100, 65), color: '#ef4444', period: 2.8,
  countDoc: '输入错误时输入框左右晃动的来回次数', extraDoc: '晃动的最大距离（像素）', sizeDoc: '输入框的宽度（占画面的百分比）',
  presets: { 两下: { count: 2 }, 十二下: { count: 12 }, 轻晃: { amp: 3 }, 猛晃: { amp: 29 }, 宽框: { size: 98 } },
  explain: '摇一摇提示：密码输错时，输入框会像摇头一样左右快速晃几下并变红，同时下方出现错误提示。晃动用一个衰减的正弦波实现：来回 n 次，幅度逐渐变小直到停下。',
  formula: '位移 x = 幅度 · sin(2π · n · e) · (1 − e)', formula2: 'e = 晃动进度（0 → 1，持续 0.5 秒）',
  draw(ctx, W, H, t, C, P, k) {
    const ts = k.u * k.per, e = win(ts, 0.6, 1.1), shaking = e > 0 && e < 1, dx = shaking ? k.x * Math.sin(TAU * k.n * e) * (1 - e) : 0, err = ts > 0.6 && ts < 2.4, bw = Math.max(180, ((W - 40) * k.s) / 100), bh = 48, bx = (W - bw) / 2 + dx, by = k.cy - bh / 2 - 10;
    text(ctx, '登录', W / 2, by - 40, { size: 20, col: '#e2e8f0', align: 'center', bold: true });
    ctx.fillStyle = '#0f172a'; rrect(ctx, bx, by, bw, bh, 10); ctx.fill(); ctx.strokeStyle = err ? hsla(k.hue, 85, 60) : 'rgba(148,163,184,.4)'; ctx.lineWidth = 2; ctx.stroke();
    const dots = Math.min(8, Math.floor(win(ts, 0, 0.45) * 8)); for (let i = 0; i < dots; i++) { ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(bx + 20 + i * 16, by + bh / 2, 4, 0, TAU); ctx.fill(); }
    if (!dots) text(ctx, '请输入密码', bx + 16, by + bh / 2, { size: 14, col: '#64748b' });
    if (err) { ctx.globalAlpha = smooth(win(ts, 0.6, 0.8)) * (1 - smooth(win(ts, 2.2, 2.4))); text(ctx, '⚠ 密码错误，请重试', bx, by + bh + 20, { size: 13, col: hsla(k.hue, 85, 68) }); ctx.globalAlpha = 1; }
    ctx.fillStyle = hsla(k.hue + 200, 70, 50); rrect(ctx, (W - bw) / 2, by + bh + 40, bw, 42, 10); ctx.fill(); text(ctx, '登 录', W / 2, by + bh + 61, { size: 15, col: '#fff', align: 'center', bold: true });
    const gy = H - 50, gw = Math.min(W * 0.6, 360), gx = (W - gw) / 2; ctx.strokeStyle = hsla(k.hue, 70, 60, 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); for (let q = 0; q <= 100; q++) { const ee = q / 100; ctx.lineTo(gx + ee * gw, gy - k.x * Math.sin(TAU * k.n * ee) * (1 - ee)); } ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + e * gw, gy - dx, 3, 0, TAU); ctx.fill();
    return { mode: `${shaking ? '晃动中' : err ? '显示错误' : '输入中'} · 幅度 ${fmt(k.x, 1)}px · 位移 ${fmt(dx, 1)}`, cell: P.x > bx && P.x < bx + bw && P.y > by && P.y < by + bh ? `密码框（位移 ${fmt(dx, 1)}px）` : null };
  } });

const pieceP = (ctx, x, y, s, tabs) => { const r = s * 0.16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.4, y); if (tabs > 0) ctx.arc(x + s * 0.5, y, r, Math.PI, 0, false); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s * 0.4); if (tabs > 1) ctx.arc(x + s, y + s * 0.5, r, -Math.PI / 2, Math.PI / 2, false); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s * 0.6, y + s); if (tabs > 2) ctx.arc(x + s * 0.5, y + s, r, 0, Math.PI, false); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s * 0.6); if (tabs > 3) ctx.arc(x, y + s * 0.5, r, Math.PI / 2, -Math.PI / 2, true); ctx.closePath(); };
FAM['slide-verify'] = mFam({ title: '滑动验证', count: NC('拼图凸起', 1, 4, 2), extra: R('tol', '容差', 2, 30, 0.5, 8), size: SZ('拼图大小', 28, 80, 48), color: '#14b8a6', period: 3.6,
  countDoc: '拼图块边上的凸起数量（只影响形状）', extraDoc: '拼图与缺口相差多少像素以内算验证成功', sizeDoc: '拼图块的边长（像素）',
  presets: { 一凸: { count: 1 }, 四凸: { count: 4 }, 严格: { tol: 2 }, 宽松: { tol: 29 }, 大块: { size: 78 } },
  explain: '滑动验证：图片上有一个拼图形状的缺口，用户拖动下方滑块，拼图块跟着横向移动，松手时如果拼图与缺口的距离小于容差，就验证通过（变绿）；否则变红并抖动，滑块弹回起点。演示指针每次会有几像素的随机误差，容差越小越容易失败。',
  formula: '误差 = |拼图 x − 缺口 x|', formula2: '通过 ⇔ 误差 ≤ 容差',
  draw(ctx, W, H, t, C, P, k) {
    const s = k.s, iw = Math.min(W * 0.86, 560), ih = Math.min(H * 0.5, 280), ix = (W - iw) / 2, iy = 8 + Math.max(10, (H - 8 - ih - 70) / 2), gx = ix + iw * (0.55 + 0.25 * hh(k.cyc, 4)), gy = iy + ih * 0.3, err = (hh(k.cyc, 9) - 0.5) * 30, ts = k.u * k.per;
    const g = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); g.addColorStop(0, hsla(k.hue + 180, 50, 35)); g.addColorStop(1, hsla(k.hue + 240, 50, 15)); ctx.fillStyle = g; rrect(ctx, ix, iy, iw, ih, 10); ctx.fill();
    ctx.fillStyle = hsla(k.hue + 40, 80, 70, 0.8); ctx.beginPath(); ctx.arc(ix + iw * 0.2, iy + ih * 0.3, ih * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = hsla(k.hue + 160, 35, 12); ctx.beginPath(); ctx.moveTo(ix, iy + ih); for (let x = 0; x <= iw; x += 10) ctx.lineTo(ix + x, iy + ih * 0.7 - ih * 0.2 * (0.5 + 0.5 * Math.sin(x * 0.02 + 1))); ctx.lineTo(ix + iw, iy + ih); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.55)'; pieceP(ctx, gx, gy, s, k.n); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    const startX = ix + 8, tgt = gx + err, drag = win(ts, 0.3, 1.5), back = win(ts, 2.4, 2.8), pass = Math.abs(err) <= k.x, done = ts > 1.6;
    let px = startX + (tgt - startX) * eo(drag); if (done && !pass) px = tgt + (startX - tgt) * eo(back); const shk = done && !pass && ts < 2.3 ? Math.sin((ts - 1.6) * 50) * 4 * (2.3 - ts) : 0;
    ctx.save(); ctx.translate(shk, 0); ctx.fillStyle = done ? (pass ? hsla(k.hue + 120, 70, 50) : 'hsla(0,80%,55%,1)') : hsla(k.hue, 75, 55); pieceP(ctx, px, gy, s, k.n); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    const ty = iy + ih + 24, th = 40, sw = th; ctx.fillStyle = '#1e293b'; rrect(ctx, ix, ty, iw, th, th / 2); ctx.fill(); ctx.fillStyle = hsla(k.hue, 70, 45, 0.5); rrect(ctx, ix, ty, Math.max(th, px - ix + sw), th, th / 2); ctx.fill();
    text(ctx, done ? (pass ? `✓ 验证通过（误差 ${fmt(Math.abs(err), 1)}px）` : `✗ 验证失败（误差 ${fmt(Math.abs(err), 1)}px）`) : '向右拖动滑块完成拼图', ix + iw / 2, ty + th / 2, { size: 13, col: '#cbd5e1', align: 'center' });
    const kx = clamp(px - 8 + shk, ix, ix + iw - sw); ctx.fillStyle = '#fff'; rrect(ctx, kx, ty, sw, th, th / 2); ctx.fill(); text(ctx, '→', kx + sw / 2, ty + th / 2, { size: 16, col: '#0f172a', align: 'center', bold: true });
    if (!k.user) cursorAt(ctx, kx + sw / 2, ty + th / 2, ts > 0.2 && ts < 1.6 ? 1 : 0);
    return { mode: `容差 ${fmt(k.x, 1)}px · 本次误差 ${fmt(Math.abs(err), 1)}px · ${done ? (pass ? '通过' : '失败') : '拖动中'}`, cell: P.y > ty && P.y < ty + th ? '滑块轨道' : P.y > iy && P.y < iy + ih ? `图片：缺口在 x = ${Math.round(gx - ix)}px` : null };
  } });

FAM.dblzoom = mFam({ title: '双击放大', count: NC('图片数', 1, 6, 2), extra: R('zoom', '放大倍数', 1.2, 4, 0.05, 2.2), size: SZ('图片大小', 30, 100, 80), color: '#8b5cf6', period: 3.6,
  countDoc: '画面中图片的数量', extraDoc: '双击后图片放大到原来的几倍', sizeDoc: '图片大小（占格子的百分比）',
  presets: { 单图: { count: 1 }, 六图: { count: 6 }, 小倍: { zoom: 1.25 }, 大倍: { zoom: 3.9 }, 大图: { size: 100 } },
  explain: '双击放大：在图片上快速点两下，图片会以双击的位置为中心平滑放大（就像手机相册），再双击一次缩回。关键是缩放中心：先把坐标原点移到双击点，缩放后再移回去，这样双击点在放大前后位置不变。',
  formula: '缩放 = 1 + (倍数 − 1) · 弹簧(e)', formula2: 'translate(点) · scale(缩放) · translate(−点)',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(k.n, W, H - 6), ts = k.u * k.per, act = k.cyc % k.n; let cell = null, curZ = 1;
    cells.forEach((c, i) => {
      const w = c.r * 2.4 * (k.s / 80), h = c.r * 1.9 * (k.s / 80), x0 = c.x - w / 2, y0 = c.y - h / 2, fx = x0 + w * (0.3 + 0.4 * hh(k.cyc, i + 2)), fy = y0 + h * (0.35 + 0.3 * hh(k.cyc, i + 5));
      const zi = i === act ? spr(win(ts, 0.7, 1.6), 0.55) * (1 - smooth(win(ts, 2.6, 3.2))) : 0, z = 1 + (k.x - 1) * zi; if (i === act) curZ = z;
      ctx.save(); rrect(ctx, x0, y0, w, h, 10); ctx.clip(); ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, hsla(k.hue + i * 50 + 180, 55, 45)); g.addColorStop(1, hsla(k.hue + i * 50 + 220, 55, 20)); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = hsla(k.hue + i * 50 + 40, 90, 75); ctx.beginPath(); ctx.arc(x0 + w * 0.72, y0 + h * 0.28, h * 0.1, 0, TAU); ctx.fill(); ctx.fillStyle = hsla(k.hue + i * 50 + 120, 40, 14); ctx.beginPath(); ctx.moveTo(x0, y0 + h); ctx.lineTo(x0 + w * 0.3, y0 + h * 0.45); ctx.lineTo(x0 + w * 0.55, y0 + h * 0.75); ctx.lineTo(x0 + w * 0.75, y0 + h * 0.5); ctx.lineTo(x0 + w, y0 + h); ctx.fill();
      for (let q = 0; q < 6; q++) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x0 + w * (0.1 + q * 0.15), y0 + h * 0.85, w * 0.05, h * 0.06); }
      ctx.restore(); ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.lineWidth = 1; rrect(ctx, x0, y0, w, h, 10); ctx.stroke();
      if (i === act) { const tap = (a) => win(ts, a, a + 0.15) > 0 && win(ts, a, a + 0.15) < 1; if (!k.user) cursorAt(ctx, fx, fy, tap(0.3) || tap(0.5) ? 1 : 0); text(ctx, `${fmt(z, 2)}×`, x0 + 10, y0 + 16, { size: 12, col: '#fff', bold: true }); }
      if (P.x > x0 && P.x < x0 + w && P.y > y0 && P.y < y0 + h) cell = `图片 ${i + 1}：缩放 ${fmt(i === act ? z : 1, 2)}×`;
    });
    return { mode: `放大倍数 ${fmt(k.x, 2)} · 当前 ${fmt(curZ, 2)}×`, cell };
  } });

FAM['hover-mag'] = mFam({ title: '悬停磁吸', count: NC('按钮数', 1, 6, 3), extra: R('pull', '磁吸强度', 0, 1, 0.01, 0.45), size: SZ('按钮大小', 30, 100, 60), color: '#06b6d4', period: 4,
  countDoc: '画面中磁吸按钮的数量', extraDoc: '指针靠近时按钮被「吸」向指针的程度；0 为不动', sizeDoc: '按钮大小（占格子的百分比）',
  presets: { 单钮: { count: 1 }, 六钮: { count: 6 }, 弱吸: { pull: 0.1 }, 强吸: { pull: 1 }, 大钮: { size: 98 } },
  explain: '悬停磁吸：指针进入按钮周围的感应范围后，按钮朝指针方向偏移一点，按钮上的文字偏移得更多（产生层次感），离开后弹回原位。偏移量 = 指针与按钮中心的距离 × 磁吸强度，并随距离增大而减弱。移动指针靠近按钮试试。',
  formula: '偏移 = (指针 − 中心) · 强度 · (1 − 距离 / 感应半径)', formula2: '文字偏移 = 按钮偏移 · 1.5',
  draw(ctx, W, H, t, C, P, k, st) {
    const cells = grid(k.n, W, H - 6); st.off = st.off || []; let cell = null, maxD = 0;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 60), w = s * 1.7, h = s * 0.7, R2 = s * 1.8, dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy), f = d < R2 ? k.x * (1 - d / R2) : 0, o = st.off[i] || (st.off[i] = { x: 0, y: 0 });
      o.x += (dx * f * 0.6 - o.x) * 0.2; o.y += (dy * f * 0.6 - o.y) * 0.2; const m = Math.hypot(o.x, o.y); maxD = Math.max(maxD, m);
      ctx.strokeStyle = 'rgba(148,163,184,.12)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(c.x, c.y, R2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(c.x + o.x, c.y + o.y); ctx.shadowColor = hsla(k.hue + i * 30, 90, 60); ctx.shadowBlur = 10 + m; ctx.fillStyle = hsla(k.hue + i * 30, 75, 45 + Math.min(15, m)); rrect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
      text(ctx, '悬停我', o.x * 0.5, o.y * 0.5, { size: clamp(h * 0.36, 11, 24), col: '#fff', align: 'center', bold: true }); ctx.restore();
      if (d < R2) cell = `按钮 ${i + 1}：偏移 ${fmt(m, 1)}px`;
    });
    cursorAt(ctx, P.x, P.y, 0);
    return { mode: `磁吸强度 ${fmt(k.x, 2)} · 最大偏移 ${fmt(maxD, 1)}px`, cell };
  } });

FAM['press-ripple'] = mFam({ title: '按压波纹', count: NC('涟漪数', 1, 6, 3), extra: R('reach', '扩散半径', 0.3, 2, 0.01, 1), size: SZ('按钮大小', 30, 100, 65), color: '#6366f1', period: 3,
  countDoc: '一个周期内连续点击产生的涟漪数量', extraDoc: '涟漪最大半径是按钮宽度的几倍', sizeDoc: '按钮大小（占画面的百分比）',
  presets: { 单波: { count: 1 }, 六连波: { count: 6 }, 小波: { reach: 0.32 }, 大波: { reach: 1.95 }, 大按钮: { size: 98 } },
  explain: '按压波纹（Material Ripple）：点击按钮时，从点击的位置画一个圆，圆的半径迅速变大、颜色逐渐变淡，并被裁剪在按钮的圆角矩形内部。连续点击会叠加多个涟漪，按钮本身在按下时轻微下沉。',
  formula: '半径 = 扩散半径 · 按钮宽 · 缓出(e)', formula2: '透明度 = 0.4 · (1 − e)，e = 涟漪开始后的进度',
  draw(ctx, W, H, t, C, P, k) {
    const s = Math.min(W, H - 8) * 0.24 * (k.s / 65), bw = Math.min(W - 40, s * 2.6), bh = s * 0.9, bx = W / 2 - bw / 2, by = k.cy - bh / 2; let live = 0, press = 0;
    const taps = Array.from({ length: k.n }, (_, i) => ({ a: (i / k.n) * 0.8, x: bx + bw * (0.2 + 0.6 * hh(i, 3)), y: by + bh * (0.25 + 0.5 * hh(i, 8)) }));
    taps.forEach((p) => { if (k.u > p.a && k.u < p.a + 0.06) press = 1; });
    ctx.save(); ctx.translate(0, press * 2); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16 - press * 8; ctx.shadowOffsetY = 6 - press * 4; rrect(ctx, bx, by, bw, bh, 14); ctx.fillStyle = hsla(k.hue, 70, 52); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip();
    taps.forEach((p) => { for (const off of [0, 1]) { const e = (k.u + off - p.a) / 0.5; if (e <= 0 || e >= 1) continue; live++; ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - e)})`; ctx.beginPath(); ctx.arc(p.x, p.y, k.x * bw * eo(e), 0, TAU); ctx.fill(); } });
    ctx.restore(); text(ctx, '按下我', W / 2, by + bh / 2 + press * 2, { size: clamp(bh * 0.3, 12, 32), col: '#fff', align: 'center', bold: true });
    if (!k.user) { const p = taps.reduce((b, q) => (k.u >= q.a ? q : b), taps[taps.length - 1]); cursorAt(ctx, p.x, p.y, press); }
    return { mode: `扩散半径 ${fmt(k.x, 2)} 倍 · 正在扩散 ${live} 个涟漪`, cell: P.x > bx && P.x < bx + bw && P.y > by && P.y < by + bh ? `按钮内 (${Math.round(P.x - bx)}, ${Math.round(P.y - by)})` : null };
  } });

FAM['toggle-spring'] = mFam({ title: '开关弹簧', count: NC('开关数', 1, 6, 4), extra: R('damp', '弹簧阻尼', 0.05, 1, 0.01, 0.35), size: SZ('开关大小', 30, 100, 65), color: '#22c55e', period: 3.2,
  countDoc: '画面中开关的数量', extraDoc: '弹簧的阻尼：越小来回晃得越多，越大越快停稳', sizeDoc: '开关大小（占格子的百分比）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 很弹: { damp: 0.05 }, 稳: { damp: 1 }, 大开关: { size: 98 } },
  explain: '开关弹簧：开关的圆钮不是匀速滑过去，而是像挂在弹簧上一样冲过头一点再弹回来，最后停稳。圆钮在移动时会被横向拉长（「果冻感」），轨道颜色随位置渐变。阻尼决定晃动的次数。',
  formula: '位置 = 起点 + (终点 − 起点) · 弹簧(e)', formula2: '弹簧(e) = 1 − e^(−(3 + 10 · 阻尼) · e) · cos(16 · (1.1 − 阻尼) · e)',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(k.n, W, H - 6); let cell = null, onN = 0;
    cells.forEach((c, i) => {
      const s = c.r * (k.s / 65), w = s * 1.9, h = s * 0.95, ph = fract(k.u + i * 0.13), toOn = ph < 0.5, e = (ph % 0.5) / 0.5, raw = spr(e * 1.6, k.x), pos = toOn ? raw : 1 - raw, vel = Math.abs(spr(e * 1.6 + 0.02, k.x) - raw) * 25; if (pos > 0.5) onN++;
      ctx.fillStyle = `hsl(${k.hue + i * 25}, ${20 + 55 * clamp(pos, 0, 1)}%, ${22 + 25 * clamp(pos, 0, 1)}%)`; rrect(ctx, c.x - w / 2, c.y - h / 2, w, h, h / 2); ctx.fill();
      const kr = h * 0.4, kx = c.x - w / 2 + h / 2 + (w - h) * pos; ctx.save(); ctx.translate(kx, c.y); ctx.scale(1 + clamp(vel, 0, 0.35), 1 - clamp(vel, 0, 0.35) * 0.5); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(0, 0, kr, 0, TAU); ctx.fill(); ctx.restore();
      text(ctx, pos > 0.5 ? '开' : '关', c.x, c.y + h * 0.9, { size: 12, col: '#94a3b8', align: 'center' });
      if (inCell(P, c)) cell = `开关 ${i + 1}：位置 ${fmt(pos, 2)}`;
    });
    return { mode: `阻尼 ${fmt(k.x, 2)} · 开启 ${onN}/${k.n}`, cell };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'heart');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'heart';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-micro',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: [],
    liveKeys: LIVE,
    presets: Object.keys(F0.presets),
    presetDefaults: { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => {
      const S = createCanvasStage(box, o, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: 'crosshair' });
      S.onFrame(F0.build(S));
      return () => S.destroy();
    },
  });
}
