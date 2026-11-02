/**
 * kit-filters — 16 canvas filter / blend families. A procedural animated "photo" is rendered into a small
 * buffer, the CSS-filter math (W3C colour matrices, box blur, shadows, blends) is applied per pixel, and a
 * sweeping split line compares before / after. All knobs are live (no remount).
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
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
function scene(g, w, h, t, hue, nb = 4) {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, `hsl(${hue + 200},70%,55%)`); sky.addColorStop(0.6, `hsl(${hue + 330},75%,65%)`); sky.addColorStop(1, `hsl(${hue + 20},85%,60%)`); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = `hsl(${hue + 50},95%,70%)`; g.beginPath(); g.arc(w * (0.72 + 0.04 * Math.sin(t * 0.5)), h * 0.32, h * 0.14, 0, TAU); g.fill();
  for (let i = 0; i < nb; i++) { g.fillStyle = `hsla(${hue + i * 70},85%,55%,.85)`; g.beginPath(); g.arc(w * (0.15 + 0.7 * fract(0.2 * i + t * 0.03 * (i % 2 ? 1 : -1) + 1)), h * (0.25 + 0.2 * Math.sin(t * 0.7 + i * 2)), h * (0.07 + 0.03 * (i % 3)), 0, TAU); g.fill(); }
  g.fillStyle = `hsl(${hue + 150},45%,28%)`; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * 0.62 - h * 0.14 * (0.5 + 0.5 * Math.sin(x * 0.035 + 1) * Math.cos(x * 0.011))); g.lineTo(w, h); g.fill();
  g.fillStyle = `hsl(${hue + 170},55%,16%)`; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 4) g.lineTo(x, h * 0.8 - h * 0.08 * Math.sin(x * 0.06 + t * 0.4)); g.lineTo(w, h); g.fill();
  g.fillStyle = '#fff'; g.font = `800 ${Math.round(h * 0.13)}px ui-sans-serif,system-ui,sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('CLYUNE', w * 0.06, h * 0.94);
  for (let i = 0; i < 6; i++) { g.fillStyle = `hsl(${i * 60},90%,55%)`; g.fillRect(w * 0.62 + i * w * 0.055, h * 0.86, w * 0.045, h * 0.08); }
}
/** W3C filter colour functions, amount-parameterised; all operate on 0..1 rgb */
const MAT = {
  brightness: (a) => (r, g, b) => [r * a, g * a, b * a],
  contrast: (a) => (r, g, b) => [(r - 0.5) * a + 0.5, (g - 0.5) * a + 0.5, (b - 0.5) * a + 0.5],
  saturate: (s) => (r, g, b) => [(0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b, (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b, (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b],
  hue: (deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); const m = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]; return (r, g, b) => [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b]; },
  invert: (a) => (r, g, b) => [r * (1 - a) + (1 - r) * a, g * (1 - a) + (1 - g) * a, b * (1 - a) + (1 - b) * a],
  grayscale: (a) => { const k = 1 - a; return (r, g, b) => [(0.2126 + 0.7874 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 - 0.0722 * k) * b, (0.2126 - 0.2126 * k) * r + (0.7152 + 0.2848 * k) * g + (0.0722 - 0.0722 * k) * b, (0.2126 - 0.2126 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 + 0.9278 * k) * b]; },
  sepia: (a) => { const k = 1 - a; return (r, g, b) => [(0.393 + 0.607 * k) * r + (0.769 - 0.769 * k) * g + (0.189 - 0.189 * k) * b, (0.349 - 0.349 * k) * r + (0.686 + 0.314 * k) * g + (0.168 - 0.168 * k) * b, (0.272 - 0.272 * k) * r + (0.534 - 0.534 * k) * g + (0.131 + 0.869 * k) * b]; },
};
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function applyFn(id, fn) { const d = id.data; for (let i = 0; i < d.length; i += 4) { const o = fn(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, i); d[i] = c01(o[0]) * 255; d[i + 1] = c01(o[1]) * 255; d[i + 2] = c01(o[2]) * 255; } return id; }
function boxBlur(id, w, h, r, passes = 3) {
  r = Math.round(r); if (r < 1) return id; const d = id.data, tmp = new Float32Array(d.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) { let acc = 0; for (let x = -r; x <= r; x++) acc += d[(y * w + clamp(x, 0, w - 1)) * 4 + c]; for (let x = 0; x < w; x++) { tmp[(y * w + x) * 4 + c] = acc / (2 * r + 1); acc += d[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c] - d[(y * w + Math.max(0, x - r)) * 4 + c]; } }
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[(clamp(y, 0, h - 1) * w + x) * 4 + c]; for (let y = 0; y < h; y++) { d[(y * w + x) * 4 + c] = acc / (2 * r + 1); acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c] - tmp[(Math.max(0, y - r) * w + x) * 4 + c]; } }
  }
  return id;
}
const rgbS = (a) => `rgb(${a.map((v) => Math.round(v)).join(', ')})`;
const FCP = '<p>为了在所有浏览器里效果一致，这里没有直接调用 CSS 的 filter，而是把一张会动的风景「照片」先画到一块小画布上，再按 W3C 规范里每个滤镜的公式逐个像素计算颜色，最后放大显示。中间那条竖线左边是原图、右边是滤镜后的结果，竖线会跟着指针移动；把指针放在图上，信息面板会显示这一点滤镜前后的颜色。</p>';

