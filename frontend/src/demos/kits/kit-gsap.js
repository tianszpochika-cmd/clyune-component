import { addStyle, bar, hsl, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';
import { libs } from '../../lib/load.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-gsap',
    title: 'GSAP 序列',
    fallbackVariant: 'seq-1',
    params: defaultParams({color:true,speed:true}),
    mapVariant: (family, n) => `seq-${n}`,
    mountLegacy,
  });
}

async function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'seq-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-play>Play</button><button class="btn" data-rev>Reverse</button>`);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const gsap = await libs.gsap();
  const rm = addStyle(`.kg{position:absolute;inset:0;display:grid;place-items:center;gap:14px;padding:20px;overflow:auto}
  .kg .item{width:72px;height:72px;border-radius:16px;background:var(--c,${hsl(n)});display:grid;place-items:center;font-weight:700;color:#0b1020}
  .kg .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .kg .card{width:120px;height:80px;border-radius:12px;background:#18233d;border:1px solid #24314f}
  .kg .txt{font-size:clamp(28px,5vw,48px);font-weight:800;letter-spacing:.04em}
  .kg .ring{width:90px;height:90px;border-radius:50%;border:6px solid #24314f;border-top-color:var(--c,${hsl(n)})}`);
  const root = document.createElement('div'); root.className = 'kg'; stage.appendChild(root);
  const kind = (n - 1) % 10;
  let tl;
  if (kind === 0) {
    root.innerHTML = `<div class="item" data-el>BOING</div>`;
    tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.fromTo('[data-el]', { y: -80, scale: 0.6 }, { y: 0, scale: 1, duration: 0.7, ease: 'bounce.out' });
  } else if (kind === 1) {
    root.innerHTML = `<div class="row">${[0,1,2,3,4].map(i=>`<div class="card" data-c></div>`).join('')}</div>`;
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    tl.from('[data-c]', { y: 40, opacity: 0, stagger: 0.08, duration: 0.5, ease: 'power2.out' })
      .to('[data-c]', { y: -10, stagger: 0.05, duration: 0.35 }, '+=0.2')
      .to('[data-c]', { opacity: 0, y: -30, stagger: 0.05, duration: 0.35 });
  } else if (kind === 2) {
    root.innerHTML = `<div class="item" data-el>PATH</div>`;
    tl = gsap.timeline({ repeat: -1 });
    tl.to('[data-el]', { motionPath: undefined, x: 120, y: -40, duration: 0.8, ease: 'power1.inOut' })
      .to('[data-el]', { x: 0, y: 40, duration: 0.8 })
      .to('[data-el]', { x: -120, y: -20, duration: 0.8 })
      .to('[data-el]', { x: 0, y: 0, duration: 0.8 });
  } else if (kind === 3) {
    root.innerHTML = `<div class="item" data-el>OUT</div>`;
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
    tl.fromTo('[data-el]', { rotate: 0, scale: 1, opacity: 1 }, { rotate: 180, scale: 0, opacity: 0, duration: 0.8, ease: 'power3.in' })
      .set('[data-el]', { rotate: 0, scale: 0.2, opacity: 0 })
      .to('[data-el]', { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
  } else if (kind === 4) {
    root.innerHTML = `<div class="item" data-el>ELASTIC</div>`;
    tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to('[data-el]', { scale: 1.35, duration: 0.7, ease: 'elastic.out(1,0.4)' });
  } else if (kind === 5) {
    root.innerHTML = `<div class="item" data-el>FLASH</div>`;
    tl = gsap.timeline({ repeat: -1 });
    tl.to('[data-el]', { backgroundColor: '#22d3ee', duration: 0.25 })
      .to('[data-el]', { backgroundColor: hsl(n), duration: 0.25 })
      .to('[data-el]', { backgroundColor: '#f472b6', duration: 0.25 })
      .to('[data-el]', { backgroundColor: hsl(n), duration: 0.25 });
  } else if (kind === 6) {
    root.innerHTML = `<div class="row">${[0,1,2].map(()=>`<div class="card" data-c style="height:100px"></div>`).join('')}</div>`;
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    tl.to('[data-c]', { rotateY: 180, stagger: 0.12, duration: 0.6 }).to('[data-c]', { rotateY: 0, stagger: 0.12, duration: 0.6 });
  } else if (kind === 7) {
    root.innerHTML = `<div class="ring" data-el></div>`;
    tl = gsap.timeline({ repeat: -1 });
    tl.to('[data-el]', { rotate: 360, duration: 1, ease: 'none' });
  } else if (kind === 8) {
    root.innerHTML = `<div class="txt" data-el></div>`;
    const text = 'GSAP TYPE';
    const el = root.querySelector('[data-el]');
    tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
    tl.to({}, { duration: 0.05, onStart(){ el.textContent=''; }, onUpdate(){}, repeat: text.length, onRepeat(){ el.textContent = text.slice(0, (el.textContent?.length||0)+1); } });
    // simpler:
    tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
    for (let i = 0; i <= text.length; i++) tl.set(el, { textContent: text.slice(0, i) }, i * 0.08);
    tl.to({}, { duration: 0.8 });
    for (let i = text.length; i >= 0; i--) tl.set(el, { textContent: text.slice(0, i) }, '>');
  } else {
    root.innerHTML = `<div class="row" style="position:relative;height:160px;width:min(420px,90%)">
      <div class="card" data-a style="position:absolute;left:10%;top:20%"></div>
      <div class="card" data-b style="position:absolute;left:40%;top:40%;background:#1d2a4a"></div>
      <div class="card" data-c style="position:absolute;left:65%;top:15%;background:#24314f"></div></div>`;
    tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to('[data-a]', { y: 40, duration: 1.2 }).to('[data-b]', { y: -30, duration: 1.2 }, 0).to('[data-c]', { y: 50, duration: 1.2 }, 0);
  }
  host.querySelector('[data-play]')?.addEventListener('click', () => tl?.paused(!tl.paused()));
  host.querySelector('[data-rev]')?.addEventListener('click', () => tl?.reversed(!tl.reversed()));
  const sync = setInterval(() => {
    const L = live();
    stage.style.setProperty('--c', L.color);
    root.style.setProperty('--c', L.color);
    try { tl?.timeScale(L.speed); } catch (_) {}
  }, 100);
  return () => { clearInterval(sync); tl?.kill(); rm(); host.innerHTML=''; };
}
