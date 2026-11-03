import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readLiveControls, colorToRgb } from './kits/_shared.js';
import { maxDpr, preferLiteFx, tuneOrbitControls } from '../lib/mobile.js';
import { createInfoPanel, alignDocParams, fmt, F, dockControls } from './kits/info-panel.js';
import { getLang } from '../lib/i18n';

/* Proper English names (the generic dictionary would read 水/金/火 as Water/Gold/Fire). */
const EN_NAME = {
  太阳: 'Sun', 水星: 'Mercury', 金星: 'Venus', 地球: 'Earth', 火星: 'Mars', 木星: 'Jupiter', 土星: 'Saturn', 天王星: 'Uranus', 海王星: 'Neptune',
  月球: 'Moon', 火卫一: 'Phobos', 火卫二: 'Deimos', 木卫一: 'Io', 木卫二: 'Europa', 木卫三: 'Ganymede', 木卫四: 'Callisto',
  土卫一: 'Mimas', 土卫二: 'Enceladus', 土卫三: 'Tethys', 土卫四: 'Dione', 土卫五: 'Rhea', 土卫六: 'Titan',
  天卫五: 'Miranda', 天卫一: 'Ariel', 天卫二: 'Umbriel', 天卫三: 'Titania', 天卫四: 'Oberon', 海卫八: 'Proteus', 海卫一: 'Triton',
};
const EN = () => getLang() === 'en';
const nm = (s) => (s && EN() ? EN_NAME[s] || s : s);

export const PARAMS_SPEC = {
  color: { label: '轨道线颜色', value: '#818cf8' },
  speed: { label: '时间流速', min: 0.1, max: 3, step: 0.1, value: 1 },
  size: { label: '整体缩放', min: 0.5, max: 1.6, step: 0.05, value: 1 },
  count: { label: '行星数', min: 1, max: 8, step: 1, value: 8, buttons: true },
  remountKeys: ['count'],
};
const EARTH_N = 3.5 * Math.pow(3.7, -1.5);
const SS_DOC = {
  title: '太阳系 · 开普勒轨道',
  rows: (v) => [
    ['模式', v.mode === 'helix' ? '螺旋前进（太阳在动）' : '日心（太阳静止）'],
    ['聚焦', v.focus || nm('太阳'), 'focus'],
    ['已过 地球年', fmt(v.years ?? 0, 2)],
    ['半长轴 a', v.a != null ? fmt(v.a, 1) : '—'],
    ['偏心率 e', v.e != null ? fmt(v.e, 3) : '—'],
    ['当前日距 r', v.r != null ? fmt(v.r, 2) : '—'],
    ['公转周期 T', v.T != null ? `${fmt(v.T, 1)} s（${fmt(v.Ty, 2)} 地球年）` : '—', null, 'wide'],
    ['T²/a³', v.k != null ? fmt(v.k, 3) : '—'],
    ['行星数', String(v.n ?? 0)],
  ],
  formula: () => F('r(θ) = a(1 − e²) / (1 + e·cosθ)') + F('dθ/dt = n · (1 + e·cosθ)² / (1 − e²)^1.5') + F('开普勒第三定律：T² ∝ a³（n = 3.5·a^−1.5）'),
  explain: '<p>每颗行星沿<b>椭圆</b>轨道绕太阳转，太阳在椭圆的一个焦点上。偏心率 e 越大椭圆越扁（水星 e≈0.21 最明显）。</p><p>行星离太阳近时跑得快、远时跑得慢（开普勒第二定律：相同时间扫过相同面积），所以角速度公式里带着 (1+e·cosθ)²。</p><p>离太阳越远，公转周期越长：周期的平方与半长轴的立方成正比，所以面板里的 <b>T²/a³</b> 对每颗行星几乎都一样。</p><p>切到“螺旋前进”模式，太阳本身也在银河中前进，行星轨迹被拉成螺旋线。</p>',
  params: [['轨道线颜色', '轨道椭圆线的色调'], ['时间流速', '模拟时间倍率，越大公转越快'], ['整体缩放', '整个太阳系的缩放（含相机距离）'], ['行星数', '从水星起显示前 N 颗行星（会重建场景）']],
  example: (v) => (v.a != null ? `<ol><li>${v.focus}：a = ${fmt(v.a, 1)}，T = 2π/n = ${fmt(v.T, 1)} 秒</li><li>T² / a³ = ${fmt(v.T, 1)}² / ${fmt(v.a, 1)}³ = ${fmt(v.k, 3)}（≈ (2π/3.5)² ≈ 3.223）</li><li>当前日距 r = ${fmt(v.r, 2)}，近日点 a(1−e) = ${fmt(v.a * (1 - v.e), 2)}，远日点 a(1+e) = ${fmt(v.a * (1 + v.e), 2)}</li></ol>` : '<p>点击一颗行星（或上方按钮）聚焦它，这里会算出它的开普勒参数。</p>'),
  tip: '点击行星聚焦，双击空白回到太阳；拖动旋转，滚轮或双指缩放。',
};

