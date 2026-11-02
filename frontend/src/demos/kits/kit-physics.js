/**
 * kit-physics — physics & interaction families on the shared canvas stage. Each family integrates
 * real equations with fixed sub-steps (energy stays bounded), exposes only the knobs it uses, and
 * documents 公式/说明/参数/步骤 in beginner Chinese. Drag to grab/throw; an idle auto-pointer keeps it alive.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, rng, hexRgb, rgba, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';
import { libs } from '../../lib/load.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label = '时间流速', max = 3) => ({ label, min: 0, max, step: 0.1, value: 1 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const mix = (c, k = 0.5, to = [255, 255, 255]) => { const a = hexRgb(c); return [0, 1, 2].map((i) => Math.round(a[i] + (to[i] - a[i]) * k)); };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
/** fixed sub-stepper: calls f(h) n times so that n·h ≈ dt (dt already scaled by speed) */
const substep = (st, dt, h, max, f) => { st.acc = (st.acc || 0) + dt; let n = 0; while (st.acc >= h && n < max) { st.acc -= h; f(h); n++; } if (st.acc > h) st.acc = 0; return n; };
/** circle vs moving pointer disc: push out + reflect relative velocity */
const hitPointer = (b, P, Rp, e = 0.9) => {
  const dx = b.x - P.x, dy = b.y - P.y, d = Math.hypot(dx, dy), m = b.r + Rp;
  if (d >= m || d < 1e-6) return false;
  const nx = dx / d, ny = dy / d; b.x = P.x + nx * m; b.y = P.y + ny * m;
  const pvx = clamp(P.vx, -1500, 1500), pvy = clamp(P.vy, -1500, 1500);
  const rv = (b.vx - pvx) * nx + (b.vy - pvy) * ny; if (rv < 0) { b.vx -= (1 + e) * rv * nx; b.vy -= (1 + e) * rv * ny; }
  return true;
};
const capV = (b, vmax) => { const s = Math.hypot(b.vx, b.vy); if (s > vmax) { b.vx *= vmax / s; b.vy *= vmax / s; } };
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const pointerRing = (ctx, P, r, col = 'rgba(255,255,255,.35)') => { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU); ctx.stroke(); };

export const FAM = {};

