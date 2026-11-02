/**
 * kit-dataviz — data-visualisation families on the shared canvas stage. Every chart is drawn from a
 * real (seeded) dataset with the real layout algorithm (squarify, stacking, quartiles, spiral placement,
 * force simulation …). Hover / drag any mark: the info panel shows the value under the pointer live,
 * plus 公式/说明/参数/步骤 in beginner Chinese. An idle auto-pointer keeps hovering when untouched.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, rng, hexRgb, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '数据变化速度', max = 3) => ({ label, min: 0, max, step: 0.1, value: 1 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const yes = (x) => (on(x) ? '开' : '关');
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const lerp = (a, b, k) => a + (b - a) * k;
const rrect = (ctx, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
/** categorical palette seeded from the chosen colour (mono → one hue, light→dark) */
const pal = (C, i, n, mono, a = 1, l = 62) => {
  const h = hueOf(C.color || '#818cf8');
  if (on(mono)) return hsla(h, 78, 30 + 40 * (n > 1 ? 1 - i / (n - 1) : 1), a);
  return hsla(h + i * (300 / Math.max(1, n)), 76, l, a);
};
/** sequential colour ramp: dark navy → chosen colour → near white */
const ramp = (C, v, a = 1) => {
  const c = hexRgb(C.color || '#22d3ee'); const lo = [14, 22, 44]; v = clamp(v, 0, 1);
  const m = v < 0.75 ? v / 0.75 : 1, w = v < 0.75 ? 0 : (v - 0.75) / 0.25 * 0.55;
  const r = [0, 1, 2].map((i) => Math.round(lerp(lerp(lo[i], c[i], m), 255, w)));
  return `rgba(${r[0]},${r[1]},${r[2]},${a})`;
};
const fsz = (W, H, k = 1) => clamp(Math.min(W, H) / 30, 10, 13) * k;
const text = (ctx, s, x, y, { size = 12, col = '#cbd5e1', align = 'left', base = 'middle', bold = false } = {}) => {
  ctx.font = `${bold ? '600 ' : ''}${size}px ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
};
/** floating tooltip next to the pointer, clamped inside the canvas */
const tip = (ctx, W, H, x, y, lines, accent = '#818cf8') => {
  if (!lines || !lines.length) return;
  const s = fsz(W, H, 0.95); ctx.font = `${s}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18, h = lines.length * (s + 5) + 10;
  let bx = x + 14, by = y + 14; if (bx + w > W - 4) bx = x - w - 14; if (by + h > H - 4) by = y - h - 14;
  bx = clamp(bx, 4, Math.max(4, W - w - 4)); by = clamp(by, 4, Math.max(4, H - h - 4));
  ctx.fillStyle = 'rgba(8,13,26,.92)'; rrect(ctx, bx, by, w, h, 7); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
  lines.forEach((l, i) => text(ctx, l, bx + 9, by + 5 + (s + 5) * i + s / 2 + 1, { size: s, col: i ? '#cbd5e1' : '#f8fafc', bold: !i }));
};
const cross = (ctx, P, W, H) => { ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(P.x, 0); ctx.lineTo(P.x, H); ctx.moveTo(0, P.y); ctx.lineTo(W, P.y); ctx.stroke(); ctx.setLineDash([]); };
const gauss = (r) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const pct = (x, d = 1) => `${fmt(x * 100, d)}%`;
const big = (x) => (Math.abs(x) >= 10000 ? `${fmt(x / 10000, 2)} 万` : String(Math.round(x)));
/** nested data tree: {name, v, ch[]} with values summed bottom-up */
const NAMES = [['前端', '后端', '设计', '数据', '运维', '市场'], ['页面', '组件', '接口', '服务', '图表', '脚本', '文档', '测试'], ['A', 'B', 'C', 'D', 'E']];
const makeTree = (depth, br, seed) => {
  const r = rng(seed);
  const mk = (d, name, path) => {
    const n = { name, path, d, ch: [] };
    if (d < depth) { const k = d === 0 ? Math.max(2, br + 1) : Math.max(2, br - (r() < 0.4 ? 1 : 0)); for (let i = 0; i < k; i++) { const nm = d === 0 ? NAMES[0][i % 6] : d === 1 ? NAMES[1][(i + ((r() * 8) | 0)) % 8] + (i + 1) : `${NAMES[2][i % 5]}${d}`; n.ch.push(mk(d + 1, nm, path ? `${path} / ${nm}` : nm)); } }
    else n.base = 1 + r() * 9;
    n.ph = r() * TAU; return n;
  };
  return mk(0, '全部', '');
};
const sumTree = (n, t, amp) => { if (!n.ch.length) { n.v = n.base * (1 + amp * Math.sin(t * 0.7 + n.ph)); return n.v; } n.v = 0; for (const c of n.ch) n.v += sumTree(c, t, amp); return n.v; };

export const FAM = {};

/* ───────────────────────── heatmap ───────────────────────── */
FAM.heatmap = {
  spec: { color: { label: '高值颜色', value: '#22d3ee' }, speed: SPD('热点移动速度'), size: { label: '格子间隙', min: 0, max: 0.45, step: 0.01, value: 0.08 }, count: { label: '网格分辨率 N', min: 6, max: 28, step: 1, value: 14 }, extras: [R('gam', '对比度 γ', 0.4, 2.5, 0.05, 1), R('hot', '热点个数', 1, 5, 1, 3), T('div', '冷暖双色', false), T('lab', '格内数值', false)], remountKeys: [] },
  presets: { 默认: {}, '8×8': { count: 8, lab: true }, 高对比: { gam: 2.2 }, 冷暖: { div: true }, 快变: { speed: 2.4 }, 柔和: { gam: 0.6, size: 0 } },
  doc: {
    title: '热力图 · 用颜色表示数值',
    rows: (v) => [['网格', `${v.n}×${v.n} = ${v.n * v.n} 格`], ['悬停格 (行, 列)', v.cell, 'cell'], ['该格数值', fmt(v.val, 3), 'val'], ['该行均值 / 该列均值', `${fmt(v.rm, 3)} / ${fmt(v.cm, 3)}`], ['全局 最小 / 最大', `${fmt(v.mn, 3)} / ${fmt(v.mx, 3)}`], ['对比度 γ', fmt(v.gam, 2)], ['冷暖双色 / 格内数值', `${v.div} / ${v.lab}`]],
    formula: () => F('值 v(x, y) = Σₖ exp(−dₖ² / 2σ²)　（每个热点一个高斯"山包"）') + F('归一化 u = (v − min) / (max − min)') + F('颜色 = 色带(u^γ)'),
    explain: '<p><b>热力图</b>把一张二维表格里的每个数字画成一个小方格，用<b>颜色深浅</b>代替数字本身：越亮的格子数值越大。人眼对颜色比对数字敏感得多，一眼就能看出"热点"在哪。</p><p>这里的数据来自几个慢慢移动的热点，每个热点对周围格子的贡献随距离按高斯曲线衰减。先把所有值缩放到 0~1，再用 γ 调对比度：γ&gt;1 只有最热的地方亮，γ&lt;1 中间值也会变亮。</p><p>鼠标/手指移到哪个格子，右侧就显示它的行列、数值以及这一行、这一列的平均值（十字高亮）。</p>',
    params: [['高值颜色', '色带最亮端的颜色'], ['热点移动速度', '0 = 数据静止'], ['格子间隙', '格子之间留白比例'], ['网格分辨率 N', 'N×N 个格子'], ['对比度 γ', 'u^γ 的指数'], ['热点个数', '叠加几个高斯热点'], ['冷暖双色', '低值用互补色，适合有正负含义的数据'], ['格内数值', '在格子里直接写数字']],
    example: (v) => `<ol><li>悬停格原始值 v = ${fmt(v.raw, 3)}</li><li>归一化 u = (${fmt(v.raw, 3)} − ${fmt(v.rmn, 3)}) / (${fmt(v.rmx, 3)} − ${fmt(v.rmn, 3)}) = ${fmt(v.val, 3)}</li><li>上色用 u^γ = ${fmt(v.val, 3)}^${fmt(v.gam, 2)} = ${fmt(Math.pow(v.val || 0, v.gam || 1), 3)}</li></ol>`,
    tip: '移动指针看任意格子的数值；把 N 调小再打开"格内数值"更直观。',
  },
  build(S) {
    let raw = [], N = 0;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      N = clamp(Math.round(num(C.count, 14)), 2, 40); const K = clamp(Math.round(num(C.hot, 3)), 1, 6), gam = num(C.gam, 1), gap = num(C.size, 0.08), div = on(C.div), lab = on(C.lab);
      const fs = fsz(W, H), ml = fs * 2.4, mt = fs * 1.6, mr = fs * 3.2, mb = fs * 1.2;
      const cw = (W - ml - mr) / N, ch = (H - mt - mb) / N;
      const hs = []; for (let k = 0; k < K; k++) { const a = t * (0.25 + 0.11 * k) + k * 2.1; hs.push([0.5 + 0.32 * Math.cos(a) * Math.cos(k), 0.5 + 0.32 * Math.sin(a * 1.3 + k)]); }
      raw = new Array(N * N); let mn = 1e9, mx = -1e9;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / N, y = (j + 0.5) / N; let v = 0; for (const [hx, hy] of hs) v += Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * 0.16 ** 2)); raw[j * N + i] = v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
      const u = (v) => (v - mn) / (mx - mn || 1);
      const colAt = (q) => { if (!div) return ramp(C, Math.pow(q, gam)); const h = hueOf(C.color); const d = (q - 0.5) * 2, s = Math.pow(Math.abs(d), gam); return d >= 0 ? hsla(h, 85, 18 + 50 * s) : hsla(h + 180, 75, 18 + 46 * s); };
      const hi = clamp(Math.floor((P.x - ml) / cw), 0, N - 1), hj = clamp(Math.floor((P.y - mt) / ch), 0, N - 1);
      const inside = P.x >= ml && P.x <= W - mr && P.y >= mt && P.y <= H - mb;
      const g = Math.min(cw, ch) * gap;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const q = u(raw[j * N + i]); ctx.fillStyle = colAt(q);
        rrect(ctx, ml + i * cw + g / 2, mt + j * ch + g / 2, cw - g, ch - g, Math.min(cw, ch) * 0.12); ctx.fill();
        if (lab && cw > fs * 1.8) text(ctx, fmt(q, 2), ml + (i + 0.5) * cw, mt + (j + 0.5) * ch, { size: Math.min(fs, cw / 3), col: q > 0.6 ? '#0b1020' : '#e2e8f0', align: 'center' });
      }
      if (inside) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(ml, mt + hj * ch, N * cw, ch); ctx.fillRect(ml + hi * cw, mt, cw, N * ch); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(ml + hi * cw + 1, mt + hj * ch + 1, cw - 2, ch - 2); }
      const step = Math.ceil(N / 8);
      for (let i = 0; i < N; i += step) { text(ctx, String(i + 1), ml + (i + 0.5) * cw, mt - fs * 0.8, { size: fs * 0.85, col: '#64748b', align: 'center' }); text(ctx, String(i + 1), ml - fs * 0.6, mt + (i + 0.5) * ch, { size: fs * 0.85, col: '#64748b', align: 'right' }); }
      const lx = W - mr + fs * 0.8, lh = H - mt - mb; for (let k = 0; k < 40; k++) { ctx.fillStyle = colAt(1 - k / 39); ctx.fillRect(lx, mt + (k / 40) * lh, fs * 0.9, lh / 40 + 1); }
      text(ctx, '高', lx + fs * 1.3, mt + fs * 0.5, { size: fs * 0.85, col: '#94a3b8' }); text(ctx, '低', lx + fs * 1.3, H - mb - fs * 0.5, { size: fs * 0.85, col: '#94a3b8' });
      let rm = 0, cm = 0; for (let k = 0; k < N; k++) { rm += u(raw[hj * N + k]); cm += u(raw[k * N + hi]); } rm /= N; cm /= N;
      const val = u(raw[hj * N + hi]);
      if (inside) tip(ctx, W, H, P.x, P.y, [`第 ${hj + 1} 行 · 第 ${hi + 1} 列`, `数值 ${fmt(val, 3)}`], C.color);
      return { n: N, cell: `${hj + 1}, ${hi + 1}`, val, raw: raw[hj * N + hi], rmn: mn, rmx: mx, rm, cm, mn, mx, gam, div: yes(div), lab: yes(lab), ix: `${hi},${hj}` };
    };
  },
};

/* ───────────────────────── radar ───────────────────────── */
const DIMS = ['攻击', '防御', '速度', '耐力', '技巧', '智力', '运气', '魅力', '感知', '协作'];
FAM.radar = {
  spec: { color: { label: '系列主色', value: '#818cf8' }, speed: SPD('数值波动速度'), size: { label: '雷达半径', min: 0.45, max: 1, step: 0.01, value: 0.88 }, count: { label: '维度数', min: 3, max: 10, step: 1, value: 6, buttons: true }, extras: [R('ser', '系列数', 1, 3, 1, 2), R('fill', '填充不透明度', 0, 0.8, 0.05, 0.3), R('rings', '刻度圈数', 2, 8, 1, 5), T('smooth', '平滑曲线', false)], remountKeys: [] },
  presets: { 默认: {}, 描边: { fill: 0 }, 三系列: { ser: 3 }, 平滑: { smooth: true }, 十维: { count: 10 }, 三维: { count: 3, ser: 1 } },
  doc: {
    title: '雷达图 · 多维度对比',
    rows: (v) => [['维度数 / 系列数', `${v.n} / ${v.ns}`], ['悬停维度', v.dim, 'dim'], ['该维度各系列', v.vals, 'vals'], ['系列 A 面积占比', pct(v.area), 'area'], ['系列 A 平均分', fmt(v.avg, 1)], ['刻度圈 / 平滑', `${v.rings} 圈 / ${v.sm}`]],
    formula: () => F('第 k 个维度的角度 θₖ = 2π·k / n') + F('点坐标 (x, y) = 中心 + r·vₖ·(sin θₖ, −cos θₖ)') + F('多边形面积 A = ½ · Σ r²·vₖ·vₖ₊₁ · sin(2π/n)'),
    explain: '<p><b>雷达图</b>（蜘蛛网图）把 n 个维度平均分布在一圈上，每个维度一根轴，数值越大点离中心越远，再把这些点连成多边形。</p><p>一个多边形就是一个"系列"（比如一名选手），几个系列叠在一起就能看出谁在哪方面强、谁更全面。多边形<b>面积</b>常被当作"综合实力"的直观感受。</p><p>指针指向哪个方向，就会高亮离它最近的那根轴，右侧列出这一维度上每个系列的分数。</p>',
    params: [['系列主色', '第一个系列的颜色，其它系列按色相偏移'], ['数值波动速度', '数据轻微实时波动；0 = 静止'], ['雷达半径', '相对画布的大小'], ['维度数', '轴的数量 n'], ['系列数', '同时对比几组数据'], ['填充不透明度', '0 = 只描边'], ['刻度圈数', '背景同心多边形的圈数'], ['平滑曲线', '用曲线代替折线连接各点']],
    example: (v) => `<ol><li>n = ${v.n}，相邻轴夹角 = 360° / ${v.n} = ${fmt(360 / v.n, 1)}°</li><li>系列 A 在"${v.dim}"上得分 ${v.va}，点离中心 ${v.va}% · r</li><li>面积占满分多边形的 ${pct(v.area)}</li></ol>`,
    tip: '把指针绕着中心转一圈，逐个查看每个维度的分数。',
  },
  build(S) {
    const r0 = rng(11); const base = [0, 1, 2].map(() => DIMS.map(() => 0.35 + r0() * 0.6));
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 6)), 3, 10), ns = clamp(Math.round(num(C.ser, 2)), 1, 3), rings = clamp(Math.round(num(C.rings, 5)), 2, 10), fa = num(C.fill, 0.3), sm = on(C.smooth);
      const fs = fsz(W, H), cx = W / 2, cy = H / 2 + fs * 0.3, Rm = (Math.min(W, H) / 2 - fs * 2.6) * num(C.size, 0.88);
      const ang = (k) => (k / n) * TAU; const pt = (k, r) => [cx + Math.sin(ang(k)) * r, cy - Math.cos(ang(k)) * r];
      const vals = base.slice(0, ns).map((b, s) => b.slice(0, n).map((v, k) => clamp(v + 0.07 * Math.sin(t * 1.2 + k * 1.7 + s * 2.3), 0.05, 1)));
      let pa = Math.atan2(P.x - cx, -(P.y - cy)); if (pa < 0) pa += TAU; const hk = Math.round(pa / (TAU / n)) % n;
      for (let g = 1; g <= rings; g++) { ctx.beginPath(); for (let k = 0; k <= n; k++) { const [x, y] = pt(k % n, (Rm * g) / rings); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = g === rings ? 'rgba(148,163,184,.45)' : 'rgba(148,163,184,.16)'; ctx.lineWidth = 1; ctx.stroke(); }
      for (let k = 0; k < n; k++) { const [x, y] = pt(k, Rm); ctx.strokeStyle = k === hk ? 'rgba(255,255,255,.8)' : 'rgba(148,163,184,.25)'; ctx.lineWidth = k === hk ? 2 : 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); const [lx, ly] = pt(k, Rm + fs * 1.3); text(ctx, DIMS[k], lx, ly, { size: fs, col: k === hk ? '#fff' : '#94a3b8', align: 'center', bold: k === hk }); }
      vals.forEach((vs, s) => {
        const pts = vs.map((v, k) => pt(k, v * Rm)); const col = pal(C, s, 3, false, 1);
        ctx.beginPath();
        if (sm) { for (let k = 0; k < n; k++) { const p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n]; if (!k) ctx.moveTo(p1[0], p1[1]); ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); } } else pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath(); ctx.fillStyle = pal(C, s, 3, false, fa); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
        pts.forEach(([x, y], k) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, k === hk ? 5.5 : 3.2, 0, TAU); ctx.fill(); });
      });
      for (let s = 0; s < ns; s++) { ctx.fillStyle = pal(C, s, 3, false); ctx.fillRect(fs * 0.8, fs * (0.8 + s * 1.5), fs * 0.9, fs * 0.9); text(ctx, `系列 ${'ABC'[s]}`, fs * 2.1, fs * (1.25 + s * 1.5), { size: fs, col: '#cbd5e1' }); }
      const A = vals[0]; let area = 0; for (let k = 0; k < n; k++) area += A[k] * A[(k + 1) % n]; area /= n;
      const [tx, ty] = pt(hk, A[hk] * Rm);
      tip(ctx, W, H, tx, ty, [DIMS[hk], ...vals.map((vs, s) => `系列 ${'ABC'[s]}：${Math.round(vs[hk] * 100)}`)], C.color);
      return { n, ns, dim: DIMS[hk], vals: vals.map((vs) => Math.round(vs[hk] * 100)).join(' / '), va: Math.round(A[hk] * 100), area, avg: (A.reduce((a, b) => a + b, 0) / n) * 100, rings, sm: yes(sm), hx: tx, hy: ty, ix: String(hk) };
    };
  },
};

