/**
 * kit-scroll — scroll-driven effects on a virtual scrolling page (canvas stage).
 * scrollY auto-scrolls back and forth; every frame is a pure function of (scroll, t, pointer, knobs).
 * LIVE .mip readout; beginner Chinese docs; full-stage fill.
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
const SCP = '<p>画面模拟一个可以滚动的网页：scrollY 表示页面已经向上滚过了多少像素，这里它自动来回滚动（右侧细条就是滚动条）。元素在屏幕上的位置 = 页面位置 − scrollY；元素进入视口的程度通常用 scroll 事件或 IntersectionObserver 算出来，再拿这个 0~1 的进度去驱动透明度、位移、缩放等动画。</p>';
const bars = (ctx, x, y, w, n, lh, col, seed = 0) => { ctx.fillStyle = col; for (let i = 0; i < n; i++) { rrect(ctx, x, y + i * lh, w * (i === n - 1 ? 0.55 : 0.75 + 0.25 * hh(i, seed)), lh * 0.42, lh * 0.2); ctx.fill(); } };
const vis = (sT, sB, top, bot) => sB > top && sT < bot;

/** scFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k, st) returns { mode?, n?, cell?, pageH, sp? } */
function scFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '滚动速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key] ?? ex.value) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key] ?? ex.value)}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>${SCP}`,
      params: [['主色', '强调色，其他颜色由它在色环上偏移得到'], [spec.speed.label, '自动滚动的快慢，0 表示停在当前位置'], [spec.size.label, d.sizeDoc || '元素的大小'], [d.count.label, d.countDoc || '元素的数量'], [ex.label, d.extraDoc || '该效果特有的参数']],
      example: (v) => `<ol><li>当前：${v.mode}</li><li>${d.count.label}：${v.n}；指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖动右侧滑条立即看到变化</li></ol>`,
      tip: d.tip || '页面会自动上下滚动；移动指针查看各元素的状态，右侧滑条实时调整。',
    },
    build(S) {
      const st = {};
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', tt = t * num(C.speed, 0.9), vh = H - 12;
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), cx: W / 2, cy: (H + 8) / 2, vh, sp: 0.5 - 0.5 * Math.cos((TAU * tt) / 14) };
        k.sy = (pageH) => k.sp * Math.max(0, pageH - vh);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        const pageH = r.pageH || vh * 2, trk = H - 22, th = Math.max(18, (trk * vh) / pageH), sp = r.sp ?? k.sp;
        ctx.fillStyle = 'rgba(148,163,184,.12)'; rrect(ctx, W - 7, 12, 4, trk, 2); ctx.fill();
        ctx.fillStyle = hsla(k.hue, 80, 65, 0.85); rrect(ctx, W - 7, 12 + sp * (trk - th), 4, th, 2); ctx.fill();
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: r.cell || '指针不在内容上', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const SZ = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const FONTB = (fs, w = 800) => `${w} ${Math.round(fs)}px "PingFang SC","Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif`;

const ridge = (x, i) => Math.sin(x * 0.004 * (i + 1) + i * 3) * 0.5 + Math.sin(x * 0.011 * (i + 1) + i) * 0.3 + Math.sin(x * 0.023 + i * 5) * 0.2;
FAM.parallax = scFam({ title: '视差层', count: NC('图层数', 2, 7, 4), extra: R('depth', '视差强度', 0, 1.5, 0.05, 0.7), size: SZ('山体高度', 20, 100, 60), color: '#38bdf8',
  countDoc: '远近不同的山脉图层数量', extraDoc: '远处图层比近处慢多少；0 时所有图层一起移动（没有视差）', sizeDoc: '山脉起伏的高度（百分比）',
  presets: { 双层: { count: 2 }, 七层: { count: 7 }, 无视差: { depth: 0 }, 强视差: { depth: 1.5 }, 高山: { size: 100 } },
  explain: '视差层：现实中远处的山看起来移动得慢，近处的树移动得快。网页里把背景分成几层，滚动时让每一层以不同的速度移动（远层速度小、近层速度大），就会产生纵深感。前景文字按正常速度滚动。',
  formula: '图层位移ᵢ = scrollY · 速度ᵢ', formula2: '速度ᵢ = 1 − 强度 · 0.66 · (1 − (i+1)/n)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sy = k.sy(k.vh * 3), sky = ctx.createLinearGradient(0, 8, 0, H); sky.addColorStop(0, hsla(k.hue + 20, 60, 10)); sky.addColorStop(1, hsla(k.hue, 50, 26)); ctx.fillStyle = sky; ctx.fillRect(0, 8, W, H);
    const vOf = (i) => Math.max(0.05, 1 - k.x * 0.66 * (1 - (i + 1) / n)), off = (i) => (0.5 - k.sp) * k.vh * 0.9 * vOf(i);
    ctx.fillStyle = hsla(k.hue + 40, 90, 80, 0.9); ctx.beginPath(); ctx.arc(W * 0.72, 8 + k.vh * 0.25 + off(-1) * 0.2, Math.min(W, H) * 0.07, 0, TAU); ctx.fill();
    let layer = -1;
    for (let i = 0; i < n; i++) {
      const base = 8 + k.vh * (0.42 + (0.45 * (i + 1)) / n) + off(i), amp = ((k.vh * 0.35 * k.s) / 100) * (0.6 + (0.4 * (i + 1)) / n);
      ctx.fillStyle = hsla(k.hue + i * 12, 45, 14 + (i * 40) / n); ctx.beginPath(); ctx.moveTo(0, H + 40);
      for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, base - amp * (0.5 + 0.5 * ridge(x, i))); ctx.lineTo(W, H + 40); ctx.closePath(); ctx.fill();
      if (P.y > base - amp * (0.5 + 0.5 * ridge(P.x, i))) layer = i;
    }
    text(ctx, '向下滚动 · 视差', W / 2, 8 + k.vh * 0.5 + (0.5 - k.sp) * k.vh * 1.1, { size: clamp(W / 14, 18, 54), col: '#f8fafc', align: 'center', bold: true });
    return { mode: `scrollY ${Math.round(sy)}px · 近/远层速度比 ${fmt(vOf(n - 1) / vOf(0), 2)}`, cell: layer >= 0 ? `第 ${layer + 1} 层（速度 ${fmt(vOf(layer), 2)}）` : '指针在天空区域', pageH: k.vh * 3 };
  } });

FAM.progress = scFam({ title: '进度条', count: NC('章节数', 2, 10, 5), extra: T('glow', '发光', true), size: SZ('进度条粗细', 2, 24, 6), color: '#f472b6',
  countDoc: '文章分成几章（进度条上的刻度）', extraDoc: '进度条是否带发光阴影', sizeDoc: '顶部进度条的高度（像素）',
  presets: { 两章: { count: 2 }, 十章: { count: 10 }, 朴素: { glow: false }, 粗条: { size: 22 } },
  explain: '阅读进度条：进度 = 已滚动距离 ÷ 可滚动的总距离。把这个 0~1 的比例乘以屏幕宽度，就是顶部进度条的长度；刻度标出每一章的开始位置，左下角的圆环显示同样的进度。',
  formula: '进度 = scrollY / (页面高度 − 视口高度)', formula2: '进度条宽 = 进度 · 屏幕宽',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sec = k.vh * 0.9, pageH = n * sec + k.vh * 0.5, sy = k.sy(pageH), cw = Math.min(W * 0.8, 640), x0 = (W - cw) / 2; let cur = 0;
    for (let j = 0; j < n; j++) {
      const y = 8 + k.vh * 0.25 + j * sec - sy; if (y - sy > H && y > H) continue; if (y < 8 + k.vh * 0.4) cur = j;
      if (!vis(y, y + sec, 0, H)) continue;
      ctx.fillStyle = hsla(k.hue + j * 30, 70, 60); rrect(ctx, x0, y, cw * 0.5, 22, 6); ctx.fill(); text(ctx, `第 ${j + 1} 章`, x0 + 10, y + 11, { size: 13, col: '#0b1020', bold: true });
      bars(ctx, x0, y + 40, cw, 7, 22, 'rgba(148,163,184,.25)', j);
    }
    const sp = k.sp, bh = k.s; ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(0, 8, W, bh);
    ctx.save(); if (k.x) { ctx.shadowColor = hsla(k.hue, 90, 65); ctx.shadowBlur = 14; } const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, hsla(k.hue, 85, 60)); g.addColorStop(1, hsla(k.hue + 60, 85, 65)); ctx.fillStyle = g; ctx.fillRect(0, 8, W * sp, bh); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let j = 1; j < n; j++) { const f = clamp((k.vh * 0.25 + j * sec - k.vh * 0.4) / (pageH - k.vh), 0, 1); ctx.fillRect(W * f - 1, 8, 2, bh + 4); }
    const rx = 34, ry = H - 34; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.beginPath(); ctx.arc(rx, ry, 18, 0, TAU); ctx.stroke(); ctx.strokeStyle = hsla(k.hue, 85, 62); ctx.beginPath(); ctx.arc(rx, ry, 18, -Math.PI / 2, -Math.PI / 2 + TAU * sp); ctx.stroke();
    text(ctx, `${Math.round(sp * 100)}`, rx, ry, { size: 11, col: '#fff', align: 'center', bold: true });
    return { mode: `已读 ${Math.round(sp * 100)}% · 第 ${cur + 1}/${n} 章 · 发光${yes(k.x)}`, cell: P.y < 8 + bh + 10 ? `进度条上此处 = ${Math.round((P.x / W) * 100)}%` : `指针所在：第 ${clamp(Math.floor((P.y - 8 + sy - k.vh * 0.25) / sec) + 1, 1, n)} 章`, pageH };
  } });

