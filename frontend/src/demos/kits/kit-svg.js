/**
 * kit-svg — SVG animation concepts (stroke-dash, morph, SMIL, masks, filters, gradients)
 * rendered on a canvas stage via Path2D. Every frame is a pure function of (t, pointer, knobs).
 * LIVE .mip readout; beginner Chinese docs; full-stage fill.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';
import { getLang } from '../../lib/i18n';

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
const SVGP = '<p>SVG 是「用文字描述的矢量图」：&lt;path d="M… L… C… A…"&gt; 里 M 表示移动到某点、L 画直线、C 画三次贝塞尔曲线、A 画圆弧。这里用 Canvas 的 Path2D 解析同样的路径，再按时间 t 改变描边、形状、颜色等属性，效果与网页里的 SVG 动画一致。</p>';

/** sFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k, st) returns { mode?, n?, cell? } */
function sFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key] ?? ex.value) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key] ?? ex.value)}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>${SVGP}`,
      params: [['主色', '图形的基础颜色，其他颜色由它在色环上偏移得到'], [spec.speed.label, '动画播放的快慢，0 表示暂停'], [spec.size.label, d.sizeDoc || '图形的大小'], [d.count.label, d.countDoc || '图形的数量'], [ex.label, d.extraDoc || '该效果特有的参数']],
      example: (v) => `<ol><li>当前：${v.mode}</li><li>${d.count.label}：${v.n}；指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖动右侧滑条立即看到变化</li></ol>`,
      tip: d.tip || '移动指针与图形互动；右侧滑条实时调整，无需重新加载。',
    },
    build(S) {
      const st = {};
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', tt = t * num(C.speed, 0.9);
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), cx: W / 2, cy: (H + 8) / 2, R: Math.min(W, H - 20) * 0.4 };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        const lp = fract(tt / 6); ctx.fillStyle = hsla(k.hue, 80, 60, 0.18); ctx.fillRect(0, H - 4, W, 4); ctx.fillStyle = hsla(k.hue, 85, 65, 0.7); ctx.fillRect(0, H - 4, W * lp, 4);
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: r.cell || '指针不在图形上', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const SZ = (label, min, max, value, step = 1) => ({ label, min, max, step, value });

const DRAWL = ['heart', 'star', 'sig', 'inf', 'gear', 'circle', 'spiral', 'hex', 'wave'];
FAM.draw = sFam({ title: '路径描边动画', count: NC('图形数', 1, 9, 3), extra: R('dur', '描边时长', 0.5, 6, 0.1, 2.2), size: SZ('线宽', 1, 14, 4, 0.5), color: '#38bdf8',
  countDoc: '同时描边的图形个数', extraDoc: '画完一条路径需要几秒', sizeDoc: '描边线条的粗细（stroke-width）',
  presets: { 单个: { count: 1 }, 九宫格: { count: 9 }, 快描: { dur: 0.6 }, 慢描: { dur: 5.8 }, 粗线: { size: 13 } },
  explain: '路径描边动画：先用 getTotalLength() 量出整条路径的长度 L，把 stroke-dasharray 设成「L 实线 + L 空白」，再让 stroke-dashoffset 从 L 逐渐变到 0，线条就像被笔一点点画出来；画完后再从起点开始擦除，循环播放。白色亮点就是笔尖当前的位置。',
  formula: 'dashoffset = L · (1 − 缓动(t / 描边时长))', formula2: '可见长度 = L · 进度，L = getTotalLength()',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(k.n, W, H), dur = k.x, T0 = dur * 2 + 1, ph = ((t % T0) + T0) % T0; let first = 0, cell = null;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    G.forEach((c, i) => {
      const nm = DRAWL[i % DRAWL.length], s = shape(nm, c.x, c.y, c.r), d0 = i * 0.12, a = smooth((ph - dur - 0.5 - d0) / dur), b = smooth((ph - d0) / dur);
      ctx.lineWidth = k.s; ctx.strokeStyle = hsla(k.hue, 60, 60, 0.12); ctx.stroke(s.p);
      ctx.strokeStyle = hsla(k.hue + i * 25, 85, 62); dashSeg(ctx, s, a, b);
      if (b > a + 0.001 && b < 1) { const q = along(s, b); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, k.s * 0.7 + 2, 0, TAU); ctx.fill(); }
      if (!i) first = b - a;
      if (!cell && inCell(P, c)) cell = `第 ${i + 1} 个「${SHN[nm]}」，已显示 ${Math.round((b - a) * 100)}%（L≈${Math.round(s.L)}px）`;
    });
    return { mode: `描边时长 ${fmt(dur, 1)} 秒 · 第 1 条可见 ${Math.round(first * 100)}%`, cell };
  } });

const MSEQ = ['circle', 'star', 'heart', 'hex', 'gear', 'inf'];
FAM.morph = sFam({ title: '形状变形 Morph', count: NC('采样点数', 6, 160, 48), extra: R('hold', '停留时间', 0, 2, 0.05, 0.5), size: SZ('图形半径', 20, 100, 85), color: '#a78bfa',
  countDoc: '每个形状被重新采样成多少个点；点越少越有棱角', extraDoc: '每个形状变形完成后停留几秒', sizeDoc: '图形占画面的百分比',
  presets: { 棱角: { count: 6 }, 细腻: { count: 160 }, 不停: { hold: 0 }, 久停: { hold: 1.9 }, 小图: { size: 30 } },
  explain: '形状变形：两条 path 要想平滑过渡，必须有相同数量、一一对应的点。这里把圆、星、心等形状都按同样的点数重新采样，再对每一对点做线性插值，形状就会连续地从一个变成另一个。指针靠近时，附近的点会被轻轻推开。',
  formula: '点ᵢ = A点ᵢ · (1 − p) + B点ᵢ · p', formula2: 'p = 缓动((t − 停留时间) / 1.2)',
  draw(ctx, W, H, t, C, P, k) {
    const N = k.n, R0 = (k.R * k.s) / 100, seg = 1.2 + k.x, idx = Math.floor(t / seg), p = smooth(((((t % seg) + seg) % seg) - k.x) / 1.2);
    const ia = ((idx % 6) + 6) % 6, ib = (ia + 1) % 6, A = shape(MSEQ[ia], k.cx, k.cy, R0, N), B = shape(MSEQ[ib], k.cx, k.cy, R0, N);
    const pts = []; let pushed = 0;
    for (let i = 0; i < N; i++) { let x = lerp(A.pts[i][0], B.pts[i][0], p), y = lerp(A.pts[i][1], B.pts[i][1], p); const dx = x - P.x, dy = y - P.y, dd = Math.hypot(dx, dy) || 1, f = Math.max(0, 1 - dd / (R0 * 0.5)) * R0 * 0.15; if (f > 1) pushed++; x += (dx / dd) * f; y += (dy / dd) * f; pts.push([x, y]); }
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const g = ctx.createRadialGradient(k.cx, k.cy - R0 * 0.3, R0 * 0.1, k.cx, k.cy, R0 * 1.2); g.addColorStop(0, hsla(k.hue + 30, 90, 70, 0.9)); g.addColorStop(1, hsla(k.hue - 20, 80, 45, 0.55));
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = hsla(k.hue, 90, 80); ctx.stroke();
    if (N <= 64) { ctx.fillStyle = '#fff'; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }); }
    return { mode: `${SHN[MSEQ[ia]]} → ${SHN[MSEQ[ib]]} ${Math.round(p * 100)}% · 停留 ${fmt(k.x, 2)} 秒`, cell: `指针距中心 ${Math.round(Math.hypot(P.x - k.cx, P.y - k.cy))}px，推开 ${pushed} 个点` };
  } });

function ICO(ctx, kind, x, y, z, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(z, z); ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
  const L = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
  const poly = (A, B) => { ctx.beginPath(); A.forEach((a, i) => { const px = lerp(a[0], B[i][0], s), py = lerp(a[1], B[i][1], s); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); ctx.fill(); };
  switch (kind) {
    case 'menu':
      ctx.save(); ctx.translate(0, -0.28 * (1 - s)); ctx.rotate((s * Math.PI) / 4); L(-0.38, 0, 0.38, 0); ctx.restore();
      ctx.globalAlpha = 1 - s; L(-0.38 + 0.3 * s, 0, 0.38 - 0.3 * s, 0); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(0, 0.28 * (1 - s)); ctx.rotate((-s * Math.PI) / 4); L(-0.38, 0, 0.38, 0); ctx.restore(); break;
    case 'play':
      poly([[-0.3, -0.42], [0.06, -0.21], [0.06, 0.21], [-0.3, 0.42]], [[-0.32, -0.4], [-0.08, -0.4], [-0.08, 0.4], [-0.32, 0.4]]);
      poly([[0.06, -0.21], [0.42, 0], [0.42, 0], [0.06, 0.21]], [[0.08, -0.4], [0.32, -0.4], [0.32, 0.4], [0.08, 0.4]]); break;
    case 'plus': L(-0.38, 0, 0.38, 0); ctx.rotate((s * Math.PI) / 2); L(0, -0.38, 0, 0.38); break;
    case 'chev': ctx.rotate(s * Math.PI); ctx.beginPath(); ctx.moveTo(-0.32, -0.12); ctx.lineTo(0, 0.16); ctx.lineTo(0.32, -0.12); ctx.stroke(); break;
    case 'check': {
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      if (s > 0.01) { ctx.beginPath(); ctx.arc(0, 0, 0.42, -Math.PI / 2, -Math.PI / 2 + TAU * s); ctx.stroke(); }
      const d = s * 0.59; ctx.beginPath(); ctx.moveTo(-0.2, 0); if (d > 0) { const a = Math.min(d, 0.17) / 0.17; ctx.lineTo(-0.2 + 0.12 * a, 0.12 * a); if (d > 0.17) { const b = (d - 0.17) / 0.42; ctx.lineTo(-0.08 + 0.3 * b, 0.12 - 0.3 * b); } } ctx.stroke(); break; }
    case 'heart': {
      const sc = 1 + 0.15 * Math.sin(s * Math.PI); ctx.scale(sc, sc); ctx.beginPath();
      for (let i = 0; i < 40; i++) { const [hx, hy] = UN.heart(i / 40); i ? ctx.lineTo(hx * 0.42, hy * 0.42) : ctx.moveTo(hx * 0.42, hy * 0.42); }
      ctx.closePath(); ctx.globalAlpha = s; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); break; }
    case 'arrow': { const dx = Math.sin(s * Math.PI) * 0.12, hw = 0.14 + 0.1 * s; L(-0.36 + dx, 0, 0.32 + dx, 0); ctx.beginPath(); ctx.moveTo(0.32 + dx - hw, -hw); ctx.lineTo(0.32 + dx, 0); ctx.lineTo(0.32 + dx - hw, hw); ctx.stroke(); break; }
    default: {
      ctx.beginPath(); ctx.moveTo(-0.4, -0.12); ctx.lineTo(-0.24, -0.12); ctx.lineTo(-0.06, -0.3); ctx.lineTo(-0.06, 0.3); ctx.lineTo(-0.24, 0.12); ctx.lineTo(-0.4, 0.12); ctx.closePath(); ctx.fill();
      for (let j = 0; j < 3; j++) { const a = clamp(s * 3 - j, 0, 1); if (a <= 0) continue; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(-0.06, 0, 0.14 + j * 0.12, -0.8, 0.8); ctx.stroke(); }
      ctx.globalAlpha = 1; }
  }
  ctx.restore();
}
const ICK = ['menu', 'play', 'plus', 'chev', 'check', 'heart', 'arrow', 'vol'];
const ICN = { menu: '菜单 ↔ 关闭', play: '播放 ↔ 暂停', plus: '加号 ↔ 减号', chev: '展开 ↔ 收起', check: '画出对勾', heart: '空心 ↔ 实心爱心', arrow: '箭头前进', vol: '音量增大' };
FAM.icons = sFam({ title: '动画图标', count: NC('图标数', 1, 8, 6), extra: R('gap', '切换间隔', 0.4, 4, 0.1, 1.4), size: SZ('图标大小', 20, 100, 70), color: '#34d399',
  countDoc: '画面中展示几个图标', extraDoc: '每个图标保持一种状态多少秒再切换', sizeDoc: '图标占格子的百分比',
  presets: { 单个: { count: 1 }, 全部: { count: 8 }, 快切: { gap: 0.5 }, 慢切: { gap: 3.8 }, 大图标: { size: 100 } },
  explain: '动画图标：每个图标有两种状态（例如菜单 ☰ 和关闭 ✕），状态值 s 在 0 和 1 之间平滑过渡。图标里每条线的位置、旋转角、透明度都按 s 插值，所以切换时线条会连贯地变形，而不是突然替换。指针悬停的图标会停在状态 1。',
  formula: '属性 = 状态0的值 · (1 − s) + 状态1的值 · s', formula2: 's = 缓动(局部时间 / 0.35)，每隔「切换间隔」秒翻转一次',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(k.n, W, H); let cell = null, cnt = 0;
    G.forEach((c, i) => {
      const z = (c.r * 2.3 * k.s) / 100, hov = Math.abs(P.x - c.x) < Math.max(z, c.r) * 0.65 && Math.abs(P.y - c.y) < Math.max(z, c.r) * 0.65, s = hov ? 1 : tog(t, k.x, i), kind = ICK[i % 8];
      if (s > 0.5) cnt++;
      ctx.fillStyle = hsla(k.hue, 30, hov ? 20 : 12); rrect(ctx, c.x - z * 0.62, c.y - z * 0.62, z * 1.24, z * 1.24, z * 0.2); ctx.fill();
      ICO(ctx, kind, c.x, c.y, z, s, hsla(k.hue + i * 20, 80, 66));
      if (hov) cell = `第 ${i + 1} 个「${ICN[kind]}」，状态 s = ${fmt(s, 2)}`;
    });
    return { mode: `切换间隔 ${fmt(k.x, 1)} 秒 · ${cnt} 个处于状态 1`, cell };
  } });

const STL = ['star', 'heart', 'hex', 'gear', 'inf', 'mount', 'zig', 'sig', 'circle', 'spiral', 'wave'];
FAM.stroke = sFam({ title: '描边路径', count: NC('虚线段数', 1, 24, 8), extra: T('round', '圆头端点', true), size: SZ('线宽', 1, 24, 8, 0.5), color: '#f472b6',
  countDoc: '把整条路径平均分成几段虚线；1 表示实线', extraDoc: 'stroke-linecap / linejoin 用 round（圆头圆角）还是 butt / miter（平头尖角）', sizeDoc: 'stroke-width 描边宽度',
  presets: { 实线: { count: 1 }, 细碎: { count: 24 }, 平头: { round: false }, 粗描边: { size: 22 } },
  explain: '描边路径：SVG 的 stroke 有几个关键属性：stroke-width 线宽、stroke-linecap 线头形状、stroke-linejoin 拐角形状、stroke-dasharray 虚线图案、stroke-dashoffset 虚线起点。这里把路径总长 L 平均分成 n 段虚线，并让 dashoffset 随时间变化，虚线就会沿路径转动；每 4 秒换一种形状。',
  formula: 'dasharray = (0.6 · L/n, 0.4 · L/n)', formula2: 'dashoffset = −t · L / 8',
  draw(ctx, W, H, t, C, P, k) {
    const idx = Math.floor(t / 4), nm = STL[((idx % STL.length) + STL.length) % STL.length], s = shape(nm, k.cx, k.cy, k.R), n = k.n, seg = s.L / n, ph = ((t % 4) + 4) % 4, fade = smooth(ph / 0.4) * (1 - smooth((ph - 3.6) / 0.4));
    ctx.lineWidth = k.s; ctx.lineCap = k.x ? 'round' : 'butt'; ctx.lineJoin = k.x ? 'round' : 'miter';
    ctx.strokeStyle = hsla(k.hue, 50, 50, 0.15); ctx.stroke(s.p);
    ctx.globalAlpha = 0.35 + 0.65 * fade; ctx.strokeStyle = hsla(k.hue, 85, 64); if (n > 1) ctx.setLineDash([seg * 0.6, seg * 0.4]); ctx.lineDashOffset = (-t * s.L) / 8; ctx.stroke(s.p); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const d = minDist(P, s.pts);
    return { mode: `${SHN[nm]} · dasharray ${n > 1 ? `${Math.round(seg * 0.6)} ${Math.round(seg * 0.4)}` : '无（实线）'} · ${k.x ? 'round' : 'butt'}`, cell: d < k.s / 2 + 8 ? `指针压在「${SHN[nm]}」的描边上` : `指针距描边 ${Math.round(d)}px` };
  } });

function IA(ctx, kind, x, y, z, t, sw, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(z, z); ctx.lineWidth = 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;
  const A = (sw * Math.PI) / 180, L = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
  switch (kind) {
    case 'bell': {
      ctx.translate(0, -0.4); const r = A * Math.sin(t * 5) * (0.55 + 0.45 * Math.sin(t * 1.3)); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(-0.32, 0.62); ctx.bezierCurveTo(-0.3, 0.1, -0.22, 0.05, 0, 0.05); ctx.bezierCurveTo(0.22, 0.05, 0.3, 0.1, 0.32, 0.62); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(Math.sin(t * 5 + 1) * A * 0.15, 0.72, 0.07, 0, TAU); ctx.fill(); L(0, 0.05, 0, -0.03); break; }
    case 'gear': {
      ctx.rotate(t * 1.2 + Math.sin(t * 3) * A); ctx.beginPath();
      for (let i = 0; i < 72; i++) { const [gx, gy] = UN.gear(i / 72); i ? ctx.lineTo(gx * 0.42, gy * 0.42) : ctx.moveTo(gx * 0.42, gy * 0.42); }
      ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 0.13, 0, TAU); ctx.stroke(); break; }
    case 'down': {
      const dy = Math.abs(Math.sin(t * 3)) * (A / Math.PI) * 0.6; L(-0.36, 0.22, -0.36, 0.4); L(-0.36, 0.4, 0.36, 0.4); L(0.36, 0.4, 0.36, 0.22);
      L(0, -0.42 + dy, 0, 0.12 + dy); L(-0.17, -0.05 + dy, 0, 0.12 + dy); L(0.17, -0.05 + dy, 0, 0.12 + dy); break; }
    case 'search': { ctx.rotate(Math.sin(t * 2) * A); const sc = 1 + 0.1 * Math.sin(t * 4); ctx.scale(sc, sc); ctx.beginPath(); ctx.arc(-0.08, -0.08, 0.26, 0, TAU); ctx.stroke(); L(0.11, 0.11, 0.38, 0.38); break; }
    case 'cloud': {
      ctx.save(); ctx.translate(Math.sin(t) * (A / Math.PI) * 0.4, 0); ctx.beginPath(); ctx.arc(-0.2, 0.0, 0.17, 0, TAU); ctx.arc(0.05, -0.12, 0.24, 0, TAU); ctx.arc(0.25, 0.02, 0.15, 0, TAU); ctx.rect(-0.2, 0, 0.45, 0.17); ctx.fill(); ctx.restore();
      for (let j = 0; j < 3; j++) { const yy = 0.25 + fract(t * 1.2 + j / 3) * 0.3; ctx.globalAlpha = 1 - fract(t * 1.2 + j / 3); L(-0.15 + j * 0.15, yy, -0.18 + j * 0.15, yy + 0.08); } ctx.globalAlpha = 1; break; }
    default: {
      const sc = 1 + (A / Math.PI) * 0.8 * Math.pow(Math.abs(Math.sin(t * 3)), 6); ctx.scale(sc, sc); ctx.beginPath();
      for (let i = 0; i < 40; i++) { const [hx, hy] = UN.heart(i / 40); i ? ctx.lineTo(hx * 0.42, hy * 0.42) : ctx.moveTo(hx * 0.42, hy * 0.42); } ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
const IAK = ['bell', 'gear', 'down', 'search', 'cloud', 'heart'];
const IAN = { bell: '铃铛摇摆', gear: '齿轮旋转', down: '下载跳动', search: '放大镜摆动', cloud: '云朵下雨', heart: '爱心跳动' };
FAM['icon-anim'] = sFam({ title: '图标动效', count: NC('图标数', 1, 6, 4), extra: R('swing', '摆动幅度', 0, 60, 1, 24), size: SZ('图标大小', 20, 100, 72), color: '#facc15',
  countDoc: '展示几个带动效的图标', extraDoc: '图标摆动 / 跳动的幅度（角度）', sizeDoc: '图标占格子的百分比',
  presets: { 单个: { count: 1 }, 全部: { count: 6 }, 轻摆: { swing: 5 }, 猛摆: { swing: 58 }, 大图标: { size: 100 } },
  explain: '图标动效：给图标的一部分加上 transform 动画——铃铛绕顶部的挂点 rotate 摇摆，齿轮持续旋转，下载箭头上下 translate 跳动，爱心用 scale 模拟心跳。transform-origin（旋转中心）选得好，动作才自然。指针悬停的图标会高亮。',
  formula: '摆角 = 幅度 · sin(5t) · 包络(t)', formula2: '心跳缩放 = 1 + 0.8 · 幅度/180 · |sin 3t|⁶',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(k.n, W, H); let cell = null;
    G.forEach((c, i) => {
      const z = (c.r * 2.3 * k.s) / 100, kind = IAK[i % 6], hov = inCell(P, c);
      ctx.fillStyle = hsla(k.hue, 30, hov ? 20 : 11); ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(z * 0.62, 6), 0, TAU); ctx.fill();
      IA(ctx, kind, c.x, c.y, z, t + i * 0.4, k.x, hsla(k.hue + i * 30, 85, hov ? 75 : 64));
      if (hov) cell = `第 ${i + 1} 个「${IAN[kind]}」`;
    });
    return { mode: `摆动幅度 ${Math.round(k.x)}°`, cell };
  } });

FAM.smil = sFam({ title: 'SMIL/CSS 动画', count: NC('动画元素数', 1, 12, 6), extra: R('dur', 'dur 时长', 0.5, 6, 0.1, 2), size: SZ('圆点半径', 10, 100, 55), color: '#fb923c',
  countDoc: '有几个 <circle> 元素各自带着 <animate> 动画', extraDoc: 'dur 属性：一次动画循环的秒数', sizeDoc: '圆点基础半径 r（占格子的百分比）',
  presets: { 单个: { count: 1 }, 一排: { count: 12 }, 快: { dur: 0.6 }, 慢: { dur: 5.5 }, 大圆: { size: 95 } },
  explain: 'SMIL 是写在 SVG 里的声明式动画：在 <circle> 里放一个 <animate attributeName="r" values="r;1.6r;r" dur="2s" begin="0.3s" repeatCount="indefinite"/>，浏览器就会自动按关键帧插值属性，不用写 JS。这里每个圆点同时动画半径 r、纵坐标 cy 和颜色 fill，第 i 个的 begin 比前一个晚 dur/n 秒，排成一列波浪。',
  formula: '值(t) = 关键帧插值(values, (t − begin) / dur)', formula2: 'beginᵢ = i · dur / n',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, dur = k.x, G = grid(n, W, H); let cell = null, r0 = 0;
    G.forEach((c, i) => {
      const ph = fract((t - (i * dur) / n) / dur), f = 0.5 - 0.5 * Math.cos(TAU * ph), r = (c.r * 0.6 * k.s) / 100, rr = r * (1 + 0.6 * f); if (!i) r0 = rr;
      ctx.fillStyle = hsla(k.hue + f * 60, 85, 50 + f * 15, 0.35 + 0.65 * f); ctx.beginPath(); ctx.arc(c.x, c.y + c.r * 0.35 - f * c.r * 0.7, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = hsla(k.hue, 60, 70, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c.x, c.y + c.r * 0.35, r, 0, TAU); ctx.stroke();
      if (!cell && inCell(P, c)) cell = `第 ${i + 1} 个 circle：r = ${Math.round(rr)}，begin = ${fmt((i * dur) / n, 2)}s`;
    });
    const fs = clamp(W / 52, 9, 13); text(ctx, `<animate attributeName="r" dur="${fmt(dur, 1)}s" repeatCount="indefinite"/>`, W / 2, 24, { size: fs, col: hsla(k.hue, 70, 75, 0.8), align: 'center' });
    return { mode: `dur = ${fmt(dur, 1)}s · 第 1 个 r = ${Math.round(r0)}`, cell };
  } });

const DSH = ['circle', 'hex', 'wave'];
FAM.dash = sFam({ title: '虚线流转', count: NC('虚线段数', 2, 40, 12), extra: R('gap', '间隙比例', 0.1, 0.9, 0.02, 0.4), size: SZ('线宽', 1, 20, 6, 0.5), color: '#22d3ee',
  countDoc: '每条路径被分成多少段虚线', extraDoc: '每段里空白所占的比例', sizeDoc: '虚线的粗细',
  presets: { 少段: { count: 3 }, 密集: { count: 40 }, 细缝: { gap: 0.12 }, 点点: { gap: 0.85 }, 粗线: { size: 18 } },
  explain: '虚线流转：stroke-dasharray="a b" 让线条按「a 长的实线、b 长的空白」重复。只要让 stroke-dashoffset 随时间不断增加，虚线图案就会沿着路径「流动」，常用来表示数据流、加载中和选中框（蚂蚁线）。中间那条路径反向流动。',
  formula: 'a = (L/n)·(1 − 间隙)，b = (L/n)·间隙', formula2: 'dashoffset = ±1.2 · t · L/n',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(3, W, H); let cell = null, a0 = 0, b0 = 0; ctx.lineCap = 'butt';
    G.forEach((c, i) => {
      const s = shape(DSH[i], c.x, c.y, c.r * 1.1), seg = s.L / k.n, a = seg * (1 - k.x), b = seg * k.x; if (!i) { a0 = a; b0 = b; }
      ctx.lineWidth = k.s; ctx.strokeStyle = hsla(k.hue, 50, 50, 0.12); ctx.stroke(s.p);
      ctx.strokeStyle = hsla(k.hue + i * 40, 85, 62); ctx.setLineDash([a, b]); ctx.lineDashOffset = (i === 1 ? 1 : -1) * t * seg * 1.2; ctx.stroke(s.p); ctx.setLineDash([]);
      const d = minDist(P, s.pts); if (!cell && d < c.r * 0.3) cell = `第 ${i + 1} 条「${SHN[DSH[i]]}」${i === 1 ? '反向' : '正向'}流动，距 ${Math.round(d)}px`;
    });
    ctx.lineDashOffset = 0;
    return { mode: `dasharray = ${Math.round(a0)} ${Math.round(b0)}（第 1 条）`, cell };
  } });

const DTX = '文字描边SVG动画LINE';
const LAY = new Map();
function layout(ctx, chars, fs, W, H) {
  const key = `${chars.join('')}|${fs}|${W}|${H}`; if (LAY.has(key)) return LAY.get(key);
  ctx.save(); ctx.font = FONT(fs); const ws = chars.map((c) => ctx.measureText(c).width); ctx.restore();
  const rows = []; let row = [], rw = 0;
  chars.forEach((c, i) => { if (rw + ws[i] > W * 0.9 && row.length) { rows.push([row, rw]); row = []; rw = 0; } row.push(i); rw += ws[i]; });
  if (row.length) rows.push([row, rw]);
  const lh = fs * 1.2, y0 = 8 + (H - 8) / 2 - (rows.length * lh) / 2 + lh / 2, g = [];
  rows.forEach(([r, w], li) => { let x = W / 2 - w / 2; r.forEach((i) => { g.push({ ch: chars[i], x: x + ws[i] / 2, y: y0 + li * lh }); x += ws[i]; }); });
  if (LAY.size > 100) LAY.clear(); LAY.set(key, g); return g;
}
FAM.drawtext = sFam({ title: '文字描边', count: NC('字数', 2, 13, 8), extra: R('fill', '填充延迟', 0, 2, 0.05, 0.6), size: SZ('字号', 24, 150, 88), color: '#f59e0b',
  countDoc: '参与描边动画的字数', extraDoc: '描边画完后，再等几秒开始填充颜色', sizeDoc: '文字大小（像素），放不下会自动换行',
  presets: { 两字: { count: 2 }, 全部: { count: 13 }, 立即填充: { fill: 0 }, 慢填充: { fill: 1.9 }, 大字: { size: 146 } },
  explain: '文字描边：SVG 的 <text> 也可以只画轮廓（fill="none" + stroke）。给轮廓加上 stroke-dasharray，让 dashoffset 从大变小，字的笔画轮廓就会被一笔笔描出来；描完后等待「填充延迟」秒，再把 fill 的透明度从 0 渐变到 1。每个字比前一个晚 0.12 秒开始。',
  formula: '描边进度ᵢ = 缓动((t − 0.12i) / 1.5)', formula2: '填充透明度ᵢ = 缓动((t − 0.12i − 1.5 − 填充延迟) / 0.5)',
  draw(ctx, W, H, t, C, P, k) {
    const chars = [...(getLang() === 'en' ? 'SVG STROKE FX' : DTX)].slice(0, k.n), fs = k.s, g = layout(ctx, chars, fs, W, H), T0 = 1.5 + k.n * 0.12 + k.x + 0.5 + 1.2 + 0.6, ph = ((t % T0) + T0) % T0, out = 1 - smooth((ph - (T0 - 0.6)) / 0.6), Lg = fs * 6;
    ctx.font = FONT(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, fs / 40); let sum = 0, cell = null, bd = 1e9;
    g.forEach((q, i) => {
      const p = smooth((ph - i * 0.12) / 1.5), fa = smooth((ph - i * 0.12 - 1.5 - k.x) / 0.5); sum += p;
      ctx.globalAlpha = out * fa; ctx.fillStyle = hsla(k.hue + i * 12, 85, 60); ctx.fillText(q.ch, q.x, q.y);
      ctx.globalAlpha = out; ctx.strokeStyle = hsla(k.hue + i * 12, 90, 72); ctx.setLineDash([p * Lg + 0.01, Lg]); ctx.strokeText(q.ch, q.x, q.y);
      const d = Math.hypot(q.x - P.x, q.y - P.y); if (d < bd) { bd = d; cell = `第 ${i + 1} 个字「${q.ch}」：描边 ${Math.round(p * 100)}%，填充 ${Math.round(fa * 100)}%`; }
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    return { mode: `填充延迟 ${fmt(k.x, 2)} 秒 · 描边 ${Math.round((sum / Math.max(1, g.length)) * 100)}%`, cell: bd < fs ? cell : `最近的字距指针 ${Math.round(bd)}px` };
  } });

FAM.ring = sFam({ title: '环形进度', count: NC('环数', 1, 6, 3), extra: R('target', '目标进度', 0, 100, 1, 72), size: SZ('环宽', 2, 30, 12), color: '#4ade80',
  countDoc: '同心圆环的个数，每个环代表一个指标', extraDoc: '最外环最终要到达的百分比（内环依次略少）', sizeDoc: '圆环的描边宽度 stroke-width',
  presets: { 单环: { count: 1 }, 六环: { count: 6 }, 满格: { target: 100 }, 少量: { target: 15 }, 粗环: { size: 28 } },
  explain: '环形进度：圆环其实是一个 <circle>，周长 C = 2πr。把 stroke-dasharray 设为 C，stroke-dashoffset = C·(1 − 进度)，就只露出进度对应的那段弧；再把圆旋转 −90°，让进度从 12 点钟方向开始。多个同心环分别表示不同指标，中心数字显示外环的当前值。',
  formula: 'dashoffset = 2πr · (1 − 进度)', formula2: '进度(t) = 目标 · (1 − (1 − t/1.6)³)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gap = Math.min(k.s * 1.6, k.R / n), lw = Math.min(k.s, gap * 0.85), ph = ((t % 4) + 4) % 4, e = (1 - Math.pow(1 - clamp(ph / 1.6, 0, 1), 3)) * (1 - smooth((ph - 3.4) / 0.6));
    const dP = Math.hypot(P.x - k.cx, P.y - k.cy); let v0 = 0, cell = null; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = k.R - i * gap, tg = k.x * (1 - i * 0.13), v = tg * e; if (!i) v0 = v;
      ctx.lineWidth = lw; ctx.strokeStyle = hsla(k.hue + i * 35, 40, 40, 0.25); ctx.beginPath(); ctx.arc(k.cx, k.cy, r, 0, TAU); ctx.stroke();
      if (v > 0.2) { ctx.strokeStyle = hsla(k.hue + i * 35, 85, 60); ctx.beginPath(); ctx.arc(k.cx, k.cy, r, -Math.PI / 2, -Math.PI / 2 + (TAU * v) / 100); ctx.stroke(); }
      if (Math.abs(dP - r) < lw / 2 + 3) cell = `第 ${i + 1} 环：${Math.round(v)}%（目标 ${Math.round(tg)}%）`;
    }
    ctx.strokeStyle = hsla(k.hue, 50, 70, 0.35); ctx.lineWidth = 1.5;
    for (let j = 0; j < 20; j++) { const a = (TAU * j) / 20, r1 = k.R + lw / 2 + 4, r2 = r1 + (j % 5 ? 4 : 9); ctx.beginPath(); ctx.moveTo(k.cx + Math.cos(a) * r1, k.cy + Math.sin(a) * r1); ctx.lineTo(k.cx + Math.cos(a) * r2, k.cy + Math.sin(a) * r2); ctx.stroke(); }
    const inner = k.R - (n - 1) * gap - lw; if (inner > 14) text(ctx, `${Math.round(v0)}%`, k.cx, k.cy, { size: clamp(inner * 0.6, 10, 64), col: '#f8fafc', align: 'center', bold: true });
    if (!cell) { const ang = ((Math.atan2(P.y - k.cy, P.x - k.cx) + Math.PI / 2 + TAU) % TAU) * (180 / Math.PI); cell = `指针方向 ${Math.round(ang)}° 对应进度 ${Math.round(ang / 3.6)}%`; }
    return { mode: `目标 ${Math.round(k.x)}% · 外环当前 ${Math.round(v0)}%`, cell };
  } });

FAM['filter-svg'] = sFam({ title: 'SVG 滤镜', count: NC('模糊半径', 0, 20, 6), extra: R('hue', '色相旋转', 0, 360, 5, 0), size: SZ('圆点半径', 20, 100, 60), color: '#e879f9',
  countDoc: 'feGaussianBlur 的 stdDeviation：模糊扩散的像素半径', extraDoc: 'feColorMatrix type="hueRotate" 的角度', sizeDoc: '圆点占面板的百分比',
  presets: { 清晰: { count: 0 }, 很糊: { count: 20 }, 转色: { hue: 180 }, 大圆: { size: 100 } },
  explain: 'SVG 滤镜：<filter> 里可以串联多个滤镜原语。feGaussianBlur 按 stdDeviation 做高斯模糊；feColorMatrix type="hueRotate" 把所有颜色在色环上转一个角度。第一块面板是「模糊 + 色相旋转」；第二块是经典的「粘滞（gooey）」效果：先模糊，再大幅提高对比度，靠近的圆点就会像液体一样粘在一起。指针进入面板时会带走一个圆点。',
  formula: '模糊：像素 = Σ 邻居 · 高斯权重(σ = 模糊半径)', formula2: '粘滞：颜色 = 18 · 模糊后 − 7（对比度阈值）',
  draw(ctx, W, H, t, C, P, k, st) {
    const G = grid(2, W, H), b = k.n, hr = k.x; let cell = null;
    const dots = (c, rr) => Array.from({ length: 5 }, (_, j) => { const a = t * 0.9 + (j * TAU) / 5, m = 0.55 * (0.55 + 0.45 * Math.sin(t * 1.3 + j * 2)); return { x: c.x + Math.cos(a) * rr * m, y: c.y + Math.sin(a * 1.3) * rr * m, j }; });
    G.forEach((c, pi) => {
      const rr = c.r * 1.25, dr = (rr * 0.32 * k.s) / 100 + 3, D = dots(c, rr), hov = inCell(P, c, 1.3);
      if (hov) { D[0].x = P.x; D[0].y = P.y; cell = pi ? `粘滞面板：模糊 ${b}px 后阈值化` : `模糊 + 色相面板：σ = ${b}，旋转 ${Math.round(hr)}°`; }
      ctx.fillStyle = hsla(k.hue, 25, 9); rrect(ctx, c.x - rr * 1.05, c.y - rr * 1.05, rr * 2.1, rr * 2.1, 12); ctx.fill();
      if (!pi) {
        ctx.save(); ctx.filter = `blur(${b}px) hue-rotate(${hr}deg)`;
        D.forEach((d) => { ctx.fillStyle = hsla(k.hue + d.j * 40, 85, 60); ctx.beginPath(); ctx.arc(d.x, d.y, dr, 0, TAU); ctx.fill(); });
        ctx.restore();
      } else {
        const S2 = Math.ceil(rr * 2.1), o = (st.o ||= document.createElement('canvas')); if (o.width !== S2) { o.width = S2; o.height = S2; }
        const x = o.getContext('2d'), ox = c.x - rr * 1.05, oy = c.y - rr * 1.05; x.filter = 'none'; x.fillStyle = '#000'; x.fillRect(0, 0, S2, S2); x.filter = `blur(${b}px)`;
        D.forEach((d) => { x.fillStyle = hsla(k.hue + hr, 90, 55); x.beginPath(); x.arc(d.x - ox, d.y - oy, dr, 0, TAU); x.fill(); }); x.filter = 'none';
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'contrast(18) brightness(0.9)'; ctx.drawImage(o, ox, oy); ctx.restore();
      }
      text(ctx, pi ? 'gooey：blur → contrast' : 'feGaussianBlur + hueRotate', c.x, c.y + rr * 1.05 - 10, { size: clamp(W / 60, 9, 12), col: hsla(k.hue, 50, 75, 0.8), align: 'center' });
    });
    return { mode: `stdDeviation = ${b} · hueRotate = ${Math.round(hr)}°`, cell };
  } });

FAM.mask = sFam({ title: '遮罩', count: NC('遮罩孔数', 1, 8, 3), extra: R('feather', '边缘羽化', 0, 60, 1, 16), size: SZ('孔半径', 20, 160, 70), color: '#60a5fa',
  countDoc: '幕布上沿轨道移动的圆孔数量（指针处另有一个）', extraDoc: '孔边缘从完全透明到完全遮挡的过渡宽度（像素）', sizeDoc: '每个圆孔的半径（像素）',
  presets: { 单孔: { count: 1 }, 八孔: { count: 8 }, 硬边: { feather: 0 }, 柔边: { feather: 58 }, 大孔: { size: 155 } },
  explain: '遮罩：<mask> 里白色区域让下面的内容显示、黑色区域把它挡住，灰色则半透明。这里在一层深色幕布上「挖」出几个圆孔（mask 中的白色圆，边缘用径向渐变羽化），圆孔沿轨道移动，指针处也有一个孔，透过孔能看到下面流动的彩色条纹。clipPath 则只能做硬边裁剪，没有半透明过渡。',
  formula: '显示 = 内容 · 遮罩亮度（0 ~ 1）', formula2: '羽化：亮度 = 1 − 缓动((d − (r − f)) / f)',
  draw(ctx, W, H, t, C, P, k, st) {
    const bw = Math.max(24, W / 14), off = (t * 30) % (bw * 2);
    for (let j = -2; j < W / bw + H / bw + 2; j++) { const x = j * bw - off; ctx.fillStyle = hsla(k.hue + j * 22, 80, 55); ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + bw, 8); ctx.lineTo(x + bw - H * 0.6, H); ctx.lineTo(x - H * 0.6, H); ctx.closePath(); ctx.fill(); }
    text(ctx, 'MASK 遮罩', k.cx, k.cy, { size: clamp(W / 7, 28, 120), col: 'rgba(255,255,255,.9)', align: 'center', bold: true });
    const m = (st.m ||= document.createElement('canvas')); if (m.width !== Math.ceil(W) || m.height !== Math.ceil(H)) { m.width = Math.ceil(W); m.height = Math.ceil(H); }
    const x = m.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, m.width, m.height); x.fillStyle = 'rgba(6,10,20,0.95)'; x.fillRect(0, 0, m.width, m.height); x.globalCompositeOperation = 'destination-out';
    const r = k.s, f = k.x, holes = [];
    for (let j = 0; j < k.n; j++) { const a = t * 0.6 + (j * TAU) / k.n, orr = k.R * 0.8 * (0.7 + 0.3 * Math.sin(t * 0.8 + j)); holes.push([k.cx + Math.cos(a) * orr * (W > H ? 1.4 : 1), k.cy + Math.sin(a) * orr]); }
    holes.push([P.x, P.y]);
    holes.forEach(([hx, hy]) => { const g = x.createRadialGradient(hx, hy, Math.min(r - 0.5, Math.max(0, r - f)), hx, hy, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(hx, hy, r, 0, TAU); x.fill(); });
    ctx.drawImage(m, 0, 0, W, H);
    let nd = 1e9; holes.slice(0, -1).forEach(([hx, hy]) => { nd = Math.min(nd, Math.hypot(hx - P.x, hy - P.y)); });
    return { mode: `${k.n + 1} 个孔 · 半径 ${Math.round(r)}px · 羽化 ${Math.round(f)}px`, cell: `指针处有一个孔；最近的轨道孔距 ${Math.round(nd)}px` };
  } });

FAM.follow = sFam({ title: '路径跟随', count: NC('跟随物数', 1, 16, 6), extra: R('gap', '间隔', 0.01, 0.2, 0.005, 0.06), size: SZ('物体大小', 4, 40, 14), color: '#f87171',
  countDoc: '沿路径排队移动的物体个数', extraDoc: '相邻两个物体之间相隔路径总长的几分之几', sizeDoc: '箭头的大小（像素）',
  presets: { 单个: { count: 1 }, 长队: { count: 16 }, 紧贴: { gap: 0.015 }, 分散: { gap: 0.19 }, 大箭头: { size: 38 } },
  explain: '路径跟随：<animateMotion path="…" rotate="auto"> 让元素沿着路径移动，并按路径的切线方向自动转向。原理是用 getPointAtLength(进度 · L) 取路径上的点，再用前后两点算出切线角度。多个物体用同一条路径、错开固定的「间隔」，就排成了一列队伍。',
  formula: '位置ᵢ = getPointAtLength(L · fract(0.12t − i · 间隔))', formula2: '朝向角 = atan2(dy, dx)（切线方向）',
  draw(ctx, W, H, t, C, P, k) {
    const s = shape('inf', k.cx, k.cy, Math.min((W * 0.44) / 1.15, ((H - 30) * 0.44) / 0.55)); let cell = null, bd = 1e9, lead = 0;
    ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = hsla(k.hue, 50, 60, 0.35); ctx.stroke(s.p); ctx.setLineDash([]);
    for (let i = 0; i < k.n; i++) {
      const f = fract(t * 0.12 - i * k.x), q = along(s, f), z = k.s * (i ? 1 : 1.3); if (!i) lead = f;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.fillStyle = hsla(k.hue + i * 18, 85, i ? 62 : 72); ctx.beginPath(); ctx.moveTo(z, 0); ctx.lineTo(-z * 0.7, -z * 0.6); ctx.lineTo(-z * 0.35, 0); ctx.lineTo(-z * 0.7, z * 0.6); ctx.closePath(); ctx.fill(); ctx.restore();
      const d = Math.hypot(q.x - P.x, q.y - P.y); if (d < bd) { bd = d; cell = `第 ${i + 1} 个：进度 ${Math.round(f * 100)}%，朝向 ${Math.round((q.a * 180) / Math.PI)}°`; }
    }
    return { mode: `间隔 ${fmt(k.x * 100, 1)}% 路径长 · 领头进度 ${Math.round(lead * 100)}%`, cell: bd < k.s * 3 ? cell : `最近的物体距指针 ${Math.round(bd)}px` };
  } });

FAM['blob-svg'] = sFam({ title: 'SVG Blob', count: NC('控制点数', 3, 16, 7), extra: R('amp', '起伏幅度', 0, 0.6, 0.01, 0.25), size: SZ('图形半径', 20, 100, 80), color: '#c084fc',
  countDoc: '圆周上用来控制形状的点数；越多越复杂', extraDoc: '每个点的半径上下起伏的比例', sizeDoc: '图形占画面的百分比',
  presets: { 三点: { count: 3 }, 多点: { count: 16 }, 平静: { amp: 0.03 }, 狂野: { amp: 0.58 }, 小图: { size: 30 } },
  explain: 'SVG Blob（有机形）：在圆周上均匀放 n 个控制点，每个点的半径随时间用两条正弦波起伏；再用 Catmull-Rom 样条把这些点转换成一串三次贝塞尔曲线（path 里的 C 命令），得到光滑、像果冻一样蠕动的形状。指针靠近会把边缘按进去。',
  formula: 'rᵢ = R · (1 + 幅度 · (0.6 sin(0.9t + 1.7i) + 0.4 sin(1.7t + 3.1i)))', formula2: '贝塞尔控制点 = Pᵢ ± (Pᵢ₊₁ − Pᵢ₋₁) / 6',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, R0 = (k.R * k.s) / 100, pts = []; let dent = 0;
    for (let i = 0; i < n; i++) { const a = (TAU * i) / n - Math.PI / 2; let r = R0 * (1 + k.x * (0.6 * Math.sin(t * 0.9 + i * 1.7) + 0.4 * Math.sin(t * 1.7 + i * 3.1))); const px = k.cx + Math.cos(a) * r, py = k.cy + Math.sin(a) * r, d = Math.hypot(px - P.x, py - P.y); if (d < R0 * 0.6) { r -= (1 - d / (R0 * 0.6)) * R0 * 0.25; dent++; } pts.push([k.cx + Math.cos(a) * r, k.cy + Math.sin(a) * r]); }
    const cp = []; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]; cp.push([p1, c1], [p2, c2]); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]); }
    ctx.closePath(); const g = ctx.createRadialGradient(k.cx - R0 * 0.3, k.cy - R0 * 0.3, R0 * 0.1, k.cx, k.cy, R0 * 1.4); g.addColorStop(0, hsla(k.hue + 40, 90, 72)); g.addColorStop(1, hsla(k.hue - 30, 80, 42));
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = hsla(k.hue, 90, 85, 0.8); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; cp.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    ctx.fillStyle = '#fff'; pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); });
    return { mode: `d = "M${Math.round(pts[0][0])} ${Math.round(pts[0][1])} C…" · ${n} 段贝塞尔 · 幅度 ${fmt(k.x, 2)}`, cell: dent ? `指针按下了 ${dent} 个控制点` : `指针距中心 ${Math.round(Math.hypot(P.x - k.cx, P.y - k.cy))}px` };
  } });

FAM['chart-draw'] = sFam({ title: '图表描出', count: NC('数据点数', 3, 30, 12), extra: R('area', '面积透明度', 0, 1, 0.02, 0.35), size: SZ('线宽', 1, 10, 3, 0.5), color: '#2dd4bf',
  countDoc: '折线上有多少个数据点', extraDoc: '折线下方面积填充的不透明度；0 只有折线', sizeDoc: '折线的粗细',
  presets: { 少点: { count: 3 }, 多点: { count: 30 }, 纯折线: { area: 0 }, 实面积: { area: 0.95 }, 粗线: { size: 9 } },
  explain: '图表描出：折线图本质是一条 <polyline> / <path>，面积图是在折线下方补成封闭区域再填充。先用 dashoffset 让折线从左往右画出来，同时用一个逐渐变宽的 clipPath 露出下面的面积，数据点在折线经过时依次弹出。每 5 秒换一组数据。',
  formula: 'xᵢ = 左边距 + i · 宽 / (n − 1)，yᵢ = 底边 − 值ᵢ · 高', formula2: '画出比例 p = 缓动(t / 2)，clip 宽 = p · 宽',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, x0 = W * 0.08, x1 = W * 0.94, y0 = 8 + (H - 8) * 0.12, y1 = H - 22, seed = Math.floor(t / 5), ph = ((t % 5) + 5) % 5, p = smooth(ph / 2), out = 1 - smooth((ph - 4.5) / 0.5);
    const V = Array.from({ length: n }, (_, i) => clamp(0.5 + 0.3 * Math.sin(i * 0.7 + seed * 1.9) + 0.35 * (hh(i, seed) - 0.5), 0.05, 0.97)), X = (i) => x0 + (i * (x1 - x0)) / Math.max(1, n - 1), Y = (v) => y1 - v * (y1 - y0);
    ctx.strokeStyle = 'rgba(148,163,184,.15)'; ctx.lineWidth = 1; for (let j = 0; j <= 4; j++) { const y = lerp(y0, y1, j / 4); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    const path = new Path2D(); let L = 0; V.forEach((v, i) => { if (i) { L += Math.hypot(X(i) - X(i - 1), Y(v) - Y(V[i - 1])); path.lineTo(X(i), Y(v)); } else path.moveTo(X(i), Y(v)); });
    ctx.globalAlpha = out;
    if (k.x > 0.01) { ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, (x1 - x0) * p, H); ctx.clip(); const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, hsla(k.hue, 80, 55, k.x)); g.addColorStop(1, hsla(k.hue, 80, 55, 0)); ctx.fillStyle = g; ctx.beginPath(); V.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.lineTo(X(n - 1), y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.lineWidth = k.s; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = hsla(k.hue, 85, 62); dashSeg(ctx, { p: path, L }, 0, p);
    V.forEach((v, i) => { const sc = backE(clamp((p * (n - 1) - i) * 2 + 0.5, 0, 1), 2); if (sc <= 0.01) return; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(i), Y(v), (k.s + 2.5) * sc, 0, TAU); ctx.fill(); });
    ctx.globalAlpha = 1;
    const ni = clamp(Math.round(((P.x - x0) / (x1 - x0)) * (n - 1)), 0, n - 1);
    ctx.strokeStyle = hsla(k.hue, 60, 75, 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(ni), y0); ctx.lineTo(X(ni), y1); ctx.stroke();
    return { mode: `第 ${seed + 1} 组数据 · 已画出 ${Math.round(p * 100)}%`, cell: `第 ${ni + 1} 个点：值 ${Math.round(V[ni] * 100)}` };
  } });

const SYM = new Path2D('M0 -1 C .12 -.12 .12 -.12 1 0 C .12 .12 .12 .12 0 1 C -.12 .12 -.12 .12 -1 0 C -.12 -.12 -.12 -.12 0 -1 Z');
FAM.sprite = sFam({ title: '图标精灵', count: NC('每行个数', 2, 10, 5), extra: R('step', '色相步进', 0, 60, 1, 24), size: SZ('图标大小', 20, 100, 70), color: '#fbbf24',
  countDoc: '每一行放几个 <use> 实例（行数按画面高度自动计算）', extraDoc: '相邻实例之间的色相差（度）', sizeDoc: '每个实例占格子的百分比',
  presets: { 稀疏: { count: 2 }, 密集: { count: 10 }, 同色: { step: 0 }, 彩虹: { step: 58 }, 大图标: { size: 100 } },
  explain: '图标精灵：在 <defs> 里用 <symbol id="icon"> 定义一次图形，再用很多个 <use href="#icon"> 在不同位置复用它；每个 <use> 可以有自己的 transform 和颜色（通过 currentColor 传入）。改一处定义，所有实例都会跟着变。这里每个实例错开时间做旋转和缩放，颜色按序号递增色相，指针悬停的实例会放大。',
  formula: '实例ᵢ = use(#icon, translate(xᵢ, yᵢ) rotate(θᵢ) scale(sᵢ))', formula2: '色相ᵢ = 主色 + i · 色相步进',
  draw(ctx, W, H, t, C, P, k) {
    const cols = k.n, cw = W / cols, rows = Math.max(1, Math.round((H - 20) / cw)), ch = (H - 20) / rows, tot = cols * rows; let cell = null;
    for (let i = 0; i < tot; i++) {
      const x = ((i % cols) + 0.5) * cw, y = 12 + (Math.floor(i / cols) + 0.5) * ch, z = (Math.min(cw, ch) * 0.45 * k.s) / 100, hov = Math.abs(P.x - x) < cw / 2 && Math.abs(P.y - y) < ch / 2;
      const th = Math.sin(t * 1.5 - i * 0.25) * 0.6, sc = (0.85 + 0.15 * Math.sin(t * 2 - i * 0.3)) * (hov ? 1.35 : 1), hu = k.hue + i * k.x;
      ctx.save(); ctx.translate(x, y); ctx.rotate(th); ctx.scale(z * sc, z * sc); ctx.fillStyle = hsla(hu, 85, 62); ctx.fill(SYM); ctx.lineWidth = 0.06; ctx.strokeStyle = hsla(hu, 80, 80, 0.6); ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, TAU); ctx.stroke(); ctx.restore();
      if (hov) cell = `第 ${i + 1} 个 <use>：色相 ${Math.round(((hu % 360) + 360) % 360)}°，缩放 ${fmt(sc, 2)}`;
    }
    return { mode: `${tot} 个 <use> 共享 1 个 symbol · 步进 ${Math.round(k.x)}°`, n: `${cols}（共 ${tot} 个）`, cell };
  } });

function wrapStops(g, n, t, hue) {
  const S = Array.from({ length: n }, (_, i) => ({ o: fract(i / n + 0.15 * t), h: hue + (i * 300) / n })).sort((a, b) => a.o - b.o);
  const f = S[0], l = S[S.length - 1], span = f.o + 1 - l.o, w = span > 1e-4 ? (1 - l.o) / span : 0, h0 = lerp(l.h, f.h + (f.h < l.h ? 0 : 0), w);
  g.addColorStop(0, hsla(h0, 85, 60)); S.forEach((s) => g.addColorStop(clamp(s.o, 0, 1), hsla(s.h, 85, 60))); g.addColorStop(1, hsla(h0, 85, 60));
}
FAM['gradient-svg'] = sFam({ title: '渐变动画', count: NC('色标数', 2, 8, 4), extra: R('angle', '渐变角度', 0, 360, 1, 30), size: SZ('线宽', 2, 40, 14), color: '#f43f5e',
  countDoc: '渐变里 <stop> 色标的个数', extraDoc: '线性渐变的方向角（度）', sizeDoc: '渐变圆环的描边宽度',
  presets: { 双色: { count: 2 }, 八色: { count: 8 }, 竖向: { angle: 90 }, 反向: { angle: 210 }, 粗环: { size: 38 } },
  explain: '渐变动画：<linearGradient> 由若干 <stop offset="…" stop-color="…"/> 组成，x1,y1 → x2,y2 决定方向；<radialGradient> 则从中心向外扩散。让 stop 的 offset 随时间移动，渐变就会流动起来。三个示例：线性渐变填充的圆角矩形、渐变描边的圆环（方向随时间转动）、呼吸的径向渐变。',
  formula: 'offsetᵢ = fract(i / n + 0.15t)', formula2: '方向 = (cos 角度, sin 角度)',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(3, W, H), n = k.n, an = (k.x * Math.PI) / 180; let cell = null;
    G.forEach((c, i) => {
      const r = c.r * 1.15; let g;
      if (i === 0) { const dx = Math.cos(an) * r, dy = Math.sin(an) * r; g = ctx.createLinearGradient(c.x - dx, c.y - dy, c.x + dx, c.y + dy); wrapStops(g, n, t, k.hue); ctx.fillStyle = g; rrect(ctx, c.x - r, c.y - r * 0.7, r * 2, r * 1.4, r * 0.2); ctx.fill(); }
      else if (i === 1) { const a2 = an + t * 0.7, dx = Math.cos(a2) * r, dy = Math.sin(a2) * r; g = ctx.createLinearGradient(c.x - dx, c.y - dy, c.x + dx, c.y + dy); wrapStops(g, n, t, k.hue); ctx.strokeStyle = g; ctx.lineWidth = k.s; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.8, 0, TAU); ctx.stroke(); }
      else { const rr = r * (0.85 + 0.15 * Math.sin(t * 2)); g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rr); wrapStops(g, n, t, k.hue); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.fill(); }
      if (inCell(P, c)) cell = ['线性渐变填充（linearGradient）', '渐变描边圆环（stroke 用渐变）', '径向渐变呼吸（radialGradient）'][i];
    });
    return { mode: `${n} 个 stop · 角度 ${Math.round(k.x)}°`, cell };
  } });

FAM['line-draw'] = sFam({ title: '线条生长', count: NC('线条数', 3, 48, 16), extra: R('bend', '弯曲度', 0, 1, 0.02, 0.4), size: SZ('线宽', 0.5, 10, 2.5, 0.5), color: '#84cc16',
  countDoc: '从中心向外生长的线条数量', extraDoc: '曲线偏离直线的程度；0 为直线', sizeDoc: '线条的粗细',
  presets: { 少线: { count: 3 }, 密集: { count: 48 }, 直线: { bend: 0 }, 大弯: { bend: 0.98 }, 粗线: { size: 9 } },
  explain: '线条生长：每条线是一条二次贝塞尔曲线 <path d="M 中心 Q 控制点 终点">。先量出长度 L，再用 dashoffset 从 L 变到 0，让它从中心「长」出来；第 i 条比前一条晚 0.04 秒开始，长满后再从根部收回。弯曲度控制控制点偏离直线的距离；指针会把附近的线端吸过去。',
  formula: '终点ᵢ = 中心 + R · (cos θᵢ, sin θᵢ)，θᵢ = 2πi / n', formula2: '控制点 = 中点 + 弯曲度 · R/2 · 法向量',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, ph = ((t % 4.5) + 4.5) % 4.5; let sum = 0, pulled = 0; ctx.lineCap = 'round'; ctx.lineWidth = k.s;
    for (let i = 0; i < n; i++) {
      const th = (TAU * i) / n + t * 0.1, R1 = k.R * (0.75 + 0.25 * hh(i, 3)); let ex = k.cx + Math.cos(th) * R1 * (W > H ? 1.3 : 1), ey = k.cy + Math.sin(th) * R1;
      const dP = Math.hypot(ex - P.x, ey - P.y), pull = Math.max(0, 1 - dP / (k.R * 0.5)) * 0.4; if (pull > 0.05) pulled++; ex += (P.x - ex) * pull; ey += (P.y - ey) * pull;
      const mx = (k.cx + ex) / 2, my = (k.cy + ey) / 2, nx = -(ey - k.cy), ny = ex - k.cx, nl = Math.hypot(nx, ny) || 1, qx = mx + (nx / nl) * k.x * R1 * 0.5, qy = my + (ny / nl) * k.x * R1 * 0.5;
      const p = new Path2D(); p.moveTo(k.cx, k.cy); p.quadraticCurveTo(qx, qy, ex, ey); let L = 0, px = k.cx, py = k.cy;
      for (let j = 1; j <= 10; j++) { const u = j / 10, x = (1 - u) * (1 - u) * k.cx + 2 * (1 - u) * u * qx + u * u * ex, y = (1 - u) * (1 - u) * k.cy + 2 * (1 - u) * u * qy + u * u * ey; L += Math.hypot(x - px, y - py); px = x; py = y; }
      const b = smooth((ph - i * 0.04) / 1.2), a = smooth((ph - 2.6 - i * 0.04) / 1.2); sum += b - a;
      ctx.strokeStyle = hsla(k.hue + (i * 120) / n, 80, 60); dashSeg(ctx, { p, L }, a, b);
    }
    ctx.fillStyle = hsla(k.hue, 85, 75); ctx.beginPath(); ctx.arc(k.cx, k.cy, 4 + k.s, 0, TAU); ctx.fill();
    return { mode: `弯曲度 ${fmt(k.x, 2)} · 已生长 ${Math.round((sum / n) * 100)}%`, cell: pulled ? `指针吸引了 ${pulled} 条线的末端` : '指针附近没有线端' };
  } });

FAM['check-morph'] = sFam({ title: '勾选变形', count: NC('复选框数', 1, 9, 4), extra: R('back', '回弹强度', 0, 1, 0.02, 0.5), size: SZ('框大小', 20, 100, 60), color: '#10b981',
  countDoc: '画面里复选框的数量', extraDoc: 'back 缓动的过冲程度；0 没有回弹', sizeDoc: '复选框占格子的百分比',
  presets: { 单个: { count: 1 }, 九宫格: { count: 9 }, 无回弹: { back: 0 }, 强回弹: { back: 1 }, 大框: { size: 100 } },
  explain: '勾选变形：复选框从「空心方框」变成「实心圆角 + 对勾」：圆角半径 rx 变大、填充从透明变成实色、对勾用 dashoffset 画出来。缩放使用回弹缓动（back easing），先超过 1 一点再回来，显得有弹性。指针悬停的框会被勾选。',
  formula: '缩放 = back(s) = 1 + (c+1)(s−1)³ + c(s−1)²，c = 3 · 回弹强度', formula2: '对勾可见长度 = L · 缓动((s − 0.4) / 0.6)',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(k.n, W, H); let cell = null, cnt = 0;
    G.forEach((c, i) => {
      const z = (c.r * 2.2 * k.s) / 100, hov = inCell(P, c), s = hov ? 1 : tog(t, 1.6, i), sc = 0.8 + 0.2 * backE(s, 3 * k.x), rx = lerp(0.12, 0.3, s) * z; if (s > 0.5) cnt++;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sc, sc);
      rrect(ctx, -z / 2, -z / 2, z, z, rx); ctx.fillStyle = hsla(k.hue, 75, 48, s); ctx.fill(); ctx.lineWidth = Math.max(2, z * 0.06); ctx.strokeStyle = hsla(k.hue, 70, 65); ctx.stroke();
      const cs = new Path2D(); cs.moveTo(-z * 0.26, 0); cs.lineTo(-z * 0.06, z * 0.2); cs.lineTo(z * 0.28, -z * 0.2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, z * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; dashSeg(ctx, { p: cs, L: z * 0.81 }, 0, smooth((s - 0.4) / 0.6));
      ctx.restore();
      if (hov) cell = `第 ${i + 1} 个：已勾选（s = ${fmt(s, 2)}）`;
    });
    return { mode: `回弹强度 ${fmt(k.x, 2)} · 已勾选 ${cnt}/${k.n}`, cell };
  } });

FAM['loader-svg'] = sFam({ title: 'SVG 加载弧', count: NC('弧段数', 1, 6, 3), extra: R('arc', '弧长比例', 0.05, 0.95, 0.01, 0.3), size: SZ('弧线宽', 1, 20, 6, 0.5), color: '#0ea5e9',
  countDoc: '同心旋转弧的个数', extraDoc: '每段弧占整圈周长的比例', sizeDoc: '弧线的粗细 stroke-width',
  presets: { 单弧: { count: 1 }, 六弧: { count: 6 }, 短弧: { arc: 0.08 }, 长弧: { arc: 0.9 }, 粗弧: { size: 18 } },
  explain: 'SVG 加载弧：一个 <circle> 只描出一段弧（dasharray = 弧长 + 剩余周长），再用 animateTransform 让它整体旋转；弧长同时随时间伸缩，就是 Material 风格的加载动画。多个同心弧以不同速度、相反方向旋转，指针靠近时外弧会加速。',
  formula: '弧长 = 周长 · 比例 · (0.6 + 0.4 sin 3t)', formula2: '转角ᵢ = (−1)ⁱ · (1 + 0.3i) · 2t',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gap = Math.min(k.s * 2.4, k.R / n), near = clamp(1 - Math.hypot(P.x - k.cx, P.y - k.cy) / (k.R * 1.3), 0, 1); let deg = 0; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = k.R - i * gap, rot = (i % 2 ? -1 : 1) * (1 + 0.3 * i) * 2 * t * (1 + (i ? 0 : near)), len = TAU * k.x * (0.6 + 0.4 * Math.sin(t * 3 + i)); if (!i) deg = ((rot * 180) / Math.PI) % 360;
      ctx.lineWidth = k.s; ctx.strokeStyle = hsla(k.hue + i * 30, 40, 40, 0.18); ctx.beginPath(); ctx.arc(k.cx, k.cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = hsla(k.hue + i * 30, 85, 62); ctx.beginPath(); ctx.arc(k.cx, k.cy, r, rot, rot + len); ctx.stroke();
    }
    text(ctx, `Loading ${Math.round(fract(t / 4) * 100)}%`, k.cx, k.cy, { size: clamp(k.R / 7, 10, 22), col: hsla(k.hue, 60, 80), align: 'center' });
    return { mode: `弧长比例 ${Math.round(k.x * 100)}% · 外弧转角 ${Math.round(deg)}°`, cell: near > 0.05 ? `指针靠近，外弧加速 ${Math.round(near * 100)}%` : '指针离加载器较远' };
  } });

const MMK = ['x', 'arrow', 'minus', 'xspin'];
const MMN = { x: '汉堡 → ✕', arrow: '汉堡 → 返回箭头', minus: '汉堡 → 减号', xspin: '汉堡 → 旋转 ✕' };
const MMB = {
  x: [[-0.3, -0.3, 0.3, 0.3], [0, 0, 0, 0], [-0.3, 0.3, 0.3, -0.3]],
  arrow: [[-0.38, 0, -0.06, -0.3], [-0.36, 0, 0.38, 0], [-0.38, 0, -0.06, 0.3]],
  minus: [[-0.38, 0, 0.38, 0], [-0.38, 0, 0.38, 0], [-0.38, 0, 0.38, 0]],
};
MMB.xspin = MMB.x;
const MMA = [[-0.38, -0.28, 0.38, -0.28], [-0.38, 0, 0.38, 0], [-0.38, 0.28, 0.38, 0.28]];
FAM['menu-morph'] = sFam({ title: '菜单变形', count: NC('图标数', 1, 8, 4), extra: R('bounce', '回弹强度', 0, 1, 0.02, 0.4), size: SZ('图标大小', 20, 100, 65), color: '#8b5cf6',
  countDoc: '画面中汉堡菜单图标的个数（四种变形轮流出现）', extraDoc: 'back 缓动的过冲程度；0 没有回弹', sizeDoc: '图标占格子的百分比',
  presets: { 单个: { count: 1 }, 全部: { count: 8 }, 无回弹: { bounce: 0 }, 强回弹: { bounce: 1 }, 大图标: { size: 100 } },
  explain: '菜单变形：汉堡菜单 ☰ 是三条 <line>。切换时，每条线的两个端点 (x1,y1)→(x2,y2) 分别插值到目标形状的端点：变成 ✕、返回箭头 ←、减号 −，或一边旋转一边变成 ✕。插值进度使用回弹缓动，线条会先冲过头再回到位，显得有弹性。指针悬停的图标保持在展开状态。',
  formula: '端点 = 汉堡端点 · (1 − e) + 目标端点 · e', formula2: 'e = back(s)，过冲系数 c = 3 · 回弹强度',
  draw(ctx, W, H, t, C, P, k) {
    const G = grid(k.n, W, H); let cell = null, cnt = 0;
    G.forEach((c, i) => {
      const z = (c.r * 2.3 * k.s) / 100, kind = MMK[i % 4], hov = inCell(P, c), s = hov ? 1 : tog(t, 1.5, i), e = backE(s, 3 * k.x); if (s > 0.5) cnt++;
      ctx.fillStyle = hsla(k.hue, 30, hov ? 20 : 12); rrect(ctx, c.x - z * 0.62, c.y - z * 0.62, z * 1.24, z * 1.24, z * 0.22); ctx.fill();
      ctx.save(); ctx.translate(c.x, c.y); if (kind === 'xspin') ctx.rotate(e * Math.PI); ctx.scale(z, z); ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.strokeStyle = hsla(k.hue + i * 25, 85, 68);
      MMA.forEach((A, j) => { const B = MMB[kind][j]; ctx.globalAlpha = kind !== 'minus' && kind !== 'arrow' && j === 1 ? 1 - s : 1; ctx.beginPath(); ctx.moveTo(lerp(A[0], B[0], e), lerp(A[1], B[1], e)); ctx.lineTo(lerp(A[2], B[2], e), lerp(A[3], B[3], e)); ctx.stroke(); });
      ctx.restore(); ctx.globalAlpha = 1;
      if (hov) cell = `第 ${i + 1} 个「${MMN[kind]}」：进度 ${Math.round(s * 100)}%`;
    });
    return { mode: `回弹强度 ${fmt(k.x, 2)} · ${cnt}/${k.n} 个已展开`, cell };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'draw');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'draw';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-svg',
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
