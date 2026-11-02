/**
 * kit-generative — generative art families. Pixel fields render at a coarse
 * resolution into an offscreen canvas; simulations (GOL, Gray-Scott, walkers)
 * keep per-mount state. LIVE .mip readout; beginner Chinese docs; full-stage fill.
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
const smooth = (x) => x * x * (3 - 2 * x);
const ih = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** value noise in 0..1, smooth in x, y, z */
function noise3(x, y, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const p = (dx, dy, dz) => ih(xi + dx, yi + dy, zi + dz);
  return L(L(L(p(0, 0, 0), p(1, 0, 0), u), L(p(0, 1, 0), p(1, 1, 0), u), v), L(L(p(0, 0, 1), p(1, 0, 1), u), L(p(0, 1, 1), p(1, 1, 1), u), v), w);
}
const fbm = (x, y, z, o = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z + i * 7.1); n += a; a *= 0.5; f *= 2; } return s / n; };
function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = fract(t); return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** gFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k, st) returns { mode?, n?, cell? }. */
function gFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key]) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key])}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针处', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p><p>生成艺术 = 用简单的数学规则 + 随机数/噪声，让电脑自己「画」出图案；改变参数就是改变规则。</p>`,
      params: [['主色', '图案的基础色相，其余颜色在它附近变化'], [spec.speed.label, '时间流逝的快慢，0 表示暂停'], [d.size.label, d.sizeDoc || '单个元素的大小'], [d.count.label, d.countDoc || '元素的数量'], [ex.label, d.extraDoc || '该图案特有的规则参数']],
      example: (v) => `<ol><li>当前：${v.mode}，${d.count.label} ${v.n}</li><li>指针处：${v.cell}</li><li>主色 ${v.colorHex}，拖滑条观察图案变化</li></ol>`,
      tip: d.tip || '移动指针与图案互动；右侧滑条实时改变规则。',
    },
    build(S) {
      const st = { t0: null };
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8';
        const tt = t * num(C.speed, 0.9);
        st.dt = st.t0 == null ? 0 : clamp(tt - st.t0, 0, 0.1); st.t0 = tt;
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), near: 0 };
        k.dot = (x, y, r, fill, a = 1) => {
          if (r <= 0.05 || a <= 0.003) return;
          ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = fill || col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          if ((x - P.x) ** 2 + (y - P.y) ** 2 < 3600) k.near++;
        };
        /** raw pixel buffer at 1/res resolution; fill(data, fw, fh, res) */
        k.raw = (res, fill) => {
          const fw = Math.max(8, Math.ceil(W / res)), fh = Math.max(8, Math.ceil((H - 8) / res));
          if (!st.fc || st.fw !== fw || st.fh !== fh) { st.fc = document.createElement('canvas'); st.fc.width = fw; st.fc.height = fh; st.fx = st.fc.getContext('2d'); st.img = st.fx.createImageData(fw, fh); st.fw = fw; st.fh = fh; st.img.data.fill(255); }
          fill(st.img.data, fw, fh, res);
          st.fx.putImageData(st.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(st.fc, 0, 8, fw * res, fh * res);
          return { fw, fh };
        };
        /** per-pixel field: fn(x, y, out) writes out[0..2] in 0..255 */
        k.field = (res, fn) => k.raw(res, (D, fw, fh) => { const out = [0, 0, 0]; let o = 0; for (let j = 0; j < fh; j++) { const y = 8 + j * res + res / 2; for (let i = 0; i < fw; i++) { fn(i * res + res / 2, y, out); D[o] = out[0]; D[o + 1] = out[1]; D[o + 2] = out[2]; o += 4; } } });
        /** 256-entry palette cached by key; fn(u) -> [h, s(0..1), l(0..1)] */
        k.lut = (key, fn) => { st.luts = st.luts || {}; if (!st.luts[key]) { const a = new Uint8ClampedArray(768); for (let i = 0; i < 256; i++) { const [h, s, l] = fn(i / 255); const c = hsl2rgb(h, s, l); a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } st.luts[key] = a; } return st.luts[key]; };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip();
        const r = d.draw(ctx, W, H, tt, C, P, k, st) || {};
        ctx.restore();
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: r.cell || `${k.near} 个元素在指针 60px 内`, colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}
const setPx = (out, L, u) => { const i = clamp(Math.round(u * 255), 0, 255) * 3; out[0] = L[i]; out[1] = L[i + 1]; out[2] = L[i + 2]; };

FAM.flowfield = gFam({ title: 'Perlin 流场', size: { label: '线宽', min: 0.4, max: 4, step: 0.1, value: 1.2 }, count: { label: '流线数', min: 20, max: 400, step: 5, value: 160 },
  extra: R('scale', '噪声尺度', 0.5, 4, 0.05, 1.6), presets: { 疏: { count: 40 }, 密: { count: 400 }, 粗线: { size: 3.5 }, 细纹: { scale: 3.8 }, 大涡: { scale: 0.6 } },
  explain: '流场：画面每一点都有一个「风向」，由平滑噪声决定。从随机起点出发、一步步顺着风向前进，就画出一条流线；亮点沿流线流动。指针处会产生一个漩涡。', formula: '角度 θ(x, y, t) = 4π · noise(x·s, y·s, 0.05t)', formula2: '下一步 p ← p + 3·(cos θ, sin θ)',
  draw(ctx, W, H, t, C, P, k) {
    const sc = k.x / 260, L = 36; ctx.lineWidth = k.s; ctx.lineCap = 'round'; let near = 0;
    for (let i = 0; i < k.n; i++) {
      let x = hh(i, 1) * W, y = 8 + hh(i, 2) * (H - 8); const head = fract(hh(i, 3) + t * 0.25) * L;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < L; s++) {
        let a = noise3(x * sc, y * sc, t * 0.05) * TAU * 2; const dx = x - P.x, dy = y - P.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { a = a * (d2 / 14400) + (Math.atan2(dy, dx) + Math.PI / 2) * (1 - d2 / 14400); if (s === 0) near++; }
        x += Math.cos(a) * 3; y += Math.sin(a) * 3; ctx.lineTo(x, y);
        if (Math.abs(s - head) < 0.5) k.dot(x, y, k.s * 1.6, hsla(k.hue + 40, 90, 75), 0.9);
      }
      ctx.strokeStyle = hsla(k.hue + hh(i, 4) * 50 - 25, 75, 62, 0.55); ctx.stroke();
    }
    return { cell: `${near} 条流线经过指针 120px 漩涡区` };
  } });

const fracDoc = (W, H, k, P, cx, cy, sc) => [(P.x - W / 2) * sc + cx, (P.y - (H + 8) / 2) * sc + cy];
const escape = (zx, zy, cx, cy, N) => { let i = 0, x2 = zx * zx, y2 = zy * zy; while (i < N && x2 + y2 < 16) { zy = 2 * zx * zy + cy; zx = x2 - y2 + cx; x2 = zx * zx; y2 = zy * zy; i++; } return i >= N ? -1 : i + 1 - Math.log2(Math.max(1e-9, Math.log(x2 + y2) / 2 / Math.LN2)); };

FAM.julia = gFam({ title: 'Julia 集', size: { label: '像素块', min: 2, max: 8, step: 1, value: 3, }, count: { label: '最大迭代', min: 16, max: 200, step: 2, value: 70 },
  extra: R('zoom', '缩放', 0.5, 4, 0.05, 1), sizeDoc: '每个计算格子占几个屏幕像素；越大越粗糙但越快', countDoc: '每个点最多迭代几次；越多细节越丰富', presets: { 粗糙: { size: 7 }, 精细: { size: 2, count: 160 }, 少迭代: { count: 18 }, 放大: { zoom: 3.5 } },
  explain: 'Julia 集：对复平面上每个点 z 反复做 z ← z² + c，数一数多少步后 |z| 超过 2（「逃逸」）。逃得越慢颜色越亮，永不逃逸的点画成暗色。常数 c 随时间绕圈，指针会微调 c，所以图形不断变形。', formula: 'z_{n+1} = z_n² + c，c 沿主心形线边界移动: c = 0.97·(e^{iθ}/2 − e^{2iθ}/4)', formula2: '颜色 ∝ 逃逸步数 n（平滑处理）',
  draw(ctx, W, H, t, C, P, k) {
    const a = t * 0.2 + (P.x / W - 0.5) * 0.3, q = 0.97 + (P.y / H - 0.5) * 0.06, cr = q * (Math.cos(a) / 2 - Math.cos(2 * a) / 4), ci = q * (Math.sin(a) / 2 - Math.sin(2 * a) / 4), sc = 3.2 / Math.min(W, H) / k.x, N = k.n;
    const Lp = k.lut('j' + k.hue, (u) => [k.hue + u * 120, 0.85, 0.08 + u * 0.62]), In = hsl2rgb(k.hue + 180, 0.5, 0.18);
    k.field(k.s, (x, y, out) => { const v = escape((x - W / 2) * sc, (y - (H + 8) / 2) * sc, cr, ci, N); if (v < 0) { out[0] = In[0]; out[1] = In[1]; out[2] = In[2]; } else setPx(out, Lp, 1 - Math.exp(-v / 9)); });
    const [zx, zy] = fracDoc(W, H, k, P, 0, 0, sc), v = escape(zx, zy, cr, ci, N);
    return { mode: `c = ${fmt(cr, 2)} ${ci < 0 ? '−' : '+'} ${fmt(Math.abs(ci), 2)}i`, cell: v < 0 ? `不逃逸（属于 Julia 集内部，上限 ${N} 次）` : `迭代 ${Math.round(v)} 次后逃逸（上限 ${N}）` };
  } });