FAM.pin = scFam({ title: '章节钉住', count: NC('钉住章节', 1, 5, 3), extra: R('hold', '钉住时长', 0.3, 2, 0.05, 1), size: SZ('标题字号', 14, 48, 26), color: '#a78bfa',
  countDoc: '页面里带吸顶标题的章节数量', extraDoc: '每个章节的长度（几屏高）；越长标题钉住越久', sizeDoc: '章节标题的字号',
  presets: { 单节: { count: 1 }, 五节: { count: 5 }, 短钉: { hold: 0.35 }, 长钉: { hold: 1.9 }, 大标题: { size: 46 } },
  explain: '章节钉住（position: sticky）：章节标题平时跟着内容滚动，一旦碰到视口顶部，就「粘」在顶部不动；直到这一章的内容全部滚完，标题才被下一章推走。sticky 的范围被限制在它的父元素（这一章）之内。',
  formula: '标题 y = min(max(章节顶 − scrollY, 0), 章节底 − scrollY − 标题高)', formula2: '章节高 = 视口高 · (1 + 钉住时长)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sec = k.vh * (1 + k.x), pageH = n * sec + k.vh * 0.5, sy = k.sy(pageH), hh2 = k.s * 1.8, cw = Math.min(W * 0.86, 680), x0 = (W - cw) / 2; let pinned = -1, cell = null;
    for (let j = 0; j < n; j++) {
      const sT = 8 + 20 + j * sec - sy, sB = sT + sec - 30; if (!vis(sT, sB, 0, H)) continue;
      for (let c = 0; c * 78 < sec - hh2 - 40; c++) { const y = sT + hh2 + 16 + c * 78; if (y < -80 || y > H) continue; ctx.fillStyle = hsla(k.hue + j * 40, 25, 14); rrect(ctx, x0, y, cw, 64, 10); ctx.fill(); bars(ctx, x0 + 16, y + 14, cw - 32, 2, 20, 'rgba(148,163,184,.3)', j * 9 + c); }
      const y = Math.min(Math.max(sT, 8), sB - hh2); if (sT < 8 && sB - hh2 > 8) pinned = j;
      ctx.fillStyle = hsla(k.hue + j * 40, 70, y === 8 ? 52 : 40); rrect(ctx, x0 - 6, y, cw + 12, hh2, 8); ctx.fill();
      text(ctx, `第 ${j + 1} 章 · ${y === 8 ? '已钉住' : '滚动中'}`, x0 + 10, y + hh2 / 2, { size: k.s, col: '#fff', bold: true });
      if (P.y > y && P.y < y + hh2) cell = `第 ${j + 1} 章标题（${y === 8 ? 'sticky 生效' : '正常滚动'}）`;
    }
    return { mode: `钉住时长 ${fmt(k.x, 2)} 屏 · 当前钉住：${pinned >= 0 ? `第 ${pinned + 1} 章` : '无'}`, cell, pageH };
  } });

const cardAt = (ctx, x, y, w, h, hue, seed, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = hsla(hue, 30, 15); rrect(ctx, x, y, w, h, 12); ctx.fill(); const im = Math.min(h - 16, w * 0.3); ctx.fillStyle = hsla(hue, 70, 55); rrect(ctx, x + 8, y + 8, im, h - 16, 8); ctx.fill(); bars(ctx, x + im + 20, y + 14, w - im - 34, Math.max(1, Math.floor((h - 20) / 20)), 20, 'rgba(203,213,225,.35)', seed); ctx.globalAlpha = 1; };
FAM.reveal = scFam({ title: '淡入揭示', count: NC('卡片数', 4, 20, 10), extra: R('dist', '位移距离', 0, 120, 1, 40), size: SZ('卡片高度', 30, 140, 70), color: '#34d399',
  countDoc: '页面中卡片的数量', extraDoc: '卡片出现前向下偏移多少像素，0 为只淡入', sizeDoc: '每张卡片的高度（像素）',
  presets: { 少卡: { count: 4 }, 多卡: { count: 20 }, 纯淡入: { dist: 0 }, 大位移: { dist: 118 }, 高卡: { size: 136 } },
  explain: '淡入揭示：卡片还没进入视口时是透明并且偏下的；当它从底部进入视口，进度 e 从 0 增加到 1，透明度跟着变成 1、位移回到 0，看起来就是「滑上来并浮现」。这正是 IntersectionObserver 最常见的用途。',
  formula: 'e = 缓动((视口底 − 卡片顶) / (0.3 · 视口高))', formula2: '透明度 = e，位移 = (1 − e) · 位移距离',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gy = k.s + 18, pageH = k.vh * 0.9 + n * gy, sy = k.sy(pageH), cw = Math.min(W * 0.82, 560), x0 = (W - cw) / 2; let cnt = 0, cell = null;
    for (let i = 0; i < n; i++) {
      const sT = 8 + k.vh * 0.45 + i * gy - sy; if (!vis(sT, sT + k.s + k.x, 0, H)) continue; const e = smooth((8 + k.vh - sT) / (k.vh * 0.3)); if (e > 0.98) cnt++;
      cardAt(ctx, x0, sT + (1 - e) * k.x, cw, k.s, k.hue + i * 17, i, e);
      if (P.y > sT && P.y < sT + k.s) cell = `第 ${i + 1} 张：显现 ${Math.round(e * 100)}%`;
    }
    return { mode: `可见卡片中已完全揭示 ${cnt} 张 · 位移 ${Math.round(k.x)}px`, cell, pageH };
  } });

