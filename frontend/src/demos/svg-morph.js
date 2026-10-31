// Morph between shapes sampled to the same number of points (no plugin needed)
import { loop } from '../lib/canvas.js';
const N = 120;
function shape(kind) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N, a = t * Math.PI * 2 - Math.PI / 2;
    let r = 1, x, y;
    switch (kind) {
      case 'circle': x = Math.cos(a); y = Math.sin(a); break;
      case 'star': { const k = (t * 10) % 2; r = k < 1 ? 1 - .55 * k : .45 + .55 * (k - 1); x = Math.cos(a) * r; y = Math.sin(a) * r; break; }
      case 'heart': { const th = t * Math.PI * 2; x = 16 * Math.sin(th) ** 3 / 17; y = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 17; break; }
      case 'square': { const s = t * 4, side = Math.floor(s), f = s - side; [x, y] = [[-1 + 2 * f, -1], [1, -1 + 2 * f], [1 - 2 * f, 1], [-1, 1 - 2 * f]][side % 4]; x *= .85; y *= .85; break; }
      case 'flower': r = .65 + .35 * Math.cos(6 * a); x = Math.cos(a) * r; y = Math.sin(a) * r; break;
      case 'blob': r = .8 + .12 * Math.sin(3 * a) + .08 * Math.cos(5 * a); x = Math.cos(a) * r; y = Math.sin(a) * r; break;
    }
    pts.push([x * 120 + 160, y * 120 + 160]);
  }
  return pts;
}
const toD = (p) => 'M' + p.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z';
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export function mount(host) {
  const kinds = { circle: '圆', star: '星', heart: '心', square: '方', flower: '花', blob: '流体' };
  const colors = { circle: ['#818cf8', '#22d3ee'], star: ['#fbbf24', '#f97316'], heart: ['#f472b6', '#e11d48'], square: ['#34d399', '#0ea5e9'], flower: ['#c084fc', '#f472b6'], blob: ['#22d3ee', '#6366f1'] };
  host.innerHTML = `<div class="fx-bar">${Object.entries(kinds).map(([k, v]) => `<button class="btn" data-k="${k}">${v}</button>`).join('')}<button class="btn" data-k="auto">自动</button></div>
  <div style="position:absolute;inset:0;display:grid;place-items:center;padding:50px 10px 10px">
    <svg viewBox="0 0 320 320" style="width:min(420px,90%);height:auto;max-height:100%">
      <defs><linearGradient id="smg" x1="0" y1="0" x2="1" y2="1"><stop id="sm1" offset="0" stop-color="#818cf8"/><stop id="sm2" offset="1" stop-color="#22d3ee"/></linearGradient></defs>
      <path id="smp" fill="url(#smg)" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
    </svg></div>`;
  const path = host.querySelector('#smp'), s1 = host.querySelector('#sm1'), s2 = host.querySelector('#sm2');
  let from = shape('circle'), to = from, t = 1, kind = 'circle', auto = true, timer = 0;
  const order = Object.keys(kinds);
  const go = (k) => { from = cur(); to = shape(k); t = 0; kind = k; s1.setAttribute('stop-color', colors[k][0]); s2.setAttribute('stop-color', colors[k][1]); mark(); };
  const cur = () => { const e = ease(Math.min(1, t)); return from.map((p, i) => [p[0] + (to[i][0] - p[0]) * e, p[1] + (to[i][1] - p[1]) * e]); };
  const mark = () => host.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b.dataset.k === kind || (auto && b.dataset.k === 'auto')));
  host.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.k === 'auto') { auto = !auto; mark(); return; }
    auto = false; go(b.dataset.k);
  }));
  mark();
  const stop = loop((dt) => {
    t += dt / .9;
    if (auto) { timer += dt; if (timer > 2) { timer = 0; go(order[(order.indexOf(kind) + 1) % order.length]); } }
    path.setAttribute('d', toD(cur()));
  });
  return () => { stop(); host.innerHTML = ''; };
}
