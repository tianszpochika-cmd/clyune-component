import { addStyle } from '../lib/canvas.js';
import { readLiveControls } from './kits/_shared.js';

export function mount(host, opts = {}) {
  const ctrl = opts._controls || {};
  const rm = addStyle(`
  .ck { position:absolute; inset:0; overflow:auto; padding:24px; color:var(--text);
    --c: #818cf8; --spd: 1; --sz: 1; }
  .ck h3 { margin:0 0 12px; font-size:14px; color:var(--muted); font-weight:600; }
  .ck-title { font-size:clamp(28px,6vw,56px); font-weight:800; margin:0 0 6px; letter-spacing:.04em;
    background:linear-gradient(90deg,var(--c),#22d3ee,#f472b6,#fbbf24,var(--c)); background-size:300% 100%;
    -webkit-background-clip:text; background-clip:text; color:transparent;
    animation:ck-flow calc(6s / var(--spd)) linear infinite; }
  .ck-sub { color:var(--muted); margin:0 0 26px; font-size:13px; }
  @keyframes ck-flow { to { background-position:300% 0; } }
  .ck-row { display:flex; flex-wrap:wrap; gap:26px; margin-bottom:30px; align-items:center; }
  .ck-spin { width:calc(44px * var(--sz)); height:calc(44px * var(--sz)); border-radius:50%; border:4px solid #24314f; border-top-color:var(--c); animation:ck-rot calc(1s / var(--spd)) linear infinite; }
  @keyframes ck-rot { to { transform:rotate(360deg); } }
  .ck-dots { display:flex; gap:6px; } .ck-dots i { width:calc(12px * var(--sz)); height:calc(12px * var(--sz)); border-radius:50%; background:var(--c); animation:ck-bounce calc(.9s / var(--spd)) ease-in-out infinite; }
  .ck-dots i:nth-child(2){animation-delay:.15s} .ck-dots i:nth-child(3){animation-delay:.3s}
  @keyframes ck-bounce { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-14px);opacity:1} }
  .ck-pulse { width:calc(44px * var(--sz)); height:calc(44px * var(--sz)); border-radius:50%; background:var(--c); position:relative; }
  .ck-pulse::before,.ck-pulse::after { content:''; position:absolute; inset:0; border-radius:50%; border:2px solid var(--c); animation:ck-ring calc(1.8s / var(--spd)) ease-out infinite; }
  .ck-pulse::after { animation-delay:.9s; }
  @keyframes ck-ring { from{transform:scale(1);opacity:.9} to{transform:scale(2.4);opacity:0} }
  .ck-bars { display:flex; gap:4px; align-items:flex-end; height:calc(40px * var(--sz)); } .ck-bars i { width:6px; background:var(--c); border-radius:3px; animation:ck-eq calc(1s / var(--spd)) ease-in-out infinite; }
  .ck-bars i:nth-child(2){animation-delay:-.2s}.ck-bars i:nth-child(3){animation-delay:-.4s}.ck-bars i:nth-child(4){animation-delay:-.6s}.ck-bars i:nth-child(5){animation-delay:-.8s}
  @keyframes ck-eq { 0%,100%{height:8px} 50%{height:40px} }
  .ck-morph { width:calc(44px * var(--sz)); height:calc(44px * var(--sz)); background:linear-gradient(135deg,var(--c),#22d3ee); animation:ck-shape calc(3s / var(--spd)) ease-in-out infinite; }
  @keyframes ck-shape { 0%,100%{border-radius:8px;transform:rotate(0)} 33%{border-radius:50%;transform:rotate(120deg)} 66%{border-radius:50% 0;transform:rotate(240deg)} }
  .ck-ease { display:grid; gap:10px; max-width:640px; }
  .ck-track { position:relative; height:34px; background:#0d1426; border:1px solid #24314f; border-radius:10px; }
  .ck-track span { position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:11px; color:var(--muted); pointer-events:none; z-index:1; }
  .ck-ball { position:absolute; top:5px; left:4px; width:22px; height:22px; border-radius:50%; background:var(--c); transition:left calc(1.1s / var(--spd)); }
  .ck-ease.go .ck-ball { left:calc(100% - 26px); }
  .ck-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; max-width:700px; }
  .ck-card { padding:16px; border-radius:12px; background:#18233d; border:1px solid #24314f; transition:transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .35s, border-color .35s, background .35s; cursor:default; font-size:13px; }
  .ck-card:hover { transform:translateY(-6px) scale(1.03); border-color:var(--c); box-shadow:0 16px 30px -12px color-mix(in srgb, var(--c) 60%, transparent); background:#1d2a4a; }
  .ck-card b { display:block; margin-bottom:4px; }
  .ck-card small { color:var(--muted); }
  `);
  host.innerHTML = `<div class="ck">
    <div class="ck-title">CSS Keyframes</div>
    <p class="ck-sub">右侧可调颜色 / 速度 / 尺寸 · 渐变流光文字</p>
    <h3>加载动画 @keyframes</h3>
    <div class="ck-row"><div class="ck-spin"></div><div class="ck-dots"><i></i><i></i><i></i></div><div class="ck-pulse"></div><div class="ck-bars"><i></i><i></i><i></i><i></i><i></i></div><div class="ck-morph"></div></div>
    <h3>过渡曲线对比 transition-timing-function <button class="btn" id="ckGo">运行</button></h3>
    <div class="ck-ease" id="ckEase">
      ${['linear','ease','ease-in-out','cubic-bezier(.68,-0.6,.32,1.6)','steps(6)'].map(e=>`<div class="ck-track"><span>${e}</span><div class="ck-ball" style="transition-timing-function:${e}"></div></div>`).join('')}
    </div>
    <h3 style="margin-top:28px">悬停卡片 transition（弹性曲线）</h3>
    <div class="ck-cards">${['Hover','Spring','Lift','Glow'].map((t,i)=>`<div class="ck-card"><b>${t}</b><small>transform + box-shadow #${i+1}</small></div>`).join('')}</div>
  </div>`;
  const root = host.querySelector('.ck');
  const ease = host.querySelector('#ckEase');
  const btn = host.querySelector('#ckGo');
  const onGo = () => ease.classList.toggle('go');
  btn.addEventListener('click', onGo);
  const t = setTimeout(onGo, 400);
  const sync = setInterval(() => {
    const L = readLiveControls([host, host.parentElement, root], ctrl);
    root.style.setProperty('--c', L.color);
    root.style.setProperty('--spd', String(L.speed));
    root.style.setProperty('--sz', String(L.size));
  }, 80);
  return () => { clearInterval(sync); clearTimeout(t); rm(); host.innerHTML = ''; };
}