FAM['scale-in'] = scFam({ title: '缩放进入', count: NC('卡片数', 3, 16, 8), extra: R('from', '起始缩放', 0.1, 0.95, 0.01, 0.6), size: SZ('卡片高度', 40, 200, 110), color: '#fb923c',
  countDoc: '页面中卡片的数量', extraDoc: '卡片离视口中心最远时的缩放比例', sizeDoc: '每张卡片的高度（像素）',
  presets: { 少卡: { count: 3 }, 多卡: { count: 16 }, 轻缩: { from: 0.9 }, 重缩: { from: 0.15 }, 高卡: { size: 196 } },
  explain: '缩放进入：卡片离视口中心越近就越大越亮，离开中心时又缩小变暗。e 表示卡片中心与视口中心的接近程度（1 = 正好在中心），缩放 = 起始缩放 + (1 − 起始缩放) · e，相当于 transform: scale() 跟着滚动变化。',
  formula: 'e = 缓动(1 − |卡片中心 − 视口中心| / (0.6 · 视口高))', formula2: '缩放 = 起始 + (1 − 起始) · e',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gy = k.s + 24, pageH = k.vh + n * gy, sy = k.sy(pageH), cw = Math.min(W * 0.8, 600), vc = 8 + k.vh / 2; let best = 0, bi = 0, cell = null;
    for (let i = 0; i < n; i++) {
      const sT = 8 + k.vh * 0.5 + i * gy - sy - k.s / 2, cy = sT + k.s / 2; if (!vis(sT, sT + k.s, -k.s, H + k.s)) continue;
      const e = smooth(1 - Math.abs(cy - vc) / (k.vh * 0.6)), sc = k.x + (1 - k.x) * e; if (e > best) { best = e; bi = i; }
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(sc, sc); cardAt(ctx, -cw / 2, -k.s / 2, cw, k.s, k.hue + i * 20, i, 0.3 + 0.7 * e); ctx.restore();
      if (Math.abs(P.y - cy) < (k.s * sc) / 2 && Math.abs(P.x - W / 2) < (cw * sc) / 2) cell = `第 ${i + 1} 张：缩放 ${fmt(sc, 2)}`;
    }
    return { mode: `起始缩放 ${fmt(k.x, 2)} · 第 ${bi + 1} 张最接近中心（${Math.round(best * 100)}%）`, cell, pageH };
  } });

FAM['h-gallery'] = scFam({ title: '横向画廊', count: NC('卡片数', 3, 16, 8), extra: T('snap', '吸附', true), size: SZ('卡片宽度', 20, 90, 45), color: '#22d3ee',
  countDoc: '横向轨道上的卡片数量', extraDoc: '是否让轨道在每张卡片居中处停顿（scroll-snap）', sizeDoc: '卡片宽度占屏幕宽度的百分比',
  presets: { 少卡: { count: 3 }, 多卡: { count: 16 }, 自由: { snap: false }, 宽卡: { size: 88 }, 窄卡: { size: 22 } },
  explain: '横向画廊：页面纵向滚动时，把滚动进度换算成一条横向轨道的位移（translateX），卡片就从右向左移过屏幕。开启吸附后，位移会在每张卡片居中时多停留一会，类似 CSS scroll-snap 的效果；越接近中心的卡片越大。',
  formula: 'translateX = −进度 · (轨道总宽 − 屏幕宽)', formula2: '吸附：f = ⌊f⌋ + 缓动²(f − ⌊f⌋)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cw = (W * k.s) / 100, gap = 16, step = cw + gap, pad = (W - cw) / 2, maxX = (n - 1) * step; let f = k.sp * (n - 1); if (k.x) f = Math.floor(f) + smooth(smooth(fract(f))); const sx = Math.min(f * step, maxX);
    const ch = k.vh * 0.62, y0 = 8 + (k.vh - ch) / 2; let cell = null;
    for (let i = 0; i < n; i++) {
      const x = pad + i * step - sx; if (x > W || x + cw < 0) continue; const e = 1 - Math.min(1, Math.abs(x + cw / 2 - W / 2) / W), sc = 0.86 + 0.14 * e;
      ctx.save(); ctx.translate(x + cw / 2, y0 + ch / 2); ctx.scale(sc, sc); const g = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2); g.addColorStop(0, hsla(k.hue + i * 25, 75, 55)); g.addColorStop(1, hsla(k.hue + i * 25 + 50, 70, 30));
      ctx.fillStyle = g; rrect(ctx, -cw / 2, -ch / 2, cw, ch, 16); ctx.fill(); text(ctx, String(i + 1).padStart(2, '0'), -cw / 2 + 16, -ch / 2 + 30, { size: clamp(cw / 6, 14, 48), col: 'rgba(255,255,255,.9)', bold: true });
      bars(ctx, -cw / 2 + 16, ch / 2 - 60, cw - 32, 2, 22, 'rgba(255,255,255,.4)', i); ctx.restore();
      if (P.x > x && P.x < x + cw && P.y > y0 && P.y < y0 + ch) cell = `第 ${i + 1} 张卡片（距中心 ${Math.round(Math.abs(x + cw / 2 - W / 2))}px）`;
    }
    for (let i = 0; i < n; i++) { ctx.fillStyle = Math.round(sx / step) === i ? hsla(k.hue, 85, 65) : 'rgba(148,163,184,.35)'; ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 14, H - 16, 4, 0, TAU); ctx.fill(); }
    return { mode: `横向位移 ${Math.round(sx)}px · 第 ${Math.round(sx / step) + 1} 张居中 · 吸附${yes(k.x)}`, cell, pageH: k.vh * (1 + n * 0.5) };
  } });

FAM.stack = scFam({ title: '卡片堆叠', count: NC('卡片数', 2, 10, 5), extra: R('gap', '堆叠间距', 0, 40, 1, 12), size: SZ('卡片高度', 30, 90, 60), color: '#f59e0b',
  countDoc: '依次堆叠的卡片数量', extraDoc: '每张卡片钉住时比上一张低多少像素', sizeDoc: '卡片高度占视口的百分比',
  presets: { 两张: { count: 2 }, 十张: { count: 10 }, 紧贴: { gap: 0 }, 松散: { gap: 38 }, 矮卡: { size: 32 } },
  explain: '卡片堆叠：每张卡片都是 position: sticky，钉住的位置一张比一张低一点（top = 基础 + i · 间距）。滚动时后面的卡片滑上来盖住前一张，被盖住的卡片稍微缩小变暗，形成一摞卡片的效果。',
  formula: '卡片 y = max(页面位置 − scrollY, 钉住位置ᵢ)', formula2: '钉住位置ᵢ = 16 + i · 间距；被盖住时缩放 = 1 − 0.05 · 层数',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, ch = (k.vh * k.s) / 100, sec = k.vh * 0.8, pageH = k.vh * 0.2 + n * sec + k.vh * 0.3, sy = k.sy(pageH), cw = Math.min(W * 0.84, 620), x0 = (W - cw) / 2;
    const Y = Array.from({ length: n }, (_, i) => { const stick = 8 + 16 + i * k.x; return { y: Math.max(8 + k.vh * 0.2 + i * sec - sy, stick), stick }; }); let stacked = 0, cell = null;
    for (let i = 0; i < n; i++) {
      let dep = 0; for (let j = i + 1; j < n; j++) dep += clamp(1 - (Y[j].y - Y[j].stick) / ch, 0, 1); if (Y[i].y <= Y[i].stick + 0.5) stacked++;
      if (Y[i].y > H) continue; const sc = 1 - 0.05 * dep;
      ctx.save(); ctx.translate(W / 2, Y[i].y); ctx.scale(sc, sc); ctx.fillStyle = hsla(k.hue + i * 28, 65, 48 - dep * 6); rrect(ctx, -cw / 2, 0, cw, ch, 16); ctx.fill();
      text(ctx, `卡片 ${i + 1}`, -cw / 2 + 18, 26, { size: 18, col: '#fff', bold: true }); bars(ctx, -cw / 2 + 18, 48, cw - 36, Math.max(1, Math.floor((ch - 60) / 22)), 22, 'rgba(255,255,255,.35)', i); ctx.restore();
      if (P.y > Y[i].y && P.y < Y[i].y + ch) cell = `卡片 ${i + 1}（上面盖了 ${fmt(dep, 1)} 层）`;
    }
    return { mode: `已堆叠 ${stacked}/${n} 张 · 间距 ${Math.round(k.x)}px`, cell, pageH };
  } });

