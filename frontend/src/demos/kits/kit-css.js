/**
 * kit-css — CSS motion / FX concepts as interactive canvas labs.
 * Knobs drive real geometry/pixels; LIVE .mip readout; beginner Chinese docs.
 * Carousel fills the full stage. No in-canvas control overlays (mobile-safe).
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

FAM['pulse'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '环尺寸', min: 0.4, max: 2, step: 0.05, value: 1 },
    count: { label: '环数', min: 1, max: 6, step: 1, value: 3 },
    extras: [R('spread','扩散',0.4,2.2,0.05,1.2), T('fillRing','实心核',true)], remountKeys: [] },
  presets: { 默认: {}, '靛紫': { color:'#818cf8' }, '青绿': { color:'#22d3ee' }, '玫红': { color:'#f472b6' }, '琥珀': { color:'#fbbf24' }, '密环': { count:5 }, '慢': { speed:0.35 } },
  doc: { title: '脉冲环', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('r(i) = base × (1 + spread × fract(t×spd + i/n))') + F('α = 1 − fract(...)'), explain: '<p><b>脉冲环</b>用多层不断扩大又淡出的圆环，模拟 CSS box-shadow / 伪元素动画的「呼吸感」。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素个数']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 3)), 1, 6), sz = num(C.size, 1), spread = num(C.spread, 1.2), spd = num(C.speed, 0.9);
      const cx = W / 2, cy = H / 2, base = Math.min(W, H) * 0.12 * sz;
      let hit = null;
      if (on(C.fillRing)) { ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(cx, cy, base * 0.55, 0, TAU); ctx.fill(); }
      for (let i = 0; i < n; i++) {
        const u = (t * spd + i / n) % 1; const r = base * (1 + spread * u); const a = 1 - u;
        ctx.strokeStyle = hsla(hueOf(C.color), 80, 65, a * 0.85); ctx.lineWidth = 3 + sz * 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        if (Math.hypot(P.x - cx, P.y - cy) < r + 8 && Math.hypot(P.x - cx, P.y - cy) > r - 12) hit = { i, r, a };
      }
      if (hit) tip(ctx, W, H, P.x, P.y, [`环 #${hit.i + 1}`, `r=${fmt(hit.r, 0)} α=${fmt(hit.a, 2)}`], C.color);
      text(ctx, 'pulse rings', 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: `pulse×${n}`, ph: fmt((t * spd) % 1, 2), cell: hit ? `#${hit.i + 1}` : '（移到环上）', n, sz: fmt(sz, 2), colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

    };
  },
};

FAM['loader'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式档', min: 0, max: 11, step: 1, value: 0 },
    extras: [T('trail','拖尾',true)], remountKeys: [] },
  presets: { 默认: {}, '环': { count:0 }, '点阵': { count:1 }, '条': { count:2 }, '轨道': { count:5 }, '双环': { count:8 }, '慢': { speed:0.35 } },
  doc: { title: '加载器', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('CSS 时间函数驱动：progress = ease(fract(t × speed))'), explain: '<p>常见纯 CSS 加载动画：旋转环、弹跳点、音阶条……这里用画布复现，调速度/尺寸立刻改观感。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素个数']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 11), sz = num(C.size, 1), spd = num(C.speed, 0.9), trail = on(C.trail);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.16 * sz; const ph = t * spd;
      const names = ['环','点阵','条','方块翻转','呼吸','轨道','涟漪','交叉','双环','弹跳点','旋转三角','进度弧'];
      if (style === 0 || style === 8) {
        ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 5 * sz; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = C.color || '#818cf8'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, R, ph * TAU, ph * TAU + Math.PI * 1.2); ctx.stroke();
        if (style === 8) { ctx.strokeStyle = pastel(C, 2); ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, -ph * TAU, -ph * TAU + Math.PI); ctx.stroke(); }
      } else if (style === 1 || style === 9) {
        for (let i = 0; i < 3; i++) {
          const y = cy + Math.sin(ph * TAU * 2 + i * 1.2) * R * 0.55;
          ctx.fillStyle = pastel(C, i, 3); ctx.beginPath(); ctx.arc(cx + (i - 1) * R * 0.7, y, 8 * sz, 0, TAU); ctx.fill();
        }
      } else if (style === 2) {
        for (let i = 0; i < 5; i++) {
          const h = R * (0.4 + 0.8 * (0.5 + 0.5 * Math.sin(ph * TAU * 2 + i * 0.7)));
          ctx.fillStyle = pastel(C, i, 5); rrect(ctx, cx - R + i * (R * 0.4), cy - h / 2, R * 0.28, h, 3); ctx.fill();
        }
      } else if (style === 5) {
        ctx.strokeStyle = 'rgba(148,163,184,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        const ang = ph * TAU; ctx.fillStyle = C.color || '#818cf8';
        ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 7 * sz, 0, TAU); ctx.fill();
        if (trail) for (let k = 1; k <= 4; k++) { ctx.globalAlpha = 0.35 - k * 0.06; ctx.beginPath(); ctx.arc(cx + Math.cos(ang - k * 0.25) * R, cy + Math.sin(ang - k * 0.25) * R, 5 * sz, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (style === 6) {
        for (let i = 0; i < 3; i++) { const u = (ph + i / 3) % 1; ctx.strokeStyle = hsla(hueOf(C.color), 80, 65, 1 - u); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * (0.4 + u * 1.2), 0, TAU); ctx.stroke(); }
      } else if (style === 11) {
        const p = (0.5 + 0.5 * Math.sin(ph * TAU)); ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 8 * sz; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
        text(ctx, `${Math.round(p * 100)}%`, cx, cy, { size: fsz(W, H, 1.2), col: '#f8fafc', align: 'center', bold: true });
      } else {
        const s = R * (0.8 + 0.2 * Math.sin(ph * TAU)); ctx.save(); ctx.translate(cx, cy); ctx.rotate(ph * TAU);
        ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, -s / 2, -s / 2, s, s, style === 3 ? 4 : s / 2); ctx.fill(); ctx.restore();
      }
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(ph % 1, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

    };
  },
};

FAM['hover'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '卡片缩放', min: 0.7, max: 1.4, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 11, step: 1, value: 0 },
    extras: [T('glow','发光',true)], remountKeys: [] },
  presets: { 默认: {}, '上浮': { count:0 }, '缩放': { count:1 }, '扫光': { count:3 }, '霓虹': { count:8 }, '慢': { speed:0.3 } },
  doc: { title: '悬停动效', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('CSS 时间函数驱动：progress = ease(fract(t × speed))'), explain: '<p>卡片悬停反馈：上浮、缩放、扫光、霓虹描边等。指针靠近卡片时触发「悬停态」。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素个数']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 11), sz = num(C.size, 1), spd = num(C.speed, 0.9), glow = on(C.glow);
      const names = ['上浮','缩放','边光','扫光','倾斜','边框跑马','阴影扩散','模糊聚焦','霓虹描边','磁吸位移','下划线展开','背景填充'];
      const cw = Math.min(W, H) * 0.42 * sz, ch = cw * 0.62; const cx = W / 2, cy = H / 2;
      const over = Math.abs(P.x - cx) < cw / 2 && Math.abs(P.y - cy) < ch / 2;
      const k = over ? 1 : 0.15 + 0.1 * Math.sin(t * spd);
      let dx = 0, dy = 0, sc = 1, rot = 0;
      if (style === 0) dy = -14 * k; if (style === 1) sc = 1 + 0.08 * k; if (style === 4) { rot = (P.x - cx) / cw * 0.25 * k; }
      if (style === 9 && over) { dx = clamp((P.x - cx) * 0.15, -12, 12); dy = clamp((P.y - cy) * 0.15, -10, 10); }
      ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(rot); ctx.scale(sc, sc);
      if (glow && (over || style === 8)) { ctx.shadowColor = C.color || '#818cf8'; ctx.shadowBlur = 24 * k; }
      ctx.fillStyle = over && style === 11 ? (C.color || '#818cf8') : '#18233d';
      rrect(ctx, -cw / 2, -ch / 2, cw, ch, 16); ctx.fill();
      ctx.strokeStyle = over ? (C.color || '#818cf8') : '#24314f'; ctx.lineWidth = over && style === 2 ? 3 : 1.5; ctx.stroke();
      if (style === 3 && over) {
        const g = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
        const u = (t * spd * 2) % 1; g.addColorStop(clamp(u - 0.2, 0, 1), 'transparent'); g.addColorStop(u, 'rgba(255,255,255,.45)'); g.addColorStop(clamp(u + 0.2, 0, 1), 'transparent');
        ctx.fillStyle = g; rrect(ctx, -cw / 2, -ch / 2, cw, ch, 16); ctx.fill();
      }
      if (style === 10) { ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-cw * 0.35, ch * 0.28); ctx.lineTo(-cw * 0.35 + cw * 0.7 * (over ? 1 : 0.2), ch * 0.28); ctx.stroke(); }
      text(ctx, names[style], 0, 0, { size: fsz(W, H, 1.1), col: over && style === 11 ? '#0b1020' : '#f8fafc', align: 'center', bold: true });
      ctx.restore();
      text(ctx, 'hover card', 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt((t * spd) % 1, 2), cell: over ? '悬停中' : '离开', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

    };
  },
};

FAM['grad'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '色带数', min: 2, max: 6, step: 1, value: 4 },
    extras: [R('angle','角度',0,360,1,120)], remountKeys: [] },
  presets: { 默认: {}, '冷色': { color:'#22d3ee' }, '暖色': { color:'#f472b6' }, '霓虹': { color:'#a78bfa', count:5 }, '慢': { speed:0.3 } },
  doc: { title: '渐变流动', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>多色线性渐变沿角度缓慢漂移，对应 CSS background-size 动画的流动渐变。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 4)), 2, 6), sz = num(C.size, 1), spd = num(C.speed, 0.9), ang = num(C.angle, 120) * Math.PI / 180;
      const pad = 8; const x0 = pad, y0 = pad + 4, w = W - pad * 2, h = H - pad * 2 - 12;
      const shift = (t * spd * 0.25) % 1;
      const g = ctx.createLinearGradient(x0, y0, x0 + Math.cos(ang) * w, y0 + Math.sin(ang) * h);
      for (let i = 0; i <= n; i++) {
        const u = (i / n + shift) % 1;
        g.addColorStop(u, pastel(C, i, n));
      }
      ctx.fillStyle = g; rrect(ctx, x0, y0, w, h, 18 * sz); ctx.fill();
      text(ctx, 'gradient flow', x0 + 12, y0 + 16, { size: fsz(W, H, 0.9), col: 'rgba(15,23,42,.7)', bold: true });
      const over = P.x >= x0 && P.x <= x0 + w && P.y >= y0 && P.y <= y0 + h;
      return { mode: `bands×${n}`, ph: fmt(shift, 2), cell: over ? '渐变面' : '—', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

    };
  },
};

FAM['ease'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '球尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '曲线', min: 0, max: 7, step: 1, value: 0 },
    extras: [T('loop','循环',true)], remountKeys: [] },
  presets: { 默认: {}, 'linear': { count:0 }, 'ease-in': { count:1 }, 'ease-out': { count:2 }, 'back': { count:4 }, 'steps': { count:6 } },
  doc: { title: '缓动曲线', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>对比不同 transition-timing-function：小球按曲线从左移到右，曲线图画在下方。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const names = ['linear','ease','ease-in','ease-out','back','bounce','steps','ease-in-out'];
      const ei = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), loop = on(C.loop);
      const name = names[ei];
      let u;
      if (loop) { u = (t * spd * 0.45) % 2; if (u > 1) u = 2 - u; }
      else { u = Math.min(t * spd * 0.45, 1); }
      const e = easeFn(name, clamp(u, 0, 1));
      const ml = 40, mr = 40, trackY = H * 0.32, trackW = W - ml - mr;
      ctx.strokeStyle = '#24314f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ml, trackY); ctx.lineTo(ml + trackW, trackY); ctx.stroke();
      const bx = ml + e * trackW, br = 18 * sz;
      ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(bx, trackY, br, 0, TAU); ctx.fill();
      // curve plot
      const plotY = H * 0.55, plotH = H * 0.35, plotX = ml, plotW = trackW;
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.strokeRect(plotX, plotY, plotW, plotH);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = plotX + (i / 60) * plotW, y = plotY + plotH * (1 - easeFn(name, i / 60));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = 2; ctx.stroke();
      const px = plotX + clamp(u, 0, 1) * plotW, py = plotY + plotH * (1 - e);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      text(ctx, name, ml, 16, { size: fsz(W, H), col: '#94a3b8' });
      return { mode: name, ph: fmt(e, 2), cell: name, colorHex: String(C.color || '').toLowerCase(), hx: bx, hy: trackY };

    };
  },
};

FAM['spring'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 7, step: 1, value: 0 },
    extras: [R('boost','过冲',0.2,1.8,0.05,1)], remountKeys: [] },
  presets: { 默认: {}, '弹入': { count:0 }, '过冲缩放': { count:2 }, '左右晃': { count:5 }, '慢': { speed:0.35 } },
  doc: { title: '弹簧感', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>用阻尼正弦近似弹簧：过冲后再回落，对应 CSS 里难写的 spring 手感。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), boost = num(C.boost, 1);
      const names = ['弹入','弹出','过冲缩放','橡皮筋','沉降回弹','左右晃回','旋转过冲','连环弹跳'];
      const cx = W / 2, cy = H / 2; const ph = t * spd * 2.2;
      const damp = Math.exp(-0.35 * (ph % 6)); const osc = Math.sin(ph * 3) * damp * boost;
      let dx = 0, dy = 0, sc = 1, rot = 0;
      if (style === 0 || style === 1) sc = 0.7 + 0.3 * (1 - damp) + osc * 0.08;
      if (style === 2) sc = 1 + osc * 0.25;
      if (style === 3) { sc = 1 + osc * 0.15; dx = osc * 20; }
      if (style === 4) dy = osc * 40;
      if (style === 5) dx = osc * 50;
      if (style === 6) rot = osc * 0.6;
      if (style === 7) { dy = Math.abs(osc) * 30; sc = 1 + Math.abs(osc) * 0.1; }
      const s = Math.min(W, H) * 0.22 * sz;
      ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, -s / 2, -s / 2, s, s, 18); ctx.fill();
      text(ctx, names[style], 0, 0, { size: fsz(W, H), col: '#0b1020', align: 'center', bold: true });
      ctx.restore();
      return { mode: names[style], ph: fmt(osc, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

    };
  },
};

FAM['stagger'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '间距', min: 4, max: 40, step: 1, value: 14 },
    count: { label: '条目', min: 3, max: 12, step: 1, value: 6 },
    extras: [R('delay','错峰',0.02,0.35,0.01,0.1), T('scaleIn','缩放入',true)], remountKeys: [] },
  presets: { 默认: {}, '少': { count:4 }, '多': { count:10 }, '快错峰': { delay:0.05 }, '慢': { speed:0.3 } },
  doc: { title: '交错入场', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>子元素按延迟依次淡入，对应 animation-delay 递增的 stagger 入场。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 6)), 3, 12), gap = num(C.size, 14), delay = num(C.delay, 0.1), spd = num(C.speed, 0.9), scaleIn = on(C.scaleIn);
      const ml = 24, mr = 24, mt = 28, iw = W - ml - mr, ih = H - mt - 24;
      const rowH = (ih - gap * (n - 1)) / n; let hit = null;
      const cycle = (t * spd * 0.35) % (1.5 + n * delay);
      for (let i = 0; i < n; i++) {
        const local = clamp((cycle - i * delay) / 0.55, 0, 1);
        const e = easeFn('ease-out', local); const y = mt + i * (rowH + gap);
        const sc = scaleIn ? 0.85 + 0.15 * e : 1;
        ctx.globalAlpha = e; ctx.fillStyle = pastel(C, i, n);
        const w = iw * (0.55 + 0.45 * e);
        rrect(ctx, ml, y + rowH * (1 - sc) / 2, w, rowH * sc, 10); ctx.fill();
        ctx.globalAlpha = 1;
        text(ctx, `Item ${i + 1}`, ml + 12, y + rowH / 2, { size: fsz(W, H, 0.9), col: '#0f172a', bold: true });
        if (P.y >= y && P.y <= y + rowH && P.x >= ml && P.x <= ml + w) hit = i;
      }
      if (hit != null) tip(ctx, W, H, P.x, P.y, [`条目 ${hit + 1}`, `delay×${hit}`], C.color);
      return { mode: `stagger×${n}`, ph: fmt(cycle, 2), cell: hit != null ? `#${hit + 1}` : '（移到条上）', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

    };
  },
};

FAM['flip'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '圆角', min: 0, max: 24, step: 1, value: 12 },
    count: { label: '格子', min: 4, max: 12, step: 1, value: 9 },
    extras: [T('shuffle','打乱相位',true)], remountKeys: [] },
  presets: { 默认: {}, '少格': { count:4 }, '多格': { count:12 }, '大圆角': { size:20 }, '慢': { speed:0.35 } },
  doc: { title: 'FLIP 布局', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>FLIP：记录 First 位置，改到 Last，用 Invert 补偿，再 Play 过渡。格子缓缓换位。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 9)), 4, 12), rad = num(C.size, 12), spd = num(C.speed, 0.9), shuffle = on(C.shuffle);
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const ml = 20, mt = 28, iw = W - 40, ih = H - 48, gap = 10;
      const cw = (iw - gap * (cols - 1)) / cols, ch = (ih - gap * (rows - 1)) / rows;
      const phase = Math.floor(t * spd * 0.4); const blend = easeFn('ease-in-out', (t * spd * 0.4) % 1);
      let hit = null;
      for (let i = 0; i < n; i++) {
        const a = i, b = shuffle ? (i * 7 + phase * 3) % n : (i + phase) % n;
        const c0 = a % cols, r0 = (a / cols) | 0, c1 = b % cols, r1 = (b / cols) | 0;
        const x = ml + (c0 + (c1 - c0) * blend) * (cw + gap);
        const y = mt + (r0 + (r1 - r0) * blend) * (ch + gap);
        ctx.fillStyle = pastel(C, i, n); rrect(ctx, x, y, cw, ch, rad); ctx.fill();
        text(ctx, String(i + 1), x + cw / 2, y + ch / 2, { size: fsz(W, H), col: '#0f172a', align: 'center', bold: true });
        if (P.x >= x && P.x <= x + cw && P.y >= y && P.y <= y + ch) hit = i;
      }
      if (hit != null) tip(ctx, W, H, P.x, P.y, [`格 ${hit + 1}`, 'FLIP 插值中'], C.color);
      return { mode: `FLIP×${n}`, ph: fmt(blend, 2), cell: hit != null ? `#${hit + 1}` : '（移到格上）', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

    };
  },
};

FAM['clip'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '形状', min: 0, max: 9, step: 1, value: 0 },
    extras: [R('reveal','揭示量',0,1,0.01,0.65)], remountKeys: [] },
  presets: { 默认: {}, '圆': { count:0 }, '菱形': { count:1 }, '星形': { count:4 }, '全显': { reveal:1 } },
  doc: { title: 'Clip-path', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>clip-path 裁出形状。揭示量从 0→1 像窗帘拉开，露出渐变底图。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 9), sz = num(C.size, 1), spd = num(C.speed, 0.9), reveal = num(C.reveal, 0.65);
      const names = ['圆揭示','菱形','多边形','斜切','星形','波浪边','对角擦除','圆形收缩','十字','胶囊'];
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38 * sz;
      const anim = clamp(reveal * (0.7 + 0.3 * Math.sin(t * spd)), 0, 1);
      // bg
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.color || '#818cf8'); g.addColorStop(1, pastel(C, 3));
      ctx.save();
      ctx.beginPath();
      if (style === 0 || style === 7) ctx.arc(cx, cy, R * (style === 7 ? (1 - anim * 0.5) : anim), 0, TAU);
      else if (style === 1) { const r = R * anim; ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); }
      else if (style === 4) {
        const spikes = 5, r = R * anim; for (let i = 0; i < spikes * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / spikes; const rr = i % 2 ? r * 0.45 : r; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
      } else if (style === 8) {
        const r = R * anim; ctx.rect(cx - r * 0.25, cy - r, r * 0.5, r * 2); ctx.rect(cx - r, cy - r * 0.25, r * 2, r * 0.5);
      } else if (style === 9) { const r = R * anim; rrect(ctx, cx - r, cy - r * 0.45, r * 2, r * 0.9, r * 0.45); }
      else if (style === 6) { ctx.moveTo(0, 0); ctx.lineTo(W * anim, 0); ctx.lineTo(0, H * anim); ctx.closePath(); }
      else { // polygon / default
        const sides = 6; for (let i = 0; i <= sides; i++) { const a = -Math.PI / 2 + i * TAU / sides; const x = cx + Math.cos(a) * R * anim, y = cy + Math.sin(a) * R * anim; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      }
      ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      text(ctx, names[style], cx, cy, { size: fsz(W, H, 1.3), col: '#0b1020', align: 'center', bold: true });
      ctx.restore();
      text(ctx, 'clip-path', 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(anim, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

    };
  },
};

FAM['xform3d'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 9, step: 1, value: 0 },
    extras: [R('persp','透视感',0.2,2,0.05,1)], remountKeys: [] },
  presets: { 默认: {}, '立方': { count:0 }, '翻转牌': { count:1 }, '木马': { count:2 }, '慢': { speed:0.35 } },
  doc: { title: '3D Transform', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>perspective + rotateX/Y 的三维感。拖动指针可微调视角。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 9), sz = num(C.size, 1), spd = num(C.speed, 0.9), persp = num(C.persp, 1);
      const names = ['立方体','翻转牌','旋转木马','层叠卡片','门轴打开','翻书','倾斜面板','球体感','棱柱','行列翻转'];
      const cx = W / 2, cy = H / 2; const rx = (P.y / H - 0.5) * 0.8 * persp + t * spd * 0.4; const ry = (P.x / W - 0.5) * 0.8 * persp + t * spd * 0.55;
      const s = Math.min(W, H) * 0.18 * sz;
      // fake 3d faces as parallelograms
      const faces = [];
      for (let i = 0; i < 6; i++) {
        const a = ry + i * Math.PI / 3; const z = Math.cos(a); const x = Math.sin(a);
        faces.push({ i, x, z, depth: z });
      }
      faces.sort((a, b) => a.depth - b.depth);
      for (const f of faces) {
        const px = cx + f.x * s * 1.4; const py = cy + Math.sin(rx) * s * 0.4 * f.z;
        const sc = 0.7 + 0.35 * (f.z + 1) / 2;
        ctx.globalAlpha = 0.55 + 0.45 * sc; ctx.fillStyle = pastel(C, f.i, 6);
        rrect(ctx, px - s * sc / 2, py - s * sc / 2, s * sc, s * sc, 10); ctx.fill();
        ctx.globalAlpha = 1;
      }
      text(ctx, names[style], cx, H - 20, { size: fsz(W, H), col: '#94a3b8', align: 'center' });
      return { mode: names[style], ph: fmt(ry % TAU, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['trans'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '属性', min: 0, max: 9, step: 1, value: 0 },
    extras: [T('hoverGo','悬停触发',true)], remountKeys: [] },
  presets: { 默认: {}, '颜色': { count:0 }, '宽高': { count:1 }, '透明度': { count:2 }, '圆角': { count:5 } },
  doc: { title: '过渡属性', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>同一元素在两种状态间过渡：颜色、尺寸、透明度、阴影……悬停切换到 B 态。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 9), sz = num(C.size, 1), spd = num(C.speed, 0.9), hoverGo = on(C.hoverGo);
      const names = ['颜色','宽高','透明度','变换','阴影','圆角','字号','边框','滤镜','复合多属性'];
      const cx = W / 2, cy = H / 2; const over = hoverGo && Math.hypot(P.x - cx, P.y - cy) < Math.min(W, H) * 0.28;
      const k = over ? 1 : (0.5 + 0.5 * Math.sin(t * spd));
      let w = 120 * sz, h = 80 * sz, rad = 12, a = 1, sc = 1, lw = 2;
      let col = C.color || '#818cf8';
      if (style === 0) col = hsla(hueOf(C.color) + k * 80, 80, 60);
      if (style === 1) { w *= 0.7 + 0.6 * k; h *= 0.7 + 0.5 * k; }
      if (style === 2) a = 0.25 + 0.75 * k;
      if (style === 3) sc = 0.85 + 0.3 * k;
      if (style === 5) rad = 4 + 28 * k;
      if (style === 7) lw = 1 + 8 * k;
      if (style === 9) { w *= 0.8 + 0.4 * k; rad = 8 + 16 * k; a = 0.5 + 0.5 * k; sc = 0.9 + 0.15 * k; }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = a;
      if (style === 4 || style === 9) { ctx.shadowColor = col; ctx.shadowBlur = 8 + 30 * k; }
      ctx.fillStyle = col; rrect(ctx, -w / 2, -h / 2, w, h, rad); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = lw; ctx.stroke();
      text(ctx, names[style], 0, 0, { size: fsz(W, H, 0.7 + 0.6 * (style === 6 ? k : 1)), col: '#0b1020', align: 'center', bold: true });
      ctx.restore();
      return { mode: names[style], ph: fmt(k, 2), cell: over ? 'B态' : 'A态', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['parallax'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '层幅度', min: 0.3, max: 2, step: 0.05, value: 1 },
    count: { label: '层数', min: 2, max: 6, step: 1, value: 4 },
    extras: [R('depth','深度',0.2,2,0.05,1)], remountKeys: [] },
  presets: { 默认: {}, '多层': { count:5 }, '强深度': { depth:1.6 }, '慢': { speed:0.3 } },
  doc: { title: '视差', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>多层以不同速度跟随指针，近快远慢，模拟 CSS 视差。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 4)), 2, 6), amp = num(C.size, 1), depth = num(C.depth, 1), spd = num(C.speed, 0.9);
      const cx = W / 2, cy = H / 2; const px = (P.x - cx) / W, py = (P.y - cy) / H;
      // fill bg
      ctx.fillStyle = '#0b1224'; ctx.fillRect(0, 8, W, H - 8);
      let hit = null;
      for (let i = 0; i < n; i++) {
        const d = (i + 1) / n * depth; const ox = px * 80 * d * amp + Math.sin(t * spd + i) * 6;
        const oy = py * 60 * d * amp + Math.cos(t * spd * 0.8 + i) * 4;
        const r = Math.min(W, H) * (0.08 + 0.1 * i / n) * amp;
        const x = cx + ox * (i + 1), y = cy + oy * (i + 1);
        ctx.fillStyle = pastel(C, i, n, 0.35 + 0.5 * i / n); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        if (Math.hypot(P.x - x, P.y - y) < r) hit = i;
      }
      text(ctx, 'parallax layers', 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: `layers×${n}`, ph: fmt(px, 2), cell: hit != null ? `L${hit + 1}` : '（移到层上）', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['filter'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '滤镜', min: 0, max: 7, step: 1, value: 0 },
    extras: [R('amount','强度',0.1,1.5,0.05,0.8)], remountKeys: [] },
  presets: { 默认: {}, '模糊': { count:0 }, '色相': { count:2 }, '霓虹': { count:5 }, '慢': { speed:0.35 } },
  doc: { title: '滤镜动效', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>模拟 CSS filter：模糊、饱和、色相旋转、对比、发光等随时间脉动。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), amount = num(C.amount, 0.8);
      const names = ['模糊进出','饱和脉动','色相旋转','对比闪','灰度到彩色','霓虹发光','暗角呼吸','色散感'];
      const k = 0.5 + 0.5 * Math.sin(t * spd * TAU * 0.5);
      const pad = 10; rrect(ctx, pad, pad + 4, W - pad * 2, H - pad * 2 - 8, 16); 
      const h = hueOf(C.color) + (style === 2 ? k * 120 * amount : 0);
      const sat = style === 1 ? 40 + 50 * k * amount : (style === 4 ? 10 + 70 * k : 70);
      const light = style === 3 ? 40 + 30 * k * amount : 55;
      ctx.fillStyle = hsla(h, sat, light); ctx.fill();
      if (style === 5 || style === 0) { ctx.shadowColor = hsla(h, 90, 60); ctx.shadowBlur = (style === 5 ? 40 : 20 * (1 - k)) * amount * sz; }
      const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.25 * sz;
      ctx.fillStyle = hsla(h + 40, sat, light + 10); rrect(ctx, cx - s, cy - s * 0.6, s * 2, s * 1.2, 18); ctx.fill();
      ctx.shadowBlur = 0;
      if (style === 6) { const g = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, Math.max(W, H) * 0.7); g.addColorStop(0, 'transparent'); g.addColorStop(1, `rgba(0,0,0,${0.3 + 0.5 * k * amount})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (style === 7) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = hsla(h + 90, 80, 50, 0.35 * amount); rrect(ctx, cx - s + 6, cy - s * 0.6, s * 2, s * 1.2, 18); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      text(ctx, names[style], cx, cy, { size: fsz(W, H, 1.1), col: '#0b1020', align: 'center', bold: true });
      return { mode: names[style], ph: fmt(k, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['blend'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '模式', min: 0, max: 7, step: 1, value: 0 },
    extras: [T('follow','跟随指针',true)], remountKeys: [] },
  presets: { 默认: {}, 'screen': { count:0 }, 'multiply': { count:1 }, 'overlay': { count:2 }, 'difference': { count:3 } },
  doc: { title: '混合模式', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>两色块叠加以不同 mix-blend-mode 感觉混合。移动指针拖动上层。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), follow = on(C.follow);
      const names = ['screen','multiply','overlay','difference','exclusion','color-dodge','hard-light','soft-light'];
      const modes = ['screen','multiply','overlay','difference','exclusion','lighter','lighter','screen'];
      ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 8, W, H);
      const s = Math.min(W, H) * 0.35 * sz;
      ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(W * 0.4, H * 0.5, s, 0, TAU); ctx.fill();
      const ox = follow ? P.x : W * 0.6 + Math.sin(t * spd) * 40;
      const oy = follow ? P.y : H * 0.5 + Math.cos(t * spd * 0.9) * 30;
      ctx.globalCompositeOperation = modes[style];
      ctx.fillStyle = pastel(C, 3, 6); ctx.beginPath(); ctx.arc(ox, oy, s * 0.85, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.9), col: '#94a3b8' });
      return { mode: names[style], ph: fmt((t * spd) % 1, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: ox, hy: oy };

  }; },
};

FAM['skeleton'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '圆角', min: 2, max: 20, step: 1, value: 8 },
    count: { label: '布局', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('shimmer','扫光速度',0.3,2.5,0.05,1)], remountKeys: [] },
  presets: { 默认: {}, '卡片': { count:0 }, '列表': { count:1 }, '头像行': { count:2 }, '慢扫': { shimmer:0.4 } },
  doc: { title: '骨架屏', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>占位灰块 + 高光扫过，模拟 Skeleton loading。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), rad = num(C.size, 8), spd = num(C.speed, 0.9), shimmer = num(C.shimmer, 1);
      const names = ['卡片','列表','头像行','图表占位','文章段落','网格瓷砖'];
      const ml = 20, mt = 24, iw = W - 40, ih = H - 44;
      const sweep = ((t * spd * shimmer) % 1);
      const paintBar = (x, y, w, h) => {
        const g = ctx.createLinearGradient(x, y, x + w, y);
        g.addColorStop(clamp(sweep - 0.2, 0, 1), '#18233d');
        g.addColorStop(sweep, pastel(C, 0, 3, 0.55));
        g.addColorStop(clamp(sweep + 0.2, 0, 1), '#18233d');
        ctx.fillStyle = g; rrect(ctx, x, y, w, h, rad); ctx.fill();
      };
      if (style === 0) { paintBar(ml, mt, iw, ih * 0.45); paintBar(ml, mt + ih * 0.5, iw * 0.9, 16); paintBar(ml, mt + ih * 0.5 + 28, iw * 0.55, 14); }
      else if (style === 1 || style === 4) { for (let i = 0; i < 5; i++) paintBar(ml, mt + i * (ih / 5.5), iw * (0.95 - i * 0.08), ih / 8); }
      else if (style === 2) { ctx.fillStyle = '#18233d'; ctx.beginPath(); ctx.arc(ml + 28, mt + 28, 28, 0, TAU); ctx.fill(); paintBar(ml + 70, mt + 12, iw - 70, 18); paintBar(ml + 70, mt + 40, iw * 0.4, 14); for (let i = 0; i < 3; i++) paintBar(ml, mt + 80 + i * 40, iw, 24); }
      else if (style === 3) { paintBar(ml, mt, iw, ih * 0.7); paintBar(ml, mt + ih * 0.78, iw * 0.3, 14); paintBar(ml + iw * 0.35, mt + ih * 0.78, iw * 0.3, 14); }
      else { const cols = 3, rows = 2, gap = 12; const cw = (iw - gap * (cols - 1)) / cols, ch = (ih - gap * (rows - 1)) / rows; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) paintBar(ml + c * (cw + gap), mt + r * (ch + gap), cw, ch); }
      text(ctx, names[style], 12, H - 12, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(sweep, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['progress'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '粗细', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 7, step: 1, value: 0 },
    extras: [T('auto','自动往返',true)], remountKeys: [] },
  presets: { 默认: {}, '线性': { count:0 }, '环形': { count:2 }, '半环': { count:3 }, '水波': { count:5 } },
  doc: { title: '进度条', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>进度从 0→100% 的多种画法：线性条、环、半环、水波填充。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), auto = on(C.auto);
      const names = ['线性','条纹不确定','环形','半环','分段步进','水波填充','像素块','渐变扫'];
      let p = auto ? (0.5 + 0.5 * Math.sin(t * spd)) : ((t * spd * 0.2) % 1);
      const cx = W / 2, cy = H / 2;
      if (style === 0 || style === 1 || style === 7) {
        const bw = W * 0.7, bh = 14 * sz, x = (W - bw) / 2, y = cy;
        ctx.fillStyle = '#18233d'; rrect(ctx, x, y, bw, bh, bh / 2); ctx.fill();
        if (style === 1) { const g = ctx.createLinearGradient(x, 0, x + bw, 0); const u = (t * spd) % 1; g.addColorStop(0, 'transparent'); g.addColorStop(u, C.color || '#818cf8'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; rrect(ctx, x, y, bw, bh, bh / 2); ctx.fill(); }
        else { ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, x, y, bw * p, bh, bh / 2); ctx.fill(); }
      } else if (style === 2 || style === 3) {
        const R = Math.min(W, H) * 0.22 * sz; const start = style === 3 ? Math.PI : -Math.PI / 2; const span = style === 3 ? Math.PI : TAU;
        ctx.strokeStyle = '#18233d'; ctx.lineWidth = 12 * sz; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, R, start, start + span); ctx.stroke();
        ctx.strokeStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(cx, cy, R, start, start + span * p); ctx.stroke();
        text(ctx, `${Math.round(p * 100)}%`, cx, cy, { size: fsz(W, H, 1.4), col: '#f8fafc', align: 'center', bold: true });
      } else if (style === 5) {
        const R = Math.min(W, H) * 0.25 * sz; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = '#18233d'; ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
        const wy = cy + R - 2 * R * p + Math.sin(t * spd * 4) * 4;
        ctx.fillStyle = pastel(C, 0, 3, 0.85); ctx.beginPath(); ctx.moveTo(cx - R, H); ctx.lineTo(cx - R, wy);
        for (let x = cx - R; x <= cx + R; x += 6) ctx.lineTo(x, wy + Math.sin(x * 0.08 + t * spd * 5) * 6);
        ctx.lineTo(cx + R, H); ctx.fill(); ctx.restore();
        text(ctx, `${Math.round(p * 100)}%`, cx, cy, { size: fsz(W, H, 1.2), col: '#f8fafc', align: 'center', bold: true });
      } else if (style === 4) {
        const segs = 8, gap = 6, bw = (W * 0.7 - gap * (segs - 1)) / segs, x0 = W * 0.15, y = cy, bh = 18 * sz;
        const onN = Math.round(p * segs);
        for (let i = 0; i < segs; i++) { ctx.fillStyle = i < onN ? (C.color || '#818cf8') : '#18233d'; rrect(ctx, x0 + i * (bw + gap), y, bw, bh, 4); ctx.fill(); }
      } else {
        const cols = 10, rows = 4, gap = 4; const bw = (W * 0.6 - gap * (cols - 1)) / cols, bh = (40 * sz - gap * (rows - 1)) / rows;
        const x0 = W * 0.2, y0 = cy - 20 * sz; const total = cols * rows, onN = Math.round(p * total);
        for (let i = 0; i < total; i++) { const c = i % cols, r = (i / cols) | 0; ctx.fillStyle = i < onN ? pastel(C, i, total) : '#18233d'; rrect(ctx, x0 + c * (bw + gap), y0 + r * (bh + gap), bw, bh, 2); ctx.fill(); }
      }
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(p, 2), cell: `${Math.round(p * 100)}%`, colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['ripple'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '波数', min: 1, max: 5, step: 1, value: 3 },
    extras: [T('square','方波',false)], remountKeys: [] },
  presets: { 默认: {}, '单波': { count:1 }, '多波': { count:4 }, '方波': { square:true }, '慢': { speed:0.35 } },
  doc: { title: '涟漪', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>点击/自动在指针处扩散波纹，对应 Material ripple。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 3)), 1, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), square = on(C.square);
      const cx = P.user ? P.x : W * (0.5 + 0.25 * Math.cos(t * 0.4));
      const cy = P.user ? P.y : H * (0.5 + 0.2 * Math.sin(t * 0.55));
      // button
      const bw = Math.min(W, H) * 0.35 * sz, bh = bw * 0.45;
      ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, W / 2 - bw / 2, H / 2 - bh / 2, bw, bh, 12); ctx.fill();
      text(ctx, 'Ripple', W / 2, H / 2, { size: fsz(W, H, 1.1), col: '#0b1020', align: 'center', bold: true });
      for (let i = 0; i < n; i++) {
        const u = (t * spd + i / n) % 1; const r = 10 + u * Math.min(W, H) * 0.35 * sz; const a = 1 - u;
        ctx.strokeStyle = hsla(hueOf(C.color), 80, 70, a); ctx.lineWidth = 3;
        if (square) { rrect(ctx, cx - r, cy - r, r * 2, r * 2, 8); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
      }
      return { mode: square ? '方波' : '圆波', ph: fmt((t * spd) % 1, 2), cell: `×${n}`, colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['carousel'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '圆角', min: 0, max: 32, step: 1, value: 16 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('slides','页数',3,8,1,5), T('autoplay','自动播放',true)], remountKeys: [] },
  presets: { 默认: {}, '滑移': { count:0 }, '淡入': { count:1 }, '封面流': { count:2 }, '垂直': { count:4 }, '循环快': { speed:1.6 } },
  doc: { title: '轮播', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('offset = (t × speed) mod slides') + F('slide_i 绘制于满幅舞台'), explain: '<p>轮播占满整个舞台。样式含滑移、淡入、3D 封面流、卡片堆、垂直、无限循环。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '轮播铺满舞台；调页数/速度/圆角。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), rad = num(C.size, 16), spd = num(C.speed, 0.9);
      const slides = clamp(Math.round(num(C.slides, 5)), 3, 8); const autoplay = on(C.autoplay);
      const names = ['滑移','淡入淡出','3D 封面流','卡片堆','垂直','无限循环'];
      // FULL STAGE inset — fill almost entire canvas
      const pad = 6; const x0 = pad, y0 = 10, ww = W - pad * 2, hh = H - pad - 28;
      const tpos = autoplay ? t * spd * 0.35 : (P.x / W) * slides;
      const idx = ((Math.floor(tpos) % slides) + slides) % slides;
      const frac = tpos - Math.floor(tpos);
      const drawSlide = (i, x, y, w, h, a = 1, sc = 1) => {
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc);
        ctx.fillStyle = pastel(C, i, slides); rrect(ctx, -w / 2, -h / 2, w, h, rad); ctx.fill();
        text(ctx, `${i + 1}`, 0, -8, { size: fsz(W, H, 2.2), col: '#0b1020', align: 'center', bold: true });
        text(ctx, names[style], 0, 28, { size: fsz(W, H, 0.95), col: 'rgba(15,23,42,.7)', align: 'center' });
        ctx.restore();
      };
      if (style === 0 || style === 5) {
        const off = frac * ww;
        drawSlide(idx, x0 - off, y0, ww, hh, 1, 1);
        drawSlide((idx + 1) % slides, x0 + ww - off, y0, ww, hh, 1, 1);
      } else if (style === 1) {
        drawSlide(idx, x0, y0, ww, hh, 1 - frac, 1);
        drawSlide((idx + 1) % slides, x0, y0, ww, hh, frac, 1);
      } else if (style === 2) {
        for (let k = -2; k <= 2; k++) {
          const i = ((idx + k) % slides + slides) % slides;
          const x = x0 + ww / 2 + (k - frac) * ww * 0.42; const sc = 1 - Math.abs(k - frac) * 0.18;
          drawSlide(i, x - ww * 0.32, y0 + hh * 0.08, ww * 0.64, hh * 0.84, 0.45 + 0.55 * sc, sc);
        }
      } else if (style === 3) {
        for (let k = 3; k >= 0; k--) {
          const i = ((idx + k) % slides + slides) % slides;
          const o = (k - frac) * 18;
          drawSlide(i, x0 + o, y0 + o, ww - o * 2, hh - o * 2, 1 - k * 0.15, 1);
        }
      } else { // vertical
        const off = frac * hh;
        drawSlide(idx, x0, y0 - off, ww, hh, 1, 1);
        drawSlide((idx + 1) % slides, x0, y0 + hh - off, ww, hh, 1, 1);
      }
      // dots
      for (let i = 0; i < slides; i++) {
        ctx.fillStyle = i === idx ? (C.color || '#818cf8') : '#334155';
        ctx.beginPath(); ctx.arc(W / 2 - (slides - 1) * 8 + i * 16, H - 14, i === idx ? 4.5 : 3.2, 0, TAU); ctx.fill();
      }
      const over = P.x >= x0 && P.x <= x0 + ww && P.y >= y0 && P.y <= y0 + hh;
      return { mode: names[style], ph: fmt(frac, 2), cell: over ? `第 ${idx + 1}/${slides} 页` : '—', slides, colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['accordion'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '圆角', min: 0, max: 20, step: 1, value: 10 },
    count: { label: '面板数', min: 2, max: 6, step: 1, value: 4 },
    extras: [T('multi','多开',false)], remountKeys: [] },
  presets: { 默认: {}, '三栏': { count:3 }, '多开': { multi:true }, '慢': { speed:0.35 } },
  doc: { title: '手风琴', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>手风琴：点开一块、高度过渡展开。默认单开，可开多开。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 4)), 2, 6), rad = num(C.size, 10), spd = num(C.speed, 0.9), multi = on(C.multi);
      const ml = 16, mt = 20, iw = W - 32, gap = 8;
      const openIdx = multi ? -1 : Math.floor((t * spd * 0.4) % n);
      const headerH = 36; let y = mt; let hit = null;
      const bodyMax = (H - mt - 20 - n * (headerH + gap)) / (multi ? n : 1);
      for (let i = 0; i < n; i++) {
        const open = multi ? (0.5 + 0.5 * Math.sin(t * spd + i)) > 0.35 : i === openIdx;
        const bh = open ? bodyMax * (0.7 + 0.3 * Math.abs(Math.sin(t * spd + i))) : 0;
        ctx.fillStyle = open ? pastel(C, i, n) : '#18233d'; rrect(ctx, ml, y, iw, headerH + bh, rad); ctx.fill();
        ctx.fillStyle = open ? '#0b1020' : '#e2e8f0';
        text(ctx, `面板 ${i + 1}`, ml + 14, y + headerH / 2, { size: fsz(W, H), col: open ? '#0b1020' : '#e2e8f0', bold: true });
        text(ctx, open ? '▾' : '▸', ml + iw - 22, y + headerH / 2, { size: fsz(W, H), col: open ? '#0b1020' : '#94a3b8', align: 'center' });
        if (open && bh > 8) text(ctx, '展开内容 · height transition', ml + 14, y + headerH + 16, { size: fsz(W, H, 0.85), col: 'rgba(15,23,42,.7)' });
        if (P.x >= ml && P.x <= ml + iw && P.y >= y && P.y <= y + headerH + bh) hit = i;
        y += headerH + bh + gap;
      }
      return { mode: multi ? '多开' : '单开', ph: fmt((t * spd) % 1, 2), cell: hit != null ? `面板${hit + 1}` : '—', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['modal'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '进出场', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('blurBg','模糊背景',true)], remountKeys: [] },
  presets: { 默认: {}, '淡入缩放': { count:0 }, '下滑': { count:1 }, '右滑': { count:2 }, '弹跳': { count:4 } },
  doc: { title: '弹层进出', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>Modal 进出场：淡入缩放、滑入、模糊背景、弹跳等。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), blurBg = on(C.blurBg);
      const names = ['淡入缩放','自下滑入','自右滑入','模糊背景','弹跳入','翻转入'];
      let u = (t * spd * 0.45) % 2; if (u > 1) u = 2 - u; const e = easeFn(style === 4 ? 'back' : 'ease-out', u);
      ctx.fillStyle = `rgba(5,8,16,${0.55 * e})`; ctx.fillRect(0, 8, W, H);
      if (blurBg || style === 3) { for (let i = 0; i < 3; i++) { ctx.fillStyle = pastel(C, i, 3, 0.15 * e); ctx.beginPath(); ctx.arc(W * (0.2 + i * 0.3), H * (0.3 + i * 0.15), 80 * sz, 0, TAU); ctx.fill(); } }
      const mw = Math.min(340, W * 0.7) * sz, mh = Math.min(200, H * 0.4) * sz;
      let dx = 0, dy = 0, sc = 0.85 + 0.15 * e, rot = 0;
      if (style === 1) dy = (1 - e) * 80; if (style === 2) dx = (1 - e) * 100; if (style === 0) sc = 0.7 + 0.3 * e;
      if (style === 4) sc = easeFn('back', e); if (style === 5) rot = (1 - e) * 0.5;
      ctx.save(); ctx.translate(W / 2 + dx, H / 2 + dy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = e;
      ctx.fillStyle = '#18233d'; rrect(ctx, -mw / 2, -mh / 2, mw, mh, 16); ctx.fill();
      ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, names[style], 0, -12, { size: fsz(W, H, 1.15), col: '#f8fafc', align: 'center', bold: true });
      text(ctx, 'Modal panel', 0, 16, { size: fsz(W, H, 0.9), col: '#94a3b8', align: 'center' });
      ctx.restore();
      return { mode: names[style], ph: fmt(e, 2), cell: e > 0.5 ? '打开' : '关闭中', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['reveal'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('amount','揭示量',0,1,0.01,0.7)], remountKeys: [] },
  presets: { 默认: {}, '擦除': { count:0 }, '百叶窗': { count:1 }, '圆形': { count:2 }, '对角': { count:3 } },
  doc: { title: '揭示', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>内容被遮罩逐渐揭示：擦除、百叶窗、圆形扩散、对角线、像素块、模糊清晰。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), amount = num(C.amount, 0.7);
      const names = ['遮罩擦除','百叶窗','圆形扩散','对角线','像素块','模糊清晰'];
      const a = clamp(amount * (0.75 + 0.25 * Math.sin(t * spd)), 0, 1);
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.color || '#818cf8'); g.addColorStop(1, pastel(C, 4));
      ctx.fillStyle = g; ctx.fillRect(0, 8, W, H);
      text(ctx, 'REVEAL', W / 2, H / 2, { size: fsz(W, H, 2), col: '#0b1020', align: 'center', bold: true });
      ctx.fillStyle = '#060a14';
      if (style === 0) ctx.fillRect(W * a, 8, W * (1 - a), H);
      else if (style === 1) { const bars = 10; for (let i = 0; i < bars; i++) { const bh = H / bars; const cut = a * W; ctx.fillRect(cut, 8 + i * bh, W - cut, bh - 1); } }
      else if (style === 2) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.55 * a * sz, 0, TAU); ctx.fill('evenodd'); }
      else if (style === 3) { ctx.beginPath(); ctx.moveTo(W * a * 2, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.lineTo(0, H * (1 - a)); ctx.closePath(); ctx.fill(); }
      else if (style === 4) { const cols = 8, rows = 6; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if ((c + r) / (cols + rows) > a) ctx.fillRect(c * W / cols, r * H / rows, W / cols + 1, H / rows + 1); } }
      else { ctx.globalAlpha = 1 - a; ctx.fillRect(0, 8, W, H); ctx.globalAlpha = 1; }
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#94a3b8' });
      return { mode: names[style], ph: fmt(a, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['neon'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '辉光', min: 0.3, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('flicker','闪烁',true)], remountKeys: [] },
  presets: { 默认: {}, '文字': { count:0 }, '边框': { count:1 }, '双色': { count:4 }, '故障': { count:5 } },
  doc: { title: '霓虹', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>霓虹发光字/边：多层阴影模拟 text-shadow / box-shadow 霓虹。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), glow = num(C.size, 1), spd = num(C.speed, 0.9), flicker = on(C.flicker);
      const names = ['文字','边框','按钮','图标','双色交替','故障闪'];
      const flick = flicker ? (0.75 + 0.25 * Math.sin(t * spd * 18)) : 1;
      const cx = W / 2, cy = H / 2; const col = C.color || '#818cf8'; const col2 = pastel(C, 3);
      const use = style === 4 ? (Math.sin(t * spd * 3) > 0 ? col : col2) : col;
      ctx.fillStyle = '#070b16'; ctx.fillRect(0, 8, W, H);
      if (style === 0 || style === 5) {
        ctx.save();
        if (style === 5) ctx.translate((Math.random() - 0.5) * 4 * glow, (Math.random() - 0.5) * 3);
        for (const [b, a] of [[40 * glow, 0.25], [20 * glow, 0.45], [8 * glow, 0.8]]) {
          ctx.shadowColor = use; ctx.shadowBlur = b * flick; ctx.fillStyle = use; ctx.globalAlpha = a * flick;
          text(ctx, 'NEON', cx, cy, { size: fsz(W, H, 2.4), col: use, align: 'center', bold: true });
        }
        ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        text(ctx, 'NEON', cx, cy, { size: fsz(W, H, 2.4), col: '#fff', align: 'center', bold: true });
      } else {
        const w = Math.min(W, H) * 0.45, h = w * 0.55;
        ctx.shadowColor = use; ctx.shadowBlur = 28 * glow * flick;
        ctx.strokeStyle = use; ctx.lineWidth = 3; rrect(ctx, cx - w / 2, cy - h / 2, w, h, 16); ctx.stroke();
        if (style === 2) { ctx.fillStyle = hsla(hueOf(use), 70, 20, 0.85); rrect(ctx, cx - w / 2, cy - h / 2, w, h, 16); ctx.fill(); }
        ctx.shadowBlur = 0; text(ctx, names[style], cx, cy, { size: fsz(W, H, 1.2), col: use, align: 'center', bold: true });
      }
      return { mode: names[style], ph: fmt(flick, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['liquid'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('visc','黏度',0.2,2,0.05,1)], remountKeys: [] },
  presets: { 默认: {}, '按钮': { count:0 }, 'blob': { count:1 }, '水滴': { count:2 }, '波浪': { count:4 } },
  doc: { title: '液态', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>液态/果冻变形：blob 边、水滴、波浪底边，悬停时黏滞拉伸。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), visc = num(C.visc, 1);
      const names = ['按钮变形','blob 边','水滴菜单','果冻点击','波浪底边','粘滞切换'];
      const cx = W / 2, cy = H / 2; const over = Math.hypot(P.x - cx, P.y - cy) < Math.min(W, H) * 0.3;
      const morph = (over ? 1 : 0.35) * (0.7 + 0.3 * Math.sin(t * spd * 2 / visc));
      ctx.fillStyle = C.color || '#818cf8';
      ctx.beginPath();
      const R = Math.min(W, H) * 0.22 * sz;
      if (style === 1 || style === 0 || style === 3 || style === 5) {
        for (let i = 0; i <= 32; i++) {
          const a = i / 32 * TAU; const wob = 1 + morph * 0.2 * Math.sin(a * 3 + t * spd * 3);
          const x = cx + Math.cos(a) * R * wob + (over ? (P.x - cx) * 0.08 : 0);
          const y = cy + Math.sin(a) * R * wob * (style === 0 ? 0.7 : 1) + (over ? (P.y - cy) * 0.08 : 0);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      } else if (style === 2) {
        ctx.ellipse(cx, cy - R * 0.2, R * 0.55, R * (0.9 + morph * 0.2), 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - R * 0.2, cy + R * 0.4); ctx.quadraticCurveTo(cx, cy + R * (1.2 + morph), cx + R * 0.2, cy + R * 0.4); ctx.fill();
      } else {
        rrect(ctx, cx - R * 1.4, cy - R * 0.6, R * 2.8, R * 1.2, 16); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - R * 1.4, cy + R * 0.6);
        for (let x = cx - R * 1.4; x <= cx + R * 1.4; x += 8) ctx.lineTo(x, cy + R * 0.6 + Math.sin(x * 0.08 + t * spd * 4) * 12 * morph);
        ctx.lineTo(cx + R * 1.4, cy + R * 1.2); ctx.lineTo(cx - R * 1.4, cy + R * 1.2); ctx.fill();
      }
      text(ctx, names[style], cx, cy, { size: fsz(W, H), col: '#0b1020', align: 'center', bold: true });
      return { mode: names[style], ph: fmt(morph, 2), cell: over ? '拉伸中' : '静止', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['marquee'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '字号感', min: 0.6, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('reverse','反向',false)], remountKeys: [] },
  presets: { 默认: {}, '横向': { count:0 }, '反向': { reverse:true }, '双行': { count:2 }, '垂直': { count:4 } },
  doc: { title: '跑马灯', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>无限滚动跑马灯：横向文字、双行、徽标带、垂直。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), reverse = on(C.reverse);
      const names = ['横向文字','反向','双行','徽标带','垂直','变速'];
      const dir = (reverse || style === 1) ? -1 : 1; const v = spd * (style === 5 ? (1.2 + Math.sin(t) * 0.8) : 1);
      const msg = '  Clyune  ·  CSS Marquee  ·  无限滚动  ·  ';
      ctx.fillStyle = '#0d1426'; ctx.fillRect(0, 8, W, H);
      const fs = fsz(W, H, 1.6 * sz); ctx.font = `700 ${fs}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`;
      const tw = ctx.measureText(msg).width; const off = ((t * v * 60 * dir) % tw + tw) % tw;
      if (style === 4) {
        const lines = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];
        for (let i = 0; i < lines.length; i++) {
          const y = ((t * v * 40 + i * 48) % (H + 48)) - 24;
          text(ctx, lines[i], W / 2, y, { size: fs, col: pastel(C, i, 5), align: 'center', bold: true });
        }
      } else {
        for (let row = 0; row < (style === 2 ? 2 : 1); row++) {
          const y = H * (style === 2 ? 0.35 + row * 0.28 : 0.5);
          const o = off + (row ? tw / 2 : 0);
          for (let k = -1; k <= 2; k++) text(ctx, msg, -o + k * tw + 20, y, { size: fs, col: row ? pastel(C, 2) : (C.color || '#818cf8'), bold: true });
        }
        if (style === 3) for (let i = 0; i < 6; i++) { const x = ((t * v * 50 + i * 120) % (W + 120)) - 60; ctx.fillStyle = pastel(C, i, 6); rrect(ctx, x, H * 0.7, 80, 36, 8); ctx.fill(); }
      }
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(off / Math.max(1, tw), 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['kenburns'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '缩放幅度', min: 0.2, max: 1.5, step: 0.05, value: 0.7 },
    count: { label: '路径', min: 0, max: 3, step: 1, value: 0 },
    extras: [], remountKeys: [] },
  presets: { 默认: {}, '慢推': { count:1, speed:0.35 }, '对角': { count:2 }, '急拉': { count:3, speed:1.8 } },
  doc: { title: 'Ken Burns', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>Ken Burns：画面缓慢缩放+平移，常用于幻灯纪录片感。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 3), amp = num(C.size, 0.7), spd = num(C.speed, 0.9);
      const names = ['默认','慢推','对角','急拉'];
      const u = (t * spd * (style === 3 ? 0.55 : 0.2)) % 1; const e = easeFn('ease-in-out', u);
      const sc = 1 + amp * 0.35 * e;
      let ox = 0, oy = 0;
      if (style === 0) { ox = e * 40; oy = e * 20; }
      if (style === 1) { ox = e * 20; oy = -e * 30; }
      if (style === 2) { ox = e * 60; oy = e * 50; }
      if (style === 3) { ox = Math.sin(e * Math.PI) * 80; oy = Math.cos(e * Math.PI) * 40; }
      ctx.save(); ctx.translate(W / 2 + ox, H / 2 + oy); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.color || '#818cf8'); g.addColorStop(0.5, pastel(C, 2)); g.addColorStop(1, pastel(C, 5));
      ctx.fillStyle = g; ctx.fillRect(-40, -40, W + 80, H + 80);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = pastel(C, i, 8, 0.35); ctx.beginPath(); ctx.arc((i * 97) % W, (i * 53) % H, 40 + i * 8, 0, TAU); ctx.fill(); }
      ctx.restore();
      text(ctx, 'Ken Burns · ' + names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.9), col: '#0b1020', bold: true });
      return { mode: names[style], ph: fmt(e, 2), cell: `zoom ${fmt(sc, 2)}`, colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['shake'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('amp','幅度',2,28,1,10)], remountKeys: [] },
  presets: { 默认: {}, '左右': { count:0 }, '旋转': { count:2 }, '心跳': { count:4 }, '强震': { amp:22 } },
  doc: { title: '抖动反馈', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>错误/提醒抖动：左右、上下、旋转、弹性、心跳、震动条。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), amp = num(C.amp, 10);
      const names = ['左右','上下','旋转','弹性','心跳','震动条'];
      const burst = Math.abs(Math.sin(t * spd * 6));
      let dx = 0, dy = 0, rot = 0, sc = 1;
      if (style === 0) dx = Math.sin(t * spd * 40) * amp * burst;
      if (style === 1) dy = Math.sin(t * spd * 40) * amp * burst;
      if (style === 2) rot = Math.sin(t * spd * 30) * 0.15 * burst * (amp / 10);
      if (style === 3) { dx = Math.sin(t * spd * 20) * amp * burst; sc = 1 + 0.05 * burst; }
      if (style === 4) sc = 1 + 0.12 * Math.abs(Math.sin(t * spd * 8));
      const cx = W / 2, cy = H / 2, w = Math.min(W, H) * 0.4 * sz, h = w * 0.55;
      ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, -w / 2, -h / 2, w, h, 14); ctx.fill();
      text(ctx, style === 5 ? '|||||||' : 'Shake!', 0, 0, { size: fsz(W, H, 1.2), col: '#0b1020', align: 'center', bold: true });
      ctx.restore();
      if (style === 5) for (let i = 0; i < 7; i++) { const hh = 20 + Math.random() * amp * 2; ctx.fillStyle = pastel(C, i, 7); rrect(ctx, cx - 60 + i * 18, cy + h * 0.5 + 20, 10, hh, 2); ctx.fill(); }
      return { mode: names[style], ph: fmt(burst, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['keyseq'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '序列', min: 0, max: 7, step: 1, value: 0 },
    extras: [T('loop','循环',true)], remountKeys: [] },
  presets: { 默认: {}, '行走': { count:0 }, '变形': { count:1 }, '节拍': { count:2 }, '呼吸': { count:4 } },
  doc: { title: '关键帧序列', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>复杂 @keyframes 多段叙事：位移、缩放、旋转、颜色节拍组合。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 7), sz = num(C.size, 1), spd = num(C.speed, 0.9), loop = on(C.loop);
      const names = ['行走循环','加载变形','颜色节拍','路径感位移','缩放呼吸组合','旋转+位移','闪烁摩斯','多段叙事'];
      let u = loop ? ((t * spd * 0.4) % 1) : Math.min(t * spd * 0.4, 1);
      const cx = W / 2, cy = H / 2; const s = Math.min(W, H) * 0.12 * sz;
      let x = cx, y = cy, sc = 1, rot = 0, a = 1;
      if (style === 0) { x = cx + Math.sin(u * TAU) * W * 0.28; y = cy + Math.abs(Math.sin(u * TAU * 2)) * -20; }
      if (style === 1) { sc = 0.6 + 0.6 * Math.abs(Math.sin(u * Math.PI)); rot = u * TAU; }
      if (style === 2) { /* color beat below */ }
      if (style === 3) { x = cx + Math.cos(u * TAU) * W * 0.25; y = cy + Math.sin(u * TAU * 2) * H * 0.2; }
      if (style === 4) { sc = 0.85 + 0.3 * Math.sin(u * TAU); }
      if (style === 5) { rot = u * TAU; x = cx + Math.cos(u * TAU) * 60; }
      if (style === 6) { a = (Math.floor(u * 16) % 2) ? 1 : 0.15; }
      if (style === 7) { const seg = Math.floor(u * 4); sc = seg === 1 ? 1.3 : 1; rot = seg === 2 ? 0.4 : 0; y = cy + (seg === 3 ? 40 : 0); }
      const col = style === 2 ? hsla(hueOf(C.color) + u * 200, 80, 60) : (C.color || '#818cf8');
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = a;
      ctx.fillStyle = col; rrect(ctx, -s, -s, s * 2, s * 2, 14); ctx.fill();
      text(ctx, names[style].slice(0, 2), 0, 0, { size: fsz(W, H), col: '#0b1020', align: 'center', bold: true });
      ctx.restore();
      // path guide
      ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.28, H * 0.2, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return { mode: names[style], ph: fmt(u, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: x, hy: y };

  }; },
};

