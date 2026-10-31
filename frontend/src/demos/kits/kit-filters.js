import { addStyle, bar, hsl, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-filters',
    title: '滤镜实验室',
    fallbackVariant: 'filter-lab',
    params: defaultParams({ color: true, speed: true, blur: true }),
    remountKeys: [],
    liveKeys: ['color', 'speed', 'blur'],
    mapVariant: (_family, n) => `f-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'f-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id);
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.kf{position:absolute;inset:0;display:grid;place-items:center;padding:20px}
  .kf .art{width:min(420px,86%);aspect-ratio:16/10;border-radius:18px;border:1px solid #24314f;display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff;transition:filter .12s}`)
  const root = document.createElement('div'); root.className = 'kf'; stage.appendChild(root);
  root.innerHTML = `<div class="art" data-a>FILTER ${n}</div>`;
  const el = root.querySelector('[data-a]');
  const filters = [
    (v, blur) => `blur(${Math.max(v * 0.12, blur)}px)`,
    (v) => `brightness(${0.5 + v / 100})`,
    (v) => `contrast(${50 + v}%)`,
    (v) => `saturate(${v * 2}%)`,
    (v) => `hue-rotate(${v * 3.6}deg)`,
    (v) => `invert(${v}%)`,
    (v) => `grayscale(${v}%)`,
    (v) => `sepia(${v}%)`,
    (v, blur, c) => `drop-shadow(0 0 ${8 + v / 5 + blur}px ${c})`,
    (v, blur) => `blur(${v * 0.04 + blur * 0.5}px) saturate(${100 + v}%) contrast(${100 + v / 2}%)`,
    (v, blur) => `blur(${v * 0.08 + blur}px)`,
    (v) => `contrast(${100 + v}%) brightness(${1 + v / 200})`,
    (v) => `opacity(${0.4 + v / 160})`,
    (v) => `hue-rotate(${v * 2}deg) saturate(180%)`,
    (v, blur) => `blur(${v * 0.05 + blur * 0.3}px) brightness(1.1)`,
    (v) => `contrast(${120 + v / 2}%)`,
    (v) => `brightness(${0.7 + v / 200}) contrast(120%)`,
    (v, blur) => `drop-shadow(0 0 ${v / 4 + blur}px #fff) saturate(140%)`,
    (v) => `grayscale(${100 - v}%) sepia(${v / 2}%)`,
    (v, blur) => `hue-rotate(${v * 4}deg) blur(${v * 0.02 + blur * 0.2}px)`,
  ];
  const fn = filters[(n - 1) % filters.length];
  let raf = 0;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const L = live();
    const amt = 30 + 40 * (0.5 + 0.5 * Math.sin(t * 0.001 * L.speed));
    el.style.background = `radial-gradient(circle at 30% 30%, ${L.color}, transparent 50%), radial-gradient(circle at 70% 60%, #22d3ee, transparent 45%), linear-gradient(135deg,#18233d,#0b1020)`;
    el.style.filter = fn(amt, L.blur, L.color);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); rm(); host.innerHTML = ''; };
}
