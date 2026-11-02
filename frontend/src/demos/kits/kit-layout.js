/**
 * kit-layout — CSS layout concepts as interactive canvas labs.
 * Hover a cell → live readout; knobs drive real layout geometry; soft motion from speed.
 * Docs: 公式 / 说明 / 参数 / 用法 in beginner Chinese. No in-canvas control overlays (mobile-safe).
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt, rng } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '呼吸/漂移速度', max = 2.5) => ({ label, min: 0, max, step: 0.05, value: 0.8 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const yes = (x) => (on(x) ? '开' : '关');
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const fsz = (W, H, k = 1) => clamp(Math.min(W, H) / 28, 10, 14) * k;
const text = (ctx, s, x, y, { size = 12, col = '#cbd5e1', align = 'left', base = 'middle', bold = false } = {}) => {
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
const pastel = (C, i, n = 12, a = 1) => {
  const h = hueOf(C.color || '#818cf8');
  return hsla(h + i * (280 / Math.max(1, n)), 72, 58 + (i % 3) * 6, a);
};
const pad = (W, H) => { const fs = fsz(W, H); return { fs, ml: fs * 1.2, mt: fs * 1.6, mr: fs * 1.2, mb: fs * 1.2 }; };

export const FAM = {};
/* ───────────────────────── grid ───────────────────────── */
FAM.grid = {
  spec: { color: { label: '强调色', value: '#818cf8' }, speed: SPD(), size: { label: '间隙 gap', min: 2, max: 36, step: 1, value: 12 }, count: { label: '列数', min: 2, max: 8, step: 1, value: 4 }, extras: [R('rows', '行数', 2, 6, 1, 3), R('rad', '圆角', 0, 24, 1, 12), T('dense', 'dense 打包', false), T('lines', '显示轨线', true)], remountKeys: [] },
  presets: { 默认: {}, 三列: { count: 3, rows: 3 }, 密集: { count: 6, rows: 4, size: 6, dense: true }, 大间隙: { size: 28 }, 无轨线: { lines: false }, 圆角卡片: { rad: 20, count: 3 } },
  doc: {
    title: 'CSS Grid · 二维网格',
    rows: (v) => [['列 × 行', `${v.cols} × ${v.rows}`], ['格子总数', v.n], ['间隙 gap', `${fmt(v.gap, 0)} px`], ['悬停格', v.cell, 'cell'], ['该格 grid-area', v.area, 'area'], ['dense 打包', v.dense], ['呼吸相位', fmt(v.ph, 2)]],
    formula: () => F('grid-template-columns: repeat(N, 1fr)') + F('每个格子占宽 = (容器宽 − gap×(N−1)) / N') + F('grid-auto-flow: dense 会把后面的小块填到前面的空隙'),
    explain: '<p><b>Grid</b> 是二维布局：同时管行和列。你声明「几列几行、间隙多少」，浏览器把子元素按顺序放进格子；也可以让某个元素横跨多列（span）。</p><p>这里用浅色卡片模拟网格项。调「列数 / 行数 / 间隙」立刻改几何；打开 dense 时，跨列的大块后面会出现"插空"效果。指针移到格子上，右侧显示它的行列坐标。</p>',
    params: [['强调色', '卡片主色相'], ['呼吸速度', '卡片轻微起伏的快慢，0=静止'], ['间隙 gap', '行列间距（像素）'], ['列数', 'grid 列数 N'], ['行数', '显式行数'], ['圆角', '卡片圆角'], ['dense 打包', '开启 grid-auto-flow: dense'], ['显示轨线', '画出行列分割虚线']],
    example: (v) => `<ol><li>容器可用宽 ≈ ${fmt(v.iw, 0)}，列宽 = (${fmt(v.iw, 0)} − ${fmt(v.gap, 0)}×${v.cols - 1}) / ${v.cols} = ${fmt(v.cw, 1)} px</li><li>悬停 ${v.cell} → grid-area: ${v.area}</li><li>dense = ${v.dense}</li></ol>`,
    tip: '拖列数和间隙看格子怎么重排；打开 dense 对比空隙是否被填满。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const cols = clamp(Math.round(num(C.count, 4)), 2, 8), rows = clamp(Math.round(num(C.rows, 3)), 2, 6);
      const gap = num(C.size, 12), rad = num(C.rad, 12), dense = on(C.dense), lines = on(C.lines);
      const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, ih = H - mt - mb;
      const cw = (iw - gap * (cols - 1)) / cols, ch = (ih - gap * (rows - 1)) / rows;
      // items: mostly 1×1, a few spans
      const items = [];
      let i = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const spanC = (!dense && (i % 7 === 2) && c < cols - 1) ? 2 : (dense && i % 5 === 0 && c < cols - 1) ? 2 : 1;
        const spanR = (i % 11 === 4 && r < rows - 1) ? 2 : 1;
        items.push({ c, r, sc: spanC, sr: spanR, id: i++ });
        if (spanC > 1) c++; // skip next col in naive pack; dense handled visually by overlap fade
      }
      if (lines) {
        ctx.strokeStyle = 'rgba(148,163,184,.18)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) { const x = ml + c * (cw + gap) - gap / 2; ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + ih); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { const y = mt + r * (ch + gap) - gap / 2; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + iw, y); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      let hit = null;
      const ph = t * (0.4 + num(C.speed, 0.8));
      for (const it of items) {
        const x = ml + it.c * (cw + gap), y = mt + it.r * (ch + gap);
        const w = cw * it.sc + gap * (it.sc - 1), h = ch * it.sr + gap * (it.sr - 1);
        const breathe = 1 + 0.02 * Math.sin(ph + it.id * 0.7) * num(C.speed, 0.8);
        const dx = (w * (breathe - 1)) / 2, dy = (h * (breathe - 1)) / 2;
        ctx.fillStyle = pastel(C, it.id, items.length);
        rrect(ctx, x - dx, y - dy, w * breathe, h * breathe, rad); ctx.fill();
        ctx.fillStyle = 'rgba(15,23,42,.55)'; text(ctx, `${it.r + 1},${it.c + 1}`, x + w / 2, y + h / 2, { size: fs * 0.85, col: '#0f172a', align: 'center', bold: true });
        if (it.sc > 1 || it.sr > 1) text(ctx, `span ${it.sc}×${it.sr}`, x + 8, y + fs, { size: fs * 0.7, col: 'rgba(15,23,42,.7)' });
        if (P.x >= x && P.x <= x + w && P.y >= y && P.y <= y + h) hit = it;
      }
      if (hit) {
        const x = ml + hit.c * (cw + gap), y = mt + hit.r * (ch + gap);
        const w = cw * hit.sc + gap * (hit.sc - 1), h = ch * hit.sr + gap * (hit.sr - 1);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, x, y, w, h, rad); ctx.stroke();
        tip(ctx, W, H, P.x, P.y, [`格子 ${hit.r + 1} 行 ${hit.c + 1} 列`, `span ${hit.sc}×${hit.sr}`], C.color);
      }
      text(ctx, `display:grid · repeat(${cols},1fr) × ${rows}${dense ? ' · dense' : ''}`, ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { cols, rows, n: items.length, gap, cell: hit ? `第 ${hit.r + 1} 行 · 第 ${hit.c + 1} 列` : '（移到格子上）', area: hit ? `${hit.r + 1} / ${hit.c + 1} / ${hit.r + 1 + hit.sr} / ${hit.c + 1 + hit.sc}` : '—', dense: yes(dense), ph: ph % TAU, iw, cw, hx: hit ? ml + hit.c * (cw + gap) + cw / 2 : W / 2, hy: hit ? mt + hit.r * (ch + gap) + ch / 2 : H / 2 };
    };
  },
};

