import { makeCanvas, loop, bar, defaultParams, paramsFromSpec, readLiveControls, localPoint } from './_shared.js';
import { withControls } from './withControls.js';
import { createInfoPanel, alignDocParams } from './info-panel.js';
import { MATH_DOCS } from './math-docs.js';

/** per-frame readout values written by the active draw function (synchronous, so safe to share) */
let OUT = {};

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


/**
 * Per-family DemoControls: only knobs that change canvas or live math readout.
 * extras = demo-specific meaningful controls (preferred over generic count/size).
 */
const FAMILY_CONTROLS = {
  pythagoras: {
    color: true, speed: false, size: false, count: false,
    extras: [
      { key: 'sideA', type: 'range', label: '直角边 a', min: 4, max: 18, step: 0.1, value: 10.5 },
      { key: 'sideB', type: 'range', label: '直角边 b', min: 4, max: 18, step: 0.1, value: 10 },
      { key: 'showSq', type: 'toggle', label: '三边正方形', value: true },
    ],
  },
  'similar-tri': {
    color: true, speed: false, size: false, count: false,
    extras: [{ key: 'simT', type: 'range', label: '相似比 t', min: 0.15, max: 0.85, step: 0.01, value: 0.35 }],
  },
  'circle-angles': { color: true, speed: { label: '旋转速度' }, size: { label: '圆半径' }, count: false },
  'area-volume': { color: true, speed: false, size: { label: '尺度' }, count: { label: '分层数', min: 3, max: 24, step: 1, value: 8, buttons: true } },
  'coord-geo': { color: true, speed: false, size: { label: '坐标缩放' }, count: { label: '等分点数', min: 2, max: 40, step: 1, value: 10, buttons: true } },
  conics: { color: true, speed: false, size: { label: '缩放' }, count: { label: '曲线类型', min: 1, max: 6, step: 1, value: 3, buttons: true } },
  linear: { color: true, speed: { label: '截距摆动' }, size: { label: '斜率 |k|' }, count: { label: '取样点', min: 3, max: 40, step: 1, value: 12, buttons: true } },
  quadratic: { color: true, speed: { label: '顶点漂移' }, size: { label: '|a| 大小' }, count: false },
  'exp-log': { color: true, speed: false, size: { label: '底数相关' }, count: { label: '取样点', min: 3, max: 40, step: 1, value: 12, buttons: true } },
  power: { color: true, speed: false, size: { label: '缩放' }, count: { label: '曲线条数', min: 1, max: 6, step: 1, value: 3, buttons: true } },
  piecewise: { color: true, speed: { label: '动点速度' }, size: { label: '中段系数' }, count: { label: '分段数', min: 2, max: 8, step: 1, value: 3, buttons: true } },
  parametric: { color: true, speed: { label: '绘制速度' }, size: { label: '图形大小' }, count: { label: '频率比 b', min: 1, max: 6, step: 1, value: 2, buttons: true } },
  polar: { color: true, speed: { label: '绘制速度' }, size: { label: '大小' }, count: { label: '花瓣 k', min: 2, max: 8, step: 1, value: 3, buttons: true } },
  'unit-circle': { color: true, speed: { label: '旋转速度' }, size: { label: '圆半径' }, count: false },
  'trig-id': { color: true, speed: { label: '旋转速度' }, size: { label: '大小' }, count: false },
  'law-sine': { color: true, speed: { label: '旋转' }, size: { label: '外接圆' }, count: false },
  limit: { color: true, speed: { label: '逼近节奏' }, size: { label: '缩放' }, count: { label: '取样点数', min: 3, max: 36, step: 1, value: 12, buttons: true } },
  derivative: { color: true, speed: { label: '割线动画' }, size: { label: '缩放' }, count: false },
  integral: { color: true, speed: false, size: { label: '缩放' }, count: { label: '矩形数 N', min: 3, max: 48, step: 1, value: 12, buttons: true } },
  taylor: { color: true, speed: false, size: { label: '缩放' }, count: { label: '展开项数', min: 1, max: 10, step: 1, value: 4, buttons: true } },
  vectors: { color: true, speed: false, size: { label: '缩放' }, count: false },
  'matrix-2d': { color: true, speed: { label: '旋转速度' }, size: { label: '缩放' }, count: false },
  determinant: { color: true, speed: false, size: { label: '缩放' }, count: { label: '阴影线密度', min: 2, max: 24, step: 1, value: 8, buttons: true } },
  eigen: { color: true, speed: { label: '测试向量转速' }, size: { label: '缩放' }, count: false },
  venn: { color: true, speed: false, size: { label: '圆半径' }, count: false },
  combinatorics: { color: true, speed: false, size: { label: '选取 k', min: 0, max: 10, step: 1, value: 3, buttons: true }, count: { label: '元素 n', min: 3, max: 10, step: 1, value: 6, buttons: true } },
  sequence: { color: true, speed: { label: '推进速度' }, size: { label: '初值 a₂ / 公比 r' }, count: { label: '项数', min: 5, max: 20, step: 1, value: 10, buttons: true } },
  'shortest-path': { color: true, speed: { label: '推进速度' }, size: { label: '节点大小' }, count: false, extras: [{ key: 'showW', type: 'toggle', label: '显示边权', value: true }] },
  modular: { color: true, speed: { label: '自动计数' }, size: { label: '钟面大小' }, count: { label: '模 m', min: 4, max: 16, step: 1, value: 7, buttons: true } },
  binomial: { color: true, speed: { label: 'p 摆动' }, size: { label: '成功概率 p' }, count: { label: '试验次数 n', min: 3, max: 30, step: 1, value: 10, buttons: true } },
  normal: { color: true, speed: { label: 'μ 漂移' }, size: { label: 'σ 宽度' }, count: false },
  clt: { color: true, speed: { label: '重抽样' }, size: false, count: { label: '每组样本', min: 2, max: 30, step: 1, value: 8, buttons: true } },
};

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'pythagoras').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'pythagoras';
  const spec = FAMILY_CONTROLS[fam] || { color: true, speed: false, size: true, count: false };
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-math',
    title: fam,
    fallbackVariant: fam,
    params: paramsFromSpec(spec),
    mapVariant: (family, n) => `${family}-${n}`,
    remountKeys: spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count', 'blur'],
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
    const stageEl = host.closest?.('.kit-stage') || host.parentElement;
    const cur = (typeof stageEl?.__getControls === 'function' ? stageEl.__getControls() : null) || ctrl;
    const extra = {};
    for (const [k, v] of Object.entries(cur)) {
      if (['color', 'speed', 'size', 'count', 'blur', 'style', 'styleName', 'easing'].includes(k)) continue;
      extra[k] = v;
    }
    return {
      ...L,
      ...extra,
      style: Number.isFinite(cur.style) ? cur.style : (Number.isFinite(ctrl.style) ? ctrl.style : 0),
      styleName: cur.styleName || ctrl.styleName || '',
    };
  };
  const info = createInfoPanel(stage, {
    doc: alignDocParams(MATH_DOCS[family] || MATH_DOCS.pythagoras, FAMILY_CONTROLS[family] || {}),
    onHover: (k) => { ix.hl = k; },
  });
  const { canvas, ctx, state, dispose } = makeCanvas(info.canvasBox);

  // interaction state (world-ish normalized params)
  const ix = {
    drag: null, // { key, ox, oy }
    u: 0.35, // similar-tri / unit-circle / derivative param
    ax: 1.6, ay: 0.9, bx: 0.7, by: 1.3, // vectors / determinant
    px: -2, py: 1.5, qx: 3, qy: -1, // coord-geo points
    panX: 0, panY: 0, zoom: 1, // function plots
    theta: 0.8, // unit circle
    node: 0, // shortest-path click
    sc: null, // scrub 0..1 for families without handles (drag horizontally)
    hl: null, // readout row hover → canvas highlight key
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
        // node/mod hits are handled below (select + scrub); don't swallow as a dead drag key
        if (hit.key === 'node' || hit.key === 'mod') { if (d < bd) { bd = d; best = hit; } continue; }
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
    if (family === 'shortest-path' || family === 'modular') {
      // click nearest node; keep scrubbing so a drag from the handle also advances progress
      let nb = null, nd = 1e9;
      for (const hit of hits) {
        const d = Math.hypot(p.x - hit.x, p.y - hit.y);
        if (d < nd) { nd = d; nb = hit; }
      }
      const soft = Math.max(40, Math.min(w, h) * 0.12);
      if (nb && nd < soft) {
        ix.node = nb.idx ?? 0; ix.nodeSet = true;
        if (family === 'modular') ix.sc = null;
        else {
          const path = [0, 2, 3, 4, 6];
          let pi = path.indexOf(ix.node);
          if (pi < 0) pi = Math.round((ix.sc ?? 0) * (path.length - 1));
          ix.sc = pi / Math.max(1, path.length - 1);
          ix.drag = { key: 'scrub', x0: p.x, sc0: ix.sc };
          canvas.setPointerCapture?.(e.pointerId);
        }
        e.preventDefault();
        return;
      }
    }
    // empty drag = pan for plot families (probe at canvas centre follows)
    if (PAN_FAMILIES.includes(family)) {
      ix.drag = { key: 'pan', x0: p.x, y0: p.y, panX0: ix.panX, panY0: ix.panY };
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    // everything else: horizontal scrub drives the family's main parameter
    if (SCRUB_FAMILIES.includes(family)) {
      ix.drag = { key: 'scrub' };
      applyDrag(family, ix, p, w, h, L);
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
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
    if (!['linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'limit', 'derivative', 'integral', 'taylor', 'polar', 'parametric', 'normal', 'conics', 'coord-geo'].includes(family)) return;
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
    OUT = { _pts: {} };
    ix._live = L;
    // a slider moved -> it takes over from any earlier canvas scrub, so the knob is never silently ignored
    const knobSig = ['size', 'count', ...Object.keys(L).filter((k) => !['color', 'speed', 'size', 'count', 'style', 'styleName', 'sideA', 'sideB', 'simT'].includes(k))].map((k) => L[k]).join('|');
    if (ix._knobSig != null && knobSig !== ix._knobSig && !ix.drag) { ix.sc = null; }
    ix._knobSig = knobSig;
    // two-way binding: slider -> figure when idle; dragging the figure writes back into the slider
    const stageEl = host.closest?.('.kit-stage') || host.parentElement;
    const push = (patch) => { if (typeof stageEl?.__setControls === 'function') stageEl.__setControls(patch); };
    if (family === 'pythagoras') {
      const k = 10 * Math.min(1, h / 440);
      const cl = (v) => Math.round(Math.max(4, Math.min(18, v)) * 10) / 10;
      if (ix.drag) {
        if (ix._a != null && ix._b != null) push({ sideA: cl(ix._a / k), sideB: cl(ix._b / k) });
      } else {
        if (L.sideA != null) ix._a = Number(L.sideA) * k;
        if (L.sideB != null) ix._b = Number(L.sideB) * k;
      }
    }
    if (family === 'similar-tri') {
      if (ix.drag) { if (Number.isFinite(ix.u)) push({ simT: Math.round(Math.max(0.15, Math.min(0.85, ix.u)) * 100) / 100 }); }
      else if (L.simT != null) ix.u = Number(L.simT);
    }
    if (family === 'combinatorics' && ix.drag && ix.sc != null) {
      const N = Math.min(10, Math.max(3, Math.round(n)));
      push({ size: Math.min(N, Math.max(0, Math.round(ix.sc * N))) });
    }
    drawFamily(ctx, family, w, h, tint, tt, sz, n, L, ix);
    const vals = OUT;
    // interaction affordance
    drawHandles(ctx, family, w, h, L, ix, tint);
    drawHighlight(ctx, family, w, h, L, ix, vals, t);
    vals.L = { size: sz, speed: spd, count: n, style: L.style || 0, styleName: L.styleName || '' };
    const hs = hitTargets(family, w, h, L, ix);
    const hp = hs[0] && !['shortest-path', 'modular'].includes(family) ? hs[0] : { x: w * 0.5, y: h * 0.5 };
    info.update(vals, {
      ix: ixSig(ix),
      handle: `${Math.round(hp.x)},${Math.round(hp.y)}`,
      dbg: `size=${sz.toFixed(2)} speed=${spd.toFixed(2)} count=${n} preset=${L.styleName || L.style || 0}`,
    });
  });
  return () => {
    stop();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    dispose();
    info.destroy();
    host.innerHTML = '';
  };
}

/* ── helpers ─────────────────────────────────────────── */
const TAU = Math.PI * 2;
const PAN_FAMILIES = ['linear', 'quadratic', 'exp-log', 'power', 'piecewise', 'derivative', 'taylor', 'normal'];
const SCRUB_FAMILIES = ['circle-angles', 'area-volume', 'conics', 'parametric', 'polar', 'law-sine', 'limit', 'integral',
  'matrix-2d', 'eigen', 'venn', 'combinatorics', 'sequence', 'shortest-path', 'modular', 'binomial', 'clt'];
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
function ixSig(ix) {
  return JSON.stringify({ u: r3(ix.u), a: r3(ix._a), b: r3(ix._b), ax: r3(ix.ax), ay: r3(ix.ay), bx: r3(ix.bx), by: r3(ix.by),
    px: r3(ix.px), py: r3(ix.py), qx: r3(ix.qx), qy: r3(ix.qy), pan: [r3(ix.panX), r3(ix.panY)], z: r3(ix.zoom),
    th: ix.thSet ? r3(ix.theta) : undefined, node: ix.nodeSet ? ix.node : undefined, sc: r3(ix.sc) });
}
/** probe: vertical guide at canvas centre; returns world x and plots f(x) dot */
function probe(ctx, ox, oy, sx, sy, w, h, fn, color = '#fbbf24') {
  const xp = (w * 0.5 - ox) / sx;
  const yp = fn(xp);
  ctx.save();
  ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(251,191,36,.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.5, 34); ctx.lineTo(w * 0.5, h - 28); ctx.stroke(); ctx.setLineDash([]);
  if (Number.isFinite(yp) && Math.abs(yp) < 40) {
    ctx.fillStyle = color; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w * 0.5, oy - yp * sy, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
    OUT._pts.probe = [w * 0.5, oy - yp * sy];
  }
  ctx.restore();
  return { xp, yp };
}
function scrubBar(ctx, w, h, v, label) {
  // thin affordance at top-right showing the scrub parameter
  const bw = Math.min(160, w * 0.3), bx = w - bw - 14, by = 16;
  ctx.fillStyle = '#1e293b'; ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(bx, by, bw * Math.min(1, Math.max(0, v)), 4);
  ctx.beginPath(); ctx.arc(bx + bw * Math.min(1, Math.max(0, v)), by + 2, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#64748b'; ctx.font = '10px ui-sans-serif,system-ui'; ctx.textAlign = 'right';
  ctx.fillText(label, bx + bw, by + 18); ctx.textAlign = 'left';
}
function drawHighlight(ctx, family, w, h, L, ix, vals, t) {
  if (!ix.hl) return;
  let pt = vals._pts && vals._pts[ix.hl];
  if (!pt) {
    const hit = hitTargets(family, w, h, L, ix).find((x) => x.key === ix.hl);
    if (hit) pt = [hit.x, hit.y];
  }
  if (!pt) return;
  const r = 14 + 4 * Math.sin(t * 6);
  ctx.save();
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2.5; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, TAU); ctx.stroke();
  ctx.restore();
}
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

function circleGeom(family, w, h, sz) {
  if (family === 'trig-id') return { cx: w * 0.72, cy: h * 0.5, R: 55 * sz };
  const R = Math.min(70, w * 0.12) * sz;
  return { cx: 16 + R + 20, cy: h * 0.5, R };
}
function hitTargets(family, w, h, L, ix) {
  const sz = L.size > 0 ? L.size : 1;
  if (family === 'pythagoras') {
    const ratios = [[3, 4], [1, 1], [2, 5], [5, 2], [4, 3], [3, 4]][(L.style || 0) % 6];
    const kf = Math.min(1, h / 440);
    const a = ix._a ?? (55 + 50 * sz * (ratios[0] / 3)) * kf;
    const b = ix._b ?? (40 + 45 * sz * (ratios[1] / 3)) * kf;
    const ox = w * 0.3, oy = h * 0.6;
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
    const { cx, cy, R } = circleGeom(family, w, h, sz);
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
    const ox = w * 0.5 + ix.panX * 16, oy = h * 0.55, s = 40 * sz * ix.zoom;
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
  if (d.key === 'scrub') {
    if (Number.isFinite(d.x0) && Number.isFinite(d.sc0)) {
      ix.sc = Math.min(1, Math.max(0, d.sc0 + (p.x - d.x0) / Math.max(1, w * 0.55)));
    } else {
      ix.sc = Math.min(1, Math.max(0, (p.x - w * 0.06) / Math.max(1, w * 0.88)));
    }
    if (family === 'shortest-path') { ix.node = [0, 2, 3, 4, 6][Math.round(ix.sc * 4)]; ix.nodeSet = true; }
    if (family === 'modular') ix.node = null;
    return;
  }
  if (family === 'pythagoras') {
    const ox = w * 0.3, oy = h * 0.6;
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
    const { cx, cy, R } = circleGeom(family, w, h, sz);
    ix.theta = Math.atan2(cy - (p.y - d.dy), (p.x - d.dx) - cx);
    ix.thSet = true;
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
    const ox = w * 0.5 + ix.panX * 16, s = 40 * sz * ix.zoom;
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
    case 'circle-angles': return drawCircleAngles(ctx, w, h, tint, tt, sz, style, ix);
    case 'area-volume': return drawAreaVolume(ctx, w, h, tint, tt, sz, n, style, ix);
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
    case 'law-sine': return drawLawSine(ctx, w, h, tint, tt, sz, style, ix);
    case 'limit': return drawLimit(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'derivative': return drawDerivative(ctx, w, h, tint, tt, sz, style, ix);
    case 'integral': return drawIntegral(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'taylor': return drawTaylor(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'vectors': return drawVectors(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'matrix-2d': return drawMatrix2d(ctx, w, h, tint, tt, sz, style, ix);
    case 'determinant': return drawDeterminant(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'eigen': return drawEigen(ctx, w, h, tint, tt, sz, style, ix);
    case 'venn': return drawVenn(ctx, w, h, tint, tt, sz, style, ix);
    case 'combinatorics': return drawCombinatorics(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'sequence': return drawSequence(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'shortest-path': return drawShortest(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'modular': return drawModular(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'binomial': return drawBinomial(ctx, w, h, tint, tt, sz, n, style, ix);
    case 'normal': return drawNormal(ctx, w, h, tint, tt, sz, style, ix);
    case 'clt': return drawCLT(ctx, w, h, tint, tt, sz, n, style, ix);
    default: return drawPythagoras(ctx, w, h, tint, tt, sz, style, ix);
  }
}

/* ── 几何 ────────────────────────────────────────────── */
function drawPythagoras(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '勾股定理  a² + b² = c²  · 拖动直角边端点或右侧滑条', 16, 22);
  const ratios = [[3, 4], [1, 1], [2, 5], [5, 2], [4, 3], [3, 4]][style % 6];
  const kf = Math.min(1, h / 440);
  let a = ix._a ?? (55 + 50 * (ratios[0] / 3)) * kf;
  let b = ix._b ?? (40 + 45 * (ratios[1] / 3)) * kf;
  ix._a = a; ix._b = b;
  const c = Math.hypot(a, b);
  const ox = w * 0.3, oy = h * 0.6;
  fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox, oy - b]], rgba(tint, 0.2), tint);
  const showSq = ix._live?.showSq !== false && ix._live?.showSq !== 0 && ix._live?.showSq !== '0';
  if (showSq) {
    fillPoly(ctx, [[ox, oy], [ox + a, oy], [ox + a, oy + a], [ox, oy + a]], rgba('#22d3ee', 0.28), '#22d3ee');
    labelAt(ctx, `a²`, ox + a / 2, oy + a / 2 + 4, '#67e8f9');
    fillPoly(ctx, [[ox, oy], [ox, oy - b], [ox - b, oy - b], [ox - b, oy]], rgba('#f472b6', 0.28), '#f472b6');
    labelAt(ctx, `b²`, ox - b / 2, oy - b / 2 + 4, '#f9a8d4');
    const ang = Math.atan2(-b, a);
    ctx.save(); ctx.translate(ox + a, oy); ctx.rotate(ang);
    fillPoly(ctx, [[0, 0], [-c, 0], [-c, -c], [0, -c]], rgba('#fbbf24', 0.3), '#fbbf24');
    labelAt(ctx, `c²`, -c / 2, -c / 2 + 4, '#fde68a');
    ctx.restore();
  } else {
    ctx.strokeStyle = tint; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + a, oy); ctx.lineTo(ox, oy - b); ctx.closePath(); ctx.stroke();
  }
  OUT = { ...OUT, a: a / 10, b: b / 10, c: c / 10, showSq: !!showSq };
  OUT._pts.A = [ox + a, oy]; OUT._pts.B = [ox, oy - b]; OUT._pts.C = [ox + a / 2, oy - b / 2];
  caption(ctx, `a=${(a / 10).toFixed(1)} b=${(b / 10).toFixed(1)} c=${(c / 10).toFixed(1)} · 右侧调 a/b · 拖黄点`, 16, h - 16);
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
  OUT = { ...OUT, t, k: 1 - t, AB: Math.hypot(B[0] - A[0], B[1] - A[1]) / 40, PQ: Math.hypot(Q[0] - P[0], Q[1] - P[1]) / 40 };
  OUT._pts.u = P; OUT._pts.Q = Q;
  caption(ctx, `相似比 t=${t.toFixed(2)} · 速度仅影响标题脉冲色相偏移`, 16, h - 16);
  // color pulse via tt to make speed visible
  ctx.strokeStyle = rgba(tint, 0.35 + 0.35 * Math.sin(tt * 3));
  ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
}

function drawCircleAngles(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '圆心角与圆周角  ∠圆心 = 2·∠圆周', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * (0.2 + 0.14 * sz);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const spanBase = [0.7, 1.2, 2.0, 2.5, 1.0, 1.6][style % 6];
  const a0 = tt * 0.45, span = ix.sc != null ? 0.3 + ix.sc * 2.8 : spanBase;
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
  OUT = { ...OUT, span, R: R / 40, arc: (R / 40) * span };
  OUT._pts.O = [cx, cy]; OUT._pts.P = P;
  scrubBar(ctx, w, h, (span - 0.3) / 2.8, '拖动画布 → 弧宽');
  caption(ctx, `圆心角 ${(span * 180 / Math.PI).toFixed(0)}° · 圆周角 ${(span * 90 / Math.PI).toFixed(0)}° · 预设改弧宽 · 尺寸改半径`, 16, h - 16);
}

function drawAreaVolume(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '棱锥与球 · 体积关系', 16, 22);
  const r = (30 + 35 * sz) * (ix.sc != null ? 0.5 + ix.sc : 1);
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
  OUT = { ...OUT, r: r / 20, base: base / 20, height: height / 20, layers };
  OUT._pts.sphere = [sx, sy]; OUT._pts.apex = apex;
  scrubBar(ctx, w, h, ix.sc ?? 0.5, '拖动画布 → 球半径');
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
  OUT = { ...OUT, ax: ix.px, ay: ix.py, bx: ix.qx, by: ix.qy, dist, slope, ticks };
  OUT._pts.M = M;
  caption(ctx, `|AB|=${dist.toFixed(2)}  k=${slope.toFixed(2)}  分点=${ticks} · count改分点`, 16, h - 16);
}

function drawConics(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '圆锥曲线 · 预设/数量 切换类型', 16, 22);
  const ox = w * 0.5 + ix.panX * 10, oy = h * 0.52 + ix.panY * 10, s = 22 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.42, h * 0.38);
  const mode = style % 3; // preset drives type; count also shifts
  const mode2 = (mode + Math.floor((n - 1) / 3)) % 3;
  if (mode2 === 0) {
    const a = ix.sc != null ? 2 + ix.sc * 3 : 3.2 + sz + 0.3 * Math.sin(tt), b = 1.8 + 0.4 * sz;
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
    OUT = { ...OUT, type: 'ellipse', a, b, c, e: c / a };
    OUT._pts.F1 = [ox - c * s, oy]; OUT._pts.F2 = [ox + c * s, oy];
    caption(ctx, `椭圆 · a=${a.toFixed(1)} b=${b.toFixed(1)}`, 16, h - 16);
  } else if (mode2 === 1) {
    const ha = ix.sc != null ? 0.5 + ix.sc * 2 : 1;
    ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath(); let first = true;
      for (let i = 0; i <= 60; i++) {
        const x = ha + i * 0.1; const y = Math.sqrt(Math.max(0, x * x - ha * ha));
        const px = ox + sx * x * s, py = oy - sy * y * s;
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    const hc = Math.SQRT2 * ha;
    OUT = { ...OUT, type: 'hyperbola', a: ha, b: ha, c: hc, e: hc / ha };
    ctx.fillStyle = '#fbbf24'; [-1, 1].forEach((q) => { ctx.beginPath(); ctx.arc(ox + q * hc * s, oy, 4, 0, TAU); ctx.fill(); });
    OUT._pts.F1 = [ox - hc * s, oy]; OUT._pts.F2 = [ox + hc * s, oy];
    caption(ctx, `双曲线  x²/a² − y²/a² = 1`, 16, h - 16);
  } else {
    const pk = (0.2 + 0.1 * sz) * (ix.sc != null ? 0.4 + ix.sc * 1.6 : 1);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = -4 + i * 0.08; const y = pk * x * x - 1;
      const px = ox + x * s, py = oy - y * s;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    const fy = -1 + 1 / (4 * pk);
    OUT = { ...OUT, type: 'parabola', k: pk, p: 1 / (2 * pk), focusY: fy, e: 1 };
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox, oy - fy * s, 4, 0, TAU); ctx.fill();
    OUT._pts.F1 = [ox, oy - fy * s];
    caption(ctx, `抛物线  y = kx² − 1`, 16, h - 16);
  }
  scrubBar(ctx, w, h, ix.sc ?? 0.5, '拖动画布 → 改 a / 开口');
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
  const pr = probe(ctx, ox, oy, s, s, w, h, (x) => k * x + b);
  OUT = { ...OUT, k, b, root: k ? -b / k : NaN, ...pr, dots };
  OUT._pts.b = [ox, oy - b * s];
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
  const pr = probe(ctx, ox, oy, s, s, w, h, (x) => a * x * x + b * x + c);
  OUT = { ...OUT, a, b, c, vx, vy, disc, ...pr };
  OUT._pts.V = [ox + vx * s, oy - vy * s];
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
  const pr = probe(ctx, ox, oy, s, s * 0.55, w, h, (x) => Math.pow(base, x));
  OUT = { ...OUT, base, xp: pr.xp, ax: pr.yp, lg: pr.xp > 0 ? Math.log(pr.xp) / Math.log(base) : NaN, samples };
  caption(ctx, `底 a=${base.toFixed(2)} · 取样=${samples} · count改点`, 16, h - 16);
}
function drawPower(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '幂函数  y=xⁿ', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const exps = [1, 2, 3, 0.5, -1];
  const colors = [tint, '#f472b6', '#22d3ee', '#fbbf24', '#a78bfa'];
  const showN = Math.min(exps.length, Math.max(1, Math.round(n)));
  for (let i = 0; i < showN; i++) {
    const p = exps[i];
    plotFn(ctx, ox, oy, s, s, p < 0 ? 0.2 : -2.2, 2.2, (x) => {
      if (p === 0.5 && x < 0) return NaN;
      if (p < 0 && Math.abs(x) < 0.15) return NaN;
      return Math.sign(x) * Math.pow(Math.abs(x), p);
    }, colors[i], 2);
  }
  const xp = (w * 0.5 - ox) / s;
  const powv = (p, x) => (p === 0.5 && x < 0) || (p < 0 && x === 0) ? NaN : Math.sign(x) * Math.pow(Math.abs(x), p);
  probe(ctx, ox, oy, s, s, w, h, (x) => powv(exps[0], x));
  OUT = { ...OUT, xp, exps: exps.slice(0, showN), vals: exps.slice(0, showN).map((p) => powv(p, xp)), showN };
  caption(ctx, `显示 ${showN} 条 · count/预设改条数`, 16, h - 16);
}
function drawPiecewise(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '分段函数', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  const segs = Math.min(8, Math.max(2, Math.round(n)));
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
  const pf = (x) => (x < -1 ? -x - 1 : x <= 1 ? x * x * (0.6 + 0.4 * sz) : 2 - x / (1 + style % 3));
  const pr = probe(ctx, ox, oy, s, s, w, h, pf);
  OUT = { ...OUT, segs, cursor, yv, ...pr, piece: pr.xp < -1 ? 1 : pr.xp <= 1 ? 2 : 3, q: 0.6 + 0.4 * sz, d: 1 + style % 3 };
  OUT._pts.cursor = [ox + cursor * s, oy - yv * s];
  caption(ctx, `分段数=${segs} · count改段数 · 预设改右段斜率`, 16, h - 16);
}
function drawParametric(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '参数方程 · 李萨如', 16, 22);
  const ox = w * 0.5 + ix.panX * 10, oy = h * 0.52, sc = 60 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.4, h * 0.38);
  const b = Math.max(1, Math.min(8, Math.round(n)));
  ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.beginPath();
  const T = tt * 1.5;
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * Math.min(T, TAU * 2);
    const x = ox + Math.cos(t) * sc;
    const y = oy - Math.sin(b * t) * sc * 0.7;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  const tc = ix.sc != null ? ix.sc * TAU : (T % TAU);
  const dx = ox + Math.cos(tc) * sc, dy = oy - Math.sin(b * tc) * sc * 0.7;
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(dx, dy, 6, 0, TAU); ctx.fill();
  OUT = { ...OUT, b, t: tc, x: Math.cos(tc), y: Math.sin(b * tc) };
  OUT._pts.P = [dx, dy];
  scrubBar(ctx, w, h, tc / TAU, '拖动画布 → 参数 t');
  caption(ctx, `y=sin(${b}t) · count/预设改频率比`, 16, h - 16);
}
function drawPolar(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '极坐标 玫瑰线', 16, 22);
  const ox = w * 0.5, oy = h * 0.52;
  ctx.strokeStyle = '#1e293b';
  for (let r = 30; r <= 140 * sz * ix.zoom; r += 30) { ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.stroke(); }
  const k = Math.max(2, Math.min(8, Math.round(n)));
  const a = 80 * sz * ix.zoom;
  ctx.strokeStyle = tint; ctx.lineWidth = 2.2; ctx.beginPath();
  const fullTh = TAU * (k % 2 === 0 ? 2 : 1);
  const maxTh = ix.sc != null ? Math.max(0.02, ix.sc) * fullTh : Math.min((tt * 1.3) % (fullTh + 1), fullTh); // redraw in a loop with a short hold
  for (let i = 0; i <= 500; i++) {
    const th = (i / 500) * maxTh;
    const r = a * Math.cos(k * th);
    const x = ox + r * Math.cos(th), y = oy + r * Math.sin(th);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  const rEnd = Math.cos(k * maxTh);
  const ex = ox + a * rEnd * Math.cos(maxTh), ey = oy + a * rEnd * Math.sin(maxTh);
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, TAU); ctx.fill();
  OUT = { ...OUT, k, th: maxTh, r: rEnd, petals: k % 2 ? k : 2 * k };
  OUT._pts.P = [ex, ey];
  scrubBar(ctx, w, h, maxTh / fullTh, '拖动画布 → θ');
  caption(ctx, `r=cos(${k}θ) · count 改花瓣数`, 16, h - 16);
}

/* ── 三角 ────────────────────────────────────────────── */
function drawUnitCircle2d(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '单位圆与波形 · 拖动圆上黄点', 16, 22);
  const R = Math.min(70, w * 0.12) * sz;
  const cx = 16 + R + 20, cy = h * 0.5;
  // auto-rotate using tt delta approximation: store last
  if (!ix._lastTt) ix._lastTt = tt;
  if (!ix.drag && !ix.thSet) ix.theta = (ix.theta + (tt - ix._lastTt) * 0.9) % TAU; // auto-rotate until the user drags
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
  OUT = { ...OUT, th, s, c, phase };
  OUT._pts.sin = [px, (py + cy) / 2]; OUT._pts.cos = [(px + cx) / 2, py];
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
  if (!ix.drag && !ix.thSet) ix.theta = (ix.theta + (tt - ix._lastTt2) * 0.8) % TAU;
  ix._lastTt2 = tt;
  const cx = w * 0.72, cy = h * 0.5, R = 55 * sz;
  ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const th = ix.theta;
  const px = cx + Math.cos(th) * R, py = cy - Math.sin(th) * R;
  fillPoly(ctx, [[cx, cy], [px, cy], [px, py]], rgba(tint, 0.28), tint);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
  OUT = { ...OUT, th, s: Math.sin(th), c: Math.cos(th) };
  OUT._pts.sin = [px, (py + cy) / 2]; OUT._pts.cos = [(px + cx) / 2, cy];
  caption(ctx, `黄线恒为1 · 尺寸改圆 · 拖点改角`, 16, h - 16);
}
function drawLawSine(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '正弦定理  a/sinA=2R', 16, 22);
  const cx = w * 0.45, cy = h * 0.52, R = Math.min(w, h) * (0.18 + 0.14 * sz);
  ctx.strokeStyle = '#334155'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const offs0 = [[0, 1.8, 3.5], [0.2, 1.2, 3.8], [0, 2.2, 3.2], [0.4, 1.5, 4.0], [0, 1.0, 3.0], [0.3, 2.0, 3.6]][style % 6];
  const offs = ix.sc != null ? [offs0[0], Math.min(offs0[2] - 0.15, offs0[0] + 0.2 + ix.sc * 2.9), offs0[2]] : offs0;
  const a0 = tt * 0.25;
  const pts = offs.map((o) => [cx + R * Math.cos(a0 + o), cy + R * Math.sin(a0 + o)]);
  fillPoly(ctx, pts, rgba(tint, 0.18), tint);
  pts.forEach((p, i) => {
    ctx.fillStyle = ['#22d3ee', '#f472b6', '#fbbf24'][i];
    ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, TAU); ctx.fill();
  });
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) / R;
  const sa = dist(pts[1], pts[2]), sb = dist(pts[0], pts[2]), sc2 = dist(pts[0], pts[1]);
  const angA = Math.acos(Math.min(1, Math.max(-1, (sb * sb + sc2 * sc2 - sa * sa) / (2 * sb * sc2))));
  const angB = Math.acos(Math.min(1, Math.max(-1, (sa * sa + sc2 * sc2 - sb * sb) / (2 * sa * sc2))));
  OUT = { ...OUT, A: angA, B: angB, C: Math.PI - angA - angB, a: sa, b: sb, c: sc2, R: 1 };
  OUT._pts.A = pts[0]; OUT._pts.B = pts[1]; OUT._pts.C = pts[2];
  ['A', 'B', 'C'].forEach((lb, i) => labelAt(ctx, lb, pts[i][0] + (pts[i][0] - cx) * 0.12, pts[i][1] + (pts[i][1] - cy) * 0.12 + 4, '#e2e8f0'));
  scrubBar(ctx, w, h, ix.sc ?? 0.5, '拖动画布 → 移动 B');
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
  const xl = ix.sc != null ? Math.max(0.001, 2.5 * (1 - ix.sc)) : Math.max(0.001, 1.8 * (1 - tphase * 0.85));
  const fl = Math.sin(xl) / xl;
  ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ox + xl * s, oy - fl * s, 6, 0, TAU); ctx.fill(); ctx.stroke();
  OUT = { ...OUT, x: xl, fx: fl, err: Math.abs(1 - fl), steps };
  OUT._pts.x = [ox + xl * s, oy - fl * s];
  scrubBar(ctx, w, h, ix.sc ?? tphase, '拖动画布 → x→0');
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
  OUT = { ...OUT, x0, y0, m, hstep, sec: (Math.sin(x0 + hstep) - y0) / hstep, showSec: style % 2 === 0 };
  caption(ctx, `x=${x0.toFixed(2)} f'=${m.toFixed(2)} · 预设显/隐割线`, 16, h - 16);
}
function drawIntegral(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '积分=面积 黎曼和', 16, 22);
  const ox = w * 0.12 + ix.panX * 10, oy = h * 0.62, sx = 48 * sz * ix.zoom, sy = 42 * sz * ix.zoom;
  axes(ctx, ox, oy, w * 0.8, h * 0.4);
  plotFn(ctx, ox, oy, sx, sy, 0, Math.PI, Math.sin, tint, 2);
  const N = Math.min(48, Math.max(3, n));
  const Bd = ix.sc != null ? 0.2 + ix.sc * (Math.PI - 0.2) : Math.PI;
  const dx = Bd / N; let area = 0;
  for (let i = 0; i < N; i++) {
    const x = i * dx; const y = Math.sin(x + dx / 2); area += y * dx;
    ctx.fillStyle = rgba('#22d3ee', 0.35 + 0.3 * Math.sin(tt * 2 + i * 0.2));
    ctx.fillRect(ox + x * sx, oy - Math.max(0, y) * sy, dx * sx - 1, Math.abs(y) * sy);
  }
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox + Bd * sx, oy + 6); ctx.lineTo(ox + Bd * sx, oy - Math.sin(Bd) * sy - 10); ctx.stroke();
  OUT = { ...OUT, N, b: Bd, area, exact: 1 - Math.cos(Bd), dx };
  OUT._pts.b = [ox + Bd * sx, oy - Math.sin(Bd) * sy];
  scrubBar(ctx, w, h, (Bd - 0.2) / (Math.PI - 0.2), '拖动画布 → 上限 b');
  caption(ctx, `N=${N} 面积≈${area.toFixed(3)} (真值${(1 - Math.cos(Bd)).toFixed(3)}) · count=矩形数`, 16, h - 16);
}
function drawTaylor(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '泰勒展开  sin x', 16, 22);
  const { ox, oy, s } = plotFrame(ctx, w, h, ix, sz, tint);
  plotFn(ctx, ox, oy, s, s, -6, 6, Math.sin, '#64748b', 1.5);
  const terms = Math.min(10, Math.max(1, Math.round(n)));
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
  const pr = probe(ctx, ox, oy, s, s, w, h, taylor);
  OUT = { ...OUT, terms, xp: pr.xp, P: pr.yp, sin: Math.sin(pr.xp), order: 2 * terms - 1 };
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
  const ghosts = 3;
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
  OUT = { ...OUT, ax: ix.ax, ay: ix.ay, bx: ix.bx, by: ix.by, dot, cross };
  OUT._pts.sum = [ox + (ix.ax + ix.bx) * s, oy - (ix.ay + ix.by) * s];
  caption(ctx, `a·b=${dot.toFixed(2)}  a×b=${cross.toFixed(2)} · 刻度=${ghosts} · count改辅助向量`, 16, h - 16);
}
function drawMatrix2d(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '矩阵变换 · 旋转/缩放', 16, 22);
  const ox = w * 0.5, oy = h * 0.55, s = 55 * sz;
  axes(ctx, ox, oy, w * 0.35, h * 0.35);
  const ang = ix.sc != null ? ix.sc * TAU : tt * (0.4 + style * 0.15);
  const c = Math.cos(ang), sn = Math.sin(ang);
  const sc = 0.6 + 0.5 * sz;
  const apply = (x, y) => style % 2 === 1 ? [c * x * sc, sn * x * 0.3 + y * sc] : [c * x - sn * y, sn * x + c * y];
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
    const [u, v] = apply(x * sc, y * sc);
    return [ox + u * s, oy - v * s];
  });
  fillPoly(ctx, [[ox, oy], [ox + sc * s, oy], [ox + sc * s, oy - sc * s], [ox, oy - sc * s]], rgba('#64748b', 0.15), '#64748b');
  fillPoly(ctx, sq, rgba(tint, 0.3), tint);
  const shear = style % 2 === 1;
  const M = shear ? [c * sc, 0, 0.3 * sn, sc] : [c, -sn, sn, c];
  OUT = { ...OUT, ang, shear, m: M, det: M[0] * M[3] - M[1] * M[2] };
  OUT._pts.e1 = sq[1]; OUT._pts.e2 = sq[3];
  scrubBar(ctx, w, h, ((ang % TAU) + TAU) % TAU / TAU, '拖动画布 → θ');
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
  OUT = { ...OUT, ax: ix.ax, ay: ix.ay, bx: ix.bx, by: ix.by, det, hatch };
  caption(ctx, `det=${det.toFixed(2)} ${det < 0 ? '(反向)' : ''} · 阴影线=${hatch} · count改密度`, 16, h - 16);
}
function drawEigen(ctx, w, h, tint, tt, sz, style, ix) {
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
  const Mx = style % 2 ? [1.5, 0.8, 0.8, 1.2] : [2, 0.5, 0.5, 1];
  const tr = Mx[0] + Mx[3], dt = Mx[0] * Mx[3] - Mx[1] * Mx[2];
  const disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  const ev = (l) => { const v = [Mx[1], l - Mx[0]]; const m = Math.hypot(v[0], v[1]) || 1; return [v[0] / m, v[1] / m]; };
  const v1 = ev(l1), v2 = ev(l2);
  ctx.setLineDash([6, 4]);
  [[v1, '#fbbf24'], [v2, '#f472b6']].forEach(([v, col]) => {
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(ox - v[0] * s * 3, oy + v[1] * s * 3); ctx.lineTo(ox + v[0] * s * 3, oy - v[1] * s * 3); ctx.stroke();
  });
  ctx.setLineDash([]);
  arrow(ctx, ox, oy, ox + v1[0] * s * l1 * 0.8, oy - v1[1] * s * l1 * 0.8, '#fbbf24', 2.2);
  arrow(ctx, ox, oy, ox + v2[0] * s * l2 * 0.8, oy - v2[1] * s * l2 * 0.8, '#f472b6', 2.2);
  const tv = ix.sc != null ? ix.sc * Math.PI : (tt * 0.35) % Math.PI;
  const v = [Math.cos(tv), Math.sin(tv)], Av = A(v[0], v[1]);
  arrow(ctx, ox, oy, ox + v[0] * s * 1.2, oy - v[1] * s * 1.2, '#22d3ee', 2.5);
  arrow(ctx, ox, oy, ox + Av[0] * s * 0.8, oy - Av[1] * s * 0.8, '#34d399', 2.5);
  const crossVA = v[0] * Av[1] - v[1] * Av[0];
  OUT = { ...OUT, M: Mx, l1, l2, v1, v2, tv, v, Av, par: Math.abs(crossVA) / (Math.hypot(Av[0], Av[1]) || 1) };
  OUT._pts.v = [ox + v[0] * s * 1.2, oy - v[1] * s * 1.2]; OUT._pts.Av = [ox + Av[0] * s * 0.8, oy - Av[1] * s * 0.8];
  OUT._pts.v1 = [ox + v1[0] * s * l1 * 0.8, oy - v1[1] * s * l1 * 0.8]; OUT._pts.v2 = [ox + v2[0] * s * l2 * 0.8, oy - v2[1] * s * l2 * 0.8];
  scrubBar(ctx, w, h, tv / Math.PI, '拖动画布 → 旋转测试向量 v');
  caption(ctx, `青=v 绿=Av · 共线时 v 是特征向量 · 预设切换矩阵`, 16, h - 16);
}

