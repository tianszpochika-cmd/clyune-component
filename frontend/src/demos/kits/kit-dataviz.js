import { makeCanvas, loop, bar, hsl, rand, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = [
  'heatmap', 'radar', 'sankey', 'bubbles', 'cal-heat', 'sunburst', 'chord', 'boxplot',
  'parallel', 'stream', 'wordcloud', 'hierarchy', 'funnel', 'candle', 'icicle', 'arc',
];

export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'heatmap').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'heatmap';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-dataviz',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({ color: true, speed: true, size: true }),
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
  const id = opts.variant || 'heatmap-1';
  const family = resolveFamily(id);
  const n = FAMILIES.indexOf(family) + 1;
  const { stage } = bar(host, id, `<button class="btn" data-gen>Regenerate</button>`);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  let seed = Math.random() * 1000;
  const regen = () => { seed = Math.random() * 1000; };
  host.querySelector('[data-gen]')?.addEventListener('click', regen);

  const stop = loop((dt, t) => {
    const L = live();
    const tint = L.color;
    const tt = t * L.speed;
    const sz = L.size > 0 ? L.size : 1;
    const { w, h } = state;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    drawFamily(ctx, family, w, h, tint, tt, sz, seed, n);
  });
  return () => { stop(); dispose(); host.innerHTML = ''; };
}

