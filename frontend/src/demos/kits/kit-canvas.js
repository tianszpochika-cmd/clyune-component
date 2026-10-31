import { makeCanvas, loop, localPoint, bar, rand, hsl } from './_shared.js';

export function mount(host, opts = {}) {
  const id = opts.variant || 'orbits-1';
  const { stage } = bar(host, id, `<button class="btn" data-burst>Burst</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  const mouse = { x: 0, y: 0, down: false };
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const color = hsl(n, 75, 60);
  let parts = [];
  const reset = () => {
    parts = Array.from({ length: 80 + n * 8 }, (_, i) => ({
      x: rand(0, state.w), y: rand(0, state.h),
      vx: rand(-40, 40), vy: rand(-40, 40),
      r: rand(1.5, 3.5), hue: (i * 17 + n * 40) % 360,
      life: rand(0.5, 1),
    }));
  };
  state.onResize = reset;
  reset();
  const onMove = (e) => { const p = localPoint(canvas, e); mouse.x = p.x; mouse.y = p.y; };
  const onDown = (e) => { mouse.down = true; onMove(e); burst(); };
  const onUp = () => { mouse.down = false; };
  const burst = () => {
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 220);
      parts.push({ x: mouse.x || state.w/2, y: mouse.y || state.h/2, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, r: rand(2,4), hue: (n*50+i*10)%360, life: 1 });
    }
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  host.querySelector('[data-burst]')?.addEventListener('click', burst);

  const stop = loop((dt, t) => {
    const { w, h } = state;
    if (id.startsWith('trail')) {
      ctx.fillStyle = 'rgba(6,10,20,0.12)';
      ctx.fillRect(0, 0, w, h);
      const modes = ['neon','smoke','star','ink','rainbow','pixel','spark'];
      const mode = modes[(n-1)%7];
      for (let i = 0; i < 8; i++) {
        const ang = t * 2 + i;
        const x = mouse.x + Math.cos(ang) * i * 2;
        const y = mouse.y + Math.sin(ang) * i * 2;
        ctx.beginPath();
        if (mode === 'pixel') { ctx.fillStyle = hsl(n+i*20); ctx.fillRect(x|0, y|0, 4, 4); }
        else {
          ctx.fillStyle = mode === 'rainbow' ? hsl((t*80+i*30)|0) : mode === 'ink' ? '#93a0c0' : color;
          ctx.globalAlpha = 1 - i/10;
          ctx.arc(x, y, mode === 'smoke' ? 10-i : 4, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      return;
    }
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    for (const p of parts) {
      if (id.startsWith('orbits')) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 30 * dt; p.vy += (dy / d) * 30 * dt;
        p.vx *= 0.99; p.vy *= 0.99;
      } else if (id.startsWith('rain')) {
        p.vy += (40 + n * 8) * dt; p.vx += Math.sin(t + p.x) * 8 * dt;
        if (p.y > h) { p.y = -4; p.x = rand(0, w); p.vy = rand(20, 80); }
      } else if (id.startsWith('blob')) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        p.vx += dx * 0.4 * dt; p.vy += dy * 0.4 * dt;
        p.vx *= 0.96; p.vy *= 0.96;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!id.startsWith('rain')) {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue} 80% 60% / ${0.55 + 0.45 * p.life})`;
      const rr = id.startsWith('blob') ? p.r * (2 + Math.sin(t * 3 + p.hue)) : p.r;
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    if (id.startsWith('orbits') || id.startsWith('blob')) {
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], b = parts[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 70) {
          ctx.strokeStyle = `rgba(129,140,248,${1 - d / 70})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
  });

  return () => { stop(); dispose(); host.innerHTML = ''; canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); };
}
