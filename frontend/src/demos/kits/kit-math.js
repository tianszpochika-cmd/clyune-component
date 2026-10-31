import { makeCanvas, loop, bar, hsl, rand, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

/** Junior-high+ math visualization kit — each family is a distinct interactive demo. */
const FAMILIES = [
  // 几何
  'pythagoras', 'similar-tri', 'circle-angles', 'area-volume', 'coord-geo', 'conics',
  // 函数
  'linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'parametric', 'polar',
  // 三角
  'unit-circle', 'trig-id', 'law-sine',
  // 极限与微积分
  'limit', 'derivative', 'integral', 'taylor',
  // 线性代数
  'vectors', 'matrix-2d', 'determinant', 'eigen',
  // 离散
  'venn', 'combinatorics', 'sequence', 'shortest-path', 'modular',
  // 概率统计
  'binomial', 'normal', 'clt',
];

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'pythagoras').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'pythagoras';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-math',
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
  const id = opts.variant || 'pythagoras';
  const family = resolveFamily(id);
  const { stage } = bar(host, id, '');
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);

  const stop = loop((dt, t) => {
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

/* ── helpers ─────────────────────────────────────────── */
const TAU = Math.PI * 2;
function hexRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#818cf8');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [129, 140, 248];
}
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function title(ctx, text, x, y, color = '#e2e8f0') {
  ctx.fillStyle = color; ctx.font = '600 13px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}
function caption(ctx, text, x, y) {
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px ui-sans-serif,system-ui'; ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}
function axes(ctx, ox, oy, W, H, color = '#334155') {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(ox - W, oy); ctx.lineTo(ox + W, oy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, oy - H); ctx.lineTo(ox, oy + H); ctx.stroke();
}
function plotFn(ctx, ox, oy, sx, sy, xmin, xmax, fn, color, lw = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const x = xmin + (xmax - xmin) * (i / steps);
    const y = fn(x);
    if (!Number.isFinite(y)) { ctx.stroke(); ctx.beginPath(); continue; }
    const px = ox + x * sx, py = oy - y * sy;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
function fillPoly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function arrow(ctx, x0, y0, x1, y1, color, lw = 2) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
  ctx.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
}
function labelAt(ctx, text, x, y, color = '#cbd5e1') {
  ctx.fillStyle = color; ctx.font = '12px ui-sans-serif,system-ui'; ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function drawFamily(ctx, family, w, h, tint, tt, sz, n, L) {
  switch (family) {
    case 'pythagoras': return drawPythagoras(ctx, w, h, tint, tt, sz);
    case 'similar-tri': return drawSimilar(ctx, w, h, tint, tt, sz);
    case 'circle-angles': return drawCircleAngles(ctx, w, h, tint, tt, sz);
    case 'area-volume': return drawAreaVolume(ctx, w, h, tint, tt, sz, n);
    case 'coord-geo': return drawCoordGeo(ctx, w, h, tint, tt, sz);
    case 'conics': return drawConics(ctx, w, h, tint, tt, sz, n);
    case 'linear': return drawLinear(ctx, w, h, tint, tt, sz);
    case 'quadratic': return drawQuadratic(ctx, w, h, tint, tt, sz);
    case 'exp-log': return drawExpLog(ctx, w, h, tint, tt, sz);
    case 'power': return drawPower(ctx, w, h, tint, tt, sz, n);
    case 'piecewise': return drawPiecewise(ctx, w, h, tint, tt, sz);
    case 'parametric': return drawParametric(ctx, w, h, tint, tt, sz);
    case 'polar': return drawPolar(ctx, w, h, tint, tt, sz, n);
    case 'unit-circle': return drawUnitCircle2d(ctx, w, h, tint, tt, sz);
    case 'trig-id': return drawTrigId(ctx, w, h, tint, tt, sz);
    case 'law-sine': return drawLawSine(ctx, w, h, tint, tt, sz);
    case 'limit': return drawLimit(ctx, w, h, tint, tt, sz, n);
    case 'derivative': return drawDerivative(ctx, w, h, tint, tt, sz);
    case 'integral': return drawIntegral(ctx, w, h, tint, tt, sz, n);
    case 'taylor': return drawTaylor(ctx, w, h, tint, tt, sz, n);
    case 'vectors': return drawVectors(ctx, w, h, tint, tt, sz);
    case 'matrix-2d': return drawMatrix2d(ctx, w, h, tint, tt, sz);
    case 'determinant': return drawDeterminant(ctx, w, h, tint, tt, sz);
    case 'eigen': return drawEigen(ctx, w, h, tint, tt, sz);
    case 'venn': return drawVenn(ctx, w, h, tint, tt, sz);
    case 'combinatorics': return drawCombinatorics(ctx, w, h, tint, tt, sz, n);
    case 'sequence': return drawSequence(ctx, w, h, tint, tt, sz, n);
    case 'shortest-path': return drawShortest(ctx, w, h, tint, tt, sz, n);
    case 'modular': return drawModular(ctx, w, h, tint, tt, sz, n);
    case 'binomial': return drawBinomial(ctx, w, h, tint, tt, sz, n);
    case 'normal': return drawNormal(ctx, w, h, tint, tt, sz);
    case 'clt': return drawCLT(ctx, w, h, tint, tt, sz, n);
    default: return drawPythagoras(ctx, w, h, tint, tt, sz);
  }
}

/* ── 几何 ────────────────────────────────────────────── */
function drawPythagoras(ctx, w, h, tint, tt, sz) {
  title(ctx, '勾股定理  a² + b² = c²', 16, 22);
  const a = 70 + 40 * sz, b = 50 + 35 * sz;
  const c = Math.hypot(a, b);
  const ox = w * 0.28, oy = h * 0.72;
  // right triangle
  fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox, oy - b]], rgba(tint, 0.15), tint);
  // squares on sides
  const pulse = 0.5 + 0.5 * Math.sin(tt * 1.2);
  // a² bottom
  fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox + a, oy + a], [ox, oy + a]], rgba('#22d3ee', 0.18 + 0.1 * pulse), '#22d3ee');
  labelAt(ctx, `a²=${(a * a / 100).toFixed(0)}`, ox + a / 2, oy + a / 2 + 4, '#67e8f9');
  // b² left
  fillPoly(ctx, [[ox, oy], [ox, oy - b], [ox - b, oy - b], [ox - b, oy]], rgba('#f472b6', 0.18 + 0.1 * pulse), '#f472b6');
  labelAt(ctx, `b²=${(b * b / 100).toFixed(0)}`, ox - b / 2, oy - b / 2 + 4, '#f9a8d4');
  // c² on hypotenuse — rotate
  const ang = Math.atan2(-b, a);
  ctx.save();
  ctx.translate(ox + a, oy);
  ctx.rotate(ang);
  fillPoly(ctx, [[0, 0], [-c, 0], [-c, -c], [0, -c]], rgba('#fbbf24', 0.2 + 0.12 * pulse), '#fbbf24');
  labelAt(ctx, `c²=${(c * c / 100).toFixed(0)}`, -c / 2, -c / 2 + 4, '#fde68a');
  ctx.restore();
  caption(ctx, `a=${(a/10).toFixed(1)}  b=${(b/10).toFixed(1)}  c=${(c/10).toFixed(1)} · 尺寸改变直角边`, 16, h - 16);
}