FAM.mandelbrot = gFam({ title: 'Mandelbrot 集', size: { label: '像素块', min: 2, max: 8, step: 1, value: 3 }, count: { label: '基础迭代', min: 16, max: 200, step: 2, value: 60 },
  extra: R('depth', '缩放深度', 1, 12, 0.5, 7), color: '#f59e0b', sizeDoc: '每个计算格子占几个屏幕像素', countDoc: '迭代上限的起点；放大越深会自动加更多迭代', extraDoc: '来回缩放时最大放大到 2^深度 倍', presets: { 粗糙: { size: 7 }, 精细: { size: 2 }, 浅游: { depth: 2 }, 深潜: { depth: 12 } },
  explain: 'Mandelbrot 集：对每个点 c，从 z = 0 开始反复做 z ← z² + c，看会不会逃到无穷远。画面在「海马谷」附近来回缩放，越放大边界的细节越多——这就是分形的自相似。', formula: 'z_{n+1} = z_n² + c，z_0 = 0', formula2: '放大倍数 = 2^(深度·(1 − cos 0.15t)/2)',
  draw(ctx, W, H, t, C, P, k) {
    const z = Math.pow(2, k.x * (1 - Math.cos(t * 0.15)) / 2), cx = -0.743643887 + (P.x / W - 0.5) * 0.02 / z, cy = 0.131825904 + (P.y / H - 0.5) * 0.02 / z, sc = 3 / Math.min(W, H) / z, N = Math.round(k.n + Math.log2(z) * 12);
    const Lp = k.lut('m' + k.hue, (u) => [k.hue - 30 + u * 200, 0.9, 0.05 + 0.6 * Math.pow(u, 0.8)]);
    k.field(k.s, (x, y, out) => { const v = escape(0, 0, (x - W / 2) * sc + cx, (y - (H + 8) / 2) * sc + cy, N); if (v < 0) { out[0] = 6; out[1] = 6; out[2] = 16; } else setPx(out, Lp, fract(v / 40)); });
    const [px, py] = fracDoc(W, H, k, P, cx, cy, sc), v = escape(0, 0, px, py, N);
    return { mode: `放大 ${fmt(z, z < 10 ? 1 : 0)} 倍`, n: `${k.n}（当前上限 ${N}）`, cell: v < 0 ? `不逃逸：点在集合内（上限 ${N} 次）` : `迭代 ${Math.round(v)} 次后逃逸（上限 ${N}）` };
  } });

FAM.gol = gFam({ title: '生命游戏', size: { label: '格子大小', min: 4, max: 20, step: 1, value: 8 }, count: { label: '初始密度 %', min: 5, max: 60, step: 1, value: 28 },
  extra: T('trail', '死亡拖影', true), color: '#34d399', spdLabel: '演化速度', countDoc: '开局时活细胞占格子的百分比；改动会重新开局', extraDoc: '打开后刚死去的细胞会留下渐暗的痕迹', presets: { 疏: { count: 8 }, 密: { count: 55 }, 大格: { size: 18 }, 小格: { size: 4 }, 无拖影: { trail: false } },
  explain: 'Conway 生命游戏：每个格子是活或死。每一代同时按规则更新：活细胞周围有 2 或 3 个活邻居就继续活，否则死去；死格子恰好有 3 个活邻居就诞生新细胞。指针划过会撒下新细胞，系统也会定期投放「滑翔机」。', formula: '活: 邻居 ∈ {2, 3} → 存活', formula2: '死: 邻居 = 3 → 诞生',
  draw(ctx, W, H, t, C, P, k, st) {
    const cs = Math.round(k.s), cols = Math.max(8, Math.floor(W / cs)), rows = Math.max(6, Math.floor((H - 8) / cs)), key = `${cols}x${rows}:${k.n}`;
    if (st.key !== key) { st.key = key; st.cols = cols; st.rows = rows; st.cur = new Uint8Array(cols * rows); st.prev = new Uint8Array(cols * rows); st.age = new Float32Array(cols * rows); st.gen = 0; st.acc = 0; for (let i = 0; i < st.cur.length; i++) st.cur[i] = Math.random() * 100 < k.n ? 1 : 0; st.prev.set(st.cur); }
    const step = () => {
      const { cur } = st, nx = new Uint8Array(cols * rows);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) c += cur[((y + j + rows) % rows) * cols + ((x + i + cols) % cols)]; const id = y * cols + x; nx[id] = c === 3 || (c === 2 && cur[id]) ? 1 : 0; if (cur[id] && !nx[id]) st.age[id] = 1; }
      const gx = Math.floor(P.x / cs), gy = Math.floor((P.y - 8) / cs); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (Math.random() < 0.45 && gx + i >= 0 && gx + i < cols && gy + j >= 0 && gy + j < rows) nx[(gy + j) * cols + gx + i] = 1;
      if (st.gen % 20 === 0) { const ox = Math.floor(Math.random() * (cols - 3)), oy = Math.floor(Math.random() * (rows - 3)); [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(([i, j]) => { nx[(oy + j) * cols + ox + i] = 1; }); }
      st.prev = st.cur; st.cur = nx; st.gen++;
    };
    st.acc += st.dt; const T0 = 0.12; while (st.acc > T0) { st.acc -= T0; step(); }
    const p = smooth(clamp(st.acc / T0, 0, 1)); let alive = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const id = y * cols + x, a = st.prev[id] + (st.cur[id] - st.prev[id]) * p; alive += st.cur[id];
      if (k.x && st.age[id] > 0.02 && a < 0.5) { ctx.fillStyle = hsla(k.hue + 40, 60, 40, st.age[id] * 0.45); ctx.fillRect(x * cs, 8 + y * cs, cs - 1, cs - 1); }
      if (a > 0.02) { ctx.fillStyle = hsla(k.hue + (x + y) * 0.6, 80, 60, a); ctx.fillRect(x * cs, 8 + y * cs, cs - 1, cs - 1); }
    }
    for (let i = 0; i < st.age.length; i++) st.age[i] = Math.max(0, st.age[i] - st.dt * 0.6);
    const gx = clamp(Math.floor(P.x / cs), 0, cols - 1), gy = clamp(Math.floor((P.y - 8) / cs), 0, rows - 1);
    ctx.strokeStyle = hsla(k.hue, 90, 80, 0.8); ctx.lineWidth = 1; ctx.strokeRect(gx * cs - cs, 8 + gy * cs - cs, cs * 3, cs * 3);
    return { mode: `第 ${st.gen} 代 · ${cols}×${rows} 格 · 拖影${k.x ? '开' : '关'}`, n: `${k.n}%`, cell: `格子 (${gx}, ${gy}) ${st.cur[gy * cols + gx] ? '活' : '死'}，全场活细胞 ${alive} 个` };
  } });

