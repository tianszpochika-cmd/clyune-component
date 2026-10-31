import { addStyle, bar, hsl } from './_shared.js';

export function mount(host, opts = {}) {
  const id = opts.variant || 'pulse-1';
  const { stage } = bar(host, id, `<label>速度 <input type="range" min="0.3" max="2.5" step="0.1" value="1" data-spd></label>
    <input type="color" value="#818cf8" data-col>`);
  const rm = addStyle(`
    .kit-css{position:absolute;inset:0;display:grid;place-items:center;padding:24px;overflow:auto}
    .kit-css .box{width:min(280px,70%);aspect-ratio:1;border-radius:20px;display:grid;place-items:center;font-weight:700;color:#fff;position:relative}
    .kit-css .card{width:min(220px,80%);padding:18px;border-radius:14px;background:#18233d;border:1px solid #24314f;transition:.35s;cursor:default;text-align:center}
    .k-pulse{background:var(--c,#818cf8);animation:kp calc(1.8s / var(--spd,1)) ease-out infinite}
    .k-pulse::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c,#818cf8);animation:kr calc(1.8s / var(--spd,1)) ease-out infinite}
    @keyframes kp{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes kr{from{transform:scale(1);opacity:.8}to{transform:scale(1.55);opacity:0}}
    .k-loader{width:56px;height:56px;border:4px solid #24314f;border-top-color:var(--c,#818cf8);border-radius:50%;animation:kl calc(1s / var(--spd,1)) linear infinite}
    @keyframes kl{to{transform:rotate(360deg)}}
    .k-dots{display:flex;gap:8px}.k-dots i{width:12px;height:12px;border-radius:50%;background:var(--c);animation:kb calc(.9s / var(--spd,1)) ease-in-out infinite}
    .k-dots i:nth-child(2){animation-delay:.15s}.k-dots i:nth-child(3){animation-delay:.3s}
    @keyframes kb{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-14px);opacity:1}}
    .k-bars{display:flex;gap:5px;align-items:flex-end;height:48px}.k-bars i{width:7px;background:var(--c);border-radius:3px;animation:ke calc(1s / var(--spd,1)) ease-in-out infinite}
    .k-bars i:nth-child(2){animation-delay:-.2s}.k-bars i:nth-child(3){animation-delay:-.4s}.k-bars i:nth-child(4){animation-delay:-.6s}.k-bars i:nth-child(5){animation-delay:-.8s}
    @keyframes ke{0%,100%{height:10px}50%{height:48px}}
    .k-flip{animation:kf calc(2.4s / var(--spd,1)) ease-in-out infinite;background:linear-gradient(135deg,var(--c),#22d3ee)}
    @keyframes kf{0%,100%{border-radius:16px;transform:rotateY(0)}50%{border-radius:50%;transform:rotateY(180deg)}}
    .k-breathe{animation:kbr calc(2s / var(--spd,1)) ease-in-out infinite;background:var(--c);box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 50%,transparent)}
    @keyframes kbr{0%,100%{transform:scale(1);box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 45%,transparent)}50%{transform:scale(1.08);box-shadow:0 0 0 18px transparent}}
    .k-orbit{width:64px;height:64px;position:relative}.k-orbit span{position:absolute;inset:0;border:2px dashed color-mix(in srgb,var(--c) 50%,#24314f);border-radius:50%;animation:ko calc(3s / var(--spd,1)) linear infinite}
    .k-orbit i{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--c);top:50%;left:50%;margin:-7px;transform:rotate(0) translateX(32px);animation:ko calc(3s / var(--spd,1)) linear infinite}
    @keyframes ko{to{transform:rotate(360deg) translateX(32px)}}
    .k-ripple{background:var(--c)}.k-ripple::before,.k-ripple::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c);animation:kri calc(2s / var(--spd,1)) ease-out infinite}
    .k-ripple::after{animation-delay:1s}
    @keyframes kri{from{transform:scale(1);opacity:.7}to{transform:scale(2.2);opacity:0}}
    .k-cross{width:48px;height:48px;position:relative}.k-cross:before,.k-cross:after{content:'';position:absolute;background:var(--c);border-radius:4px;animation:kc calc(1.2s / var(--spd,1)) ease-in-out infinite}
    .k-cross:before{inset:0 40%;}.k-cross:after{inset:40% 0;animation-delay:.3s}
    @keyframes kc{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
    .hover-lift:hover{transform:translateY(-8px);box-shadow:0 16px 32px -12px rgba(129,140,248,.55);border-color:var(--c)}
    .hover-scale:hover{transform:scale(1.06)}
    .hover-glow:hover{box-shadow:0 0 0 2px var(--c),0 0 28px color-mix(in srgb,var(--c) 45%,transparent)}
    .hover-shine{overflow:hidden;position:relative}.hover-shine::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25),transparent 60%);transform:translateX(-120%);transition:transform .6s}
    .hover-shine:hover::after{transform:translateX(120%)}
    .hover-tilt:hover{transform:perspective(600px) rotateX(8deg) rotateY(-8deg)}
    .hover-marquee{position:relative;overflow:hidden}.hover-marquee::before{content:'';position:absolute;inset:0;border:2px solid transparent;border-radius:inherit;background:linear-gradient(#18233d,#18233d) padding-box,linear-gradient(90deg,var(--c),#22d3ee,var(--c)) border-box;background-size:200% 100%;opacity:0;transition:.2s}
    .hover-marquee:hover::before{opacity:1;animation:km calc(1.5s / var(--spd,1)) linear infinite}
    @keyframes km{to{background-position:200% 0}}
    .hover-shadow:hover{box-shadow:0 20px 40px -10px color-mix(in srgb,var(--c) 55%,transparent)}
    .hover-blur:hover{filter:none;background:#1d2a4a}.hover-blur{filter:blur(.3px);transition:.3s}
    .grad-flow{width:min(420px,90%);height:160px;border-radius:18px;background:linear-gradient(120deg,var(--c),#22d3ee,#f472b6,var(--c));background-size:300% 300%;animation:kg calc(6s / var(--spd,1)) linear infinite;display:grid;place-items:center;font-weight:700}
    @keyframes kg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  `);
  const root = document.createElement('div');
  root.className = 'kit-css';
  root.style.setProperty('--c', '#818cf8');
  root.style.setProperty('--spd', '1');
  stage.appendChild(root);

  const n = parseInt(id.split('-').pop(), 10) || 1;
  let html = '';
  if (id.startsWith('pulse')) {
    html = `<div class="box k-pulse" style="--c:${hsl(n)}">PULSE ${n}</div>`;
  } else if (id.startsWith('loader')) {
    const kinds = ['ring','dots','bars','flip','breathe','orbit','ripple','cross'];
    const k = kinds[(n - 1) % kinds.length];
    if (k === 'ring') html = `<div class="k-loader" style="--c:${hsl(n)}"></div>`;
    else if (k === 'dots') html = `<div class="k-dots" style="--c:${hsl(n)}"><i></i><i></i><i></i></div>`;
    else if (k === 'bars') html = `<div class="k-bars" style="--c:${hsl(n)}"><i></i><i></i><i></i><i></i><i></i></div>`;
    else if (k === 'flip') html = `<div class="box k-flip" style="--c:${hsl(n)};width:80px;height:80px"></div>`;
    else if (k === 'breathe') html = `<div class="box k-breathe" style="--c:${hsl(n)};width:80px;height:80px"></div>`;
    else if (k === 'orbit') html = `<div class="k-orbit" style="--c:${hsl(n)}"><span></span><i></i></div>`;
    else if (k === 'ripple') html = `<div class="box k-ripple" style="--c:${hsl(n)};width:72px;height:72px;border-radius:50%"></div>`;
    else html = `<div class="k-cross" style="--c:${hsl(n)}"></div>`;
  } else if (id.startsWith('hover')) {
    const cls = ['hover-lift','hover-scale','hover-glow','hover-shine','hover-tilt','hover-marquee','hover-shadow','hover-blur'][(n-1)%8];
    html = `<div class="card ${cls}" style="--c:${hsl(n)}"><b>Hover me</b><div style="color:var(--muted);font-size:12px;margin-top:6px">${cls}</div></div>`;
  } else {
    html = `<div class="grad-flow" style="--c:${hsl(n)}">Gradient Flow ${n}</div>`;
  }
  root.innerHTML = html;

  const spd = host.querySelector('[data-spd]');
  const col = host.querySelector('[data-col]');
  const onSpd = () => root.style.setProperty('--spd', spd.value);
  const onCol = () => root.style.setProperty('--c', col.value);
  spd?.addEventListener('input', onSpd);
  col?.addEventListener('input', onCol);
  return () => { rm(); host.innerHTML = ''; };
}
