/**
 * kit-particles — particle effects as stateless analytic systems: every particle
 * position is a pure function of (index, t, pointer), so knobs act instantly and
 * deterministically. LIVE .mip readout; beginner Chinese docs; full-stage fill.
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

/** pFam: shared spec/doc wrapper. d.draw(ctx, W, H, t, C, P, k) uses k.dot() which also counts particles near the pointer. */
function pFam(d) {
  const ex = d.extra;
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size, count: d.count, extras: [ex], remountKeys: [] };
  const exVal = (C) => (ex.type === 'toggle' ? on(C[ex.key]) : num(C[ex.key], ex.value));
  const exTxt = (C) => (ex.type === 'toggle' ? `${ex.label}：${yes(C[ex.key])}` : `${ex.label} ${fmt(num(C[ex.key], ex.value), 2)}`);
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], [d.count.label, v.n], ['指针附近', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula) + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p><p>这里每个粒子的位置都由「编号 i 的随机种子 + 时间 t + 指针位置」直接算出来，所以拖动滑条会立刻生效。</p>`,
      params: [['主色', '粒子的基础颜色'], [spec.speed.label, '时间流逝的快慢'], [d.size.label, d.sizeDoc || '单个粒子的大小'], [d.count.label, d.countDoc || '同时显示的粒子数量'], [ex.label, d.extraDoc || '该特效特有的效果参数']],
      example: (v) => `<ol><li>当前：${v.mode}，${d.count.label} ${v.n}</li><li>指针附近：${v.cell}</li><li>主色 ${v.colorHex}，拖滑条观察粒子变化</li></ol>`,
      tip: d.tip || '移动指针与粒子互动；右侧滑条实时改变数量、大小和效果。',
    },
    build(S) {
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#060a14'; ctx.fillRect(0, 8, W, H);
        const col = C.color || '#818cf8';
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), x: exVal(C), col, hue: hueOf(col), near: 0 };
        k.dot = (x, y, r, fill, a = 1) => {
          if (r <= 0.05 || a <= 0.003) return;
          ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = fill || col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          if ((x - P.x) ** 2 + (y - P.y) ** 2 < 3600) k.near++;
        };
        k.glow = (x, y, r, fill, a = 1) => { k.dot(x, y, r * 3, fill, a * 0.12); k.dot(x, y, r * 1.8, fill, a * 0.25); k.dot(x, y, r, fill, a); };
        ctx.save(); ctx.beginPath(); ctx.rect(0, 8, W, H - 8); ctx.clip();
        const r = d.draw(ctx, W, H, t * num(C.speed, 0.9), C, P, k) || {};
        ctx.restore();
        chip(ctx, W, H, C);
        return { mode: r.mode || exTxt(C), n: String(r.n ?? k.n), cell: `${k.near} 个粒子（60px 内）`, colorHex: String(col).toLowerCase(), hx: P.x, hy: P.y };
      };
    },
  };
}

FAM.starfield = pFam({ title: '星空穿梭', size: { label: '星星大小', min: 0.5, max: 4, step: 0.1, value: 1.6 }, count: { label: '星星数', min: 50, max: 600, step: 10, value: 260 },
  extra: R('warp', '曲速拉线', 0, 1, 0.02, 0.35), presets: { 稀疏: { count: 80 }, 密集: { count: 600 }, 无拉线: { warp: 0 }, 曲速: { warp: 1 } },
  explain: '3D 星空：每颗星有深度 z，z 随时间减小（向你飞来），屏幕位置 = 中心 + 方向 / z，越近越大越快；曲速拉线画出星星上一时刻到现在的轨迹。', formula: 'z = fract(种子 − 0.15t)', formula2: '屏幕 x = cx + dx / z',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2 + (P.x - W / 2) * 0.15, cy = H / 2 + (P.y - H / 2) * 0.15, F = Math.min(W, H) * 0.5;
    for (let i = 0; i < k.n; i++) { const dx = (hh(i, 1) - 0.5) * 2, dy = (hh(i, 2) - 0.5) * 2, z = 0.05 + fract(hh(i, 3) - t * 0.15) * 0.95;
      const x = cx + dx * F / z, y = cy + dy * F / z, r = k.s * (1.2 - z), a = clamp((1 - z) * 1.6, 0, 1) * clamp(z * 12, 0, 1);
      if (k.x > 0.01) { const z2 = Math.min(1, z + k.x * 0.12); ctx.strokeStyle = hsla(k.hue + hh(i, 4) * 40, 80, 75, a * 0.6); ctx.lineWidth = Math.max(0.5, r * 0.8); ctx.beginPath(); ctx.moveTo(cx + dx * F / z2, cy + dy * F / z2); ctx.lineTo(x, y); ctx.stroke(); }
      k.dot(x, y, r, hh(i, 5) < 0.3 ? k.col : '#e8eeff', a); }
  } });

FAM.snow = pFam({ title: '降雪', size: { label: '雪花大小', min: 0.8, max: 6, step: 0.1, value: 2.6 }, count: { label: '雪花数', min: 30, max: 500, step: 10, value: 220 },
  extra: R('wind', '风力', -1, 1, 0.05, 0.25), presets: { 小雪: { count: 60 }, 暴雪: { count: 500 }, 左风: { wind: -0.9 }, 大片: { size: 5.5 } },
  explain: '降雪：雪花从顶部匀速下落并左右轻摆，到底部后从顶部重新出现；风力让下落路径倾斜。近处（大）雪花落得更快。', formula: 'y = fract(种子 + 速度·t) × H', formula2: 'x = x₀ + 风·y + 摆幅·sin(t + 种子)',
  draw(ctx, W, H, t, C, P, k) {
    ctx.fillStyle = hsla(k.hue, 50, 20, 0.35); ctx.fillRect(0, H - 22, W, 22);
    for (let i = 0; i < k.n; i++) { const depth = 0.4 + hh(i, 1) * 0.6, y = 8 + fract(hh(i, 2) + t * 0.08 * depth) * (H + 20) - 10, sway = Math.sin(t * 1.3 + i) * 10 * depth;
      let x = hh(i, 3) * (W + 200) - 100 + k.x * (y - H / 2) * 0.6 + sway; x = ((x % W) + W) % W;
      const dxp = x - P.x, dyp = y - P.y, dd = Math.hypot(dxp, dyp); if (dd < 70) x += dxp / (dd + 1) * (70 - dd) * 0.4;
      k.dot(x, y, k.s * depth, depth > 0.8 ? '#ffffff' : hsla(k.hue, 60, 85), 0.5 + depth * 0.5); }
  } });

FAM.goldrain = pFam({ title: '金雨', size: { label: '金粒长度', min: 4, max: 40, step: 1, value: 14 }, count: { label: '金粒数', min: 20, max: 400, step: 10, value: 160 },
  extra: T('sparkle', '闪光十字', true), color: '#fbbf24', presets: { 稀疏: { count: 40 }, 倾盆: { count: 400 }, 无闪光: { sparkle: false }, 长条: { size: 36 } },
  explain: '金雨：细长的金色线段高速下落，落到底部溅起小火花；部分金粒带闪烁的十字星光。', formula: 'y = fract(种子 + 0.5t) × H', formula2: '线段: (x, y − 长度) → (x, y)',
  draw(ctx, W, H, t, C, P, k) {
    for (let i = 0; i < k.n; i++) { const sp = 0.35 + hh(i, 1) * 0.4, ph = fract(hh(i, 2) + t * sp), y = 8 + ph * (H + 40) - 20, x = hh(i, 3) * W + (P.x - W / 2) * 0.05 * ph;
      const g = ctx.createLinearGradient(x, y - k.s, x, y); g.addColorStop(0, hsla(k.hue, 90, 60, 0)); g.addColorStop(1, hsla(k.hue, 95, 70, 0.95));
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - k.s); ctx.lineTo(x, y); ctx.stroke(); k.dot(x, y, 1.4, '#fff7d6');
      if (k.x && hh(i, 4) < 0.25) { const tw = 0.5 + 0.5 * Math.sin(t * 6 + i), L = 3 + tw * 5; ctx.strokeStyle = hsla(k.hue, 100, 85, 0.4 + 0.5 * tw); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke(); }
      if (ph > 0.9) { const s2 = (ph - 0.9) * 10; for (let j = 0; j < 3; j++) k.dot(x + (j - 1) * s2 * 10, H - 6 - Math.sin(s2 * Math.PI) * 10, 1.2, k.col, 1 - s2); } }
  } });

FAM['smoke-col'] = pFam({ title: '烟柱', size: { label: '烟团大小', min: 6, max: 50, step: 1, value: 22 }, count: { label: '烟粒数', min: 20, max: 300, step: 10, value: 120 },
  extra: R('spread', '扩散角', 0.05, 1.2, 0.01, 0.45), color: '#94a3b8', presets: { 细烟: { count: 40 }, 浓烟: { count: 300 }, 直柱: { spread: 0.08 }, 散开: { spread: 1.15 } },
  explain: '烟柱：烟粒从底部烟源升起，随高度变大、变透明，并按扩散角向两侧散开；指针像风一样把烟吹偏。', formula: '年龄 a = fract(种子 + 0.2t)', formula2: '半径 = 大小·(0.3 + a)，透明度 = (1 − a)·0.3',
  draw(ctx, W, H, t, C, P, k) {
    const sx = W / 2, sy = H - 20; ctx.fillStyle = hsla(k.hue, 30, 25, 1); rrect(ctx, sx - 30, sy, 60, 14, 4); ctx.fill();
    for (let i = 0; i < k.n; i++) { const a = fract(hh(i, 1) + t * 0.2), side = (hh(i, 2) - 0.5) * 2, rise = a * (H - 40);
      const x = sx + side * k.x * rise * 0.6 + Math.sin(t * 1.5 + i + a * 6) * 12 * a + (P.x - sx) * 0.4 * a * a, y = sy - rise;
      k.dot(x, y, k.s * (0.3 + a), hsla(k.hue + a * 20, 25 + 30 * (1 - a), 55 + a * 20), (1 - a) * 0.3 * clamp(a * 10, 0, 1)); }
  } });

FAM.firefly = pFam({ title: '萤火虫', size: { label: '光点大小', min: 1, max: 6, step: 0.1, value: 2.4 }, count: { label: '萤火虫数', min: 5, max: 150, step: 1, value: 50 },
  extra: R('glow', '光晕', 0, 1, 0.02, 0.6), color: '#a3e635', presets: { 零星: { count: 10 }, 成群: { count: 150 }, 无光晕: { glow: 0 }, 大光点: { size: 5.5 } },
  explain: '萤火虫：每只沿两组不同频率的正弦曲线慢慢游荡（李萨如轨迹），亮度缓慢呼吸；指针附近的萤火虫会被吸引靠近。', formula: 'x = cx + A·sin(ω₁t + φ)，y = cy + B·sin(ω₂t + φ)', formula2: '亮度 = 0.5 + 0.5·sin(1.5t + φ)',
  draw(ctx, W, H, t, C, P, k) {
    const gr = ctx.createLinearGradient(0, H * 0.6, 0, H); gr.addColorStop(0, 'rgba(10,30,20,0)'); gr.addColorStop(1, hsla(k.hue, 40, 14, 0.9)); ctx.fillStyle = gr; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    for (let i = 0; i < k.n; i++) { const ph = hh(i, 1) * TAU; let x = hh(i, 2) * W + Math.sin(t * (0.3 + hh(i, 3) * 0.4) + ph) * 60, y = 8 + hh(i, 4) * (H - 16) + Math.sin(t * (0.25 + hh(i, 5) * 0.3) + ph * 2) * 40;
      const dx = P.x - x, dy = P.y - y, dd = Math.hypot(dx, dy); if (dd < 160) { x += dx * (1 - dd / 160) * 0.35; y += dy * (1 - dd / 160) * 0.35; }
      const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.5 + ph));
      if (k.x > 0) { k.dot(x, y, k.s * (2 + 5 * k.x), k.col, b * 0.1 * (0.5 + k.x)); k.dot(x, y, k.s * (1.3 + 2 * k.x), k.col, b * 0.22); }
      k.dot(x, y, k.s, hsla(k.hue, 90, 80), b); }
  } });

FAM.fountain = pFam({ title: '火花喷泉', size: { label: '火花大小', min: 0.6, max: 4, step: 0.1, value: 1.8 }, count: { label: '火花数', min: 30, max: 500, step: 10, value: 220 },
  extra: R('power', '喷射力', 0.3, 1.2, 0.02, 0.8), color: '#f97316', presets: { 稀疏: { count: 60 }, 盛大: { count: 500 }, 矮喷: { power: 0.35 }, 高喷: { power: 1.18 } },
  explain: '火花喷泉：每颗火花以随机角度和初速度喷出，之后受重力影响做抛物线运动，颜色由白热逐渐变暗。喷口跟随指针横向移动。', formula: 'x = x₀ + vₓ·a，y = y₀ − v_y·a + ½·g·a²', formula2: 'a = fract(种子 + 0.6t)（每颗火花的年龄）',
  draw(ctx, W, H, t, C, P, k) {
    const ox = clamp(P.x, 30, W - 30), oy = H - 14, V = (H - 30) * 2.2 * k.x, G = (H - 30) * 4.4;
    ctx.fillStyle = hsla(k.hue, 40, 30); rrect(ctx, ox - 16, oy, 32, 10, 3); ctx.fill();
    for (let i = 0; i < k.n; i++) { const a = fract(hh(i, 1) + t * 0.6) * 0.9, ang = -Math.PI / 2 + (hh(i, 2) - 0.5) * 0.7, v = V * (0.7 + hh(i, 3) * 0.3);
      const x = ox + Math.cos(ang) * v * a, y = oy + Math.sin(ang) * v * a + 0.5 * G * a * a, al = clamp(1 - a / 0.9, 0, 1) * clamp(a * 30, 0, 1);
      for (let j = 1; j <= 2; j++) { const b = Math.max(0, a - j * 0.012); k.dot(ox + Math.cos(ang) * v * b, oy + Math.sin(ang) * v * b + 0.5 * G * b * b, k.s * 0.6, k.col, al * 0.3); }
      k.dot(x, y, k.s, a < 0.25 ? '#fff4d6' : hsla(k.hue - a * 30, 95, 65 - a * 25), al); }
  } });

FAM.attractor = pFam({ title: '引力井', size: { label: '粒子大小', min: 0.6, max: 4, step: 0.1, value: 1.6 }, count: { label: '粒子数', min: 30, max: 600, step: 10, value: 300 },
  extra: R('pull', '引力强度', 0, 1, 0.02, 0.6), presets: { 少: { count: 60 }, 多: { count: 600 }, 无引力: { pull: 0 }, 强引力: { pull: 1 } },
  explain: '引力井：每个粒子绕指针做圆周运动，引力越强轨道越小、转得越快（像行星：近的转得快）。', formula: '轨道半径 r = r₀ · (1 − 0.75·引力)', formula2: '角速度 ω ∝ 1 / √r',
  draw(ctx, W, H, t, C, P, k) {
    const R0 = Math.hypot(W, H) * 0.45;
    for (let i = 0; i < k.n; i++) { const r0 = 20 + hh(i, 1) * R0, r = r0 * (1 - 0.75 * k.x), w = (0.3 + k.x * 1.2) * 18 / Math.sqrt(r + 8), a = hh(i, 2) * TAU + t * w;
      const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r * 0.85;
      k.dot(x, y, k.s, hsla(k.hue + (r / R0) * 60, 85, 65), 0.4 + 0.6 * (1 - r / R0)); }
    k.glow(P.x, P.y, 5, k.col, 0.9);
  } });

FAM.repulsor = pFam({ title: '排斥场', size: { label: '粒子大小', min: 1, max: 5, step: 0.1, value: 2 }, count: { label: '网格列数', min: 8, max: 40, step: 1, value: 22 },
  extra: R('radius', '排斥半径', 30, 220, 2, 110), presets: { 粗网格: { count: 8 }, 细网格: { count: 40 }, 小半径: { radius: 40 }, 大半径: { radius: 210 } },
  explain: '排斥场：粒子排成整齐网格，指针附近的粒子被推开，推力随距离衰减；离开后粒子弹回原位并轻轻呼吸。', formula: '位移 = 方向 · (半径 − d)² / 半径（d < 半径）', formula2: '颜色亮度 ∝ 位移大小',
  draw(ctx, W, H, t, C, P, k) {
    const cols = k.n, gap = W / cols, rows = Math.max(2, Math.round((H - 8) / gap));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const bx = (c + 0.5) * gap, by = 8 + (r + 0.5) * ((H - 8) / rows) + Math.sin(t * 2 + c * 0.4 + r * 0.3) * 1.5;
      const dx = bx - P.x, dy = by - P.y, d = Math.hypot(dx, dy) + 0.01; let x = bx, y = by, push = 0;
      if (d < k.x) { push = (k.x - d) ** 2 / k.x; x += dx / d * push; y += dy / d * push; }
      k.dot(x, y, k.s, hsla(k.hue + push, 80, 55 + Math.min(30, push * 0.5)), 0.55 + Math.min(0.45, push / 60)); }
    ctx.strokeStyle = hsla(k.hue, 70, 65, 0.35); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(P.x, P.y, k.x, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    return { n: `${k.n} × ${rows}` };
  } });

FAM['follow-swarm'] = pFam({ title: '跟随群', size: { label: '个体大小', min: 1, max: 5, step: 0.1, value: 2.2 }, count: { label: '个体数', min: 10, max: 300, step: 5, value: 120 },
  extra: R('spread', '群体半径', 10, 160, 2, 60), presets: { 小群: { count: 20 }, 大群: { count: 300 }, 紧密: { spread: 14 }, 松散: { spread: 150 } },
  explain: '跟随群：每个个体追随指针，但跟随有不同的延迟，并绕目标做小圆周运动，整体像一群小鱼/蜜蜂。延迟越大的个体越落后、颜色越淡。', formula: '目标 = 指针(t − 延迟ᵢ)', formula2: '位置 = 目标 + 群体半径 · (cos θᵢ, sin θᵢ)',
  draw(ctx, W, H, t, C, P, k) {
    for (let i = 0; i < k.n; i++) { const lag = hh(i, 1), th = hh(i, 2) * TAU + t * (1 + hh(i, 3) * 2) * (i % 2 ? 1 : -1), rr = k.x * (0.3 + hh(i, 4) * 0.7);
      const tx = P.x + Math.cos(t * 0.7) * lag * 80, ty = P.y + Math.sin(t * 0.9) * lag * 60, x = tx + Math.cos(th) * rr, y = ty + Math.sin(th) * rr * 0.8;
      const hx = Math.cos(th + Math.PI / 2), hy = Math.sin(th + Math.PI / 2); ctx.strokeStyle = hsla(k.hue + lag * 60, 80, 65, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - hx * k.s * 3, y - hy * k.s * 3); ctx.stroke();
      k.dot(x, y, k.s, hsla(k.hue + lag * 60, 85, 65), 1 - lag * 0.6); }
  } });

FAM.explode = pFam({ title: '烟花爆炸', size: { label: '碎片大小', min: 0.6, max: 4, step: 0.1, value: 1.8 }, count: { label: '碎片数', min: 20, max: 300, step: 5, value: 120 },
  extra: R('force', '爆炸力', 0.2, 1.5, 0.02, 0.8), color: '#f472b6', presets: { 小爆: { count: 30 }, 大爆: { count: 300 }, 弱: { force: 0.25 }, 强: { force: 1.45 } },
  explain: '烟花爆炸：三个错开时间的爆点，碎片从中心沿随机方向飞出，受阻力减速、受重力下坠，并逐渐熄灭；第一个爆点跟随指针。', formula: '距离 = 速度 · (1 − e^(−3a)) / 3', formula2: '下坠 = ½·g·a²，透明度 = 1 − a',
  draw(ctx, W, H, t, C, P, k) {
    for (let b = 0; b < 3; b++) { const cyc = t * 0.45 + b / 3, id = Math.floor(cyc), a = fract(cyc), cx = b === 0 ? P.x : (0.2 + hh(id, b + 7) * 0.6) * W, cy = b === 0 ? P.y : 8 + (0.2 + hh(id, b + 9) * 0.4) * H, bh = k.hue + b * 50 + hh(id, 3) * 30;
      for (let i = 0; i < k.n; i++) { const ang = hh(i, 1 + b) * TAU, v = Math.min(W, H) * 0.35 * k.x * (0.5 + hh(i, 2 + b) * 0.5), dist = v * (1 - Math.exp(-3 * a)) / 1;
        const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist + 60 * a * a, al = (1 - a) * clamp(a * 20, 0, 1);
        k.dot(x, y, k.s * (1 - a * 0.5), hsla(bh + hh(i, 4) * 30, 90, 65), al); } }
  } });

FAM.galaxy = pFam({ title: '螺旋星系', size: { label: '星点大小', min: 0.4, max: 3, step: 0.05, value: 1.2 }, count: { label: '星点数', min: 100, max: 1500, step: 20, value: 700 },
  extra: R('arms', '旋臂数', 1, 6, 1, 3), presets: { 稀疏: { count: 200 }, 浓密: { count: 1500 }, 双臂: { arms: 2 }, 六臂: { arms: 6 } },
  explain: '螺旋星系：星点沿对数螺旋分布在几条旋臂上，越靠内转得越快（差速旋转），中心是明亮的核球；指针让星系倾斜。', formula: 'θ = 臂号·2π/臂数 + 3·r + ω(r)·t', formula2: 'ω(r) ∝ 1 / (r + 0.2)',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = (H + 8) / 2, R0 = Math.min(W, H) * 0.46, tilt = 0.45 + 0.4 * clamp(P.y / H, 0, 1), arms = Math.round(k.x);
    k.glow(cx, cy, R0 * 0.06, hsla(k.hue, 60, 85), 0.8);
    for (let i = 0; i < k.n; i++) { const r = Math.pow(hh(i, 1), 0.8), arm = i % arms, th = arm * TAU / arms + r * 3 + (hh(i, 2) - 0.5) * (0.5 + 0.6 * (1 - r)) + t * 0.4 / (r + 0.2);
      const x = cx + Math.cos(th) * r * R0, y = cy + Math.sin(th) * r * R0 * tilt;
      k.dot(x, y, k.s * (0.6 + hh(i, 3)), hsla(k.hue + (1 - r) * 40 - 20, 80, 60 + (1 - r) * 30), 0.35 + 0.65 * (1 - r * 0.7)); }
    return { mode: `${arms} 条旋臂` };
  } });

FAM.heartfield = pFam({ title: '爱心粒子', size: { label: '粒子大小', min: 0.6, max: 4, step: 0.1, value: 1.8 }, count: { label: '粒子数', min: 60, max: 1000, step: 20, value: 400 },
  extra: R('beat', '心跳幅度', 0, 0.3, 0.01, 0.12), color: '#f43f5e', presets: { 稀疏: { count: 100 }, 浓密: { count: 1000 }, 静止: { beat: 0 }, 剧烈: { beat: 0.3 } },
  explain: '爱心粒子：粒子分布在心形曲线附近，整体按心跳节奏缩放（快速放大、缓慢回落）；指针靠近时粒子被轻轻推开。', formula: 'x = 16 sin³θ，y = 13cosθ − 5cos2θ − 2cos3θ − cos4θ', formula2: '缩放 = 1 + 幅度·e^(−8·fract(t))',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = (H + 8) / 2 - 6, S0 = Math.min(W, H - 8) / 38, beat = 1 + k.x * Math.exp(-6 * fract(t * 0.9)) - k.x * 0.3;
    for (let i = 0; i < k.n; i++) { const th = hh(i, 1) * TAU, fill = Math.sqrt(hh(i, 2)) * (i % 3 ? 1 : 0.9 + 0.1 * Math.sin(t * 2 + i)), jitter = (hh(i, 3) - 0.5) * 0.8;
      const hx = 16 * Math.sin(th) ** 3, hy = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th));
      let x = cx + (hx * fill + jitter) * S0 * beat, y = cy + (hy * fill + jitter) * S0 * beat; const dx = x - P.x, dy = y - P.y, dd = Math.hypot(dx, dy); if (dd < 50) { x += dx / dd * (50 - dd) * 0.5; y += dy / dd * (50 - dd) * 0.5; }
      k.dot(x, y, k.s * (0.5 + fill * 0.7), hsla(k.hue + (1 - fill) * 30, 85, 55 + fill * 20), 0.4 + 0.6 * fill); }
  } });

let textCache = { key: '', pts: [] };
FAM['text-dots'] = pFam({ title: '文字粒子', size: { label: '点大小', min: 0.6, max: 5, step: 0.1, value: 1.8 }, count: { label: '采样间距', min: 3, max: 12, step: 1, value: 5 },
  extra: T('scatter', '指针打散', true), presets: { 细密: { count: 3 }, 稀疏: { count: 12 }, 不打散: { scatter: false }, 大点: { size: 4.5 } },
  countDoc: '在文字像素上每隔多少像素取一个点（越小点越多）',
  explain: '文字粒子：先把文字画到离屏画布，再每隔几个像素采样一次，有颜色的位置就放一个粒子；粒子在目标位置附近微微浮动，指针靠近时被吹散。', formula: '粒子 = { (x, y) | 文字像素(x, y) 不透明，x、y 为间距的倍数 }', formula2: '偏移 = 方向 · max(0, 80 − d) · 0.6',
  draw(ctx, W, H, t, C, P, k) {
    const gap = k.n, key = `${W}x${H}:${gap}`;
    if (textCache.key !== key) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.floor(W)); c.height = Math.max(1, Math.floor(H)); const g = c.getContext('2d');
      const fs = Math.min(W / 4.2, H * 0.42); g.font = `900 ${fs}px ui-sans-serif,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText('粒子', W / 2, H * 0.36); g.font = `900 ${fs * 0.55}px ui-sans-serif,system-ui,sans-serif`; g.fillText('PARTICLE', W / 2, H * 0.72);
      const img = g.getImageData(0, 0, c.width, c.height).data, pts = []; for (let y = 0; y < c.height; y += gap) for (let x = 0; x < c.width; x += gap) if (img[(y * c.width + x) * 4 + 3] > 128) pts.push([x, y]);
      textCache = { key, pts }; }
    const pts = textCache.pts;
    for (let i = 0; i < pts.length; i++) { let [x, y] = pts[i]; x += Math.sin(t * 1.5 + i * 0.7) * 1.5; y += Math.cos(t * 1.2 + i * 0.3) * 1.5;
      if (k.x) { const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) + 0.01; if (d < 80) { x += dx / d * (80 - d) * 0.6; y += dy / d * (80 - d) * 0.6; } }
      k.dot(x, y, k.s, hsla(k.hue + (x / W) * 60, 85, 65), 0.95); }
    return { n: `${gap}px（${pts.length} 点）` };
  } });

