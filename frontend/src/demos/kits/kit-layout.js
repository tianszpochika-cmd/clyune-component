import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';

const TITLES={grid:'Grid 布局',flex:'Flex 布局'};
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-layout',
    title: TITLES[parseVariant(opts.variant||'grid').family]||'Layout',
    fallbackVariant: 'grid',
    params: defaultParams({color:true,speed:false,size:false}).concat([{key:'cols',type:'range',label:'列数',min:1,max:12,step:1,value:3},{key:'gap',type:'range',label:'间距',min:0,max:48,step:2,value:12}]),
    
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'grid-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<label>列数 <input type="range" min="2" max="6" value="3" data-cols></label><label>间距 <input type="range" min="4" max="28" value="12" data-gap></label>`);
  const rm = addStyle(`.kl{position:absolute;inset:0;overflow:auto;padding:18px}
  .kl .grid{display:grid;gap:12px;grid-template-columns:repeat(3,1fr)}
  .kl .cell{min-height:64px;border-radius:12px;background:#18233d;border:1px solid #24314f;display:grid;place-items:center;color:var(--muted);font-size:12px}
  .kl .flex{display:flex;gap:12px;flex-wrap:wrap;min-height:180px;align-items:stretch;border:1px dashed #24314f;border-radius:12px;padding:12px}
  .kl .flex .cell{flex:1 1 100px}`);
  const root = document.createElement('div'); root.className = 'kl'; stage.appendChild(root);
  const isFlex = id.startsWith('flex');
  const count = isFlex ? 6 : 9;
  root.innerHTML = `<div class="${isFlex?'flex':'grid'}" data-g>${Array.from({length:count},(_,i)=>`<div class="cell" style="background:color-mix(in srgb, ${hsl(n+i)} 35%, #18233d)">Item ${i+1}</div>`).join('')}</div>`;
  const g = root.querySelector('[data-g]');
  const cols = host.querySelector('[data-cols]'); const gap = host.querySelector('[data-gap]');
  const apply = () => {
    g.style.gap = gap.value + 'px';
    if (!isFlex) g.style.gridTemplateColumns = `repeat(${cols.value}, 1fr)`;
    else {
      const aligns = ['flex-start','center','flex-end','space-between','space-around'];
      g.style.justifyContent = aligns[(n-1)%aligns.length];
      g.style.flexDirection = n % 2 === 0 ? 'column' : 'row';
    }
  };
  cols?.addEventListener('input', apply); gap?.addEventListener('input', apply); apply();
  return () => { rm(); host.innerHTML=''; };
}