/* ───────────────────────── sankey ───────────────────────── */
const SK = [['搜索', '社交', '广告', '直接', '邮件', '外链'], ['首页', '商品页', '活动页', '博客', '搜索页', '帮助'], ['下单', '注册', '收藏', '离开', '咨询', '分享']];
FAM.sankey = {
  spec: { color: { label: '流带主色', value: '#818cf8' }, speed: SPD('粒子流动速度'), size: { label: '节点宽度', min: 0.4, max: 2.2, step: 0.05, value: 1 }, count: { label: '每列节点数', min: 2, max: 6, step: 1, value: 4, buttons: true }, extras: [R('dens', '连线密度', 0.2, 1, 0.05, 0.75), R('curv', '曲率', 0, 1, 0.05, 0.5), R('gap', '节点间距', 0.02, 0.25, 0.01, 0.07), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 少流: { dens: 0.3 }, 多节点: { count: 6, dens: 1 }, 宽节点: { size: 2 }, 直线: { curv: 0 }, 单色: { mono: true } },
  doc: {
    title: '桑基图 · 流量从哪来到哪去',
    rows: (v) => [['节点 / 连线', `${v.nn} / ${v.nl}`], ['总流量', big(v.tot)], ['悬停', v.hov, 'hov'], ['该流量', `${big(v.hv)}（占总量 ${pct(v.hs)}）`, 'hv'], ['节点 流入 / 流出', v.io], ['守恒检查', v.ok], ['曲率 / 单色', `${fmt(v.curv, 2)} / ${v.mono}`]],
    formula: () => F('带宽 wᵢⱼ = 流量ᵢⱼ / 总流量 × 可用高度') + F('守恒：中间节点 Σ 流入 = Σ 流出') + F('流带中心线 = 三次贝塞尔 B(s)，控制点水平偏移 = 曲率 × 列距'),
    explain: '<p><b>桑基图</b>画的是"流量"：左边是来源（比如访客渠道），中间是经过的页面，右边是去向（下单、离开…）。每条带子的<b>宽度正比于流量</b>，所以粗带就是主要路径。</p><p>中间列的节点满足<b>守恒</b>：流进来多少就流出去多少，节点高度等于它的总流量。带子里流动的小点表示真实的"人流"，越粗的带子点越多。</p><p>把指针放在任意带子或节点上，右侧会显示具体的流量和占比。</p>',
    params: [['流带主色', '按来源分配色相'], ['粒子流动速度', '0 = 静止'], ['节点宽度', '矩形节点的宽度'], ['每列节点数', '每一列有几个节点'], ['连线密度', '相邻列之间实际存在的连线比例'], ['曲率', '0 = 直线，1 = 很弯的 S 形'], ['节点间距', '同一列节点之间的留白'], ['单色', '所有来源用同一色相的深浅']],
    example: (v) => `<ol><li>总流量 = ${big(v.tot)}</li><li>悬停的 "${v.hov}" 流量 ${big(v.hv)}</li><li>占比 = ${big(v.hv)} / ${big(v.tot)} = ${pct(v.hs)}，所以它的带宽就占可用高度的 ${pct(v.hs)}</li></ol>`,
    tip: '指针扫过带子查看每条路径的流量；"少流"预设更容易看清。',
  },
  build(S) {
    let key = '', nodes = [], links = [], parts = [];
    const make = (n, dens) => {
      const r = rng(5 + n * 13 + Math.round(dens * 20)); nodes = []; links = [];
      for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) nodes.push({ c, i, name: SK[c][i], in: 0, out: 0 });
      const N = (c, i) => nodes[c * n + i];
      for (let i = 0; i < n; i++) { const src = N(0, i); src.out = 0; const vol = 800 + r() * 4200; const ts = []; for (let j = 0; j < n; j++) if (r() < dens || j === i % n) ts.push([j, 0.2 + r()]); const sw = ts.reduce((a, b) => a + b[1], 0); ts.forEach(([j, w]) => { const v = (vol * w) / sw; links.push({ a: src, b: N(1, j), v, c: i }); src.out += v; N(1, j).in += v; }); }
      for (let j = 0; j < n; j++) { const mid = N(1, j); if (!mid.in) continue; const ts = []; for (let k = 0; k < n; k++) if (r() < dens || k === (j + 1) % n) ts.push([k, 0.2 + r()]); const sw = ts.reduce((a, b) => a + b[1], 0); ts.forEach(([k, w]) => { const v = (mid.in * w) / sw; links.push({ a: mid, b: N(2, k), v, c: links.filter((l) => l.b === mid).sort((p, q) => q.v - p.v)[0]?.c ?? j }); mid.out += v; N(2, k).in += v; }); }
      parts = [];
    };
    return ({ ctx, W, H, dt, dtw, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 4)), 2, 6), dens = num(C.dens, 0.75), curv = num(C.curv, 0.5), gapK = num(C.gap, 0.07), mono = on(C.mono);
      const k2 = `${n}|${dens}`; if (k2 !== key) { key = k2; make(n, dens); }
      const fs = fsz(W, H), mt = fs * 2.2, mb = fs * 0.8, nw = clamp(Math.min(W, H) * 0.035, 8, 22) * num(C.size, 1);
      const tot = nodes.filter((d) => d.c === 0).reduce((a, d) => a + d.out, 0);
      const colX = [fs * 4.6, W / 2 - nw / 2, W - fs * 4.6 - nw];
      const avail = H - mt - mb - gapK * (H - mt - mb) * (n - 1), sc = avail / tot, gp = gapK * (H - mt - mb);
      for (let c = 0; c < 3; c++) { let y = mt; nodes.filter((d) => d.c === c).forEach((d) => { d.h = Math.max(1, (c === 0 ? d.out : d.in) * sc); d.x = colX[c]; d.y = y; y += d.h + gp; d.oy = d.y; d.iy = d.y; }); }
      links.forEach((l) => { l.w = l.v * sc; l.y0 = l.a.oy + l.w / 2; l.a.oy += l.w; l.y1 = l.b.iy + l.w / 2; l.b.iy += l.w; });
      const bez = (l, s) => { const x0 = l.a.x + nw, x1 = l.b.x, cxo = (x1 - x0) * curv * 0.5, u = 1 - s; return [u * u * u * x0 + 3 * u * u * s * (x0 + cxo) + 3 * u * s * s * (x1 - cxo) + s * s * s * x1, u * u * u * l.y0 + 3 * u * u * s * l.y0 + 3 * u * s * s * l.y1 + s * s * s * l.y1]; };
      const yAtX = (l, x) => { let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (bez(l, m)[0] < x) lo = m; else hi = m; } return bez(l, (lo + hi) / 2)[1]; };
      let hl = null, hn = null;
      for (const d of nodes) if (P.x >= d.x - 3 && P.x <= d.x + nw + 3 && P.y >= d.y && P.y <= d.y + d.h) hn = d;
      if (!hn) for (const l of links) if (P.x > l.a.x + nw && P.x < l.b.x && Math.abs(P.y - yAtX(l, P.x)) <= Math.max(2, l.w / 2)) hl = l;
      const lit = (l) => (hl ? l === hl : hn ? l.a === hn || l.b === hn : true);
      for (const l of links) {
        ctx.beginPath(); const steps = 24; for (let s = 0; s <= steps; s++) { const [x, y] = bez(l, s / steps); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        { const ta = lit(l) ? (hl || hn ? 0.75 : 0.5) : 0.12; l.al = l.al == null ? ta : l.al + (ta - l.al) * Math.min(1, (dtw || 0.016) * 9); } ctx.strokeStyle = pal(C, l.c, n, mono, l.al); ctx.lineWidth = Math.max(1, l.w); ctx.lineCap = 'butt'; ctx.stroke();
      }
      // particles ∝ flow
      if (dt > 0) for (const l of links) if (Math.random() < (l.v / tot) * 14 * dt * 8) parts.push({ l, s: 0, o: (Math.random() - 0.5) * 0.8 });
      parts = parts.filter((p) => (p.s += dt * 0.45) < 1);
      for (const p of parts) { const [x, y] = bez(p.l, p.s); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y + p.o * p.l.w, 1.8, 0, TAU); ctx.fill(); }
      for (const d of nodes) { ctx.fillStyle = d === hn ? '#fff' : pal(C, d.c === 0 ? d.i : d.i + d.c, n, mono, d.c === 0 ? 1 : 0.85); rrect(ctx, d.x, d.y, nw, d.h, 2); ctx.fill(); const left = d.c < 2; text(ctx, d.name, left && d.c === 0 ? d.x - 6 : d.c === 2 ? d.x + nw + 6 : d.x + nw + 6, d.y + d.h / 2, { size: fs, col: '#cbd5e1', align: d.c === 0 ? 'right' : 'left' }); }
      ['来源', '页面', '去向'].forEach((s, c) => text(ctx, s, colX[c] + nw / 2, fs * 1, { size: fs, col: '#64748b', align: 'center', bold: true }));
      let hov = '—', hv = 0, io = '—';
      if (hl) { hov = `${hl.a.name} → ${hl.b.name}`; hv = hl.v; io = `${big(hl.b.in)} / ${big(hl.b.out)}`; } else if (hn) { hov = `节点 ${hn.name}`; hv = hn.c === 0 ? hn.out : hn.in; io = `${big(hn.in)} / ${big(hn.out)}`; }
      if (hl || hn) tip(ctx, W, H, P.x, P.y, [hov, `流量 ${big(hv)}`, `占总量 ${pct(hv / tot)}`], C.color);
      const mid = nodes.filter((d) => d.c === 1 && d.in > 0); const err = mid.reduce((a, d) => a + Math.abs(d.in - d.out), 0);
      return { nn: nodes.length, nl: links.length, tot, hov, hv, hs: hv / tot, io, ok: err < 1e-6 * tot ? '✓ 中间列流入 = 流出' : `误差 ${fmt(err, 2)}`, curv, mono: yes(mono), ix: hl ? links.indexOf(hl) : hn ? `n${nodes.indexOf(hn)}` : '-' };
    };
  },
};

/* ───────────────────────── bubbles (scatter) ───────────────────────── */
FAM.bubbles = {
  spec: { color: { label: '气泡颜色', value: '#22d3ee' }, speed: SPD('漂移速度'), size: { label: '气泡缩放', min: 0.3, max: 2, step: 0.05, value: 1 }, count: { label: '样本点数', min: 10, max: 160, step: 5, value: 50 }, extras: [R('corr', '相关强度 ρ', -1, 1, 0.05, 0.6), R('grp', '分组数', 1, 4, 1, 3), T('fit', '回归直线', true)], remountKeys: [] },
  presets: { 默认: {}, 负相关: { corr: -0.7 }, 无相关: { corr: 0 }, 密集小泡: { count: 150, size: 0.55 }, 大泡: { size: 1.8, count: 25 } },
  doc: {
    title: '气泡散点图 · 两个变量的关系',
    rows: (v) => [['样本点数', String(v.n)], ['皮尔逊相关系数 r', fmt(v.r, 3), 'r'], ['回归直线 y = a + b·x', `a = ${fmt(v.a, 2)}，b = ${fmt(v.b, 3)}`], ['悬停点 (x, y)', v.pt, 'pt'], ['悬停点 气泡值', v.pv], ['设定 ρ / 分组', `${fmt(v.rho, 2)} / ${v.g}`], ['回归直线', v.fit]],
    formula: () => F('r = Σ(x−x̄)(y−ȳ) / √(Σ(x−x̄)² · Σ(y−ȳ)²)') + F('最小二乘斜率 b = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²，截距 a = ȳ − b·x̄') + F('气泡半径 ∝ √值（让面积而不是半径正比于数值）'),
    explain: '<p><b>散点图</b>每个点代表一个样本，横坐标和纵坐标是它的两个属性，比如"广告费"和"销量"。点整体往右上倾斜说明两者<b>正相关</b>，往右下是负相关，一团乱就是没关系。</p><p><b>气泡图</b>再加第三个维度：气泡大小。注意要让<b>面积</b>正比于数值（半径取平方根），否则大值会被夸大。</p><p>相关系数 r 在 −1 ~ 1 之间，越接近 ±1 越像一条直线；回归直线是让所有点到直线竖直距离平方和最小的那条线。数据点在轻微漂移，r 会实时变化。</p>',
    params: [['气泡颜色', '第一组颜色，其它组按色相偏移'], ['漂移速度', '样本轻微漂移的速度；0 = 静止'], ['气泡缩放', '所有气泡的大小倍数'], ['样本点数', '点的数量'], ['相关强度 ρ', '生成数据时设定的相关性'], ['分组数', '按类别着色的组数'], ['回归直线', '画出最小二乘拟合直线']],
    example: (v) => `<ol><li>设定 ρ = ${fmt(v.rho, 2)}，用 y = ρ·x + √(1−ρ²)·噪声 生成数据</li><li>实际算出 r = ${fmt(v.r, 3)}（样本越多越接近 ρ）</li><li>斜率 b = ${fmt(v.b, 3)}：x 每增加 1，y 平均变化 ${fmt(v.b, 3)}</li></ol>`,
    tip: '把 ρ 从 −1 拖到 1，看点云从右下翻到右上；指针悬停看单个样本。',
  },
  build(S) {
    const r = rng(21); const pool = Array.from({ length: 200 }, () => ({ zx: gauss(r), ze: gauss(r), v: Math.exp(gauss(r) * 0.6), g: (r() * 4) | 0, ph: r() * TAU, w: 0.6 + r() }));
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 50)), 3, 200), rho = clamp(num(C.corr, 0.6), -1, 1), G = clamp(Math.round(num(C.grp, 3)), 1, 4), fit = on(C.fit), sc = num(C.size, 1);
      const fs = fsz(W, H), ml = fs * 3, mb = fs * 2.4, mt = fs * 1.2, mr = fs * 1.2, pw = W - ml - mr, ph = H - mt - mb;
      const pts = pool.slice(0, n).map((p) => { const x = p.zx + 0.18 * Math.sin(t * 0.5 * p.w + p.ph), e = p.ze + 0.18 * Math.cos(t * 0.4 * p.w + p.ph); return { x, y: rho * x + Math.sqrt(1 - rho * rho) * e, v: p.v, g: p.g % G }; });
      const X = (x) => ml + ((x + 3) / 6) * pw, Y = (y) => mt + ph - ((y + 3) / 6) * ph;
      ctx.strokeStyle = 'rgba(148,163,184,.13)'; ctx.lineWidth = 1;
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(X(k), mt); ctx.lineTo(X(k), mt + ph); ctx.moveTo(ml, Y(k)); ctx.lineTo(ml + pw, Y(k)); ctx.stroke(); text(ctx, String(k), X(k), mt + ph + fs * 0.9, { size: fs * 0.85, col: '#64748b', align: 'center' }); text(ctx, String(k), ml - fs * 0.5, Y(k), { size: fs * 0.85, col: '#64748b', align: 'right' }); }
      text(ctx, '变量 X →', ml + pw, H - fs * 0.6, { size: fs * 0.9, col: '#94a3b8', align: 'right' }); text(ctx, '↑ 变量 Y', ml + 4, mt + fs * 0.5, { size: fs * 0.9, col: '#94a3b8' });
      const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
      const rr = sxy / Math.sqrt(sxx * syy || 1), b = sxy / (sxx || 1), a = my - b * mx;
      const base = Math.min(pw, ph) * 0.028 * sc; let hp = null, hd = 1e9;
      for (const p of pts) { p.px = X(p.x); p.py = Y(p.y); p.r = base * Math.sqrt(p.v) + 1.5; const d = Math.hypot(P.x - p.px, P.y - p.py); if (d < Math.max(p.r, 10) && d < hd) { hd = d; hp = p; } }
      pts.sort((p, q) => q.r - p.r).forEach((p) => { ctx.fillStyle = pal(C, p.g, 4, false, p === hp ? 0.95 : 0.55); ctx.beginPath(); ctx.arc(p.px, p.py, p.r, 0, TAU); ctx.fill(); ctx.strokeStyle = p === hp ? '#fff' : pal(C, p.g, 4, false, 0.9); ctx.lineWidth = p === hp ? 2 : 1; ctx.stroke(); });
      if (fit) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(X(-3), Y(a - 3 * b)); ctx.lineTo(X(3), Y(a + 3 * b)); ctx.stroke(); ctx.setLineDash([]); }
      text(ctx, `r = ${fmt(rr, 2)}`, ml + pw - 4, mt + fs * 0.6, { size: fs * 1.2, col: '#fff', align: 'right', bold: true });
      if (hp) tip(ctx, W, H, hp.px, hp.py, [`第 ${hp.g + 1} 组样本`, `x = ${fmt(hp.x, 2)}，y = ${fmt(hp.y, 2)}`, `气泡值 = ${fmt(hp.v, 2)}`], C.color);
      else cross(ctx, P, W, H);
      return { n, r: rr, a, b, pt: hp ? `${fmt(hp.x, 2)}, ${fmt(hp.y, 2)}` : `（指针处 ${fmt(((P.x - ml) / pw) * 6 - 3, 2)}, ${fmt(((mt + ph - P.y) / ph) * 6 - 3, 2)}）`, pv: hp ? fmt(hp.v, 2) : '—', rho, g: G, fit: yes(fit), ix: hp ? String(pts.indexOf(hp)) : '-' };
    };
  },
};

