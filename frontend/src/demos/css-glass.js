import { addStyle } from '../lib/canvas.js';
import { readLiveControls } from './kits/_shared.js';
export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const rm = addStyle(`
  .cg { position:absolute; inset:0; overflow:hidden; background:#0b1020; --blur:16px; --alpha:.12; }
  .cg-blob { position:absolute; border-radius:50%; filter:blur(4px); animation:cg-move 14s ease-in-out infinite alternate; }
  .cg-b1 { width:260px; height:260px; background:radial-gradient(circle at 30% 30%,#f472b6,#7c3aed); left:8%; top:10%; }
  .cg-b2 { width:320px; height:320px; background:radial-gradient(circle at 30% 30%,#22d3ee,#2563eb); right:6%; bottom:4%; animation-delay:-5s; }
  .cg-b3 { width:180px; height:180px; background:radial-gradient(circle at 30% 30%,#fbbf24,#ea580c); left:45%; top:45%; animation-delay:-9s; }
  @keyframes cg-move { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.1)} 100%{transform:translate(-40px,50px) scale(.92)} }
  .cg-stage { position:absolute; inset:0; display:flex; flex-wrap:wrap; gap:18px; align-items:center; justify-content:center; padding:70px 20px 20px; overflow:auto; }
  .cg-card { width:min(300px,90%); padding:22px; border-radius:20px; color:#fff;
    background:rgba(255,255,255,var(--alpha)); border:1px solid rgba(255,255,255,.25);
    backdrop-filter:blur(var(--blur)) saturate(160%); -webkit-backdrop-filter:blur(var(--blur)) saturate(160%);
    box-shadow:0 8px 32px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.35); }
  .cg-card h4 { margin:0 0 6px; font-size:18px; } .cg-card p { margin:0 0 14px; font-size:13px; opacity:.85; line-height:1.6; }
  .cg-chip { display:inline-block; padding:4px 10px; border-radius:999px; background:rgba(255,255,255,.18); font-size:11px; margin-right:6px; }
  .cg-num { font-size:34px; font-weight:800; }
  .cg-row { display:flex; justify-content:space-between; align-items:center; }
  .cg-avatar { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#f472b6,var(--c, #818cf8)); border:2px solid rgba(255,255,255,.6); }
  `);
  host.innerHTML = `<div class="cg" id="cg">
    <div class="cg-blob cg-b1"></div><div class="cg-blob cg-b2"></div><div class="cg-blob cg-b3"></div>
    <div class="fx-bar">
      <label>模糊 <input type="range" id="cgBlur" min="0" max="40" value="16"></label>
      <label>透明 <input type="range" id="cgAlpha" min="0" max="40" value="12"></label>
    </div>
    <div class="cg-stage">
      <div class="cg-card"><div class="cg-row"><div><h4>云澜 Dashboard</h4><p>毛玻璃信息卡片</p></div><div class="cg-avatar"></div></div><span class="cg-chip">backdrop-filter</span><span class="cg-chip">saturate</span></div>
      <div class="cg-card"><p>本月活跃用户</p><div class="cg-num">12,846</div><p style="margin:6px 0 0">较上月 ↑ 18.2%</p></div>
      <div class="cg-card"><h4>Glassmorphism</h4><p>半透明背景 + 背景模糊 + 细边框高光，营造层次感。</p><button class="btn">了解更多</button></div>
    </div></div>`;
  const root = host.querySelector('#cg');
  host.querySelector('#cgBlur').addEventListener('input', (e) => root.style.setProperty('--blur', e.target.value + 'px'));
  host.querySelector('#cgAlpha').addEventListener('input', (e) => root.style.setProperty('--alpha', e.target.value / 100));
  const rootEl = host.firstElementChild || host;
  const sync = setInterval(() => {
    const L = readLiveControls([host, host.parentElement, rootEl], ctrl);
    rootEl.style.setProperty('--c', L.color);
    rootEl.style.setProperty('--spd', String(L.speed));
    rootEl.style.setProperty('--sz', String(L.size));
  }, 80);
  return () => { clearInterval(sync);  rm(); host.innerHTML = ''; };
}
