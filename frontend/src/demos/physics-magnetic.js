import { addStyle, loop, localPoint } from '../lib/canvas.js';
export function mount(host) {
  const rm = addStyle(`
  .pm { position:absolute; inset:0; overflow:hidden; cursor:none; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:40px; padding:40px 20px; }
  @media (hover:none) { .pm { cursor:auto; } .pm-cursor, .pm-ring { display:none; } }
  .pm-btn { position:relative; padding:18px 34px; border-radius:999px; border:1px solid #24314f; background:#18233d; color:var(--text); font-size:15px; font-weight:600; cursor:none; transition:background .3s, border-color .3s; }
  .pm-btn span { display:inline-block; pointer-events:none; }
  .pm-btn:hover { background:linear-gradient(135deg,#6366f1,#22d3ee); border-color:transparent; color:#0b1020; }
  .pm-circle { width:120px; height:120px; border-radius:50%; padding:0; }
  .pm-cursor { position:absolute; left:0; top:0; width:8px; height:8px; margin:-4px; border-radius:50%; background:#fff; pointer-events:none; z-index:10; mix-blend-mode:difference; }
  .pm-ring { position:absolute; left:0; top:0; width:40px; height:40px; margin:-20px; border-radius:50%; border:1.5px solid rgba(129,140,248,.9); pointer-events:none; z-index:9; transition:width .25s, height .25s, margin .25s, background .25s; }
  .pm-ring.big { width:80px; height:80px; margin:-40px; background:rgba(129,140,248,.15); }
  .pm-trail { position:absolute; inset:0; pointer-events:none; z-index:8; }
  .pm-eye-wrap { display:flex; gap:14px; }
  .pm-eye { width:64px; height:64px; border-radius:50%; background:#e8eefc; position:relative; box-shadow:inset 0 -4px 0 rgba(0,0,0,.15); }
  .pm-eye i { position:absolute; width:26px; height:26px; border-radius:50%; background:#0b1020; left:19px; top:19px; box-shadow:inset 0 0 0 5px #6366f1; }
  `);
  host.innerHTML = `<div class="pm" id="pm"><canvas class="pm-trail"></canvas>
    <button class="pm-btn" data-mag="0.4"><span>磁吸按钮</span></button>
    <button class="pm-btn pm-circle" data-mag="0.6"><span>Hover</span></button>
    <div class="pm-eye-wrap"><div class="pm-eye"><i></i></div><div class="pm-eye"><i></i></div></div>
    <button class="pm-btn" data-mag="0.3"><span>Get Started →</span></button>
    <div class="pm-cursor"></div><div class="pm-ring"></div></div>`;
  const root = host.querySelector('#pm'), cur = root.querySelector('.pm-cursor'), ring = root.querySelector('.pm-ring');
  const cv = root.querySelector('.pm-trail'), ctx = cv.getContext('2d');
  const m = { x: -100, y: -100 }, rp = { x: -100, y: -100 }, trail = [];
  const size = () => { cv.width = root.clientWidth; cv.height = root.clientHeight; };
  const ro = new ResizeObserver(size); ro.observe(root); size();
  const btns = [...root.querySelectorAll('[data-mag]')];
  const eyes = [...root.querySelectorAll('.pm-eye i')];
  root.addEventListener('pointermove', (e) => {
    Object.assign(m, localPoint(root, e));
    trail.push({ x: m.x, y: m.y, life: 1 });
    let near = false;
    for (const b of btns) {
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), zone = Math.max(r.width, r.height);
      const k = +b.dataset.mag;
      if (d < zone) { near = true; b.style.transform = `translate(${dx * k}px,${dy * k}px)`; b.firstElementChild.style.transform = `translate(${dx * k * .5}px,${dy * k * .5}px)`; }
      else { b.style.transform = ''; b.firstElementChild.style.transform = ''; }
    }
    ring.classList.toggle('big', near);
    for (const eye of eyes) {
      const r = eye.parentElement.getBoundingClientRect(), a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      eye.style.transform = `translate(${Math.cos(a) * 14}px,${Math.sin(a) * 14}px)`;
    }
  });
  btns.forEach((b) => { b.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1), background .3s, border-color .3s'; b.firstElementChild.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; });
  root.addEventListener('pointerleave', () => btns.forEach((b) => { b.style.transform = ''; b.firstElementChild.style.transform = ''; }));
  const stop = loop((dt) => {
    rp.x += (m.x - rp.x) * Math.min(1, dt * 12); rp.y += (m.y - rp.y) * Math.min(1, dt * 12);
    cur.style.transform = `translate(${m.x}px,${m.y}px)`; ring.style.transform = `translate(${rp.x}px,${rp.y}px)`;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = trail.length - 1; i >= 0; i--) { const t = trail[i]; t.life -= dt * 1.8; if (t.life <= 0) { trail.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${200 + i * 2},90%,65%,${t.life * .6})`; ctx.beginPath(); ctx.arc(t.x, t.y, 10 * t.life, 0, 7); ctx.fill(); }
  });
  return () => { stop(); ro.disconnect(); rm(); host.innerHTML = ''; };
}
