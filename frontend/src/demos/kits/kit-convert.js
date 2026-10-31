import { makeCanvas, loop, bar, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = [
  'temperature', 'timezone', 'mass', 'length', 'area-volume',
  'radix', 'speed', 'pressure', 'energy',
];

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'temperature').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'temperature';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-convert',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({ color: true, speed: true, size: true, count: true }),
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy,
  });
}

function resolveFamily(id) {
  const partsId = String(id).split('-');
  const last = partsId[partsId.length - 1];
  let family = /^\d+$/.test(last) ? partsId.slice(0, -1).join('-') : String(id);
  if (!FAMILIES.includes(family)) {
    for (let i = partsId.length - 1; i >= 1; i--) {
      const cand = partsId.slice(0, i).join('-');
      if (FAMILIES.includes(cand)) { family = cand; break; }
    }
  }
  if (!FAMILIES.includes(family)) {
    const num = parseInt(String(id).split('-').pop(), 10) || 1;
    family = FAMILIES[(num - 1) % FAMILIES.length];
  }
  return family;
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'temperature';
  const family = resolveFamily(id);
  const { stage } = bar(host, id, '');
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const stop = loop((_dt, t) => {
    const L = live();
    const tint = L.color || '#818cf8';
    const tt = t * (L.speed > 0 ? L.speed : 1);
    const sz = L.size > 0 ? L.size : 1;
    const n = Math.max(1, Math.round(L.count > 0 ? L.count : 8));
    const { w, h } = state;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    drawFamily(ctx, family, w, h, tint, tt, sz, n, L);
  });
  return () => { stop(); dispose(); host.innerHTML = ''; };
}

const TAU = Math.PI * 2;
function hexRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#818cf8');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [129, 140, 248];
}
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function title(ctx, text, x, y) {
  ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}
function caption(ctx, text, x, y) {
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}
function card(ctx, x, y, w, h, tint) {
  ctx.fillStyle = rgba(tint, 0.08);
  ctx.strokeStyle = rgba(tint, 0.35);
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function valueCard(ctx, x, y, w, h, label, value, unit, tint, accent) {
  card(ctx, x, y, w, h, tint);
  ctx.fillStyle = accent || tint;
  ctx.font = '600 11px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 18);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${Math.min(28, h * 0.38)}px ui-monospace,monospace`;
  ctx.fillText(value, x + 12, y + h * 0.62);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px ui-sans-serif,system-ui';
  ctx.fillText(unit, x + 12, y + h - 12);
}

function drawFamily(ctx, family, w, h, tint, tt, sz, n, L) {
  switch (family) {
    case 'temperature': return drawTemp(ctx, w, h, tint, tt, sz);
    case 'timezone': return drawTimezone(ctx, w, h, tint, tt, sz, n);
    case 'mass': return drawMass(ctx, w, h, tint, tt, sz);
    case 'length': return drawLength(ctx, w, h, tint, tt, sz);
    case 'area-volume': return drawAreaVol(ctx, w, h, tint, tt, sz, n);
    case 'radix': return drawRadix(ctx, w, h, tint, tt, sz, n);
    case 'speed': return drawSpeed(ctx, w, h, tint, tt, sz);
    case 'pressure': return drawPressure(ctx, w, h, tint, tt, sz);
    case 'energy': return drawEnergy(ctx, w, h, tint, tt, sz);
    default: return drawTemp(ctx, w, h, tint, tt, sz);
  }
}

/* ── 温度 ───────────────────────────────────────────── */
function drawTemp(ctx, w, h, tint, tt, sz) {
  title(ctx, '温度换算  °C / °F / K / °R', 16, 22);
  // base °C driven by size + gentle motion
  const c = -20 + 60 * sz + 8 * Math.sin(tt * 0.5);
  const f = c * 9 / 5 + 32;
  const k = c + 273.15;
  const r = (c + 273.15) * 9 / 5;
  const units = [
    ['摄氏', c, '°C', '#22d3ee'],
    ['华氏', f, '°F', '#f472b6'],
    ['开尔文', k, 'K', '#fbbf24'],
    ['兰氏', r, '°R', '#a78bfa'],
  ];
  const gap = 10, cardW = (w - 32 - gap * 3) / 4, cardH = 88;
  units.forEach((u, i) => {
    valueCard(ctx, 16 + i * (cardW + gap), 40, cardW, cardH, u[0], u[1].toFixed(1), u[2], tint, u[3]);
  });
  // dual thermometer
  const tx = w * 0.28, ty = h * 0.42, th = h * 0.45, tw = 18;
  drawThermo(ctx, tx, ty, tw, th, (c + 30) / 100, '#22d3ee', '°C', -30, 70);
  drawThermo(ctx, w * 0.55, ty, tw, th, (f + 22) / 180, '#f472b6', '°F', -22, 158);
  // linked scale bar
  const bx = 16, by = h - 28, bw = w - 32;
  ctx.fillStyle = '#1e293b'; roundRect(ctx, bx, by - 6, bw, 12, 6); ctx.fill();
  const tnorm = Math.min(1, Math.max(0, (c + 30) / 100));
  const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grd.addColorStop(0, '#38bdf8'); grd.addColorStop(0.5, '#818cf8'); grd.addColorStop(1, '#f472b6');
  ctx.fillStyle = grd; roundRect(ctx, bx, by - 6, bw * tnorm, 12, 6); ctx.fill();
  caption(ctx, `尺寸改变基准温度 · 四标度实时联动`, 16, h - 12);
}

function drawThermo(ctx, x, y, tw, th, frac, color, label, min, max) {
  const f = Math.min(1, Math.max(0, frac));
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, x, y, tw, th, tw / 2); ctx.fill();
  ctx.fillStyle = color;
  const fillH = (th - tw) * f;
  roundRect(ctx, x + 3, y + th - tw - fillH, tw - 6, fillH + tw - 6, (tw - 6) / 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + tw / 2, y + th - tw / 2, tw * 0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + tw + 8, y + 12);
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
  ctx.fillText(String(max), x + tw + 8, y + 28);
  ctx.fillText(String(min), x + tw + 8, y + th - 4);
}