FAM.voronoi = gFam({ title: 'Voronoi 图', size: { label: '边线宽度', min: 0, max: 8, step: 0.5, value: 2 }, count: { label: '种子数', min: 3, max: 60, step: 1, value: 18 },
  extra: R('spread', '色相跨度', 0, 240, 5, 90), presets: { 少核: { count: 4 }, 多核: { count: 60 }, 无边: { size: 0 }, 粗边: { size: 7 }, 单色: { spread: 0 } },
  explain: 'Voronoi 图：撒下若干「种子」点，画面上每个位置都归属离它最近的种子，于是平面被分成一块块区域。两块的分界线到两个种子距离相等。种子缓慢漂移，第一个种子跟随指针。', formula: '区域(p) = argmin_i |p − s_i|', formula2: '边线: d₂ − d₁ < 边线宽度（最近与次近距离差）',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sx = new Float32Array(n), sy = new Float32Array(n);
    for (let i = 0; i < n; i++) { sx[i] = (0.5 + 0.45 * Math.sin(t * (0.1 + hh(i, 1) * 0.2) + hh(i, 2) * TAU)) * W; sy[i] = 8 + (0.5 + 0.45 * Math.cos(t * (0.1 + hh(i, 3) * 0.2) + hh(i, 4) * TAU)) * (H - 8); }
    sx[0] = sx[0] * 0.35 + P.x * 0.65; sy[0] = sy[0] * 0.35 + P.y * 0.65;
    const cols = []; for (let i = 0; i < n; i++) cols.push(hsl2rgb(k.hue + (hh(i, 5) - 0.5) * k.x, 0.65, 0.3 + hh(i, 6) * 0.25));
    const ew = k.s, res = 3;
    k.field(res, (x, y, out) => { let d1 = 1e9, d2 = 1e9, b = 0; for (let i = 0; i < n; i++) { const dx = x - sx[i], dy = y - sy[i], d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; b = i; } else if (d < d2) d2 = d; }
      const e = Math.sqrt(d2) - Math.sqrt(d1), c = cols[b], m = ew > 0 ? clamp((e - ew) / 2, 0, 1) : 1, l = 1 - Math.sqrt(d1) / 400 * 0.4;
      out[0] = c[0] * m * l + 230 * (1 - m); out[1] = c[1] * m * l + 235 * (1 - m); out[2] = c[2] * m * l + 250 * (1 - m); });
    for (let i = 0; i < n; i++) k.dot(sx[i], sy[i], 2.5, '#ffffff', 0.9);
    let b = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = (P.x - sx[i]) ** 2 + (P.y - sy[i]) ** 2; if (d < bd) { bd = d; b = i; } }
    return { cell: `指针属于第 ${b + 1} 号区域，离种子 ${Math.round(Math.sqrt(bd))}px` };
  } });

FAM.tree = gFam({ title: '递归分形树', size: { label: '树干粗细', min: 2, max: 18, step: 0.5, value: 8 }, count: { label: '递归深度', min: 2, max: 11, step: 1, value: 9 },
  extra: R('angle', '分叉角', 8, 60, 1, 26), color: '#a3e635', countDoc: '树枝分叉的层数；每多一层枝条数翻倍', presets: { 矮: { count: 4 }, 茂密: { count: 11 }, 窄冠: { angle: 10 }, 宽冠: { angle: 58 }, 细枝: { size: 3 } },
  explain: '递归树：画一根树枝，然后在末端左右各画一根更短的树枝，再对每根新树枝重复同样的事——这就是「递归」。风让每层枝条轻轻摆动，指针左右移动会让整棵树朝那边倾斜。', formula: '子枝长度 = 0.72 × 父枝长度', formula2: '子枝角度 = 父角 ± 分叉角 + 风·sin(t + 层)',
  draw(ctx, W, H, t, C, P, k) {
    const D = k.n, lean = (P.x / W - 0.5) * 0.5; let count = 0; ctx.lineCap = 'round';
    const L0 = (H - 8) * 0.27, aR = k.x * Math.PI / 180;
    const br = (x, y, a, len, d, w) => {
      const sw = Math.sin(t * 1.3 + d * 0.7 + x * 0.01) * 0.06 * (D - d + 1) / D, aa = a + sw + lean / D, x2 = x + Math.sin(aa) * len, y2 = y - Math.cos(aa) * len;
      ctx.strokeStyle = hsla(k.hue - 50 + (d / D) * 70, 60, 25 + (d / D) * 40); ctx.lineWidth = Math.max(0.5, w); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); count++;
      if (d >= D) { k.dot(x2, y2, Math.max(1.5, k.s * 0.35), hsla(k.hue + 20 + hh(count, 1) * 40, 85, 62), 0.85); return; }
      br(x2, y2, aa - aR, len * 0.72, d + 1, w * 0.7); br(x2, y2, aa + aR, len * 0.72, d + 1, w * 0.7);
    };
    br(W / 2, H - 4, 0, L0, 1, k.s);
    return { mode: `${count} 根枝条`, cell: `倾斜 ${fmt(lean * 57.3, 1)}°，指针旁 ${k.near} 片叶` };
  } });

FAM.sierpinski = gFam({ title: 'Sierpinski 三角', size: { label: '描边粗细', min: 0.3, max: 4, step: 0.1, value: 1 }, count: { label: '递归层数', min: 0, max: 8, step: 1, value: 5 },
  extra: T('fill', '填充', true), color: '#f472b6', countDoc: '把三角形一分为三的次数；每层数量 ×3', presets: { 浅: { count: 1 }, 深: { count: 8 }, 线框: { fill: false }, 粗线: { size: 3.5 } },
  explain: 'Sierpinski 三角：把一个三角形三条边的中点连起来，挖掉中间那个，剩下 3 个小三角；再对每个小三角重复。层数越多越像「镂空」。每层会轻轻呼吸缩放，指针所在的小三角会被高亮。', formula: '第 n 层三角形数 = 3ⁿ', formula2: '面积占比 = (3/4)ⁿ → 0（分形维数 log3/log2 ≈ 1.585）',
  draw(ctx, W, H, t, C, P, k) {
    const D = k.n, cx = W / 2, cy = (H + 8) / 2 + (H - 8) * 0.08, R0 = Math.min(W * 0.55, (H - 8) * 0.62), rot = Math.sin(t * 0.2) * 0.15; let hit = -1, cnt = 0;
    const pt = (a) => [cx + Math.sin(a + rot) * R0, cy - Math.cos(a + rot) * R0];
    const inTri = (p, a, b, c) => { const s = (u, v, w) => (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]); const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    const Pp = [P.x, P.y];
    const tri = (a, b, c, d, id) => {
      if (d === 0) { const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3], f = 0.92 + 0.08 * Math.sin(t * 1.5 + id * 0.7); const q = [a, b, c].map((v) => [g[0] + (v[0] - g[0]) * f, g[1] + (v[1] - g[1]) * f]);
        const h = inTri(Pp, a, b, c); if (h) hit = cnt; cnt++;
        ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath();
        if (k.x) { ctx.fillStyle = hsla(k.hue + (g[1] / H) * 60, 75, h ? 75 : 52, h ? 1 : 0.85); ctx.fill(); }
        ctx.strokeStyle = hsla(k.hue + 30, 90, 80, 0.9); ctx.lineWidth = k.s; ctx.stroke(); return; }
      const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2], ab = m(a, b), bc = m(b, c), ca = m(c, a);
      tri(a, ab, ca, d - 1, id * 3); tri(ab, b, bc, d - 1, id * 3 + 1); tri(ca, bc, c, d - 1, id * 3 + 2);
    };
    tri(pt(0), pt(TAU / 3), pt(2 * TAU / 3), D, 1);
    return { mode: `${cnt} 个小三角`, cell: hit >= 0 ? `指针在第 ${hit + 1} 个小三角内（共 ${cnt} 个）` : `指针在镂空处或三角形外部` };
  } });

FAM.circles = gFam({ title: '圆形填充', size: { label: '最大半径', min: 6, max: 80, step: 1, value: 36 }, count: { label: '尝试次数', min: 20, max: 900, step: 10, value: 400 },
  extra: R('gap', '间距', 0, 10, 0.5, 2), color: '#22d3ee', countDoc: '随机放圆的尝试次数，越多空隙越少', presets: { 疏: { count: 40 }, 密: { count: 900 }, 小圆: { size: 10 }, 大圆: { size: 78 }, 紧贴: { gap: 0 } },
  explain: '圆形填充（Circle Packing）：随机选一个点，算出它离最近的圆和边框还有多远，就在那里放一个刚好不重叠的圆；重复很多次，大圆先占位，小圆填缝。圆会轻轻呼吸，指针附近的圆变亮。', formula: 'r = min(最大半径, 到边框距离, min_j(|p − c_j| − r_j) − 间距)', formula2: 'r < 2 则放弃这个点',
  draw(ctx, W, H, t, C, P, k, st) {
    const key = `${k.n}|${k.s}|${k.x}|${W}|${H}`;
    if (st.ck !== key) { st.ck = key; const cs = []; for (let i = 0; i < k.n; i++) { const x = hh(i, 1) * W, y = 8 + hh(i, 2) * (H - 8); let r = Math.min(k.s, x, W - x, y - 8, H - y); for (const c of cs) { r = Math.min(r, Math.hypot(x - c[0], y - c[1]) - c[2] - k.x); if (r < 2) break; } if (r >= 2) cs.push([x, y, r]); } st.cs = cs; }
    let hit = null;
    st.cs.forEach(([x, y, r], i) => { const f = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.2 + i * 0.9)), d = Math.hypot(P.x - x, P.y - y), on = d < r; if (on) hit = r;
      ctx.beginPath(); ctx.arc(x, y, r * f, 0, TAU); ctx.fillStyle = hsla(k.hue + (r / k.s) * 80 - 40, 70, on ? 70 : 40 + 20 * (r / k.s), on ? 0.95 : 0.75); ctx.fill(); ctx.strokeStyle = hsla(k.hue, 80, 78, 0.5); ctx.lineWidth = 1; ctx.stroke(); if (d < 60) k.near++; });
    return { mode: `放下 ${st.cs.length} 个圆`, cell: hit ? `指针在半径 ${fmt(hit, 1)}px 的圆内` : `指针在空隙处，60px 内 ${k.near} 个圆` };
  } });