/* ------------------------------------------------------------------ data */
const DEG = Math.PI / 180;
const PLANETS = [
  { key: 'mercury', name: '水星', r: 0.16, a: 2.0, e: 0.205, tilt: 0.03, spin: 0.4, tex: 'mercury', trail: 0xb8b2aa, moons: [] },
  { key: 'venus', name: '金星', r: 0.26, a: 2.8, e: 0.007, tilt: 177.4, spin: -0.15, tex: 'venus', atmo: 0xffd9a0, trail: 0xf2c878, moons: [] },
  { key: 'earth', name: '地球', r: 0.28, a: 3.7, e: 0.017, tilt: 23.4, spin: 1.6, tex: 'earth', clouds: true, atmo: 0x5ab0ff, trail: 0x5aa8ff,
    moons: [{ name: '月球', r: 0.27, d: 3.2, w: 1.6, color: 0xcfcfcf }] },
  { key: 'mars', name: '火星', r: 0.2, a: 4.6, e: 0.093, tilt: 25.2, spin: 1.5, tex: 'mars', atmo: 0xff9a6a, atmoK: 0.35, trail: 0xff7a50,
    moons: [{ name: '火卫一', r: 0.14, d: 1.9, w: 5.0, color: 0x9b8b7a }, { name: '火卫二', r: 0.11, d: 2.9, w: 3.0, color: 0xa89a88 }] },
  { key: 'jupiter', name: '木星', r: 0.7, a: 6.6, e: 0.049, tilt: 3.1, spin: 2.6, tex: 'jupiter', trail: 0xe0b080,
    moons: [
      { name: '木卫一', r: 0.08, d: 1.7, w: 3.2, color: 0xe8c85a },
      { name: '木卫二', r: 0.07, d: 2.2, w: 2.3, color: 0xe0d4ba },
      { name: '木卫三', r: 0.11, d: 2.9, w: 1.6, color: 0xa09080 },
      { name: '木卫四', r: 0.1, d: 3.8, w: 1.0, color: 0x6f6458 },
    ] },
  { key: 'saturn', name: '土星', r: 0.6, a: 8.8, e: 0.057, tilt: 26.7, spin: 2.4, tex: 'saturn', trail: 0xf0d090,
    ring: { type: 'saturn', inner: 1.24, outer: 2.27, opacity: 1 },
    moons: [
      { name: '土卫一', r: 0.05, d: 2.6, w: 3.4, color: 0xbdbdbd },
      { name: '土卫二', r: 0.055, d: 2.9, w: 3.0, color: 0xf2f4f8 },
      { name: '土卫三', r: 0.07, d: 3.25, w: 2.6, color: 0xd6d6d0 },
      { name: '土卫四', r: 0.07, d: 3.65, w: 2.2, color: 0xc8c4bc },
      { name: '土卫五', r: 0.09, d: 4.25, w: 1.7, color: 0xbcb6aa },
      { name: '土卫六', r: 0.17, d: 5.4, w: 1.1, color: 0xe0a050 },
    ] },
  { key: 'uranus', name: '天王星', r: 0.42, a: 10.6, e: 0.046, tilt: 97.8, spin: -1.8, tex: 'uranus', atmo: 0x9fe8ff, trail: 0x9fe8ff,
    ring: { type: 'uranus', inner: 1.6, outer: 2.05, opacity: 0.85 },
    moons: [
      { name: '天卫五', r: 0.06, d: 2.4, w: 2.8, color: 0xb8b8b8 },
      { name: '天卫一', r: 0.08, d: 2.9, w: 2.2, color: 0xc8c8c8 },
      { name: '天卫二', r: 0.08, d: 3.3, w: 1.9, color: 0x7a7a7a },
      { name: '天卫三', r: 0.1, d: 3.8, w: 1.5, color: 0xb5aaa0 },
      { name: '天卫四', r: 0.1, d: 4.4, w: 1.2, color: 0xa49a90 },
    ] },
  { key: 'neptune', name: '海王星', r: 0.4, a: 12.2, e: 0.01, tilt: 28.3, spin: 1.9, tex: 'neptune', atmo: 0x6f8dff, trail: 0x6f8dff,
    moons: [
      { name: '海卫八', r: 0.06, d: 2.1, w: 3.0, color: 0x8a8580 },
      { name: '海卫一', r: 0.14, d: 3.2, w: -1.6, color: 0xd9cfc8, inc: 0.35 },
    ] },
];

/* ------------------------------------------------------- CPU noise (tex) */
function hash3(x, y, z, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = hash3(xi, yi, zi, s), c100 = hash3(xi + 1, yi, zi, s);
  const c010 = hash3(xi, yi + 1, zi, s), c110 = hash3(xi + 1, yi + 1, zi, s);
  const c001 = hash3(xi, yi, zi + 1, s), c101 = hash3(xi + 1, yi, zi + 1, s);
  const c011 = hash3(xi, yi + 1, zi + 1, s), c111 = hash3(xi + 1, yi + 1, zi + 1, s);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function fbm(x, y, z, oct = 5, s = 1) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * noise3(x * f, y * f, z * f, s + i * 17);
    norm += a; a *= 0.5; f *= 2.03;
  }
  return sum / norm;
}
const mixc = (a, b, t) => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

const SHADERS = {
  mercury(px, py, pz) {
    const n = fbm(px * 4, py * 4, pz * 4, 5, 3);
    const c = fbm(px * 14 + 3, py * 14, pz * 14, 3, 5);
    let col = mixc([92, 86, 80], [176, 168, 158], n);
    if (c > 0.62) col = mixc(col, [60, 56, 52], (c - 0.62) * 4);
    return col;
  },
  venus(px, py, pz, lat) {
    const n = fbm(px * 2.2, py * 7, pz * 2.2, 5, 7);
    const b = 0.5 + 0.5 * Math.sin(lat * 9 + n * 5);
    return mixc([196, 150, 92], [240, 214, 160], b * 0.6 + n * 0.4);
  },
  earth(px, py, pz, lat) {
    const n = fbm(px * 1.6 + 5, py * 1.6, pz * 1.6, 5, 11);
    if (Math.abs(lat) > 1.2 + (n - 0.5) * 0.4) return [236, 242, 248];
    if (n > 0.52) {
      const m = fbm(px * 6, py * 6, pz * 6, 3, 7);
      if (Math.abs(lat) < 0.55 && m > 0.56) return mixc([196, 170, 112], [168, 140, 90], m);
      return mixc([52, 108, 46], [124, 112, 72], (n - 0.52) * 4 + m * 0.3);
    }
    return mixc([34, 96, 168], [10, 30, 82], Math.min(1, ((0.52 - n) / 0.52) * 2.4));
  },
  clouds(px, py, pz) {
    const n = fbm(px * 3 + 9, py * 3.6, pz * 3, 5, 23);
    const a = sstep(0.5, 0.72, n);
    return [255, 255, 255, a * 235];
  },
  mars(px, py, pz, lat) {
    const n = fbm(px * 3, py * 3, pz * 3, 5, 13);
    const d = fbm(px * 9, py * 9, pz * 9, 3, 2);
    if (Math.abs(lat) > 1.36 + (n - 0.5) * 0.2) return [240, 236, 230];
    let col = mixc([196, 98, 52], [116, 52, 32], sstep(0.45, 0.62, n));
    col = mixc(col, [222, 150, 100], (d - 0.5) * 0.6);
    return col;
  },
  jupiter(px, py, pz, lat, lon) {
    const turb = fbm(px * 3, py * 3, pz * 3, 4, 3);
    const b = Math.sin(lat * 14 + turb * 2.2 + Math.sin(lat * 5) * 1.5);
    let col = mixc([196, 160, 118], [238, 224, 200], (b + 1) / 2);
    if (b < -0.55) col = mixc(col, [150, 98, 66], (-b - 0.55) * 2.2);
    const dl = (lat + 0.39) / 0.08, dn = angDiff(lon, 1.0) / 0.2, dd = dl * dl + dn * dn;
    if (dd < 1) col = mixc(col, [198, 92, 58], (1 - dd) * 1.2);
    return col;
  },
  saturn(px, py, pz, lat) {
    const t = fbm(px * 2, py * 2, pz * 2, 3, 41);
    const b = Math.sin(lat * 22 + t * 1.4);
    let col = mixc([200, 172, 122], [238, 218, 172], (b + 1) / 2);
    if (Math.abs(lat) > 1.2) col = mixc(col, [170, 176, 160], (Math.abs(lat) - 1.2) * 2);
    return col;
  },
  uranus(px, py, pz, lat) {
    const b = Math.sin(lat * 8 + fbm(px * 2, py * 2, pz * 2, 3, 9));
    return mixc([150, 208, 220], [178, 228, 236], (b + 1) / 2);
  },
  neptune(px, py, pz, lat, lon) {
    const n = fbm(px * 2.5, py * 5, pz * 2.5, 4, 17);
    const b = Math.sin(lat * 10 + n * 3);
    let col = mixc([46, 76, 190], [84, 124, 232], (b + 1) / 2);
    const dl = (lat + 0.35) / 0.1, dn = angDiff(lon, 2.0) / 0.22, dd = dl * dl + dn * dn;
    if (dd < 1) col = mixc(col, [24, 34, 110], 1 - dd);
    if (n > 0.66 && Math.abs(lat + 0.55) < 0.12) col = mixc(col, [230, 236, 255], (n - 0.66) * 4);
    return col;
  },
  moon(px, py, pz) {
    const n = fbm(px * 5, py * 5, pz * 5, 5, 29);
    const c = fbm(px * 16, py * 16, pz * 16, 2, 31);
    let g = 110 + 120 * n;
    if (c > 0.6) g *= 0.75;
    return [g, g, g];
  },
};