/* ── 时差 ───────────────────────────────────────────── */
const CITIES = [
  { name: '北京', offset: 8, color: '#f472b6' },
  { name: '东京', offset: 9, color: '#fbbf24' },
  { name: '新加坡', offset: 8, color: '#22d3ee' },
  { name: '迪拜', offset: 4, color: '#a78bfa' },
  { name: '伦敦', offset: 0, color: '#34d399' },
  { name: '纽约', offset: -5, color: '#60a5fa' },
  { name: '洛杉矶', offset: -8, color: '#fb7185' },
  { name: '悉尼', offset: 11, color: '#c084fc' },
];
function drawTimezone(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '世界时差 · 主要城市 UTC 偏移', 16, 22);
  const show = Math.min(CITIES.length, Math.max(4, Math.round(4 + sz * 4)));
  // simulated UTC hours from tt
  const utcH = (12 + tt * 0.15) % 24;
  const stripY = 48, stripH = 56;
  // UTC strip
  card(ctx, 16, stripY, w - 32, stripH, tint);
  ctx.fillStyle = tint; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('UTC', 28, stripY + 22);
  ctx.fillStyle = '#f8fafc'; ctx.font = '700 22px ui-monospace,monospace';
  const uh = Math.floor(utcH), um = Math.floor((utcH % 1) * 60);
  ctx.fillText(`${String(uh).padStart(2, '0')}:${String(um).padStart(2, '0')}`, 28, stripY + 46);
  // day progress bar
  ctx.fillStyle = '#1e293b'; roundRect(ctx, w * 0.35, stripY + 18, w * 0.55, 20, 6); ctx.fill();
  ctx.fillStyle = rgba(tint, 0.7);
  roundRect(ctx, w * 0.35, stripY + 18, w * 0.55 * (utcH / 24), 20, 6); ctx.fill();

  const cols = Math.min(4, show);
  const rows = Math.ceil(show / cols);
  const gap = 10;
  const cw = (w - 32 - gap * (cols - 1)) / cols;
  const ch = Math.min(78, (h - stripY - stripH - 50 - gap * (rows - 1)) / rows);
  for (let i = 0; i < show; i++) {
    const c = CITIES[i];
    const col = i % cols, row = Math.floor(i / cols);
    const x = 16 + col * (cw + gap);
    const y = stripY + stripH + 16 + row * (ch + gap);
    const local = (utcH + c.offset + 24) % 24;
    const lh = Math.floor(local), lm = Math.floor((local % 1) * 60);
    const night = local < 6 || local >= 19;
    card(ctx, x, y, cw, ch, c.color);
    ctx.fillStyle = c.color; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(c.name, x + 10, y + 16);
    ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
    ctx.font = `700 ${Math.min(22, ch * 0.36)}px ui-monospace,monospace`;
    ctx.fillText(`${String(lh).padStart(2, '0')}:${String(lm).padStart(2, '0')}`, x + 10, y + ch * 0.58);
    const sign = c.offset >= 0 ? '+' : '';
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
    ctx.fillText(`UTC${sign}${c.offset}  ${night ? '夜' : '昼'}`, x + 10, y + ch - 10);
  }
  caption(ctx, `速度驱动时间流逝 · 尺寸控制显示城市数`, 16, h - 14);
}