const WLN = ['滚动时文字被一点点点亮', '颜色从左到右擦过去', '就像有人在读这一行', 'SCROLL TO REVEAL', '每一行有自己的进度', '进入视口中部时完成', '这是常见的长文效果', '读到哪里亮到哪里'];
FAM['wipe-text'] = scFam({ title: '文字擦除', count: NC('行数', 1, 8, 4), extra: R('band', '擦除过渡', 0, 200, 1, 60), size: SZ('字号', 16, 80, 36), color: '#facc15',
  countDoc: '参与擦除效果的文字行数', extraDoc: '亮与暗之间渐变过渡带的宽度（像素），0 为硬边', sizeDoc: '文字大小（放不下时自动缩小）',
  presets: { 单行: { count: 1 }, 八行: { count: 8 }, 硬边: { band: 0 }, 柔边: { band: 196 }, 大字: { size: 78 } },
  explain: '文字擦除：每一行文字先用暗色画一遍，再用一个从左到右的线性渐变（亮色 → 透明）覆盖。渐变的位置由这一行的滚动进度 e 决定：行刚从底部进入时 e = 0，到达视口中上部时 e = 1，于是亮色像刷子一样从左向右擦过文字。',
  formula: 'eᵢ = clamp((0.85 · 视口高 − 行的屏幕 y) / (0.5 · 视口高))', formula2: '亮区右边界 = 行左端 + eᵢ · (行宽 + 过渡带)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, lh = k.s * 2.2, pageH = k.vh * 1.3 + n * lh, sy = k.sy(pageH); let e0 = 0, cell = null;
    for (let i = 0; i < n; i++) {
      const s = WLN[i], fs = Math.min(k.s, (W * 0.88) / Math.max(4, [...s].length * (/[A-Z]/.test(s) ? 0.7 : 1))), y = 8 + k.vh * 0.62 + i * lh - sy; if (!vis(y - lh, y + lh, 0, H)) continue;
      const e = clamp((8 + k.vh * 0.85 - y) / (k.vh * 0.5), 0, 1); if (!i) e0 = e;
      ctx.font = FONT(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(s).width, xl = W / 2 - w / 2;
      ctx.fillStyle = 'rgba(148,163,184,.18)'; ctx.fillText(s, W / 2, y);
      const bx = xl + e * (w + k.x), g = ctx.createLinearGradient(bx - k.x - 0.01, 0, bx, 0); g.addColorStop(0, hsla(k.hue + i * 15, 90, 65)); g.addColorStop(1, hsla(k.hue + i * 15, 90, 65, 0)); ctx.fillStyle = g; ctx.fillText(s, W / 2, y);
      if (Math.abs(P.y - y) < lh / 2) cell = `第 ${i + 1} 行：已擦亮 ${Math.round(e * 100)}%`;
    }
    return { mode: `擦除过渡 ${Math.round(k.x)}px · 第 1 行 ${Math.round(e0 * 100)}%`, cell, pageH };
  } });

FAM['path-draw'] = scFam({ title: '路径随滚', count: NC('弯折数', 2, 12, 6), extra: T('glow', '发光', true), size: SZ('线宽', 1, 16, 5, 0.5), color: '#4ade80',
  countDoc: '路径在页面上左右弯折的次数', extraDoc: '描出的线条是否带发光阴影', sizeDoc: '线条的粗细',
  presets: { 少弯: { count: 2 }, 多弯: { count: 12 }, 朴素: { glow: false }, 粗线: { size: 15 } },
  explain: '路径随滚：一条蛇形的 SVG 路径贯穿整个页面。滚动时，计算页面上处于视口 60% 高度那一行的位置，把路径从起点画到这一行（用 stroke-dashoffset），就像线条跟着读者一路往下画；经过的节点会被点亮。',
  formula: '目标行 = scrollY + 0.6 · 视口高', formula2: '可见长度 = 路径在目标行以上的长度',
  draw(ctx, W, H, t, C, P, k, st) {
    const n = k.n, sp2 = k.vh * 0.55, pageH = k.vh * 0.9 + n * sp2, sy = k.sy(pageH), key = `${W}|${k.vh}|${n}`;
    if (st.key !== key) {
      const pts = Array.from({ length: n + 1 }, (_, j) => [W * (j % 2 ? 0.76 : 0.24), k.vh * 0.3 + j * sp2]), p = new Path2D(), smp = [[pts[0][1], 0]]; let L = 0, px = pts[0][0], py = pts[0][1]; p.moveTo(px, py);
      for (let j = 1; j <= n; j++) { const a = pts[j - 1], b = pts[j], c1 = [a[0], a[1] + sp2 * 0.5], c2 = [b[0], b[1] - sp2 * 0.5]; p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b[0], b[1]); for (let s = 1; s <= 16; s++) { const u = s / 16, v = 1 - u, x = v * v * v * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b[0], y = v * v * v * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b[1]; L += Math.hypot(x - px, y - py); px = x; py = y; smp.push([y, L]); } }
      Object.assign(st, { key, pts, p, smp, L });
    }
    const tgt = sy + k.vh * 0.6; let len = 0; for (const [y, l] of st.smp) { if (y <= tgt) len = l; else break; }
    ctx.save(); ctx.translate(0, 8 - sy); ctx.lineCap = 'round'; ctx.lineWidth = k.s; ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.stroke(st.p);
    if (k.x) { ctx.shadowColor = hsla(k.hue, 90, 60); ctx.shadowBlur = 14; } ctx.strokeStyle = hsla(k.hue, 85, 60); dashSeg(ctx, { p: st.p, L: st.L }, 0, len / st.L); ctx.shadowBlur = 0;
    let lit = 0; st.pts.forEach(([x, y], j) => { const on2 = y <= tgt; if (on2) lit++; ctx.fillStyle = on2 ? hsla(k.hue + j * 20, 85, 65) : 'rgba(148,163,184,.3)'; ctx.beginPath(); ctx.arc(x, y, k.s + 6, 0, TAU); ctx.fill(); bars(ctx, j % 2 ? W * 0.1 : W * 0.5, y - 20, W * 0.36, 2, 20, on2 ? 'rgba(226,232,240,.45)' : 'rgba(148,163,184,.15)', j); });
    ctx.restore();
    return { mode: `已描 ${Math.round((len / st.L) * 100)}% · 点亮 ${lit}/${n + 1} 个节点 · 发光${yes(k.x)}`, cell: `指针处页面位置 y = ${Math.round(P.y - 8 + sy)}px`, pageH };
  } });

const CUL = ['注册用户', '完成订单', '覆盖城市', '五星好评', '累计下载', '团队成员'];
FAM.countup = scFam({ title: '数字递增', count: NC('数字组数', 1, 6, 3), extra: R('target', '目标数值', 100, 10000, 100, 2400), size: SZ('字号', 20, 90, 48), color: '#60a5fa',
  countDoc: '页面中统计数字的个数', extraDoc: '第一组数字最终要数到的值（其余按比例更大）', sizeDoc: '数字的字号',
  presets: { 单组: { count: 1 }, 六组: { count: 6 }, 一百: { target: 100 }, 一万: { target: 10000 }, 大字: { size: 88 } },
  explain: '数字递增：统计数字进入视口后，从 0 开始滚动增加到目标值，常见于官网的「数据亮点」区域。进度 e 由数字在视口中的位置决定，再经过「缓出」曲线（先快后慢），显示的值 = 目标 · 缓出(e)，取整后显示并加上千位分隔符。',
  formula: 'e = clamp((0.9 · 视口高 − 数字 y) / (0.45 · 视口高))', formula2: '显示值 = round(目标 · (1 − (1 − e)³))',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cols = Math.min(n, W > 640 ? 3 : 2), rows = Math.ceil(n / cols), rh = k.s * 2.8, pageH = k.vh * 1.5 + rows * rh, sy = k.sy(pageH), cw = W / cols; let v0 = 0, cell = null;
    text(ctx, '数据亮点', W / 2, 8 + k.vh * 0.45 - sy, { size: 22, col: '#e2e8f0', align: 'center', bold: true });
    for (let i = 0; i < n; i++) {
      const x = ((i % cols) + 0.5) * cw, y = 8 + k.vh * 0.85 + Math.floor(i / cols) * rh - sy; if (!vis(y - rh, y + rh, 0, H)) continue;
      const e = clamp((8 + k.vh * 0.9 - y) / (k.vh * 0.45), 0, 1), tg = Math.round(k.x * (1 + i * 0.37)), v = Math.round(tg * (1 - Math.pow(1 - e, 3))); if (!i) v0 = v;
      text(ctx, v.toLocaleString('en-US'), x, y, { size: Math.min(k.s, cw / 4.5), col: hsla(k.hue + i * 25, 85, 68), align: 'center', bold: true });
      text(ctx, CUL[i], x, y + k.s * 0.75, { size: 13, col: '#94a3b8', align: 'center' });
      ctx.fillStyle = hsla(k.hue + i * 25, 80, 60, 0.7); ctx.fillRect(x - cw * 0.3, y + k.s * 0.75 + 14, cw * 0.6 * e, 3);
      if (Math.abs(P.x - x) < cw / 2 && Math.abs(P.y - y) < rh / 2) cell = `「${CUL[i]}」：${v} / ${tg}`;
    }
    return { mode: `目标 ${Math.round(k.x)} · 第 1 组当前 ${v0}`, cell, pageH };
  } });