/* ───────────────────────── matter (Matter.js) ───────────────────────── */
FAM.matter = {
  spec: { color: { label: '物体主色', value: '#818cf8' }, speed: SPD(), size: { label: '物体大小', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '物体数', min: 10, max: 120, step: 5, value: 40, buttons: true }, extras: [R('e', '弹性系数 e', 0, 1, 0.05, 0.5), R('g', '重力倍数', 0, 2, 0.05, 1), R('fr', '摩擦系数 μ', 0, 1, 0.05, 0.1)], remountKeys: [] },
  presets: { 默认: {}, 高弹: { e: 0.92 }, 无重力: { g: 0 }, 多物体: { count: 100 }, 大块: { size: 1.7 } },
  doc: {
    title: 'Matter.js 刚体 · 碰撞与冲量',
    rows: (v) => [['物体数', String(v.n ?? 0)], ['总动能（相对）', fmt(v.ke ?? 0, 1), 'ke'], ['平均速度', `${fmt(v.vm ?? 0, 1)} px/帧`], ['本秒碰撞', String(v.col ?? 0)], ['弹性 e / 摩擦 μ', `${fmt(v.e ?? 0, 2)} / ${fmt(v.fr ?? 0, 2)}`], ['重力', `${fmt(v.g ?? 0, 2)} g`], ['状态', String(v.st ?? '')]],
    formula: () => F('牛顿第二定律：m·a = Σ F（重力 + 接触力）') + F('碰撞冲量 j = −(1 + e)·v_rel·n / (1/m₁ + 1/m₂)') + F('摩擦 |F_f| ≤ μ·|F_n|'),
    explain: '<p>这是真正的刚体物理引擎 <b>Matter.js</b>：每个圆、方块、多边形都有质量、速度和角速度，每一步先按重力积分，再检测相互穿透并用<b>冲量</b>把它们推开。</p><p>弹性系数 e 决定碰撞后保留多少相对速度（1 = 完全弹性，0 = 粘在一起）；摩擦让物体在接触面上减速、能堆起来。</p><p>中间有一根慢慢旋转的搅拌杆，指针本身也是一个看不见的圆盘，会把物体推开。按住物体可以抓起来甩出去。</p>',
    params: [['物体主色', '物体颜色（每个略偏色相）'], ['时间流速', '0 = 暂停'], ['物体大小', '统一缩放所有物体'], ['物体数', '场景中的刚体数量'], ['弹性系数 e', '碰撞恢复系数'], ['重力倍数', '0 = 失重'], ['摩擦系数 μ', '接触面摩擦']],
    example: (v) => `<ol><li>两球以 v_rel 相撞，碰后相对速度变为 e·v_rel = ${fmt(v.e ?? 0, 2)}·v_rel</li><li>动能损失比例 1 − e² = ${fmt(1 - (v.e ?? 0) ** 2, 2)}</li><li>本秒发生 ${v.col} 次碰撞</li></ol>`,
    tip: '按住物体拖动再松手把它甩出去；把重力调到 0 看失重。',
  },
  build(S) {
    let M = null, engine = null, bodies = [], walls = [], bar = null, pb = null, grab = null, cons = null, err = '', colN = 0, colRate = 0, colT = 0; const st = {}; const R0 = rng(3);
    libs.matter().then((m) => { M = m; engine = M.Engine.create(); M.Events.on(engine, 'collisionStart', (e) => { colN += e.pairs.length; }); build(); }).catch(() => { err = '物理引擎加载失败'; });
    const build = () => {
      if (!M || !S.W) return; const { Bodies, Composite } = M; const W = S.W, H = S.H, t = 80, o = { isStatic: true, friction: 0.3 };
      if (walls.length) Composite.remove(engine.world, walls);
      walls = [Bodies.rectangle(W / 2, H + t / 2, W + 400, t, o), Bodies.rectangle(-t / 2, H / 2, t, H * 4, o), Bodies.rectangle(W + t / 2, H / 2, t, H * 4, o)];
      if (bar) Composite.remove(engine.world, bar); bar = Bodies.rectangle(W / 2, H * 0.62, Math.min(W, H) * 0.42, 14, { isStatic: true, friction: 0.2 });
      if (pb) Composite.remove(engine.world, pb); pb = Bodies.circle(-200, -200, 24, { isStatic: true });
      Composite.add(engine.world, [...walls, bar, pb]);
    };
    S.onResize(() => build());
    const spawn = (C) => {
      const { Bodies, Body, Composite } = M; const s = (12 + R0() * 14) * num(C.size, 1), r = R0(), x = 40 + R0() * (S.W - 80), y = -20 - R0() * S.H * 0.6;
      const o = { restitution: num(C.e, 0.5), friction: num(C.fr, 0.1), frictionAir: 0.004 };
      const b = r < 0.4 ? Bodies.circle(x, y, s, o) : r < 0.75 ? Bodies.rectangle(x, y, s * 1.8, s * 1.8, { ...o, chamfer: { radius: 4 } }) : Bodies.polygon(x, y, 3 + ((R0() * 4) | 0), s * 1.2, o);
      b.dh = R0() * 60 - 30; b.sc = num(C.size, 1); Body.setAngularVelocity(b, (R0() - 0.5) * 0.2); Composite.add(engine.world, b); bodies.push(b);
    };
    S.onDown((P) => {
      if (!M) return; const hit = M.Query.point(bodies, { x: P.x, y: P.y })[0];
      if (hit) { grab = hit; cons = M.Constraint.create({ pointA: { x: P.x, y: P.y }, bodyB: hit, pointB: { x: P.x - hit.position.x, y: P.y - hit.position.y }, stiffness: 0.2, damping: 0.1, length: 0 }); M.Composite.add(engine.world, cons); }
    });
    S.onUp(() => { if (cons && M) M.Composite.remove(engine.world, cons); cons = null; grab = null; });
    S.disposers.push(() => { if (M && engine) { M.World.clear(engine.world, false); M.Engine.clear(engine); } });
    return ({ ctx, W, H, dt, t, C, P }) => {
      S.clear();
      if (!M || !engine) { ctx.fillStyle = '#94a3b8'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(err || '正在加载 Matter.js…', W / 2, H / 2); ctx.textAlign = 'left'; return { n: 0, ke: 0, vm: 0, col: 0, e: num(C.e, 0.5), fr: num(C.fr, 0.1), g: num(C.g, 1), st: err || '加载中' }; }
      if (!bar) build();
      const { Body, Composite, Engine } = M; const n = clamp(Math.round(num(C.count, 40)), 1, 200);
      while (bodies.length < n) spawn(C);
      while (bodies.length > n) { const b = bodies.shift(); if (b === grab) { if (cons) Composite.remove(engine.world, cons); cons = null; grab = null; } Composite.remove(engine.world, b); }
      const e = num(C.e, 0.5), fr = num(C.fr, 0.1), sz = num(C.size, 1); engine.gravity.y = num(C.g, 1);
      for (const b of bodies) { b.restitution = e; b.friction = fr; if (Math.abs(b.sc - sz) > 1e-3) { Body.scale(b, sz / b.sc, sz / b.sc); b.sc = sz; } }
      substep(st, dt, 1 / 60, 3, () => {
        Body.setAngle(bar, (t * 0.8) % TAU);
        if (!grab) Body.setPosition(pb, { x: P.x, y: P.y }); else Body.setPosition(pb, { x: -300, y: -300 });
        if (cons) cons.pointA = { x: P.x, y: P.y };
        Engine.update(engine, 1000 / 60);
        for (const b of bodies) { if (b.position.y > H + 200 || b.position.x < -200 || b.position.x > W + 200) { Body.setPosition(b, { x: 40 + R0() * (W - 80), y: -40 }); Body.setVelocity(b, { x: 0, y: 0 }); } if (b.speed > 40) Body.setVelocity(b, { x: (b.velocity.x * 40) / b.speed, y: (b.velocity.y * 40) / b.speed }); }
      });
      colT += dt; if (colT > 1) { colRate = colN; colN = 0; colT = 0; }
      const base = hueOf(C.color || '#818cf8'); let ke = 0, vs = 0;
      const draw = (b, fill, stroke) => { ctx.beginPath(); const v = b.vertices; ctx.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
      draw(bar, '#1e293b', '#475569');
      for (const b of bodies) { ke += 0.5 * b.mass * b.speed * b.speed; vs += b.speed; draw(b, hsla(base + b.dh, 75, b === grab ? 70 : 58), 'rgba(255,255,255,.3)'); }
      if (cons) { ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(grab.position.x + cons.pointB.x, grab.position.y + cons.pointB.y); ctx.stroke(); ctx.setLineDash([]); }
      else pointerRing(ctx, P, 24);
      return { n: bodies.length, ke, vm: vs / Math.max(1, bodies.length), col: colRate, e, fr, g: engine.gravity.y, st: grab ? '抓取中' : '运行', ix: grab ? `g${grab.id}` : '' };
    };
  },
};

/* ───────────────────────── drag (kanban reorder) ───────────────────────── */
FAM.drag = {
  spec: { color: { label: '卡片强调色', value: '#22d3ee' }, speed: SPD('动画时间流速'), size: { label: '卡片高度', min: 0.6, max: 1.4, step: 0.05, value: 1 }, count: { label: '卡片数', min: 4, max: 15, step: 1, value: 9, buttons: true }, extras: [R('w', '弹簧角频率 ω', 4, 30, 1, 14), R('zeta', '阻尼比 ζ', 0.2, 1.5, 0.05, 1), T('ghost', '自动示范拖拽', true)], remountKeys: [] },
  presets: { 默认: {}, 弹跳: { zeta: 0.3 }, 迟缓: { w: 5 }, 干脆: { w: 28, zeta: 1 }, 多卡: { count: 15 } },
  doc: {
    title: '拖拽排序 · 临界阻尼弹簧动画',
    rows: (v) => [['卡片数', String(v.n ?? 0)], ['拖动中', String(v.drag ?? '无')], ['目标位置（列, 序号）', String(v.slot ?? '—'), 'slot'], ['ω / ζ', `${fmt(v.w ?? 0, 0)} / ${fmt(v.z ?? 0, 2)}`], ['调整时间 ≈ 4/(ζω)', `${fmt(v.ts ?? 0, 2)} s`], ['最大偏离', `${fmt(v.dev ?? 0, 0)} px`], ['已完成排序', String(v.moves ?? 0)], ['自动示范', v.ghost ? '开' : '关']],
    formula: () => F('弹簧–阻尼：ẍ = ω²(x目标 − x) − 2ζω·ẋ') + F('ζ = 1 临界阻尼：最快到位且不过冲；ζ < 1 会回弹') + F('插入序号 i = round((y指针 − y列顶) / (h + 间距))'),
    explain: '<p>拖拽排序的“顺滑感”来自<b>弹簧动画</b>：每张卡片都有一个目标位置，卡片像挂在弹簧上一样被拉过去，同时受阻尼减速。</p><p>角频率 ω 决定快慢，阻尼比 ζ 决定是否回弹：ζ = 1 是<b>临界阻尼</b>，到位最快而且不冲过头，UI 动画最常用；ζ 越小回弹越明显。</p><p>拖动时根据指针位置算出插入序号，其他卡片让位；松手后卡片落到新位置。</p>',
    params: [['卡片强调色', '卡片左侧色条与高亮'], ['动画时间流速', '弹簧动画的时间倍率'], ['卡片高度', '卡片尺寸'], ['卡片数', '看板中的卡片数'], ['弹簧角频率 ω', '越大越快'], ['阻尼比 ζ', '1 = 临界阻尼'], ['自动示范拖拽', '无人操作时自动演示']],
    example: (v) => `<ol><li>ω = ${fmt(v.w ?? 0, 0)}，ζ = ${fmt(v.z ?? 0, 2)}</li><li>误差衰减约 e^(−ζωt)，4/(ζω) = ${fmt(v.ts ?? 0, 2)} s 后剩约 2%</li><li>${(v.z ?? 1) < 1 ? '欠阻尼：会回弹' : '不回弹'}</li></ol>`,
    tip: '按住任一卡片拖到别的列或位置后松开。',
  },
  build(S) {
    const cards = []; const cols = [[], [], []]; let nextId = 1, dragged = null, off = [0, 0], ins = null, ghost = null, gTimer = 2, moves = 0; const st = {};
    const L = (C) => { const W = S.W, H = S.H, gap = 12, cw = (W - gap * 4) / 3, h = 40 * num(C.size, 1), top = 44; return { gap, cw, h, top, colX: (c) => gap + c * (cw + gap), H }; };
    const slotPos = (l, c, i) => [l.colX(c) + 6, l.top + i * (l.h + 8)];
    const insertAt = (l, x, y) => { const c = clamp(Math.floor((x - l.gap / 2) / (l.cw + l.gap)), 0, 2); const len = cols[c].filter((id) => id !== dragged).length; const i = clamp(Math.round((y - l.top - l.h / 2) / (l.h + 8)), 0, len); return [c, i]; };
    const pick = (P) => { for (const cd of cards) { const l = L(S.get()); if (P.x >= cd.x && P.x <= cd.x + l.cw - 12 && P.y >= cd.y && P.y <= cd.y + l.h) return cd; } return null; };
    const drop = () => { if (dragged == null || !ins) { dragged = null; return; } for (const c of cols) { const k = c.indexOf(dragged); if (k >= 0) c.splice(k, 1); } cols[ins[0]].splice(ins[1], 0, dragged); dragged = null; ins = null; moves++; };
    S.onDown((P) => { const cd = pick(P); if (cd) { ghost = null; dragged = cd.id; off = [P.x - cd.x, P.y - cd.y]; } });
    S.onUp(() => { if (!ghost) drop(); });
    return ({ ctx, W, H, dt, t, C, P }) => {
      const l = L(C); const n = clamp(Math.round(num(C.count, 9)), 1, 30);
      while (cards.length < n) { const id = nextId++; const c = cols.reduce((a, col, i) => (col.length < cols[a].length ? i : a), 0); cols[c].push(id); const [x, y] = slotPos(l, c, cols[c].length - 1); cards.push({ id, x, y: y + 30, vx: 0, vy: 0 }); }
      while (cards.length > n) { const cd = cards.pop(); for (const c of cols) { const k = c.indexOf(cd.id); if (k >= 0) c.splice(k, 1); } if (dragged === cd.id) { dragged = null; ghost = null; } }
      // ghost demo drag
      if (on(C.ghost ?? true) && !P.down && dragged == null && !ghost) { gTimer -= dt; if (gTimer <= 0 && cards.length) { gTimer = 0.9; const cd = cards[(t * 7 | 0) % cards.length]; const tc = (cols.findIndex((c) => c.includes(cd.id)) + 1 + ((t * 3) | 0) % 2) % 3; ghost = { id: cd.id, x0: cd.x, y0: cd.y, t0: t, c: tc, i: (t * 11 | 0) % (cols[tc].length + 1) }; dragged = cd.id; } }
      const w = num(C.w, 14), z = num(C.zeta, 1);
      let dx = 0, dy = 0;
      if (ghost) { const cd = cards.find((c) => c.id === ghost.id); if (!cd) { ghost = null; dragged = null; } else { ins = [ghost.c, Math.min(ghost.i, cols[ghost.c].filter((id) => id !== dragged).length)]; const [tx, ty] = slotPos(l, ins[0], ins[1]); const u = clamp((t - ghost.t0) / 1.2, 0, 1), e = u * u * (3 - 2 * u); dx = ghost.x0 + (tx - ghost.x0) * e; dy = ghost.y0 + (ty - ghost.y0) * e - Math.sin(Math.PI * e) * 30; if (u >= 1) { ghost = null; drop(); } } }
      else if (dragged != null) { dx = P.x - off[0]; dy = P.y - off[1]; ins = insertAt(l, P.x, P.y); }
      // targets
      const tgt = new Map();
      cols.forEach((col, c) => { let i = 0; const list = col.filter((id) => id !== dragged); list.forEach((id) => { if (ins && dragged != null && ins[0] === c && ins[1] === i) i++; tgt.set(id, slotPos(l, c, i)); i++; }); });
      let dev = 0;
      substep(st, dt, 1 / 120, 8, (h) => { for (const cd of cards) { if (cd.id === dragged) continue; const tg = tgt.get(cd.id); if (!tg) continue; cd.vx += (w * w * (tg[0] - cd.x) - 2 * z * w * cd.vx) * h; cd.vy += (w * w * (tg[1] - cd.y) - 2 * z * w * cd.vy) * h; cd.x += cd.vx * h; cd.y += cd.vy * h; } });
      const dc = cards.find((c) => c.id === dragged); if (dc) { dc.x = dx; dc.y = dy; dc.vx = dc.vy = 0; }
      for (const cd of cards) { const tg = tgt.get(cd.id); if (tg && cd.id !== dragged) dev = Math.max(dev, dist(cd.x, cd.y, tg[0], tg[1])); }
      S.clear(); const rgb = hexRgb(C.color || '#22d3ee');
      ['待办', '进行中', '完成'].forEach((name, c) => { const x = l.colX(c); ctx.fillStyle = '#0f172a'; rrect(ctx, x, 10, l.cw, H - 20, 10); ctx.fill(); ctx.fillStyle = rgba(rgb, 1); ctx.fillRect(x + 10, 34, l.cw - 20, 3); ctx.fillStyle = '#cbd5e1'; ctx.font = '13px system-ui'; ctx.fillText(`${name} · ${cols[c].length}`, x + 10, 28); });
      if (dragged != null && ins) { const [sx, sy] = slotPos(l, ins[0], ins[1]); ctx.strokeStyle = rgba(rgb, 0.7); ctx.setLineDash([5, 4]); rrect(ctx, sx, sy, l.cw - 12, l.h, 8); ctx.stroke(); ctx.setLineDash([]); }
      const order = cards.slice().sort((a, b) => (a.id === dragged) - (b.id === dragged));
      ctx.font = `${Math.round(12 * Math.max(0.8, num(C.size, 1)))}px system-ui`;
      for (const cd of order) {
        const isD = cd.id === dragged; ctx.fillStyle = isD ? rgba(rgb, 1) : rgba(mix(C.color || '#22d3ee', 0.55, [30, 41, 59]), 1); rrect(ctx, cd.x, cd.y, l.cw - 12, l.h, 8); ctx.fill();
        ctx.fillStyle = rgba(rgb, 1); ctx.fillRect(cd.x, cd.y + 6, 4, l.h - 12);
        ctx.fillStyle = isD ? '#0b1020' : '#f1f5f9'; ctx.fillText(`#${cd.id} 任务卡片`, cd.x + 14, cd.y + l.h / 2 + 4);
        if (isD) { ctx.strokeStyle = rgba(rgb, 1); ctx.lineWidth = 2; rrect(ctx, cd.x, cd.y, l.cw - 12, l.h, 8); ctx.stroke(); }
      }
      if (dragged == null && cards.length) { const nx = cards[((t + gTimer) * 7 | 0) % cards.length]; ctx.strokeStyle = rgba(rgb, 0.35 + 0.35 * Math.sin(t * 6)); ctx.lineWidth = 2; rrect(ctx, nx.x - 2, nx.y - 2, l.cw - 8, l.h + 4, 9); ctx.stroke(); }
      const first = cards.find((c) => c.id === cols[0][0]) || cards[0];
      const hx = dc ? dc.x + off[0] : first ? first.x + 40 : W / 2, hy = dc ? dc.y + off[1] : first ? first.y + l.h / 2 : H / 2;
      return { n: cards.length, drag: dragged != null ? `#${dragged}${ghost ? '（示范）' : ''}` : '无', slot: ins && dragged != null ? `${ins[0] + 1}, ${ins[1] + 1}` : '—', w, z, ts: 4 / (z * w), dev, moves, ghost: on(C.ghost ?? true), hx, hy, ix: `${dragged ?? ''}:${ins ? ins.join('.') : ''}` };
    };
  },
};

/* ───────────────────────── magnetic ───────────────────────── */
FAM.magnetic = {
  spec: { color: { label: '按钮颜色', value: '#a78bfa' }, speed: SPD(), size: { label: '按钮大小', min: 0.6, max: 1.5, step: 0.05, value: 1 }, count: { label: '按钮数', min: 1, max: 8, step: 1, value: 4, buttons: true }, extras: [R('R', '磁吸半径 R', 40, 240, 5, 130), R('k', '磁吸强度 k', 0, 0.8, 0.02, 0.4), R('lag', '跟随刚度 ω', 2, 30, 1, 10)], remountKeys: [] },
  presets: { 默认: {}, 强吸: { k: 0.75 }, 大范围: { R: 220 }, 慢跟随: { lag: 3 }, 多按钮: { count: 8 } },
  doc: {
    title: '磁吸按钮 · 距离衰减 + 弹簧跟随',
    rows: (v) => [['最近按钮', String(v.near ?? '—')], ['距离 d', `${fmt(v.d ?? 0, 0)} px`, 'd'], ['吸附偏移', `${fmt(v.off ?? 0, 1)} px`], ['光标滞后', `${fmt(v.lagd ?? 0, 1)} px`], ['半径 R / 强度 k', `${fmt(v.R ?? 0, 0)} / ${fmt(v.k ?? 0, 2)}`], ['跟随 ω', fmt(v.w ?? 0, 0)], ['点击次数', String(v.clicks ?? 0)]],
    formula: () => F('d < R 时目标偏移 o* = k·(p指针 − c按钮)·(1 − (d/R)²)') + F('按钮偏移弹簧：ö = ω²(o* − o) − 2·0.8ω·ȯ') + F('跟随光标：ẍ = ω²(p − x) − 2·0.7ω·ẋ'),
    explain: '<p>“磁吸按钮”是很多网站的交互细节：指针靠近时按钮被“吸”向指针，离得越近吸得越多，超出半径 R 就回到原位。</p><p>为了让运动柔和，按钮不是直接跳到目标，而是用<b>弹簧</b>追过去，所以有一点点弹性和延迟。</p><p>圆环光标也用弹簧跟随指针，滞后距离与速度和刚度 ω 有关；它身后的拖尾是最近的轨迹。点击按钮会有一次脉冲。</p>',
    params: [['按钮颜色', '按钮主色'], ['时间流速', '0 = 暂停'], ['按钮大小', '按钮尺寸'], ['按钮数', '按钮个数'], ['磁吸半径 R', '在这个距离内开始吸附'], ['磁吸强度 k', '吸附偏移比例'], ['跟随刚度 ω', '光标与按钮弹簧的快慢']],
    example: (v) => `<ol><li>距离 d = ${fmt(v.d ?? 0, 0)} px，R = ${fmt(v.R ?? 0, 0)}</li><li>衰减因子 1 − (d/R)² = ${fmt(Math.max(0, 1 - ((v.d ?? 0) / (v.R || 1)) ** 2), 2)}</li><li>目标偏移 ≈ ${fmt(v.off ?? 0, 1)} px</li></ol>`,
    tip: '把指针慢慢移向按钮，再快速划过对比光标滞后。',
  },
  build(S) {
    let btn = [], key = '', clicks = 0; const ring = { x: 0, y: 0, vx: 0, vy: 0 }; const trail = []; const st = {};
    const layout = (W, H, n, sz) => { const rows = n > 2 && W < H * 1.2 ? Math.min(n, n > 4 ? 3 : 2) : n > 4 ? 2 : 1, per = Math.ceil(n / rows), bw = clamp((W / per) * 0.62, 84, 190) * sz, bh = clamp(bw * 0.4, 36, 72); const gx = W / per, gy = Math.min(H / rows, bh + 120); const out = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per); out.push({ cx: W / 2 + (c - (inRow - 1) / 2) * gx, cy: H / 2 + (r - (rows - 1) / 2) * gy, w: bw, h: bh, ox: 0, oy: 0, vx: 0, vy: 0, pulse: 0 }); } return out; };
    S.autoPath = (t, W, H) => { if (!btn.length) return [W / 2, H / 2]; const k = t * 0.35, i = Math.floor(k) % btn.length, j = (i + 1) % btn.length, u = k - Math.floor(k), e = u < 0.5 ? 0 : (u - 0.5) * 2, s = e * e * (3 - 2 * e); const a = btn[i], b = btn[j]; return [a.cx + (b.cx - a.cx) * s + Math.cos(t * 2) * 18, a.cy + (b.cy - a.cy) * s + Math.sin(t * 1.6) * 12]; };
    S.onDown((P) => { for (const b of btn) if (Math.abs(P.x - b.cx - b.ox) < b.w / 2 && Math.abs(P.y - b.cy - b.oy) < b.h / 2) { b.pulse = 1; clicks++; } });
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 4)), 1, 12), sz = num(C.size, 1), k2 = `${n}|${sz}|${W}|${H}`; if (k2 !== key) { key = k2; btn = layout(W, H, n, sz); ring.x = P.x; ring.y = P.y; }
      const Rr = num(C.R, 130), k = num(C.k, 0.4), w = num(C.lag, 10);
      let near = null, nd = 1e9;
      for (const b of btn) { const d = dist(P.x, P.y, b.cx, b.cy); if (d < nd) { nd = d; near = b; } }
      substep(st, dt, 1 / 120, 8, (h) => {
        for (const b of btn) { const d = dist(P.x, P.y, b.cx, b.cy); const f = d < Rr ? k * (1 - (d / Rr) ** 2) : 0; const tx = (P.x - b.cx) * f, ty = (P.y - b.cy) * f; b.vx += (w * w * (tx - b.ox) - 1.6 * w * b.vx) * h; b.vy += (w * w * (ty - b.oy) - 1.6 * w * b.vy) * h; b.ox += b.vx * h; b.oy += b.vy * h; b.pulse = Math.max(0, b.pulse - h * 2.5); }
        ring.vx += (w * w * (P.x - ring.x) - 1.4 * w * ring.vx) * h; ring.vy += (w * w * (P.y - ring.y) - 1.4 * w * ring.vy) * h; ring.x += ring.vx * h; ring.y += ring.vy * h;
      });
      if (dt > 0) { trail.push([ring.x, ring.y]); if (trail.length > 14) trail.shift(); }
      S.clear(); const rgb = hexRgb(C.color || '#a78bfa');
      for (let y = 14; y < H; y += 24) for (let x = 14; x < W; x += 24) { const d = dist(P.x, P.y, x, y), f = d < Rr ? k * (1 - (d / Rr) ** 2) : 0; ctx.fillStyle = f > 0 ? rgba(rgb, 0.25 + f) : 'rgba(148,163,184,.18)'; ctx.fillRect(x + (P.x - x) * f * 0.5 - 1.5, y + (P.y - y) * f * 0.5 - 1.5, 3, 3); }
      ctx.strokeStyle = rgba(rgb, 0.25); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(P.x, P.y, Rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (const b of btn) {
        const x = b.cx + b.ox, y = b.cy + b.oy, hot = b === near && nd < Rr;
        ctx.fillStyle = rgba(rgb, 0.12); ctx.beginPath(); ctx.arc(b.cx, b.cy, Rr * 0.25, 0, TAU); ctx.fill();
        if (b.pulse > 0) { ctx.strokeStyle = rgba(rgb, b.pulse); ctx.lineWidth = 2; rrect(ctx, x - b.w / 2 - (1 - b.pulse) * 16, y - b.h / 2 - (1 - b.pulse) * 16, b.w + (1 - b.pulse) * 32, b.h + (1 - b.pulse) * 32, 14); ctx.stroke(); }
        ctx.fillStyle = hot ? rgba(mix(C.color || '#a78bfa', 0.15), 1) : rgba(rgb, 0.85); rrect(ctx, x - b.w / 2, y - b.h / 2, b.w, b.h, b.h / 2); ctx.fill();
        ctx.fillStyle = '#0b1020'; ctx.font = `600 ${Math.round(clamp(b.h * 0.34, 12, 22))}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('磁吸按钮', x + b.ox * 0.3, y + b.h * 0.12 + b.oy * 0.3); ctx.textAlign = 'left';
      }
      for (let i = 1; i < trail.length; i++) { ctx.strokeStyle = rgba(rgb, i / trail.length * 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ring.x, ring.y, 16, 0, TAU); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, P.y, 3, 0, TAU); ctx.fill();
      return { near: near ? `#${btn.indexOf(near) + 1}` : '—', d: nd, off: near ? Math.hypot(near.ox, near.oy) : 0, lagd: dist(ring.x, ring.y, P.x, P.y), R: Rr, k, w, clicks, ix: near ? String(btn.indexOf(near)) : '' };
    };
  },
};

