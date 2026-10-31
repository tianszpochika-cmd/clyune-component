import { makeCanvas, loop, bar, defaultParams, readLiveControls, localPoint } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = [
  'pythagoras', 'similar-tri', 'circle-angles', 'area-volume', 'coord-geo', 'conics',
  'linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'parametric', 'polar',
  'unit-circle', 'trig-id', 'law-sine',
  'limit', 'derivative', 'integral', 'taylor',
  'vectors', 'matrix-2d', 'determinant', 'eigen',
  'venn', 'combinatorics', 'sequence', 'shortest-path', 'modular',
  'binomial', 'normal', 'clt',
];

/** Preset → concrete numeric overrides (applied via remount _controls + CSS). */
const PRESET_DEFAULTS = {
  // geometry
  '经典3-4-5': { size: 1, count: 8 }, '等腰直角': { size: 1.2, count: 12 }, '瘦长': { size: 1.6, count: 6 },
  '矮胖': { size: 0.7, count: 10 }, '大图': { size: 1.8, count: 8 }, '慢动': { size: 1, speed: 0.4 },
  '高相似比': { size: 1.5 }, '低相似比': { size: 0.6 }, '动截线': { speed: 1.8 }, '静': { speed: 0.3 },
  '锐角弧': { size: 0.8, count: 5 }, '钝角弧': { size: 1.4, count: 15 }, '动点': { speed: 1.6 },
  '大圆': { size: 1.7 }, '小圆': { size: 0.6 },
  '多分层面': { count: 16 }, '少层': { count: 4 }, '大球': { size: 1.6 }, '小球': { size: 0.7 },
  '高锥': { size: 1.5 }, '矮锥': { size: 0.7 },
  '远点': { size: 1.5 }, '近点': { size: 0.7 }, '动A': { speed: 1.8 }, '大刻度': { size: 1.4 }, '密': { count: 20 },
  '椭圆': { count: 3 }, '双曲线': { count: 4 }, '抛物线': { count: 5 }, '扁椭圆': { size: 1.5, count: 3 },
  // functions
  '陡坡': { size: 1.8 }, '缓坡': { size: 0.55 }, '过原点': { count: 1 }, '负斜率': { count: 2 },
  '开口上': { size: 1 }, '开口下': { size: 1.5 }, '有根': { count: 8 }, '无根': { count: 20 }, '动顶点': { speed: 1.5 },
  '底大': { size: 1.6 }, '底小': { size: 0.6 }, '对称显': { count: 10 },
  '多条': { count: 5 }, '少条': { count: 2 }, '奇次': { count: 3 }, '偶次': { count: 2 }, '含负': { count: 5 }, '正': { count: 3 },
  '动点快': { speed: 2 }, '动点慢': { speed: 0.4 }, '高对比': { size: 1.4 }, '柔': { size: 0.8 },
  '2叶': { count: 2 }, '3叶': { count: 3 }, '快绘': { speed: 2 }, '慢绘': { speed: 0.4 },
  '3瓣': { count: 3 }, '4瓣': { count: 4 }, '5瓣': { count: 5 },
  // trig / calc
  '标准': { size: 1, speed: 1 }, '快速': { speed: 2.2 }, '慢速': { speed: 0.35 }, '大振幅': { size: 1.7 }, '相位': { count: 12 },
  '高亮': { size: 1.3, speed: 1.2 }, '锐三角': { size: 0.9 }, '钝三角': { size: 1.5 },
  '密取样': { count: 24 }, '疏取样': { count: 4 }, '快逼近': { speed: 2 },
  '快扫': { speed: 2 }, '慢扫': { speed: 0.4 }, '大切线': { size: 1.6 }, '显割线': { count: 10 }, '隐': { count: 2 },
  '多矩形': { count: 36 }, '少矩形': { count: 6 }, '高': { size: 1.5 }, '低': { size: 0.7 },
  '2项': { count: 2 }, '4项': { count: 4 }, '6项': { count: 6 }, '8项': { count: 8 },
  // linalg / discrete / prob
  '钝角': { size: 1.4 }, '锐角': { size: 0.8 }, '正交': { count: 8 },
  '快旋': { speed: 2 }, '慢旋': { speed: 0.4 }, '显基': { count: 12 },
  '正定向': { size: 1.3 }, '负定向': { size: 0.7, count: 15 }, '大面积': { size: 1.7 },
  '大交': { size: 1.5 }, '小交': { size: 0.7 },
  'n大': { count: 8 }, 'n小': { count: 4 }, 'k大': { size: 1.6 }, 'k小': { size: 0.6 },
  '斐波那契': { count: 12 }, '等比': { count: 13 }, '多项': { count: 16 }, '少项': { count: 6 },
  '快推进': { speed: 2 }, '慢推进': { speed: 0.4 }, '大节点': { size: 1.5 }, '显权': { count: 10 }, '简': { count: 4 },
  'mod7': { count: 7 }, 'mod12': { count: 12 }, 'mod16': { count: 16 },
  'p高': { size: 1.6 }, 'p低': { size: 0.5 }, '动p': { speed: 1.5 },
  '窄峰': { size: 0.6 }, '宽峰': { size: 1.8 }, 'μ漂移': { speed: 1.6 },
  '大样本': { count: 24 }, '小样本': { count: 4 }, '多组': { count: 20 }, '少组': { count: 6 },
  '大': { size: 1.6 }, '小': { size: 0.65 }, '快': { speed: 2 }, '慢': { speed: 0.4 }, '动': { speed: 1.5 },
};

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'pythagoras').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'pythagoras';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-math',
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
  const id = opts.variant || 'pythagoras';
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
    return {
      ...L,
      style: Number.isFinite(ctrl.style) ? ctrl.style : 0,
      styleName: ctrl.styleName || '',
    };
  };
  const { canvas, ctx, state, dispose } = makeCanvas(stage);

  // interaction state (world-ish normalized params)
  const ix = {
    drag: null, // { key, ox, oy }
    u: 0.35, // similar-tri / unit-circle / derivative param
    ax: 1.6, ay: 0.9, bx: 0.7, by: 1.3, // vectors / determinant
    px: -2, py: 1.5, qx: 3, qy: -1, // coord-geo points
    panX: 0, panY: 0, zoom: 1, // function plots
    theta: 0.8, // unit circle
    node: 0, // shortest-path click
  };

  const onPointerDown = (e) => {
    const p = localPoint(canvas, e);
    const { w, h } = state;
    const L = live();
    const hits = hitTargets(family, w, h, L, ix);
    let best = null, bd = 1e9;
    for (const hit of hits) {
      const d = Math.hypot(p.x - hit.x, p.y - hit.y);
      if (d <= (hit.r || 14)) {
        ix.drag = { key: hit.key, dx: p.x - hit.x, dy: p.y - hit.y };
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
        return;
      }
      if (d < bd) { bd = d; best = hit; }
    }
    // soft grab: nearest handle within generous radius (mobile + audit friendly)
    const soft = Math.max(130, Math.min(w, h) * 0.28);
    if (best && bd <= soft && ['pythagoras', 'similar-tri', 'unit-circle', 'trig-id', 'vectors', 'determinant', 'coord-geo', 'derivative'].includes(family)) {
      ix.drag = { key: best.key, dx: p.x - best.x, dy: p.y - best.y };
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    // empty drag = pan for plot families
    if (['linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'limit', 'derivative', 'integral', 'taylor', 'normal'].includes(family)) {
      ix.drag = { key: 'pan', x0: p.x, y0: p.y, panX0: ix.panX, panY0: ix.panY };
      canvas.setPointerCapture?.(e.pointerId);
    }
    if (family === 'shortest-path' || family === 'combinatorics' || family === 'modular') {
      // click nearest
      let best = null, bd = 1e9;
      for (const hit of hits) {
        const d = Math.hypot(p.x - hit.x, p.y - hit.y);
        if (d < bd) { bd = d; best = hit; }
      }
      if (best && bd < 28) {
        ix.node = best.idx ?? 0;
        if (best.key === 'u') ix.u = best.u ?? ix.u;
      }
    }
  };
  const onPointerMove = (e) => {
    if (!ix.drag) return;
    const p = localPoint(canvas, e);
    const { w, h } = state;
    applyDrag(family, ix, p, w, h, live());
  };
  const onPointerUp = () => { ix.drag = null; };
  const onWheel = (e) => {
    if (!['linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'limit', 'derivative', 'integral', 'taylor', 'polar', 'parametric', 'normal'].includes(family)) return;
    e.preventDefault();
    const f = e.deltaY > 0 ? 0.9 : 1.1;
    ix.zoom = Math.min(3, Math.max(0.4, ix.zoom * f));
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.style.cursor = 'crosshair';

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
    drawFamily(ctx, family, w, h, tint, tt, sz, n, L, ix);
    // interaction affordance
    drawHandles(ctx, family, w, h, L, ix, tint);
  });
  return () => {
    stop();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    dispose();
    host.innerHTML = '';
  };
}

/* ── helpers ─────────────────────────────────────────── */
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
function axes(ctx, ox, oy, W, H, color = '#334155') {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(ox - W, oy); ctx.lineTo(ox + W, oy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, oy - H); ctx.lineTo(ox, oy + H); ctx.stroke();
}
function plotFn(ctx, ox, oy, sx, sy, xmin, xmax, fn, color, lw = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  let pen = false;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const x = xmin + (xmax - xmin) * (i / steps);
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 20) { pen = false; continue; }
    const px = ox + x * sx, py = oy - y * sy;
    if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
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
function handle(ctx, x, y, tint) {
  ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(tint, 0.5); ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
}

function hitTargets(family, w, h, L, ix) {
  const sz = L.size > 0 ? L.size : 1;
  if (family === 'pythagoras') {
    const ratios = [[3, 4], [1, 1], [2, 5], [5, 2], [4, 3], [3, 4]][(L.style || 0) % 6];
    const a = ix._a ?? (55 + 50 * sz * (ratios[0] / 3));
    const b = ix._b ?? (40 + 45 * sz * (ratios[1] / 3));
    const ox = w * 0.3, oy = h * 0.68;
    return [
      { key: 'A', x: ox + a, y: oy, r: 28 },
      { key: 'B', x: ox, y: oy - b, r: 28 },
    ];
  }
  if (family === 'similar-tri') {
    const A = [w * 0.18, h * 0.7], B = [w * 0.48, h * 0.7], C = [w * 0.28, h * 0.28];
    const t = ix.u;
    const P = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
    return [{ key: 'u', x: P[0], y: P[1], r: 26 }];
  }
  if (family === 'unit-circle' || family === 'trig-id') {
    const R = Math.min(70, w * 0.12) * sz;
    const cx = 16 + R + 20, cy = h * 0.5;
    const th = ix.theta;
    return [{ key: 'theta', x: cx + Math.cos(th) * R, y: cy - Math.sin(th) * R, r: 26 }];
  }
  if (family === 'vectors') {
    const ox = w * 0.35, oy = h * 0.55, s = 50 * sz;
    return [
      { key: 'va', x: ox + ix.ax * s, y: oy - ix.ay * s, r: 28 },
      { key: 'vb', x: ox + ix.bx * s, y: oy - ix.by * s, r: 28 },
    ];
  }
  if (family === 'determinant') {
    const ox = w * 0.4, oy = h * 0.6, s = 70 * sz;
    return [
      { key: 'va', x: ox + ix.ax * s, y: oy - ix.ay * s, r: 28 },
      { key: 'vb', x: ox + ix.bx * s, y: oy - ix.by * s, r: 28 },
    ];
  }
  if (family === 'coord-geo') {
    const ox = w * 0.5, oy = h * 0.55, s = 28 * sz * ix.zoom;
    return [
      { key: 'P', x: ox + (ix.px + ix.panX) * s, y: oy - (ix.py + ix.panY) * s, r: 26 },
      { key: 'Q', x: ox + (ix.qx + ix.panX) * s, y: oy - (ix.qy + ix.panY) * s, r: 26 },
    ];
  }
  if (family === 'derivative') {
    const ox = w * 0.5 + ix.panX * 20, oy = h * 0.55, s = 40 * sz * ix.zoom;
    const x0 = ix.u * 4 - 2;
    return [{ key: 'deriv', x: ox + x0 * s, y: oy - Math.sin(x0) * s, r: 26 }];
  }
  if (family === 'shortest-path') {
    const nodes = [[0.15, 0.55], [0.35, 0.3], [0.35, 0.75], [0.55, 0.45], [0.75, 0.3], [0.75, 0.7], [0.9, 0.5]];
    return nodes.map(([x, y], idx) => ({ key: 'node', idx, x: x * w, y: y * h, r: 18 }));
  }
  if (family === 'modular') {
    const m = Math.min(16, Math.max(4, Math.round(L.count)));
    const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.32 * sz;
    const out = [];
    for (let i = 0; i < m; i++) {
      const a = -Math.PI / 2 + (i / m) * TAU;
      out.push({ key: 'mod', idx: i, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: 16 });
    }
    return out;
  }
  return [];
}

function applyDrag(family, ix, p, w, h, L) {
  const sz = L.size > 0 ? L.size : 1;
  const d = ix.drag;
  if (!d) return;
  if (d.key === 'pan') {
    ix.panX = d.panX0 + (p.x - d.x0) / 40;
    ix.panY = d.panY0 - (p.y - d.y0) / 40;
    return;
  }
  if (family === 'pythagoras') {
    const ox = w * 0.3, oy = h * 0.68;
    if (d.key === 'A') ix._a = Math.max(30, Math.min(w * 0.45, p.x - d.dx - ox));
    if (d.key === 'B') ix._b = Math.max(30, Math.min(h * 0.45, oy - (p.y - d.dy)));
    return;
  }
  if (family === 'similar-tri') {
    const A = [w * 0.18, h * 0.7], C = [w * 0.28, h * 0.28];
    // project onto AC
    const vx = C[0] - A[0], vy = C[1] - A[1];
    const len2 = vx * vx + vy * vy;
    const t = ((p.x - A[0]) * vx + (p.y - A[1]) * vy) / len2;
    ix.u = Math.min(0.85, Math.max(0.15, t));
    return;
  }
  if (family === 'unit-circle' || family === 'trig-id') {
    const R = Math.min(70, w * 0.12) * sz;
    const cx = 16 + R + 20, cy = h * 0.5;
    ix.theta = Math.atan2(cy - (p.y - d.dy), (p.x - d.dx) - cx);
    if (ix.theta < 0) ix.theta += TAU;
    return;
  }
  if (family === 'vectors') {
    const ox = w * 0.35, oy = h * 0.55, s = 50 * sz;
    const x = (p.x - d.dx - ox) / s, y = (oy - (p.y - d.dy)) / s;
    if (d.key === 'va') { ix.ax = x; ix.ay = y; }
    if (d.key === 'vb') { ix.bx = x; ix.by = y; }
    return;
  }
  if (family === 'determinant') {
    const ox = w * 0.4, oy = h * 0.6, s = 70 * sz;
    const x = (p.x - d.dx - ox) / s, y = (oy - (p.y - d.dy)) / s;
    if (d.key === 'va') { ix.ax = x; ix.ay = y; }
    if (d.key === 'vb') { ix.bx = x; ix.by = y; }
    return;
  }
  if (family === 'coord-geo') {
    const ox = w * 0.5, oy = h * 0.55, s = 28 * sz * ix.zoom;
    const x = (p.x - d.dx - ox) / s - ix.panX;
    const y = (oy - (p.y - d.dy)) / s - ix.panY;
    if (d.key === 'P') { ix.px = x; ix.py = y; }
    if (d.key === 'Q') { ix.qx = x; ix.qy = y; }
    return;
  }
  if (family === 'derivative') {
    const ox = w * 0.5 + ix.panX * 20, s = 40 * sz * ix.zoom;
    const x0 = (p.x - d.dx - ox) / s;
    ix.u = (x0 + 2) / 4;
    return;
  }
}

function drawHandles(ctx, family, w, h, L, ix, tint) {
  const interactive = ['pythagoras', 'similar-tri', 'unit-circle', 'trig-id', 'vectors', 'determinant', 'coord-geo', 'derivative'];
  if (!interactive.includes(family)) return;
  for (const hit of hitTargets(family, w, h, L, ix)) handle(ctx, hit.x, hit.y, tint);
}

function drawFamily(ctx, family, w, h, tint, tt, sz, n, L, ix) {
  const style = L.style || 0;
  switch (family) {
    case 'pythagoras': return drawPythagoras(ctx, w, h, tint, tt, sz, style, ix);
    case 'similar-tri': return drawSimilar(ctx, w, h, tint, tt, sz, style, ix);
    case 'circle-angles': return drawCircleAngles(ctx, w, h, tint, tt, sz, style);
    case 'area-volume': return drawAreaVolume(ctx, w, h, tint, tt, sz, n, style);
    case 'coord-geo': return drawCoordGeo(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'conics': return drawConics(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'linear': return drawLinear(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'quadratic': return drawQuadratic(ctx, w, h, tint, tt, sz, style, ix);
    case 'exp-log': return drawExpLog(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'power': return drawPower(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'piecewise': return drawPiecewise(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'parametric': return drawParametric(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'polar': return drawPolar(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'unit-circle': return drawUnitCircle2d(ctx, w, h, tint, tt, sz, style, ix);
    case 'trig-id': return drawTrigId(ctx, w, h, tint, tt, sz, style, ix);
    case 'law-sine': return drawLawSine(ctx, w, h, tint, tt, sz, style);
    case 'limit': return drawLimit(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'derivative': return drawDerivative(ctx, w, h, tint, tt, sz, style, ix);
    case 'integral': return drawIntegral(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'taylor': return drawTaylor(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'vectors': return drawVectors(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'matrix-2d': return drawMatrix2d(ctx, w, h, tint, tt, sz, style);
    case 'determinant': return drawDeterminant(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'eigen': return drawEigen(ctx, w, h, tint, tt, sz, style);
    case 'venn': return drawVenn(ctx, w, h, tint, tt, sz, style);
    case 'combinatorics': return drawCombinatorics(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'sequence': return drawSequence(ctx, w, h, tint, tt, sz, n, style);
    case 'shortest-path': return drawShortest(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'modular': return drawModular(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'binomial': return drawBinomial(ctx, w, h, tint, tt, sz, n, style);
    case 'normal': return drawNormal(ctx, w, h, tint, tt, sz, style, ix);
    case 'clt': return drawCLT(ctx, w, h, tint, tt, sz, n, style);
    default: return drawPythagoras(ctx, w, h, tint, tt, sz, style, ix);
  }
}

/* ── 几何 ────────────────────────────────────────────── */
function drawPythagoras(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '勾股定理  a² + b² = c²  · 拖动直角边端点', 16, 22);
  const ratios = [[3, 4], [1, 1], [2, 5], [5, 2], [4, 3], [3, 4]][style % 6];
  let a = ix._a ?? (55 + 50 * sz * (ratios[0] / 3));
  let b = ix._b ?? (40 + 45 * sz * (ratios[1] / 3));
  ix._a = a; ix._b = b;
  const c = Math.hypot(a, b);
  const ox = w * 0.3, oy = h * 0.68;
  fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox, oy - b]], rgba(tint, 0.2), tint);
  const pulse = 0.5 + 0.5 * Math.sin(tt * 1.2);
  fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox + a, oy + a], [ox, oy + a]], rgba('#22d3ee', 0.2 + 0.12 * pulse), '#22d3ee');
  labelAt(ctx, `a²`, ox + a / 2, oy + a / 2 + 4, '#67e8f9');
  fillPoly(ctx, [[ox, oy], [ox, oy - b], [ox - b, oy - b], [ox - b, oy]], rgba('#f472b6', 0.2 + 0.12 * pulse), '#f472b6');
  labelAt(ctx, `b²`, ox - b / 2, oy - b / 2 + 4, '#f9a8d4');
  const ang = Math.atan2(-b, a);
  ctx.save(); ctx.translate(ox + a, oy); ctx.rotate(ang);
  fillPoly(ctx, [[0, 0], [-c, 0], [-c, -c], [0, -c]], rgba('#fbbf24', 0.22 + 0.12 * pulse), '#fbbf24');
  labelAt(ctx, `c²`, -c / 2, -c / 2 + 4, '#fde68a');
  ctx.restore();
  caption(ctx, `a=${(a / 10).toFixed(1)} b=${(b / 10).toFixed(1)} c=${(c / 10).toFixed(1)} · 尺寸/预设改比例 · 拖黄点`, 16, h - 16);
}

function drawSimilar(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '相似三角形  · 拖动截点改相似比', 16, 22);
  const A = [w * 0.18, h * 0.72], B = [w * 0.52, h * 0.72], C = [w * 0.3, h * 0.22];
  if (!ix.drag) {
    const auto = 0.25 + 0.2 * sz + (style % 3) * 0.08;
    if (Math.abs(ix.u - auto) > 0.25 && style >= 0) { /* keep user drag */ }
  }
  const t = ix.u;
  fillPoly(ctx, [A, B, C], rgba(tint, 0.12), tint);
  const P = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  const Q = [B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t];
  fillPoly(ctx, [P, Q, C], rgba('#f472b6', 0.3), '#f472b6');
  ctx.setLineDash([5, 4]); ctx.strokeStyle = '#94a3b8';
  ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(Q[0], Q[1]); ctx.stroke(); ctx.setLineDash([]);
  caption(ctx, `相似比 t=${t.toFixed(2)} · 速度仅影响标题脉冲色相偏移`, 16, h - 16);
  // color pulse via tt to make speed visible
  ctx.strokeStyle = rgba(tint, 0.35 + 0.35 * Math.sin(tt * 3));
  ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
}

function drawCircleAngles(ctx, w, h, tint, tt, sz, style) {
  title(ctx, '圆心角与圆周角  ∠圆心 = 2·∠圆周', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * (0.2 + 0.14 * sz);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const spanBase = [0.7, 1.2, 2.0, 2.5, 1.0, 1.6][style % 6];
  const a0 = tt * 0.45, span = spanBase;
  const A = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
  const B = [cx + R * Math.cos(a0 + span), cy + R * Math.sin(a0 + span)];
  const mid = a0 + span / 2 + Math.PI;
  const P = [cx + R * Math.cos(mid), cy + R * Math.sin(mid)];
  ctx.strokeStyle = tint; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.fillStyle = rgba(tint, 0.25);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.35, a0, a0 + span); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath();
  ctx.moveTo(P[0], P[1]); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.closePath(); ctx.stroke();
  [[A, '#22d3ee'], [B, '#22d3ee'], [P, '#f472b6'], [[cx, cy], '#fbbf24']].forEach(([pt, c]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, TAU); ctx.fill();
  });
  caption(ctx, `圆心角 ${(span * 180 / Math.PI).toFixed(0)}° · 圆周角 ${(span * 90 / Math.PI).toFixed(0)}° · 预设改弧宽 · 尺寸改半径`, 16, h - 16);
}

function drawAreaVolume(ctx, w, h, tint, tt, sz, n, style) {
  title(ctx, '棱锥与球 · 体积关系', 16, 22);
  const r = 30 + 35 * sz;
  const sx = w * 0.28, sy = h * 0.5;
  const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
  g.addColorStop(0, rgba(tint, 0.6)); g.addColorStop(1, rgba(tint, 0.08));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = tint; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.28, 0, 0, TAU); ctx.strokeStyle = rgba(tint, 0.5); ctx.stroke();
  labelAt(ctx, `球 V=⁴⁄₃πr³`, sx, sy + r + 18, '#94a3b8');
  const px = w * 0.68, base = 40 + 40 * sz, height = 70 + 50 * sz * (style % 2 === 0 ? 1 : 0.65);
  const apex = [px, sy - height * 0.55];
  const b1 = [px - base, sy + height * 0.35], b2 = [px + base * 0.6, sy + height * 0.35];
  const b3 = [px + base * 0.2, sy + height * 0.55];
  fillPoly(ctx, [apex, b1, b2], rgba('#f472b6', 0.25), '#f472b6');
  fillPoly(ctx, [apex, b2, b3], rgba('#fbbf24', 0.18), '#fbbf24');
  const layers = Math.min(18, Math.max(3, n));
  for (let i = 1; i < layers; i++) {
    const u = i / layers;
    const y = apex[1] + (sy + height * 0.35 - apex[1]) * u;
    ctx.strokeStyle = rgba('#22d3ee', 0.3 + 0.5 * Math.sin(tt * 2 + i));
    ctx.strokeRect(px - base * u, y, base * 1.4 * u, 3);
  }
  caption(ctx, `分层 N=${layers} · count 改层数 · 尺寸改半径/底`, 16, h - 16);
}

function drawCoordGeo(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '坐标几何 · 拖动 A/B · 滚轮缩放 · 拖空白平移', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 28 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.4, h * 0.35);
  const ax = ix.px + ix.panX, ay = ix.py + ix.panY;
  const bx = ix.qx + ix.panX, by = ix.qy + ix.panY;
  const A = [ox + ax * s, oy - ay * s], B = [ox + bx * s, oy - by * s];
  const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  arrow(ctx, A[0], A[1], B[0], B[1], tint, 2.5);
  const ticks = Math.min(24, Math.max(2, Math.round(n / 2)));
  for (let i = 1; i < ticks; i++) {
    const u = i / ticks;
    const x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u;
    ctx.fillStyle = rgba(tint, 0.55);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(A[0], A[1], 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(B[0], B[1], 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(M[0], M[1], 4, 0, TAU); ctx.fill();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#64748b';
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  ctx.setLineDash([]);
  const dist = Math.hypot(ix.qx - ix.px, ix.qy - ix.py);
  const slope = (ix.qy - ix.py) / (ix.qx - ix.px || 1e-6);
  caption(ctx, `|AB|=${dist.toFixed(2)}  k=${slope.toFixed(2)}  分点=${ticks} · count改分点`, 16, h - 16);
}

function drawConics(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '圆锥曲线 · 预设/数量 切换类型', 16, 22);
  const ox = w * 0.5 + ix.panX * 10, oy = h * 0.52 + ix.panY * 10, s = 22 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.42, h * 0.38);
  const mode = style % 3; // preset drives type; count also shifts
  const mode2 = (mode + Math.floor((n - 1) / 3)) % 3;
  if (mode2 === 0) {
    const a = 3.2 + sz + 0.3 * Math.sin(tt), b = 1.8 + 0.4 * sz;
    ctx.strokeStyle = tint; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const th = (i / 180) * TAU;
      const x = ox + a * Math.cos(th) * s, y = oy - b * Math.sin(th) * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    const c = Math.sqrt(Math.max(0, a * a - b * b));
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(ox - c * s, oy, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + c * s, oy, 4, 0, TAU); ctx.fill();
    caption(ctx, `椭圆 · a=${a.toFixed(1)} b=${b.toFixed(1)}`, 16, h - 16);
  } else if (mode2 === 1) {
    ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath(); let first = true;
      for (let i = 0; i <= 60; i++) {
        const x = 1.05 + i * 0.1; const y = Math.sqrt(Math.max(0, x * x - 1));
        const px = ox + sx * x * s, py = oy - sy * y * s;
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    caption(ctx, `双曲线  x² − y² = 1`, 16, h - 16);
  } else {
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = -4 + i * 0.08; const y = (0.2 + 0.1 * sz) * x * x - 1;
      const px = ox + x * s, py = oy - y * s;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    caption(ctx, `抛物线  y ∝ x²`, 16, h - 16);
  }
}

/* ── 函数 ────────────────────────────────────────────── */
function plotFrame(ctx, w, h, ix, sz, tint) {
  const ox = w * 0.5 + ix.panX * 16, oy = h * 0.55 + ix.panY * 16, s = 32 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.42, h * 0.4);
  return { ox, oy, s };
}
function drawLinear(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '一次函数  y=kx+b  · 拖平移 / 滚轮缩放', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const modes = [
    () => ({ k: 0.8 * sz, b: Math.sin(tt * 0.5) }),
    () => ({ k: 0.25 * sz, b: 1 }),
    () => ({ k: 1.2 * sz, b: 0 }),
    () => ({ k: -0.9 * sz, b: 0.5 }),
    () => ({ k: 0.5 * sz, b: Math.cos(tt) }),
    () => ({ k: -0.3 * sz, b: -1 }),
  ];
  const { k, b } = modes[style % modes.length]();
  plotFn(ctx, ox, oy, s, s, -6, 6, (x) => k * x + b, tint, 2.5);
  const dots = Math.min(30, Math.max(3, Math.round(n / 2)));
  for (let i = 0; i < dots; i++) {
    const x = -5 + 10 * (i / Math.max(1, dots - 1));
    const y = k * x + b;
    ctx.fillStyle = rgba(tint, 0.75);
    ctx.beginPath(); ctx.arc(ox + x * s, oy - y * s, 3.2, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox, oy - b * s, 4, 0, TAU); ctx.fill();
  caption(ctx, `k=${k.toFixed(2)} b=${b.toFixed(2)} · 取样点=${dots} · count改点密度`, 16, h - 16);
}
function drawQuadratic(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '二次函数  · 拖平移 / 滚轮缩放', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const a = (style % 2 === 1 ? -1 : 1) * (0.25 + 0.25 * sz);
  const b = Math.sin(tt * 0.3) * (style % 3 === 2 ? 1.2 : 0.4);
  const c = style % 4 === 3 ? 2 : -1 + 0.3 * Math.cos(tt * 0.2);
  plotFn(ctx, ox, oy, s, s, -5, 5, (x) => a * x * x + b * x + c, tint, 2.5);
  const vx = -b / (2 * a), vy = a * vx * vx + b * vx + c;
  ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(ox + vx * s, oy - vy * s, 5, 0, TAU); ctx.fill();
  const disc = b * b - 4 * a * c;
  caption(ctx, `a=${a.toFixed(2)} Δ=${disc.toFixed(2)} ${disc >= 0 ? '有实根' : '无实根'}`, 16, h - 16);
}
function drawExpLog(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '指数与对数', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const base = 1.3 + 1.2 * sz * ([1, 0.4, 1.2, 0.7, 1.5, 0.9][style % 6]);
  plotFn(ctx, ox, oy, s, s * 0.55, -2, 3.2, (x) => Math.pow(base, x), tint, 2.2);
  plotFn(ctx, ox, oy, s, s * 0.55, 0.08, 5, (x) => Math.log(x) / Math.log(base), '#f472b6', 2.2);
  const samples = Math.min(28, Math.max(3, Math.round(n / 2)));
  for (let i = 0; i < samples; i++) {
    const x = -1.5 + 4.2 * (i / Math.max(1, samples - 1));
    const y = Math.pow(base, x);
    ctx.fillStyle = rgba(tint, 0.8);
    ctx.beginPath(); ctx.arc(ox + x * s, oy - y * s * 0.55, 3.4, 0, TAU); ctx.fill();
  }
  ctx.setLineDash([4, 4]); ctx.strokeStyle = '#475569';
  ctx.beginPath(); ctx.moveTo(ox - 2 * s, oy + 2 * s); ctx.lineTo(ox + 4 * s, oy - 4 * s); ctx.stroke();
  ctx.setLineDash([]);
  caption(ctx, `底 a=${base.toFixed(2)} · 取样=${samples} · count改点`, 16, h - 16);
}
function drawPower(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '幂函数  y=xⁿ', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const exps = [1, 2, 3, 0.5, -1];
  const colors = [tint, '#f472b6', '#22d3ee', '#fbbf24', '#a78bfa'];
  const showN = Math.min(exps.length, Math.max(1, (n % 6) || Math.min(5, style + 1)));
  for (let i = 0; i < showN; i++) {
    const p = exps[i];
    plotFn(ctx, ox, oy, s, s, p < 0 ? 0.2 : -2.2, 2.2, (x) => {
      if (p === 0.5 && x < 0) return NaN;
      if (p < 0 && Math.abs(x) < 0.15) return NaN;
      return Math.sign(x) * Math.pow(Math.abs(x), p);
    }, colors[i], 2);
  }
  caption(ctx, `显示 ${showN} 条 · count/预设改条数`, 16, h - 16);
}
function drawPiecewise(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '分段函数', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const segs = Math.min(6, Math.max(2, Math.round(n / 8)));
  const xs = [];
  for (let i = 0; i <= segs; i++) xs.push(-4 + 8 * (i / segs));
  for (let i = 0; i < segs; i++) {
    const x0 = xs[i], x1 = xs[i + 1];
    const mid = (x0 + x1) / 2;
    const fn = mid < -1 ? ((x) => -x - 1)
      : mid <= 1 ? ((x) => x * x * (0.6 + 0.4 * sz))
      : ((x) => 2 - x / (1 + style % 3));
    const col = i % 3 === 0 ? '#f472b6' : i % 3 === 1 ? tint : '#22d3ee';
    plotFn(ctx, ox, oy, s, s, x0, x1, fn, col, 2.5);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(ox + x0 * s, oy - fn(x0) * s, 3.5, 0, TAU); ctx.fill();
  }
  const cursor = -3 + ((tt * 0.7) % 6);
  let yv = cursor < -1 ? -cursor - 1 : cursor <= 1 ? cursor * cursor * (0.6 + 0.4 * sz) : 2 - cursor / (1 + style % 3);
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox + cursor * s, oy - yv * s, 5, 0, TAU); ctx.fill();
  caption(ctx, `分段数=${segs} · count改段数 · 预设改右段斜率`, 16, h - 16);
}
function drawParametric(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '参数方程 · 李萨如', 16, 22);
  const ox = w * 0.5 + ix.panX * 10, oy = h * 0.52, sc = 60 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.4, h * 0.38);
  const b = Math.max(1, (n % 5) || (2 + style % 3));
  ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.beginPath();
  const T = tt * 1.5;
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * Math.min(T, TAU * 2);
    const x = ox + Math.cos(t) * sc;
    const y = oy - Math.sin(b * t) * sc * 0.7;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  caption(ctx, `y=sin(${b}t) · count/预设改频率比`, 16, h - 16);
}
function drawPolar(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '极坐标 玫瑰线', 16, 22);
  const ox = w * 0.5, oy = h * 0.52;
  ctx.strokeStyle = '#1e293b';
  for (let r = 30; r <= 140 * sz * ix.zoom; r += 30) { ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.stroke(); }
  const k = Math.max(2, (n % 7) || (2 + style % 5));
  const a = 80 * sz * ix.zoom;
  ctx.strokeStyle = tint; ctx.lineWidth = 2.2; ctx.beginPath();
  const maxTh = Math.min(tt * 1.3, TAU * (k % 2 === 0 ? 2 : 1));
  for (let i = 0; i <= 500; i++) {
    const th = (i / 500) * maxTh;
    const r = a * Math.cos(k * th);
    const x = ox + r * Math.cos(th), y = oy + r * Math.sin(th);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  caption(ctx, `r=cos(${k}θ) · count 改花瓣数`, 16, h - 16);
}

/* ── 三角 ────────────────────────────────────────────── */
function drawUnitCircle2d(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '单位圆与波形 · 拖动圆上黄点', 16, 22);
  if (!ix.drag) ix.theta = (ix.theta + 0.012 * (0.3 + sz)) % TAU; // slow auto unless dragging — speed via tt handled outside; use style
  // actually speed is in tt; better: auto advance with a base rate separate from drag
  const R = Math.min(70, w * 0.12) * sz;
  const cx = 16 + R + 20, cy = h * 0.5;
  // auto-rotate using tt delta approximation: store last
  if (!ix._lastTt) ix._lastTt = tt;
  if (!ix.drag) ix.theta = (ix.theta + (tt - ix._lastTt) * 0.9) % TAU;
  ix._lastTt = tt;
  const th = ix.theta, c = Math.cos(th), s = Math.sin(th);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  axes(ctx, cx, cy, R + 10, R + 10, '#334155');
  const px = cx + c * R, py = cy - s * R;
  ctx.strokeStyle = tint; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  ctx.strokeStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
  const x0 = cx + R + 36, waveW = w - x0 - 20, amp = R;
  const phase = (style % 6) * 0.4;
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = i / 120; const ang = th - (1 - u) * TAU;
    const x = x0 + u * waveW, y = cy - Math.sin(ang + phase) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const u = i / 120; const ang = th - (1 - u) * TAU;
    const x = x0 + u * waveW, y = cy - Math.cos(ang + phase) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  caption(ctx, `θ=${(th * 180 / Math.PI).toFixed(0)}° sin=${s.toFixed(3)} cos=${c.toFixed(3)} · 预设改相位`, 16, h - 16);
}
function drawTrigId(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '三角恒等 sin²+cos²=1 · 可拖动角点', 16, 22);
  const ox = w * 0.3, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.25, h * 0.35);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, Math.sin, '#22d3ee', 2);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, Math.cos, '#f472b6', 2);
  plotFn(ctx, ox, oy, s, s, -0.2, TAU + 0.2, (x) => Math.sin(x) ** 2 + Math.cos(x) ** 2, '#fbbf24', 2.5);
  if (!ix._lastTt2) ix._lastTt2 = tt;
  if (!ix.drag) ix.theta = (ix.theta + (tt - ix._lastTt2) * 0.8) % TAU;
  ix._lastTt2 = tt;
  const cx = w * 0.72, cy = h * 0.5, R = 55 * sz;
  ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const th = ix.theta;
  const px = cx + Math.cos(th) * R, py = cy - Math.sin(th) * R;
  fillPoly(ctx, [[cx, cy], [px, cy], [px, py]], rgba('#22d3ee', 0.25), '#22d3ee');
  ctx.strokeStyle = tint; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  caption(ctx, `黄线恒为1 · 尺寸改圆 · 拖点改角`, 16, h - 16);
}
function drawLawSine(ctx, w, h, tint, tt, sz, style) {
  title(ctx, '正弦定理  a/sinA=2R', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * (0.18 + 0.14 * sz);
  ctx.strokeStyle = '#334155'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const offs = [[0, 1.8, 3.5], [0.2, 1.2, 3.8], [0, 2.2, 3.2], [0.4, 1.5, 4.0], [0, 1.0, 3.0], [0.3, 2.0, 3.6]][style % 6];
  const a0 = tt * 0.25;
  const pts = offs.map((o) => [cx + R * Math.cos(a0 + o), cy + R * Math.sin(a0 + o)]);
  fillPoly(ctx, pts, rgba(tint, 0.18), tint);
  pts.forEach((p, i) => {
    ctx.fillStyle = ['#22d3ee', '#f472b6', '#fbbf24'][i];
    ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, TAU); ctx.fill();
  });
  caption(ctx, `预设改变三角形形状 · 尺寸改外接圆`, 16, h - 16);
}

/* ── 微积分 ──────────────────────────────────────────── */
function drawLimit(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '极限逼近  (sin x)/x → 1', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  plotFn(ctx, ox, oy, s, s, -4, 4, (x) => Math.abs(x) < 0.05 ? 1 : Math.sin(x) / x, tint, 2.5);
  const steps = Math.min(28, Math.max(3, n));
  const tphase = (tt * 0.45) % 1;
  for (let i = 1; i <= steps; i++) {
    const x = (1.8 * i) / steps * (1 - tphase * 0.85) * (i % 2 ? 1 : -1);
    const y = Math.sin(x) / x;
    ctx.fillStyle = rgba('#fbbf24', 0.45 + 0.5 * (1 - Math.abs(x) / 2));
    ctx.beginPath(); ctx.arc(ox + x * s, oy - y * s, 4, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#f472b6'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(ox - 4 * s, oy - s); ctx.lineTo(ox + 4 * s, oy - s); ctx.stroke();
  ctx.setLineDash([]);
  caption(ctx, `取样 N=${steps} · count 加密 · 速度改逼近节奏`, 16, h - 16);
}
function drawDerivative(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '导数=切线斜率 · 拖动切点', 16, 22);
  const ox = w * 0.5 + ix.panX * 16, oy = h * 0.55, s = 40 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.42, h * 0.4);
  plotFn(ctx, ox, oy, s, s, -4, 4, Math.sin, tint, 2);
  const x0 = ix.u * 4 - 2;
  const y0 = Math.sin(x0), m = Math.cos(x0);
  ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox + (x0 - 1.6) * s, oy - (y0 - 1.6 * m) * s);
  ctx.lineTo(ox + (x0 + 1.6) * s, oy - (y0 + 1.6 * m) * s);
  ctx.stroke();
  const hstep = 0.3 + 1.2 * (0.2 + 0.8 * Math.abs(Math.sin(tt)));
  if (style % 2 === 0) {
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#22d3ee';
    ctx.beginPath(); ctx.moveTo(ox + x0 * s, oy - y0 * s);
    ctx.lineTo(ox + (x0 + hstep) * s, oy - Math.sin(x0 + hstep) * s); ctx.stroke();
    ctx.setLineDash([]);
  }
  caption(ctx, `x=${x0.toFixed(2)} f'=${m.toFixed(2)} · 预设显/隐割线`, 16, h - 16);
}
function drawIntegral(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '积分=面积 黎曼和', 16, 22);
  const ox = w * 0.12 + ix.panX * 10, oy = h * 0.62, sx = 48 * sz * ix.zoom, sy = 42 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.8, h * 0.4);
  plotFn(ctx, ox, oy, sx, sy, 0, Math.PI, Math.sin, tint, 2);
  const N = Math.min(48, Math.max(3, n));
  const dx = Math.PI / N; let area = 0;
  for (let i = 0; i < N; i++) {
    const x = i * dx; const y = Math.sin(x + dx / 2); area += y * dx;
    ctx.fillStyle = rgba('#22d3ee', 0.35 + 0.3 * Math.sin(tt * 2 + i * 0.2));
    ctx.fillRect(ox + x * sx, oy - Math.max(0, y) * sy, dx * sx - 1, Math.abs(y) * sy);
  }
  caption(ctx, `N=${N} 面积≈${area.toFixed(3)} (真值2) · count=矩形数`, 16, h - 16);
}
function drawTaylor(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '泰勒展开  sin x', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  plotFn(ctx, ox, oy, s, s, -6, 6, Math.sin, '#64748b', 1.5);
  const terms = Math.min(10, Math.max(1, (n % 11) || (2 + style)));
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
  caption(ctx, `前 ${terms} 项 · count/预设改阶数`, 16, h - 16);
}