FAM['bg-shift'] = scFam({ title: '背景变色', count: NC('色段数', 2, 8, 4), extra: R('blend', '过渡宽度', 0.05, 1, 0.01, 0.5), size: SZ('标题字号', 16, 72, 40), color: '#ef4444',
  countDoc: '页面分成几段，每段有自己的背景色', extraDoc: '相邻两段颜色混合的区间占一段的比例；越小切换越突然', sizeDoc: '每段标题的字号',
  presets: { 双色: { count: 2 }, 八色: { count: 8 }, 突变: { blend: 0.05 }, 柔和: { blend: 1 }, 大标题: { size: 70 } },
  explain: '背景变色：页面分成若干段，每段指定一个背景色。滚动时算出当前位于第几段以及段内的位置，在两段颜色之间按比例插值，背景就会随滚动平滑变色。过渡宽度越小，颜色停留越久、切换越快。',
  formula: 'f = scrollY / 视口高，m = 缓动((f − ⌊f⌋ − 0.5) / 过渡宽度 + 0.5)', formula2: '背景色相 = 色相₍⌊f⌋₎ + (色相₍⌊f⌋+1₎ − 色相₍⌊f⌋₎) · m',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, pageH = n * k.vh, sy = k.sy(pageH), f = sy / k.vh, j = Math.min(n - 1, Math.floor(f)), m = smooth((fract(f) - 0.5) / k.x + 0.5), hOf = (i) => k.hue + (i * 300) / n, h = lerp(hOf(j), hOf(Math.min(n - 1, j + 1)), j >= n - 1 ? 0 : m);
    ctx.fillStyle = hsla(h, 60, 22); ctx.fillRect(0, 8, W, H);
    for (let i = 0; i < n; i++) {
      const y = 8 + i * k.vh + k.vh / 2 - sy; if (!vis(y - k.vh / 2, y + k.vh / 2, 0, H)) continue;
      ctx.fillStyle = hsla(hOf(i), 80, 65, 0.25); ctx.beginPath(); ctx.arc(W * (i % 2 ? 0.25 : 0.75), y, Math.min(W, k.vh) * 0.25, 0, TAU); ctx.fill();
      text(ctx, `第 ${i + 1} 段`, W / 2, y, { size: Math.min(k.s, W / 6), col: '#fff', align: 'center', bold: true }); bars(ctx, W * 0.25, y + k.s, W * 0.5, 2, 20, 'rgba(255,255,255,.3)', i);
    }
    return { mode: `背景 hsl(${Math.round(((h % 360) + 360) % 360)}, 60%, 22%) · 第 ${j + 1} 段 · 过渡 ${fmt(k.x, 2)}`, cell: `指针位于第 ${clamp(Math.floor((P.y - 8 + sy) / k.vh) + 1, 1, n)} 段`, pageH };
  } });

FAM['split-wipe'] = scFam({ title: '分屏擦除', count: NC('段落数', 2, 8, 4), extra: T('vertical', '上下分屏', false), size: SZ('标题字号', 16, 64, 32), color: '#8b5cf6',
  countDoc: '每一侧有几块面板', extraDoc: '关：左右分屏（上下反向滚动）；开：上下分屏（左右反向滑动）', sizeDoc: '面板编号的字号',
  presets: { 两段: { count: 2 }, 八段: { count: 8 }, 上下: { vertical: true }, 大字: { size: 62 } },
  explain: '分屏擦除：屏幕被分成两半，两半的内容朝相反方向移动——一边向上、一边向下（或一边向左、一边向右）。每到一个整段，两边的面板正好对齐拼成一个完整的画面，中间那条线显示总进度。',
  formula: '第一半位移 = −scrollY，第二半位移 = +scrollY − (n − 1) · 段长', formula2: '段号 = round(scrollY / 段长)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, v = k.x, L = v ? W : k.vh, pageH = n * k.vh, f = k.sp * (n - 1), half = v ? (k.vh / 2) : W / 2; let cell = null;
    for (let side = 0; side < 2; side++) for (let i = 0; i < n; i++) {
      const pos = side ? (n - 1 - i) * L - (n - 1 - f) * L : i * L - f * L, hu = k.hue + i * 45 + side * 180;
      let x, y, w, h; if (v) { x = pos; y = 8 + side * half; w = W; h = half; } else { x = side * half; y = 8 + pos; w = half; h = k.vh; }
      if (x > W || x + w < 0 || y > H || y + h < 8) continue;
      const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, hsla(hu, 70, 45)); g.addColorStop(1, hsla(hu + 30, 70, 25)); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      text(ctx, String(i + 1).padStart(2, '0'), x + w / 2, y + h / 2, { size: Math.min(k.s, h / 3), col: 'rgba(255,255,255,.92)', align: 'center', bold: true });
      if (P.x > x && P.x < x + w && P.y > y && P.y < y + h) cell = `${side ? (v ? '下半' : '右半') : (v ? '上半' : '左半')}：第 ${i + 1} 块面板`;
    }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; if (v) ctx.fillRect(0, 8 + half - 1.5, W * k.sp, 3); else ctx.fillRect(W / 2 - 1.5, 8, 3, k.vh * k.sp);
    return { mode: `第 ${Math.round(f) + 1}/${n} 段 · ${v ? '上下' : '左右'}分屏`, cell, pageH };
  } });

FAM.snap = scFam({ title: '惯性吸附', count: NC('段落数', 2, 10, 5), extra: R('strength', '吸附强度', 0, 1, 0.01, 0.7), size: SZ('标题字号', 16, 72, 40), color: '#14b8a6',
  countDoc: '整页分成几段全屏段落', extraDoc: '滚动位置被拉向最近段落的程度；0 为自由滚动', sizeDoc: '段落标题的字号',
  presets: { 两段: { count: 2 }, 十段: { count: 10 }, 自由: { strength: 0 }, 强吸: { strength: 1 }, 大标题: { size: 70 } },
  explain: '惯性吸附（scroll-snap）：给滚动容器设置 scroll-snap-type: y mandatory，每个段落设置 scroll-snap-align: start，浏览器就会在用户停止滚动时自动「吸」到最近的段落开头。这里把原始滚动位置的小数部分用多次缓动压扁，吸附强度控制压扁的程度，于是滚动会在每段停顿再快速翻到下一段。',
  formula: 'f = 进度 · (n − 1)，r = f − ⌊f⌋', formula2: '吸附后 = ⌊f⌋ + r + 强度 · (缓动³(r) − r)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, f = k.sp * (n - 1), r = fract(f), r3 = smooth(smooth(smooth(r))), fs = Math.floor(f) + r + k.x * (r3 - r), sy = fs * k.vh;
    for (let i = 0; i < n; i++) {
      const y = 8 + i * k.vh - sy; if (!vis(y, y + k.vh, 0, H)) continue; const g = ctx.createLinearGradient(0, y, W, y + k.vh); g.addColorStop(0, hsla(k.hue + i * 36, 60, 30)); g.addColorStop(1, hsla(k.hue + i * 36 + 40, 60, 14)); ctx.fillStyle = g; ctx.fillRect(0, y, W, k.vh);
      text(ctx, `段落 ${i + 1}`, W / 2, y + k.vh * 0.42, { size: Math.min(k.s, W / 6), col: '#fff', align: 'center', bold: true }); bars(ctx, W * 0.25, y + k.vh * 0.42 + k.s, W * 0.5, 2, 20, 'rgba(255,255,255,.3)', i);
    }
    for (let i = 0; i < n; i++) { const a = Math.round(fs) === i; ctx.fillStyle = a ? '#fff' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(W - 22, k.cy + (i - (n - 1) / 2) * 16, a ? 5 : 3, 0, TAU); ctx.fill(); }
    return { mode: `吸附强度 ${fmt(k.x, 2)} · 第 ${Math.round(fs) + 1} 段 · 偏离段首 ${Math.round(Math.abs(fs - Math.round(fs)) * k.vh)}px`, cell: `指针位于段落 ${clamp(Math.floor((P.y - 8 + sy) / k.vh) + 1, 1, n)}`, pageH: n * k.vh, sp: n > 1 ? fs / (n - 1) : 0 };
  } });

