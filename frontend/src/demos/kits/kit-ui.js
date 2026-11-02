/**
 * kit-ui — UI component patterns as interactive canvas labs.
 * Knobs drive real geometry/pixels; LIVE .mip readout; beginner Chinese docs.
 * /ui/car carousel fills the full stage. No in-canvas control overlays (mobile-safe).
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
const inR = (P, x, y, w, h) => P.x >= x && P.x <= x + w && P.y >= y && P.y <= y + h;
const btnBox = (ctx, x, y, w, h, r, fill, label, W, H, col = '#0b1020') => { ctx.fillStyle = fill; rrect(ctx, x, y, w, h, r); ctx.fill(); if (label) text(ctx, label, x + w / 2, y + h / 2, { size: fsz(W, H, 0.9), col, align: 'center', bold: true }); };
const line = (ctx, x0, y0, x1, y1, col, lw = 2) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const caret = (ctx, x, y, t, col) => { if (Math.sin(t * 6) > 0) { ctx.fillStyle = col; ctx.fillRect(x, y - 9, 2, 18); } };

/** uiFam: shared doc/spec wrapper so every family has LIVE rows, formula, Chinese docs, example ≥10 chars. */
function uiFam(d) {
  const spec = { color: { label: '主色', value: d.color || '#818cf8' }, speed: SPD(d.spdLabel || '动画速度'), size: d.size, count: d.count, extras: d.extras || [], remountKeys: [] };
  return {
    spec,
    presets: { 默认: {}, ...(d.presets || {}) },
    doc: {
      title: d.title,
      rows: (v) => [['模式', v.mode], ['数量', v.n], ['悬停', v.cell, 'cell'], ['主色', v.colorHex]],
      formula: () => F(d.formula || 'progress = ease(fract(t × 速度))') + (d.formula2 ? F(d.formula2) : ''),
      explain: `<p>${d.explain}</p>`,
      params: [['主色', '组件强调色（按钮、选中态、高亮）'], [spec.speed.label, '过渡/循环动画快慢'], [d.size.label, d.sizeDoc || '组件几何尺寸'], [d.count.label, d.countDoc || '元素个数或样式档']].concat((d.extras || []).map((e) => [e.label, d.extraDoc || '额外开关/强度'])),
      example: (v) => `<ol><li>当前：${v.mode}，共 ${v.n} 项</li><li>悬停位置：${v.cell}</li><li>主色 ${v.colorHex}，拖滑条观察变化</li></ol>`,
      tip: d.tip || '移动指针悬停组件看读数；拖动右侧滑条立即改变外观。',
    },
    build(S) {
      return ({ ctx, W, H, t, C, P }) => {
        S.clear();
        ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 8, W, H);
        chip(ctx, W, H, C);
        const k = { n: Math.round(num(C.count, d.count.value)), s: num(C.size, d.size.value), spd: num(C.speed, 0.9), col: C.color || '#818cf8' };
        const r = d.draw(ctx, W, H, t * k.spd, C, P, k) || {};
        return { mode: r.mode || d.title, n: String(r.n ?? k.n), cell: r.cell || '（移到组件上）', colorHex: String(C.color || '').toLowerCase(), hx: r.hx ?? W / 2, hy: r.hy ?? H / 2 };
      };
    },
  };
}

FAM.buttons = uiFam({ title: '按钮合集', size: { label: '按钮高度', min: 28, max: 64, step: 1, value: 42 }, count: { label: '按钮数', min: 2, max: 8, step: 1, value: 4 },
  extras: [T('pill', '胶囊圆角', true)], presets: { 少: { count: 2 }, 多: { count: 8 }, 大: { size: 60 }, 方角: { pill: false } },
  explain: '常见按钮：实心、描边、幽灵、渐变。悬停上浮+发光，按下缩小，对应 CSS :hover / :active 过渡。', formula: 'hover: translateY(−2px)，shadow 扩散', formula2: 'active: scale(0.96)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), h = k.s, cols = Math.min(n, W < 500 ? 2 : 4), rows = Math.ceil(n / cols);
    const gw = (W - 40) / cols, gh = Math.min(h * 2, (H - 40) / rows), r = on(C.pill) ? h / 2 : 6; let cell = null;
    const kinds = ['实心', '描边', '幽灵', '渐变', '危险', '成功', '图标', '加载'];
    for (let i = 0; i < n; i++) {
      const bw = gw - 18, x = 20 + (i % cols) * gw + 9, y0 = 24 + ((i / cols) | 0) * gh + (gh - h) / 2;
      const hov = inR(P, x, y0, bw, h), lift = hov ? -3 : Math.sin(t * 2 + i) * 1.2, y = y0 + lift;
      if (hov) { cell = kinds[i]; ctx.save(); ctx.shadowColor = k.col; ctx.shadowBlur = 18; }
      if (i % 4 === 0) btnBox(ctx, x, y, bw, h, r, k.col, kinds[i], W, H);
      else if (i % 4 === 1) { ctx.strokeStyle = k.col; ctx.lineWidth = 2; rrect(ctx, x, y, bw, h, r); ctx.stroke(); text(ctx, kinds[i], x + bw / 2, y + h / 2, { size: fsz(W, H, 0.9), col: k.col, align: 'center', bold: true }); }
      else if (i % 4 === 2) { ctx.fillStyle = hsla(hueOf(k.col), 60, 60, 0.15); rrect(ctx, x, y, bw, h, r); ctx.fill(); text(ctx, kinds[i], x + bw / 2, y + h / 2, { size: fsz(W, H, 0.9), col: '#e2e8f0', align: 'center' }); }
      else { const g = ctx.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, k.col); g.addColorStop(1, pastel(C, 3)); btnBox(ctx, x, y, bw, h, r, g, kinds[i], W, H); }
      if (hov) ctx.restore();
    }
    return { mode: on(C.pill) ? '胶囊' : '方角', cell: cell || '（移到按钮上）' };
  } });

FAM.cards = uiFam({ title: '卡片与弹窗', size: { label: '卡片圆角', min: 0, max: 28, step: 1, value: 14 }, count: { label: '卡片数', min: 1, max: 6, step: 1, value: 3 },
  extras: [T('modal', '显示弹窗', true)], presets: { 单卡: { count: 1 }, 多卡: { count: 6 }, 直角: { size: 0 }, 无弹窗: { modal: false } },
  explain: '卡片悬停上浮；点击后出现模态弹窗与半透明遮罩，弹窗缩放淡入。', formula: 'modal: scale 0.9→1, opacity 0→1', formula2: 'backdrop: rgba(0,0,0,.5)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 6), cols = Math.min(n, W < 500 ? 2 : 3), rows = Math.ceil(n / cols), gw = (W - 32) / cols, gh = (H - 40) / rows; let cell = null;
    for (let i = 0; i < n; i++) {
      const x = 16 + (i % cols) * gw + 6, y = 24 + ((i / cols) | 0) * gh + 6, w = gw - 12, h = gh - 12, hov = inR(P, x, y, w, h);
      const lift = hov ? -4 : 0; if (hov) cell = `卡片 ${i + 1}`;
      ctx.fillStyle = '#141d33'; rrect(ctx, x, y + lift, w, h, k.s); ctx.fill();
      ctx.fillStyle = pastel(C, i, n, 0.8); rrect(ctx, x, y + lift, w, Math.min(h * 0.45, 80), k.s); ctx.fill();
      text(ctx, `Card ${i + 1}`, x + 12, y + lift + Math.min(h * 0.45, 80) + 18, { size: fsz(W, H), col: '#e2e8f0', bold: true });
    }
    if (on(C.modal)) {
      const a = 0.5 + 0.5 * Math.sin(t * 1.2); const sc = 0.92 + 0.08 * a;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 8, W, H);
      const mw = Math.min(W * 0.7, 340) * sc, mh = Math.min(H * 0.5, 180) * sc;
      ctx.fillStyle = '#18233d'; rrect(ctx, (W - mw) / 2, (H - mh) / 2, mw, mh, k.s); ctx.fill();
      ctx.strokeStyle = k.col; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, '确认操作？', W / 2, H / 2 - mh * 0.2, { size: fsz(W, H, 1.1), col: '#f8fafc', align: 'center', bold: true });
      btnBox(ctx, W / 2 - 50, H / 2 + mh * 0.1, 100, 30, 8, k.col, '确定', W, H);
    }
    return { mode: on(C.modal) ? '弹窗打开' : '仅卡片', cell: cell || '（移到卡片上）' };
  } });

FAM.input = uiFam({ title: '输入控件', size: { label: '输入框高度', min: 30, max: 60, step: 1, value: 40 }, count: { label: '字段数', min: 1, max: 5, step: 1, value: 3 },
  extras: [T('err', '校验报错', false)], presets: { 单字段: { count: 1 }, 表单: { count: 5 }, 报错: { err: true }, 大号: { size: 56 } },
  explain: '文本框聚焦时边框变主色并出现光晕；校验失败显示红框与提示。光标闪烁模拟输入。', formula: 'focus: border = 主色, ring 3px', formula2: 'error: border = #ef4444',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 5), h = k.s, gap = Math.min(24, (H - 40 - n * h) / Math.max(1, n)), w = Math.min(W - 48, 420), x = (W - w) / 2; let cell = null;
    const labels = ['用户名', '邮箱', '密码', '手机号', '备注'], vals = ['clyune', 'hi@clyune.com', '••••••', '138 0000 0000', '…'];
    const total = n * (h + 18 + gap), y0 = Math.max(20, (H - total) / 2);
    const focus = Math.floor(t * 0.5) % n;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * (h + 18 + gap) + 16, hov = inR(P, x, y, w, h), f = hov || (!P.user && i === focus), err = on(C.err) && i === n - 1;
      text(ctx, labels[i], x, y - 9, { size: fsz(W, H, 0.85), col: '#94a3b8' });
      if (f && !err) { ctx.strokeStyle = hsla(hueOf(k.col), 80, 65, 0.3); ctx.lineWidth = 6; rrect(ctx, x, y, w, h, 10); ctx.stroke(); }
      ctx.fillStyle = '#0d1426'; rrect(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = err ? '#ef4444' : f ? k.col : '#24314f'; ctx.lineWidth = 1.5; rrect(ctx, x, y, w, h, 10); ctx.stroke();
      const v = f ? vals[i].slice(0, 1 + Math.floor((t * 3) % vals[i].length)) : vals[i];
      text(ctx, v, x + 12, y + h / 2, { size: fsz(W, H), col: '#e2e8f0' });
      if (f) { ctx.font = `${fsz(W, H)}px ui-sans-serif`; caret(ctx, x + 14 + ctx.measureText(v).width, y + h / 2, t, k.col); }
      if (err) text(ctx, '格式不正确', x + w, y + h + 10, { size: fsz(W, H, 0.8), col: '#ef4444', align: 'right' });
      if (hov) cell = labels[i];
    }
    return { mode: on(C.err) ? '含报错' : '正常', cell: cell || '（移到输入框）' };
  } });