FAM['grid-pulse'] = pFam({ title: '网格脉冲', size: { label: '点大小', min: 0.6, max: 5, step: 0.1, value: 2 }, count: { label: '网格列数', min: 8, max: 48, step: 1, value: 26 },
  extra: R('wavelen', '波长', 20, 200, 2, 80), presets: { 粗网格: { count: 8 }, 细网格: { count: 48 }, 短波: { wavelen: 24 }, 长波: { wavelen: 190 } },
  explain: '网格脉冲：从指针位置发出一圈圈圆形波，波峰经过的点会放大变亮，像水面上的浮标随波起伏。', formula: '波 = sin(2π·d/波长 − 4t)', formula2: '半径 = 大小 · (1 + 0.8·max(波, 0))',
  draw(ctx, W, H, t, C, P, k) {
    const cols = k.n, gap = W / cols, rows = Math.max(2, Math.round((H - 8) / gap));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = (c + 0.5) * gap, y = 8 + (r + 0.5) * ((H - 8) / rows), d = Math.hypot(x - P.x, y - P.y);
      const w = Math.sin(TAU * d / k.x - t * 4) * Math.exp(-d / 500), pw = Math.max(0, w);
      k.dot(x, y, k.s * (1 + 0.8 * pw), hsla(k.hue + w * 30, 80, 45 + pw * 30), 0.4 + 0.6 * pw); }
    return { n: `${cols} × ${rows}` };
  } });