/** box for the photo: size% of available area, 16:10 */
function photoBox(W, H, s, strip = 0) { const top = 16, avH = H - top - 12 - strip, avW = W - 24; let w = (avW * s) / 100, h = w * 0.62; if (h > avH) { h = avH * Math.min(1, s / 100 + 0.25); w = h / 0.62; } if (w > avW) { w = avW; h = w * 0.62; } return { x: (W - w) / 2, y: top + Math.max(0, (avH - h) / 2), w, h }; }
/** render scene into buffer, process, draw with split. proc(id, bw, bh) → ImageData (filtered). Returns sample info under P. */
function photo(ctx, st, box, t, hue, nb, proc, P, split) {
  const bw = Math.max(40, Math.min(300, Math.round(box.w / 2))), bh = Math.max(24, Math.round((bw * box.h) / box.w));
  if (!st.a || st.a.width !== bw || st.a.height !== bh) { st.a = mk(bw, bh); st.b = mk(bw, bh); }
  const ga = st.a.getContext('2d', { willReadFrequently: true }), gb = st.b.getContext('2d'); scene(ga, bw, bh, t, hue, nb);
  const src = ga.getImageData(0, 0, bw, bh), orig = new Uint8ClampedArray(src.data), out = proc(src, bw, bh, ga) || src; gb.putImageData(out, 0, 0);
  const sx = clamp(split, box.x, box.x + box.w); ctx.imageSmoothingEnabled = true;
  ctx.save(); rrect(ctx, box.x, box.y, box.w, box.h, 10); ctx.clip(); ctx.drawImage(st.a, box.x, box.y, box.w, box.h); ctx.beginPath(); ctx.rect(sx, box.y, box.x + box.w - sx, box.h); ctx.clip(); ctx.drawImage(st.b, box.x, box.y, box.w, box.h); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, box.y, 2, box.h); ctx.beginPath(); ctx.arc(sx, box.y + box.h / 2, 9, 0, TAU); ctx.fill(); text(ctx, '⇆', sx, box.y + box.h / 2 + 1, { size: 11, col: '#0f172a', align: 'center', bold: true });
  text(ctx, '原图', box.x + 10, box.y + 14, { size: 12, col: '#fff', bold: true }); text(ctx, '滤镜后', box.x + box.w - 10, box.y + 14, { size: 12, col: '#fff', align: 'right', bold: true });
  if (P.x > box.x && P.x < box.x + box.w && P.y > box.y && P.y < box.y + box.h) { const px = clamp(Math.floor(((P.x - box.x) / box.w) * bw), 0, bw - 1), py = clamp(Math.floor(((P.y - box.y) / box.h) * bh), 0, bh - 1), i = (py * bw + px) * 4; return `滤镜前 ${rgbS([orig[i], orig[i + 1], orig[i + 2]])} → 滤镜后 ${rgbS([out.data[i], out.data[i + 1], out.data[i + 2]])}`; }
  return null;
}
/** swatch strip: n hues, top = original, bottom = filtered via fn */
function swatches(ctx, W, y, n, hue, fn, P) { const sw = Math.min(56, (W - 40) / n), x0 = (W - sw * n) / 2; let cell = null;
  text(ctx, '原色', x0 - 6, y + 10, { size: 10, col: '#94a3b8', align: 'right' }); text(ctx, '结果', x0 - 6, y + 32, { size: 10, col: '#94a3b8', align: 'right' });
  for (let i = 0; i < n; i++) { const hh2 = hue + (i * 360) / n, l = i % 2 ? 0.62 : 0.45, c = hslRgb(hh2, 0.75, l), o = fn(c[0], c[1], c[2]).map(c01), x = x0 + i * sw; ctx.fillStyle = rgbS(c.map((v) => v * 255)); ctx.fillRect(x, y, sw - 2, 20); ctx.fillStyle = rgbS(o.map((v) => v * 255)); ctx.fillRect(x, y + 22, sw - 2, 20); if (P.x > x && P.x < x + sw && P.y > y && P.y < y + 42) cell = `色卡 ${i + 1}：${rgbS(c.map((v) => v * 255))} → ${rgbS(o.map((v) => v * 255))}`; }
  return cell; }
const hslRgb = (h, s, l) => { h = (((h % 360) + 360) % 360) / 360; const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; };

/** fFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k, st) returns { mode?, n?, cell? } */
function fFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '画面变化速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key] ?? ex.value) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key] ?? ex.value)}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>${d.noPhoto ? '' : FCP}`,
      params: [['主色', '画面的主色调，其他颜色由它在色环上偏移得到'], [spec.speed.label, '画面里物体移动的快慢，0 表示静止'], [spec.size.label, d.sizeDoc || '元素的大小'], [d.count.label, d.countDoc || '元素的数量'], [ex.label, d.extraDoc || '该效果特有的参数']],
      example: (v) => `<ol><li>当前：${v.mode}</li><li>${d.count.label}：${v.n}；指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖动右侧滑条立即看到变化</li></ol>`,
      tip: d.tip || '移动指针拖动对比线，并查看指针处滤镜前后的颜色；右侧滑条实时调整。',
    },
    build(S) {
      const st = {};
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', tt = t * num(C.speed, 0.9);
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), cx: W / 2, cy: (H + 8) / 2, tt, split: P.x };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        ctx.fillStyle = hsla(k.hue, 80, 65, 0.7); ctx.fillRect(0, H - 4, (W - 56) * fract(tt / 4), 4);
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: r.cell || '指针不在图片上', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });
const SZ = (label, min, max, value, step = 1) => ({ label, min, max, step, value });