/* shared: grab-and-throw for circle sets */
const grabber = (S, list, pickR = 12) => {
  const g = { b: null, ox: 0, oy: 0 };
  S.onDown((P) => { let best = null, bd = 1e9; for (const b of list()) { const d = dist(P.x, P.y, b.x, b.y); if (d < b.r + pickR && d < bd) { bd = d; best = b; } } if (best) { g.b = best; g.ox = best.x - P.x; g.oy = best.y - P.y; } });
  S.onUp((P) => { if (g.b) { g.b.vx = clamp(P.vx, -1800, 1800); g.b.vy = clamp(P.vy, -1800, 1800); } g.b = null; });
  g.hold = (P, h) => { if (!g.b) return; const nx = P.x + g.ox, ny = P.y + g.oy; g.b.vx = (nx - g.b.x) / h; g.b.vy = (ny - g.b.y) / h; g.b.x = nx; g.b.y = ny; };
  return g;
};
/** equal-density circle collision with restitution e */
const collide = (a, b, e) => {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r; if (d >= m || d < 1e-6) return false;
  const nx = dx / d, ny = dy / d, ma = a.r * a.r, mb = b.r * b.r, pen = m - d;
  a.x -= nx * pen * (mb / (ma + mb)); a.y -= ny * pen * (mb / (ma + mb)); b.x += nx * pen * (ma / (ma + mb)); b.y += ny * pen * (ma / (ma + mb));
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv > 0) return true;
  const j = (-(1 + e) * rv) / (1 / ma + 1 / mb); a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny; b.vx += (j / mb) * nx; b.vy += (j / mb) * ny; return true;
};

