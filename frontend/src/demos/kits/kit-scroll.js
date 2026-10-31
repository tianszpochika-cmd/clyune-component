import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-scroll',
    title: '滚动特效实验室',
    fallbackVariant: 'scroll-lab',
    params: defaultParams({color:true,speed:true}),
    mapVariant: (family, n) => `s-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 's-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id);
  const rm = addStyle(`.ksc{position:absolute;inset:0;overflow:auto;scroll-behavior:smooth}
  .ksc .progress{position:sticky;top:0;height:3px;background:#24314f;z-index:5}
  .ksc .progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,${hsl(n)},#22d3ee)}
  .ksc .sec{min-height:70%;padding:48px 24px;border-bottom:1px solid #24314f;display:grid;align-content:center;gap:12px}
  .ksc .sec h3{margin:0;font-size:22px} .ksc .sec p{margin:0;color:var(--muted);max-width:520px;line-height:1.6}
  .ksc .card{background:#18233d;border:1px solid #24314f;border-radius:14px;padding:18px;transform:translateY(24px);opacity:.35;transition:.5s}
  .ksc .card.in{transform:none;opacity:1}
  .ksc .parallax{height:180px;border-radius:14px;background:linear-gradient(135deg,${hsl(n)},#22d3ee);background-attachment:local;transform:translateY(calc(var(--p,0)*40px))}
  .ksc .stack{position:sticky;top:40px;background:#121a2f;border:1px solid #24314f;border-radius:14px;padding:20px;margin:12px 0}
  .ksc .gallery{display:flex;gap:12px;overflow:auto;padding-bottom:8px}.ksc .gallery div{flex:0 0 180px;height:120px;border-radius:12px;background:#18233d;border:1px solid #24314f}
  .ksc .totop{position:sticky;bottom:16px;justify-self:end;margin:0 16px 0 auto}
  `);
  const root = document.createElement('div'); root.className = 'ksc'; stage.appendChild(root);
  const kind = (n - 1) % 20;
  const sections = Array.from({ length: 6 }, (_, i) => `<section class="sec" data-sec><h3>Section ${i + 1}</h3><p>滚动特效演示 ${id} — 在本面板内滚动查看视差 / 揭示 / 进度。</p><div class="card" data-c>Reveal card #${i + 1}</div>${kind===0||kind===10?`<div class="parallax" data-p></div>`:''}${kind===6?`<div class="stack">Sticky stack ${i+1}</div>`:''}</section>`).join('');
  root.innerHTML = `<div class="progress"><i data-bar></div>${kind===5?`<div class="gallery">${[1,2,3,4,5,6].map(i=>`<div style="background:color-mix(in srgb,${hsl(n+i)} 40%,#18233d)"></div>`).join('')}</div>`:''}${sections}<button class="btn totop" data-top>↑ Top</button>`;
  const barEl = root.querySelector('[data-bar]');
  const onScroll = () => {
    const max = root.scrollHeight - root.clientHeight || 1;
    const p = root.scrollTop / max;
    barEl.style.width = (p * 100) + '%';
    root.querySelectorAll('[data-p]').forEach(el => el.style.setProperty('--p', String(p)));
    root.querySelectorAll('[data-c]').forEach(el => {
      const r = el.getBoundingClientRect(); const hr = root.getBoundingClientRect();
      if (r.top < hr.bottom - 40) el.classList.add('in');
    });
  };
  root.addEventListener('scroll', onScroll, { passive: true });
  root.querySelector('[data-top]')?.addEventListener('click', () => { root.scrollTo({ top: 0, behavior: 'smooth' }); });
  onScroll();
  return () => { rm(); host.innerHTML = ''; };
}