function noise(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function drawFamily(ctx, family, w, h, tint, tt, sz, seed, n) {
  switch (family) {
    case 'heatmap': return drawHeatmap(ctx, w, h, tt, seed);
    case 'radar': return drawRadar(ctx, w, h, tint, tt);
    case 'sankey': return drawSankey(ctx, w, h, tint, tt, seed);
    case 'bubbles': return drawBubbles(ctx, w, h, tint, tt, seed);
    case 'cal-heat': return drawCalHeat(ctx, w, h, tt, seed);
    case 'sunburst': return drawSunburst(ctx, w, h, tint, tt, seed);
    case 'chord': return drawChord(ctx, w, h, tint, tt, seed);
    case 'boxplot': return drawBoxplot(ctx, w, h, tint, tt, seed);
    case 'parallel': return drawParallel(ctx, w, h, tint, tt, seed);
    case 'stream': return drawStream(ctx, w, h, tint, tt, seed);
    case 'wordcloud': return drawWordcloud(ctx, w, h, n, tt, seed);
    case 'hierarchy': return drawHierarchy(ctx, w, h, tint, tt, seed);
    case 'funnel': return drawFunnel(ctx, w, h, tint);
    case 'candle': return drawCandle(ctx, w, h, tint, tt);
    case 'icicle': return drawIcicle(ctx, w, h, n, tt, seed);
    case 'arc': return drawArcProgress(ctx, w, h, tint, tt, sz);
    default: return drawHeatmap(ctx, w, h, tt, seed);
  }
}

function drawHeatmap(ctx, w, h, tt, seed) {
  const cols = 8, rows = 8, cw = w / cols, ch = h / rows;
  for (let i = 0; i < 64; i++) {
    const v = (noise(seed, i) + 0.5 + 0.5 * Math.sin(tt + i)) % 1;
    ctx.fillStyle = `hsla(${240 - v * 200} 80% ${30 + v * 40}%)`;
    ctx.fillRect((i % cols) * cw, (i / cols | 0) * ch, cw - 1, ch - 1);
  }
}

function drawRadar(ctx, w, h, tint, tt) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.35, axes = 6;
  ctx.strokeStyle = '#24314f';
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    for (let i = 0; i <= axes; i++) {
      const a = -Math.PI / 2 + (i / axes) * Math.PI * 2;
      const x = cx + Math.cos(a) * R * r / 3, y = cy + Math.sin(a) * R * r / 3;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.beginPath();
  ctx.strokeStyle = tint;
  ctx.fillStyle = `color-mix(in srgb, ${tint} 25%, transparent)`;
  for (let i = 0; i <= axes; i++) {
    const a = -Math.PI / 2 + (i / axes) * Math.PI * 2;
    const v = 0.4 + 0.5 * ((Math.sin(tt + i) + 1) / 2);
    const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

/** Left→right flow ribbons (classic sankey look). */
function drawSankey(ctx, w, h, tint, tt, seed) {
  const left = [
    { y: 0.12, h: 0.18, c: '#818cf8' },
    { y: 0.36, h: 0.22, c: '#22d3ee' },
    { y: 0.66, h: 0.2, c: '#f472b6' },
  ];
  const right = [
    { y: 0.1, h: 0.28, c: '#a78bfa' },
    { y: 0.44, h: 0.18, c: '#34d399' },
    { y: 0.7, h: 0.2, c: '#fb923c' },
  ];
  const flows = [
    [0, 0, 0.55], [0, 1, 0.45],
    [1, 0, 0.35], [1, 1, 0.25], [1, 2, 0.4],
    [2, 1, 0.3], [2, 2, 0.7],
  ];
  const lx = w * 0.08, lw = w * 0.12, rx = w * 0.8, rw = w * 0.12;
  const pad = 16;
  left.forEach((n, i) => {
    const y = pad + n.y * (h - pad * 2);
    const hh = n.h * (h - pad * 2);
    ctx.fillStyle = n.c;
    ctx.fillRect(lx, y + Math.sin(tt + i) * 2, lw, hh);
  });
  right.forEach((n, i) => {
    const y = pad + n.y * (h - pad * 2);
    const hh = n.h * (h - pad * 2);
    ctx.fillStyle = n.c;
    ctx.fillRect(rx, y + Math.cos(tt + i) * 2, rw, hh);
  });
  flows.forEach(([li, ri, share], fi) => {
    const L = left[li], R = right[ri];
    const y0 = pad + L.y * (h - pad * 2) + L.h * (h - pad * 2) * (0.15 + share * 0.5);
    const y1 = pad + R.y * (h - pad * 2) + R.h * (h - pad * 2) * (0.2 + (1 - share) * 0.4);
    const thick = 10 + share * 22 + Math.sin(tt * 0.7 + fi) * 2;
    const c0x = lx + lw, c1x = rx;
    const mid = (c0x + c1x) / 2;
    ctx.beginPath();
    ctx.moveTo(c0x, y0 - thick / 2);
    ctx.bezierCurveTo(mid, y0 - thick / 2, mid, y1 - thick / 2, c1x, y1 - thick / 2);
    ctx.lineTo(c1x, y1 + thick / 2);
    ctx.bezierCurveTo(mid, y1 + thick / 2, mid, y0 + thick / 2, c0x, y0 + thick / 2);
    ctx.closePath();
    ctx.fillStyle = `color-mix(in srgb, ${L.c} 55%, transparent)`;
    ctx.fill();
    ctx.strokeStyle = `color-mix(in srgb, ${tint} 40%, ${L.c})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('Source', lx, 14);
  ctx.fillText('Target', rx, 14);
}

/** Nested radial rings (sunburst). */
function drawSunburst(ctx, w, h, tint, tt, seed) {
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.42;
  const levels = [
    [1],
    [0.35, 0.28, 0.37],
    [0.12, 0.14, 0.1, 0.18, 0.16, 0.14, 0.16],
  ];
  let start = -Math.PI / 2 + tt * 0.08;
  levels.forEach((row, li) => {
    const r0 = (li / levels.length) * R;
    const r1 = ((li + 1) / levels.length) * R;
    let a = start;
    const sum = row.reduce((s, v) => s + v, 0);
    row.forEach((v, i) => {
      const da = (v / sum) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r1, a, a + da);
      ctx.arc(cx, cy, r0, a + da, a, true);
      ctx.closePath();
      const hue = (li * 50 + i * 28 + seed) % 360;
      ctx.fillStyle = `hsla(${hue} 75% ${48 + li * 6}% / 0.9)`;
      ctx.fill();
      ctx.strokeStyle = '#060a14';
      ctx.lineWidth = 2;
      ctx.stroke();
      a += da;
    });
  });
  ctx.beginPath();
  ctx.fillStyle = tint;
  ctx.arc(cx, cy, R * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** Circular chord diagram with ribbons between nodes. */
function drawChord(ctx, w, h, tint, tt, seed) {
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.36;
  const N = 6;
  const nodes = Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2 + tt * 0.05;
    return { a, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, c: hsl(i * 40 + seed) };
  });
  // arcs
  nodes.forEach((n, i) => {
    const a0 = n.a - Math.PI / N * 0.7;
    const a1 = n.a + Math.PI / N * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, a0, a1);
    ctx.strokeStyle = n.c;
    ctx.lineWidth = 10;
    ctx.stroke();
  });
  // chords
  const pairs = [[0, 2], [0, 3], [1, 4], [1, 5], [2, 4], [3, 5], [2, 5]];
  pairs.forEach(([i, j], k) => {
    const a = nodes[i], b = nodes[j];
    const wobble = Math.sin(tt + k) * 8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx + wobble, cy - wobble, b.x, b.y);
    ctx.strokeStyle = `color-mix(in srgb, ${a.c} 50%, transparent)`;
    ctx.lineWidth = 3 + noise(seed, k) * 5;
    ctx.stroke();
  });
  nodes.forEach((n) => {
    ctx.beginPath();
    ctx.fillStyle = n.c;
    ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Parallel coordinates. */
function drawParallel(ctx, w, h, tint, tt, seed) {
  const axes = 5;
  const padX = 40, padY = 30;
  const xs = Array.from({ length: axes }, (_, i) => padX + (i / (axes - 1)) * (w - padX * 2));
  ctx.strokeStyle = '#24314f';
  ctx.lineWidth = 2;
  xs.forEach((x, i) => {
    ctx.beginPath();
    ctx.moveTo(x, padY);
    ctx.lineTo(x, h - padY);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`D${i + 1}`, x - 8, padY - 8);
  });
  const lines = 10;
  for (let li = 0; li < lines; li++) {
    ctx.beginPath();
    for (let ai = 0; ai < axes; ai++) {
      const v = 0.15 + 0.7 * noise(seed, li * 10 + ai);
      const y = padY + (h - padY * 2) * (0.5 + 0.45 * Math.sin(tt * 0.4 + li + ai) * 0.25 + (v - 0.5));
      const yy = Math.max(padY, Math.min(h - padY, y));
      ai ? ctx.lineTo(xs[ai], yy) : ctx.moveTo(xs[ai], yy);
    }
    ctx.strokeStyle = li % 3 === 0 ? tint : hsl(li * 28 + seed);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Streamgraph stacked areas. */
function drawStream(ctx, w, h, tint, tt, seed) {
  const layers = 5;
  const steps = 48;
  const colors = [tint, '#22d3ee', '#a78bfa', '#34d399', '#f472b6'];
  const series = Array.from({ length: layers }, (_, li) =>
    Array.from({ length: steps }, (_, i) => {
      const x = i / (steps - 1);
      return 0.08 + 0.18 * (0.5 + 0.5 * Math.sin(x * Math.PI * 2 * (li + 1) + tt + seed * 0.01 + li));
    }),
  );
  // baseline centered stream
  const mid = Array(steps).fill(0);
  const half = Array(steps).fill(0);
  for (let i = 0; i < steps; i++) {
    const sum = series.reduce((s, row) => s + row[i], 0);
    half[i] = sum / 2;
  }
  let baseline = half.map((v) => 0.5 - v);
  for (let li = 0; li < layers; li++) {
    const top = [];
    const bot = [];
    for (let i = 0; i < steps; i++) {
      const y0 = baseline[i];
      const y1 = y0 + series[li][i];
      bot.push(y0);
      top.push(y1);
      baseline[i] = y1;
    }
    ctx.beginPath();
    for (let i = 0; i < steps; i++) {
      const x = (i / (steps - 1)) * w;
      const y = top[i] * h;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let i = steps - 1; i >= 0; i--) {
      const x = (i / (steps - 1)) * w;
      const y = bot[i] * h;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `color-mix(in srgb, ${colors[li % colors.length]} 75%, transparent)`;
    ctx.fill();
  }
}

function drawBubbles(ctx, w, h, tint, tt, seed) {
  for (let i = 0; i < 24; i++) {
    const x = (Math.sin(i * 1.7 + tt * 0.2) * 0.4 + 0.5) * w;
    const y = (Math.cos(i * 1.3 + tt * 0.15) * 0.4 + 0.5) * h;
    const r = 8 + noise(seed, i) * 30;
    ctx.beginPath();
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.55;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCalHeat(ctx, w, h, tt, seed) {
  const cols = 14, rows = 7;
  const cw = (w - 20) / cols, ch = (h - 20) / rows;
  for (let i = 0; i < cols * rows; i++) {
    const v = (noise(seed, i) + 0.2 * Math.sin(tt + i * 0.2)) % 1;
    const vv = (v + 1) % 1;
    ctx.fillStyle = `hsla(${140 + vv * 80} 70% ${25 + vv * 40}%)`;
    ctx.fillRect(10 + (i % cols) * cw, 10 + ((i / cols) | 0) * ch, cw - 2, ch - 2);
  }
}

function drawBoxplot(ctx, w, h, tint, tt, seed) {
  const groups = 5;
  for (let i = 0; i < groups; i++) {
    const x = 40 + i * ((w - 60) / groups);
    const mid = h * 0.45 + Math.sin(tt + i) * 20;
    ctx.strokeStyle = hsl(i * 40 + seed);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, mid - 40, 28, 80);
    ctx.beginPath();
    ctx.moveTo(x + 14, mid - 70);
    ctx.lineTo(x + 14, mid + 70);
    ctx.stroke();
    ctx.fillStyle = tint;
    ctx.fillRect(x, mid - 2, 28, 4);
  }
}

function drawWordcloud(ctx, w, h, n, tt, seed) {
  const words = ['Rust', 'React', 'Vite', 'Canvas', 'SVG', 'WebGL', 'GSAP', 'CSS', 'Three', 'Axum', 'Postgres', 'Demo'];
  words.forEach((word, i) => {
    ctx.font = `${12 + noise(seed, i) * 22 | 0}px sans-serif`;
    ctx.fillStyle = hsl(n + i * 25);
    ctx.fillText(word, 20 + (i % 4) * (w / 4), 40 + (i / 4 | 0) * 40 + Math.sin(tt + i) * 6);
  });
}

function drawHierarchy(ctx, w, h, tint, tt, seed) {
  // indented tree bars
  const rows = [
    { d: 0, v: 1, label: 'Root' },
    { d: 1, v: 0.62, label: 'Branch A' },
    { d: 2, v: 0.28, label: 'Leaf A1' },
    { d: 2, v: 0.34, label: 'Leaf A2' },
    { d: 1, v: 0.38, label: 'Branch B' },
    { d: 2, v: 0.2, label: 'Leaf B1' },
    { d: 2, v: 0.18, label: 'Leaf B2' },
  ];
  const rowH = (h - 40) / rows.length;
  rows.forEach((r, i) => {
    const x = 20 + r.d * 28;
    const y = 20 + i * rowH;
    const bw = (w - x - 40) * r.v * (0.85 + 0.15 * Math.sin(tt + i));
    ctx.fillStyle = `color-mix(in srgb, ${tint} ${70 - r.d * 15}%, ${hsl(i * 30 + seed)})`;
    ctx.fillRect(x, y, bw, rowH - 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText(r.label, x + 8, y + rowH * 0.55);
  });
}

function drawFunnel(ctx, w, h, tint) {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const y0 = 40 + t0 * (h - 80), y1 = 40 + t1 * (h - 80);
    const w0 = (0.85 - t0 * 0.55) * w * 0.5, w1 = (0.85 - t1 * 0.55) * w * 0.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - w0, y0); ctx.lineTo(w / 2 + w0, y0);
    ctx.lineTo(w / 2 + w1, y1); ctx.lineTo(w / 2 - w1, y1);
    ctx.closePath();
    ctx.fillStyle = `color-mix(in srgb, ${tint} ${70 - i * 10}%, #18233d)`;
    ctx.fill();
  }
}

function drawCandle(ctx, w, h, tint, tt) {
  const nBars = 14, bw = (w - 40) / nBars;
  for (let i = 0; i < nBars; i++) {
    const o = h * 0.5 + Math.sin(tt + i) * 20;
    const c = o + Math.sin(tt * 1.3 + i * 0.7) * 30;
    const hi = Math.min(o, c) - 20, lo = Math.max(o, c) + 20;
    const x = 20 + i * bw + bw * 0.5;
    ctx.strokeStyle = '#93a0c0';
    ctx.beginPath(); ctx.moveTo(x, hi); ctx.lineTo(x, lo); ctx.stroke();
    ctx.fillStyle = c >= o ? tint : '#f472b6';
    ctx.fillRect(x - bw * 0.25, Math.min(o, c), bw * 0.5, Math.abs(c - o) + 2);
  }
}

function drawIcicle(ctx, w, h, n, tt, seed) {
  const levels = [[1], [0.55, 0.45], [0.3, 0.25, 0.25, 0.2]];
  let y = 20;
  levels.forEach((row, li) => {
    let x = 20;
    const rh = (h - 40) / levels.length - 8;
    const total = row.reduce((a, b) => a + b, 0);
    row.forEach((v, i) => {
      const rw = (w - 40) * v / total;
      ctx.fillStyle = `hsla(${(n * 40 + li * 40 + i * 25 + seed) % 360} 70% 55% / .85)`;
      ctx.fillRect(x, y, rw - 2, rh);
      x += rw;
    });
    y += rh + 8;
  });
}

function drawArcProgress(ctx, w, h, tint, tt, sz) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 5; i++) {
    const v = 0.35 + 0.55 * ((Math.sin(tt * 0.8 + i) + 1) / 2);
    ctx.strokeStyle = i === 0 ? tint : hsl(i * 40);
    ctx.lineWidth = 8 * sz;
    ctx.beginPath();
    ctx.arc(cx, cy, (40 + i * 18) * sz, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.7 * v);
    ctx.stroke();
  }
}