/* ── 质量 ───────────────────────────────────────────── */
function drawMass(ctx, w, h, tint, tt, sz) {
  title(ctx, '重量 / 质量  kg · g · lb · oz · 斤 · 两', 16, 22);
  const kg = 0.5 + 40 * sz + 2 * Math.sin(tt * 0.4);
  const rows = [
    ['千克', kg, 'kg', '#818cf8'],
    ['克', kg * 1000, 'g', '#22d3ee'],
    ['磅', kg * 2.20462262, 'lb', '#f472b6'],
    ['盎司', kg * 35.2739619, 'oz', '#fbbf24'],
    ['斤', kg * 2, '斤', '#34d399'],
    ['两', kg * 20, '两', '#a78bfa'],
  ];
  const cols = 3, gap = 10;
  const cw = (w - 32 - gap * (cols - 1)) / cols, ch = 78;
  rows.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 16 + col * (cw + gap), y = 44 + row * (ch + gap);
    const val = r[1] >= 100 ? r[1].toFixed(0) : r[1].toFixed(2);
    valueCard(ctx, x, y, cw, ch, r[0], val, r[2], tint, r[3]);
  });
  // balance visual
  const bx = w * 0.5, by = h - 70;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx - 80, by); ctx.lineTo(bx + 80, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, by - 30); ctx.lineTo(bx, by); ctx.stroke();
  const tip = Math.sin(tt) * 6;
  ctx.strokeStyle = tint; ctx.beginPath();
  ctx.moveTo(bx - 70, by + tip); ctx.lineTo(bx + 70, by - tip); ctx.stroke();
  ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(bx - 70, by + tip + 12, 10 + sz * 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(bx + 70, by - tip + 12, 10 + sz * 4, 0, TAU); ctx.fill();
  caption(ctx, `以千克为基准 · 尺寸调节质量`, 16, h - 14);
}

/* ── 长度 ───────────────────────────────────────────── */
function drawLength(ctx, w, h, tint, tt, sz) {
  title(ctx, '距离 / 长度  m · km · mile · ft · inch · 里 · nmi', 16, 22);
  const m = 1 + 5000 * sz * sz; // nonlinear for interesting range
  const rows = [
    ['米', m, 'm'],
    ['千米', m / 1000, 'km'],
    ['英里', m / 1609.344, 'mile'],
    ['英尺', m / 0.3048, 'ft'],
    ['英寸', m / 0.0254, 'inch'],
    ['市里', m / 500, '里'],
    ['海里', m / 1852, 'nmi'],
  ];
  const fmt = (v) => (v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3));
  rows.forEach((r, i) => {
    const y = 42 + i * 28;
    ctx.fillStyle = '#1e293b'; roundRect(ctx, 16, y, w - 32, 24, 6); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(r[0], 24, y + 16);
    const barMax = w - 160;
    const norm = Math.min(1, Math.log10(1 + r[1]) / 5);
    ctx.fillStyle = rgba(tint, 0.55);
    roundRect(ctx, 70, y + 5, barMax * norm, 14, 4); ctx.fill();
    ctx.fillStyle = '#f8fafc'; ctx.font = '600 12px ui-monospace,monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${fmt(r[1])} ${r[2]}`, w - 24, y + 16);
  });
  caption(ctx, `尺寸增大基准米数 · 对数条便于跨数量级对比`, 16, h - 14);
}