/* ───────────────────────── wall-ball ───────────────────────── */
FAM['wall-ball'] = {
  spec: { color: { label: '小球颜色', value: '#f472b6' }, speed: SPD(), size: { label: '球半径', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '球数', min: 1, max: 60, step: 1, value: 14, buttons: true }, extras: [R('e', '恢复系数 e', 0.3, 1, 0.01, 0.85), R('g', '重力 g', 0, 2000, 50, 900)], remountKeys: [] },
  presets: { 少球: { count: 4 }, 多球: { count: 40 }, 大: { size: 1.8 }, 小: { size: 0.6 }, 高弹: { e: 0.98 }, 低弹: { e: 0.4 } },
  doc: {
    title: '弹球墙 · 重力 + 恢复系数',
    rows: (v) => [['球数', String(v.n ?? 0)], ['总能量 E = K + U', fmt(v.E ?? 0, 0), 'E'], ['动能 K', fmt(v.K ?? 0, 0)], ['每次反弹保留能量 e²', `${fmt((v.e ?? 0) ** 2 * 100, 0)} %`], ['最快球速', `${fmt(v.vmax ?? 0, 0)} px/s`], ['反弹 / 秒', String(v.bps ?? 0)], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`]],
    formula: () => F('自由下落：v ← v + g·Δt，y ← y + v·Δt') + F('撞墙：v⊥ ← −e·v⊥（e = 恢复系数）') + F('反弹高度 h₂ = e²·h₁；能量 E = ½mv² + mg(H − y)'),
    explain: '<p>小球受重力加速下落，撞到墙或地面时，垂直于墙面的速度反向并乘以<b>恢复系数 e</b>。e = 1 是完全弹性，球会一直跳；e &lt; 1 每次都损失 1 − e² 的能量，越跳越低。</p><p>球与球之间按动量守恒碰撞（质量 ∝ 半径²）。指针是一块会动的“挡板”，会把能量重新打进系统，所以不会完全停下。</p><p>按住小球可以拖动并甩出去，松手时的速度就是你的手速。</p>',
    params: [['小球颜色', '小球颜色'], ['时间流速', '0 = 暂停'], ['球半径', '统一缩放'], ['球数', '小球数量'], ['恢复系数 e', '反弹后保留的速度比例'], ['重力 g', '向下加速度']],
    example: (v) => `<ol><li>从 100px 落下，第一次反弹高 e²×100 = ${fmt((v.e ?? 0) ** 2 * 100, 0)} px</li><li>第二次 ${fmt((v.e ?? 0) ** 4 * 100, 0)} px，第三次 ${fmt((v.e ?? 0) ** 6 * 100, 0)} px</li><li>落地速度 v = √(2gh) = ${fmt(Math.sqrt(2 * (v.g ?? 0) * 100), 0)} px/s</li></ol>`,
    tip: '抓起小球往上甩；把 e 调到 1 看永不停止的弹跳。',
  },
  build(S) {
    const R0 = rng(201); const balls = []; const st = {}; let hits = 0, bps = 0, ht = 0;
    const g0 = grabber(S, () => balls);
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 14)), 1, 120), sz = num(C.size, 1), e = num(C.e, 0.85), g = num(C.g, 900);
      while (balls.length < n) balls.push({ x: 30 + R0() * (W - 60), y: 30 + R0() * H * 0.4, vx: (R0() - 0.5) * 300, vy: 0, r0: 10 + R0() * 10, r: 0, h: R0() * 50 - 25 });
      if (balls.length > n) balls.length = n;
      for (const b of balls) b.r = b.r0 * sz;
      substep(st, dt, 1 / 240, 16, (h) => {
        for (const b of balls) {
          if (b === g0.b) { g0.hold(P, h); continue; }
          b.vy += g * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * e; hits++; } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * e; hits++; }
          if (b.y > H - b.r) { b.y = H - b.r; if (b.vy > 0) { b.vy = -b.vy * e; if (Math.abs(b.vy) > 30) hits++; } b.vx *= 0.999; } else if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * e; }
          if (!g0.b) hitPointer(b, P, 26, 1); capV(b, 2500);
        }
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) collide(balls[i], balls[j], e);
      });
      ht += dt; if (ht > 1) { bps = hits; hits = 0; ht = 0; }
      S.clear(); const base = hueOf(C.color || '#f472b6'); let K = 0, U = 0, vmax = 0;
      for (const b of balls) { const m = (b.r * b.r) / 100, v2 = b.vx * b.vx + b.vy * b.vy; K += 0.5 * m * v2 / 1000; U += (m * g * (H - b.r - b.y)) / 1000; vmax = Math.max(vmax, Math.sqrt(v2)); ctx.fillStyle = hsla(base + b.h, 80, b === g0.b ? 72 : 60); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, TAU); ctx.fill(); }
      if (!g0.b) pointerRing(ctx, P, 26);
      const hb = balls[0];
      return { n, E: K + U, K, e, vmax, bps, g, hx: g0.b ? P.x : hb.x, hy: g0.b ? P.y : hb.y, ix: g0.b ? 'g' : '' };
    };
  },
};

/* ───────────────────────── multigrav ───────────────────────── */
FAM.multigrav = {
  spec: { color: { label: '粒子颜色', value: '#22d3ee' }, speed: SPD(), size: { label: '粒子大小', min: 0.5, max: 3, step: 0.1, value: 1.2 }, count: { label: '引力井数', min: 1, max: 5, step: 1, value: 3, buttons: true }, extras: [R('G', '引力强度 G（负 = 斥力）', -2, 2, 0.05, 1), R('soft', '软化长度 ε', 5, 60, 1, 22), R('gx', '全局重力 x', -1, 1, 0.05, 0), R('gy', '全局重力 y', -1, 1, 0.05, 0)], remountKeys: [] },
  presets: { 无重力: { G: 0.3 }, 反重力: { G: -1 }, 低g: { gy: 0.3 }, 高g: { gy: 1 }, 侧向: { gx: 0.8 }, 混沌: { count: 5, G: 1.8 } },
  doc: {
    title: '多重力场 · 软化平方反比',
    rows: (v) => [['引力井', `${v.k ?? 0} + 指针`], ['粒子数', String(v.n ?? 0)], ['平均速度', `${fmt(v.vm ?? 0, 0)} px/s`], ['指针处加速度 |a|', `${fmt(v.ap ?? 0, 0)} px/s²`, 'ap'], ['重生 / 秒', String(v.rs ?? 0)], ['G / ε', `${fmt(v.G ?? 0, 2)} / ${fmt(v.eps ?? 0, 0)}`], ['全局重力', `(${fmt(v.gx ?? 0, 2)}, ${fmt(v.gy ?? 0, 2)})`]],
    formula: () => F('a = Σᵢ G·Mᵢ·(cᵢ − p) / (|cᵢ − p|² + ε²)^(3/2) + g全局') + F('ε 软化：避免距离→0 时加速度无穷大') + F('半隐式欧拉：v ← v + a·Δt，p ← p + v·Δt'),
    explain: '<p>每个引力井像一颗看不见的星球，按<b>平方反比</b>吸引周围的粒子：距离翻倍，引力变成 1/4。几个井同时作用，粒子会画出复杂的轨迹，甚至在井之间被“抛来抛去”。</p><p>真实公式在距离接近 0 时会无穷大，数值上会把粒子弹飞，所以加了<b>软化长度 ε</b>。</p><p>指针也是一个引力井；G 调成负数就变成斥力。逃出画面太远或撞进井心的粒子会在边缘重生。</p>',
    params: [['粒子颜色', '粒子颜色（越快越亮）'], ['时间流速', '0 = 暂停'], ['粒子大小', '粒子半径'], ['引力井数', '固定井的数量（另加指针）'], ['引力强度 G（负 = 斥力）', '所有井的强度'], ['软化长度 ε', '越大井心越“软”'], ['全局重力 x', '整体水平加速度'], ['全局重力 y', '整体竖直加速度']],
    example: (v) => `<ol><li>距离 r = 100 时 |a| ∝ G/(r² + ε²)</li><li>r = 200 时约为 1/4</li><li>指针处合加速度 ${fmt(v.ap ?? 0, 0)} px/s²</li></ol>`,
    tip: '把指针放在粒子流中间吸引它们；把 G 调负看斥力。',
  },
  build(S) {
    const R0 = rng(211); const ps = []; const st = {}; let rsN = 0, rs = 0, rt = 0;
    const respawn = (p, W, H) => { const s = R0() * 4 | 0; p.x = s === 0 ? 0 : s === 1 ? W : R0() * W; p.y = s === 2 ? 0 : s === 3 ? H : R0() * H; p.vx = (R0() - 0.5) * 60; p.vy = (R0() - 0.5) * 60; };
    return ({ ctx, W, H, dt, t, C, P }) => {
      const k = clamp(Math.round(num(C.count, 3)), 1, 8), G = num(C.G, 1) * 9e5, eps = num(C.soft, 22), gx = num(C.gx, 0) * 400, gy = num(C.gy, 0) * 400;
      while (ps.length < 500) { const p = {}; p.x = R0() * W; p.y = R0() * H; p.vx = (R0() - 0.5) * 80; p.vy = (R0() - 0.5) * 80; ps.push(p); }
      const wells = []; for (let i = 0; i < k; i++) wells.push([W / 2 + Math.cos(t * 0.25 + (i * TAU) / k) * W * 0.28, H / 2 + Math.sin(t * 0.25 + (i * TAU) / k) * H * 0.28, 1]);
      wells.push([P.x, P.y, 1.2]);
      const acc = (x, y) => { let ax = gx, ay = gy; for (const [cx, cy, m] of wells) { const dx = cx - x, dy = cy - y, r2 = dx * dx + dy * dy + eps * eps, f = (G * m) / (r2 * Math.sqrt(r2)); ax += dx * f; ay += dy * f; } return [ax, ay]; };
      substep(st, dt, 1 / 120, 6, (h) => { for (const p of ps) { const [ax, ay] = acc(p.x, p.y); p.vx += ax * h; p.vy += ay * h; capV(p, 900); p.x += p.vx * h; p.y += p.vy * h; if (p.x < -W * 0.3 || p.x > W * 1.3 || p.y < -H * 0.3 || p.y > H * 1.3) { respawn(p, W, H); rsN++; } } });
      rt += dt; if (rt > 1) { rs = rsN; rsN = 0; rt = 0; }
      S.clear(); const rgb = hexRgb(C.color || '#22d3ee'); const sz = num(C.size, 1.2); let vs = 0;
      for (const [cx, cy, m] of wells) { const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40); gr.addColorStop(0, G >= 0 ? 'rgba(251,191,36,.6)' : 'rgba(248,113,113,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, TAU); ctx.fill(); }
      for (const p of ps) { const s = Math.hypot(p.vx, p.vy); vs += s; const b = clamp(s / 400, 0, 1); ctx.strokeStyle = rgba(mix(C.color || '#22d3ee', b * 0.6), 0.5 + 0.5 * b); ctx.lineWidth = sz; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); }
      ctx.fillStyle = rgba(rgb, 0.9); for (let i = 0; i < ps.length; i += 2) ctx.fillRect(ps[i].x - sz / 2, ps[i].y - sz / 2, sz, sz);
      const [ax, ay] = acc(P.x + eps, P.y);
      return { k, n: ps.length, vm: vs / ps.length, ap: Math.hypot(ax, ay), rs, G: G / 9e5, eps, gx: gx / 400, gy: gy / 400, ix: fmt(Math.hypot(ax, ay), 0) };
    };
  },
};

/* ───────────────────────── spring ───────────────────────── */
FAM.spring = {
  spec: { color: { label: '弹簧颜色', value: '#34d399' }, speed: SPD(), size: { label: '自然长度', min: 0.5, max: 1.5, step: 0.05, value: 1 }, count: { label: '质点数', min: 3, max: 20, step: 1, value: 8, buttons: true }, extras: [R('k', '劲度系数 k', 5, 200, 1, 60), R('c', '阻尼 c', 0, 2, 0.05, 0.3), R('g', '重力 g', 0, 1500, 50, 600)], remountKeys: [] },
  presets: { 软簧: { k: 15 }, 硬簧: { k: 180 }, 少点: { count: 4 }, 多点: { count: 18 }, 鼠标拉: { c: 0.1 }, 静: { c: 1.8 } },
  doc: {
    title: '弹簧链 · 胡克定律',
    rows: (v) => [['质点数', String(v.n ?? 0)], ['劲度 k / 阻尼 c', `${fmt(v.k ?? 0, 0)} / ${fmt(v.c ?? 0, 2)}`], ['单簧固有频率 ω₀ = √(k/m)', `${fmt(v.w0 ?? 0, 2)} rad/s`], ['周期 T = 2π/ω₀', `${fmt(v.T ?? 0, 2)} s`], ['总伸长', `${fmt(v.ext ?? 0, 0)} px`, 'ext'], ['弹性势能（相对）', fmt(v.Ue ?? 0, 1)], ['总能量（相对）', fmt(v.E ?? 0, 1)]],
    formula: () => F('胡克定律：F = −k·(|Δx| − L₀)·x̂') + F('阻尼：F_d = −c·(v₁ − v₂)·x̂') + F('ω₀ = √(k/m)，T = 2π√(m/k)（m = 1）'),
    explain: '<p>一串质点用弹簧连起来，顶端挂在一个锚点上。每根弹簧遵守<b>胡克定律</b>：拉得越长，拉力越大，方向指回原长。</p><p>重力把链子往下拉，弹簧把它拉回去，于是上下振荡；阻尼让振荡逐渐减弱。劲度 k 越大振得越快，周期 T = 2π√(m/k)。</p><p>锚点会跟着指针左右移动，带动整条链摆动；按住任意质点可以拉扯它。</p>',
    params: [['弹簧颜色', '弹簧线颜色'], ['时间流速', '0 = 暂停'], ['自然长度', '每节弹簧原长'], ['质点数', '链上质点个数'], ['劲度系数 k', '弹簧硬度'], ['阻尼 c', '能量损耗'], ['重力 g', '向下加速度']],
    example: (v) => `<ol><li>k = ${fmt(v.k ?? 0, 0)}，m = 1 → ω₀ = ${fmt(v.w0 ?? 0, 2)} rad/s</li><li>周期 T = ${fmt(v.T ?? 0, 2)} s</li><li>k 变为 4 倍，周期减半</li></ol>`,
    tip: '按住链上的球往下拉再松开。',
  },
  build(S) {
    let pts = [], key = '', grab = -1; const st = {};
    S.onDown((P) => { let b = -1, bd = 40; pts.forEach((p, i) => { if (i === 0) return; const d = dist(p.x, p.y, P.x, P.y); if (d < bd) { bd = d; b = i; } }); grab = b; });
    S.onUp(() => { grab = -1; });
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 8)), 2, 40), L0 = (H * 0.6 * num(C.size, 1)) / n, k = num(C.k, 60), c = num(C.c, 0.3), g = num(C.g, 600), kk = `${n}|${W}|${H}`;
      if (kk !== key) { key = kk; pts = []; for (let i = 0; i < n; i++) pts.push({ x: W / 2, y: 24 + i * L0, vx: 0, vy: 0 }); }
      const ks = k * 40, cs = c * 6;
      substep(st, dt, 1 / 480, 40, (h) => {
        const a = pts[0]; a.x += (P.x - a.x) * Math.min(1, h * 4); a.y = 24; a.vx = a.vy = 0;
        const fx = new Float32Array(n), fy = new Float32Array(n);
        for (let i = 1; i < n; i++) fy[i] += g;
        for (let i = 0; i < n - 1; i++) { const A = pts[i], B = pts[i + 1]; const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d; const f = ks * (d - L0) + cs * ((B.vx - A.vx) * ux + (B.vy - A.vy) * uy); fx[i] += f * ux; fy[i] += f * uy; fx[i + 1] -= f * ux; fy[i + 1] -= f * uy; }
        for (let i = 1; i < n; i++) { const p = pts[i]; if (i === grab) { p.vx = (P.x - p.x) / h; p.vy = (P.y - p.y) / h; p.x = P.x; p.y = P.y; continue; } p.vx += fx[i] * h; p.vy += fy[i] * h; p.vx *= 1 - 0.2 * h; p.vy *= 1 - 0.2 * h; capV(p, 4000); p.x += p.vx * h; p.y += p.vy * h; }
      });
      S.clear(); const rgb = hexRgb(C.color || '#34d399'); let ext = 0, Ue = 0, K = 0, Ug = 0;
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 18, W, 3);
      for (let i = 0; i < n - 1; i++) {
        const A = pts[i], B = pts[i + 1]; const d = dist(A.x, A.y, B.x, B.y); ext += d - L0; Ue += 0.5 * ks * (d - L0) ** 2 / 1e4;
        const coils = 8, ux = (B.x - A.x) / d, uy = (B.y - A.y) / d, amp = clamp(9 - (d - L0) * 0.1, 2, 12);
        ctx.strokeStyle = rgba(rgb, 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A.x, A.y);
        for (let s = 1; s < coils * 2; s++) { const u = s / (coils * 2), o = (s % 2 ? 1 : -1) * amp; ctx.lineTo(A.x + ux * d * u - uy * o, A.y + uy * d * u + ux * o); }
        ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      for (let i = 0; i < n; i++) { const p = pts[i]; K += 0.5 * (p.vx * p.vx + p.vy * p.vy) / 1e4; Ug += (g * (H - p.y)) / 1e4; ctx.fillStyle = i === 0 ? '#e2e8f0' : i === grab ? '#fff' : rgba(mix(C.color || '#34d399', 0.4), 1); ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 5 : 8, 0, TAU); ctx.fill(); }
      const w0 = Math.sqrt(k); const last = pts[n - 1];
      return { n, k, c, w0, T: TAU / w0, ext, Ue, E: Ue + K + Ug, hx: grab >= 0 ? P.x : last.x, hy: grab >= 0 ? P.y : last.y, ix: grab >= 0 ? `g${grab}` : '' };
    };
  },
};

/* ───────────────────────── box-collide ───────────────────────── */
FAM['box-collide'] = {
  spec: { color: { label: '盒子颜色', value: '#fbbf24' }, speed: SPD(), size: { label: '盒子大小', min: 0.5, max: 1.8, step: 0.05, value: 1 }, count: { label: '盒子数', min: 3, max: 40, step: 1, value: 14, buttons: true }, extras: [R('e', '恢复系数 e', 0, 1, 0.05, 0.4), R('g', '重力 g', 0, 2000, 50, 900), R('mu', '摩擦 μ', 0, 1, 0.05, 0.3)], remountKeys: [] },
  presets: { 少: { count: 5 }, 多: { count: 36 }, 大: { size: 1.6 }, 小: { size: 0.6 }, 高弹: { e: 0.9 }, 粘滞: { mu: 0.95, e: 0 } },
  doc: {
    title: '碰撞盒 · AABB 检测与冲量',
    rows: (v) => [['盒子数', String(v.n ?? 0)], ['总动量 |Σmv|', fmt(v.p ?? 0, 1), 'p'], ['总动能（相对）', fmt(v.K ?? 0, 1)], ['接触对', String(v.pairs ?? 0)], ['恢复 e / 摩擦 μ', `${fmt(v.e ?? 0, 2)} / ${fmt(v.mu ?? 0, 2)}`], ['平均穿透', `${fmt(v.pen ?? 0, 2)} px`], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`]],
    formula: () => F('AABB 相交：|x₁ − x₂| < (w₁ + w₂)/2 且 |y₁ − y₂| < (h₁ + h₂)/2') + F('沿最小穿透轴分离；冲量 j = −(1 + e)·v_rel / (1/m₁ + 1/m₂)') + F('切向摩擦冲量 |j_t| ≤ μ·j，m ∝ w·h'),
    explain: '<p><b>AABB</b>（轴对齐包围盒）是最简单的碰撞检测：两个不旋转的矩形，只要在 x 和 y 两个方向上都重叠，就是相撞。</p><p>相撞后沿<b>穿透最浅</b>的方向把它们推开，并在这个方向上施加冲量，让相对速度按恢复系数 e 反弹；切向用摩擦减速，所以盒子能叠起来。</p><p>大盒子质量大、更难推动。指针是一个推杆，按住盒子可以拖动和抛出。</p>',
    params: [['盒子颜色', '盒子颜色'], ['时间流速', '0 = 暂停'], ['盒子大小', '统一缩放'], ['盒子数', '盒子数量'], ['恢复系数 e', '0 = 完全非弹性'], ['重力 g', '向下加速度'], ['摩擦 μ', '接触面摩擦']],
    example: (v) => `<ol><li>两盒正碰，碰后相对速度 = e × 碰前 = ${fmt(v.e ?? 0, 2)}×</li><li>总动量 |Σmv| = ${fmt(v.p ?? 0, 1)}（无外力时守恒）</li><li>当前 ${v.pairs} 对接触</li></ol>`,
    tip: '按住盒子拖到高处松开，看它砸向盒堆。',
  },
  build(S) {
    const R0 = rng(221); const bx = []; const st = {}; let grab = null, gox = 0, goy = 0;
    S.onDown((P) => { for (const b of bx) if (Math.abs(P.x - b.x) < b.w / 2 + 4 && Math.abs(P.y - b.y) < b.h / 2 + 4) { grab = b; gox = b.x - P.x; goy = b.y - P.y; break; } });
    S.onUp((P) => { if (grab) { grab.vx = clamp(P.vx, -1500, 1500); grab.vy = clamp(P.vy, -1500, 1500); } grab = null; });
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 14)), 1, 80), sz = num(C.size, 1), e = num(C.e, 0.4), g = num(C.g, 900), mu = num(C.mu, 0.3);
      while (bx.length < n) bx.push({ x: 40 + R0() * (W - 80), y: -R0() * H * 0.5, vx: 0, vy: 0, w0: 22 + R0() * 30, h0: 22 + R0() * 26, w: 0, h: 0, hue: R0() * 50 - 25 });
      if (bx.length > n) bx.length = n;
      for (const b of bx) { b.w = b.w0 * sz; b.h = b.h0 * sz; b.m = (b.w * b.h) / 900; }
      let pairs = 0, pen = 0;
      substep(st, dt, 1 / 180, 9, (h) => {
        for (const b of bx) {
          if (b === grab) { const nx = P.x + gox, ny = P.y + goy; b.vx = (nx - b.x) / h; b.vy = (ny - b.y) / h; b.x = nx; b.y = ny; continue; }
          b.vy += g * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.y > H - b.h / 2) { b.y = H - b.h / 2; if (b.vy > 0) b.vy = -b.vy * e; b.vx *= 1 - mu * 0.08; }
          if (b.x < b.w / 2) { b.x = b.w / 2; b.vx = Math.abs(b.vx) * e; } else if (b.x > W - b.w / 2) { b.x = W - b.w / 2; b.vx = -Math.abs(b.vx) * e; }
          if (!grab) { const dx = b.x - P.x, dy = b.y - P.y, ox = b.w / 2 + 18 - Math.abs(dx), oy = b.h / 2 + 18 - Math.abs(dy); if (ox > 0 && oy > 0) { if (ox < oy) { b.x += Math.sign(dx || 1) * ox; b.vx = clamp(P.vx, -900, 900) * 0.8 + Math.sign(dx || 1) * 40; } else { b.y += Math.sign(dy || 1) * oy; b.vy = clamp(P.vy, -900, 900) * 0.8 + Math.sign(dy || 1) * 40; } } }
          capV(b, 2000);
        }
        pairs = 0; pen = 0;
        for (let it = 0; it < 2; it++) for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) {
          const a = bx[i], b = bx[j]; const dx = b.x - a.x, dy = b.y - a.y, ox = (a.w + b.w) / 2 - Math.abs(dx), oy = (a.h + b.h) / 2 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue; if (it === 0) { pairs++; pen += Math.min(ox, oy); }
          const ia = a === grab ? 0 : 1 / a.m, ib = b === grab ? 0 : 1 / b.m; if (ia + ib === 0) continue;
          let nx = 0, ny = 0, p; if (ox < oy) { nx = Math.sign(dx || 1); p = ox; } else { ny = Math.sign(dy || 1); p = oy; }
          const corr = Math.max(0, p - 0.3) * 0.8 / (ia + ib); a.x -= nx * corr * ia; a.y -= ny * corr * ia; b.x += nx * corr * ib; b.y += ny * corr * ib;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv > 0) continue;
          const j0 = (-(1 + (Math.abs(rv) < 40 ? 0 : e)) * rv) / (ia + ib); a.vx -= j0 * ia * nx; a.vy -= j0 * ia * ny; b.vx += j0 * ib * nx; b.vy += j0 * ib * ny;
          const tx = -ny, ty = nx, vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty; const jt = clamp(-vt / (ia + ib), -mu * j0, mu * j0); a.vx -= jt * ia * tx; a.vy -= jt * ia * ty; b.vx += jt * ib * tx; b.vy += jt * ib * ty;
        }
      });
      S.clear(); const base = hueOf(C.color || '#fbbf24'); let px = 0, py = 0, K = 0;
      for (const b of bx) { px += b.m * b.vx; py += b.m * b.vy; K += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) / 1e4; ctx.fillStyle = hsla(base + b.hue, 80, b === grab ? 70 : 56); rrect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 4); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke(); }
      if (!grab) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(P.x - 18, P.y - 18, 36, 36); }
      const hb = bx[0];
      return { n, p: Math.hypot(px, py) / 100, K, pairs, e, mu, pen: pairs ? pen / pairs : 0, g, hx: grab ? P.x : hb.x, hy: grab ? P.y : hb.y, ix: grab ? 'g' : '' };
    };
  },
};