/* ── 线代 ────────────────────────────────────────────── */
function drawVectors(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '向量运算 · 拖动向量终点', 16, 22);
  const ox = w * 0.35, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.3, h * 0.35);
  // style nudges initial if never dragged
  if (style === 2) { /* orthogonal hint */ if (!ix._locked) { ix.ax = 1.4; ix.ay = 0; ix.bx = 0; ix.by = 1.4; ix._locked = style; } }
  else if (ix._locked !== style && !ix.drag) {
    const tips = [[1.6, 0.9, 0.7, 1.3], [1.2, 1.4, 1.5, 0.4], [1.4, 0, 0, 1.4], [1.8, 0.5, -0.6, 1.2], [1.0, 1.0, 1.2, -0.8], [0.8, 1.5, 1.6, 0.2]];
    const t = tips[style % tips.length];
    ix.ax = t[0]; ix.ay = t[1]; ix.bx = t[2]; ix.by = t[3];
    ix._locked = style;
  }
  const ghosts = Math.min(12, Math.max(1, Math.round(n / 4)));
  for (let i = 1; i <= ghosts; i++) {
    const u = i / (ghosts + 1);
    ctx.globalAlpha = 0.18 + 0.25 * (1 - u);
    arrow(ctx, ox, oy, ox + ix.ax * s * u, oy - ix.ay * s * u, tint, 1.5);
    arrow(ctx, ox, oy, ox + ix.bx * s * u, oy - ix.by * s * u, '#f472b6', 1.5);
  }
  ctx.globalAlpha = 1;
  arrow(ctx, ox, oy, ox + ix.ax * s, oy - ix.ay * s, '#22d3ee', 2.5);
  arrow(ctx, ox, oy, ox + ix.bx * s, oy - ix.by * s, '#f472b6', 2.5);
  arrow(ctx, ox, oy, ox + (ix.ax + ix.bx) * s, oy - (ix.ay + ix.by) * s, '#fbbf24', 2.5);
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(ox + ix.ax * s, oy - ix.ay * s);
  ctx.lineTo(ox + (ix.ax + ix.bx) * s, oy - (ix.ay + ix.by) * s);
  ctx.lineTo(ox + ix.bx * s, oy - ix.by * s); ctx.stroke(); ctx.setLineDash([]);
  const dot = ix.ax * ix.bx + ix.ay * ix.by;
  const cross = ix.ax * ix.by - ix.ay * ix.bx;
  caption(ctx, `a·b=${dot.toFixed(2)}  a×b=${cross.toFixed(2)} · 刻度=${ghosts} · count改辅助向量`, 16, h - 16);
}
function drawMatrix2d(ctx, w, h, tint, tt, sz, style) {
  title(ctx, '矩阵变换 · 旋转/缩放', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 55 * sz;
  axes(ctx, ox, oy, w * 0.35, h * 0.35);
  const ang = tt * (0.4 + style * 0.15);
  const c = Math.cos(ang), sn = Math.sin(ang);
  const sc = 0.6 + 0.5 * sz;
  const apply = (x, y) => style % 2 === 1 ? [c * x * sc, sn * x * 0.3 + y * sc] : [c * x - sn * y, sn * x + c * y];
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
    const [u, v] = apply(x * sc, y * sc);
    return [ox + u * s, oy - v * s];
  });
  fillPoly(ctx, [[ox, oy], [ox + sc * s, oy], [ox + sc * s, oy - sc * s], [ox, oy - sc * s]], rgba('#64748b', 0.15), '#64748b');
  fillPoly(ctx, sq, rgba(tint, 0.3), tint);
  caption(ctx, `θ=${((ang * 180 / Math.PI) % 360).toFixed(0)}° · 预设奇偶切换剪切/纯旋`, 16, h - 16);
}
function drawDeterminant(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '行列式=有向面积 · 拖向量', 16, 22);
  const ox = w * 0.4, oy = h * 0.6, s = 70 * sz;
  axes(ctx, ox, oy, w * 0.35, h * 0.4);
  if (ix._lockedD !== style && !ix.drag) {
    if (style % 2) { ix.ax = 1.0; ix.ay = 0.8; ix.bx = 0.9; ix.by = -0.6; }
    else { ix.ax = 1.2; ix.ay = 0.2; ix.bx = 0.3; ix.by = 1.1; }
    ix._lockedD = style;
  }
  fillPoly(ctx, [
    [ox, oy], [ox + ix.ax * s, oy - ix.ay * s],
    [ox + (ix.ax + ix.bx) * s, oy - (ix.ay + ix.by) * s], [ox + ix.bx * s, oy - ix.by * s],
  ], rgba(tint, 0.35), tint);
  const hatch = Math.min(20, Math.max(2, Math.round(n / 3)));
  ctx.strokeStyle = rgba('#fbbf24', 0.55); ctx.lineWidth = 1.2;
  for (let i = 1; i < hatch; i++) {
    const u = i / hatch;
    ctx.beginPath();
    ctx.moveTo(ox + ix.ax * s * u, oy - ix.ay * s * u);
    ctx.lineTo(ox + ix.ax * s * u + ix.bx * s, oy - ix.ay * s * u - ix.by * s);
    ctx.stroke();
  }
  arrow(ctx, ox, oy, ox + ix.ax * s, oy - ix.ay * s, '#22d3ee', 2.5);
  arrow(ctx, ox, oy, ox + ix.bx * s, oy - ix.by * s, '#f472b6', 2.5);
  const det = ix.ax * ix.by - ix.ay * ix.bx;
  caption(ctx, `det=${det.toFixed(2)} ${det < 0 ? '(反向)' : ''} · 阴影线=${hatch} · count改密度`, 16, h - 16);
}
function drawEigen(ctx, w, h, tint, tt, sz, style) {
  title(ctx, '特征值 / 特征向量', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 50 * sz;
  axes(ctx, ox, oy, w * 0.38, h * 0.38);
  const A = (x, y) => style % 2 ? [1.5 * x + 0.8 * y, 0.8 * x + 1.2 * y] : [2 * x + 0.5 * y, 0.5 * x + y];
  for (let i = 0; i < 24; i++) {
    const th = (i / 24) * TAU + tt * 0.1;
    const v = [Math.cos(th), Math.sin(th)]; const Av = A(v[0], v[1]);
    ctx.strokeStyle = rgba(tint, 0.28);
    ctx.beginPath();
    ctx.moveTo(ox + v[0] * s * 0.55, oy - v[1] * s * 0.55);
    ctx.lineTo(ox + Av[0] * s * 0.4, oy - Av[1] * s * 0.4); ctx.stroke();
  }
  arrow(ctx, ox - s * 0.9, oy, ox + s * 0.9, oy, '#fbbf24', 2);
  arrow(ctx, ox, oy + s * 0.7, ox, oy - s * 0.7, '#f472b6', 2);
  caption(ctx, `预设切换矩阵 · 尺寸改刻度 · 黄/粉≈特征方向示意`, 16, h - 16);
}

/* ── 离散 / 概率 ─────────────────────────────────────── */
function drawVenn(ctx, w, h, tint, tt, sz, style) {
  title(ctx, '集合韦恩图', 16, 22);
  const r = 55 * sz;
  const sep = 0.12 + 0.1 * (style % 3);
  const cx1 = w * (0.5 - sep), cx2 = w * (0.5 + sep), cy = h * 0.5;
  ctx.fillStyle = rgba('#22d3ee', 0.28); ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#f472b6', 0.28); ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba('#fbbf24', 0.4 + 0.25 * Math.sin(tt * 2));
  ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.stroke();
  labelAt(ctx, 'A∩B', (cx1 + cx2) / 2, cy + 4, '#fde68a');
  caption(ctx, `预设改两圆间距 · 尺寸改半径 · 速度改交集闪烁`, 16, h - 16);
}
function drawCombinatorics(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '排列组合  C(n,k)/P(n,k) · 点击圆点', 16, 22);
  const N = Math.min(10, Math.max(3, n % 11 || (3 + style)));
  const K = Math.min(N, Math.max(1, Math.round(1 + sz * 3)));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const C = fact(N) / (fact(K) * fact(N - K));
  const P = fact(N) / fact(N - K);
  const x0 = w * 0.12, gap = Math.min(52, (w * 0.76) / N);
  for (let i = 0; i < N; i++) {
    const x = x0 + i * gap, y = h * 0.4;
    const on = i < K;
    ctx.fillStyle = on ? tint : '#334155';
    ctx.beginPath(); ctx.arc(x, y, 12 + 4 * Math.min(1, sz), 0, TAU); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, y + 4);
  }
  ctx.fillStyle = '#e2e8f0'; ctx.font = '600 16px ui-sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`C(${N},${K})=${C}   P(${N},${K})=${P}`, x0, h * 0.62);
  caption(ctx, `count→n 尺寸→k`, 16, h - 16);
}
function drawSequence(ctx, w, h, tint, tt, sz, n, style) {
  title(ctx, '递推数列', 16, 22);
  const N = Math.min(18, Math.max(5, n));
  const mode = style % 2;
  const seq = mode === 0 ? [1, 1] : [1];
  if (mode === 0) while (seq.length < N) seq.push(seq.at(-1) + seq.at(-2));
  else { const r = 1.2 + 0.25 * sz; while (seq.length < N) seq.push(seq.at(-1) * r); }
  const maxV = Math.max(...seq);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / N, barH = h * 0.55;
  seq.forEach((v, i) => {
    const bh = (v / maxV) * barH;
    const pulse = i === Math.floor(tt * 2) % N ? 1.12 : 1;
    ctx.fillStyle = rgba(tint, 0.45 + 0.45 * (i / N));
    ctx.fillRect(x0 + i * barW + 2, y0 - bh * pulse, barW - 4, bh * pulse);
  });
  caption(ctx, mode === 0 ? `斐波那契 n=${N}` : `等比 n=${N} · 预设切类型`, 16, h - 16);
}
function drawShortest(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '最短路 · 点击节点高亮路径前缀', 16, 22);
  const nodes = [[0.15, 0.55], [0.35, 0.3], [0.35, 0.75], [0.55, 0.45], [0.75, 0.3], [0.75, 0.7], [0.9, 0.5]].map(([x, y]) => [x * w, y * h]);
  const edges = [[0, 1, 2], [0, 2, 4], [1, 3, 3], [2, 3, 1], [1, 4, 5], [3, 4, 2], [3, 5, 4], [4, 6, 2], [5, 6, 3], [2, 5, 6]];
  const path = [0, 2, 3, 4, 6];
  const progress = Math.min(path.length - 1, Math.max(ix.node, Math.floor((tt * 0.7) % (path.length + 1))));
  edges.forEach(([a, b, wt]) => {
    const onPath = path.slice(0, progress + 1).includes(a) && path.slice(0, progress + 1).includes(b)
      && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    ctx.strokeStyle = onPath ? tint : '#334155'; ctx.lineWidth = onPath ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[b][0], nodes[b][1]); ctx.stroke();
    if (n > 6) {
      ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(wt), (nodes[a][0] + nodes[b][0]) / 2, (nodes[a][1] + nodes[b][1]) / 2 - 4);
    }
  });
  nodes.forEach((p, i) => {
    const reached = path.indexOf(i) >= 0 && path.indexOf(i) <= progress;
    ctx.fillStyle = reached ? tint : '#1e293b';
    ctx.strokeStyle = i === ix.node ? '#fbbf24' : '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p[0], p[1], 10 + 4 * sz, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String.fromCharCode(65 + i), p[0], p[1] + 4);
  });
  caption(ctx, `进度 ${progress} · 点击节点 / 速度推进`, 16, h - 16);
}
function drawModular(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '模运算 · 点击剩余类', 16, 22);
  const m = Math.min(16, Math.max(4, n));
  const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.3 * sz;
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const val = Math.floor(tt * 1.5 + style * 3);
  const rem = ix.node != null && ix.node < m ? ix.node : ((val % m) + m) % m;
  for (let i = 0; i < m; i++) {
    const a = -Math.PI / 2 + (i / m) * TAU;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    ctx.fillStyle = i === rem ? tint : '#1e293b';
    ctx.strokeStyle = i === rem ? '#fbbf24' : '#475569';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i), x, y + 4);
  }
  caption(ctx, `${val} ≡ ${rem} (mod ${m}) · count=m`, 16, h - 16);
}
function drawBinomial(ctx, w, h, tint, tt, sz, n, style) {
  title(ctx, '二项分布 B(n,p)', 16, 22);
  const N = Math.min(28, Math.max(5, n + 2));
  const p = 0.15 + 0.7 * (sz / 2) * (0.5 + 0.5 * Math.sin(tt * 0.25 + style));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const pdf = [];
  for (let k = 0; k <= N; k++) pdf.push(fact(N) / (fact(k) * fact(N - k)) * Math.pow(p, k) * Math.pow(1 - p, N - k));
  const maxP = Math.max(...pdf);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / (N + 1), barH = h * 0.55;
  pdf.forEach((v, i) => {
    ctx.fillStyle = rgba(tint, 0.4 + 0.55 * (v / maxP));
    ctx.fillRect(x0 + i * barW + 1, y0 - (v / maxP) * barH, barW - 2, (v / maxP) * barH);
  });
  caption(ctx, `n=${N} p=${p.toFixed(2)} · 尺寸/速度改 p`, 16, h - 16);
}
function drawNormal(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '正态分布 · 拖平移/滚轮缩放', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const mu = Math.sin(tt * 0.3) * (style % 2 ? 1.8 : 0.8);
  const sigma = 0.45 + 0.7 * sz;
  const gauss = (x) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(TAU));
  ctx.beginPath(); ctx.moveTo(ox - 4 * s, oy);
  for (let i = 0; i <= 120; i++) {
    const x = -4 + 8 * i / 120;
    ctx.lineTo(ox + x * s, oy - gauss(x) * s * 4);
  }
  ctx.lineTo(ox + 4 * s, oy); ctx.closePath();
  ctx.fillStyle = rgba(tint, 0.32); ctx.fill();
  plotFn(ctx, ox, oy, s, s * 4, -4, 4, gauss, tint, 2.5);
  caption(ctx, `μ=${mu.toFixed(2)} σ=${sigma.toFixed(2)}`, 16, h - 16);
}
function drawCLT(ctx, w, h, tint, tt, sz, n, style) {
  title(ctx, '中心极限定理', 16, 22);
  const samples = Math.min(48, 6 + n * 2);
  const means = [];
  let s0 = (Math.floor(tt * 2) + style * 17) * 9973;
  const rnd = () => { s0 = (s0 * 16807) % 2147483647; return (s0 & 0xffff) / 0xffff; };
  for (let i = 0; i < 220; i++) {
    let sum = 0; for (let j = 0; j < samples; j++) sum += 1 + Math.floor(rnd() * 6);
    means.push(sum / samples);
  }
  const bins = 16, min = 1, max = 6, counts = new Array(bins).fill(0);
  means.forEach((m) => { counts[Math.min(bins - 1, Math.max(0, Math.floor(((m - min) / (max - min)) * bins)))]++; });
  const maxC = Math.max(...counts, 1);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / bins, barH = h * 0.5;
  counts.forEach((c, i) => {
    ctx.fillStyle = rgba(tint, 0.4 + 0.5 * (c / maxC));
    ctx.fillRect(x0 + i * barW + 1, y0 - (c / maxC) * barH, barW - 2, (c / maxC) * barH);
  });
  caption(ctx, `每组 n=${samples} · count 增大样本`, 16, h - 16);
}