FAM.nav = uiFam({ title: '导航样式', size: { label: '导航栏高度', min: 36, max: 72, step: 1, value: 48 }, count: { label: '菜单项', min: 2, max: 7, step: 1, value: 5 },
  extras: [T('under', '下划线指示', true)], presets: { 少: { count: 3 }, 多: { count: 7 }, 胶囊: { under: false }, 高栏: { size: 70 } },
  explain: '顶部导航：当前项用滑动指示器（下划线或胶囊）标出，指示器在项间平滑移动。', formula: 'indicator.x = lerp(x_prev, x_target, ease)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 7), h = k.s, items = ['首页', '组件', '文档', '案例', '博客', '关于', '登录'];
    ctx.fillStyle = '#121a2f'; rrect(ctx, 16, 24, W - 32, h, 12); ctx.fill();
    const iw = (W - 48) / n; let hovI = -1;
    for (let i = 0; i < n; i++) if (inR(P, 24 + i * iw, 24, iw, h)) hovI = i;
    const auto = (t * 0.5) % n, cur = hovI >= 0 ? hovI : auto; const fi = Math.floor(cur), fr = easeFn('ease-in-out', cur - fi);
    const ix = 24 + (fi + (hovI >= 0 ? 0 : fr)) * iw;
    if (on(C.under)) { ctx.fillStyle = k.col; rrect(ctx, ix + iw * 0.2, 24 + h - 5, iw * 0.6, 3, 2); ctx.fill(); }
    else { ctx.fillStyle = hsla(hueOf(k.col), 70, 60, 0.3); rrect(ctx, ix + 4, 28, iw - 8, h - 8, (h - 8) / 2); ctx.fill(); }
    for (let i = 0; i < n; i++) text(ctx, items[i], 24 + i * iw + iw / 2, 24 + h / 2, { size: fsz(W, H), col: Math.round(cur) % n === i ? '#f8fafc' : '#94a3b8', align: 'center', bold: Math.round(cur) % n === i });
    // page body skeleton fills the stage below
    for (let r = 0; r < 4; r++) { ctx.fillStyle = '#141d33'; rrect(ctx, 16, 40 + h + r * ((H - h - 60) / 4), W - 32, (H - h - 60) / 4 - 10, 10); ctx.fill(); }
    return { mode: on(C.under) ? '下划线' : '胶囊', cell: hovI >= 0 ? items[hovI] : '（移到菜单项）' };
  } });

FAM.acc = uiFam({ title: '手风琴组件', size: { label: '标题高度', min: 32, max: 60, step: 1, value: 42 }, count: { label: '面板数', min: 2, max: 6, step: 1, value: 4 },
  extras: [T('multi', '允许多开', false)], presets: { 少: { count: 2 }, 多: { count: 6 }, 多开: { multi: true }, 高: { size: 58 } },
  explain: '手风琴：点击标题展开内容，高度平滑过渡；单开模式下展开一个会收起其它。', formula: 'height: 0 → 内容高度（ease-out）', formula2: '箭头 rotate(0 → 90°)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 6), hh = k.s, x = 20, w = W - 40; const open = Math.floor(t * 0.4) % n;
    const avail = H - 36 - n * (hh + 6); const bodyH = Math.max(30, on(C.multi) ? avail / 2 : avail);
    let y = 22, cell = null;
    for (let i = 0; i < n; i++) {
      const isOpen = on(C.multi) ? (i === open || i === (open + 1) % n) : i === open;
      const ph = isOpen ? easeFn('ease-out', Math.min(1, ((t * 0.4) % 1) * 3)) : 0;
      const hov = inR(P, x, y, w, hh); if (hov) cell = `面板 ${i + 1}`;
      ctx.fillStyle = isOpen ? '#1b2642' : '#141d33'; rrect(ctx, x, y, w, hh, 10); ctx.fill();
      if (isOpen) { ctx.strokeStyle = k.col; ctx.lineWidth = 1.5; rrect(ctx, x, y, w, hh, 10); ctx.stroke(); }
      text(ctx, `第 ${i + 1} 节`, x + 14, y + hh / 2, { size: fsz(W, H), col: '#e2e8f0', bold: true });
      ctx.save(); ctx.translate(x + w - 20, y + hh / 2); ctx.rotate(isOpen ? Math.PI / 2 * Math.max(ph, 0.999) : 0); text(ctx, '›', 0, 0, { size: fsz(W, H, 1.4), col: k.col, align: 'center' }); ctx.restore();
      y += hh + 4;
      if (isOpen) { const bh = bodyH * Math.max(ph, 0.15); ctx.fillStyle = '#0f1729'; rrect(ctx, x + 6, y, w - 12, bh, 8); ctx.fill();
        for (let l = 0; l < 3 && 14 + l * 18 < bh; l++) { ctx.fillStyle = '#24314f'; rrect(ctx, x + 18, y + 10 + l * 18, (w - 50) * (0.9 - l * 0.2), 8, 4); ctx.fill(); }
        y += bh + 4; }
      y += 2;
    }
    return { mode: on(C.multi) ? '多开' : '单开', cell: cell || '（移到标题）' };
  } });

FAM.mod = uiFam({ title: '对话框', size: { label: '对话框宽度', min: 0.4, max: 0.9, step: 0.01, value: 0.6 }, count: { label: '进场方式', min: 0, max: 3, step: 1, value: 0 },
  extras: [R('dim', '遮罩深度', 0, 0.85, 0.01, 0.5)], presets: { 缩放: { count: 0 }, 下滑: { count: 1 }, 淡入: { count: 2 }, 弹跳: { count: 3 } },
  explain: '模态对话框：遮罩压暗背景，对话框以缩放/下滑/淡入/弹跳方式进场，循环演示开合。', formula: 'open(t)=ease(t)，scale=0.9+0.1·open', formula2: '遮罩 α = 遮罩深度 × open',
  draw(ctx, W, H, t, C, P, k) {
    const style = clamp(k.n, 0, 3), names = ['缩放', '下滑', '淡入', '弹跳'];
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#141d33'; rrect(ctx, 16 + (i % 3) * (W - 32) / 3 + 4, 24 + ((i / 3) | 0) * (H - 40) / 2, (W - 32) / 3 - 8, (H - 40) / 2 - 8, 10); ctx.fill(); }
    const cyc = (t * 0.35) % 1, o = cyc < 0.7 ? Math.min(1, cyc / 0.25) : Math.max(0, 1 - (cyc - 0.7) / 0.3);
    const e = style === 3 ? easeFn('back', o) : easeFn('ease-out', o);
    ctx.fillStyle = `rgba(0,0,0,${num(C.dim, 0.5) * o})`; ctx.fillRect(0, 8, W, H);
    const mw = W * k.s, mh = Math.min(H * 0.55, 220); let x = (W - mw) / 2, y = (H - mh) / 2, sc = 1, a = 1;
    if (style === 0 || style === 3) sc = 0.85 + 0.15 * e; if (style === 1) y -= (1 - e) * 60; if (style === 2) a = e; else a = Math.min(1, o * 2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y + mh / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -(y + mh / 2));
    ctx.fillStyle = '#18233d'; rrect(ctx, x, y, mw, mh, 14); ctx.fill(); ctx.strokeStyle = k.col; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, '删除这个项目？', x + 18, y + 30, { size: fsz(W, H, 1.1), col: '#f8fafc', bold: true });
    text(ctx, '此操作不可撤销。', x + 18, y + 58, { size: fsz(W, H, 0.9), col: '#94a3b8' });
    btnBox(ctx, x + mw - 200, y + mh - 50, 84, 32, 8, '#24314f', '取消', W, H, '#e2e8f0'); btnBox(ctx, x + mw - 104, y + mh - 50, 84, 32, 8, k.col, '删除', W, H);
    ctx.restore();
    return { mode: names[style], cell: inR(P, x, y, mw, mh) ? '对话框' : '遮罩' };
  } });

FAM.car = uiFam({ title: '走马灯组件', size: { label: '卡片圆角', min: 0, max: 32, step: 1, value: 16 }, count: { label: '页数', min: 2, max: 8, step: 1, value: 5 },
  extras: [T('dots', '指示点', true)], presets: { 少: { count: 3 }, 多: { count: 8 }, 直角: { size: 0 }, 无点: { dots: false } },
  explain: '走马灯：幻灯片铺满整个舞台，按缓动横向切换，底部指示点显示当前页。悬停暂停。', formula: 'offset = −(index + ease(frac)) × 舞台宽', formula2: '指示点宽度：当前页拉长',
  tip: '悬停幻灯片暂停；页数滑条改变总页数和指示点。',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), pad = 6, x0 = pad, y0 = 8 + pad, w = W - pad * 2, h = H - 8 - pad * 2;
    const hov = P.user && inR(P, x0, y0, w, h);
    const cyc = (t * 0.3) % n, idx = Math.floor(cyc), fr = hov ? 0 : easeFn('ease-in-out', clamp((cyc - idx - 0.7) / 0.3, 0, 1));
    ctx.save(); rrect(ctx, x0, y0, w, h, k.s); ctx.clip();
    for (let j = -1; j <= 1; j++) {
      const i = ((idx + j) % n + n) % n, x = x0 + (j - fr) * w;
      const g = ctx.createLinearGradient(x, y0, x + w, y0 + h); g.addColorStop(0, pastel(C, i, n)); g.addColorStop(1, pastel(C, i + 2, n, 0.75));
      ctx.fillStyle = g; ctx.fillRect(x, y0, w + 1, h);
      text(ctx, `Slide ${i + 1}`, x + w / 2, y0 + h / 2, { size: fsz(W, H, 2.2), col: '#0b1020', align: 'center', bold: true });
    }
    ctx.restore();
    if (on(C.dots)) { const cur = Math.round(idx + fr) % n; let dx = W / 2 - (n * 16 + 14) / 2;
      for (let i = 0; i < n; i++) { const dw = i === cur ? 28 : 10; ctx.fillStyle = i === cur ? '#fff' : 'rgba(255,255,255,.5)'; rrect(ctx, dx, H - pad - 22, dw, 10, 5); ctx.fill(); dx += dw + 6; } }
    return { mode: hov ? '暂停' : '自动播放', cell: hov ? `第 ${idx + 1} 页` : '（悬停暂停）' };
  } });

