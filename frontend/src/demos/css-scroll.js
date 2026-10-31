import { addStyle } from '../lib/canvas.js';
import { readLiveControls } from './kits/_shared.js';
export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const supports = CSS.supports('animation-timeline: view()');
  const rm = addStyle(`
  .cs { position:absolute; inset:0; overflow:auto; scroll-timeline:--cs y; }
  .cs-progress { position:sticky; top:0; height:4px; z-index:3; background:linear-gradient(90deg,var(--c, #818cf8),#22d3ee); transform-origin:0 50%; transform:scaleX(0); }
  .cs-intro { min-height:70%; display:grid; place-items:center; text-align:center; padding:40px 20px; color:var(--muted); }
  .cs-intro h3 { color:var(--text); font-size:26px; margin:0 0 8px; }
  .cs-list { max-width:620px; margin:0 auto; padding:0 18px 60vh; display:grid; gap:22px; }
  .cs-item { padding:22px; border-radius:16px; background:#18233d; border:1px solid #24314f; color:var(--text); }
  .cs-item h4 { margin:0 0 6px; } .cs-item p { margin:0; color:var(--muted); font-size:13px; line-height:1.6; }
  .cs-item.alt { background:linear-gradient(135deg,rgba(129,140,248,.2),rgba(34,211,238,.12)); }
  .cs-mode { position:absolute; right:12px; top:12px; z-index:4; font-size:11px; color:var(--accent-2); background:rgba(18,26,47,.9); border:1px solid var(--border); padding:4px 10px; border-radius:999px; }
  @keyframes cs-reveal { from { opacity:0; transform:translateY(60px) scale(.92) rotate(-2deg); filter:blur(6px); } to { opacity:1; transform:none; filter:none; } }
  @keyframes cs-grow { to { transform:scaleX(1); } }
  @supports (animation-timeline: view()) {
    .cs-item { animation:cs-reveal linear both; animation-timeline:view(); animation-range:entry 0% cover 35%; }
    .cs-progress { animation:cs-grow linear both; animation-timeline:--cs; }
  }
  .cs-io .cs-item { opacity:0; transform:translateY(60px) scale(.92); transition:opacity .6s, transform .6s cubic-bezier(.2,.7,.2,1); }
  .cs-io .cs-item.in { opacity:1; transform:none; }
  `);
  const items = Array.from({ length: 10 }, (_, i) => `<div class="cs-item ${i % 3 === 1 ? 'alt' : ''}"><h4>Section ${i + 1}</h4><p>${['元素进入视口时淡入、上移并去模糊。','animation-range 控制动画在滚动的哪一段播放。','顶部进度条由 scroll-timeline 驱动。','无需 JavaScript，完全由浏览器合成线程驱动。'][i % 4]}</p></div>`).join('');
  host.innerHTML = `<div class="cs ${supports ? '' : 'cs-io'}" id="cs"><div class="cs-progress" id="csBar"></div><span class="cs-mode">${supports ? 'animation-timeline: view()' : 'IntersectionObserver 回退'}</span>
    <div class="cs-intro"><div><h3>向下滚动 ↓</h3><p>Scroll-driven Animations</p></div></div><div class="cs-list">${items}</div></div>`;
  const root = host.querySelector('#cs');
  let io, onScroll;
  if (!supports) {
    io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { root, threshold: .2 });
    root.querySelectorAll('.cs-item').forEach((el) => io.observe(el));
    const bar = host.querySelector('#csBar');
    onScroll = () => { bar.style.transform = `scaleX(${root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight)})`; };
    root.addEventListener('scroll', onScroll, { passive: true });
  }
  const rootEl = host.firstElementChild || host;
  const sync = setInterval(() => {
    const L = readLiveControls([host, host.parentElement, rootEl], ctrl);
    rootEl.style.setProperty('--c', L.color);
    rootEl.style.setProperty('--spd', String(L.speed));
    rootEl.style.setProperty('--sz', String(L.size));
  }, 80);
  return () => { clearInterval(sync);  io && io.disconnect(); rm(); host.innerHTML = ''; };
}
