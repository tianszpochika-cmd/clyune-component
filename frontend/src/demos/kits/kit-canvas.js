/**
 * kit-canvas — Canvas 2D effect families. Every family has only the knobs it really uses,
 * a live readout + 公式/说明/参数/步骤 info panel in beginner Chinese, a sim clock scaled by
 * the speed knob (dt clamped) and pointer interaction (drag / click) with an idle auto-pointer.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, makeLayer, fadeA, rng, makeNoise, hexRgb, rgba, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '时间流速', max = 3) => ({ label, min: 0, max, step: 0.1, value: 1 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const mix = (c, k = 0.5, to = [255, 255, 255]) => { const a = hexRgb(c); return [0, 1, 2].map((i) => Math.round(a[i] + (to[i] - a[i]) * k)); };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const FAM = {};

/* ───────────────────────── network ───────────────────────── */
FAM.network = {
  spec: { color: { label: '连线颜色', value: '#818cf8' }, speed: SPD('漂移速度'), size: { label: '粒子半径', min: 0.5, max: 4, step: 0.1, value: 1.6 }, count: { label: '粒子数 N', min: 20, max: 220, step: 10, value: 90, buttons: true }, extras: [R('link', '连线距离 d', 40, 200, 5, 110), R('pull', '指针吸引力', 0, 2, 0.1, 0.8)], remountKeys: [] },
  presets: { 默认: {}, 稀疏: { count: 40, link: 150 }, 密集: { count: 180, link: 80 }, 高速: { speed: 2.4 } },
  doc: {
    title: '粒子网络 · 距离连线',
    rows: (v) => [['粒子数 N', String(v.n ?? 0)], ['连线数 E', String(v.E ?? 0), 'E'], ['平均度数 2E/N', fmt(v.deg ?? 0, 1)], ['连线阈值 d', `${fmt(v.d ?? 0, 0)} px`], ['指针邻居', String(v.near ?? 0)], ['吸引力', fmt(v.pull ?? 0, 1)]],
    formula: () => F('两点距离 r = √((x₁−x₂)² + (y₁−y₂)²)') + F('r < d 时连线，透明度 α = 1 − r / d') + F('平均度数 = 2E / N'),
    explain: '<p>每个粒子匀速漂移，碰到边界反弹。每一帧检查<b>所有粒子两两之间的距离</b>，距离小于阈值 d 就画一条线，越近线越实。</p><p>N 个粒子要比较 N(N−1)/2 对，粒子数翻倍计算量约变 4 倍，这就是为什么这种背景一般控制在几百个点以内。</p><p>指针附近的粒子会被轻轻吸过去，并与指针连线。</p>',
    params: [['连线颜色', '粒子与连线的颜色'], ['漂移速度', '时间流速，0 = 暂停'], ['粒子半径', '圆点大小（px）'], ['粒子数 N', '粒子个数，连线数大约随 N² 增长'], ['连线距离 d', '小于这个距离才连线'], ['指针吸引力', '指针对附近粒子的吸力，0 = 不吸引']],
    example: (v) => `<ol><li>N = ${v.n}，需要比较 ${v.n}×${(v.n ?? 1) - 1}/2 = ${((v.n ?? 0) * ((v.n ?? 1) - 1)) / 2} 对</li><li>其中距离 &lt; ${fmt(v.d ?? 0, 0)}px 的有 E = ${v.E} 对</li><li>平均每个粒子连 2E/N = ${fmt(v.deg ?? 0, 1)} 条线</li></ol>`,
    tip: '移动/拖动指针吸引粒子；调连线距离看网络疏密变化。',
  },
  build(S) {
    const R0 = rng(11); const pts = [];
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 90)), 5, 400);
      while (pts.length < n) { const a = R0() * TAU, s = 18 + R0() * 26; pts.push({ x: R0() * W, y: R0() * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ux: Math.cos(a) * s, uy: Math.sin(a) * s }); }
      if (pts.length > n) pts.length = n;
      const d = num(C.link, 110), pull = num(C.pull, 0.8), col = C.color || '#818cf8';
      const relax = 1 - Math.exp(-dt * 0.8);
      for (const p of pts) {
        const dx = P.x - p.x, dy = P.y - p.y, r = Math.hypot(dx, dy) || 1;
        if (r < d * 1.6) { const a = pull * 140 * (1 - r / (d * 1.6)); p.vx += (dx / r) * a * dt; p.vy += (dy / r) * a * dt; }
        p.vx += (p.ux - p.vx) * relax; p.vy += (p.uy - p.vy) * relax;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); p.ux = Math.abs(p.ux); } else if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); p.ux = -Math.abs(p.ux); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); p.uy = Math.abs(p.uy); } else if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); p.uy = -Math.abs(p.uy); }
      }
      S.clear();
      const rgb = hexRgb(col); let E = 0, near = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        for (let j = i + 1; j < n; j++) {
          const b = pts[j]; const r = Math.hypot(a.x - b.x, a.y - b.y);
          if (r < d) { E++; ctx.strokeStyle = rgba(rgb, (1 - r / d) * 0.85); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        const rp = Math.hypot(a.x - P.x, a.y - P.y);
        if (rp < d) { near++; ctx.strokeStyle = rgba(mix(col, 0.5), (1 - rp / d)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(P.x, P.y); ctx.stroke(); }
      }
      const rr = num(C.size, 1.6); ctx.fillStyle = rgba(mix(col, 0.45), 1);
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = rgba(rgb, 0.5); ctx.beginPath(); ctx.arc(P.x, P.y, 5, 0, TAU); ctx.stroke();
      return { n, E, deg: n ? (2 * E) / n : 0, d, near, pull, ix: `${E}` };
    };
  },
};

/* ───────────────────────── matrix ───────────────────────── */
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF';
FAM.matrix = {
  spec: { color: { label: '字符颜色', value: '#34d399' }, speed: SPD('下落速度'), size: { label: '字号 px', min: 10, max: 28, step: 1, value: 16 }, count: false, extras: [R('fade', '拖尾衰减 α', 0.02, 0.3, 0.01, 0.07), R('dens', '列密度', 0.3, 1, 0.05, 0.9)], remountKeys: [] },
  presets: { 经典绿: {}, 疏列: { dens: 0.4 }, 长拖尾: { fade: 0.03 }, 大字: { size: 24 }, 急雨: { speed: 2.4 } },
  doc: {
    title: '代码雨 · 逐帧淡出',
    rows: (v) => [['列数', `${v.active ?? 0} / ${v.cols ?? 0}`], ['字号', `${v.fs ?? 0} px`], ['平均下落', `${fmt(v.vy ?? 0, 0)} px/s`], ['衰减 α', fmt(v.fade ?? 0, 2)], ['拖尾长度 ≈', `${fmt(v.tail ?? 0, 0)} 字`, 'tail'], ['指针列', String(v.pc ?? 0)]],
    formula: () => F('每帧亮度 ×(1 − α)：bₙ = b₀·(1 − α)ⁿ') + F('亮度降到 1/40 需要 n = ln(1/40) / ln(1 − α) 帧') + F('列数 = ⌊画布宽 / 字号⌋'),
    explain: '<p>画布被分成若干竖列，每列有一个“头”字符向下落，落到新的一行就在那里写一个字。</p><p>每帧用半透明的背景色盖一层，旧字就会一点点变暗，形成拖尾。α 越大，盖得越重，拖尾越短。</p><p>每列速度不同，到底部后从顶部随机位置重新开始，所以看起来错落有致。</p>',
    params: [['字符颜色', '字符与发光颜色'], ['下落速度', '时间流速，0 = 暂停'], ['字号 px', '字号越大列越少'], ['拖尾衰减 α', '每帧变暗的比例，越大拖尾越短'], ['列密度', '有多少比例的列在下雨']],
    example: (v) => `<ol><li>α = ${fmt(v.fade ?? 0, 2)}，每帧剩 ${fmt(1 - (v.fade ?? 0), 2)} 的亮度</li><li>n = ln(1/40)/ln(${fmt(1 - (v.fade ?? 0), 2)}) ≈ ${fmt(v.frames ?? 0, 0)} 帧</li><li>平均每帧落 ${fmt((v.vy ?? 0) / 60, 1)} px，拖尾 ≈ ${fmt(v.tail ?? 0, 0)} 个字</li></ol>`,
    tip: '指针所在的几列会被点亮；把 α 调小看长拖尾。',
  },
  build(S) {
    const R0 = rng(5); let L = null, cols = [], fs = 0;
    const setup = (W, H, size) => {
      fs = size; L = makeLayer(W, H, S.dpr); L.x.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); L.x.fillStyle = S.bg; L.x.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.floor(W / size));
      cols = Array.from({ length: n }, (_, i) => ({ i, y: -R0() * (H / size), v: 6 + R0() * 9, h: R0(), row: -1 }));
    };
    return ({ ctx, W, H, dt, C, P }) => {
      const size = clamp(Math.round(num(C.size, 16)), 8, 40);
      if (!L || size !== fs || Math.abs(L.w - W * S.dpr) > 1 || Math.abs(L.h - H * S.dpr) > 1) setup(W, H, size);
      const col = C.color || '#34d399', fade = num(C.fade, 0.07), dens = num(C.dens, 0.9);
      const x = L.x; x.font = `${size}px ui-monospace,monospace`; x.textBaseline = 'top';
      const pc = Math.floor(P.x / size);
      if (dt > 0) {
        x.fillStyle = rgba(S.bg, fadeA(fade, dt)); x.fillRect(0, 0, W, H);
        x.fillStyle = rgba(col, 0.85);
        for (const c of cols) {
          if (c.h > dens) continue;
          c.y += c.v * dt * (Math.abs(c.i - pc) <= 1 ? 1.6 : 1);
          const row = Math.floor(c.y);
          if (row !== c.row) { c.row = row; const g = GLYPHS[(c.i * 31 + row * 17 + ((c.h * 997) | 0)) % GLYPHS.length]; x.fillText(g, c.i * size, row * size); }
          if (c.y * size > H + R0() * H * 0.6) { c.y = -R0() * 12; c.v = 6 + R0() * 9; }
        }
      }
      ctx.drawImage(L.c, 0, 0, W, H);
      ctx.font = `${size}px ui-monospace,monospace`; ctx.textBaseline = 'top';
      let active = 0, vs = 0;
      for (const c of cols) {
        if (c.h > dens) continue; active++; vs += c.v;
        const near = Math.abs(c.i - pc) <= 1;
        ctx.fillStyle = near ? '#ffffff' : rgba(mix(col, 0.6), 1);
        const g = GLYPHS[(c.i * 31 + c.row * 17 + ((c.h * 997) | 0)) % GLYPHS.length];
        ctx.fillText(g, c.i * size, c.row * size);
      }
      ctx.fillStyle = rgba(col, 0.12); ctx.fillRect(pc * size - size, 0, size * 3, H);
      const frames = Math.log(1 / 40) / Math.log(1 - fade);
      const vy = active ? (vs / active) * size * C.speed : 0;
      return { cols: cols.length, active, fs: size, vy, fade, frames, tail: (frames * vy) / 60 / size, pc, ix: String(pc) };
    };
  },
};