const colorFam = (key, o) => fFam({ title: o.title, count: NC('色卡数', 2, 12, 6), extra: R('amt', o.label, o.min, o.max, o.step, o.value), size: SZ('图片大小', 30, 100, 80), color: o.color,
  countDoc: '图片下方用来对照的色卡数量：上排是原色，下排是经过滤镜后的颜色', extraDoc: o.extraDoc, sizeDoc: '图片宽度占画面的百分比',
  presets: o.presets, explain: o.explain, formula: o.formula, formula2: o.formula2,
  draw(ctx, W, H, t, C, P, k, st) {
    const fn = MAT[key](k.x), box = photoBox(W, H, k.s, 60), c1 = photo(ctx, st, box, t, k.hue, 4, (id) => applyFn(id, fn), P, k.split), c2 = swatches(ctx, W, box.y + box.h + 12, k.n, k.hue, fn, P);
    return { mode: `filter: ${o.css(k.x)}`, cell: c1 || c2 };
  } });
FAM.blur = fFam({ title: '模糊', count: NC('模糊迭代', 1, 5, 3), extra: R('radius', '模糊半径', 0, 16, 0.5, 4), size: SZ('图片大小', 30, 100, 80), color: '#60a5fa',
  countDoc: '盒式模糊重复的次数：1 次是方块状的模糊，重复 3 次就非常接近高斯模糊', extraDoc: '每个像素向四周取平均的范围（像素）', sizeDoc: '图片宽度占画面的百分比',
  presets: { 单次: { count: 1 }, 五次: { count: 5 }, 清晰: { radius: 0 }, 重糊: { radius: 15 }, 大图: { size: 100 } },
  explain: '模糊 blur()：把每个像素换成它周围一圈像素的平均值，图像的细节就被抹平了。真正的高斯模糊计算量大，常用的近似方法是「盒式模糊」：先横向求平均、再纵向求平均，并重复几次——重复 3 次后的结果和高斯模糊几乎一样。',
  formula: '新值(x) = (1 / (2r + 1)) · Σ 原值(x + i)，i = −r … r', formula2: '重复 n 次盒式模糊 ≈ 高斯模糊',
  draw(ctx, W, H, t, C, P, k, st) {
    const box = photoBox(W, H, k.s), r = k.x * (Math.min(300, box.w / 2) / 300), c = photo(ctx, st, box, t, k.hue, 4, (id, w, h) => boxBlur(id, w, h, r, k.n), P, k.split);
    return { mode: `filter: blur(${fmt(k.x, 1)}px) · 迭代 ${k.n} 次`, cell: c };
  } });
FAM.brightness = colorFam('brightness', { title: '亮度', label: '亮度倍数', min: 0, max: 3, step: 0.01, value: 1.6, color: '#facc15', css: (a) => `brightness(${fmt(a, 2)})`,
  extraDoc: '每个颜色通道乘以的倍数：1 不变，小于 1 变暗，大于 1 变亮',
  presets: { 全黑: { amt: 0 }, 变暗: { amt: 0.5 }, 原样: { amt: 1 }, 很亮: { amt: 2.6 }, 少色卡: { count: 2 } },
  explain: '亮度 brightness()：把红、绿、蓝三个通道都乘以同一个数。乘以 0.5 整体变暗一半，乘以 2 变亮一倍；超过 255 的部分会被截断成白色，所以亮度太高时亮部细节会丢失（过曝）。', formula: '(R, G, B) → (a·R, a·G, a·B)', formula2: '结果限制在 0 … 255 之间' });
FAM.contrast = colorFam('contrast', { title: '对比度', label: '对比倍数', min: 0, max: 3, step: 0.01, value: 1.8, color: '#a3e635', css: (a) => `contrast(${fmt(a, 2)})`,
  extraDoc: '颜色离中间灰的距离被放大的倍数：1 不变，0 全部变成灰色',
  presets: { 全灰: { amt: 0 }, 低对比: { amt: 0.5 }, 原样: { amt: 1 }, 高对比: { amt: 2.8 }, 少色卡: { count: 2 } },
  explain: '对比度 contrast()：以中间灰（0.5）为中心，把每个通道到中心的距离乘以一个倍数。倍数大于 1 时亮的更亮、暗的更暗，画面更「硬」；小于 1 时所有颜色向灰色靠拢，画面发灰。', formula: 'v → (v − 0.5) · a + 0.5', formula2: 'v 为 0 … 1 的通道值' });
FAM.saturate = colorFam('saturate', { title: '饱和度', label: '饱和倍数', min: 0, max: 4, step: 0.01, value: 2.2, color: '#f472b6', css: (a) => `saturate(${fmt(a, 2)})`,
  extraDoc: '颜色鲜艳程度的倍数：0 为黑白，1 不变，大于 1 更鲜艳',
  presets: { 黑白: { amt: 0 }, 淡彩: { amt: 0.5 }, 原样: { amt: 1 }, 浓艳: { amt: 3.8 }, 多色卡: { count: 12 } },
  explain: '饱和度 saturate()：先算出颜色的「灰度」（亮度相同的灰色），再把颜色与这个灰色的差距放大或缩小。差距放大颜色更鲜艳，缩小到 0 就只剩灰色。W3C 规范用一个 3×3 的颜色矩阵来实现。', formula: '结果 = 灰度 + s · (原色 − 灰度)', formula2: '灰度 = 0.213R + 0.715G + 0.072B' });