const canvasCache = new Map();
function planetCanvas(kind, w, h) {
  const key = `${kind}:${w}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const shade = SHADERS[kind];
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      const col = shade(cl * Math.cos(lon), sl, cl * Math.sin(lon), lat, lon);
      const i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3] ?? 255;
    }
  }
  g.putImageData(img, 0, 0);
  canvasCache.set(key, c);
  return c;
}

function ringCanvas(type) {
  const key = `ring:${type}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const W = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = 2;
  const g = c.getContext('2d');
  const img = g.createImageData(W, 2);
  for (let x = 0; x < W; x++) {
    const r = x / (W - 1);
    const fine = noise3(r * 260, 0.5, 0.5, 77) * 0.55 + noise3(r * 900, 1.5, 0.5, 78) * 0.45;
    let col = [0, 0, 0], a = 0;
    if (type === 'saturn') {
      if (r < 0.12) { col = [120, 104, 86]; a = 0.12 + 0.18 * (r / 0.12); }
      else if (r < 0.5) { col = mixc([214, 196, 160], [236, 222, 190], (r - 0.12) / 0.38); a = 0.82 + 0.15 * Math.sin(r * 60); }
      else if (r < 0.57) { col = [90, 80, 70]; a = 0.06; }
      else if (r < 0.88) { col = [200, 184, 150]; a = 0.62; if (Math.abs(r - 0.83) < 0.006) a = 0.04; }
      else if (r > 0.935 && r < 0.95) { col = [220, 210, 190]; a = 0.55; }
      a *= 0.72 + 0.5 * fine;
      col = mixc(col, [150, 130, 105], (1 - fine) * 0.35);
    } else {
      const bands = [0.12, 0.26, 0.4, 0.52, 0.64, 0.9];
      for (const b of bands) {
        const wdt = b === 0.9 ? 0.03 : 0.008;
        const k = 1 - Math.min(1, Math.abs(r - b) / wdt);
        if (k > 0) { a = Math.max(a, (b === 0.9 ? 0.55 : 0.32) * k); }
      }
      col = [150, 162, 170];
      a *= 0.8 + 0.4 * fine;
    }
    a = Math.max(0, Math.min(1, a));
    for (let y = 0; y < 2; y++) {
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  canvasCache.set(key, c);
  return c;
}

function glowCanvas(kind) {
  const key = `glow:${kind}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const m = S / 2;
  if (kind === 'corona') {
    const grd = g.createRadialGradient(m, m, 0, m, m, m);
    grd.addColorStop(0.0, 'rgba(255,246,220,1)');
    grd.addColorStop(0.16, 'rgba(255,214,140,0.9)');
    grd.addColorStop(0.22, 'rgba(255,170,70,0.45)');
    grd.addColorStop(0.45, 'rgba(255,120,30,0.12)');
    grd.addColorStop(1.0, 'rgba(255,90,10,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    try { g.filter = 'blur(3px)'; } catch (_) { /* ignore */ }
    for (let i = 0; i < 90; i++) {
      const ang = (i / 90) * Math.PI * 2 + hash3(i, 1, 2, 5) * 0.2;
      const len = m * (0.3 + 0.55 * hash3(i, 3, 4, 6));
      const lg = g.createLinearGradient(m, m, m + Math.cos(ang) * len, m + Math.sin(ang) * len);
      lg.addColorStop(0, 'rgba(255,200,120,0.22)');
      lg.addColorStop(1, 'rgba(255,140,40,0)');
      g.strokeStyle = lg;
      g.lineWidth = 2 + hash3(i, 7, 7, 7) * 5;
      g.beginPath();
      g.moveTo(m, m);
      g.lineTo(m + Math.cos(ang) * len, m + Math.sin(ang) * len);
      g.stroke();
    }
  } else {
    const grd = g.createRadialGradient(m, m, 0, m, m, m);
    grd.addColorStop(0, 'rgba(255,190,110,0.55)');
    grd.addColorStop(0.3, 'rgba(255,140,60,0.16)');
    grd.addColorStop(1, 'rgba(255,100,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  canvasCache.set(key, c);
  return c;
}

/* ---------------------------------------------------------------- shaders */
const NOISE_GLSL = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function makeSunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 2.3 } },
    vertexShader: /* glsl */`
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      void main(){
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uIntensity;
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      ${NOISE_GLSL}
      void main(){
        vec3 p = normalize(vPos);
        float t = uTime;
        float n1 = snoise(p * 2.2 + vec3(0.0, t * 0.05, 0.0));
        float n2 = snoise(p * 6.0 + vec3(t * 0.12, 0.0, -t * 0.08));
        float gran = 1.0 - abs(snoise(p * 24.0 + vec3(0.0, t * 0.35, t * 0.2)));
        gran = gran * gran;
        float spots = smoothstep(0.58, 0.78, snoise(p * 1.7 + vec3(t * 0.01, 3.0, 1.0)));
        float heat = 0.55 + 0.22 * n1 + 0.14 * n2 + 0.28 * gran;
        heat *= 1.0 - 0.65 * spots;
        vec3 cool = vec3(0.85, 0.22, 0.02);
        vec3 mid = vec3(1.0, 0.55, 0.08);
        vec3 hot = vec3(1.0, 0.93, 0.65);
        vec3 col = mix(cool, mid, smoothstep(0.2, 0.62, heat));
        col = mix(col, hot, smoothstep(0.62, 1.05, heat));
        float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        float limb = 0.32 + 0.68 * pow(mu, 0.55);
        col *= limb;
        col += vec3(1.0, 0.42, 0.08) * pow(1.0 - mu, 3.0) * 0.7;
        gl_FragColor = vec4(col * uIntensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function makeAtmoMaterial(color, k = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: new THREE.Vector3() }, uK: { value: k } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uSun; uniform float uK;
      varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        vec3 L = normalize(uSun - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        float lit = smoothstep(-0.25, 0.6, dot(N, L));
        float a = fres * lit * uK;
        gl_FragColor = vec4(uColor * a * 1.6, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function makeRingMaterial(tex, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uSun: { value: new THREE.Vector3() },
      uPlanet: { value: new THREE.Vector3() },
      uPlanetR: { value: 1 },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uSun; uniform vec3 uPlanet; uniform float uPlanetR; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){
        vec4 tex = texture2D(uMap, vec2(vUv.x, 0.5));
        if (tex.a < 0.004) discard;
        vec3 L = normalize(uSun - vW);
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        float ndl = dot(N, L); float ndv = dot(N, V);
        float lit = 0.3 + 0.7 * abs(ndl);
        if (ndl * ndv < 0.0) lit *= mix(0.9, 0.22, tex.a);
        vec3 oc = vW - uPlanet;
        float b = dot(oc, L);
        float c = dot(oc, oc) - uPlanetR * uPlanetR;
        float hh = b * b - c;
        float shadow = 1.0;
        if (hh > 0.0 && b < 0.0) shadow = mix(1.0, 0.07, smoothstep(0.0, uPlanetR * uPlanetR * 0.1, hh));
        gl_FragColor = vec4(tex.rgb * lit * shadow * 1.3, tex.a * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/* --------------------------------------------------------------- helpers */
function orbitR(a, e, th) { return (a * (1 - e * e)) / (1 + e * Math.cos(th)); }

function makeOrbitLine(a, e, mat) {
  const pts = [];
  for (let i = 0; i < 256; i++) {
    const th = (i / 256) * Math.PI * 2;
    const r = orbitR(a, e, th);
    pts.push(new THREE.Vector3(Math.cos(th) * r, 0, Math.sin(th) * r));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

function makeCircle(radius, mat) {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(th) * radius, 0, Math.sin(th) * radius));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

function makeTrail(color, N) {
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 4);
  const c = new THREE.Color(color);
  for (let i = 0; i < N; i++) {
    const a = Math.pow(1 - i / N, 1.5);
    col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = a * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  return { line, pos, geo, filled: 0, N };
}
function trailPush(tr, v, shift) {
  if (shift && tr.filled > 0) {
    tr.pos.copyWithin(3, 0, (tr.N - 1) * 3);
    tr.filled = Math.min(tr.filled + 1, tr.N);
  }
  tr.pos[0] = v.x; tr.pos[1] = v.y; tr.pos[2] = v.z;
  if (tr.filled === 0) {
    tr.filled = 1;
  }
  tr.geo.setDrawRange(0, tr.filled);
  tr.geo.attributes.position.needsUpdate = true;
}

function makeStarfield(count = 2200) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 500;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
    c.setHSL(0.55 + Math.random() * 0.15 - (Math.random() < 0.3 ? 0.45 : 0), 0.4, 0.6 + Math.random() * 0.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

const CSS = `
.ss-ui{position:absolute;left:max(8px,env(safe-area-inset-left,0px));top:max(8px,env(safe-area-inset-top,0px));right:max(8px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:6px;z-index:3;pointer-events:none;font:12px/1.2 system-ui,-apple-system,sans-serif;max-width:calc(100% - 16px);width:max-content}
.ss-row{display:flex;flex-wrap:wrap;gap:3px;align-items:center;pointer-events:auto;background:rgba(8,12,24,.62);border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:3px;backdrop-filter:blur(6px);width:max-content;max-width:100%}
.ss-row button{appearance:none;border:0;background:transparent;cursor:pointer;padding:4px 8px;border-radius:6px;color:#cbd5e1;font:inherit;min-height:32px}
.ss-row button:hover{background:rgba(148,163,184,.16)}
.ss-row button.on{background:rgba(129,140,248,.38);color:#fff}
.ss-row input[type=range]{width:96px;accent-color:#818cf8}
.ss-hint{pointer-events:none;color:#94a3b8;padding:0 4px;font-size:11px}
.ss-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.ss-label{position:absolute;left:0;top:0;color:#e2e8f0;font:11px system-ui,sans-serif;text-shadow:0 1px 2px #000,0 0 4px #000;white-space:nowrap;will-change:transform}
.ss-label.moon{color:#9fb0c8;font-size:10px}
@media (max-width:860px){
  .ss-ui{left:6px;top:6px;right:6px;max-width:calc(100% - 12px);width:auto;gap:3px}
  .ss-row{width:100%;max-width:100%;padding:2px;gap:2px;border-radius:10px;background:rgba(8,12,24,.72)}
  .ss-row button{min-height:36px;min-width:36px;padding:4px 8px;font-size:12px}
  .ss-row[data-row=zoom] input[type=range]{flex:1;min-width:0;width:auto;min-height:24px}
  .ss-row[data-row=focus]{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .ss-row[data-row=focus]::-webkit-scrollbar{display:none}
  .ss-row[data-row=focus] button{flex:0 0 auto}
  .ss-hint{display:none}
  .ss-label{font-size:10px}
  .ss-label.moon{font-size:9px}
}
@media (max-width:420px){
  .ss-row[data-row=mode] button{flex:1 1 auto;text-align:center}
  .ss-hint{display:none}
}
`;

/* ------------------------------------------------------------------ mount */
export async function mountSolarSystem(outerHost, opts = {}) {
  const ctrl = opts._controls || {};
  const info = createInfoPanel(outerHost, { doc: alignDocParams(SS_DOC, PARAMS_SPEC) });
  const host = info.canvasBox;
  const live = () => readLiveControls([host, host.parentElement], ctrl);
  const styleName = String(ctrl.styleName || '');
  let mode = /螺旋|helix/i.test(styleName) ? 'helix' : 'helio';
  let showTrails = !/隐藏/.test(styleName);
  const innerOnly = /内太阳系/.test(styleName);
  const outerOnly = /外行星|气态/.test(styleName);
  const speedMult = /快进/.test(styleName) ? 2.5 : /慢速/.test(styleName) ? 0.35 : 1;

  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const L0 = live();
  const lite = preferLiteFx();
  let list;
  if (innerOnly) list = PLANETS.slice(0, 4);
  else if (outerOnly) list = PLANETS.slice(4);
  else {
    let cnt = Math.round(Number(ctrl.count ?? L0.count ?? 8));
    cnt = Math.max(1, Math.min(8, cnt || 8));
    list = PLANETS.slice(0, cnt);
  }
  const maxA = Math.max(...list.map((p) => p.a));
  const defaultDist = { helio: Math.max(9, maxA * 1.95 + 1), helix: Math.max(14, maxA * 2.5 + 2) };
  const defaultDir = {
    helio: new THREE.Vector3(0, 0.44, 0.9).normalize(),
    helix: new THREE.Vector3(0.28, 0.4, 0.87).normalize(),
  };

  /* renderer / scene */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setClearColor(0x02030a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  host.appendChild(renderer.domElement);

  const style = document.createElement('style');
  style.textContent = CSS;
  host.appendChild(style);
  const labelsEl = document.createElement('div');
  labelsEl.className = 'ss-labels';
  host.appendChild(labelsEl);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 3000);
  const sz0 = L0.size > 0 ? L0.size : 1;
  camera.position.copy(defaultDir[mode]).multiplyScalar(defaultDist[mode] * sz0);

  const controls = new OrbitControls(camera, renderer.domElement);
  tuneOrbitControls(controls, { mobile: lite });
  controls.minDistance = 1.6;
  controls.maxDistance = 160;

  const disposables = [];
  const tex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    disposables.push(t);
    return t;
  };

  scene.add(new THREE.AmbientLight(0x334466, 0.32));
  const stars = makeStarfield(lite ? 900 : 2200);
  scene.add(stars);

  const system = new THREE.Group();
  scene.add(system);

  /* sun */
  const sunGroup = new THREE.Group();
  system.add(sunGroup);
  const sunMat = makeSunMaterial();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, lite ? 48 : 96, lite ? 32 : 64), sunMat);
  sunGroup.add(sun);
  const coronaMat = new THREE.SpriteMaterial({ map: tex(glowCanvas('corona')), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.setScalar(7.2);
  sunGroup.add(corona);
  const haloMat = new THREE.SpriteMaterial({ map: tex(glowCanvas('halo')), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(18);
  sunGroup.add(halo);
  const sunLight = new THREE.PointLight(0xfff2d8, 3.0, 0, 0);
  sunGroup.add(sunLight);
  const sunPick = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  sunPick.userData.pick = 'sun';
  sunGroup.add(sunPick);

  /* orbit plane (tilts in helix mode) */
  const orbitPlane = new THREE.Group();
  system.add(orbitPlane);
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x7c8aa8, transparent: true, opacity: 0.38, depthWrite: false });
  const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0x9fb0c8, transparent: true, opacity: 0, depthWrite: false });

  const moonCanvas = planetCanvas('moon', 128, 64);
  const moonTex = tex(moonCanvas);
  const bodies = [];
  const picks = [sunPick];
  const orbitLines = [];
  const moonLines = [];

  list.forEach((p, idx) => {
    const big = ['earth', 'jupiter', 'saturn'].includes(p.tex);
    const tw = lite ? (big ? 256 : 128) : (big ? 512 : 256);
    const map = tex(planetCanvas(p.tex, tw, tw / 2));
    const mat = new THREE.MeshStandardMaterial({ map, roughness: p.tex === 'earth' ? 0.75 : 0.92, metalness: 0 });

    const ol = makeOrbitLine(p.a, p.e, orbitMat);
    orbitPlane.add(ol);
    orbitLines.push(ol);

    const anchor = new THREE.Group();
    orbitPlane.add(anchor);
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = p.tilt * DEG;
    anchor.add(tiltGroup);

    const lod = new THREE.LOD();
    const lodLevels = lite ? [[32, 0], [16, p.r * 36]] : [[64, 0], [32, p.r * 28], [16, p.r * 90]];
    lodLevels.forEach(([seg, dist]) => {
      lod.addLevel(new THREE.Mesh(new THREE.SphereGeometry(p.r, seg, Math.max(8, seg / 2)), mat), dist);
    });
    tiltGroup.add(lod);

    let clouds = null;
    if (p.clouds) {
      const cm = new THREE.MeshStandardMaterial({ map: tex(planetCanvas('clouds', lite ? 256 : 512, lite ? 128 : 256)), transparent: true, depthWrite: false, roughness: 1 });
      clouds = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.015, 48, 24), cm);
      tiltGroup.add(clouds);
    }
    let atmoMat = null;
    if (p.atmo) {
      atmoMat = makeAtmoMaterial(p.atmo, p.atmoK ?? 1);
      tiltGroup.add(new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.06, 48, 24), atmoMat));
    }
    let ringMat = null;
    if (p.ring) {
      const ri = p.r * p.ring.inner, ro = p.r * p.ring.outer;
      const rg = new THREE.RingGeometry(ri, ro, 192, 1);
      const pa = rg.attributes.position, ua = rg.attributes.uv;
      for (let i = 0; i < pa.count; i++) ua.setXY(i, (Math.hypot(pa.getX(i), pa.getY(i)) - ri) / (ro - ri), 0.5);
      const rt = tex(ringCanvas(p.ring.type));
      rt.wrapS = rt.wrapT = THREE.ClampToEdgeWrapping;
      ringMat = makeRingMaterial(rt, p.ring.opacity);
      const ring = new THREE.Mesh(rg, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 2;
      tiltGroup.add(ring);
    }

    const moons = p.moons.map((m, mi) => {
      const mr = Math.max(0.028, p.r * m.r);
      const md = p.r * m.d;
      const mmat = new THREE.MeshStandardMaterial({ map: moonTex, color: m.color, roughness: 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(mr, lite ? 12 : 24, lite ? 8 : 16), mmat);
      const holder = new THREE.Group();
      if (m.inc) holder.rotation.x = m.inc;
      holder.add(mesh);
      tiltGroup.add(holder);
      const line = makeCircle(md, moonOrbitMat);
      holder.add(line);
      moonLines.push(line);
      const lab = document.createElement('span');
      lab.className = 'ss-label moon';
      lab.textContent = nm(m.name);
      lab.style.display = 'none';
      labelsEl.appendChild(lab);
      return { mesh, d: md, w: m.w, phase: hash3(idx, mi, 3, 9) * Math.PI * 2, label: lab, name: m.name };
    });

    const pick = new THREE.Mesh(new THREE.SphereGeometry(Math.max(p.r * 1.5, 0.34), 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    pick.userData.pick = idx;
    anchor.add(pick);
    picks.push(pick);

    const label = document.createElement('span');
    label.className = 'ss-label';
    label.textContent = nm(p.name);
    labelsEl.appendChild(label);

    const trail = makeTrail(p.trail, lite ? 600 : 1400);
    scene.add(trail.line);
    trail.line.visible = false;

    bodies.push({
      p, anchor, tiltGroup, lod, clouds, atmoMat, ringMat, moons, label, trail,
      th: hash3(idx, 1, 1, 4) * Math.PI * 2,
      n: 3.5 * Math.pow(p.a, -1.5),
    });
  });

  const sunTrail = makeTrail(0xffc070, lite ? 600 : 1400);
  scene.add(sunTrail.line);
  sunTrail.line.visible = false;

  /* space dust for sense of motion in helix mode */
  const DUST = lite ? 500 : 1400, DB = 45;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST * 3; i++) dustPos[i] = (Math.random() * 2 - 1) * DB;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.07, color: 0x8899bb, transparent: true, opacity: 0.55, depthWrite: false }));
  dust.frustumCulled = false;
  dust.visible = false;
  scene.add(dust);

  /* overlay UI */
  const ui = document.createElement('div');
  ui.className = 'ss-ui';
  ui.innerHTML = `
    <div class="ss-row" data-row="mode">
      <button type="button" data-mode="helio">☉ 日心</button>
      <button type="button" data-mode="helix">🌀 螺旋前进</button>
      <button type="button" data-act="trails">轨迹</button>
    </div>
    <div class="ss-row" data-row="zoom">
      <button type="button" data-act="zoom-out" title="缩小">−</button>
      <input type="range" min="0" max="100" step="0.5" data-zoom aria-label="缩放">
      <button type="button" data-act="zoom-in" title="放大">+</button>
      <button type="button" data-act="reset">复位</button>
    </div>
    <div class="ss-row" data-row="focus">
      <button type="button" data-focus="sun" title="${nm('太阳')}">☉</button>
      ${bodies.map((b, i) => `<button type="button" data-focus="${i}" title="${nm(b.p.name)}">${EN() ? nm(b.p.name) : b.p.name.slice(0, 1)}</button>`).join('')}
    </div>
    <div class="ss-hint" data-hint>滚轮/滑条缩放 · 点击行星聚焦</div>`;
  host.appendChild(ui);
  dockControls(ui, host);
  const slider = ui.querySelector('[data-zoom]');
  const hint = ui.querySelector('[data-hint]');

  /* state */
  let focus = null; // index into bodies or null (sun)
  const anim = { dist: defaultDist[mode] * sz0, dir: null };
  let tiltCur = mode === 'helix' ? 60 * DEG : 0;
  let followReset = true;
  const prevFollow = new THREE.Vector3();
  let sampleAcc = 0;
  let sliderActive = false;
  const D_MIN = 0.4, D_MAX = 160;
  const distToSlider = (d) => (Math.log(Math.max(D_MIN, d) / D_MIN) / Math.log(D_MAX / D_MIN)) * 100;
  const sliderToDist = (s) => D_MIN * Math.pow(D_MAX / D_MIN, s / 100);

  const syncButtons = () => {
    ui.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    ui.querySelector('[data-act="trails"]').classList.toggle('on', showTrails);
    ui.querySelectorAll('[data-focus]').forEach((b) => {
      const f = b.dataset.focus === 'sun' ? null : Number(b.dataset.focus);
      b.classList.toggle('on', f === focus);
    });
    host.dataset.mode = mode;
    host.dataset.focus = focus == null ? 'sun' : bodies[focus].p.key;
    hint.textContent = focus == null
      ? (mode === 'helix' ? '螺旋前进：太阳沿轴前进，行星边转边走' : '滚轮/滑条缩放 · 点击行星聚焦')
      : EN()
        ? `Focus: ${nm(bodies[focus].p.name)} · ${bodies[focus].moons.length || 'no'} moon${bodies[focus].moons.length === 1 ? '' : 's'}`
        : `聚焦 ${bodies[focus].p.name} · ${bodies[focus].moons.length} 颗卫星`;
  };

  const resetTrails = () => {
    for (const b of bodies) { b.trail.filled = 0; b.trail.geo.setDrawRange(0, 0); }
    sunTrail.filled = 0; sunTrail.geo.setDrawRange(0, 0);
    sampleAcc = 0;
  };
  const applyVisibility = () => {
    const helix = mode === 'helix';
    orbitLines.forEach((l) => { l.visible = showTrails && !helix; });
    bodies.forEach((b) => { b.trail.line.visible = showTrails && helix; });
    sunTrail.line.visible = showTrails && helix;
    dust.visible = helix;
  };

  const setMode = (m) => {
    if (m === mode) return;
    const sz = live().size || 1;
    if (m === 'helio') {
      const shift = system.position.clone().negate();
      camera.position.add(shift);
      controls.target.add(shift);
      system.position.set(0, 0, 0);
    } else {
      resetTrails();
      const sp = new THREE.Vector3();
      sunGroup.getWorldPosition(sp);
      for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = sp.x + (Math.random() * 2 - 1) * DB;
        dustPos[i * 3 + 1] = sp.y + (Math.random() * 2 - 1) * DB;
        dustPos[i * 3 + 2] = sp.z + (Math.random() * 2 - 1) * DB;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
    mode = m;
    followReset = true;
    if (focus == null) {
      anim.dir = defaultDir[mode].clone();
      anim.dist = defaultDist[mode] * sz;
    }
    applyVisibility();
    syncButtons();
  };

  const setFocus = (f) => {
    focus = f;
    followReset = false; // smooth transition via residual lerp
    const sz = live().size || 1;
    if (f == null) {
      anim.dist = defaultDist[mode] * sz;
    } else {
      anim.dist = Math.max(bodies[f].p.r * (bodies[f].moons.length > 3 ? 9 : 6), 1.0) * sz;
    }
    anim.dir = null;
    syncButtons();
  };

  ui.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.mode) setMode(t.dataset.mode);
    else if (t.dataset.focus) setFocus(t.dataset.focus === 'sun' ? null : Number(t.dataset.focus));
    else if (t.dataset.act === 'trails') { showTrails = !showTrails; applyVisibility(); syncButtons(); }
    else if (t.dataset.act === 'zoom-in') anim.dist = Math.max(D_MIN, camera.position.distanceTo(controls.target) * 0.62);
    else if (t.dataset.act === 'zoom-out') anim.dist = Math.min(D_MAX, camera.position.distanceTo(controls.target) / 0.62);
    else if (t.dataset.act === 'reset') {
      focus = null;
      anim.dir = defaultDir[mode].clone();
      anim.dist = defaultDist[mode] * (live().size || 1);
      syncButtons();
    }
  });
  ['pointerdown', 'wheel'].forEach((ev) => ui.addEventListener(ev, (e) => e.stopPropagation()));
  slider.addEventListener('pointerdown', () => { sliderActive = true; });
  const sliderUp = () => { sliderActive = false; };
  window.addEventListener('pointerup', sliderUp);
  slider.addEventListener('input', () => { anim.dist = sliderToDist(Number(slider.value)); });

  controls.addEventListener('start', () => { anim.dist = null; anim.dir = null; });

  /* picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY = null;
  const pickAt = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    return hit ? hit.object.userData.pick : undefined;
  };
  const onDown = (e) => { downXY = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!downXY) return;
    const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    downXY = null;
    if (moved > 5) return;
    const p = pickAt(e);
    if (p === 'sun') setFocus(null);
    else if (typeof p === 'number') setFocus(p);
  };
  let moveRaf = 0;
  const onMove = (e) => {
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      renderer.domElement.style.cursor = pickAt(e) !== undefined ? 'pointer' : 'grab';
    });
  };
  const onDbl = (e) => { if (pickAt(e) === undefined) setFocus(null); };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('dblclick', onDbl);

  /* resize */
  let lastW = 0, lastH = 0;
  const resize = () => {
    const w = host.clientWidth || host.parentElement?.clientWidth || 640;
    const h = host.clientHeight || host.parentElement?.clientHeight || 420;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    camera.aspect = w / Math.max(1, h);
    camera.fov = camera.aspect < 1 ? Math.min(80, (2 * Math.atan(Math.tan(25 * DEG) / camera.aspect)) / DEG) : 50;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(maxDpr(2));
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  applyVisibility();
  syncButtons();

  /* loop */
  const tmp = new THREE.Vector3();
  const sunW = new THREE.Vector3();
  const fp = new THREE.Vector3();
  const offs = new THREE.Vector3();
  const prj = new THREE.Vector3();
  let alive = true;
  let last = performance.now();
  let simT = 0;

  const placeLabel = (el, world, radius, show) => {
    if (!show) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    prj.copy(world).project(camera);
    if (prj.z > 1 || Math.abs(prj.x) > 1.2 || Math.abs(prj.y) > 1.2) { el.style.display = 'none'; return; }
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const d = camera.position.distanceTo(world);
    const pr = (radius / Math.max(d, 1e-3)) * (h / (2 * Math.tan((camera.fov * DEG) / 2)));
    if (pr > 120) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.transform = `translate(${((prj.x * 0.5 + 0.5) * w + pr + 4).toFixed(1)}px, ${((-prj.y * 0.5 + 0.5) * h - 7).toFixed(1)}px)`;
  };

  const warmDt = [];
  const tick = (now) => {
    if (!alive) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    // one-shot adaptive render scale after a short warm-up (weak GPUs / software GL)
    if (dt > 0 && warmDt.length < 24) {
      warmDt.push(dt);
      if (warmDt.length === 24) {
        const med = [...warmDt].sort((a, b) => a - b)[12];
        if (med > 0.034) { renderer.setPixelRatio(maxDpr(2) * Math.max(0.4, 0.028 / med)); renderer.setSize(lastW, lastH, false); }
      }
    }
    const L = live();
    const sz = L.size > 0 ? L.size : 1;
    const ts = (L.speed > 0 ? L.speed : 1) * speedMult;
    const sdt = dt * ts;
    simT += sdt;

    system.scale.setScalar(sz);
    const [cr, cg, cb] = colorToRgb(L.color);
    orbitMat.color.setRGB(0.35 + cr * 0.35, 0.38 + cg * 0.35, 0.45 + cb * 0.35);

    const tiltTarget = mode === 'helix' ? 60 * DEG : 0;
    tiltCur += (tiltTarget - tiltCur) * (1 - Math.exp(-dt * 2.5));
    orbitPlane.rotation.z = tiltCur;
    if (mode === 'helix') system.position.x += 1.4 * sz * sdt;

    sunMat.uniforms.uTime.value = simT;
    sun.rotation.y += 0.05 * sdt;
    coronaMat.rotation += 0.01 * dt;
    const pulse = 1 + 0.03 * Math.sin(now * 0.0013);
    corona.scale.setScalar(7.2 * pulse);
    halo.scale.setScalar(18 * (2 - pulse));

    for (const b of bodies) {
      const { p } = b;
      b.th += b.n * Math.pow(1 + p.e * Math.cos(b.th), 2) / Math.pow(1 - p.e * p.e, 1.5) * sdt;
      const r = orbitR(p.a, p.e, b.th);
      b.anchor.position.set(Math.cos(b.th) * r, 0, Math.sin(b.th) * r);
      b.lod.rotation.y += p.spin * sdt;
      if (b.clouds) b.clouds.rotation.y += p.spin * 1.12 * sdt;
      for (const m of b.moons) {
        m.phase += m.w * sdt;
        m.mesh.position.set(Math.cos(m.phase) * m.d, 0, Math.sin(m.phase) * m.d);
        m.mesh.rotation.y = -m.phase;
      }
    }

    scene.updateMatrixWorld();
    sunGroup.getWorldPosition(sunW);
    for (const b of bodies) {
      if (b.atmoMat) b.atmoMat.uniforms.uSun.value.copy(sunW);
      if (b.ringMat) {
        b.ringMat.uniforms.uSun.value.copy(sunW);
        b.anchor.getWorldPosition(b.ringMat.uniforms.uPlanet.value);
        b.ringMat.uniforms.uPlanetR.value = b.p.r * sz;
      }
    }

    /* follow focus / sun */
    if (focus != null) bodies[focus].anchor.getWorldPosition(fp); else fp.copy(sunW);
    if (followReset) { prevFollow.copy(fp); followReset = false; }
    offs.subVectors(fp, prevFollow);
    camera.position.add(offs);
    controls.target.add(offs);
    prevFollow.copy(fp);
    tmp.copy(controls.target);
    controls.target.lerp(fp, 1 - Math.exp(-dt * 5));
    camera.position.add(tmp.sub(controls.target).negate());

    const focusR = focus != null ? bodies[focus].p.r * sz : 1 * sz;
    controls.minDistance = Math.max(0.12, focusR * 1.35);

    /* smooth zoom / direction */
    offs.subVectors(camera.position, controls.target);
    let dist = offs.length();
    if (anim.dir) {
      const cur = offs.clone().normalize();
      cur.lerp(anim.dir, 1 - Math.exp(-dt * 3)).normalize();
      if (cur.angleTo(anim.dir) < 0.002) anim.dir = null;
      offs.copy(cur).multiplyScalar(dist);
    }
    if (anim.dist != null) {
      const goal = Math.max(controls.minDistance, Math.min(D_MAX, anim.dist));
      dist += (goal - dist) * (1 - Math.exp(-dt * 4.5));
      if (Math.abs(goal - dist) < goal * 0.002) anim.dist = null;
      offs.setLength(dist);
    }
    camera.position.copy(controls.target).add(offs);
    controls.update();
    if (!sliderActive) slider.value = String(distToSlider(camera.position.distanceTo(controls.target)));

    /* helix trails + dust */
    if (mode === 'helix') {
      sampleAcc += sdt;
      const shift = sampleAcc >= 0.04;
      if (shift) sampleAcc = 0;
      for (const b of bodies) { b.anchor.getWorldPosition(tmp); trailPush(b.trail, tmp, shift); }
      trailPush(sunTrail, sunW, shift);
      const db = DB * sz;
      for (let i = 0; i < DUST; i++) {
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          const c = k === 0 ? sunW.x : k === 1 ? sunW.y : sunW.z;
          if (dustPos[j] < c - db) dustPos[j] += db * 2;
          else if (dustPos[j] > c + db) dustPos[j] -= db * 2;
        }
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    stars.position.copy(camera.position);

    /* zoom-dependent detail: moon orbits, labels */
    for (const b of bodies) {
      b.anchor.getWorldPosition(tmp);
      const cd = camera.position.distanceTo(tmp);
      const near = cd < b.p.r * sz * 40;
      placeLabel(b.label, tmp, b.p.r * sz, !lite || focus == null || bodies[focus] === b || cd < b.p.r * sz * 55);
      const showMoonLabels = focus != null && bodies[focus] === b && cd < b.p.r * sz * 30;
      for (const m of b.moons) {
        if (showMoonLabels) { m.mesh.getWorldPosition(prj); const wp = prj.clone(); placeLabel(m.label, wp, m.mesh.geometry.parameters.radius * sz, true); }
        else placeLabel(m.label, tmp, 0, false);
      }
      b.nearAlpha = near ? Math.max(0, Math.min(0.45, 0.45 * (1 - cd / (b.p.r * sz * 40)) * 1.6)) : 0;
    }
    const maxNear = Math.max(0, ...bodies.map((b) => b.nearAlpha || 0));
    moonOrbitMat.opacity = showTrails ? Math.max(0.06, maxNear) : 0;
    moonLines.forEach((l) => { l.visible = showTrails; });

    renderer.render(scene, camera);
    const fb = focus != null ? bodies[focus] : null;
    const iv = { mode, n: bodies.length, years: (simT * EARTH_N) / (2 * Math.PI), focus: fb ? nm(fb.p.name) : null };
    if (fb) {
      const T = (2 * Math.PI) / fb.n;
      Object.assign(iv, { a: fb.p.a, e: fb.p.e, r: orbitR(fb.p.a, fb.p.e, fb.th), T, Ty: (T * EARTH_N) / (2 * Math.PI), k: (T * T) / fb.p.a ** 3 });
    }
    offs.subVectors(camera.position, controls.target);
    const az = Math.atan2(offs.x, offs.z), pol = Math.acos(Math.max(-1, Math.min(1, offs.y / Math.max(1e-6, offs.length()))));
    info.update(iv, {
      ix: `${az.toFixed(2)},${pol.toFixed(2)},${offs.length().toFixed(1)}|${focus}|${mode}`,
      handle: `${Math.round(lastW / 2)},${Math.round(lastH * 0.62)}`,
      ctl: [['视角 方位/俯仰', `${fmt(az / DEG, 0)}° / ${fmt(pol / DEG, 0)}°`], ['相机距离', fmt(offs.length(), 1)]],
    });
  };
  requestAnimationFrame(tick);

  return () => {
    alive = false;
    if (moveRaf) cancelAnimationFrame(moveRaf);
    ro.disconnect();
    window.removeEventListener('pointerup', sliderUp);
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.removeEventListener('pointerup', onUp);
    renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('dblclick', onDbl);
    controls.dispose();
    const seen = new Set();
    scene.traverse((obj) => {
      if (obj.geometry && !seen.has(obj.geometry)) { seen.add(obj.geometry); obj.geometry.dispose(); }
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) if (!seen.has(m)) { seen.add(m); m.dispose(); }
    });
    disposables.forEach((t) => t.dispose());
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (_) { /* ignore */ }
    host.innerHTML = '';
    info.destroy();
    outerHost.innerHTML = '';
  };
}