FAM.toast = uiFam({ title: 'Toast', size: { label: '消息宽度', min: 180, max: 380, step: 2, value: 280 }, count: { label: '堆叠数', min: 1, max: 5, step: 1, value: 3 },
  extras: [T('bottom', '底部弹出', false)], presets: { 单条: { count: 1 }, 堆叠: { count: 5 }, 底部: { bottom: true }, 宽: { size: 360 } },
  explain: 'Toast 轻提示：新消息从角落滑入，旧消息依次下移并淡出，几秒后自动消失。', formula: 'y_i = 起点 + i × (高 + 间距)', formula2: '进场: translateX(110%→0)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 5), w = Math.min(k.s, W - 32), h = 52, bottom = on(C.bottom), kinds = [['成功', '#22c55e'], ['提示', k.col], ['警告', '#f59e0b'], ['错误', '#ef4444'], ['同步', '#22d3ee']];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#121a2f'; rrect(ctx, 16, 24 + i * (H - 40) / 5, W * 0.45, (H - 40) / 5 - 8, 8); ctx.fill(); }
    const fr = (t * 0.5) % 1, slide = easeFn('back', Math.min(1, fr * 3)); let cell = null;
    for (let i = 0; i < n; i++) {
      const x = W - w - 16 + (i === 0 ? (1 - slide) * (w + 20) : 0), y = bottom ? H - 16 - h - i * (h + 8) : 24 + i * (h + 8);
      ctx.globalAlpha = i === n - 1 ? 1 - fr * 0.6 : 1;
      ctx.fillStyle = '#18233d'; rrect(ctx, x, y, w, h, 10); ctx.fill(); const [lab, c] = kinds[i % 5];
      ctx.fillStyle = c; rrect(ctx, x, y, 5, h, 3); ctx.fill(); text(ctx, lab, x + 16, y + 18, { size: fsz(W, H), col: c, bold: true });
      text(ctx, '保存于 ' + (12 + i) + ':0' + i, x + 16, y + 36, { size: fsz(W, H, 0.85), col: '#94a3b8' });
      ctx.globalAlpha = 1; if (inR(P, x, y, w, h)) cell = lab;
    }
    return { mode: bottom ? '右下角' : '右上角', cell: cell || '（移到消息）' };
  } });

FAM.drop = uiFam({ title: '下拉', size: { label: '选项高度', min: 26, max: 48, step: 1, value: 34 }, count: { label: '选项数', min: 2, max: 8, step: 1, value: 5 },
  extras: [T('search', '带搜索框', false)], presets: { 少: { count: 3 }, 多: { count: 8 }, 搜索: { search: true }, 高: { size: 46 } },
  explain: '下拉选择：点击后菜单从触发器下方展开（缩放+淡入），悬停项高亮，勾选当前值。', formula: 'menu: scaleY(0.9→1) + opacity', formula2: '高亮行 = 指针所在行',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), rh = k.s, w = Math.min(320, W - 40), x = (W - w) / 2, ty = 24, opts = ['北京', '上海', '广州', '深圳', '杭州', '成都', '西安', '南京'];
    ctx.fillStyle = '#0d1426'; rrect(ctx, x, ty, w, 40, 10); ctx.fill(); ctx.strokeStyle = k.col; ctx.lineWidth = 1.5; ctx.stroke();
    const cur = Math.floor(t * 0.6) % n; text(ctx, opts[cur], x + 14, ty + 20, { size: fsz(W, H), col: '#e2e8f0' }); text(ctx, '▾', x + w - 18, ty + 20, { size: fsz(W, H), col: k.col, align: 'center' });
    let my = ty + 48; const o = easeFn('ease-out', Math.min(1, ((t * 0.6) % 1) * 4));
    const mh = (on(C.search) ? 40 : 0) + n * rh + 8; ctx.save(); ctx.globalAlpha = o; ctx.translate(0, my); ctx.scale(1, 0.9 + 0.1 * o); ctx.translate(0, -my);
    ctx.fillStyle = '#18233d'; rrect(ctx, x, my, w, Math.min(mh, H - my - 10), 10); ctx.fill();
    if (on(C.search)) { ctx.fillStyle = '#0d1426'; rrect(ctx, x + 8, my + 6, w - 16, 28, 7); ctx.fill(); text(ctx, '🔍 搜索城市', x + 16, my + 20, { size: fsz(W, H, 0.85), col: '#64748b' }); my += 40; }
    let cell = null;
    for (let i = 0; i < n; i++) { const y = my + 4 + i * rh; if (y + rh > H - 8) break; const hov = inR(P, x, y, w, rh);
      if (hov || i === cur) { ctx.fillStyle = hov ? hsla(hueOf(k.col), 70, 60, 0.25) : 'rgba(255,255,255,.04)'; rrect(ctx, x + 4, y, w - 8, rh - 2, 6); ctx.fill(); }
      text(ctx, opts[i], x + 16, y + rh / 2, { size: fsz(W, H), col: '#e2e8f0' }); if (i === cur) text(ctx, '✓', x + w - 20, y + rh / 2, { size: fsz(W, H), col: k.col, align: 'center' }); if (hov) cell = opts[i]; }
    ctx.restore();
    return { mode: on(C.search) ? '可搜索' : '普通', cell: cell || '（移到选项）' };
  } });

FAM.tip = uiFam({ title: '提示', size: { label: '气泡宽度', min: 100, max: 260, step: 2, value: 160 }, count: { label: '目标数', min: 1, max: 6, step: 1, value: 4 },
  extras: [T('arrow', '显示小箭头', true)], presets: { 单个: { count: 1 }, 多个: { count: 6 }, 无箭头: { arrow: false }, 宽: { size: 240 } },
  explain: 'Tooltip：悬停目标时在其上方弹出气泡，带小箭头指向目标；离开后淡出。', formula: '气泡.x = 目标中心 − 宽/2（夹在舞台内）', formula2: 'opacity 0→1，translateY(4px→0)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 6), labels = ['保存', '分享', '删除', '设置', '帮助', '收藏'], gw = (W - 40) / n, cy = H * 0.62; let hovI = -1;
    for (let i = 0; i < n; i++) { const cx = 20 + gw * (i + 0.5); if (Math.hypot(P.x - cx, P.y - cy) < 26) hovI = i; }
    const act = hovI >= 0 ? hovI : Math.floor(t * 0.6) % n, ph = hovI >= 0 ? 1 : easeFn('ease-out', Math.min(1, ((t * 0.6) % 1) * 4));
    for (let i = 0; i < n; i++) { const cx = 20 + gw * (i + 0.5); ctx.fillStyle = i === act ? k.col : '#24314f'; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, TAU); ctx.fill(); text(ctx, labels[i][0], cx, cy, { size: fsz(W, H), col: i === act ? '#0b1020' : '#cbd5e1', align: 'center', bold: true }); }
    const cx = 20 + gw * (act + 0.5), bw = k.s, bh = 44, bx = clamp(cx - bw / 2, 8, W - bw - 8), by = cy - 40 - bh - (1 - ph) * 6;
    ctx.globalAlpha = ph; ctx.fillStyle = '#f8fafc'; rrect(ctx, bx, by, bw, bh, 8); ctx.fill();
    if (on(C.arrow)) { ctx.beginPath(); ctx.moveTo(cx - 8, by + bh); ctx.lineTo(cx + 8, by + bh); ctx.lineTo(cx, by + bh + 9); ctx.closePath(); ctx.fill(); }
    text(ctx, `${labels[act]}（Ctrl+${'SHDTJF'[act]}）`, bx + bw / 2, by + bh / 2, { size: fsz(W, H, 0.85), col: '#0b1020', align: 'center', bold: true }); ctx.globalAlpha = 1;
    ctx.fillStyle = k.col; ctx.fillRect(bx, by, 4, bh);
    return { mode: on(C.arrow) ? '带箭头' : '无箭头', cell: hovI >= 0 ? labels[hovI] : '（移到图标）' };
  } });

FAM.skel = uiFam({ title: '加载占位', size: { label: '占位圆角', min: 0, max: 20, step: 1, value: 8 }, count: { label: '列表行数', min: 2, max: 8, step: 1, value: 4 },
  extras: [T('avatar', '显示头像', true)], presets: { 少: { count: 2 }, 多: { count: 8 }, 无头像: { avatar: false }, 直角: { size: 0 } },
  explain: '骨架屏：数据加载前先画出灰色轮廓，一道高光从左到右扫过，提示正在加载。', formula: 'shimmer.x = fract(t × 速度) × 宽', formula2: 'gradient: 透明 → 白 15% → 透明',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), rh = (H - 40) / n, sx = ((t * 0.5) % 1.4 - 0.2) * W; let cell = null;
    for (let i = 0; i < n; i++) { const y = 24 + i * rh, hh = rh - 12; let x = 20;
      if (on(C.avatar)) { ctx.fillStyle = '#1b2540'; ctx.beginPath(); ctx.arc(x + hh / 2, y + hh / 2, hh / 2, 0, TAU); ctx.fill(); x += hh + 14; }
      ctx.fillStyle = '#1b2540'; rrect(ctx, x, y + hh * 0.1, (W - x - 30) * 0.7, hh * 0.32, k.s); ctx.fill(); rrect(ctx, x, y + hh * 0.56, (W - x - 30) * (0.9 - (i % 3) * 0.15), hh * 0.3, k.s); ctx.fill();
      if (inR(P, 20, y, W - 40, hh)) cell = `第 ${i + 1} 行`; }
    const g = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, hsla(hueOf(k.col), 80, 75, 0.22)); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 8, W, H);
    return { mode: on(C.avatar) ? '列表+头像' : '纯文本', cell: cell || '（移到占位行）' };
  } });

