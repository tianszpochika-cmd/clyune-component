import { addStyle, bar, hsl } from './_shared.js';
export function mount(host, opts = {}) {
  const id = opts.variant || 'f-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<label>强度 <input type="range" min="0" max="100" value="60" data-amt></label>`);
  const rm = addStyle(`.kf{position:absolute;inset:0;display:grid;place-items:center;padding:20px}
  .kf .art{width:min(420px,86%);aspect-ratio:16/10;border-radius:18px;background:
    radial-gradient(circle at 30% 30%, ${hsl(n)}, transparent 50%),
    radial-gradient(circle at 70% 60%, #22d3ee, transparent 45%),
    linear-gradient(135deg,#18233d,#0b1020); border:1px solid #24314f; display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff; transition:filter .15s, backdrop-filter .15s}`);
  const root = document.createElement('div'); root.className='kf'; stage.appendChild(root);
  root.innerHTML = `<div class="art" data-a>FILTER ${n}</div>`;
  const el = root.querySelector('[data-a]');
  const amt = host.querySelector('[data-amt]');
  const filters = [
    (v)=>`blur(${v*0.12}px)`, (v)=>`brightness(${0.5+v/100})`, (v)=>`contrast(${50+v}%)`, (v)=>`saturate(${v*2}%)`,
    (v)=>`hue-rotate(${v*3.6}deg)`, (v)=>`invert(${v}%)`, (v)=>`grayscale(${v}%)`, (v)=>`sepia(${v}%)`,
    (v)=>`drop-shadow(0 0 ${8+v/5}px ${hsl(n)})`, (v)=>`blur(${v*0.04}px) saturate(${100+v}%) contrast(${100+v/2}%)`,
    (v)=>`blur(${v*0.08}px)`, (v)=>`contrast(${100+v}%) brightness(${1+v/200})`, (v)=>`opacity(${0.4+v/160})`,
    (v)=>`hue-rotate(${v*2}deg) saturate(180%)`, (v)=>`blur(${v*0.05}px) brightness(1.1)`, (v)=>`contrast(${120+v/2}%)`,
    (v)=>`brightness(${0.7+v/200}) contrast(120%)`, (v)=>`drop-shadow(0 0 ${v/4}px #fff) saturate(140%)`,
    (v)=>`grayscale(${100-v}%) sepia(${v/2}%)`, (v)=>`hue-rotate(${v*4}deg) blur(${v*0.02}px)`,
  ];
  const fn = filters[(n-1)%filters.length];
  const apply = () => { el.style.filter = fn(+amt.value); };
  amt.addEventListener('input', apply); apply();
  return () => { rm(); host.innerHTML=''; };
}