FAM.hue = colorFam('hue', { title: '色相旋转', label: '旋转角度', min: 0, max: 360, step: 1, value: 120, color: '#c084fc', css: (a) => `hue-rotate(${Math.round(a)}deg)`,
  extraDoc: '在色环上把所有颜色转过的角度：120° 时红变绿、绿变蓝',
  presets: { 不转: { amt: 0 }, 九十度: { amt: 90 }, 半圈: { amt: 180 }, 近一圈: { amt: 330 }, 多色卡: { count: 12 } },
  explain: '色相旋转 hue-rotate()：把每个颜色在色环上转过同一个角度，亮度基本不变。转 180° 时颜色变成互补色（蓝 ↔ 橙）；转满 360° 回到原样。下方色卡能清楚看到每种颜色被转到了哪里。', formula: '(R, G, B) → M(θ) · (R, G, B)', formula2: 'M(θ) 由 cos θ 与 sin θ 组成的 3×3 矩阵' });
FAM.invert = colorFam('invert', { title: '反相', label: '反相程度', min: 0, max: 1, step: 0.01, value: 1, color: '#2dd4bf', css: (a) => `invert(${fmt(a, 2)})`,
  extraDoc: '0 为原图，1 为完全反相（像照片底片），0.5 时所有颜色都变成灰色',
  presets: { 原样: { amt: 0 }, 三成: { amt: 0.3 }, 一半: { amt: 0.5 }, 全反: { amt: 1 }, 少色卡: { count: 2 } },
  explain: '反相 invert()：把每个通道换成「255 减去它」，黑变白、白变黑、红变青，就像老式胶片的底片。程度 a 在原图和完全反相之间插值，a = 0.5 时两者正好抵消成灰色。', formula: 'v → v · (1 − a) + (1 − v) · a', formula2: 'a = 1 时：v → 1 − v' });
FAM.grayscale = colorFam('grayscale', { title: '灰度', label: '灰度程度', min: 0, max: 1, step: 0.01, value: 0.85, color: '#94a3b8', css: (a) => `grayscale(${fmt(a, 2)})`,
  extraDoc: '0 为原图，1 为完全黑白',
  presets: { 原样: { amt: 0 }, 半灰: { amt: 0.5 }, 全灰: { amt: 1 }, 多色卡: { count: 12 }, 小图: { size: 40 } },
  explain: '灰度 grayscale()：把颜色换成亮度相同的灰色。人眼对绿色最敏感、对蓝色最不敏感，所以计算亮度时绿色的权重最大（0.7152），蓝色最小（0.0722）。程度 a 在原图和灰图之间插值。', formula: '灰 = 0.2126R + 0.7152G + 0.0722B', formula2: '结果 = 原色 + a · (灰 − 原色)' });
FAM.sepia = colorFam('sepia', { title: '褐色怀旧', label: '褐色程度', min: 0, max: 1, step: 0.01, value: 0.9, color: '#d97706', css: (a) => `sepia(${fmt(a, 2)})`,
  extraDoc: '0 为原图，1 为完全的老照片褐色',
  presets: { 原样: { amt: 0 }, 淡褐: { amt: 0.4 }, 全褐: { amt: 1 }, 多色卡: { count: 12 }, 小图: { size: 40 } },
  explain: '褐色 sepia()：模仿老照片发黄发褐的效果。它先把颜色变成灰度，再把灰度映射到偏红黄的褐色上：红通道得到最多、蓝通道最少。程度 a 在原图和完全褐色之间插值。', formula: 'R′ = 0.393R + 0.769G + 0.189B', formula2: 'G′ = 0.349R + 0.686G + 0.168B，B′ = 0.272R + 0.534G + 0.131B' });

const shapeAt = (ctx, kind, x, y, r) => { ctx.beginPath(); if (kind === 0) ctx.arc(x, y, r, 0, TAU); else if (kind === 1) rrect(ctx, x - r, y - r, r * 2, r * 2, r * 0.3); else if (kind === 2) { for (let j = 0; j < 3; j++) { const a = -Math.PI / 2 + (j * TAU) / 3; ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15); } ctx.closePath(); } else if (kind === 3) heartQ(ctx, x, y, r); else if (kind === 4) { for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * TAU) / 10, rr = j % 2 ? r * 0.45 : r * 1.1; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); } else { for (let j = 0; j < 6; j++) { const a = (j * TAU) / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); } };
const heartQ = (ctx, x, y, s) => { ctx.moveTo(x, y + s * 0.8); ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.45); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.8); ctx.closePath(); };
const SHN2 = ['圆', '方块', '三角', '爱心', '星', '六边形'];
FAM['drop-shadow'] = fFam({ title: '投影发光', count: NC('图形数', 1, 6, 4), extra: R('blur', '阴影模糊', 0, 40, 0.5, 14), size: SZ('图形大小', 30, 100, 60), color: '#f59e0b', noPhoto: true,
  countDoc: '画面中带投影的图形数量', extraDoc: '阴影边缘的模糊程度（像素），0 为硬边阴影', sizeDoc: '图形大小（占格子的百分比）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 硬影: { blur: 0 }, 柔影: { blur: 38 }, 大图形: { size: 98 } },
  explain: '投影 drop-shadow()：和 box-shadow 不同，drop-shadow 会沿着图形真实的轮廓（包括透明区域）生成阴影，所以星形、爱心也有贴合形状的阴影。阴影方向由光源决定：这里光源就是你的指针，阴影总是落在图形背对指针的一侧，离得越远阴影越长。',
  formula: '阴影偏移 = (图形中心 − 光源) · 0.12（最长 40px）', formula2: 'filter: drop-shadow(dx dy 模糊 颜色)',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(k.n, W, H - 6); let cell = null;
    ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let x = 0; x < W; x += 24) ctx.fillRect(x, 8, 1, H); for (let y = 8; y < H; y += 24) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = hsla(k.hue + 40, 100, 80); ctx.beginPath(); ctx.arc(P.x, P.y, 7, 0, TAU); ctx.fill();
    cells.forEach((c, i) => { const r = c.r * (k.s / 60) * 0.7, y = c.y + Math.sin(t * 1.3 + i) * 4; let dx = (c.x - P.x) * 0.12, dy = (y - P.y) * 0.12; const m = Math.hypot(dx, dy); if (m > 40) { dx *= 40 / m; dy *= 40 / m; }
      ctx.save(); ctx.shadowColor = hsla(k.hue + i * 40, 80, 8, 0.85); ctx.shadowBlur = k.x; ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy; ctx.fillStyle = hsla(k.hue + i * 40, 80, 60); shapeAt(ctx, i % 6, c.x, y, r); ctx.fill(); ctx.restore();
      if (inCell(P, c)) cell = `${SHN2[i % 6]}：阴影偏移 (${Math.round(dx)}, ${Math.round(dy)})`; });
    return { mode: `filter: drop-shadow(dx dy ${fmt(k.x, 1)}px)`, cell };
  } });