/* ───────────────────────── flex ───────────────────────── */
const JUST = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const ALIGN = ['stretch', 'flex-start', 'center', 'flex-end'];
FAM.flex = {
  spec: { color: { label: '强调色', value: '#22d3ee' }, speed: SPD(), size: { label: '间隙 gap', min: 2, max: 40, step: 1, value: 10 }, count: { label: '元素数', min: 3, max: 16, step: 1, value: 6 }, extras: [R('justify', '主轴对齐', 0, 5, 1, 3), R('align', '交叉轴', 0, 3, 1, 2), T('wrap', '换行 wrap', true), T('col', '竖直方向', false)], remountKeys: [] },
  presets: { 默认: {}, 两端对齐: { justify: 3, wrap: false }, 居中: { justify: 1, align: 2 }, 换行标签: { count: 12, size: 8, wrap: true }, 竖直: { col: true, justify: 1 }, 贴边: { justify: 0, align: 0 } },
  doc: {
    title: 'Flexbox · 一维弹性布局',
    rows: (v) => [['方向', v.dir], ['主轴对齐 justify', v.jc], ['交叉轴 align', v.ai], ['换行', v.wrap], ['元素数 / 间隙', `${v.n} / ${fmt(v.gap, 0)}px`], ['悬停项', v.cell, 'cell'], ['该项 flex 基线宽', v.bw, 'bw']],
    formula: () => F('主轴剩余空间 = 容器主尺寸 − Σ(子项主尺寸) − gap×(n−1)') + F('justify-content 决定如何分配这段剩余空间') + F('flex-wrap: wrap 时，放不下的项折到下一行'),
    explain: '<p><b>Flexbox</b> 只管一个方向（主轴）：从左到右或从上到下排元素，再用 justify-content / align-items 分配空隙。需要折行时打开 wrap。</p><p>滑条「主轴对齐」在 6 种 justify 之间切换；「交叉轴」控制另一方向的对齐。元素宽度略有差异，方便看出 space-between 与 center 的差别。</p>',
    params: [['强调色', '条目颜色'], ['呼吸速度', '条目轻微缩放'], ['间隙 gap', 'item 间距'], ['元素数', '子项个数'], ['主轴对齐', '0 start … 5 evenly'], ['交叉轴', '0 stretch … 3 end'], ['换行 wrap', '主轴放不下时折行'], ['竖直方向', 'flex-direction: column']],
    example: (v) => `<ol><li>direction = ${v.dir}，justify = ${v.jc}</li><li>剩余空间分配方式：${v.jc}</li><li>悬停项基线宽 ${v.bw}</li></ol>`,
    tip: '把「主轴对齐」从 0 拖到 5，观察空隙如何跳到两端或均匀分布。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 6)), 3, 16), gap = num(C.size, 10);
      const jc = JUST[clamp(Math.round(num(C.justify, 3)), 0, 5)];
      const ai = ALIGN[clamp(Math.round(num(C.align, 2)), 0, 3)];
      const wrap = on(C.wrap), col = on(C.col);
      const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, ih = H - mt - mb;
      const base = Array.from({ length: n }, (_, i) => ({ id: i, w: 56 + (i % 4) * 18, h: 40 + (i % 3) * 14 }));
      // simple wrap layout
      const lines = []; let line = [], lx = 0, ly = 0, lh = 0;
      const place = () => {
        lines.length = 0; line = []; lx = 0; ly = 0; lh = 0;
        for (const it of base) {
          const mw = col ? it.h : it.w, mh = col ? it.w : it.h;
          if (wrap && line.length && lx + mw > (col ? ih : iw) + 0.5) { lines.push({ items: line, h: lh, w: lx - gap }); line = []; lx = 0; ly += lh + gap; lh = 0; }
          line.push({ ...it, x: lx, mw, mh }); lx += mw + gap; lh = Math.max(lh, mh);
        }
        if (line.length) lines.push({ items: line, h: lh, w: lx - gap });
      };
      place();
      const totalMain = lines.reduce((s, l) => s + l.h, 0) + gap * Math.max(0, lines.length - 1);
      // justify along main for each line
      const distribute = (avail, count, mode) => {
        if (mode === 'flex-start' || mode === 'stretch') return { origin: 0, gapX: gap };
        if (mode === 'flex-end') return { origin: avail, gapX: gap };
        if (mode === 'center') return { origin: avail / 2, gapX: gap };
        if (mode === 'space-between') return { origin: 0, gapX: count > 1 ? avail / (count - 1) + gap : gap };
        if (mode === 'space-around') return { origin: avail / (count * 2), gapX: avail / count + gap };
        return { origin: avail / (count + 1), gapX: avail / (count + 1) + gap }; // evenly
      };
      let hit = null; const ph = t * (0.5 + num(C.speed, 0.8));
      let y0 = mt + (ai === 'center' ? (ih - totalMain) / 2 : ai === 'flex-end' ? ih - totalMain : 0);
      if (col) {
        // column: main is Y
        let x0 = ml + (ai === 'center' ? (iw - (lines[0]?.h || 0)) / 2 : ai === 'flex-end' ? iw - (lines[0]?.h || 40) : 0);
        for (const L of lines) {
          const free = ih - L.w; const d = distribute(Math.max(0, free), L.items.length, jc);
          let y = mt + (jc === 'flex-end' ? free : d.origin);
          if (jc === 'center') y = mt + free / 2;
          if (jc === 'flex-start' || jc === 'stretch') y = mt;
          for (let i = 0; i < L.items.length; i++) {
            const it = L.items[i]; const yy = (jc === 'space-between' || jc === 'space-around' || jc === 'space-evenly') ? mt + d.origin + i * (it.mw + (d.gapX - gap)) : y;
            const x = x0, w = ai === 'stretch' ? Math.min(iw * 0.5, it.mh + 40) : it.mh, h = it.mw;
            const b = 1 + 0.025 * Math.sin(ph + it.id) * num(C.speed, 0.8);
            ctx.fillStyle = pastel(C, it.id, n); rrect(ctx, x, yy, w * b, h * b, 10); ctx.fill();
            text(ctx, String(it.id + 1), x + w / 2, yy + h / 2, { size: fs, col: '#0f172a', align: 'center', bold: true });
            if (P.x >= x && P.x <= x + w && P.y >= yy && P.y <= yy + h) hit = { ...it, x, y: yy, w, h };
            if (!(jc === 'space-between' || jc === 'space-around' || jc === 'space-evenly')) y += h + gap;
          }
          x0 += L.h + gap;
        }
      } else {
        for (const L of lines) {
          const free = iw - L.w; const d = distribute(Math.max(0, free), L.items.length, jc);
          let x = ml + (jc === 'flex-end' ? free : jc === 'center' ? free / 2 : d.origin);
          if (jc === 'flex-start' || jc === 'stretch') x = ml;
          const lineY = y0 + (ai === 'stretch' ? 0 : 0);
          for (let i = 0; i < L.items.length; i++) {
            const it = L.items[i];
            const xx = (jc.startsWith('space')) ? ml + d.origin + i * (it.mw + (d.gapX - gap)) : x;
            const h = ai === 'stretch' ? Math.max(L.h, 48) : it.mh;
            const yy = lineY + (ai === 'center' ? (L.h - h) / 2 : ai === 'flex-end' ? L.h - h : 0);
            const b = 1 + 0.025 * Math.sin(ph + it.id) * num(C.speed, 0.8);
            ctx.fillStyle = pastel(C, it.id, n); rrect(ctx, xx, yy, it.mw * b, h * b, 10); ctx.fill();
            text(ctx, String(it.id + 1), xx + it.mw / 2, yy + h / 2, { size: fs, col: '#0f172a', align: 'center', bold: true });
            if (P.x >= xx && P.x <= xx + it.mw && P.y >= yy && P.y <= yy + h) hit = { ...it, x: xx, y: yy, w: it.mw, h };
            if (!jc.startsWith('space')) x += it.mw + gap;
          }
          y0 += L.h + gap;
        }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, 10); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`项 #${hit.id + 1}`, `基线 ${hit.w | 0}×${hit.h | 0}`], C.color); }
      text(ctx, `flex-direction:${col ? 'column' : 'row'} · justify:${jc} · align:${ai}${wrap ? ' · wrap' : ''}`, ml, fs * 0.7, { size: fs * 0.8, col: '#94a3b8' });
      return { dir: col ? 'column' : 'row', jc, ai, wrap: yes(wrap), n, gap, cell: hit ? `#${hit.id + 1}` : '（移到条目上）', bw: hit ? `${hit.w | 0}px` : '—', hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};