function drawSimilar(ctx, w, h, tint, tt, sz) {
  title(ctx, '相似三角形  ∠相等 ⇒ 对应边成比例', 16, 22);
  const A = [w * 0.18, h * 0.7], B = [w * 0.48, h * 0.7], C = [w * 0.28, h * 0.28];
  // big
  fillPoly(ctx, [A, B, C], rgba(tint, 0.12), tint);
  // small similar via intercept
  const t = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(tt));
  const P = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  const Q = [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t];
  fillPoly(ctx, [P, Q, C], rgba('#f472b6', 0.25), '#f472b6');
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#94a3b8'; ctx.beginPath();
  ctx.moveTo(P[0], P[1]); ctx.lineTo(Q[0], Q[1]); ctx.stroke(); ctx.setLineDash([]);
  caption(ctx, `小 △ / 大 △ 相似比 ≈ ${t.toFixed(2)} · 对应边平行截线`, 16, h - 16);
  labelAt(ctx, '△ABC', (A[0] + B[0]) / 2, h * 0.76, '#94a3b8');
  labelAt(ctx, '△PQC', (P[0] + Q[0]) / 2, (P[1] + C[1]) / 2, '#f9a8d4');
}

function drawCircleAngles(ctx, w, h, tint, tt, sz) {
  title(ctx, '圆心角与圆周角  ∠圆心 = 2·∠圆周', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * 0.28 * (0.85 + 0.15 * sz);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const a0 = tt * 0.4, span = 0.9 + 0.5 * Math.sin(tt * 0.7);
  const A = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
  const B = [cx + R * Math.cos(a0 + span), cy + R * Math.sin(a0 + span)];
  // circumference point opposite
  const mid = a0 + span / 2 + Math.PI;
  const P = [cx + R * Math.cos(mid), cy + R * Math.sin(mid)];
  // radii
  ctx.strokeStyle = tint; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.fillStyle = rgba(tint, 0.2);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.35, a0, a0 + span); ctx.closePath(); ctx.fill();
  // inscribed
  ctx.strokeStyle = '#f472b6'; ctx.beginPath();
  ctx.moveTo(P[0], P[1]); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(P[0], P[1]); ctx.stroke();
  [[A, '#22d3ee'], [B, '#22d3ee'], [P, '#f472b6'], [[cx, cy], '#fbbf24']].forEach(([p, c]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, TAU); ctx.fill();
  });
  const degC = (span * 180 / Math.PI).toFixed(0);
  const degI = (span * 90 / Math.PI).toFixed(0);
  caption(ctx, `圆心角 ${degC}°  ·  圆周角 ${degI}°  （始终二倍）`, 16, h - 16);
}