/* ───────────────────────── cal-heat ───────────────────────── */
const WK = ['一', '二', '三', '四', '五', '六', '日'];
FAM['cal-heat'] = {
  spec: { color: { label: '活跃颜色', value: '#34d399' }, speed: SPD('日期推进速度'), size: { label: '格子间隙', min: 0, max: 0.45, step: 0.01, value: 0.14 }, count: { label: '显示周数', min: 4, max: 53, step: 1, value: 26 }, extras: [R('act', '活跃度', 0.1, 1, 0.05, 0.6), R('lv', '颜色分级数', 3, 8, 1, 5), T('fire', '火焰色谱', false)], remountKeys: [] },
  presets: { 默认: {}, 一年: { count: 53 }, 一个月: { count: 5 }, 高活跃: { act: 0.95 }, 低活跃: { act: 0.2 }, 火焰色: { fire: true } },
  doc: {
    title: '日历热力图 · 每天做了多少',
    rows: (v) => [['显示范围', `${v.wk} 周 · ${v.days} 天`], ['悬停日期', v.date, 'date'], ['当天次数', String(v.cnt), 'cnt'], ['总次数 / 活跃天数', `${v.tot} / ${v.ad}`], ['最长连续活跃', `${v.streak} 天`], ['颜色分级', `${v.lv} 级 · 火焰色 ${v.fire}`]],
    formula: () => F('格子位置：列 = 第几周，行 = 星期几') + F('颜色级别 = ⌈ 次数 / 最大次数 × 级数 ⌉') + F('最长连续 = 最长一段"每天次数 > 0"的天数'),
    explain: '<p>GitHub 提交记录那种绿色格子就是<b>日历热力图</b>：每一列是一周，每一行是星期一到星期日，每个格子是一天，颜色越深当天越活跃。</p><p>它特别适合看<b>习惯和周期</b>：周末是不是总空着？有没有连续很多天坚持？颜色不是连续渐变，而是分成几个<b>级别</b>，这样少量差异不会干扰判断。</p><p>日期会随时间向前推进（最右边是"今天"，有呼吸光圈），指针悬停查看任意一天。</p>',
    params: [['活跃颜色', '最高级别的颜色'], ['日期推进速度', '每过一段时间向前推进一天；0 = 静止'], ['格子间隙', '格子之间留白'], ['显示周数', '横向显示多少周'], ['活跃度', '每天有记录的概率与强度'], ['颜色分级数', '把次数分成几档颜色'], ['火焰色谱', '改用黄→橙→红的配色']],
    example: (v) => `<ol><li>悬停的 ${v.date} 有 ${v.cnt} 次</li><li>最大值 ${v.mxc}，级别 = ⌈${v.cnt} / ${v.mxc} × ${v.lv}⌉ = ${v.cnt ? Math.ceil((v.cnt / (v.mxc || 1)) * v.lv) : 0}</li><li>这段时间共 ${v.ad} 天活跃，最长连续 ${v.streak} 天</li></ol>`,
    tip: '看看哪一行（星期几）最空；把周数调到 53 看一整年。',
  },
  build(S) {
    const day0 = new Date(2026, 10, 2).getTime();
    const val = (d, act) => { const r = rng(1000 + d)(); const r2 = rng(5000 + d)(); const dow = ((d % 7) + 7) % 7; const wk = dow >= 5 ? 0.45 : 1; const season = 0.6 + 0.4 * Math.sin(d / 23); return r < act * wk * season ? Math.ceil(r2 * 12 * act * season) : 0; };
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const wk = clamp(Math.round(num(C.count, 26)), 2, 60), act = num(C.act, 0.6), lv = clamp(Math.round(num(C.lv, 5)), 2, 10), fire = on(C.fire), gap = num(C.size, 0.14);
      const shift = Math.floor(t * 1.5), frac = t * 1.5 - shift;
      const fs = fsz(W, H), ml = fs * 2.2, mt = fs * 2.2, mr = fs * 0.8, mb = fs * 2.4;
      const days = wk * 7, today = shift; const first = today - days + 1;
      const cw = (W - ml - mr) / wk, ch = Math.min((H - mt - mb) / 7, cw * 1.6), top = mt + ((H - mt - mb) - ch * 7) / 2;
      const cells = []; let mxc = 1; for (let k = 0; k < days; k++) { const d = first + k; const c = val(d, act); cells.push(c); mxc = Math.max(mxc, c); }
      const col = (q) => { if (!q) return 'rgba(148,163,184,.10)'; const lvl = Math.ceil((q / mxc) * lv) / lv; if (fire) return hsla(55 - 50 * lvl, 95, 30 + 32 * lvl); return ramp(C, 0.2 + 0.62 * lvl); };
      const hc = clamp(Math.floor((P.x - ml) / cw), 0, wk - 1), hr = clamp(Math.floor((P.y - top) / ch), 0, 6); const hk = hc * 7 + hr;
      const g = Math.min(cw, ch) * gap;
      for (let k = 0; k < days; k++) { const c = (k / 7) | 0, rr = k % 7; ctx.fillStyle = col(cells[k]); rrect(ctx, ml + c * cw + g / 2, top + rr * ch + g / 2, cw - g, ch - g, Math.min(cw, ch) * 0.18); ctx.fill(); }
      const lx = ml + (wk - 1) * cw + cw / 2, ly = top + 6 * ch + ch / 2; ctx.strokeStyle = `rgba(255,255,255,${0.9 - frac * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, Math.min(cw, ch) * (0.3 + frac * 0.5), 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(ml + hc * cw + g / 2, top + hr * ch + g / 2, cw - g, ch - g);
      WK.forEach((s, i) => { if (i % 2 === 0) text(ctx, s, ml - fs * 0.5, top + (i + 0.5) * ch, { size: fs * 0.85, col: '#64748b', align: 'right' }); });
      let lastM = -1; for (let c = 0; c < wk; c++) { const dt0 = new Date(day0 + (first + c * 7) * 864e5); if (dt0.getMonth() !== lastM && (c === 0 || cw * 2 > fs)) { lastM = dt0.getMonth(); if (c < wk - 1) text(ctx, `${lastM + 1}月`, ml + c * cw, top - fs * 0.8, { size: fs * 0.85, col: '#94a3b8' }); } }
      for (let i = 0; i <= lv; i++) { ctx.fillStyle = i ? col((i / lv) * mxc) : col(0); ctx.fillRect(W - mr - (lv + 1 - i) * fs * 1.2, H - fs * 1.4, fs, fs); } text(ctx, '少', W - mr - (lv + 1) * fs * 1.2 - fs * 0.4, H - fs * 0.9, { size: fs * 0.85, col: '#64748b', align: 'right' });
      let tot = 0, ad = 0, streak = 0, cur = 0; for (const c of cells) { tot += c; if (c) { ad++; cur++; streak = Math.max(streak, cur); } else cur = 0; }
      const dd = new Date(day0 + (first + hk) * 864e5); const date = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')} 周${WK[hr]}`;
      tip(ctx, W, H, ml + hc * cw + cw / 2, top + hr * ch + ch / 2, [date, `${cells[hk]} 次`], C.color);
      return { wk, days, date, cnt: cells[hk], tot, ad, streak, lv, fire: yes(fire), mxc, hx: ml + hc * cw + cw / 2, hy: top + hr * ch + ch / 2, ix: String(hk) };
    };
  },
};

/* ───────────────────────── sunburst ───────────────────────── */
FAM.sunburst = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('旋转与数据波动'), size: { label: '中心空洞', min: 0, max: 0.6, step: 0.01, value: 0.22 }, count: { label: '层级深度', min: 1, max: 4, step: 1, value: 3, buttons: true }, extras: [R('br', '分支数', 2, 5, 1, 3), R('gap', '扇区间隙°', 0, 4, 0.25, 0.75), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 两层: { count: 2 }, 四层: { count: 4, br: 2 }, 无间隙: { gap: 0, size: 0 }, 多分支: { br: 5 }, 单色: { mono: true } },
  doc: {
    title: '旭日图 · 一圈一层的层级占比',
    rows: (v) => [['层级 / 叶子数', `${v.depth} 层 / ${v.leaves}`], ['悬停路径', v.path, 'path'], ['数值', fmt(v.val, 1), 'val'], ['占父级', pct(v.sp)], ['占整体', pct(v.sa)], ['当前聚焦', v.focus], ['间隙 / 单色', `${fmt(v.gap, 2)}° / ${v.mono}`]],
    formula: () => F('扇区角度 = 节点值 / 父节点值 × 父扇区角度') + F('第 d 层半径区间 = [r₀ + (d−1)·Δr, r₀ + d·Δr]') + F('父节点值 = Σ 子节点值'),
    explain: '<p><b>旭日图</b>是"一圈一圈的饼图"：最里圈是第一层分类，往外每一圈是下一层的细分。每个扇区的<b>角度正比于它的数值</b>，并且一定落在父扇区的角度范围之内。</p><p>这样既能看出每一层的占比，又能看出层级关系，比如"前端 → 组件 → A"。</p><p>指针悬停任意扇区查看完整路径与占比；<b>点击</b>某个扇区会把它放大成整圈（下钻），点击中心返回上一级。</p>',
    params: [['起始色相', '第一个一级分类的颜色'], ['旋转与数据波动', '整体缓慢旋转、叶子值轻微波动；0 = 静止'], ['中心空洞', '中间空白圆的半径比例'], ['层级深度', '树有几层'], ['分支数', '每个节点大约几个孩子'], ['扇区间隙°', '扇区之间的角度留白'], ['单色', '只用一个色相区分']],
    example: (v) => `<ol><li>悬停 "${v.path}"，值 ${fmt(v.val, 1)}</li><li>父节点值 ${fmt(v.pv, 1)} → 占父级 ${pct(v.sp)}</li><li>扇区角度 = ${pct(v.sa)} × 360° = ${fmt(v.sa * 360, 1)}°</li></ol>`,
    tip: '点击扇区下钻，点中心返回。',
  },
  build(S) {
    let key = '', root = null, focus = null, hov = null, arcs = [];
    S.onDown((P) => { const cx = S.W / 2, cy = S.H / 2; const r = Math.hypot(P.x - cx, P.y - cy); if (hov && hov.ch.length) focus = hov; else if (r < S._r0 && focus && focus !== root) focus = focus.parent || root; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const depth = clamp(Math.round(num(C.count, 3)), 1, 4), br = clamp(Math.round(num(C.br, 3)), 2, 5), gapD = num(C.gap, 0.75), mono = on(C.mono);
      const k2 = `${depth}|${br}`; if (k2 !== key) { key = k2; root = makeTree(depth, br, 31 + br); const link = (n) => n.ch.forEach((c) => { c.parent = n; link(c); }); link(root); focus = root; }
      sumTree(root, t, 0.2);
      const fs = fsz(W, H), cx = W / 2, cy = H / 2, Rm = Math.min(W, H) / 2 - fs * 0.8, fd = focus.d, levels = depth - fd, r0 = Rm * num(C.size, 0.22), dr = (Rm - r0) / Math.max(1, levels); S._r0 = Math.max(r0, 18);
      const rot = t * 0.12, gap = (gapD * Math.PI) / 180; arcs = [];
      const n1 = focus.ch.length || 1;
      const walk = (n, a0, a1, top) => { n.ch.forEach((c) => { const a = a0 + ((a1 - a0) * c.v) / n.v; const ti = top < 0 ? focus.ch.indexOf(c) : top; arcs.push({ n: c, a0, a1: a, ti }); walk(c, a0, a, ti); a0 = a; }); };
      walk(focus, rot, rot + TAU, -1);
      let pa = Math.atan2(P.y - cy, P.x - cx); const pr = Math.hypot(P.x - cx, P.y - cy); hov = null;
      for (const a of arcs) { const ri = r0 + (a.n.d - fd - 1) * dr, ro = ri + dr; let q = pa; while (q < a.a0) q += TAU; while (q > a.a0 + TAU) q -= TAU; if (pr >= ri && pr < ro && q <= a.a1) hov = a.n; }
      const anc = new Set(); for (let x = hov; x; x = x.parent) anc.add(x);
      for (const a of arcs) {
        const ri = r0 + (a.n.d - fd - 1) * dr, ro = ri + dr - 1.5, g = Math.min(gap, (a.a1 - a.a0) * 0.3);
        const light = 62 - (a.n.d - fd - 1) * 9; const h = hueOf(C.color);
        ctx.fillStyle = mono ? hsla(h, 70, light - (a.ti % 3) * 6, hov && !anc.has(a.n) ? 0.35 : 1) : hsla(h + a.ti * (300 / n1), 72, light, hov && !anc.has(a.n) ? 0.35 : 1);
        ctx.beginPath(); ctx.arc(cx, cy, ro, a.a0 + g / 2, a.a1 - g / 2); ctx.arc(cx, cy, ri, a.a1 - g / 2, a.a0 + g / 2, true); ctx.closePath(); ctx.fill();
        if (a.n === hov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        const mid = (a.a0 + a.a1) / 2, rm = (ri + ro) / 2; if ((a.a1 - a.a0) * rm > fs * 3.2 && dr > fs * 1.3) text(ctx, a.n.name, cx + Math.cos(mid) * rm, cy + Math.sin(mid) * rm, { size: fs * 0.9, col: '#0b1020', align: 'center', bold: true });
      }
      ctx.fillStyle = '#0e1628'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, r0 - 2), 0, TAU); ctx.fill();
      if (r0 > fs * 2) { text(ctx, focus.name, cx, cy - fs * 0.6, { size: fs, col: '#e2e8f0', align: 'center', bold: true }); text(ctx, focus === root ? '点击扇区下钻' : '点中心返回', cx, cy + fs * 0.8, { size: fs * 0.8, col: '#64748b', align: 'center' }); }
      const val = hov ? hov.v : focus.v, pv = hov ? hov.parent.v : focus.v;
      if (hov) tip(ctx, W, H, P.x, P.y, [hov.path, `值 ${fmt(hov.v, 1)} · 占父级 ${pct(hov.v / hov.parent.v)}`], C.color);
      let leaves = 0; const cnt = (n) => { if (!n.ch.length) leaves++; n.ch.forEach(cnt); }; cnt(root);
      return { depth, leaves, path: hov ? hov.path : '（指向扇区）', val, pv, sp: val / pv, sa: val / focus.v, focus: focus === root ? '全部' : focus.path, gap: gapD, mono: yes(mono), ix: hov ? hov.path : '-' };
    };
  },
};

/* ───────────────────────── chord ───────────────────────── */
const CITY = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆'];
FAM.chord = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('旋转速度'), size: { label: '外环厚度', min: 0.4, max: 2.2, step: 0.05, value: 1 }, count: { label: '分组数', min: 3, max: 10, step: 1, value: 6, buttons: true }, extras: [R('dens', '关系密度', 0.2, 1, 0.05, 0.6), R('op', '弦不透明度', 0.1, 0.9, 0.05, 0.5), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 密集: { dens: 1 }, 稀疏: { dens: 0.3 }, 粗外环: { size: 2 }, 十组: { count: 10 }, 单色: { mono: true } },
  doc: {
    title: '和弦图 · 谁和谁之间有多少往来',
    rows: (v) => [['分组 / 弦数', `${v.n} / ${v.nc}`], ['悬停分组', v.g, 'g'], ['流出 / 流入', `${big(v.out)} / ${big(v.inn)}`, 'out'], ['最大往来对象', v.top], ['占全部往来', pct(v.share)], ['密度 / 不透明度', `${fmt(v.dens, 2)} / ${fmt(v.op, 2)}`], ['单色', v.mono]],
    formula: () => F('分组弧长 ∝ 该组流出总量 Σⱼ M[i][j]') + F('弦在 i 端的宽度 ∝ M[i][j]，在 j 端的宽度 ∝ M[j][i]') + F('弦 = 两段弧之间经过圆心附近的二次贝塞尔曲线'),
    explain: '<p><b>和弦图</b>用来展示"矩阵"型的关系，比如城市之间的人口迁徙：M[i][j] 表示从城市 i 到城市 j 的人数。</p><p>外圈每段<b>弧</b>是一个分组，弧越长它的流出总量越大；内部每条<b>弦</b>连接两个分组，弦两端的宽度分别代表两个方向的流量。</p><p>指针沿着外环转动，会高亮当前分组以及和它相连的所有弦，右侧显示它的流出、流入和最大往来对象。</p>',
    params: [['起始色相', '第一组颜色'], ['旋转速度', '整体缓慢旋转；0 = 静止'], ['外环厚度', '分组弧的厚度'], ['分组数', '矩阵大小 n×n'], ['关系密度', '矩阵中非零元素的比例'], ['弦不透明度', '弦的透明度'], ['单色', '所有分组用同一色相']],
    example: (v) => `<ol><li>${v.g} 流出总量 ${big(v.out)}，占全部 ${pct(v.share)}</li><li>所以它的弧长 = ${pct(v.share)} × 可用角度</li><li>与它往来最多的是 ${v.top}</li></ol>`,
    tip: '指针绕外环转动查看每个分组。',
  },
  build(S) {
    let key = '', M = [];
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 6)), 2, 10), dens = num(C.dens, 0.6), op = num(C.op, 0.5), mono = on(C.mono);
      const k2 = `${n}|${dens}`; if (k2 !== key) { key = k2; const r = rng(77 + n); M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i !== j && (r() < dens || j === (i + 1) % n) ? Math.round(200 + r() * 1800) : 0))); }
      const fs = fsz(W, H), cx = W / 2, cy = H / 2, Ro = Math.min(W, H) / 2 - fs * 2.4, th = clamp(Math.min(W, H) * 0.035, 6, 20) * num(C.size, 1), Ri = Ro - th;
      const out = M.map((row) => row.reduce((a, b) => a + b, 0)), tot = out.reduce((a, b) => a + b, 0), padA = 0.04, avail = TAU - padA * n, rot = t * 0.1 - Math.PI / 2;
      const g = []; let a = rot; for (let i = 0; i < n; i++) { const span = (out[i] / tot) * avail; g.push({ a0: a, a1: a + span }); a += span + padA; }
      const sub = g.map((gg, i) => { let s = gg.a0; return M[i].map((v) => { const s0 = s; s += (v / (out[i] || 1)) * (gg.a1 - gg.a0); return [s0, s]; }); });
      let pa = Math.atan2(P.y - cy, P.x - cx); let hg = -1; for (let i = 0; i < n; i++) { let q = pa; while (q < g[i].a0) q += TAU; if (q <= g[i].a1 + padA) hg = i; } if (hg < 0) hg = 0;
      const colOf = (i, al) => (mono ? hsla(hueOf(C.color), 72, 35 + (40 * i) / Math.max(1, n - 1), al) : pal(C, i, n, false, al));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if (!M[i][j] && !M[j][i]) continue; const [p0, p1] = sub[i][j], [q0, q1] = sub[j][i]; const lit = i === hg || j === hg;
        ctx.beginPath(); ctx.arc(cx, cy, Ri, p0, p1); ctx.quadraticCurveTo(cx, cy, cx + Math.cos(q0) * Ri, cy + Math.sin(q0) * Ri); ctx.arc(cx, cy, Ri, q0, q1); ctx.quadraticCurveTo(cx, cy, cx + Math.cos(p0) * Ri, cy + Math.sin(p0) * Ri); ctx.closePath();
        ctx.fillStyle = colOf(M[i][j] >= M[j][i] ? i : j, lit ? Math.min(0.95, op + 0.3) : op * 0.35); ctx.fill();
      }
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(cx, cy, Ro, g[i].a0, g[i].a1); ctx.arc(cx, cy, Ri + 1, g[i].a1, g[i].a0, true); ctx.closePath(); ctx.fillStyle = colOf(i, 1); ctx.fill(); if (i === hg) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } const m = (g[i].a0 + g[i].a1) / 2; text(ctx, CITY[i], cx + Math.cos(m) * (Ro + fs * 1.2), cy + Math.sin(m) * (Ro + fs * 1.2), { size: fs, col: i === hg ? '#fff' : '#94a3b8', align: 'center', bold: i === hg }); }
      const inn = M.reduce((s, row) => s + row[hg], 0); let tj = 0; for (let j = 0; j < n; j++) if (M[hg][j] + M[j][hg] > M[hg][tj] + M[tj][hg]) tj = j;
      let nc = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (M[i][j] || M[j][i]) nc++;
      const m = (g[hg].a0 + g[hg].a1) / 2, hx = cx + Math.cos(m) * (Ro - th / 2), hy = cy + Math.sin(m) * (Ro - th / 2);
      tip(ctx, W, H, P.x, P.y, [CITY[hg], `流出 ${big(out[hg])} · 流入 ${big(inn)}`], C.color);
      return { n, nc, g: CITY[hg], out: out[hg], inn, top: `${CITY[tj]}（${big(M[hg][tj])} → / ← ${big(M[tj][hg])}）`, share: out[hg] / tot, dens, op, mono: yes(mono), hx, hy, ix: String(hg) };
    };
  },
};