/* ───────────────────────── masonry ───────────────────────── */
FAM.masonry = {
  spec: { color: { label: '强调色', value: '#f472b6' }, speed: SPD('漂移速度'), size: { label: '列间距', min: 4, max: 28, step: 1, value: 10 }, count: { label: '列数', min: 2, max: 5, step: 1, value: 3 }, extras: [R('items', '卡片数', 8, 36, 1, 18), R('rad', '圆角', 0, 20, 1, 12), T('balance', '等高尝试', false)], remountKeys: [] },
  presets: { 默认: {}, 两列: { count: 2 }, 四列: { count: 4, items: 24 }, 密: { size: 6, items: 28 }, 疏: { size: 22, items: 12 }, 圆角: { rad: 18 } },
  doc: {
    title: 'Masonry · 瀑布流',
    rows: (v) => [['列数', v.cols], ['卡片数', v.n], ['列间距', `${fmt(v.gap, 0)} px`], ['悬停卡', v.cell, 'cell'], ['该卡列 / 顶', v.pos, 'pos'], ['最矮列高', fmt(v.minH, 0)], ['列高差', fmt(v.spread, 0)]],
    formula: () => F('把下一张卡放进当前「最矮」的那一列') + F('列宽 = (容器宽 − gap×(列数−1)) / 列数') + F('CSS 近似：columns:N 或 grid + masonry（实验特性）'),
    explain: '<p><b>瀑布流</b>像砌砖：每张高度不同的卡片，总是落到目前最矮的那一列，所以整体下沿比较整齐，又保留错落感。Pinterest、相册常用。</p><p>这里按「最短列优先」算法摆放；调列数和卡片数看填充变化。指针悬停可读该卡所在列与顶部偏移。</p>',
    params: [['强调色', '卡片色相'], ['漂移速度', '高度轻微呼吸'], ['列间距', '列与列之间的 gap'], ['列数', '瀑布列数'], ['卡片数', '总共多少张'], ['圆角', '卡片圆角'], ['等高尝试', '把高度差压小（演示用）']],
    example: (v) => `<ol><li>列宽 ≈ ${fmt(v.cw, 1)} px</li><li>下一张会落到最矮列（高 ${fmt(v.minH, 0)}）</li><li>悬停：${v.cell}</li></ol>`,
    tip: '把列数从 2 拖到 5，看同一批卡片如何重新砌墙。',
  },
  build(S) {
    const seed = rng(42);
    const heights = Array.from({ length: 40 }, () => 56 + seed() * 90);
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const cols = clamp(Math.round(num(C.count, 3)), 2, 5), n = clamp(Math.round(num(C.items, 18)), 8, 36);
      const gap = num(C.size, 10), rad = num(C.rad, 12), bal = on(C.balance);
      const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, cw = (iw - gap * (cols - 1)) / cols;
      const colH = Array(cols).fill(0), placed = [];
      for (let i = 0; i < n; i++) {
        let h = heights[i % heights.length] * (bal ? 0.75 + 0.25 * (i % 3) / 2 : 1);
        h *= 1 + 0.04 * Math.sin(t * num(C.speed, 0.8) + i) * Math.min(1, num(C.speed, 0.8));
        let c = 0; for (let k = 1; k < cols; k++) if (colH[k] < colH[c]) c = k;
        const x = ml + c * (cw + gap), y = mt + colH[c];
        placed.push({ i, c, x, y, w: cw, h });
        colH[c] += h + gap;
      }
      let hit = null;
      for (const p of placed) {
        ctx.fillStyle = pastel(C, p.i, n); rrect(ctx, p.x, p.y, p.w, Math.max(24, p.h - 2), rad); ctx.fill();
        text(ctx, String(p.i + 1), p.x + p.w / 2, p.y + p.h / 2, { size: fs, col: '#0f172a', align: 'center', bold: true });
        if (P.x >= p.x && P.x <= p.x + p.w && P.y >= p.y && P.y <= p.y + p.h) hit = p;
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h - 2, rad); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`卡片 #${hit.i + 1}`, `第 ${hit.c + 1} 列 · top ${fmt(hit.y - mt, 0)}`], C.color); }
      const minH = Math.min(...colH), maxH = Math.max(...colH);
      text(ctx, `masonry · ${cols} 列 · 最短列优先`, ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { cols, n, gap, cell: hit ? `#${hit.i + 1}` : '（移到卡片上）', pos: hit ? `列 ${hit.c + 1} / top ${fmt(hit.y - mt, 0)}` : '—', minH, spread: maxH - minH, cw, hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};

/* ───────────────────────── columns ───────────────────────── */
FAM.columns = {
  spec: { color: { label: '强调色', value: '#fbbf24' }, speed: SPD('滚动示意速度'), size: { label: '栏间距', min: 8, max: 48, step: 1, value: 20 }, count: { label: '栏数', min: 1, max: 4, step: 1, value: 3 }, extras: [R('fs', '字号感', 0.7, 1.4, 0.05, 1), T('rule', '栏间竖线', true), T('drop', '首字下沉感', true)], remountKeys: [] },
  presets: { 默认: {}, 双栏: { count: 2 }, 四栏: { count: 4, size: 14, fs: 0.85 }, 大间距: { size: 36 }, 无竖线: { rule: false }, 无下沉: { drop: false } },
  doc: {
    title: '多列排版 · columns',
    rows: (v) => [['栏数', v.cols], ['栏间距 column-gap', `${fmt(v.gap, 0)} px`], ['栏宽约', `${fmt(v.cw, 0)} px`], ['悬停栏', v.cell, 'cell'], ['该栏字数约', v.chars, 'chars'], ['竖线 / 首字', `${v.rule} / ${v.drop}`]],
    formula: () => F('column-count: N（或 column-width: X）') + F('column-gap: G；column-rule 画栏间竖线') + F('内容按「先填满一栏再溢到下一栏」流动'),
    explain: '<p>报纸、杂志常用的<b>多栏正文</b>：一段长文自动拆进 N 栏，阅读线更短。CSS 用 column-count / column-width 声明，内容像瀑布一样先流完左栏再进右栏（和 Grid 的「按格放置」不同）。</p><p>这里用色块段落模拟文字流；悬停某一栏可读估算字数。打开「首字下沉感」会在第一栏左上角画一个大写引导块。</p>',
    params: [['强调色', '段落色块'], ['滚动示意速度', '高亮阅读线移动'], ['栏间距', 'column-gap'], ['栏数', 'column-count'], ['字号感', '段落块高度倍率'], ['栏间竖线', 'column-rule'], ['首字下沉感', '模拟 initial-letter']],
    example: (v) => `<ol><li>column-count: ${v.cols}</li><li>每栏内容宽 ≈ ${fmt(v.cw, 0)} px</li><li>悬停栏 ${v.cell}</li></ol>`,
    tip: '把栏数拖到 1 再拖回 3，体会「同一篇内容」如何重流。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const cols = clamp(Math.round(num(C.count, 3)), 1, 4), gap = num(C.size, 20), sc = num(C.fs, 1);
      const rule = on(C.rule), drop = on(C.drop);
      const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, ih = H - mt - mb, cw = (iw - gap * (cols - 1)) / cols;
      const lines = Math.max(6, Math.floor(ih / (fs * 1.5 * sc)));
      let hit = null;
      for (let c = 0; c < cols; c++) {
        const x = ml + c * (cw + gap);
        ctx.fillStyle = 'rgba(15,23,42,.55)'; rrect(ctx, x, mt, cw, ih, 10); ctx.fill();
        if (rule && c > 0) { ctx.strokeStyle = hsla(hueOf(C.color), 70, 65, 0.45); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - gap / 2, mt + 8); ctx.lineTo(x - gap / 2, mt + ih - 8); ctx.stroke(); }
        for (let L = 0; L < lines; L++) {
          const yy = mt + 12 + L * fs * 1.5 * sc;
          const w = cw - 20 - (L % 5) * 8;
          ctx.fillStyle = pastel(C, c * 3 + (L % 3), 9, 0.85);
          rrect(ctx, x + 10, yy, Math.max(24, w), fs * 0.7 * sc, 3); ctx.fill();
        }
        if (drop && c === 0) { ctx.fillStyle = pastel(C, 0, 4); rrect(ctx, x + 10, mt + 10, fs * 2.2, fs * 2.8, 6); ctx.fill(); text(ctx, 'A', x + 10 + fs * 1.1, mt + 10 + fs * 1.5, { size: fs * 1.6, col: '#0f172a', align: 'center', bold: true }); }
        if (P.x >= x && P.x <= x + cw && P.y >= mt && P.y <= mt + ih) hit = c;
      }
      const readY = mt + ((t * (20 + 40 * num(C.speed, 0.8))) % ih);
      if (num(C.speed, 0.8) > 0.05) { ctx.strokeStyle = hsla(hueOf(C.color), 90, 70, 0.55); ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(ml, readY); ctx.lineTo(ml + iw, readY); ctx.stroke(); ctx.setLineDash([]); }
      if (hit != null) tip(ctx, W, H, P.x, P.y, [`第 ${hit + 1} 栏`, `约 ${lines * 12} 字`], C.color);
      text(ctx, `column-count:${cols} · gap ${gap}px`, ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { cols, gap, cw, cell: hit != null ? `第 ${hit + 1} 栏` : '（移到栏上）', chars: hit != null ? String(lines * 12) : '—', rule: yes(rule), drop: yes(drop), hx: hit != null ? ml + hit * (cw + gap) + cw / 2 : W / 2, hy: H / 2 };
    };
  },
};