FAM.btn = uiFam({ title: '按钮动效', size: { label: '按钮宽度', min: 100, max: 260, step: 2, value: 160 }, count: { label: '动效档', min: 0, max: 5, step: 1, value: 0 },
  extras: [T('ripple', '点击涟漪', true)], presets: { 涟漪: { count: 0 }, 扫光: { count: 1 }, 加载: { count: 2 }, 成功: { count: 3 }, 抖动: { count: 4 }, 呼吸: { count: 5 } },
  explain: '按钮反馈动效：涟漪、扫光、加载转圈、成功打勾、错误抖动、呼吸发光，循环演示一次点击的完整过程。', formula: 'ripple r = ease(p) × 对角线', formula2: 'shake x = sin(30p)·(1−p)·8',
  draw(ctx, W, H, t, C, P, k) {
    const st = clamp(k.n, 0, 5), names = ['涟漪', '扫光', '加载', '成功', '抖动', '呼吸'], bw = k.s, bh = 50, p = (t * 0.6) % 1;
    let x = (W - bw) / 2, y = (H - bh) / 2; if (st === 4) x += Math.sin(p * 30) * (1 - p) * 8;
    if (st === 5) { ctx.save(); ctx.shadowColor = k.col; ctx.shadowBlur = 10 + 20 * Math.abs(Math.sin(t * 2)); }
    btnBox(ctx, x, y, bw, bh, 12, st === 3 && p > 0.4 ? '#22c55e' : k.col, st === 2 ? '' : st === 3 && p > 0.4 ? '✓ 已保存' : '提交', W, H); if (st === 5) ctx.restore();
    ctx.save(); rrect(ctx, x, y, bw, bh, 12); ctx.clip();
    if (st === 0 || on(C.ripple)) { const rr = easeFn('ease-out', p) * bw; ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - p)})`; ctx.beginPath(); ctx.arc(x + bw * 0.35, y + bh / 2, rr, 0, TAU); ctx.fill(); }
    if (st === 1) { const sx = x - 40 + p * (bw + 80); const g = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, bw, bh); }
    ctx.restore();
    if (st === 2) { ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + bw / 2, y + bh / 2, 11, t * 6, t * 6 + 4.5); ctx.stroke(); }
    return { mode: names[st], cell: inR(P, x, y, bw, bh) ? '按钮' : '（移到按钮）' };
  } });

FAM.switch = uiFam({ title: '开关弹簧', size: { label: '开关宽度', min: 40, max: 96, step: 1, value: 56 }, count: { label: '开关数', min: 1, max: 6, step: 1, value: 4 },
  extras: [R('bounce', '弹性过冲', 0, 2, 0.05, 1)], presets: { 单个: { count: 1 }, 一组: { count: 6 }, 无弹性: { bounce: 0 }, 大号: { size: 90 } },
  explain: '开关切换：圆钮从一端弹到另一端并略微过冲，背景色同步渐变为主色。', formula: 'x = ease_back(p, 过冲) × 行程', formula2: '背景 = mix(灰, 主色, p)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 6), sw = k.s, sh = sw * 0.52, gap = Math.min(70, (H - 40) / n), y0 = (H - (n - 1) * gap) / 2; let cell = null;
    const labels = ['Wi-Fi', '蓝牙', '定位', '通知', '深色', '自动'];
    for (let i = 0; i < n; i++) { const y = y0 + i * gap, x = W / 2 + 10; const cyc = (t * 0.4 + i * 0.17) % 2, on1 = cyc < 1;
      const pr = clamp((cyc % 1) * 3, 0, 1), c = 1.70158 * num(C.bounce, 1), e = pr === 1 ? 1 : 1 + (c + 1) * Math.pow(pr - 1, 3) + c * Math.pow(pr - 1, 2), pos = on1 ? e : 1 - e;
      ctx.fillStyle = pos > 0.5 ? k.col : '#24314f'; rrect(ctx, x, y - sh / 2, sw, sh, sh / 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + sh / 2 + pos * (sw - sh), y, sh / 2 - 3, 0, TAU); ctx.fill();
      text(ctx, labels[i], x - 20, y, { size: fsz(W, H), col: '#e2e8f0', align: 'right' }); if (inR(P, x - 100, y - sh / 2, sw + 110, sh)) cell = labels[i]; }
    return { mode: `过冲 ${fmt(num(C.bounce, 1), 2)}`, cell: cell || '（移到开关）' };
  } });

FAM.sheet = uiFam({ title: '底栏/浮层', size: { label: '浮层高度', min: 0.3, max: 0.85, step: 0.01, value: 0.55 }, count: { label: '列表项', min: 2, max: 8, step: 1, value: 4 },
  extras: [T('handle', '拖动把手', true)], presets: { 矮: { size: 0.35 }, 高: { size: 0.8 }, 多项: { count: 8 }, 无把手: { handle: false } },
  explain: 'Bottom Sheet：底部浮层向上滑出，遮罩压暗页面；顶部有拖动把手，列表项可点。', formula: 'y = H − 高度 × ease(p)', formula2: '遮罩 α = 0.45 × p',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8); for (let i = 0; i < 4; i++) { ctx.fillStyle = '#141d33'; rrect(ctx, 16, 24 + i * (H - 40) / 4, W - 32, (H - 40) / 4 - 10, 10); ctx.fill(); }
    const cyc = (t * 0.3) % 1, p = cyc < 0.75 ? easeFn('ease-out', Math.min(1, cyc * 4)) : 1 - easeFn('ease-in', (cyc - 0.75) * 4);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * p})`; ctx.fillRect(0, 8, W, H);
    const sh = (H - 8) * k.s, y = H - sh * p; ctx.fillStyle = '#18233d'; rrect(ctx, 0, y, W, sh + 20, 18); ctx.fill();
    ctx.strokeStyle = k.col; ctx.lineWidth = 2; line(ctx, 0, y + 1, W, y + 1, hsla(hueOf(k.col), 70, 60, 0.6));
    let yy = y + 14; if (on(C.handle)) { ctx.fillStyle = '#64748b'; rrect(ctx, W / 2 - 22, y + 8, 44, 5, 3); ctx.fill(); yy += 10; }
    const rh = Math.min(44, (sh - 30) / n); let cell = null;
    for (let i = 0; i < n; i++) { const ry = yy + i * rh; if (ry + rh > H) break; const hov = inR(P, 0, ry, W, rh); if (hov) cell = `选项 ${i + 1}`;
      if (hov) { ctx.fillStyle = hsla(hueOf(k.col), 70, 60, 0.2); ctx.fillRect(0, ry, W, rh); }
      ctx.fillStyle = pastel(C, i, n); ctx.beginPath(); ctx.arc(28, ry + rh / 2, 8, 0, TAU); ctx.fill(); text(ctx, `选项 ${i + 1}`, 48, ry + rh / 2, { size: fsz(W, H), col: '#e2e8f0' }); }
    return { mode: p > 0.95 ? '展开' : '滑动中', cell: cell || '（移到列表项）' };
  } });

FAM.tabs = uiFam({ title: 'Tabs 动效', size: { label: '标签高度', min: 30, max: 60, step: 1, value: 40 }, count: { label: '标签数', min: 2, max: 6, step: 1, value: 4 },
  extras: [T('slide', '内容滑动', true)], presets: { 两个: { count: 2 }, 六个: { count: 6 }, 不滑动: { slide: false }, 高: { size: 56 } },
  explain: 'Tabs：选中块在标签间滑动，下方内容面板随之横向切换或淡入。', formula: 'pill.x = lerp(i, i+1, ease)', formula2: '内容 translateX = −当前 × 宽',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 6), th = k.s, names = ['概览', '数据', '设置', '成员', '日志', '账单'], tw = (W - 40) / n;
    ctx.fillStyle = '#121a2f'; rrect(ctx, 20, 22, W - 40, th, 10); ctx.fill(); let hovI = -1;
    for (let i = 0; i < n; i++) if (inR(P, 20 + i * tw, 22, tw, th)) hovI = i;
    const cyc = (t * 0.4) % n, fi = Math.floor(cyc), fr = easeFn('ease-in-out', clamp((cyc - fi - 0.6) / 0.4, 0, 1)), cur = hovI >= 0 ? hovI : fi + fr;
    ctx.fillStyle = k.col; rrect(ctx, 22 + cur * tw, 24, tw - 4, th - 4, 8); ctx.fill();
    for (let i = 0; i < n; i++) text(ctx, names[i], 20 + i * tw + tw / 2, 22 + th / 2, { size: fsz(W, H), col: Math.round(cur) === i ? '#0b1020' : '#cbd5e1', align: 'center', bold: true });
    const py = 32 + th, ph = H - py - 12; ctx.save(); rrect(ctx, 20, py, W - 40, ph, 12); ctx.clip();
    const off = on(C.slide) ? cur : Math.round(cur);
    for (let i = 0; i < n; i++) { const x = 20 + (i - off) * (W - 40); if (x > W || x + W < 0) continue; ctx.fillStyle = '#141d33'; ctx.fillRect(x, py, W - 40, ph);
      text(ctx, names[i] + ' 面板', x + 20, py + 26, { size: fsz(W, H, 1.1), col: '#f8fafc', bold: true });
      for (let b = 0; b < 3; b++) { ctx.fillStyle = pastel(C, i + b, n + 3, 0.7); rrect(ctx, x + 20 + b * ((W - 80) / 3), py + 50, (W - 80) / 3 - 10, ph - 70, 10); ctx.fill(); } }
    ctx.restore();
    return { mode: on(C.slide) ? '滑动切换' : '直接切换', cell: hovI >= 0 ? names[hovI] : '（移到标签）' };
  } });