/* ───────────────────────── boxplot ───────────────────────── */
FAM.boxplot = {
  spec: { color: { label: '箱体颜色', value: '#818cf8' }, speed: SPD('数据流动速度'), size: { label: '箱体宽度', min: 0.2, max: 0.9, step: 0.05, value: 0.55 }, count: { label: '分组数', min: 2, max: 10, step: 1, value: 6, buttons: true }, extras: [R('n', '每组样本数', 10, 200, 5, 60), R('spread', '离散程度', 0.2, 2, 0.05, 1), R('out', '离群比例', 0, 0.2, 0.01, 0.04), T('pts', '显示原始点', true)], remountKeys: [] },
  presets: { 默认: {}, 少组: { count: 3 }, 多组: { count: 10, n: 40 }, 高离散: { spread: 1.8, out: 0.12 }, 只看箱: { pts: false } },
  doc: {
    title: '箱线图 · 一眼看懂分布',
    rows: (v) => [['分组 / 每组样本', `${v.g} / ${v.n}`], ['悬停分组', v.name, 'name'], ['Q1 / 中位数 / Q3', `${fmt(v.q1, 1)} / ${fmt(v.md, 1)} / ${fmt(v.q3, 1)}`, 'md'], ['四分位距 IQR', fmt(v.iqr, 1)], ['须线范围', `${fmt(v.lo, 1)} ~ ${fmt(v.hi, 1)}`], ['离群点 / 均值', `${v.no} 个 / ${fmt(v.mean, 1)}`], ['原始点', v.pts]],
    formula: () => F('排序后：Q1 = 第 25% 位置，中位数 = 第 50%，Q3 = 第 75%') + F('IQR = Q3 − Q1') + F('须线：[Q1 − 1.5·IQR, Q3 + 1.5·IQR] 内的最远点；之外为离群点'),
    explain: '<p><b>箱线图</b>用 5 个数字概括一组数据：最小、Q1、中位数、Q3、最大。中间的<b>箱子</b>装着中间一半的数据，箱中横线是中位数，两边的<b>须线</b>延伸到"正常范围"的最远点，超出的点单独画出来，就是<b>离群点</b>。</p><p>比起只看平均值，箱线图能同时看出数据的中心、分散程度和有没有异常值。左边的散点是原始数据（横向随机抖开，方便看清）。</p><p>数据在缓慢流动，四分位数会实时更新；指针移到哪一组，就显示它的统计量。</p>',
    params: [['箱体颜色', '第一组颜色，其它组色相偏移'], ['数据流动速度', '样本缓慢变化；0 = 静止'], ['箱体宽度', '箱子占每组宽度的比例'], ['分组数', '几组数据并排比较'], ['每组样本数', '每组多少个数据点'], ['离散程度', '数据的标准差倍数'], ['离群比例', '人为混入异常值的比例'], ['显示原始点', '在箱子旁画出每个样本']],
    example: (v) => `<ol><li>${v.name}：Q1 = ${fmt(v.q1, 1)}，Q3 = ${fmt(v.q3, 1)}</li><li>IQR = ${fmt(v.q3, 1)} − ${fmt(v.q1, 1)} = ${fmt(v.iqr, 1)}</li><li>上限 = Q3 + 1.5×IQR = ${fmt(v.q3 + 1.5 * v.iqr, 1)}，超过它的 ${v.no} 个点算离群</li></ol>`,
    tip: '调大"离群比例"，看须线外冒出的点。',
  },
  build(S) {
    const r = rng(41); const pool = Array.from({ length: 10 }, (_, gi) => ({ mu: 40 + r() * 30, sd: 5 + r() * 8, z: Array.from({ length: 200 }, () => ({ z: gauss(r), o: r(), os: r() < 0.5 ? -1 : 1, jx: r() - 0.5, ph: r() * TAU })) }));
    const q = (a, p) => { const i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(a.length - 1, lo + 1)] - a[lo]) * (i - lo); };
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const G = clamp(Math.round(num(C.count, 6)), 1, 10), n = clamp(Math.round(num(C.n, 60)), 5, 200), sp = num(C.spread, 1), po = num(C.out, 0.04), pts = on(C.pts), bw = num(C.size, 0.55);
      const fs = fsz(W, H), ml = fs * 3, mr = fs, mt = fs, mb = fs * 2.2, pw = W - ml - mr, ph = H - mt - mb, gw = pw / G;
      const Y = (v) => mt + ph - (v / 110) * ph;
      for (let k = 0; k <= 100; k += 20) { ctx.strokeStyle = 'rgba(148,163,184,.13)'; ctx.beginPath(); ctx.moveTo(ml, Y(k)); ctx.lineTo(ml + pw, Y(k)); ctx.stroke(); text(ctx, String(k), ml - fs * 0.5, Y(k), { size: fs * 0.85, col: '#64748b', align: 'right' }); }
      const hg = clamp(Math.floor((P.x - ml) / gw), 0, G - 1); let res = null;
      for (let gi = 0; gi < G; gi++) {
        const g = pool[gi], cx = ml + (gi + 0.5) * gw, col = pal(C, gi, G, false), lit = gi === hg;
        const vals = g.z.slice(0, n).map((s) => { let v = g.mu + g.sd * sp * (s.z + 0.35 * Math.sin(t * 0.8 + s.ph)); if (s.o < po) v = g.mu + s.os * g.sd * sp * (3.2 + s.o * 20); return { v: clamp(v, 0, 110), jx: s.jx }; });
        const sorted = vals.map((d) => d.v).sort((a, b) => a - b); const q1 = q(sorted, 0.25), md = q(sorted, 0.5), q3 = q(sorted, 0.75), iqr = q3 - q1, lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
        const lo = sorted.find((v) => v >= lf), hi = [...sorted].reverse().find((v) => v <= uf); const outs = sorted.filter((v) => v < lf || v > uf);
        const w = gw * bw;
        if (lit) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(ml + gi * gw, mt, gw, ph); }
        if (pts) for (const d of vals) { if (d.v < lf || d.v > uf) continue; ctx.fillStyle = pal(C, gi, G, false, 0.45); ctx.beginPath(); ctx.arc(cx + d.jx * w * 0.9, Y(d.v), 1.6, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, Y(hi)); ctx.lineTo(cx, Y(q3)); ctx.moveTo(cx, Y(q1)); ctx.lineTo(cx, Y(lo)); ctx.moveTo(cx - w * 0.25, Y(hi)); ctx.lineTo(cx + w * 0.25, Y(hi)); ctx.moveTo(cx - w * 0.25, Y(lo)); ctx.lineTo(cx + w * 0.25, Y(lo)); ctx.stroke();
        ctx.fillStyle = pal(C, gi, G, false, lit ? 0.6 : 0.35); rrect(ctx, cx - w / 2, Y(q3), w, Y(q1) - Y(q3), 4); ctx.fill(); ctx.strokeStyle = lit ? '#fff' : col; ctx.lineWidth = lit ? 2.2 : 1.6; ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - w / 2, Y(md)); ctx.lineTo(cx + w / 2, Y(md)); ctx.stroke();
        for (const v of outs) { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, Y(v), 3.2, 0, TAU); ctx.stroke(); }
        text(ctx, `组 ${String.fromCharCode(65 + gi)}`, cx, H - fs * 1, { size: fs * 0.9, col: lit ? '#fff' : '#94a3b8', align: 'center', bold: lit });
        if (lit) res = { q1, md, q3, iqr, lo, hi, no: outs.length, mean: sorted.reduce((a, b) => a + b, 0) / sorted.length, cx, w };
      }
      tip(ctx, W, H, res.cx + res.w / 2, Y(res.md), [`组 ${String.fromCharCode(65 + hg)}`, `中位数 ${fmt(res.md, 1)}`, `IQR ${fmt(res.iqr, 1)} · 离群 ${res.no}`], C.color);
      return { g: G, n, name: `组 ${String.fromCharCode(65 + hg)}`, ...res, pts: yes(pts), hx: res.cx, hy: Y(res.md), ix: String(hg) };
    };
  },
};

/* ───────────────────────── parallel coordinates ───────────────────────── */
const PAX = ['价格', '续航', '重量', '性能', '屏幕', '评分', '销量', '保修'];
FAM.parallel = {
  spec: { color: { label: '选中线颜色', value: '#22d3ee' }, speed: SPD('数据漂移速度'), size: { label: '线条粗细', min: 0.5, max: 3, step: 0.1, value: 1.2 }, count: { label: '坐标轴数', min: 3, max: 8, step: 1, value: 5, buttons: true }, extras: [R('n', '数据条数', 20, 300, 10, 120), R('bw', '刷选区间高度', 0.06, 0.6, 0.01, 0.22), T('only', '只显示选中', false)], remountKeys: [] },
  presets: { 默认: {}, 多轴: { count: 8 }, 少轴: { count: 3 }, 窄刷选: { bw: 0.08 }, 只显选中: { only: true }, 少数据: { n: 30, size: 2.2 } },
  doc: {
    title: '平行坐标 · 多维数据 + 刷选过滤',
    rows: (v) => [['坐标轴 / 数据条数', `${v.k} / ${v.n}`], ['刷选轴', v.ax, 'ax'], ['刷选区间', v.rg, 'rg'], ['选中条数', `${v.sel}（${pct(v.sel / v.n)}）`, 'sel'], ['选中的平均值（各轴）', v.avg], ['只显示选中', v.only]],
    formula: () => F('每个维度一根竖轴：y = 轴底 − (值 − min) / (max − min) × 轴高') + F('一条数据 = 依次连接它在各轴上的点的折线') + F('刷选：保留在所选轴上 值 ∈ [下界, 上界] 的折线'),
    explain: '<p>当数据有很多维度（价格、续航、重量…）时，普通坐标系只能画两个。<b>平行坐标</b>把每个维度画成一根<b>竖直的轴</b>，一条数据就是穿过所有轴的一条折线。</p><p>看相邻两轴之间的线：大多平行说明两个维度<b>正相关</b>，大多交叉成 X 形说明<b>负相关</b>。</p><p>指针靠近哪根轴，就在那根轴上以指针为中心"<b>刷选</b>"一段区间，只有穿过这段区间的折线会被点亮，右侧显示选中了多少条以及它们在各轴上的平均值。</p>',
    params: [['选中线颜色', '被刷选中的折线颜色'], ['数据漂移速度', '数据缓慢变化；0 = 静止'], ['线条粗细', '折线宽度'], ['坐标轴数', '显示几个维度'], ['数据条数', '折线数量'], ['刷选区间高度', '刷选框占轴高的比例'], ['只显示选中', '隐藏未选中的折线']],
    example: (v) => `<ol><li>在 "${v.ax}" 轴上刷选 ${v.rg}</li><li>${v.n} 条数据中有 ${v.sel} 条落在区间内</li><li>选中占比 = ${v.sel} / ${v.n} = ${pct(v.sel / v.n)}</li></ol>`,
    tip: '把指针放到某根轴上下移动，看哪些数据被筛出来。',
  },
  build(S) {
    const r = rng(51); const pool = Array.from({ length: 300 }, () => { const a = gauss(r), b = gauss(r); return { z: PAX.map((_, i) => clamp(0.5 + 0.17 * (i % 2 ? -a : a) * (i % 3 === 2 ? 0.3 : 1) + 0.13 * (i % 3 === 2 ? b : gauss(r) * 0.6), 0.02, 0.98)), ph: r() * TAU }; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const k = clamp(Math.round(num(C.count, 5)), 2, 8), n = clamp(Math.round(num(C.n, 120)), 5, 300), bw = num(C.bw, 0.22), only = on(C.only), lw = num(C.size, 1.2);
      const fs = fsz(W, H), ml = fs * 2.6, mr = fs * 2.6, mt = fs * 2.2, mb = fs * 1.6, ah = H - mt - mb, dx = (W - ml - mr) / (k - 1);
      const AX = (i) => ml + i * dx, Y = (v) => mt + ah - v * ah;
      const ha = clamp(Math.round((P.x - ml) / dx), 0, k - 1); const bc = clamp((mt + ah - P.y) / ah, bw / 2, 1 - bw / 2), b0 = bc - bw / 2, b1 = bc + bw / 2;
      const rows = pool.slice(0, n).map((d) => d.z.slice(0, k).map((v, i) => clamp(v + 0.04 * Math.sin(t * 0.6 + d.ph + i), 0, 1)));
      const sel = rows.map((row) => row[ha] >= b0 && row[ha] <= b1);
      const line = (row) => { ctx.beginPath(); row.forEach((v, i) => (i ? ctx.lineTo(AX(i), Y(v)) : ctx.moveTo(AX(i), Y(v)))); ctx.stroke(); };
      ctx.lineWidth = lw; if (!only) { ctx.strokeStyle = 'rgba(148,163,184,.13)'; rows.forEach((row, i) => !sel[i] && line(row)); }
      ctx.strokeStyle = pal(C, 0, 1, false, 0.6); rows.forEach((row, i) => sel[i] && line(row));
      for (let i = 0; i < k; i++) { ctx.strokeStyle = i === ha ? '#fff' : 'rgba(203,213,225,.55)'; ctx.lineWidth = i === ha ? 2 : 1.2; ctx.beginPath(); ctx.moveTo(AX(i), mt); ctx.lineTo(AX(i), mt + ah); ctx.stroke(); text(ctx, PAX[i], AX(i), mt - fs * 1.1, { size: fs, col: i === ha ? '#fff' : '#94a3b8', align: 'center', bold: i === ha }); text(ctx, '高', AX(i) + 4, mt + fs * 0.4, { size: fs * 0.75, col: '#475569' }); text(ctx, '低', AX(i) + 4, mt + ah - fs * 0.4, { size: fs * 0.75, col: '#475569' }); }
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = C.color; ctx.lineWidth = 1.5; rrect(ctx, AX(ha) - fs * 0.8, Y(b1), fs * 1.6, Y(b0) - Y(b1), 4); ctx.fill(); ctx.stroke();
      const ns = sel.filter(Boolean).length; const avg = []; for (let i = 0; i < k; i++) { let s = 0; rows.forEach((row, j) => { if (sel[j]) s += row[i]; }); avg.push(ns ? Math.round((s / ns) * 100) : 0); }
      tip(ctx, W, H, AX(ha) + fs, Y(bc), [`${PAX[ha]} ∈ [${Math.round(b0 * 100)}, ${Math.round(b1 * 100)}]`, `选中 ${ns} / ${n} 条`], C.color);
      return { k, n, ax: PAX[ha], rg: `${Math.round(b0 * 100)} ~ ${Math.round(b1 * 100)}`, sel: ns, avg: avg.join(' · '), only: yes(only), hx: AX(ha), hy: Y(bc), ix: `${ha},${Math.round(bc * 100)}` };
    };
  },
};

/* ───────────────────────── stream graph ───────────────────────── */
const GEN = ['摇滚', '流行', '电子', '爵士', '民谣', '说唱', '古典', '乡村', '蓝调', '雷鬼'];
const BASES = ['零基线（普通堆叠）', '对称（剪影）', '加权居中（摆动最小）'];
FAM.stream = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('时间滚动速度'), size: { label: '波动幅度', min: 0.2, max: 2, step: 0.05, value: 1 }, count: { label: '图层数', min: 2, max: 10, step: 1, value: 6, buttons: true }, extras: [R('base', '基线模式', 0, 2, 1, 2), R('win', '时间窗口（点数）', 20, 120, 5, 60), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 多层: { count: 10 }, 少层: { count: 3 }, 高波动: { size: 1.9 }, 零基线: { base: 0 }, 单色: { mono: true } },
  doc: {
    title: '流图 · 随时间变化的堆叠面积',
    rows: (v) => [['图层 / 时间点', `${v.n} / ${v.win}`], ['基线模式', v.bm, 'bm'], ['悬停时间点', v.tx, 'tx'], ['悬停图层', v.layer, 'layer'], ['该层数值', fmt(v.lv, 1), 'lv'], ['该时刻总量', fmt(v.tot, 1)], ['该层占比', pct(v.share)]],
    formula: () => F('堆叠：第 i 层下边 yᵢ = g₀ + Σ_{j<i} fⱼ，上边 = yᵢ + fᵢ') + F('对称基线 g₀ = −½ Σ fⱼ') + F('加权居中 g₀ = −Σ (n − i + ½)·fᵢ / n'),
    explain: '<p><b>流图</b>（Streamgraph）是堆叠面积图的变体：每一层是一个类别（比如音乐流派的播放量），横轴是时间，每层的<b>厚度</b>就是它当时的数值，所有层加起来的总厚度就是总量。</p><p>不同的<b>基线</b>决定整条"河流"摆在哪里：零基线从底部往上堆（最容易读总量）；对称基线让河流沿中线左右对称；加权居中让每一层的上下摆动尽量小，看起来最平滑。</p><p>时间在不断向左滚动；指针放在某个时刻、某一层上，右侧显示它的数值和占比。</p>',
    params: [['起始色相', '第一层的颜色'], ['时间滚动速度', '0 = 静止'], ['波动幅度', '各层数值的起伏程度'], ['图层数', '类别个数'], ['基线模式', '0 零基线 · 1 对称 · 2 加权居中'], ['时间窗口（点数）', '横轴显示多少个时间点'], ['单色', '只用一个色相']],
    example: (v) => `<ol><li>时刻 ${v.tx}，"${v.layer}" = ${fmt(v.lv, 1)}</li><li>该时刻所有层总量 = ${fmt(v.tot, 1)}</li><li>占比 = ${fmt(v.lv, 1)} / ${fmt(v.tot, 1)} = ${pct(v.share)}，即这一层占河流宽度的 ${pct(v.share)}</li></ol>`,
    tip: '切换基线模式，比较同一份数据的三种摆法。',
  },
  build(S) {
    const r = rng(61); const L = GEN.map(() => ({ f: [0.05 + r() * 0.1, 0.1 + r() * 0.15, 0.2 + r() * 0.3], p: [r() * TAU, r() * TAU, r() * TAU], b: 0.6 + r() }));
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 6)), 1, 10), win = clamp(Math.round(num(C.win, 60)), 10, 200), bm = clamp(Math.round(num(C.base, 2)), 0, 2), amp = num(C.size, 1), mono = on(C.mono);
      const fs = fsz(W, H), mb = fs * 2, mt = fs * 0.6, ph = H - mt - mb, sx = W / (win - 1), off = t * 2.2;
      const val = (i, x) => { const l = L[i]; let v = l.b; for (let k = 0; k < 3; k++) v += amp * 0.55 * Math.sin((x + off) * l.f[k] + l.p[k]); return Math.max(0.05, v + amp * 0.6); };
      const cols = []; let mxT = 0;
      for (let x = 0; x < win; x++) { const f = []; let s = 0; for (let i = 0; i < n; i++) { f.push(val(i, x)); s += f[i]; } let g0 = 0; if (bm === 1) g0 = -s / 2; else if (bm === 2) { for (let i = 0; i < n; i++) g0 -= (n - i - 0.5) * f[i]; g0 /= n; } cols.push({ f, s, g0 }); }
      let lo = 1e9, hi = -1e9; for (const c of cols) { lo = Math.min(lo, c.g0); hi = Math.max(hi, c.g0 + c.s); mxT = Math.max(mxT, c.s); }
      const Y = (v) => mt + ph - ((v - lo) / (hi - lo || 1)) * ph;
      const hx = clamp(Math.round(P.x / sx), 0, win - 1); let hl = -1;
      { const c = cols[hx]; let y = c.g0; for (let i = 0; i < n; i++) { if (P.y <= Y(y) && P.y >= Y(y + c.f[i])) hl = i; y += c.f[i]; } }
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        for (let x = 0; x < win; x++) { const c = cols[x]; let y = c.g0; for (let j = 0; j < i; j++) y += c.f[j]; const yy = Y(y + c.f[i]); x ? ctx.lineTo(x * sx, yy) : ctx.moveTo(0, yy); }
        for (let x = win - 1; x >= 0; x--) { const c = cols[x]; let y = c.g0; for (let j = 0; j < i; j++) y += c.f[j]; ctx.lineTo(x * sx, Y(y)); }
        ctx.closePath(); ctx.fillStyle = mono ? hsla(hueOf(C.color), 72, 30 + (40 * i) / Math.max(1, n - 1), hl >= 0 && hl !== i ? 0.45 : 0.95) : pal(C, i, n, false, hl >= 0 && hl !== i ? 0.4 : 0.92); ctx.fill();
        if (i === hl) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.stroke(); }
      }
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx * sx, mt); ctx.lineTo(hx * sx, mt + ph); ctx.stroke();
      for (let x = 0; x < win; x += Math.ceil(win / 8)) text(ctx, `t${Math.floor(x + off)}`, x * sx + 2, H - fs * 0.9, { size: fs * 0.8, col: '#64748b' });
      const c = cols[hx], li = hl >= 0 ? hl : 0;
      tip(ctx, W, H, P.x, P.y, [`时刻 t${Math.floor(hx + off)}`, hl >= 0 ? `${GEN[hl]}：${fmt(c.f[hl], 1)}（${pct(c.f[hl] / c.s)}）` : `总量 ${fmt(c.s, 1)}`], C.color);
      return { n, win, bm: BASES[bm], tx: `t${Math.floor(hx + off)}`, layer: hl >= 0 ? GEN[hl] : `（未指向层，显示 ${GEN[0]}）`, lv: c.f[li], tot: c.s, share: c.f[li] / c.s, ix: `${hx},${hl}` };
    };
  },
};