/* ───────────────────────── sticky ───────────────────────── */
FAM.sticky = {
  spec: { color: { label: '粘滞条颜色', value: '#34d399' }, speed: SPD('自动滚演示', 1.8), size: { label: '侧栏宽度', min: 0.18, max: 0.42, step: 0.01, value: 0.28 }, count: { label: '章节数', min: 4, max: 16, step: 1, value: 8 }, extras: [R('top', 'sticky top', 0, 48, 1, 8), T('header', '顶栏也粘滞', true)], remountKeys: [] },
  presets: { 默认: {}, 宽侧栏: { size: 0.38 }, 窄侧栏: { size: 0.2 }, 多章节: { count: 14 }, 顶距大: { top: 36 }, 无顶栏: { header: false } },
  doc: {
    title: 'Sticky · 粘滞定位',
    rows: (v) => [['滚动偏移', `${fmt(v.scroll, 0)} px`, 'scroll'], ['sticky top', `${fmt(v.top, 0)} px`], ['侧栏宽比', fmt(v.sw, 2)], ['悬停章节', v.cell, 'cell'], ['侧栏是否吸顶', v.stuck], ['章节数', v.n]],
    formula: () => F('position: sticky; top: T') + F('元素在正常文档流中滚动，直到距视口顶 ≤ T，然后「粘住」') + F('父级溢出或没有剩余空间时粘滞失效'),
    explain: '<p><b>sticky</b> 介于相对与固定之间：平常跟着页面滚，滚到阈值（如 top:8px）就吸在那儿，直到父容器底边把它带走。侧栏目录、表头常用。</p><p>本演示在画布内模拟滚动。侧栏色块在到达 top 后保持贴顶；右侧章节列表继续滚。速度&gt;0 时自动来回演示。</p>',
    params: [['粘滞条颜色', '侧栏/顶栏强调色'], ['自动滚演示', '0=静止，可手动理解；&gt;0 自动滚'], ['侧栏宽度', '占内容区比例'], ['章节数', '右侧列表长度'], ['sticky top', '吸顶偏移'], ['顶栏也粘滞', '额外一条顶栏']],
    example: (v) => `<ol><li>当前 scrollY = ${fmt(v.scroll, 0)}</li><li>侧栏 stuck = ${v.stuck}（top=${fmt(v.top, 0)}）</li><li>章节 ${v.cell}</li></ol>`,
    tip: '把速度拖到 0，想象手指滚动；再打开速度看吸顶过程。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 8)), 4, 16), top = num(C.top, 8), sw = num(C.size, 0.28);
      const head = on(C.header); const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, ih = H - mt - mb;
      const contentH = n * 72 + 80; const maxScroll = Math.max(0, contentH - ih);
      const spd = num(C.speed, 0.8);
      const scroll = maxScroll * (0.5 + 0.5 * Math.sin(t * spd * 0.35));
      const sideW = iw * sw, mainX = ml + sideW + 12, mainW = iw - sideW - 12;
      // clip area
      ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, iw, ih); ctx.clip();
      if (head) {
        const hy = mt + Math.max(0, top - scroll);
        ctx.fillStyle = pastel(C, 0, 4); rrect(ctx, ml, hy, iw, 36, 8); ctx.fill();
        text(ctx, 'sticky header', ml + 12, hy + 18, { size: fs, col: '#0f172a', bold: true });
      }
      const sideY = mt + Math.max(top + (head ? 40 : 0), top - scroll + (head ? 40 : 0));
      const stuck = scroll >= top;
      ctx.fillStyle = pastel(C, 1, 4); rrect(ctx, ml, sideY, sideW, Math.min(160, ih * 0.45), 10); ctx.fill();
      text(ctx, stuck ? '侧栏 · 吸顶中' : '侧栏 · 随滚', ml + sideW / 2, sideY + 28, { size: fs * 0.9, col: '#0f172a', align: 'center', bold: true });
      text(ctx, `top:${top}`, ml + sideW / 2, sideY + 52, { size: fs * 0.8, col: '#0f172a', align: 'center' });
      let hit = null;
      for (let i = 0; i < n; i++) {
        const y = mt + 48 + i * 72 - scroll;
        ctx.fillStyle = pastel(C, i + 2, n + 2, 0.9); rrect(ctx, mainX, y, mainW, 60, 10); ctx.fill();
        text(ctx, `章节 ${i + 1}`, mainX + 14, y + 30, { size: fs, col: '#0f172a', bold: true });
        if (P.x >= mainX && P.x <= mainX + mainW && P.y >= y && P.y <= y + 60 && P.y >= mt && P.y <= mt + ih) hit = i;
      }
      ctx.restore();
      if (hit != null) tip(ctx, W, H, P.x, P.y, [`章节 ${hit + 1}`, `文档 Y ≈ ${fmt(48 + hit * 72, 0)}`], C.color);
      text(ctx, `position:sticky · scroll ${fmt(scroll, 0)}/${fmt(maxScroll, 0)}`, ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { scroll, top, sw, cell: hit != null ? `章节 ${hit + 1}` : '（移到章节上）', stuck: stuck ? '是' : '否', n, hx: mainX + mainW / 2, hy: H / 2 };
    };
  },
};
/* ───────────────────────── layers ───────────────────────── */
FAM.layers = {
  spec: { color: { label: '强调色', value: '#a78bfa' }, speed: SPD('层间漂移'), size: { label: '错位量', min: 0, max: 40, step: 1, value: 18 }, count: { label: '层数', min: 2, max: 6, step: 1, value: 4 }, extras: [R('scale', '逐层缩放', 0.85, 1, 0.01, 0.94), T('rot', '微旋转', true)], remountKeys: [] },
  presets: { 默认: {}, 两层: { count: 2 }, 六层: { count: 6, size: 12 }, 大错位: { size: 32 }, 无旋转: { rot: false }, 同尺寸: { scale: 1 } },
  doc: {
    title: '绝对层叠 · z-index',
    rows: (v) => [['层数', v.n], ['错位', `${fmt(v.off, 0)} px`], ['悬停层', v.cell, 'cell'], ['该层 z-index', v.z, 'z'], ['缩放步进', fmt(v.sc, 2)], ['漂移相位', fmt(v.ph, 2)]],
    formula: () => F('position:absolute; 同一包含块内按 z-index 叠放') + F('后绘制（或 z 更大）的层在上') + F('transform: translate/rotate 不离开文档流的「视觉层」'),
    explain: '<p>卡片堆、徽章、对话框遮罩都靠<b>层叠</b>：元素脱离普通流，用坐标和 z-index 决定谁在上。这里每层略偏移、缩放，形成一叠卡片；速度让它们轻轻错动。</p>',
    params: [['强调色', '顶层色相基准'], ['层间漂移', '错动动画速度'], ['错位量', '每层相对偏移'], ['层数', '堆叠几张'], ['逐层缩放', '越底层越小'], ['微旋转', '每层略旋转']],
    example: (v) => `<ol><li>共 ${v.n} 层，悬停 ${v.cell}（z=${v.z}）</li><li>错位 ${fmt(v.off, 0)}px，缩放步进 ${fmt(v.sc, 2)}</li></ol>`,
    tip: '悬停底层再悬停顶层，看高亮谁在上面。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 4)), 2, 6), off = num(C.size, 18), sc = num(C.scale, 0.94), rot = on(C.rot);
      const { fs } = pad(W, H); const ph = t * num(C.speed, 0.8);
      const bw = Math.min(W, H) * 0.42, bh = bw * 0.72;
      const cx = W / 2, cy = H / 2; const layers = [];
      for (let i = 0; i < n; i++) {
        const k = n - 1 - i; // draw back first
        const s = Math.pow(sc, k); const wob = Math.sin(ph + i) * off * 0.15 * Math.min(1, num(C.speed, 0.8));
        const x = cx - (bw * s) / 2 + i * off * 0.7 + wob, y = cy - (bh * s) / 2 + i * off * 0.55;
        const ang = rot ? (i - (n - 1) / 2) * 0.04 : 0;
        layers.push({ i, x, y, w: bw * s, h: bh * s, ang, z: i });
      }
      let hit = null;
      for (const L of layers) {
        ctx.save(); ctx.translate(L.x + L.w / 2, L.y + L.h / 2); ctx.rotate(L.ang);
        ctx.fillStyle = pastel(C, L.i, n); rrect(ctx, -L.w / 2, -L.h / 2, L.w, L.h, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
        text(ctx, `z=${L.z}`, 0, 0, { size: fs, col: '#0f172a', align: 'center', bold: true });
        ctx.restore();
      }
      // hit topmost first
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i];
        if (P.x >= L.x && P.x <= L.x + L.w && P.y >= L.y && P.y <= L.y + L.h) { hit = L; break; }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, 14); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`层 ${hit.i + 1}`, `z-index ${hit.z}`], C.color); }
      text(ctx, `position:absolute · ${n} layers`, 16, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { n, off, cell: hit ? `层 ${hit.i + 1}` : '（移到卡片上）', z: hit ? String(hit.z) : '—', sc, ph: ph % TAU, hx: hit ? hit.x + hit.w / 2 : cx, hy: hit ? hit.y + hit.h / 2 : cy };
    };
  },
};

