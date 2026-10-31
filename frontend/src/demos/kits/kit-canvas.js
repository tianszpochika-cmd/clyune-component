import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';

const TITLES={orbits:'轨道粒子',trail:'指针拖尾',blob:'软体 Blob',rain:'粒子雨',wave:'波浪',noise:'噪声场',flock:'群体',burst:'爆发',flow:'流场',gridwave:'网格起伏',ink:'墨水扩散',aurora:'极光',constellation:'星座连线',sand:'沙粒',kaleido:'万花筒',lightning:'闪电',cloth:'布料感',spiral:'螺旋采样',tunnel:'隧道穿梭'};
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
  const mouse = { x: 0, y: 0, down: false };
  const n = parseInt(String(id).split('-').pop(), 10) || 1;
  const parts = id.split('-');
  const kind = parts.slice(0, -1).join('-') || parts[0];
  const ctrl = opts._controls || {};
  const readVar = (name, fallback) => {
    const v = getComputedStyle(host).getPropertyValue(name).trim()
      || getComputedStyle(stage).getPropertyValue(name).trim()
      || getComputedStyle(host.parentElement || host).getPropertyValue(name).trim();
    return v || fallback;
  };
  const liveColor = () => readVar('--c', ctrl.color || hsl(n, 75, 60));
  const liveSpd = () => {
    const s = parseFloat(readVar('--spd', ctrl.speed ?? 1));
    return Number.isFinite(s) && s > 0 ? s : 1;
  };
  const liveCount = () => {
    const c = parseInt(readVar('--count', ctrl.count ?? 40), 10);
    return Number.isFinite(c) ? c : 40;
  };
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
  state.onResize = reset;
  reset();

  const onMove = (e) => { const p = localPoint(canvas, e); mouse.x = p.x; mouse.y = p.y; };
  const onDown = (e) => { mouse.down = true; onMove(e); burst(); };
  const onUp = () => { mouse.down = false; };
  const burst = () => {
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

  const stop = loop((dt, t) => {
    const color = liveColor();
    const spd = liveSpd();
    pwr = spd;
    const { w, h } = state;
    if (!w || !h) return;

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
        p.x += p.vx * dt; p.y += p.vy * dt;
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
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!['rain', 'flow', 'burst', 'ink', 'sand'].includes(kind)) {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      if (p.life <= 0) continue;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue} 80% 60% / ${0.55 + 0.45 * Math.max(0, p.life)})`;
      const rr = kind === 'blob' ? p.r * (2 + Math.sin(t * 3 + p.hue)) : p.r;
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    partsArr = partsArr.filter((p) => p.life === undefined || p.life > 0);

    if (kind === 'orbits' || kind === 'blob' || kind === 'flock') {
      for (let i = 0; i < partsArr.length; i++) for (let j = i + 1; j < Math.min(partsArr.length, i + 30); j++) {
        const a = partsArr[i], b = partsArr[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 70) {
          ctx.strokeStyle = `rgba(129,140,248,${1 - d / 70})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
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
