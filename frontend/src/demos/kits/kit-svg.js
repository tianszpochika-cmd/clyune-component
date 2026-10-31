import { addStyle, bar, hsl } from './_shared.js';
export function mount(host, opts = {}) {
  const id = opts.variant || 'stroke-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-replay>Replay</button>`);
  const rm = addStyle(`.ks{position:absolute;inset:0;display:grid;place-items:center}.ks svg{width:min(320px,80%);height:auto;overflow:visible}
  .ks path,.ks polyline,.ks circle,.ks rect,.ks polygon{fill:none;stroke:${hsl(n)};stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
  .ks .fillable{fill:color-mix(in srgb,${hsl(n)} 18%,transparent)}
  .ks .ico{width:72px;height:72px;cursor:pointer;border:1px solid #24314f;border-radius:16px;display:grid;place-items:center;background:#121a2f}
  .ks .ico svg{width:36px;height:36px}`);
  const root = document.createElement('div'); root.className = 'ks'; stage.appendChild(root);
  const paths = {
    1: 'M40 100 A60 60 0 1 1 40.1 100',
    2: 'M100 20 L120 70 L175 70 L130 105 L148 160 L100 125 L52 160 L70 105 L25 70 L80 70 Z',
    3: 'M100 30 C60 30 40 70 100 120 C160 70 140 30 100 30',
    4: 'M20 100 Q60 40 100 100 T180 100',
    5: 'M20 40 L60 160 L100 40 L140 160 L180 40',
    6: 'M100 100 m0-70 a70 70 0 0 1 0 140 a50 50 0 0 1 0-100 a30 30 0 0 1 0 60',
    7: 'M100 25 L155 55 L155 115 L100 145 L45 115 L45 55 Z',
    8: 'M40 140 L40 60 L70 60 Q100 60 100 85 Q100 110 70 110 L40 110 M70 110 L105 140',
  };
  let on = false;
  const render = () => {
    if (id.startsWith('icon')) {
      const icons = [
        `<path d="M30 50 H70 M30 70 H70 M30 90 H70"/>`,
        on ? `<path d="M40 40 L40 110 M40 40 L90 75 L40 110"/>` : `<path d="M40 40 L90 75 L40 110 Z"/>`,
        `<path class="fillable" d="M70 95 C50 75 40 60 55 48 C65 40 75 48 70 58 C65 48 75 40 85 48 C100 60 90 75 70 95"/>`,
        `<path d="M70 40 A20 20 0 0 1 70 80 H40 V40 Z"/><circle cx="70" cy="35" r="4"/>`,
        `<circle cx="70" cy="70" r="28"/><path d="M70 50 V70 L85 85"/>`,
        `<path d="M45 70 H95 M70 55 L95 70 L70 85"/><path d="M50 90 H90"/>`,
        `<circle cx="70" cy="70" r="24"/><path d="M70 50 V70 L82 78"/><circle cx="70" cy="70" r="4"/>`,
        `<path d="M40 75 Q70 40 100 75 V95 H40 Z"/><path d="M55 95 V105 H85 V95"/>`,
      ];
      const i = (n - 1) % icons.length;
      root.innerHTML = `<div class="ico" data-ico>${`<svg viewBox="0 0 140 140" stroke="${hsl(n)}" fill="none" stroke-width="8" stroke-linecap="round">${icons[i]}</svg>`}</div>`;
      root.querySelector('[data-ico]').onclick = () => { on = !on; render(); anim(); };
    } else if (id.startsWith('morph')) {
      const shapes = [paths[2], paths[3], paths[7], paths[1]];
      const a = shapes[(n - 1) % shapes.length], b = shapes[n % shapes.length];
      root.innerHTML = `<svg viewBox="0 0 200 200"><path id="mp" d="${a}"/></svg>`;
      const p = root.querySelector('#mp');
      let flip = false;
      const go = () => { flip = !flip; p.setAttribute('d', flip ? b : a); p.style.transition = 'none';
        // approximate morph via dash + opacity pulse
        p.style.opacity = '0.3'; requestAnimationFrame(() => { p.style.transition = 'opacity .45s'; p.style.opacity = '1'; });
      };
      host.querySelector('[data-replay]').onclick = go;
      setTimeout(go, 300);
    } else {
      const d = paths[((n - 1) % 8) + 1];
      root.innerHTML = `<svg viewBox="0 0 200 200"><path id="sp" d="${d}"/></svg>`;
      anim();
    }
  };
  const anim = () => {
    const p = root.querySelector('#sp, #mp, path');
    if (!p || !p.getTotalLength) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
    p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset 1.2s ease';
    p.style.strokeDashoffset = '0';
  };
  render();
  host.querySelector('[data-replay]')?.addEventListener('click', () => { render(); anim(); });
  setTimeout(anim, 50);
  return () => { rm(); host.innerHTML = ''; };
}