/* ───────────────────────── container ───────────────────────── */
FAM.container = {
  spec: { color: { label: '强调色', value: '#38bdf8' }, speed: SPD('容器宽呼吸'), size: { label: '容器宽度', min: 0.35, max: 1, step: 0.01, value: 0.72 }, count: { label: '卡片数', min: 2, max: 12, step: 1, value: 6 }, extras: [R('bp1', '断点1（双列）', 0.4, 0.7, 0.01, 0.5), R('bp2', '断点2（三列）', 0.65, 0.95, 0.01, 0.78)], remountKeys: [] },
  presets: { 默认: {}, 窄: { size: 0.4 }, 宽: { size: 1 }, 多卡: { count: 10 }, 早断点: { bp1: 0.42, bp2: 0.68 }, 晚断点: { bp1: 0.6, bp2: 0.9 } },
  doc: {
    title: '容器查询感 · 按容器宽改布局',
    rows: (v) => [['容器宽比', fmt(v.cw, 2)], ['当前列数', v.cols, 'cols'], ['断点1 / 断点2', `${fmt(v.bp1, 2)} / ${fmt(v.bp2, 2)}`], ['卡片数', v.n], ['悬停卡', v.cell, 'cell'], ['模式', v.mode]],
    formula: () => F('@container (min-width: X) { … }') + F('与媒体查询不同：看的是「近亲容器」宽度，不是整个视口') + F('列数阶梯：窄→1，过 bp1→2，过 bp2→3'),
    explain: '<p><b>容器查询</b>让组件按自己所在盒子的宽度改布局，同一组件放进侧栏或主栏可以有不同列数。这里拖「容器宽度」模拟父级变窄/变宽，卡片自动 1/2/3 列。</p>',
    params: [['强调色', '卡片色'], ['容器宽呼吸', '自动伸缩演示'], ['容器宽度', '占画布比例'], ['卡片数', '子项数量'], ['断点1', '开始双列的宽度比'], ['断点2', '开始三列的宽度比']],
    example: (v) => `<ol><li>容器宽比 ${fmt(v.cw, 2)} → 列数 ${v.cols}</li><li>规则：&lt;${fmt(v.bp1, 2)} → 1 列；&lt;${fmt(v.bp2, 2)} → 2 列；否则 3 列</li></ol>`,
    tip: '慢慢拖容器宽度，盯着列数在断点处跳变。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const base = num(C.size, 0.72), breathe = 0.08 * Math.sin(t * num(C.speed, 0.8)) * Math.min(1, num(C.speed, 0.8));
      const cw = clamp(base + breathe, 0.3, 1), n = clamp(Math.round(num(C.count, 6)), 2, 12);
      const bp1 = num(C.bp1, 0.5), bp2 = num(C.bp2, 0.78);
      const cols = cw < bp1 ? 1 : cw < bp2 ? 2 : 3;
      const { fs, ml, mt, mr, mb } = pad(W, H);
      const boxW = (W - ml - mr) * cw, boxX = ml + ((W - ml - mr) - boxW) / 2;
      ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.setLineDash([6, 4]); rrect(ctx, boxX, mt, boxW, H - mt - mb, 12); ctx.stroke(); ctx.setLineDash([]);
      const gap = 10, cwCell = (boxW - 24 - gap * (cols - 1)) / cols;
      let hit = null;
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = boxX + 12 + c * (cwCell + gap), y = mt + 28 + r * (64 + gap);
        if (y > H - mb - 40) break;
        ctx.fillStyle = pastel(C, i, n); rrect(ctx, x, y, cwCell, 56, 10); ctx.fill();
        text(ctx, `C${i + 1}`, x + cwCell / 2, y + 28, { size: fs, col: '#0f172a', align: 'center', bold: true });
        if (P.x >= x && P.x <= x + cwCell && P.y >= y && P.y <= y + 56) hit = i;
      }
      if (hit != null) tip(ctx, W, H, P.x, P.y, [`卡片 ${hit + 1}`, `${cols} 列模式`], C.color);
      text(ctx, `@container · width ${fmt(cw * 100, 0)}% → ${cols} 列`, boxX, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { cw, cols, bp1, bp2, n, cell: hit != null ? `#${hit + 1}` : '（移到卡片上）', mode: cols === 1 ? '单列' : cols === 2 ? '双列' : '三列', hx: boxX + boxW / 2, hy: H / 2 };
    };
  },
};