/* ───────────────────────── fireworks ───────────────────────── */
FAM.fireworks = {
  spec: { color: { label: '主色调', value: '#f472b6' }, speed: SPD('时间流速', 2.5), size: { label: '火花粗细', min: 0.5, max: 3, step: 0.1, value: 1.4 }, count: { label: '每发火花数', min: 20, max: 200, step: 10, value: 90, buttons: true }, extras: [R('g', '重力 g', 40, 400, 10, 160), R('drag', '空气阻力 k', 0.2, 3, 0.1, 1.2), R('every', '自动发射间隔 s', 0.4, 3, 0.1, 1.2)], remountKeys: [] },
  presets: { 默认: {}, 大礼花: { count: 180 }, 高空: { g: 80 }, 快节奏: { every: 0.5 }, 慢落: { drag: 2.6 } },
  doc: {
    title: '烟花 · 抛体 + 空气阻力',
    rows: (v) => [['在空火花', String(v.sparks ?? 0)], ['火箭', String(v.rockets ?? 0)], ['已发射', String(v.shots ?? 0)], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`], ['阻力 k', fmt(v.k ?? 0, 1)], ['上升初速 v₀', `${fmt(v.v0 ?? 0, 0)} px/s`, 'v0'], ['爆炸半径 ≈ u/k', `${fmt(v.rad ?? 0, 0)} px`], ['每发火花 / 间隔', `${v.per ?? 0} 个 / ${fmt(v.every ?? 0, 1)} s`]],
    formula: () => F('火箭：要升高 h，初速 v₀ = √(2gh)') + F('火花：v′ = −k·v + g，所以 v(t) = u·e^(−kt) + …') + F('无重力时最远飞出 u / k'),
    explain: '<p>每颗火箭从底部竖直发射，初速按 <b>v₀ = √(2gh)</b> 计算，刚好在目标高度速度变成 0，然后爆炸。</p><p>爆炸生成一圈火花，每个火花有不同的初速 u 和方向。空气阻力让速度按指数衰减（e^(−kt)），重力让它们慢慢下坠，于是形成“垂柳”般的轨迹。</p><p>火花有寿命，越老越暗，最后消失。</p>',
    params: [['主色调', '火花颜色，相邻几发会偏移色相'], ['时间流速', '整体快慢，0 = 暂停'], ['火花粗细', '火花线宽'], ['每发火花数', '一次爆炸的火花数'], ['重力 g', '越大下坠越快'], ['空气阻力 k', '越大火花减速越快、炸开越小'], ['自动发射间隔 s', '不点击时自动发射的间隔']],
    example: (v) => `<ol><li>目标高度 h = ${fmt(v.h ?? 0, 0)} px，g = ${fmt(v.g ?? 0, 0)}</li><li>v₀ = √(2×${fmt(v.g ?? 0, 0)}×${fmt(v.h ?? 0, 0)}) = ${fmt(v.v0 ?? 0, 0)} px/s</li><li>火花初速 u ≈ ${fmt(v.u ?? 0, 0)}，炸开半径 ≈ u/k = ${fmt(v.rad ?? 0, 0)} px</li></ol>`,
    tip: '点击任意位置在那里放一发；调大阻力看烟花变小。',
  },
  build(S) {
    const R0 = rng(3); const rockets = [], sparks = []; let timer = 0.3, shots = 0, lastV0 = 0, lastH = 0;
    const launch = (tx, ty) => {
      const { W, H } = S; const g = num(S.get().g, 160);
      const x = tx ?? W * (0.2 + R0() * 0.6), y = ty ?? H * (0.18 + R0() * 0.25);
      const h = Math.max(20, H - y); const v0 = Math.sqrt(2 * g * h);
      rockets.push({ x, y: H, vy: -v0, hue: shots * 37 }); shots++; lastV0 = v0; lastH = h;
    };
    S.onDown((P) => launch(P.x, P.y));
    return ({ ctx, W, H, dt, C }) => {
      const g = num(C.g, 160), k = num(C.drag, 1.2), n = Math.round(num(C.count, 90)), lw = num(C.size, 1.4);
      const base = hueOf(C.color || '#f472b6'); const u0 = Math.min(W, H) * 0.3 * (k + 0.35);
      timer -= dt; if (timer <= 0) { timer = num(C.every, 1.2); launch(); }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.vy += g * dt; r.y += r.vy * dt;
        if (r.vy >= 0) {
          rockets.splice(i, 1);
          for (let j = 0; j < n; j++) { const a = (j / n) * TAU + R0() * 0.2, u = u0 * (0.45 + 0.55 * R0()); sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * u, vy: Math.sin(a) * u, life: 1.3 + R0() * 0.9, age: 0, dh: (r.hue % 3) * 22 }); }
        }
      }
      const damp = Math.exp(-k * dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.vx *= damp; p.vy = p.vy * damp + g * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
        if (p.age > p.life || p.y > H + 20) sparks.splice(i, 1);
      }
      if (sparks.length > 4000) sparks.splice(0, sparks.length - 4000);
      S.clear();
      { const gl = ctx.createLinearGradient(0, H * 0.6, 0, H); gl.addColorStop(0, hsla(base, 80, 50, 0)); gl.addColorStop(1, hsla(base, 85, 45, 0.45)); ctx.fillStyle = gl; ctx.fillRect(0, H * 0.6, W, H * 0.4); ctx.fillStyle = '#05070f'; for (let x = 0, i = 0; x < W; x += 34, i++) { const bh = 18 + ((i * 37) % 5) * 9; ctx.fillRect(x, H - bh, 30, bh); } }
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      for (const r of rockets) { ctx.strokeStyle = hsla(base, 90, 75, 0.9); ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y - r.vy * 0.05); ctx.stroke(); }
      for (const p of sparks) {
        const a = 1 - p.age / p.life; ctx.strokeStyle = hsla(base + p.dh, 90, 55 + 25 * a, a); ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      return { sparks: sparks.length, rockets: rockets.length, shots, g, k, v0: lastV0, h: lastH, u: u0 * 0.72, rad: (u0 * 0.72) / k, per: Math.round(num(C.count, 90)), every: num(C.every, 1.2), ix: String(shots) };
    };
  },
};

/* ───────────────────────── draw ───────────────────────── */
FAM.draw = {
  spec: { color: { label: '笔刷颜色', value: '#22d3ee' }, speed: false, size: { label: '笔刷粗细', min: 1, max: 30, step: 1, value: 6 }, count: false, extras: [R('smooth', '平滑度 s', 0, 0.9, 0.05, 0.5), R('fade', '褪色速度', 0, 1, 0.05, 0.15), T('press', '速度感应线宽', true), T('ghost', '自动示范笔', true)], remountKeys: [] },
  presets: { 钢笔: {}, 粗马克: { size: 22 }, 细线: { size: 2, press: false }, 不褪色: { fade: 0 }, 高平滑: { smooth: 0.85 } },
  doc: {
    title: '画板 · 指数平滑笔刷',
    rows: (v) => [['笔画数', String(v.strokes ?? 0)], ['总长度', `${fmt(v.len ?? 0, 0)} px`], ['笔速 v', `${fmt(v.v ?? 0, 0)} px/s`, 'v'], ['当前线宽', `${fmt(v.w ?? 0, 1)} px`], ['平滑度 s', fmt(v.s ?? 0, 2)], ['笔刷颜色', String(v.col ?? '')], ['褪色', fmt(v.fade ?? 0, 2)], ['速度感应 / 示范笔', `${v.press ? '开' : '关'} / ${v.ghost ? '开' : '关'}`]],
    formula: () => F('平滑点 p̃ ← p̃ + (1 − s)·(p − p̃)') + F('线宽 w = 粗细 × clamp(1.4 − v/1200, 0.4, 1.4)') + F('段长 Δl = |p̃ₙ − p̃ₙ₋₁|，总长 = ΣΔl'),
    explain: '<p>手指或鼠标的原始坐标会抖动。笔刷不直接用原始点，而是让“笔尖”每次只朝原始点走 (1 − s) 的比例，这叫<b>指数平滑</b>，s 越大线越顺滑但越“拖”。</p><p>打开速度感应后，画得快线变细、画得慢线变粗，像真实的毛笔。</p><p>画好的笔迹存在一张离屏画布上，褪色速度 &gt; 0 时会慢慢淡去。双击清空画板。</p>',
    params: [['笔刷颜色', '新笔画的颜色（光标圈即预览）'], ['笔刷粗细', '基准线宽 px'], ['平滑度 s', '0 = 原始坐标，越大越顺滑'], ['褪色速度', '笔迹淡出速度，0 = 永久保留'], ['速度感应线宽', '快细慢粗'], ['自动示范笔', '无人操作时自动画一条曲线']],
    example: (v) => `<ol><li>s = ${fmt(v.s ?? 0, 2)}，每帧笔尖走剩余距离的 ${fmt(1 - (v.s ?? 0), 2)}</li><li>当前笔速 ${fmt(v.v ?? 0, 0)} px/s → 线宽 ${fmt(v.w ?? 0, 1)} px</li><li>已画 ${v.strokes} 笔，共 ${fmt(v.len ?? 0, 0)} px</li></ol>`,
    tip: '按住拖动绘画（支持触屏）；双击清空。',
  },
  build(S) {
    let L = null, strokes = 0, len = 0, sp = null, lastW = 0, speed = 0, ghostDown = false;
    const ensure = (W, H) => {
      if (L && Math.abs(L.w - W * S.dpr) <= 1 && Math.abs(L.h - H * S.dpr) <= 1) return;
      const old = L; L = makeLayer(W, H, S.dpr); L.x.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (old) L.x.drawImage(old.c, 0, 0, W, H);
    };
    S.onDown((P) => { sp = { x: P.x, y: P.y }; strokes++; ghostDown = false; });
    S.onUp(() => { sp = null; });
    const dbl = () => { if (L) L.x.clearRect(0, 0, S.W, S.H); strokes = 0; len = 0; };
    S.canvas.addEventListener('dblclick', dbl); S.disposers.push(() => S.canvas.removeEventListener('dblclick', dbl));
    return ({ ctx, W, H, dt, dtw, C, P }) => {
      ensure(W, H);
      const s = num(C.smooth, 0.5), base = num(C.size, 6), col = C.color || '#22d3ee';
      const ghost = on(C.ghost ?? true) && !P.user;
      if (ghost && !ghostDown) { ghostDown = true; sp = { x: P.x, y: P.y }; strokes++; }
      if (!ghost && ghostDown && !P.down) { ghostDown = false; sp = null; }
      if (dtw > 0 && num(C.fade, 0.15) > 0) {
        L.x.globalCompositeOperation = 'destination-out'; L.x.fillStyle = `rgba(0,0,0,${fadeA(num(C.fade, 0.15) * 0.03, dtw)})`; L.x.fillRect(0, 0, W, H); L.x.globalCompositeOperation = 'source-over';
      }
      if (sp && (P.down || ghost) && dtw > 0) {
        const k = 1 - Math.pow(s, dtw * 60);
        const nx = sp.x + (P.x - sp.x) * k, ny = sp.y + (P.y - sp.y) * k;
        const dl = Math.hypot(nx - sp.x, ny - sp.y); speed = dl / dtw;
        const w = on(C.press ?? true) ? base * clamp(1.4 - speed / 1200, 0.4, 1.4) : base; lastW = w;
        if (dl > 0.2) { L.x.strokeStyle = col; L.x.lineWidth = w; L.x.lineCap = 'round'; L.x.lineJoin = 'round'; L.x.beginPath(); L.x.moveTo(sp.x, sp.y); L.x.lineTo(nx, ny); L.x.stroke(); len += dl; }
        sp.x = nx; sp.y = ny;
      } else if (dtw > 0) speed *= 0.9;
      S.clear();
      ctx.strokeStyle = 'rgba(148,163,184,.08)'; ctx.lineWidth = 1;
      for (let x = 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 24; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.drawImage(L.c, 0, 0, W, H);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(3, (lastW || base) / 2 + 2), 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(col, 0.35); ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(2, base / 2), 0, TAU); ctx.fill();
      return { strokes, len, v: speed, w: lastW || base, s, col: String(col).toLowerCase(), fade: num(C.fade, 0.15), press: on(C.press ?? true), ghost: on(C.ghost ?? true), ix: `${strokes}:${len | 0}` };
    };
  },
};

/* ───────────────────────── orbits ───────────────────────── */
FAM.orbits = {
  spec: { color: { label: '粒子颜色', value: '#818cf8' }, speed: SPD('公转速度'), size: { label: '点大小', min: 0.5, max: 3, step: 0.1, value: 1.3 }, count: { label: '粒子数 N', min: 50, max: 800, step: 10, value: 300, buttons: true }, extras: [R('rings', '轨道层数', 1, 6, 1, 3), R('push', '指针扰动', 0, 2, 0.1, 0.8)], remountKeys: [] },
  presets: { 疏: { count: 120 }, 密: { count: 650 }, 快轨: { speed: 2.2 }, 慢轨: { speed: 0.4 }, 双色: { rings: 2 }, 彩虹: { rings: 6 }, 极细: { size: 0.6 }, 粗点: { size: 2.6 }, 扰动强: { push: 2 } },
  doc: {
    title: '轨道粒子 · 开普勒第三定律',
    rows: (v) => [['粒子数 N', String(v.n ?? 0)], ['轨道层数', String(v.rings ?? 0)], ['内层周期 T₁', `${fmt(v.T1 ?? 0, 1)} s`, 'T1'], ['外层周期 Tₙ', `${fmt(v.Tn ?? 0, 1)} s`], ['T² / r³（应恒定）', fmt(v.k ?? 0, 3)], ['被扰动粒子', String(v.hit ?? 0)], ['指针扰动强度', fmt(v.push ?? 0, 2)]],
    formula: () => F('角速度 ω = ω₀ · (r / r₀)^(−3/2)') + F('周期 T = 2π / ω，T² ∝ r³（开普勒第三定律）') + F('扰动：Δr ← Δr·e^(−2t) + 推力'),
    explain: '<p>粒子分成几层圆环绕中心转。像行星一样，<b>越外层转得越慢</b>：角速度与半径的 −3/2 次方成正比，所以 T²/r³ 对每一层都是同一个常数。</p><p>指针靠近时会把粒子沿径向推开，之后像弹簧一样慢慢回到原轨道（指数衰减）。</p><p>椭圆是把圆在竖直方向压扁 0.6 倍，模拟从斜上方看的透视。</p>',
    params: [['粒子颜色', '内层颜色，外层逐渐偏移色相'], ['公转速度', '时间流速，0 = 暂停'], ['点大小', '粒子半径'], ['粒子数 N', '总粒子数，均分到各层'], ['轨道层数', '圆环层数'], ['指针扰动', '指针推开粒子的力度']],
    example: (v) => `<ol><li>内层半径 ${fmt(v.r1 ?? 0, 0)}px，周期 ${fmt(v.T1 ?? 0, 1)}s</li><li>外层半径 ${fmt(v.rn ?? 0, 0)}px，周期 ${fmt(v.Tn ?? 0, 1)}s</li><li>(${fmt(v.Tn ?? 0, 1)}/${fmt(v.T1 ?? 0, 1)})² = ${fmt(((v.Tn ?? 1) / (v.T1 || 1)) ** 2, 2)} ≈ (${fmt(v.rn ?? 0, 0)}/${fmt(v.r1 ?? 0, 0)})³ = ${fmt(((v.rn ?? 1) / (v.r1 || 1)) ** 3, 2)}</li></ol>`,
    tip: '把指针移进轨道里扰动粒子，看它们弹回原轨道。',
  },
  build(S) {
    const R0 = rng(21); const ps = [];
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 300)), 10, 2000), rings = clamp(Math.round(num(C.rings, 3)), 1, 8), push = num(C.push, 0.8);
      while (ps.length < n) ps.push({ a: R0() * TAU, j: R0(), q: R0(), dr: 0 });
      if (ps.length > n) ps.length = n;
      const cx = W / 2, cy = H / 2, Rm = Math.min(W / 2, H / 2 / 0.6) * 0.9, w0 = 1.1;
      const rOf = (i) => Rm * (0.3 + (0.7 * (i + 1)) / rings);
      const base = hueOf(C.color || '#818cf8'); const sz = num(C.size, 1.3);
      S.clear(); let hit = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < rings; i++) { ctx.strokeStyle = hsla(base + i * 28, 60, 60, 0.12); ctx.beginPath(); ctx.ellipse(cx, cy, rOf(i), rOf(i) * 0.6, 0, 0, TAU); ctx.stroke(); }
      for (const p of ps) {
        const ring = Math.floor(p.q * rings), r = rOf(ring) + (p.j - 0.5) * Rm * 0.08;
        const w = w0 * Math.pow(r / rOf(0), -1.5); p.a += w * dt;
        const x0 = cx + Math.cos(p.a) * (r + p.dr), y0 = cy + Math.sin(p.a) * (r + p.dr) * 0.6;
        const dd = dist(x0, y0, P.x, P.y);
        if (dd < 70 && push > 0) { const rp = Math.hypot(P.x - cx, (P.y - cy) / 0.6); p.dr += push * 260 * (1 - dd / 70) * dt * (rp < r + p.dr ? 1 : -1); hit++; }
        p.dr *= Math.exp(-2 * dt);
        const x = cx + Math.cos(p.a) * (r + p.dr), y = cy + Math.sin(p.a) * (r + p.dr) * 0.6;
        ctx.fillStyle = hsla(base + ring * 28, 85, 66, 0.9); ctx.beginPath(); ctx.arc(x, y, sz * (0.7 + 0.5 * Math.sin(p.a) ** 2), 0, TAU); ctx.fill();
      }
      ctx.fillStyle = rgba(mix(C.color || '#818cf8', 0.7), 1); ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      const r1 = rOf(0), rn = rOf(rings - 1), T1 = TAU / (w0 * C.speed || 1e-9), Tn = TAU / (w0 * Math.pow(rn / r1, -1.5) * C.speed || 1e-9);
      return { n, rings, T1: C.speed ? T1 : 0, Tn: C.speed ? Tn : 0, k: C.speed ? (T1 * T1) / (r1 / 100) ** 3 : 0, r1, rn, hit, push: num(C.push, 1), ix: String(hit) };
    };
  },
};

/* ───────────────────────── trail ───────────────────────── */
FAM.trail = {
  spec: { color: { label: '拖尾颜色', value: '#f472b6' }, speed: SPD('自动轨迹速度'), size: { label: '拖尾粗细', min: 0.3, max: 3, step: 0.1, value: 1 }, count: { label: '节点数 n', min: 8, max: 80, step: 2, value: 36, buttons: true }, extras: [R('k', '跟随系数 k', 0.05, 0.6, 0.01, 0.25), T('rainbow', '彩虹渐变', false)], remountKeys: [] },
  presets: { 霓虹: {}, 烟: { size: 2.6, k: 0.12 }, 星屑: { size: 0.5, count: 60 }, 墨迹: { k: 0.08 }, 彩虹: { rainbow: true }, 像素: { count: 14 }, 火花: { size: 0.4, k: 0.45 }, 光剑: { size: 1.6, k: 0.55 }, 萤火: { count: 70, k: 0.1 }, 水彩: { size: 2.8, rainbow: true } },
  doc: {
    title: '指针拖尾 · 链式插值',
    rows: (v) => [['节点数 n', String(v.n ?? 0)], ['跟随系数 k', fmt(v.k ?? 0, 2)], ['半衰期', `${fmt(v.half ?? 0, 1)} 帧`, 'half'], ['头部速度', `${fmt(v.vh ?? 0, 0)} px/s`], ['尾部滞后', `${fmt(v.lag ?? 0, 0)} px`], ['彩虹', v.rb ? '开' : '关']],
    formula: () => F('每帧：pᵢ ← pᵢ + k·(pᵢ₋₁ − pᵢ)，p₀ 跟随指针') + F('剩余差距每帧 ×(1 − k)，半衰期 = ln 0.5 / ln(1 − k) 帧') + F('线宽 wᵢ = 12 × 粗细 × (1 − i / n)'),
    explain: '<p>拖尾由 n 个节点组成。第 0 个追指针，第 1 个追第 0 个……每个节点每帧只走过剩余距离的 k 倍，这就是<b>线性插值（lerp）</b>。</p><p>因为每一节都“慢半拍”，整条线就像被拖着的丝带。k 越小越柔、越拖得长；k 越大越紧贴指针。</p><p>线宽从头到尾逐渐变细，形成渐隐的尾巴。</p>',
    params: [['拖尾颜色', '丝带颜色'], ['自动轨迹速度', '无人操作时自动指针的速度'], ['拖尾粗细', '整体线宽倍数'], ['节点数 n', '节点越多尾巴越长'], ['跟随系数 k', '每帧追上的比例'], ['彩虹渐变', '沿尾巴变化色相']],
    example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 2)}：每帧剩余差距 ×${fmt(1 - (v.k ?? 0), 2)}</li><li>半衰期 = ln0.5/ln${fmt(1 - (v.k ?? 0), 2)} = ${fmt(v.half ?? 0, 1)} 帧</li><li>${v.n} 节累积滞后 ≈ ${fmt(v.lag ?? 0, 0)} px</li></ol>`,
    tip: '在画布上移动/拖动指针，快速甩动看丝带的惯性。',
  },
  build(S) {
    const pts = [];
    return ({ ctx, W, H, dtw, C, P }) => {
      const n = clamp(Math.round(num(C.count, 36)), 2, 200), k = num(C.k, 0.25);
      while (pts.length < n) { const l = pts[pts.length - 1] || P; pts.push({ x: l.x, y: l.y }); }
      if (pts.length > n) pts.length = n;
      const a = 1 - Math.pow(1 - k, dtw * 60);
      let tx = P.x, ty = P.y;
      for (const p of pts) { p.x += (tx - p.x) * a; p.y += (ty - p.y) * a; tx = p.x; ty = p.y; }
      S.clear();
      const base = hueOf(C.color || '#f472b6'), rb = on(C.rainbow), sz = num(C.size, 1);
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < n; i++) {
        const f = 1 - i / n; ctx.strokeStyle = rb ? hsla(base + i * (300 / n), 90, 62, f) : rgba(C.color || '#f472b6', 0.25 + 0.75 * f);
        ctx.lineWidth = Math.max(0.5, 12 * sz * f); ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      { const gl = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 70 * Math.max(0.6, sz)); gl.addColorStop(0, rgba(C.color || '#f472b6', 0.55)); gl.addColorStop(1, rgba(C.color || '#f472b6', 0)); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(P.x, P.y, 70 * Math.max(0.6, sz), 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, P.y, 3, 0, TAU); ctx.fill();
      const lag = dist(P.x, P.y, pts[n - 1].x, pts[n - 1].y);
      return { n, k, half: Math.log(0.5) / Math.log(1 - k), vh: Math.hypot(P.vx, P.vy), lag, rb, ix: `${lag | 0}` };
    };
  },
};

/* ───────────────────────── blob ───────────────────────── */
FAM.blob = {
  spec: { color: { label: '软体颜色', value: '#22d3ee' }, speed: SPD('摆动速度'), size: { label: '半径 R', min: 0.5, max: 1.5, step: 0.05, value: 1 }, count: { label: '顶点数', min: 8, max: 64, step: 2, value: 32, buttons: true }, extras: [R('soft', '柔软度', 0.1, 1, 0.05, 0.5), R('push', '指针推力', 0, 2, 0.1, 1)], remountKeys: [] },
  presets: { 默认: {}, 软: { soft: 0.9 }, 硬: { soft: 0.15 }, 多彩: { count: 48 }, 慢: { speed: 0.4 }, 快: { speed: 2.2 }, 大: { size: 1.4 } },
  doc: {
    title: '软体 Blob · 弹簧顶点',
    rows: (v) => [['顶点数', String(v.n ?? 0)], ['面积 A', `${fmt(v.A ?? 0, 0)} px²`, 'A'], ['静止面积 πR²', `${fmt(v.A0 ?? 0, 0)} px²`], ['形变 |A−A₀|/A₀', `${fmt((v.def ?? 0) * 100, 1)} %`], ['周长', `${fmt(v.L ?? 0, 0)} px`], ['柔软度 / 推力', `${fmt(v.soft ?? 0, 2)} / ${fmt(v.push ?? 0, 2)}`]],
    formula: () => F('目标半径 r(θ) = R·(1 + 0.08 sin(3θ + t) + 0.05 sin(5θ − 1.3t))') + F('弹簧：a = −k·(r − r目标) − c·v，k = 60·(1.1 − 柔软度)') + F('面积（鞋带公式）A = ½|Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|'),
    explain: '<p>软体边缘是一圈顶点，每个顶点只沿径向移动，被一根<b>弹簧</b>拉向“目标半径”。目标半径随时间轻微起伏，于是整体像果冻一样蠕动。</p><p>相邻顶点之间还有平滑力，避免出现尖刺。指针靠近会把顶点向内推，松开后弹回。</p><p>面积用<b>鞋带公式</b>由所有顶点坐标算出，可以看到形变时面积如何变化。</p>',
    params: [['软体颜色', '填充颜色'], ['摆动速度', '蠕动快慢'], ['半径 R', '静止半径（相对画布）'], ['顶点数', '边缘顶点数，越多越圆滑'], ['柔软度', '越大弹簧越软、晃得越久'], ['指针推力', '指针按压的力度']],
    example: (v) => `<ol><li>R = ${fmt(v.R ?? 0, 0)} px，A₀ = π×${fmt(v.R ?? 0, 0)}² = ${fmt(v.A0 ?? 0, 0)}</li><li>当前 A = ${fmt(v.A ?? 0, 0)}</li><li>形变 = ${fmt((v.def ?? 0) * 100, 1)}%</li></ol>`,
    tip: '把指针压进软体里推它；调柔软度对比软硬。',
  },
  build(S) {
    let vs = [];
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 32)), 6, 128), soft = num(C.soft, 0.5), push = num(C.push, 1);
      if (vs.length !== n) vs = Array.from({ length: n }, () => ({ d: 0, v: 0 }));
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3 * num(C.size, 1);
      const k = 60 * (1.1 - soft), c = 2 + 6 * (1 - soft);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU, q = vs[i];
        const tgt = R * (1 + 0.08 * Math.sin(3 * th + t) + 0.05 * Math.sin(5 * th - 1.3 * t));
        const r = tgt + q.d; const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
        let f = -k * q.d - c * q.v;
        const L = vs[(i + n - 1) % n].d, Rr = vs[(i + 1) % n].d; f += 20 * (L + Rr - 2 * q.d);
        const dp = dist(x, y, P.x, P.y), rp = dist(P.x, P.y, cx, cy);
        if (dp < R * 0.6 && rp < r + 10) f -= push * 900 * (1 - dp / (R * 0.6));
        q.v += f * dt; q.d += q.v * dt; q.d = clamp(q.d, -R * 0.7, R * 0.5);
        pts.push([cx + Math.cos(th) * (tgt + q.d), cy + Math.sin(th) * (tgt + q.d)]);
      }
      S.clear();
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R * 1.2);
      g.addColorStop(0, rgba(mix(C.color || '#22d3ee', 0.5), 1)); g.addColorStop(1, rgba(C.color || '#22d3ee', 0.85));
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (!i) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a[0], a[1], mx, my); }
      const a0 = pts[0], b0 = pts[1 % n]; ctx.quadraticCurveTo(a0[0], a0[1], (a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, TAU); ctx.fill(); }
      let A = 0, Lp = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; Lp += dist(a[0], a[1], b[0], b[1]); }
      A = Math.abs(A) / 2; const A0 = Math.PI * R * R;
      return { n, A, A0, def: Math.abs(A - A0) / A0, L: Lp, soft, push: num(C.push, 1), R, hx: cx + R * 0.6, hy: cy, ix: `${(A / 10) | 0}` };
    };
  },
};

/* ───────────────────────── rain ───────────────────────── */
FAM.rain = {
  spec: { color: { label: '雨滴颜色', value: '#93c5fd' }, speed: SPD(), size: { label: '雨滴长度', min: 0.5, max: 3, step: 0.1, value: 1 }, count: { label: '雨滴数 N', min: 50, max: 1000, step: 10, value: 320, buttons: true }, extras: [R('wind', '风速 w', -300, 300, 10, 40), R('drag', '空气阻力 k', 0.5, 6, 0.1, 2.5)], remountKeys: [] },
  presets: { 细雨: { count: 160, size: 0.6 }, 暴雨: { count: 900, size: 1.6 }, 斜风: { wind: 220 }, 彩雨: { size: 1.2 }, 雪感: { drag: 6, size: 0.5 }, 火花雨: { drag: 1 }, 慢飘: { speed: 0.4 } },
  doc: {
    title: '粒子雨 · 终端速度',
    rows: (v) => [['雨滴数 N', String(v.n ?? 0)], ['终端速度 v_t = g/k', `${fmt(v.vt ?? 0, 0)} px/s`, 'vt'], ['风速 w', `${fmt(v.w ?? 0, 0)} px/s`], ['倾斜角 atan(w/v_t)', `${fmt(v.tilt ?? 0, 1)}°`], ['水花', String(v.spl ?? 0)], ['伞挡雨', `${fmt(v.blocked ?? 0, 0)} 滴/s`]],
    formula: () => F('a = g − k·(v − 风)，竖直 g = 900 px/s²') + F('a = 0 时达到终端速度 v_t = g / k') + F('雨线倾角 φ = atan(w / v_t)'),
    explain: '<p>每滴雨受两个力：向下的<b>重力</b>和与相对空气速度成正比的<b>阻力</b>。刚开始越落越快，直到阻力等于重力，速度不再增加，这就是<b>终端速度</b> g/k。</p><p>水平方向上，阻力把雨滴拉向风速，所以雨线会倾斜 atan(w/v_t)。</p><p>指针是一把“伞”，打到伞面或地面的雨滴会溅起小水花。</p>',
    params: [['雨滴颜色', '雨线颜色'], ['时间流速', '0 = 暂停'], ['雨滴长度', '雨线长度倍数'], ['雨滴数 N', '同屏雨滴数'], ['风速 w', '正值向右吹，负值向左'], ['空气阻力 k', '越大终端速度越小、越像雪']],
    example: (v) => `<ol><li>v_t = 900 / ${fmt(v.k ?? 0, 1)} = ${fmt(v.vt ?? 0, 0)} px/s</li><li>φ = atan(${fmt(v.w ?? 0, 0)}/${fmt(v.vt ?? 0, 0)}) = ${fmt(v.tilt ?? 0, 1)}°</li><li>达到终端速度的 95% 需要 3/k = ${fmt(3 / (v.k || 1), 2)} s</li></ol>`,
    tip: '指针是一把伞，移到雨里挡雨；调风速看雨线倾斜。',
  },
  build(S) {
    const R0 = rng(9); const drops = [], spl = []; let blockedAcc = 0, blockedRate = 0, rateT = 0;
    const g = 900;
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 320)), 10, 3000), k = num(C.drag, 2.5), w = num(C.wind, 40);
      while (drops.length < n) drops.push({ x: R0() * W * 1.4 - W * 0.2, y: R0() * H, vx: w, vy: g / k * (0.5 + R0() * 0.5), m: 0.7 + R0() * 0.6 });
      if (drops.length > n) drops.length = n;
      const umb = 46;
      for (const d of drops) {
        d.vx += (w - d.vx) * k * dt; d.vy += (g - k * d.vy) * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        const hitU = dist(d.x, d.y, P.x, P.y) < umb && d.y < P.y;
        if (d.y > H || hitU) {
          if (spl.length < 600) for (let i = 0; i < 3; i++) spl.push({ x: d.x, y: hitU ? d.y : H - 1, vx: (R0() - 0.5) * 120 + d.vx * 0.2, vy: -60 - R0() * 120, life: 0.35 });
          if (hitU) blockedAcc++;
          d.y = -10 - R0() * 40; d.x = R0() * W * 1.4 - W * 0.2 - w * 0.3; d.vy = g / k * 0.6;
        }
        if (d.x < -W * 0.3) d.x += W * 1.6; else if (d.x > W * 1.3) d.x -= W * 1.6;
      }
      for (let i = spl.length - 1; i >= 0; i--) { const s = spl[i]; s.vy += g * 0.6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.life <= 0) spl.splice(i, 1); }
      rateT += dt; if (rateT > 0.5) { blockedRate = blockedAcc / rateT; blockedAcc = 0; rateT = 0; }
      S.clear();
      const col = C.color || '#93c5fd', L = num(C.size, 1) * 0.035;
      ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 1.2; ctx.beginPath();
      for (const d of drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * L * d.m, d.y - d.vy * L * d.m); }
      ctx.stroke();
      ctx.fillStyle = rgba(mix(col, 0.4), 0.9); for (const s of spl) ctx.fillRect(s.x, s.y, 1.6, 1.6);
      ctx.strokeStyle = rgba(mix(col, 0.6), 0.9); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(P.x, P.y, umb, Math.PI, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x, P.y + 30); ctx.stroke();
      const vt = g / k;
      return { n, vt, w, k, tilt: (Math.atan2(w, vt) * 180) / Math.PI, spl: spl.length, blocked: blockedRate };
    };
  },
};