/* ───────────────────────── bubbles ───────────────────────── */
FAM.bubbles = {
  spec: { color: { label: '气泡颜色', value: '#38bdf8' }, speed: SPD(), size: { label: '气泡大小', min: 0.5, max: 2, step: 0.05, value: 1 }, count: { label: '气泡数', min: 5, max: 80, step: 1, value: 30, buttons: true }, extras: [R('mu', '液体粘度 μ', 0.3, 3, 0.05, 1), R('wob', '左右摆动', 0, 2, 0.05, 1)], remountKeys: [] },
  presets: { 少: { count: 10 }, 多: { count: 70 }, 大: { size: 1.8 }, 小: { size: 0.6 }, 慢升: { mu: 2.6 }, 快升: { mu: 0.4 } },
  doc: {
    title: '上浮气泡 · 斯托克斯定律',
    rows: (v) => [['气泡数', String(v.n ?? 0)], ['半径范围', `${fmt(v.rmin ?? 0, 0)} ~ ${fmt(v.rmax ?? 0, 0)} px`], ['大泡终速', `${fmt(v.vbig ?? 0, 0)} px/s`], ['小泡终速', `${fmt(v.vsmall ?? 0, 0)} px/s`], ['速度比 (r大/r小)²', fmt(v.ratio ?? 0, 1), 'ratio'], ['粘度 μ', fmt(v.mu ?? 0, 2)], ['已戳破', String(v.pop ?? 0)], ['摆动幅度', `${fmt((v.wob ?? 0) * 30, 0)} px/s`]],
    formula: () => F('斯托克斯终端速度：v_t = 2(ρ液 − ρ气)·g·r² / (9μ)') + F('趋近终速：v ← v + (v_t − v)·(1 − e^(−Δt/τ))') + F('⇒ 半径翻倍，上升速度变 4 倍'),
    explain: '<p>小气泡在液体里受<b>浮力</b>向上，同时受与速度成正比的<b>粘滞阻力</b>。两者平衡时达到终端速度，由斯托克斯定律给出：v ∝ r²/μ。</p><p>所以大气泡升得比小气泡快得多（半径 2 倍 → 速度 4 倍），粘度越大（像蜂蜜）上升越慢。</p><p>气泡升到顶部会破裂并从底部重新生成；指针会把气泡推开，点击可以戳破。</p>',
    params: [['气泡颜色', '气泡颜色'], ['时间流速', '0 = 暂停'], ['气泡大小', '半径整体缩放'], ['气泡数', '同时存在的气泡'], ['液体粘度 μ', '越大上升越慢'], ['左右摆动', '上升时的横向摆动']],
    example: (v) => `<ol><li>大泡 r = ${fmt(v.rmax ?? 0, 0)}px → ${fmt(v.vbig ?? 0, 0)} px/s</li><li>小泡 r = ${fmt(v.rmin ?? 0, 0)}px → ${fmt(v.vsmall ?? 0, 0)} px/s</li><li>速度比 = (${fmt(v.rmax ?? 0, 0)}/${fmt(v.rmin ?? 1, 0)})² = ${fmt(v.ratio ?? 0, 1)}</li></ol>`,
    tip: '点击气泡戳破；调粘度对比上升速度。',
  },
  build(S) {
    const R0 = rng(231); const bs = []; const st = {}; let pop = 0; const pops = [];
    const reset = (b, W, H, any) => { b.r0 = 4 + R0() ** 1.5 * 18; b.x = 20 + R0() * (W - 40); b.y = any ? R0() * H : H + b.r0 + R0() * 40; b.vy = 0; b.vx = 0; b.ph = R0() * TAU; };
    S.onDown((P) => { for (const b of bs) if (dist(P.x, P.y, b.x, b.y) < b.r + 6) { pops.push({ x: b.x, y: b.y, r: b.r, a: 1 }); pop++; reset(b, S.W, S.H, false); } });
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 30)), 1, 150), sz = num(C.size, 1), mu = num(C.mu, 1), wob = num(C.wob, 1);
      while (bs.length < n) { const b = {}; reset(b, W, H, true); bs.push(b); }
      if (bs.length > n) bs.length = n;
      const K = 0.9 / mu; let rmin = 1e9, rmax = 0;
      for (const b of bs) { b.r = b.r0 * sz; rmin = Math.min(rmin, b.r); rmax = Math.max(rmax, b.r); }
      substep(st, dt, 1 / 120, 6, (h) => {
        for (const b of bs) { const vt = -K * b.r * b.r; b.vy += (vt - b.vy) * (1 - Math.exp(-h * 4)); b.vx += (Math.sin(t * 2 + b.ph) * 30 * wob - b.vx) * (1 - Math.exp(-h * 3)); hitPointer(b, P, 22, 0.2); b.x += b.vx * h; b.y += b.vy * h; b.x = clamp(b.x, b.r, W - b.r); if (b.y < -b.r) { pops.push({ x: b.x, y: 4, r: b.r, a: 1 }); reset(b, W, H, false); } }
      });
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].a -= dt * 3; if (pops[i].a <= 0) pops.splice(i, 1); }
      S.clear(); const rgb = hexRgb(C.color || '#38bdf8');
      const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, rgba(rgb, 0.08)); gr.addColorStop(1, rgba(rgb, 0.25)); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      for (const b of bs) { ctx.fillStyle = rgba(rgb, 0.25); ctx.strokeStyle = rgba(mix(C.color || '#38bdf8', 0.5), 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(1, b.r * 0.22), 0, TAU); ctx.fill(); }
      for (const p of pops) { ctx.strokeStyle = rgba(rgb, p.a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2 - p.a), 0, TAU); ctx.stroke(); }
      pointerRing(ctx, P, 22);
      return { n, rmin, rmax, vbig: K * rmax * rmax, vsmall: K * rmin * rmin, hx: bs[0].x, hy: bs[0].y, ratio: (rmax / rmin) ** 2, mu, pop, wob, ix: String(pop) };
    };
  },
};