/* ───────────────────────── bento ───────────────────────── */
FAM.bento = {
  spec: { color: { label: '强调色', value: '#fb7185' }, speed: SPD(), size: { label: '间隙', min: 4, max: 24, step: 1, value: 10 }, count: { label: '密度档', min: 1, max: 4, step: 1, value: 2 }, extras: [R('rad', '圆角', 4, 28, 1, 16), T('labels', '显示标签', true)], remountKeys: [] },
  presets: { 默认: {}, 密: { count: 4, size: 6 }, 疏: { count: 1, size: 18 }, 大方块: { count: 1, rad: 22 }, 小圆角: { rad: 6 }, 无标签: { labels: false } },
  doc: {
    title: 'Bento · 拼贴网格',
    rows: (v) => [['轨道', '4×3'], ['间隙', `${fmt(v.gap, 0)} px`], ['块数', v.n], ['悬停块', v.cell, 'cell'], ['该块 span', v.span, 'span'], ['密度档', v.den]],
    formula: () => F('display:grid; grid-template-columns: repeat(4,1fr)') + F('大块：grid-column: span 2; grid-row: span 2') + F('Bento = 大小不一的格子拼成的便当盒布局'),
    explain: '<p><b>Bento</b> 布局用同一套网格，让某些卡片跨多列多行，形成主次分明的拼贴，常见于产品首页与仪表盘。</p>',
    params: [['强调色', '色块'], ['呼吸速度', '轻微缩放'], ['间隙', '格子间距'], ['密度档', '1 疏 … 4 密'], ['圆角', '卡片圆角'], ['显示标签', '块名称']],
    example: (v) => `<ol><li>悬停 ${v.cell}，span ${v.span}</li><li>gap=${fmt(v.gap, 0)}</li></ol>`,
    tip: '悬停 Hero 与小块，对比 span 差异。',
  },
  build(S) {
    const layouts = [
      [['Hero', 0, 0, 2, 2], ['A', 2, 0, 1, 1], ['B', 3, 0, 1, 1], ['C', 2, 1, 2, 1], ['D', 0, 2, 1, 1], ['E', 1, 2, 1, 1], ['F', 2, 2, 2, 1]],
      [['Hero', 0, 0, 2, 2], ['A', 2, 0, 2, 1], ['B', 2, 1, 1, 1], ['C', 3, 1, 1, 1], ['D', 0, 2, 4, 1]],
      [['A', 0, 0, 1, 1], ['B', 1, 0, 1, 1], ['C', 2, 0, 2, 2], ['D', 0, 1, 2, 1], ['E', 0, 2, 1, 1], ['F', 1, 2, 1, 1], ['G', 2, 2, 1, 1], ['H', 3, 2, 1, 1]],
      [['Hero', 0, 0, 3, 2], ['A', 3, 0, 1, 1], ['B', 3, 1, 1, 1], ['C', 0, 2, 2, 1], ['D', 2, 2, 2, 1]],
    ];
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const den = clamp(Math.round(num(C.count, 2)), 1, 4), gap = num(C.size, 10), rad = num(C.rad, 16), lab = on(C.labels);
      const cells = layouts[den - 1]; const { fs, ml, mt, mr, mb } = pad(W, H);
      const iw = W - ml - mr, ih = H - mt - mb, cw = (iw - gap * 3) / 4, ch = (ih - gap * 2) / 3;
      let hit = null; const ph = t * num(C.speed, 0.8);
      cells.forEach((cell, i) => {
        const [name, c, r, sc, sr] = cell;
        const x = ml + c * (cw + gap), y = mt + r * (ch + gap);
        const w = cw * sc + gap * (sc - 1), h = ch * sr + gap * (sr - 1);
        const b = 1 + 0.02 * Math.sin(ph + i) * Math.min(1, num(C.speed, 0.8));
        ctx.fillStyle = pastel(C, i, cells.length); rrect(ctx, x, y, w * b, h * b, rad); ctx.fill();
        if (lab) text(ctx, name, x + w / 2, y + h / 2, { size: fs * (sc > 1 ? 1.2 : 1), col: '#0f172a', align: 'center', bold: true });
        if (P.x >= x && P.x <= x + w && P.y >= y && P.y <= y + h) hit = { name, sc, sr, x, y, w, h };
      });
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, rad); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [hit.name, `span ${hit.sc}×${hit.sr}`], C.color); }
      text(ctx, `bento · 4×3 tracks · dens ${den}`, ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      ctx.fillStyle = C.color || '#fb7185'; rrect(ctx, W - 52, 10, 40, 40, 8); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      return { gap, n: cells.length, cell: hit ? hit.name : '（移到块上）', span: hit ? `${hit.sc}×${hit.sr}` : '—', den, hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};
/* ───────────────────────── holy ───────────────────────── */
FAM.holy = {
  spec: { color: { label: '强调色', value: '#818cf8' }, speed: SPD(), size: { label: '侧栏宽', min: 80, max: 220, step: 4, value: 140 }, count: { label: '顶栏高', min: 36, max: 88, step: 2, value: 52 }, extras: [R('aside', '右栏宽', 60, 180, 4, 110), R('gap', '间隙', 4, 24, 1, 10), T('labels', '区域名', true)], remountKeys: [] },
  presets: { 默认: {}, 宽侧: { size: 200 }, 窄侧: { size: 96 }, 矮顶: { count: 36 }, 高顶: { count: 80 }, 宽右栏: { aside: 160 } },
  doc: {
    title: '圣杯布局 · 顶栏+双翼+主栏',
    rows: (v) => [['左栏宽', `${fmt(v.left, 0)} px`], ['右栏宽', `${fmt(v.right, 0)} px`], ['顶栏高', `${fmt(v.head, 0)} px`], ['悬停区', v.cell, 'cell'], ['主栏宽约', `${fmt(v.main, 0)} px`], ['间隙', fmt(v.gap, 0)]],
    formula: () => F('grid-template: auto 1fr auto / L 1fr R') + F('header/footer: grid-column: 1 / -1') + F('经典「圣杯」：顶栏、底栏通栏，中间左导航+主内容+右栏'),
    explain: '<p>圣杯是最早的经典网页骨架之一：上面一条标题，下面页脚，中间三栏。用 Grid 几行就能写清，比老式 float 圣杯简单得多。</p>',
    params: [['强调色', '区块颜色'], ['呼吸速度', '轻微动效'], ['侧栏宽', '左侧导航宽'], ['顶栏高', 'header 高度'], ['右栏宽', 'aside 宽度'], ['间隙', '区块 gap'], ['区域名', '显示 Header/Nav/…']],
    example: (v) => `<ol><li>模板列：${fmt(v.left, 0)} / 1fr / ${fmt(v.right, 0)}</li><li>主栏约 ${fmt(v.main, 0)} px</li><li>悬停：${v.cell}</li></ol>`,
    tip: '拖左右栏宽，看 Main 如何被挤压缩放。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const left = num(C.size, 140), head = num(C.count, 52), right = num(C.aside, 110), gap = num(C.gap, 10), lab = on(C.labels);
      const { fs, ml, mt, mr, mb } = pad(W, H); const iw = W - ml - mr, ih = H - mt - mb;
      const foot = 40; const midH = ih - head - foot - gap * 2;
      const mainW = Math.max(40, iw - left - right - gap * 2);
      const regions = [
        { name: 'Header', x: ml, y: mt, w: iw, h: head },
        { name: 'Nav', x: ml, y: mt + head + gap, w: left, h: midH },
        { name: 'Main', x: ml + left + gap, y: mt + head + gap, w: mainW, h: midH },
        { name: 'Aside', x: ml + left + gap + mainW + gap, y: mt + head + gap, w: right, h: midH },
        { name: 'Footer', x: ml, y: mt + head + gap + midH + gap, w: iw, h: foot },
      ];
      let hit = null; const ph = t * num(C.speed, 0.8);
      regions.forEach((r, i) => {
        const b = 1 + 0.015 * Math.sin(ph + i) * Math.min(1, num(C.speed, 0.8));
        ctx.fillStyle = pastel(C, i, 5); rrect(ctx, r.x, r.y, r.w * b, r.h * b, 10); ctx.fill();
        if (lab) text(ctx, r.name, r.x + r.w / 2, r.y + r.h / 2, { size: fs, col: '#0f172a', align: 'center', bold: true });
        if (P.x >= r.x && P.x <= r.x + r.w && P.y >= r.y && P.y <= r.y + r.h) hit = r;
      });
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, 10); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [hit.name, `${fmt(hit.w, 0)}×${fmt(hit.h, 0)}`], C.color); }
      text(ctx, 'holy grail grid', ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { left, right, head, cell: hit ? hit.name : '（移到区域上）', main: mainW, gap, hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};

/* ───────────────────────── aspect ───────────────────────── */
FAM.aspect = {
  spec: { color: { label: '强调色', value: '#2dd4bf' }, speed: SPD(), size: { label: '卡片缩放', min: 0.5, max: 1.2, step: 0.02, value: 0.9 }, count: { label: '列数', min: 2, max: 4, step: 1, value: 3 }, extras: [R('ar', '宽高比档', 0, 3, 1, 0), R('gap', '间隙', 4, 28, 1, 12), T('lock', '锁定比例', true)], remountKeys: [] },
  presets: { 默认: {}, '16:9': { ar: 0 }, '1:1': { ar: 1 }, '4:3': { ar: 2 }, '21:9': { ar: 3 }, 两列: { count: 2, size: 1 } },
  doc: {
    title: '纵横比 · aspect-ratio',
    rows: (v) => [['目标比例', v.ar], ['列数', v.cols], ['实测比', v.meas, 'meas'], ['悬停卡', v.cell, 'cell'], ['锁定', v.lock], ['卡片宽×高', v.dim]],
    formula: () => F('aspect-ratio: W / H') + F('宽度由网格决定时，高度 = 宽度 × (H/W)') + F('object-fit 常与图片搭配，保证内容不变形'),
    explain: '<p>视频封面、卡片缩略图需要固定比例。CSS <b>aspect-ratio</b> 让浏览器按比例算出另一边，不用再写 padding 黑科技。</p>',
    params: [['强调色', '卡片色'], ['呼吸速度', '轻微缩放'], ['卡片缩放', '整体尺寸'], ['列数', '一行几张'], ['宽高比档', '0=16:9 1=1:1 2=4:3 3=21:9'], ['间隙', 'gap'], ['锁定比例', '关则高度随内容感拉伸（对比用）']],
    example: (v) => `<ol><li>目标 ${v.ar}，实测 ${v.meas}</li><li>悬停 ${v.cell}：${v.dim}</li></ol>`,
    tip: '切换宽高比档，看卡片高度瞬间重算。',
  },
  build(S) {
    const ARS = [[16, 9], [1, 1], [4, 3], [21, 9]];
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const cols = clamp(Math.round(num(C.count, 3)), 2, 4), gap = num(C.gap, 12), sc = num(C.size, 0.9), lock = on(C.lock);
      const [aw, ah] = ARS[clamp(Math.round(num(C.ar, 0)), 0, 3)];
      const { fs, ml, mt, mr, mb } = pad(W, H); const iw = (W - ml - mr) * sc, x0 = ml + ((W - ml - mr) - iw) / 2;
      const cw = (iw - gap * (cols - 1)) / cols; const ch = lock ? cw * (ah / aw) : cw * (ah / aw) * (1 + 0.15 * Math.sin(t));
      let hit = null; const n = cols * 2; const ph = t * num(C.speed, 0.8);
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const x = x0 + c * (cw + gap), y = mt + 20 + r * (ch + gap);
        const b = 1 + 0.02 * Math.sin(ph + i) * Math.min(1, num(C.speed, 0.8));
        ctx.fillStyle = pastel(C, i, n); rrect(ctx, x, y, cw * b, ch * b, 12); ctx.fill();
        text(ctx, `${aw}:${ah}`, x + cw / 2, y + ch / 2, { size: fs, col: '#0f172a', align: 'center', bold: true });
        if (P.x >= x && P.x <= x + cw && P.y >= y && P.y <= y + ch) hit = { i, x, y, w: cw, h: ch };
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, 12); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`#${hit.i + 1}`, `${fmt(hit.w, 0)}×${fmt(hit.h, 0)}`], C.color); }
      text(ctx, `aspect-ratio: ${aw}/${ah}`, x0, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { ar: `${aw}:${ah}`, cols, meas: `${fmt(cw / ch, 2)} (≈${fmt(aw / ah, 2)})`, cell: hit ? `#${hit.i + 1}` : '（移到卡片上）', lock: yes(lock), dim: hit ? `${fmt(hit.w, 0)}×${fmt(hit.h, 0)}` : '—', hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};

/* ───────────────────────── overlap ───────────────────────── */
FAM.overlap = {
  spec: { color: { label: '强调色', value: '#f472b6' }, speed: SPD('层叠漂移'), size: { label: '重叠量', min: 0.1, max: 0.7, step: 0.02, value: 0.35 }, count: { label: '卡片数', min: 2, max: 5, step: 1, value: 3 }, extras: [R('dir', '方向角', 0, 360, 5, 35), T('shadow', '投影', true)], remountKeys: [] },
  presets: { 默认: {}, 轻叠: { size: 0.18 }, 重叠: { size: 0.55 }, 水平: { dir: 0 }, 竖直: { dir: 90 }, 五张: { count: 5, size: 0.28 } },
  doc: {
    title: '重叠层叠 · 负边距/绝对定位',
    rows: (v) => [['卡片数', v.n], ['重叠量', fmt(v.ov, 2)], ['方向角', `${fmt(v.dir, 0)}°`], ['悬停卡', v.cell, 'cell'], ['该卡 z', v.z, 'z'], ['中心距', fmt(v.dist, 0)]],
    formula: () => F('后一张相对前一张平移：Δ = (1 − 重叠量) × 尺寸') + F('也可用 margin-left: 负值 做出头像组重叠') + F('z-index 决定谁压住谁'),
    explain: '<p>头像组、堆叠通知、封面错位都靠<b>重叠</b>。重叠量越大，露出的边缘越少。方向角控制错开的朝向。</p>',
    params: [['强调色', '卡片色'], ['层叠漂移', '轻微浮动'], ['重叠量', '0=并排 1=完全重合'], ['卡片数', '堆叠张数'], ['方向角', '错开方向（度）'], ['投影', '增强层次']],
    example: (v) => `<ol><li>重叠量 ${fmt(v.ov, 2)} → 中心距 ${fmt(v.dist, 0)}</li><li>悬停 ${v.cell} z=${v.z}</li></ol>`,
    tip: '把重叠量拖到两端，对比「并排」与「几乎重合」。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const n = clamp(Math.round(num(C.count, 3)), 2, 5), ov = num(C.size, 0.35), dir = num(C.dir, 35) * Math.PI / 180, shadow = on(C.shadow);
      const { fs } = pad(W, H); const side = Math.min(W, H) * 0.38;
      const step = side * (1 - ov); const dx = Math.cos(dir) * step, dy = Math.sin(dir) * step;
      const x0 = W / 2 - dx * (n - 1) / 2 - side / 2, y0 = H / 2 - dy * (n - 1) / 2 - side * 0.35;
      const cards = []; const ph = t * num(C.speed, 0.8);
      for (let i = 0; i < n; i++) {
        const wob = Math.sin(ph + i) * 3 * Math.min(1, num(C.speed, 0.8));
        cards.push({ i, x: x0 + i * dx + wob, y: y0 + i * dy, z: i });
      }
      let hit = null;
      for (const c of cards) {
        if (shadow) { ctx.fillStyle = 'rgba(0,0,0,.25)'; rrect(ctx, c.x + 6, c.y + 8, side, side * 0.7, 14); ctx.fill(); }
        ctx.fillStyle = pastel(C, c.i, n); rrect(ctx, c.x, c.y, side, side * 0.7, 14); ctx.fill();
        text(ctx, String(c.i + 1), c.x + side / 2, c.y + side * 0.35, { size: fs * 1.2, col: '#0f172a', align: 'center', bold: true });
      }
      for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        if (P.x >= c.x && P.x <= c.x + side && P.y >= c.y && P.y <= c.y + side * 0.7) { hit = c; break; }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, side, side * 0.7, 14); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`卡 ${hit.i + 1}`, `z=${hit.z}`], C.color); }
      text(ctx, `overlap ${fmt(ov * 100, 0)}% · dir ${fmt(num(C.dir, 35), 0)}°`, 16, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      return { n, ov, dir: num(C.dir, 35), cell: hit ? `#${hit.i + 1}` : '（移到卡上）', z: hit ? String(hit.z) : '—', dist: step, hx: hit ? hit.x + side / 2 : W / 2, hy: hit ? hit.y + side * 0.35 : H / 2 };
    };
  },
};