FAM['wave-part'] = pFam({ title: '粒子波浪', size: { label: '点大小', min: 0.6, max: 4, step: 0.1, value: 1.6 }, count: { label: '波浪行数', min: 4, max: 40, step: 1, value: 18 },
  extra: R('amp', '振幅', 0, 60, 1, 24), presets: { 少行: { count: 4 }, 多行: { count: 40 }, 平静: { amp: 2 }, 汹涌: { amp: 58 } },
  explain: '粒子波浪：粒子排成多行，每行沿正弦波上下起伏，行与行之间相位错开形成 3D 起伏的海面；指针位置的波浪更高。', formula: 'y = y₀ + 振幅 · sin(0.02x + 0.4·行 + 2t)', formula2: '指针增益 = 1 + e^(−|x − 指针x| / 120)',
  draw(ctx, W, H, t, C, P, k) {
    const rows = k.n, cols = Math.round(W / 9);
    for (let r = 0; r < rows; r++) { const depth = (r + 1) / rows, y0 = 8 + H * 0.15 + depth * (H * 0.75);
      for (let c = 0; c < cols; c++) { const x = (c + 0.5) * (W / cols), boost = 1 + Math.exp(-Math.abs(x - P.x) / 120), y = y0 + k.x * depth * boost * Math.sin(x * 0.02 + r * 0.4 + t * 2);
        k.dot(x, y, k.s * (0.4 + depth * 0.8), hsla(k.hue + depth * 40, 80, 45 + depth * 25), 0.25 + depth * 0.75); } }
    return { n: `${rows} 行` };
  } });

