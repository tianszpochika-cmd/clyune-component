/**
 * kit-gsap — 15 canvas families that re-create GSAP's core ideas (tween, ease, timeline, stagger,
 * ScrollTrigger, scrub, motionPath, SplitText) with a tiny analytic tween engine: every frame is computed
 * directly from time, so all knobs are live (no remount) and no external library is loaded.
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

// ---- GSAP-style eases ----
const pIn = (n) => (t) => Math.pow(clamp(t, 0, 1), n + 1);
const pOut = (n) => (t) => 1 - Math.pow(1 - clamp(t, 0, 1), n + 1);
const pIO = (n) => (t) => { t = clamp(t, 0, 1); return t < 0.5 ? Math.pow(2 * t, n + 1) / 2 : 1 - Math.pow(2 - 2 * t, n + 1) / 2; };
const backOut = (c = 1.7) => (t) => { t = clamp(t, 0, 1); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const elasticOut = (a = 1, p = 0.3) => (t) => { t = clamp(t, 0, 1); if (t === 0 || t === 1) return t; a = Math.max(1, a); const s = (p / TAU) * Math.asin(1 / a); return a * Math.pow(2, -10 * t) * Math.sin(((t - s) * TAU) / p) + 1; };
const bounceOut = (t) => { t = clamp(t, 0, 1); const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
const seg = (time, start, dur) => clamp((time - start) / Math.max(1e-6, dur), 0, 1);
const h2r = (h, s, l) => { h = (((h % 360) + 360) % 360) / 360; const f = (n) => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0) * 255, f(8) * 255, f(4) * 255]; };
const rgbS = (c) => `rgb(${c.map((v) => Math.round(clamp(v, 0, 255))).join(',')})`;
const hex2 = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const FONT2 = 'ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif';

// small ease-curve plot (y range -0.35..1.35) with a marker at progress p
function easeGraph(ctx, x, y, w, h, fn, p, label, hue) {
  ctx.fillStyle = 'rgba(15,23,42,.78)'; rrect(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1; rrect(ctx, x, y, w, h, 8); ctx.stroke();
  const px = (u) => x + 8 + u * (w - 16), py = (v) => y + h - 8 - ((v + 0.35) / 1.7) * (h - 22);
  ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(1), py(0)); ctx.moveTo(px(0), py(1)); ctx.lineTo(px(1), py(1)); ctx.stroke();
  ctx.strokeStyle = hsla(hue, 90, 68); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 48; i++) { const u = i / 48; ctx[i ? 'lineTo' : 'moveTo'](px(u), py(fn(u))); } ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px(p), py(fn(p)), 3.5, 0, TAU); ctx.fill();
  text(ctx, label, x + 8, y + 9, { size: 10, col: '#94a3b8' });
}
// horizontal timeline track: items [{s,d,label}], total seconds, playhead time
function track(ctx, x, y, w, items, total, now, hue, P) {
  const rh = 12, gap = 3, h = items.length * (rh + gap) + 16; let hit = null;
  ctx.fillStyle = 'rgba(15,23,42,.78)'; rrect(ctx, x - 6, y - 4, w + 12, h, 8); ctx.fill();
  items.forEach((it, i) => { const bx = x + (it.s / total) * w, bw = Math.max(3, (it.d / total) * w), by = y + i * (rh + gap); const act = now >= it.s && now <= it.s + it.d;
    ctx.fillStyle = hsla(hue + i * 40, 80, act ? 62 : 42, act ? 1 : 0.7); rrect(ctx, bx, by, bw, rh, 4); ctx.fill();
    if (bw > 40) text(ctx, it.label, bx + 4, by + rh / 2, { size: 9, col: '#0b1020', bold: true });
    if (P.y > by - 1 && P.y < by + rh + 1 && P.x > x - 6 && P.x < x + w + 6) hit = i; });
  const hx = x + clamp(now / total, 0, 1) * w; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, y - 4); ctx.lineTo(hx, y + h - 8); ctx.stroke();
  text(ctx, `${fmt(now, 2)}s / ${fmt(total, 2)}s`, x, y + h - 6, { size: 9, col: '#94a3b8' });
  return hit;
}
const GCP = '<p>这里没有加载 GSAP 库，而是用几十行代码复刻了它最核心的几个概念：补间（tween，从 A 值平滑过渡到 B 值）、缓动（ease，控制过渡的快慢节奏）、时间轴（timeline，把多段补间排好先后顺序）和交错（stagger，让一组元素依次出发）。每一帧都直接根据「当前时间」算出画面，所以拖动右侧滑条会立即看到变化。公式区给出了对应的 GSAP 写法，可以直接搬到真实项目里。</p>';

function gFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '播放速度', 2.5), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key] ?? ex.value) : num(C[ex.key], ex.value));
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>${GCP}`,
      params: [['主色', '画面的主色调，其他颜色由它在色环上偏移得到'], [spec.speed.label, '相当于 GSAP 的 timeScale：1 为正常速度，0 为暂停'], [spec.size.label, d.sizeDoc || '元素的大小'], [d.count.label, d.countDoc || '元素的数量'], [ex.label, d.extraDoc || '该效果特有的参数']],
      example: (v) => `<ol><li>当前：${v.mode}</li><li>${d.count.label}：${v.n}；指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖动右侧滑条立即看到变化</li></ol>`,
      tip: d.tip || '把指针移到元素上，信息面板会显示它此刻的动画数值；右侧滑条实时调整。',
    },
    build(S) {
      const st = {};
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', spd = num(C.speed, 0.9), dt = st.lt == null ? 0 : t - st.lt; st.lt = t; st.tt = st.tt == null ? t * spd : st.tt + (dt > 0 && dt < 0.25 ? dt * spd : 0); const tt = st.tt;
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), cx: W / 2, cy: (H + 8) / 2, raw: t };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        ctx.fillStyle = hsla(k.hue, 80, 65, 0.7); ctx.fillRect(0, H - 4, (W - 56) * fract(tt / 4), 4);
        chip(ctx, W, H, C);
        return { mode: r.mode || '', n: String(r.n ?? k.n), cell: r.cell || '指针不在元素上', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const SZ = (label, min, max, value, step = 1) => ({ label, min, max, step, value });

const TLK = [['x 右移', 'x: 200'], ['旋转 180°', 'rotation: 180'], ['放大 1.5×', 'scale: 1.5'], ['变色', 'backgroundColor'], ['上移', 'y: -60'], ['变圆', 'borderRadius: "50%"']];
FAM.timeline = gFam({ title: 'Timeline 时间轴', count: NC('片段数', 2, 6, 4), extra: R('overlap', '片段重叠', 0, 0.7, 0.01, 0.2), size: SZ('方块大小', 20, 100, 50), color: '#22c55e',
  countDoc: '时间轴里依次排列的补间（片段）数量，每段改变方块的一个属性', extraDoc: '后一段比前一段提前多少秒开始（GSAP 的位置参数 "-=0.2"），0 表示一段结束下一段才开始', sizeDoc: '方块大小（相对画面）',
  presets: { 两段: { count: 2 }, 六段: { count: 6 }, 首尾相接: { overlap: 0 }, 大重叠: { overlap: 0.65 }, 大方块: { size: 98 } },
  explain: 'Timeline 时间轴：把多段补间像排视频剪辑一样按顺序排在一条时间线上。下方的彩色条就是每一段的开始时间和时长，白线是播放头。时间轴播完后会倒着播回去（yoyo），这样方块会回到起点。用「片段重叠」可以让动作衔接得更紧凑。',
  formula: '第 i 段开始时间 = i · (0.8 − 重叠)，每段时长 0.8s，ease: power2.inOut', formula2: 'gsap.timeline({ repeat: -1, yoyo: true }).to(box, { x: 200 }).to(box, { rotation: 180 }, "-=重叠")…',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, ov = k.x, dur = 0.8, step = dur - ov, total = step * (n - 1) + dur, L = total + 0.4, lt = t % (2 * L), now = clamp(lt < L ? lt : 2 * L - lt, 0, total);
    const items = Array.from({ length: n }, (_, i) => ({ s: i * step, d: dur, label: TLK[i][0] })), e = items.map((it) => pIO(2)(seg(now, it.s, it.d)));
    const trH = n * 15 + 16, top = 16, bot = H - trH - 24, bs = clamp(Math.min(W, bot - top) * 0.32 * (k.s / 50), 16, (bot - top) * 0.8), x0 = 30 + bs / 2, x1 = W - 30 - bs / 2;
    const bx = lerp(x0, n > 0 ? x1 : x0, e[0]), by = (top + bot) / 2 + (n > 4 ? -e[4] * (bot - top) * 0.2 : 0);
    ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(x0, (top + bot) / 2); ctx.lineTo(x1, (top + bot) / 2); ctx.stroke(); ctx.setLineDash([]);
    const sc = 1 + (n > 2 ? 0.5 * e[2] : 0), hu = k.hue + (n > 3 ? 140 * e[3] : 0), rad = n > 5 ? lerp(0.18, 0.5, e[5]) : 0.18;
    ctx.save(); ctx.translate(bx, by); ctx.rotate((n > 1 ? e[1] : 0) * Math.PI); ctx.scale(sc, sc); ctx.fillStyle = hsla(hu, 80, 60); rrect(ctx, -bs / 2, -bs / 2, bs, bs, bs * rad); ctx.fill(); ctx.restore();
    const hit = track(ctx, 24, H - trH - 12, W - 100, items, total, now, k.hue, P);
    const onBox = Math.abs(P.x - bx) < bs * sc * 0.6 && Math.abs(P.y - by) < bs * sc * 0.6;
    const cell = hit != null ? `片段 ${hit + 1}「${TLK[hit][0]}」：${fmt(items[hit].s, 2)}s 开始，进度 ${Math.round(e[hit] * 100)}%` : onBox ? `方块：x ${Math.round(bx)}，缩放 ${fmt(sc, 2)}` : null;
    return { mode: `总时长 ${fmt(total, 2)}s · 重叠 ${fmt(ov, 2)}s · 方块 ${Math.round(k.s)}%`, cell };
  } });

FAM.scroll = gFam({ title: 'ScrollTrigger', count: NC('内容区块数', 2, 8, 5), extra: R('start', '触发位置', 0.2, 1, 0.01, 0.8), size: SZ('区块高度', 30, 100, 55), color: '#38bdf8',
  countDoc: '页面里需要滚动触发动画的区块数量', extraDoc: '区块顶部滚到视口的哪个位置时开始动画：0.8 表示距顶部 80% 处（图中虚线）', sizeDoc: '每个区块的高度（占视口高度的百分比）',
  presets: { 两块: { count: 2 }, 八块: { count: 8 }, 靠上触发: { start: 0.3 }, 底部触发: { start: 1 }, 高区块: { size: 98 } },
  explain: 'ScrollTrigger 滚动触发：让动画跟着页面滚动走。每个区块的顶部碰到触发线（虚线）时，卡片开始从右侧滑入并淡入，滚得越多进度越大（scrub 模式）；往回滚，动画也会倒退。页面会自动上下滚动演示，把指针放进画面后，指针的上下位置就是滚动位置。右侧是滚动条，顶部细条是整页的滚动进度。',
  formula: '进度 = clamp((触发线 − 区块顶部) / (区块高 · 0.6), 0, 1)', formula2: 'gsap.from(card, { x: 120, opacity: 0, scrollTrigger: { trigger: section, start: "top 80%", scrub: true } })',
  draw(ctx, W, H, t, C, P, k) {
    const vh = H - 8, h = (vh * k.s) / 100, total = k.n * h + vh * 0.9 + 30, maxS = total - vh, sy = P.user && P.y > 8 ? clamp((P.y - 8) / vh, 0, 1) * maxS : (0.5 - 0.5 * Math.cos(t * 0.5)) * maxS, line = 8 + vh * k.x; let cell = null;
    for (let i = 0; i < k.n; i++) { const top = 8 + 30 + i * h - sy, p = clamp((line - top) / (h * 0.6), 0, 1), e = pOut(2)(p);
      if (top > H || top + h < 8) continue;
      ctx.fillStyle = i % 2 ? 'rgba(30,41,59,.55)' : 'rgba(15,23,42,.55)'; ctx.fillRect(0, top, W - 14, h);
      text(ctx, `区块 ${i + 1}`, 14, top + 14, { size: 11, col: '#64748b' });
      const cw = Math.min(W * 0.6, 360), ch = Math.max(14, h * 0.55), cx = (W - cw) / 2 + (1 - e) * 120, cy = top + (h - ch) / 2;
      ctx.globalAlpha = 0.12 + 0.88 * e; ctx.fillStyle = hsla(k.hue + i * 35, 75, 58); rrect(ctx, cx, cy, cw, ch, 12); ctx.fill(); ctx.globalAlpha = 1;
      if (ch > 22) text(ctx, `进度 ${Math.round(p * 100)}%`, cx + 14, cy + ch / 2, { size: clamp(ch * 0.3, 10, 16), col: '#0b1020', bold: true });
      if (P.y > top && P.y < top + h && P.y > 8) cell = `区块 ${i + 1}：动画进度 ${Math.round(p * 100)}%`; }
    ctx.strokeStyle = hsla(k.hue, 90, 70); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, line); ctx.lineTo(W - 60, line); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, `start: "top ${Math.round(k.x * 100)}%"`, W - 64, line - 8, { size: 10, col: hsla(k.hue, 90, 75), align: 'right' });
    ctx.fillStyle = 'rgba(148,163,184,.2)'; ctx.fillRect(W - 8, 10, 4, H - 70); ctx.fillStyle = hsla(k.hue, 80, 65); ctx.fillRect(W - 8, 10 + (sy / total) * (H - 70), 4, (vh / total) * (H - 70));
    ctx.fillStyle = hsla(k.hue, 90, 65); ctx.fillRect(0, 8, (W * sy) / maxS, 3);
    return { mode: `start: "top ${Math.round(k.x * 100)}%" · 区块高 ${Math.round(k.s)}% · 已滚动 ${Math.round((sy / maxS) * 100)}%`, cell };
  } });

const PHR = ['GSAP 文字动画', '逐字拆分 SplitText', 'stagger 交错入场', 'back.out 回弹'];
FAM.text = gFam({ title: '文字交错动画', count: NC('文字行数', 1, 4, 2), extra: R('stagger', '每字间隔', 0, 0.2, 0.005, 0.05), size: SZ('字号', 14, 72, 40), color: '#f472b6',
  countDoc: '参与动画的文字行数', extraDoc: '相邻两个字开始动画的时间差（秒），即 stagger 的值', sizeDoc: '文字大小（像素，放不下时自动缩小）',
  presets: { 单行: { count: 1 }, 四行: { count: 4 }, 同时出现: { stagger: 0 }, 慢慢出现: { stagger: 0.18 }, 大字: { size: 70 } },
  explain: '文字交错动画：先把一句话拆成一个个单字（SplitText 做的事），再给每个字设置相同的入场动画——从下方升起、旋转回正、由透明变清晰，只是每个字比前一个字晚一点出发，于是整行文字像波浪一样依次弹出。淡色的字是每个字最终停下的位置。',
  formula: '第 g 个字的延迟 = g · stagger，ease: back.out(1.7)', formula2: 'gsap.from(split.chars, { y: 40, opacity: 0, rotation: 30, stagger: 0.05, ease: "back.out(1.7)" })',
  draw(ctx, W, H, t, C, P, k) {
    const lines = PHR.slice(0, k.n), N = lines.reduce((a, s) => a + [...s].length, 0), st = k.x, inT = 0.6 + st * N, L = 2 * inT + 1.8, lt = t % L, outS = inT + 1.2; let g = 0, cell = null;
    ctx.font = `700 ${k.s}px ${FONT2}`; const maxW = Math.max(...lines.map((s) => ctx.measureText(s).width)), fs = Math.min(k.s, (k.s * (W * 0.88)) / maxW, (H - 40) / (k.n * 1.4)), lh = fs * 1.4, y0 = k.cy - (k.n * lh) / 2 + lh / 2;
    ctx.font = `700 ${fs}px ${FONT2}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    lines.forEach((s, li) => { const ch = [...s], wTot = ctx.measureText(s).width, y = y0 + li * lh; let x = (W - wTot) / 2;
      ctx.fillStyle = 'rgba(148,163,184,.13)'; ctx.fillText(s, x, y);
      ch.forEach((c) => { const cw = ctx.measureText(c).width, p = backOut(1.7)(seg(lt, g * st, 0.6)), q = pIn(2)(seg(lt, outS + g * st, 0.5)), a = clamp(seg(lt, g * st, 0.6) * 1.6, 0, 1) * (1 - q);
        if (a > 0.01) { ctx.save(); ctx.globalAlpha = a; ctx.translate(x + cw / 2, y + (1 - p) * fs * 0.9 - q * fs * 0.6); ctx.rotate((1 - p) * 0.5); ctx.fillStyle = hsla(k.hue + g * 9, 85, 68); ctx.fillText(c, -cw / 2, 0); ctx.restore(); }
        x += cw; g++; });
      if (Math.abs(P.y - y) < lh / 2) cell = `第 ${li + 1} 行：${ch.length} 个字，最后一个字延迟 ${fmt((g - 1) * st, 2)}s`; });
    return { mode: `stagger ${fmt(st, 3)}s · 字号 ${Math.round(fs)}px · 共 ${N} 字`, cell };
  } });

FAM.bounce = gFam({ title: '弹跳入场', count: NC('小球数', 1, 8, 3), extra: R('drop', '下落高度', 20, 100, 1, 70), size: SZ('小球大小', 20, 100, 50), color: '#f59e0b',
  countDoc: '依次落下的小球数量', extraDoc: '小球从多高的地方落下（占画面高度的百分比）', sizeDoc: '小球大小（相对每一列的宽度）',
  presets: { 单球: { count: 1 }, 八球: { count: 8 }, 低落差: { drop: 22 }, 高落差: { drop: 100 }, 大球: { size: 98 } },
  explain: '弹跳入场 bounce.out：小球落地后会像真的皮球一样弹几下才停住，这种「弹几下」的节奏就是 bounce.out 缓动曲线（左上角小图）——曲线碰到顶部（终点）后会回落几次，每次回落的幅度越来越小。小球之间有 0.12 秒的交错，所以会依次落下；落地后再缓缓升回去重来。',
  formula: 'y = 地面 − (1 − bounce.out(p)) · 下落高度', formula2: 'gsap.from(".ball", { y: -300, duration: 1, ease: "bounce.out", stagger: 0.12 })',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, floor = H - 22, top = 70, dropH = ((floor - top) * k.x) / 100, L = 2.2, lt = t % L; let cell = null, p0 = 0;
    ctx.fillStyle = 'rgba(148,163,184,.25)'; ctx.fillRect(14, floor, W - 76, 2);
    for (let i = 0; i < n; i++) { const x = ((i + 0.5) * (W - 60)) / n + 10, r = clamp(Math.min((W - 60) / n * 0.32, (floor - top) * 0.15) * (k.s / 50), 5, 80);
      const pin = seg(lt, i * 0.12, 1.0), p = bounceOut(pin), up = pIO(2)(seg(lt, 1.5 + i * 0.05, 0.6)), lift = (1 - p) + up, y = floor - r - clamp(lift, 0, 1) * dropH; if (i === 0) p0 = pin;
      const sq = lift < 0.02 ? 0.12 : 0; ctx.fillStyle = `rgba(0,0,0,${0.35 - 0.25 * clamp(lift, 0, 1)})`; ctx.beginPath(); ctx.ellipse(x, floor + 1, r * (1.1 - 0.5 * clamp(lift, 0, 1)), r * 0.22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hsla(k.hue + i * 30, 85, 60); ctx.beginPath(); ctx.ellipse(x, y + r * sq, r * (1 + sq), r * (1 - sq), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
      if (Math.hypot(P.x - x, P.y - y) < r * 1.3) cell = `小球 ${i + 1}：离地 ${Math.round(floor - r - y)}px`; }
    easeGraph(ctx, 14, 16, 120, 50, bounceOut, p0, 'bounce.out', k.hue);
    return { mode: `ease: "bounce.out" · 落差 ${Math.round(k.x)}% · 球 ${Math.round(k.s)}%`, cell };
  } });

FAM.stagger = gFam({ title: '交错卡片', count: NC('卡片数', 3, 16, 8), extra: R('each', '交错间隔', 0, 0.3, 0.005, 0.08), size: SZ('卡片大小', 30, 100, 70), color: '#a78bfa',
  countDoc: '一起做动画的卡片数量', extraDoc: '相邻两张卡片开始动画的时间差（秒），即 stagger.each', sizeDoc: '卡片大小（占每个格子的百分比）',
  presets: { 三张: { count: 3 }, 十六张: { count: 16 }, 同时: { each: 0 }, 慢交错: { each: 0.28 }, 大卡片: { size: 100 } },
  explain: 'stagger 交错：给一组元素同一个动画，但让它们依次出发。每张卡片上的数字就是它的延迟时间（第几张 × 间隔）。卡片先从下方淡入，停一会儿，再按同样的顺序向上淡出。虚线框是卡片最终停放的位置。',
  formula: '第 i 张卡片延迟 = i · each，ease: power2.out', formula2: 'gsap.from(".card", { y: 30, opacity: 0, duration: 0.6, stagger: { each: 0.08 } })',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, each = k.x, inT = 0.6 + each * n, L = 2 * inT + 1.1, lt = t % L, outS = inT + 0.8; let cell = null;
    grid(n, W - 20, H - 24).forEach((c, i) => { const w = c.r * 2.2 * (k.s / 70), h = w * 0.7, x = c.x + 10 - w / 2, y0 = c.y - h / 2 + 4;
      ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.setLineDash([4, 4]); rrect(ctx, x, y0, w, h, 10); ctx.stroke(); ctx.setLineDash([]);
      const p = pOut(2)(seg(lt, i * each, 0.6)), q = pIn(2)(seg(lt, outS + i * each, 0.4)), a = p * (1 - q);
      if (a > 0.01) { ctx.globalAlpha = a; ctx.fillStyle = hsla(k.hue + i * 12, 70, 60); rrect(ctx, x, y0 + (1 - p) * 30 - q * 20, w, h, 10); ctx.fill(); ctx.globalAlpha = 1; }
      text(ctx, `${fmt(i * each, 2)}s`, x + w / 2, y0 + h / 2, { size: clamp(w * 0.16, 9, 16), col: a > 0.5 ? '#0b1020' : '#64748b', align: 'center', bold: true });
      if (P.x > x && P.x < x + w && P.y > y0 && P.y < y0 + h) cell = `卡片 ${i + 1}：延迟 ${fmt(i * each, 3)}s`; });
    return { mode: `stagger.each ${fmt(each, 3)}s · 卡片 ${Math.round(k.s)}% · 全部入场 ${fmt(inT, 2)}s`, cell };
  } });

function cardinal(pts, c, M) { const n = pts.length, out = []; for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], m1 = [(p2[0] - p0[0]) * c * 0.5, (p2[1] - p0[1]) * c * 0.5], m2 = [(p3[0] - p1[0]) * c * 0.5, (p3[1] - p1[1]) * c * 0.5];
  for (let j = 0; j < M; j++) { const u = j / M, u2 = u * u, u3 = u2 * u, a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, cc = -2 * u3 + 3 * u2, dd = u3 - u2; out.push([a * p1[0] + b * m1[0] + cc * p2[0] + dd * m2[0], a * p1[1] + b * m1[1] + cc * p2[1] + dd * m2[1]]); } } out.push(out[0]); return out; }
function atLen(poly, f) { const L = []; let s = 0; for (let i = 1; i < poly.length; i++) { s += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); L.push(s); } const target = fract(f) * s; let i = L.findIndex((v) => v >= target); if (i < 0) i = L.length - 1; const a = poly[i], b = poly[i + 1], l0 = i ? L[i - 1] : 0, u = (target - l0) / Math.max(1e-6, L[i] - l0); return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
FAM.path = gFam({ title: '路径跟随', count: NC('路径点数', 3, 8, 5), extra: R('curvy', '曲线平滑', 0, 1, 0.01, 0.6), size: SZ('物体大小', 20, 100, 50), color: '#2dd4bf',
  countDoc: '路径经过的关键点数量', extraDoc: '路径在关键点之间弯曲的程度：0 是折线，1 是圆滑曲线（MotionPath 的 curviness）', sizeDoc: '沿路径移动的物体大小',
  presets: { 三角: { count: 3 }, 八点: { count: 8 }, 折线: { curvy: 0 }, 圆滑: { curvy: 1 }, 大物体: { size: 98 } },
  explain: '路径跟随 motionPath：让物体沿着一条预先画好的路线移动。路线由几个关键点（圆点）连成，点和点之间用平滑曲线连接，「曲线平滑」越大弯得越圆。物体会自动旋转，让车头始终朝着前进方向（autoRotate），身后的拖尾是它刚刚走过的位置。',
  formula: '位置 = 路径上「总长度 × 进度」处的点，角度 = 该处切线方向', formula2: 'gsap.to(obj, { motionPath: { path: pts, curviness: 0.6, autoRotate: true }, duration: 4, ease: "none", repeat: -1 })',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, rx = (W - 90) / 2, ry = (H - 50) / 2, cx = W / 2 - 10, cy = (H + 8) / 2; let cell = null;
    const pts = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * TAU) / n, rr = 0.65 + 0.35 * hh(i, n); return [cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]; });
    const poly = cardinal(pts, k.x * 1.2, 24), f = t / 4, sz = clamp(Math.min(W, H) * 0.06 * (k.s / 50), 6, 60);
    ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); poly.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
    for (let j = 14; j >= 1; j--) { const q = atLen(poly, f - j * 0.008); ctx.fillStyle = hsla(k.hue, 85, 62, 0.5 * (1 - j / 15)); ctx.beginPath(); ctx.arc(q.x, q.y, sz * 0.4 * (1 - j / 18), 0, TAU); ctx.fill(); }
    pts.forEach((p, i) => { ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, TAU); ctx.fill(); text(ctx, i + 1, p[0] + 8, p[1] - 8, { size: 10, col: '#94a3b8' }); if (Math.hypot(P.x - p[0], P.y - p[1]) < 14) cell = `路径点 ${i + 1}：(${Math.round(p[0])}, ${Math.round(p[1])})`; });
    const o = atLen(poly, f); ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang); ctx.fillStyle = hsla(k.hue, 85, 62); rrect(ctx, -sz, -sz * 0.6, sz * 2, sz * 1.2, sz * 0.35); ctx.fill(); ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.moveTo(sz * 0.8, 0); ctx.lineTo(sz * 0.2, -sz * 0.35); ctx.lineTo(sz * 0.2, sz * 0.35); ctx.fill(); ctx.restore();
    if (!cell && Math.hypot(P.x - o.x, P.y - o.y) < sz * 1.5) cell = `物体：进度 ${Math.round(fract(f) * 100)}%，朝向 ${Math.round(((o.ang * 180) / Math.PI + 360) % 360)}°`;
    return { mode: `motionPath · ${n} 点 · curviness ${fmt(k.x, 2)} · 物体 ${Math.round(k.s)}%`, cell };
  } });

FAM['spin-out'] = gFam({ title: '旋转出场', count: NC('方块数', 1, 6, 3), extra: R('turns', '旋转圈数', 0.25, 3, 0.25, 1), size: SZ('方块大小', 20, 100, 60), color: '#f59e0b',
  countDoc: '一起旋转出场的方块数量', extraDoc: '出场时转几圈（1 圈 = 360°）', sizeDoc: '方块大小（占每个格子的百分比）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 四分之一圈: { turns: 0.25 }, 三圈: { turns: 3 }, 大方块: { size: 100 } },
  explain: '旋转出场：方块一边旋转一边缩小、变透明直到消失（ease: power3.in，越转越快），然后从很小的状态用 back.out 弹回原大小——back 缓动会先稍微超过目标再回来，所以入场有一点「弹」的感觉。每个方块比前一个晚 0.1 秒。虚线框是方块的原始大小。',
  formula: '出场：rotation = 圈数 · 360° · power3.in(p)，scale = 1 − power3.in(p)', formula2: 'tl.to(box, { rotation: 360, scale: 0, opacity: 0, ease: "power3.in" }).to(box, { scale: 1, rotation: 0, ease: "back.out(2)" })',
  draw(ctx, W, H, t, C, P, k) {
    const L = 2.4, lt = t % L; let cell = null;
    grid(k.n, W - 20, H - 16).forEach((c, i) => { const s = c.r * 1.6 * (k.s / 60), x = c.x + 10, y = c.y + 2, d = i * 0.1, eo = pIn(3)(seg(lt, d, 0.8)), inn = lt >= 1.1 + d, ei = backOut(2)(seg(lt, 1.1 + d, 0.6));
      const sc = inn ? lerp(0.15, 1, ei) : 1 - eo, rot = inn ? 0 : eo * k.x * TAU, a = inn ? smooth(seg(lt, 1.1 + d, 0.5)) : 1 - smooth(seg(lt, d, 0.8));
      ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.setLineDash([4, 4]); rrect(ctx, x - s / 2, y - s / 2, s, s, s * 0.18); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.max(0.001, sc), Math.max(0.001, sc)); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = hsla(k.hue + i * 30, 80, 62); rrect(ctx, -s / 2, -s / 2, s, s, s * 0.18); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-s * 0.08, -s / 2 + 4, s * 0.16, s * 0.25); ctx.restore();
      if (inCell(P, c)) cell = `方块 ${i + 1}：旋转 ${Math.round((rot * 180) / Math.PI)}°，缩放 ${fmt(sc, 2)}`; });
    return { mode: `出场 ${fmt(k.x, 2)} 圈（${Math.round(k.x * 360)}°） · 方块 ${Math.round(k.s)}%`, cell };
  } });

FAM.elastic = gFam({ title: '弹性缩放', count: NC('元素数', 1, 6, 3), extra: R('amp', '弹性振幅', 1, 3, 0.05, 1.2), size: SZ('元素大小', 20, 100, 55), color: '#c084fc',
  countDoc: '一起做弹性缩放的圆形数量', extraDoc: 'elastic.out 的振幅参数：越大，超过目标后弹得越猛（左上角曲线的峰越高）', sizeDoc: '圆形大小（占每个格子的百分比）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 轻弹: { amp: 1 }, 猛弹: { amp: 2.9 }, 大圆: { size: 100 } },
  explain: '弹性缩放 elastic.out：像拉开再松手的橡皮筋，元素放大时会冲过目标大小、来回晃几下再停住。左上角的小图就是这条缓动曲线：横轴是时间，纵轴是进度，曲线超过顶线的部分就是「冲过头」。振幅越大冲得越远。之后用平缓的 power2.inOut 缩回去，循环播放。',
  formula: 'elastic.out(a, p)：e(t) = a · 2^(−10t) · sin((t − s) · 2π / p) + 1，p = 0.3', formula2: 'gsap.to(el, { scale: 1, duration: 1.2, ease: "elastic.out(1.2, 0.3)", stagger: 0.15 })',
  draw(ctx, W, H, t, C, P, k) {
    const fn = elasticOut(k.x, 0.3), L = 2.2, lt = t % L; let cell = null, p0 = 0;
    grid(k.n, W - 20, H - 16).forEach((c, i) => { const d = i * 0.15, p = seg(lt, d, 1.2), back = pIO(2)(seg(lt, 1.5 + d, 0.5)), sc = lerp(0.45, 1, fn(p)) - back * 0.55, r = c.r * (k.s / 55), x = c.x + 10, y = c.y + 6; if (!i) p0 = p;
      ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = hsla(k.hue + i * 35, 80, 62); ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * sc), 0, TAU); ctx.fill();
      if (Math.hypot(P.x - x, P.y - y) < r * 1.2) cell = `元素 ${i + 1}：缩放 ${fmt(sc, 2)}`; });
    easeGraph(ctx, 14, 16, 120, 56, fn, p0, `elastic.out(${fmt(k.x, 2)}, 0.3)`, k.hue);
    return { mode: `ease: "elastic.out(${fmt(k.x, 2)}, 0.3)" · 元素 ${Math.round(k.s)}%`, cell };
  } });

FAM.colorflash = gFam({ title: '颜色闪烁', count: NC('关键色数', 2, 6, 3), extra: R('hold', '每色持续', 0.2, 1.5, 0.01, 0.7), size: SZ('色块大小', 20, 100, 60), color: '#22d3ee',
  countDoc: '颜色动画里依次切换的关键颜色数量（由主色在色环上均匀取色）', extraDoc: '每个关键色停留多久（秒），越短闪得越快', sizeDoc: '中间色块的大小',
  presets: { 双色: { count: 2 }, 六色: { count: 6 }, 快闪: { hold: 0.2 }, 慢变: { hold: 1.5 }, 大色块: { size: 100 } },
  explain: '颜色闪烁：GSAP 可以直接对颜色做补间——它会把颜色拆成红、绿、蓝三个数字，分别从旧值平滑过渡到新值。这里把几个关键色排成一个循环的时间轴（下方色条），每个颜色先用 70% 的时间渐变过去，再停留一会儿。白色三角是当前播放位置。',
  formula: '颜色 = 旧色 + (新色 − 旧色) · sine.inOut(p)，对 R、G、B 分别计算', formula2: 'tl.to(el, { backgroundColor: "#22d3ee", duration: 0.35 }).to(el, { backgroundColor: "#f472b6" })…',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, hold = k.x, cols = Array.from({ length: n }, (_, j) => h2r(k.hue + (j * 360) / n, 0.8, 0.58)), L = n * hold, lt = t % L, j = Math.min(n - 1, Math.floor(lt / hold)), u = (lt - j * hold) / hold, e = 0.5 - 0.5 * Math.cos(Math.PI * clamp(u / 0.7, 0, 1));
    const from = cols[(j - 1 + n) % n], to = cols[j], cur = from.map((v, q) => lerp(v, to[q], e)), cs = rgbS(cur); let cell = null;
    const stripY = H - 44, avail = stripY - 24, bs = clamp(Math.min(W - 80, avail) * (k.s / 100), 30, Math.min(W - 40, avail)), bx = W / 2 - bs / 2, by = 16 + (avail - bs) / 2;
    ctx.save(); ctx.shadowColor = cs; ctx.shadowBlur = 14; ctx.fillStyle = cs; rrect(ctx, bx, by, bs, bs, bs * 0.16); ctx.fill(); ctx.restore();
    text(ctx, hex2(cur), W / 2, by + bs / 2, { size: clamp(bs * 0.12, 10, 22), col: '#0b1020', align: 'center', bold: true });
    const sw = Math.min(W - 100, 420), sx = (W - sw) / 2 - 20;
    cols.forEach((c, q) => { ctx.fillStyle = rgbS(c); rrect(ctx, sx + (q * sw) / n + 1, stripY, sw / n - 2, 16, 4); ctx.fill(); if (P.x > sx + (q * sw) / n && P.x < sx + ((q + 1) * sw) / n && P.y > stripY - 4 && P.y < stripY + 20) cell = `关键色 ${q + 1}：${hex2(c)}`; });
    const hx = sx + (lt / L) * sw; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(hx, stripY - 2); ctx.lineTo(hx - 5, stripY - 9); ctx.lineTo(hx + 5, stripY - 9); ctx.fill();
    if (!cell && P.x > bx && P.x < bx + bs && P.y > by && P.y < by + bs) cell = `当前颜色 ${hex2(cur)}（正在变向第 ${j + 1} 色）`;
    return { mode: `${n} 个关键色 · 每色 ${fmt(hold, 2)}s · 色块 ${Math.round(k.s)}%`, cell };
  } });

FAM.flipcard = gFam({ title: '翻转牌', count: NC('卡片数', 1, 8, 4), extra: R('each', '交错间隔', 0, 0.4, 0.01, 0.12), size: SZ('卡片大小', 30, 100, 70), color: '#0ea5e9',
  countDoc: '依次翻转的卡片数量', extraDoc: '相邻卡片开始翻转的时间差（秒），0 表示同时翻', sizeDoc: '卡片大小（占每个格子的百分比）',
  presets: { 单张: { count: 1 }, 八张: { count: 8 }, 同步: { each: 0 }, 慢交错: { each: 0.38 }, 大卡片: { size: 100 } },
  explain: '翻转牌 rotateY：让卡片绕竖直中线转 180°，转过 90° 时正好侧对我们（宽度变成 0），之后看到的就是背面。在平面画布上，绕 Y 轴旋转可以用「水平方向缩放 = cos(角度)」来模拟。所有卡片翻到背面，停一下，再翻回正面。',
  formula: '可见宽度 = 卡宽 · |cos(角度)|，角度 > 90° 时显示背面', formula2: 'gsap.to(".card", { rotationY: 180, duration: 0.6, ease: "power2.inOut", stagger: 0.12 })',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, each = k.x, half = 0.6 + each * n + 0.5, L = 2 * half, lt = t % L; let cell = null;
    grid(n, W - 20, H - 16).forEach((c, i) => { const w = c.r * 1.5 * (k.s / 70), h = Math.min(w * 1.4, c.r * 2.4), x = c.x + 10, y = c.y + 4, a = Math.PI * (pIO(2)(seg(lt, i * each, 0.6)) - pIO(2)(seg(lt, half + i * each, 0.6))), cs = Math.cos(a), front = cs >= 0, vw = Math.max(1, w * Math.abs(cs));
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.setLineDash([4, 4]); rrect(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.stroke(); ctx.setLineDash([]);
      const sk = 1 + 0.06 * Math.sin(a); ctx.fillStyle = front ? hsla(k.hue + i * 20, 80, 58) : hsla(k.hue + 180, 50, 30); rrect(ctx, x - vw / 2, y - (h * sk) / 2, vw, h * sk, 10); ctx.fill();
      if (vw > 24) { ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(cs), 1); text(ctx, front ? `正面 ${i + 1}` : '背面', 0, 0, { size: clamp(w * 0.16, 9, 18), col: front ? '#0b1020' : '#e2e8f0', align: 'center', bold: true }); ctx.restore(); }
      if (P.x > x - w / 2 && P.x < x + w / 2 && P.y > y - h / 2 && P.y < y + h / 2) cell = `卡片 ${i + 1}：rotateY ${Math.round((a * 180) / Math.PI)}°（${front ? '正面' : '背面'}）`; });
    return { mode: `stagger ${fmt(each, 2)}s · 卡片 ${Math.round(k.s)}%`, cell };
  } });

FAM.ring = gFam({ title: '进度环', count: NC('环数', 1, 4, 2), extra: R('lw', '线宽', 2, 24, 0.5, 10), size: SZ('环大小', 30, 100, 70), color: '#10b981',
  countDoc: '同心进度环的数量，每个环有自己的目标百分比', extraDoc: '圆环的粗细（像素）', sizeDoc: '最外层圆环的大小（占画面的百分比）',
  presets: { 单环: { count: 1 }, 四环: { count: 4 }, 细环: { lw: 3 }, 粗环: { lw: 23 }, 大环: { size: 100 } },
  explain: '进度环：圆环的弧长从 0 增长到目标百分比，就像加载进度或者运动 App 的「圆环」。在 SVG 里通常用 stroke-dashoffset（或 GSAP 的 DrawSVG 插件）来控制画出多长的线，这里直接用画弧的终点角度。几个环依次开始（交错 0.2 秒），到达目标后再收回。',
  formula: '终点角度 = −90° + 360° · 目标% · power2.inOut(p)', formula2: 'gsap.to(circle, { strokeDashoffset: 周长 · (1 − 目标%), duration: 1.2, ease: "power2.inOut" })',
  draw(ctx, W, H, t, C, P, k) {
    const TG = [0.9, 0.72, 0.55, 0.8], R0 = Math.max(20, ((Math.min(W - 80, H - 30) / 2) * k.s) / 100), cx = W / 2, cy = (H + 8) / 2, L = 3.4, lt = t % L, lw = Math.min(k.x, R0 / (k.n * 1.6)); let cell = null, pct0 = 0;
    for (let i = 0; i < k.n; i++) { const r = R0 - i * (lw * 1.6 + 4); if (r < lw) break; const p = pIO(2)(seg(lt, i * 0.2, 1.2)) - pIO(2)(seg(lt, 2.2 + i * 0.1, 0.8)), pct = TG[i] * p; if (!i) pct0 = pct;
      ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(148,163,184,.18)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      if (pct > 0.002) { ctx.strokeStyle = hsla(k.hue + i * 45, 80, 60); ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * pct); ctx.stroke(); }
      if (Math.abs(Math.hypot(P.x - cx, P.y - cy) - r) < lw / 2 + 4) cell = `环 ${i + 1}：${Math.round(pct * 100)}%（目标 ${Math.round(TG[i] * 100)}%）`; }
    ctx.lineCap = 'butt'; text(ctx, `${Math.round(pct0 * 100)}%`, cx, cy, { size: clamp(R0 * 0.3, 12, 40), col: '#e2e8f0', align: 'center', bold: true });
    return { mode: `线宽 ${fmt(lw, 1)}px · 外环半径 ${Math.round(R0)}px（${Math.round(k.s)}%）`, cell };
  } });

const TYP = ['你好，GSAP！', '这是打字机效果', '每个字依次出现', '然后再删除回去'];
FAM.type = gFam({ title: '打字机', count: NC('文字行数', 1, 4, 2), extra: R('cps', '每字耗时', 0.02, 0.3, 0.005, 0.08), size: SZ('字号', 14, 64, 32), color: '#facc15',
  countDoc: '要打出的文字行数', extraDoc: '打出一个字需要多少秒，越小打得越快', sizeDoc: '文字大小（像素，放不下时自动缩小）',
  presets: { 单行: { count: 1 }, 四行: { count: 4 }, 飞快: { cps: 0.02 }, 慢慢打: { cps: 0.28 }, 大字: { size: 62 } },
  explain: '打字机：时间轴上每隔固定时间「多显示一个字」，看起来就像有人在打字；全部打完停 1 秒，再用一半的时间一个字一个字删掉。闪烁的竖线是光标。用 GSAP 实现时，可以对一个数字做补间（从 0 到总字数），每帧把文字截取到这个长度。',
  formula: '已显示字数 = floor(时间 / 每字耗时)', formula2: 'gsap.to(state, { n: 总字数, duration: 总字数 · 0.08, ease: "none", onUpdate: () => el.textContent = text.slice(0, state.n) })',
  draw(ctx, W, H, t, C, P, k) {
    const lines = TYP.slice(0, k.n), N = lines.reduce((a, s) => a + [...s].length, 0), cps = k.x, tT = N * cps, L = tT + 1 + tT * 0.5 + 0.5, lt = t % L, shown = lt < tT ? Math.floor(lt / cps) : lt < tT + 1 ? N : Math.max(0, N - Math.floor((lt - tT - 1) / (cps * 0.5)));
    const maxC = Math.max(...lines.map((s) => [...s].length)), fs = Math.min(k.s, (W * 0.84) / maxC, (H - 40) / (k.n * 1.5)), lh = fs * 1.5, x0 = Math.max(16, (W - fs * maxC) / 2), y0 = k.cy - (k.n * lh) / 2 + lh / 2; let left = shown, cx = x0, cy = y0, cell = null;
    ctx.font = `600 ${fs}px ${FONT2}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    lines.forEach((s, i) => { const ch = [...s], m = clamp(left, 0, ch.length), y = y0 + i * lh, str = ch.slice(0, m).join(''); ctx.fillStyle = hsla(k.hue, 90, 70); ctx.fillText(str, x0, y);
      if (left >= 0 && (left <= ch.length || i === lines.length - 1)) { cx = x0 + ctx.measureText(str).width + 2; cy = y; } left -= ch.length; if (left > 0 || i === 0) { cx = left > 0 ? cx : cx; }
      if (Math.abs(P.y - y) < lh / 2) cell = `第 ${i + 1} 行：已打出 ${m}/${ch.length} 字`; });
    if (Math.floor(k.raw * 2.5) % 2 === 0 || lt < tT) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(cx, cy - fs * 0.55, Math.max(2, fs * 0.08), fs * 1.1); }
    return { mode: `每字 ${fmt(cps, 3)}s · 字号 ${Math.round(fs)}px · 已打出 ${shown}/${N} 字`, cell };
  } });

FAM['parallax-g'] = gFam({ title: '视差层', count: NC('图层数', 2, 6, 4), extra: R('depth', '视差强度', 0, 1, 0.01, 0.6), size: SZ('山体高度', 20, 100, 60), color: '#6366f1',
  countDoc: '远近不同的山脉图层数量', extraDoc: '远处图层比近处慢多少：0 表示所有图层一样快（没有立体感），1 表示最远处几乎不动', sizeDoc: '山脉的起伏高度',
  presets: { 两层: { count: 2 }, 六层: { count: 6 }, 无视差: { depth: 0 }, 强视差: { depth: 1 }, 高山: { size: 100 } },
  explain: '视差：坐车时近处的树飞快后退，远处的山却慢慢移动，大脑就靠这种速度差判断远近。把画面分成几层，越远的层移动得越慢、颜色越淡，平面画面就有了纵深感。画面会自动向右平移，把指针放进画面后左右移动可以控制镜头。',
  formula: '第 i 层速度 = 1 − 强度 · (n − 1 − i) / n（i = n − 1 是最近的一层）', formula2: 'gsap.to(layer, { x: -距离 · 速度, ease: "none", scrollTrigger: { scrub: true } })',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cam = t * 60 + (P.user ? (P.x / W - 0.5) * 400 : 0), sky = ctx.createLinearGradient(0, 8, 0, H); sky.addColorStop(0, hsla(k.hue, 50, 14)); sky.addColorStop(1, hsla(k.hue + 30, 60, 36)); ctx.fillStyle = sky; ctx.fillRect(0, 8, W, H);
    const spd = (i) => 1 - (k.x * (n - 1 - i)) / n; let cell = null;
    ctx.fillStyle = hsla(k.hue + 40, 90, 80, 0.9); ctx.beginPath(); ctx.arc(W * 0.75 - fract((cam * spd(0) * 0.2) / (W + 200)) * 0, H * 0.25, Math.min(W, H) * 0.07, 0, TAU); ctx.fill();
    for (let i = 0; i < n; i++) { const sp = spd(i), off = cam * sp, base = 8 + (H - 8) * (0.38 + (0.5 * (i + 1)) / n), amp = (H - 8) * 0.18 * (k.s / 60) * (0.6 + 0.4 * (i / n)), f1 = 0.006 + hh(i) * 0.006, f2 = 0.017 + hh(i, 3) * 0.01;
      const ridge = (x) => base - amp * (0.6 * Math.sin((x + off) * f1 + i * 1.7) + 0.4 * Math.sin((x + off) * f2 + i * 4.1));
      ctx.fillStyle = hsla(k.hue + 10, 45 - i * 4, 22 + (n - i) * (40 / n), 1); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 6) ctx.lineTo(x, ridge(x)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      if (P.y > ridge(P.x)) cell = `图层 ${i + 1}（${i === n - 1 ? '最近' : i === 0 ? '最远' : '中间'}）：速度 ${fmt(sp, 2)}×`; }
    return { mode: `视差强度 ${fmt(k.x, 2)} · 最远层速度 ${fmt(spd(0), 2)}× · 山高 ${Math.round(k.s)}%`, cell };
  } });

FAM['grid-stagger'] = gFam({ title: '网格交错', count: NC('每行格数', 3, 12, 7), extra: R('each', '交错间隔', 0, 0.2, 0.005, 0.06), size: SZ('格子大小', 20, 100, 70), color: '#f97316',
  countDoc: '网格每一行的格子数量（行数按画面比例自动算）', extraDoc: '每远离起点一格，动画推迟多少秒', sizeDoc: '方块占格子的百分比',
  presets: { 稀疏: { count: 3 }, 密集: { count: 12 }, 同时: { each: 0 }, 慢波: { each: 0.19 }, 大格子: { size: 100 } },
  explain: '网格交错：stagger 的 grid 和 from 选项可以让延迟按「离起点的距离」来算，于是动画像水波一样从起点一圈圈扩散出去。默认从中心开始；把指针放进网格，起点就变成指针所在的格子。每个格子先缩小、稍微变亮，再恢复原样；起点会平滑地移到指针处。',
  formula: '延迟 = 到起点的距离（格） · each', formula2: 'gsap.to(".cell", { scale: 0.4, yoyo: true, repeat: 1, stagger: { grid: "auto", from: "center", each: 0.06 } })',
  draw(ctx, W, H, t, C, P, k, st) {
    const cols = k.n, pad = 16, gw = W - pad * 2 - 30, gh = H - 8 - pad * 2, pitch = gw / cols, rows = clamp(Math.floor(gh / pitch), 2, 12), py = gh / rows, x0 = pad, y0 = 8 + pad;
    const inside = P.user && P.x > x0 && P.x < x0 + gw && P.y > y0 && P.y < y0 + gh, toc = inside ? Math.floor((P.x - x0) / pitch) : (cols - 1) / 2, tor = inside ? Math.floor((P.y - y0) / py) : (rows - 1) / 2;
    st.oc = st.oc == null ? toc : lerp(st.oc, toc, 0.05); st.or = st.or == null ? tor : lerp(st.or, tor, 0.05); const oc = clamp(st.oc, 0, cols - 1), or = clamp(st.or, 0, rows - 1);
    const maxD = Math.hypot(Math.max(oc, cols - 1 - oc), Math.max(or, rows - 1 - or)), L = 1.3 + k.x * maxD + 0.4, lt = t % L; let cell = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const d = Math.hypot(c - oc, r - or), dl = d * k.x, e = pIO(2)(seg(lt, dl, 0.5)) - pIO(2)(seg(lt, dl + 0.6, 0.5)), s = Math.min(pitch, py) * (k.s / 100) * (1 - 0.6 * e), x = x0 + (c + 0.5) * pitch, y = y0 + (r + 0.5) * py;
      ctx.fillStyle = hsla(k.hue + d * 12, 80, 52 + 10 * e); rrect(ctx, x - s / 2, y - s / 2, s, s, s * 0.2); ctx.fill();
      if (Math.abs(P.x - x) < pitch / 2 && Math.abs(P.y - y) < py / 2) cell = `格子 (${r + 1}, ${c + 1})：距起点 ${fmt(d, 1)} 格，延迟 ${fmt(dl, 2)}s`; }
    return { mode: `stagger: { each: ${fmt(k.x, 3)}, from: ${inside ? '指针处' : '"center"'} } · ${cols}×${rows} · 格子 ${Math.round(k.s)}%`, n: `${cols}（共 ${rows} 行）`, cell };
  } });

const SCP = ['x 位移', '旋转', '缩放', '颜色'];
FAM.scrub = gFam({ title: '时间轴 scrub', count: NC('动画属性数', 1, 4, 4), extra: R('scrub', 'scrub 平滑', 0, 2, 0.05, 0.6), size: SZ('方块大小', 20, 100, 50), color: '#e879f9',
  countDoc: '跟着进度变化的属性数量：依次是 x 位移、旋转、缩放、颜色', extraDoc: '实际进度追上目标进度需要的时间（秒），0 表示立刻跟上，越大越「顺滑、有拖拽感」', sizeDoc: '方块大小（相对画面）',
  presets: { 只位移: { count: 1 }, 全部属性: { count: 4 }, 立即跟随: { scrub: 0 }, 很顺滑: { scrub: 1.9 }, 大方块: { size: 98 } },
  explain: 'scrub 拖动进度：动画不再按时间自己播放，而是由一个「进度值」直接控制，例如滚动条位置或拖动的滑块。scrub 设成数字时，实际进度会花这么多秒慢慢追上目标进度，画面就不会一顿一顿的。下方轨道里空心圆是目标进度，实心圆是实际进度，虚线框是目标位置；把指针放进画面左右移动即可拖动进度。',
  formula: '实际进度 += (目标进度 − 实际进度) · (1 − e^(−Δt / scrub))', formula2: 'gsap.to(box, { x: 300, rotation: 360, scale: 1.5, scrollTrigger: { scrub: 0.6 } })',
  draw(ctx, W, H, t, C, P, k, st) {
    const tx0 = 30, tx1 = W - 80, ty = H - 30, target = P.user && P.y > 8 ? clamp((P.x - tx0) / (tx1 - tx0), 0, 1) : 0.5 - 0.5 * Math.cos(t * 0.9), now = performance.now() / 1000;
    if (st.p == null) { st.p = target; st.last = now; } const dt = clamp(now - st.last, 0, 0.1); st.last = now; st.p = k.x <= 0 ? target : st.p + (target - st.p) * (1 - Math.exp(-dt / k.x));
    const bs = clamp(Math.min(W, H) * 0.25 * (k.s / 50), 14, (H - 80) * 0.8), x0 = 30 + bs / 2, x1 = W - 60 - bs / 2, cy = (8 + ty) / 2;
    const at = (p) => ({ x: lerp(x0, x1, p), rot: k.n > 1 ? p * TAU : 0, sc: k.n > 2 ? 0.7 + 0.6 * p : 1, hu: k.hue + (k.n > 3 ? p * 160 : 0) }), A = at(st.p), G = at(target);
    ctx.save(); ctx.translate(G.x, cy); ctx.rotate(G.rot); ctx.scale(G.sc, G.sc); ctx.strokeStyle = 'rgba(226,232,240,.45)'; ctx.setLineDash([4, 4]); rrect(ctx, -bs / 2, -bs / 2, bs, bs, bs * 0.2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.translate(A.x, cy); ctx.rotate(A.rot); ctx.scale(A.sc, A.sc); ctx.fillStyle = hsla(A.hu, 80, 60); rrect(ctx, -bs / 2, -bs / 2, bs, bs, bs * 0.2); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(148,163,184,.25)'; rrect(ctx, tx0, ty - 3, tx1 - tx0, 6, 3); ctx.fill(); ctx.fillStyle = hsla(k.hue, 80, 62); rrect(ctx, tx0, ty - 3, (tx1 - tx0) * st.p, 6, 3); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lerp(tx0, tx1, target), ty, 8, 0, TAU); ctx.stroke(); ctx.fillStyle = hsla(k.hue, 90, 75); ctx.beginPath(); ctx.arc(lerp(tx0, tx1, st.p), ty, 5, 0, TAU); ctx.fill();
    text(ctx, `属性：${SCP.slice(0, k.n).join('、')}`, 16, 22, { size: 11, col: '#94a3b8' });
    const cell = P.y > ty - 16 && P.y < ty + 16 ? `目标进度 ${Math.round(target * 100)}% · 实际 ${Math.round(st.p * 100)}%` : Math.abs(P.x - A.x) < bs * A.sc * 0.6 && Math.abs(P.y - cy) < bs * A.sc * 0.6 ? `方块：x ${Math.round(A.x)}，旋转 ${Math.round((A.rot * 180) / Math.PI)}°，缩放 ${fmt(A.sc, 2)}` : null;
    return { mode: `scrub: ${fmt(k.x, 2)} · 方块 ${Math.round(k.s)}% · 进度 ${Math.round(st.p * 100)}%`, cell };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'bounce');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'bounce';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-gsap',
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