FAM['neumorph'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '凸起感', min: 0.3, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('inset','凹陷',false)], remountKeys: [] },
  presets: { 默认: {}, '凸起': { inset:false }, '凹陷': { inset:true }, '软': { size:0.5 }, '硬': { size:1.6 } },
  doc: { title: '新拟态', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>新拟态：浅底上双阴影做出凸起/凹陷按钮感。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), inset = on(C.inset);
      const names = ['凸起','凹陷','软','硬','彩光','单'];
      ctx.fillStyle = '#1a2238'; ctx.fillRect(0, 8, W, H);
      const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.28 * (0.8 + sz * 0.2);
      const press = inset || style === 1 || (Math.sin(t * spd * 2) > 0.7 && style === 0);
      const blur = (style === 2 ? 12 : style === 3 ? 28 : 20) * sz;
      ctx.save();
      if (!press) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 10; }
      ctx.fillStyle = '#1a2238'; rrect(ctx, cx - s, cy - s, s * 2, s * 2, s * 0.35); ctx.fill();
      ctx.shadowColor = style === 4 ? (C.color || '#818cf8') : 'rgba(255,255,255,.08)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = -8; ctx.shadowOffsetY = -8;
      ctx.fillStyle = '#1a2238'; rrect(ctx, cx - s, cy - s, s * 2, s * 2, s * 0.35); ctx.fill();
      ctx.restore();
      if (press) { ctx.fillStyle = 'rgba(0,0,0,.25)'; rrect(ctx, cx - s + 4, cy - s + 4, s * 2 - 8, s * 2 - 8, s * 0.3); ctx.fill(); }
      ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.28, 0, TAU); ctx.fill();
      text(ctx, press ? 'inset' : 'raised', cx, cy + s * 0.65, { size: fsz(W, H), col: '#94a3b8', align: 'center' });
      return { mode: names[style], ph: fmt((t * spd) % 1, 2), cell: press ? '凹陷' : '凸起', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['cursor-fx'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '环大小', min: 0.4, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('trail','拖尾',true)], remountKeys: [] },
  presets: { 默认: {}, '环': { count:0 }, '点': { count:1 }, '拖尾': { trail:true }, '大': { size:1.6 } },
  doc: { title: '自定义光标', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>自定义光标环跟随指针（或自动巡游），可带拖尾。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), trail = on(C.trail);
      const names = ['环','点','拖尾','混合','大','小'];
      const cx = P.user ? P.x : W * (0.5 + 0.35 * Math.cos(t * spd * 0.7));
      const cy = P.user ? P.y : H * (0.5 + 0.28 * Math.sin(t * spd * 0.9));
      // decorative cards
      for (let i = 0; i < 3; i++) { ctx.fillStyle = pastel(C, i, 3, 0.35); rrect(ctx, 40 + i * (W / 4), 60 + (i % 2) * 40, W * 0.2, H * 0.35, 14); ctx.fill(); }
      const R = 18 * sz * (style === 4 ? 1.5 : style === 5 ? 0.6 : 1);
      if (trail || style === 2) {
        for (let k = 6; k >= 1; k--) {
          ctx.strokeStyle = hsla(hueOf(C.color), 80, 65, 0.15); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx - k * 4, cy - k * 2, R * (1 - k * 0.05), 0, TAU); ctx.stroke();
        }
      }
      ctx.strokeStyle = C.color || '#818cf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      if (style !== 0) { ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(cx, cy, 4 * sz, 0, TAU); ctx.fill(); }
      return { mode: names[style], ph: fmt((t * spd) % 1, 2), cell: `光标 (${fmt(cx, 0)},${fmt(cy, 0)})`, colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['text-stroke'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '描边粗', min: 1, max: 10, step: 0.5, value: 3 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('dash','虚线跑',true)], remountKeys: [] },
  presets: { 默认: {}, '细': { size:1.5 }, '粗': { size:7 }, '霓虹': { count:4 }, '慢': { speed:0.3 } },
  doc: { title: '文字描边动', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>文字描边沿路径奔跑（stroke-dashoffset 感），可虚线流动。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), lw = num(C.size, 3), spd = num(C.speed, 0.9), dash = on(C.dash);
      const names = ['细','粗','快','慢','霓虹','单'];
      const cx = W / 2, cy = H / 2; const label = 'STROKE';
      ctx.fillStyle = '#070b16'; ctx.fillRect(0, 8, W, H);
      ctx.font = `800 ${Math.min(W, H) * 0.22}px ui-sans-serif,system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const off = (t * spd * 80) % 80;
      if (dash || style !== 5) ctx.setLineDash([18, 14]); ctx.lineDashOffset = -off;
      ctx.lineWidth = lw; ctx.strokeStyle = style === 4 ? hsla(hueOf(C.color) + t * spd * 80, 90, 60) : (C.color || '#818cf8');
      if (style === 4) { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; }
      ctx.strokeText(label, cx, cy);
      ctx.setLineDash([]); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(248,250,252,.08)'; ctx.fillText(label, cx, cy);
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(off / 80, 2), cell: label, colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['border-beam'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '光束粗', min: 1, max: 12, step: 0.5, value: 4 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [T('dual','双色',true)], remountKeys: [] },
  presets: { 默认: {}, '快': { speed:1.8 }, '慢': { speed:0.3 }, '粗光': { size:9 }, '双色': { dual:true } },
  doc: { title: '边框光束', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>光束沿圆角矩形边框旋转奔跑，常见于高亮卡片。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), lw = num(C.size, 4), spd = num(C.speed, 0.9), dual = on(C.dual);
      const names = ['快','慢','粗光','细光','双色','单色'];
      const pad = 28; const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2 - 8; const rad = 20;
      ctx.fillStyle = '#0d1426'; rrect(ctx, x, y, w, h, rad); ctx.fill();
      ctx.strokeStyle = '#24314f'; ctx.lineWidth = 2; rrect(ctx, x, y, w, h, rad); ctx.stroke();
      // perimeter beam via arc length param
      const per = 2 * (w + h - 4 * rad) + TAU * rad; // approx
      const u = (t * spd * 0.35) % 1; const beamLen = 0.12;
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      const drawBeam = (u0, col) => {
        ctx.strokeStyle = col; ctx.beginPath();
        // sample points along rounded rect
        const N = 80; let started = false;
        for (let i = 0; i <= N; i++) {
          const p = (u0 + i / N * beamLen) % 1; const d = p * (2 * (w + h));
          let px, py;
          if (d < w) { px = x + d; py = y; }
          else if (d < w + h) { px = x + w; py = y + (d - w); }
          else if (d < 2 * w + h) { px = x + w - (d - w - h); py = y + h; }
          else { px = x; py = y + h - (d - 2 * w - h); }
          started ? ctx.lineTo(px, py) : (ctx.moveTo(px, py), started = true);
        }
        ctx.stroke();
      };
      drawBeam(u, C.color || '#818cf8');
      if (dual || style === 4) drawBeam((u + 0.5) % 1, pastel(C, 3));
      text(ctx, 'Border Beam', W / 2, H / 2, { size: fsz(W, H, 1.2), col: '#e2e8f0', align: 'center', bold: true });
      return { mode: names[style], ph: fmt(u, 2), cell: '光束', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['spotlight'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '光斑', min: 0.3, max: 2, step: 0.05, value: 1 },
    count: { label: '样式', min: 0, max: 5, step: 1, value: 0 },
    extras: [R('bright','亮度',0.2,1,0.05,0.7)], remountKeys: [] },
  presets: { 默认: {}, '小光': { size:0.5 }, '大光': { size:1.6 }, '强': { bright:1 }, '彩': { count:4 } },
  doc: { title: '聚光跟随', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>暗幕上开一束跟随指针的聚光，照亮下方卡片。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 5), sz = num(C.size, 1), spd = num(C.speed, 0.9), bright = num(C.bright, 0.7);
      const names = ['小光','大光','强','弱','彩','白'];
      // content
      for (let i = 0; i < 6; i++) {
        const x = 30 + (i % 3) * (W / 3.2), y = 40 + ((i / 3) | 0) * (H / 2.4);
        ctx.fillStyle = pastel(C, i, 6, 0.85); rrect(ctx, x, y, W / 3.6, H / 3.2, 14); ctx.fill();
        text(ctx, `Card ${i + 1}`, x + 16, y + 28, { size: fsz(W, H), col: '#0b1020', bold: true });
      }
      const sx = P.user ? P.x : W * (0.5 + 0.3 * Math.cos(t * spd * 0.6));
      const sy = P.user ? P.y : H * (0.5 + 0.25 * Math.sin(t * spd * 0.8));
      const R = Math.min(W, H) * 0.28 * sz;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      const col = style === 5 ? '255,255,255' : (style === 4 ? `${Math.round(hsla(hueOf(C.color)+t*40,80,60).length && 129)},140,248` : null);
      // simpler
      g.addColorStop(0, `rgba(255,255,255,${0.01})`);
      g.addColorStop(0.01, 'rgba(0,0,0,0)');
      // dark overlay with hole via destination-out feels hard; draw dark then cut with lighter composite
      ctx.fillStyle = `rgba(2,4,12,${0.75 - bright * 0.25})`; ctx.fillRect(0, 8, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      const hole = ctx.createRadialGradient(sx, sy, R * 0.05, sx, sy, R);
      hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hole; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      // tint
      if (style === 4) { ctx.fillStyle = hsla(hueOf(C.color) + t * 30, 80, 60, 0.12); ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill(); }
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#94a3b8' });
      return { mode: names[style], ph: fmt((t * spd) % 1, 2), cell: `光斑 (${fmt(sx, 0)},${fmt(sy, 0)})`, colorHex: String(C.color || '').toLowerCase(), hx: sx, hy: sy };

  }; },
};

FAM['keyframes'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '场景', min: 0, max: 3, step: 1, value: 0 },
    extras: [T('shine','流光',true)], remountKeys: [] },
  presets: { 默认: {}, '加载': { count:0 }, '过渡': { count:1 }, '流光字': { count:2 }, '慢': { speed:0.3 } },
  doc: { title: 'Keyframes 与渐变文字', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>@keyframes 入门：加载点、过渡曲线小球、流光渐变文字同台演示。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 3), sz = num(C.size, 1), spd = num(C.speed, 0.9), shine = on(C.shine);
      const names = ['加载','过渡','流光字','综合'];
      // left: loader dots
      for (let i = 0; i < 3; i++) {
        const y = H * 0.35 + Math.sin(t * spd * TAU * 2 + i * 1.2) * 18 * sz;
        ctx.fillStyle = pastel(C, i, 3); ctx.beginPath(); ctx.arc(W * 0.2 + i * 28 * sz, y, 10 * sz, 0, TAU); ctx.fill();
      }
      // center: ease ball
      const e = easeFn('ease-in-out', (t * spd * 0.4) % 1);
      ctx.fillStyle = C.color || '#818cf8'; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.3 + e * H * 0.4, 16 * sz, 0, TAU); ctx.fill();
      // right / bottom: shine text
      const label = 'Keyframes';
      ctx.font = `800 ${Math.min(W, H) * 0.12 * sz}px ui-sans-serif,system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const g = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
      const sh = shine ? (t * spd * 0.5) % 1 : 0.5;
      g.addColorStop(clamp(sh - 0.2, 0, 1), pastel(C, 0)); g.addColorStop(sh, '#fff'); g.addColorStop(clamp(sh + 0.2, 0, 1), pastel(C, 3));
      ctx.fillStyle = g; ctx.fillText(label, W / 2, H * 0.78);
      text(ctx, names[style], 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: names[style], ph: fmt(e, 2), cell: names[style], colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['glass'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '模糊感', min: 0.2, max: 2, step: 0.05, value: 1 },
    count: { label: '卡片数', min: 1, max: 4, step: 1, value: 2 },
    extras: [R('alpha','透明度',0.05,0.5,0.01,0.18)], remountKeys: [] },
  presets: { 默认: {}, '清晰': { size:0.4 }, '大模糊': { size:1.7 }, '多卡': { count:3 }, '慢漂': { speed:0.3 } },
  doc: { title: '玻璃拟态', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>Glassmorphism：半透明卡片叠在流动色斑上，模拟 backdrop-filter 毛玻璃。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 2)), 1, 4), blur = num(C.size, 1), spd = num(C.speed, 0.9), alpha = num(C.alpha, 0.18);
      // blobs
      for (let i = 0; i < 4; i++) {
        const x = W * (0.2 + 0.2 * i) + Math.sin(t * spd + i) * 30;
        const y = H * (0.3 + 0.15 * (i % 3)) + Math.cos(t * spd * 0.8 + i) * 25;
        ctx.fillStyle = pastel(C, i, 4, 0.55); ctx.beginPath(); ctx.arc(x, y, 70 * blur, 0, TAU); ctx.fill();
      }
      // faux frosted cards
      let hit = null;
      for (let i = 0; i < n; i++) {
        const cw = Math.min(280, W * 0.4), ch = Math.min(160, H * 0.35);
        const x = W * (0.15 + i * 0.2) % (W - cw - 20); const y = H * (0.25 + (i % 2) * 0.2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; rrect(ctx, x, y, cw, ch, 18); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
        text(ctx, 'Glass Card', x + 16, y + 36, { size: fsz(W, H, 1.1), col: '#f8fafc', bold: true });
        text(ctx, `blur≈${fmt(blur * 16, 0)}px`, x + 16, y + 64, { size: fsz(W, H, 0.85), col: '#cbd5e1' });
        if (P.x >= x && P.x <= x + cw && P.y >= y && P.y <= y + ch) hit = i;
      }
      return { mode: `glass×${n}`, ph: fmt((t * spd) % 1, 2), cell: hit != null ? `卡${hit + 1}` : '—', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};

FAM['tilt'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '尺寸', min: 0.5, max: 2, step: 0.05, value: 1 },
    count: { label: '卡片', min: 1, max: 3, step: 1, value: 1 },
    extras: [R('maxTilt','最大倾角',0.1,0.8,0.05,0.35), T('glare','光泽',true)], remountKeys: [] },
  presets: { 默认: {}, '单卡': { count:1 }, '双卡': { count:2 }, '强倾': { maxTilt:0.65 }, '慢': { speed:0.3 } },
  doc: { title: '3D 倾斜卡片', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>指针驱动 rotateX/Y 倾斜；可叠加光泽高光，点击感翻转。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const n = clamp(Math.round(num(C.count, 1)), 1, 3), sz = num(C.size, 1), spd = num(C.speed, 0.9), maxTilt = num(C.maxTilt, 0.35), glare = on(C.glare);
      const cx = W / 2, cy = H / 2;
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * Math.min(W, H) * 0.28;
        const rx = clamp((P.y - cy) / H, -1, 1) * maxTilt; const ry = clamp((P.x - cx - ox) / W, -1, 1) * maxTilt;
        const w = Math.min(W, H) * 0.32 * sz, h = w * 0.62;
        // fake perspective squash
        const scY = 1 - Math.abs(rx) * 0.25, scX = 1 - Math.abs(ry) * 0.2;
        ctx.save(); ctx.translate(cx + ox + ry * 20, cy + rx * 16); ctx.scale(scX, scY);
        ctx.fillStyle = pastel(C, i, 3); rrect(ctx, -w / 2, -h / 2, w, h, 16); ctx.fill();
        if (glare) {
          const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
          g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.4, 'transparent');
          ctx.fillStyle = g; rrect(ctx, -w / 2, -h / 2, w, h, 16); ctx.fill();
        }
        text(ctx, 'Tilt', 0, 0, { size: fsz(W, H, 1.2), col: '#0b1020', align: 'center', bold: true });
        ctx.restore();
      }
      text(ctx, `tilt ${(maxTilt * 57).toFixed(0)}°`, 12, fsz(W, H) * 0.7, { size: fsz(W, H, 0.85), col: '#64748b' });
      return { mode: `tilt×${n}`, ph: fmt((t * spd) % 1, 2), cell: '倾斜中', colorHex: String(C.color || '').toLowerCase(), hx: cx, hy: cy };

  }; },
};