/* ── 离散 / 概率 ─────────────────────────────────────── */
function drawVenn(ctx, w, h, tint, tt, sz, style, ix) {
  title(ctx, '集合韦恩图', 16, 22);
  const r = 55 * sz;
  const sep = ix.sc != null ? 0.005 + ix.sc * 0.3 : 0.12 + 0.1 * (style % 3);
  const cx1 = w * (0.5 - sep), cx2 = w * (0.5 + sep), cy = h * 0.5;
  ctx.fillStyle = rgba('#22d3ee', 0.28); ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#f472b6', 0.28); ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba(tint, 0.55);
  ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx1, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#f472b6'; ctx.beginPath(); ctx.arc(cx2, cy, r, 0, TAU); ctx.stroke();
  labelAt(ctx, 'A∩B', (cx1 + cx2) / 2, cy + 4, '#f8fafc');
  const dN = (cx2 - cx1) / r;
  const inter = dN >= 2 ? 0 : 2 * Math.acos(dN / 2) - (dN / 2) * Math.sqrt(4 - dN * dN);
  OUT = { ...OUT, d: dN, area: Math.PI, inter, union: 2 * Math.PI - inter };
  OUT._pts.AB = [(cx1 + cx2) / 2, cy]; OUT._pts.A = [cx1 - r * 0.5, cy]; OUT._pts.B = [cx2 + r * 0.5, cy];
  scrubBar(ctx, w, h, ix.sc ?? (sep - 0.005) / 0.3, '拖动画布 → 圆心距');
  caption(ctx, `拖动改圆心距 · 右侧改半径和交集颜色`, 16, h - 16);
}
function drawCombinatorics(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '排列组合  C(n,k)/P(n,k) · 点击圆点', 16, 22);
  const N = Math.min(10, Math.max(3, Math.round(n)));
  // size slider is k itself (0..10); scrub writes it back
  let K = Math.min(N, Math.max(0, Math.round(Number(ix._live?.size ?? 3))));
  if (ix.drag && ix.sc != null) K = Math.min(N, Math.max(0, Math.round(ix.sc * N)));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const C = fact(N) / (fact(K) * fact(N - K) || 1);
  const P = fact(N) / (fact(N - K) || 1);
  const x0 = w * 0.12, gap = Math.min(52, (w * 0.76) / N);
  for (let i = 0; i < N; i++) {
    const x = x0 + i * gap, y = h * 0.4;
    const on = i < K;
    ctx.fillStyle = on ? tint : '#334155';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, y + 4);
  }
  ctx.fillStyle = '#e2e8f0'; ctx.font = '600 16px ui-sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`C(${N},${K})=${C}   P(${N},${K})=${P}`, x0, h * 0.62);
  OUT = { ...OUT, N, K, C, P, fk: fact(K) };
  scrubBar(ctx, w, h, N ? K / N : 0, '拖动画布 → k');
  caption(ctx, `右侧改 n / k · 拖动画布改 k`, 16, h - 16);
}
function drawSequence(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '递推数列', 16, 22);
  const N = Math.min(18, Math.max(5, n));
  const mode = style % 2;
  const a2 = Math.max(1, Math.round(1 + (sz - 1) * 3));
  const seq = mode === 0 ? [1, a2] : [1];
  if (mode === 0) while (seq.length < N) seq.push(seq.at(-1) + seq.at(-2));
  else { const r = 1.2 + 0.25 * sz; while (seq.length < N) seq.push(seq.at(-1) * r); }
  const maxV = Math.max(...seq);
  const hi = ix.sc != null ? Math.min(N - 1, Math.floor(ix.sc * N)) : Math.floor(tt * 2) % N;
  const x0 = 30, y0 = h - 40, barW = (w - 60) / N, barH = h * 0.55;
  seq.forEach((v, i) => {
    const bh = (v / maxV) * barH;
    const pulse = i === hi ? 1.12 : 1;
    if (i === hi) OUT._pts.hi = [x0 + i * barW + barW / 2, y0 - bh * pulse];
    ctx.fillStyle = rgba(tint, 0.45 + 0.45 * (i / N));
    ctx.fillRect(x0 + i * barW + 2, y0 - bh * pulse, barW - 4, bh * pulse);
  });
  OUT = { ...OUT, mode, N, hi, val: seq[hi], prev: hi > 0 ? seq[hi - 1] : NaN, prev2: hi > 1 ? seq[hi - 2] : NaN, sum: seq.slice(0, hi + 1).reduce((x, y) => x + y, 0), r: mode ? 1.2 + 0.25 * sz : NaN, a2 };
  scrubBar(ctx, w, h, hi / Math.max(1, N - 1), '拖动画布 → 第 i 项');
  caption(ctx, mode === 0 ? `广义斐波那契 a₁=1, a₂=${a2}, n=${N}` : `等比 n=${N} · 预设切类型`, 16, h - 16);
}
function drawShortest(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '最短路 · 点击节点高亮路径前缀', 16, 22);
  const nodes = [[0.15, 0.55], [0.35, 0.3], [0.35, 0.75], [0.55, 0.45], [0.75, 0.3], [0.75, 0.7], [0.9, 0.5]].map(([x, y]) => [x * w, y * h]);
  const edges = [[0, 1, 2], [0, 2, 4], [1, 3, 3], [2, 3, 1], [1, 4, 5], [3, 4, 2], [3, 5, 4], [4, 6, 2], [5, 6, 3], [2, 5, 6]];
  const path = [0, 2, 3, 4, 6];
  const auto = Math.min(path.length - 1, Math.floor((tt * 0.7) % (path.length + 1)));
  const progress = ix.nodeSet ? Math.max(0, path.indexOf(ix.node)) : auto;
  // Dijkstra from A for the readout
  const dist = nodes.map(() => Infinity); dist[0] = 0; const done = new Set();
  for (let it = 0; it < nodes.length; it++) {
    let u = -1; for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    done.add(u);
    edges.forEach(([a, b, wt]) => { if (a === u && dist[u] + wt < dist[b]) dist[b] = dist[u] + wt; if (b === u && dist[u] + wt < dist[a]) dist[a] = dist[u] + wt; });
  }
  edges.forEach(([a, b, wt]) => {
    const onPath = path.slice(0, progress + 1).includes(a) && path.slice(0, progress + 1).includes(b)
      && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    ctx.strokeStyle = onPath ? tint : '#334155'; ctx.lineWidth = onPath ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(nodes[a][0], nodes[a][1]); ctx.lineTo(nodes[b][0], nodes[b][1]); ctx.stroke();
    if (ix._live?.showW !== false && ix._live?.showW !== 0) {
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
  const sel = ix.nodeSet ? ix.node : path[progress];
  const pct = Math.round((Number.isFinite(ix.sc) ? ix.sc : progress / Math.max(1, path.length - 1)) * 100);
  OUT = { ...OUT, progress, path, sel, dist, onPath: path.includes(sel), pct };
  OUT._pts.sel = nodes[sel];
  caption(ctx, `进度 ${progress} · 点击节点 / 速度推进`, 16, h - 16);
}
function drawModular(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '模运算 · 点击剩余类', 16, 22);
  const m = Math.min(16, Math.max(4, n));
  const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.3 * sz;
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  const val = ix.sc != null ? Math.round(ix.sc * m * 3) : Math.floor(tt * 1.5 + style * 3);
  const rem = ix.nodeSet && ix.sc == null && ix.node != null && ix.node < m ? ix.node : ((val % m) + m) % m;
  for (let i = 0; i < m; i++) {
    const a = -Math.PI / 2 + (i / m) * TAU;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    ctx.fillStyle = i === rem ? tint : '#1e293b';
    ctx.strokeStyle = i === rem ? '#fbbf24' : '#475569';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i), x, y + 4);
  }
  OUT = { ...OUT, val, m, rem, picked: ix.node != null && ix.node < m && ix.sc == null && ix.nodeSet };
  { const a = -Math.PI / 2 + (rem / m) * TAU; OUT._pts.rem = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }
  scrubBar(ctx, w, h, ix.sc ?? 0, '拖动画布 → 被除数 a');
  caption(ctx, `${val} ≡ ${rem} (mod ${m}) · count=m`, 16, h - 16);
}
function drawBinomial(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '二项分布 B(n,p)', 16, 22);
  const N = Math.min(28, Math.max(5, n + 2));
  const p = ix.sc != null ? 0.02 + ix.sc * 0.96 : 0.15 + 0.7 * (sz / 2) * (0.5 + 0.5 * Math.sin(tt * 0.25 + style));
  const fact = (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  const pdf = [];
  for (let k = 0; k <= N; k++) pdf.push(fact(N) / (fact(k) * fact(N - k)) * Math.pow(p, k) * Math.pow(1 - p, N - k));
  const maxP = Math.max(...pdf);
  const x0 = 30, y0 = h - 40, barW = (w - 60) / (N + 1), barH = h * 0.55;
  pdf.forEach((v, i) => {
    ctx.fillStyle = rgba(tint, 0.4 + 0.55 * (v / maxP));
    ctx.fillRect(x0 + i * barW + 1, y0 - (v / maxP) * barH, barW - 2, (v / maxP) * barH);
  });
  const kMax = pdf.indexOf(maxP);
  OUT = { ...OUT, N, p, mean: N * p, vr: N * p * (1 - p), kMax, pMax: maxP };
  OUT._pts.mode = [x0 + kMax * barW + barW / 2, y0 - barH];
  scrubBar(ctx, w, h, (p - 0.02) / 0.96, '拖动画布 → p');
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
  const pr = probe(ctx, ox, oy, s, s * 4, w, h, gauss);
  OUT = { ...OUT, mu, sigma, xp: pr.xp, pdf: pr.yp, z: (pr.xp - mu) / sigma };
  OUT._pts.mu = [ox + mu * s, oy - gauss(mu) * s * 4];
  caption(ctx, `μ=${mu.toFixed(2)} σ=${sigma.toFixed(2)}`, 16, h - 16);
}
function drawCLT(ctx, w, h, tint, tt, sz, n, style, ix) {
  title(ctx, '中心极限定理', 16, 22);
  const samples = ix.sc != null ? 1 + Math.round(ix.sc * 47) : Math.min(48, 6 + n * 2);
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
  const mm = means.reduce((x, y) => x + y, 0) / means.length;
  const sd = Math.sqrt(means.reduce((x, y) => x + (y - mm) ** 2, 0) / means.length);
  OUT = { ...OUT, samples, groups: means.length, mm, sd, theory: Math.sqrt(35 / 12) / Math.sqrt(samples) };
  scrubBar(ctx, w, h, (samples - 1) / 47, '拖动画布 → 每组样本数 n');
  caption(ctx, `每组 n=${samples} · count 增大样本`, 16, h - 16);
}