FAM.timeline = uiFam({ title: '时间线', size: { label: '节点半径', min: 4, max: 16, step: 0.5, value: 8 }, count: { label: '事件数', min: 2, max: 8, step: 1, value: 5 },
  extras: [T('alt', '左右交替', true)], presets: { 少: { count: 3 }, 多: { count: 8 }, 单侧: { alt: false }, 大节点: { size: 14 } },
  explain: '时间线：竖线串起事件节点，进度依次点亮节点，卡片左右交替排列。', formula: '已完成 = floor(进度 × 事件数)', formula2: '节点 y_i = 顶 + i × 间距',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), r = k.s, cx = on(C.alt) ? W / 2 : 40, gap = (H - 50) / (n - 1 || 1), prog = (t * 0.25) % 1, done = prog * (n - 1); let cell = null;
    line(ctx, cx, 25, cx, H - 25, '#24314f', 3); line(ctx, cx, 25, cx, 25 + done * gap, k.col, 3);
    for (let i = 0; i < n; i++) { const y = 25 + i * gap, lit = i <= done; ctx.fillStyle = lit ? k.col : '#24314f'; ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill();
      const left = on(C.alt) && i % 2 === 1, cw = on(C.alt) ? W / 2 - 50 : W - 100, ch = Math.min(40, gap - 6), x = left ? cx - 24 - cw : cx + 24;
      ctx.fillStyle = lit ? '#18233d' : '#121a2f'; rrect(ctx, x, y - ch / 2, cw, ch, 8); ctx.fill();
      text(ctx, `2026-0${i + 1} · 里程碑 ${i + 1}`, x + 10, y, { size: fsz(W, H, 0.85), col: lit ? '#f8fafc' : '#64748b' }); if (inR(P, x, y - ch / 2, cw, ch)) cell = `里程碑 ${i + 1}`; }
    return { mode: on(C.alt) ? '交替' : '单侧', cell: cell || '（移到事件）' };
  } });

FAM.tree = uiFam({ title: '树形', size: { label: '缩进宽度', min: 12, max: 40, step: 1, value: 22 }, count: { label: '展开层级', min: 1, max: 4, step: 1, value: 3 },
  extras: [T('guide', '层级连线', true)], presets: { 一层: { count: 1 }, 全展开: { count: 4 }, 无连线: { guide: false }, 宽缩进: { size: 36 } },
  explain: '树形控件：节点可逐级展开，子节点缩进显示，连线标出父子关系；当前选中行高亮。', formula: 'x = 左边距 + 深度 × 缩进', formula2: '可见行 = 深度 ≤ 展开层级',
  draw(ctx, W, H, t, C, P, k) {
    const depth = clamp(k.n, 1, 4), ind = k.s, nodes = [];
    const walk = (d, name) => { nodes.push([d, name]); if (d < depth) for (let i = 0; i < (d === 0 ? 3 : 2); i++) walk(d + 1, `${name}.${i + 1}`); };
    walk(0, 'src'); const rh = Math.min(28, (H - 30) / nodes.length), sel = Math.floor(t * 1.2) % nodes.length; let cell = null;
    nodes.forEach(([d, name], i) => { const y = 20 + i * rh, x = 20 + d * ind; const hov = inR(P, 0, y, W, rh);
      if (i === sel || hov) { ctx.fillStyle = hov ? hsla(hueOf(k.col), 70, 60, 0.25) : hsla(hueOf(k.col), 70, 60, 0.14); ctx.fillRect(10, y, W - 20, rh - 2); }
      if (on(C.guide) && d > 0) { line(ctx, x - ind + 6, y - rh / 2, x - ind + 6, y + rh / 2, '#334155', 1); line(ctx, x - ind + 6, y + rh / 2 - 1, x - 2, y + rh / 2 - 1, '#334155', 1); }
      text(ctx, (d < depth ? '▾ ' : '• ') + (d === 0 ? '📁 ' : d < depth ? '📂 ' : '📄 ') + name, x, y + rh / 2, { size: fsz(W, H, 0.9), col: i === sel ? k.col : '#cbd5e1' }); if (hov) cell = name; });
    return { mode: `展开 ${depth} 层`, n: nodes.length, cell: cell || '（移到节点）' };
  } });

FAM.fab = uiFam({ title: 'FAB', size: { label: '按钮直径', min: 40, max: 80, step: 1, value: 56 }, count: { label: '子菜单数', min: 2, max: 6, step: 1, value: 4 },
  extras: [T('arc', '扇形展开', false)], presets: { 少: { count: 2 }, 多: { count: 6 }, 扇形: { arc: true }, 大: { size: 76 } },
  explain: '悬浮按钮 FAB：主按钮旋转成 ×，子按钮依次弹出（竖排或扇形），带交错延迟。', formula: '子按钮 i 延迟 = i × 0.06s', formula2: '扇形角 θ_i = 90° × i/(n−1)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 6), d = k.s, cx = W - 30 - d / 2, cy = H - 70 - d / 2, cyc = (t * 0.35) % 1, o = cyc < 0.7 ? Math.min(1, cyc * 3) : 1 - (cyc - 0.7) / 0.3;
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#141d33'; rrect(ctx, 16, 24 + i * (H - 40) / 6, W * 0.55, (H - 40) / 6 - 8, 8); ctx.fill(); }
    const icons = ['✎', '⇪', '✉', '★', '⚑', '☎']; let cell = null;
    for (let i = 0; i < n; i++) { const e = easeFn('back', clamp(o * 1.4 - i * 0.08, 0, 1)), sd = d * 0.72;
      let x = cx, y = cy - (i + 1) * (sd + 12) * e; if (on(C.arc)) { const a = Math.PI / 2 * (i / (n - 1)); x = cx - Math.sin(a) * (d * 2.2) * e; y = cy - Math.cos(a) * (d * 2.2) * e; }
      ctx.globalAlpha = e; ctx.fillStyle = pastel(C, i, n); ctx.beginPath(); ctx.arc(x, y, sd / 2, 0, TAU); ctx.fill(); text(ctx, icons[i], x, y, { size: fsz(W, H), col: '#0b1020', align: 'center', bold: true }); ctx.globalAlpha = 1;
      if (Math.hypot(P.x - x, P.y - y) < sd / 2) cell = icons[i]; }
    ctx.fillStyle = k.col; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(o * Math.PI / 4); ctx.fillStyle = '#0b1020'; ctx.fillRect(-d * 0.2, -2, d * 0.4, 4); ctx.fillRect(-2, -d * 0.2, 4, d * 0.4); ctx.restore();
    return { mode: on(C.arc) ? '扇形' : '竖排', cell: cell || (Math.hypot(P.x - cx, P.y - cy) < d / 2 ? '主按钮' : '（移到按钮）') };
  } });

FAM.chip = uiFam({ title: '芯片/标签', size: { label: '芯片高度', min: 22, max: 44, step: 1, value: 30 }, count: { label: '标签数', min: 3, max: 14, step: 1, value: 8 },
  extras: [T('close', '可删除 ×', true)], presets: { 少: { count: 4 }, 多: { count: 14 }, 无删除: { close: false }, 大: { size: 42 } },
  explain: '标签芯片：自动换行排列，选中态填充主色；带 × 的可删除，新标签弹入。', formula: '换行: x + w > 宽 → 下一行', formula2: '选中 = 主色背景',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 3, 14), h = k.s, tags = ['React', 'Vue', 'Svelte', 'Canvas', 'WebGL', 'CSS', 'TypeScript', 'Node', 'Vite', 'Three', 'D3', 'Rust', 'Go', 'AI'];
    let x = 20, y = 24; const sel = Math.floor(t * 0.8) % n; let cell = null; ctx.font = `${fsz(W, H, 0.9)}px ui-sans-serif`;
    for (let i = 0; i < n; i++) { const tw = ctx.measureText(tags[i]).width + 24 + (on(C.close) ? 18 : 0); if (x + tw > W - 20) { x = 20; y += h + 10; }
      const pop = i === n - 1 ? easeFn('back', Math.min(1, ((t * 0.5) % 1) * 3)) : 1, s2 = i === sel;
      ctx.save(); ctx.translate(x + tw / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + tw / 2), -(y + h / 2));
      ctx.fillStyle = s2 ? k.col : '#18233d'; rrect(ctx, x, y, tw, h, h / 2); ctx.fill(); ctx.strokeStyle = s2 ? k.col : '#24314f'; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, tags[i], x + 12, y + h / 2, { size: fsz(W, H, 0.9), col: s2 ? '#0b1020' : '#e2e8f0', bold: s2 }); if (on(C.close)) text(ctx, '×', x + tw - 14, y + h / 2, { size: fsz(W, H), col: s2 ? '#0b1020' : '#94a3b8', align: 'center' });
      ctx.restore(); if (inR(P, x, y, tw, h)) cell = tags[i]; x += tw + 8; }
    return { mode: on(C.close) ? '可删除' : '只读', cell: cell || '（移到标签）' };
  } });