function drawAreaVolume(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '棱锥与球 · 体积关系', 16, 22);
  const r = 40 + 20 * sz;
  // sphere left
  const sx = w * 0.28, sy = h * 0.5;
  const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
  g.addColorStop(0, rgba(tint, 0.55)); g.addColorStop(1, rgba(tint, 0.08));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = tint; ctx.stroke();
  // equator ellipse
  ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.28, 0, 0, TAU); ctx.strokeStyle = rgba(tint, 0.5); ctx.stroke();
  labelAt(ctx, `球 V=⁴⁄₃πr³`, sx, sy + r + 18, '#94a3b8');
  // pyramid right
  const px = w * 0.68, base = 50 + 25 * sz, height = 90 + 30 * sz;
  const apex = [px, sy - height * 0.55];
  const b1 = [px - base, sy + height * 0.35], b2 = [px + base * 0.6, sy + height * 0.35];
  const b3 = [px + base * 0.2, sy + height * 0.55], b4 = [px - base * 0.7, sy + height * 0.2];
  fillPoly(ctx, [apex, b1, b2], rgba('#f472b6', 0.2), '#f472b6');
  fillPoly(ctx, [apex, b2, b3], rgba('#fbbf24', 0.15), '#fbbf24');
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#64748b';
  ctx.beginPath(); ctx.moveTo(apex[0], apex[1]); ctx.lineTo(b4[0], b4[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
  ctx.setLineDash([]);
  labelAt(ctx, `棱锥 V=⅓Sh`, px, sy + height * 0.55 + 18, '#94a3b8');
  const layers = Math.min(12, 3 + n);
  for (let i = 1; i < layers; i++) {
    const u = i / layers;
    const y = apex[1] + (sy + height * 0.35 - apex[1]) * u;
    const s = u;
    ctx.strokeStyle = rgba('#22d3ee', 0.25 + 0.4 * Math.sin(tt * 2 + i));
    ctx.strokeRect(px - base * s, y, base * 1.4 * s, 3);
  }
  caption(ctx, `count 控制棱锥分层数 · 尺寸改变半径/底边`, 16, h - 16);
}

function drawCoordGeo(ctx, w, h, tint, tt, sz) {
  title(ctx, '坐标几何 · 距离 / 中点 / 斜率', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 28 * sz;
  axes(ctx, ox, oy, w * 0.4, h * 0.35);
  const ax = -3 + Math.sin(tt * 0.5), ay = 2 + Math.cos(tt * 0.4);
  const bx = 4, by = -1.5;
  const A = [ox + ax * s, oy - ay * s], B = [ox + bx * s, oy - by * s];
  const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  arrow(ctx, A[0], A[1], B[0], B[1], tint, 2.5);
  ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(A[0], A[1], 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(B[0], B[1], 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(M[0], M[1], 4, 0, TAU); ctx.fill();
  // right triangle for distance
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#64748b';
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  ctx.setLineDash([]);
  const dist = Math.hypot(bx - ax, by - ay);
  const slope = (by - ay) / (bx - ax);
  caption(ctx, `A(${ax.toFixed(1)},${ay.toFixed(1)})  B(${bx.toFixed(1)},${by.toFixed(1)})  |AB|=${dist.toFixed(2)}  k=${slope.toFixed(2)}`, 16, h - 16);
}

function drawConics(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '圆锥曲线 · 椭圆 / 双曲线 / 抛物线', 16, 22);
  const ox = w * 0.5, oy = h * 0.52, s = 22 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.38);
  const mode = n % 3; // 0 ellipse 1 hyperbola 2 parabola — via count
  if (mode === 0) {
    // ellipse x²/a² + y²/b² = 1
    const a = 4 + Math.sin(tt) * 0.4, b = 2.4;
    ctx.strokeStyle = tint; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const th = (i / 180) * TAU;
      const x = ox + a * Math.cos(th) * s, y = oy - b * Math.sin(th) * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // foci
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(ox - c * s, oy, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + c * s, oy, 4, 0, TAU); ctx.fill();
    caption(ctx, `椭圆  x²/a² + y²/b² = 1 · 焦点 F₁ F₂`, 16, h - 16);
  } else if (mode === 1) {
    ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const x = 1.2 + i * 0.08;
        const y = Math.sqrt(Math.max(0, x * x - 1)) * (i % 2 === 0 ? 1 : 1);
        // draw both branches upper/lower separately below
      }
    }
    // proper hyperbola
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        let first = true;
        for (let i = 0; i <= 60; i++) {
          const x = 1.05 + i * 0.1;
          const y = Math.sqrt(Math.max(0, x * x - 1));
          const px = ox + sx * x * s, py = oy - sy * y * s;
          if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    caption(ctx, `双曲线  x² − y² = 1 · count 切换曲线类型`, 16, h - 16);
  } else {
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = -4 + i * 0.08;
      const y = 0.25 * x * x - 1;
      const px = ox + x * s, py = oy - y * s;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    // focus
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox, oy - (1) * s, 4, 0, TAU); ctx.fill();
    caption(ctx, `抛物线  y = ¼x² · count÷3 切换椭圆/双曲线/抛物线`, 16, h - 16);
  }
}

/* ── 函数 ────────────────────────────────────────────── */
function drawLinear(ctx, w, h, tint, tt, sz) {
  title(ctx, '一次函数  y = kx + b', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 28 * sz;
  axes(ctx, ox, oy, w * 0.4, h * 0.38);
  const k = 0.6 + Math.sin(tt * 0.5) * 0.8;
  const b = Math.cos(tt * 0.35) * 1.2;
  plotFn(ctx, ox, oy, s, s, -6, 6, (x) => k * x + b, tint, 2.5);
  // intercepts
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox, oy - b * s, 4, 0, TAU); ctx.fill();
  caption(ctx, `k = ${k.toFixed(2)}  b = ${b.toFixed(2)}  （速度驱动斜率与截距缓慢变化）`, 16, h - 16);
}

function drawQuadratic(ctx, w, h, tint, tt, sz) {
  title(ctx, '二次函数  y = ax² + bx + c', 16, 22);
  const ox = w * 0.5, oy = h * 0.6, s = 26 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.42);
  const a = 0.35 + 0.15 * Math.sin(tt * 0.4);
  const b = Math.sin(tt * 0.25) * 0.8;
  const c = -1 + 0.5 * Math.cos(tt * 0.3);
  plotFn(ctx, ox, oy, s, s, -5, 5, (x) => a * x * x + b * x + c, tint, 2.5);
  // vertex
  const vx = -b / (2 * a), vy = a * vx * vx + b * vx + c;
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(ox + vx * s, oy - vy * s, 5, 0, TAU); ctx.fill();
  labelAt(ctx, '顶点', ox + vx * s, oy - vy * s - 12, '#f9a8d4');
  // discriminant roots
  const disc = b * b - 4 * a * c;
  caption(ctx, `a=${a.toFixed(2)} b=${b.toFixed(2)} c=${c.toFixed(2)}  Δ=${disc.toFixed(2)} ${disc >= 0 ? '两实根' : '无实根'}`, 16, h - 16);
}

function drawExpLog(ctx, w, h, tint, tt, sz) {
  title(ctx, '指数与对数  y=aˣ  ·  y=logₐx', 16, 22);
  const ox = w * 0.35, oy = h * 0.65, s = 36 * sz;
  axes(ctx, ox, oy, w * 0.55, h * 0.45);
  const base = 1.5 + 0.8 * (0.5 + 0.5 * Math.sin(tt * 0.3));
  plotFn(ctx, ox, oy, s, s * 0.55, -2, 3.2, (x) => Math.pow(base, x), tint, 2.2);
  plotFn(ctx, ox, oy, s, s * 0.55, 0.08, 5, (x) => Math.log(x) / Math.log(base), '#f472b6', 2.2);
  // y=x mirror hint
  ctx.setLineDash([4, 4]); ctx.strokeStyle = '#475569'; ctx.beginPath();
  ctx.moveTo(ox - 2 * s, oy + 2 * s); ctx.lineTo(ox + 4 * s, oy - 4 * s); ctx.stroke(); ctx.setLineDash([]);
  caption(ctx, `底 a=${base.toFixed(2)} · 青=指数 粉=对数 · 虚线 y=x 互为反函数`, 16, h - 16);
}

