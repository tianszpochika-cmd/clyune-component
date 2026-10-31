import { addStyle, bar, hsl, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const TITLES = { grid: 'Grid 布局', flex: 'Flex 布局' };
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-layout',
    title: TITLES[parseVariant(opts.variant || 'grid').family] || 'Layout',
    fallbackVariant: 'grid',
    params: defaultParams({ color: true, speed: false, size: false }).concat([
      { key: 'cols', type: 'range', label: '列数', min: 1, max: 12, step: 1, value: 3 },
      { key: 'gap', type: 'range', label: '间距', min: 0, max: 48, step: 2, value: 12 },
    ]),
    remountKeys: ['cols', 'gap'],
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'grid-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id);
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`.kl{position:absolute;inset:0;overflow:auto;padding:18px}
  .kl .grid{display:grid;gap:var(--gap,12px);grid-template-columns:repeat(var(--cols,3),1fr)}
  .kl .cell{min-height:64px;border-radius:12px;background:color-mix(in srgb, var(--c) 35%, #18233d);border:1px solid #24314f;display:grid;place-items:center;color:var(--muted);font-size:12px}
  .kl .flex{display:flex;gap:var(--gap,12px);flex-wrap:wrap;min-height:180px;align-items:stretch;border:1px dashed #24314f;border-radius:12px;padding:12px}
  .kl .flex .cell{flex:1 1 100px}`);
  const root = document.createElement('div'); root.className = 'kl'; stage.appendChild(root);
  const isFlex = id.startsWith('flex');
  const count = isFlex ? 6 : 9;
  root.innerHTML = `<div class="${isFlex ? 'flex' : 'grid'}" data-g>${Array.from({ length: count }, (_, i) => `<div class="cell">Item ${i + 1}</div>`).join('')}</div>`;
  const g = root.querySelector('[data-g]');
  const apply = () => {
    const L = live();
    const cols = Math.max(1, Math.min(12, Number(ctrl.cols) || 3));
    const gap = Number.isFinite(Number(ctrl.gap)) ? Number(ctrl.gap) : 12;
    const c = L.color;
    root.style.setProperty('--c', c);
    root.style.setProperty('--cols', String(cols));
    root.style.setProperty('--gap', `${gap}px`);
    stage.style.setProperty('--c', c);
    g.style.gap = `${gap}px`;
    if (!isFlex) g.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    else {
      const aligns = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
      g.style.justifyContent = aligns[(n - 1) % aligns.length];
      g.style.flexDirection = n % 2 === 0 ? 'column' : 'row';
    }
  };
  apply();
  const sync = setInterval(apply, 100);
  return () => { clearInterval(sync); rm(); host.innerHTML = ''; };
}