FAM.table = uiFam({ title: '表格交互', size: { label: '行高', min: 24, max: 48, step: 1, value: 32 }, count: { label: '行数', min: 3, max: 12, step: 1, value: 6 },
  extras: [T('zebra', '斑马纹', true)], presets: { 少: { count: 3 }, 多: { count: 12 }, 无斑马: { zebra: false }, 高行: { size: 46 } },
  explain: '数据表格：表头固定，行悬停高亮，斑马纹提高可读性；排序列的箭头周期翻转。', formula: '行 y_i = 表头 + i × 行高', formula2: '悬停行 = floor((y−表头)/行高)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 3, 12), rh = Math.min(k.s, (H - 70) / n), cols = ['名称', '状态', '数量', '更新'], cw = (W - 40) / 4, x0 = 20, y0 = 22;
    ctx.fillStyle = '#18233d'; rrect(ctx, x0, y0, W - 40, 34, 8); ctx.fill(); const asc = Math.floor(t * 0.4) % 2 === 0;
    cols.forEach((c, j) => text(ctx, c + (j === 2 ? (asc ? ' ▲' : ' ▼') : ''), x0 + 12 + j * cw, y0 + 17, { size: fsz(W, H, 0.9), col: j === 2 ? k.col : '#cbd5e1', bold: true }));
    let cell = null;
    for (let i = 0; i < n; i++) { const y = y0 + 38 + i * rh, hov = inR(P, x0, y, W - 40, rh), v = asc ? (i + 1) * 13 : (n - i) * 13;
      if (hov) { ctx.fillStyle = hsla(hueOf(k.col), 70, 60, 0.22); ctx.fillRect(x0, y, W - 40, rh); } else if (on(C.zebra) && i % 2) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x0, y, W - 40, rh); }
      text(ctx, `项目 ${String.fromCharCode(65 + i)}`, x0 + 12, y + rh / 2, { size: fsz(W, H, 0.85), col: '#e2e8f0' });
      ctx.fillStyle = i % 3 ? '#22c55e' : '#f59e0b'; ctx.beginPath(); ctx.arc(x0 + cw + 16, y + rh / 2, 4, 0, TAU); ctx.fill(); text(ctx, i % 3 ? '正常' : '待审', x0 + cw + 26, y + rh / 2, { size: fsz(W, H, 0.85), col: '#cbd5e1' });
      text(ctx, String(v), x0 + 12 + 2 * cw, y + rh / 2, { size: fsz(W, H, 0.85), col: '#e2e8f0' }); text(ctx, `${i + 1} 分钟前`, x0 + 12 + 3 * cw, y + rh / 2, { size: fsz(W, H, 0.8), col: '#94a3b8' });
      if (hov) cell = `项目 ${String.fromCharCode(65 + i)}`; }
    return { mode: asc ? '数量升序' : '数量降序', cell: cell || '（移到行）' };
  } });

FAM.avatar = uiFam({ title: '头像组', size: { label: '头像直径', min: 28, max: 72, step: 1, value: 44 }, count: { label: '人数', min: 2, max: 10, step: 1, value: 6 },
  extras: [R('overlap', '重叠比例', 0, 0.6, 0.01, 0.3)], presets: { 少: { count: 3 }, 多: { count: 10 }, 不重叠: { overlap: 0 }, 大: { size: 68 } },
  explain: '头像组：圆形头像相互重叠排成一行，悬停的头像上浮放大；超出显示 +N。在线状态点呼吸。', formula: 'x_i = i × 直径 × (1 − 重叠)', formula2: '超出 5 个显示 +N',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 10), d = k.s, step = d * (1 - num(C.overlap, 0.3)), show = Math.min(n, 5), total = (show - 1) * step + d + (n > 5 ? step : 0), x0 = (W - total) / 2 + d / 2, cy = H / 2; let cell = null;
    for (let i = 0; i < show; i++) { const x = x0 + i * step, hov = Math.hypot(P.x - x, P.y - cy) < d / 2, lift = hov ? -8 : 0; if (hov) cell = `成员 ${i + 1}`;
      ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.arc(x, cy + lift, d / 2 + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = pastel(C, i, show); ctx.beginPath(); ctx.arc(x, cy + lift, d / 2, 0, TAU); ctx.fill(); text(ctx, '张王李赵刘'[i], x, cy + lift, { size: d * 0.38, col: '#0b1020', align: 'center', bold: true });
      if (i % 2 === 0) { ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(x + d * 0.35, cy + lift + d * 0.35, d * 0.1 * (1 + 0.2 * Math.sin(t * 3 + i)), 0, TAU); ctx.fill(); } }
    if (n > 5) { const x = x0 + show * step; ctx.fillStyle = '#24314f'; ctx.beginPath(); ctx.arc(x, cy, d / 2, 0, TAU); ctx.fill(); text(ctx, `+${n - 5}`, x, cy, { size: d * 0.34, col: k.col, align: 'center', bold: true }); }
    text(ctx, `${n} 位成员在线协作`, W / 2, cy + d / 2 + 28, { size: fsz(W, H), col: '#94a3b8', align: 'center' });
    return { mode: `重叠 ${fmt(num(C.overlap, 0.3) * 100, 0)}%`, cell: cell || '（移到头像）' };
  } });

FAM.stepper = uiFam({ title: '步骤条动效', size: { label: '节点直径', min: 20, max: 48, step: 1, value: 32 }, count: { label: '步骤数', min: 2, max: 7, step: 1, value: 4 },
  extras: [T('label', '显示步骤名', true)], presets: { 两步: { count: 2 }, 七步: { count: 7 }, 无文字: { label: false }, 大: { size: 46 } },
  explain: '步骤条：当前步骤之前打勾，连接线随进度填充主色，当前节点外圈脉冲。', formula: '进度线长度 = (当前 + ease(frac)) / (n−1)', formula2: '完成节点显示 ✓',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 7), d = k.s, names = ['账号', '资料', '验证', '支付', '确认', '完成', '反馈'], x0 = 40, x1 = W - 40, cy = H * 0.42, gap = (x1 - x0) / (n - 1);
    const cyc = (t * 0.35) % n, cur = Math.floor(cyc), fr = easeFn('ease-in-out', clamp((cyc - cur - 0.5) * 2, 0, 1)); let cell = null;
    line(ctx, x0, cy, x1, cy, '#24314f', 4); line(ctx, x0, cy, x0 + Math.min(n - 1, cur + fr) * gap, cy, k.col, 4);
    for (let i = 0; i < n; i++) { const x = x0 + i * gap, done = i < cur, now = i === cur;
      if (now) { ctx.strokeStyle = hsla(hueOf(k.col), 80, 65, 0.5 * (1 - (t % 1))); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, d / 2 + 4 + (t % 1) * 10, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = done || now ? k.col : '#18233d'; ctx.beginPath(); ctx.arc(x, cy, d / 2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#24314f'; ctx.lineWidth = 1.5; if (!done && !now) ctx.stroke();
      text(ctx, done ? '✓' : String(i + 1), x, cy, { size: d * 0.42, col: done || now ? '#0b1020' : '#94a3b8', align: 'center', bold: true });
      if (on(C.label)) text(ctx, names[i], x, cy + d / 2 + 18, { size: fsz(W, H, 0.85), col: now ? '#f8fafc' : '#94a3b8', align: 'center' });
      if (Math.hypot(P.x - x, P.y - cy) < d / 2 + 6) cell = names[i]; }
    ctx.fillStyle = '#141d33'; rrect(ctx, 20, cy + d / 2 + 40, W - 40, H - cy - d / 2 - 56, 12); ctx.fill(); text(ctx, `第 ${cur + 1} 步：${names[cur]}`, 36, cy + d / 2 + 64, { size: fsz(W, H, 1.05), col: '#f8fafc', bold: true });
    return { mode: `第 ${cur + 1}/${n} 步`, cell: cell || '（移到节点）' };
  } });

FAM.kanban = uiFam({ title: '看板', size: { label: '卡片高度', min: 28, max: 64, step: 1, value: 42 }, count: { label: '列数', min: 2, max: 5, step: 1, value: 3 },
  extras: [T('wip', 'WIP 计数', true)], presets: { 两列: { count: 2 }, 五列: { count: 5 }, 无计数: { wip: false }, 高卡: { size: 60 } },
  explain: '看板：任务卡片在「待办 → 进行中 → 完成」列之间拖动，被拖卡片带阴影漂浮移动。', formula: '拖拽卡 x = lerp(列_a, 列_b, ease)', formula2: '列头显示卡片数（WIP）',
  draw(ctx, W, H, t, C, P, k) {
    const nc = clamp(k.n, 2, 5), ch = k.s, names = ['待办', '进行中', '评审', '测试', '完成'], cw = (W - 24) / nc; let cell = null;
    const cyc = (t * 0.3) % (nc - 1), from = Math.floor(cyc), p = easeFn('ease-in-out', clamp((cyc - from - 0.3) / 0.7, 0, 1));
    for (let c = 0; c < nc; c++) { const x = 12 + c * cw + 4, w = cw - 8, cnt = 3 - (c % 2);
      ctx.fillStyle = '#121a2f'; rrect(ctx, x, 20, w, H - 30, 12); ctx.fill(); text(ctx, names[c] + (on(C.wip) ? ` · ${cnt}` : ''), x + 10, 36, { size: fsz(W, H, 0.9), col: '#cbd5e1', bold: true });
      for (let j = 0; j < cnt; j++) { const y = 52 + j * (ch + 8); if (y + ch > H - 14) break; ctx.fillStyle = '#1b2540'; rrect(ctx, x + 6, y, w - 12, ch, 8); ctx.fill(); ctx.fillStyle = pastel(C, c * 3 + j, 15); ctx.fillRect(x + 6, y, 4, ch);
        text(ctx, `任务 ${c + 1}-${j + 1}`, x + 16, y + ch / 2, { size: fsz(W, H, 0.85), col: '#e2e8f0' }); if (inR(P, x + 6, y, w - 12, ch)) cell = `任务 ${c + 1}-${j + 1}`; } }
    const dx = 12 + (from + p) * cw + 10, dy = 52 + 3 * (ch + 8) - Math.sin(p * Math.PI) * 30;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16; ctx.fillStyle = k.col; rrect(ctx, dx, Math.min(dy, H - ch - 16), cw - 20, ch, 8); ctx.fill(); ctx.restore();
    text(ctx, '拖动中…', dx + 12, Math.min(dy, H - ch - 16) + ch / 2, { size: fsz(W, H, 0.85), col: '#0b1020', bold: true });
    return { mode: `${names[from]} → ${names[from + 1]}`, cell: cell || '（移到卡片）' };
  } });