function drawPower(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '幂函数  y = xⁿ', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 40 * sz;
  axes(ctx, ox, oy, w * 0.4, h * 0.4);
  const exps = [1, 2, 3, 0.5, -1];
  const colors = [tint, '#f472b6', '#22d3ee', '#fbbf24', '#a78bfa'];
  const showN = Math.min(exps.length, Math.max(1, n % 6 || 5));
  for (let i = 0; i < showN; i++) {
    const p = exps[i];
    plotFn(ctx, ox, oy, s, s, p < 0 ? 0.2 : -2.2, 2.2, (x) => {
      if (p === 0.5 && x < 0) return NaN;
      if (p < 0 && Math.abs(x) < 0.15) return NaN;
      return Math.sign(x) * Math.pow(Math.abs(x), p);
    }, colors[i], 2);
  }
  caption(ctx, `显示前 ${showN} 条：n=1,2,3,½,−1 · count 控制条数`, 16, h - 16);
}

function drawPiecewise(ctx, w, h, tint, tt, sz) {
  title(ctx, '分段函数', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 32 * sz;
  axes(ctx, ox, oy, w * 0.4, h * 0.4);
  // y = { -x-1 x<-1; x² -1≤x≤1; 2-x/2 x>1 }
  plotFn(ctx, ox, oy, s, s, -4, -1, (x) => -x - 1, '#f472b6', 2.5);
  plotFn(ctx, ox, oy, s, s, -1, 1, (x) => x * x, tint, 2.5);
  plotFn(ctx, ox, oy, s, s, 1, 4, (x) => 2 - x / 2, '#22d3ee', 2.5);
  // open/closed dots
  const pts = [[-1, 0, '#f472b6'], [-1, 1, tint], [1, 1, tint], [1, 1.5, '#22d3ee']];
  // marker at junctions
  [[-1, 1, tint, true], [1, 1, tint, true]].forEach(([x, y, c]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ox + x * s, oy - y * s, 4, 0, TAU); ctx.fill();
  });
  const cursor = -3 + ((tt * 0.6) % 6);
  let yv;
  if (cursor < -1) yv = -cursor - 1;
  else if (cursor <= 1) yv = cursor * cursor;
  else yv = 2 - cursor / 2;
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox + cursor * s, oy - yv * s, 5, 0, TAU); ctx.fill();
  caption(ctx, `粉: x<-1  紫: −1≤x≤1  青: x>1 · 黄点沿分段曲线移动`, 16, h - 16);
}

function drawParametric(ctx, w, h, tint, tt, sz) {
  title(ctx, '参数方程  x=cos t · y=sin 2t  （李萨如）', 16, 22);
  const ox = w * 0.5, oy = h * 0.52, s = 70 * sz;
  axes(ctx, ox, oy, w * 0.4, h * 0.38);
  const a = 1, b = 2 + (Math.floor(tt) % 3);
  ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.beginPath();
  const T = tt * 1.5;
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * Math.min(T, TAU * 2);
    const x = ox + a * Math.cos(t) * s;
    const y = oy - Math.sin(b * t) * s * 0.7;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  const t = Math.min(T, TAU * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(ox + a * Math.cos(t) * s, oy - Math.sin(b * t) * s * 0.7, 5, 0, TAU); ctx.fill();
  caption(ctx, `x=cos t, y=sin(${b}t) · 速度控制绘制进度`, 16, h - 16);
}

function drawPolar(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '极坐标  r = a·cos(kθ)  玫瑰线', 16, 22);
  const ox = w * 0.5, oy = h * 0.52;
  // polar grid
  ctx.strokeStyle = '#1e293b';
  for (let r = 30; r <= 140 * sz; r += 30) {
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 150 * sz, oy + Math.sin(a) * 150 * sz); ctx.stroke();
  }
  const k = Math.max(2, (n % 7) || 3);
  const a = 90 * sz;
  ctx.strokeStyle = tint; ctx.lineWidth = 2.2; ctx.beginPath();
  const maxTh = Math.min(tt * 1.2, TAU * (k % 2 === 0 ? 2 : 1));
  for (let i = 0; i <= 500; i++) {
    const th = (i / 500) * maxTh;
    const r = a * Math.cos(k * th);
    const x = ox + r * Math.cos(th), y = oy + r * Math.sin(th);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  caption(ctx, `r = cos(${k}θ) · count 改变花瓣数 k`, 16, h - 16);
}

/* ── 三角 ────────────────────────────────────────────── */
function drawUnitCircle2d(ctx, w, h, tint, tt, sz) {
  title(ctx, '单位圆与正弦/余弦波（2D）', 16, 22);
  const R = Math.min(70, w * 0.12) * sz;
  const cx = 16 + R + 20, cy = h * 0.5;
  const th = tt * 0.9;
  const c = Math.cos(th), s = Math.sin(th);
  // circle
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  axes(ctx, cx, cy, R + 10, R + 10, '#334155');
  // radius + point
  const px = cx + c * R, py = cy - s * R;
  ctx.strokeStyle = tint; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
  // projections
  ctx.strokeStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
  // waves to the right
  const x0 = cx + R + 36, waveW = w - x0 - 20, amp = R;
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + waveW, cy); ctx.stroke();
  // sin wave
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    const ang = th - (1 - u) * TAU;
    const x = x0 + u * waveW, y = cy - Math.sin(ang) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // cos wave
  ctx.strokeStyle = '#f472b6'; ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    const ang = th - (1 - u) * TAU;
    const x = x0 + u * waveW, y = cy - Math.cos(ang) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // connectors
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x0 + waveW, cy - s * amp); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(x0 + waveW, cy - c * amp); ctx.stroke();
  ctx.setLineDash([]);
  caption(ctx, `θ=${(th % TAU * 180 / Math.PI).toFixed(0)}°  sin=${s.toFixed(3)}  cos=${c.toFixed(3)}`, 16, h - 16);
}