/* ───────────────────────── pendulum ───────────────────────── */
FAM.pendulum = {
  spec: { color: { label: '摆锤颜色', value: '#f97316' }, speed: SPD(), size: { label: '摆锤质量 m', min: 0.5, max: 3, step: 0.1, value: 1 }, count: false, extras: [R('L', '摆长 L', 0.3, 1, 0.05, 0.75), R('c', '空气阻尼 c', 0, 1, 0.02, 0.1), R('g', '重力 g', 2, 20, 0.5, 9.8), R('drive', '驱动力 A', 0, 3, 0.1, 0.6), T('trail', '轨迹', true)], remountKeys: [] },
  presets: { 长臂: { L: 1 }, 短臂: { L: 0.35 }, 重锤: { size: 2.8 }, 轻锤: { size: 0.5 }, 阻尼大: { c: 0.8, drive: 0 }, 阻尼小: { c: 0.02 } },
  doc: {
    title: '单摆 · 非线性摆 + 受迫振动',
    rows: (v) => [['摆角 θ', `${fmt(v.th ?? 0, 1)}°`, 'th'], ['角速度 ω', `${fmt(v.om ?? 0, 2)} rad/s`], ['小角周期 T = 2π√(L/g)', `${fmt(v.T ?? 0, 2)} s`], ['摆长 L / 质量 m', `${fmt(v.L ?? 0, 2)} m / ${fmt(v.m ?? 0, 1)} kg`], ['机械能 E', `${fmt(v.E ?? 0, 2)} J`], ['阻尼 c / 驱动 A', `${fmt(v.c ?? 0, 2)} / ${fmt(v.A ?? 0, 1)}`], ['重力 g', `${fmt(v.g ?? 0, 1)} m/s²`]],
    formula: () => F("θ'' = −(g/L)·sin θ − (c/m)·θ' + A·cos(Ω t)，Ω = √(g/L)") + F('小角近似：T = 2π√(L/g)（与质量无关）') + F('E = ½·m·L²·ω² + m·g·L·(1 − cos θ)'),
    explain: '<p>单摆是最经典的振动系统。重力沿切线方向的分量 −mg·sin θ 把摆锤拉回最低点，所以它来回摆动。摆角很小时，<b>周期只取决于摆长和重力</b>，和质量、振幅都无关——这是伽利略发现的。</p><p>空气阻尼让能量慢慢损失；驱动力以固有频率周期性推动它（<b>共振</b>），补充能量，所以不会停。阻尼项是 c/m，质量越大越不怕阻尼。</p><p>数值上用 <b>RK4</b>（四阶龙格–库塔）积分，能量在长时间里也很稳定。按住摆锤可以拖到任意角度松手。</p>',
    params: [['摆锤颜色', '摆锤与轨迹颜色'], ['时间流速', '0 = 暂停'], ['摆锤质量 m', '影响阻尼衰减与能量，不影响周期'], ['摆长 L', '越长周期越长'], ['空气阻尼 c', '能量损耗'], ['重力 g', '地球 9.8，月球 1.6'], ['驱动力 A', '共振驱动的强度'], ['轨迹', '显示摆锤轨迹']],
    example: (v) => `<ol><li>L = ${fmt(v.L ?? 0, 2)} m，g = ${fmt(v.g ?? 0, 1)}</li><li>T = 2π√(${fmt(v.L ?? 0, 2)}/${fmt(v.g ?? 0, 1)}) = ${fmt(v.T ?? 0, 2)} s</li><li>摆长变为 4 倍，周期变为 2 倍</li></ol>`,
    tip: '按住摆锤拉到一侧松开；把驱动力设为 0 看阻尼衰减。',
  },
  build(S) {
    const s = { th: 0.9, om: 0 }; let grab = false; const trail = []; const st = {};
    const geo = (W, H, L) => { const px = W / 2, py = H * 0.1, Lp = Math.min(H * 0.82, W * 0.45) * L / 1; return { px, py, Lp }; };
    S.onDown((P) => { const C = S.get(); const { px, py, Lp } = geo(S.W, S.H, num(C.L, 0.75)); const bx = px + Math.sin(s.th) * Lp, by = py + Math.cos(s.th) * Lp; if (dist(P.x, P.y, bx, by) < 40) grab = true; });
    S.onUp(() => { grab = false; });
    return ({ ctx, W, H, dt, t, C, P }) => {
      const L = num(C.L, 0.75), c = num(C.c, 0.1), g = num(C.g, 9.8), A = num(C.drive, 0.6), m = num(C.size, 1); const { px, py, Lp } = geo(W, H, L); const Om = Math.sqrt(g / L);
      const f = (th, om, tt) => -(g / L) * Math.sin(th) - (c / m) * om + A * Math.cos(Om * tt);
      if (grab) { const nth = Math.atan2(P.x - px, P.y - py); if (dt > 0) s.om = clamp((nth - s.th) / Math.max(dt, 1e-3), -20, 20) * 0.5; s.th = nth; }
      else substep(st, dt, 1 / 240, 16, (h) => {
        const tt = t; const k1t = s.om, k1o = f(s.th, s.om, tt); const k2t = s.om + k1o * h / 2, k2o = f(s.th + k1t * h / 2, k2t, tt + h / 2); const k3t = s.om + k2o * h / 2, k3o = f(s.th + k2t * h / 2, k3t, tt + h / 2); const k4t = s.om + k3o * h, k4o = f(s.th + k3t * h, k4t, tt + h);
        s.th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t); s.om += (h / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
        s.om = clamp(s.om, -30, 30); if (!Number.isFinite(s.th) || !Number.isFinite(s.om)) { s.th = 0.5; s.om = 0; }
      });
      s.th = Math.atan2(Math.sin(s.th), Math.cos(s.th));
      const bx = px + Math.sin(s.th) * Lp, by = py + Math.cos(s.th) * Lp, br = 10 + 7 * Math.sqrt(m);
      if (dt > 0) { trail.push([bx, by]); if (trail.length > 90) trail.shift(); }
      S.clear(); const rgb = hexRgb(C.color || '#f97316');
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(px, py, Lp, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + Lp); ctx.stroke(); ctx.setLineDash([]);
      if (on(C.trail ?? true)) for (let i = 1; i < trail.length; i++) { ctx.strokeStyle = rgba(rgb, (i / trail.length) * 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke(); }
      ctx.fillStyle = '#64748b'; ctx.fillRect(px - 40, py - 6, 80, 6);
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
      const gr = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br); gr.addColorStop(0, rgba(mix(C.color || '#f97316', 0.6), 1)); gr.addColorStop(1, rgba(rgb, 1)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      // angle arc
      ctx.strokeStyle = 'rgba(250,204,21,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 36, Math.PI / 2, Math.PI / 2 - s.th, s.th > 0); ctx.stroke();
      const E = 0.5 * m * L * L * s.om * s.om + m * g * L * (1 - Math.cos(s.th));
      return { th: (s.th * 180) / Math.PI, om: s.om, T: TAU * Math.sqrt(L / g), L, m, E, c, A, g, hx: bx, hy: by, ix: grab ? 'g' : '' };
    };
  },
};

/* ───────────────────────── hourglass ───────────────────────── */
FAM.hourglass = {
  spec: { color: { label: '沙子颜色', value: '#fcd34d' }, speed: SPD('流沙速度'), size: { label: '沙粒格子', min: 2, max: 6, step: 1, value: 3 }, count: false, extras: [R('neck', '瓶颈宽度（格）', 1, 8, 1, 2), R('fill', '装沙比例', 0.2, 0.9, 0.05, 0.6), T('flip', '漏完自动翻转', true)], remountKeys: [] },
  presets: { 细沙: { size: 2 }, 粗沙: { size: 5 }, 快漏: { neck: 6 }, 慢漏: { neck: 1 }, 密: { fill: 0.85 }, 疏: { fill: 0.3 } },
  doc: {
    title: '沙漏 · 颗粒元胞自动机',
    rows: (v) => [['上半沙粒', String(v.top ?? 0), 'top'], ['下半沙粒', String(v.bot ?? 0)], ['流量', `${fmt(v.rate ?? 0, 0)} 粒/s`], ['预计漏完', `${fmt(v.eta ?? 0, 1)} s`], ['瓶颈 D', `${v.neck ?? 0} 格`], ['Beverloo 预测 Q ∝ (D − k)^2.5', fmt(v.bev ?? 0, 1)], ['已翻转', `${v.flips ?? 0} 次`], ['自动翻转', v.af ? '开' : '关']],
    formula: () => F('每粒沙：下方空 → 下落；否则左下/右下空 → 斜落（随机先试一边）') + F('Beverloo 定律：Q = C·ρ·√g·(D − k·d)^(5/2)') + F('漏完时间 ≈ N / Q'),
    explain: '<p>沙子既不像固体也不像液体。这里用<b>元胞自动机</b>模拟：画面被切成小格子，每粒沙每帧只看自己下面三个格子，能落就落，不能就堆起来，于是自然形成<b>安息角</b>的沙堆。</p><p>沙漏的流量几乎不随沙堆高度变化（不像水），只取决于瓶颈宽度 D，经验公式叫 <b>Beverloo 定律</b>：Q ∝ (D − k)^2.5，瓶颈宽一倍，流量多五倍以上。</p><p>上半漏空后会自动翻转；点击画面也能手动翻转，按住拖动可以在指针处挖开沙子。</p>',
    params: [['沙子颜色', '沙粒颜色'], ['流沙速度', '每秒模拟步数倍率'], ['沙粒格子', '每粒沙的像素大小（重建）'], ['瓶颈宽度（格）', '中间开口宽度'], ['装沙比例', '上半部初始装满程度（重建）'], ['漏完自动翻转', '上半空了自动翻']],
    example: (v) => `<ol><li>上半还有 ${v.top} 粒，流量 ${fmt(v.rate ?? 0, 0)} 粒/s</li><li>预计 ${fmt(v.eta ?? 0, 1)} s 漏完</li><li>瓶颈 ${v.neck} 格，按 Beverloo 相对流量 ${fmt(v.bev ?? 0, 1)}</li></ol>`,
    tip: '点一下翻转沙漏；调瓶颈宽度看流量变化。',
  },
  build(S) {
    let gw = 0, gh = 0, cell = 3, grid = null, col = null, mask = null, key = '', flips = 0, rot = 0, rotT = 0, acc = 0, flowN = 0, rate = 0, rt = 0, ttap = 0; const R0 = rng(241);
    const half = (y) => (y < gh / 2 ? 0 : 1);
    const makeMask = (neck) => { mask = new Uint8Array(gw * gh); const cx = gw / 2; for (let y = 0; y < gh; y++) { const u = Math.abs(y - gh / 2) / (gh / 2); const hw = Math.max(neck / 2, (gw * 0.46) * Math.pow(u, 0.7)); for (let x = 0; x < gw; x++) mask[y * gw + x] = Math.abs(x + 0.5 - cx) <= hw && y > 0 && y < gh - 1 ? 1 : 0; } };
    const init = (C, W, H) => { cell = clamp(Math.round(num(C.size, 3)), 2, 8); gw = Math.max(20, Math.floor(Math.min(W, H * 0.7) / cell)); gh = Math.max(30, Math.floor((H - 16) / cell)); grid = new Uint8Array(gw * gh); col = new Uint8Array(gw * gh); makeMask(num(C.neck, 2)); const f = num(C.fill, 0.6); const top = Math.floor(gh / 2 - (gh / 2) * f); for (let y = top; y < gh / 2 - 1; y++) for (let x = 0; x < gw; x++) if (mask[y * gw + x]) { grid[y * gw + x] = 1; col[y * gw + x] = (R0() * 60) | 0; } };
    const flip = () => { if (rotT > 0) return; rotT = 0.6; flips++; };
    S.onDown(() => { ttap = 1; });
    S.onUp(() => { if (ttap) flip(); ttap = 0; });
    S.onMove((P) => { if (P.down) ttap = 0; });
    const stepCA = (neckW) => {
      for (let y = gh - 2; y >= 0; y--) { const ltr = R0() < 0.5; for (let k = 0; k < gw; k++) { const x = ltr ? k : gw - 1 - k, i = y * gw + x; if (!grid[i]) continue; const b = i + gw; const go = (j) => { grid[j] = 1; col[j] = col[i]; grid[i] = 0; if (half(y) === 0 && half(y + 1) === 1) flowN++; }; if (mask[b] && !grid[b]) { go(b); continue; } const d = R0() < 0.5 ? -1 : 1; const a1 = b + d, a2 = b - d; if (x + d >= 0 && x + d < gw && mask[a1] && !grid[a1]) go(a1); else if (x - d >= 0 && x - d < gw && mask[a2] && !grid[a2]) go(a2); } }
    };
    return ({ ctx, W, H, dt, C, P }) => {
      const k = `${num(C.size, 3)}|${num(C.fill, 0.6)}|${W}|${H}`; if (k !== key) { key = k; init(C, W, H); }
      const neck = clamp(Math.round(num(C.neck, 2)), 1, 12); if (neck !== (mask._n || 0)) { makeMask(neck); mask._n = neck; for (let i = 0; i < grid.length; i++) if (!mask[i]) grid[i] = 0; }
      if (rotT > 0) { rotT -= dt; if (rotT <= 0) { rotT = 0; const g2 = new Uint8Array(gw * gh), c2 = new Uint8Array(gw * gh); for (let i = 0; i < grid.length; i++) { const j = gw * gh - 1 - i; g2[j] = grid[i]; c2[j] = col[i]; } grid = g2; col = c2; } }
      else { acc += dt * 60; let n = 0; while (acc >= 1 && n < 4) { acc -= 1; n++; stepCA(neck); } if (acc > 1) acc = 0; }
      if (P.down && !ttap) { const gx = Math.floor((P.x - (W - gw * cell) / 2) / cell), gy = Math.floor((P.y - 8) / cell); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = gx + dx, y = gy + dy; if (x >= 0 && x < gw && y >= 0 && y < gh) grid[y * gw + x] = 0; } }
      let top = 0, bot = 0; for (let i = 0; i < grid.length; i++) if (grid[i]) { if (i < (gh / 2) * gw) top++; else bot++; }
      rt += dt; if (rt > 1) { rate = flowN / rt; flowN = 0; rt = 0; }
      if (on(C.flip ?? true) && top === 0 && bot > 0 && rotT === 0) flip();
      S.clear(); const ox = (W - gw * cell) / 2, oy = 8; const rgb = hexRgb(C.color || '#fcd34d');
      ctx.save(); const ang = rotT > 0 ? Math.PI * (1 - rotT / 0.6) : 0; ctx.translate(W / 2, oy + (gh * cell) / 2); ctx.rotate(ang); ctx.translate(-W / 2, -(oy + (gh * cell) / 2));
      ctx.fillStyle = 'rgba(148,197,255,.08)'; for (let y = 0; y < gh; y++) { let x0 = -1; for (let x = 0; x <= gw; x++) { const m = x < gw && mask[y * gw + x]; if (m && x0 < 0) x0 = x; if (!m && x0 >= 0) { ctx.fillRect(ox + x0 * cell, oy + y * cell, (x - x0) * cell, cell); x0 = -1; } } }
      for (let i = 0; i < grid.length; i++) if (grid[i]) { const x = i % gw, y = (i / gw) | 0; const s = col[i] / 60; ctx.fillStyle = rgba(mix(C.color || '#fcd34d', s * 0.35, [120, 80, 20]), 1); ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
      ctx.fillStyle = rgba(rgb, 1); ctx.fillRect(ox - 6, oy - 6, gw * cell + 12, 6); ctx.fillRect(ox - 6, oy + gh * cell, gw * cell + 12, 6);
      ctx.restore();
      const bev = Math.pow(Math.max(0.2, neck - 0.4), 2.5);
      return { top, bot, rate, eta: rate > 0 ? top / rate : 0, neck, bev, flips, af: on(C.flip ?? true), hx: W / 2, hy: H / 2, ix: `${flips}` };
    };
  },
};

/* ───────────────────────── magnet ───────────────────────── */
FAM.magnet = {
  spec: { color: { label: '磁针颜色', value: '#60a5fa' }, speed: SPD(), size: { label: '磁针长度', min: 0.5, max: 1.6, step: 0.05, value: 1 }, count: { label: '磁极数', min: 1, max: 6, step: 1, value: 2, buttons: true }, extras: [R('str', '磁场强度', 0.2, 3, 0.05, 1), T('repel', '指针为同极（斥力）', false), T('lines', '显示示踪粒子', true)], remountKeys: [] },
  presets: { 弱磁: { str: 0.3 }, 强磁: { str: 2.8 }, 斥力: { repel: true }, 吸力: { repel: false }, 多点: { count: 6 }, 少点: { count: 1 } },
  doc: {
    title: '磁场 · 磁针对齐与场线',
    rows: (v) => [['磁极数', `${v.k ?? 0} + 指针`], ['指针处 |B|', fmt(v.B ?? 0, 2), 'B'], ['指针处方向', `${fmt(v.ang ?? 0, 0)}°`], ['最强磁针 |B|', fmt(v.Bmax ?? 0, 2)], ['场强倍数', fmt(v.str ?? 0, 2)], ['指针极性', v.rep ? '同极（推开粒子）' : '异极（吸引粒子）'], ['示踪粒子', String(v.np ?? 0)]],
    formula: () => F('二维点磁荷：B(p) = Σᵢ qᵢ·(p − cᵢ) / |p − cᵢ|²') + F('磁针方向 = B̂ = B / |B|，长度/亮度 ∝ log(1 + |B|)') + F('示踪粒子：p ← p + v₀·B̂·Δt（沿场线前进）'),
    explain: '<p>小磁针（指南针）总会转到和当地磁场平行的方向。画面里布满磁针，就能“看见”看不见的磁场。</p><p>每个磁极按距离衰减地产生磁场，N 极（红）向外发出、S 极（蓝）向内收拢，多个磁极的场直接<b>矢量相加</b>。示踪粒子沿着磁场方向前进，描出<b>磁感线</b>。</p><p>指针本身也是一个磁极，移动它看磁针集体转向；“同极”开关会把指针变成与 N 极同号。</p>',
    params: [['磁针颜色', '磁针颜色'], ['时间流速', '磁极移动与粒子速度'], ['磁针长度', '磁针大小'], ['磁极数', '自动移动的磁极数'], ['磁场强度', '整体强度'], ['指针为同极（斥力）', '切换指针磁极符号'], ['显示示踪粒子', '沿场线运动的粒子']],
    example: (v) => `<ol><li>距一个磁极 r 处 |B| ∝ q/r，距离翻倍场强减半</li><li>指针处 |B| = ${fmt(v.B ?? 0, 2)}</li><li>方向 ${fmt(v.ang ?? 0, 0)}°（0° 向右，顺时针增大）</li></ol>`,
    tip: '移动指针靠近磁极，看磁针一起转动。',
  },
  build(S) {
    const R0 = rng(251); const ps = []; const st = {};
    return ({ ctx, W, H, dt, t, C, P }) => {
      const k = clamp(Math.round(num(C.count, 2)), 1, 8), s0 = num(C.str, 1) * 60, rep = on(C.repel);
      const poles = []; for (let i = 0; i < k; i++) { const a = t * 0.2 + (i * TAU) / k; poles.push([W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a * 1.3) * H * 0.3, i % 2 ? -1 : 1]); }
      poles.push([P.x, P.y, rep ? 1 : -1]);
      const B = (x, y) => { let bx = 0, by = 0; for (const [cx, cy, q] of poles) { const dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy + 100; bx += (s0 * q * dx) / r2; by += (s0 * q * dy) / r2; } return [bx, by]; };
      const showP = on(C.lines ?? true);
      while (ps.length < 260) ps.push({ x: R0() * W, y: R0() * H, a: R0() * 3 });
      if (showP) substep(st, dt, 1 / 60, 3, (h) => { for (const p of ps) { const [bx, by] = B(p.x, p.y), m = Math.hypot(bx, by) || 1; p.x += (bx / m) * 90 * h; p.y += (by / m) * 90 * h; p.a -= h; let near = false; for (const [cx, cy] of poles) if (dist(p.x, p.y, cx, cy) < 8) near = true; if (p.a < 0 || near || p.x < 0 || p.x > W || p.y < 0 || p.y > H) { p.x = R0() * W; p.y = R0() * H; p.a = 1 + R0() * 3; } } });
      S.clear(); const rgb = hexRgb(C.color || '#60a5fa'); const sp = 26, len = 10 * num(C.size, 1); let Bmax = 0;
      for (let y = sp / 2; y < H; y += sp) for (let x = sp / 2; x < W; x += sp) {
        const [bx, by] = B(x, y), m = Math.hypot(bx, by); if (m < 1e-6) continue; Bmax = Math.max(Bmax, m); const ux = bx / m, uy = by / m, l = Math.log1p(m) * 0.5, a = clamp(0.25 + l * 0.6, 0.25, 1);
        ctx.strokeStyle = `rgba(248,113,113,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ux * len, y + uy * len); ctx.stroke();
        ctx.strokeStyle = rgba(rgb, a); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ux * len, y - uy * len); ctx.stroke();
      }
      if (showP) { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (const p of ps) ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
      for (const [cx, cy, q] of poles) { ctx.fillStyle = q > 0 ? '#ef4444' : '#3b82f6'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(q > 0 ? 'N' : 'S', cx, cy + 3.5); ctx.textAlign = 'left'; }
      const [bx, by] = B(P.x + 20, P.y);
      return { k, B: Math.hypot(bx, by), ang: (Math.atan2(by, bx) * 180) / Math.PI, Bmax, str: s0 / 60, rep, np: showP ? ps.length : 0, ix: fmt(Math.atan2(by, bx), 2) };
    };
  },
};

/* ───────────────────────── rope ───────────────────────── */
FAM.rope = {
  spec: { color: { label: '绳子颜色', value: '#e879f9' }, speed: SPD(), size: { label: '绳子粗细', min: 1, max: 10, step: 0.5, value: 4 }, count: { label: '节点数', min: 6, max: 40, step: 1, value: 20, buttons: true }, extras: [R('iter', '约束迭代次数', 1, 20, 1, 8), R('g', '重力 g', 0, 2000, 50, 900), R('slack', '松弛度', 1, 1.6, 0.02, 1.2), T('rainbow', '彩虹色', false)], remountKeys: [] },
  presets: { 软: { iter: 2 }, 硬: { iter: 20 }, 多节: { count: 38 }, 少节: { count: 7 }, 彩: { rainbow: true }, 单: { rainbow: false } },
  doc: {
    title: '绳索 · Verlet 积分 + 距离约束',
    rows: (v) => [['节点数', String(v.n ?? 0)], ['实际长度 / 自然长度', `${fmt(v.len ?? 0, 0)} / ${fmt(v.L0 ?? 0, 0)} px`], ['拉伸', `${fmt(v.str ?? 0, 1)} %`, 'str'], ['最大下垂', `${fmt(v.sag ?? 0, 0)} px`], ['锚点张力（相对）', fmt(v.ten ?? 0, 1)], ['约束迭代', String(v.it ?? 0)], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`]],
    formula: () => F('Verlet：xₙ₊₁ = xₙ + (xₙ − xₙ₋₁)·阻尼 + a·Δt²') + F('距离约束：Δ = (|d| − L)/|d|，两端各修正 ½·Δ·d') + F('迭代越多越接近不可伸长；悬链线 y = a·cosh(x/a)'),
    explain: '<p>绳子被拆成一串节点。<b>Verlet 积分</b>不显式存速度，而是用“这一帧位置 − 上一帧位置”当作速度，非常稳定，游戏里常用。</p><p>每一步之后，反复把相邻节点拉回固定间距（<b>距离约束</b>）。迭代次数少，绳子像橡皮筋一样能拉长；迭代多，就几乎不可伸长。静止时绳子形状接近<b>悬链线</b>。</p><p>两端固定，指针会把绳子推开；按住绳子可以抓住最近的节点拖动。</p>',
    params: [['绳子颜色', '绳子颜色'], ['时间流速', '0 = 暂停'], ['绳子粗细', '线宽'], ['节点数', '分段数'], ['约束迭代次数', '越多越硬'], ['重力 g', '向下加速度'], ['松弛度', '绳长 ÷ 两锚点距离'], ['彩虹色', '按节点着色']],
    example: (v) => `<ol><li>自然长度 L₀ = ${fmt(v.L0 ?? 0, 0)} px</li><li>当前 ${fmt(v.len ?? 0, 0)} px，拉伸 ${fmt(v.str ?? 0, 1)}%</li><li>迭代 ${v.it} 次；减少迭代拉伸会变大</li></ol>`,
    tip: '按住绳子往下拉；把迭代调到 1 看橡皮筋效果。',
  },
  build(S) {
    let pts = [], key = '', grab = -1; const st = {};
    S.onDown((P) => { let b = -1, bd = 30; pts.forEach((p, i) => { const d = dist(p.x, p.y, P.x, P.y); if (d < bd && i > 0 && i < pts.length - 1) { bd = d; b = i; } }); grab = b; });
    S.onUp(() => { grab = -1; });
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 20)), 3, 80), slack = num(C.slack, 1.2), g = num(C.g, 900), it = clamp(Math.round(num(C.iter, 8)), 1, 40);
      const ax = W * 0.12, ay = H * 0.22, bx = W * 0.88, by = H * 0.22, span = bx - ax, L0 = span * slack, seg = L0 / (n - 1);
      const k = `${n}|${W}|${H}`; if (k !== key) { key = k; pts = []; for (let i = 0; i < n; i++) { const x = ax + (span * i) / (n - 1); pts.push({ x, y: ay, px: x, py: ay }); } }
      let ten = 0;
      substep(st, dt, 1 / 120, 8, (h) => {
        for (let i = 1; i < n - 1; i++) { const p = pts[i]; if (i === grab) continue; const vx = (p.x - p.px) * 0.995, vy = (p.y - p.py) * 0.995; p.px = p.x; p.py = p.y; p.x += clamp(vx, -40, 40); p.y += clamp(vy, -40, 40) + g * h * h; }
        if (grab > 0) { const p = pts[grab]; p.px = p.x; p.py = p.y; p.x = P.x; p.y = P.y; }
        else for (let i = 1; i < n - 1; i++) { const p = pts[i], dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy), r = 26; if (d < r && d > 1e-6) { p.x = P.x + (dx / d) * r; p.y = P.y + (dy / d) * r; } }
        pts[0].x = pts[0].px = ax; pts[0].y = pts[0].py = ay; pts[n - 1].x = pts[n - 1].px = bx; pts[n - 1].y = pts[n - 1].py = by;
        for (let k2 = 0; k2 < it; k2++) for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, df = (d - seg) / d; const wa = i === 0 || i === grab ? 0 : 1, wb = i + 1 === n - 1 || i + 1 === grab ? 0 : 1; if (wa + wb === 0) continue; a.x += dx * df * (wa / (wa + wb)); a.y += dy * df * (wa / (wa + wb)); b.x -= dx * df * (wb / (wa + wb)); b.y -= dy * df * (wb / (wa + wb)); }
        for (const p of pts) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { key = ''; }
      });
      let len = 0, sag = 0; for (let i = 0; i < n - 1; i++) len += dist(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y); for (const p of pts) sag = Math.max(sag, p.y - ay);
      ten = (dist(pts[0].x, pts[0].y, pts[1].x, pts[1].y) / seg - 1) * 100 + g / 100;
      S.clear(); const rgb = hexRgb(C.color || '#e879f9'); const base = hueOf(C.color || '#e879f9'); const rb = on(C.rainbow);
      ctx.lineCap = 'round'; ctx.lineWidth = num(C.size, 4);
      for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1], s = dist(a.x, a.y, b.x, b.y) / seg; ctx.strokeStyle = rb ? hsla(base + (i / n) * 300, 85, 60) : rgba(s > 1.05 ? mix(C.color || '#e879f9', clamp((s - 1) * 3, 0, 0.7), [255, 80, 80]) : rgb, 1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#e2e8f0'; for (const p of [pts[0], pts[n - 1]]) { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill(); }
      if (grab > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pts[grab].x, pts[grab].y, 7, 0, TAU); ctx.fill(); } else pointerRing(ctx, P, 26);
      const mid = pts[n >> 1];
      return { n, len, L0, str: (len / L0 - 1) * 100, sag, ten, it, g, hx: grab > 0 ? P.x : mid.x, hy: grab > 0 ? P.y : mid.y, ix: grab > 0 ? `g${grab}` : '' };
    };
  },
};