FAM.colorpick = uiFam({ title: '取色器', size: { label: '色盘大小', min: 0.5, max: 1, step: 0.01, value: 0.8 }, count: { label: '色板数', min: 3, max: 10, step: 1, value: 6 },
  extras: [R('light', '明度', 20, 80, 1, 55)], presets: { 少色板: { count: 3 }, 多色板: { count: 10 }, 暗: { light: 30 }, 亮: { light: 75 } },
  explain: '取色器：色相环 + 预设色板。指针在色环上的角度就是色相（H），明度滑条调 L，右侧实时预览。', formula: 'H = atan2(y−cy, x−cx)', formula2: '颜色 = hsl(H, 80%, 明度)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 3, 10), R0 = Math.min(W * 0.32, H * 0.42) * k.s, cx = Math.max(R0 + 20, W * 0.34), cy = H / 2, L = num(C.light, 55);
    for (let a = 0; a < 360; a += 3) { ctx.strokeStyle = hsla(a, 80, L); ctx.lineWidth = R0 * 0.28; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.86, (a - 1.6) * Math.PI / 180, (a + 1.6) * Math.PI / 180); ctx.stroke(); }
    const dist = Math.hypot(P.x - cx, P.y - cy), onRing = P.user && dist > R0 * 0.7 && dist < R0;
    const hue = onRing ? ((Math.atan2(P.y - cy, P.x - cx) * 180 / Math.PI) + 360) % 360 : (hueOf(k.col) + t * 20) % 360;
    const ka = hue * Math.PI / 180; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx + Math.cos(ka) * R0 * 0.86, cy + Math.sin(ka) * R0 * 0.86, 9, 0, TAU); ctx.stroke();
    ctx.fillStyle = hsla(hue, 80, L); ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.5, 0, TAU); ctx.fill();
    const px = Math.min(W - 160, cx + R0 + 30), sw = 22;
    text(ctx, `H ${hue.toFixed(0)}°  L ${L}%`, px, 40, { size: fsz(W, H), col: '#e2e8f0', bold: true });
    for (let i = 0; i < n; i++) { const x = px + (i % 5) * (sw + 8), y = 60 + ((i / 5) | 0) * (sw + 8); ctx.fillStyle = pastel(C, i, n); rrect(ctx, x, y, sw, sw, 6); ctx.fill(); }
    return { mode: onRing ? '取色中' : '自动漫游', cell: `hsl(${hue.toFixed(0)}, 80%, ${L}%)` };
  } });

FAM.notify = uiFam({ title: '通知中心', size: { label: '面板宽度', min: 220, max: 420, step: 2, value: 320 }, count: { label: '通知数', min: 1, max: 7, step: 1, value: 4 },
  extras: [T('badge', '未读红点', true)], presets: { 少: { count: 1 }, 多: { count: 7 }, 无红点: { badge: false }, 宽: { size: 400 } },
  explain: '通知中心：铃铛显示未读数并轻摇，面板列出通知，新通知从顶部插入，其余下移。', formula: '铃铛摆角 = sin(20t)·e^(−3p)·15°', formula2: '未读数 = 通知数 − 已读',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 7), pw = Math.min(k.s, W - 30), px = W - pw - 15, p = (t * 0.4) % 1, rh = Math.min(54, (H - 90) / n); let cell = null;
    const bx = W - 40, by = 34; ctx.save(); ctx.translate(bx, by - 12); ctx.rotate(Math.sin(t * 20) * Math.exp(-3 * p) * 0.26); text(ctx, '🔔', 0, 12, { size: 22, col: '#fff', align: 'center' }); ctx.restore();
    if (on(C.badge)) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(bx + 10, by - 10, 9, 0, TAU); ctx.fill(); text(ctx, String(n), bx + 10, by - 10, { size: 11, col: '#fff', align: 'center', bold: true }); }
    ctx.fillStyle = '#141d33'; rrect(ctx, px, 60, pw, H - 72, 12); ctx.fill(); ctx.strokeStyle = k.col; ctx.lineWidth = 1.5; ctx.stroke();
    const ins = easeFn('ease-out', Math.min(1, p * 3)); const msgs = ['新评论', '构建成功', '有人提到你', '部署完成', '订单已发货', '日程提醒', '安全登录'];
    for (let i = 0; i < n; i++) { const y = 70 + (i - 1 + ins) * rh; if (i === 0) ctx.globalAlpha = ins; if (y < 64 || y + rh > H - 12) { ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = i === 0 ? hsla(hueOf(k.col), 60, 55, 0.18) : '#18233d'; rrect(ctx, px + 8, y, pw - 16, rh - 6, 8); ctx.fill();
      ctx.fillStyle = pastel(C, i, n); ctx.beginPath(); ctx.arc(px + 26, y + (rh - 6) / 2, 9, 0, TAU); ctx.fill();
      text(ctx, msgs[i], px + 44, y + (rh - 6) / 2, { size: fsz(W, H, 0.9), col: '#e2e8f0' }); ctx.globalAlpha = 1; if (inR(P, px + 8, y, pw - 16, rh - 6)) cell = msgs[i]; }
    return { mode: on(C.badge) ? `未读 ${n}` : '静默', cell: cell || '（移到通知）' };
  } });

FAM.command = uiFam({ title: '命令面板', size: { label: '面板宽度', min: 0.5, max: 0.95, step: 0.01, value: 0.8 }, count: { label: '结果数', min: 2, max: 8, step: 1, value: 5 },
  extras: [T('kbd', '快捷键提示', true)], presets: { 少: { count: 2 }, 多: { count: 8 }, 无快捷键: { kbd: false }, 窄: { size: 0.55 } },
  explain: '命令面板（⌘K）：输入关键字逐字出现，结果列表实时过滤，高亮项上下移动，回车执行。', formula: '匹配 = 名称包含输入', formula2: '高亮 = (t × 速度) mod 结果数',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 8), pw = W * k.s, px = (W - pw) / 2, cmds = ['打开文件', '切换主题', '新建窗口', '查找替换', '格式化文档', '运行测试', '提交代码', '设置'];
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 8, W, H); ctx.fillStyle = '#18233d'; rrect(ctx, px, 24, pw, H - 40, 14); ctx.fill(); ctx.strokeStyle = k.col; ctx.lineWidth = 1.5; ctx.stroke();
    const q = '打开文件切换', typed = q.slice(0, 1 + Math.floor((t * 2) % q.length)); text(ctx, '› ' + typed, px + 16, 48, { size: fsz(W, H, 1.05), col: '#f8fafc' });
    ctx.font = `${fsz(W, H, 1.05)}px ui-sans-serif`; caret(ctx, px + 30 + ctx.measureText(typed).width, 48, t, k.col); line(ctx, px, 70, px + pw, 70, '#24314f', 1);
    const rh = Math.min(38, (H - 100) / n), hi = Math.floor(t * 0.8) % n; let cell = null;
    for (let i = 0; i < n; i++) { const y = 78 + i * rh, hov = inR(P, px, y, pw, rh); if (hov) cell = cmds[i];
      if (i === hi || hov) { ctx.fillStyle = hov ? hsla(hueOf(k.col), 70, 60, 0.3) : hsla(hueOf(k.col), 70, 60, 0.18); rrect(ctx, px + 6, y, pw - 12, rh - 4, 8); ctx.fill(); }
      text(ctx, cmds[i], px + 18, y + rh / 2 - 2, { size: fsz(W, H, 0.9), col: '#e2e8f0' });
      if (on(C.kbd)) { ctx.fillStyle = '#0d1426'; rrect(ctx, px + pw - 62, y + 6, 46, rh - 16, 5); ctx.fill(); text(ctx, '⌘' + (i + 1), px + pw - 39, y + rh / 2 - 2, { size: fsz(W, H, 0.8), col: '#94a3b8', align: 'center' }); } }
    return { mode: `输入“${typed}”`, cell: cell || '（移到结果）' };
  } });

FAM.pagination = uiFam({ title: '分页器', size: { label: '页码尺寸', min: 26, max: 48, step: 1, value: 34 }, count: { label: '总页数', min: 3, max: 20, step: 1, value: 9 },
  extras: [T('ellipsis', '省略号折叠', true)], presets: { 少页: { count: 3 }, 多页: { count: 20 }, 不折叠: { ellipsis: false }, 大: { size: 46 } },
  explain: '分页器：当前页高亮块滑动到目标页；页数多时中间折叠成 …，始终显示首尾页。', formula: '显示 = 1, 当前±1, 末页', formula2: '高亮 x = lerp(旧, 新, ease)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 3, 20), s = k.s, cur = Math.floor(t * 0.5) % n + 1; let items = [];
    if (!on(C.ellipsis) || n <= 7) for (let i = 1; i <= n; i++) items.push(i);
    else { items = [1]; if (cur > 3) items.push('…'); for (let i = Math.max(2, cur - 1); i <= Math.min(n - 1, cur + 1); i++) items.push(i); if (cur < n - 2) items.push('…'); items.push(n); }
    items = ['‹', ...items, '›']; const gap = 6, maxW = W - 30, sz = Math.min(s, (maxW - gap * items.length) / items.length), tw = items.length * (sz + gap), x0 = (W - tw) / 2, cy = H * 0.45; let cell = null;
    items.forEach((it, i) => { const x = x0 + i * (sz + gap), sel = it === cur, hov = inR(P, x, cy - sz / 2, sz, sz);
      ctx.fillStyle = sel ? k.col : hov ? '#24314f' : '#141d33'; rrect(ctx, x, cy - sz / 2, sz, sz, 8); ctx.fill();
      text(ctx, String(it), x + sz / 2, cy, { size: Math.min(fsz(W, H), sz * 0.45), col: sel ? '#0b1020' : '#cbd5e1', align: 'center', bold: sel }); if (hov) cell = String(it); });
    ctx.fillStyle = '#141d33'; rrect(ctx, 20, cy + sz, W - 40, H - cy - sz - 16, 12); ctx.fill();
    text(ctx, `第 ${cur} / ${n} 页 · 每页 10 条`, W / 2, cy + sz + 30, { size: fsz(W, H), col: '#94a3b8', align: 'center' });
    for (let r = 0; r < 3; r++) { ctx.fillStyle = pastel(C, cur + r, n + 3, 0.5); rrect(ctx, 36, cy + sz + 50 + r * 24, (W - 72) * (0.5 + 0.15 * r), 14, 6); ctx.fill(); }
    return { mode: `当前第 ${cur} 页`, cell: cell || '（移到页码）' };
  } });

