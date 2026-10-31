import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-text',
    title: '文字特效实验室',
    fallbackVariant: 'text-lab',
    params: defaultParams({color:true,speed:true,size:true}),
    mapVariant: (family, n) => `t-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 't-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-replay>Replay</button>`);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.kt{position:absolute;inset:0;display:grid;place-items:center;padding:24px;overflow:auto}
  .kt .t{font-size:calc(clamp(28px,6vw,56px) * var(--sz, 1));color:var(--c);font-weight:800;letter-spacing:.04em;text-align:center;line-height:1.2}
  .kt .chars span{display:inline-block}
  @keyframes glitch{0%{transform:translate(0);text-shadow:2px 0 #f0f,-2px 0 #0ff}20%{transform:translate(-2px,1px)}40%{transform:translate(2px,-1px)}100%{transform:translate(0)}}
  .kt .glitch{animation:glitch calc(.4s / var(--spd, 1)) infinite;color:var(--c)}
  .kt .grad{background:linear-gradient(90deg,var(--c),#22d3ee,#f472b6,var(--c));background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:flow calc(4s / var(--spd, 1)) linear infinite}
  @keyframes flow{to{background-position:300% 0}}
  .kt .neon{color:#fff;text-shadow:0 0 6px var(--c),0 0 18px var(--c),0 0 32px var(--c)}
  .kt .wave span{animation:wv calc(1.2s / var(--spd, 1)) ease-in-out infinite}
  @keyframes wv{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  .kt .outline{-webkit-text-stroke:2px var(--c);color:transparent}
  `);
  const root = document.createElement('div'); root.className = 'kt'; stage.appendChild(root);
  const text = 'Clyune Component';
  const kind = (n - 1) % 25;
  const split = (cls='') => `<div class="t chars ${cls}">${[...text].map((ch,i)=>`<span style="animation-delay:${i*0.04}s">${ch===' '?'&nbsp;':ch}</span>`).join('')}</div>`;
  const render = () => {
    if (kind === 0) { // typewriter
      root.innerHTML = `<div class="t" data-el></div>`;
      const el = root.querySelector('[data-el]'); let i = 0;
      const timer = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(timer); }, 60);
      root._timer = timer;
    } else if (kind === 1) root.innerHTML = `<div class="t glitch">${text}</div>`;
    else if (kind === 2) root.innerHTML = `<div class="t grad">${text}</div>`;
    else if (kind === 3) root.innerHTML = `<div class="t outline">${text}</div>`;
    else if (kind === 4 || kind === 5) root.innerHTML = split() + `<style>.kt .chars span{opacity:0;animation:fadeIn .5s forwards}@keyframes fadeIn{to{opacity:1;transform:none}} .kt .chars span{transform:translateY(${kind===4?20:-10}px)}</style>`;
    else if (kind === 8) root.innerHTML = split('wave');
    else if (kind === 10) root.innerHTML = `<div class="t neon">${text}</div>`;
    else if (kind === 12) { // counter
      root.innerHTML = `<div class="t" data-el>0</div>`;
      const el = root.querySelector('[data-el]'); let v = 0; const target = 1280 + n * 17;
      const timer = setInterval(() => { v += Math.ceil((target - v) / 8); el.textContent = String(v); if (v >= target) clearInterval(timer); }, 40);
      root._timer = timer;
    } else if (kind === 13) {
      root.innerHTML = `<div class="t" data-el></div>`;
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const el = root.querySelector('[data-el]'); let frame = 0;
      const timer = setInterval(() => {
        frame++;
        el.textContent = [...text].map((ch, i) => ch === ' ' ? ' ' : (i < frame / 2 ? text[i] : glyphs[(Math.random() * glyphs.length) | 0])).join('');
        if (frame > text.length * 2 + 10) clearInterval(timer);
      }, 40);
      root._timer = timer;
    } else root.innerHTML = `<div class="t" style="color:var(--c)">${text}</div>`;
  };
  render();
  host.querySelector('[data-replay]')?.addEventListener('click', () => { if (root._timer) clearInterval(root._timer); render(); });
  const sync = setInterval(() => {
    const L = live();
    root.style.setProperty('--c', L.color);
    root.style.setProperty('--spd', String(L.speed));
    root.style.setProperty('--sz', String(L.size));
    stage.style.setProperty('--c', L.color);
  }, 80);
  return () => { clearInterval(sync); if (root._timer) clearInterval(root._timer); rm(); host.innerHTML = ''; };
}