const TOCL = ['简介', '安装', '快速开始', '配置', '组件', '主题', '动画', '路由', '状态', '测试', '部署', '常见问题'];
FAM.toc = scFam({ title: '目录高亮', count: NC('目录条目', 3, 12, 6), extra: T('pill', '胶囊高亮', true), size: SZ('目录字号', 10, 24, 14), color: '#0ea5e9',
  countDoc: '目录（也就是文章章节）的条数', extraDoc: '开：滑动的胶囊背景高亮；关：左侧竖线 / 下划线高亮', sizeDoc: '目录文字的字号',
  presets: { 三条: { count: 3 }, 十二条: { count: 12 }, 竖线: { pill: false }, 大字: { size: 23 } },
  explain: '目录高亮：长文档旁边的目录会随着阅读位置自动高亮当前章节。做法是找出「顶部已经越过视口 30% 位置」的最后一个章节，把它在目录里标亮；高亮块的位置用连续的小数插值，所以会平滑地滑向下一项，而不是跳过去。窄屏时目录变成顶部的一排标签。',
  formula: 'f = (scrollY + 0.3 · 视口高) / 章节高', formula2: '高亮位置 = 目录项位置(f)（小数部分平滑插值）',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sec = k.vh * 0.7, pageH = n * sec + k.vh * 0.5, sy = k.sy(pageH), f = clamp((sy + k.vh * 0.3) / sec - 0.5, 0, n - 1), side = W >= 560, tw = side ? Math.min(220, W * 0.3) : 0, th = side ? 0 : k.s * 2.8; let cell = null;
    const cx0 = tw + 24, cw = W - cx0 - 24;
    for (let j = 0; j < n; j++) { const y = 8 + th + 30 + j * sec - sy; if (!vis(y, y + sec, 0, H)) continue; text(ctx, `${j + 1}. ${TOCL[j]}`, cx0, y + 12, { size: 20, col: hsla(k.hue + j * 20, 70, 70), bold: true }); bars(ctx, cx0, y + 40, cw, 5, 22, 'rgba(148,163,184,.25)', j); }
    ctx.fillStyle = 'rgba(8,13,26,.96)'; if (side) ctx.fillRect(0, 8, tw, H); else ctx.fillRect(0, 8, W, th);
    const ih = k.s * 2.1, iw = side ? tw - 24 : (W - 16) / n, pos = (i) => (side ? { x: 12, y: 24 + i * ih, w: iw, h: ih - 4 } : { x: 8 + i * iw, y: 12, w: iw - 4, h: th - 8 }), a = pos(Math.floor(f)), b = pos(Math.min(n - 1, Math.floor(f) + 1)), m = smooth(fract(f)), hx = lerp(a.x, b.x, m), hy = lerp(a.y, b.y, m);
    ctx.fillStyle = hsla(k.hue, 80, 55, k.x ? 0.35 : 1); if (k.x) { rrect(ctx, hx, hy, a.w, a.h, a.h / 2); ctx.fill(); } else if (side) ctx.fillRect(hx, hy + 3, 3, a.h - 6); else ctx.fillRect(hx + 6, hy + a.h - 3, a.w - 12, 3);
    for (let i = 0; i < n; i++) { const p = pos(i), act = Math.round(f) === i; text(ctx, TOCL[i], p.x + (side ? 14 : p.w / 2), p.y + p.h / 2, { size: side ? k.s : Math.min(k.s, p.w / Math.max(2, TOCL[i].length) * 0.9), col: act ? '#fff' : '#94a3b8', align: side ? 'left' : 'center', bold: act }); if (P.x > p.x && P.x < p.x + p.w && P.y > p.y && P.y < p.y + p.h) cell = `目录「${TOCL[i]}」→ 跳到第 ${i + 1} 节`; }
    return { mode: `当前：${TOCL[Math.round(f)]} · ${k.x ? '胶囊' : side ? '竖线' : '下划线'}高亮`, cell, pageH };
  } });

FAM.cover = scFam({ title: '封面滑出', count: NC('内容段数', 2, 8, 4), extra: R('coverH', '封面高度', 0.3, 1, 0.01, 0.8), size: SZ('标题字号', 18, 80, 44), color: '#e879f9',
  countDoc: '封面下方的内容段落数', extraDoc: '封面占视口高度的比例', sizeDoc: '封面大标题的字号',
  presets: { 两段: { count: 2 }, 八段: { count: 8 }, 矮封面: { coverH: 0.32 }, 全屏: { coverH: 1 }, 大标题: { size: 78 } },
  explain: '封面滑出：页面开头是一张大封面。向下滚动时，封面背景以一半的速度上移（视差），标题逐渐变淡并缩小，下面的内容卡片以正常速度滑上来覆盖封面。回到顶部时封面又完整出现。',
  formula: '封面位移 = 0.5 · scrollY，标题透明度 = 1 − scrollY / 封面高', formula2: '内容 y = 封面高 − scrollY',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, ch = k.vh * k.x, sec = 120, pageH = ch + n * sec + 40, sy = k.sy(pageH), e = clamp(sy / ch, 0, 1), cy = 8 - sy * 0.5; let cell = null;
    const g = ctx.createLinearGradient(0, cy, W, cy + ch); g.addColorStop(0, hsla(k.hue, 70, 40)); g.addColorStop(1, hsla(k.hue + 60, 70, 18)); ctx.fillStyle = g; ctx.fillRect(0, cy, W, ch);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = hsla(k.hue + i * 20, 80, 70, 0.12); ctx.beginPath(); ctx.arc(W * hh(i, 3), cy + ch * hh(i, 7), ch * 0.25, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1 - e; text(ctx, '封面标题', W / 2, cy + ch * 0.45, { size: Math.min(k.s, W / 6) * (1 - 0.3 * e), col: '#fff', align: 'center', bold: true }); text(ctx, '向下滚动 ↓', W / 2, cy + ch * 0.45 + k.s, { size: 13, col: '#e2e8f0', align: 'center' }); ctx.globalAlpha = 1;
    if (P.y > 8 && P.y < cy + ch) cell = `封面（已滑出 ${Math.round(e * 100)}%）`;
    const y0 = 8 + ch - sy; ctx.fillStyle = '#0b1222'; ctx.fillRect(0, y0, W, pageH); const cw = Math.min(W * 0.84, 640), x0 = (W - cw) / 2;
    for (let i = 0; i < n; i++) { const y = y0 + 20 + i * sec; if (!vis(y, y + sec, 0, H)) continue; ctx.fillStyle = hsla(k.hue + i * 30, 30, 16); rrect(ctx, x0, y, cw, sec - 20, 12); ctx.fill(); text(ctx, `内容 ${i + 1}`, x0 + 16, y + 22, { size: 16, col: hsla(k.hue + i * 30, 70, 72), bold: true }); bars(ctx, x0 + 16, y + 44, cw - 32, 2, 22, 'rgba(148,163,184,.3)', i); if (P.y > y && P.y < y + sec - 20) cell = `内容第 ${i + 1} 段`; }
    return { mode: `封面高度 ${fmt(k.x, 2)} 屏 · 已滑出 ${Math.round(e * 100)}%`, cell, pageH };
  } });

