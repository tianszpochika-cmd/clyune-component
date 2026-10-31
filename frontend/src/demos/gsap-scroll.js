import { libs } from '../lib/load.js';
import { addStyle } from '../lib/canvas.js';
export async function mount(host) {
  const ScrollTrigger = await libs.scrollTrigger();
  const gsap = window.gsap;
  gsap.registerPlugin(ScrollTrigger);
  const rm = addStyle(`
  .gs { position:absolute; inset:0; overflow:auto; overflow-x:hidden; }
  .gs-bar { position:sticky; top:0; z-index:5; height:4px; background:linear-gradient(90deg,#f472b6,#818cf8,#22d3ee); transform-origin:0 50%; transform:scaleX(0); }
  .gs-sec { min-height:100%; display:grid; place-items:center; padding:40px 20px; position:relative; overflow:hidden; }
  .gs-sec h3 { font-size:clamp(26px,6vw,48px); margin:0; text-align:center; }
  .gs-sec p { color:var(--muted); text-align:center; }
  .gs-par { position:absolute; border-radius:50%; filter:blur(2px); opacity:.6; }
  .gs-pin { height:100%; display:flex; align-items:center; overflow:hidden; }
  .gs-track { display:flex; gap:20px; padding:0 40px; }
  .gs-panel { flex:none; width:min(300px,70vw); height:220px; border-radius:18px; display:flex; flex-direction:column; justify-content:flex-end; padding:20px; color:#fff; font-weight:700; font-size:20px; }
  .gs-panel small { font-weight:400; font-size:12px; opacity:.8; }
  .gs-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; width:min(520px,90%); }
  .gs-grid div { aspect-ratio:1; border-radius:12px; background:#18233d; border:1px solid #24314f; }
  .gs-counter { font-size:clamp(40px,10vw,90px); font-weight:800; background:linear-gradient(90deg,#818cf8,#22d3ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
  `);
  const colors = ['#4f46e5', '#0891b2', '#db2777', '#059669', '#d97706', '#7c3aed'];
  host.innerHTML = `<div class="gs" id="gs"><div class="gs-bar"></div>
    <section class="gs-sec"><div class="gs-par" style="width:180px;height:180px;background:#818cf8;left:10%;top:15%" data-speed="-200"></div><div class="gs-par" style="width:120px;height:120px;background:#22d3ee;right:12%;top:55%" data-speed="160"></div><div class="gs-par" style="width:70px;height:70px;background:#f472b6;left:55%;bottom:10%" data-speed="-120"></div><div><h3>ScrollTrigger</h3><p>向下滚动 ↓ 视差 · 固定横滑 · 交错显现 · 数字滚动</p></div></section>
    <section class="gs-sec" style="padding:0;display:block" id="gsPinSec"><div class="gs-pin"><div class="gs-track" id="gsTrack">${colors.map((c, i) => `<div class="gs-panel" style="background:linear-gradient(160deg,${c},#0b1020)">Panel ${i + 1}<small>pin + scrub 横向滚动</small></div>`).join('')}</div></div></section>
    <section class="gs-sec"><div style="display:grid;place-items:center;gap:20px;width:100%"><p>stagger 网格显现</p><div class="gs-grid" id="gsGrid">${'<div></div>'.repeat(16)}</div></div></section>
    <section class="gs-sec"><div style="text-align:center"><div class="gs-counter" id="gsNum">0</div><p>scrub 驱动的数字</p></div></section>
    <div style="height:30vh"></div></div>`;
  const scroller = host.querySelector('#gs');
  const ctx = gsap.context(() => {
    gsap.to('.gs-bar', { scaleX: 1, ease: 'none', scrollTrigger: { scroller, start: 0, end: 'max', scrub: true } });
    gsap.utils.toArray('.gs-par').forEach((el) => gsap.to(el, { y: +el.dataset.speed, ease: 'none', scrollTrigger: { scroller, trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: true } }));
    const track = host.querySelector('#gsTrack');
    gsap.to(track, { x: () => -(track.scrollWidth - scroller.clientWidth), ease: 'none',
      scrollTrigger: { scroller, trigger: '#gsPinSec', start: 'top top', end: () => '+=' + track.scrollWidth, pin: true, scrub: 1, invalidateOnRefresh: true } });
    gsap.from('#gsGrid div', { scale: 0, rotation: 90, opacity: 0, background: '#818cf8', stagger: { each: .05, grid: [4, 4], from: 'center' }, duration: .6, ease: 'back.out(1.7)',
      scrollTrigger: { scroller, trigger: '#gsGrid', start: 'top 80%', toggleActions: 'play none none reverse' } });
    const num = { v: 0 }, el = host.querySelector('#gsNum');
    gsap.to(num, { v: 98765, ease: 'none', onUpdate: () => { el.textContent = Math.round(num.v).toLocaleString(); },
      scrollTrigger: { scroller, trigger: el, start: 'top 90%', end: 'top 30%', scrub: true } });
  }, host);
  const ro = new ResizeObserver(() => ScrollTrigger.refresh());
  ro.observe(scroller);
  return () => { ro.disconnect(); ctx.revert(); rm(); host.innerHTML = ''; };
}