/* ───────────────────────── word cloud ───────────────────────── */
const WORDS = ['可视化', '数据', '图表', 'Canvas', 'SVG', '动画', '交互', '布局', '颜色', '维度', '趋势', '分布', '相关', '聚类', '层级', '网络', '地图', '时间', '比例', '对比', '热力', '散点', '折线', '柱状', '饼图', '雷达', '桑基', '漏斗', '箱线', '词云', 'D3', 'ECharts', 'WebGL', '像素', '缩放', '刷选', '图例', '坐标', '刻度', '标签', '统计', '均值', '方差', '中位数', '回归', '采样', '过滤', '排序', '分组', '叠加', '渐变', '透明', '高亮', '悬停', '拖拽', '实时', '流式', '仪表盘', '故事', '洞察'];
const MAPS = ['线性', '平方根', '对数'];
FAM.wordcloud = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('悬浮摆动速度'), size: { label: '字号缩放', min: 0.5, max: 1.6, step: 0.05, value: 1 }, count: { label: '词数', min: 10, max: 60, step: 1, value: 36 }, extras: [R('rot', '竖排比例', 0, 0.6, 0.05, 0.2), R('map', '字号映射', 0, 2, 1, 1), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 密: { count: 60, size: 0.8 }, 疏: { count: 14, size: 1.4 }, 线性映射: { map: 0 }, 全横排: { rot: 0 }, 单色: { mono: true } },
  doc: {
    title: '词云 · 字越大出现越多',
    rows: (v) => [['词数 / 已放下', `${v.n} / ${v.placed}`], ['悬停词', v.w, 'w'], ['出现次数', String(v.f), 'f'], ['字号', `${fmt(v.px, 1)} px`], ['字号映射', v.map], ['竖排比例', pct(v.rot, 0)], ['画面利用率', pct(v.fill)]],
    formula: () => F('词频服从齐普夫定律：第 k 名的次数 ≈ f₁ / k') + F('字号 = 最小 + (最大 − 最小) × m(f)，m 为线性 / √ / log 映射') + F('阿基米德螺线放置：r = a·θ，沿螺线找第一个不重叠的位置'),
    explain: '<p><b>词云</b>把文本里出现次数多的词画得大，次数少的画得小，快速告诉你"这段文字主要在说什么"。</p><p>摆放方法：从出现最多的词开始，先放在中心；后面的词沿着一条<b>阿基米德螺线</b>一圈圈往外找，直到找到一个不和已放的词<b>重叠</b>的位置。</p><p>字号映射很关键：线性映射会让第一名特别大、其它都很小；平方根或对数映射更均衡。指针悬停任意词查看它的次数和字号。</p>',
    params: [['起始色相', '颜色从这个色相开始轮换'], ['悬浮摆动速度', '词轻微上下浮动；0 = 静止'], ['字号缩放', '整体字号倍数'], ['词数', '显示多少个词'], ['竖排比例', '旋转 90° 竖排的词所占比例'], ['字号映射', '0 线性 · 1 平方根 · 2 对数'], ['单色', '只用一个色相']],
    example: (v) => `<ol><li>"${v.w}" 出现 ${v.f} 次（第一名 ${v.f1} 次）</li><li>${v.map}映射 m = ${fmt(v.m, 3)}</li><li>字号 = ${fmt(v.px, 1)} px</li></ol>`,
    tip: '切换字号映射比较大小差异；悬停查看每个词。',
  },
  build(S) {
    let key = '', placed = [], fillR = 0;
    const layout = (n, sc, rot, map, W, H) => {
      const r = rng(71); const fs = []; for (let k = 0; k < n; k++) fs.push(Math.round(240 / (k + 1) + r() * 6 + 2));
      const f1 = fs[0], fm = fs[n - 1]; const m = (f) => (map === 0 ? (f - fm) / (f1 - fm || 1) : map === 1 ? (Math.sqrt(f) - Math.sqrt(fm)) / (Math.sqrt(f1) - Math.sqrt(fm) || 1) : (Math.log(f) - Math.log(fm)) / (Math.log(f1) - Math.log(fm) || 1));
      const base = Math.min(W, H) / 400; const out = []; const ctx = S.ctx;
      for (let k = 0; k < n; k++) {
        const px = (10 + 46 * m(fs[k])) * base * sc; ctx.font = `600 ${px}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`; const tw = ctx.measureText(WORDS[k]).width; const vert = k > 0 && r() < rot;
        const bw = (vert ? px : tw) + 4, bh = (vert ? tw : px) + 2; let ok = false;
        for (let th = 0; th < 260 && !ok; th += 0.12) { const rr = 2.2 * base * th; const x = W / 2 + rr * Math.cos(th) * (W / H > 1 ? 1.4 : 0.8) - bw / 2, y = H / 2 + rr * Math.sin(th) - bh / 2; if (x < 2 || y < 2 || x + bw > W - 2 || y + bh > H - 2) continue; if (out.every((o) => x + bw < o.x || o.x + o.w < x || y + bh < o.y || o.y + o.h < y)) { out.push({ k, x, y, w: bw, h: bh, px, vert, f: fs[k], m: m(fs[k]), ph: r() * TAU }); ok = true; } }
      }
      placed = out; fillR = out.reduce((a, o) => a + o.w * o.h, 0) / (W * H); placed.f1 = f1;
    };
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 36)), 3, WORDS.length), sc = num(C.size, 1), rot = num(C.rot, 0.2), map = clamp(Math.round(num(C.map, 1)), 0, 2), mono = on(C.mono);
      const k2 = `${n}|${sc}|${rot}|${map}|${W}|${H}`; if (k2 !== key) { key = k2; layout(n, sc, rot, map, W, H); }
      let bx0 = W, by0 = H, bx1 = 0, by1 = 0; for (const o of placed) { bx0 = Math.min(bx0, o.x); by0 = Math.min(by0, o.y); bx1 = Math.max(bx1, o.x + o.w); by1 = Math.max(by1, o.y + o.h); }
      const zs = placed.length ? clamp(Math.min((W - 16) / (bx1 - bx0), (H - 16) / (by1 - by0)), 0.5, 2.4) : 1, ox = W / 2 - ((bx0 + bx1) / 2) * zs, oy = H / 2 - ((by0 + by1) / 2) * zs;
      const qx = (P.x - ox) / zs, qy = (P.y - oy) / zs;
      let hv = null; for (const o of placed) if (qx >= o.x && qx <= o.x + o.w && qy >= o.y && qy <= o.y + o.h) hv = o;
      { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6); g.addColorStop(0, hsla(hueOf(C.color), 70, 50, 0.16)); g.addColorStop(1, hsla(hueOf(C.color), 70, 50, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      ctx.save(); ctx.translate(ox, oy); ctx.scale(zs, zs);
      for (const o of placed) {
        const bob = Math.sin(t * 1.4 + o.ph) * 1.5, cx = o.x + o.w / 2, cy = o.y + o.h / 2 + bob, s = o === hv ? 1.12 : 1;
        ctx.save(); ctx.translate(cx, cy); if (o.vert) ctx.rotate(-Math.PI / 2); ctx.scale(s, s);
        const col = mono ? hsla(hueOf(C.color), 75, 35 + 40 * o.m) : pal(C, o.k % 7, 7, false, 1, 55 + 15 * o.m);
        text(ctx, WORDS[o.k], 0, 0, { size: o.px, col: hv && o !== hv ? col.replace(/,1\)$/, ',.45)') : col, align: 'center', bold: true }); ctx.restore();
      }
      if (hv) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1 / zs; ctx.strokeRect(hv.x, hv.y, hv.w, hv.h); } ctx.restore();
      if (hv) { tip(ctx, W, H, P.x, P.y, [WORDS[hv.k], `出现 ${hv.f} 次 · ${fmt(hv.px * zs, 0)} px`], C.color); } else cross(ctx, P, W, H);
      const o = hv || placed[0] || { k: 0, f: 0, px: 0, m: 0 };
      return { n, placed: placed.length, w: hv ? WORDS[hv.k] : `（未悬停，显示 ${WORDS[o.k]}）`, f: o.f, px: o.px * zs, m: o.m, f1: placed.f1, map: MAPS[map], rot, fill: fillR * zs * zs, ix: hv ? String(hv.k) : '-' };
    };
  },
};

/* ───────────────────────── hierarchy (indented tree) ───────────────────────── */
FAM.hierarchy = {
  spec: { color: { label: '数值条颜色', value: '#818cf8' }, speed: SPD('自动展开节奏'), size: { label: '行高', min: 0.6, max: 1.6, step: 0.05, value: 1 }, count: { label: '层级深度', min: 1, max: 4, step: 1, value: 3, buttons: true }, extras: [R('ind', '缩进 px', 8, 40, 2, 18), T('bars', '数值条', true), T('auto', '自动展开/折叠', true)], remountKeys: [] },
  presets: { 默认: {}, 深: { count: 4 }, 浅: { count: 2 }, 大缩进: { ind: 34 }, 无数值条: { bars: false }, 手动: { auto: false } },
  doc: {
    title: '层级列表 · 可折叠的树',
    rows: (v) => [['节点总数 / 可见行', `${v.tot} / ${v.vis}`], ['悬停行', v.path, 'path'], ['数值', fmt(v.val, 1), 'val'], ['占父级 / 占整体', `${pct(v.sp)} / ${pct(v.sa)}`], ['所在层级', `第 ${v.d} 层`], ['缩进 / 数值条 / 自动', `${v.ind}px / ${v.bars} / ${v.auto}`]],
    formula: () => F('行顺序 = 树的前序遍历（先父后子）') + F('x 缩进 = 层级 d × 缩进宽度') + F('父节点值 = Σ 子节点值；数值条长度 = 值 / 根值'),
    explain: '<p>文件夹、组织架构、目录都是<b>树</b>。最常见的展示方式就是<b>缩进列表</b>：子节点排在父节点下面，并且往右缩进一格，▶ / ▼ 表示可以展开或折叠。</p><p>每行右边的<b>数值条</b>表示它占整体的比例（比如文件夹大小），父节点的值等于所有孩子之和，所以展开后孩子的条加起来正好等于父亲的条。</p><p><b>点击</b>带三角的行展开/折叠；打开"自动展开"时会自己轮流演示。指针悬停查看路径和占比。</p>',
    params: [['数值条颜色', '数值条与高亮颜色'], ['自动展开节奏', '自动展开/折叠的快慢；0 = 停止'], ['行高', '每行高度倍数'], ['层级深度', '树的层数'], ['缩进 px', '每深一层向右缩进多少'], ['数值条', '显示数值比例条'], ['自动展开/折叠', '自动演示折叠动画']],
    example: (v) => `<ol><li>"${v.path}" 值 ${fmt(v.val, 1)}</li><li>它的父节点值 ${fmt(v.pv, 1)}，占父级 ${pct(v.sp)}</li><li>位于第 ${v.d} 层，所以缩进 ${v.d} × ${v.ind} = ${v.d * v.ind} px</li></ol>`,
    tip: '点击 ▶ 行展开；关掉"自动展开"后完全手动控制。',
  },
  build(S) {
    let key = '', root = null, all = [], hov = null, acc = 0, ai = 0, rows = [];
    S.onDown(() => { if (hov && hov.ch.length) hov.open = !hov.open; });
    return ({ ctx, W, H, dt, t, C, P }) => {
      S.clear();
      const depth = clamp(Math.round(num(C.count, 3)), 1, 4), ind = num(C.ind, 18), bars = on(C.bars), auto = on(C.auto), rhK = num(C.size, 1);
      if (`${depth}` !== key) { key = `${depth}`; root = makeTree(depth, 3, 91); all = []; const link = (n, p) => { n.parent = p; n.open = n.d < 2; n.y = 0; all.push(n); n.ch.forEach((c) => link(c, n)); }; link(root, null); root.open = true; }
      sumTree(root, t, 0.12);
      if (auto) { acc += dt; if (acc > 1.6) { acc = 0; const cand = all.filter((n) => n.ch.length && n !== root); if (cand.length) { const n = cand[ai++ % cand.length]; n.open = !n.open; } } }
      rows = []; const walk = (n) => { rows.push(n); if (n.open) n.ch.forEach(walk); }; walk(root);
      const fs = fsz(W, H), mt = fs * 0.6; const rh = Math.max(8, Math.min((H - mt * 2) / rows.length, fs * 3 * rhK));
      const fsr = clamp(rh * 0.5, 9, 14) * Math.min(1.15, rhK);
      hov = null; const k = 1 - Math.exp(-(dt > 0 ? Math.max(dt, 1 / 60) : 0) * 10);
      const barX = W * 0.5, barW = W * 0.5 - fs * 4;
      rows.forEach((n, i) => {
        const ty = mt + i * rh; n.y = n.y ? n.y + (ty - n.y) * (k || 1) : ty; const y = n.y;
        if (P.y >= y && P.y < y + rh) hov = n;
        if (i % 2) { ctx.fillStyle = 'rgba(148,163,184,.04)'; ctx.fillRect(0, y, W, rh); }
        const x = fs + n.d * ind;
        if (n.ch.length) text(ctx, n.open ? '▼' : '▶', x, y + rh / 2, { size: fsr * 0.8, col: '#94a3b8' });
        text(ctx, n.d === 0 ? '全部（根）' : n.name, x + fsr * 1.3, y + rh / 2, { size: fsr, col: n === hov ? '#fff' : n.d ? '#cbd5e1' : '#f1f5f9', bold: !n.d || n === hov });
        ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.lineWidth = 1; if (n.d) { ctx.beginPath(); ctx.moveTo(fs + (n.d - 1) * ind + fsr * 0.35, y + rh / 2); ctx.lineTo(x - 3, y + rh / 2); ctx.stroke(); }
        if (bars) { const w = (n.v / root.v) * barW; ctx.fillStyle = 'rgba(148,163,184,.1)'; rrect(ctx, barX, y + rh * 0.25, barW, rh * 0.5, rh * 0.2); ctx.fill(); ctx.fillStyle = pal(C, 0, 1, false, n === hov ? 1 : 0.55 + 0.4 * (1 - n.d / 4)); rrect(ctx, barX, y + rh * 0.25, Math.max(2, w), rh * 0.5, rh * 0.2); ctx.fill(); }
        text(ctx, fmt(n.v, 1), W - fs * 0.6, y + rh / 2, { size: fsr * 0.9, col: '#94a3b8', align: 'right' });
      });
      if (hov) { ctx.strokeStyle = C.color; ctx.lineWidth = 1.5; ctx.strokeRect(1, hov.y + 1, W - 2, rh - 2); }
      const h = hov || root, pv = h.parent ? h.parent.v : h.v;
      if (hov) tip(ctx, W, H, P.x, P.y, [hov.path || '全部', `值 ${fmt(hov.v, 1)} · 占父级 ${pct(hov.v / pv)}`], C.color);
      return { tot: all.length, vis: rows.length, path: h.path || '全部（根）', val: h.v, pv, sp: h.v / pv, sa: h.v / root.v, d: h.d, ind, bars: yes(bars), auto: yes(auto), hy: hov ? hov.y + rh / 2 : P.y, ix: `${rows.indexOf(h)}:${rows.length}` };
    };
  },
};

