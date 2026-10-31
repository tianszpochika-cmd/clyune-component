import { addStyle } from '../lib/canvas.js';
export function mount(host) {
  const rm = addStyle(`
  .sd { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:20px; cursor:pointer; }
  .sd svg { width:min(720px,100%); height:auto; max-height:80%; overflow:visible; }
  .sd path, .sd circle, .sd polyline { fill:none; stroke-linecap:round; stroke-linejoin:round; }
  .sd .muted { color:var(--muted); font-size:12px; }
  `);
  host.innerHTML = `<div class="sd" id="sd">
    <svg viewBox="0 0 720 300">
      <defs><linearGradient id="sdg" x1="0" x2="1"><stop offset="0" stop-color="#818cf8"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
      <filter id="sdglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g stroke="url(#sdg)" stroke-width="6" filter="url(#sdglow)">
        <!-- C -->
        <path d="M120 70 C 60 40, 20 110, 40 170 C 60 230, 130 240, 160 200"/>
        <!-- L -->
        <path d="M200 50 L 200 230 L 280 230"/>
        <!-- Y -->
        <path d="M310 60 L 350 140 L 390 60 M350 140 L 350 230"/>
        <!-- U -->
        <path d="M420 60 L 420 180 C 420 245, 510 245, 510 180 L 510 60"/>
        <!-- N -->
        <path d="M550 230 L 550 60 L 630 230 L 630 60"/>
        <!-- E -->
        <path d="M710 60 L 660 60 L 660 230 L 710 230 M660 145 L 700 145"/>
      </g>
      <g stroke="#34d399" stroke-width="3">
        <polyline points="20,280 140,280 160,255 180,295 200,265 215,280 700,280"/>
      </g>
    </svg>
    <div class="muted">stroke-dasharray = getTotalLength() · stroke-dashoffset 动画 · 点击重播</div></div>`;
  const root = host.querySelector('#sd');
  const paths = [...root.querySelectorAll('path, polyline')];
  const play = () => {
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.getAnimations().forEach((a) => a.cancel());
      p.style.strokeDasharray = len;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1100, delay: i * 280, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
    });
  };
  root.addEventListener('click', play);
  play();
  return () => { rm(); host.innerHTML = ''; };
}