/* ── 面积/体积 ───────────────────────────────────────── */
function drawAreaVol(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '面积 / 体积  m² · acre · 坪 · L · gal · ml', 16, 22);
  const mode = n % 2; // 0 area 1 volume
  if (mode === 0) {
    const m2 = 10 + 4000 * sz;
    const items = [
      ['平方米', m2, 'm²', '#22d3ee'],
      ['公顷', m2 / 10000, 'ha', '#34d399'],
      ['英亩', m2 / 4046.8564224, 'acre', '#fbbf24'],
      ['坪', m2 / 3.305785, '坪', '#f472b6'],
    ];
    items.forEach((it, i) => {
      const x = 16 + (i % 2) * ((w - 42) / 2 + 10);
      const y = 44 + Math.floor(i / 2) * 100;
      valueCard(ctx, x, y, (w - 42) / 2, 88, it[0], it[1] >= 10 ? it[1].toFixed(2) : it[1].toFixed(3), it[2], tint, it[3]);
    });
    // square visual
    const s = 30 + 40 * Math.min(1, Math.sqrt(m2) / 80);
    ctx.strokeStyle = tint; ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.5 - s / 2, h - 90, s, s);
    caption(ctx, `面积模式 · count 奇偶切换面积/体积`, 16, h - 14);
  } else {
    const L = 0.5 + 80 * sz;
    const items = [
      ['升', L, 'L', '#22d3ee'],
      ['毫升', L * 1000, 'ml', '#34d399'],
      ['美制加仑', L / 3.785411784, 'gal', '#fbbf24'],
      ['立方米', L / 1000, 'm³', '#f472b6'],
    ];
    items.forEach((it, i) => {
      const x = 16 + (i % 2) * ((w - 42) / 2 + 10);
      const y = 44 + Math.floor(i / 2) * 100;
      valueCard(ctx, x, y, (w - 42) / 2, 88, it[0], it[1] >= 100 ? it[1].toFixed(1) : it[1].toFixed(3), it[2], tint, it[3]);
    });
    // cylinder
    const cx = w * 0.5, cy = h - 70, rw = 28 + 20 * Math.min(1, L / 50), rh = 18;
    ctx.fillStyle = rgba(tint, 0.3);
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, rw, rh, 0, 0, TAU); ctx.fill();
    ctx.fillRect(cx - rw, cy - 30, rw * 2, 50);
    ctx.fillStyle = rgba(tint, 0.5);
    ctx.beginPath(); ctx.ellipse(cx, cy - 30, rw, rh, 0, 0, TAU); ctx.fill();
    caption(ctx, `体积模式 · 尺寸调节升数`, 16, h - 14);
  }
}