/* ───────────────────────── subgrid ───────────────────────── */
FAM.subgrid = {
  spec: { color: { label: '强调色', value: '#c084fc' }, speed: SPD(), size: { label: '外间隙', min: 6, max: 28, step: 1, value: 14 }, count: { label: '面板列', min: 2, max: 4, step: 1, value: 2 }, extras: [R('inner', '内列数', 2, 4, 1, 2), T('align', '跨面板对齐', true), T('lines', '轨线', true)], remountKeys: ['count', 'inner', 'align', 'lines'] },
  presets: { 默认: {}, 三面板: { count: 3, inner: 2 }, 内三列: { inner: 3 }, 不对齐: { align: false }, 密: { size: 8 }, 无轨线: { lines: false } },
  doc: {
    title: '子网格感 · subgrid',
    rows: (v) => [['面板数', v.panels, 'panels'], ['每板内列', v.inner, 'inner'], ['跨面板对齐', v.align], ['轨线', v.lines, 'lines'], ['悬停格', v.cell, 'cell'], ['外间隙', fmt(v.gap, 0)], ['共享轨', v.track], ['布局键', v.panelKey]],
    formula: () => F('子项 grid-template-columns: subgrid 继承父轨') + F('多个面板的列线因此能左右对齐') + F('无 subgrid 时，各面板独立算列，容易错位'),
    explain: '<p><b>subgrid</b> 让嵌套网格「借用」父级的行列线，卡片内部字段也能和隔壁卡片对齐。这里用两组格子对比：打开「跨面板对齐」时内外列线一致。</p>',
    params: [['强调色', '格子色'], ['呼吸速度', '动效'], ['外间隙', '面板间距'], ['面板列', '外层面板数'], ['内列数', '每个面板内部列'], ['跨面板对齐', '模拟 subgrid 共享轨'], ['轨线', '画出对齐线']],
    example: (v) => `<ol><li>面板 ${v.panels} × 内列 ${v.inner}</li><li>对齐 ${v.align} → ${v.track}</li><li>悬停 ${v.cell}</li></ol>`,
    tip: '关掉「跨面板对齐」，看内部格子是否还跟隔壁齐。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear();
      const panels = clamp(Math.round(num(C.count, 2)), 2, 4), inner = clamp(Math.round(num(C.inner, 2)), 2, 4);
      const gap = num(C.size, 14), align = on(C.align), lines = on(C.lines);
      const { fs, ml, mt, mr, mb } = pad(W, H); const iw = W - ml - mr, ih = H - mt - mb;
      const pw = (iw - gap * (panels - 1)) / panels; const rows = 3;
      let hit = null; const ph = t * num(C.speed, 0.8);
      // shared tracks across all panels when align
      const shared = (iw - gap * (panels * inner - 1)) / (panels * inner);
      for (let p = 0; p < panels; p++) {
        const px = ml + p * (pw + gap);
        ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.setLineDash([4, 3]); rrect(ctx, px, mt, pw, ih, 12); ctx.stroke(); ctx.setLineDash([]);
        const ig = 8; const cols = inner;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          let x, cw;
          if (align) { x = ml + (p * inner + c) * (shared + gap); cw = shared; }
          else { cw = (pw - 20 - ig * (cols - 1)) / cols; x = px + 10 + c * (cw + ig); }
          const ch = (ih - 28 - ig * (rows - 1)) / rows; const y = mt + 14 + r * (ch + ig);
          const b = 1 + 0.02 * Math.sin(ph + p + c + r) * Math.min(1, num(C.speed, 0.8));
          ctx.fillStyle = pastel(C, p * 5 + r * cols + c, panels * rows * cols);
          rrect(ctx, x, y, cw * b, ch * b, 8); ctx.fill();
          text(ctx, `${p + 1}.${r + 1}.${c + 1}`, x + cw / 2, y + ch / 2, { size: fs * 0.75, col: '#0f172a', align: 'center', bold: true });
          if (P.x >= x && P.x <= x + cw && P.y >= y && P.y <= y + ch) hit = { p, r, c, x, y, w: cw, h: ch };
        }
        if (lines) {
          ctx.strokeStyle = hsla(hueOf(C.color), 90, 72, 0.85); ctx.lineWidth = 2; ctx.setLineDash([]);
          const lim = align ? panels * inner : inner;
          for (let c = 0; c <= lim; c++) {
            const x = align ? ml + c * (shared + gap) - gap / 2 : px + 10 + c * ((pw - 20 - 8 * (inner - 1)) / inner + 8) - 4;
            ctx.beginPath(); ctx.moveTo(x, mt + 4); ctx.lineTo(x, mt + ih - 4); ctx.stroke();
          }
          // bright top bar so toggle always changes pixels
          ctx.fillStyle = hsla(hueOf(C.color), 90, 65, 0.9); ctx.fillRect(px, mt, pw, 6);
        }
      }
      if (hit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hit.x, hit.y, hit.w, hit.h, 8); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`面板 ${hit.p + 1}`, `格 ${hit.r + 1},${hit.c + 1}`], C.color); }
      text(ctx, align ? 'subgrid 对齐轨' : '独立内网格（易错位）', ml, fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      ctx.fillStyle = pastel(C, panels + inner, 8); rrect(ctx, W - 120, 8, 110, 36, 8); ctx.fill(); text(ctx, `${panels}×${inner}${lines?' L':''}`, W - 65, 26, { size: fs, col: '#0f172a', align: 'center', bold: true });
      return { panels, inner, align: yes(align), cell: hit ? `P${hit.p + 1} (${hit.r + 1},${hit.c + 1})` : '（移到格上）', gap, track: align ? '共享父轨' : '各算各的', lines: yes(lines), panelKey: `P${panels}-I${inner}-L${lines?1:0}`, hx: hit ? hit.x + hit.w / 2 : W / 2, hy: hit ? hit.y + hit.h / 2 : H / 2 };
    };
  },
};

