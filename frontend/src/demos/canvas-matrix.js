import { makeCanvas, loop } from '../lib/canvas.js';
export function mount(host) {
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF云澜学习星<>/{}=+*';
  const palettes = ['#22c55e', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24'];
  let color = 0, size = 16, cols = [], acc = 0;
  const seed = () => { size = state.w < 500 ? 13 : 16; cols = Array.from({ length: Math.ceil(state.w / size) }, () => Math.random() * -50); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, state.w, state.h); };
  state.onResize = seed; seed();
  canvas.addEventListener('click', () => { color = (color + 1) % palettes.length; });
  const stop = loop((dt) => {
    acc += dt; if (acc < 1 / 24) return; acc = 0;
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `${size}px ui-monospace, monospace`;
    for (let i = 0; i < cols.length; i++) {
      const y = cols[i] * size, ch = chars[(Math.random() * chars.length) | 0];
      ctx.fillStyle = '#e8ffe8'; ctx.fillText(ch, i * size, y);
      ctx.fillStyle = palettes[color]; ctx.fillText(chars[(Math.random() * chars.length) | 0], i * size, y - size);
      if (y > state.h && Math.random() > .975) cols[i] = 0; else cols[i]++;
    }
  });
  return () => { stop(); dispose(); };
}