FAM.comet = pFam({ title: '彗星', size: { label: '彗星大小', min: 1, max: 8, step: 0.1, value: 3 }, count: { label: '彗星数', min: 1, max: 30, step: 1, value: 8 },
  extra: R('tail', '尾巴长度', 0.05, 1, 0.01, 0.4), presets: { 单颗: { count: 1 }, 流星雨: { count: 30 }, 短尾: { tail: 0.08 }, 长尾: { tail: 0.95 } },
  explain: '彗星：每颗彗星沿斜线划过天空，尾巴由许多逐渐变小变淡的粒子组成，是彗星头部过去位置的轨迹。', formula: '头部 p(t) = 起点 + 速度·fract(t + 种子)', formula2: '尾粒 j = p(t − j·Δ)，大小 ∝ 1 − j/n',
  draw(ctx, W, H, t, C, P, k) {
    for (let s = 0; s < 70; s++) k.dot(hh(s, 9) * W, 8 + hh(s, 10) * H, 0.8, '#cbd5e1', 0.3 + 0.2 * Math.sin(t + s));
    const pos = (i, tt) => { const a = fract(hh(i, 1) + tt * (0.15 + hh(i, 2) * 0.15)); return [(hh(i, 3) * 1.2 - 0.1) * W + a * W * 0.6 - W * 0.3 + (P.x - W / 2) * 0.1, 8 - 40 + a * (H + 80)]; };
    for (let i = 0; i < k.n; i++) { const seg = 24; for (let j = seg; j >= 0; j--) { const tt = t - j * k.x * 0.08, a0 = fract(hh(i, 1) + t * (0.15 + hh(i, 2) * 0.15)), aj = a0 - j * k.x * 0.08 * (0.15 + hh(i, 2) * 0.15); if (aj < 0) continue;
        const [x, y] = pos(i, tt), f = 1 - j / seg; k.dot(x, y, k.s * (0.25 + 0.75 * f), j === 0 ? '#ffffff' : hsla(k.hue + j * 3, 90, 65), f * 0.9); }
      const [hx, hy] = pos(i, t); k.glow(hx, hy, k.s * 0.8, k.col, 0.8); }
  } });

