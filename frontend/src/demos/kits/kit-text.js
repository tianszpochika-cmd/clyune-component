import { addStyle, bar, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const FAMILIES = ["typewriter", "glitch", "gradient", "outline", "split-fall", "bounce-in", "blur-clear", "mirror", "wave-text", "perspective", "neon-text", "scramble", "counter", "decode", "ribbon", "handwrite", "karaoke", "vertical", "pageflip", "liquid", "pixel", "smoke", "magnetic", "rainbow"];
export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'typewriter').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'typewriter';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-text',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({ color: true, speed: true, size: true }),
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'typewriter-1';
  const partsId = String(id).split('-');
  const last = partsId[partsId.length - 1];
  let family = /^\d+$/.test(last) ? partsId.slice(0, -1).join('-') : String(id);
  if (!FAMILIES.includes(family)) {
    const num = parseInt(String(id).split('-').pop(), 10) || 1;
    family = FAMILIES[(num - 1) % FAMILIES.length];
  }
  const n = FAMILIES.indexOf(family) + 1;
  const { stage } = bar(host, id, `<button class="btn" data-replay>Replay</button>`);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.kt{position:absolute;inset:0;display:grid;place-items:center;padding:24px;overflow:auto}
  .kt .t{font-size:calc(clamp(28px,6vw,56px) * var(--sz, 1));color:var(--c);font-weight:800;letter-spacing:.04em;text-align:center;line-height:1.2}
  .kt .chars span{display:inline-block}
  @keyframes glitch{0%{transform:translate(0);text-shadow:2px 0 #f0f,-2px 0 #0ff}20%{transform:translate(-2px,1px)}40%{transform:translate(2px,-1px)}100%{transform:translate(0)}}
  .kt .glitch{animation:glitch calc(.4s / var(--spd, 1)) infinite}
  .kt .grad{background:linear-gradient(90deg,var(--c),#22d3ee,#f472b6,var(--c));background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:flow calc(4s / var(--spd, 1)) linear infinite}
  @keyframes flow{to{background-position:300% 0}}
  .kt .neon{color:#fff;text-shadow:0 0 6px var(--c),0 0 18px var(--c),0 0 32px var(--c)}
  .kt .wave span{animation:wv calc(1.2s / var(--spd, 1)) ease-in-out infinite}
  @keyframes wv{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  .kt .outline{-webkit-text-stroke:2px var(--c);color:transparent}
  .kt .flip3d{transform-style:preserve-3d;animation:flip3d calc(2.4s / var(--spd,1)) ease-in-out infinite}
  @keyframes flip3d{0%,100%{transform:perspective(600px) rotateY(0)}50%{transform:perspective(600px) rotateY(180deg)}}
  .kt .blurin{filter:blur(8px);animation:blin calc(1.2s / var(--spd,1)) forwards}
  @keyframes blin{to{filter:blur(0)}}
  .kt .mirror{transform:scaleX(-1);animation:unmir calc(1s / var(--spd,1)) forwards}
  @keyframes unmir{to{transform:none}}
  .kt .karaoke span{opacity:.35}.kt .karaoke span.on{opacity:1;color:#fff;text-shadow:0 0 12px var(--c)}
  .kt .vert{writing-mode:vertical-rl;letter-spacing:.2em}
  .kt .pixel{image-rendering:pixelated;font-family:ui-monospace,monospace;letter-spacing:0}
  .kt .smoke{animation:smk calc(2s / var(--spd,1)) forwards}
  @keyframes smk{to{opacity:0;filter:blur(12px);transform:translateY(-24px) scale(1.08)}}
  .kt .rainbow span{animation:rb calc(1.5s / var(--spd,1)) linear infinite}
  @keyframes rb{0%,100%{color:var(--c);transform:translateY(0)}50%{color:#22d3ee;transform:translateY(-8px)}}
  .kt .whack span{cursor:pointer;transition:transform .15s}.kt .whack span:hover{transform:scale(1.35);color:#fff}
  `);
  const root = document.createElement('div'); root.className = 'kt'; stage.appendChild(root);
  const text = 'Clyune Component';
  const kind = (n - 1) % 25;
  const split = (cls = '') =>
    `<div class="t chars ${cls}">${[...text].map((ch, i) => `<span style="animation-delay:${i * 0.04}s">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</div>`;

  const render = () => {
    if (root._timer) { clearInterval(root._timer); root._timer = null; }
    root.onpointermove = null;
    if (kind === 0) {
      root.innerHTML = `<div class="t" data-el></div>`;
      const el = root.querySelector('[data-el]'); let i = 0;
      root._timer = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(root._timer); }, Math.max(20, 70 / (live().speed || 1)));
    } else if (kind === 1) root.innerHTML = `<div class="t glitch">${text}</div>`;
    else if (kind === 2) root.innerHTML = `<div class="t grad">${text}</div>`;
    else if (kind === 3) root.innerHTML = `<div class="t outline">${text}</div>`;
    else if (kind === 4) root.innerHTML = split() + `<style>.kt .chars span{opacity:0;transform:translateY(24px);animation:fadeIn calc(.55s / var(--spd,1)) forwards}@keyframes fadeIn{to{opacity:1;transform:none}}</style>`;
    else if (kind === 5) root.innerHTML = split() + `<style>.kt .chars span{opacity:0;transform:scale(.4);animation:popIn calc(.55s / var(--spd,1)) cubic-bezier(.2,1.4,.4,1) forwards}@keyframes popIn{to{opacity:1;transform:none}}</style>`;
    else if (kind === 6) root.innerHTML = `<div class="t blurin">${text}</div>`;
    else if (kind === 7) root.innerHTML = `<div class="t mirror">${text}</div>`;
    else if (kind === 8) root.innerHTML = split('wave');
    else if (kind === 9) root.innerHTML = `<div class="t flip3d">${text}</div>`;
    else if (kind === 10) root.innerHTML = `<div class="t neon">${text}</div>`;
    else if (kind === 11) root.innerHTML = split() + `<style>.kt .chars span{opacity:0;transform:rotate(12deg) translateY(-16px);animation:rejoin calc(.5s / var(--spd,1)) forwards}@keyframes rejoin{to{opacity:1;transform:none}}</style>`;
    else if (kind === 12) {
      root.innerHTML = `<div class="t" data-el>0</div>`;
      const el = root.querySelector('[data-el]'); let v = 0; const target = 1280 + n * 17;
      root._timer = setInterval(() => { v += Math.ceil((target - v) / 8); el.textContent = String(v); if (v >= target) clearInterval(root._timer); }, 40);
    } else if (kind === 13) {
      root.innerHTML = `<div class="t" data-el></div>`;
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const el = root.querySelector('[data-el]'); let frame = 0;
      root._timer = setInterval(() => {
        frame++;
        el.textContent = [...text].map((ch, i) => ch === ' ' ? ' ' : (i < frame / 2 ? text[i] : glyphs[(Math.random() * glyphs.length) | 0])).join('');
        if (frame > text.length * 2 + 10) clearInterval(root._timer);
      }, 40);
    } else if (kind === 14) {
      root.innerHTML = `<div class="t" style="background:linear-gradient(90deg,transparent 0%,var(--c) 50%,transparent 100%);-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% 100%;animation:flow calc(2.5s / var(--spd,1)) linear infinite">${text}</div>`;
    } else if (kind === 15) {
      root.innerHTML = `<div class="t outline" data-el style="overflow:hidden;white-space:nowrap;border-right:2px solid var(--c)"></div>`;
      const el = root.querySelector('[data-el]'); let i = 0;
      root._timer = setInterval(() => { i++; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(root._timer); }, 80);
    } else if (kind === 16) {
      root.innerHTML = split('karaoke');
      const spans = [...root.querySelectorAll('span')]; let i = 0;
      root._timer = setInterval(() => { spans.forEach((s, j) => s.classList.toggle('on', j <= i)); i = (i + 1) % spans.length; }, Math.max(80, 220 / (live().speed || 1)));
    } else if (kind === 17) root.innerHTML = `<div class="t vert">${text}</div>`;
    else if (kind === 18) root.innerHTML = `<div class="t flip3d" style="animation-duration:calc(1.1s / var(--spd,1))">${text}</div>`;
    else if (kind === 19) root.innerHTML = split() + `<style>.kt .chars span{display:inline-block;animation:liq calc(1.4s / var(--spd,1)) ease-in-out infinite}@keyframes liq{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.15)}}</style>`;
    else if (kind === 20) root.innerHTML = `<div class="t pixel" style="font-size:calc(clamp(22px,5vw,42px) * var(--sz,1));letter-spacing:.12em">${text}</div>`;
    else if (kind === 21) root.innerHTML = `<div class="t smoke">${text}</div>`;
    else if (kind === 22) {
      root.innerHTML = split('whack');
      root.onpointermove = (e) => {
        root.querySelectorAll('span').forEach((s) => {
          const r = s.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy) || 1;
          if (d < 80) s.style.transform = `translate(${dx * 0.2}px,${dy * 0.2}px)`; else s.style.transform = '';
        });
      };
    } else if (kind === 23) root.innerHTML = split('rainbow');
    else root.innerHTML = split('whack');
  };
  render();
  host.querySelector('[data-replay]')?.addEventListener('click', () => render());
  const sync = setInterval(() => {
    const L = live();
    root.style.setProperty('--c', L.color);
    root.style.setProperty('--spd', String(L.speed));
    root.style.setProperty('--sz', String(L.size));
    stage.style.setProperty('--c', L.color);
  }, 80);
  return () => { clearInterval(sync); if (root._timer) clearInterval(root._timer); rm(); host.innerHTML = ''; };
}