FAM.terrain = gFam({ title: '噪声地形', size: { label: '起伏高度', min: 10, max: 120, step: 1, value: 60 }, count: { label: '山脊线数', min: 10, max: 90, step: 1, value: 44 },
  extra: R('scale', '噪声尺度', 0.5, 5, 0.05, 1.8), color: '#38bdf8', countDoc: '从远到近画多少条横向剖面线', presets: { 丘陵: { size: 20 }, 高山: { size: 115 }, 少线: { count: 12 }, 细纹: { scale: 4.5 } },
  explain: '噪声地形：把平滑噪声当作「海拔」，一行行横着取样画成折线，远处的线在上、近处在下，并用纯色遮住后面的线，就形成有前后遮挡的山脉（类似 Joy Division 封面）。地形向前滚动，指针处会隆起一座小山。', formula: '海拔 h(x, z) = fbm(x·s, z·s − 0.3t)', formula2: '屏幕 y = 基线 − 起伏高度 · h · 透视',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sc = k.x / 300, top = 8 + (H - 8) * 0.12, bot = H - 6; let ph = 0;
    for (let r = 0; r < n; r++) {
      const f = r / (n - 1), y0 = top + (bot - top) * f, z = r * 0.12 - t * 0.3, amp = k.s * (0.4 + 0.6 * f);
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) { const bump = Math.exp(-((x - P.x) ** 2 + (y0 - P.y) ** 2) / 4000); const h = fbm(x * sc, z, 0, 3) * 1.6 - 0.5 + bump * 0.8, yy = y0 - Math.max(0, h) * amp; ctx.lineTo(x, yy); if (Math.abs(x - P.x) < 3 && Math.abs(y0 - P.y) < (bot - top) / n) ph = h; }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = '#060a14'; ctx.fill();
      ctx.strokeStyle = hsla(k.hue + f * 40, 80, 35 + f * 35, 0.5 + 0.5 * f); ctx.lineWidth = 1.3; ctx.stroke();
    }
    return { cell: `指针处海拔 ${fmt(Math.max(0, ph), 2)}（0 = 平地）` };
  } });

FAM.walk = gFam({ title: '随机游走', size: { label: '步长', min: 2, max: 14, step: 0.5, value: 5 }, count: { label: '游走者数', min: 1, max: 60, step: 1, value: 16 },
  extra: R('tail', '尾迹长度', 20, 500, 10, 180), color: '#facc15', spdLabel: '行走速度', extraDoc: '保留最近多少步的轨迹', presets: { 独行: { count: 1 }, 人群: { count: 60 }, 小步: { size: 2 }, 大步: { size: 13 }, 长尾: { tail: 500 } },
  explain: '随机游走：每个游走者每一步随机选上、下、左、右之一走一步，像醉汉走路。走 n 步后离起点的平均距离约等于 √n × 步长——走得多但离得不远。碰到指针附近会被弹开，走出边界从另一边回来。', formula: 'p_{n+1} = p_n + 步长 · 随机方向 ∈ {↑, ↓, ←, →}', formula2: '平均位移 ≈ 步长 · √n',
  draw(ctx, W, H, t, C, P, k, st) {
    if (!st.w || st.w.length !== k.n) { const old = st.w || []; st.w = []; for (let i = 0; i < k.n; i++) st.w.push(old[i] || { x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: (H + 8) / 2 + (Math.random() - 0.5) * H * 0.4, sx: 0, sy: 0, n: 0, tr: [] }); st.w.forEach((w) => { w.sx = w.x; w.sy = w.y; w.n = 0; }); }
    st.acc = (st.acc || 0) + st.dt * 30; let steps = Math.floor(st.acc); st.acc -= steps; steps = Math.min(steps, 6); const L = Math.round(k.x);
    for (const w of st.w) {
      for (let s = 0; s < steps; s++) { let dir = Math.floor(Math.random() * 4); const dx = w.x - P.x, dy = w.y - P.y; if (dx * dx + dy * dy < 2500) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 1) : (dy > 0 ? 2 : 3);
        w.x += [k.s, -k.s, 0, 0][dir]; w.y += [0, 0, k.s, -k.s][dir]; let wrap = false;
        if (w.x < 0) { w.x += W; wrap = true; } if (w.x > W) { w.x -= W; wrap = true; } if (w.y < 8) { w.y += H - 8; wrap = true; } if (w.y > H) { w.y -= H - 8; wrap = true; }
        w.tr.push([w.x, w.y, wrap]); w.n++; }
      if (w.tr.length > L) w.tr.splice(0, w.tr.length - L);
    }
    let md = 0;
    st.w.forEach((w, i) => { const c = k.hue + (i / Math.max(1, k.n)) * 80 - 40; ctx.lineWidth = 1.4; const tl = w.tr.length, B = 6;
      for (let b = 0; b < B; b++) { const j0 = Math.max(1, Math.floor(tl * b / B)), j1 = Math.floor(tl * (b + 1) / B); ctx.strokeStyle = hsla(c, 85, 60, ((b + 1) / B) * 0.9); ctx.beginPath(); for (let j = j0; j < j1 + (b < B - 1 ? 1 : 0) && j < tl; j++) { if (w.tr[j][2]) continue; ctx.moveTo(w.tr[j - 1][0], w.tr[j - 1][1]); ctx.lineTo(w.tr[j][0], w.tr[j][1]); } ctx.stroke(); }
      k.dot(w.x, w.y, 3, hsla(c, 90, 75), 1); md += Math.hypot(w.x - w.sx, w.y - w.sy); });
    const avgN = st.w.reduce((a, w) => a + w.n, 0) / st.w.length;
    return { mode: `已走 ${Math.round(avgN)} 步 · 尾迹 ${L} 步`, cell: `平均离起点 ${Math.round(md / st.w.length)}px，√n·步长 ≈ ${Math.round(Math.sqrt(avgN) * k.s)}px` };
  } });

const LSYS = {};
const lsys = (n) => { if (!LSYS[n]) { let s = 'F'; for (let i = 0; i < n; i++) s = s.replace(/F/g, 'FF+[+F-F-F]-[-F+F+F]'); LSYS[n] = { s, segs: (s.match(/F/g) || []).length }; } return LSYS[n]; };
FAM.lsystem = gFam({ title: 'L-System 植物', size: { label: '线宽', min: 0.3, max: 4, step: 0.1, value: 1.1 }, count: { label: '迭代次数', min: 1, max: 5, step: 1, value: 4 },
  extra: R('angle', '转角', 10, 45, 0.5, 22.5), color: '#4ade80', countDoc: '把规则替换几次；每多一次线段约 ×8', presets: { 幼苗: { count: 2 }, 繁茂: { count: 5 }, 窄叶: { angle: 12 }, 宽叶: { angle: 40 }, 粗干: { size: 3.5 } },
  explain: 'L-System：从字符串 "F" 开始，按规则把每个 F 替换成一串更长的指令，反复几次；然后让「海龟」照着画：F 前进画线，+/− 转弯，[ ] 记住/回到分叉点。植物会从根部慢慢生长，风让枝条摇摆。', formula: '规则: F → FF+[+F−F−F]−[−F+F+F]', formula2: '+ / − : 转动 ±转角，[ ] : 压栈/出栈',
  draw(ctx, W, H, t, C, P, k) {
    const { s, segs } = lsys(k.n), len = (H - 8) * 0.9 / Math.pow(2.35, k.n), aR = k.x * Math.PI / 180, ph = fract(t / 12), grow = Math.min(1, ph * 1.6), fade = ph > 0.9 ? 1 - (ph - 0.9) * 10 : 1, lim = Math.floor(segs * smooth(grow));
    const lean = (P.x / W - 0.5) * 0.25; let x = W / 2, y = H - 4, a = 0, d = 0, drawn = 0; const stack = [];
    ctx.lineWidth = k.s; ctx.lineCap = 'round'; ctx.globalAlpha = fade; ctx.strokeStyle = hsla(k.hue, 70, 55); ctx.beginPath();
    for (let i = 0; i < s.length && drawn < lim; i++) { const ch = s[i];
      if (ch === 'F') { const aa = a + lean * (d + 1) * 0.3 + Math.sin(t * 1.4 + d) * 0.03 * d, nx = x + Math.sin(aa) * len, ny = y - Math.cos(aa) * len; ctx.moveTo(x, y); ctx.lineTo(nx, ny); x = nx; y = ny; drawn++; }
      else if (ch === '+') a += aR; else if (ch === '-') a -= aR; else if (ch === '[') { stack.push([x, y, a, d]); d++; } else if (ch === ']') { [x, y, a, d] = stack.pop(); } }
    ctx.stroke(); ctx.globalAlpha = 1;
    return { mode: `生长 ${Math.round(grow * 100)}%`, n: `${k.n}（${segs} 段）`, cell: `已画 ${drawn} / ${segs} 段，倾斜 ${fmt(lean * 57.3, 1)}°` };
  } });