/* ───────────────────────── funnel ───────────────────────── */
const STG = ['访问', '注册', '激活', '加购', '下单', '支付', '复购', '推荐'];
FAM.funnel = {
  spec: { color: { label: '漏斗颜色', value: '#818cf8' }, speed: SPD('用户流动速度'), size: { label: '漏斗宽度', min: 0.35, max: 1, step: 0.01, value: 0.85 }, count: { label: '阶段数', min: 3, max: 8, step: 1, value: 5, buttons: true }, extras: [R('rate', '平均转化率', 0.3, 0.95, 0.01, 0.62), R('gap', '层间距 px', 0, 14, 1, 4), T('mono', '单色', true)], remountKeys: [] },
  presets: { 默认: {}, 陡峭: { rate: 0.38 }, 平缓: { rate: 0.9 }, 八阶段: { count: 8 }, 窄漏斗: { size: 0.45 }, 彩色: { mono: false } },
  doc: {
    title: '转化漏斗 · 每一步流失多少',
    rows: (v) => [['阶段数', String(v.n)], ['悬停阶段', v.st, 'st'], ['该阶段人数', big(v.cnt), 'cnt'], ['上一步 → 本步转化', pct(v.step)], ['从第一步累计转化', pct(v.cum)], ['本步流失人数', big(v.lost)], ['整体转化', pct(v.all)]],
    formula: () => F('第 k 步人数 Nₖ = Nₖ₋₁ × pₖ（pₖ 为单步转化率）') + F('累计转化 = Nₖ / N₁ = p₂ × p₃ × … × pₖ') + F('梯形宽度 ∝ 人数'),
    explain: '<p><b>漏斗图</b>展示用户一步步完成目标的过程：从访问网站，到注册、激活、下单、支付…每一步都会有人离开，所以越往下越窄，像个漏斗。</p><p>最重要的两个数字：<b>单步转化率</b>（这一步留下了上一步的百分之多少）和<b>累计转化率</b>（相对于最开始还剩多少）。累计转化是所有单步转化率<b>连乘</b>，所以即使每步都有 60%，五步之后也只剩 13%。</p><p>小点代表用户往下流动，被侧面甩出去的就是流失。指针悬停任意一层查看数据。</p>',
    params: [['漏斗颜色', '各层颜色从此色开始'], ['用户流动速度', '小点下落速度；0 = 静止'], ['漏斗宽度', '最上层宽度占画布的比例'], ['阶段数', '漏斗有几层'], ['平均转化率', '每一步大约保留多少用户'], ['层间距 px', '层与层之间的留白'], ['单色', '关闭后每层不同色相']],
    example: (v) => `<ol><li>${v.st}：${big(v.cnt)} 人</li><li>单步转化 ${pct(v.step)}，即上一步 ${big(v.prev)} × ${pct(v.step)} = ${big(v.cnt)}</li><li>累计转化 ${pct(v.cum)}，流失 ${big(v.lost)} 人</li></ol>`,
    tip: '把平均转化率调低，看漏斗变得多陡。',
  },
  build(S) {
    const r0 = rng(81); const jit = STG.map(() => (r0() - 0.5) * 0.18); let parts = [];
    return ({ ctx, W, H, dt, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 5)), 2, 8), rate = num(C.rate, 0.62), gap = num(C.gap, 4), mono = on(C.mono), wk = num(C.size, 0.85);
      const N = [10000]; const p = [1]; for (let k = 1; k < n; k++) { p.push(clamp(rate + jit[k], 0.05, 0.99)); N.push(N[k - 1] * p[k]); }
      const fs = fsz(W, H), mt = fs * 0.8, mb = fs * 0.8, lh = (H - mt - mb - gap * (n - 1)) / n, cx = W * 0.46, Wm = W * 0.62 * wk;
      const wOf = (k) => Math.max(fs * 2, Wm * Math.sqrt(N[k] / N[0]));
      const hk = clamp(Math.floor((P.y - mt) / (lh + gap)), 0, n - 1);
      for (let k = 0; k < n; k++) {
        const y = mt + k * (lh + gap), w0 = wOf(k), w1 = k < n - 1 ? wOf(k + 1) : w0 * 0.85;
        ctx.beginPath(); ctx.moveTo(cx - w0 / 2, y); ctx.lineTo(cx + w0 / 2, y); ctx.lineTo(cx + w1 / 2, y + lh); ctx.lineTo(cx - w1 / 2, y + lh); ctx.closePath();
        ctx.fillStyle = mono ? hsla(hueOf(C.color), 75, 62 - (k * 30) / n, k === hk ? 1 : 0.82) : pal(C, k, n, false, k === hk ? 1 : 0.82); ctx.fill();
        if (k === hk) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        text(ctx, STG[k], cx, y + lh / 2 - (lh > fs * 3 ? fs * 0.55 : 0), { size: fs, col: '#0b1020', align: 'center', bold: true });
        if (lh > fs * 3) text(ctx, big(N[k]), cx, y + lh / 2 + fs * 0.7, { size: fs * 0.9, col: '#0b1020', align: 'center' });
        if (k) text(ctx, `↓ ${pct(p[k], 0)}`, cx + Wm / 2 + fs * 0.8, y - gap / 2, { size: fs * 0.9, col: '#94a3b8' });
      }
      if (dt > 0 && Math.random() < dt * 30) parts.push({ x: (Math.random() - 0.5), y: mt, k: 0, vx: 0, out: false, a: 1, px: cx });
      parts = parts.filter((q) => {
        if (!q.out) { q.y += dt * 90; const k = Math.floor((q.y - mt) / (lh + gap)); if (k > q.k) { if (k >= n || Math.random() > p[k]) q.out = true, q.vx = (q.x > 0 ? 1 : -1) * 120; q.k = k; } } else { q.y += dt * 40; q.a -= dt * 1.2; }
        const w = wOf(Math.min(q.k, n - 1)); if (q.out) q.px += q.vx * dt; else q.px = cx + q.x * w * 0.8;
        return q.a > 0 && q.y < H;
      });
      for (const q of parts) { ctx.fillStyle = q.out ? `rgba(248,250,252,${q.a * 0.5})` : 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(q.px, q.y, 2, 0, TAU); ctx.fill(); }
      const cum = N[hk] / N[0], lost = hk ? N[hk - 1] - N[hk] : 0;
      tip(ctx, W, H, P.x, P.y, [STG[hk], `${big(N[hk])} 人 · 单步 ${pct(p[hk], 0)}`, `累计 ${pct(cum)}`], C.color);
      return { n, st: STG[hk], cnt: N[hk], prev: hk ? N[hk - 1] : N[0], step: p[hk], cum, lost, all: N[n - 1] / N[0], hy: mt + hk * (lh + gap) + lh / 2, hx: cx, ix: String(hk) };
    };
  },
};

/* ───────────────────────── candlestick ───────────────────────── */
FAM.candle = {
  spec: { color: { label: '上涨颜色', value: '#22d3ee' }, speed: SPD('行情速度'), size: { label: '柱宽比例', min: 0.2, max: 0.95, step: 0.05, value: 0.65 }, count: { label: '显示 K 线数', min: 15, max: 120, step: 1, value: 50 }, extras: [R('vol', '波动率 σ', 0.004, 0.05, 0.001, 0.018), R('ma', '均线周期 MA', 0, 30, 1, 10), T('vb', '成交量柱', true)], remountKeys: [] },
  presets: { 默认: {}, 多柱: { count: 120, size: 0.8 }, 少柱: { count: 20 }, 高波动: { vol: 0.045 }, 无均线: { ma: 0 }, 无成交量: { vb: false } },
  doc: {
    title: 'K 线图（烛台图）· 开高低收',
    rows: (v) => [['K 线数 / 波动率', `${v.n} / ${fmt(v.vol * 100, 1)}%`], ['悬停 K 线', v.idx, 'idx'], ['开 / 收', `${fmt(v.o, 2)} / ${fmt(v.c, 2)}`, 'c'], ['高 / 低', `${fmt(v.h, 2)} / ${fmt(v.l, 2)}`], ['涨跌幅', `${v.chg >= 0 ? '+' : ''}${fmt(v.chg * 100, 2)}%`], ['振幅', pct(v.amp, 2)], [`MA${v.ma || ''}`, v.ma ? fmt(v.mav, 2) : '关']],
    formula: () => F('每根 K 线 = 一段时间内的 开盘 O、最高 H、最低 L、收盘 C') + F('涨跌幅 = (C − O) / O，振幅 = (H − L) / O') + F('移动平均 MAₙ = 最近 n 根收盘价的平均') + F('价格模型：Cₜ = Cₜ₋₁ × e^(σ·z)，z ~ 标准正态'),
    explain: '<p><b>K 线</b>（烛台）是股票行情里最常见的图：每根代表一段时间。中间粗的<b>实体</b>从开盘价画到收盘价，上下细的<b>影线</b>延伸到最高价和最低价。</p><p>收盘比开盘高（上涨）用"上涨颜色"，下跌用灰紫色。<b>均线</b>把最近 n 根的收盘价取平均，可以过滤掉短期波动、看出趋势。底部的柱子是<b>成交量</b>。</p><p>最右边一根正在实时跳动，到时间就收盘并开出新的一根。指针悬停任意一根查看它的开高低收。</p>',
    params: [['上涨颜色', '阳线（收 ≥ 开）的颜色'], ['行情速度', '实时跳动与出新柱的速度；0 = 停止'], ['柱宽比例', '实体宽度占每根空间的比例'], ['显示 K 线数', '屏幕上显示多少根'], ['波动率 σ', '每一步价格的相对波动'], ['均线周期 MA', '0 = 不画均线'], ['成交量柱', '底部显示成交量']],
    example: (v) => `<ol><li>${v.idx}：开 ${fmt(v.o, 2)}，收 ${fmt(v.c, 2)}</li><li>涨跌幅 = (${fmt(v.c, 2)} − ${fmt(v.o, 2)}) / ${fmt(v.o, 2)} = ${fmt(v.chg * 100, 2)}%</li><li>振幅 = (${fmt(v.h, 2)} − ${fmt(v.l, 2)}) / ${fmt(v.o, 2)} = ${pct(v.amp, 2)}</li></ol>`,
    tip: '把波动率调大看行情剧烈起伏；悬停查看每根 K 线。',
  },
  build(S) {
    const r = rng(101); let bars = [], live = null, acc = 0, tick = 0, lastVol = -1;
    const mk = (prev, vol) => { const o = prev; let c = o, h = o, l = o; for (let i = 0; i < 6; i++) { c *= Math.exp(vol * gauss(r) * 0.45); h = Math.max(h, c); l = Math.min(l, c); } return { o, c, h: h * (1 + r() * vol * 0.4), l: l * (1 - r() * vol * 0.4), v: 0.3 + r() + Math.abs(c - o) / o / vol }; };
    return ({ ctx, W, H, dt, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 50)), 5, 200), vol = num(C.vol, 0.018), ma = clamp(Math.round(num(C.ma, 10)), 0, 60), vb = on(C.vb), bwK = num(C.size, 0.65);
      if (vol !== lastVol) { lastVol = vol; bars = []; let p = 100; for (let i = 0; i < 200; i++) { const b = mk(p, vol); bars.push(b); p = b.c; } live = { o: p, c: p, h: p, l: p, v: 0.2 }; }
      acc += dt; tick += dt; if (tick > 0.08) { tick = 0; live.c *= Math.exp(vol * gauss(r) * 0.3); live.h = Math.max(live.h, live.c); live.l = Math.min(live.l, live.c); live.v += 0.05 + r() * 0.05; }
      if (acc > 1.4) { acc = 0; bars.push(live); bars.shift(); const p = live.c; live = { o: p, c: p, h: p, l: p, v: 0.2 }; }
      const seq = [...bars.slice(bars.length - (n - 1)), live];
      const fs = fsz(W, H), ml = fs * 0.6, mr = fs * 3.6, mt = fs * 0.8, vh = vb ? (H - mt) * 0.18 : 0, mb = fs * 1.8, ph = H - mt - mb - vh - (vb ? fs * 0.6 : 0);
      let lo = Infinity, hi = -Infinity; seq.forEach((b) => { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); }); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      const Y = (v) => mt + ph - ((v - lo) / (hi - lo)) * ph, cw = (W - ml - mr) / n, X = (i) => ml + (i + 0.5) * cw;
      for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; ctx.strokeStyle = 'rgba(148,163,184,.12)'; ctx.beginPath(); ctx.moveTo(ml, Y(v)); ctx.lineTo(W - mr, Y(v)); ctx.stroke(); text(ctx, fmt(v, 1), W - mr + fs * 0.4, Y(v), { size: fs * 0.85, col: '#64748b' }); }
      const up = C.color, dn = hsla(hueOf(C.color) + 150, 30, 58); const vmx = Math.max(...seq.map((b) => b.v));
      const hi2 = clamp(Math.floor((P.x - ml) / cw), 0, n - 1);
      seq.forEach((b, i) => { const x = X(i), col = b.c >= b.o ? up : dn, bw = Math.max(1, cw * bwK); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, cw * 0.12); ctx.beginPath(); ctx.moveTo(x, Y(b.h)); ctx.lineTo(x, Y(b.l)); ctx.stroke(); ctx.fillStyle = col; const y0 = Y(Math.max(b.o, b.c)), y1 = Y(Math.min(b.o, b.c)); ctx.fillRect(x - bw / 2, y0, bw, Math.max(1, y1 - y0)); if (vb) { const vh2 = (b.v / vmx) * vh; ctx.globalAlpha = 0.55; ctx.fillRect(x - bw / 2, H - mb - vh2, bw, vh2); ctx.globalAlpha = 1; } });
      let mav = 0; if (ma > 0) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.8; ctx.beginPath(); const all = [...bars, live]; const off = all.length - n; let started = false; for (let i = 0; i < n; i++) { const j = off + i; if (j - ma + 1 < 0) continue; let s = 0; for (let q = j - ma + 1; q <= j; q++) s += all[q].c; const m = s / ma; if (i === hi2) mav = m; started ? ctx.lineTo(X(i), Y(m)) : (ctx.moveTo(X(i), Y(m)), (started = true)); } ctx.stroke(); text(ctx, `MA${ma}`, ml + 4, mt + fs * 0.4, { size: fs * 0.9, col: '#fbbf24', bold: true }); }
      const b = seq[hi2]; ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(X(hi2) - cw / 2, mt, cw, H - mt - mb); cross(ctx, { x: X(hi2), y: P.y }, W - mr, H - mb);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(W - mr, Y(seq[n - 1].c) - fs * 0.6, mr, fs * 1.2); text(ctx, fmt(seq[n - 1].c, 2), W - mr + 3, Y(seq[n - 1].c), { size: fs * 0.85, col: '#0b1020', bold: true });
      const lab = hi2 === n - 1 ? '最新（实时）' : `倒数第 ${n - hi2} 根`;
      tip(ctx, W, H, X(hi2), P.y, [lab, `开 ${fmt(b.o, 2)} 收 ${fmt(b.c, 2)}`, `高 ${fmt(b.h, 2)} 低 ${fmt(b.l, 2)}`], C.color);
      return { n, vol, idx: lab, o: b.o, c: b.c, h: b.h, l: b.l, chg: (b.c - b.o) / b.o, amp: (b.h - b.l) / b.o, ma, mav, ix: String(hi2) };
    };
  },
};

/* ───────────────────────── icicle ───────────────────────── */
FAM.icicle = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('数据波动速度'), size: { label: '块间隙', min: 0, max: 6, step: 0.5, value: 1.5 }, count: { label: '层级深度', min: 1, max: 4, step: 1, value: 3, buttons: true }, extras: [R('br', '分支数', 2, 5, 1, 3), T('hor', '横向排列', false), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 两层: { count: 2 }, 四层: { count: 4, br: 2 }, 横向: { hor: true }, 多分支: { br: 5 }, 单色: { mono: true } },
  doc: {
    title: '冰柱图 · 矩形版的层级分区',
    rows: (v) => [['层级 / 叶子', `${v.depth} / ${v.leaves}`], ['悬停路径', v.path, 'path'], ['数值', fmt(v.val, 1), 'val'], ['占父级 / 占当前视图', `${pct(v.sp)} / ${pct(v.sa)}`], ['当前视图', v.focus], ['方向 / 单色', `${v.ori} / ${v.mono}`]],
    formula: () => F('第 d 层的块排在第 d 行（或列）') + F('子块宽度 = 子值 / 父值 × 父块宽度，并且位于父块正下方') + F('点击下钻：把选中块的区间 [x₀, x₁] 线性放大到整个宽度'),
    explain: '<p><b>冰柱图</b>（Icicle / Partition）是旭日图的"拉直版"：最上面一行是整体，往下每一行是下一层的细分，每个子块都正好在父块的正下方，宽度按数值分配。</p><p>和旭日图相比，矩形更容易比较长度、也更方便放文字。<b>点击</b>任意块会把它放大成整个宽度（下钻），点击最上面一行返回。</p><p>数据在轻微波动，可以看到子块宽度变化时父块也跟着变。</p>',
    params: [['起始色相', '一级分类的颜色起点'], ['数据波动速度', '叶子数值的波动；0 = 静止'], ['块间隙', '块与块之间的像素留白'], ['层级深度', '树的层数'], ['分支数', '每个节点大约几个孩子'], ['横向排列', '关 = 从上往下分层，开 = 从左往右分层'], ['单色', '只用一个色相']],
    example: (v) => `<ol><li>"${v.path}" 值 ${fmt(v.val, 1)}，父节点 ${fmt(v.pv, 1)}</li><li>宽度占父块 ${pct(v.sp)}</li><li>占当前视图 ${pct(v.sa)}，所以它的块是整个宽度的 ${pct(v.sa)}</li></ol>`,
    tip: '点击任意块下钻，点顶行返回。',
  },
  build(S) {
    let key = '', root = null, focus = null, hov = null, z0 = 0, z1 = 1, tz0 = 0, tz1 = 1;
    S.onDown(() => { if (!hov) return; if (hov === focus) focus = focus.parent || root; else if (hov.ch.length || hov.d < focus.d) focus = hov; });
    return ({ ctx, W, H, dtw, t, C, P }) => {
      S.clear();
      const depth = clamp(Math.round(num(C.count, 3)), 1, 4), br = clamp(Math.round(num(C.br, 3)), 2, 5), gp = num(C.size, 1.5), hor = on(C.hor), mono = on(C.mono);
      if (`${depth}|${br}` !== key) { key = `${depth}|${br}`; root = makeTree(depth, br, 131 + br); const link = (n) => n.ch.forEach((c) => { c.parent = n; link(c); }); link(root); focus = root; z0 = tz0 = 0; z1 = tz1 = 1; }
      sumTree(root, t, 0.25);
      const lay = (n, a, b, ti) => { n.x0 = a; n.x1 = b; n.ti = ti; let s = a; n.ch.forEach((c, i) => { const e = s + ((b - a) * c.v) / n.v; lay(c, s, e, n.d === 0 ? i : ti); s = e; }); }; lay(root, 0, 1, 0);
      tz0 = focus.x0; tz1 = focus.x1; const k = 1 - Math.exp(-(dtw || 0.016) * 8); z0 += (tz0 - z0) * k; z1 += (tz1 - z1) * k;
      const fs = fsz(W, H), rows = depth + 1, L = hor ? W : H, Wd = hor ? H : W, rh = L / rows;
      const all = []; const walk = (n) => { all.push(n); n.ch.forEach(walk); }; walk(root);
      const n1 = root.ch.length; hov = null;
      for (const n of all) {
        const a = ((n.x0 - z0) / (z1 - z0)) * Wd, b = ((n.x1 - z0) / (z1 - z0)) * Wd; if (b < 0 || a > Wd || b - a < 0.5) continue;
        const r0 = n.d * rh; const [x, y, w, h] = hor ? [r0, a, rh, b - a] : [a, r0, b - a, rh];
        const inside = P.x >= x && P.x < x + w && P.y >= y && P.y < y + h; if (inside) hov = n;
        const hh = hueOf(C.color), light = n.d === 0 ? 30 : 64 - n.d * 8;
        ctx.fillStyle = n.d === 0 ? '#1e293b' : mono ? hsla(hh, 70, light - (n.ti % 3) * 6) : hsla(hh + n.ti * (300 / n1), 72, light);
        rrect(ctx, x + gp / 2, y + gp / 2, Math.max(0, w - gp), Math.max(0, h - gp), 3); ctx.fill();
        if (inside) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        if ((hor ? h : w) > fs * 3 && (hor ? w : h) > fs * 1.4) text(ctx, n.d ? n.name : (focus === root ? '全部' : `↑ ${focus.path}`), x + 6, y + Math.min(h / 2, fs * 1.2), { size: fs * 0.9, col: n.d ? '#0b1020' : '#e2e8f0', bold: true });
      }
      const h = hov || focus, pv = h.parent ? h.parent.v : h.v; let leaves = 0; all.forEach((n) => { if (!n.ch.length) leaves++; });
      if (hov) tip(ctx, W, H, P.x, P.y, [hov.path || '全部', `值 ${fmt(hov.v, 1)} · 占父级 ${pct(hov.v / pv)}`], C.color);
      return { depth, leaves, path: h.path || '全部', val: h.v, pv, sp: h.v / pv, sa: h.v / focus.v, focus: focus === root ? '全部' : focus.path, ori: hor ? '横向' : '竖向', mono: yes(mono), ix: h.path || 'root' };
    };
  },
};

