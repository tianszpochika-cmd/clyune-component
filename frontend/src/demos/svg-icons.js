import { addStyle } from '../lib/canvas.js';
export function mount(host) {
  const rm = addStyle(`
  .si { position:absolute; inset:0; overflow:auto; padding:24px; display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; align-content:start; }
  .si-cell { background:#18233d; border:1px solid #24314f; border-radius:14px; padding:18px 10px 12px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; user-select:none; transition:border-color .2s; }
  .si-cell:hover { border-color:#818cf8; }
  .si-cell span { font-size:12px; color:var(--muted); }
  .si svg { width:56px; height:56px; overflow:visible; }
  .si svg * { transition:all .45s cubic-bezier(.68,-0.4,.32,1.4); transform-box:fill-box; transform-origin:center; }
  .si .ham line { stroke:#e8eefc; stroke-width:3; stroke-linecap:round; }
  .si .on .ham .l1 { transform:translateY(10px) rotate(45deg); }
  .si .on .ham .l2 { opacity:0; transform:scaleX(0); }
  .si .on .ham .l3 { transform:translateY(-10px) rotate(-45deg); }
  .si .pp path { fill:#22d3ee; transition:d .35s ease; }
  .si .chk circle { fill:none; stroke:#34d399; stroke-width:3; stroke-dasharray:151; stroke-dashoffset:151; }
  .si .chk path { fill:none; stroke:#34d399; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:40; stroke-dashoffset:40; }
  .si .on .chk circle { stroke-dashoffset:0; } .si .on .chk path { stroke-dashoffset:0; transition-delay:.3s; }
  .si .bell { transform-origin:50% 10%; } .si .on .bellg { animation:si-ring .8s ease; }
  @keyframes si-ring { 0%,100%{transform:rotate(0)} 20%{transform:rotate(18deg)} 40%{transform:rotate(-16deg)} 60%{transform:rotate(10deg)} 80%{transform:rotate(-6deg)} }
  .si .bellg path { fill:#fbbf24; } .si .dot { fill:#ef4444; transform:scale(0); } .si .on .dot { transform:scale(1); }
  .si .spin { animation:si-rot 1.2s linear infinite; } .si .spin circle { fill:none; stroke:#818cf8; stroke-width:4; stroke-linecap:round; stroke-dasharray:90 150; animation:si-dash 1.5s ease-in-out infinite; }
  @keyframes si-rot { to { transform:rotate(360deg); } } @keyframes si-dash { 0%{stroke-dasharray:1 150;stroke-dashoffset:0} 50%{stroke-dasharray:90 150;stroke-dashoffset:-35} 100%{stroke-dasharray:90 150;stroke-dashoffset:-124} }
  .si .sun circle { fill:#fbbf24; } .si .sun line { stroke:#fbbf24; stroke-width:3; stroke-linecap:round; } .si .sun .mask { fill:#18233d; transform:translate(30px,-30px); }
  .si .on .sun circle.core { fill:#c7d2fe; } .si .on .sun line { opacity:0; transform:scale(.3); } .si .on .sun .mask { transform:translate(8px,-8px); }
  .si .heart path { fill:transparent; stroke:#f472b6; stroke-width:3; } .si .on .heart path { fill:#f472b6; transform:scale(1.12); }
  .si .arrow { stroke:#22d3ee; stroke-width:3.5; fill:none; stroke-linecap:round; stroke-linejoin:round; } .si .on .arrow { transform:rotate(180deg); }
  `);
  const pause = 'M18 14 L26 14 L26 42 L18 42 Z M30 14 L38 14 L38 42 L30 42 Z';
  const play = 'M18 12 L30 20 L30 36 L18 44 Z M30 20 L44 28 L44 28 L30 36 Z';
  host.innerHTML = `<div class="si">
    <div class="si-cell"><svg viewBox="0 0 56 56" class="ham"><line class="l1" x1="12" y1="18" x2="44" y2="18"/><line class="l2" x1="12" y1="28" x2="44" y2="28"/><line class="l3" x1="12" y1="38" x2="44" y2="38"/></svg><span>菜单 ↔ 关闭</span></div>
    <div class="si-cell" data-pp><svg viewBox="0 0 56 56" class="pp"><path d="${play}"/></svg><span>播放 ↔ 暂停</span></div>
    <div class="si-cell"><svg viewBox="0 0 56 56" class="chk"><circle cx="28" cy="28" r="24"/><path d="M17 29 L25 37 L40 20"/></svg><span>完成对勾</span></div>
    <div class="si-cell" data-once><svg viewBox="0 0 56 56" class="bell"><g class="bellg"><path d="M28 8 C18 8 15 17 15 25 L15 34 L11 40 L45 40 L41 34 L41 25 C41 17 38 8 28 8 Z M23 43 A5 5 0 0 0 33 43 Z"/><circle class="dot" cx="41" cy="13" r="6"/></g></svg><span>通知铃铛</span></div>
    <div class="si-cell"><svg viewBox="0 0 56 56" class="sun"><circle class="core" cx="28" cy="28" r="11"/><circle class="mask" cx="28" cy="28" r="10"/>${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${28 + Math.cos(a) * 17}" y1="${28 + Math.sin(a) * 17}" x2="${28 + Math.cos(a) * 23}" y2="${28 + Math.sin(a) * 23}"/>`; }).join('')}</svg><span>日间 ↔ 夜间</span></div>
    <div class="si-cell"><svg viewBox="0 0 56 56" class="heart"><path d="M28 46 C10 34 6 24 10 17 C14 10 24 10 28 18 C32 10 42 10 46 17 C50 24 46 34 28 46 Z"/></svg><span>收藏</span></div>
    <div class="si-cell"><svg viewBox="0 0 56 56"><path class="arrow" d="M16 24 L28 36 L40 24"/></svg><span>展开 ↕ 收起</span></div>
    <div class="si-cell"><svg viewBox="0 0 56 56" class="spin"><circle cx="28" cy="28" r="20"/></svg><span>加载中</span></div>
  </div>`;
  host.querySelectorAll('.si-cell').forEach((c) => c.addEventListener('click', () => {
    if ('once' in c.dataset) { c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); return; }
    c.classList.toggle('on');
    if ('pp' in c.dataset) {
      const p = c.querySelector('path'), d = c.classList.contains('on') ? pause : play;
      p.setAttribute('d', d); p.style.d = `path("${d}")`;
    }
  }));
  return () => { rm(); host.innerHTML = ''; };
}