FAM.bubbles = pFam({ title: '气泡', size: { label: '气泡大小', min: 3, max: 30, step: 0.5, value: 12 }, count: { label: '气泡数', min: 5, max: 120, step: 1, value: 40 },
  extra: T('shine', '高光', true), color: '#38bdf8', presets: { 少: { count: 8 }, 多: { count: 120 }, 无高光: { shine: false }, 大泡: { size: 28 } },
  explain: '气泡：气泡从底部浮起，左右摆动上升，越接近顶部越透明；指针碰到的气泡会被推开。气泡是空心圆加一个小高光点。', formula: 'y = H − fract(种子 + 0.1t)·(H + 2r)', formula2: 'x = x₀ + 15·sin(2t + 种子)',
  draw(ctx, W, H, t, C, P, k) {
    for (let i = 0; i < k.n; i++) { const r = k.s * (0.4 + hh(i, 1) * 0.8), a = fract(hh(i, 2) + t * (0.08 + hh(i, 3) * 0.06)); let y = H + r - a * (H + 2 * r), x = hh(i, 4) * W + Math.sin(t * 2 + i) * 15;
      const dx = x - P.x, dy = y - P.y, dd = Math.hypot(dx, dy) + 0.01; if (dd < r + 40) { x += dx / dd * (r + 40 - dd) * 0.6; y += dy / dd * (r + 40 - dd) * 0.6; }
      const al = (1 - a * 0.7) * clamp(a * 15, 0, 1); k.dot(x, y, r, hsla(k.hue, 80, 60), al * 0.12);
      ctx.strokeStyle = hsla(k.hue, 85, 70, al * 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (k.x) k.dot(x - r * 0.35, y - r * 0.35, r * 0.22, '#ffffff', al * 0.85); }
  } });

FAM.leaves = pFam({ title: '落叶', size: { label: '叶片大小', min: 3, max: 18, step: 0.5, value: 8 }, count: { label: '叶片数', min: 5, max: 150, step: 1, value: 45 },
  extra: R('sway', '摇摆幅度', 0, 80, 1, 30), color: '#f59e0b', presets: { 零星: { count: 10 }, 满天: { count: 150 }, 直落: { sway: 0 }, 狂舞: { sway: 78 } },
  explain: '落叶：叶片缓慢下落，同时左右大幅摇摆并绕自身旋转；叶片形状是两段圆弧拼成的椭圆叶。', formula: 'x = x₀ + 摇摆·sin(t + φ)，y = fract(种子 + 0.07t)·H', formula2: '旋转角 = 2·sin(1.3t + φ)',
  draw(ctx, W, H, t, C, P, k) {
    for (let i = 0; i < k.n; i++) { const ph = hh(i, 1) * TAU, a = fract(hh(i, 2) + t * (0.05 + hh(i, 3) * 0.04)), y = 8 - 20 + a * (H + 40), x = hh(i, 4) * W + Math.sin(t + ph) * k.x + (P.x - W / 2) * 0.08 * a;
      const rot = 2 * Math.sin(t * 1.3 + ph) + ph, L = k.s * (0.7 + hh(i, 5) * 0.6);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.45 + 0.35 * Math.abs(Math.cos(t * 1.7 + ph)));
      ctx.fillStyle = hsla(k.hue + hh(i, 6) * 50 - 25, 80, 50 + hh(i, 7) * 15); ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke(); ctx.restore();
      if ((x - P.x) ** 2 + (y - P.y) ** 2 < 3600) k.near++; }
  } });

