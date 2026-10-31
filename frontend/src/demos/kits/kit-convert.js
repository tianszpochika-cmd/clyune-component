import { makeCanvas, loop, bar, defaultParams, readLiveControls, localPoint } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = [
  'temperature', 'timezone', 'mass', 'length', 'area-volume',
  'radix', 'speed', 'pressure', 'energy',
];

const PRESET_DEFAULTS = {
  '常温': { size: 0.7, speed: 0.5 }, '冰点': { size: 0.33, speed: 0.3 }, '沸点旁': { size: 1.9, speed: 0.4 },
  '低温': { size: 0.2, speed: 0.3 }, '动': { speed: 1.8 }, '静': { speed: 0.25 },
  '亚洲': { count: 4, size: 1 }, '欧美': { count: 8, size: 1.2 }, '多城': { size: 1.6, count: 10 },
  '少城': { size: 0.7, count: 4 }, '快进': { speed: 2.4 }, '慢': { speed: 0.35 },
  '轻物': { size: 0.35 }, '重物': { size: 1.8 }, '厨房': { size: 0.55 }, '货运': { size: 1.6 },
  '人体': { size: 0.45 }, '街道': { size: 0.9 }, '城际': { size: 1.4 }, '航海': { size: 1.9 },
  '面积': { count: 2 }, '体积': { count: 3 }, '大': { size: 1.7 }, '小': { size: 0.55 },
  '8位': { count: 4 }, '12位': { count: 8 }, '16位': { count: 12 }, '快增': { speed: 2.2 }, '慢增': { speed: 0.35 }, '中值': { size: 1 },
  '步行': { size: 0.25 }, '车速': { size: 0.7 }, '高铁': { size: 1.4 }, '航速': { size: 1.9 },
  '低压': { size: 0.35 }, '常压': { size: 0.7 }, '高压': { size: 1.7 },
  '小能': { size: 0.35 }, '家用': { size: 0.9 }, '工业': { size: 1.8 },
};

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'temperature').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'temperature';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-convert',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({ color: true, speed: true, size: true, count: true }),
    mapVariant: (family, n) => `${family}-${n}`,
    remountKeys: ['count'],
    presetDefaults: PRESET_DEFAULTS,
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
  const roots = () => [
    host, stage, host.parentElement,
    host.closest?.('.kit-inner'), host.closest?.('.kit-stage'),
    host.closest?.('.fx-layout'), host.closest?.('.fx-root'),
  ];
  const live = () => {
    const L = readLiveControls(roots(), ctrl);
    return { ...L, style: Number.isFinite(ctrl.style) ? ctrl.style : 0, styleName: ctrl.styleName || '' };
  };
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const ix = { drag: null, t: 0.5, val: 0 };

  const onDown = (e) => {
    const p = localPoint(canvas, e);
    const { w, h } = state;
    // bottom slider bar hit for temperature/mass/speed/etc
    if (p.y > h - 40 && p.y < h - 10) {
      ix.drag = { key: 'slider' };
      ix.t = Math.min(1, Math.max(0, (p.x - 16) / Math.max(1, w - 32)));
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    if (family === 'radix') {
      const L = live();
      const bits = Math.min(16, Math.max(4, Math.round(L.count) + 4));
      const maxVal = (1 << Math.min(bits, 16)) - 1;
      const by = 40 + 4 * 42 + 22;
      const bw = Math.min(28, (w - 40) / bits - 4);
      for (let i = 0; i < bits; i++) {
        const x = 16 + i * (bw + 4);
        if (p.x >= x && p.x <= x + bw && p.y >= by && p.y <= by + bw * 1.2) {
          if (!ix._user) {
            const sz = L.size > 0 ? L.size : 1;
            ix.val = Math.floor((0.05 + 0.9 * sz) * maxVal) & maxVal;
          }
          ix._user = true;
          ix.val = (Number(ix.val) || 0) ^ (1 << (bits - 1 - i));
          e.preventDefault();
          return;
        }
      }
    }
  };
  const onMove = (e) => {
    if (!ix.drag) return;
    const p = localPoint(canvas, e);
    const { w } = state;
    if (ix.drag.key === 'slider') ix.t = Math.min(1, Math.max(0, (p.x - 16) / Math.max(1, w - 32)));
  };
  const onUp = () => { ix.drag = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.cursor = 'pointer';

  const stop = loop((_dt, t) => {
    const L = live();
    const tint = L.color || '#818cf8';
    const spd = L.speed > 0 ? L.speed : 1;
    const tt = t * spd;
    const sz = L.size > 0 ? L.size : 1;
    const n = Math.max(1, Math.round(L.count > 0 ? L.count : 8));
    const { w, h } = state;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    // blend slider with size for stronger visible coupling
    const mix = ix.drag || ix.t !== 0.5 ? ix.t : (sz - 0.5) / 1.5;
    drawFamily(ctx, family, w, h, tint, tt, sz, n, L, ix, mix);
  });
  return () => {
    stop();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    dispose(); host.innerHTML = '';
  };
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
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function card(ctx, x, y, w, h, tint) {
  ctx.fillStyle = rgba(tint, 0.08); ctx.strokeStyle = rgba(tint, 0.35); ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
}
function valueCard(ctx, x, y, w, h, label, value, unit, tint, accent) {
  card(ctx, x, y, w, h, tint);
  ctx.fillStyle = accent || tint; ctx.font = '600 11px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, y + 18);
  ctx.fillStyle = '#f8fafc'; ctx.font = `700 ${Math.min(28, h * 0.38)}px ui-monospace,monospace`;
  ctx.fillText(value, x + 12, y + h * 0.62);
  ctx.fillStyle = '#94a3b8'; ctx.font = '12px ui-sans-serif,system-ui';
  ctx.fillText(unit, x + 12, y + h - 12);
}
function sliderBar(ctx, w, h, t, tint, label) {
  const bx = 16, by = h - 28, bw = w - 32;
  ctx.fillStyle = '#1e293b'; roundRect(ctx, bx, by - 6, bw, 14, 7); ctx.fill();
  const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grd.addColorStop(0, '#38bdf8'); grd.addColorStop(0.5, tint); grd.addColorStop(1, '#f472b6');
  ctx.fillStyle = grd; roundRect(ctx, bx, by - 6, bw * t, 14, 7); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(bx + bw * t, by + 1, 8, 0, TAU); ctx.fill();
  caption(ctx, label, 16, h - 8);
}

function drawFamily(ctx, family, w, h, tint, tt, sz, n, L, ix, mix) {
  switch (family) {
    case 'temperature': return drawTemp(ctx, w, h, tint, tt, sz, L, mix);
    case 'timezone': return drawTimezone(ctx, w, h, tint, tt, sz, n, L);
    case 'mass': return drawMass(ctx, w, h, tint, tt, sz, mix);
    case 'length': return drawLength(ctx, w, h, tint, tt, sz, n, mix);
    case 'area-volume': return drawAreaVol(ctx, w, h, tint, tt, sz, n, L, mix);
    case 'radix': return drawRadix(ctx, w, h, tint, tt, sz, n, L, ix);
    case 'speed': return drawSpeed(ctx, w, h, tint, tt, sz, mix);
    case 'pressure': return drawPressure(ctx, w, h, tint, tt, sz, mix);
    case 'energy': return drawEnergy(ctx, w, h, tint, tt, sz, n, mix);
    default: return drawTemp(ctx, w, h, tint, tt, sz, L, mix);
  }
}

function drawTemp(ctx, w, h, tint, tt, sz, L, mix) {
  title(ctx, '温度换算  °C / °F / K / °R · 拖底栏', 16, 22);
  // size + mix + styleName presets dominate; gentle speed wobble
  const base = -30 + 130 * Math.min(1, Math.max(0, mix));
  const c = base + 3 * Math.sin(tt * 0.8);
  const f = c * 9 / 5 + 32, k = c + 273.15, r = k * 9 / 5;
  const units = [['摄氏', c, '°C', '#22d3ee'], ['华氏', f, '°F', '#f472b6'], ['开尔文', k, 'K', '#fbbf24'], ['兰氏', r, '°R', '#a78bfa']];
  const gap = 10, cardW = (w - 32 - gap * 3) / 4, cardH = 88;
  units.forEach((u, i) => valueCard(ctx, 16 + i * (cardW + gap), 40, cardW, cardH, u[0], u[1].toFixed(1), u[2], tint, u[3]));
  drawThermo(ctx, w * 0.28, h * 0.42, 18, h * 0.38, (c + 30) / 130, '#22d3ee', '°C', -30, 100);
  drawThermo(ctx, w * 0.55, h * 0.42, 18, h * 0.38, (f + 22) / 212, '#f472b6', '°F', -22, 190);
  sliderBar(ctx, w, h, Math.min(1, Math.max(0, (c + 30) / 130)), tint, `拖动/尺寸 → ${c.toFixed(1)}°C · 预设冰点/沸点 · 颜色改强调色`);
}
function drawThermo(ctx, x, y, tw, th, frac, color, label, min, max) {
  const f = Math.min(1, Math.max(0, frac));
  ctx.fillStyle = '#1e293b'; roundRect(ctx, x, y, tw, th, tw / 2); ctx.fill();
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

const CITIES = [
  { name: '北京', offset: 8, color: '#f472b6' }, { name: '东京', offset: 9, color: '#fbbf24' },
  { name: '新加坡', offset: 8, color: '#22d3ee' }, { name: '迪拜', offset: 4, color: '#a78bfa' },
  { name: '伦敦', offset: 0, color: '#34d399' }, { name: '纽约', offset: -5, color: '#60a5fa' },
  { name: '洛杉矶', offset: -8, color: '#fb7185' }, { name: '悉尼', offset: 11, color: '#c084fc' },
];
function drawTimezone(ctx, w, h, tint, tt, sz, n, L) {
  title(ctx, '世界时差 · 速度驱动时间', 16, 22);
  const show = Math.min(CITIES.length, Math.max(3, Math.round(3 + sz * 5)));
  const utcH = (8 + tt * 0.4 + (L.style || 0) * 2) % 24;
  card(ctx, 16, 48, w - 32, 56, tint);
  ctx.fillStyle = tint; ctx.font = '600 12px sans-serif'; ctx.fillText('UTC', 28, 70);
  const uh = Math.floor(utcH), um = Math.floor((utcH % 1) * 60);
  ctx.fillStyle = '#f8fafc'; ctx.font = '700 22px ui-monospace,monospace';
  ctx.fillText(`${String(uh).padStart(2, '0')}:${String(um).padStart(2, '0')}`, 28, 94);
  ctx.fillStyle = '#1e293b'; roundRect(ctx, w * 0.35, 66, w * 0.55, 20, 6); ctx.fill();
  ctx.fillStyle = rgba(tint, 0.75); roundRect(ctx, w * 0.35, 66, w * 0.55 * (utcH / 24), 20, 6); ctx.fill();
  const cols = Math.min(4, show), rows = Math.ceil(show / cols), gap = 10;
  const cw = (w - 32 - gap * (cols - 1)) / cols;
  const ch = Math.min(78, (h - 130 - gap * (rows - 1)) / rows);
  for (let i = 0; i < show; i++) {
    const c = CITIES[i]; const col = i % cols, row = Math.floor(i / cols);
    const x = 16 + col * (cw + gap), y = 120 + row * (ch + gap);
    const local = (utcH + c.offset + 24) % 24;
    const lh = Math.floor(local), lm = Math.floor((local % 1) * 60);
    const night = local < 6 || local >= 19;
    card(ctx, x, y, cw, ch, c.color);
    ctx.fillStyle = c.color; ctx.font = '600 11px sans-serif'; ctx.fillText(c.name, x + 10, y + 16);
    ctx.fillStyle = night ? '#94a3b8' : '#f8fafc';
    ctx.font = `700 ${Math.min(22, ch * 0.36)}px ui-monospace,monospace`;
    ctx.fillText(`${String(lh).padStart(2, '0')}:${String(lm).padStart(2, '0')}`, x + 10, y + ch * 0.58);
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
    ctx.fillText(`UTC${c.offset >= 0 ? '+' : ''}${c.offset} ${night ? '夜' : '昼'}`, x + 10, y + ch - 10);
  }
  caption(ctx, `显示 ${show} 城 · 尺寸改城市数 · 预设亚洲/欧美`, 16, h - 14);
}

function drawMass(ctx, w, h, tint, tt, sz, mix) {
  title(ctx, '重量/质量 · 拖底栏', 16, 22);
  const kg = 0.2 + 80 * Math.min(1, Math.max(0, mix)) + Math.sin(tt) * 0.05;
  const rows = [
    ['千克', kg, 'kg', '#818cf8'], ['克', kg * 1000, 'g', '#22d3ee'], ['磅', kg * 2.20462262, 'lb', '#f472b6'],
    ['盎司', kg * 35.2739619, 'oz', '#fbbf24'], ['斤', kg * 2, '斤', '#34d399'], ['两', kg * 20, '两', '#a78bfa'],
  ];
  const cols = 3, gap = 10, cw = (w - 32 - gap * 2) / 3, ch = 78;
  rows.forEach((r, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    valueCard(ctx, 16 + col * (cw + gap), 44 + row * (ch + gap), cw, ch, r[0], r[1] >= 100 ? r[1].toFixed(0) : r[1].toFixed(2), r[2], tint, r[3]);
  });
  sliderBar(ctx, w, h, Math.min(1, kg / 80), tint, `基准 ${kg.toFixed(2)} kg`);
}

function drawLength(ctx, w, h, tint, tt, sz, n, mix) {
  title(ctx, '距离/长度 · 拖底栏', 16, 22);
  const m = Math.pow(10, mix * 6) * (0.5 + 0.5 * sz); // 1m .. ~500km scale-ish
  const rows = [
    ['米', m, 'm'], ['千米', m / 1000, 'km'], ['英里', m / 1609.344, 'mile'],
    ['英尺', m / 0.3048, 'ft'], ['英寸', m / 0.0254, 'inch'], ['市里', m / 500, '里'], ['海里', m / 1852, 'nmi'],
  ];
  const show = Math.min(rows.length, Math.max(2, Math.round(2 + n / 8)));
  const fmt = (v) => (v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3));
  rows.slice(0, show).forEach((r, i) => {
    const y = 42 + i * 28;
    ctx.fillStyle = '#1e293b'; roundRect(ctx, 16, y, w - 32, 24, 6); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(r[0], 24, y + 16);
    const norm = Math.min(1, Math.log10(1 + r[1]) / 6);
    ctx.fillStyle = rgba(tint, 0.55); roundRect(ctx, 70, y + 5, (w - 160) * norm, 14, 4); ctx.fill();
    ctx.fillStyle = '#f8fafc'; ctx.font = '600 12px ui-monospace,monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${fmt(r[1])} ${r[2]}`, w - 24, y + 16);
  });
  // count badges
  for (let i = 0; i < Math.min(24, Math.max(2, Math.round(n / 2))); i++) {
    ctx.fillStyle = rgba(tint, 0.35 + (i % 3) * 0.15);
    ctx.fillRect(16 + i * 10, h - 52, 8, 8);
  }
  sliderBar(ctx, w, h, mix, tint, `显示 ${show} 单位 · count改行数 · 基准 ≈ ${m.toFixed(1)} m`);
}

function drawAreaVol(ctx, w, h, tint, tt, sz, n, L, mix) {
  title(ctx, '面积 / 体积 · count 奇偶切换', 16, 22);
  const mode = (n + (L.style || 0)) % 2;
  if (mode === 0) {
    const m2 = 5 + 8000 * mix * sz;
    const items = [['平方米', m2, 'm²', '#22d3ee'], ['公顷', m2 / 10000, 'ha', '#34d399'], ['英亩', m2 / 4046.8564224, 'acre', '#fbbf24'], ['坪', m2 / 3.305785, '坪', '#f472b6']];
    items.forEach((it, i) => {
      valueCard(ctx, 16 + (i % 2) * ((w - 42) / 2 + 10), 44 + Math.floor(i / 2) * 100, (w - 42) / 2, 88, it[0], it[1] >= 10 ? it[1].toFixed(2) : it[1].toFixed(3), it[2], tint, it[3]);
    });
    const s = 20 + 50 * Math.min(1, Math.sqrt(m2) / 90);
    ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.strokeRect(w * 0.5 - s / 2, h - 100, s, s);
    sliderBar(ctx, w, h, mix, tint, `面积模式 · ${m2.toFixed(1)} m²`);
  } else {
    const liters = 0.2 + 120 * mix * sz;
    const items = [['升', liters, 'L', '#22d3ee'], ['毫升', liters * 1000, 'ml', '#34d399'], ['美制加仑', liters / 3.785411784, 'gal', '#fbbf24'], ['立方米', liters / 1000, 'm³', '#f472b6']];
    items.forEach((it, i) => {
      valueCard(ctx, 16 + (i % 2) * ((w - 42) / 2 + 10), 44 + Math.floor(i / 2) * 100, (w - 42) / 2, 88, it[0], it[1] >= 100 ? it[1].toFixed(1) : it[1].toFixed(3), it[2], tint, it[3]);
    });
    sliderBar(ctx, w, h, mix, tint, `体积模式 · ${liters.toFixed(2)} L`);
  }
}

function drawRadix(ctx, w, h, tint, tt, sz, n, L, ix) {
  title(ctx, '进制转换 · 点击比特翻转', 16, 22);
  const bits = Math.min(16, Math.max(4, Math.round(n) + 4));
  const maxVal = (1 << Math.min(bits, 16)) - 1;
  // size picks mid value; speed animates; click XOR bits
  if (!ix._seeded) { ix.val = Math.floor(((0.15 + 0.7 * sz) * maxVal)) & maxVal; ix._seeded = true; }
  if (!ix.drag) ix.val = (ix.val + Math.floor(tt * 2) - Math.floor((tt - 0.016) * 2)) & maxVal;
  // stabilize: only auto-increment when speed high via fractional
  const val = (ix.val ^ 0) & maxVal;
  // Actually better: base from size, XOR user flips, plus animated offset from speed
  const base = Math.floor((0.05 + 0.9 * sz) * maxVal) & maxVal;
  const anim = Math.floor(tt * (0.5 + sz)) & maxVal;
  const v = ((ix.val ? ix.val : base) ^ (ix._user ? 0 : 0)) & maxVal;
  // Prefer explicit ix.val if user clicked; else animate
  const shown = (ix._user ? ix.val : ((base + Math.floor(tt * 3)) & maxVal)) >>> 0;
  const use = shown & maxVal;
  const bin = use.toString(2).padStart(bits, '0');
  const cards = [
    ['十进制 DEC', String(use), '#fbbf24'],
    ['二进制 BIN', bin, '#22d3ee'],
    ['八进制 OCT', use.toString(8), '#f472b6'],
    ['十六进制 HEX', '0x' + use.toString(16).toUpperCase(), '#a78bfa'],
  ];
  cards.forEach((c, i) => {
    const y = 40 + i * 42; card(ctx, 16, y, w - 32, 36, c[2]);
    ctx.fillStyle = c[2]; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(c[0], 28, y + 14);
    ctx.fillStyle = '#f8fafc'; ctx.font = '700 16px ui-monospace,monospace'; ctx.fillText(c[1], 28, y + 30);
  });
  const by = 40 + 4 * 42 + 12;
  const bw = Math.min(28, (w - 40) / bits - 4);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.fillText(`位宽 ${bits} bit · 点击翻转`, 16, by);
  for (let i = 0; i < bits; i++) {
    const bit = bin[i] === '1';
    const x = 16 + i * (bw + 4), y = by + 10;
    ctx.fillStyle = bit ? tint : '#1e293b';
    ctx.strokeStyle = bit ? '#fbbf24' : '#334155'; ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, bw, bw * 1.2, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = bit ? '#0f172a' : '#64748b';
    ctx.font = `700 ${Math.max(10, bw * 0.45)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(bit ? '1' : '0', x + bw / 2, y + bw * 0.75);
  }
  // wire click flips into ix
  // (handler already XOR; mark user)
  caption(ctx, `尺寸定基准 · 速度递增 · count 位宽`, 16, h - 14);
}

function drawSpeed(ctx, w, h, tint, tt, sz, mix) {
  title(ctx, '速度换算 · 拖底栏', 16, 22);
  const kmh = 5 + 240 * mix + 5 * Math.sin(tt);
  const items = [['千米/时', kmh, 'km/h', '#22d3ee'], ['英里/时', kmh / 1.609344, 'mph', '#f472b6'], ['米/秒', kmh / 3.6, 'm/s', '#fbbf24'], ['节', kmh / 1.852, 'knot', '#a78bfa']];
  items.forEach((it, i) => {
    valueCard(ctx, 16 + (i % 2) * ((w - 42) / 2 + 10), 40 + Math.floor(i / 2) * 90, (w - 42) / 2, 80, it[0], it[1].toFixed(1), it[2], tint, it[3]);
  });
  const cx = w * 0.5, cy = h - 36, R = Math.min(90, w * 0.22);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, TAU); ctx.stroke();
  const frac = Math.min(1, kmh / 250);
  ctx.strokeStyle = tint; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * frac); ctx.stroke(); ctx.lineCap = 'butt';
  const ang = Math.PI + Math.PI * frac;
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * (R - 8), cy + Math.sin(ang) * (R - 8)); ctx.stroke();
  sliderBar(ctx, w, h, mix, tint, `${kmh.toFixed(0)} km/h`);
}

function drawPressure(ctx, w, h, tint, tt, sz, mix) {
  title(ctx, '压力换算 · 拖底栏', 16, 22);
  const bar = 0.1 + 12 * mix + 0.1 * Math.sin(tt);
  const items = [['巴', bar, 'bar', '#22d3ee'], ['千帕', bar * 100, 'kPa', '#34d399'], ['磅力/英寸²', bar * 14.5037738, 'psi', '#f472b6'], ['标准大气压', bar / 1.01325, 'atm', '#fbbf24']];
  items.forEach((it, i) => {
    valueCard(ctx, 16 + (i % 2) * ((w - 42) / 2 + 10), 40 + Math.floor(i / 2) * 90, (w - 42) / 2, 80, it[0], it[1].toFixed(2), it[2], tint, it[3]);
  });
  const px = w * 0.5 - 40, py = h - 110, ph = 50, fill = Math.min(0.92, bar / 12);
  ctx.fillStyle = '#1e293b'; roundRect(ctx, px, py, 80, ph, 6); ctx.fill();
  ctx.fillStyle = rgba(tint, 0.65); ctx.fillRect(px + 4, py + ph - 4 - (ph - 8) * fill, 72, (ph - 8) * fill);
  ctx.fillStyle = '#94a3b8'; roundRect(ctx, px + 10, py - 12, 60, 12, 3); ctx.fill();
  sliderBar(ctx, w, h, mix, tint, `${bar.toFixed(2)} bar`);
}

function drawEnergy(ctx, w, h, tint, tt, sz, n, mix) {
  title(ctx, '能量换算 · 拖底栏', 16, 22);
  const J = Math.pow(10, 2 + mix * 6) * sz;
  const fmt = (v) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'e9';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'e6';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'e3';
    if (v < 0.01) return v.toExponential(2);
    return v.toFixed(2);
  };
  const items = [['焦耳', J, 'J', '#22d3ee'], ['卡路里', J / 4.184, 'cal', '#f472b6'], ['千瓦时', J / 3.6e6, 'kWh', '#fbbf24'], ['电子伏特', J / 1.602176634e-19, 'eV', '#a78bfa']];
  const show = Math.min(items.length, Math.max(1, Math.round(1 + n / 16)));
  items.slice(0, show).forEach((it, i) => {
    valueCard(ctx, 16 + (i % 2) * ((w - 42) / 2 + 10), 40 + Math.floor(i / 2) * 90, (w - 42) / 2, 80, it[0], fmt(it[1]), it[2], tint, it[3]);
  });
  const cells = Math.min(36, Math.max(3, Math.round(n / 2)));
  for (let i = 0; i < cells; i++) {
    const x = 16 + (i % 12) * 14, y = h - 100 + Math.floor(i / 12) * 14;
    ctx.fillStyle = rgba(tint, 0.25 + (i % 4) * 0.15);
    ctx.fillRect(x, y, 11, 11);
  }
  const bx = w * 0.5 - 50, by = h - 80;
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; roundRect(ctx, bx, by, 90, 36, 6); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.fillRect(bx + 90, by + 10, 8, 16);
  ctx.fillStyle = rgba(tint, 0.75); roundRect(ctx, bx + 3, by + 3, 84 * mix, 30, 4); ctx.fill();
  sliderBar(ctx, w, h, mix, tint, `卡片 ${show} · 格点 ${cells} · ${fmt(J)} J`);
}