const NEON = ['OPEN', 'NEON', '霓虹灯', 'BAR', '24H', 'LOVE'];
FAM['neon-combo'] = fFam({ title: '组合霓虹', count: NC('灯牌行数', 1, 6, 3), extra: R('glow', '发光强度', 0, 1, 0.01, 0.7), size: SZ('字号', 18, 90, 48), color: '#22d3ee', noPhoto: true,
  countDoc: '霓虹灯牌上的文字行数', extraDoc: '外层光晕的强度：0 只剩灯管本身', sizeDoc: '霓虹文字的字号（放不下时自动缩小）',
  presets: { 单行: { count: 1 }, 六行: { count: 6 }, 熄灭感: { glow: 0 }, 强光: { glow: 1 }, 大字: { size: 88 } },
  explain: '组合霓虹：霓虹灯的效果是几层滤镜叠出来的——最外层是大范围、半透明的彩色光晕（大模糊的 drop-shadow），中间是较小的光晕，最里面是接近白色的灯管本身。偶尔让某一行快速闪烁两下，就像接触不良的真霓虹灯。',
  formula: '光晕层 i：drop-shadow(0 0 (4 · 3ⁱ · 强度)px 颜色)，i = 0, 1, 2', formula2: '灯管颜色 = 白色与主色混合',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, lh = Math.min(k.s * 1.5, (H - 30) / n), y0 = k.cy - (n * lh) / 2 + lh / 2; let cell = null;
    ctx.fillStyle = '#0b0f1d'; ctx.fillRect(0, 8, W, H); ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let x = 0; x < W; x += 18) ctx.fillRect(x, 8, 9, H);
    for (let i = 0; i < n; i++) {
      const s = NEON[i], fs = Math.min(k.s, lh * 0.8, (W * 0.85) / Math.max(2, [...s].length * (/[A-Z0-9]/.test(s) ? 0.68 : 1))), y = y0 + i * lh, hu = k.hue + i * 55, cyc = fract(t * 0.25 + i * 0.37), flick = cyc > 0.9 && Math.sin(cyc * 300) > 0 ? 0.25 : 1;
      ctx.font = `700 ${fs}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let L = 2; L >= 0; L--) { ctx.save(); ctx.shadowColor = hsla(hu, 100, 60, flick); ctx.shadowBlur = 4 * Math.pow(3, L) * k.x; ctx.fillStyle = hsla(hu, 100, 60 + L * 0, 0.0001 + (L ? 0.35 : 1) * flick); ctx.fillText(s, W / 2, y); ctx.restore(); }
      ctx.fillStyle = hsla(hu, 100, 92, flick); ctx.fillText(s, W / 2, y);
      if (Math.abs(P.y - y) < lh / 2) cell = `「${s}」${flick < 1 ? '闪烁中' : '常亮'}`;
    }
    return { mode: `发光强度 ${fmt(k.x, 2)} · 外层光晕 ${Math.round(36 * k.x)}px`, cell };
  } });

FAM.glass = fFam({ title: '毛玻璃', count: NC('背景色块', 2, 10, 5), extra: R('blur', '模糊半径', 0, 30, 0.5, 10), size: SZ('玻璃卡大小', 20, 90, 50), color: '#38bdf8',
  countDoc: '玻璃卡后面漂浮的彩色圆块数量', extraDoc: '透过玻璃看到的背景模糊程度', sizeDoc: '玻璃卡宽度占图片的百分比',
  presets: { 少色块: { count: 2 }, 多色块: { count: 10 }, 透明: { blur: 0 }, 重糊: { blur: 29 }, 大卡: { size: 88 } },
  explain: '毛玻璃 backdrop-filter: blur()：给卡片背后的内容做模糊，再盖上一层半透明的白色和一条亮边，看起来就像隔着磨砂玻璃。注意被模糊的是「卡片后面的背景」，卡片自己的文字仍然清晰。玻璃卡会跟着指针缓慢移动。',
  formula: '卡片区域 = 模糊(背景) + rgba(255,255,255,0.12)', formula2: 'CSS：backdrop-filter: blur(r) saturate(1.4)',
  draw(ctx, W, H, t, C, P, k, st) {
    const box = photoBox(W, H, 100); const bw = Math.max(40, Math.min(300, Math.round(box.w / 2))), bh = Math.max(24, Math.round((bw * box.h) / box.w));
    if (!st.a || st.a.width !== bw || st.a.height !== bh) { st.a = mk(bw, bh); st.b = mk(bw, bh); }
    const ga = st.a.getContext('2d', { willReadFrequently: true }); scene(ga, bw, bh, t, k.hue, k.n); const id = ga.getImageData(0, 0, bw, bh); st.b.getContext('2d').putImageData(boxBlur(applyFn(id, MAT.saturate(1.4)), bw, bh, k.x * (bw / 300), 3), 0, 0);
    ctx.save(); rrect(ctx, box.x, box.y, box.w, box.h, 10); ctx.clip(); ctx.drawImage(st.a, box.x, box.y, box.w, box.h); ctx.restore();
    const cw = (box.w * k.s) / 100, ch = Math.min(box.h * 0.8, cw * 0.62); st.gx = st.gx ?? W / 2; st.gy = st.gy ?? box.y + box.h / 2; st.gx += (clamp(P.x, box.x + cw / 2, box.x + box.w - cw / 2) - st.gx) * 0.06; st.gy += (clamp(P.y, box.y + ch / 2, box.y + box.h - ch / 2) - st.gy) * 0.06;
    const gx = st.gx - cw / 2, gy = st.gy - ch / 2; ctx.save(); rrect(ctx, gx, gy, cw, ch, 16); ctx.clip(); ctx.drawImage(st.b, box.x, box.y, box.w, box.h); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(gx, gy, cw, ch); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; rrect(ctx, gx, gy, cw, ch, 16); ctx.stroke();
    text(ctx, '毛玻璃卡片', gx + 16, gy + 24, { size: clamp(cw / 12, 12, 22), col: '#fff', bold: true }); text(ctx, `blur(${fmt(k.x, 1)}px)`, gx + 16, gy + 24 + clamp(cw / 12, 12, 22) + 6, { size: 12, col: 'rgba(255,255,255,.85)' });
    const inG = P.x > gx && P.x < gx + cw && P.y > gy && P.y < gy + ch;
    return { mode: `backdrop-filter: blur(${fmt(k.x, 1)}px) · 卡宽 ${Math.round(k.s)}%`, cell: inG ? '玻璃卡内（背景被模糊）' : P.y > box.y && P.y < box.y + box.h ? '玻璃卡外（背景清晰）' : null };
  } });

FAM.duotone = fFam({ title: '双色调', count: NC('色阶数', 2, 16, 16), extra: R('contrast', '对比度', 0.5, 2.5, 0.01, 1.2), size: SZ('图片大小', 30, 100, 80), color: '#e11d48',
  countDoc: '从暗色到亮色之间分成几级：2 级是海报式的硬分色，16 级接近平滑过渡', extraDoc: '映射前先拉开亮度差距，越大暗部越暗、亮部越亮', sizeDoc: '图片宽度占画面的百分比',
  presets: { 两级: { count: 2 }, 四级: { count: 4 }, 柔和: { contrast: 0.6 }, 强对比: { contrast: 2.4 }, 大图: { size: 100 } },
  explain: '双色调：先把图片变成灰度，只保留「亮还是暗」的信息；再规定两种颜色，最暗处用暗色（主色），最亮处用亮色（主色的互补色附近），中间按亮度在两种颜色之间插值。Spotify 的海报就是这种风格。CSS 里可以用 grayscale + mix-blend-mode 或 SVG feColorMatrix 实现。',
  formula: 'L = 0.2126R + 0.7152G + 0.0722B，L′ = (L − 0.5) · 对比 + 0.5', formula2: '颜色 = 暗色 + (亮色 − 暗色) · 量化(L′, 色阶数)',
  draw(ctx, W, H, t, C, P, k, st) {
    const dk = hslRgb(k.hue, 0.8, 0.18), lt = hslRgb(k.hue + 160, 0.9, 0.72), q = (v) => (k.n >= 16 ? v : Math.round(v * (k.n - 1)) / (k.n - 1));
    const fn = (r, g, b) => { const L = q(c01((0.2126 * r + 0.7152 * g + 0.0722 * b - 0.5) * k.x + 0.5)); return [dk[0] + (lt[0] - dk[0]) * L, dk[1] + (lt[1] - dk[1]) * L, dk[2] + (lt[2] - dk[2]) * L]; };
    const box = photoBox(W, H, k.s, 34), c = photo(ctx, st, box, t, k.hue, 4, (id) => applyFn(id, fn), P, k.split), gy = box.y + box.h + 10, gw = Math.min(W - 60, 400), gx0 = (W - gw) / 2;
    for (let i = 0; i < 64; i++) { const v = q(i / 63); ctx.fillStyle = rgbS([0, 1, 2].map((j) => (dk[j] + (lt[j] - dk[j]) * v) * 255)); ctx.fillRect(gx0 + (i * gw) / 64, gy, gw / 64 + 1, 18); }
    text(ctx, '暗', gx0 - 6, gy + 9, { size: 11, col: '#94a3b8', align: 'right' }); text(ctx, '亮', gx0 + gw + 6, gy + 9, { size: 11, col: '#94a3b8' });
    return { mode: `双色调 · ${k.n >= 16 ? '平滑' : `${k.n} 级`} · 对比 ${fmt(k.x, 2)}`, cell: c };
  } });

FAM['glitch-f'] = fFam({ title: '故障抖动', count: NC('切片数', 2, 24, 8), extra: R('shift', '色差偏移', 0, 20, 0.5, 6), size: SZ('图片大小', 30, 100, 80), color: '#f43f5e',
  countDoc: '画面被横向切成几条，每条会随机左右错位', extraDoc: '红、蓝通道分别向左右偏移的距离（像素），形成色差', sizeDoc: '图片宽度占画面的百分比',
  presets: { 少切片: { count: 2 }, 多切片: { count: 24 }, 无色差: { shift: 0 }, 强色差: { shift: 19 }, 大图: { size: 100 } },
  explain: '故障效果（glitch）：模拟信号不良的电视画面。做法是：① 把图片横切成若干条，随机挑几条左右错开；② 把红色通道向左挪、蓝色通道向右挪，边缘出现红蓝重影（色差）。错位每隔一小段时间随机变化一次，看起来就在「抖」。',
  formula: '第 j 条切片偏移 = 随机(时间块, j) · 0.12 · 宽（约 30% 的切片会错位）', formula2: 'R(x) = 原R(x + 偏移)，B(x) = 原B(x − 偏移)',
  draw(ctx, W, H, t, C, P, k, st) {
    const box = photoBox(W, H, k.s), blk = Math.floor(t * 6), sh = Math.round(k.x * (Math.min(300, box.w / 2) / 300));
    const c = photo(ctx, st, box, t, k.hue, 4, (id, w, h) => { const s = new Uint8ClampedArray(id.data), d = id.data, sl = h / k.n;
      for (let y = 0; y < h; y++) { const j = Math.floor(y / sl), off = hh(j, blk) > 0.7 ? Math.round((hh(j, blk + 99) - 0.5) * 0.24 * w) : 0;
        for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, xr = clamp(x + off + sh, 0, w - 1), xg = clamp(x + off, 0, w - 1), xb = clamp(x + off - sh, 0, w - 1); d[i] = s[(y * w + xr) * 4]; d[i + 1] = s[(y * w + xg) * 4 + 1]; d[i + 2] = s[(y * w + xb) * 4 + 2]; } }
      return id; }, P, k.split);
    ctx.save(); rrect(ctx, box.x, box.y, box.w, box.h, 10); ctx.clip(); ctx.fillStyle = hsla(k.hue, 95, 58, 0.22); for (let y = box.y; y < box.y + box.h; y += 4) ctx.fillRect(box.x, y, box.w, 2); ctx.restore();
    ctx.strokeStyle = hsla(k.hue, 95, 62, 0.9); ctx.lineWidth = 3; rrect(ctx, box.x - 2, box.y - 2, box.w + 4, box.h + 4, 11); ctx.stroke();
    let moved = 0; for (let j = 0; j < k.n; j++) if (hh(j, blk) > 0.7) moved++;
    return { mode: `${k.n} 条切片中 ${moved} 条错位 · 色差 ${fmt(k.x, 1)}px`, cell: c };
  } });

FAM.vignette = fFam({ title: '暗角', count: NC('渐变级数', 2, 16, 16), extra: R('amount', '暗角强度', 0, 1, 0.01, 0.75), size: SZ('暗角半径', 30, 100, 65), color: '#a78bfa',
  countDoc: '从中心到边缘的明暗变化分成几级：16 级为平滑过渡，级数少时能看到一圈圈的台阶', extraDoc: '边缘最暗处变暗的比例：0 不变暗，1 边缘全黑', sizeDoc: '中心保持明亮的区域大小（占对角线的百分比）',
  presets: { 两级: { count: 2 }, 四级: { count: 4 }, 无暗角: { amount: 0 }, 浓暗角: { amount: 1 }, 小光圈: { size: 32 } },
  explain: '暗角（vignette）：让画面四周逐渐变暗，把视线集中到中心，常见于摄影和电影。每个像素到中心的距离 d 越大，就乘以一个越小的系数。CSS 里通常用一个 radial-gradient 从透明到黑色的径向渐变盖在图片上。',
  formula: 'd = 像素到中心的距离 / 半对角线', formula2: '亮度系数 = 1 − 强度 · 平滑(d − 半径, 0 → 1 − 半径)',
  draw(ctx, W, H, t, C, P, k, st) {
    const box = photoBox(W, H, 85), rad = k.s / 100, q = (v) => (k.n >= 16 ? v : Math.round(v * (k.n - 1)) / (k.n - 1));
    const c = photo(ctx, st, box, t, k.hue, 4, (id, w, h) => applyFn(id, (r, g, b, i) => { const p = i / 4, x = (p % w) / w - 0.5, y = Math.floor(p / w) / h - 0.5, d = Math.hypot(x, y) / 0.7071, f = 1 - k.x * q(smooth((d - rad) / Math.max(0.05, 1 - rad))); return [r * f, g * f, b * f]; }), P, k.split);
    return { mode: `暗角强度 ${fmt(k.x, 2)} · 半径 ${Math.round(k.s)}% · ${k.n >= 16 ? '平滑' : `${k.n} 级`}`, cell: c };
  } });

FAM['glow-edge'] = fFam({ title: '发光描边', count: NC('图形数', 1, 6, 3), extra: R('glow', '发光半径', 0, 30, 0.5, 12), size: SZ('描边粗细', 1, 12, 3, 0.5), color: '#4ade80', noPhoto: true,
  countDoc: '画面中发光图形的数量', extraDoc: '描边外光晕的模糊半径（像素）', sizeDoc: '图形描边的线宽（像素）',
  presets: { 单个: { count: 1 }, 六个: { count: 6 }, 无光: { glow: 0 }, 强光: { glow: 29 }, 粗线: { size: 11 } },
  explain: '发光描边：只给图形画轮廓线，并给轮廓线加上同色的模糊阴影（drop-shadow / text-shadow），就得到一圈发光的边。叠加两层（一层大模糊、一层小模糊）光会更饱满。一个亮点沿着轮廓跑动，模拟流光。',
  formula: '光晕 = drop-shadow(0 0 r 颜色) 叠加 drop-shadow(0 0 r/3 颜色)', formula2: '流光位置 = 轮廓上的 (时间 · 0.25) mod 1 处',
  draw(ctx, W, H, t, C, P, k) {
    const cells = grid(k.n, W, H - 6); let cell = null;
    cells.forEach((c, i) => { const r = c.r * 0.8, hu = k.hue + i * 50; for (const L of [1, 0.33]) { ctx.save(); ctx.shadowColor = hsla(hu, 100, 60); ctx.shadowBlur = k.x * L; ctx.strokeStyle = hsla(hu, 100, 70); ctx.lineWidth = k.s; ctx.lineJoin = 'round'; shapeAt(ctx, [1, 0, 4, 5, 2, 3][i % 6], c.x, c.y, r); ctx.stroke(); ctx.restore(); }
      const a = TAU * fract(t * 0.25 + i * 0.2); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * r * 0.9, c.y + Math.sin(a) * r * 0.9, k.s * 0.8 + 1.5, 0, TAU); ctx.fill(); ctx.restore();
      if (inCell(P, c)) cell = `图形 ${i + 1}：线宽 ${fmt(k.s, 1)}px · 光晕 ${fmt(k.x, 1)}px`; });
    return { mode: `发光半径 ${fmt(k.x, 1)}px · 线宽 ${fmt(k.s, 1)}px`, cell };
  } });

FAM.backdrop = fFam({ title: '背板模糊', count: NC('卡片数', 1, 4, 2), extra: R('blur', '背板模糊', 0, 30, 0.5, 8), size: SZ('卡片大小', 20, 100, 60), color: '#818cf8', noPhoto: true,
  countDoc: '叠在滚动内容上方的半透明卡片数量', extraDoc: '卡片下方内容的模糊程度', sizeDoc: '卡片宽度（占画面的百分比）',
  presets: { 单卡: { count: 1 }, 四卡: { count: 4 }, 不糊: { blur: 0 }, 重糊: { blur: 29 }, 宽卡: { size: 98 } },
  explain: '背板模糊：iOS 的导航栏、通知中心都用这个效果——内容在卡片下面滚动，透过卡片看到的部分是模糊的，既能看出下面有东西，又不影响卡片上文字的阅读。实现方式：把卡片区域下面的画面单独取出来做模糊，再画回卡片位置。',
  formula: '卡片区域像素 = 模糊(下方内容)', formula2: 'CSS：backdrop-filter: blur(r); background: rgba(15,23,42,.35)',
  draw(ctx, W, H, t, C, P, k, st) {
    const bw = Math.max(40, Math.round(W / 3)), bh = Math.max(30, Math.round((H - 8) / 3));
    if (!st.a || st.a.width !== bw || st.a.height !== bh) { st.a = mk(bw, bh); st.b = mk(bw, bh); }
    const g = st.a.getContext('2d', { willReadFrequently: true }), sx = bw / W, off = (t * 30) % 60; g.fillStyle = '#0b1222'; g.fillRect(0, 0, bw, bh);
    for (let r = -1; r < bh / (60 * sx) + 1; r++) { const y = (r * 60 - off) * sx, hu = k.hue + r * 37; g.fillStyle = `hsl(${hu},70%,55%)`; g.beginPath(); g.arc(24 * sx, y + 30 * sx, 16 * sx, 0, TAU); g.fill(); g.fillStyle = 'rgba(226,232,240,.8)'; g.fillRect(50 * sx, y + 18 * sx, (W * 0.5 + 60 * Math.sin(r)) * sx, 9 * sx); g.fillStyle = 'rgba(148,163,184,.6)'; g.fillRect(50 * sx, y + 34 * sx, W * 0.35 * sx, 7 * sx); g.fillStyle = `hsl(${hu + 120},70%,60%)`; g.fillRect((W - 120) * sx, y + 14 * sx, 70 * sx, 32 * sx); }
    ctx.drawImage(st.a, 0, 8, W, H - 8); const id = g.getImageData(0, 0, bw, bh); st.b.getContext('2d').putImageData(boxBlur(id, bw, bh, k.x * sx * 1.2, 3), 0, 0);
    let cell = null; const cw = Math.max(120, ((W - 40) * k.s) / 100), ch = Math.min(90, (H - 30) / k.n - 14);
    for (let i = 0; i < k.n; i++) { const x = (W - cw) / 2 + Math.sin(t * 0.6 + i * 1.7) * Math.max(0, (W - cw) / 2 - 10), y = 16 + i * ((H - 24) / k.n) + ((H - 24) / k.n - ch) / 2;
      ctx.save(); rrect(ctx, x, y, cw, ch, 14); ctx.clip(); ctx.drawImage(st.b, 0, 8, W, H - 8); ctx.fillStyle = 'rgba(15,23,42,.35)'; ctx.fillRect(x, y, cw, ch); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; rrect(ctx, x, y, cw, ch, 14); ctx.stroke();
      text(ctx, `卡片 ${i + 1} · blur(${fmt(k.x, 1)}px)`, x + 14, y + ch / 2, { size: 13, col: '#fff', bold: true }); if (P.x > x && P.x < x + cw && P.y > y && P.y < y + ch) cell = `卡片 ${i + 1}：下方内容被模糊`; }
    return { mode: `backdrop-filter: blur(${fmt(k.x, 1)}px) · ${k.n} 张卡`, cell: cell || (P.y > 8 ? '未被遮挡的内容（清晰）' : null) };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'blur');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'blur';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-filters',
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