/* ───────────────────────── billiard ───────────────────────── */
FAM.billiard = {
  spec: { color: { label: '台面颜色', value: '#16a34a' }, speed: SPD(), size: { label: '球半径', min: 0.6, max: 1.6, step: 0.05, value: 1 }, count: { label: '彩球数', min: 1, max: 15, step: 1, value: 10, buttons: true }, extras: [R('mu', '滚动摩擦 μ', 0.05, 0.6, 0.01, 0.2), R('power', '击球力度', 0.3, 2, 0.05, 1), T('auto', '无人操作时自动击球', true)], remountKeys: [] },
  presets: { 少球: { count: 3 }, 多球: { count: 15 }, 大: { size: 1.5 }, 小: { size: 0.65 }, 高摩擦: { mu: 0.55 }, 低摩擦: { mu: 0.06 } },
  doc: {
    title: '台球 · 动量守恒与滚动摩擦',
    rows: (v) => [['运动中的球', `${v.mv ?? 0} / ${v.n ?? 0}`], ['母球速度', `${fmt(v.cv ?? 0, 0)} px/s`, 'cv'], ['母球停止距离 v²/(2μg)', `${fmt(v.sd ?? 0, 0)} px`], ['总动能（相对）', fmt(v.K ?? 0, 1)], ['摩擦 μ', fmt(v.mu ?? 0, 2)], ['瞄准力度', v.aim ? `${fmt(v.aim, 0)} px/s` : '—'], ['进袋', String(v.pot ?? 0)], ['击球力度倍率', fmt(v.pw ?? 1, 2)], ['自动击球', v.auto ? '开' : '关']],
    formula: () => F('等质量弹性碰撞：沿法线交换速度分量 v₁ₙ ↔ v₂ₙ（e = 0.95）') + F('滚动摩擦减速：a = μ·g（与速度方向相反）') + F('停止距离 s = v² / (2μg)；库边反弹 e = 0.8'),
    explain: '<p>两个同样重的台球正面相撞，会<b>交换速度</b>：打出去的球停下，被撞的球以原速飞走；斜着撞时只交换连心线方向的速度分量，两球大约成 90° 分开。</p><p>台面摩擦让每个球以恒定减速度 μg 慢下来，所以停止距离与速度的平方成正比：速度翻倍，滚得远 4 倍。</p><p>从白色母球按住<b>往后拖</b>瞄准，松手击球；无人操作时会自动击球演示。进袋的球会重新摆回台面。</p>',
    params: [['台面颜色', '台呢颜色'], ['时间流速', '0 = 暂停'], ['球半径', '所有球大小'], ['彩球数', '彩球数量'], ['滚动摩擦 μ', '越大越快停下'], ['击球力度', '拖动距离到速度的倍率'], ['无人操作时自动击球', '自动演示']],
    example: (v) => `<ol><li>母球速度 ${fmt(v.cv ?? 0, 0)} px/s，μ = ${fmt(v.mu ?? 0, 2)}</li><li>停止距离 = v²/(2μg) ≈ ${fmt(v.sd ?? 0, 0)} px</li><li>μ 减半，滚动距离翻倍</li></ol>`,
    tip: '按住白球往后拉，松手击球。',
  },
  build(S) {
    const R0 = rng(261); let balls = [], key = '', aiming = false, idleT = 1.5, pot = 0; const st = {}; const G = 900;
    const rack = (W, H, n, r) => { const out = [{ x: W * 0.25, y: H / 2, vx: 0, vy: 0, r, cue: true, h: 0 }]; let k = 0; for (let row = 0; row < 5 && k < n; row++) for (let j = 0; j <= row && k < n; j++, k++) out.push({ x: W * 0.62 + row * r * 1.8, y: H / 2 + (j - row / 2) * r * 2.05, vx: 0, vy: 0, r, h: (k * 37) % 360 }); return out; };
    const table = (W, H) => ({ x0: 14, y0: 14, x1: W - 14, y1: H - 14 });
    S.onDown((P) => { const c = balls[0]; if (c && dist(P.x, P.y, c.x, c.y) < c.r + 30) aiming = true; });
    S.onUp((P) => { if (!aiming) return; aiming = false; const c = balls[0], pw = num(S.get().power, 1); const dx = c.x - P.x, dy = c.y - P.y; c.vx = clamp(dx * 6 * pw, -2400, 2400); c.vy = clamp(dy * 6 * pw, -2400, 2400); idleT = 4; });
    return ({ ctx, W, H, dt, t, C, P }) => {
      const n = clamp(Math.round(num(C.count, 10)), 1, 15), r = 11 * num(C.size, 1) * Math.min(1, Math.max(0.6, Math.min(W, H) / 400)), mu = num(C.mu, 0.2), k = `${n}|${W}|${H}`;
      if (k !== key) { key = k; balls = rack(W, H, n, r); }
      for (const b of balls) b.r = r;
      const tb = table(W, H), pockets = [[tb.x0, tb.y0], [W / 2, tb.y0 - 2], [tb.x1, tb.y0], [tb.x0, tb.y1], [W / 2, tb.y1 + 2], [tb.x1, tb.y1]];
      let mv = 0; for (const b of balls) if (Math.hypot(b.vx, b.vy) > 2) mv++;
      if (on(C.auto ?? true) && !aiming && mv === 0 && !P.down) { idleT -= dt; if (idleT <= 0) { idleT = 0.7; const c = balls[0], tg = balls[1 + ((t * 13) | 0) % Math.max(1, balls.length - 1)] || { x: W * 0.8, y: H / 2 }; const a = Math.atan2(tg.y - c.y, tg.x - c.x) + (R0() - 0.5) * 0.08, s = 900 + R0() * 500; c.vx = Math.cos(a) * s * num(C.power, 1); c.vy = Math.sin(a) * s * num(C.power, 1); } }
      substep(st, dt, 1 / 240, 16, (h) => {
        for (const b of balls) { const s = Math.hypot(b.vx, b.vy); if (s > 0) { const ns = Math.max(0, s - mu * G * h); b.vx *= ns / s; b.vy *= ns / s; } b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < tb.x0 + b.r) { b.x = tb.x0 + b.r; b.vx = Math.abs(b.vx) * 0.8; } else if (b.x > tb.x1 - b.r) { b.x = tb.x1 - b.r; b.vx = -Math.abs(b.vx) * 0.8; }
          if (b.y < tb.y0 + b.r) { b.y = tb.y0 + b.r; b.vy = Math.abs(b.vy) * 0.8; } else if (b.y > tb.y1 - b.r) { b.y = tb.y1 - b.r; b.vy = -Math.abs(b.vy) * 0.8; }
          for (const [qx, qy] of pockets) if (dist(b.x, b.y, qx, qy) < b.r * 1.6) { pot++; if (b.cue) { b.x = W * 0.25; b.y = H / 2; } else { b.x = W * (0.45 + R0() * 0.4); b.y = H * (0.25 + R0() * 0.5); } b.vx = b.vy = 0; }
        }
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) collide(balls[i], balls[j], 0.95);
      });
      S.clear(); const felt = hexRgb(C.color || '#16a34a');
      ctx.fillStyle = '#5b3a1e'; rrect(ctx, 2, 2, W - 4, H - 4, 12); ctx.fill(); ctx.fillStyle = rgba(felt, 1); ctx.fillRect(tb.x0, tb.y0, tb.x1 - tb.x0, tb.y1 - tb.y0);
      ctx.fillStyle = '#020617'; for (const [qx, qy] of pockets) { ctx.beginPath(); ctx.arc(qx, qy, r * 1.5, 0, TAU); ctx.fill(); }
      let K = 0;
      for (const b of balls) { K += 0.5 * (b.vx * b.vx + b.vy * b.vy) / 1e4; ctx.fillStyle = b.cue ? '#f8fafc' : hsla(b.h, 80, 52); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, TAU); ctx.fill(); }
      const c = balls[0]; let aim = 0;
      if (!aiming && mv === 0 && on(C.auto ?? true)) { const tg = balls[1] || { x: W * 0.8, y: H / 2 }, a = Math.atan2(tg.y - c.y, tg.x - c.x), pull = 14 + 10 * Math.sin(t * 8); ctx.strokeStyle = '#d6b37a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c.x - Math.cos(a) * (c.r + pull), c.y - Math.sin(a) * (c.r + pull)); ctx.lineTo(c.x - Math.cos(a) * (c.r + pull + 120), c.y - Math.sin(a) * (c.r + pull + 120)); ctx.stroke(); }
      if (aiming) { const dx = c.x - P.x, dy = c.y - P.y; aim = Math.hypot(dx, dy) * 6 * num(C.power, 1); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x - dx * 0.6, P.y - dy * 0.6); ctx.stroke(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + dx * 3, c.y + dy * 3); ctx.stroke(); ctx.setLineDash([]); }
      const cv = Math.hypot(c.vx, c.vy);
      return { mv, n: balls.length, cv, sd: (cv * cv) / (2 * mu * G), K, mu, aim, pot, pw: num(C.power, 1), auto: on(C.auto ?? true), hx: c.x, hy: c.y, ix: aiming ? 'aim' : '' };
    };
  },
};