/* ───────────────────────── arc progress ───────────────────────── */
const KPI = ['营收', '用户', '留存', '满意度', '转化', '活跃'];
const EASE = ['线性', '缓出（三次）', '弹性'];
FAM.arc = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('目标刷新速度'), size: { label: '环宽', min: 0.4, max: 1.8, step: 0.05, value: 1 }, count: { label: '环数', min: 1, max: 6, step: 1, value: 4, buttons: true }, extras: [R('gap', '环间距 px', 2, 16, 1, 6), R('ease', '缓动方式', 0, 2, 1, 1), T('glow', '霓虹光晕', false)], remountKeys: [] },
  presets: { 默认: {}, 单环: { count: 1, size: 1.6 }, 粗环: { size: 1.7 }, 弹性: { ease: 2 }, 霓虹: { glow: true }, 线性: { ease: 0 } },
  doc: {
    title: '多层弧形进度 · 完成度一目了然',
    rows: (v) => [['环数', String(v.n)], ['悬停指标', v.name, 'name'], ['当前 / 目标', `${pct(v.cur)} / ${pct(v.tgt)}`, 'cur'], ['距目标还差', pct(v.rem)], ['动画进度 s', fmt(v.s, 2)], ['缓动方式', v.ease], ['平均完成度', pct(v.avg)]],
    formula: () => F('弧终点角 = 起始角 + 完成度 × 2π') + F('动画：值 = 旧值 + (新值 − 旧值) × e(s)，s 从 0 走到 1') + F('缓出 e(s) = 1 − (1 − s)³；弹性 e(s) = 1 − cos(4.5πs)·e^(−6s)'),
    explain: '<p><b>弧形进度</b>（Apple 健身圆环那种）把每个指标画成一个圆环，<b>弧长占整圈的比例 = 完成度</b>。多个同心环放在一起，可以同时看好几个 KPI。</p><p>数值变化时不是瞬间跳过去，而是用<b>缓动函数</b>做动画：线性匀速；"缓出"先快后慢更自然；"弹性"会冲过头再回弹。每隔一段时间会刷新一次目标值来演示。</p><p>指针移到哪一环（按到中心的距离判断），右侧就显示它的当前值和目标。</p>',
    params: [['起始色相', '最外环的颜色'], ['目标刷新速度', '多久换一次目标值；0 = 停止'], ['环宽', '每个环的粗细'], ['环数', '同心环数量'], ['环间距 px', '环与环之间的距离'], ['缓动方式', '0 线性 · 1 缓出 · 2 弹性'], ['霓虹光晕', '给弧加发光效果']],
    example: (v) => `<ol><li>"${v.name}" 从 ${pct(v.from)} 动画到 ${pct(v.tgt)}</li><li>当前 s = ${fmt(v.s, 2)}，e(s) = ${fmt(v.es, 3)}</li><li>值 = ${pct(v.from)} + (${pct(v.tgt)} − ${pct(v.from)}) × ${fmt(v.es, 3)} = ${pct(v.cur)}</li></ol>`,
    tip: '切换缓动方式，对比三种动画手感。',
  },
  build(S) {
    const r = rng(111); const rings = KPI.map(() => ({ from: r() * 0.5, to: 0.3 + r() * 0.7 })); let s = 0;
    const E = [(x) => x, (x) => 1 - (1 - x) ** 3, (x) => 1 - Math.cos(4.5 * Math.PI * x) * Math.exp(-6 * x)];
    return ({ ctx, W, H, dt, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 4)), 1, 6), gap = num(C.gap, 6), em = clamp(Math.round(num(C.ease, 1)), 0, 2), glow = on(C.glow);
      s += dt / 1.6; if (s >= 1.8) { s = 0; rings.forEach((g) => { g.from = g.to; g.to = 0.15 + r() * 0.85; }); }
      const sc = Math.min(1, s), es = E[em](sc);
      const fs = fsz(W, H), cx = W / 2, cy = H / 2, Ro = Math.min(W, H) / 2 - fs * 0.8, rw = Math.min(Ro / (n + 1.2) - gap, clamp(Math.min(W, H) * 0.05, 8, 28) * num(C.size, 1));
      const pr = Math.hypot(P.x - cx, P.y - cy); let hk = clamp(Math.floor((Ro - pr) / (rw + gap)), 0, n - 1);
      let sum = 0;
      for (let k = 0; k < n; k++) {
        const g = rings[k], cur = g.from + (g.to - g.from) * es; sum += clamp(cur, 0, 1); const rr = Ro - rw / 2 - k * (rw + gap), col = pal(C, k, 6, false, 1);
        ctx.lineCap = 'round'; ctx.lineWidth = rw; ctx.strokeStyle = pal(C, k, 6, false, 0.14); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
        if (glow) { ctx.shadowColor = col; ctx.shadowBlur = rw * 1.2; }
        ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, cur) * TAU); ctx.stroke(); ctx.shadowBlur = 0;
        const ta = -Math.PI / 2 + g.to * TAU; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(cx + Math.cos(ta) * rr, cy + Math.sin(ta) * rr, Math.max(2, rw * 0.12), 0, TAU); ctx.fill();
        if (k === hk) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(cx, cy, rr + rw / 2 + 1, 0, TAU); ctx.arc(cx, cy, rr - rw / 2 - 1, 0, TAU, true); ctx.stroke(); }
        if (rw > fs * 0.9) text(ctx, KPI[k], cx - fs * 0.4, cy - rr, { size: Math.min(fs, rw * 0.7), col: '#0b1020', align: 'right', bold: true });
      }
      const g = rings[hk], cur = g.from + (g.to - g.from) * es; const inner = Ro - n * (rw + gap);
      if (inner > fs * 2.5) { text(ctx, pct(sum / n, 0), cx, cy - fs * 0.3, { size: Math.min(inner * 0.45, fs * 2.4), col: '#f1f5f9', align: 'center', bold: true }); text(ctx, '平均完成度', cx, cy + fs * 1.2, { size: fs * 0.85, col: '#64748b', align: 'center' }); }
      tip(ctx, W, H, P.x, P.y, [KPI[hk], `${pct(cur)} / 目标 ${pct(g.to)}`], C.color);
      return { n, name: KPI[hk], cur, tgt: g.to, from: g.from, rem: Math.max(0, g.to - cur), s: sc, es, ease: EASE[em], avg: sum / n, glow: yes(glow), ix: String(hk) };
    };
  },
};

/* ───────────────────────── force graph shared sim ───────────────────────── */
const forceStep = (nodes, links, o, h) => { const vs = o.vs ?? 1;
  const { rep, len, grav, cx, cy, collide } = o; const n = nodes.length;
  for (let i = 0; i < n; i++) { const a = nodes[i]; a.fx = ((a.gx ?? cx) - a.x) * grav; a.fy = ((a.gy ?? cy) - a.y) * grav; }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
    const d = Math.sqrt(d2), f = rep / d2; a.fx += (dx / d) * f; a.fy += (dy / d) * f; b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
    if (collide) { const m = a.r + b.r + 2; if (d < m) { const p = (m - d) * 0.5; a.x += (dx / d) * p; a.y += (dy / d) * p; b.x -= (dx / d) * p; b.y -= (dy / d) * p; } }
  }
  for (const l of links) { const a = l.a, b = l.b; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - len * (l.k || 1)) * (o.ks || 3.6) * (l.s ?? 1); a.fx += (dx / d) * f; a.fy += (dy / d) * f; b.fx -= (dx / d) * f; b.fy -= (dy / d) * f; }
  let ke = 0;
  for (const a of nodes) { if (a.fix) { a.vx = a.vy = 0; continue; } a.vx = (a.vx + a.fx * h * vs) * 0.86; a.vy = (a.vy + a.fy * h * vs) * 0.86; const s = Math.hypot(a.vx, a.vy); if (s > 900) { a.vx *= 900 / s; a.vy *= 900 / s; } a.x += a.vx * h; a.y += a.vy * h; ke += a.vx * a.vx + a.vy * a.vy; }
  return ke / Math.max(1, n);
};
const pickNode = (nodes, P) => { let best = null, bd = 1e9; for (const a of nodes) { const d = Math.hypot(P.x - a.x, P.y - a.y); if (d < Math.max(a.r + 4, 12) && d < bd) { bd = d; best = a; } } return best; };

/* ───────────────────────── graph (tech-stack relation graph) ───────────────────────── */
const STACK = { 前端框架: ['Vue', 'React', 'Svelte', 'Angular', 'Solid'], 图形渲染: ['Three.js', 'WebGL', 'Canvas', 'SVG', 'PixiJS'], 动画: ['GSAP', 'Lottie', 'CSS 动画', 'WAAPI', 'Motion'], 可视化: ['ECharts', 'D3', 'Chart.js', 'Vega', 'AntV'], 工程化: ['Vite', 'TypeScript', 'ESLint', 'pnpm', 'Rollup'], 服务端: ['Node.js', 'nginx', 'Docker', 'Deno', 'Bun'] };
const XL = [['Three.js', 'WebGL'], ['PixiJS', 'WebGL'], ['Chart.js', 'Canvas'], ['ECharts', 'Canvas'], ['D3', 'SVG'], ['Lottie', 'SVG'], ['GSAP', 'CSS 动画'], ['Vue', 'Vite'], ['React', 'Vite'], ['Svelte', 'Vite'], ['Vite', 'Node.js'], ['TypeScript', 'Vue'], ['TypeScript', 'React'], ['TypeScript', 'Angular'], ['Docker', 'nginx'], ['WAAPI', 'CSS 动画'], ['pnpm', 'Node.js'], ['ESLint', 'TypeScript'], ['Vite', 'Rollup'], ['Motion', 'React'], ['Vega', 'D3'], ['AntV', 'Canvas'], ['Deno', 'TypeScript'], ['Bun', 'TypeScript']];
FAM.graph = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('模拟速度'), size: { label: '节点大小', min: 0.5, max: 1.8, step: 0.05, value: 1 }, count: { label: '每类技术数', min: 1, max: 5, step: 1, value: 4, buttons: true }, extras: [R('rep', '斥力强度', 50, 600, 10, 240), R('len', '连线长度', 30, 160, 5, 70), R('grav', '向心力', 0, 0.3, 0.01, 0.06), T('cross', '跨类依赖线', true)], remountKeys: [] },
  presets: { 默认: {}, 紧凑: { rep: 100, len: 40 }, 舒展: { rep: 520, len: 130 }, 仅分类: { cross: false }, 大节点: { size: 1.6 }, 全部技术: { count: 5 } },
  doc: {
    title: '关系图 · 力引导布局的技术栈网络',
    rows: (v) => [['节点 / 连线', `${v.n} / ${v.m}`], ['悬停节点', v.node, 'node'], ['所属分类 / 度数', `${v.cat} / ${v.deg}`, 'deg'], ['相连节点', v.nb], ['平均动能（越小越稳定）', fmt(v.ke, 1), 'ke'], ['缩放', `${fmt(v.z, 2)}×`], ['斥力 / 连线长度 / 向心力', `${v.rep} / ${v.len} / ${fmt(v.grav, 2)}`]],
    formula: () => F('斥力（库仑）：F = k / d²，所有节点两两相斥') + F('弹簧（胡克）：F = s · (d − L)，有连线的节点互相拉到长度 L') + F('向心力：F = g · (中心 − 位置)；速度每步 × 阻尼 0.86'),
    explain: '<p><b>关系图</b>（网络图）里，点是"东西"，线是"关系"。这里是前端技术栈：中心是 Web 前端，连着 6 个分类，每个分类连着具体技术，虚线是技术之间的依赖。</p><p>位置不是手工摆的，而是<b>力引导布局</b>算出来的：把每个节点想象成带同种电荷的小球（互相排斥），每条连线是一根弹簧（拉近），再加一点向中心的引力。反复模拟直到受力平衡，关系紧密的节点自然聚在一起。</p><p>指针悬停高亮一个节点及其邻居；<b>按住拖动</b>节点，其它节点会被弹簧带着跑；<b>滚轮</b>缩放。</p>',
    params: [['起始色相', '6 个分类按色相轮换'], ['模拟速度', '力学模拟的时间流速；0 = 冻结'], ['节点大小', '节点半径倍数'], ['每类技术数', '每个分类显示几个技术节点'], ['斥力强度', '库仑常数 k'], ['连线长度', '弹簧自然长度 L'], ['向心力', '把整体拉向中心的强度 g'], ['跨类依赖线', '显示技术之间的依赖（虚线）']],
    example: (v) => `<ol><li>"${v.node}" 有 ${v.deg} 条连线</li><li>两个相距 d = 100 的节点，斥力 = ${v.rep} / 100² ≈ ${fmt(v.rep / 10000, 3)}</li><li>平均动能 ${fmt(v.ke, 1)}，接近 0 说明布局已稳定</li></ol>`,
    tip: '拖住一个节点甩一甩；滚轮缩放视图。',
  },
  build(S) {
    let key = '', nodes = [], links = [], drag = null, z = 1; const st = {};
    S.canvas.addEventListener('wheel', (e) => { e.preventDefault(); z = clamp(z * Math.exp(-e.deltaY * 0.0015), 0.4, 2.5); }, { passive: false });
    const toW = (P) => ({ x: (P.x - S.W / 2) / z + S.W / 2, y: (P.y - S.H / 2) / z + S.H / 2 });
    S.onDown((P) => { const q = toW(P); drag = pickNode(nodes, q); if (drag) drag.fix = true; });
    S.onUp(() => { if (drag) drag.fix = false; drag = null; });
    return ({ ctx, W, H, dt, t, C, P }) => {
      { const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6); g.addColorStop(0, hsla(hueOf(C.color), 70, 50, 0.16)); g.addColorStop(1, hsla(hueOf(C.color), 70, 50, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      S.clear();
      const per = clamp(Math.round(num(C.count, 4)), 1, 5), cr = on(C.cross), sz = num(C.size, 1);
      const k2 = `${per}|${cr}`; if (k2 !== key) {
        key = k2; const old = new Map(nodes.map((a) => [a.id, a])); nodes = []; links = []; const r = rng(7);
        const mk = (id, cat, r0) => { const o = old.get(id); const a = { id, cat, r0, x: o ? o.x : W / 2 + (r() - 0.5) * W * 0.6, y: o ? o.y : H / 2 + (r() - 0.5) * H * 0.6, vx: 0, vy: 0, deg: 0 }; nodes.push(a); return a; };
        const hub = mk('Web 前端', -1, 15);
        Object.keys(STACK).forEach((c, ci) => { const cn = mk(c, ci, 10); links.push({ a: hub, b: cn, k: 1.3 }); STACK[c].slice(0, per).forEach((tname) => { const tn = mk(tname, ci, 5.5); links.push({ a: cn, b: tn, k: 0.8 }); }); });
        if (cr) for (const [a, b] of XL) { const A = nodes.find((n) => n.id === a), B = nodes.find((n) => n.id === b); if (A && B) links.push({ a: A, b: B, k: 1.6, x: true, s: 0.12 }); }
        links.forEach((l) => { l.a.deg++; l.b.deg++; });
      }
      nodes.forEach((a) => { a.r = a.r0 * sz * clamp(Math.min(W, H) / 420, 0.75, 1.4); });
      const q = toW(P); if (drag) { drag.x = q.x; drag.y = q.y; }
      const gs = Math.min(W, H) / 420; const o = { rep: num(C.rep, 240) * 900 * gs * gs, ks: 1.6, len: num(C.len, 70) * gs * 1.25 * (1 + 0.04 * Math.sin(t * 0.8)), grav: num(C.grav, 0.06) * 9, cx: W / 2, cy: H / 2, collide: true, vs: 10 };
      let ke = st.ke || 0; let steps = 0; st.acc = (st.acc || 0) + dt; while (st.acc >= 1 / 120 && steps < 6) { st.acc -= 1 / 120; ke = forceStep(nodes, links, o, 1 / 120); steps++; } if (st.acc > 0.05) st.acc = 0; st.ke = ke;
      const hv = drag || pickNode(nodes, q); const nb = new Set(); if (hv) links.forEach((l) => { if (l.a === hv) nb.add(l.b); if (l.b === hv) nb.add(l.a); });
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      const colOf = (a, al = 1) => (a.cat < 0 ? `rgba(232,238,252,${al})` : pal(C, a.cat, 6, false, al));
      for (const l of links) { const lit = hv && (l.a === hv || l.b === hv); ctx.strokeStyle = lit ? 'rgba(255,255,255,.85)' : colOf(l.b.cat < 0 ? l.a : l.b, hv ? 0.15 : l.x ? 0.3 : 0.5); ctx.lineWidth = (lit ? 2 : 1.2) / z; if (l.x) ctx.setLineDash([4 / z, 4 / z]); ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke(); ctx.setLineDash([]); }
      const fs = fsz(W, H) / Math.sqrt(z);
      for (const a of nodes) { const dim = hv && a !== hv && !nb.has(a); ctx.fillStyle = colOf(a, dim ? 0.3 : 1); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill(); if (a === hv) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 / z; ctx.stroke(); } if (a.r0 > 6 || a === hv || nb.has(a) || z > 1.3) text(ctx, a.id, a.x + a.r + 3, a.y, { size: a.r0 > 6 ? fs : fs * 0.85, col: dim ? 'rgba(203,213,225,.35)' : '#e2e8f0', bold: a.r0 > 6 }); }
      ctx.restore();
      const cats = Object.keys(STACK);
      if (hv) tip(ctx, W, H, P.x, P.y, [hv.id, hv.cat < 0 ? '中心节点' : `分类：${cats[hv.cat]}`, `度数 ${hv.deg}`], C.color);
      const h = hv || nodes[0];
      return { n: nodes.length, m: links.length, node: hv ? hv.id : '（指向节点）', cat: h.cat < 0 ? '中心' : cats[h.cat], deg: h.deg, nb: hv ? [...nb].map((a) => a.id).slice(0, 5).join('、') + (nb.size > 5 ? ' …' : '') : '—', ke: ke / 100, z, rep: num(C.rep, 240), len: num(C.len, 70), grav: num(C.grav, 0.06), hx: (h.x - W / 2) * z + W / 2, hy: (h.y - H / 2) * z + H / 2, ix: hv ? hv.id : '-' };
    };
  },
};