function drawTrigId(ctx, w, h, tint, tt, sz) {
  title(ctx, '三角恒等 · sin²θ + cos²θ = 1', 16, 22);
  const ox = w * 0.3, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.25, h * 0.35);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, Math.sin, '#22d3ee', 2);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, Math.cos, '#f472b6', 2);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, (x) => Math.sin(x) ** 2 + Math.cos(x) ** 2, '#fbbf24', 2.5);
  // unit circle proof side
  const cx = w * 0.72, cy = h * 0.5, R = 70 * sz;
  ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const th = tt * 0.8;
  const px = cx + Math.cos(th) * R, py = cy - Math.sin(th) * R;
  fillPoly(ctx, [[cx, cy], [px, cy], [px, py]], rgba('#22d3ee', 0.2), '#22d3ee');
  ctx.strokeStyle = tint; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  caption(ctx, `黄线恒为 1 · 右侧直角三角形斜边=半径`, 16, h - 16);
}

function drawLawSine(ctx, w, h, tint, tt, sz) {
  title(ctx, '正弦定理  a/sin A = b/sin B = c/sin C = 2R', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * 0.28 * sz;
  ctx.strokeStyle = '#334155'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const a0 = tt * 0.25, a1 = a0 + 1.8 + 0.3 * Math.sin(tt), a2 = a0 + 3.5 + 0.2 * Math.cos(tt * 0.7);
  const pts = [a0, a1, a2].map((a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  fillPoly(ctx, pts, rgba(tint, 0.15), tint);
  pts.forEach((p, i) => {
    ctx.fillStyle = ['#22d3ee', '#f472b6', '#fbbf24'][i];
    ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, TAU); ctx.fill();
  });
  // side lengths
  const side = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  const sides = [side(1, 2), side(0, 2), side(0, 1)];
  caption(ctx, `外接圆半径 R · a=${sides[0].toFixed(0)} b=${sides[1].toFixed(0)} c=${sides[2].toFixed(0)} · a/sinA=2R`, 16, h - 16);
}

/* ── 微积分 ──────────────────────────────────────────── */
function drawLimit(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '极限逼近  limₓ→₀ (sin x)/x = 1', 16, 22);
  const ox = w * 0.5, oy = h * 0.6, s = 55 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.4);
  plotFn(ctx, ox, oy, s, s, -4, 4, (x) => Math.abs(x) < 0.05 ? 1 : Math.sin(x) / x, tint, 2.5);
  // approaching points
  const steps = Math.min(20, 4 + n);
  const tphase = (tt * 0.4) % 1;
  for (let i = 1; i <= steps; i++) {
    const x = (1.5 * i) / steps * (1 - tphase * 0.85) * (i % 2 ? 1 : -1);
    const y = Math.sin(x) / x;
    ctx.fillStyle = rgba('#fbbf24', 0.4 + 0.6 * (1 - Math.abs(x) / 2));
    ctx.beginPath(); ctx.arc(ox + x * s, oy - y * s, 4, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#f472b6'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(ox - 4 * s, oy - s); ctx.lineTo(ox + 4 * s, oy - s); ctx.stroke();
  ctx.setLineDash([]);
  caption(ctx, `黄点从两侧逼近 x=0 · 粉虚线 y=1 · count 加密取样`, 16, h - 16);
}

function drawDerivative(ctx, w, h, tint, tt, sz) {
  title(ctx, '导数 = 切线斜率  f(x)=sin x', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 40 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.4);
  plotFn(ctx, ox, oy, s, s, -4, 4, Math.sin, tint, 2);
  const x0 = Math.sin(tt * 0.5) * 2.8;
  const y0 = Math.sin(x0), m = Math.cos(x0);
  // tangent
  ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox + (x0 - 1.5) * s, oy - (y0 - 1.5 * m) * s);
  ctx.lineTo(ox + (x0 + 1.5) * s, oy - (y0 + 1.5 * m) * s);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox + x0 * s, oy - y0 * s, 5, 0, TAU); ctx.fill();
  // secant animation
  const hstep = 1.2 * (0.15 + 0.85 * Math.abs(Math.sin(tt)));
  const msec = (Math.sin(x0 + hstep) - y0) / hstep;
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(ox + x0 * s, oy - y0 * s);
  ctx.lineTo(ox + (x0 + hstep) * s, oy - Math.sin(x0 + hstep) * s);
  ctx.stroke(); ctx.setLineDash([]);
  caption(ctx, `x=${x0.toFixed(2)}  f'=cos x=${m.toFixed(2)}  割线斜率→${msec.toFixed(2)}`, 16, h - 16);
}

function drawIntegral(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '积分 = 曲边面积  ∫sin x dx', 16, 22);
  const ox = w * 0.15, oy = h * 0.6, s = 45 * sz, sx = 50 * sz;
  axes(ctx, ox, oy, w * 0.75, h * 0.4);
  plotFn(ctx, ox, oy, sx, s, 0, Math.PI, Math.sin, tint, 2);
  const N = Math.min(40, Math.max(4, n));
  const a = 0, b = Math.PI;
  const dx = (b - a) / N;
  let area = 0;
  for (let i = 0; i < N; i++) {
    const x = a + i * dx;
    const y = Math.sin(x + dx / 2);
    area += y * dx;
    const pulse = 0.35 + 0.25 * Math.sin(tt * 2 + i * 0.3);
    ctx.fillStyle = rgba('#22d3ee', pulse);
    ctx.fillRect(ox + x * sx, oy - Math.max(0, y) * s, dx * sx - 1, Math.abs(y) * s);
  }
  caption(ctx, `黎曼和 N=${N}  面积≈${area.toFixed(3)}  （真值 2）· count=矩形数`, 16, h - 16);
}