FAM.timeline = scFam({ title: '时间轴', count: NC('事件数', 3, 14, 7), extra: T('alt', '左右交错', true), size: SZ('节点大小', 4, 20, 9), color: '#38bdf8',
  countDoc: '时间轴上的事件数量', extraDoc: '开：事件卡片左右交替；关：全部在右侧', sizeDoc: '时间轴节点圆点的半径',
  presets: { 三件: { count: 3 }, 十四件: { count: 14 }, 单侧: { alt: false }, 大节点: { size: 19 } },
  explain: '时间轴：一条竖线贯穿页面，每个事件是线上的一个节点和一张卡片。滚动时，竖线从顶部「长」到视口 60% 的位置，经过的节点被点亮，对应的卡片从侧面滑入。窄屏时自动改为单侧布局。',
  formula: '已填充长度 = scrollY + 0.6 · 视口高 − 轴起点', formula2: '卡片进度 e = clamp((填充点 − 节点 y) / 80)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gy = 110, pageH = k.vh * 0.8 + n * gy, sy = k.sy(pageH), alt = k.x && W >= 520, ax = alt ? W / 2 : Math.min(60, W * 0.12), top = 8 + k.vh * 0.35 - sy, fill = 8 + k.vh * 0.6; let lit = 0, cell = null;
    ctx.fillStyle = 'rgba(148,163,184,.2)'; ctx.fillRect(ax - 1.5, top, 3, (n - 1) * gy); ctx.fillStyle = hsla(k.hue, 85, 62); ctx.fillRect(ax - 1.5, top, 3, clamp(fill - top, 0, (n - 1) * gy));
    for (let i = 0; i < n; i++) {
      const y = top + i * gy, e = clamp((fill - y) / 80, 0, 1); if (e > 0) lit++; if (!vis(y - gy, y + gy, 0, H)) continue;
      const right = !alt || i % 2 === 0, cw = alt ? Math.min(W / 2 - 50, 300) : W - ax - 40, cx = right ? ax + 24 : ax - 24 - cw, dx = (1 - smooth(e)) * 40 * (right ? 1 : -1);
      ctx.globalAlpha = 0.25 + 0.75 * e; ctx.fillStyle = hsla(k.hue + i * 22, 30, 16); rrect(ctx, cx + dx, y - 34, cw, 68, 10); ctx.fill();
      text(ctx, `${2015 + i} 年`, cx + dx + 12, y - 16, { size: 14, col: hsla(k.hue + i * 22, 80, 70), bold: true }); bars(ctx, cx + dx + 12, y + 2, cw - 24, 2, 18, 'rgba(203,213,225,.35)', i); ctx.globalAlpha = 1;
      ctx.fillStyle = e > 0 ? hsla(k.hue + i * 22, 85, 62) : '#1e293b'; ctx.beginPath(); ctx.arc(ax, y, k.s, 0, TAU); ctx.fill(); ctx.strokeStyle = '#060a14'; ctx.lineWidth = 3; ctx.stroke();
      if (Math.abs(P.y - y) < 36) cell = `${2015 + i} 年事件（${e > 0 ? '已点亮' : '未到达'}）`;
    }
    return { mode: `已点亮 ${lit}/${n} 个节点 · 左右交错：${yes(k.x)}${k.x && !alt ? '（窄屏单侧）' : ''}`, cell, pageH };
  } });

FAM['lazy-img'] = scFam({ title: '懒加载图片', count: NC('图片数', 3, 18, 8), extra: R('margin', '加载距离', 0, 300, 5, 80), size: SZ('图片高度', 40, 200, 110), color: '#84cc16',
  countDoc: '页面中的图片数量', extraDoc: '图片距离视口还有多少像素时开始加载（rootMargin）', sizeDoc: '每张图片的高度',
  presets: { 三张: { count: 3 }, 十八张: { count: 18 }, 贴边加载: { margin: 0 }, 提前加载: { margin: 300 }, 高图: { size: 196 } },
  explain: '懒加载图片：页面里的图片先显示灰色占位框，只有当图片靠近视口（距离小于「加载距离」）时才真正开始下载，下载完成后从模糊淡入为清晰。这样首屏不用一次下载所有图片，加载更快。IntersectionObserver 的 rootMargin 就是这里的加载距离。',
  formula: '开始加载：图片顶 < 视口底 + rootMargin', formula2: '加载进度 = clamp((视口底 + rootMargin − 图片顶) / 图片高)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cols = W > 640 ? 2 : 1, gy = k.s + 16, rows = Math.ceil(n / cols), pageH = k.vh * 0.3 + rows * gy + 40, sy = k.sy(pageH), cw = (Math.min(W * 0.9, 760) - (cols - 1) * 16) / cols, x0 = (W - (cw * cols + (cols - 1) * 16)) / 2, bot = 8 + k.vh; let loaded = 0, cell = null;
    ctx.strokeStyle = hsla(k.hue, 80, 60, 0.6); ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, bot - 2); ctx.lineTo(W, bot - 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i % cols) * (cw + 16), y = 8 + k.vh * 0.3 + Math.floor(i / cols) * gy - sy, e = clamp((bot + k.x - y) / k.s, 0, 1); if (e >= 1) loaded++; if (!vis(y, y + k.s, 0, H)) continue;
      ctx.fillStyle = '#1e293b'; rrect(ctx, x, y, cw, k.s, 10); ctx.fill();
      if (e > 0) { ctx.save(); ctx.globalAlpha = e; rrect(ctx, x, y, cw, k.s, 10); ctx.clip(); const g = ctx.createLinearGradient(x, y, x + cw, y + k.s); g.addColorStop(0, hsla(k.hue + i * 23, 70, 55)); g.addColorStop(1, hsla(k.hue + i * 23 + 80, 60, 25)); ctx.fillStyle = g; ctx.fillRect(x, y, cw, k.s);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(x, y + k.s); ctx.lineTo(x + cw * 0.35, y + k.s * 0.45); ctx.lineTo(x + cw * 0.6, y + k.s * 0.75); ctx.lineTo(x + cw * 0.8, y + k.s * 0.35); ctx.lineTo(x + cw, y + k.s); ctx.fill(); ctx.restore(); }
      else text(ctx, '占位', x + cw / 2, y + k.s / 2, { size: 12, col: '#64748b', align: 'center' });
      if (P.x > x && P.x < x + cw && P.y > y && P.y < y + k.s) cell = `图 ${i + 1}：${e <= 0 ? '未加载' : e < 1 ? `加载中 ${Math.round(e * 100)}%` : '已加载'}`;
    }
    return { mode: `rootMargin ${Math.round(k.x)}px · 已加载 ${loaded}/${n}`, cell, pageH };
  } });

FAM['stagger-grid'] = scFam({ title: '错峰网格', count: NC('列数', 2, 6, 4), extra: R('stagger', '交错延迟', 0, 0.3, 0.01, 0.12), size: SZ('格子高度', 30, 140, 70), color: '#f43f5e',
  countDoc: '网格的列数（总共 4 行一组，共 3 组）', extraDoc: '同一行里每往右一格，出现时间推迟多少（屏高的比例）', sizeDoc: '每个格子的高度',
  presets: { 两列: { count: 2 }, 六列: { count: 6 }, 同时: { stagger: 0 }, 大错峰: { stagger: 0.3 }, 高格: { size: 136 } },
  explain: '错峰网格：网格里的格子不是一起出现，而是一个接一个地「波浪式」浮现。每个格子的进度 = 基础进度 − 列号 · 交错延迟，所以同一行里越靠右的格子出现得越晚。CSS 里常用 transition-delay: calc(var(--i) * 80ms) 实现。',
  formula: 'eᵢ = clamp((视口底 − 格子顶) / (0.35 · 视口高) − 列号 · 延迟 · 4)', formula2: '缩放 = 0.6 + 0.4 · eᵢ，透明度 = eᵢ',
  draw(ctx, W, H, t, C, P, k) {
    const cols = k.n, rows = 12, gap = 10, gw = Math.min(W * 0.9, 820), cw = (gw - (cols - 1) * gap) / cols, x0 = (W - gw) / 2, pageH = k.vh * 0.5 + rows * (k.s + gap), sy = k.sy(pageH), bot = 8 + k.vh; let shown = 0, cell = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * (cw + gap), y = 8 + k.vh * 0.5 + r * (k.s + gap) - sy; if (!vis(y, y + k.s, 0, H)) continue;
      const e = smooth((bot - y) / (k.vh * 0.35) - c * k.x * 4); if (e > 0.98) shown++; const sc = 0.6 + 0.4 * e;
      ctx.save(); ctx.globalAlpha = e; ctx.translate(x + cw / 2, y + k.s / 2); ctx.scale(sc, sc); ctx.fillStyle = hsla(k.hue + (r * cols + c) * 9, 70, 52); rrect(ctx, -cw / 2, -k.s / 2, cw, k.s, 10); ctx.fill(); ctx.restore();
      if (P.x > x && P.x < x + cw && P.y > y && P.y < y + k.s) cell = `第 ${r + 1} 行第 ${c + 1} 列：${Math.round(e * 100)}%`;
    }
    return { mode: `交错延迟 ${fmt(k.x, 2)} · 视口内已出现 ${shown} 格`, cell, pageH };
  } });