/* ───────────────────────── treemap ───────────────────────── */
const TMC = ['前端', '后端', '设计', '数据', '运维', '市场'];
const squarify = (items, x, y, w, h, sq) => {
  const out = []; const tot = items.reduce((a, b) => a + b.v, 0); if (!tot) return out;
  if (!sq) { let s = 0; const hor = w >= h; for (const it of items) { const f = it.v / tot; out.push(hor ? { it, x: x + s * w, y, w: f * w, h } : { it, x, y: y + s * h, w, h: f * h }); s += f; } return out; }
  const list = [...items].sort((a, b) => b.v - a.v).map((it) => ({ it, a: (it.v / tot) * w * h }));
  let rx = x, ry = y, rw = w, rh = h, row = [];
  const worst = (r, side) => { const s = r.reduce((a, b) => a + b.a, 0); let mx = 0; for (const c of r) mx = Math.max(mx, Math.max((side * side * c.a) / (s * s), (s * s) / (side * side * c.a))); return mx; };
  const flush = () => { const s = row.reduce((a, b) => a + b.a, 0); if (rw >= rh) { const cw = s / rh; let yy = ry; for (const c of row) { const ch = c.a / cw; out.push({ it: c.it, x: rx, y: yy, w: cw, h: ch }); yy += ch; } rx += cw; rw -= cw; } else { const ch = s / rw; let xx = rx; for (const c of row) { const cw = c.a / ch; out.push({ it: c.it, x: xx, y: ry, w: cw, h: ch }); xx += cw; } ry += ch; rh -= ch; } row = []; };
  for (const c of list) { const side = Math.min(rw, rh); if (!row.length || worst([...row, c], side) <= worst(row, side)) row.push(c); else { flush(); row.push(c); } }
  if (row.length) flush(); return out;
};
FAM.treemap = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('数据波动速度'), size: { label: '内边距 px', min: 0, max: 8, step: 0.5, value: 2 }, count: { label: '叶子数', min: 6, max: 42, step: 1, value: 24 }, extras: [R('amp', '数值波动幅度', 0, 0.5, 0.05, 0.25), T('sq', '方形化算法', true), T('mono', '单色', false)], remountKeys: [] },
  presets: { 默认: {}, 切片布局: { sq: false }, 多叶子: { count: 42 }, 无间距: { size: 0 }, 静止数据: { amp: 0 }, 单色: { mono: true } },
  doc: {
    title: '矩形树图 · 面积代表大小',
    rows: (v) => [['叶子数 / 分类', `${v.n} / ${v.cats}`], ['悬停', v.name, 'name'], ['数值', fmt(v.val, 1), 'val'], ['占当前视图', pct(v.share), 'share'], ['平均长宽比（越接近 1 越方）', fmt(v.ar, 2), 'ar'], ['当前层级', v.lvl], ['算法 / 单色', `${v.alg} / ${v.mono}`]],
    formula: () => F('矩形面积 = 值 / 总值 × 画布面积') + F('长宽比 = max(w/h, h/w)，越接近 1 越好比较') + F('Squarify：按值从大到小放一行，只要加入新块后"最差长宽比"不变坏就继续加，否则另起一行'),
    explain: '<p><b>矩形树图</b>（Treemap）把层级数据画成嵌套的矩形：大矩形是分类，里面的小矩形是子项，<b>面积正比于数值</b>。在有限空间里能同时展示几十上百个项目的大小关系，常用于磁盘占用、预算、市值等。</p><p>怎么切矩形是关键：最朴素的"切片法"把一条边按比例切开，容易出现细长条；<b>Squarify 方形化算法</b>会尽量让每个矩形接近正方形，更容易比较。打开/关闭"方形化算法"看右侧的平均长宽比变化。</p><p>指针悬停查看数值；<b>点击</b>一个分类下钻进去，再点一下返回。</p>',
    params: [['起始色相', '各分类色相轮换'], ['数据波动速度', '数值实时波动的速度；0 = 静止'], ['内边距 px', '矩形之间的留白'], ['叶子数', '最底层项目总数'], ['数值波动幅度', '数值上下波动的比例'], ['方形化算法', '开 = Squarify；关 = 切片法'], ['单色', '只用一个色相']],
    example: (v) => `<ol><li>"${v.name}" 值 ${fmt(v.val, 1)}，占 ${pct(v.share)}</li><li>所以它的面积 = ${pct(v.share)} × 画布面积</li><li>当前平均长宽比 ${fmt(v.ar, 2)}（${v.alg}）</li></ol>`,
    tip: '关掉"方形化算法"对比切片法的细长条。',
  },
  build(S) {
    let key = '', cats = [], focus = -1, hov = null, rects = [];
    S.onDown(() => { if (focus >= 0) focus = -1; else if (hov) focus = hov.ci; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 24)), 6, 60), pad = num(C.size, 2), amp = num(C.amp, 0.25), sq = on(C.sq), mono = on(C.mono);
      if (`${n}` !== key) { key = `${n}`; const r = rng(121); cats = TMC.map((name, ci) => ({ name, ci, ch: [] })); for (let i = 0; i < n; i++) { const ci = i % 6; cats[ci].ch.push({ name: `${TMC[ci]}-${cats[ci].ch.length + 1}`, base: Math.exp(gauss(r) * 0.8) * (1 + (5 - ci) * 0.25), ph: r() * TAU, ci }); } focus = -1; }
      cats.forEach((c) => { c.ch.forEach((l) => { l.v = l.base * (1 + amp * Math.sin(t * 0.7 + l.ph)); }); c.v = c.ch.reduce((a, b) => a + b.v, 0); });
      const fs = fsz(W, H), head = fs * 1.5; rects = []; hov = null;
      const colOf = (ci, k, m, al = 1) => (mono ? hsla(hueOf(C.color), 70, 34 + 30 * (1 - k / Math.max(1, m)), al) : hsla(hueOf(C.color) + ci * 50, 70, 48 + 16 * (1 - k / Math.max(1, m)), al));
      const view = focus >= 0 ? [cats[focus]] : cats; const vtot = view.reduce((a, b) => a + b.v, 0);
      const top = focus >= 0 ? [{ it: cats[focus], x: 0, y: 0, w: W, h: H }] : squarify(cats, 0, 0, W, H, sq);
      let arS = 0, arN = 0;
      for (const cr of top) {
        const c = cr.it; const x = cr.x + pad / 2, y = cr.y + pad / 2, w = cr.w - pad, h = cr.h - pad; if (w < 2 || h < 2) continue;
        ctx.fillStyle = 'rgba(148,163,184,.08)'; ctx.fillRect(x, y, w, h);
        text(ctx, focus >= 0 ? `← ${c.name}（点击返回）` : c.name, x + 4, y + head / 2, { size: fs * 0.95, col: '#e2e8f0', bold: true });
        const hh = h > head * 2 ? head : 0; const leaves = squarify(c.ch, x, y + hh, w, h - hh, sq); const sorted = [...c.ch].sort((a, b) => b.v - a.v);
        for (const lr of leaves) {
          const lx = lr.x + pad / 2, ly = lr.y + pad / 2, lw = lr.w - pad, lh = lr.h - pad; if (lw < 0.5 || lh < 0.5) continue; arS += Math.max(lr.w / lr.h, lr.h / lr.w); arN++;
          const inside = P.x >= lx && P.x < lx + lw && P.y >= ly && P.y < ly + lh; if (inside) hov = lr.it;
          ctx.fillStyle = colOf(c.ci, sorted.indexOf(lr.it), c.ch.length, hov && !inside ? 0.85 : 1); rrect(ctx, lx, ly, lw, lh, Math.min(4, lw / 4, lh / 4)); ctx.fill();
          if (inside) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
          if (lw > fs * 3.5 && lh > fs * 2.2) { text(ctx, lr.it.name, lx + 5, ly + fs * 0.9, { size: fs * 0.85, col: '#0b1020', bold: true }); text(ctx, fmt(lr.it.v, 1), lx + 5, ly + fs * 2, { size: fs * 0.8, col: 'rgba(11,16,32,.75)' }); }
          rects.push(lr);
        }
      }
      if (hov) tip(ctx, W, H, P.x, P.y, [hov.name, `值 ${fmt(hov.v, 1)} · 占 ${pct(hov.v / vtot)}`], C.color);
      const h = hov || view[0].ch[0];
      return { n, cats: 6, name: hov ? `${TMC[hov.ci]} / ${hov.name}` : '（指向矩形）', val: h.v, share: h.v / vtot, ar: arN ? arS / arN : 1, lvl: focus >= 0 ? `分类 ${TMC[focus]}` : '全部', alg: sq ? 'Squarify' : '切片法', mono: yes(mono), ix: hov ? hov.name : '-' };
    };
  },
};

/* ───────────────────────── d3-force (clustered) ───────────────────────── */
FAM['d3-force'] = {
  spec: { color: { label: '起始色相', value: '#818cf8' }, speed: SPD('模拟速度'), size: { label: '节点半径', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '节点数', min: 20, max: 160, step: 5, value: 70 }, extras: [R('grp', '分组数', 2, 6, 1, 4), R('ch', '电荷强度', 5, 80, 1, 30), R('ld', '连线距离', 10, 80, 1, 30), T('col', '碰撞力', true)], remountKeys: [] },
  presets: { 默认: {}, 大图: { count: 150, size: 0.7 }, 强斥力: { ch: 70 }, 无碰撞: { col: false }, 多分组: { grp: 6 }, 两组: { grp: 2 } },
  doc: {
    title: '力导向图 · 分组聚类与"冷却"',
    rows: (v) => [['节点 / 连线 / 分组', `${v.n} / ${v.m} / ${v.g}`], ['温度 α（越低越稳定）', fmt(v.alpha, 3), 'alpha'], ['悬停节点', v.node, 'node'], ['所在分组 / 度数', `${v.grp} / ${v.deg}`, 'deg'], ['平均速度', fmt(v.vs, 1)], ['电荷 / 连线距离', `−${v.ch} / ${v.ld}`], ['碰撞力', v.col]],
    formula: () => F('多体力：Fᵢⱼ = −电荷 · α / d²（同号相斥）') + F('连线力：把两端拉向距离 L') + F('分组定位力（forceX / forceY）：把节点拉向本组中心') + F('冷却：α ← α + (α目标 − α) × 0.02，每步速度 × α 缩放'),
    explain: '<p>这就是 <b>d3-force</b> 的做法：每个节点受三种力——所有节点之间的<b>电荷斥力</b>、连线的<b>弹簧拉力</b>、防止重叠的<b>碰撞力</b>。再加一个把节点拉向<b>本组中心</b>的定位力（d3 里的 forceX / forceY），同组节点之间连线又更多，所以会聚成一团一团。</p><p>d3 还有一个"<b>温度 α</b>"：刚开始 α = 1，力很大、节点乱飞；之后 α 逐渐<b>冷却</b>，节点越动越慢直到稳定。拖动节点时会重新"加热"，让布局重新调整。</p><p>指针悬停查看节点所在组和连线数，按住可以拖着节点走。</p>',
    params: [['起始色相', '各分组色相轮换'], ['模拟速度', '0 = 冻结'], ['节点半径', '节点大小倍数'], ['节点数', '节点总数'], ['分组数', '聚类的组数'], ['电荷强度', '斥力大小'], ['连线距离', '弹簧自然长度'], ['碰撞力', '是否禁止节点重叠']],
    example: (v) => `<ol><li>当前温度 α = ${fmt(v.alpha, 3)}</li><li>每一步 α 向目标 ${fmt(v.at, 2)} 靠近 2%</li><li>"${v.node}" 在 ${v.grp}，有 ${v.deg} 条连线</li></ol>`,
    tip: '拖动节点会重新加热 α；"无碰撞"预设看节点重叠。',
  },
  build(S) {
    let key = '', nodes = [], links = [], drag = null, alpha = 1; const st = {};
    S.onDown((P) => { drag = pickNode(nodes, P); if (drag) { drag.fix = true; alpha = Math.max(alpha, 0.3); } });
    S.onUp(() => { if (drag) drag.fix = false; drag = null; });
    return ({ ctx, W, H, dt, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 70)), 5, 200), G = clamp(Math.round(num(C.grp, 4)), 1, 6), col = on(C.col);
      if (`${n}|${G}` !== key) { key = `${n}|${G}`; const r = rng(141 + G); const old = nodes; nodes = []; links = []; for (let i = 0; i < n; i++) { const o = old[i]; nodes.push({ id: i, g: i % G, x: o ? o.x : W / 2 + (r() - 0.5) * W * 0.5, y: o ? o.y : H / 2 + (r() - 0.5) * H * 0.5, vx: 0, vy: 0, deg: 0 }); } for (let i = G; i < n; i++) { const g = i % G; const tgt = r() < 0.9 ? g + G * ((r() * Math.floor(i / G)) | 0) : (r() * i) | 0; if (tgt !== i && tgt < n) links.push({ a: nodes[i], b: nodes[tgt], s: nodes[tgt].g === g ? 1 : 0.04 }); } links.forEach((l) => { l.a.deg++; l.b.deg++; }); alpha = 1; }
      const sc = clamp(Math.min(W, H) / 420, 0.7, 1.5); nodes.forEach((a) => { a.r = (3 + Math.sqrt(a.deg) * 1.6) * num(C.size, 1) * sc; const ga = (a.g / G) * TAU - Math.PI / 2; a.gx = W / 2 + (G > 1 ? Math.cos(ga) * W * 0.27 : 0); a.gy = H / 2 + (G > 1 ? Math.sin(ga) * H * 0.27 : 0); });
      if (drag) { drag.x = P.x; drag.y = P.y; }
      const at = drag ? 0.3 : 0.06; let ke = 0; st.acc = (st.acc || 0) + dt; let k = 0;
      while (st.acc >= 1 / 90 && k < 4) { st.acc -= 1 / 90; k++; alpha += (at - alpha) * 0.02; ke = forceStep(nodes, links, { rep: num(C.ch, 30) * 1500 * sc * sc * (0.3 + alpha), len: num(C.ld, 30) * sc, grav: 2.2, cx: W / 2, cy: H / 2, collide: col, vs: 60 }, (1 / 90) * (0.4 + alpha)); }
      if (st.acc > 0.05) st.acc = 0;
      const hv = drag || pickNode(nodes, P); const nb = new Set(); if (hv) links.forEach((l) => { if (l.a === hv) nb.add(l.b); if (l.b === hv) nb.add(l.a); });
      for (const l of links) { const lit = hv && (l.a === hv || l.b === hv); ctx.strokeStyle = lit ? 'rgba(255,255,255,.9)' : l.a.g === l.b.g ? pal(C, l.a.g, G, false, 0.35) : 'rgba(148,163,184,.25)'; ctx.lineWidth = lit ? 2 : 1; ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke(); }
      for (const a of nodes) { ctx.fillStyle = pal(C, a.g, G, false, hv && a !== hv && !nb.has(a) ? 0.4 : 1); ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill(); ctx.strokeStyle = a === hv ? '#fff' : 'rgba(6,10,20,.8)'; ctx.lineWidth = a === hv ? 2.5 : 1; ctx.stroke(); }
      const fs = fsz(W, H); ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(fs * 0.6, fs * 0.6, fs * 6, fs * 0.5); ctx.fillStyle = C.color; ctx.fillRect(fs * 0.6, fs * 0.6, fs * 6 * clamp(alpha, 0, 1), fs * 0.5); text(ctx, `α ${fmt(alpha, 2)}`, fs * 7, fs * 0.85, { size: fs * 0.85, col: '#94a3b8' });
      if (hv) tip(ctx, W, H, P.x, P.y, [`节点 #${hv.id}`, `第 ${hv.g + 1} 组 · 度数 ${hv.deg}`], C.color);
      const h = hv || nodes[0];
      return { n, m: links.length, g: G, alpha, at, node: hv ? `#${hv.id}` : '（指向节点）', grp: `第 ${h.g + 1} 组`, deg: h.deg, vs: Math.sqrt(ke), ch: num(C.ch, 30), ld: num(C.ld, 30), col: yes(col), hx: h.x, hy: h.y, ix: hv ? String(hv.id) : '-' };
    };
  },
};

/* ───────────────────────── mount ───────────────────────── */
const FAMILIES = Object.keys(FAM);

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'heatmap');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'heatmap';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-dataviz',
    title: fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    presetDefaults: F0.presets,
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => mountFamily(fam, box, o),
  });
}

function mountFamily(fam, host, opts) {
  const F0 = FAM[fam];
  const S = createCanvasStage(host, opts, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: F0.cursor || 'crosshair' });
  const step = F0.build(S, S.get());
  S.onFrame(step);
  return S.destroy;
}