function drawTaylor(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '泰勒展开  sin x ≈ Σ (−1)ⁿ x²ⁿ⁺¹ / (2n+1)!', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 35 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.4);
  plotFn(ctx, ox, oy, s, s, -6, 6, Math.sin, '#64748b', 1.5);
  const terms = Math.min(8, Math.max(1, n % 9 || 4));
  const fact = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
  const taylor = (x) => {
    let sum = 0;
    for (let k = 0; k < terms; k++) {
      const p = 2 * k + 1;
      sum += ((k % 2 === 0) ? 1 : -1) * Math.pow(x, p) / fact(p);
    }
    return sum;
  };
  plotFn(ctx, ox, oy, s, s, -6, 6, taylor, tint, 2.5);
  caption(ctx, `保留前 ${terms} 项 · count 增加阶数，逼近 sin x（灰）`, 16, h - 16);
}

/* ── 线性代数 ────────────────────────────────────────── */
function drawVectors(ctx, w, h, tint, tt, sz) {
  title(ctx, '向量 · 加法 / 点积 / 叉积(2D)', 16, 22);
  const ox = w * 0.35, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.3, h * 0.35);
  const ax = 1.6, ay = 0.9 + 0.4 * Math.sin(tt);
  const bx = 0.5 + 0.8 * Math.cos(tt * 0.7), by = 1.5;
  arrow(ctx, ox, oy, ox + ax * s, oy - ay * s, '#22d3ee', 2.5);
  arrow(ctx, ox, oy, ox + bx * s, oy - by * s, '#f472b6', 2.5);
  // parallelogram sum
  arrow(ctx, ox, oy, ox + (ax + bx) * s, oy - (ay + by) * s, '#fbbf24', 2.5);
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(ox + ax * s, oy - ay * s); ctx.lineTo(ox + (ax + bx) * s, oy - (ay + by) * s);
  ctx.lineTo(ox + bx * s, oy - by * s); ctx.stroke(); ctx.setLineDash([]);
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  caption(ctx, `a·b = ${dot.toFixed(2)}   a×b (z) = ${cross.toFixed(2)}   |a+b| 黄`, 16, h - 16);
  labelAt(ctx, 'a', ox + ax * s * 0.5, oy - ay * s * 0.5 - 10, '#67e8f9');
  labelAt(ctx, 'b', ox + bx * s * 0.5 - 10, oy - by * s * 0.5, '#f9a8d4');
}

function drawMatrix2d(ctx, w, h, tint, tt, sz) {
  title(ctx, '矩阵变换  [[cos,−sin],[sin,cos]] 旋转', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.35, h * 0.35);
  // unit square
  const ang = tt * 0.6;
  const c = Math.cos(ang), sn = Math.sin(ang);
  const scale = 0.7 + 0.3 * sz;
  const apply = (x, y) => [c * x - sn * y, sn * x + c * y];
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
    const [u, v] = apply(x * scale, y * scale);
    return [ox + u * s * 1.5, oy - v * s * 1.5];
  });
  // original faint
  fillPoly(ctx, [[ox, oy], [ox + scale * s * 1.5, oy], [ox + scale * s * 1.5, oy - scale * s * 1.5], [ox, oy - scale * s * 1.5]], rgba('#64748b', 0.15), '#64748b');
  fillPoly(ctx, sq, rgba(tint, 0.25), tint);
  // basis vectors
  const e1 = apply(1, 0), e2 = apply(0, 1);
  arrow(ctx, ox, oy, ox + e1[0] * s * 1.5 * scale, oy - e1[1] * s * 1.5 * scale, '#22d3ee', 2);
  arrow(ctx, ox, oy, ox + e2[0] * s * 1.5 * scale, oy - e2[1] * s * 1.5 * scale, '#f472b6', 2);
  caption(ctx, `θ=${(ang * 180 / Math.PI % 360).toFixed(0)}° · 灰=原单位正方形 · 紫=变换后`, 16, h - 16);
}

function drawDeterminant(ctx, w, h, tint, tt, sz) {
  title(ctx, '行列式 = 平行四边形有向面积', 16, 22);
  const ox = w * 0.4, oy = h * 0.6, s = 70 * sz;
  axes(ctx, ox, oy, w * 0.35, h * 0.4);
  const ax = 1.2, ay = 0.3 * Math.sin(tt);
  const bx = 0.4 * Math.cos(tt * 0.8), by = 1.0;
  fillPoly(ctx, [
    [ox, oy],
    [ox + ax * s, oy - ay * s],
    [ox + (ax + bx) * s, oy - (ay + by) * s],
    [ox + bx * s, oy - by * s],
  ], rgba(tint, 0.3), tint);
  arrow(ctx, ox, oy, ox + ax * s, oy - ay * s, '#22d3ee', 2.5);
  arrow(ctx, ox, oy, ox + bx * s, oy - by * s, '#f472b6', 2.5);
  const det = ax * by - ay * bx;
  caption(ctx, `det [a b] = ${det.toFixed(2)}  （面积，符号表示定向）`, 16, h - 16);
}