FAM.breadcrumb = uiFam({ title: '面包屑', size: { label: '字号', min: 11, max: 22, step: 1, value: 14 }, count: { label: '路径层数', min: 2, max: 7, step: 1, value: 4 },
  extras: [T('chev', '箭头分隔', true)], presets: { 浅: { count: 2 }, 深: { count: 7 }, 斜杠: { chev: false }, 大字: { size: 20 } },
  explain: '面包屑：显示当前页面在站点中的层级路径，末级为当前页；新层级从右侧滑入，悬停项加下划线。', formula: '路径 = 首页 › … › 当前', formula2: '分隔符 = › 或 /',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 2, 7), fs = k.s, names = ['首页', '产品', '电子', '手机', '旗舰', '配置', '详情'], cy = H * 0.3, p = easeFn('ease-out', Math.min(1, ((t * 0.4) % 1) * 3)); let x = 24, y = cy, cell = null;
    ctx.font = `${fs}px ui-sans-serif`; ctx.fillStyle = '#141d33'; rrect(ctx, 12, cy - fs * 1.4, W - 24, fs * 2.8 + (W < 500 ? fs * 2 : 0), 10); ctx.fill();
    for (let i = 0; i < n; i++) { const last = i === n - 1, w = ctx.measureText(names[i]).width, sep = on(C.chev) ? ' › ' : ' / ', sw = ctx.measureText(sep).width;
      if (x + w > W - 24) { x = 24; y += fs * 1.8; }
      const xx = last ? x + (1 - p) * 30 : x; ctx.globalAlpha = last ? p : 1; const hov = inR(P, xx, y - fs, w, fs * 2);
      text(ctx, names[i], xx, y, { size: fs, col: last ? k.col : hov ? '#f8fafc' : '#94a3b8', bold: last }); if (hov) { line(ctx, xx, y + fs * 0.7, xx + w, y + fs * 0.7, k.col, 1.5); cell = names[i]; }
      ctx.globalAlpha = 1; x += w; if (!last) { text(ctx, sep, x, y, { size: fs, col: '#475569' }); x += sw; } }
    ctx.fillStyle = '#121a2f'; rrect(ctx, 12, H * 0.5, W - 24, H * 0.46, 12); ctx.fill(); text(ctx, names[n - 1] + ' 页面内容', 30, H * 0.5 + 28, { size: fsz(W, H, 1.1), col: '#f8fafc', bold: true });
    return { mode: `${n} 层路径`, cell: cell || '（移到路径）' };
  } });

FAM.rating = uiFam({ title: '评分', size: { label: '星星大小', min: 16, max: 48, step: 1, value: 32 }, count: { label: '星星数', min: 3, max: 10, step: 1, value: 5 },
  extras: [T('half', '允许半星', true)], presets: { 三星: { count: 3 }, 十星: { count: 10 }, 整星: { half: false }, 大: { size: 46 } },
  explain: '评分组件：悬停预览分数（星星依次点亮放大），离开后回到当前分；支持半星。', formula: '分数 = (指针x − 左) / 星宽，按 0.5 取整', formula2: '点亮星 scale 1→1.2',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 3, 10), s = Math.min(k.s, (W - 40) / n - 6), gap = s + 6, x0 = (W - n * gap) / 2, cy = H * 0.42, inRow = inR(P, x0, cy - s, n * gap, s * 2);
    let score = inRow ? (P.x - x0) / gap : (Math.sin(t * 0.8) * 0.5 + 0.5) * n; score = on(C.half) ? Math.ceil(score * 2) / 2 : Math.ceil(score); score = clamp(score, 0.5, n);
    const star = (cx, cy2, r) => { ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy2 + Math.sin(a) * rr); } ctx.closePath(); };
    for (let i = 0; i < n; i++) { const cx = x0 + i * gap + gap / 2, fill = clamp(score - i, 0, 1), sc = fill > 0 ? 1 + 0.12 * Math.max(0, Math.sin(t * 4 - i)) : 1;
      star(cx, cy, s / 2 * sc); ctx.fillStyle = '#24314f'; ctx.fill();
      if (fill > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx - s, cy - s, s * fill, s * 2); ctx.clip(); star(cx, cy, s / 2 * sc); ctx.fillStyle = k.col; ctx.fill(); ctx.restore(); } }
    text(ctx, `${score} / ${n} 分`, W / 2, cy + s + 24, { size: fsz(W, H, 1.2), col: '#f8fafc', align: 'center', bold: true });
    ctx.fillStyle = '#141d33'; rrect(ctx, 20, cy + s + 50, W - 40, H - cy - s - 64, 12); ctx.fill(); text(ctx, ['很差', '一般', '还行', '不错', '超赞'][Math.min(4, Math.floor(score / n * 4.99))], W / 2, cy + s + 50 + (H - cy - s - 64) / 2, { size: fsz(W, H), col: k.col, align: 'center' });
    return { mode: on(C.half) ? '半星' : '整星', cell: inRow ? `预览 ${score} 分` : '（移到星星）' };
  } });

FAM.empty = uiFam({ title: '空状态', size: { label: '插画大小', min: 0.4, max: 1, step: 0.01, value: 0.7 }, count: { label: '插画样式', min: 0, max: 3, step: 1, value: 0 },
  extras: [T('cta', '显示操作按钮', true)], presets: { 空盒: { count: 0 }, 搜索无果: { count: 1 }, 离线: { count: 2 }, 无消息: { count: 3 }, 无按钮: { cta: false } },
  explain: '空状态：列表没有数据时，用一幅轻微浮动的插画 + 说明文字 + 引导按钮，告诉用户下一步做什么。', formula: '插画 y = sin(t) × 6px', formula2: '阴影宽 ∝ 1 − 上浮量',
  draw(ctx, W, H, t, C, P, k) {
    const st = clamp(k.n, 0, 3), names = ['暂无数据', '没有搜索结果', '网络已断开', '没有新消息'], icons = ['📦', '🔍', '📡', '💬'], R0 = Math.min(W, H) * 0.22 * k.s, cy = H * 0.38, fy = Math.sin(t * 1.5) * 6;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(W / 2, cy + R0 + 12, R0 * (0.8 - fy / 40), 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hsla(hueOf(k.col), 60, 55, 0.18); ctx.beginPath(); ctx.arc(W / 2, cy + fy, R0, 0, TAU); ctx.fill(); ctx.strokeStyle = k.col; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, icons[st], W / 2, cy + fy, { size: R0, col: '#fff', align: 'center' });
    text(ctx, names[st], W / 2, cy + R0 + 40, { size: fsz(W, H, 1.2), col: '#f8fafc', align: 'center', bold: true }); text(ctx, '换个条件试试，或点击下方按钮新建', W / 2, cy + R0 + 64, { size: fsz(W, H, 0.85), col: '#94a3b8', align: 'center' });
    let cell = null; if (on(C.cta)) { const bw = 140, bx = (W - bw) / 2, by = Math.min(H - 50, cy + R0 + 84); const hov = inR(P, bx, by, bw, 38); btnBox(ctx, bx, by - (hov ? 2 : 0), bw, 38, 10, k.col, '＋ 新建', W, H); if (hov) cell = '新建按钮'; }
    return { mode: names[st], cell: cell || '（移到按钮）' };
  } });

FAM.banner = uiFam({ title: '横幅', size: { label: '横幅高度', min: 40, max: 90, step: 1, value: 56 }, count: { label: '横幅数', min: 1, max: 4, step: 1, value: 2 },
  extras: [T('marquee', '滚动文字', true)], presets: { 单条: { count: 1 }, 多条: { count: 4 }, 静止: { marquee: false }, 高: { size: 84 } },
  explain: '公告横幅：页面顶部的提示条，从上方滑下；长文字可横向滚动，右侧有关闭按钮。', formula: '滚动 x = −fract(t×速度)×文本宽', formula2: '进场 translateY(−100%→0)',
  draw(ctx, W, H, t, C, P, k) {
    const n = clamp(k.n, 1, 4), bh = k.s, kinds = [['公告', k.col], ['警告', '#f59e0b'], ['成功', '#22c55e'], ['错误', '#ef4444']]; let cell = null;
    const ent = easeFn('ease-out', Math.min(1, ((t * 0.25) % 1) * 4));
    for (let i = 0; i < n; i++) { const y = 16 + i * (bh + 8) - (i === 0 ? (1 - ent) * (bh + 16) : 0), [lab, c] = kinds[i];
      ctx.fillStyle = hsla(hueOf(c), 70, 45, 0.3); rrect(ctx, 12, y, W - 24, bh, 10); ctx.fill(); ctx.fillStyle = c; rrect(ctx, 12, y, 6, bh, 3); ctx.fill();
      ctx.save(); rrect(ctx, 24, y, W - 80, bh, 0); ctx.clip(); const msg = `【${lab}】系统将于今晚 23:00 维护升级，预计 30 分钟，请提前保存工作。　　`;
      ctx.font = `${fsz(W, H)}px ui-sans-serif`; const mw = ctx.measureText(msg).width, off = on(C.marquee) ? -((t * 40) % mw) : 0;
      text(ctx, msg, 30 + off, y + bh / 2, { size: fsz(W, H), col: '#f8fafc' }); if (on(C.marquee)) text(ctx, msg, 30 + off + mw, y + bh / 2, { size: fsz(W, H), col: '#f8fafc' }); ctx.restore();
      text(ctx, '×', W - 36, y + bh / 2, { size: fsz(W, H, 1.2), col: '#cbd5e1', align: 'center' }); if (inR(P, 12, y, W - 24, bh)) cell = lab; }
    const top = 16 + n * (bh + 8); ctx.fillStyle = '#121a2f'; rrect(ctx, 12, top, W - 24, H - top - 10, 12); ctx.fill();
    for (let r = 0; r < 4; r++) { ctx.fillStyle = '#1b2540'; rrect(ctx, 28, top + 20 + r * 26, (W - 56) * (0.9 - r * 0.15), 12, 6); ctx.fill(); }
    return { mode: on(C.marquee) ? '滚动' : '静止', cell: cell || '（移到横幅）' };
  } });

const FAMILIES = Object.keys(FAM);
const TITLES = Object.fromEntries(Object.entries(FAM).map(([k, v]) => [k, (v.doc.title || k).split('·')[0].trim()]));
const LIVE = ['color', 'speed', 'size', 'count', ...new Set(Object.values(FAM).flatMap((f) => f.spec.extras.map((e) => e.key)))];

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'input');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'input';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-ui',
    title: TITLES[fam] || fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: LIVE,
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
export default mount;
