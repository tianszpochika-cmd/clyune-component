import { addStyle, bar, hsl, defaultParams, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const FILTER_PRESETS = ['模糊','亮度','对比','饱和','色相旋转','反相','灰度','褐色','投影','组合霓虹','毛玻璃背板','混合叠加','排除混合','彩色闪烁','像素感','锐化模拟','暗角','发光描边','双色调','故障抖动'];
const BLEND_PRESETS = ['screen','multiply','overlay','difference','exclusion','color-dodge','hard-light','soft-light','lighten','darken','color','hue','saturation','luminosity','plus-lighter','正常对比'];
export function mount(host, opts = {}) {
  const family = (opts.variant || 'filter-lab').startsWith('blend') ? 'blend-lab' : 'filter-lab';
  return withControls(host, opts, {
    kitKey: 'kit-filters',
    title: family === 'blend-lab' ? '混合模式实验室' : '滤镜实验室',
    fallbackVariant: family,
    presets: family === 'blend-lab' ? BLEND_PRESETS : FILTER_PRESETS,
    params: defaultParams({ color: true, speed: true, blur: true }),
    remountKeys: [],
    liveKeys: ['color', 'speed', 'blur'],
    mapVariant: (_family, n) => family === 'blend-lab' ? `blend-${n}` : `f-${n}`,
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'f-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const isBlend = String(id).startsWith('blend');
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id);
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.kf{position:absolute;inset:0;display:grid;place-items:center;padding:20px}
  .kf .art{width:min(420px,86%);aspect-ratio:16/10;border-radius:18px;border:1px solid #24314f;display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff;transition:filter .12s;position:relative;overflow:hidden}
  .kf .blob{position:absolute;width:55%;height:55%;border-radius:50%;filter:blur(8px);mix-blend-mode:screen}`)
  const root = document.createElement('div'); root.className = 'kf'; stage.appendChild(root);
  root.innerHTML = isBlend
    ? `<div class="art" data-a><div class="blob" data-b1></div><div class="blob" data-b2></div><span style="position:relative;z-index:1">BLEND</span></div>`
    : `<div class="art" data-a>FILTER ${n}</div>`;
  const el = root.querySelector('[data-a]');
  const blends = ['screen','multiply','overlay','difference','exclusion','color-dodge','hard-light','soft-light','lighten','darken','color','hue','saturation','luminosity','plus-lighter','normal'];
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
    if (isBlend) {
      const mode = blends[(n - 1) % blends.length];
      el.style.background = 'linear-gradient(135deg,#0b1020,#18233d)';
      el.style.filter = L.blur ? `blur(${L.blur * 0.15}px)` : 'none';
      const b1 = root.querySelector('[data-b1]'); const b2 = root.querySelector('[data-b2]');
      if (b1 && b2) {
        b1.style.mixBlendMode = mode; b2.style.mixBlendMode = mode;
        b1.style.background = L.color; b2.style.background = '#22d3ee';
        b1.style.left = `${20 + 10 * Math.sin(t * 0.001 * L.speed)}%`;
        b1.style.top = `${18 + 8 * Math.cos(t * 0.0012 * L.speed)}%`;
        b2.style.right = `${16 + 10 * Math.cos(t * 0.001 * L.speed)}%`;
        b2.style.bottom = `${14 + 8 * Math.sin(t * 0.0014 * L.speed)}%`;
        b2.style.left = 'auto'; b2.style.top = 'auto';
      }
      return;
    }
    el.style.background = `radial-gradient(circle at 30% 30%, ${L.color}, transparent 50%), radial-gradient(circle at 70% 60%, #22d3ee, transparent 45%), linear-gradient(135deg,#18233d,#0b1020)`;
    el.style.filter = fn(amt, L.blur, L.color);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); rm(); host.innerHTML = ''; };
}