FAM['scroll'] = {
  spec: { color: { label: '主色', value: '#818cf8' }, speed: SPD(),
    size: { label: '段落数', min: 3, max: 10, step: 1, value: 6 },
    count: { label: '样式', min: 0, max: 3, step: 1, value: 0 },
    extras: [R('view','视口进度',0,1,0.01,0.35)], remountKeys: [] },
  presets: { 默认: {}, '淡入': { count:0 }, '滑入': { count:1 }, '缩放': { count:2 }, '进度中': { view:0.5 } },
  doc: { title: '滚动驱动', rows: (v) => [['模式', v.mode], ['相位', v.ph], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]], formula: () => F('progress = fract(t × speed)'), explain: '<p>模拟 animation-timeline: view()：随「滚动进度」段落依次入场。</p>', params: [['主色','强调色'],['速度','动画快慢'],['尺寸','几何大小'],['数量','元素/样式']], example: (v) => `<ol><li>${v.mode}</li><li>相位 ${v.ph}</li></ol>`, tip: '悬停或拖动指针；调滑条看几何变化。' },
  build(S) { return ({ ctx, W, H, t, C, P }) => { S.clear(); chip(ctx, W, H, C);

      const style = clamp(Math.round(num(C.count, 0)), 0, 3), n = clamp(Math.round(num(C.size, 6)), 3, 10), spd = num(C.speed, 0.9), view = num(C.view, 0.35);
      const names = ['淡入','滑入','缩放','擦除'];
      const progress = clamp(view + 0.15 * Math.sin(t * spd * 0.5), 0, 1);
      const ml = 20, mt = 24, iw = W - 40, gap = 10;
      const rowH = (H - mt - 20 - gap * (n - 1)) / n; let hit = null;
      for (let i = 0; i < n; i++) {
        const appear = clamp((progress * n - i), 0, 1); const e = easeFn('ease-out', appear);
        const y = mt + i * (rowH + gap); let x = ml, a = e, sc = 1;
        if (style === 1) x = ml + (1 - e) * 40; if (style === 2) sc = 0.85 + 0.15 * e; if (style === 0) a = e;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x + iw / 2, y + rowH / 2); ctx.scale(sc, sc);
        ctx.fillStyle = pastel(C, i, n); rrect(ctx, -iw / 2, -rowH / 2, iw, rowH, 10); ctx.fill();
        text(ctx, `Section ${i + 1}`, 0, 0, { size: fsz(W, H, 0.95), col: '#0b1020', align: 'center', bold: true });
        ctx.restore();
        if (P.y >= y && P.y <= y + rowH) hit = i;
      }
      // scrollbar
      ctx.fillStyle = '#18233d'; rrect(ctx, W - 12, mt, 4, H - mt - 20, 2); ctx.fill();
      ctx.fillStyle = C.color || '#818cf8'; rrect(ctx, W - 12, mt + progress * (H - mt - 60), 4, 40, 2); ctx.fill();
      return { mode: names[style], ph: fmt(progress, 2), cell: hit != null ? `S${hit + 1}` : '—', colorHex: String(C.color || '').toLowerCase(), hx: W / 2, hy: H / 2 };

  }; },
};


const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, (v.doc.title || k).split('·')[0].trim()]));

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'pulse');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'pulse';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-css',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count', 'spread', 'fillRing', 'trail', 'glow', 'angle', 'loop', 'boost', 'delay', 'scaleIn', 'shuffle', 'reveal', 'persp', 'hoverGo', 'depth', 'amount', 'follow', 'shimmer', 'auto', 'square', 'slides', 'autoplay', 'multi', 'blurBg', 'flicker', 'visc', 'reverse', 'amp', 'inset', 'dash', 'dual', 'bright', 'shine', 'alpha', 'maxTilt', 'glare', 'view'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    presetDefaults: F0.presets && { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => {
      const S = createCanvasStage(box, o, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: 'crosshair' });
      S.onFrame(F0.build(S));
      return () => S.destroy();
    },
  });
}