FAM.dust = pFam({ title: '光束尘埃', size: { label: '尘埃大小', min: 0.4, max: 3, step: 0.05, value: 1.2 }, count: { label: '尘埃数', min: 50, max: 800, step: 10, value: 350 },
  extra: R('beam', '光束宽度', 0.1, 0.8, 0.01, 0.35), color: '#fde68a', presets: { 稀少: { count: 80 }, 浓密: { count: 800 }, 窄光束: { beam: 0.12 }, 宽光束: { beam: 0.78 } },
  explain: '光束尘埃：一束斜射的光从左上照进来，飘浮的尘埃在光束里被照亮，在光束外几乎看不见；光束随指针摆动。', formula: '尘埃: 布朗运动 x = x₀ + 20·noise(t)', formula2: '亮度 = smoothstep(宽, 0, 到光束中心线的距离)',
  draw(ctx, W, H, t, C, P, k) {
    const ox = W * 0.1, oy = 8, ang = Math.atan2(P.y - oy, P.x - ox), ux = Math.cos(ang), uy = Math.sin(ang), bw = k.x * Math.min(W, H) * 0.5;
    const L = Math.hypot(W, H); ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, hsla(k.hue, 90, 75, 0.28)); g.addColorStop(1, hsla(k.hue, 90, 75, 0.04));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(L, -bw); ctx.lineTo(L, bw); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    for (let i = 0; i < k.n; i++) { const x = hh(i, 1) * W + Math.sin(t * 0.4 + i) * 20 + Math.sin(t * 0.13 + i * 2) * 15, y = 8 + hh(i, 2) * H + Math.cos(t * 0.35 + i * 1.3) * 18;
      const px = x - ox, py = y - oy, along = px * ux + py * uy, perp = Math.abs(-px * uy + py * ux), wAt = 4 + (bw - 4) * clamp(along / L, 0, 1);
      const lit = along > 0 ? clamp(1 - perp / Math.max(wAt, 1), 0, 1) : 0; k.dot(x, y, k.s * (0.6 + hh(i, 3) * 0.8), lit > 0.05 ? hsla(k.hue, 90, 85) : '#64748b', 0.08 + lit * 0.9); }
  } });