/* ───────────────────────── wave ───────────────────────── */
FAM.wave = {
  spec: { color: { label: '水面颜色', value: '#38bdf8' }, speed: SPD('波速'), size: { label: '振幅 A', min: 0.2, max: 2.5, step: 0.05, value: 1 }, count: { label: '波层数', min: 1, max: 6, step: 1, value: 4, buttons: true }, extras: [R('k', '波数 k', 0.004, 0.04, 0.001, 0.012), R('press', '指针按压', 0, 1.5, 0.05, 0.6)], remountKeys: [] },
  presets: { 正弦叠层: {}, 干涉纹: { k: 0.03, count: 2 }, 液体面: { size: 0.6, count: 6 }, 声波: { k: 0.035, size: 0.5 }, 海岸线: { size: 2, k: 0.006 }, 多层视差波: { count: 6 }, 极坐标波: { k: 0.02 }, 噪声波: { press: 1.4 } },
  doc: {
    title: '波浪 · 正弦叠加',
    rows: (v) => [['波层数', String(v.n ?? 0)], ['振幅 A', `${fmt(v.A ?? 0, 0)} px`], ['波长 λ = 2π/k', `${fmt(v.lam ?? 0, 0)} px`, 'lam'], ['角频率 ω', `${fmt(v.w ?? 0, 2)} rad/s`], ['波速 v = ω/k', `${fmt(v.v ?? 0, 0)} px/s`], ['指针处水面 y', `${fmt(v.yp ?? 0, 0)} px`]],
    formula: () => F('yᵢ(x,t) = y₀ + A·sin(kᵢx − ωᵢt + φᵢ) + 0.35A·sin(1.7kᵢx + 0.6ωᵢt)') + F('λ = 2π / k，v = ω / k') + F('按压：Δy = p·(y指针 − y)·e^(−((x − x指针)/80)²)'),
    explain: '<p>每一层水面都是两条正弦波的叠加：一条主波向右传，一条短波向左传，叠在一起就有了起伏不规则的感觉。</p><p>越靠后的层振幅越小、颜色越暗、速度越慢，产生<b>视差</b>深度感。</p><p><b>波长</b> λ 是两个波峰的距离，<b>波速</b> = ω/k。指针会把最前面一层水面“按”向指针位置，用高斯函数让影响只在附近。</p>',
    params: [['水面颜色', '最前层颜色，后层更暗'], ['波速', '时间流速'], ['振幅 A', '波浪高度'], ['波层数', '叠加的水面层数'], ['波数 k', 'k 越大波长越短'], ['指针按压', '指针对前层水面的吸引程度']],
    example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 3)} → λ = 2π/k = ${fmt(v.lam ?? 0, 0)} px</li><li>ω = ${fmt(v.w ?? 0, 2)} → v = ω/k = ${fmt(v.v ?? 0, 0)} px/s</li><li>一个周期 T = 2π/ω = ${v.w ? fmt(TAU / v.w, 2) : '∞'} s</li></ol>`,
    tip: '把指针放到水面附近“按”水；调波数改变波长。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 4)), 1, 8), k = num(C.k, 0.012), A = 26 * num(C.size, 1) * Math.min(1, H / 300), press = num(C.press, 0.6);
      const rgb = hexRgb(C.color || '#38bdf8'); const w0 = 1.6;
      S.clear();
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b1224'); sky.addColorStop(1, '#060a14'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      let yp = 0;
      for (let L = n - 1; L >= 0; L--) {
        const depth = L / Math.max(1, n - 1 || 1), kk = k * (1 + L * 0.25), ww = w0 * (1 - L * 0.1), AA = A * (1 - depth * 0.55);
        const y0 = H * (0.42 + 0.4 * (1 - depth)) - (n > 1 ? 0 : -H * 0.05) - H * 0.12;
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 4; x += 4) {
          let y = y0 + AA * Math.sin(kk * x - ww * t + L * 1.3) + 0.35 * AA * Math.sin(1.7 * kk * x + 0.6 * ww * t + L);
          if (L === 0) { y += press * (P.y - y) * Math.exp(-(((x - P.x) / 80) ** 2)) * 0.8; if (Math.abs(x - P.x) < 2.5) yp = y; }
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath();
        const sh = 1 - depth * 0.6;
        ctx.fillStyle = `rgba(${(rgb[0] * sh) | 0},${(rgb[1] * sh) | 0},${(rgb[2] * sh) | 0},${0.55 + 0.4 * (1 - depth)})`; ctx.fill();
        ctx.strokeStyle = rgba(mix(C.color || '#38bdf8', 0.6), 0.5 * (1 - depth) + 0.15); ctx.lineWidth = 1.2; ctx.stroke();
      }
      if (!yp) yp = H * 0.7;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, yp, 3, 0, TAU); ctx.fill();
      const w = w0 * C.speed;
      return { n, A, k, lam: TAU / k, w, v: w / k, yp, ix: `${yp | 0}` };
    };
  },
};

/* ───────────────────────── noise ───────────────────────── */
const NOISE_MODES = ['', '平滑', '大理石', '湍流'];
FAM.noise = {
  spec: { color: { label: '色调', value: '#818cf8' }, speed: SPD('漂移速度'), size: { label: '缩放（特征尺寸）', min: 0.5, max: 4, step: 0.1, value: 1.6 }, count: { label: '倍频数（octaves）', min: 1, max: 6, step: 1, value: 4, buttons: true }, extras: [R('warp', '域扭曲强度', 0, 2, 0.05, 0), R('mode', '模式 1平滑 2大理石 3湍流', 1, 3, 1, 1)], remountKeys: [] },
  presets: { Value: { count: 1 }, 'FBM 流': { count: 4 }, 域扭曲: { warp: 1.2 }, 云层: { count: 6, size: 1 }, 大理石: { mode: 2 }, 电浆: { mode: 2, warp: 0.8 }, 像素风: { size: 3.6, count: 2 }, 湍流: { mode: 3 } },
  doc: {
    title: '噪声场 · 分形布朗运动 FBM',
    rows: (v) => [['倍频数 n', String(v.oct ?? 0)], ['基础频率 f', `${fmt(v.f ?? 0, 3)} /px`], ['总振幅 Σ0.5ⁱ', fmt(v.amp ?? 0, 3)], ['模式', String(v.mode ?? '')], ['域扭曲', fmt(v.warp ?? 0, 2)], ['指针处数值', fmt(v.vp ?? 0, 3), 'vp']],
    formula: () => F('fbm(p) = Σᵢ 0.5ⁱ · noise(2ⁱ · f · p) / Σ 0.5ⁱ') + F('域扭曲：p′ = p + w · (fbm(p+a), fbm(p+b))') + F('大理石 = ½ + ½ sin(10·fbm)，湍流 = |2·fbm − 1|'),
    explain: '<p><b>值噪声</b>在整数格点放随机数，中间用平滑曲线插值，得到柔和的起伏。</p><p>把同一个噪声按频率 ×2、振幅 ×0.5 叠加多层（倍频），大轮廓上就有了小细节，这就是 <b>FBM</b>，常用来做云、地形、火焰。</p><p><b>域扭曲</b>先用噪声把坐标推歪再采样，形状会变成流动的漩涡。第三个维度用时间，所以图案会缓慢演化。</p>',
    params: [['色调', '亮处的颜色'], ['漂移速度', '时间维度的推进速度'], ['缩放（特征尺寸）', '越大图案越粗'], ['倍频数（octaves）', '叠加层数，越多细节越多'], ['域扭曲强度', '0 = 不扭曲'], ['模式 1平滑 2大理石 3湍流', '把 fbm 值再映射成不同纹理']],
    example: (v) => `<ol><li>n = ${v.oct} 层，频率 f, 2f, 4f…</li><li>振幅 0.5 + 0.25 + … = ${fmt(v.amp ?? 0, 3)}（再归一化到 0~1）</li><li>指针处 fbm = ${fmt(v.vp ?? 0, 3)}</li></ol>`,
    tip: '移动指针读取该点的噪声值；切换模式与倍频对比纹理。',
  },
  build(S) {
    const N = makeNoise(17); let L = null;
    return ({ ctx, W, H, t, C, P }) => {
      const cols = Math.min(180, Math.max(40, Math.round(W / 5))), rows = Math.max(20, Math.round((cols * H) / W));
      if (!L || L.w !== cols || L.h !== rows) { L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows); }
      const oct = clamp(Math.round(num(C.count, 4)), 1, 8), sc = num(C.size, 1.6), warp = num(C.warp, 0), mode = clamp(Math.round(num(C.mode, 1)), 1, 3);
      const f = 1 / (60 * sc); const z = t * 0.25; const cell = W / cols;
      const rgb = hexRgb(C.color || '#818cf8'); const d = L.img.data;
      const val = (px, py) => {
        let x = px * f, y = py * f;
        if (warp > 0) { const a = N.fbm(x + 5.2, y + 1.3, z, 3), b = N.fbm(x + 1.7, y + 9.2, z, 3); x += warp * (a - 0.5) * 4; y += warp * (b - 0.5) * 4; }
        let v = N.fbm(x, y, z, oct);
        if (mode === 2) v = 0.5 + 0.5 * Math.sin(v * 10 + x * 2); else if (mode === 3) v = Math.abs(2 * v - 1) * 1.4;
        return clamp(v, 0, 1);
      };
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const v = val(i * cell, j * cell); const v2 = v * v; const o = (j * cols + i) * 4; const hi = Math.max(0, v - 0.75) * 2;
        d[o] = 6 + (rgb[0] - 6) * v2 + 255 * hi * 0.4; d[o + 1] = 10 + (rgb[1] - 10) * v2 + 255 * hi * 0.4; d[o + 2] = 20 + (rgb[2] - 20) * v2 + 255 * hi * 0.4; d[o + 3] = 255;
      }
      L.x.putImageData(L.img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(L.c, 0, 0, W, H);
      const vp = val(P.x, P.y);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P.x, P.y, 7, 0, TAU); ctx.moveTo(P.x - 12, P.y); ctx.lineTo(P.x + 12, P.y); ctx.moveTo(P.x, P.y - 12); ctx.lineTo(P.x, P.y + 12); ctx.stroke();
      let amp = 0; for (let i = 0; i < oct; i++) amp += 0.5 ** (i + 1);
      return { oct, f, amp, mode: NOISE_MODES[mode], warp, vp, ix: fmt(vp, 3) };
    };
  },
};

/* ───────────────────────── flock ───────────────────────── */
FAM.flock = {
  spec: { color: { label: '个体颜色', value: '#22d3ee' }, speed: SPD('时间流速'), size: { label: '个体大小', min: 0.5, max: 2.5, step: 0.1, value: 1 }, count: { label: '个体数 N', min: 20, max: 250, step: 10, value: 110, buttons: true }, extras: [R('sep', '分离权重', 0, 3, 0.1, 1.5), R('ali', '对齐权重', 0, 3, 0.1, 1), R('coh', '聚合权重', 0, 3, 0.1, 1), T('flee', '指针是捕食者', true)], remountKeys: [] },
  presets: { 鸟群: {}, 鱼群: { ali: 2, coh: 1.6 }, 避障: { sep: 3 }, 环绕: { coh: 3, ali: 0.5 }, 捕食逃逸: { flee: true, sep: 2 }, 网格对齐: { ali: 3, coh: 0.3 } },
  doc: {
    title: 'Boids 群体 · 三条局部规则',
    rows: (v) => [['个体数 N', String(v.n ?? 0)], ['平均速度', `${fmt(v.vm ?? 0, 0)} px/s`], ['极化度 φ', fmt(v.pol ?? 0, 2), 'pol'], ['平均邻居数', fmt(v.nb ?? 0, 1)], ['逃离个体', String(v.fl ?? 0)], ['权重 分离/对齐/聚合', `${fmt(v.ws ?? 0, 1)} / ${fmt(v.wa ?? 0, 1)} / ${fmt(v.wc ?? 0, 1)}`]],
    formula: () => F('a = w分·Σ(p − pⱼ)/r² + w对·(v̄邻 − v) + w聚·(p̄邻 − p)') + F('速度限制 40 ≤ |v| ≤ 110 px/s') + F('极化度 φ = |Σ v̂ᵢ| / N（1 = 完全同向）'),
    explain: '<p>1986 年 Reynolds 发现：每只鸟只看<b>附近 50px 内</b>的同伴，遵守三条规则，就能涌现出逼真的群体运动：</p><p>① <b>分离</b>：离太近就推开；② <b>对齐</b>：方向向邻居的平均方向靠拢；③ <b>聚合</b>：向邻居的中心靠拢。</p><p>没有“领头鸟”，整体形态完全是局部规则的结果。极化度 φ 衡量大家方向一致的程度。打开捕食者后，靠近指针的个体会逃开。</p>',
    params: [['个体颜色', '三角形颜色'], ['时间流速', '0 = 暂停'], ['个体大小', '三角形大小'], ['个体数 N', '群体规模'], ['分离权重', '避免拥挤的强度'], ['对齐权重', '跟随邻居方向的强度'], ['聚合权重', '靠拢邻居中心的强度'], ['指针是捕食者', '开：逃离指针；关：被指针吸引']],
    example: (v) => `<ol><li>每个个体平均看到 ${fmt(v.nb ?? 0, 1)} 个邻居</li><li>φ = ${fmt(v.pol ?? 0, 2)}（${(v.pol ?? 0) > 0.7 ? '方向高度一致' : (v.pol ?? 0) > 0.35 ? '部分一致' : '较混乱'}）</li><li>把对齐权重调到 0，φ 会明显下降</li></ol>`,
    tip: '把指针移进群里驱散它们；把对齐调到 3 看整齐的鱼群。',
  },
  build(S) {
    const R0 = rng(31); const b = [];
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 110)), 5, 400);
      while (b.length < n) { const a = R0() * TAU; b.push({ x: R0() * W, y: R0() * H, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 }); }
      if (b.length > n) b.length = n;
      const ws = num(C.sep, 1.5), wa = num(C.ali, 1), wc = num(C.coh, 1), flee = on(C.flee ?? true);
      let nbSum = 0, fl = 0;
      if (dt > 0) {
        for (const p of b) {
          let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, k = 0;
          for (const q of b) {
            if (q === p) continue; let dx = p.x - q.x, dy = p.y - q.y;
            if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W; if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
            const d2 = dx * dx + dy * dy; if (d2 > 2500) continue;
            k++; ax += q.vx; ay += q.vy; cx -= dx; cy -= dy; if (d2 < 484) { sx += dx / (d2 + 1) * 22; sy += dy / (d2 + 1) * 22; }
          }
          nbSum += k;
          let fx = 0, fy = 0;
          if (k) { fx += ws * sx * 60 + wa * (ax / k - p.vx) * 0.9 + wc * (cx / k) * 0.6; fy += ws * sy * 60 + wa * (ay / k - p.vy) * 0.9 + wc * (cy / k) * 0.6; }
          const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy) || 1;
          if (d < 110) { const s = (flee ? 1 : -0.5) * 900 * (1 - d / 110); fx += (dx / d) * s; fy += (dy / d) * s; if (flee) fl++; }
          p.vx += fx * dt; p.vy += fy * dt;
          const sp = Math.hypot(p.vx, p.vy) || 1, cl = clamp(sp, 40, 110); p.vx *= cl / sp; p.vy *= cl / sp;
        }
        for (const p of b) { p.x = (p.x + p.vx * dt + W) % W; p.y = (p.y + p.vy * dt + H) % H; }
      } else for (const p of b) { let k = 0; for (const q of b) if (q !== p && (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < 2500) k++; nbSum += k; }
      S.clear();
      const sz = 6 * num(C.size, 1), rgb = hexRgb(C.color || '#22d3ee'); let sx = 0, sy = 0, vm = 0;
      for (const p of b) {
        const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp; sx += ux; sy += uy; vm += sp;
        ctx.fillStyle = rgba(rgb, 0.65 + 0.35 * (sp / 110));
        ctx.beginPath(); ctx.moveTo(p.x + ux * sz * 1.6, p.y + uy * sz * 1.6); ctx.lineTo(p.x - ux * sz - uy * sz * 0.6, p.y - uy * sz + ux * sz * 0.6); ctx.lineTo(p.x - ux * sz + uy * sz * 0.6, p.y - uy * sz - ux * sz * 0.6); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = flee ? 'rgba(248,113,113,.7)' : rgba(rgb, 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.x, P.y, 110, 0, TAU); ctx.stroke();
      return { n, vm: (vm / n) * C.speed, pol: Math.hypot(sx, sy) / n, nb: nbSum / n, fl, ws, wa, wc, ix: String(fl) };
    };
  },
};

/* ───────────────────────── burst ───────────────────────── */
const BURST_SHAPES = ['', '圆形', '星形', '圆环', '爱心'];
FAM.burst = {
  spec: { color: { label: '粒子颜色', value: '#fbbf24' }, speed: SPD(), size: { label: '粒子大小', min: 0.5, max: 3, step: 0.1, value: 1.3 }, count: { label: '每次粒子数', min: 20, max: 300, step: 10, value: 120, buttons: true }, extras: [R('drag', '阻力 k', 0.5, 5, 0.1, 2), R('shape', '形状 1圆 2星 3环 4心', 1, 4, 1, 1), R('every', '自动间隔 s', 0.5, 3, 0.1, 1.4)], remountKeys: [] },
  presets: { 烟花: { shape: 1 }, 彩纸: { shape: 1, size: 2.4 }, 星爆: { shape: 2 }, 环波: { shape: 3 }, 像素碎: { size: 3, count: 60 }, 火花四射: { drag: 0.8 }, 爱心雨: { shape: 4 }, 字母喷: { shape: 2, count: 220 } },
  doc: {
    title: '粒子爆发 · 速度场决定形状',
    rows: (v) => [['活跃粒子', String(v.live ?? 0)], ['形状', String(v.shape ?? '')], ['初速 u', `${fmt(v.u ?? 0, 0)} px/s`], ['当前半径 r(t)', `${fmt(v.r ?? 0, 0)} px`, 'r'], ['最大半径 u/k', `${fmt(v.rmax ?? 0, 0)} px`], ['爆发次数', String(v.shots ?? 0)], ['每次粒子 / 间隔', `${v.per ?? 0} 个 / ${fmt(v.every ?? 0, 1)} s`]],
    formula: () => F('v(t) = u·e^(−kt)，r(t) = u·(1 − e^(−kt)) / k') + F('最大半径 r∞ = u / k') + F('形状：u(θ) = u·g(θ)，星形 g = 0.55 + 0.45|cos(2.5θ)|'),
    explain: '<p>所有粒子从同一点出发，<b>方向均匀分布</b>在 360°。爆开后的形状完全由“每个方向的初速度”决定：速度都一样就是圆环，按角度调制速度就变成星形或心形。</p><p>阻力让速度按指数衰减，所以图案先快速扩张、再慢慢定格，最远到 u/k。</p><p>点击画布在指针处爆发一次。</p>',
    params: [['粒子颜色', '粒子主色'], ['时间流速', '0 = 暂停'], ['粒子大小', '圆点半径'], ['每次粒子数', '一次爆发的粒子数'], ['阻力 k', '越大越快停下、图案越小'], ['形状 1圆 2星 3环 4心', '初速度随角度的分布'], ['自动间隔 s', '不点击时自动爆发的间隔']],
    example: (v) => `<ol><li>u = ${fmt(v.u ?? 0, 0)}，k = ${fmt(v.k ?? 0, 1)}</li><li>r∞ = u/k = ${fmt(v.rmax ?? 0, 0)} px</li><li>到达 95% 需要 3/k = ${fmt(3 / (v.k || 1), 2)} s；当前 r = ${fmt(v.r ?? 0, 0)} px</li></ol>`,
    tip: '点击任意位置爆发；切换形状对比速度分布。',
  },
  build(S) {
    const R0 = rng(13); const ps = []; let timer = 0.2, shots = 0, lastT0 = 0, lastU = 0;
    const fire = (x, y) => {
      const C = S.get(); const n = Math.round(num(C.count, 120)), k = num(C.drag, 2), sh = clamp(Math.round(num(C.shape, 1)), 1, 4);
      const u = Math.min(S.W, S.H) * 0.36 * k; lastU = u; lastT0 = S.t; shots++;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU; let g = 1, ax = Math.cos(th), ay = Math.sin(th);
        if (sh === 1) g = 0.35 + 0.65 * R0(); else if (sh === 2) g = 0.55 + 0.45 * Math.abs(Math.cos(2.5 * th)); else if (sh === 3) g = 0.97 + R0() * 0.03;
        else { const hx = 16 * Math.sin(th) ** 3, hy = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)); const m = Math.hypot(hx, hy) || 1; ax = hx / m; ay = hy / m; g = m / 17; }
        ps.push({ x, y, vx: ax * u * g, vy: ay * u * g, age: 0, life: 1.6 + R0() * 0.6, h: R0() * 40 - 20 });
      }
    };
    S.onDown((P) => fire(P.x, P.y));
    return ({ ctx, W, H, dt, t, C }) => {
      const k = num(C.drag, 2), sz = num(C.size, 1.3);
      timer -= dt; if (timer <= 0) { timer = num(C.every, 1.4); fire(W * (0.3 + R0() * 0.4), H * (0.35 + R0() * 0.3)); }
      const damp = Math.exp(-k * dt);
      for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.vx *= damp; p.vy = p.vy * damp + 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt; if (p.age > p.life) ps.splice(i, 1); }
      if (ps.length > 5000) ps.splice(0, ps.length - 5000);
      S.clear(); const base = hueOf(C.color || '#fbbf24');
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) { const a = 1 - p.age / p.life; ctx.fillStyle = hsla(base + p.h, 95, 55 + 20 * a, a); ctx.beginPath(); ctx.arc(p.x, p.y, sz * (0.6 + a), 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      const age = t - lastT0, rmax = lastU / k;
      return { live: ps.length, shape: BURST_SHAPES[clamp(Math.round(num(C.shape, 1)), 1, 4)], u: lastU, k, r: rmax * (1 - Math.exp(-k * age)), rmax, shots, per: Math.round(num(C.count, 120)), every: num(C.every, 1.4), ix: String(shots) };
    };
  },
};

/* ───────────────────────── flow ───────────────────────── */
FAM.flow = {
  spec: { color: { label: '流线颜色', value: '#a78bfa' }, speed: SPD('流速'), size: { label: '线宽', min: 0.5, max: 3, step: 0.1, value: 1 }, count: { label: '粒子数 N', min: 100, max: 3000, step: 100, value: 1200, buttons: true }, extras: [R('scale', '场缩放', 0.5, 4, 0.1, 1.5), R('curl', '指针涡旋 Γ', -3, 3, 0.1, 1.2), R('fade', '拖尾衰减', 0.01, 0.2, 0.01, 0.05)], remountKeys: [] },
  presets: { 旋涡: { curl: 2.5 }, 螺旋: { curl: -1.8, scale: 0.8 }, 网格风: { scale: 0.6 }, 噪声流: {}, 吸引子: { curl: 0.4 }, 双涡: { scale: 3 } },
  doc: {
    title: '向量场流线 · 噪声角度场',
    rows: (v) => [['粒子数 N', String(v.n ?? 0)], ['指针处场角 θ', `${fmt(v.ang ?? 0, 0)}°`, 'ang'], ['平均速度', `${fmt(v.vm ?? 0, 0)} px/s`], ['涡旋强度 Γ', fmt(v.curl ?? 0, 1)], ['场缩放', fmt(v.sc ?? 0, 1)], ['拖尾衰减 / 线宽', `${fmt(v.fade ?? 0, 2)} / ${fmt(v.lw ?? 0, 1)} px`]],
    formula: () => F('场角 θ(x,y,t) = 4π · noise(x/s, y/s, 0.1t)') + F('v = 60·(cos θ, sin θ) + Γ·r̂⊥ · 4000/(r + 40)') + F('位置 p ← p + v·Δt'),
    explain: '<p>给画布每一点指定一个方向（由平滑噪声算出），就得到一个<b>向量场</b>。成千上万个粒子顺着方向走，并在离屏画布上留下逐渐淡去的轨迹，流线就显现出来了。</p><p>指针处叠加一个<b>涡旋</b>：速度垂直于指向指针的方向，大小随距离衰减，Γ 为正是逆时针，为负是顺时针。</p><p>粒子跑出画布或寿命到了就随机重生。</p>',
    params: [['流线颜色', '流线主色'], ['流速', '时间流速'], ['线宽', '轨迹线宽'], ['粒子数 N', '粒子越多流线越密'], ['场缩放', '越大漩涡越大越平缓'], ['指针涡旋 Γ', '正逆时针、负顺时针、0 关闭'], ['拖尾衰减', '轨迹淡出速度']],
    example: (v) => `<ol><li>指针处场角 θ = ${fmt(v.ang ?? 0, 0)}°</li><li>该处基础速度 = 60·(cos θ, sin θ)</li><li>叠加涡旋 Γ = ${fmt(v.curl ?? 0, 1)}，越靠近指针越快</li></ol>`,
    tip: '在画布上移动指针搅动流场；把 Γ 调成负数改变旋向。',
  },
  build(S) {
    const N = makeNoise(41), R0 = rng(41); const ps = []; let L = null;
    return ({ ctx, W, H, dt, t, C, P }) => {
      if (!L || Math.abs(L.w - W * S.dpr) > 1 || Math.abs(L.h - H * S.dpr) > 1) { L = makeLayer(W, H, S.dpr); L.x.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); L.x.fillStyle = S.bg; L.x.fillRect(0, 0, W, H); }
      const n = clamp(Math.round(num(C.count, 1200)), 50, 5000), sc = num(C.scale, 1.5) * 140, curl = num(C.curl, 1.2), col = C.color || '#a78bfa';
      while (ps.length < n) ps.push({ x: R0() * W, y: R0() * H, life: R0() * 4 });
      if (ps.length > n) ps.length = n;
      const field = (x, y) => N.n3(x / sc, y / sc, t * 0.1) * 4 * Math.PI;
      let vm = 0;
      if (dt > 0) {
        L.x.fillStyle = rgba(S.bg, fadeA(num(C.fade, 0.05), dt)); L.x.fillRect(0, 0, W, H);
        L.x.strokeStyle = rgba(col, 0.55); L.x.lineWidth = num(C.size, 1); L.x.beginPath();
        for (const p of ps) {
          const a = field(p.x, p.y); let vx = Math.cos(a) * 60, vy = Math.sin(a) * 60;
          const dx = p.x - P.x, dy = p.y - P.y, r = Math.hypot(dx, dy) || 1; const s = (curl * 4000) / (r + 40) / r;
          vx += -dy * s; vy += dx * s; vm += Math.hypot(vx, vy);
          const nx = p.x + vx * dt, ny = p.y + vy * dt; L.x.moveTo(p.x, p.y); L.x.lineTo(nx, ny); p.x = nx; p.y = ny; p.life -= dt;
          if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life < 0) { p.x = R0() * W; p.y = R0() * H; p.life = 2 + R0() * 4; }
        }
        L.x.stroke();
      }
      ctx.drawImage(L.c, 0, 0, W, H);
      ctx.fillStyle = rgba(mix(col, 0.5), 0.9); { const hs = 1.2 * num(C.size, 1) + 0.4; for (let i = 0; i < ps.length; i += 3) ctx.fillRect(ps[i].x - hs / 2, ps[i].y - hs / 2, hs, hs); }
      const ang = ((field(P.x, P.y) * 180) / Math.PI) % 360;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + Math.cos((ang * Math.PI) / 180) * 24, P.y + Math.sin((ang * Math.PI) / 180) * 24); ctx.stroke();
      ctx.beginPath(); ctx.arc(P.x, P.y, 4, 0, TAU); ctx.stroke();
      return { n, ang: (ang + 360) % 360, vm: dt > 0 ? (vm / n) * C.speed : 0, curl, sc: num(C.scale, 1.5), fade: num(C.fade, 0.05), lw: num(C.size, 1), ix: fmt(ang, 0) };
    };
  },
};

/* ───────────────────────── gridwave ───────────────────────── */
FAM.gridwave = {
  spec: { color: { label: '点阵颜色', value: '#22d3ee' }, speed: SPD('波速'), size: { label: '振幅 A', min: 0, max: 2, step: 0.05, value: 1 }, count: { label: '网格间距 px', min: 10, max: 40, step: 1, value: 20, buttons: true }, extras: [R('k', '波数 k', 0.02, 0.12, 0.005, 0.05), R('decay', '衰减长度 L', 60, 600, 10, 260), T('lines', '连成线框', false)], remountKeys: [] },
  presets: { 疏网: { count: 32 }, 密网: { count: 12 }, 高波: { size: 1.8 }, 低波: { size: 0.4 }, 彩点: {}, 线框: { lines: true } },
  doc: {
    title: '网格起伏 · 衰减圆形波',
    rows: (v) => [['网格点数', String(v.pts ?? 0)], ['间距', `${v.gap ?? 0} px`], ['波长 λ = 2π/k', `${fmt(v.lam ?? 0, 0)} px`, 'lam'], ['波速 ω/k', `${fmt(v.v ?? 0, 0)} px/s`], ['衰减长度 L', `${fmt(v.L ?? 0, 0)} px`], ['中心振幅', `${fmt(v.z0 ?? 0, 1)} px`]],
    formula: () => F('z(d, t) = 14A · sin(k·d − ωt) · e^(−d / L)') + F('d = 网格点到指针的距离，ω = 3 rad/s') + F('屏幕 y′ = y − z，亮度 ∝ (z + 14A)'),
    explain: '<p>以指针为圆心发出一圈圈波纹，网格上每个点按自己到指针的距离 d 计算位移 z。</p><p>sin(k·d − ωt) 让波纹向外传播，<b>e^(−d/L)</b> 让离得越远的点起伏越小——就像石子落水，涟漪会越来越弱。</p><p>位移转成竖直偏移和亮度，平面的点阵就有了立体感。</p>',
    params: [['点阵颜色', '点/线颜色'], ['波速', '时间流速'], ['振幅 A', '起伏高度'], ['网格间距 px', '越小点越密'], ['波数 k', 'k 越大波纹越密'], ['衰减长度 L', '波纹能传多远'], ['连成线框', '把相邻点连成网']],
    example: (v) => `<ol><li>λ = 2π/${fmt(v.k ?? 0, 3)} = ${fmt(v.lam ?? 0, 0)} px</li><li>距离 L = ${fmt(v.L ?? 0, 0)}px 处振幅剩 e⁻¹ ≈ 37%</li><li>距离 2L 处只剩 e⁻² ≈ 14%</li></ol>`,
    tip: '移动指针改变波源位置；调衰减长度看波纹传播范围。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      const gap = clamp(Math.round(num(C.count, 20)), 6, 60), A = 14 * num(C.size, 1), k = num(C.k, 0.05), Ld = num(C.decay, 260), w = 3, lines = on(C.lines);
      S.clear(); const rgb = hexRgb(C.color || '#22d3ee');
      const nx = Math.floor(W / gap) + 1, ny = Math.floor(H / gap) + 1, ox = (W - (nx - 1) * gap) / 2, oy = (H - (ny - 1) * gap) / 2;
      const Z = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = ox + i * gap, y = oy + j * gap, d = dist(x, y, P.x, P.y); Z[j * nx + i] = A * Math.sin(k * d - w * t) * Math.exp(-d / Ld); }
      if (lines) {
        ctx.strokeStyle = rgba(rgb, 0.45); ctx.lineWidth = 1; ctx.beginPath();
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = ox + i * gap, y = oy + j * gap - Z[j * nx + i]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = ox + i * gap, y = oy + j * gap - Z[j * nx + i]; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const z = Z[j * nx + i], b = A ? (z + A) / (2 * A) : 0.5;
        ctx.fillStyle = rgba(mix(C.color || '#22d3ee', b * 0.6), 0.35 + 0.65 * b); ctx.beginPath(); ctx.arc(ox + i * gap, oy + j * gap - z, 1.2 + 1.8 * b, 0, TAU); ctx.fill();
      }
      return { pts: nx * ny, gap, k, lam: TAU / k, v: (w * C.speed) / k, L: Ld, z0: A * Math.abs(Math.sin(-w * t)), ix: `${nx * ny}` };
    };
  },
};

/* ───────────────────────── ink ───────────────────────── */
FAM.ink = {
  spec: { color: { label: '墨水颜色', value: '#60a5fa' }, speed: SPD(), size: { label: '墨滴大小', min: 0.4, max: 2.5, step: 0.05, value: 1 }, count: false, extras: [R('D', '扩散系数 D', 20, 400, 10, 120), R('every', '自动滴墨间隔 s', 0.4, 4, 0.1, 1.3)], remountKeys: [] },
  presets: { 淡墨: { size: 0.7, D: 220 }, 浓墨: { size: 1.7, D: 60 }, 彩墨: {}, 水彩: { D: 320 } },
  doc: {
    title: '墨水扩散 · 高斯扩散方程',
    rows: (v) => [['墨滴数', String(v.n ?? 0)], ['扩散系数 D', `${fmt(v.D ?? 0, 0)} px²/s`], ['最新墨滴年龄', `${fmt(v.age ?? 0, 2)} s`], ['扩散半径 σ = √(2Dt)', `${fmt(v.sig ?? 0, 0)} px`, 'sig'], ['峰值浓度（相对）', fmt(v.peak ?? 0, 3)], ['已滴 / 间隔', `${v.drops ?? 0} / ${fmt(v.every ?? 0, 1)} s`], ['墨量 M（大小）', fmt(v.M ?? 0, 2)]],
    formula: () => F('∂c/∂t = D·∇²c（扩散方程）') + F('点源解：c(r,t) = M/(4πDt) · e^(−r²/(4Dt))') + F('半径 σ = √(2Dt)，峰值 ∝ 1/t'),
    explain: '<p>一滴墨落进水里，分子做无规则运动，从浓的地方往淡的地方扩散。数学上这由<b>扩散方程</b>描述，它的解是一个不断变宽变矮的<b>高斯钟形</b>。</p><p>扩散半径随 √t 增长（越往后扩得越慢），中心浓度按 1/t 下降，但墨水总量 M 保持不变。</p><p>每滴墨还被轻微的水流带着漂移，形成自然的形状。点击画布滴一滴。</p>',
    params: [['墨水颜色', '墨的颜色（相邻墨滴略偏色相）'], ['时间流速', '0 = 暂停'], ['墨滴大小', '初始墨量 M'], ['扩散系数 D', '越大扩散越快'], ['自动滴墨间隔 s', '不点击时自动滴墨的间隔']],
    example: (v) => `<ol><li>D = ${fmt(v.D ?? 0, 0)}，t = ${fmt(v.age ?? 0, 2)} s</li><li>σ = √(2×${fmt(v.D ?? 0, 0)}×${fmt(v.age ?? 0, 2)}) = ${fmt(v.sig ?? 0, 0)} px</li><li>时间翻 4 倍，半径只翻 2 倍</li></ol>`,
    tip: '点击滴墨；把 D 调大对比扩散快慢。',
  },
  build(S) {
    const R0 = rng(61), N = makeNoise(61); const drops = []; let timer = 0, count = 0;
    const add = (x, y) => { drops.push({ x, y, t0: S.t, m: num(S.get().size, 1), h: (count % 4) * 18 - 27, s: R0() * 100 }); count++; if (drops.length > 24) drops.shift(); };
    S.onDown((P) => add(P.x, P.y));
    return ({ ctx, W, H, dt, t, C }) => {
      const D = num(C.D, 120); timer -= dt; if (timer <= 0) { timer = num(C.every, 1.3); add(W * (0.2 + R0() * 0.6), H * (0.2 + R0() * 0.6)); }
      S.clear(); const base = hueOf(C.color || '#60a5fa'); const [, sat] = [0, 80];
      let last = null;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; const age = Math.max(0.02, t - d.t0); const sig = Math.sqrt(2 * D * age) + 6 * d.m;
        const peak = (d.m * 900) / (sig * sig);
        if (peak < 0.004) { drops.splice(i, 1); continue; }
        if (!last) last = { age, sig, peak };
        d.x += (N.n3(d.x / 200, d.y / 200, t * 0.2) - 0.5) * 20 * dt; d.y += 6 * dt;
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * TAU + d.s, off = sig * 0.35 * N.n3(d.s + s, t * 0.3, 0);
          const x = d.x + Math.cos(a) * off, y = d.y + Math.sin(a) * off;
          const g = ctx.createRadialGradient(x, y, 0, x, y, sig * 1.2);
          g.addColorStop(0, hsla(base + d.h, sat, 60, clamp(peak, 0, 0.9) / 2)); g.addColorStop(1, hsla(base + d.h, sat, 50, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, sig * 1.2, 0, TAU); ctx.fill();
        }
      }
      last = last || { age: 0, sig: 0, peak: 0 };
      return { n: drops.length, D, age: last.age, sig: last.sig, peak: last.peak, drops: count, every: num(C.every, 1.3), M: num(C.size, 1), ix: String(count) };
    };
  },
};

/* ───────────────────────── aurora ───────────────────────── */
FAM.aurora = {
  spec: { color: { label: '极光颜色', value: '#34d399' }, speed: SPD('漂移速度'), size: { label: '光带高度', min: 0.4, max: 2, step: 0.05, value: 1 }, count: { label: '光带数', min: 1, max: 6, step: 1, value: 4, buttons: true }, extras: [R('amp', '摆动幅度', 0, 2, 0.05, 1), R('lean', '指针风力', 0, 2, 0.05, 0.8)], remountKeys: [] },
  presets: { 绿紫: { color: '#34d399' }, 蓝青: { color: '#22d3ee' }, 粉橙: { color: '#f472b6' }, 慢漂: { speed: 0.35 } },
  doc: {
    title: '极光 · 噪声帘幕',
    rows: (v) => [['光带数', String(v.n ?? 0)], ['主波长', `${fmt(v.lam ?? 0, 0)} px`], ['摆动幅度', `${fmt(v.amp ?? 0, 0)} px`], ['指针处亮度', fmt(v.bp ?? 0, 2), 'bp'], ['风偏', `${fmt(v.lean ?? 0, 0)} px`], ['漂移速度', `${fmt(v.vd ?? 0, 2)} rad/s`]],
    formula: () => F('帘幕顶边 y(x,t) = y₀ + A·[sin(kx + ωt + φ) + fbm(x/250, 0.2t)]') + F('亮度 b(x) = 0.4 + 0.6·fbm(x/120, 0.3t)') + F('每列竖直渐变：颜色 → 透明'),
    explain: '<p>真实极光是太阳风粒子撞击高层大气发光，形状像随风飘动的<b>帘幕</b>。这里每条光带的顶边由正弦波加噪声决定，再从顶边向下画一条由亮到透明的竖直渐变。</p><p>亮度也用噪声沿水平方向变化，出现一束束亮丝。多条光带用“加色混合”（lighter）叠加，交叠处更亮。</p><p>指针左右位置相当于风，会让帘幕向一侧偏斜。</p>',
    params: [['极光颜色', '主色，其它光带偏移色相'], ['漂移速度', '时间流速'], ['光带高度', '帘幕竖直长度'], ['光带数', '叠加的帘幕数'], ['摆动幅度', '顶边起伏大小'], ['指针风力', '指针造成的偏斜程度']],
    example: (v) => `<ol><li>主波长 λ = ${fmt(v.lam ?? 0, 0)} px</li><li>指针处亮度 b = ${fmt(v.bp ?? 0, 2)}</li><li>风偏 ${fmt(v.lean ?? 0, 0)} px（指针越偏离中心越大）</li></ol>`,
    tip: '左右移动指针吹动极光；切换预设换颜色。',
  },
  build(S) {
    const N = makeNoise(71); const sprites = new Map();
    const sprite = (hue, h) => {
      const key = `${hue | 0}:${h | 0}`; if (sprites.has(key)) return sprites.get(key);
      const c = document.createElement('canvas'); c.width = 2; c.height = Math.max(4, h | 0); const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, hsla(hue, 90, 75, 0.95)); g.addColorStop(0.25, hsla(hue, 85, 60, 0.5)); g.addColorStop(1, hsla(hue + 40, 80, 50, 0));
      x.fillStyle = g; x.fillRect(0, 0, 2, c.height); if (sprites.size > 60) sprites.clear(); sprites.set(key, c); return c;
    };
    return ({ ctx, W, H, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 4)), 1, 8), A = 30 * num(C.amp, 1), hh = H * 0.45 * num(C.size, 1), lean = (P.x / W - 0.5) * 120 * num(C.lean, 0.8);
      S.clear(); const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#050816'); sky.addColorStop(1, '#0b1530'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const base = hueOf(C.color || '#34d399'); const k = 0.008; let bp = 0;
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < n; b++) {
        const hue = base + b * 35, sp = sprite(hue, hh * (0.7 + 0.3 * ((b + 1) / n))), y0 = H * (0.12 + 0.08 * b);
        for (let x = 0; x <= W; x += 3) {
          const y = y0 + A * (Math.sin(k * x + t * 0.6 + b * 1.7) + (N.fbm(x / 250 + b * 3, t * 0.2, 0, 3) - 0.5) * 2);
          const br = 0.4 + 0.6 * N.fbm(x / 120 + b * 7, t * 0.3, 1, 3); if (b === 0 && Math.abs(x - P.x) < 1.5) bp = br;
          ctx.globalAlpha = br * 0.55; ctx.drawImage(sp, x + lean * 0.3, y, 3, sp.height);
          ctx.globalAlpha = br * 0.25; ctx.drawImage(sp, x + lean, y + sp.height * 0.15, 3, sp.height * 0.85);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#020617'; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 18 - 22 * N.n3(x / 90, 3.3, 0)); ctx.lineTo(W, H); ctx.fill();
      return { n, lam: TAU / k, amp: A, bp, lean, vd: 0.6 * C.speed, ix: fmt(lean, 0) };
    };
  },
};

/* ───────────────────────── constellation ───────────────────────── */
FAM.constellation = {
  spec: { color: { label: '星线颜色', value: '#a5b4fc' }, speed: SPD('漂移速度'), size: { label: '星星大小', min: 0.5, max: 3, step: 0.1, value: 1.4 }, count: { label: '星数 N', min: 20, max: 160, step: 5, value: 70, buttons: true }, extras: [R('knn', '近邻数 k', 1, 4, 1, 2), R('tw', '闪烁强度', 0, 1, 0.05, 0.6)], remountKeys: [] },
  presets: { 疏星: { count: 35 }, 密星: { count: 140 }, 亮线: { knn: 4 }, 暗线: { knn: 1 } },
  doc: {
    title: '星座连线 · k 近邻图',
    rows: (v) => [['星数 N', String(v.n ?? 0)], ['近邻数 k', String(v.k ?? 0)], ['边数（去重）', String(v.E ?? 0), 'E'], ['平均边长', `${fmt(v.Lm ?? 0, 0)} px`], ['最长边', `${fmt(v.Lx ?? 0, 0)} px`], ['指针连接星', String(v.pc ?? 0)]],
    formula: () => F('每颗星连向离它最近的 k 颗星（k-NN）') + F('边数 ≤ N·k，互为近邻的边只算一次') + F('亮度 b = 1 − τ + τ·(½ + ½ sin(ωᵢt + φᵢ))'),
    explain: '<p>和“距离小于阈值就连线”不同，这里每颗星只连向<b>离它最近的 k 颗</b>。这样无论星星疏密，每颗星都至少有 k 条线，图案更像星座。</p><p>如果 A 是 B 的近邻、B 也是 A 的近邻，这条边只画一次，所以边数通常小于 N·k。</p><p>星星各自以不同频率闪烁；指针附近 140px 内的星会和指针连线。</p>',
    params: [['星线颜色', '连线与星光颜色'], ['漂移速度', '时间流速'], ['星星大小', '星点半径'], ['星数 N', '星星数量'], ['近邻数 k', '每颗星连几条线'], ['闪烁强度', '0 = 不闪']],
    example: (v) => `<ol><li>N = ${v.n}，k = ${v.k}，上限 N·k = ${(v.n ?? 0) * (v.k ?? 0)}</li><li>去重后实际 ${v.E} 条边</li><li>平均边长 ${fmt(v.Lm ?? 0, 0)} px</li></ol>`,
    tip: '把指针移到星空里与附近星星连线；调 k 看图案变化。',
  },
  build(S) {
    const R0 = rng(81); const st = [];
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 70)), 5, 300), k = clamp(Math.round(num(C.knn, 2)), 1, 6), tw = num(C.tw, 0.6);
      while (st.length < n) { const a = R0() * TAU; st.push({ x: R0() * W, y: R0() * H, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, w: 1 + R0() * 3, ph: R0() * TAU }); }
      if (st.length > n) st.length = n;
      for (const s of st) { s.x += s.vx * dt; s.y += s.vy * dt; if (s.x < 0 || s.x > W) { s.vx *= -1; s.x = clamp(s.x, 0, W); } if (s.y < 0 || s.y > H) { s.vy *= -1; s.y = clamp(s.y, 0, H); } }
      S.clear(); const rgb = hexRgb(C.color || '#a5b4fc'); const edges = new Set(); let Ls = 0, Lx = 0;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = st[i]; const ds = [];
        for (let j = 0; j < n; j++) if (j !== i) ds.push([(a.x - st[j].x) ** 2 + (a.y - st[j].y) ** 2, j]);
        ds.sort((p, q) => p[0] - q[0]);
        for (let m = 0; m < Math.min(k, ds.length); m++) {
          const j = ds[m][1], key = i < j ? `${i}-${j}` : `${j}-${i}`; if (edges.has(key)) continue; edges.add(key);
          const L = Math.sqrt(ds[m][0]); Ls += L; Lx = Math.max(Lx, L);
          ctx.strokeStyle = rgba(rgb, clamp(1 - L / 260, 0.15, 0.8)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(st[j].x, st[j].y); ctx.stroke();
        }
      }
      let pc = 0;
      for (const s of st) { const d = dist(s.x, s.y, P.x, P.y); if (d < 140) { pc++; ctx.strokeStyle = rgba(mix(C.color || '#a5b4fc', 0.5), 1 - d / 140); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(P.x, P.y); ctx.stroke(); } }
      const sz = num(C.size, 1.4);
      for (const s of st) { const b = 1 - tw + tw * (0.5 + 0.5 * Math.sin(s.w * t + s.ph)); ctx.fillStyle = rgba(mix(C.color || '#a5b4fc', 0.7), b); ctx.beginPath(); ctx.arc(s.x, s.y, sz * (0.6 + 0.6 * b), 0, TAU); ctx.fill(); }
      return { n, k, E: edges.size, Lm: edges.size ? Ls / edges.size : 0, Lx, pc, ix: String(pc) };
    };
  },
};

/* ───────────────────────── sand ───────────────────────── */
FAM.sand = {
  spec: { color: { label: '沙子颜色', value: '#fbbf24' }, speed: SPD('模拟速度'), size: { label: '沙粒像素', min: 2, max: 8, step: 1, value: 4 }, count: false, extras: [R('rate', '倾倒速率 粒/s', 20, 600, 10, 220), T('drain', '底部漏斗', true)], remountKeys: [] },
  presets: { 细沙: { size: 2 }, 粗沙: { size: 6 }, 彩沙: { rate: 420 } },
  doc: {
    title: '落沙 · 元胞自动机',
    rows: (v) => [['沙粒数', String(v.g ?? 0), 'g'], ['网格', `${v.cols ?? 0} × ${v.rows ?? 0}`], ['倾倒速率', `${fmt(v.rate ?? 0, 0)} 粒/s`], ['漏出', `${fmt(v.out ?? 0, 0)} 粒/s`], ['最高堆高', `${v.top ?? 0} 格`], ['安息角（规则决定）', '≈ 45°'], ['底部漏斗', v.drain ? '开' : '关']],
    formula: () => F('规则①：下方为空 → 下落一格') + F('规则②：否则左下/右下为空 → 斜落（随机先试一边）') + F('否则静止；斜率最多 1 格/格 ⇒ 安息角 ≈ 45°'),
    explain: '<p>画面被切成网格，每格要么是沙要么是空。每一步从下往上扫描，每粒沙只看身边三格，按两条简单规则移动——这就是<b>元胞自动机</b>。</p><p>只靠局部规则，就自然出现了沙堆、滑坡和稳定的斜坡角度（<b>安息角</b>）。真实干沙的安息角约 30°~35°，这个规则给出 45°。</p><p>底部中央有个漏斗口，倒入与漏出平衡后会形成 V 形稳定沙面。</p>',
    params: [['沙子颜色', '沙粒基础色（每粒略有明暗）'], ['模拟速度', '每秒模拟步数倍率'], ['沙粒像素', '每格大小，越小沙越细（重建网格）'], ['倾倒速率 粒/s', '指针处每秒倒出的沙粒'], ['底部漏斗', '开：底部中央漏沙']],
    example: (v) => `<ol><li>每秒倒入 ${fmt(v.rate ?? 0, 0)} 粒，漏出 ${fmt(v.out ?? 0, 0)} 粒</li><li>当前共 ${v.g} 粒，占网格 ${fmt(((v.g ?? 0) / Math.max(1, (v.cols ?? 1) * (v.rows ?? 1))) * 100, 1)}%</li><li>沙面坡度不会超过 1 格/格（45°）</li></ol>`,
    tip: '按住拖动在指针处倒沙；关掉漏斗看沙子堆满。',
  },
  build(S) {
    const R0 = rng(91); let G = null, cols = 0, rows = 0, cs = 0, L = null, acc = 0, pourAcc = 0, outAcc = 0, outRate = 0, rt = 0, grains = 0;
    const setup = (W, H, s) => { cs = s; cols = Math.max(10, Math.floor(W / s)); rows = Math.max(10, Math.floor(H / s)); G = new Uint8Array(cols * rows); L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows); grains = 0; };
    return ({ ctx, W, H, dt, C, P }) => {
      const s = clamp(Math.round(num(C.size, 4)), 2, 10);
      if (!G || s !== cs || cols !== Math.max(10, Math.floor(W / s)) || rows !== Math.max(10, Math.floor(H / s))) setup(W, H, s);
      const drain = on(C.drain ?? true), rate = num(C.rate, 220);
      if (dt > 0) {
        pourAcc += rate * dt; const px = clamp(Math.floor(P.x / cs), 1, cols - 2), py = clamp(Math.floor(P.y / cs), 0, rows - 2);
        while (pourAcc >= 1) { pourAcc -= 1; const x = clamp(px + Math.round((R0() - 0.5) * 4), 0, cols - 1), i = py * cols + x; if (!G[i]) { G[i] = 1 + ((R0() * 200) | 0); grains++; } }
        acc += dt * 60; let steps = Math.min(4, Math.floor(acc)); acc -= steps;
        while (steps-- > 0) {
          if (drain) { const h0 = (cols >> 1) - 2; for (let x = h0; x < h0 + 4; x++) { const i = (rows - 1) * cols + x; if (G[i]) { G[i] = 0; grains--; outAcc++; } } }
          for (let y = rows - 2; y >= 0; y--) {
            const dir = (y & 1) ? 1 : -1;
            for (let xx = 0; xx < cols; xx++) {
              const x = dir > 0 ? xx : cols - 1 - xx; const i = y * cols + x; const g = G[i]; if (!g) continue;
              const b = i + cols;
              if (!G[b]) { G[b] = g; G[i] = 0; continue; }
              const first = R0() < 0.5 ? -1 : 1;
              for (const d of [first, -first]) { const nx = x + d; if (nx < 0 || nx >= cols) continue; const j = b + d; if (!G[j]) { G[j] = g; G[i] = 0; break; } }
            }
          }
        }
        rt += dt; if (rt > 0.5) { outRate = outAcc / rt; outAcc = 0; rt = 0; }
      }
      const rgb = hexRgb(C.color || '#fbbf24'); const d = L.img.data; let top = rows;
      for (let i = 0; i < G.length; i++) {
        const g = G[i], o = i * 4;
        if (g) { const sh = 0.7 + (g / 255) * 0.5; d[o] = Math.min(255, rgb[0] * sh); d[o + 1] = Math.min(255, rgb[1] * sh); d[o + 2] = Math.min(255, rgb[2] * sh); d[o + 3] = 255; const y = (i / cols) | 0; if (y < top) top = y; }
        else { d[o] = 6; d[o + 1] = 10; d[o + 2] = 20; d[o + 3] = 255; }
      }
      L.x.putImageData(L.img, 0, 0);
      S.clear(); ctx.imageSmoothingEnabled = false; ctx.drawImage(L.c, 0, 0, cols * cs, rows * cs); ctx.imageSmoothingEnabled = true;
      if (drain) { ctx.fillStyle = '#ef4444'; ctx.fillRect(((cols >> 1) - 2) * cs, rows * cs - 2, 4 * cs, 2); }
      ctx.strokeStyle = rgba(rgb, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.x, P.y, 8, 0, TAU); ctx.stroke();
      return { g: grains, cols, rows, rate, out: outRate, top: rows - top, drain, ix: String(grains) };
    };
  },
};

/* ───────────────────────── kaleido ───────────────────────── */
FAM.kaleido = {
  spec: { color: { label: '笔迹颜色', value: '#f472b6' }, speed: SPD(), size: { label: '线宽', min: 0.5, max: 5, step: 0.1, value: 2 }, count: { label: '扇区数 n', min: 3, max: 16, step: 1, value: 6, buttons: true }, extras: [T('mirror', '扇区内镜像', true), T('rainbow', '彩虹笔迹', false), R('trail', '笔迹时长 s', 1, 6, 0.1, 3)], remountKeys: [] },
  presets: { '6 瓣': { count: 6 }, '8 瓣': { count: 8 }, '12 瓣': { count: 12 }, 彩镜: { rainbow: true } },
  doc: {
    title: '万花筒 · 旋转与镜像对称',
    rows: (v) => [['扇区数 n', String(v.n ?? 0)], ['扇角 360°/n', `${fmt(v.ang ?? 0, 1)}°`], ['对称阶', `${v.ord ?? 0}（${v.mir ? '旋转+镜像 Dₙ' : '仅旋转 Cₙ'}）`], ['笔迹点数', String(v.pts ?? 0)], ['指针极坐标 r', `${fmt(v.r ?? 0, 0)} px`, 'r'], ['指针极坐标 θ', `${fmt(v.th ?? 0, 0)}°`]],
    formula: () => F('旋转复制：θₖ = θ + k·2π/n，k = 0…n−1') + F('镜像：θ → −θ（再旋转）') + F('点 (r, θ) → (r·cos θₖ, r·sin θₖ)'),
    explain: '<p>万花筒里的镜子把一小块画面复制成一圈。这里把指针走过的路径转成以中心为原点的<b>极坐标</b> (r, θ)，然后每隔 360°/n 复制一份。</p><p>打开镜像后每份再左右翻转一次，对称阶从 n 变成 2n，数学上叫二面体群 Dₙ；只旋转叫循环群 Cₙ。</p><p>笔迹随时间淡出，不停移动指针就能画出一直变化的花纹。</p>',
    params: [['笔迹颜色', '线条颜色'], ['时间流速', '笔迹淡出与自动笔速度'], ['线宽', '线条粗细'], ['扇区数 n', '复制成几份'], ['扇区内镜像', '是否左右翻转'], ['彩虹笔迹', '沿时间改变色相'], ['笔迹时长 s', '笔迹保留多久']],
    example: (v) => `<ol><li>n = ${v.n}：每份 ${fmt(v.ang ?? 0, 1)}°</li><li>指针在 r = ${fmt(v.r ?? 0, 0)}px、θ = ${fmt(v.th ?? 0, 0)}°</li><li>会被复制到 ${v.ord} 个位置</li></ol>`,
    tip: '在画布上画线，图案会自动对称复制。',
  },
  build(S) {
    const pts = [];
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 6)), 2, 24), mir = on(C.mirror ?? true), rb = on(C.rainbow), life = num(C.trail, 3);
      const cx = W / 2, cy = H / 2;
      if (dt > 0) { const l = pts[pts.length - 1]; const x = P.x - cx, y = P.y - cy; if (!l || Math.hypot(l.x - x, l.y - y) > 1) pts.push({ x, y, t }); }
      while (pts.length && t - pts[0].t > life) pts.shift();
      S.clear(); ctx.lineWidth = num(C.size, 2); ctx.lineCap = 'round'; const base = hueOf(C.color || '#f472b6'); const rgb = hexRgb(C.color || '#f472b6');
      ctx.save(); ctx.translate(cx, cy);
      for (let k = 0; k < n; k++) for (let m = 0; m < (mir ? 2 : 1); m++) {
        ctx.save(); ctx.rotate((k * TAU) / n); if (m) ctx.scale(1, -1);
        for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const al = 1 - (t - b.t) / life; ctx.strokeStyle = rb ? hsla(base + b.t * 60, 90, 62, al) : rgba(rgb, al); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < n; k++) { const a = (k * TAU) / n; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W); } ctx.stroke();
      const r = dist(P.x, P.y, cx, cy), th = ((Math.atan2(P.y - cy, P.x - cx) * 180) / Math.PI + 360) % 360;
      return { n, ang: 360 / n, ord: mir ? 2 * n : n, mir, pts: pts.length, r, th, ix: fmt(th, 0) };
    };
  },
};

/* ───────────────────────── lightning ───────────────────────── */
FAM.lightning = {
  spec: { color: { label: '电光颜色', value: '#a5b4fc' }, speed: SPD(), size: { label: '主干粗细', min: 0.5, max: 4, step: 0.1, value: 1.8 }, count: { label: '细分层数 n', min: 3, max: 8, step: 1, value: 6, buttons: true }, extras: [R('rough', '粗糙度 r', 0.2, 1, 0.05, 0.55), R('branch', '分叉概率', 0, 0.6, 0.05, 0.25), R('every', '闪击间隔 s', 0.1, 2, 0.05, 0.6)], remountKeys: [] },
  presets: { 单道: { branch: 0 }, 分叉: { branch: 0.45 }, 暴闪: { every: 0.15 } },
  doc: {
    title: '闪电 · 中点位移分形',
    rows: (v) => [['细分层数 n', String(v.n ?? 0)], ['线段数 2ⁿ', String(v.seg ?? 0)], ['首层偏移 r·L/2', `${fmt(v.d0 ?? 0, 0)} px`], ['分叉数', String(v.br ?? 0)], ['主干长度 L', `${fmt(v.L ?? 0, 0)} px`, 'L'], ['闪击次数', String(v.hits ?? 0)], ['分叉概率 / 间隔', `${fmt(v.pb ?? 0, 2)} / ${fmt(v.every ?? 0, 2)} s`]],
    formula: () => F('取线段中点 M，沿垂直方向偏移 δ ~ U(−d, d)') + F('每细分一层 d ← d·r（r = 粗糙度）') + F('n 层后共 2ⁿ 段；分叉：以概率 p 从中点再长出一支'),
    explain: '<p>闪电从云层（顶部）劈向指针。算法很简单：连一条直线，把中点往旁边随机推一点，变成两段；再对每一段重复……这叫<b>中点位移法</b>。</p><p>每层偏移按粗糙度 r 缩小，所以大轮廓弯曲、细节抖动，形成<b>分形</b>。分叉在中点以一定概率长出一条更细的支路。</p><p>每次闪击生成新形状，然后按指数快速衰减。</p>',
    params: [['电光颜色', '电弧颜色（核心为白色）'], ['时间流速', '衰减与闪击节奏'], ['主干粗细', '主干线宽'], ['细分层数 n', '层数越多越细碎'], ['粗糙度 r', '越大越曲折'], ['分叉概率', '0 = 无分叉'], ['闪击间隔 s', '两次闪击的间隔']],
    example: (v) => `<ol><li>L = ${fmt(v.L ?? 0, 0)} px，首层偏移 ≤ ${fmt(v.d0 ?? 0, 0)} px</li><li>第 2 层 ≤ ${fmt((v.d0 ?? 0) * (v.r ?? 0), 0)} px，第 3 层 ≤ ${fmt((v.d0 ?? 0) * (v.r ?? 0) ** 2, 0)} px</li><li>${v.n} 层共 ${v.seg} 段</li></ol>`,
    tip: '移动指针决定落点；点击立即闪击一次。',
  },
  build(S) {
    let seed = 1, age = 9, timer = 0, hits = 0;
    S.onDown(() => { seed = (seed * 7919 + 17) % 100003; age = 0; hits++; });
    const bolt = (R0, x1, y1, x2, y2, d, n, r, pb, out, depth) => {
      let pts = [[x1, y1], [x2, y2]];
      for (let l = 0; l < n; l++) {
        const np = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const mx = (ax + bx) / 2, my = (ay + by) / 2; const L = Math.hypot(bx - ax, by - ay) || 1;
          const o = (R0() * 2 - 1) * d; const px = mx - ((by - ay) / L) * o, py = my + ((bx - ax) / L) * o; np.push([px, py], pts[i]);
          if (depth < 2 && l >= 1 && l <= 3 && out.branches.length < 24 && R0() < pb) { const a = Math.atan2(by - ay, bx - ax) + (R0() - 0.5) * 1.6; const bl = L * (0.6 + R0() * 0.5); out.branches.push({ depth: depth + 1, x1: px, y1: py, x2: px + Math.cos(a) * bl, y2: py + Math.sin(a) * bl, d: d * 0.6 }); }
        }
        pts = np; d *= r;
      }
      return pts;
    };
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 6)), 2, 9), r = num(C.rough, 0.55), pb = num(C.branch, 0.25);
      timer -= dt; age += dt; if (timer <= 0) { timer = num(C.every, 0.6); seed = (seed * 7919 + 17) % 100003; age = 0; hits++; }
      const x1 = W * 0.5 + (P.x - W / 2) * 0.3, y1 = 0, L = Math.hypot(P.x - x1, P.y - y1), d0 = (r * L) / 2;
      const R0 = rng(seed); const out = { branches: [] };
      const main = bolt(R0, x1, y1, P.x, P.y, d0, n, r, pb, out, 0);
      const paths = [{ p: main, w: 1 }];
      for (let i = 0; i < out.branches.length && i < 24; i++) { const b = out.branches[i]; paths.push({ p: bolt(R0, b.x1, b.y1, b.x2, b.y2, b.d, Math.max(2, n - 1), r, pb * 0.5, out, b.depth), w: 0.5 / b.depth }); }
      S.clear(); const a = 0.25 + 0.75 * Math.exp(-age * 5); const rgb = hexRgb(C.color || '#a5b4fc'); const w0 = num(C.size, 1.8);
      ctx.fillStyle = rgba(rgb, 0.05 * a); ctx.fillRect(0, 0, W, H * 0.15);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const pass of [[6, 0.18], [2.4, 0.6], [1, 1]]) {
        for (const { p, w } of paths) {
          ctx.strokeStyle = pass[1] === 1 ? `rgba(255,255,255,${a * w})` : rgba(rgb, a * pass[1] * w); ctx.lineWidth = w0 * pass[0] * w;
          ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(rgb, 0.8); ctx.beginPath(); ctx.arc(P.x, P.y, 4, 0, TAU); ctx.fill();
      return { n, seg: 2 ** n, d0, br: paths.length - 1, L, r, hits, pb, every: num(C.every, 0.6), ix: String(hits) };
    };
  },
};

/* ───────────────────────── cloth ───────────────────────── */
FAM.cloth = {
  spec: { color: { label: '布料颜色', value: '#60a5fa' }, speed: SPD(), size: { label: '布料尺寸', min: 0.5, max: 1, step: 0.05, value: 0.8 }, count: { label: '网格密度', min: 8, max: 28, step: 1, value: 16, buttons: true }, extras: [R('iter', '约束迭代（刚度）', 1, 12, 1, 5), R('g', '重力 g', 0, 1500, 50, 700), R('wind', '风力', 0, 2, 0.05, 0.6)], remountKeys: [] },
  presets: { 软布: { iter: 2 }, 硬布: { iter: 12 }, 彩布: { wind: 1.6 } },
  doc: {
    title: '布料 · Verlet 积分 + 距离约束',
    rows: (v) => [['质点数', String(v.np ?? 0)], ['约束数', String(v.nc ?? 0)], ['约束迭代', String(v.it ?? 0)], ['平均拉伸', `${fmt(v.st ?? 0, 1)} %`, 'st'], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`], ['抓取', v.grab ? '是' : '否'], ['风力', fmt(v.wind ?? 0, 2)]],
    formula: () => F('Verlet：xₙ₊₁ = xₙ + (xₙ − xₙ₋₁)·0.99 + a·Δt²') + F('约束：|pᵢ − pⱼ| → L₀，各移动一半误差') + F('拉伸 = (|pᵢ − pⱼ| − L₀) / L₀'),
    explain: '<p>布被看成一张由质点和“绳子”组成的网。每个质点用 <b>Verlet 积分</b>更新：速度隐含在“这一帧和上一帧的位置差”里，非常稳定。</p><p>每一步之后反复修正每根绳子，让它恢复原长 L₀（<b>距离约束</b>）。修正次数越多，布越硬、越不容易被拉长。</p><p>顶部一排被钉住；按住拖动可以抓起最近的点，指针移动时也会推开附近的布。</p>',
    params: [['布料颜色', '布面颜色（按拉伸明暗）'], ['时间流速', '0 = 暂停'], ['布料尺寸', '占画面宽度比例'], ['网格密度', '每边质点数（重建布料）'], ['约束迭代（刚度）', '迭代越多越硬'], ['重力 g', '向下加速度'], ['风力', '水平随机风']],
    example: (v) => `<ol><li>${v.np} 个质点、${v.nc} 根约束</li><li>每步迭代 ${v.it} 次，平均拉伸 ${fmt(v.st ?? 0, 1)}%</li><li>迭代改成 1 会看到布明显被拉长</li></ol>`,
    tip: '按住拖动抓起布料，松开后看它摆动回落。',
  },
  build(S) {
    const N = makeNoise(5); let pts = [], cons = [], key = '', grab = -1, acc = 0, nx = 0, ny = 0;
    const setup = (W, H, n, sz) => {
      nx = n; ny = Math.max(6, Math.round(n * 0.8)); const w = W * sz, gap = Math.min(w / (nx - 1), (H * 0.8) / (ny - 1)); const ox = (W - gap * (nx - 1)) / 2, oy = H * 0.08;
      pts = []; cons = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = ox + i * gap, y = oy + j * gap; pts.push({ x, y, px: x, py: y, pin: j === 0 && (i % 3 === 0 || i === nx - 1) }); }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * nx + i; if (i < nx - 1) cons.push([a, a + 1, gap]); if (j < ny - 1) cons.push([a, a + nx, gap]); }
    };
    S.onDown((P) => { let b = -1, bd = 60; pts.forEach((p, i) => { const d = dist(p.x, p.y, P.x, P.y); if (d < bd) { bd = d; b = i; } }); grab = b; });
    S.onUp(() => { grab = -1; });
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 16)), 4, 40), sz = num(C.size, 0.8), k = `${n}|${sz}|${W}|${H}`;
      if (k !== key) { key = k; setup(W, H, n, sz); }
      const it = clamp(Math.round(num(C.iter, 5)), 1, 20), g = num(C.g, 700), wind = num(C.wind, 0.6);
      acc += dt; let steps = 0; const h = 1 / 60;
      while (acc >= h && steps < 3) {
        acc -= h; steps++;
        for (const p of pts) {
          if (p.pin) continue;
          const wx = wind * 260 * (N.n3(p.y / 120, t * 0.5, 0) - 0.4);
          const vx = (p.x - p.px) * 0.99, vy = (p.y - p.py) * 0.99; p.px = p.x; p.py = p.y; p.x += vx + wx * h * h; p.y += vy + g * h * h;
          if (!P.down) { const d = dist(p.x, p.y, P.x, P.y); if (d < 40 && d > 0) { p.x += ((p.x - P.x) / d) * (40 - d) * 0.15; p.y += ((p.y - P.y) / d) * (40 - d) * 0.15; } }
        }
        if (grab >= 0 && pts[grab]) { pts[grab].x = P.x; pts[grab].y = P.y; }
        for (let r = 0; r < it; r++) for (const [a, b, L0] of cons) {
          const A = pts[a], B = pts[b]; const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, e = (d - L0) / d / 2;
          if (!A.pin && a !== grab) { A.x += dx * e; A.y += dy * e; } if (!B.pin && b !== grab) { B.x -= dx * e; B.y -= dy * e; }
        }
      }
      if (acc > h) acc = 0;
      S.clear(); const rgb = hexRgb(C.color || '#60a5fa'); let st = 0;
      for (const [a, b, L0] of cons) st += (dist(pts[a].x, pts[a].y, pts[b].x, pts[b].y) - L0) / L0;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = pts[j * nx + i], b = pts[j * nx + i + 1], c = pts[(j + 1) * nx + i + 1], d = pts[(j + 1) * nx + i];
        const area = ((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x)); const sh = clamp(0.55 + 0.45 * Math.sign(area) * Math.min(1, Math.abs(area) / 400), 0.2, 1) * (0.85 + 0.15 * ((i + j) & 1));
        ctx.fillStyle = `rgb(${(rgb[0] * sh) | 0},${(rgb[1] * sh) | 0},${(rgb[2] * sh) | 0})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#e2e8f0'; for (const p of pts) if (p.pin) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill(); }
      const hp = pts[(ny - 1) * nx + (nx >> 1)];
      return { np: pts.length, nc: cons.length, it, st: (st / cons.length) * 100, g, wind, grab: grab >= 0, hx: grab >= 0 ? P.x : hp.x, hy: grab >= 0 ? P.y : hp.y, ix: grab >= 0 ? `g${grab}` : '' };
    };
  },
};

/* ───────────────────────── spiral ───────────────────────── */
const SPIRAL_T = ['', '阿基米德 r = bθ', '对数 r = a·e^(bθ)', '费马 r = b√θ'];
FAM.spiral = {
  spec: { color: { label: '螺线颜色', value: '#fbbf24' }, speed: SPD('旋转速度'), size: { label: '螺距 b', min: 0.3, max: 2, step: 0.05, value: 1 }, count: { label: '臂数', min: 1, max: 8, step: 1, value: 3, buttons: true }, extras: [R('type', '类型 1阿基米德 2对数 3费马', 1, 3, 1, 1), T('rainbow', '彩虹渐变', false), R('turns', '圈数', 1, 8, 0.5, 4)], remountKeys: [] },
  presets: { 阿基米德: { type: 1 }, 对数: { type: 2 }, 双螺旋: { count: 2 }, 彩旋: { rainbow: true } },
  doc: {
    title: '螺线 · 极坐标方程',
    rows: (v) => [['类型', String(v.type ?? '')], ['臂数', String(v.arms ?? 0)], ['参数 b', fmt(v.b ?? 0, 3)], ['圈数', fmt(v.turns ?? 0, 1)], ['指针角 θ', `${fmt(v.th ?? 0, 0)}°`, 'th'], ['该角处半径 r(θ)', `${fmt(v.rp ?? 0, 0)} px`]],
    formula: () => F('阿基米德：r = b·θ（圈距恒定 2πb）') + F('对数：r = a·e^(bθ)（每圈放大 e^(2πb) 倍，鹦鹉螺）') + F('费马：r = b·√θ（等面积，向日葵籽）'),
    explain: '<p>螺线在<b>极坐标</b>里最好描述：角度 θ 一直增大，半径 r 随 θ 按某个规律变化。</p><p>阿基米德螺线每圈间距相同，像唱片纹路；对数螺线每圈按固定比例放大，自然界的鹦鹉螺、台风、星系旋臂都接近它；费马螺线越往外越密，是向日葵种子排列的基础。</p><p>多条臂就是把整条曲线旋转 360°/臂数 再画一次。指针角度处标出该角对应的半径。</p>',
    params: [['螺线颜色', '线条颜色'], ['旋转速度', '整体旋转快慢'], ['螺距 b', '螺线张开程度'], ['臂数', '旋臂条数'], ['类型 1阿基米德 2对数 3费马', '三种方程'], ['彩虹渐变', '沿曲线改变色相'], ['圈数', '画多少圈']],
    example: (v) => `<ol><li>${v.type}</li><li>指针方向 θ = ${fmt(v.th ?? 0, 0)}° → r = ${fmt(v.rp ?? 0, 0)} px</li><li>${v.arms} 条臂各相差 ${fmt(360 / (v.arms || 1), 0)}°</li></ol>`,
    tip: '移动指针读取对应角度的半径；切换三种类型对比。',
  },
  build(S) {
    return ({ ctx, W, H, t, C, P }) => {
      const arms = clamp(Math.round(num(C.count, 3)), 1, 12), b0 = num(C.size, 1), ty = clamp(Math.round(num(C.type, 1)), 1, 3), turns = num(C.turns, 4), rb = on(C.rainbow);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46, thMax = turns * TAU, rot = t * 0.6;
      let rf;
      if (ty === 1) { const b = (R / thMax) * b0; rf = (th) => b * th; }
      else if (ty === 2) { const bb = (0.12 * b0) / Math.max(0.5, turns / 4); const a = R / Math.exp(bb * thMax); rf = (th) => a * Math.exp(bb * th); }
      else { const b = (R / Math.sqrt(thMax)) * b0; rf = (th) => b * Math.sqrt(th); }
      S.clear(); const base = hueOf(C.color || '#fbbf24'); const rgb = hexRgb(C.color || '#fbbf24'); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const seg = 360;
      for (let k = 0; k < arms; k++) {
        const off = (k * TAU) / arms + rot; let px = cx, py = cy;
        for (let i = 1; i <= seg; i++) {
          const th = (i / seg) * thMax, r = Math.min(R * 1.6, rf(th)); const x = cx + Math.cos(th + off) * r, y = cy + Math.sin(th + off) * r;
          ctx.strokeStyle = rb ? hsla(base + (i / seg) * 300, 90, 60, 0.35 + 0.65 * (i / seg)) : rgba(rgb, 0.35 + 0.65 * (i / seg));
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); px = x; py = y;
        }
      }
      let th = Math.atan2(P.y - cy, P.x - cx) - rot; th = ((th % TAU) + TAU) % TAU;
      const rp = Math.min(R * 1.6, rf(th + TAU * Math.floor(turns / 2)));
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th + rot) * rp, cy + Math.sin(th + rot) * rp); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + Math.cos(th + rot) * rp, cy + Math.sin(th + rot) * rp, 4, 0, TAU); ctx.fill();
      return { type: SPIRAL_T[ty], arms, b: ty === 2 ? (0.12 * b0) / Math.max(0.5, turns / 4) : b0, turns, th: (th * 180) / Math.PI, rp, ix: fmt((th * 180) / Math.PI, 0) };
    };
  },
};

/* ───────────────────────── tunnel ───────────────────────── */
const TUN_S = ['', '圆形', '方形', '六边形'];
FAM.tunnel = {
  spec: { color: { label: '隧道颜色', value: '#22d3ee' }, speed: SPD('前进速度'), size: { label: '管半径 R', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '环数', min: 10, max: 60, step: 2, value: 30, buttons: true }, extras: [R('shape', '截面 1圆 2方 3六边', 1, 3, 1, 1), R('steer', '指针转向', 0, 1.5, 0.05, 0.6), T('rainbow', '彩虹环', false)], remountKeys: [] },
  presets: { 圆环: { shape: 1 }, 方管: { shape: 2 }, 彩隧: { rainbow: true } },
  doc: {
    title: '隧道 · 透视投影 r = f·R/z',
    rows: (v) => [['环数', String(v.n ?? 0)], ['截面', String(v.shape ?? '')], ['前进速度', `${fmt(v.v ?? 0, 1)} 单位/s`], ['焦距 f', `${fmt(v.f ?? 0, 0)} px`], ['最近环深度 z', fmt(v.z ?? 0, 2)], ['最近环屏幕半径', `${fmt(v.rs ?? 0, 0)} px`, 'rs']],
    formula: () => F('透视：屏幕半径 r = f · R / z') + F('前进：z ← z − v·Δt，z < z_min 时移到最远处') + F('转向：环心偏移 Δ = s·(指针 − 中心)·(1 − z_min/z)'),
    explain: '<p>隧道由一串相同大小的环组成，只是离我们的距离 z 不同。根据<b>透视投影</b>，远处的东西看起来更小：屏幕半径 = 焦距 × 真实半径 / 距离。</p><p>让所有环的 z 不断减小，就有了向前飞行的感觉；穿过镜头的环被移到最远处循环使用。</p><p>远处的环心按指针方向偏移更多，形成隧道转弯的效果，并用亮度模拟雾气。</p>',
    params: [['隧道颜色', '环的颜色'], ['前进速度', '0 = 停下'], ['管半径 R', '隧道粗细'], ['环数', '环越多越密'], ['截面 1圆 2方 3六边', '环的形状'], ['指针转向', '转弯程度'], ['彩虹环', '每个环不同色相']],
    example: (v) => `<ol><li>f = ${fmt(v.f ?? 0, 0)} px，R = ${fmt(v.R ?? 0, 2)}</li><li>最近环 z = ${fmt(v.z ?? 0, 2)} → r = f·R/z = ${fmt(v.rs ?? 0, 0)} px</li><li>z 翻倍，屏幕半径减半</li></ol>`,
    tip: '移动指针让隧道转弯；切换截面形状。',
  },
  build(S) {
    let travel = 0;
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 30)), 4, 100), R = num(C.size, 1), sh = clamp(Math.round(num(C.shape, 1)), 1, 3), steer = num(C.steer, 0.6), rb = on(C.rainbow);
      travel += dt * 2; const f = Math.min(W, H) * 0.42, zmin = 0.35, zmax = 8, gap = (zmax - zmin) / n;
      S.clear(); const base = hueOf(C.color || '#22d3ee'); const rgb = hexRgb(C.color || '#22d3ee'); const cx = W / 2, cy = H / 2; const ox = (P.x - cx) * steer, oy = (P.y - cy) * steer;
      const sides = sh === 1 ? 40 : sh === 2 ? 4 : 6; const rings = [];
      for (let i = 0; i < n; i++) { const z = zmin + ((((i * gap - travel) % (zmax - zmin)) + (zmax - zmin)) % (zmax - zmin)); rings.push({ z, id: Math.floor((i * gap - travel) / (zmax - zmin)) * n + i }); }
      rings.sort((a, b) => b.z - a.z); let near = rings[rings.length - 1];
      const verts = (ring) => { const r = (f * R) / ring.z, k = 1 - zmin / ring.z, x0 = cx + ox * k, y0 = cy + oy * k, rot = sh === 1 ? 0 : t * 0.2 + ring.z * 0.05; const v = []; for (let s = 0; s < sides; s++) { const a = (s / sides) * TAU + rot + (sh === 2 ? Math.PI / 4 : 0); v.push([x0 + Math.cos(a) * r, y0 + Math.sin(a) * r]); } return { v, r }; };
      let prev = null;
      for (const ring of rings) {
        const { v, r } = verts(ring); const fog = clamp(1 - ring.z / zmax, 0, 1) ** 1.3 * clamp((ring.z - zmin) * 4, 0, 1);
        const col = rb ? hsla(base + ring.id * 25, 90, 60, fog) : rgba(rgb, fog);
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, 2.4 * (1 / ring.z)); ctx.beginPath(); v.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
        if (prev && sides <= 6) { ctx.strokeStyle = rgba(rgb, fog * 0.4); ctx.lineWidth = 1; ctx.beginPath(); for (let s = 0; s < sides; s++) { ctx.moveTo(prev[s][0], prev[s][1]); ctx.lineTo(v[s][0], v[s][1]); } ctx.stroke(); }
        prev = v; if (ring === near) near.r = r;
      }
      return { n, shape: TUN_S[sh], v: 2 * C.speed, f, R, z: near.z, rs: near.r, ix: `${Math.round(ox)},${Math.round(oy)}` };
    };
  },
};

/* ───────────────────────── fire ───────────────────────── */
FAM.fire = {
  spec: { color: { label: '火焰色调', value: '#f97316' }, speed: SPD('燃烧速度'), size: { label: '火源宽度', min: 0.15, max: 1, step: 0.05, value: 0.6 }, count: false, extras: [R('cool', '冷却率', 0.4, 3, 0.05, 1.2), R('wind', '风', -2, 2, 0.1, 0), R('spot', '指针热点', 0, 1, 0.05, 0.8)], remountKeys: [] },
  presets: { 篝火: {}, 猛烈: { cool: 0.6, size: 0.9 }, 冷焰: { color: '#60a5fa' }, 细苗: { size: 0.2 }, 宽焰: { size: 1 }, 风吹: { wind: 1.5 } },
  doc: {
    title: '火焰 · 热量元胞自动机',
    rows: (v) => [['网格', `${v.cols ?? 0} × ${v.rows ?? 0}`], ['火源宽度', `${fmt((v.src ?? 0) * 100, 0)} %`], ['冷却率', fmt(v.cool ?? 0, 2)], ['平均火高', `${fmt(v.hgt ?? 0, 0)} px`, 'hgt'], ['风', fmt(v.wind ?? 0, 1)], ['指针处热量', fmt(v.hp ?? 0, 2)], ['热点强度', fmt(v.spot ?? 0, 2)]],
    formula: () => F('热量向上传：T(x + w, y − 1) = T(x, y) − c·U(0, 1)') + F('w = 随机 + 风偏，c = 冷却率') + F('颜色 = 调色板(T)：黑 → 主色 → 黄 → 白'),
    explain: '<p>这是经典的“DOOM 火焰”算法：底部一排格子一直保持最高温度，每一步每个格子把自己的热量传给<b>上方</b>的格子，同时随机损失一点。</p><p>热量越往上越少，于是形成了参差不齐的火舌；横向的随机偏移和风让火苗摇摆。冷却率越大，火焰越矮。</p><p>温度映射到调色板：低温暗红、高温黄白。指针位置也是一个热点。</p>',
    params: [['火焰色调', '中温段颜色'], ['燃烧速度', '每秒模拟步数倍率'], ['火源宽度', '底部热源占宽度比例'], ['冷却率', '越大火越矮'], ['风', '负向左、正向右'], ['指针热点', '指针处额外加热强度']],
    example: (v) => `<ol><li>每上升一格平均损失 c/2 = ${fmt((v.cool ?? 0) * 0.03, 3)} 热量</li><li>热量 1 大约能升 ${fmt(1 / Math.max(0.001, (v.cool ?? 1) * 0.03), 0)} 格</li><li>当前平均火高 ${fmt(v.hgt ?? 0, 0)} px</li></ol>`,
    tip: '移动指针点燃新的火苗；调风让火焰倾斜。',
  },
  build(S) {
    const R0 = rng(101); let G = null, cols = 0, rows = 0, L = null, acc = 0, pal = null, palKey = '';
    return ({ ctx, W, H, dt, C, P }) => {
      const c = Math.min(200, Math.max(60, Math.round(W / 4))), r = Math.max(40, Math.round((c * H) / W));
      if (!G || c !== cols || r !== rows) { cols = c; rows = r; G = new Float32Array(cols * rows); L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows); }
      const col = C.color || '#f97316'; if (palKey !== col) { palKey = col; const b = hexRgb(col); pal = []; for (let i = 0; i < 256; i++) { const v = i / 255; let rgb; if (v < 0.35) { const k = v / 0.35; rgb = [b[0] * k * 0.6, b[1] * k * 0.3, b[2] * k * 0.3]; } else if (v < 0.7) { const k = (v - 0.35) / 0.35; rgb = [b[0] * (0.6 + 0.4 * k), b[1] * (0.3 + 0.7 * k), b[2] * (0.3 + 0.7 * k)]; } else { const k = (v - 0.7) / 0.3; rgb = [b[0] + (255 - b[0]) * k, b[1] + (240 - b[1]) * k, b[2] + (200 - b[2]) * k]; } pal.push(rgb.map((x) => x | 0)); } }
      const src = num(C.size, 0.6), cool = num(C.cool, 1.2) * 0.06, wind = num(C.wind, 0), spot = num(C.spot, 0.8);
      const x0 = Math.floor((cols * (1 - src)) / 2), x1 = Math.ceil((cols * (1 + src)) / 2);
      acc += dt * 60; let steps = Math.min(3, Math.floor(acc)); acc -= steps;
      while (steps-- > 0) {
        for (let x = 0; x < cols; x++) G[(rows - 1) * cols + x] = x >= x0 && x < x1 ? 0.9 + R0() * 0.1 : 0;
        const px = Math.floor((P.x / W) * cols), py = Math.floor((P.y / H) * rows);
        if (spot > 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const x = px + dx, y = py + dy; if (x >= 0 && x < cols && y >= 0 && y < rows) G[y * cols + x] = Math.max(G[y * cols + x], spot); }
        for (let y = 1; y < rows; y++) for (let x = 0; x < cols; x++) {
          const v = G[y * cols + x]; const sh = Math.round(R0() * 2 - 1 + wind * R0() * 0.8); const nx = clamp(x + sh, 0, cols - 1);
          G[(y - 1) * cols + nx] = Math.max(0, v - R0() * cool);
        }
      }
      const d = L.img.data; let hsum = 0, hc = 0;
      for (let x = 0; x < cols; x += 4) { let y = 0; while (y < rows && G[y * cols + x] < 0.2) y++; if (y < rows - 1) { hsum += rows - y; hc++; } }
      for (let i = 0; i < G.length; i++) { const p = pal[(clamp(G[i], 0, 1) * 255) | 0]; const o = i * 4; d[o] = Math.max(6, p[0]); d[o + 1] = Math.max(10, p[1]); d[o + 2] = Math.max(20, p[2]); d[o + 3] = 255; }
      L.x.putImageData(L.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(L.c, 0, 0, W, H);
      const hp = G[clamp(Math.floor((P.y / H) * rows), 0, rows - 1) * cols + clamp(Math.floor((P.x / W) * cols), 0, cols - 1)];
      return { cols, rows, src, cool: num(C.cool, 1.2), hgt: hc ? ((hsum / hc) * H) / rows : 0, wind, hp, spot, ix: fmt(hp, 2) };
    };
  },
};

/* ───────────────────────── smoke ───────────────────────── */
FAM.smoke = {
  spec: { color: { label: '烟雾颜色', value: '#cbd5e1' }, speed: SPD(), size: { label: '烟团大小', min: 0.4, max: 2.5, step: 0.05, value: 1 }, count: { label: '发射率 个/s', min: 10, max: 120, step: 5, value: 50, buttons: true }, extras: [R('rise', '浮力 a', 0, 200, 5, 70), R('spread', '湍流扩散', 0, 3, 0.05, 1)], remountKeys: [] },
  presets: { 轻烟: { count: 25 }, 浓烟: { count: 110, size: 1.6 }, 烟囱: { spread: 0.3 }, 彩色烟: { color: '#f472b6' }, 慢散: { speed: 0.4 }, 快喷: { rise: 190 } },
  doc: {
    title: '烟雾 · 浮力 + 湍流 + 扩散',
    rows: (v) => [['粒子数', String(v.n ?? 0)], ['发射率', `${fmt(v.rate ?? 0, 0)} 个/s`], ['浮力 a', `${fmt(v.a ?? 0, 0)} px/s²`], ['平均年龄', `${fmt(v.age ?? 0, 2)} s`, 'age'], ['平均半径', `${fmt(v.r ?? 0, 0)} px`], ['湍流', fmt(v.sp ?? 0, 2)]],
    formula: () => F('vᵧ ← vᵧ − a·Δt（热烟上升）') + F('vₓ ← vₓ + s·(noise(x, y, t) − ½)·Δt') + F('半径 r = r₀(1 + 1.5·age)，透明度 α = α₀(1 − age/life)'),
    explain: '<p>烟由许多半透明的圆团组成。热空气比周围轻，受<b>浮力</b>向上加速；空气中不规则的气流用噪声场模拟，把烟团推得左右摇摆（<b>湍流</b>）。</p><p>烟团在上升过程中不断变大变淡，表示烟在向四周扩散、浓度下降。</p><p>烟从底部的烟源和指针位置同时冒出。</p>',
    params: [['烟雾颜色', '烟的颜色'], ['时间流速', '0 = 暂停'], ['烟团大小', '初始半径'], ['发射率 个/s', '每秒冒出的烟团数'], ['浮力 a', '上升加速度'], ['湍流扩散', '左右摇摆强度']],
    example: (v) => `<ol><li>每秒发射 ${fmt(v.rate ?? 0, 0)} 个，寿命约 3 s</li><li>稳定时约 ${fmt((v.rate ?? 0) * 3, 0)} 个（实际 ${v.n}）</li><li>浮力 a = ${fmt(v.a ?? 0, 0)}：1 s 后上升速度约 ${fmt(v.a ?? 0, 0)} px/s</li></ol>`,
    tip: '移动指针在任意位置冒烟。',
  },
  build(S) {
    const R0 = rng(111), N = makeNoise(111); const ps = []; let acc = 0, spr = null, sk = '';
    return ({ ctx, W, H, dt, t, C, P }) => {
      const col = C.color || '#cbd5e1'; if (sk !== col) { sk = col; spr = document.createElement('canvas'); spr.width = spr.height = 64; const x = spr.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.5, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
      const rate = num(C.count, 50), a = num(C.rise, 70), sp = num(C.spread, 1), r0 = 14 * num(C.size, 1);
      acc += rate * dt;
      while (acc >= 1) { acc -= 1; const fromP = R0() < 0.5; ps.push({ x: fromP ? P.x : W / 2 + (R0() - 0.5) * 30, y: fromP ? P.y : H - 10, vx: (R0() - 0.5) * 20, vy: -20 - R0() * 20, age: 0, life: 2.6 + R0() * 0.8 }); }
      for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.vy -= a * dt; p.vx += sp * 160 * (N.n3(p.x / 90, p.y / 90, t * 0.4) - 0.5) * dt; p.vx *= Math.exp(-0.8 * dt); p.vy *= Math.exp(-0.5 * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt; if (p.age > p.life || p.y < -80) ps.splice(i, 1); }
      S.clear(); let ag = 0, rs = 0;
      for (const p of ps) { const k = p.age / p.life, r = r0 * (1 + 1.5 * p.age); ag += p.age; rs += r; ctx.globalAlpha = clamp((1 - k) * Math.min(1, p.age * 6), 0, 1); ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#334155'; ctx.fillRect(W / 2 - 22, H - 8, 44, 8);
      const n = ps.length || 1;
      return { n: ps.length, rate, a, age: ag / n, r: rs / n, sp, ix: `${ps.length}` };
    };
  },
};

/* ───────────────────────── reactdiff ───────────────────────── */
FAM.reactdiff = {
  spec: { color: { label: '图案颜色', value: '#34d399' }, speed: SPD('演化速度'), size: { label: '笔刷半径', min: 1, max: 6, step: 0.5, value: 2.5 }, count: false, extras: [R('F', '补给率 F', 0.01, 0.08, 0.001, 0.0545), R('k', '消耗率 k', 0.045, 0.07, 0.0005, 0.062)], remountKeys: [] },
  presets: { 珊瑚: { F: 0.0545, k: 0.062 }, 条纹: { F: 0.022, k: 0.051 }, 斑点: { F: 0.035, k: 0.065 }, 迷宫: { F: 0.029, k: 0.057 }, 混沌: { F: 0.026, k: 0.0535 }, 慢演化: { speed: 0.4 } },
  doc: {
    title: '反应扩散 · Gray-Scott 模型',
    rows: (v) => [['网格', `${v.cols ?? 0} × ${v.rows ?? 0}`], ['补给率 F', fmt(v.F ?? 0, 4)], ['消耗率 k', fmt(v.k ?? 0, 4)], ['每帧步数', String(v.steps ?? 0)], ['平均 V 浓度', fmt(v.vm ?? 0, 4), 'vm'], ['指针处 V', fmt(v.vp ?? 0, 3)]],
    formula: () => F('∂U/∂t = D_U∇²U − UV² + F(1 − U)') + F('∂V/∂t = D_V∇²V + UV² − (F + k)V') + F('D_U = 1，D_V = 0.5，∇² 用 3×3 卷积核'),
    explain: '<p>想象两种化学物质：U 是“食物”，V 是“吃食物的生物”。V 碰到 U 就把它变成更多 V（UV² 项），同时 V 会以速率 k 死亡，U 以速率 F 被补充。</p><p>两者都在扩散，但 U 扩散得比 V 快一倍。这种“快抑制、慢激活”的竞争会自发形成<b>图灵斑图</b>：斑马条纹、豹纹斑点、珊瑚、迷宫……</p><p>改变 F 和 k 就能切换图案类型。指针会在经过处投放 V。</p>',
    params: [['图案颜色', 'V 浓度高处的颜色'], ['演化速度', '每帧模拟步数倍率'], ['笔刷半径', '指针投放 V 的半径（格）'], ['补给率 F', 'U 的补充速率'], ['消耗率 k', 'V 的消亡速率']],
    example: (v) => `<ol><li>F = ${fmt(v.F ?? 0, 4)}，k = ${fmt(v.k ?? 0, 4)}</li><li>每帧计算 ${v.steps} 步 × ${(v.cols ?? 0) * (v.rows ?? 0)} 格</li><li>F + k = ${fmt((v.F ?? 0) + (v.k ?? 0), 4)}：V 的总损失率</li></ol>`,
    tip: '按住拖动画出新的种子；切换预设对比不同斑图。',
  },
  build(S) {
    let cols = 0, rows = 0, U, V, U2, V2, L = null, acc = 0, lastSteps = 0;
    const setup = (W, H) => {
      cols = Math.min(150, Math.max(60, Math.round(W / 5))); rows = Math.max(40, Math.round((cols * H) / W)); const n = cols * rows;
      U = new Float32Array(n).fill(1); V = new Float32Array(n); U2 = new Float32Array(n); V2 = new Float32Array(n);
      const R0 = rng(7); for (let s = 0; s < 14; s++) { const cx = (R0() * cols) | 0, cy = (R0() * rows) | 0; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const i = ((cy + y + rows) % rows) * cols + ((cx + x + cols) % cols); U[i] = 0.5; V[i] = 0.25; } }
      L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows);
    };
    return ({ ctx, W, H, dt, C, P }) => {
      const c = Math.min(150, Math.max(60, Math.round(W / 5))); if (!U || c !== cols || Math.max(40, Math.round((c * H) / W)) !== rows) setup(W, H);
      const Fv = num(C.F, 0.0545), kv = num(C.k, 0.062), br = num(C.size, 2.5);
      acc += dt * 60 * 8; let steps = Math.min(24, Math.floor(acc)); acc -= steps; if (acc > 24) acc = 0; if (dt > 0) lastSteps = steps;
      const px = Math.floor((P.x / W) * cols), py = Math.floor((P.y / H) * rows);
      if (dt > 0) for (let y = -Math.ceil(br); y <= Math.ceil(br); y++) for (let x = -Math.ceil(br); x <= Math.ceil(br); x++) if (x * x + y * y <= br * br) { const xx = px + x, yy = py + y; if (xx >= 0 && xx < cols && yy >= 0 && yy < rows) V[yy * cols + xx] = Math.max(V[yy * cols + xx], P.down ? 0.5 : 0.3); }
      while (steps-- > 0) {
        for (let y = 0; y < rows; y++) {
          const ym = ((y - 1 + rows) % rows) * cols, y0 = y * cols, yp = ((y + 1) % rows) * cols;
          for (let x = 0; x < cols; x++) {
            const xm = (x - 1 + cols) % cols, xp = (x + 1) % cols, i = y0 + x;
            const lu = 0.2 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x]) + 0.05 * (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - U[i];
            const lv = 0.2 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x]) + 0.05 * (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - V[i];
            const u = U[i], v = V[i], uvv = u * v * v;
            U2[i] = clamp(u + (lu - uvv + Fv * (1 - u)), 0, 1); V2[i] = clamp(v + (0.5 * lv + uvv - (Fv + kv) * v), 0, 1);
          }
        }
        [U, U2] = [U2, U]; [V, V2] = [V2, V];
      }
      const rgb = hexRgb(C.color || '#34d399'); const d = L.img.data; let vs = 0;
      for (let i = 0; i < V.length; i++) { const v = clamp(V[i] * 3, 0, 1); vs += V[i]; const o = i * 4; d[o] = 6 + (rgb[0] - 6) * v; d[o + 1] = 10 + (rgb[1] - 10) * v; d[o + 2] = 20 + (rgb[2] - 20) * v; d[o + 3] = 255; }
      L.x.putImageData(L.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(L.c, 0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P.x, P.y, (br * W) / cols, 0, TAU); ctx.stroke();
      const vp = V[clamp(py, 0, rows - 1) * cols + clamp(px, 0, cols - 1)];
      return { cols, rows, F: Fv, k: kv, steps: lastSteps, vm: vs / V.length, vp, ix: fmt(vp, 3) };
    };
  },
};

/* ───────────────────────── isometric ───────────────────────── */
FAM.isometric = {
  spec: { color: { label: '柱体颜色', value: '#818cf8' }, speed: SPD('起伏速度'), size: { label: '柱子粗细', min: 0.4, max: 1, step: 0.05, value: 0.86 }, count: { label: '每边格数 n', min: 6, max: 20, step: 1, value: 12, buttons: true }, extras: [R('amp', '起伏幅度', 0, 2, 0.05, 1), R('lift', '指针抬升', 0, 2, 0.05, 1), T('rainbow', '按高度着色', false)], remountKeys: [] },
  presets: { 起伏城: {}, 低矮: { amp: 0.4 }, 高峰: { amp: 1.8 }, 疏: { count: 7 }, 密: { count: 20 }, 彩虹高: { rainbow: true } },
  doc: {
    title: '等距投影 · 2.5D 柱阵',
    rows: (v) => [['柱数 n²', String(v.N ?? 0)], ['最高柱', `${fmt(v.hmax ?? 0, 0)} px`], ['平均高度', `${fmt(v.hav ?? 0, 0)} px`], ['指针所在格 (i, j)', v.cell ?? '—', 'cell'], ['菱形宽 w', `${fmt(v.tw ?? 0, 1)} px`], ['投影倾角', '≈ 26.6°（2:1）']],
    formula: () => F('屏幕 x = x₀ + (i − j)·w/2') + F('屏幕 y = y₀ + (i + j)·w/4 − h') + F('h(i,j,t) = H·[½ + ½ sin(0.6i + t)·cos(0.5j − 0.7t)] + 抬升·e^(−d²/4)'),
    explain: '<p><b>等距投影</b>是游戏里常见的“2.5D”画法：把三维格子沿对角线斜着看，x、y 两个方向都缩成一半宽的斜线，高度直接向上画。它没有近大远小，所以远处的柱子和近处一样大。</p><p>画的时候必须<b>从后往前</b>（i + j 从小到大）画，前面的柱子才能挡住后面的。</p><p>每根柱子的高度由两个正弦波相乘形成起伏地形，指针所在格会被抬高。</p>',
    params: [['柱体颜色', '顶面颜色，侧面更暗'], ['起伏速度', '时间流速'], ['柱子粗细', '柱子占格子比例'], ['每边格数 n', 'n × n 根柱子'], ['起伏幅度', '波浪起伏高度'], ['指针抬升', '指针处额外升高'], ['按高度着色', '高度映射到色相']],
    example: (v) => `<ol><li>格子 (i, j) = ${v.cell}</li><li>屏幕位置 x = x₀ + (i − j)·${fmt((v.tw ?? 0) / 2, 1)}</li><li>共 ${v.N} 根柱子，按 i + j 从后往前绘制</li></ol>`,
    tip: '移动指针抬起柱子；调格数看疏密。',
  },
  build(S) {
    const N = makeNoise(121);
    return ({ ctx, W, H, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 12)), 3, 30), amp = num(C.amp, 1), lift = num(C.lift, 1), th0 = num(C.size, 0.86), rb = on(C.rainbow);
      const tw = Math.min(W * 0.9, H * 1.35) / n, th = tw / 2, Hm = H * 0.22;
      const oy = (H - n * th) / 2 + Hm * 0.45, ox = W / 2;
      const rx = (P.x - ox) / (tw / 2), ry = (P.y - oy) / (th / 2); const gi = (rx + ry) / 2, gj = (ry - rx) / 2;
      S.clear(); const rgb = hexRgb(C.color || '#818cf8'); const base = hueOf(C.color || '#818cf8');
      let hmax = 0, hs = 0;
      const shade = (k, h) => (rb ? hsla(base + (h / (Hm * 2.2)) * 200, 85, 30 + 35 * k) : `rgb(${(rgb[0] * k) | 0},${(rgb[1] * k) | 0},${(rgb[2] * k) | 0})`);
      for (let s = 0; s <= 2 * (n - 1); s++) for (let i = 0; i < n; i++) {
        const j = s - i; if (j < 0 || j >= n) continue;
        const d2 = (i - gi) ** 2 + (j - gj) ** 2;
        const h = 4 + Hm * amp * (0.5 + 0.5 * Math.sin(0.6 * i + t) * Math.cos(0.5 * j - 0.7 * t)) * (0.7 + 0.6 * N.n3(i * 0.3, j * 0.3, 0)) + Hm * lift * Math.exp(-d2 / 4);
        hmax = Math.max(hmax, h); hs += h;
        const sx = ox + ((i - j) * tw) / 2, sy = oy + ((i + j) * th) / 2 + th / 2; const hw = (tw / 2) * th0, hh = (th / 2) * th0;
        ctx.fillStyle = shade(0.55, h); ctx.beginPath(); ctx.moveTo(sx - hw, sy - h); ctx.lineTo(sx, sy + hh - h); ctx.lineTo(sx, sy + hh); ctx.lineTo(sx - hw, sy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(0.38, h); ctx.beginPath(); ctx.moveTo(sx + hw, sy - h); ctx.lineTo(sx, sy + hh - h); ctx.lineTo(sx, sy + hh); ctx.lineTo(sx + hw, sy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(d2 < 0.5 ? 1.25 : 0.95, h); ctx.beginPath(); ctx.moveTo(sx, sy - hh - h); ctx.lineTo(sx + hw, sy - h); ctx.lineTo(sx, sy + hh - h); ctx.lineTo(sx - hw, sy - h); ctx.closePath(); ctx.fill();
      }
      const inside = gi >= -0.5 && gj >= -0.5 && gi < n - 0.5 && gj < n - 0.5;
      return { N: n * n, hmax, hav: hs / (n * n), cell: inside ? `(${Math.round(gi)}, ${Math.round(gj)})` : '网格外', tw, ix: inside ? `${Math.round(gi)},${Math.round(gj)}` : 'o' };
    };
  },
};

/* ───────────────────────── metaballs2d ───────────────────────── */
FAM.metaballs2d = {
  spec: { color: { label: '融球颜色', value: '#f472b6' }, speed: SPD(), size: { label: '球半径', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '球数', min: 1, max: 8, step: 1, value: 3, buttons: true }, extras: [R('thr', '阈值 T', 0.5, 2, 0.05, 1), R('soft', '边缘柔和', 0.02, 1, 0.02, 0.2), T('rainbow', '每球不同色', false)], remountKeys: [] },
  presets: { 双球: { count: 2 }, 三球: { count: 3 }, 软: { soft: 0.8 }, 硬: { soft: 0.04 }, 彩: { rainbow: true }, 单: { count: 1 } },
  doc: {
    title: '2D 融球 · 隐式等值面',
    rows: (v) => [['球数', String(v.n ?? 0)], ['球半径 r', `${fmt(v.r ?? 0, 0)} px`], ['阈值 T', fmt(v.thr ?? 0, 2)], ['覆盖率', `${fmt(v.cov ?? 0, 1)} %`, 'cov'], ['画面中心场值', fmt(v.fc ?? 0, 2)], ['最近两球距离', `${fmt(v.dmin ?? 0, 0)} px`]],
    formula: () => F('场 f(p) = Σᵢ rᵢ² / |p − cᵢ|²') + F('f(p) ≥ T 的区域就是“球”') + F('单球边界：|p − c| = r/√T；两球靠近时场相加，边界自然融合'),
    explain: '<p>每个球不是画出来的圆，而是一个向外衰减的<b>场</b>：离球心越近数值越大。把所有球的场加起来，凡是总和超过阈值 T 的像素就涂色。</p><p>两个球离得远时各是各的圆；一靠近，中间的场叠加超过阈值，就像水银一样“粘”在一起——这就是<b>融球</b>（metaball）。</p><p>第一个球跟随指针，其它球按李萨如轨迹运动。</p>',
    params: [['融球颜色', '内部颜色'], ['时间流速', '0 = 暂停'], ['球半径', '每个球的场强半径'], ['球数', '球的数量'], ['阈值 T', '越大球越小'], ['边缘柔和', '边界渐变宽度'], ['每球不同色', '按贡献最大的球着色']],
    example: (v) => `<ol><li>单球可见半径 = r/√T = ${fmt((v.r ?? 0) / Math.sqrt(v.thr || 1), 0)} px</li><li>两球中点各贡献 r²/(d/2)²，和 ≥ T 时连成一体</li><li>当前最近两球 d = ${fmt(v.dmin ?? 0, 0)} px</li></ol>`,
    tip: '用指针拖动第一个球去“粘”其他球。',
  },
  build(S) {
    let L = null; const bx = new Float32Array(10), by = new Float32Array(10);
    return ({ ctx, W, H, t, C, P }) => {
      const cols = Math.min(200, Math.max(60, Math.round(W / 4))), rows = Math.max(30, Math.round((cols * H) / W));
      if (!L || L.w !== cols || L.h !== rows) { L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows); }
      const n = clamp(Math.round(num(C.count, 3)), 1, 10), r = Math.min(W, H) * 0.19 * num(C.size, 1), thr = num(C.thr, 1), soft = num(C.soft, 0.2), rb = on(C.rainbow);
      bx[0] = P.x; by[0] = P.y;
      for (let i = 1; i < n; i++) { bx[i] = W / 2 + Math.cos(t * (0.5 + i * 0.13) + i * 2.1) * W * 0.3; by[i] = H / 2 + Math.sin(t * (0.7 + i * 0.11) + i) * H * 0.3; }
      const sx = W / cols, r2 = r * r, rgb = hexRgb(C.color || '#f472b6'); const base = hueOf(C.color || '#f472b6'); const d = L.img.data; let cov = 0;
      const pal = []; for (let i = 0; i < n; i++) { const h = (((base + i * 50) % 360) + 360) % 360 / 360; const q = (p, q2, tt) => { tt = (tt + 1) % 1; return tt < 1 / 6 ? p + (q2 - p) * 6 * tt : tt < 0.5 ? q2 : tt < 2 / 3 ? p + (q2 - p) * (2 / 3 - tt) * 6 : p; }; pal.push([q(0.25, 0.95, h + 1 / 3) * 255, q(0.25, 0.95, h) * 255, q(0.25, 0.95, h - 1 / 3) * 255]); }
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const px = (x + 0.5) * sx, py = (y + 0.5) * sx; let f = 0, best = 0, bi = 0;
        for (let i = 0; i < n; i++) { const c = r2 / ((px - bx[i]) ** 2 + (py - by[i]) ** 2 + 1); f += c; if (c > best) { best = c; bi = i; } }
        let a = (f - (thr - soft)) / (2 * soft); a = a < 0 ? 0 : a > 1 ? 1 : a * a * (3 - 2 * a); if (a > 0.5) cov++;
        const col = rb ? pal[bi] : rgb; const hl = clamp((f - thr * 2) / (thr * 4), 0, 0.5); const o = (y * cols + x) * 4;
        d[o] = 6 + (col[0] - 6) * a + 255 * hl * a; d[o + 1] = 10 + (col[1] - 10) * a + 255 * hl * a; d[o + 2] = 20 + (col[2] - 20) * a + 255 * hl * a; d[o + 3] = 255;
      }
      L.x.putImageData(L.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(L.c, 0, 0, W, H);
      let fc = 0, dmin = 0; for (let i = 0; i < n; i++) fc += r2 / ((W / 2 - bx[i]) ** 2 + (H / 2 - by[i]) ** 2 + 1);
      if (n > 1) { dmin = 1e9; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) dmin = Math.min(dmin, dist(bx[i], by[i], bx[j], by[j])); }
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(P.x, P.y, 5, 0, TAU); ctx.stroke();
      return { n, r, thr, cov: (cov / (cols * rows)) * 100, fc, dmin, ix: fmt(dmin, 0) };
    };
  },
};

/* ───────────────────────── pixelate ───────────────────────── */
FAM.pixelate = {
  spec: { color: { label: '主体颜色', value: '#f472b6' }, speed: SPD('场景速度'), size: { label: '像素块大小 b', min: 2, max: 32, step: 1, value: 10 }, count: false, extras: [R('levels', '色阶数', 2, 32, 1, 32), R('lens', '透镜半径', 0, 200, 5, 90), T('mono', '黑白', false)], remountKeys: [] },
  presets: { 大像素: { size: 20 }, 小像素: { size: 4 }, 强: { levels: 4 }, 弱: { levels: 32 }, 彩: {}, 单: { mono: true } },
  doc: {
    title: '像素化 · 降采样与色阶量化',
    rows: (v) => [['像素块 b', `${v.b ?? 0} px`], ['低分辨率', `${v.lw ?? 0} × ${v.lh ?? 0}`], ['像素数', String(v.np ?? 0)], ['数据量比例 1/b²', `${fmt(v.ratio ?? 0, 2)} %`], ['色阶数 L', String(v.L ?? 0)], ['透镜位置', v.lp ?? '—', 'lp']],
    formula: () => F('降采样：W′ = ⌈W / b⌉，H′ = ⌈H / b⌉') + F('放大：最近邻插值（每块一个颜色）') + F('量化：c′ = round(c·(L−1)/255)·255/(L−1)'),
    explain: '<p>像素风的本质是<b>降低分辨率</b>：先把画面缩小 b 倍（每 b×b 个像素平均成一个），再用“最近邻”方式放大回去，每块就只剩一种颜色。</p><p>再加上<b>色阶量化</b>：把每个通道 0~255 的取值压缩到 L 档，色彩变得像老游戏机一样有限。</p><p>指针处的圆形透镜显示原始画面，方便对比。数据量只剩原来的 1/b²。</p>',
    params: [['主体颜色', '场景中图形的颜色'], ['场景速度', '场景动画速度'], ['像素块大小 b', '越大越粗糙'], ['色阶数', '每通道颜色档数，32 ≈ 不量化'], ['透镜半径', '0 = 关闭原图透镜'], ['黑白', '转为灰度']],
    example: (v) => `<ol><li>b = ${v.b} → ${v.lw} × ${v.lh} = ${v.np} 个像素</li><li>只剩原图 ${fmt(v.ratio ?? 0, 2)}% 的数据</li><li>L = ${v.L}：每通道只有 ${v.L} 种取值</li></ol>`,
    tip: '移动指针用透镜对比原图；把块调到 20 看像素风。',
  },
  build(S) {
    let scene = null, low = null;
    return ({ ctx, W, H, t, C, P }) => {
      if (!scene || scene.w !== W || scene.h !== H) scene = makeLayer(W, H, 1);
      const x = scene.x, col = C.color || '#f472b6', base = hueOf(col);
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f172a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fde68a'; x.beginPath(); x.arc(W * 0.78, H * 0.28, Math.min(W, H) * 0.12, 0, TAU); x.fill();
      for (let i = 0; i < 6; i++) { x.fillStyle = hsla(base + i * 12, 60, 18 + i * 5); x.fillRect(((i * 97 + t * 30 * (i + 1)) % (W + 120)) - 60, H * 0.55 + i * 6, 70 + i * 10, H); }
      x.save(); x.translate(W * 0.35, H * 0.5); x.rotate(t * 0.6); x.fillStyle = col; const s = Math.min(W, H) * 0.22; x.fillRect(-s / 2, -s / 2, s, s); x.restore();
      x.fillStyle = rgba(mix(col, 0.4), 1); x.beginPath(); x.arc(W * 0.55 + Math.cos(t) * W * 0.12, H * 0.45 + Math.sin(t * 1.3) * H * 0.15, Math.min(W, H) * 0.09, 0, TAU); x.fill();
      x.strokeStyle = '#a5f3fc'; x.lineWidth = 3; x.beginPath(); for (let k = 0; k <= W; k += 6) x.lineTo(k, H * 0.82 + Math.sin(k * 0.03 + t * 2) * 10); x.stroke();
      const b = clamp(Math.round(num(C.size, 10)), 1, 64), lw = Math.ceil(W / b), lh = Math.ceil(H / b), Lv = clamp(Math.round(num(C.levels, 32)), 2, 256), mono = on(C.mono);
      if (!low || low.w !== lw || low.h !== lh) low = makeLayer(lw, lh, 1);
      low.x.imageSmoothingEnabled = true; low.x.drawImage(scene.c, 0, 0, lw, lh);
      if (Lv < 32 || mono) { const id = low.x.getImageData(0, 0, lw, lh), d = id.data, q = 255 / (Lv - 1); for (let i = 0; i < d.length; i += 4) { if (mono) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; } if (Lv < 32) for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] / q) * q; } low.x.putImageData(id, 0, 0); }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(low.c, 0, 0, lw * b, lh * b); ctx.imageSmoothingEnabled = true;
      const lr = num(C.lens, 90);
      if (lr > 0) { ctx.save(); ctx.beginPath(); ctx.arc(P.x, P.y, lr, 0, TAU); ctx.clip(); ctx.drawImage(scene.c, 0, 0, W, H); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, lr, 0, TAU); ctx.stroke(); }
      return { b, lw, lh, np: lw * lh, ratio: 100 / (b * b), L: Lv, lp: `${Math.round(P.x)}, ${Math.round(P.y)}` };
    };
  },
};

/* ───────────────────────── ascii ───────────────────────── */
const RAMP = ' .:-=+*#%@';
FAM.ascii = {
  spec: { color: { label: '字符颜色', value: '#34d399' }, speed: SPD('流动速度'), size: { label: '字号 px', min: 8, max: 22, step: 1, value: 12 }, count: false, extras: [R('light', '指针光强', 0, 2, 0.05, 1), R('contrast', '对比度', 0.5, 2.5, 0.05, 1.2), T('rainbow', '彩虹行', false)], remountKeys: [] },
  presets: { 密字: { size: 8 }, 疏字: { size: 18 }, 动: { speed: 2 }, 静: { speed: 0.2 }, 彩: { rainbow: true }, 单: {} },
  doc: {
    title: 'ASCII 字符画 · 亮度 → 字符',
    rows: (v) => [['字号', `${v.fs ?? 0} px`], ['网格', `${v.cols ?? 0} × ${v.rows ?? 0}`], ['字符数', String(v.nc ?? 0)], ['灰度阶数', String(RAMP.length)], ['指针处亮度', fmt(v.bp ?? 0, 2), 'bp'], ['对应字符', `“${v.ch ?? ' '}”`]],
    formula: () => F('亮度 b = clamp(c·(fbm(x, y, t) − ½) + ½ + 光强·e^(−d²/2σ²), 0, 1)') + F('字符索引 i = ⌊b·(N − 1)⌋，N = 10') + F('字符表：" .:-=+*#%@"（笔画越多越“亮”）'),
    explain: '<p>字符画把画面切成一个个小格，每格算一个<b>亮度</b>，再挑一个“墨水量”相当的字符：空格最暗，@ 最亮。</p><p>这里的亮度来自缓慢流动的分形噪声，再加上指针处的一盏高斯“灯”。字号越小格子越多、画面越细腻。</p><p>为了性能，每一行拼成一个字符串只画一次。</p>',
    params: [['字符颜色', '文字颜色'], ['流动速度', '噪声流动速度'], ['字号 px', '每格大小'], ['指针光强', '指针灯的亮度'], ['对比度', '亮暗反差'], ['彩虹行', '每行不同色相']],
    example: (v) => `<ol><li>${v.cols} 列 × ${v.rows} 行 = ${v.nc} 个字符</li><li>指针处 b = ${fmt(v.bp ?? 0, 2)} → 第 ${Math.floor((v.bp ?? 0) * 9)} 个字符“${v.ch}”</li><li>字号减半，字符数约变 4 倍</li></ol>`,
    tip: '移动指针照亮字符；调字号对比清晰度。',
  },
  build(S) {
    const N = makeNoise(131);
    return ({ ctx, W, H, t, C, P }) => {
      const fs = clamp(Math.round(num(C.size, 12)), 6, 40), light = num(C.light, 1), con = num(C.contrast, 1.2), rb = on(C.rainbow);
      ctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'top';
      const cw = ctx.measureText('M').width || fs * 0.6; const cols = Math.floor(W / cw), rows = Math.floor(H / fs);
      S.clear(); const base = hueOf(C.color || '#34d399'); const s2 = 2 * 90 * 90; let bp = 0, ch = ' ';
      const pi = Math.floor(P.x / cw), pj = Math.floor(P.y / fs);
      for (let j = 0; j < rows; j++) {
        let line = '';
        for (let i = 0; i < cols; i++) {
          const x = i * cw, y = j * fs;
          let b = con * (N.fbm(x / 160, y / 160, t * 0.25, 4) - 0.5) + 0.45 + light * Math.exp(-((x - P.x) ** 2 + (y - P.y) ** 2) / s2) * 0.8;
          b = clamp(b, 0, 1); const c = RAMP[Math.floor(b * (RAMP.length - 1))]; line += c;
          if (i === pi && j === pj) { bp = b; ch = c; }
        }
        ctx.fillStyle = rb ? hsla(base + j * 6 + t * 20, 85, 62) : (C.color || '#34d399'); ctx.fillText(line, (W - cols * cw) / 2, j * fs + (H - rows * fs) / 2);
      }
      return { fs, cols, rows, nc: cols * rows, bp, ch, ix: fmt(bp, 2) };
    };
  },
};

/* ───────────────────────── ripple-c ───────────────────────── */
FAM['ripple-c'] = {
  spec: { color: { label: '水面颜色', value: '#38bdf8' }, speed: SPD('波速倍率'), size: { label: '水滴半径', min: 1, max: 6, step: 0.5, value: 2.5 }, count: false, extras: [R('damp', '阻尼保留率', 0.9, 0.999, 0.001, 0.985), R('rain', '自动雨滴 /s', 0, 10, 0.5, 2), R('power', '水滴强度', 0.2, 2, 0.05, 1)], remountKeys: [] },
  presets: { 单波: { rain: 0 }, 多波: { rain: 8 }, 快: { speed: 2 }, 慢: { speed: 0.4 }, 强: { power: 2 }, 弱: { damp: 0.95 } },
  doc: {
    title: '水波纹 · 离散波动方程',
    rows: (v) => [['网格', `${v.cols ?? 0} × ${v.rows ?? 0}`], ['阻尼保留率', fmt(v.damp ?? 0, 3)], ['波速 c', `${fmt(v.c ?? 0, 0)} px/s`], ['总能量 Σh²', fmt(v.E ?? 0, 1), 'E'], ['指针处高度', fmt(v.hp ?? 0, 2)], ['水滴次数', String(v.drops ?? 0)], ['水滴半径 / 强度', `${fmt(v.r ?? 0, 1)} 格 / ${fmt(v.pw ?? 0, 2)}`], ['自动雨滴', `${fmt(v.rain ?? 0, 1)} /s`]],
    formula: () => F('∂²h/∂t² = c²·∇²h（波动方程）') + F('离散：hₙ₊₁ = ½(上+下+左+右)ₙ − hₙ₋₁') + F('阻尼：hₙ₊₁ ← d·hₙ₊₁；波速 c ≈ 格宽 × 60 / √2'),
    explain: '<p>水面每一格记录一个高度。<b>波动方程</b>说：一格的加速度取决于它和四周的高度差——比邻居低就被拉上去，比邻居高就被拉下来。</p><p>用两张高度图交替计算（这一帧和上一帧），就能让扰动以圆环向外传播，遇到边界反射、相遇时<b>干涉</b>。</p><p>每步乘以阻尼保留率 d，波纹逐渐平息。点击或拖动在水面滴水，明暗来自水面的坡度。</p>',
    params: [['水面颜色', '水的颜色'], ['波速倍率', '每秒模拟步数倍率'], ['水滴半径', '扰动半径（格）'], ['阻尼保留率', '越接近 1 波纹越持久'], ['自动雨滴 /s', '每秒随机雨滴数'], ['水滴强度', '扰动深度']],
    example: (v) => `<ol><li>每步保留 ${fmt(v.damp ?? 0, 3)}，60 步后剩 ${fmt((v.damp ?? 0) ** 60 * 100, 1)}%</li><li>波速 ≈ ${fmt(v.c ?? 0, 0)} px/s</li><li>当前能量 Σh² = ${fmt(v.E ?? 0, 1)}</li></ol>`,
    tip: '点击或拖动滴水；把阻尼调到 0.999 看长时间干涉。',
  },
  build(S) {
    const R0 = rng(141); let A, B, cols = 0, rows = 0, L = null, acc = 0, rainAcc = 0, drops = 0;
    const drop = (x, y, s) => { const C = S.get(); const r = num(C.size, 2.5), p = num(C.power, 1) * s; for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) { const d2 = i * i + j * j; if (d2 > r * r) continue; const xx = x + i, yy = y + j; if (xx > 0 && xx < cols - 1 && yy > 0 && yy < rows - 1) B[yy * cols + xx] -= p * 4 * (1 - d2 / (r * r + 1)); } };
    S.onDown((P) => { drop(Math.floor((P.x / S.W) * cols), Math.floor((P.y / S.H) * rows), 1); drops++; });
    return ({ ctx, W, H, dt, C, P }) => {
      const c = Math.min(200, Math.max(60, Math.round(W / 4))), r = Math.max(30, Math.round((c * H) / W));
      if (!A || c !== cols || r !== rows) { cols = c; rows = r; A = new Float32Array(cols * rows); B = new Float32Array(cols * rows); L = makeLayer(cols, rows, 1); L.img = L.x.createImageData(cols, rows); }
      const damp = num(C.damp, 0.985);
      rainAcc += num(C.rain, 2) * dt; while (rainAcc >= 1) { rainAcc -= 1; drop(2 + ((R0() * (cols - 4)) | 0), 2 + ((R0() * (rows - 4)) | 0), 0.8); drops++; }
      if (dt > 0) { const sp = Math.hypot(P.vx, P.vy); if (P.down || sp > 60) drop(Math.floor((P.x / W) * cols), Math.floor((P.y / H) * rows), P.down ? 0.25 : Math.min(0.2, sp / 3000)); }
      acc += dt * 60; let steps = Math.min(4, Math.floor(acc)); acc -= steps;
      while (steps-- > 0) {
        for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) { const i = y * cols + x; A[i] = ((B[i - 1] + B[i + 1] + B[i - cols] + B[i + cols]) / 2 - A[i]) * damp; }
        [A, B] = [B, A];
      }
      const rgb = hexRgb(C.color || '#38bdf8'); const d = L.img.data; let E = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, h = B[i]; E += h * h; const sl = x > 0 && x < cols - 1 && y > 0 && y < rows - 1 ? (B[i - 1] - B[i + 1]) + (B[i - cols] - B[i + cols]) : 0;
        const k = clamp(0.45 + sl * 0.35, 0.1, 1.6), w = Math.max(0, sl * 0.3 - 0.2) * 255, o = i * 4;
        d[o] = clamp(rgb[0] * k + w, 0, 255); d[o + 1] = clamp(rgb[1] * k + w, 0, 255); d[o + 2] = clamp(rgb[2] * k + w, 0, 255); d[o + 3] = 255;
      }
      L.x.putImageData(L.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(L.c, 0, 0, W, H);
      const hp = B[clamp(Math.floor((P.y / H) * rows), 0, rows - 1) * cols + clamp(Math.floor((P.x / W) * cols), 0, cols - 1)];
      return { cols, rows, damp, c: ((W / cols) * 60 * C.speed) / Math.SQRT2, E, hp, drops, r: num(C.size, 2.5), pw: num(C.power, 1), rain: num(C.rain, 2), ix: String(drops) };
    };
  },
};

/* ───────────────────────── mount ───────────────────────── */
const FAMILIES = Object.keys(FAM);

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'orbits');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'orbits';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-canvas',
    title: fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    presetDefaults: F0.presets,
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => mountFamily(fam, box, o),
  });
}

function mountFamily(fam, host, opts) {
  const F0 = FAM[fam];
  const S = createCanvasStage(host, opts, { doc: F0.doc, spec: F0.spec, bg: F0.bg || '#060a14', auto: F0.auto !== false, autoPath: F0.autoPath, cursor: F0.cursor || 'crosshair' });
  const step = F0.build(S, S.get());
  S.onFrame(step);
  return S.destroy;
}