FAM.interfere = gFam({ title: '波的干涉', size: { label: '波长', min: 8, max: 80, step: 1, value: 28 }, count: { label: '波源数', min: 1, max: 8, step: 1, value: 3 },
  extra: R('decay', '衰减', 0, 3, 0.05, 0.6), color: '#60a5fa', countDoc: '同时发出圆形波的点数（第 1 个跟随指针）', extraDoc: '波随距离变弱的程度', presets: { 单源: { count: 1 }, 多源: { count: 8 }, 短波: { size: 10 }, 长波: { size: 75 }, 无衰减: { decay: 0 } },
  explain: '干涉：每个波源发出一圈圈圆形波。在某一点，把所有波的高度加起来：波峰遇波峰变得更亮（加强），波峰遇波谷互相抵消（变暗），于是出现明暗相间的条纹。第一个波源跟随指针。', formula: '高度 h(p) = Σ cos(2π·rᵢ/λ − 3t) / (1 + 衰减·rᵢ/100)', formula2: 'rᵢ = |p − 波源ᵢ|，λ = 波长',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sx = [], sy = []; for (let i = 0; i < n; i++) { const a = t * 0.15 + (i / n) * TAU; sx.push(i === 0 ? P.x : W / 2 + Math.cos(a) * W * 0.3); sy.push(i === 0 ? P.y : (H + 8) / 2 + Math.sin(a) * (H - 8) * 0.3); }
    const kw = TAU / k.s, dc = k.x / 100, Lp = k.lut('i' + k.hue, (u) => [k.hue + (u - 0.5) * 60, 0.8, 0.04 + u * 0.7]);
    const hAt = (x, y) => { let h = 0; for (let i = 0; i < n; i++) { const dx = x - sx[i], dy = y - sy[i], r = Math.sqrt(dx * dx + dy * dy); h += Math.cos(r * kw - t * 3) / (1 + dc * r); } return h / n; };
    k.field(W * (H - 8) > 120000 ? 5 : 4, (x, y, out) => setPx(out, Lp, 0.5 + hAt(x, y) * 0.5));
    for (let i = 0; i < n; i++) k.dot(sx[i], sy[i], 3, '#ffffff', 0.9);
    const h = hAt(P.x + 20, P.y);
    return { cell: `指针右侧 20px 处振幅 ${fmt(h, 2)}（${h > 0.3 ? '加强' : h < -0.3 ? '反相' : '接近抵消'}）` };
  } });

FAM.diffuse = gFam({ title: '反应扩散', size: { label: '像素块', min: 2, max: 6, step: 1, value: 3 }, count: { label: '每帧迭代', min: 1, max: 24, step: 1, value: 10 },
  extra: R('bands', '色带数', 1, 6, 0.5, 2), color: '#e879f9', sizeDoc: '每个模拟格子占几个屏幕像素；改动会重新开始', countDoc: '每一帧计算几步化学反应，越多演化越快', extraDoc: '把浓度映射成颜色时重复几次色环', presets: { 粗格: { size: 6 }, 细格: { size: 2 }, 慢: { count: 2 }, 快: { count: 24 }, 多色带: { bands: 6 } },
  explain: 'Gray-Scott 反应扩散：两种「化学物质」A 和 B 在格子里扩散并反应（A + 2B → 3B），A 不断被补充，B 不断被移除。从左到右补充速度 f 逐渐变大，于是会长出斑点、条纹、迷宫等不同图案。指针会滴入 B。', formula: '∂A/∂t = Dₐ∇²A − AB² + f(1 − A)', formula2: '∂B/∂t = D_b∇²B + AB² − (k + f)B',
  draw(ctx, W, H, t, C, P, k, st) {
    const res = k.s; let gw = Math.ceil(W / res), gh = Math.ceil((H - 8) / res); const key = `${gw}x${gh}`;
    if (st.rk !== key) { st.rk = key; st.A = new Float32Array(gw * gh).fill(1); st.B = new Float32Array(gw * gh); st.A2 = new Float32Array(gw * gh); st.B2 = new Float32Array(gw * gh);
      for (let s = 0; s < 14; s++) { const cx = Math.floor(Math.random() * gw), cy = Math.floor(Math.random() * gh); for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = cx + i, y = cy + j; if (x >= 0 && x < gw && y >= 0 && y < gh) st.B[y * gw + x] = 1; } } }
    const drop = (px, py) => { const cx = Math.floor(px / res), cy = Math.floor((py - 8) / res); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i, y = cy + j; if (x >= 0 && x < gw && y >= 0 && y < gh) st.B[y * gw + x] = Math.max(st.B[y * gw + x], 0.8); } };
    drop(P.x, P.y); drop(W / 2 + Math.sin(t * 0.7) * W * 0.4, (H + 8) / 2 + Math.cos(t * 0.9) * (H - 8) * 0.4);
    const it = Math.min(k.n, Math.floor(400000 / (gw * gh)));
    const sp = num(C.speed, 0.9) > 0 ? it : 0;
    for (let n = 0; n < sp; n++) { const { A, B, A2, B2 } = st;
      for (let y = 0; y < gh; y++) { const ym = (y - 1 + gh) % gh * gw, yp = (y + 1) % gh * gw, y0 = y * gw;
        for (let x = 0; x < gw; x++) { const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw, id = y0 + x, a = A[id], b = B[id];
          const la = (A[y0 + xm] + A[y0 + xp] + A[ym + x] + A[yp + x]) * 0.2 + (A[ym + xm] + A[ym + xp] + A[yp + xm] + A[yp + xp]) * 0.05 - a;
          const lb = (B[y0 + xm] + B[y0 + xp] + B[ym + x] + B[yp + x]) * 0.2 + (B[ym + xm] + B[ym + xp] + B[yp + xm] + B[yp + xp]) * 0.05 - b;
          const f = 0.022 + 0.04 * x / gw, kk = 0.0615, abb = a * b * b;
          A2[id] = clamp(a + la - abb + f * (1 - a), 0, 1); B2[id] = clamp(b + 0.5 * lb + abb - (kk + f) * b, 0, 1); } }
      st.A = A2; st.A2 = A; st.B = B2; st.B2 = B; }
    const Lp = k.lut('d' + k.hue + '|' + k.x, (u) => [k.hue + Math.sin(u * k.x * Math.PI) * 50, 0.75, 0.06 + 0.6 * Math.pow(u, 0.7)]);
    k.raw(res, (D, fw, fh) => { for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const v = clamp((st.A[y * gw + x] - st.B[y * gw + x]) , 0, 1), i = Math.round((1 - v) * 255) * 3, o = (y * fw + x) * 4; D[o] = Lp[i]; D[o + 1] = Lp[i + 1]; D[o + 2] = Lp[i + 2]; } });
    const gx = clamp(Math.floor(P.x / res), 0, gw - 1), gy = clamp(Math.floor((P.y - 8) / res), 0, gh - 1);
    return { mode: `补充率 f = ${fmt(0.022 + 0.04 * gx / gw, 3)}（指针列）`, cell: `浓度 A = ${fmt(st.A[gy * gw + gx], 2)}，B = ${fmt(st.B[gy * gw + gx], 2)}` };
  } });

FAM.mosaic = gFam({ title: '噪声马赛克', size: { label: '砖块大小', min: 8, max: 50, step: 1, value: 22 }, count: { label: '色阶数', min: 2, max: 12, step: 1, value: 6 },
  extra: R('gap', '缝隙', 0, 10, 0.5, 2), color: '#fb7185', countDoc: '把噪声值分成几档颜色', presets: { 小砖: { size: 9 }, 大砖: { size: 48 }, 两色: { count: 2 }, 多色: { count: 12 }, 无缝: { gap: 0 } },
  explain: '马赛克：把画面切成方砖，每块砖取中心点的噪声值，再按「色阶数」四舍五入成几档颜色（量化）。噪声随时间流动，所以色块像潮水一样变化；指针附近的砖块会浮起变亮。', formula: 'v = noise(砖中心·0.01, 0.2t)', formula2: '色阶 = floor(v · 色阶数)，颜色 = 主色 + 色阶 · 25°',
  draw(ctx, W, H, t, C, P, k) {
    const s = k.s, g = k.x, L = k.n; let cl = 0;
    for (let y = 8; y < H; y += s) for (let x = 0; x < W; x += s) {
      const cx = x + s / 2, cy = y + s / 2, v = clamp(fbm(cx * 0.008, cy * 0.008, t * 0.2, 2) * 1.6 - 0.3, 0, 0.999), lv = Math.floor(v * L), d = Math.hypot(cx - P.x, cy - P.y), lift = Math.max(0, 1 - d / 90);
      if (d < s * 0.71) cl = lv;
      const inset = g / 2 - lift * g * 0.4; ctx.fillStyle = hsla(k.hue + lv * 25, 70, 30 + (lv / Math.max(1, L - 1)) * 35 + lift * 18);
      rrect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, Math.min(4, s * 0.15)); ctx.fill();
    }
    return { cell: `指针处砖块：第 ${cl + 1} / ${L} 级色阶` };
  } });