function drawEigen(ctx, w, h, tint, tt, sz) {
  title(ctx, '特征值 / 特征向量  Av = λv', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 55 * sz;
  axes(ctx, ox, oy, w * 0.38, h * 0.38);
  // matrix [[2, 0.5],[0.5, 1]]
  const A = (x, y) => [2 * x + 0.5 * y, 0.5 * x + 1 * y];
  // draw many transformed unit vectors
  for (let i = 0; i < 24; i++) {
    const th = (i / 24) * TAU + tt * 0.1;
    const v = [Math.cos(th), Math.sin(th)];
    const Av = A(v[0], v[1]);
    ctx.strokeStyle = rgba(tint, 0.25);
    ctx.beginPath();
    ctx.moveTo(ox + v[0] * s * 0.6, oy - v[1] * s * 0.6);
    ctx.lineTo(ox + Av[0] * s * 0.45, oy - Av[1] * s * 0.45);
    ctx.stroke();
  }
  // eigen directions (approx for this SPD matrix)
  // eigenvalues of [[2,.5],[.5,1]]: solve (2-l)(1-l)-0.25=0 → l²-3l+1.75=0
  const l1 = (3 + Math.sqrt(2)) / 2, l2 = (3 - Math.sqrt(2)) / 2;
  // eigenvectors roughly
  const evecs = [[0.9, 0.45], [-0.45, 0.9]];
  const lambs = [l1, l2];
  evecs.forEach((e, i) => {
    const len = lambs[i] * 0.5;
    arrow(ctx, ox - e[0] * s * len, oy + e[1] * s * len, ox + e[0] * s * len, oy - e[1] * s * len, i ? '#f472b6' : '#fbbf24', 2.5);
  });
  caption(ctx, `黄/粉 = 特征方向（变换只伸缩不旋转）· λ₁≈${l1.toFixed(2)} λ₂≈${l2.toFixed(2)}`, 16, h - 16);
}

/* ── 离散 ────────────────────────────────────────────── */
function drawVenn(ctx, w, h, tint, tt, sz) {
  title(ctx, '集合 · 韦恩图  A ∩ B / A ∪ B', 16, 22);
  const r = 70 * sz;
  const cx1 = w * 0.4, cx2 = w * 0.58, cy = h * 0.5;
  ctx.fillStyle = rgba('#22d3ee', 0.25); ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#f472b6', 0.25); ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill();
  // intersection highlight pulse
  ctx.save();
  ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba('#fbbf24', 0.35 + 0.2 * Math.sin(tt * 2));
  ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.stroke();
  labelAt(ctx, 'A', cx1 - r * 0.45, cy - r * 0.1, '#67e8f9');
  labelAt(ctx, 'B', cx2 + r * 0.45, cy - r * 0.1, '#f9a8d4');
  labelAt(ctx, 'A∩B', (cx1 + cx2) / 2, cy + 4, '#fde68a');
  caption(ctx, `青=A 粉=B 黄闪=交集 · 尺寸改变圆半径`, 16, h - 16);
}

function drawCombinatorics(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '排列组合  C(n,k) / P(n,k)', 16, 22);
  const N = Math.min(8, Math.max(3, n));
  const K = Math.min(N, Math.max(1, Math.round(2 + sz * 2) % (N + 1) || 2));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const C = fact(N) / (fact(K) * fact(N - K));
  const P = fact(N) / fact(N - K);
  // dots
  const cols = N;
  const x0 = w * 0.15, gap = Math.min(48, (w * 0.7) / cols);
  for (let i = 0; i < N; i++) {
    const x = x0 + i * gap, y = h * 0.4;
    const on = i < K && Math.sin(tt * 3 + i) > -0.2;
    ctx.fillStyle = on ? tint : '#334155';
    ctx.beginPath(); ctx.arc(x, y, 14 * Math.min(1.2, sz), 0, TAU); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, y + 4);
  }
  // combination highlight bar
  ctx.fillStyle = rgba(tint, 0.15);
  ctx.fillRect(x0 - 20, h * 0.55, K * gap + 20, 40);
  ctx.fillStyle = '#e2e8f0'; ctx.font = '600 16px ui-sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`C(${N},${K}) = ${C}`, x0, h * 0.55 + 26);
  ctx.fillText(`P(${N},${K}) = ${P}`, x0 + 160, h * 0.55 + 26);
  caption(ctx, `count→n  尺寸影响 k · 前 k 个元素高亮为选取`, 16, h - 16);
}

function drawSequence(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '递推数列 · 斐波那契 / 等比', 16, 22);
  const N = Math.min(16, Math.max(5, n + 4));
  const mode = Math.floor(tt / 4) % 2;
  const seq = [1, 1];
  if (mode === 0) {
    while (seq.length < N) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  } else {
    seq.length = 0; seq.push(1);
    const r = 1.3 + 0.2 * sz;
    while (seq.length < N) seq.push(seq[seq.length - 1] * r);
  }
  const maxV = Math.max(...seq);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / N, barH = h * 0.55;
  seq.forEach((v, i) => {
    const bh = (v / maxV) * barH;
    const pulse = i === Math.floor(tt * 2) % N ? 1.1 : 1;
    ctx.fillStyle = rgba(tint, 0.5 + 0.4 * (i / N));
    ctx.fillRect(x0 + i * barW + 2, y0 - bh * pulse, barW - 4, bh * pulse);
    if (N <= 12) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(v)), x0 + i * barW + barW / 2, y0 - bh - 6);
    }
  });
  caption(ctx, mode === 0 ? `斐波那契 Fₙ=Fₙ₋₁+Fₙ₋₂ · n=${N}` : `等比数列 · n=${N}`, 16, h - 16);
}

function drawShortest(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '图论 · 最短路示意 (Dijkstra)', 16, 22);
  const nodes = [
    [0.15, 0.55], [0.35, 0.3], [0.35, 0.75], [0.55, 0.45], [0.75, 0.3], [0.75, 0.7], [0.9, 0.5],
  ].map(([x, y]) => [x * w, y * h]);
  const edges = [[0,1,2],[0,2,4],[1,3,3],[2,3,1],[1,4,5],[3,4,2],[3,5,4],[4,6,2],[5,6,3],[2,5,6]];
  // animate path discovery
  const path = [0, 2, 3, 4, 6];
  const progress = Math.min(path.length - 1, Math.floor((tt * 0.8) % (path.length + 1)));
  edges.forEach(([a, b, wt]) => {
    const onPath = path.slice(0, progress + 1).includes(a) && path.slice(0, progress + 1).includes(b)
      && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    ctx.strokeStyle = onPath ? tint : '#334155';
    ctx.lineWidth = onPath ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[b][0], nodes[b][1]); ctx.stroke();
    const mx = (nodes[a][0] + nodes[b][0]) / 2, my = (nodes[a][1] + nodes[b][1]) / 2;
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(wt), mx, my - 4);
  });
  nodes.forEach((p, i) => {
    const reached = path.indexOf(i) >= 0 && path.indexOf(i) <= progress;
    ctx.fillStyle = reached ? tint : '#1e293b';
    ctx.strokeStyle = reached ? '#fbbf24' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p[0], p[1], 12 * Math.min(1.3, sz), 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String.fromCharCode(65 + i), p[0], p[1] + 4);
  });
  caption(ctx, `从 A 出发逐步松弛 · 高亮为当前最短路前缀`, 16, h - 16);
}

