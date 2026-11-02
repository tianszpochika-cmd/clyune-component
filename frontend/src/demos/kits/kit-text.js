/**
 * kit-text — text effects drawn per glyph on a canvas stage. Layout wraps to the
 * stage width; every glyph's state is a pure function of (index, t, pointer).
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
const FONT = (fs, w = 800) => `${w} ${Math.round(fs)}px "PingFang SC","Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif`;
const TXT = '文字特效让每一个字都动起来TEXT FX 创意排版动画与交互设计灵感';
const GLY = ['ア', 'ネ', '字', '#', '%', '&', '@', '0', '1', '7', 'X', 'Ω', '∑', '◆', '§', '?', '光', '码'];
const LAY = new Map();
/** wrap glyphs to width; returns { g: [{ ch, x, y, w }], lines, lh } centered in the stage */
function layout(ctx, str, fs, W, H, top = 8, lhK = 1.25) {
  const key = `${str}|${fs}|${W}|${H}|${top}|${lhK}`;
  if (LAY.has(key)) return LAY.get(key);
  ctx.save(); ctx.font = FONT(fs); const chars = [...str], ws = chars.map((c) => ctx.measureText(c).width); ctx.restore();
  const maxW = W * 0.9, rows = []; let row = [], rw = 0;
  chars.forEach((c, i) => { if (rw + ws[i] > maxW && row.length) { rows.push([row, rw]); row = []; rw = 0; } if (!(c === ' ' && !row.length)) { row.push(i); rw += ws[i]; } });
  if (row.length) rows.push([row, rw]);
  const lh = fs * lhK, y0 = top + (H - top) / 2 - (rows.length * lh) / 2 + lh / 2, g = [];
  rows.forEach(([r, w], li) => { let x = W / 2 - w / 2; r.forEach((i) => { g.push({ ch: chars[i], x: x + ws[i] / 2, y: y0 + li * lh, w: ws[i], line: li }); x += ws[i]; }); });
  const out = { g, lines: rows.length, lh };
  if (LAY.size > 200) LAY.clear(); LAY.set(key, out); return out;
}
/** sample glyph pixels of text into points (for pixel / smoke) */
const SMP = new Map();
function sampleText(str, fs, W, H, step) {
  const key = `${str}|${fs}|${W}|${H}|${step}`; if (SMP.has(key)) return SMP.get(key);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(W)); c.height = Math.max(1, Math.ceil(H)); const x = c.getContext('2d');
  const L = layout(x, str, fs, W, H); x.font = FONT(fs); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; L.g.forEach((g) => x.fillText(g.ch, g.x, g.y));
  const d = x.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let y = 0; y < c.height; y += step) for (let xx = 0; xx < c.width; xx += step) if (d[(y * c.width + xx) * 4 + 3] > 128) pts.push([xx, y]);
  if (SMP.size > 40) SMP.clear(); SMP.set(key, pts); return pts;
}

/** tFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k) returns { mode?, n?, cell? } */
function tFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size || { label: '字号', min: 16, max: 72, step: 1, value: 40 }, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key]) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key])}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p><p>文字被拆成一个个字（字形），每个字的位置、颜色、透明度都由「字的序号 i + 时间 t」算出来，所以能做出逐字的动画。</p>`,
      params: [['主色', '文字的基础颜色'], [spec.speed.label, '动画播放的快慢，0 表示暂停'], [spec.size.label, d.sizeDoc || '文字的大小（像素），放不下会自动换行'], [d.count.label, d.countDoc || '参与动画的字数'], [ex.label, d.extraDoc || '该特效特有的效果参数']],
      example: (v) => `<ol><li>当前：${v.mode}，${d.count.label} ${v.n}</li><li>指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖滑条观察文字变化</li></ol>`,
      tip: d.tip || '移动指针与文字互动；右侧滑条实时改变字号、字数和效果。',
    },
    build(S) {
      const st = {};
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8', tt = t * num(C.speed, 0.9);
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, spec.size.value), x: exVal(C), col, hue: hueOf(col) };
        k.lay = (str, fs = k.s, lhK) => layout(ctx, str, fs, W, H, 8, lhK);
        k.font = (fs = k.s, w) => { ctx.font = FONT(fs, w); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; };
        k.str = (n = k.n) => [...TXT].slice(0, n).join('');
        k.nearest = (g) => { let b = -1, bd = 1e9; g.forEach((q, i) => { const dd = (q.x - P.x) ** 2 + (q.y - P.y) ** 2; if (dd < bd) { bd = dd; b = i; } }); return b < 0 ? null : { i: b, ch: g[b].ch, d: Math.sqrt(bd) }; };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip(); ctx.translate(0, Math.sin(tt * 1.7) * 2.5);
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        const lp = fract(tt / 6); ctx.fillStyle = hsla(k.hue, 80, 60, 0.18); ctx.fillRect(0, H - 4, W, 4); ctx.fillStyle = hsla(k.hue, 85, 65, 0.7); ctx.fillRect(0, H - 4, W * lp, 4);
        chip(ctx, W, H, C);
        let cell = r.cell;
        if (!cell && r.g) { const nb = k.nearest(r.g); cell = nb ? (nb.d < k.s ? `指针在第 ${nb.i + 1} 个字「${nb.ch}」上` : `最近的字是第 ${nb.i + 1} 个「${nb.ch}」，距 ${Math.round(nb.d)}px`) : '画面中暂时没有文字'; }
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: cell || '指针不在文字附近', colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const NC = (label, min, max, value, step = 1) => ({ label, min, max, step, value });

FAM.typewriter = tFam({ title: '打字机', count: NC('文本长度', 4, 34, 20), extra: R('cps', '每秒字数', 2, 30, 1, 8), extraDoc: '每秒敲出几个字', presets: { 短句: { count: 6 }, 长句: { count: 34 }, 慢打: { cps: 3 }, 快打: { cps: 28 }, 大字: { size: 66 } },
  explain: '打字机：文字一个个出现，后面跟着闪烁的光标；打完停顿一会儿，再逐字删除，循环往复。', formula: '已打字数 m = min(n, ⌊每秒字数 · t⌋)', formula2: '光标透明度 = 0.5 + 0.5·cos(2π·1.2t)',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cps = k.x, Tt = n / cps, Th = 1.6, Td = n / (cps * 2.5), Tp = 0.6, T0 = Tt + Th + Td + Tp, ph = (t % T0 + T0) % T0;
    const m = ph < Tt ? Math.floor(ph * cps) : ph < Tt + Th ? n : ph < Tt + Th + Td ? Math.max(0, n - Math.floor((ph - Tt - Th) * cps * 2.5)) : 0;
    const L = k.lay(k.str(n)); k.font();
    L.g.forEach((g, i) => { if (i >= m) return; const a = i === m - 1 && ph < Tt ? clamp(fract(ph * cps) * 3, 0.3, 1) : 1; ctx.fillStyle = hsla(k.hue, 70, 78, a); ctx.fillText(g.ch, g.x, g.y); });
    const last = m > 0 ? L.g[m - 1] : null, cx = last ? last.x + last.w / 2 + 3 : (L.g[0] ? L.g[0].x - L.g[0].w / 2 : W / 2), cy = last ? last.y : (L.g[0] ? L.g[0].y : H / 2);
    ctx.fillStyle = hsla(k.hue, 90, 70, 0.5 + 0.5 * Math.cos(t * TAU * 1.2)); ctx.fillRect(cx, cy - k.s * 0.45, Math.max(2, k.s * 0.08), k.s * 0.9);
    return { mode: `已打 ${m} / ${n} 字（${ph < Tt ? '输入中' : ph < Tt + Th ? '停顿' : '删除中'}）`, g: L.g.slice(0, Math.max(1, m)) };
  } });

/** offscreen text block cache, drawn once per (str, size, color) */
function textBlock(st, key, W, H, paint) {
  if (st.bk === key && st.bc) return st.bc;
  const c = st.bc || document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); paint(x); st.bc = c; st.bk = key; return c;
}

FAM.glitch = tFam({ title: '故障 Glitch', count: NC('切片数', 2, 24, 10), extra: R('shift', '偏移强度', 0, 60, 1, 22), color: '#22d3ee', countDoc: '把文字横向切成几条，每条独立错位', extraDoc: '切片和红/青色通道错开的最大距离', presets: { 少切: { count: 3 }, 多切: { count: 24 }, 轻微: { shift: 5 }, 剧烈: { shift: 58 }, 大字: { size: 70 } },
  explain: '故障效果（Glitch）：模仿信号干扰——把文字切成横条随机左右错位，并把红、青两个颜色通道错开。干扰是一阵一阵的，指针靠近会让干扰更强烈。', formula: '切片偏移 = 强度 · (hash(条, ⌊8t⌋) − 0.5) · 阵发(t)', formula2: '阵发(t) = max(0, sin(1.3t)·sin(0.7t + 1))^0.5',
  draw(ctx, W, H, t, C, P, k, st) {
    const L = k.lay(k.str(14)); st.A = st.A || {}; st.B = st.B || {}; st.D = st.D || {};
    const mk = (o, colr) => textBlock(o, `${k.s}|${W}|${H}|${colr}`, W, H, (x) => { x.font = FONT(k.s); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = colr; L.g.forEach((g) => x.fillText(g.ch, g.x, g.y)); });
    const bA = mk(st.A, hsla(k.hue, 85, 68)), bB = mk(st.B, hsla(k.hue + 150, 95, 55)), bD = mk(st.D, hsla(k.hue - 120, 95, 55));
    const gy0 = L.g[0].y - L.lh / 2, gy1 = L.g[L.g.length - 1].y + L.lh / 2, near = clamp(1 - Math.abs(P.y - (gy0 + gy1) / 2) / (H / 2), 0, 1);
    const burst = Math.pow(Math.max(0, Math.sin(t * 1.3) * Math.sin(t * 0.7 + 1)), 0.5) * 0.8 + 0.2 + near * 0.5, step = Math.floor(t * 8), n = k.n, bh = (gy1 - gy0) / n;
    const slices = (blk, dx, a) => { ctx.globalAlpha = a; for (let b = 0; b < n; b++) { const y = gy0 + b * bh, off = (hh(b, step) - 0.5) * 2 * k.x * burst * (hh(b, step + 99) < 0.6 ? 1 : 0.1); ctx.drawImage(blk, 0, y, W, bh + 0.5, off + dx, y, W, bh + 0.5); } ctx.globalAlpha = 1; };
    ctx.globalCompositeOperation = 'lighter'; slices(bB, -k.x * 0.25 * burst, 0.7); slices(bD, k.x * 0.25 * burst, 0.7); ctx.globalCompositeOperation = 'source-over'; slices(bA, 0, 0.9);
    for (let b = 0; b < n; b++) if (hh(b, step + 7) < 0.15 * burst) { ctx.fillStyle = hsla(k.hue + 180, 90, 70, 0.3); ctx.fillRect(0, gy0 + b * bh, W, Math.max(1, bh * 0.2)); }
    return { mode: `干扰强度 ${Math.round(burst * 100)}%`, g: L.g };
  } });

FAM.gradient = tFam({ title: '渐变扫光', count: NC('色带数', 1, 6, 3), extra: R('shine', '扫光宽度', 0, 0.5, 0.01, 0.15), color: '#f472b6', countDoc: '渐变里有几种颜色', extraDoc: '白色高光条的宽度（相对文字宽度）', presets: { 单色: { count: 1 }, 多彩: { count: 6 }, 无光: { shine: 0 }, 宽光: { shine: 0.48 } },
  explain: '渐变扫光：文字用一条横向的颜色渐变来填充，渐变不断平移形成流动感；再叠加一条倾斜的白色高光从左扫到右，像金属反光。', formula: '颜色(x) = 渐变((x − 0.2t·宽) mod 宽)', formula2: '高光中心 = fract(0.3t) · (宽 + 2·高光宽) − 高光宽',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(16)); k.font(); const x0 = W * 0.05, x1 = W * 0.95, sh = fract(t * 0.2), gw = x1 - x0;
    const g = ctx.createLinearGradient(x0 - sh * gw, 0, x1 - sh * gw + gw, 0), n = k.n;
    for (let i = 0; i <= n * 2; i++) g.addColorStop(i / (n * 2), hsla(k.hue + (i % n) * (n > 1 ? 300 / n : 0), 85, n > 1 ? 62 : 45 + (i % 2) * 25));
    ctx.fillStyle = g; L.g.forEach((q) => ctx.fillText(q.ch, q.x, q.y));
    if (k.x > 0) { const c = fract(t * 0.3) * (1 + 2 * k.x) - k.x, cx = x0 + c * gw, s = ctx.createLinearGradient(cx - k.x * gw, 0, cx + k.x * gw, 0); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.85)'); s.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = s; L.g.forEach((q) => ctx.fillText(q.ch, q.x, q.y)); }
    return { mode: `${n} 色渐变`, g: L.g };
  } });

FAM.outline = tFam({ title: '描边填充', count: NC('描边层数', 1, 8, 4), extra: R('stroke', '描边粗细', 0.5, 6, 0.1, 1.6), color: '#facc15', countDoc: '叠几层错开的描边，形成立体感', presets: { 单层: { count: 1 }, 立体: { count: 8 }, 细描: { stroke: 0.6 }, 粗描: { stroke: 5.5 }, 大字: { size: 70 } },
  explain: '描边填充：先只画文字的轮廓线（strokeText），并向右下错开叠几层形成立体阴影；然后实心颜色从左往右「灌」进文字里，灌满后再退回，循环播放。', formula: '第 j 层偏移 = (j, j)·描边粗细·1.5', formula2: '填充进度 = (1 − cos(2π·t/5)) / 2',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(12)); k.font(); ctx.lineJoin = 'round'; const n = k.n;
    for (let j = n - 1; j >= 0; j--) { const o = j * k.x * 1.5; ctx.strokeStyle = hsla(k.hue - j * 14, 85, 70 - j * 6, 1 - j / (n + 1)); ctx.lineWidth = k.x; L.g.forEach((q) => ctx.strokeText(q.ch, q.x + o, q.y + o)); }
    const p = (1 - Math.cos(TAU * t / 5)) / 2, xs = L.g.map((q) => q.x), x0 = Math.min(...xs) - k.s, x1 = Math.max(...xs) + k.s, fx = x0 + (x1 - x0) * p;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, fx, H); ctx.clip(); ctx.fillStyle = hsla(k.hue, 90, 60); L.g.forEach((q) => ctx.fillText(q.ch, q.x, q.y)); ctx.restore();
    return { mode: `填充 ${Math.round(p * 100)}%`, g: L.g };
  } });

FAM['split-fall'] = tFam({ title: '拆分下落', count: NC('字数', 3, 34, 14), extra: R('drop', '下落高度', 0.2, 1.5, 0.05, 0.8), color: '#fb923c', extraDoc: '字从多高的地方落下（相对画面高度）', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 低落: { drop: 0.25 }, 高落: { drop: 1.45 }, 大字: { size: 66 } },
  explain: '拆分下落：把一句话拆成单个字，每个字依次从上方落下，落地时带一点弹跳；停留片刻后再逐个向下掉出画面，循环。每个字比前一个晚一点出发（交错）。', formula: '第 i 个字进度 p = 缓动((t − 0.06i) / 0.8)', formula2: 'y = 目标 y − 下落高度·H·(1 − 弹跳(p))',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); k.font(); const T0 = 6, ph = (t % T0 + T0) % T0; let landed = 0;
    const bounce = (p) => { p = clamp(p, 0, 1); if (p < 0.64) return (p / 0.64) ** 2; const q = (p - 0.82) / 0.18; return 1 - 0.12 * (1 - q * q); };
    L.g.forEach((g, i) => { const pin = (ph - i * 0.06) / 0.8, pout = (ph - 4 - i * 0.04) / 0.7; let y = g.y, a = 1;
      if (pout > 0) { const e = clamp(pout, 0, 1); y = g.y + e * e * H; a = 1 - e; } else { const b = bounce(pin); y = g.y - k.x * H * (1 - b); a = clamp(pin * 4, 0, 1); if (pin >= 1) landed++; }
      ctx.globalAlpha = a; ctx.fillStyle = hsla(k.hue + i * 4, 85, 65); ctx.fillText(g.ch, g.x, y); });
    ctx.globalAlpha = 1;
    return { mode: `已落地 ${landed} / ${L.g.length} 字`, g: L.g };
  } });

FAM['bounce-in'] = tFam({ title: '弹性弹入', count: NC('字数', 3, 34, 12), extra: R('elastic', '弹性', 0, 1.5, 0.05, 0.7), color: '#a78bfa', extraDoc: '放大时超出原尺寸的程度（回弹）', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 无弹: { elastic: 0 }, 强弹: { elastic: 1.45 }, 大字: { size: 68 } },
  explain: '弹性弹入：每个字从 0 放大到原尺寸，因为「弹性」会先超过原尺寸再回弹几次才停下，像果冻。字与字之间交错出场，停留后缩小消失，循环。', formula: '缩放 s(p) = 1 + 弹性·e^{−6p}·sin(12p) − e^{−8p}', formula2: '第 i 个字开始时间 = 0.08·i',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); const T0 = 5.5, ph = (t % T0 + T0) % T0; let sum = 0;
    L.g.forEach((g, i) => { const p = Math.max(0, ph - i * 0.08), out = clamp((ph - 4.3 - i * 0.02) / 0.6, 0, 1), s = Math.max(0, (1 + k.x * Math.exp(-6 * p) * Math.sin(12 * p) * 0.6 - Math.exp(-8 * p)) * (1 - smooth(out))); sum += s;
      if (s < 0.01) return; ctx.save(); ctx.translate(g.x, g.y); ctx.scale(s, s); k.font(); ctx.fillStyle = hsla(k.hue + i * 6, 80, 68); ctx.fillText(g.ch, 0, 0); ctx.restore(); });
    return { mode: `平均缩放 ${fmt(sum / Math.max(1, L.g.length), 2)} · 弹性 ${fmt(k.x, 2)}`, g: L.g };
  } });

FAM['blur-clear'] = tFam({ title: '模糊变清晰', count: NC('字数', 3, 34, 14), extra: R('blur', '最大模糊', 1, 30, 0.5, 14), color: '#38bdf8', extraDoc: '最模糊时的模糊半径（像素）', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 轻糊: { blur: 3 }, 重糊: { blur: 29 }, 大字: { size: 66 } },
  explain: '模糊变清晰：每个字一开始又糊又淡，然后依次变得清晰锐利，像镜头对焦；停留后再从左到右重新变糊。指针附近的字总是清晰的。', formula: '模糊半径 b = 最大模糊 · (1 − 缓动(p))', formula2: 'p = (t − 0.07i) / 0.9',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); k.font(); const T0 = 6, ph = (t % T0 + T0) % T0; let sharp = 0;
    L.g.forEach((g, i) => { const pin = smooth((ph - i * 0.07) / 0.9), pout = smooth((ph - 4 - i * 0.04) / 0.9), near = clamp(1 - Math.hypot(g.x - P.x, g.y - P.y) / 90, 0, 1), c = Math.max(near, pin * (1 - pout)), b = k.x * (1 - c);
      if (c > 0.95) sharp++;
      ctx.fillStyle = hsla(k.hue, 80, 72, 0.25 + 0.75 * c);
      if (b > 0.4) { ctx.shadowColor = hsla(k.hue, 80, 72, 0.25 + 0.75 * c); ctx.shadowBlur = b; ctx.shadowOffsetX = 10000; ctx.fillText(g.ch, g.x - 10000, g.y); ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowColor = 'transparent'; }
      else ctx.fillText(g.ch, g.x, g.y); });
    return { mode: `清晰 ${sharp} / ${L.g.length} 字`, g: L.g };
  } });

FAM.mirror = tFam({ title: '镜像翻转', count: NC('字数', 3, 34, 12), extra: R('refl', '倒影透明度', 0, 1, 0.02, 0.4), color: '#2dd4bf', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 无倒影: { refl: 0 }, 清晰倒影: { refl: 0.95 }, 大字: { size: 68 } },
  explain: '镜像翻转：每个字绕水平轴依次翻转一圈（纵向缩放从 1 → −1 → 1），下方还有一个上下颠倒、逐渐变淡的倒影，像站在水面上。', formula: '纵向缩放 = cos(翻转角)，角 = π·缓动(t − 0.1i)', formula2: '倒影: 缩放 (1, −1)，透明度 × 倒影透明度',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(), k.s, 1.9); const T0 = 4, ph = (t % T0 + T0) % T0; let flipping = 0;
    L.g.forEach((g, i) => { const p = smooth((ph - i * 0.1) / 0.8), sy = Math.cos(p * TAU) * (p > 0 && p < 1 ? 1 : 1); if (p > 0 && p < 1) flipping++;
      const sy2 = Math.abs(sy) < 0.04 ? 0.04 * Math.sign(sy || 1) : sy;
      ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1, sy2); k.font(); ctx.fillStyle = hsla(k.hue + (sy < 0 ? 40 : 0), 80, sy < 0 ? 55 : 70); ctx.fillText(g.ch, 0, 0); ctx.restore();
      if (k.x > 0.01) { ctx.save(); ctx.translate(g.x, g.y + k.s * 0.95); ctx.scale(1, -sy2 * 0.8); k.font(); ctx.globalAlpha = k.x * 0.6; ctx.fillStyle = hsla(k.hue, 70, 60); ctx.fillText(g.ch, 0, 0); ctx.restore(); } });
    ctx.globalAlpha = 1;
    return { mode: `正在翻转 ${flipping} 个字`, g: L.g };
  } });

FAM['wave-text'] = tFam({ title: '波浪字', count: NC('字数', 3, 34, 16), extra: R('amp', '振幅', 0, 40, 0.5, 14), color: '#60a5fa', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 平静: { amp: 2 }, 大浪: { amp: 38 }, 大字: { size: 64 } },
  explain: '波浪字：每个字的上下位置是一条正弦波，后面的字比前面的字晚一点（相位差），连起来就像一排在水面上起伏的浮标。指针附近的字会放大。', formula: 'yᵢ = y₀ + 振幅 · sin(3t − 0.5i)', formula2: '缩放ᵢ = 1 + 0.4 · max(0, 1 − dᵢ/80)',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(), k.s, 1.6);
    L.g.forEach((g, i) => { const y = g.y + k.x * Math.sin(t * 3 - i * 0.5), s = 1 + 0.4 * Math.max(0, 1 - Math.hypot(g.x - P.x, y - P.y) / 80);
      ctx.save(); ctx.translate(g.x, y); ctx.scale(s, s); k.font(); ctx.fillStyle = hsla(k.hue + Math.sin(t * 3 - i * 0.5) * 30, 85, 68); ctx.fillText(g.ch, 0, 0); ctx.restore(); });
    return { mode: `振幅 ${fmt(k.x, 1)}px`, g: L.g };
  } });

const CRAWL = ['很久很久以前', '在一个遥远的星系', '文字沿着透明的平面', '缓缓向远方滚动', '越远的行越小越淡', '直到消失在地平线', '这就是透视投影', '近大远小的原理', 'A LONG TIME AGO', 'IN A GALAXY FAR AWAY'];
FAM.perspective = tFam({ title: '3D 透视滚动', count: NC('行数', 2, 10, 8), extra: R('tilt', '倾斜角', 20, 80, 1, 58), size: { label: '字号', min: 14, max: 48, step: 1, value: 28 }, color: '#fbbf24', countDoc: '滚动文本有几行', extraDoc: '文字平面向后倒的角度，越大越「躺平」', presets: { 少行: { count: 3 }, 多行: { count: 10 }, 微倾: { tilt: 22 }, 躺平: { tilt: 78 }, 大字: { size: 46 } },
  explain: '3D 透视滚动（星战片头）：文字写在一张向后倒下的平面上，平面不断往远处移动。透视投影让远处的行变小、变窄、变淡，最终汇聚到地平线。', formula: '屏幕缩放 = f / (f + z)，z 为行的深度', formula2: 'y = 地平线 + (底边 − 地平线) · 缩放',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, gap = k.s * 1.6, total = n * gap, f = 260, sinA = Math.sin(k.x * Math.PI / 180), hz = 8 + (H - 8) * 0.12, base = H - 6, scroll = (t * 30) % (total + 200); let vis = 0, nearLine = '';
    for (let i = 0; i < n; i++) { const d = ((i * gap - scroll) % (total + 200) + total + 200) % (total + 200) - 40, z = d * sinA * 2.4; if (z < -f * 0.6) continue; const s = f / (f + z), y = hz + (base - hz) * s, a = clamp(s * 1.4 - 0.15, 0, 1);
      if (a <= 0.01 || y > H + 20) continue; vis++; if (Math.abs(y - P.y) < k.s * s) nearLine = CRAWL[i % CRAWL.length];
      ctx.save(); ctx.translate(W / 2 + (P.x - W / 2) * 0.1 * (1 - s), y); ctx.scale(s, s * (1 - sinA * 0.45)); k.font(k.s); ctx.fillStyle = hsla(k.hue, 90, 55 + 20 * s, a); ctx.fillText(CRAWL[i % CRAWL.length], 0, 0); ctx.restore(); }
    return { mode: `可见 ${vis} 行`, cell: nearLine ? `指针所在行「${nearLine}」` : '指针不在任何文字行上' };
  } });

FAM['neon-text'] = tFam({ title: '霓虹灯管', count: NC('字数', 2, 20, 8), extra: R('glow', '光晕强度', 0, 40, 0.5, 18), color: '#f0abfc', presets: { 少字: { count: 2 }, 多字: { count: 20 }, 弱光: { glow: 3 }, 强光: { glow: 39 }, 大字: { size: 70 } },
  explain: '霓虹灯管：文字用细线描边当作灯管，再加上同色的大范围模糊阴影（shadowBlur）当作光晕。亮度会像真实灯管一样轻微起伏，其中一个字接触不良会忽明忽暗；指针靠近的字更亮。', formula: '亮度ᵢ = 0.85 + 0.15·sin(5t + i) − 坏灯(i)·闪烁(t)', formula2: '光晕 = shadowBlur(光晕强度 · 亮度)',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(), k.s, 1.5); k.font(k.s, 600); const bad = Math.floor(hh(Math.floor(t / 5), 3) * L.g.length);
    L.g.forEach((g, i) => { const near = clamp(1 - Math.hypot(g.x - P.x, g.y - P.y) / 100, 0, 1), fl = i === bad ? 0.45 * smooth(0.5 + 0.5 * Math.sin(t * 9) * Math.sin(t * 2.3)) : 0, b = clamp(0.85 + 0.12 * Math.sin(t * 5 + i) - fl + near * 0.3, 0.2, 1.2);
      ctx.shadowColor = hsla(k.hue, 100, 60, clamp(b, 0, 1)); ctx.shadowBlur = k.x * b; ctx.strokeStyle = hsla(k.hue, 100, 85, clamp(b, 0, 1)); ctx.lineWidth = Math.max(1.2, k.s * 0.05); ctx.strokeText(g.ch, g.x, g.y);
      ctx.shadowBlur = k.x * b * 0.4; ctx.strokeText(g.ch, g.x, g.y); });
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    return { mode: `第 ${bad + 1} 个字接触不良`, g: L.g };
  } });

FAM.scramble = tFam({ title: '打散重组', count: NC('字数', 3, 34, 16), extra: R('radius', '打散半径', 20, 400, 5, 180), color: '#34d399', extraDoc: '字被打散时最远飞出多远', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 近散: { radius: 30 }, 远散: { radius: 390 }, 大字: { size: 64 } },
  explain: '打散重组：所有字从各自的位置飞散到随机方向并旋转，然后再沿原路飞回拼成原句，循环。飞行用缓动曲线，开始和结束都很平滑。指针会把附近的字推开。', formula: '位置 = 原位 + 缓动(s) · 半径 · (cos φᵢ, sin φᵢ)', formula2: 's = (1 − cos(2π·t/5)) / 2',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); const s = smooth((1 - Math.cos(TAU * t / 5)) / 2);
    L.g.forEach((g, i) => { const a = hh(i, 1) * TAU, r = k.x * (0.4 + 0.6 * hh(i, 2)) * s; let x = g.x + Math.cos(a) * r, y = g.y + Math.sin(a) * r; const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) + 0.01; if (d < 70) { x += dx / d * (70 - d) * 0.5; y += dy / d * (70 - d) * 0.5; }
      ctx.save(); ctx.translate(x, y); ctx.rotate((hh(i, 3) - 0.5) * 6 * s); k.font(); ctx.fillStyle = hsla(k.hue + (hh(i, 4) - 0.5) * 80 * s, 80, 68, 1 - 0.4 * s); ctx.fillText(g.ch, 0, 0); ctx.restore(); });
    return { mode: `打散程度 ${Math.round(s * 100)}%`, g: L.g };
  } });

FAM.counter = tFam({ title: '计数滚动', count: NC('位数', 1, 9, 6), extra: R('rate', '每秒增加', 1, 900, 1, 137), size: { label: '字号', min: 20, max: 90, step: 1, value: 56 }, color: '#4ade80', countDoc: '显示几位数字（超出部分循环）', extraDoc: '数值每秒增加多少', presets: { 一位: { count: 1 }, 九位: { count: 9 }, 慢数: { rate: 2 }, 快数: { rate: 880 }, 大字: { size: 88 } },
  explain: '计数滚动（里程表）：每一位数字是一条竖着的 0~9 纸带，数值增加时最低位持续滚动；当低位从 9 滚到 0 的那一刻，高一位才跟着滚一格，就像汽车里程表进位。', formula: '数值 v = 每秒增加 · t', formula2: '第 d 位 = ⌊v / 10^d⌋ mod 10，进位时按低位余数平滑滚动',
  draw(ctx, W, H, t, C, P, k) {
    const D = k.n, fs = Math.min(k.s, (W * 0.9) / (D * 0.75)), cw = fs * 0.72, lh = fs * 1.1, x0 = W / 2 + (D * cw) / 2 - cw / 2, cy = (H + 8) / 2, v = Math.max(0, t) * k.x, mod = Math.pow(10, D); let pd = -1;
    for (let d = 0; d < D; d++) { const p = Math.pow(10, d), q = Math.floor(v / p) % 10, rem = v % p, fr = d === 0 ? fract(v) : rem > p - 1 ? rem - (p - 1) : 0, e = smooth(fr), x = x0 - d * cw;
      if (Math.abs(P.x - x) < cw / 2) pd = d;
      rrect(ctx, x - cw * 0.46, cy - lh / 2, cw * 0.92, lh, 6); ctx.fillStyle = hsla(k.hue, 30, pd === d ? 18 : 11); ctx.fill();
      ctx.save(); rrect(ctx, x - cw * 0.46, cy - lh / 2, cw * 0.92, lh, 6); ctx.clip(); k.font(fs, 800); ctx.fillStyle = hsla(k.hue + d * 10, 85, 65);
      ctx.fillText(String(q), x, cy - e * lh); ctx.fillText(String((q + 1) % 10), x, cy + lh - e * lh); ctx.restore(); }
    const shown = Math.floor(v) % mod, names = ['个', '十', '百', '千', '万', '十万', '百万', '千万', '亿'];
    return { mode: `当前 ${String(shown).padStart(D, '0')}`, cell: pd >= 0 ? `指针在${names[pd]}位，数字 ${Math.floor(v / Math.pow(10, pd)) % 10}` : '指针不在数字上' };
  } });

FAM.decode = tFam({ title: '密码解码', count: NC('字数', 3, 34, 16), extra: R('hz', '乱码刷新率', 2, 30, 1, 14), color: '#22c55e', extraDoc: '未解开的字每秒换几次乱码', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 慢刷: { hz: 3 }, 快刷: { hz: 29 }, 大字: { size: 62 } },
  explain: '密码解码：文字先显示为不断变化的乱码字符，然后从左到右一个个「破译」成真正的字，像电影里的黑客界面。全部解开后停留片刻，再重新加密。', formula: '第 i 个字解开时间 = 0.12·i', formula2: '乱码 = 字符表[hash(i, ⌊刷新率·t⌋)]',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); k.font(); const T0 = L.g.length * 0.12 + 3.5, ph = (t % T0 + T0) % T0, step = Math.floor(t * k.x); let solved = 0;
    L.g.forEach((g, i) => { const ok = ph > 0.4 + i * 0.12 && ph < T0 - 1 + i * 0.02;
      if (ok) { solved++; ctx.fillStyle = hsla(k.hue, 80, 72); ctx.fillText(g.ch, g.x, g.y); }
      else { ctx.fillStyle = hsla(k.hue + 20, 70, 45, 0.85); ctx.fillText(GLY[Math.floor(hh(i, step) * GLY.length)], g.x, g.y); } });
    return { mode: `已解开 ${solved} / ${L.g.length} 字`, g: L.g };
  } });

FAM.ribbon = tFam({ title: '打印色带', count: NC('行数', 2, 10, 6), extra: R('mis', '套色偏移', 0, 8, 0.1, 2.5), size: { label: '字号', min: 14, max: 44, step: 1, value: 24 }, color: '#e11d48', countDoc: '纸带上同时保留几行', extraDoc: '青、品红、黄三色没对准时错开的距离', presets: { 少行: { count: 2 }, 多行: { count: 10 }, 对准: { mis: 0 }, 错位: { mis: 7.5 }, 大字: { size: 42 } },
  explain: '打印色带：模仿小票打印机——打印头从左到右扫过当前行把字印出来，印完一行纸带向上走一行。彩色印刷由青、品红、黄三色叠成，没对准时会出现彩色重影（套色偏移）。', formula: '当前行进度 p = fract(t / 1.6)', formula2: '三色偏移: 青(−d, 0)、品红(d, 0)、黄(0, d)',
  draw(ctx, W, H, t, C, P, k) {
    const lh = k.s * 1.5, n = k.n, cur = Math.floor(t / 1.6), p = fract(t / 1.6), base = H - 14 - lh / 2, scroll = smooth(clamp((p - 0.85) / 0.15, 0, 1)) * lh; k.font(k.s, 700); let pl = '';
    ctx.fillStyle = 'rgba(248,250,252,0.06)'; ctx.fillRect(W * 0.04, 8, W * 0.92, H - 8);
    for (let j = 0; j < n; j++) { const li = cur - j, str = CRAWL[((li % CRAWL.length) + CRAWL.length) % CRAWL.length], y = base - j * lh - scroll; if (y < 8 - lh) continue;
      ctx.save(); if (j === 0) { ctx.beginPath(); ctx.rect(0, 0, W * 0.05 + W * 0.9 * clamp(p / 0.8, 0, 1), H); ctx.clip(); }
      if (Math.abs(P.y - y) < lh / 2) pl = str;
      ctx.globalCompositeOperation = 'lighter'; const m = k.x * (1 + 0.3 * Math.sin(t * 2 + j));
      [[-m, 0, 190], [m, 0, 320], [0, m, 55]].forEach(([dx, dy, h]) => { ctx.fillStyle = hsla(h, 90, 45, 0.8); ctx.fillText(str, W / 2 + dx, y + dy); });
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = hsla(k.hue, 80, 70, 0.85); ctx.fillText(str, W / 2, y); ctx.restore(); }
    const hx = W * 0.05 + W * 0.9 * clamp(p / 0.8, 0, 1); ctx.fillStyle = hsla(k.hue, 90, 70, 0.9); ctx.fillRect(hx - 2, base - lh / 2, 4, lh);
    return { mode: `正在打印第 ${cur + 1} 行`, cell: pl ? `指针所在行「${pl}」` : '指针在空白纸面上' };
  } });

FAM.handwrite = tFam({ title: '手写进度', count: NC('字数', 2, 20, 8), extra: R('pen', '笔画粗细', 0.5, 5, 0.1, 1.6), size: { label: '字号', min: 24, max: 96, step: 1, value: 60 }, color: '#fde68a', presets: { 少字: { count: 2 }, 多字: { count: 20 }, 细笔: { pen: 0.6 }, 粗笔: { pen: 4.8 }, 大字: { size: 94 } },
  explain: '手写进度：用虚线技巧画字的轮廓——把虚线的「实线段」从 0 慢慢加长到整条轮廓长度，看起来就像笔在一笔笔描字；每个字描完后颜色再填满。字依次书写，写完后淡出重来。', formula: 'setLineDash([p·L, L])，p: 0 → 1', formula2: '第 i 个字开始时间 = 0.35·i',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(), k.s, 1.3); k.font(k.s, 500); const T0 = L.g.length * 0.35 + 3, ph = (t % T0 + T0) % T0, fade = 1 - smooth((ph - (T0 - 0.8)) / 0.8), Ld = k.s * 9; let done = 0;
    ctx.lineWidth = k.x; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    L.g.forEach((g, i) => { const p = clamp((ph - i * 0.35) / 1.2, 0, 1); if (p <= 0) return; if (p >= 1) done++;
      ctx.globalAlpha = fade; ctx.setLineDash([p * Ld, Ld]); ctx.strokeStyle = hsla(k.hue, 85, 70); ctx.strokeText(g.ch, g.x, g.y);
      const f = smooth((p - 0.7) / 0.3); if (f > 0) { ctx.setLineDash([]); ctx.fillStyle = hsla(k.hue, 75, 60, f * 0.85); ctx.fillText(g.ch, g.x, g.y); } });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    return { mode: `写完 ${done} / ${L.g.length} 字`, g: L.g };
  } });

const LYR = ['月亮代表我的心', '星星点亮夜空', '风吹过城市的街', '我们一起唱下去', '旋律一直在心里', '直到天亮的时候'];
FAM.karaoke = tFam({ title: '字幕卡拉 OK', count: NC('行数', 1, 6, 3), extra: R('glow', '高亮光晕', 0, 30, 0.5, 12), size: { label: '字号', min: 16, max: 56, step: 1, value: 34 }, color: '#f43f5e', countDoc: '屏幕上同时显示几行歌词', presets: { 单行: { count: 1 }, 多行: { count: 6 }, 无光: { glow: 0 }, 强光: { glow: 29 }, 大字: { size: 54 } },
  explain: '卡拉 OK 字幕：当前唱到的那一行，颜色像进度条一样从左往右「刷」过去，刷过的字变成高亮色并发光；唱完一行切换到下一行，上下行变暗变小。', formula: '高亮宽度 = 行宽 · fract(t / 3)', formula2: '当前行 = ⌊t / 3⌋ mod 行数',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cur = Math.floor(t / 3) % n, p = fract(t / 3), lh = k.s * 1.6, y0 = (H + 8) / 2 - ((n - 1) * lh) / 2; let pl = '';
    for (let i = 0; i < n; i++) { const str = LYR[i % LYR.length], y = y0 + i * lh, act = i === cur, s = act ? 1 : 0.8; k.font(k.s * s, 800); const w = ctx.measureText(str).width;
      if (Math.abs(P.y - y) < lh / 2) pl = str;
      ctx.fillStyle = act ? 'rgba(226,232,240,0.8)' : 'rgba(148,163,184,0.45)'; ctx.fillText(str, W / 2, y);
      if (act) { ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - w / 2, y - lh, w * p, lh * 2); ctx.clip(); ctx.shadowColor = hsla(k.hue, 100, 60); ctx.shadowBlur = k.x; ctx.fillStyle = hsla(k.hue, 90, 62); ctx.fillText(str, W / 2, y); ctx.restore();
        ctx.fillStyle = hsla(k.hue, 90, 70); ctx.beginPath(); ctx.arc(W / 2 - w / 2 + w * p, y - lh * 0.48, 4, 0, TAU); ctx.fill(); } }
    return { mode: `第 ${cur + 1} 行 ${Math.round(p * 100)}%`, cell: pl ? `指针所在行「${pl}」` : '指针不在歌词行上' };
  } });

const POEM = '床前明月光疑是地上霜举头望明月低头思故乡白日依山尽黄河入海流欲穷千里目更上一层楼';
FAM.vertical = tFam({ title: '竖排滚动', count: NC('列数', 2, 14, 6), extra: R('gapc', '列间距', 1, 3, 0.05, 1.6), size: { label: '字号', min: 14, max: 48, step: 1, value: 26 }, color: '#fca5a5', countDoc: '竖排的文字有几列', extraDoc: '列与列之间的距离（字号的倍数）', presets: { 少列: { count: 2 }, 多列: { count: 14 }, 紧密: { gapc: 1.05 }, 疏朗: { gapc: 2.9 }, 大字: { size: 46 } },
  explain: '竖排滚动：中文古籍从右往左、从上往下竖着排列。每一列文字不断向下滚动，奇数列和偶数列速度略有不同，形成错落的节奏；指针所在的列会高亮。', formula: '列 x = 右边 − 列号 · 列间距 · 字号', formula2: '字 y = (行号 · 字高 + 速度 · t) mod 列高',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cw = k.s * k.x, tot = n * cw, x0 = W / 2 + tot / 2 - cw / 2, lh = k.s * 1.25, rows = Math.ceil((H - 8) / lh) + 1, Hc = rows * lh, pc = [...POEM]; let hit = -1, hc = '';
    k.font(k.s, 600);
    for (let c = 0; c < n; c++) { const x = x0 - c * cw, on = Math.abs(P.x - x) < cw / 2, sp = 18 + (c % 2) * 8; if (on) hit = c;
      for (let r = 0; r < rows; r++) { let y = 8 + ((r * lh + t * sp) % Hc) - lh / 2; const ch = pc[(c * 7 + r) % pc.length], edge = clamp(Math.min(y - 8, H - y) / 30, 0, 1);
        if (on && Math.abs(P.y - y) < lh / 2) hc = ch;
        ctx.fillStyle = hsla(k.hue + c * 6, on ? 90 : 70, on ? 75 : 62, edge); ctx.fillText(ch, x, y); } }
    return { mode: `${n} 列竖排`, cell: hit >= 0 ? `指针在右起第 ${hit + 1} 列${hc ? `，字「${hc}」` : ''}` : '指针不在任何一列上' };
  } });

const WORDS = ['HELLO WORLD', '翻页显示屏幕', 'DEPARTURES', '下一站到了', 'GATE 42 OPEN'];
FAM.pageflip = tFam({ title: '切页翻转', count: NC('格数', 3, 16, 10), extra: R('dur', '翻转时长', 0.1, 1.2, 0.02, 0.4), size: { label: '字号', min: 16, max: 64, step: 1, value: 34 }, color: '#fbbf24', countDoc: '翻页牌一共有几格', extraDoc: '每一格翻一次用几秒', presets: { 少格: { count: 4 }, 多格: { count: 16 }, 快翻: { dur: 0.12 }, 慢翻: { dur: 1.15 }, 大字: { size: 62 } },
  explain: '切页翻转（机场翻页牌）：每一格上下两半分开，换字时上半片向下翻倒，露出新字的上半部分，翻倒的片背面是新字的下半部分。各格依次翻转，每 3 秒换一句。', formula: '翻转角 θ = π · 缓动((t − 0.06i) / 时长)', formula2: '上半片纵向缩放 = cos θ（θ < π/2），下半片 = −cos θ',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, cw = Math.min(k.s * 1.05, (W * 0.92) / n), ch = cw * 1.45, x0 = W / 2 - (n * cw) / 2 + cw / 2, cy = (H + 8) / 2, wi = Math.floor(t / 3), ph = t - wi * 3; let pcI = -1;
    const word = (w) => { const s = [...WORDS[((w % WORDS.length) + WORDS.length) % WORDS.length]]; return (i) => s[i] || ' '; };
    const A = word(wi - 1), B = word(wi); k.font(cw * 0.75, 800);
    const half = (x, chh, top, sy) => { ctx.save(); ctx.beginPath(); ctx.rect(x - cw * 0.46, top ? cy - ch / 2 : cy, cw * 0.92, ch / 2); ctx.clip(); ctx.translate(x, cy); ctx.scale(1, sy); ctx.fillStyle = hsla(k.hue, 25, top ? 16 : 12); ctx.fillRect(-cw * 0.46, top ? -ch / 2 : 0, cw * 0.92, ch / 2); ctx.fillStyle = hsla(k.hue, 85, 68); ctx.fillText(chh, 0, 0); ctx.restore(); };
    for (let i = 0; i < n; i++) { const x = x0 + i * cw, p = smooth((ph - i * 0.06) / k.x), a = A(i), b = B(i); if (Math.abs(P.x - x) < cw / 2) pcI = i;
      half(x, b, true, 1); half(x, a, false, 1);
      if (p < 0.5) half(x, a, true, Math.max(0.02, Math.cos(p * Math.PI))); else half(x, b, false, Math.max(0.02, -Math.cos(p * Math.PI)));
      ctx.fillStyle = '#060a14'; ctx.fillRect(x - cw * 0.46, cy - 0.75, cw * 0.92, 1.5); }
    return { mode: `显示「${WORDS[((wi % WORDS.length) + WORDS.length) % WORDS.length]}」· 每格翻 ${k.x.toFixed(2)} 秒`, cell: pcI >= 0 ? `指针在第 ${pcI + 1} 格「${B(pcI) === ' ' ? '空' : B(pcI)}」` : '指针不在翻页牌上' };
  } });

FAM.liquid = tFam({ title: '液态变形', count: NC('切片行数', 10, 160, 70, 2), extra: R('warp', '扭曲强度', 0, 40, 0.5, 12), size: { label: '字号', min: 20, max: 96, step: 1, value: 64 }, color: '#06b6d4', countDoc: '把文字横切成多少条细片，越多越平滑', presets: { 粗切: { count: 12 }, 细切: { count: 160 }, 平静: { warp: 1 }, 剧烈: { warp: 39 }, 大字: { size: 94 } },
  explain: '液态变形：先把文字画到一张隐藏画布上，再把它横切成很多细条，每条按正弦波左右错开，看起来就像文字在水里晃动。指针处会产生一圈额外的涟漪。', formula: '第 j 条偏移 = 扭曲 · sin(0.05y + 2t) · (0.6 + 0.4 sin(0.013y − t))', formula2: '涟漪 = 12 · e^{−d/60} · sin(0.15d − 5t)',
  draw(ctx, W, H, t, C, P, k, st) {
    const L = k.lay(k.str(8)); const blk = textBlock(st, `${k.s}|${W}|${H}|${k.col}`, W, H, (x) => { x.font = FONT(k.s); x.textAlign = 'center'; x.textBaseline = 'middle'; const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, hsla(k.hue - 30, 85, 65)); g.addColorStop(1, hsla(k.hue + 40, 85, 65)); x.fillStyle = g; L.g.forEach((q) => x.fillText(q.ch, q.x, q.y)); });
    const gy0 = Math.max(8, L.g[0].y - L.lh * 0.6), gy1 = Math.min(H, L.g[L.g.length - 1].y + L.lh * 0.6), n = k.n, bh = (gy1 - gy0) / n; let po = 0;
    for (let j = 0; j < n; j++) { const y = gy0 + j * bh, d = Math.abs(y - P.y), off = k.x * Math.sin(y * 0.05 + t * 2) * (0.6 + 0.4 * Math.sin(y * 0.013 - t)) + 12 * Math.exp(-d / 60) * Math.sin(d * 0.15 - t * 5); if (d < bh) po = off;
      ctx.drawImage(blk, 0, y, W, bh + 0.6, off, y, W, bh + 0.6); }
    return { mode: `${n} 条切片`, cell: `指针所在切片偏移 ${fmt(po, 1)}px` };
  } });

FAM.pixel = tFam({ title: '像素显现', count: NC('像素格', 3, 14, 6), extra: T('round', '圆点像素', false), size: { label: '字号', min: 24, max: 110, step: 1, value: 72 }, color: '#a3e635', countDoc: '每个像素方块的边长（像素）', presets: { 细格: { count: 3 }, 粗格: { count: 14 }, 圆点: { round: true }, 大字: { size: 108 } },
  explain: '像素显现：先把文字画到隐藏画布上，按网格取样：落在字形内的格子变成一个像素块。每个像素块有自己的随机出现时间，于是文字像信号逐渐接通一样一点点显现，停留后再随机消失。', formula: '格子出现时间 = 0.3 + 1.6 · hash(格子)', formula2: '透明度 = 缓动((t − 出现时间) / 0.25)',
  draw(ctx, W, H, t, C, P, k) {
    const step = k.n, pts = sampleText(k.str(8), k.s, W, H, step), T0 = 5, ph = (t % T0 + T0) % T0; let shown = 0, near = 0;
    pts.forEach(([x, y], i) => { const a = smooth((ph - 0.3 - 1.6 * hh(i, 1)) / 0.25) * (1 - smooth((ph - 3.6 - 0.9 * hh(i, 2)) / 0.25)); if (a <= 0.01) return; shown++;
      const d = Math.hypot(x - P.x, y - P.y), l = d < 50 ? 80 : 58 + hh(i, 3) * 12; if (d < 50) near++; ctx.fillStyle = hsla(k.hue + hh(i, 4) * 30, 85, l, a);
      if (k.x) { ctx.beginPath(); ctx.arc(x + step / 2, y + step / 2, step * 0.45, 0, TAU); ctx.fill(); } else ctx.fillRect(x, y, step - 1, step - 1); });
    return { mode: `${shown} / ${pts.length} 像素已显现`, cell: `指针 50px 内 ${near} 个像素` };
  } });

FAM.smoke = tFam({ title: '烟雾消散', count: NC('采样间距', 2, 9, 3), extra: R('drift', '漂移距离', 20, 300, 5, 120), size: { label: '字号', min: 24, max: 110, step: 1, value: 72 }, color: '#cbd5e1', countDoc: '取样点之间隔几个像素；越小粒子越多越细腻', extraDoc: '烟雾粒子最多向上飘多远', presets: { 细腻: { count: 2 }, 粗颗粒: { count: 9 }, 轻散: { drift: 25 }, 远飘: { drift: 290 }, 大字: { size: 108 } },
  explain: '烟雾消散：文字被拆成很多细小的粒子。从左到右，粒子依次被「风」吹起，向上飘散、扩散并变淡，像烟一样消失；随后粒子沿原路飘回重新凝聚成字。指针附近的粒子会被吹得更远。', formula: '消散进度 sᵢ = 缓动(波(t) − 0.6·xᵢ/W)', formula2: '位置 = 原位 + s·漂移·(噪声, −1)，透明度 = 1 − s',
  draw(ctx, W, H, t, C, P, k) {
    const pts = sampleText(k.str(8), k.s, W, H, k.n), wave = 0.5 - 0.5 * Math.cos(TAU * t / 7), ds = Math.max(1, k.n - 0.5); let gone = 0;
    pts.forEach(([x, y], i) => { const near = clamp(1 - Math.hypot(x - P.x, y - P.y) / 80, 0, 1), s = clamp(smooth(wave * 1.6 - (x / W) * 0.6) + near * 0.25, 0, 1); if (s > 0.9) gone++;
      const px = x + s * k.x * (hh(i, 1) - 0.5) * 0.8 + Math.sin(t * 2 + i) * s * 6, py = y - s * k.x * (0.4 + 0.6 * hh(i, 2)), a = 1 - s * 0.95;
      ctx.fillStyle = hsla(k.hue, 30 + 50 * (1 - s), 75 - 15 * s, a); ctx.fillRect(px, py, ds * (1 + s), ds * (1 + s)); });
    return { mode: `消散 ${Math.round(gone / Math.max(1, pts.length) * 100)}%`, cell: `共 ${pts.length} 个粒子，已飘散 ${gone} 个` };
  } });

FAM.magnetic = tFam({ title: '磁吸排列', count: NC('字数', 3, 34, 16), extra: R('range', '磁力范围', 40, 500, 5, 200), color: '#818cf8', extraDoc: '指针（磁铁）能把多远的字吸回原位', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 小磁铁: { range: 50 }, 大磁铁: { range: 490 }, 大字: { size: 60 } },
  explain: '磁吸排列：字平时在画面里随噪声自由漂浮；指针像一块磁铁，离指针越近的字越会被吸回到它在句子中的位置并摆正。移动指针，就能「扫」出一句排好的话。', formula: '吸附度 m = 缓动(1 − d / 磁力范围)', formula2: '位置 = 漂浮位置 · (1 − m) + 句中位置 · m',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str()); let snapped = 0;
    L.g.forEach((g, i) => { const fx = W * (0.1 + 0.8 * fract(hh(i, 1) + 0.02 * t * (hh(i, 2) - 0.5))) + Math.sin(t * 0.7 + i) * 20, fy = 8 + (H - 8) * (0.15 + 0.7 * fract(hh(i, 3) + 0.03 * t * (hh(i, 4) - 0.5))) + Math.cos(t * 0.6 + i) * 15;
      const m = smooth(1 - Math.hypot(g.x - P.x, g.y - P.y) / k.x); if (m > 0.9) snapped++;
      const x = fx + (g.x - fx) * m, y = fy + (g.y - fy) * m;
      ctx.save(); ctx.translate(x, y); ctx.rotate((hh(i, 5) - 0.5) * 2.4 * (1 - m)); k.font(); ctx.fillStyle = hsla(k.hue + (1 - m) * 60, 85, 50 + m * 25, 0.55 + 0.45 * m); ctx.fillText(g.ch, 0, 0); ctx.restore(); });
    if (P.x > 0) { ctx.strokeStyle = hsla(k.hue, 80, 70, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P.x, P.y, k.x, 0, TAU); ctx.stroke(); }
    return { mode: `已吸附 ${snapped} / ${L.g.length} 字`, g: L.g };
  } });

FAM.rainbow = tFam({ title: '彩虹跳动', count: NC('字数', 3, 34, 14), extra: R('span', '色相跨度', 20, 360, 5, 280), color: '#f97316', extraDoc: '整句话的颜色在色环上跨越多少度', presets: { 少字: { count: 4 }, 多字: { count: 34 }, 窄色: { span: 30 }, 全彩: { span: 360 }, 大字: { size: 66 } },
  explain: '彩虹跳动：每个字依次向上跳起再落下（|sin| 曲线，像弹跳的球），同时颜色沿色环流动，第一个字的色相是主色，整句跨越「色相跨度」。指针附近的字跳得更高。', formula: '跳高 hᵢ = A · |sin(3t − 0.4i)|', formula2: '色相ᵢ = 主色 + 跨度 · i / n + 60t',
  draw(ctx, W, H, t, C, P, k) {
    const L = k.lay(k.str(), k.s, 1.7), n = L.g.length; k.font();
    L.g.forEach((g, i) => { const near = clamp(1 - Math.hypot(g.x - P.x, g.y - P.y) / 100, 0, 1), h = k.s * (0.35 + 0.5 * near) * Math.abs(Math.sin(t * 3 - i * 0.4)), sq = 1 - 0.15 * Math.max(0, 1 - h / (k.s * 0.08));
      ctx.save(); ctx.translate(g.x, g.y - h + k.s * 0.2); ctx.scale(1 / sq, sq); ctx.fillStyle = hsla(k.hue + (k.x * i) / Math.max(1, n) + t * 60, 90, 62); ctx.fillText(g.ch, 0, 0); ctx.restore(); });
    return { mode: `色相跨度 ${Math.round(k.x)}°`, g: L.g };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'typewriter');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'typewriter';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-text',
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