FAM['polar-flower'] = gFam({ title: '极坐标花', size: { label: '线宽', min: 0.4, max: 5, step: 0.1, value: 1.6 }, count: { label: '花瓣数', min: 2, max: 16, step: 1, value: 6 },
  extra: R('layers', '花层数', 1, 8, 1, 4), color: '#f0abfc', presets: { 三瓣: { count: 3 }, 多瓣: { count: 16 }, 单层: { layers: 1 }, 重瓣: { layers: 8 }, 粗线: { size: 4.5 } },
  explain: '极坐标花（玫瑰线）：用「角度 θ + 半径 r」来画图。让 r = |cos(k/2 · θ)|，θ 转一圈时半径鼓起 k 次，就得到 k 片花瓣。多层花瓣逐层缩小、错开旋转；指针越靠近中心花开得越大。', formula: 'r(θ) = R · |cos(k/2 · θ)|，k = 花瓣数', formula2: 'x = r·cos θ，y = r·sin θ',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = (H + 8) / 2, dP = Math.hypot(P.x - cx, P.y - cy), open = 0.75 + 0.25 * clamp(1 - dP / Math.min(W, H), 0, 1), R0 = Math.min(W, H - 8) * 0.46 * open, K = k.n, Lr = Math.round(k.x);
    ctx.lineWidth = k.s;
    for (let l = 0; l < Lr; l++) { const sc = 1 - l / (Lr + 1) * 0.8, rot = t * 0.2 * (l % 2 ? -1 : 1) + l * Math.PI / K, br = 0.92 + 0.08 * Math.sin(t * 1.5 + l);
      ctx.beginPath(); for (let i = 0; i <= 360; i++) { const th = (i / 360) * TAU, r = R0 * sc * br * Math.abs(Math.cos(K / 2 * th)); const x = cx + Math.cos(th + rot) * r, y = cy + Math.sin(th + rot) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fillStyle = hsla(k.hue + l * 18, 75, 55, 0.12); ctx.fill(); ctx.strokeStyle = hsla(k.hue + l * 18, 85, 50 + l * 5, 0.9); ctx.stroke(); }
    k.dot(cx, cy, 4, '#fff7ed', 1);
    const th = Math.atan2(P.y - cy, P.x - cx);
    return { mode: `${K} 瓣 × ${Lr} 层`, cell: `指针角度 θ = ${Math.round((th * 180 / Math.PI + 360) % 360)}°，开放度 ${fmt(open, 2)}` };
  } });

FAM.tri = gFam({ title: '低多边形三角网', size: { label: '边线粗细', min: 0, max: 3, step: 0.1, value: 0.6 }, count: { label: '网格列数', min: 4, max: 30, step: 1, value: 14 },
  extra: R('jitter', '顶点抖动', 0, 1, 0.02, 0.5), color: '#a78bfa', countDoc: '横向有几列顶点，越多三角形越小', presets: { 粗网: { count: 5 }, 细网: { count: 30 }, 规整: { jitter: 0 }, 无边: { size: 0 }, 粗边: { size: 2.8 } },
  explain: '低多边形（Low Poly）：在网格上放顶点，并让每个顶点随噪声轻轻抖动；每个方格沿对角线切成两个三角形。三角形的亮度取决于它离「光源」（指针）的距离，于是出现立体折面的效果。', formula: '顶点 = 网格点 + 抖动 · 格宽 · (noise − 0.5)', formula2: '亮度 ∝ 1 − |三角中心 − 指针| / 400',
  draw(ctx, W, H, t, C, P, k) {
    const cols = k.n, cw = W / cols, rows = Math.max(2, Math.round((H - 8) / cw)), ch = (H - 8) / rows, V = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows, jx = edgeX ? 0 : (noise3(i * 0.7, j * 0.7, t * 0.3) - 0.5) * cw * k.x * 1.4, jy = edgeY ? 0 : (noise3(i * 0.7 + 50, j * 0.7, t * 0.3) - 0.5) * ch * k.x * 1.4; V.push([i * cw + jx, 8 + j * ch + jy]); }
    let cnt = 0, hit = -1; ctx.lineWidth = k.s; ctx.strokeStyle = 'rgba(226,232,240,0.35)';
    const face = (a, b, c) => { const gx = (a[0] + b[0] + c[0]) / 3, gy = (a[1] + b[1] + c[1]) / 3, d = Math.hypot(gx - P.x, gy - P.y), l = clamp(1 - d / 400, 0, 1);
      if (d < Math.min(cw, ch) * 0.5) hit = cnt; cnt++;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fillStyle = hsla(k.hue + (gy / H) * 40 - 20, 55, 14 + l * 50 + hh(cnt, 1) * 6); ctx.fill(); if (k.s > 0.05) ctx.stroke(); };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = V[j * (cols + 1) + i], b = V[j * (cols + 1) + i + 1], c = V[(j + 1) * (cols + 1) + i], d = V[(j + 1) * (cols + 1) + i + 1]; if ((i + j) % 2) { face(a, b, d); face(a, d, c); } else { face(a, b, c); face(b, d, c); } }
    return { mode: `${cnt} 个三角形`, cell: hit >= 0 ? `指针在第 ${hit + 1} 个三角形上（最亮）` : `指针位于三角形边线附近` };
  } });

FAM.subdiv = gFam({ title: '递归细分', size: { label: '分隔线宽', min: 1, max: 10, step: 0.5, value: 4 }, count: { label: '递归深度', min: 1, max: 9, step: 1, value: 6 },
  extra: R('fill', '填色比例', 0, 1, 0.02, 0.45), color: '#ef4444', countDoc: '矩形最多被切分几次', extraDoc: '有多少比例的小矩形涂上彩色（其余为深色）', presets: { 浅: { count: 2 }, 深: { count: 9 }, 细线: { size: 1 }, 全彩: { fill: 1 }, 素色: { fill: 0 } },
  explain: '递归细分（蒙德里安风格）：把一个矩形沿长边切成两块，再对每块重复，直到达到深度或随机决定停下。切分位置随时间缓慢移动，所以格子会伸缩；指针所在的矩形会高亮。', formula: '切分位置 = 0.5 + 0.3·sin(0.4t + 种子)', formula2: '叶子数 ≤ 2^深度',
  draw(ctx, W, H, t, C, P, k) {
    let leaves = 0, hit = null; const D = k.n;
    const go = (x, y, w, h, d, id) => {
      if (d >= D || (d > 2 && hh(id * 1.37 + d, 3) < 0.1) || w < 12 || h < 12) { leaves++; const on = P.x >= x && P.x < x + w && P.y >= y && P.y < y + h; if (on) hit = [w, h];
        const f = hh(id, 5) < k.x; ctx.fillStyle = on ? hsla(k.hue + 20, 90, 70) : f ? hsla(k.hue + [0, 40, 200, 0][Math.floor(hh(id, 6) * 4)], 75, 52) : hsla(k.hue, 15, 12 + hh(id, 7) * 8); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = k.s; ctx.strokeRect(x, y, w, h); return; }
      const r = 0.5 + 0.3 * Math.sin(t * 0.4 + hh(id, 1) * TAU);
      if (w > h) { const a = w * r; go(x, y, a, h, d + 1, id * 2); go(x + a, y, w - a, h, d + 1, id * 2 + 1); } else { const a = h * r; go(x, y, w, a, d + 1, id * 2); go(x, y + a, w, h - a, d + 1, id * 2 + 1); }
    };
    go(0, 8, W, H - 8, 0, 1);
    return { mode: `${leaves} 个矩形 · 填色 ${Math.round(k.x * 100)}%`, cell: hit ? `指针所在矩形 ${Math.round(hit[0])}×${Math.round(hit[1])}px` : '指针在画布外' };
  } });