/* ── 进制 ───────────────────────────────────────────── */
function drawRadix(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '进制转换  二 / 八 / 十 / 十六 + 位可视化', 16, 22);
  const bits = Math.min(16, Math.max(4, n + 4));
  const maxVal = (1 << Math.min(bits, 16)) - 1;
  const val = Math.floor(((0.15 + 0.7 * sz) * maxVal + tt * 8) % (maxVal + 1));
  const bin = val.toString(2).padStart(bits, '0');
  const oct = val.toString(8);
  const hex = val.toString(16).toUpperCase();
  const cards = [
    ['十进制 DEC', String(val), '#fbbf24'],
    ['二进制 BIN', bin, '#22d3ee'],
    ['八进制 OCT', oct, '#f472b6'],
    ['十六进制 HEX', '0x' + hex, '#a78bfa'],
  ];
  cards.forEach((c, i) => {
    const y = 40 + i * 42;
    card(ctx, 16, y, w - 32, 36, c[2]);
    ctx.fillStyle = c[2]; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(c[0], 28, y + 14);
    ctx.fillStyle = '#f8fafc'; ctx.font = '700 16px ui-monospace,monospace';
    ctx.fillText(c[1], 28, y + 30);
  });
  // bit strip
  const by = 40 + 4 * 42 + 12;
  const bw = Math.min(28, (w - 40) / bits - 4);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`位宽 ${bits} bit`, 16, by);
  for (let i = 0; i < bits; i++) {
    const bit = bin[i] === '1';
    const x = 16 + i * (bw + 4);
    const y = by + 10;
    ctx.fillStyle = bit ? tint : '#1e293b';
    ctx.strokeStyle = bit ? '#fbbf24' : '#334155';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, bw, bw * 1.2, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = bit ? '#0f172a' : '#64748b';
    ctx.font = `700 ${Math.max(10, bw * 0.45)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(bit ? '1' : '0', x + bw / 2, y + bw * 0.75);
  }
  caption(ctx, `尺寸≈数值比例 · count 控制位宽 · 速度让数值递增`, 16, h - 14);
}

/* ── 速度 ───────────────────────────────────────────── */
function drawSpeed(ctx, w, h, tint, tt, sz) {
  title(ctx, '速度  km/h · mph · m/s · knot', 16, 22);
  const kmh = 10 + 180 * sz + 15 * Math.sin(tt * 0.6);
  const items = [
    ['千米/时', kmh, 'km/h', '#22d3ee'],
    ['英里/时', kmh / 1.609344, 'mph', '#f472b6'],
    ['米/秒', kmh / 3.6, 'm/s', '#fbbf24'],
    ['节', kmh / 1.852, 'knot', '#a78bfa'],
  ];
  items.forEach((it, i) => {
    const x = 16 + (i % 2) * ((w - 42) / 2 + 10);
    const y = 40 + Math.floor(i / 2) * 90;
    valueCard(ctx, x, y, (w - 42) / 2, 80, it[0], it[1].toFixed(1), it[2], tint, it[3]);
  });
  // speedometer
  const cx = w * 0.5, cy = h - 30, R = Math.min(90, w * 0.22);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, TAU); ctx.stroke();
  const frac = Math.min(1, kmh / 200);
  ctx.strokeStyle = tint; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * frac); ctx.stroke();
  ctx.lineCap = 'butt';
  const ang = Math.PI + Math.PI * frac;
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * (R - 8), cy + Math.sin(ang) * (R - 8)); ctx.stroke();
  caption(ctx, `尺寸调节速度 · 仪表盘同步`, 16, h - 14);
}

/* ── 压力 ───────────────────────────────────────────── */
function drawPressure(ctx, w, h, tint, tt, sz) {
  title(ctx, '压力  Pa · bar · psi · atm', 16, 22);
  const bar = 0.2 + 8 * sz + 0.3 * Math.sin(tt * 0.5);
  const items = [
    ['巴', bar, 'bar', '#22d3ee'],
    ['千帕', bar * 100, 'kPa', '#34d399'],
    ['磅力/英寸²', bar * 14.5037738, 'psi', '#f472b6'],
    ['标准大气压', bar / 1.01325, 'atm', '#fbbf24'],
  ];
  items.forEach((it, i) => {
    const x = 16 + (i % 2) * ((w - 42) / 2 + 10);
    const y = 40 + Math.floor(i / 2) * 90;
    valueCard(ctx, x, y, (w - 42) / 2, 80, it[0], it[1].toFixed(2), it[2], tint, it[3]);
  });
  // piston
  const px = w * 0.5 - 40, py = h - 100, ph = 50, fill = Math.min(0.9, bar / 10);
  ctx.fillStyle = '#1e293b'; roundRect(ctx, px, py, 80, ph, 6); ctx.fill();
  ctx.fillStyle = rgba(tint, 0.6);
  ctx.fillRect(px + 4, py + ph - 4 - (ph - 8) * fill, 72, (ph - 8) * fill);
  ctx.fillStyle = '#94a3b8'; roundRect(ctx, px + 10, py - 12, 60, 12, 3); ctx.fill();
  caption(ctx, `活塞高度示意相对压强 · 尺寸调 bar`, 16, h - 14);
}

/* ── 能量 ───────────────────────────────────────────── */
function drawEnergy(ctx, w, h, tint, tt, sz) {
  title(ctx, '能量  J · cal · kWh · eV', 16, 22);
  const J = 100 + 5e6 * sz * sz;
  const items = [
    ['焦耳', J, 'J', '#22d3ee'],
    ['卡路里', J / 4.184, 'cal', '#f472b6'],
    ['千瓦时', J / 3.6e6, 'kWh', '#fbbf24'],
    ['电子伏特', J / 1.602176634e-19, 'eV', '#a78bfa'],
  ];
  const fmt = (v) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'e9';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'e6';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'e3';
    if (v < 0.01) return v.toExponential(2);
    return v.toFixed(2);
  };
  items.forEach((it, i) => {
    const x = 16 + (i % 2) * ((w - 42) / 2 + 10);
    const y = 40 + Math.floor(i / 2) * 90;
    valueCard(ctx, x, y, (w - 42) / 2, 80, it[0], fmt(it[1]), it[2], tint, it[3]);
  });
  // battery fill
  const bx = w * 0.5 - 50, by = h - 70;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  roundRect(ctx, bx, by, 90, 36, 6); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.fillRect(bx + 90, by + 10, 8, 16);
  const frac = Math.min(1, Math.log10(1 + J) / 8);
  ctx.fillStyle = rgba(tint, 0.7);
  roundRect(ctx, bx + 3, by + 3, 84 * frac, 30, 4); ctx.fill();
  caption(ctx, `尺寸调节能量数量级 · 电池填充≈对数比例`, 16, h - 14);
}