function drawModular(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '模运算  钟面 ≡ mod m', 16, 22);
  const m = Math.min(16, Math.max(4, n));
  const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.32 * sz;
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const val = Math.floor(tt * 1.5);
  const rem = ((val % m) + m) % m;
  for (let i = 0; i < m; i++) {
    const a = -Math.PI / 2 + (i / m) * TAU;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    ctx.fillStyle = i === rem ? tint : '#1e293b';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = i === rem ? '#fbbf24' : '#475569'; ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i), x, y + 4);
  }
  // hand
  const a = -Math.PI / 2 + (rem / m) * TAU;
  arrow(ctx, cx, cy, cx + Math.cos(a) * (R - 24), cy + Math.sin(a) * (R - 24), '#fbbf24', 2);
  caption(ctx, `${val} ≡ ${rem} (mod ${m}) · count=模数 m`, 16, h - 16);
}

/* ── 概率统计 ────────────────────────────────────────── */
function drawBinomial(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '二项分布  X~B(n,p)', 16, 22);
  const N = Math.min(24, Math.max(5, n + 4));
  const p = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(tt * 0.3));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const pdf = [];
  for (let k = 0; k <= N; k++) {
    pdf.push(fact(N) / (fact(k) * fact(N - k)) * Math.pow(p, k) * Math.pow(1 - p, N - k));
  }
  const maxP = Math.max(...pdf);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / (N + 1), barH = h * 0.55;
  pdf.forEach((v, i) => {
    const bh = (v / maxP) * barH;
    ctx.fillStyle = rgba(tint, 0.45 + 0.5 * (v / maxP));
    ctx.fillRect(x0 + i * barW + 1, y0 - bh, barW - 2, bh);
  });
  caption(ctx, `n=${N}  p=${p.toFixed(2)}  E[X]=${(N * p).toFixed(1)} · count→n`, 16, h - 16);
}

function drawNormal(ctx, w, h, tint, tt, sz) {
  title(ctx, '正态分布  N(μ, σ²)', 16, 22);
  const ox = w * 0.5, oy = h * 0.7, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.42, h * 0.5);
  const mu = Math.sin(tt * 0.3) * 1.2;
  const sigma = 0.6 + 0.5 * sz;
  const gauss = (x) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(TAU));
  // fill under curve
  ctx.beginPath();
  ctx.moveTo(ox - 4 * s, oy);
  for (let i = 0; i <= 120; i++) {
    const x = -4 + (8 * i) / 120;
    ctx.lineTo(ox + x * s, oy - gauss(x) * s * 4);
  }
  ctx.lineTo(ox + 4 * s, oy); ctx.closePath();
  ctx.fillStyle = rgba(tint, 0.3); ctx.fill();
  plotFn(ctx, ox, oy, s, s * 4, -4, 4, gauss, tint, 2.5);
  // σ bands
  ctx.strokeStyle = rgba('#fbbf24', 0.6); ctx.setLineDash([4, 3]);
  [-1, 1].forEach((k) => {
    ctx.beginPath(); ctx.moveTo(ox + (mu + k * sigma) * s, oy); ctx.lineTo(ox + (mu + k * sigma) * s, oy - gauss(mu + k * sigma) * s * 4); ctx.stroke();
  });
  ctx.setLineDash([]);
  caption(ctx, `μ=${mu.toFixed(2)}  σ=${sigma.toFixed(2)} · 尺寸→σ  速度→μ 漂移`, 16, h - 16);
}

function drawCLT(ctx, w, h, tint, tt, sz, n) {
  title(ctx, '中心极限定理 · 样本均值趋近正态', 16, 22);
  // simulate dice means
  const samples = Math.min(40, 8 + n * 2);
  const means = [];
  const seed = Math.floor(tt * 2);
  let s0 = seed * 9973;
  const rnd = () => { s0 = (s0 * 16807) % 2147483647; return (s0 & 0xffff) / 0xffff; };
  for (let i = 0; i < 200; i++) {
    let sum = 0;
    for (let j = 0; j < samples; j++) sum += 1 + Math.floor(rnd() * 6);
    means.push(sum / samples);
  }
  // histogram
  const bins = 16;
  const min = 1, max = 6;
  const counts = new Array(bins).fill(0);
  means.forEach((m) => {
    const bi = Math.min(bins - 1, Math.max(0, Math.floor(((m - min) / (max - min)) * bins)));
    counts[bi]++;
  });
  const maxC = Math.max(...counts, 1);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / bins, barH = h * 0.5;
  counts.forEach((c, i) => {
    const bh = (c / maxC) * barH;
    ctx.fillStyle = rgba(tint, 0.4 + 0.5 * (c / maxC));
    ctx.fillRect(x0 + i * barW + 1, y0 - bh, barW - 2, bh);
  });
  // overlay normal envelope
  const mu = 3.5, sigma = Math.sqrt(((35 / 12) / samples));
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = min + (max - min) * (i / 80);
    const g = Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(TAU));
    const px = x0 + ((x - min) / (max - min)) * (w - 60);
    const py = y0 - g * sigma * Math.sqrt(TAU) * barH * 0.85;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  caption(ctx, `骰子均值 · 每组 n=${samples} · 直方图→正态(黄) · count 增大 n`, 16, h - 16);
}