FAM.totop = scFam({ title: '回到顶部', count: NC('页面屏数', 2, 10, 5), extra: R('thresh', '出现阈值', 0, 0.8, 0.01, 0.2), size: SZ('按钮大小', 24, 80, 46), color: '#06b6d4',
  countDoc: '整个页面有几屏高', extraDoc: '滚动进度超过这个比例后才显示回到顶部按钮', sizeDoc: '圆形按钮的直径',
  presets: { 两屏: { count: 2 }, 十屏: { count: 10 }, 立即出现: { thresh: 0 }, 很晚出现: { thresh: 0.78 }, 大按钮: { size: 78 } },
  explain: '回到顶部：页面滚动超过一定距离后，右下角浮出一个圆形按钮，按钮外圈的进度环显示读了多少。点击按钮会平滑滚回顶部（scrollTo({ top: 0, behavior: "smooth" })）。滚动距离小于阈值时按钮隐藏，避免打扰阅读。',
  formula: '显示 = 进度 > 阈值（淡入带宽 0.05）', formula2: '进度环角度 = 360° · 进度',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, pageH = n * k.vh, sy = k.sy(pageH), cw = Math.min(W * 0.84, 640), x0 = (W - cw) / 2;
    for (let i = 0; i < n * 3; i++) { const y = 8 + 24 + i * (k.vh / 3) - sy; if (!vis(y, y + k.vh / 3, 0, H)) continue; text(ctx, `第 ${Math.floor(i / 3) + 1} 屏 · ${(i % 3) + 1}`, x0, y + 10, { size: 15, col: hsla(k.hue + i * 12, 70, 70), bold: true }); bars(ctx, x0, y + 30, cw, 3, 22, 'rgba(148,163,184,.25)', i); }
    const a = smooth((k.sp - k.x) / 0.05), d = k.s, bx = W - 22 - d / 2, by = H - 52 - d / 2 + (1 - a) * 30; let cell = null;
    if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = hsla(k.hue, 70, 45); ctx.beginPath(); ctx.arc(bx, by, d / 2, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(bx, by, d / 2 - 4, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, d / 2 - 4, -Math.PI / 2, -Math.PI / 2 + TAU * k.sp); ctx.stroke();
      ctx.lineWidth = Math.max(2, d / 14); ctx.beginPath(); ctx.moveTo(bx - d * 0.16, by + d * 0.06); ctx.lineTo(bx, by - d * 0.12); ctx.lineTo(bx + d * 0.16, by + d * 0.06); ctx.stroke(); ctx.restore(); if (Math.hypot(P.x - bx, P.y - by) < d / 2) cell = '回到顶部按钮（点击滚回顶部）'; }
    return { mode: `进度 ${Math.round(k.sp * 100)}% · 阈值 ${Math.round(k.x * 100)}% · 按钮${a > 0.5 ? '显示' : '隐藏'}`, cell, pageH };
  } });

const STL = ['清晨', '出发', '山路', '午后', '风暴', '黄昏', '归途', '夜晚'];
FAM.story = scFam({ title: '滚动叙事', count: NC('章节数', 2, 8, 5), extra: T('art', '插图', true), size: SZ('字号', 12, 32, 18), color: '#fbbf24',
  countDoc: '故事被分成几章', extraDoc: '是否显示跟随章节变化的固定插图', sizeDoc: '叙事文字的字号',
  presets: { 两章: { count: 2 }, 八章: { count: 8 }, 纯文字: { art: false }, 大字: { size: 31 } },
  explain: '滚动叙事（scrollytelling）：一侧是固定不动的插图（sticky），另一侧是一段段文字。哪段文字滚到视口中部，插图就切换成对应的画面（这里用太阳的高度和天空颜色表示时间推移）。窄屏时插图在上、文字在下。',
  formula: '当前章 = 距视口中心最近的文字段', formula2: '插图 = 在相邻两章之间按距离插值',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sec = k.vh * 0.75, pageH = n * sec + k.vh * 0.4, sy = k.sy(pageH), wide = W >= 600, aw = k.x ? (wide ? W * 0.5 : W) : 0, ah = k.x ? (wide ? k.vh : k.vh * 0.4) : 0, f = clamp((sy + k.vh * 0.5 - k.vh * 0.2 - sec * 0.5) / sec, 0, n - 1); let cell = null;
    const tx = wide && k.x ? aw + 24 : 24, tw = (wide ? W - aw : W) - 48, ty0 = wide || !k.x ? 8 : 8 + ah;
    for (let i = 0; i < n; i++) { const y = ty0 + k.vh * 0.2 + i * sec - sy; if (!vis(y, y + sec, ty0, H)) continue; const act = Math.round(f) === i; ctx.globalAlpha = act ? 1 : 0.35; ctx.fillStyle = hsla(k.hue + i * 30, 30, 15); rrect(ctx, tx, y, tw, sec * 0.6, 12); ctx.fill(); text(ctx, `第 ${i + 1} 章 · ${STL[i]}`, tx + 16, y + k.s + 4, { size: k.s, col: hsla(k.hue + i * 30, 80, 70), bold: true }); bars(ctx, tx + 16, y + k.s * 2 + 12, tw - 32, Math.max(1, Math.floor((sec * 0.6 - k.s * 2 - 24) / (k.s * 1.4))), k.s * 1.4, 'rgba(203,213,225,.35)', i); ctx.globalAlpha = 1; if (P.x > tx && P.y > y && P.y < y + sec * 0.6) cell = `第 ${i + 1} 章「${STL[i]}」`; }
    if (k.x) {
      const u = f / Math.max(1, n - 1), sky = ctx.createLinearGradient(0, 8, 0, 8 + ah); sky.addColorStop(0, hsla(k.hue + 200 * u, 60, 50 - 35 * Math.abs(u - 0.5) * 2 * u)); sky.addColorStop(1, hsla(k.hue + 40 + 200 * u, 60, 20)); ctx.fillStyle = sky; ctx.fillRect(0, 8, aw, ah);
      const sx = aw * (0.15 + 0.7 * u), syy = 8 + ah * (0.75 - 0.55 * Math.sin(Math.PI * u)); ctx.fillStyle = hsla(k.hue + 20, 95, 75); ctx.beginPath(); ctx.arc(sx, syy, Math.min(aw, ah) * 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = hsla(k.hue + 150, 35, 12); ctx.beginPath(); ctx.moveTo(0, 8 + ah); for (let x = 0; x <= aw; x += 8) ctx.lineTo(x, 8 + ah * 0.8 - ah * 0.1 * (0.5 + 0.5 * ridge(x, 2))); ctx.lineTo(aw, 8 + ah); ctx.fill();
      text(ctx, STL[Math.round(f)], 16, 30, { size: 16, col: '#fff', bold: true }); if (P.x < aw && P.y < 8 + ah) cell = `插图：${STL[Math.round(f)]}（${Math.round(u * 100)}%）`;
    }
    return { mode: `当前第 ${Math.round(f) + 1}/${n} 章「${STL[Math.round(f)]}」 · 插图：${yes(k.x)}`, cell, pageH };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'parallax');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'parallax';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-scroll',
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