/* ───────────────────────── orbit-p ───────────────────────── */
FAM['orbit-p'] = {
  spec: { color: { label: '行星颜色', value: '#38bdf8' }, speed: SPD(), size: { label: '恒星质量 M', min: 0.4, max: 2.5, step: 0.05, value: 1 }, count: { label: '行星数', min: 1, max: 5, step: 1, value: 3, buttons: true }, extras: [R('ecc', '初速倍率（1 = 圆轨道）', 0.6, 1.35, 0.01, 0.85), R('dist', '轨道半径', 0.3, 1, 0.05, 0.6), T('trail', '轨迹', true)], remountKeys: [] },
  presets: { 近轨: { dist: 0.35 }, 远轨: { dist: 0.95 }, 快: { speed: 2.5 }, 慢: { speed: 0.4 }, 椭圆感: { ecc: 0.7 }, 圆: { ecc: 1 } },
  doc: {
    title: '行星轨道 · 开普勒定律',
    rows: (v) => [['偏心率 e（行星 1）', fmt(v.e ?? 0, 3), 'e'], ['比能量 E', fmt(v.E ?? 0, 1)], ['角动量 L', fmt(v.L ?? 0, 0)], ['周期 T = 2π√(a³/GM)', `${fmt(v.T ?? 0, 2)} s`], ['能量漂移 ΔE', `${(Math.abs(v.dE ?? 0) < 5e-4 ? 0 : v.dE).toFixed(3)} %`], ['行星数 / 恒星 M', `${v.n ?? 0} / ${fmt(v.M ?? 0, 2)}`], ['速度倍率 / 半径', `${fmt(v.ecc ?? 0, 2)} / ${fmt(v.dist ?? 0, 2)}`], ['轨迹', v.tr ? '显示' : '隐藏']],
    formula: () => F('万有引力：a = −GM·r / |r|³') + F('速度 Verlet（辛积分）：v½ = v + ½aΔt，r ← r + v½Δt，v = v½ + ½a(r)Δt') + F('开普勒第三定律：T² = 4π²a³ / (GM)；e = √(1 + 2EL²/(GM)²)'),
    explain: '<p>行星只受恒星的引力。初速度刚好等于 √(GM/r) 时是<b>圆轨道</b>；小一点就变成<b>椭圆</b>，近日点快、远日点慢（开普勒第二定律：相同时间扫过相同面积）；超过 √2 倍就会逃逸。</p><p>轨道越大周期越长，T² ∝ a³（第三定律）。</p><p>积分用<b>速度 Verlet</b>，这种“辛积分”能让能量长期不漂移，读数里的 ΔE 应接近 0。按住行星拖到新位置松手，它会以当前切向速度重新入轨。</p>',
    params: [['行星颜色', '行星颜色（逐个变色）'], ['时间流速', '0 = 暂停'], ['恒星质量 M', '越大引力越强、周期越短'], ['行星数', '行星数量（互不吸引）'], ['初速倍率（1 = 圆轨道）', '小于 1 椭圆，>1.41 逃逸'], ['轨道半径', '第一颗行星的初始距离'], ['轨迹', '显示轨迹']],
    example: (v) => `<ol><li>半长轴 a 与 GM 给出 T = ${fmt(v.T ?? 0, 2)} s</li><li>偏心率 e = ${fmt(v.e ?? 0, 3)}（0 = 圆）</li><li>辛积分能量漂移仅 ${fmt(v.dE ?? 0, 3)}%</li></ol>`,
    tip: '把速度倍率调到 1 看圆轨道，调低看拉长的椭圆。',
  },
  build(S) {
    let pl = [], key = '', grab = -1; const st = {};
    const GM0 = 2.2e6;
    const init = (W, H, C) => { const n = clamp(Math.round(num(C.count, 3)), 1, 8), GM = GM0 * num(C.size, 1), R0m = Math.min(W, H) * 0.47 * (0.45 + 0.55 * num(C.dist, 0.6)), f = num(C.ecc, 0.85); pl = []; for (let i = 0; i < n; i++) { const r = R0m * (0.55 + (0.45 * (i + 1)) / n), a = (i * TAU) / n * 1.37, v = Math.sqrt(GM / r) * f; pl.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * v, vy: Math.cos(a) * v, tr: [], E0: null }); } };
    const acc = (x, y, GM) => { const r2 = x * x + y * y + 25, r = Math.sqrt(r2); return [(-GM * x) / (r2 * r), (-GM * y) / (r2 * r)]; };
    S.onDown((P) => { const cx = S.W / 2, cy = S.H / 2; pl.forEach((p, i) => { if (dist(P.x, P.y, cx + p.x, cy + p.y) < 18) grab = i; }); });
    S.onUp(() => { if (grab >= 0) { const p = pl[grab], GM = GM0 * num(S.get().size, 1), r = Math.hypot(p.x, p.y) || 1, v = Math.sqrt(GM / r) * num(S.get().ecc, 0.85); p.vx = (-p.y / r) * v; p.vy = (p.x / r) * v; p.tr = []; p.E0 = null; } grab = -1; });
    return ({ ctx, W, H, dt, C, P }) => {
      const k = `${num(C.count, 3)}|${num(C.size, 1)}|${num(C.ecc, 0.85)}|${num(C.dist, 0.6)}|${W}|${H}`; if (k !== key) { key = k; init(W, H, C); }
      const GM = GM0 * num(C.size, 1), cx = W / 2, cy = H / 2, lim = Math.max(W, H) * 1.5;
      substep(st, dt, 1 / 480, 40, (h) => { for (let i = 0; i < pl.length; i++) { const p = pl[i]; if (i === grab) continue; let [ax, ay] = acc(p.x, p.y, GM); p.vx += 0.5 * ax * h; p.vy += 0.5 * ay * h; p.x += p.vx * h; p.y += p.vy * h; [ax, ay] = acc(p.x, p.y, GM); p.vx += 0.5 * ax * h; p.vy += 0.5 * ay * h; if (!Number.isFinite(p.x) || Math.hypot(p.x, p.y) > lim || Math.hypot(p.x, p.y) < 6) key = ''; } });
      if (grab >= 0) { const p = pl[grab]; p.x = P.x - cx; p.y = P.y - cy; p.vx = p.vy = 0; }
      S.clear(); const base = hueOf(C.color || '#38bdf8');
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 * Math.sqrt(num(C.size, 1))); gr.addColorStop(0, '#fff7cc'); gr.addColorStop(0.3, '#fbbf24'); gr.addColorStop(1, 'rgba(251,191,36,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 40 * Math.sqrt(num(C.size, 1)), 0, TAU); ctx.fill();
      let out = { e: 0, E: 0, L: 0, T: 0, dE: 0 };
      pl.forEach((p, i) => {
        if (dt > 0) { p.tr.push([p.x, p.y]); if (p.tr.length > 260) p.tr.shift(); }
        const col = hsla(base + i * 50, 85, 62);
        if (on(C.trail ?? true) && p.tr.length > 1) { ctx.strokeStyle = hsla(base + i * 50, 85, 62, 0.45); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + p.tr[0][0], cy + p.tr[0][1]); for (const q of p.tr) ctx.lineTo(cx + q[0], cy + q[1]); ctx.stroke(); }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + p.x, cy + p.y, i === grab ? 10 : 7, 0, TAU); ctx.fill();
        if (i === 0) { const r = Math.hypot(p.x, p.y) || 1, v2 = p.vx * p.vx + p.vy * p.vy, E = 0.5 * v2 - GM / Math.sqrt(r * r + 25), L = p.x * p.vy - p.y * p.vx; if (p.E0 == null && grab < 0) p.E0 = E; const ex = (p.vy * L) / GM - p.x / r, ey = (-p.vx * L) / GM - p.y / r, a = E < 0 ? -GM / (2 * E) : 0; out = { e: Math.sqrt(Math.max(0, 1 + (2 * E * L * L) / (GM * GM))) || Math.hypot(ex, ey), E: E / 1e3, L, T: a ? TAU * Math.sqrt((a * a * a) / GM) : 0, dE: p.E0 ? ((E - p.E0) / Math.abs(p.E0)) * 100 : 0 }; }
      });
      const p0 = pl[0];
      return { ...out, n: pl.length, M: num(C.size, 1), ecc: num(C.ecc, 0.85), dist: num(C.dist, 0.6), tr: on(C.trail ?? true), hx: cx + p0.x, hy: cy + p0.y, ix: grab >= 0 ? `g${grab}` : '' };
    };
  },
};

/* ───────────────────────── softbody ───────────────────────── */
FAM.softbody = {
  spec: { color: { label: '软体颜色', value: '#4ade80' }, speed: SPD(), size: { label: '软体半径', min: 0.5, max: 1.6, step: 0.05, value: 1 }, count: { label: '软体数', min: 1, max: 5, step: 1, value: 3, buttons: true }, extras: [R('k', '弹簧刚度 k', 0.1, 1, 0.05, 0.5), R('pres', '内部压强', 0.2, 2, 0.05, 1), R('g', '重力 g', 0, 1500, 50, 600)], remountKeys: [] },
  presets: { 软: { k: 0.15, pres: 0.6 }, 硬: { k: 1, pres: 1.8 }, 大: { size: 1.5 }, 小: { size: 0.6 }, 多: { count: 5 }, 少: { count: 1 } },
  doc: {
    title: '软体 · 弹簧质点 + 气体压强',
    rows: (v) => [['软体数', String(v.n ?? 0)], ['面积比 A/A₀', fmt(v.ar ?? 0, 3), 'ar'], ['内部压强 p', fmt(v.p ?? 0, 2)], ['弹簧刚度 k', fmt(v.k ?? 0, 2)], ['最大形变', `${fmt(v.def ?? 0, 1)} %`], ['被抓点', v.grab ? '是' : '否'], ['重力 g', `${fmt(v.g ?? 0, 0)} px/s²`]],
    formula: () => F('外圈 24 个质点，相邻与隔点用弹簧相连：F = k·(|d| − L₀)') + F('理想气体：p ∝ nRT / A（面积越小压强越大），这里 p = p₀·(A₀/A − 0.7)') + F('压力沿每条边的外法线：F = p·边长·n̂'),
    explain: '<p>软体（像果冻、气球）由一圈质点和弹簧构成。只有弹簧时它会塌成一团，所以在内部加上<b>气体压强</b>：面积被压小时压强变大，把边界撑回去，就像气球。</p><p>弹簧刚度 k 控制边界的“硬度”，压强控制“鼓胀程度”。软体落地会被压扁再弹回；软体之间会互相挤压。</p><p>按住软体边缘的点可以拉扯它、甩出去。</p>',
    params: [['软体颜色', '软体颜色'], ['时间流速', '0 = 暂停'], ['软体半径', '静止时大小'], ['软体数', '软体数量'], ['弹簧刚度 k', '边界硬度'], ['内部压强', '鼓胀程度'], ['重力 g', '向下加速度']],
    example: (v) => `<ol><li>当前面积是原来的 ${fmt(v.ar ?? 0, 3)} 倍</li><li>压强 p = nRT/A ∝ 1/A → ${fmt(v.p ?? 0, 2)}</li><li>面积被压到一半，压强翻倍</li></ol>`,
    tip: '按住软体边缘往上拉，再松手让它摔下。',
  },
  build(S) {
    const N = 24; let bodies = [], key = '', grab = null; const st = {}; const R0 = rng(271);
    const make = (cx, cy, r) => { const pts = []; for (let i = 0; i < N; i++) { const a = (i * TAU) / N; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0 }); } return { pts, r, A0: N * r * r * Math.sin(TAU / N) / 2, h: R0() * 50 - 25 }; };
    const area = (pts) => { let a = 0; for (let i = 0; i < N; i++) { const p = pts[i], q = pts[(i + 1) % N]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
    S.onDown((P) => { let bd = 30; for (const b of bodies) for (const p of b.pts) { const d = dist(P.x, P.y, p.x, p.y); if (d < bd) { bd = d; grab = p; } } if (!grab) for (const b of bodies) { const c = b.pts.reduce((s, p) => [s[0] + p.x / N, s[1] + p.y / N], [0, 0]); if (dist(P.x, P.y, c[0], c[1]) < b.r) grab = b.pts[0]; } });
    S.onUp((P) => { if (grab) { grab.vx = clamp(P.vx, -1500, 1500); grab.vy = clamp(P.vy, -1500, 1500); } grab = null; });
    return ({ ctx, W, H, dt, C, P }) => {
      const n = clamp(Math.round(num(C.count, 3)), 1, 8), r = Math.min(W, H) * 0.13 * num(C.size, 1), kk = `${n}|${num(C.size, 1)}|${W}|${H}`;
      if (kk !== key) { key = kk; grab = null; bodies = []; for (let i = 0; i < n; i++) bodies.push(make(W * ((i + 1) / (n + 1)), H * 0.3 + (i % 2) * r * 0.6, r)); }
      const k = 800 + num(C.k, 0.5) * 6000, pres = num(C.pres, 1), g = num(C.g, 600); const damp = 8;
      const L1 = 2 * r * Math.sin(Math.PI / N), L2 = 2 * r * Math.sin((2 * Math.PI) / N);
      substep(st, dt, 1 / 240, 16, (h) => {
        for (const b of bodies) {
          const ps = b.pts, fx = new Float32Array(N), fy = new Float32Array(N), A = Math.max(area(ps), 1), pk = pres * 220 * Math.max(0, b.A0 / A - 0.7);
          for (let i = 0; i < N; i++) { fy[i] += g;
            for (const [o, L] of [[1, L1], [2, L2]]) { const j = (i + o) % N, p = ps[i], q = ps[j]; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-6, ux = dx / d, uy = dy / d, f = k * (d - L) + damp * ((q.vx - p.vx) * ux + (q.vy - p.vy) * uy); fx[i] += f * ux; fy[i] += f * uy; fx[j] -= f * ux; fy[j] -= f * uy; }
            const j = (i + 1) % N, p = ps[i], q = ps[j], ex = q.x - p.x, ey = q.y - p.y, nx = ey, ny = -ex; const f2 = pk * 0.5; fx[i] += nx * f2; fy[i] += ny * f2; fx[j] += nx * f2; fy[j] += ny * f2; }
          for (let i = 0; i < N; i++) { const p = ps[i]; if (p === grab) { p.vx = (P.x - p.x) / h; p.vy = (P.y - p.y) / h; p.x = P.x; p.y = P.y; continue; } p.vx += fx[i] * h; p.vy += fy[i] * h; capV(p, 2500); p.x += p.vx * h; p.y += p.vy * h;
            if (p.y > H - 3) { p.y = H - 3; p.vy *= -0.3; p.vx *= 0.9; } if (p.y < 3) { p.y = 3; p.vy = Math.abs(p.vy) * 0.3; } if (p.x < 3) { p.x = 3; p.vx = Math.abs(p.vx) * 0.3; } if (p.x > W - 3) { p.x = W - 3; p.vx = -Math.abs(p.vx) * 0.3; } }
        }
        // body–body: push points out of other bodies' centroid discs; pointer pushes too
        const cs = bodies.map((b) => b.pts.reduce((s, p) => [s[0] + p.x / N, s[1] + p.y / N], [0, 0]));
        bodies.forEach((b, bi) => { for (const p of b.pts) { if (p === grab) continue; cs.forEach((c, ci) => { if (ci === bi) return; const dx = p.x - c[0], dy = p.y - c[1], d = Math.hypot(dx, dy), m = bodies[ci].r * 0.92; if (d < m && d > 1e-6) { p.x = c[0] + (dx / d) * m; p.y = c[1] + (dy / d) * m; const vn = p.vx * (dx / d) + p.vy * (dy / d); if (vn < 0) { p.vx -= vn * (dx / d); p.vy -= vn * (dy / d); } } }); if (!grab) { const dx = p.x - P.x, dy = p.y - P.y, d = Math.hypot(dx, dy); if (d < 22 && d > 1e-6) { p.x = P.x + (dx / d) * 22; p.y = P.y + (dy / d) * 22; p.vx += (dx / d) * 30; p.vy += (dy / d) * 30; } } } });
        for (const b of bodies) for (const p of b.pts) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) key = '';
      });
      S.clear(); const base = hueOf(C.color || '#4ade80'); let ar = 0, pp = 0, def = 0;
      bodies.forEach((b, bi) => {
        const A = area(b.pts), arr = A / b.A0; if (bi === 0) { ar = arr; pp = pres * Math.max(0, 1 / Math.max(arr, 0.05) - 0.7); }
        def = Math.max(def, Math.abs(1 - arr) * 100);
        ctx.fillStyle = rgba(mix(C.color || '#4ade80', (bi % 3) * 0.12), 1); ctx.strokeStyle = rgba(mix(C.color || '#4ade80', 0.45), 1); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= N; i++) { const p = b.pts[i % N], q = b.pts[(i + 1) % N], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p.x, p.y, mx, my); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const c = b.pts.reduce((s, p) => [s[0] + p.x / N, s[1] + p.y / N], [0, 0]); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(c[0] - b.r * 0.25, c[1] - b.r * 0.15, b.r * 0.09, 0, TAU); ctx.arc(c[0] + b.r * 0.25, c[1] - b.r * 0.15, b.r * 0.09, 0, TAU); ctx.fill();
      });
      if (grab) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(grab.x, grab.y, 6, 0, TAU); ctx.fill(); } else pointerRing(ctx, P, 22);
      const hp = bodies[0].pts[(N * 3) >> 2];
      return { n: bodies.length, ar, p: pp, k: num(C.k, 0.5), def, grab: !!grab, g, hx: grab ? P.x : hp.x, hy: grab ? P.y : hp.y, ix: grab ? 'g' : '' };
    };
  },
};

/* ───────────────────────── mount ───────────────────────── */
const FAMILIES = Object.keys(FAM);

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'wall-ball');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'wall-ball';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-physics',
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
  const S = createCanvasStage(host, opts, { doc: F0.doc, spec: F0.spec, bg: F0.bg || '#060a14', auto: F0.auto !== false, cursor: F0.cursor || 'crosshair' });
  const step = F0.build(S, S.get());
  S.onFrame(step);
  return S.destroy;
}