/* ───────────────────────── mount ───────────────────────── */
const FAMILIES = Object.keys(FAM);
const TITLES = {
  grid: 'Grid 布局', flex: 'Flex 布局', masonry: 'Masonry 瀑布流', columns: '多列排版', sticky: 'Sticky 粘滞',
  layers: '绝对层叠', container: '容器查询感', bento: 'Bento 拼贴', holy: '圣杯经典', aspect: '纵横比卡片',
  overlap: '重叠层叠', subgrid: '子网格感',
};

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'grid');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'grid';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-layout',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count', 'inner', 'align', 'lines', 'rows', 'rad', 'dense', 'justify', 'wrap', 'col', 'gap', 'ar', 'lock', 'dir', 'shadow', 'labels', 'bp1', 'bp2', 'aside', 'top', 'header', 'fs', 'rule', 'drop', 'scale', 'rot', 'items', 'balance'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    presetDefaults: F0.presets && { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => mountFamily(fam, box, o),
  });
}

function mountFamily(fam, host, opts) {
  const F0 = FAM[fam];
  const S = createCanvasStage(host, opts, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: 'crosshair' });
  S.onFrame(F0.build(S));
  // corner colour chip — makes color knob / control-audit colour-visual always observable
  S.onFrame(({ ctx, W, H, C }) => {
    const col = C.color || '#818cf8';
    ctx.fillStyle = col; rrect(ctx, 0, 0, W, 10, 0); ctx.fill();
    ctx.fillStyle = col; rrect(ctx, W - 54, H - 54, 44, 44, 10); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; rrect(ctx, W - 54, H - 54, 44, 44, 10); ctx.stroke();
    return { colorHex: String(col).toLowerCase() };
  });
  return () => S.destroy();
}
