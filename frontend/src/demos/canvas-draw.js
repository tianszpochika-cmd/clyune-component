import { makeCanvas, localPoint } from '../lib/canvas.js';
export function mount(host) {
  host.style.background = '#f8fafc';
  const bar = document.createElement('div');
  bar.className = 'fx-bar';
  bar.innerHTML = `<input type="color" id="dc" value="#6366f1" title="颜色">
    <label>粗细 <input type="range" id="dw" min="1" max="40" value="6"></label>
    <button class="btn" id="dr">彩虹</button><button class="btn" id="de">橡皮</button>
    <button class="btn" id="du">撤销</button><button class="btn" id="dx">清空</button><button class="btn" id="ds">导出 PNG</button>`;
  host.appendChild(bar);
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const strokes = [];
  let cur = null, rainbow = false, eraser = false, hue = 0;
  const q = (s) => bar.querySelector(s);
  const redraw = () => {
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, state.w, state.h);
    for (const s of strokes) drawStroke(s);
  };
  const drawStroke = (s) => {
    const p = s.pts; if (!p.length) return;
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = s.w;
    ctx.globalCompositeOperation = 'source-over';
    if (p.length < 3) { ctx.fillStyle = s.colors[0]; ctx.beginPath(); ctx.arc(p[0].x, p[0].y, s.w / 2, 0, 7); ctx.fill(); return; }
    for (let i = 1; i < p.length - 1; i++) {
      const m0 = { x: (p[i - 1].x + p[i].x) / 2, y: (p[i - 1].y + p[i].y) / 2 }, m1 = { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2 };
      ctx.strokeStyle = s.colors[i] || s.colors[0];
      ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.quadraticCurveTo(p[i].x, p[i].y, m1.x, m1.y); ctx.stroke();
    }
  };
  state.onResize = redraw; redraw();
  const color = () => eraser ? '#f8fafc' : rainbow ? `hsl(${(hue += 4) % 360},90%,55%)` : q('#dc').value;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    cur = { pts: [localPoint(canvas, e)], colors: [color()], w: +q('#dw').value * (eraser ? 2 : 1) };
    strokes.push(cur); drawStroke(cur);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) { cur.pts.push(localPoint(canvas, ev)); cur.colors.push(color()); }
    redraw();
  });
  const end = () => { cur = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  q('#dr').onclick = () => { rainbow = !rainbow; eraser = false; q('#dr').classList.toggle('on', rainbow); q('#de').classList.remove('on'); };
  q('#de').onclick = () => { eraser = !eraser; q('#de').classList.toggle('on', eraser); };
  q('#du').onclick = () => { strokes.pop(); redraw(); };
  q('#dx').onclick = () => { strokes.length = 0; redraw(); };
  q('#ds').onclick = () => { const a = document.createElement('a'); a.download = 'drawing.png'; a.href = canvas.toDataURL('image/png'); a.click(); };
  return () => { dispose(); host.innerHTML = ''; host.style.background = ''; };
}