FAM['neon-dots'] = pFam({ title: '霓虹连线', size: { label: '点大小', min: 1, max: 6, step: 0.1, value: 2.6 }, count: { label: '点数', min: 10, max: 140, step: 2, value: 60 },
  extra: R('link', '连线距离', 30, 200, 2, 110), color: '#22d3ee', presets: { 少点: { count: 16 }, 多点: { count: 140 }, 短连线: { link: 34 }, 长连线: { link: 196 } },
  explain: '霓虹连线：发光的点在画面里漂移，两点距离小于「连线距离」时画一条线，越近线越亮；色相随位置缓慢变化。', formula: '连线条件: |pᵢ − pⱼ| < 连线距离', formula2: '线透明度 = 1 − d / 连线距离',
  draw(ctx, W, H, t, C, P, k) {
    const pts = []; for (let i = 0; i < k.n; i++) { const x = (0.5 + 0.45 * Math.sin(t * (0.1 + hh(i, 1) * 0.2) + hh(i, 2) * TAU)) * W, y = 8 + (0.5 + 0.45 * Math.sin(t * (0.08 + hh(i, 3) * 0.2) + hh(i, 4) * TAU)) * (H - 8); pts.push([x, y]); }
    pts.push([P.x, P.y]); ctx.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < k.x) { ctx.strokeStyle = hsla(k.hue + pts[i][0] / W * 80, 90, 65, (1 - d / k.x) * 0.7); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); } }
    for (let i = 0; i < k.n; i++) k.glow(pts[i][0], pts[i][1], k.s, hsla(k.hue + pts[i][0] / W * 80, 90, 65), 0.95);
  } });

FAM.quantum = pFam({ title: '原子轨道', size: { label: '电子大小', min: 1, max: 6, step: 0.1, value: 2.5 }, count: { label: '轨道数', min: 1, max: 8, step: 1, value: 3 },
  extra: R('cloud', '电子云扩散', 0, 1, 0.02, 0.4), color: '#a78bfa', presets: { 单轨: { count: 1 }, 八轨: { count: 8 }, 清晰: { cloud: 0 }, 云状: { cloud: 1 } },
  explain: '原子轨道：原子核在中心，电子沿倾斜的椭圆轨道运动；电子云扩散越大，每个电子周围的「概率云」粒子越分散，体现量子的不确定性。', formula: '轨道 i: 倾角 = i·π/n，x = a·cos θ，y = b·sin θ', formula2: '云粒子 = 电子位置 + 扩散·高斯随机偏移',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2 + (P.x - W / 2) * 0.1, cy = (H + 8) / 2 + (P.y - H / 2) * 0.1, A = Math.min(W, H - 8) * 0.42, n = k.n;
    for (let o = 0; o < n; o++) { const tilt = o * Math.PI / n, ca = Math.cos(tilt), sa = Math.sin(tilt), b = A * 0.32;
      ctx.strokeStyle = hsla(k.hue + o * 25, 70, 60, 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, A, b, tilt, 0, TAU); ctx.stroke();
      for (let e = 0; e < 2; e++) { const th = t * (1.2 + o * 0.15) + e * Math.PI + o; const ex = Math.cos(th) * A, ey = Math.sin(th) * b, x = cx + ex * ca - ey * sa, y = cy + ex * sa + ey * ca;
        for (let c = 0; c < 18; c++) { const g1 = (hh(c + o * 40 + e * 20, 1) + hh(c + o * 40 + e * 20, 2) - 1) * 40 * k.x, g2 = (hh(c + o * 40 + e * 20, 3) + hh(c + o * 40 + e * 20, 4) - 1) * 40 * k.x; const tt = th - c * 0.04;
          const qx = Math.cos(tt) * A, qy = Math.sin(tt) * b; k.dot(cx + qx * ca - qy * sa + g1, cy + qx * sa + qy * ca + g2, k.s * 0.45 * (1 - c / 18), hsla(k.hue + o * 25, 90, 70), (1 - c / 18) * 0.5); }
        k.glow(x, y, k.s, hsla(k.hue + o * 25, 90, 72), 1); } }
    k.glow(cx, cy, 6, '#fde68a', 1);
    return { n: `${n} 条（${n * 2} 电子）` };
  } });

