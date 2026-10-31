import { addStyle, bar, hsl, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-scroll',
    title: '滚动特效实验室',
    fallbackVariant: 'scroll-lab',
    params: defaultParams({ color: true, speed: true }),
    mapVariant: (_family, n) => `s-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 's-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.ksc{position:absolute;inset:0;overflow:auto;scroll-behavior:smooth}
  .ksc .progress{position:sticky;top:0;height:3px;background:#24314f;z-index:5}
  .ksc .progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--c),#22d3ee)}
  .ksc .sec{min-height:70%;padding:48px 24px;border-bottom:1px solid #24314f;display:grid;align-content:center;gap:12px;position:relative}
  .ksc .sec h3{margin:0;font-size:22px;color:#e8eefc} .ksc .sec p{margin:0;color:#93a0c0;max-width:520px;line-height:1.6}
  .ksc .card{background:#18233d;border:1px solid #24314f;border-radius:14px;padding:18px;transform:translateY(24px);opacity:.35;transition:calc(.5s / var(--spd, 1))}
  .ksc .card.in{transform:none;opacity:1}
  .ksc .parallax{height:180px;border-radius:14px;background:linear-gradient(135deg,var(--c),#22d3ee);transform:translateY(calc(var(--p,0)*40px))}
  .ksc .stack{position:sticky;top:40px;background:#121a2f;border:1px solid #24314f;border-radius:14px;padding:20px;margin:12px 0}
  .ksc .gallery{display:flex;gap:12px;overflow:auto;padding-bottom:8px}.ksc .gallery div{flex:0 0 180px;height:120px;border-radius:12px;background:#18233d;border:1px solid #24314f}
  .ksc .totop{position:sticky;bottom:16px;justify-self:end;margin:0 16px 0 auto}
  .ksc .scalein{transform:scale(.85);opacity:.4;transition:calc(.55s / var(--spd,1))}.ksc .scalein.in{transform:none;opacity:1}
  .ksc .wipe{clip-path:inset(0 100% 0 0);transition:clip-path calc(.6s / var(--spd,1))}.ksc .wipe.in{clip-path:inset(0 0 0 0)}
  .ksc .path{stroke:var(--c);stroke-width:3;fill:none;stroke-dasharray:400;stroke-dashoffset:calc(400 * (1 - var(--p,0)))}
  .ksc .num{font-size:42px;font-weight:800;color:var(--c)}
  .ksc .split{display:grid;grid-template-columns:1fr 1fr;min-height:50%;gap:0}.ksc .split > div{padding:24px}
  .ksc .toc{position:sticky;top:12px;display:flex;gap:8px;flex-wrap:wrap;z-index:4}
  .ksc .toc button{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid #24314f;background:#121a2f;color:#93a0c0;cursor:pointer}
  .ksc .toc button.on{border-color:var(--c);color:#fff;background:color-mix(in srgb,var(--c) 25%,#121a2f)}
  .ksc .cover{position:sticky;top:0;height:40%;display:grid;place-items:center;background:linear-gradient(180deg,var(--c),#060a14);z-index:1;font-weight:800;font-size:28px;color:#0b1020}
  .ksc .tl{border-left:2px solid #24314f;padding-left:16px;margin:8px 0}.ksc .tl b{color:var(--c)}
  .ksc .gridx{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ksc .gridx div{height:72px;border-radius:10px;background:#18233d;border:1px solid #24314f;opacity:.3;transform:translateY(16px);transition:calc(.45s / var(--spd,1))}
  .ksc .gridx div.in{opacity:1;transform:none}
  .ksc .story{font-size:18px;line-height:1.7;color:#c5d0ea}
  `);
  const root = document.createElement('div'); root.className = 'ksc'; stage.appendChild(root);
  const kind = (n - 1) % 20;
  const N = 6;
  const secHtml = Array.from({ length: N }, (_, i) => {
    const base = `<section class="sec" data-sec id="sec-${i}"><h3>Section ${i + 1}</h3><p>滚动特效 ${id} — 面板内滚动查看。</p>`;
    if (kind === 0 || kind === 10) return `${base}<div class="parallax" data-p></div><div class="card" data-c>Reveal #${i + 1}</div></section>`;
    if (kind === 3) return `${base}<div class="card" data-c>Fade reveal #${i + 1}</div></section>`;
    if (kind === 4) return `${base}<div class="card scalein" data-c>Scale in #${i + 1}</div></section>`;
    if (kind === 6) return `${base}<div class="stack">Sticky stack ${i + 1}</div></section>`;
    if (kind === 7) return `${base}<div class="card wipe" data-c>${'文字擦除演示 '.repeat(3)}</div></section>`;
    if (kind === 8) return `${base}<svg width="100%" height="80" viewBox="0 0 400 80"><path class="path" d="M10 40 C 80 10, 120 70, 200 40 S 320 10, 390 40"/></svg></section>`;
    if (kind === 9) return `${base}<div class="num" data-num data-target="${(i + 1) * 240}">0</div></section>`;
    if (kind === 11) return `<section class="sec split" data-sec id="sec-${i}"><div style="background:color-mix(in srgb,var(--c) 35%,#121a2f)">Left ${i + 1}</div><div class="card" data-c>Right panel ${i + 1}</div></section>`;
    if (kind === 14) return i === 0 ? `<div class="cover">Cover · scroll</div>${base}<div class="card" data-c>Under cover</div></section>` : `${base}<div class="card" data-c>Card ${i + 1}</div></section>`;
    if (kind === 15) return `${base}<div class="tl"><b>Step ${i + 1}</b><p>时间线节点内容</p></div></section>`;
    if (kind === 16) return `${base}<div class="card" data-c style="height:120px;background:linear-gradient(135deg,#18233d,color-mix(in srgb,var(--c) 40%,#18233d))"></div></section>`;
    if (kind === 17) return `${base}<div class="gridx">${[1, 2, 3, 4, 5, 6].map((j) => `<div data-c style="transition-delay:${j * 0.05}s"></div>`).join('')}</div></section>`;
    if (kind === 19) return `${base}<div class="story card" data-c>叙事段落 ${i + 1}：滚动驱动的章节推进，适合落地页长文。</div></section>`;
    return `${base}<div class="card" data-c>Card #${i + 1}</div></section>`;
  }).join('');

  const toc = kind === 13
    ? `<div class="toc">${Array.from({ length: N }, (_, i) => `<button type="button" data-toc="${i}">§${i + 1}</button>`).join('')}</div>`
    : '';
  const gallery = kind === 5
    ? `<div class="gallery">${[1, 2, 3, 4, 5, 6].map((i) => `<div style="background:color-mix(in srgb,${hsl(n + i)} 40%,#18233d)"></div>`).join('')}</div>`
    : '';
  const pin = kind === 2 ? `<div class="stack" style="top:8px">章节钉住 · 继续向下滚</div>` : '';

  root.innerHTML = `<div class="progress"><i data-bar></i></div>${toc}${pin}${gallery}${secHtml}<button class="btn totop" data-top>↑ Top</button>`;
  const barEl = root.querySelector('[data-bar]');
  const onScroll = () => {
    const max = root.scrollHeight - root.clientHeight || 1;
    const p = root.scrollTop / max;
    if (barEl) barEl.style.width = `${p * 100}%`;
    root.style.setProperty('--p', String(p));
    if (kind === 10) {
      const hue = (n * 30 + p * 120) % 360;
      root.style.background = `hsl(${hue} 30% ${8 + p * 6}%)`;
    }
    root.querySelectorAll('[data-p]').forEach((el) => el.style.setProperty('--p', String(p)));
    root.querySelectorAll('[data-c]').forEach((el) => {
      const r = el.getBoundingClientRect(); const hr = root.getBoundingClientRect();
      if (r.top < hr.bottom - 40) el.classList.add('in');
    });
    root.querySelectorAll('[data-num]').forEach((el) => {
      const r = el.getBoundingClientRect(); const hr = root.getBoundingClientRect();
      if (r.top < hr.bottom - 20 && !el.dataset.done) {
        el.dataset.done = '1';
        const target = +el.dataset.target || 100; let v = 0;
        const t = setInterval(() => { v += Math.ceil((target - v) / 6); el.textContent = String(v); if (v >= target) clearInterval(t); }, 30);
      }
    });
    if (kind === 13) {
      let active = 0;
      root.querySelectorAll('[data-sec]').forEach((sec, i) => {
        const r = sec.getBoundingClientRect(); const hr = root.getBoundingClientRect();
        if (r.top < hr.top + hr.height * 0.35) active = i;
      });
      root.querySelectorAll('[data-toc]').forEach((b) => b.classList.toggle('on', +b.dataset.toc === active));
    }
    if (kind === 12 && !root._snapping) {
      const secs = [...root.querySelectorAll('[data-sec]')];
      const hr = root.getBoundingClientRect();
      let best = null; let bestD = 1e9;
      secs.forEach((s) => { const d = Math.abs(s.getBoundingClientRect().top - hr.top); if (d < bestD) { bestD = d; best = s; } });
      if (best && bestD < 48 && bestD > 4) {
        root._snapping = true;
        best.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { root._snapping = false; }, 400);
      }
    }
  };
  root.addEventListener('scroll', onScroll, { passive: true });
  root.querySelector('[data-top]')?.addEventListener('click', () => root.scrollTo({ top: 0, behavior: 'smooth' }));
  root.querySelectorAll('[data-toc]').forEach((b) => b.addEventListener('click', () => {
    root.querySelector(`#sec-${b.dataset.toc}`)?.scrollIntoView({ behavior: 'smooth' });
  }));
  onScroll();
  const sync = setInterval(() => {
    const L = live();
    root.style.setProperty('--c', L.color);
    root.style.setProperty('--spd', String(L.speed));
    stage.style.setProperty('--c', L.color);
  }, 80);
  return () => { clearInterval(sync); rm(); host.innerHTML = ''; };
}
