import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';

const TITLES={orbits:'轨道粒子',trail:'指针拖尾',blob:'软体 Blob',rain:'粒子雨',wave:'波浪',noise:'噪声场',flock:'群体',burst:'爆发',flow:'流场',gridwave:'网格起伏',ink:'墨水扩散',aurora:'极光',constellation:'星座连线',sand:'沙粒',kaleido:'万花筒',lightning:'闪电',cloth:'布料感',spiral:'螺旋采样',tunnel:'隧道穿梭',fire:'火焰',smoke:'烟雾',reactdiff:'反应扩散',isometric:'等距方块',metaballs2d:'2D Metaball',pixelate:'像素化游标',ascii:'ASCII 艺术','ripple-c':'水波纹点击'};
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-canvas',
    title: TITLES[parseVariant(opts.variant||'orbits').family]||'Canvas',
    fallbackVariant: 'orbits',
    params: defaultParams({color:true,speed:true,size:true,count:true}),
    remountKeys: ['count'],
    mountLegacy,
  });
}


function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'orbits-1';
  const { stage } = bar(host, id, `<button class="btn" data-burst>Burst / Reset</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const mouse = { x: 0, y: 0, down: false, touched: false };
  const n = parseInt(String(id).split('-').pop(), 10) || 1;
  const parts = id.split('-');
  const kind = parts.slice(0, -1).join('-') || parts[0];
  const ctrl = opts._controls || {};
  const liveAll = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const liveColor = () => liveAll().color || hsl(n, 75, 60);
  const liveSpd = () => liveAll().speed;
  const liveCount = () => liveAll().count;
  const liveSize = () => liveAll().size;
  let pwr = 1;
  let partsArr = [];
  let fieldSeed = n * 97;

  const reset = () => {
    const base = liveCount();
    const count = kind === 'sand' ? Math.max(80, base * 4) : kind === 'cloth' ? 0 : Math.max(10, base + n * 5);
    partsArr = Array.from({ length: count }, (_, i) => ({
      x: rand(0, state.w || 400), y: rand(0, state.h || 300),
      vx: rand(-40, 40), vy: rand(-40, 40),
      r: rand(1.2, 3.8), hue: (i * 17 + n * 40) % 360,
      life: rand(0.5, 1), age: rand(0, 10),
    }));
    if (kind === 'cloth') {
      const cols = 18, rows = 12;
      partsArr = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        partsArr.push({
          x: (state.w || 400) * 0.15 + x * ((state.w || 400) * 0.7) / (cols - 1),
          y: 40 + y * 14,
          ox: 0, oy: 0, vx: 0, vy: 0, pinned: y === 0,
          hue: (x * 10 + n * 30) % 360, r: 2, life: 1, age: 0,
        });
      }
      partsArr.forEach((p, i) => { p.ox = p.x; p.oy = p.y; p.idx = i; });
      cloth = { cols, rows };
    }
  };
  let cloth = null;
  state.onResize = () => {
    reset();
    if (!mouse.touched) { mouse.x = (state.w || 400) / 2; mouse.y = (state.h || 300) / 2; }
  };
  reset();
  mouse.x = (state.w || 400) / 2;
  mouse.y = (state.h || 300) / 2;

  const onMove = (e) => { const p = localPoint(canvas, e); mouse.x = p.x; mouse.y = p.y; mouse.touched = true; };
  const onDown = (e) => { mouse.down = true; onMove(e); burst(); };
  const onUp = () => { mouse.down = false; };
  const burst = () => {
    if (kind === 'ripple-c') {
      if (!state._rips) state._rips = [];
      state._rips.push({ x: mouse.x || state.w/2, y: mouse.y || state.h/2, r: 4, a: 1 });
      return;
    }
    fieldSeed = Math.random() * 1000;
    if (kind === 'burst' || kind === 'lightning' || kind === 'ink' || kind.startsWith('trail') === false) {
      for (let i = 0; i < 36; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(80, 280) * pwr;
        partsArr.push({
          x: mouse.x || state.w / 2, y: mouse.y || state.h / 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rand(2, 5), hue: (n * 50 + i * 10) % 360, life: 1, age: 0,
        });
      }
    }
    if (kind === 'sand') reset();
    if (kind === 'flow' || kind === 'noise' || kind === 'aurora') fieldSeed = Math.random() * 999;
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  host.querySelector('[data-burst]')?.addEventListener('click', burst);

  // simple hash noise
  const noise = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + fieldSeed) * 43758.5453;
    return s - Math.floor(s);
  };
  const fbm = (x, y) => {
    let v = 0, a = 0.5;
    for (let i = 0; i < 4; i++) { v += a * noise(x, y); x *= 2; y *= 2; a *= 0.5; }
    return v;
  };

  let bolts = [];
  const makeBolt = () => {
    const pts = [{ x: state.w / 2, y: 20 }];
    let x = state.w / 2, y = 20;
    while (y < state.h - 20) {
      x += rand(-30, 30); y += rand(12, 28);
      pts.push({ x, y });
    }
    bolts.push({ pts, life: 1 });
  };

  let idleBolt = 0;
  let idleRip = 0;
  const stop = loop((dt, t) => {
    const color = liveColor();
    const spd = liveSpd();
    const sz = (typeof liveSize === 'function' ? liveSize() : 1);
    pwr = spd;
    const { w, h } = state;
    if (!w || !h) return;
    // Keep interactive demos alive when the pointer has not moved yet
    if (!mouse.touched) {
      mouse.x = w * 0.5 + Math.cos(t * 0.9 * spd) * Math.min(w, h) * 0.22;
      mouse.y = h * 0.5 + Math.sin(t * 1.1 * spd) * Math.min(w, h) * 0.18;
    }
    if (kind === 'lightning') {
      idleBolt += dt;
      if (idleBolt > 0.55 / Math.max(0.4, spd)) { idleBolt = 0; makeBolt(); }
    }
    if (kind === 'ripple-c') {
      idleRip += dt;
      if (idleRip > 0.9 / Math.max(0.4, spd)) {
        idleRip = 0;
        if (!state._rips) state._rips = [];
        state._rips.push({
          x: w * (0.3 + 0.4 * Math.random()),
          y: h * (0.3 + 0.4 * Math.random()),
          r: 4, a: 1,
        });
      }
    }

    if (kind === 'trail') {
      ctx.fillStyle = 'rgba(6,10,20,0.12)';
      ctx.fillRect(0, 0, w, h);
      const modes = ['neon','smoke','star','ink','rainbow','pixel','spark','saber','firefly','watercolor'];
      const mode = modes[(n - 1) % modes.length];
      for (let i = 0; i < 10; i++) {
        const ang = t * 2 + i;
        const x = mouse.x + Math.cos(ang) * i * 2;
        const y = mouse.y + Math.sin(ang) * i * 2;
        ctx.beginPath();
        if (mode === 'pixel') { ctx.fillStyle = hsl(n + i * 20); ctx.fillRect(x | 0, y | 0, 4, 4); }
        else {
          ctx.fillStyle = mode === 'rainbow' ? hsl((t * 80 + i * 30) | 0)
            : mode === 'ink' || mode === 'watercolor' ? '#93a0c0' : color;
          ctx.globalAlpha = 1 - i / 12;
          const rr = mode === 'smoke' || mode === 'watercolor' ? 12 - i : mode === 'saber' ? 3 : 4;
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return;
    }

    if (kind === 'wave') {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
      const layers = 3 + (n % 4);
      for (let L = 0; L < layers; L++) {
        ctx.beginPath();
        const amp = (12 + L * 10) * pwr;
        const freq = 0.008 + L * 0.004 + n * 0.0005;
        const speed = t * (1 + L * 0.3) * pwr;
        const base = h * 0.45 + L * 18;
        for (let x = 0; x <= w; x += 4) {
          let y = base;
          if (n % 8 === 1) y += Math.sin(x * freq + speed) * amp;
          else if (n % 8 === 2) y += Math.sin(x * freq + speed) * amp + Math.sin(x * freq * 1.7 - speed) * amp * 0.5;
          else if (n % 8 === 3) y += Math.sin(x * freq + speed) * amp + (noise(x * 0.02, t) - 0.5) * amp;
          else if (n % 8 === 4) y += Math.sin(x * freq + speed) * amp * (0.6 + 0.4 * Math.sin(t + L));
          else if (n % 8 === 5) y += Math.sin(x * freq + speed + mouse.x * 0.01) * amp;
          else if (n % 8 === 6) y += Math.sin(x * freq + speed) * amp * (1 - L / layers);
          else if (n % 8 === 7) {
            const a = Math.atan2(x - w / 2, 40); y = h / 2 + Math.sin(a * 6 + speed) * amp + L * 10;
          } else y += Math.sin(x * freq + speed) * amp + Math.cos(x * freq * 0.5 - speed) * amp * 0.4;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = `hsla(${(n * 40 + L * 25) % 360} 70% 50% / ${0.25 + L * 0.1})`;
        ctx.fill();
      }
      return;
    }

    if (kind === 'noise') {
      const cell = 8;
      const img = ctx.createImageData(w, h);
      const scale = 0.008 * pwr;
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        let v = fbm(x * scale, y * scale + t * 0.15);
        if (n % 8 === 2) v = fbm(x * scale + v, y * scale);
        if (n % 8 === 5) v = Math.abs(Math.sin(v * 12));
        const c = (v * 255) | 0;
        const hue = (n * 40 + v * 120) % 360;
        // fill block
        for (let dy = 0; dy < cell && y + dy < h; dy++) for (let dx = 0; dx < cell && x + dx < w; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          if (n % 8 === 7) { img.data[i]=c; img.data[i+1]=c; img.data[i+2]=c; }
          else {
            const rr = c, gg = (c * 0.6 + ((hue)|0) % 80) | 0, bb = 180 - c * 0.3;
            img.data[i] = rr; img.data[i+1] = gg; img.data[i+2] = bb;
          }
          img.data[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    if (kind === 'aurora') {
      ctx.fillStyle = 'rgba(6,10,20,0.2)';
      ctx.fillRect(0, 0, w, h);
      for (let b = 0; b < 5; b++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = h * 0.3 + b * 18 + Math.sin(x * 0.01 + t * 0.8 + b) * 30 * pwr
            + fbm(x * 0.005, t * 0.2 + b) * 40;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${120 + b * 30 + n * 20} 80% 60% / 0.35)`;
        ctx.lineWidth = 14; ctx.stroke();
      }
      return;
    }

    if (kind === 'kaleido') {
      ctx.fillStyle = 'rgba(6,10,20,0.15)';
      ctx.fillRect(0, 0, w, h);
      const segs = 6 + (n % 4);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      for (let s = 0; s < segs; s++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * s) / segs);
        if (s % 2) ctx.scale(1, -1);
        ctx.beginPath();
        ctx.fillStyle = hsl(n + s * 20 + t * 20);
        ctx.arc(mouse.x - w / 2, mouse.y - h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    if (kind === 'lightning') {
      ctx.fillStyle = 'rgba(6,10,20,0.25)';
      ctx.fillRect(0, 0, w, h);
      if (mouse.down && Math.random() < 0.3) makeBolt();
      bolts = bolts.filter((b) => {
        b.life -= dt * 2;
        if (b.life <= 0) return false;
        ctx.beginPath();
        b.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.strokeStyle = `rgba(200,220,255,${b.life})`;
        ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = `rgba(129,140,248,${b.life * 0.5})`;
        ctx.lineWidth = 6; ctx.stroke();
        return true;
      });
      return;
    }

    if (kind === 'tunnel') {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
      const rings = 18;
      for (let i = 0; i < rings; i++) {
        const z = ((i / rings) + t * 0.15 * pwr) % 1;
        const r = 4 + z * Math.min(w, h) * 0.55;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${(n * 40 + i * 15) % 360} 70% 55% / ${1 - z})`;
        ctx.lineWidth = 2;
        ctx.ellipse(w / 2, h / 2, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    if (kind === 'spiral') {
      ctx.fillStyle = 'rgba(6,10,20,0.2)';
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      for (let i = 0; i < 400; i++) {
        const a = i * 0.15 + t * (n % 2 ? 1 : -1);
        const r = i * 0.4 * pwr;
        const x = w / 2 + Math.cos(a) * r;
        const y = h / 2 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      return;
    }

    if (kind === 'gridwave') {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
      const step = 18;
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        const d = Math.hypot(x - mouse.x, y - mouse.y);
        const z = Math.sin(d * 0.04 - t * 3) * 6 * pwr;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${(n * 40 + d * 0.2) % 360} 70% 60% / 0.8)`;
        ctx.arc(x, y + z, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (kind === 'constellation') {
      ctx.fillStyle = 'rgba(6,10,20,0.35)';
      ctx.fillRect(0, 0, w, h);
      if (partsArr.length < 40) reset();
      for (const p of partsArr) {
        p.x += p.vx * dt * 0.2; p.y += p.vy * dt * 0.2;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.fillStyle = '#e8eefc'; ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < partsArr.length; i++) for (let j = i + 1; j < partsArr.length; j++) {
        const a = partsArr[i], b = partsArr[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 90) {
          ctx.strokeStyle = `rgba(129,140,248,${(1 - d / 90) * 0.6})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // mouse lines
      for (const p of partsArr) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < 120) {
          ctx.strokeStyle = `rgba(34,211,238,${1 - d / 120})`;
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
      }
      return;
    }

    if (kind === 'cloth' && cloth) {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows } = cloth;
      for (const p of partsArr) {
        if (p.pinned) continue;
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 80) { p.vx -= (dx / d) * 200 * dt; p.vy -= (dy / d) * 200 * dt; }
        p.vy += 40 * dt;
        p.vx += (p.ox - p.x) * 8 * dt;
        p.vy += (p.oy - p.y) * 8 * dt;
        p.vx *= 0.95; p.vy *= 0.95;
        p.x += p.vx * dt * spd; p.y += p.vy * dt * spd;
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const p = partsArr[i];
        if (x < cols - 1) { const q = partsArr[i + 1]; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        if (y < rows - 1) { const q = partsArr[i + cols]; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
      return;
    }


    if (kind === 'fire') {
      ctx.fillStyle = 'rgba(6,8,14,0.25)';
      ctx.fillRect(0, 0, w, h);
      const count = Math.max(40, liveCount());
      while (partsArr.length < count) {
        partsArr.push({ x: w * 0.5 + rand(-40, 40), y: h * 0.85, vx: rand(-20, 20), vy: rand(-120, -40), r: rand(6, 16), life: 1, hue: rand(10, 40) });
      }
      for (const p of partsArr) {
        p.x += p.vx * dt * spd; p.y += p.vy * dt * spd;
        p.vx += Math.sin(t * 3 + p.y * 0.05) * 30 * dt;
        p.life -= dt * (0.55 + (1 - p.life) * 0.4) * pwr;
        p.r *= 0.995;
        if (p.life <= 0) { p.x = w * 0.5 + rand(-50, 50); p.y = h * 0.88; p.vx = rand(-25, 25); p.vy = rand(-140, -50); p.life = 1; p.r = rand(6, 16) * sz; }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `hsla(${p.hue},100%,70%,${0.55 * p.life})`);
        g.addColorStop(0.5, `hsla(${p.hue + 20},100%,50%,${0.25 * p.life})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      // base glow
      const base = ctx.createRadialGradient(w/2, h*0.9, 10, w/2, h*0.9, 80);
      base.addColorStop(0, color); base.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.35; ctx.fillStyle = base; ctx.fillRect(w/2-80, h*0.7, 160, h*0.3); ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'smoke') {
      ctx.fillStyle = 'rgba(6,10,20,0.08)';
      ctx.fillRect(0, 0, w, h);
      const count = Math.max(30, Math.round(liveCount() * 0.7));
      while (partsArr.length < count) {
        partsArr.push({ x: mouse.x || w/2, y: mouse.y || h*0.7, vx: rand(-15,15), vy: rand(-40,-10), r: rand(10,28), life: 1, age: 0 });
      }
      for (const p of partsArr) {
        p.age += dt; p.x += p.vx * dt * spd; p.y += p.vy * dt * spd;
        p.vx += Math.sin(t + p.age) * 10 * dt; p.r += 12 * dt; p.life -= dt * 0.25 * pwr;
        if (p.life <= 0) { p.x = mouse.x || w/2; p.y = mouse.y || h*0.75; p.vx=rand(-15,15); p.vy=rand(-45,-12); p.r=rand(10,24)*sz; p.life=1; p.age=0; }
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.08 * p.life;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }

    if (kind === 'reactdiff') {
      // cheap Gray-Scott-ish: show dual chemical fields via noise feedback
      const cell = 4;
      if (!state._rd || state._rd.w !== w || state._rd.h !== h) {
        const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
        const A = new Float32Array(cols * rows), B = new Float32Array(cols * rows);
        for (let i = 0; i < A.length; i++) { A[i] = 1; B[i] = 0; }
        for (let i = 0; i < 40; i++) {
          const x = (cols * Math.random()) | 0, y = (rows * Math.random()) | 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const ix = x + dx, iy = y + dy;
            if (ix >= 0 && iy >= 0 && ix < cols && iy < rows) B[iy * cols + ix] = 1;
          }
        }
        state._rd = { cols, rows, A, B, tmpA: new Float32Array(A.length), tmpB: new Float32Array(B.length) };
      }
      const { cols, rows, A, B, tmpA, tmpB } = state._rd;
      const feed = 0.036 + (n % 5) * 0.004, kill = 0.06 + (n % 4) * 0.004;
      const idx = (x, y) => ((y + rows) % rows) * cols + ((x + cols) % cols);
      const steps = Math.max(1, Math.min(3, Math.round(spd)));
      for (let s = 0; s < steps; s++) {
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const a = A[i], b = B[i];
          const lapA = A[idx(x+1,y)] + A[idx(x-1,y)] + A[idx(x,y+1)] + A[idx(x,y-1)] - 4 * a;
          const lapB = B[idx(x+1,y)] + B[idx(x-1,y)] + B[idx(x,y+1)] + B[idx(x,y-1)] - 4 * b;
          const abb = a * b * b;
          tmpA[i] = a + (1.0 * lapA - abb + feed * (1 - a)) * 1.0;
          tmpB[i] = b + (0.5 * lapB + abb - (kill + feed) * b) * 1.0;
        }
        A.set(tmpA); B.set(tmpB);
      }
      const img = ctx.createImageData(w, h);
      const [cr, cg, cb] = (() => { const s = color; /* approx parse */ return [129,140,248]; })();
      // parse color roughly from css via canvas? use hsl fallback
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = B[y * cols + x];
        const R = (30 + v * 200) | 0, G = (40 + v * 120) | 0, Bv = (80 + v * 160) | 0;
        for (let dy = 0; dy < cell && y * cell + dy < h; dy++) for (let dx = 0; dx < cell && x * cell + dx < w; dx++) {
          const i = ((y * cell + dy) * w + (x * cell + dx)) * 4;
          img.data[i] = R; img.data[i+1] = G; img.data[i+2] = Bv; img.data[i+3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // tint overlay
      ctx.globalCompositeOperation = 'tint' in CanvasRenderingContext2D.prototype ? 'source-atop' : 'source-over';
      ctx.globalAlpha = 0.35; ctx.fillStyle = color; ctx.fillRect(0,0,w,h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      return;
    }

    if (kind === 'isometric') {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
      const size = 18 * sz;
      const cols = Math.ceil(w / size) + 2;
      const rows = Math.ceil(h / size) + 2;
      const ox = w / 2, oy = h * 0.25;
      const iso = (i, j, k=0) => ({ x: ox + (i - j) * size, y: oy + (i + j) * size * 0.5 - k * size });
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const hgt = (0.5 + 0.5 * Math.sin(i * 0.5 + t * pwr) * Math.cos(j * 0.4 + t * 0.7)) * 2.2 * (0.6 + 0.4 * Math.sin(mouse.x * 0.01 + i));
        const top = iso(i - cols/2, j - rows/2, hgt);
        const c = `hsla(${(n * 40 + i * 8 + j * 6) % 360} 70% ${45 + hgt * 8}%)`;
        // top diamond
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - size * 0.5);
        ctx.lineTo(top.x + size, top.y);
        ctx.lineTo(top.x, top.y + size * 0.5);
        ctx.lineTo(top.x - size, top.y);
        ctx.closePath();
        ctx.fillStyle = c; ctx.fill();
      }
      return;
    }


    if (kind === 'metaballs2d') {
      ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, w, h);
      const blobs = [
        { x: w*0.35 + Math.sin(t*1.2)*40, y: h*0.45 + Math.cos(t)*30, r: 55*sz },
        { x: mouse.x || w*0.6, y: mouse.y || h*0.5, r: 48*sz },
        { x: w*0.5 + Math.cos(t*0.8)*50, y: h*0.6 + Math.sin(t*1.1)*35, r: 40*sz },
      ];
      const img = ctx.createImageData(w, h);
      const [cr,cg,cb] = [parseInt((color||'#818cf8').slice(1,3),16)||129, parseInt((color||'#818cf8').slice(3,5),16)||140, parseInt((color||'#818cf8').slice(5,7),16)||248];
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        let sum = 0;
        for (const b of blobs) { const dx=x-b.x, dy=y-b.y; sum += (b.r*b.r) / (dx*dx + dy*dy + 1); }
        if (sum > 1) {
          const a = Math.min(255, (sum - 1) * 180);
          for (let oy=0; oy<2 && y+oy<h; oy++) for (let ox=0; ox<2 && x+ox<w; ox++) {
            const i = ((y+oy)*w + (x+ox)) * 4;
            img.data[i]=cr; img.data[i+1]=cg; img.data[i+2]=cb; img.data[i+3]=a;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      return;
    }
    if (kind === 'pixelate') {
      ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, w, h);
      const cell = Math.max(4, 8 * sz);
      const mx = mouse.x || w/2, my = mouse.y || h/2;
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const d = Math.hypot(x - mx, y - my);
        const on = d < 90 * sz;
        ctx.fillStyle = on ? color : `hsla(${(x+y+t*40)%360} 40% 20% / .9)`;
        ctx.fillRect(x, y, cell - 1, cell - 1);
      }
      return;
    }
    if (kind === 'ascii') {
      ctx.fillStyle = '#060a14'; ctx.fillRect(0, 0, w, h);
      const glyphs = ' .:-=+*#%@';
      const cell = Math.max(6, 10 * sz);
      ctx.font = `${cell}px monospace`;
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const v = 0.5 + 0.5 * Math.sin(x*0.05 + t) * Math.cos(y*0.04 + t*0.7);
        const g = glyphs[(v * (glyphs.length - 1)) | 0];
        ctx.fillStyle = color; ctx.globalAlpha = 0.35 + v * 0.65;
        ctx.fillText(g, x, y);
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (kind === 'ripple-c') {
      ctx.fillStyle = 'rgba(6,10,20,0.18)'; ctx.fillRect(0, 0, w, h);
      if (!state._rips) state._rips = [];
      for (const r of state._rips) {
        r.r += 80 * dt * spd; r.a -= 0.35 * dt * spd;
        if (r.a <= 0) continue;
        ctx.beginPath(); ctx.strokeStyle = color; ctx.globalAlpha = Math.max(0, r.a);
        ctx.lineWidth = 2 * sz; ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      state._rips = state._rips.filter((r) => r.a > 0);
      return;
    }

    // default particle systems: orbits, blob, rain, flock, burst, flow, ink, sand
    const fade = kind === 'burst' || kind === 'ink' ? 0.15 : 1;
    if (fade < 1) {
      ctx.fillStyle = `rgba(6,10,20,${fade})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, w, h);
    }

    for (const p of partsArr) {
      if (kind === 'orbits' || kind === 'blob') {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1;
        const pull = kind === 'blob' ? 0.4 : 30;
        p.vx += (dx / d) * pull * dt * pwr;
        p.vy += (dy / d) * pull * dt * pwr;
        p.vx *= 0.99; p.vy *= 0.99;
      } else if (kind === 'rain') {
        p.vy += (40 + n * 8) * dt * pwr;
        p.vx += Math.sin(t + p.x * 0.01) * 8 * dt;
        if (p.y > h) { p.y = -4; p.x = rand(0, w); p.vy = rand(20, 80); }
      } else if (kind === 'flock') {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 20 * dt; p.vy += (dy / d) * 20 * dt;
        p.vx += rand(-30, 30) * dt; p.vy += rand(-30, 30) * dt;
        p.vx *= 0.98; p.vy *= 0.98;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        p.vx = (p.vx / sp) * 60 * pwr; p.vy = (p.vy / sp) * 60 * pwr;
      } else if (kind === 'flow') {
        const a = fbm(p.x * 0.005, p.y * 0.005 + t * 0.05) * Math.PI * 4;
        p.vx = Math.cos(a) * 40 * pwr; p.vy = Math.sin(a) * 40 * pwr;
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) { p.x = rand(0, w); p.y = rand(0, h); }
      } else if (kind === 'burst' || kind === 'ink') {
        p.vx *= 0.98; p.vy *= 0.98;
        if (kind === 'burst') p.vy += 30 * dt;
        p.life -= dt * 0.4;
      } else if (kind === 'sand') {
        p.vy += 80 * dt; p.vx *= 0.99;
        if (p.y > h - 4) { p.y = h - 4; p.vy = 0; p.vx *= 0.5; }
      }
      p.x += p.vx * dt * spd; p.y += p.vy * dt * spd;
      if (!['rain', 'flow', 'burst', 'ink', 'sand'].includes(kind)) {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      if (p.life <= 0) continue;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55 + 0.45 * Math.max(0, p.life);
      const rr = (kind === 'blob' ? p.r * (2 + Math.sin(t * 3 + p.hue)) : p.r) * sz;
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    partsArr = partsArr.filter((p) => p.life === undefined || p.life > 0);

    if (kind === 'orbits' || kind === 'blob' || kind === 'flock') {
      for (let i = 0; i < partsArr.length; i++) for (let j = i + 1; j < Math.min(partsArr.length, i + 30); j++) {
        const a = partsArr[i], b = partsArr[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 70) {
          ctx.strokeStyle = color;
          ctx.globalAlpha = 1 - d / 70;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  });

  return () => {
    stop(); dispose(); host.innerHTML = '';
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
  };
}