FAM.contour = gFam({ title: '等高线', size: { label: '线宽', min: 0.5, max: 4, step: 0.1, value: 1.4 }, count: { label: '等高线数', min: 3, max: 30, step: 1, value: 12 },
  extra: R('scale', '噪声尺度', 0.5, 5, 0.05, 1.6), color: '#2dd4bf', presets: { 稀疏: { count: 4 }, 密集: { count: 30 }, 粗线: { size: 3.8 }, 细碎: { scale: 4.5 }, 平缓: { scale: 0.6 } },
  explain: '等高线：把噪声值当作地图上的高度，在高度恰好等于 1/n、2/n… 的地方画线，就像地图上的等高线。线越密说明坡越陡。高度场缓慢流动，指针处会隆起一座小山。', formula: '高度 h = fbm(x·s, y·s, 0.08t) + 山丘(指针)', formula2: '画线条件: |fract(h·n) − 0.5| > 0.5 − 线宽·n·0.004',
  draw(ctx, W, H, t, C, P, k) {
    const n = k.n, sc = k.x / 300, hAt = (x, y) => fbm(x * sc, y * sc, t * 0.08, 3) + 0.35 * Math.exp(-((x - P.x) ** 2 + (y - P.y) ** 2) / 5000);
    const Lp = k.lut('c' + k.hue, (u) => [k.hue + u * 60 - 30, 0.6, 0.05 + u * 0.2]), Ll = hsl2rgb(k.hue, 0.85, 0.65), w = k.s * 0.012;
    k.field(2, (x, y, out) => { const h = hAt(x, y), f = fract(h * n), e = Math.min(f, 1 - f), dx = Math.abs(hAt(x + 2, y) - h) * n + Math.abs(hAt(x, y + 2) - h) * n + 1e-4, m = clamp(1 - e / (w * 4 * dx * 20), 0, 1);
      const i = clamp(Math.round(h * 255), 0, 255) * 3; out[0] = Lp[i] + (Ll[0] - Lp[i]) * m; out[1] = Lp[i + 1] + (Ll[1] - Lp[i + 1]) * m; out[2] = Lp[i + 2] + (Ll[2] - Lp[i + 2]) * m; });
    const h = hAt(P.x, P.y);
    return { cell: `指针处高度 ${fmt(h, 2)}，位于第 ${Math.floor(h * n)} 与 ${Math.floor(h * n) + 1} 条线之间` };
  } });

