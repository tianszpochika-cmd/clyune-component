import { addStyle } from '../lib/canvas.js';
import { readLiveControls } from './kits/_shared.js';
export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const rm = addStyle(`
  .ct { position:absolute; inset:0; overflow:auto; display:flex; flex-wrap:wrap; gap:40px; align-items:center; justify-content:center; padding:30px 16px; }
  .ct-col { display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--muted); font-size:12px; }
  .ct-tilt { width:240px; height:320px; perspective:900px; }
  .ct-inner { width:100%; height:100%; border-radius:20px; position:relative; transform-style:preserve-3d; transition:transform .12s ease-out;
    background:linear-gradient(135deg,#312e81,#0e7490); border:1px solid rgba(255,255,255,.15); box-shadow:0 30px 60px -20px rgba(0,0,0,.6); overflow:hidden; }
  .ct-inner .ct-glare { position:absolute; inset:0; background:radial-gradient(circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,.35), transparent 50%); pointer-events:none; }
  .ct-inner .ct-layer { position:absolute; left:22px; right:22px; transform:translateZ(50px); color:#fff; }
  .ct-inner .ct-l1 { top:24px; font-size:22px; font-weight:800; } .ct-inner .ct-l2 { bottom:24px; font-size:13px; opacity:.85; transform:translateZ(30px); }
  .ct-orb { position:absolute; width:110px; height:110px; border-radius:50%; left:50%; top:50%; margin:-55px 0 0 -55px; background:radial-gradient(circle at 35% 35%,#fef08a,#f472b6 60%,#7c3aed); transform:translateZ(80px); box-shadow:0 20px 40px rgba(0,0,0,.4); }
  .ct-flip { width:240px; height:320px; perspective:1000px; cursor:pointer; }
  .ct-flip-in { width:100%; height:100%; position:relative; transform-style:preserve-3d; transition:transform .8s cubic-bezier(.4,.2,.2,1); }
  .ct-flip.on .ct-flip-in { transform:rotateY(180deg); }
  .ct-face { position:absolute; inset:0; border-radius:20px; backface-visibility:hidden; -webkit-backface-visibility:hidden; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:8px; padding:20px; text-align:center; color:#fff; border:1px solid rgba(255,255,255,.15); }
  .ct-front { background:linear-gradient(160deg,#1e1b4b,#4338ca); } .ct-back { background:linear-gradient(160deg,#064e3b,#0891b2); transform:rotateY(180deg); }
  .ct-face b { font-size:22px; } .ct-face span { font-size:13px; opacity:.85; }
  .ct-cube { width:120px; height:120px; position:relative; transform-style:preserve-3d; animation:ct-spin 10s linear infinite; margin:40px; }
  .ct-cube div { position:absolute; inset:0; border:1px solid rgba(129,140,248,.8); background:rgba(129,140,248,.12); display:grid; place-items:center; color:#c7d2fe; font-weight:700; }
  .ct-cube div:nth-child(1){transform:translateZ(60px)} .ct-cube div:nth-child(2){transform:rotateY(180deg) translateZ(60px)}
  .ct-cube div:nth-child(3){transform:rotateY(90deg) translateZ(60px)} .ct-cube div:nth-child(4){transform:rotateY(-90deg) translateZ(60px)}
  .ct-cube div:nth-child(5){transform:rotateX(90deg) translateZ(60px)} .ct-cube div:nth-child(6){transform:rotateX(-90deg) translateZ(60px)}
  @keyframes ct-spin { to { transform:rotateX(360deg) rotateY(720deg); } }
  .ct-scene { perspective:600px; }
  `);
  host.innerHTML = `<div class="ct">
    <div class="ct-col"><div class="ct-tilt" id="ctTilt"><div class="ct-inner" id="ctInner"><div class="ct-orb"></div><div class="ct-layer ct-l1">3D Tilt</div><div class="ct-layer ct-l2">translateZ 视差层 + 高光</div><div class="ct-glare"></div></div></div>移动指针倾斜</div>
    <div class="ct-col"><div class="ct-flip" id="ctFlip"><div class="ct-flip-in"><div class="ct-face ct-front"><b>正面</b><span>点击翻转</span></div><div class="ct-face ct-back"><b>背面</b><span>backface-visibility: hidden</span></div></div></div>点击翻转</div>
    <div class="ct-col"><div class="ct-scene"><div class="ct-cube"><div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div></div></div>纯 CSS 立方体</div>
  </div>`;
  const tilt = host.querySelector('#ctTilt'), inner = host.querySelector('#ctInner'), flip = host.querySelector('#ctFlip');
  const move = (e) => {
    const r = tilt.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    inner.style.transform = `rotateY(${(x - .5) * 30}deg) rotateX(${(.5 - y) * 30}deg)`;
    inner.style.setProperty('--gx', x * 100 + '%'); inner.style.setProperty('--gy', y * 100 + '%');
  };
  const leave = () => { inner.style.transform = ''; };
  tilt.addEventListener('pointermove', move); tilt.addEventListener('pointerleave', leave);
  flip.addEventListener('click', () => flip.classList.toggle('on'));
  const rootEl = host.firstElementChild || host;
  const sync = setInterval(() => {
    const L = readLiveControls([host, host.parentElement, rootEl], ctrl);
    rootEl.style.setProperty('--c', L.color);
    rootEl.style.setProperty('--spd', String(L.speed));
    rootEl.style.setProperty('--sz', String(L.size));
  }, 80);
  return () => { clearInterval(sync);  rm(); host.innerHTML = ''; };
}