FAM.net = pFam({ title: '粒子网络', size: { label: '节点大小', min: 1, max: 6, step: 0.1, value: 2.2 }, count: { label: '节点数', min: 10, max: 160, step: 2, value: 70 },
  extra: R('link', '连线距离', 30, 200, 2, 100), presets: { 稀疏: { count: 16 }, 密集: { count: 160 }, 短连线: { link: 34 }, 长连线: { link: 196 } },
  explain: '粒子网络（Plexus）：节点在画面中缓慢漂移，距离近的节点连线；指针是一个特殊的「枢纽」，会把附近节点轻轻吸过来并全部连线。', formula: '连线: d(i, j) < 连线距离 → 透明度 = 1 − d/连线距离', formula2: '指针吸引: p += (指针 − p) · 0.2 · (1 − d/200)',
  draw(ctx, W, H, t, C, P, k) {
    const pts = []; for (let i = 0; i < k.n; i++) { let x = fract(hh(i, 1) + t * 0.02 * (hh(i, 2) - 0.5)) * W, y = 8 + fract(hh(i, 3) + t * 0.02 * (hh(i, 4) - 0.5)) * (H - 8);
      const d = Math.hypot(P.x - x, P.y - y); if (d < 200) { x += (P.x - x) * 0.2 * (1 - d / 200); y += (P.y - y) * 0.2 * (1 - d / 200); } pts.push([x, y]); }
    ctx.lineWidth = 1;
    for (let i = 0; i < k.n; i++) { for (let j = i + 1; j < k.n; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < k.x) { ctx.strokeStyle = hsla(k.hue, 70, 70, (1 - d / k.x) * 0.55); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); } }
      const dp = Math.hypot(pts[i][0] - P.x, pts[i][1] - P.y); if (dp < k.x * 1.5) { ctx.strokeStyle = hsla(k.hue + 40, 90, 70, (1 - dp / (k.x * 1.5)) * 0.8); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(P.x, P.y); ctx.stroke(); } }
    for (const [x, y] of pts) k.dot(x, y, k.s, hsla(k.hue, 80, 72), 0.95);
    k.glow(P.x, P.y, k.s * 1.4, hsla(k.hue + 40, 90, 70), 1);
  } });

FAM.blackhole = pFam({ title: '黑洞吸积盘', size: { label: '粒子大小', min: 0.4, max: 3, step: 0.05, value: 1.2 }, count: { label: '粒子数', min: 100, max: 1500, step: 20, value: 700 },
  extra: R('horizon', '视界半径', 10, 90, 1, 34), color: '#fb923c', presets: { 稀薄: { count: 200 }, 浓密: { count: 1500 }, 小黑洞: { horizon: 12 }, 大黑洞: { horizon: 88 } },
  explain: '黑洞：粒子组成扁平的吸积盘绕中心旋转，越靠内转得越快、越热越亮（开普勒运动），中间的事件视界是一个纯黑圆；指针让盘面倾斜。', formula: 'ω(r) ∝ r^(−1.5)（开普勒）', formula2: '温度/亮度 ∝ (视界 / r)^0.75',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = (H + 8) / 2, Rm = Math.min(W, H) * 0.47, tilt = 0.18 + 0.5 * clamp(P.y / H, 0, 1), rh = k.x;
    const back = [], front = [];
    for (let i = 0; i < k.n; i++) { const r = rh * 1.3 + Math.pow(hh(i, 1), 1.4) * (Rm - rh * 1.3), th = hh(i, 2) * TAU + t * 25 * Math.pow(r / 40, -1.5), x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r * tilt;
      (Math.sin(th) < 0 ? back : front).push([x, y, r]); }
    const draw = (arr) => { for (const [x, y, r] of arr) { const heat = Math.pow(rh / r, 0.75); k.dot(x, y, k.s * (0.6 + heat), hsla(k.hue + 30 * (1 - heat), 95, 45 + heat * 45), 0.35 + 0.65 * heat); } };
    draw(back); k.dot(cx, cy, rh * 1.25, k.col, 0.18); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, rh, 0, TAU); ctx.fill();
    ctx.strokeStyle = hsla(k.hue, 100, 75, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, rh + 1.5, 0, TAU); ctx.stroke(); draw(front);
  } });

FAM.rainbow = pFam({ title: '彩虹粒子', size: { label: '粒子大小', min: 0.6, max: 5, step: 0.1, value: 2 }, count: { label: '粒子数', min: 50, max: 1000, step: 10, value: 400 },
  extra: R('span', '色相跨度', 30, 360, 5, 300), presets: { 稀疏: { count: 80 }, 浓密: { count: 1000 }, 窄色带: { span: 40 }, 全光谱: { span: 360 } },
  explain: '彩虹粒子：粒子沿多层同心圆弧排成彩虹，每一层的色相 = 主色色相 + 层号 × 跨度 / 层数；粒子沿弧线流动，指针位置的弧线鼓起。', formula: '色相 = 主色 + (层 / 层数)·跨度', formula2: '弧上角度 θ = π·fract(种子 + 0.05t)',
  draw(ctx, W, H, t, C, P, k) {
    const cx = W / 2, cy = H - 10, R0 = Math.min(W * 0.48, H - 30), bands = 7;
    for (let i = 0; i < k.n; i++) { const b = i % bands, r = R0 * (0.55 + 0.45 * b / (bands - 1)) + (hh(i, 1) - 0.5) * R0 * 0.05, th = Math.PI * (1 + fract(hh(i, 2) + t * 0.05 * (b % 2 ? 1 : -1)));
      let x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r; const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) + 0.01; if (d < 70) { x += dx / d * (70 - d) * 0.4; y += dy / d * (70 - d) * 0.4; }
      k.dot(x, y, k.s, hsla(k.hue + (b / (bands - 1)) * k.x, 90, 62), 0.85); }
    return { mode: `跨度 ${fmt(k.x, 0)}°` };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, v.doc.title]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'starfield');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'starfield';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-particles',
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