FAM.inkdrop = gFam({ title: '墨滴扩散', size: { label: '最大半径', min: 30, max: 220, step: 2, value: 110 }, count: { label: '同时墨滴数', min: 1, max: 14, step: 1, value: 6 },
  extra: R('rings', '环数', 1, 8, 1, 4), color: '#0ea5e9', presets: { 单滴: { count: 1 }, 多滴: { count: 14 }, 小滴: { size: 34 }, 大滴: { size: 210 }, 多环: { rings: 8 } },
  explain: '墨滴：一滴墨落入水中会向外扩散，半径增长越来越慢（约 ∝ √时间），颜色一圈圈分层，边缘因水流轻微抖动，最后淡去。每隔一会儿就有新墨滴落下，其中一部分落在指针处。', formula: '半径 r(τ) = 最大半径 · √(τ / 寿命)', formula2: '边缘抖动 = r · 0.05 · noise(角度, t)',
  draw(ctx, W, H, t, C, P, k, st) {
    const life = 7, per = life / k.n; st.drops = st.drops || []; st.next = st.next ?? t - life * 0.8;
    if (t < st.next - per * 2) st.next = t;
    while (t >= st.next) { const i = Math.round(st.next * 100); const atP = st.drops.length % 3 === 0; st.drops.push({ t0: st.next, x: atP ? P.x : hh(i, 1) * W, y: atP ? P.y : 8 + hh(i, 2) * (H - 8), h: hh(i, 3) * 60 - 30 }); st.next += per; }
    st.drops = st.drops.filter((d) => t - d.t0 < life); let layers = 0;
    for (const d of st.drops) { const tau = t - d.t0, R0 = k.s * Math.sqrt(tau / life), a = tau < 0.3 ? tau / 0.3 : 1 - smooth(clamp((tau - life * 0.6) / (life * 0.4), 0, 1)), Rn = Math.round(k.x);
      if (Math.hypot(P.x - d.x, P.y - d.y) < R0) layers++;
      for (let r = 0; r < Rn; r++) { const rr = R0 * (1 - r / Rn); if (rr < 1) continue; ctx.beginPath();
        for (let s = 0; s <= 48; s++) { const th = (s / 48) * TAU, q = rr * (1 + 0.05 * (noise3(Math.cos(th) * 2 + d.x, Math.sin(th) * 2, t * 0.5 + r) - 0.5) * 2); const x = d.x + Math.cos(th) * q, y = d.y + Math.sin(th) * q; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.fillStyle = hsla(k.hue + d.h + r * 12, 75, r % 2 ? 22 : 48 + r * 4, a * 0.55); ctx.fill(); } }
    return { mode: `${st.drops.length} 滴正在扩散`, cell: `指针处叠了 ${layers} 层墨` };
  } });

FAM.fiber = gFam({ title: '光纤', size: { label: '光点大小', min: 0.6, max: 5, step: 0.1, value: 2 }, count: { label: '光纤数', min: 8, max: 220, step: 2, value: 90 },
  extra: R('bend', '弯曲度', 0, 1.5, 0.02, 0.6), color: '#22d3ee', presets: { 稀疏: { count: 12 }, 浓密: { count: 220 }, 笔直: { bend: 0 }, 卷曲: { bend: 1.45 }, 大光点: { size: 4.6 } },
  explain: '光纤灯：一束光纤从底部同一点散开，每根是一条二次贝塞尔曲线，控制点随风摆动并被指针吸引。光脉冲沿光纤从底部跑到末端，末端发出明亮的光点。', formula: 'B(u) = (1−u)²·P₀ + 2u(1−u)·P₁ + u²·P₂', formula2: '脉冲位置 u = fract(0.3t + 种子)',
  draw(ctx, W, H, t, C, P, k) {
    const bx = W / 2, by = H + 4, L = (H - 8) * 0.95; ctx.lineWidth = 0.8;
    for (let i = 0; i < k.n; i++) {
      const a = (hh(i, 1) - 0.5) * 2.4, len = L * (0.6 + 0.4 * hh(i, 2)), ex = bx + Math.sin(a) * len * 0.9 + (P.x - bx) * 0.15, ey = by - Math.cos(a) * len * 0.75 + (P.y - (H + 8) / 2) * 0.1;
      const sw = Math.sin(t * 0.8 + hh(i, 3) * TAU) * 1, mx = bx + Math.sin(a) * len * 0.3 + sw * 60 * k.x + (P.x - bx) * 0.25, my = by - len * 0.55;
      ctx.strokeStyle = hsla(k.hue + (hh(i, 4) - 0.5) * 50, 70, 45, 0.25); ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      const bz = (u) => [(1 - u) ** 2 * bx + 2 * u * (1 - u) * mx + u * u * ex, (1 - u) ** 2 * by + 2 * u * (1 - u) * my + u * u * ey];
      const u = fract(t * 0.3 + hh(i, 5)), [px, py] = bz(u); k.dot(px, py, k.s * 0.7, hsla(k.hue + 30, 90, 75), 0.8);
      k.dot(ex, ey, k.s * 2.4, hsla(k.hue + (hh(i, 4) - 0.5) * 50, 90, 65), 0.18); k.dot(ex, ey, k.s, hsla(k.hue + (hh(i, 4) - 0.5) * 50, 95, 78), 0.95);
    }
    return { cell: `指针 60px 内有 ${k.near} 个光点` };
  } });

FAM.pixelsort = gFam({ title: '像素排序', size: { label: '像素块', min: 2, max: 8, step: 1, value: 3 }, count: { label: '段长上限', min: 4, max: 160, step: 2, value: 60 },
  extra: R('thresh', '亮度阈值', 0.05, 0.9, 0.01, 0.4), color: '#f97316', sizeDoc: '每个格子占几个屏幕像素', countDoc: '一次最多把多少个连续像素一起排序', extraDoc: '只有比阈值亮的像素才参与排序', presets: { 粗块: { size: 8 }, 短段: { count: 6 }, 长段: { count: 160 }, 低阈值: { thresh: 0.08 }, 高阈值: { thresh: 0.85 } },
  explain: '像素排序（Glitch 艺术）：逐行扫描图片，把亮度超过阈值的连续一段像素按亮度从暗到亮重新排列，就会出现被「拉丝」的效果。源图是流动的噪声色彩；指针所在的几行不限长度，拉丝最长。', formula: '段 = 连续满足 亮度 > 阈值 的像素', formula2: '段内按亮度升序排序（长度 ≤ 段长上限）',
  draw(ctx, W, H, t, C, P, k) {
    const res = k.s, Lp = k.lut('p' + k.hue, (u) => [k.hue - 50 + u * 110, 0.85, 0.04 + u * 0.56]), py = Math.floor((P.y - 8) / res); let sorted = 0;
    k.raw(res, (D, fw, fh) => { const row = new Float32Array(fw);
      for (let y = 0; y < fh; y++) { for (let x = 0; x < fw; x++) row[x] = clamp(fbm(x * res * 0.006 + t * 0.1, y * res * 0.012, t * 0.15, 3) * 2.2 - 0.65, 0, 1);
        const cap = Math.abs(y - py) < 4 ? fw : Math.round(k.n);
        let x = 0; while (x < fw) { if (row[x] <= k.x) { x++; continue; } let e = x; while (e < fw && row[e] > k.x && e - x < cap) e++; const seg = Array.from(row.subarray(x, e)).sort((a, b) => a - b); for (let i = 0; i < seg.length; i++) row[x + i] = seg[i]; if (Math.abs(y - py) < 1) sorted += e - x; x = e; }
        for (let x2 = 0; x2 < fw; x2++) { const i = Math.round(row[x2] * 255) * 3, o = (y * fw + x2) * 4; D[o] = Lp[i]; D[o + 1] = Lp[i + 1]; D[o + 2] = Lp[i + 2]; } } });
    return { cell: `指针所在行有 ${sorted} 个像素被排序` };
  } });

FAM.cellgrow = gFam({ title: '细胞分裂', size: { label: '细胞半径', min: 4, max: 30, step: 0.5, value: 14 }, count: { label: '最多代数', min: 1, max: 6, step: 1, value: 4 },
  extra: R('colonies', '菌落数', 1, 8, 1, 4), color: '#84cc16', countDoc: '每个菌落最多分裂几代（细胞数 = 2^代数）', presets: { 少代: { count: 1 }, 多代: { count: 6 }, 单菌落: { colonies: 1 }, 多菌落: { colonies: 8 }, 大细胞: { size: 28 } },
  explain: '细胞分裂：每个细胞长大后一分为二，两个子细胞沿随机方向分开，体积各占一半（半径 ÷ √2）。每个菌落经历「1 → 2 → 4 → …」的分裂，然后淡出并重新开始。指针附近的细胞会被轻轻推开。', formula: '第 g 代细胞数 = 2^g', formula2: '子细胞半径 = 母细胞半径 / √2（面积守恒）',
  draw(ctx, W, H, t, C, P, k) {
    const G = k.n, Cn = Math.round(k.x), per = 9; let total = 0, gNow = 0;
    for (let c = 0; c < Cn; c++) {
      const ph = fract(t / per + hh(c, 1)), g = Math.min(G, ph * (G + 1.5)), gi = Math.floor(g), gf = smooth(clamp((g - gi) * 1.6, 0, 1)), a = ph < 0.06 ? ph / 0.06 : ph > 0.85 ? 1 - (ph - 0.85) / 0.15 : 1;
      const cx = (0.15 + 0.7 * hh(c, 2)) * W + Math.sin(t * 0.2 + c) * 20, cy = 8 + (0.2 + 0.6 * hh(c, 3)) * (H - 8); gNow = Math.max(gNow, gi);
      const rec = (x, y, d, id, r) => {
        if (d === gi) { const split = gi < G ? gf : 0;
          for (const s of split > 0 ? [-1, 1] : [0]) { const ang = hh(id, 4) * TAU, off = s * r * 0.75 * split, rr = split > 0 ? r * (1 - (1 - Math.SQRT1_2) * split) : r; let px = x + Math.cos(ang) * off, py = y + Math.sin(ang) * off;
            const dx = px - P.x, dy = py - P.y, dd = Math.hypot(dx, dy) + 0.01; if (dd < 50) { px += dx / dd * (50 - dd) * 0.4; py += dy / dd * (50 - dd) * 0.4; }
            ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fillStyle = hsla(k.hue + d * 15 + c * 20, 60, 30, 0.6); ctx.fill(); ctx.strokeStyle = hsla(k.hue + d * 15 + c * 20, 80, 65); ctx.lineWidth = 1.5; ctx.stroke();
            ctx.globalAlpha = 1; k.dot(px, py, rr * 0.3, hsla(k.hue + 40, 80, 70), a * 0.9); total++; }
          return; }
        const ang = hh(id, 4) * TAU, off = r * 0.75; rec(x - Math.cos(ang) * off, y - Math.sin(ang) * off, d + 1, id * 2, r * Math.SQRT1_2); rec(x + Math.cos(ang) * off, y + Math.sin(ang) * off, d + 1, id * 2 + 1, r * Math.SQRT1_2);
      };
      rec(cx, cy, 0, c + 1, k.s * Math.pow(Math.SQRT2, Math.min(3, G) / 2));
    }
    return { mode: `最新第 ${gNow} 代`, cell: `全场 ${total} 个细胞，指针旁 ${k.near} 个` };
  } });

FAM.gravline = gFam({ title: '引力线', size: { label: '线宽', min: 0.4, max: 4, step: 0.1, value: 1.2 }, count: { label: '线条数', min: 5, max: 90, step: 1, value: 40 },
  extra: R('pull', '引力强度', 0, 1.5, 0.02, 0.7), color: '#c084fc', presets: { 少线: { count: 8 }, 多线: { count: 90 }, 无引力: { pull: 0 }, 强引力: { pull: 1.45 }, 粗线: { size: 3.5 } },
  explain: '引力线：一组水平直线，像时空网格；画面上有 2 个绕圈运动的「质量」加上指针，每个质量都把附近的线点拉向自己，越近拉得越多，于是直线被弯成漏斗形。', formula: 'p\' = p + Σ (m − p) · 强度 / (1 + |m − p|²/σ²)', formula2: 'σ = 70px，颜色亮度 ∝ 偏移量',
  draw(ctx, W, H, t, C, P, k) {
    const M = [[P.x, P.y], [W / 2 + Math.cos(t * 0.4) * W * 0.3, (H + 8) / 2 + Math.sin(t * 0.4) * (H - 8) * 0.3], [W / 2 + Math.cos(t * 0.4 + Math.PI) * W * 0.25, (H + 8) / 2 + Math.sin(t * 0.55 + Math.PI) * (H - 8) * 0.3]];
    const n = k.n, s2 = 4900; let pOff = 0; ctx.lineWidth = k.s;
    const warp = (x, y) => { let dx = 0, dy = 0; for (const [mx, my] of M) { const ex = mx - x, ey = my - y, f = k.x * 0.6 / (1 + (ex * ex + ey * ey) / s2); dx += ex * f; dy += ey * f; } return [x + dx, y + dy, Math.hypot(dx, dy)]; };
    for (let r = 0; r < n; r++) { const y0 = 8 + ((r + 0.5) / n) * (H - 8); let prev = null;
      for (let x = -10; x <= W + 10; x += 6) { const [wx, wy, off] = warp(x, y0); if (prev) { ctx.strokeStyle = hsla(k.hue + off * 0.8, 80, 35 + Math.min(45, off * 0.9)); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(wx, wy); ctx.stroke(); } prev = [wx, wy]; } }
    for (const [mx, my] of M.slice(1)) k.dot(mx, my, 5, '#f8fafc', 0.9);
    pOff = warp(P.x + 40, P.y)[2];
    return { cell: `指针右侧 40px 处线条偏移 ${fmt(pOff, 1)}px` };
  } });

FAM['spiral-gen'] = gFam({ title: '叶序螺旋', size: { label: '点大小', min: 0.8, max: 8, step: 0.1, value: 3 }, count: { label: '点数', min: 30, max: 1500, step: 10, value: 600 },
  extra: R('angle', '发散角', 130, 145, 0.05, 137.5), color: '#fbbf24', extraDoc: '相邻两点之间转过的角度；137.5° 是黄金角', presets: { 少: { count: 60 }, 多: { count: 1500 }, 黄金角: { angle: 137.5 }, 偏离: { angle: 132 }, 大点: { size: 7 } },
  explain: '叶序（向日葵花盘）：第 i 个点放在半径 √i、角度 i × 发散角 的位置。当发散角是黄金角 137.5° 时点排得最均匀，能看到顺/逆时针的螺旋线；稍微偏离就会出现一条条射线空隙。指针附近的点会放大。', formula: 'r_i = c·√i，θ_i = i · 发散角', formula2: '黄金角 = 360° · (1 − 1/φ) ≈ 137.508°',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = (H + 8) / 2, c = Math.min(W, H - 8) * 0.48 / Math.sqrt(k.n), a = k.x * Math.PI / 180, rot = t * 0.1;
    for (let i = 0; i < k.n; i++) { const r = c * Math.sqrt(i) * (1 + 0.03 * Math.sin(t * 2 - i * 0.02)), th = i * a + rot, x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r, d = Math.hypot(x - P.x, y - P.y), g = 1 + Math.max(0, 1 - d / 70) * 0.8;
      k.dot(x, y, k.s * g * (0.5 + 0.5 * Math.sqrt(i / k.n)), hsla(k.hue + (i % 21) * 3 - 30, 85, 45 + 25 * (i / k.n)), 0.9); }
    const ir = Math.round(((Math.hypot(P.x - cx, P.y - cy)) / c) ** 2);
    return { mode: `发散角 ${fmt(k.x, 2)}°`, cell: `指针半径处约是第 ${Math.min(ir, k.n)} 个点，附近 ${k.near} 个` };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'flowfield');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'flowfield';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-generative',
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
