import { addStyle, bar, hsl } from './_shared.js';

export function mount(host, opts = {}) {
  const id = opts.variant || 'pulse-1';
  const n = parseInt(String(id).split('-').pop(), 10) || 1;
  const { stage } = bar(
    host,
    id,
    `<label>速度 <input type="range" min="0.3" max="2.5" step="0.1" value="1" data-spd></label>
     <input type="color" value="#818cf8" data-col>
     <button class="btn" data-act>触发</button>`,
  );
  const rm = addStyle(`
    .kit-css{position:absolute;inset:0;display:grid;place-items:center;padding:20px;overflow:auto;--c:#818cf8;--spd:1}
    .kit-css .box{width:min(260px,70%);aspect-ratio:1;border-radius:20px;display:grid;place-items:center;font-weight:700;color:#fff;position:relative;background:var(--c)}
    .kit-css .card{width:min(220px,85%);padding:16px;border-radius:14px;background:#18233d;border:1px solid #24314f;transition:.35s;text-align:center;color:var(--text,#e8eefc)}
    .kit-css .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
    .kit-css .list{display:flex;flex-direction:column;gap:8px;width:min(360px,92%)}
    .kit-css .list .item{padding:12px 14px;border-radius:10px;background:#18233d;border:1px solid #24314f}
    .kit-css .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(360px,92%)}
    .k-pulse{animation:kp calc(1.8s / var(--spd)) ease-out infinite}
    .k-pulse::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c);animation:kr calc(1.8s / var(--spd)) ease-out infinite}
    @keyframes kp{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes kr{from{transform:scale(1);opacity:.8}to{transform:scale(1.55);opacity:0}}
    .k-loader{width:56px;height:56px;border:4px solid #24314f;border-top-color:var(--c);border-radius:50%;animation:kl calc(1s / var(--spd)) linear infinite}
    @keyframes kl{to{transform:rotate(360deg)}}
    .k-dots{display:flex;gap:8px}.k-dots i{width:12px;height:12px;border-radius:50%;background:var(--c);animation:kb calc(.9s / var(--spd)) ease-in-out infinite}
    .k-dots i:nth-child(2){animation-delay:.15s}.k-dots i:nth-child(3){animation-delay:.3s}
    @keyframes kb{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-14px);opacity:1}}
    .k-bars{display:flex;gap:5px;align-items:flex-end;height:48px}.k-bars i{width:7px;background:var(--c);border-radius:3px;animation:ke calc(1s / var(--spd)) ease-in-out infinite}
    .k-bars i:nth-child(2){animation-delay:-.2s}.k-bars i:nth-child(3){animation-delay:-.4s}.k-bars i:nth-child(4){animation-delay:-.6s}.k-bars i:nth-child(5){animation-delay:-.8s}
    @keyframes ke{0%,100%{height:10px}50%{height:48px}}
    .k-flip{animation:kf calc(2.4s / var(--spd)) ease-in-out infinite;background:linear-gradient(135deg,var(--c),#22d3ee)}
    @keyframes kf{0%,100%{border-radius:16px;transform:rotateY(0)}50%{border-radius:50%;transform:rotateY(180deg)}}
    .k-breathe{animation:kbr calc(2s / var(--spd)) ease-in-out infinite;box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 50%,transparent)}
    @keyframes kbr{0%,100%{transform:scale(1);box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 45%,transparent)}50%{transform:scale(1.08);box-shadow:0 0 0 18px transparent}}
    .k-orbit{width:64px;height:64px;position:relative}.k-orbit span{position:absolute;inset:0;border:2px dashed color-mix(in srgb,var(--c) 50%,#24314f);border-radius:50%;animation:ko calc(3s / var(--spd)) linear infinite}
    .k-orbit i{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--c);top:50%;left:50%;margin:-7px;animation:ko calc(3s / var(--spd)) linear infinite}
    @keyframes ko{to{transform:rotate(360deg) translateX(32px)}}
    .k-ripple-box{border-radius:50%}.k-ripple-box::before,.k-ripple-box::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c);animation:kri calc(2s / var(--spd)) ease-out infinite}
    .k-ripple-box::after{animation-delay:1s}
    @keyframes kri{from{transform:scale(1);opacity:.7}to{transform:scale(2.2);opacity:0}}
    .k-cross{width:48px;height:48px;position:relative}.k-cross:before,.k-cross:after{content:'';position:absolute;background:var(--c);border-radius:4px;animation:kc calc(1.2s / var(--spd)) ease-in-out infinite}
    .k-cross:before{inset:0 40%}.k-cross:after{inset:40% 0;animation-delay:.3s}
    @keyframes kc{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
    .k-dual{width:56px;height:56px;border:3px solid transparent;border-top-color:var(--c);border-bottom-color:#22d3ee;border-radius:50%;animation:kl calc(.8s / var(--spd)) linear infinite}
    .k-tri{width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:30px solid var(--c);animation:kt calc(1.2s / var(--spd)) linear infinite;transform-origin:50% 70%}
    @keyframes kt{to{transform:rotate(360deg)}}
    .k-arc{width:64px;height:64px;border-radius:50%;background:conic-gradient(var(--c) 0 120deg,transparent 0);-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 6px),#000 0);mask:radial-gradient(farthest-side,#0000 calc(100% - 6px),#000 0);animation:kl calc(1s / var(--spd)) linear infinite}
    .hover-lift:hover{transform:translateY(-8px);box-shadow:0 16px 32px -12px rgba(129,140,248,.55);border-color:var(--c)}
    .hover-scale:hover{transform:scale(1.06)}
    .hover-glow:hover{box-shadow:0 0 0 2px var(--c),0 0 28px color-mix(in srgb,var(--c) 45%,transparent)}
    .hover-shine{overflow:hidden;position:relative}.hover-shine::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25),transparent 60%);transform:translateX(-120%);transition:transform .6s}
    .hover-shine:hover::after{transform:translateX(120%)}
    .hover-tilt:hover{transform:perspective(600px) rotateX(8deg) rotateY(-8deg)}
    .hover-marquee{position:relative;overflow:hidden}.hover-marquee::before{content:'';position:absolute;inset:0;border:2px solid transparent;border-radius:inherit;background:linear-gradient(#18233d,#18233d) padding-box,linear-gradient(90deg,var(--c),#22d3ee,var(--c)) border-box;background-size:200% 100%;opacity:0;transition:.2s}
    .hover-marquee:hover::before{opacity:1;animation:km calc(1.5s / var(--spd)) linear infinite}
    @keyframes km{to{background-position:200% 0}}
    .hover-shadow:hover{box-shadow:0 20px 40px -10px color-mix(in srgb,var(--c) 55%,transparent)}
    .hover-blur{filter:blur(.3px);transition:.3s}.hover-blur:hover{filter:none;background:#1d2a4a}
    .hover-neon:hover{box-shadow:0 0 8px var(--c),0 0 24px var(--c),0 0 48px color-mix(in srgb,var(--c) 50%,transparent);color:var(--c)}
    .hover-mag{transition:transform .2s}.hover-mag:hover{transform:translate(6px,-4px)}
    .hover-uline{position:relative}.hover-uline::after{content:'';position:absolute;left:16px;right:16px;bottom:10px;height:2px;background:var(--c);transform:scaleX(0);transition:.3s}
    .hover-uline:hover::after{transform:scaleX(1)}
    .hover-fill{position:relative;overflow:hidden;z-index:0}.hover-fill::before{content:'';position:absolute;inset:0;background:var(--c);transform:scaleY(0);transform-origin:bottom;transition:.35s;z-index:-1}
    .hover-fill:hover::before{transform:scaleY(1)}.hover-fill:hover{color:#0b1020;border-color:var(--c)}
    .grad-flow{width:min(420px,90%);height:140px;border-radius:18px;background:linear-gradient(120deg,var(--c),#22d3ee,#f472b6,var(--c));background-size:300% 300%;animation:kg calc(6s / var(--spd)) linear infinite;display:grid;place-items:center;font-weight:700;color:#fff}
    @keyframes kg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .ease-track{width:min(420px,92%);height:64px;background:#0d1426;border-radius:12px;position:relative;border:1px solid #24314f}
    .ease-ball{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:50%;background:var(--c)}
    .spring-box{width:100px;height:100px;border-radius:18px;background:var(--c);display:grid;place-items:center;font-weight:800;color:#0b1020}
    .stagger .item{opacity:0;transform:translateY(16px)}
    .stagger.run .item{animation:stIn calc(.55s / var(--spd)) forwards}
    .stagger.run .item:nth-child(1){animation-delay:.05s}.stagger.run .item:nth-child(2){animation-delay:.12s}
    .stagger.run .item:nth-child(3){animation-delay:.19s}.stagger.run .item:nth-child(4){animation-delay:.26s}
    .stagger.run .item:nth-child(5){animation-delay:.33s}.stagger.run .item:nth-child(6){animation-delay:.4s}
    @keyframes stIn{to{opacity:1;transform:none}}
    .flip-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(320px,90%)}
    .flip-grid .cell{height:72px;border-radius:12px;background:color-mix(in srgb,var(--c) 45%,#121a2f);display:grid;place-items:center;font-weight:700;color:#fff;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
    .clip-demo{width:min(280px,80%);aspect-ratio:1;background:linear-gradient(135deg,var(--c),#22d3ee);display:grid;place-items:center;font-weight:800;color:#0b1020;transition:clip-path .55s}
    .scene3d{perspective:900px;width:min(280px,80%);height:180px;display:grid;place-items:center}
    .cube3d{width:100px;height:100px;position:relative;transform-style:preserve-3d;animation:spin3d calc(6s / var(--spd)) linear infinite}
    .cube3d i{position:absolute;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 70%,#000);border:1px solid #fff3;font-weight:700}
    .cube3d i:nth-child(1){transform:translateZ(50px)}.cube3d i:nth-child(2){transform:rotateY(90deg) translateZ(50px)}
    .cube3d i:nth-child(3){transform:rotateY(180deg) translateZ(50px)}.cube3d i:nth-child(4){transform:rotateY(-90deg) translateZ(50px)}
    .cube3d i:nth-child(5){transform:rotateX(90deg) translateZ(50px)}.cube3d i:nth-child(6){transform:rotateX(-90deg) translateZ(50px)}
    @keyframes spin3d{to{transform:rotateX(360deg) rotateY(360deg)}}
    .card3d{width:160px;height:100px;transform-style:preserve-3d;transition:transform .6s;cursor:pointer;position:relative}
    .card3d .f,.card3d .b{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;display:grid;place-items:center;font-weight:700}
    .card3d .f{background:var(--c);color:#0b1020}.card3d .b{background:#22d3ee;color:#0b1020;transform:rotateY(180deg)}
    .card3d.flipped{transform:rotateY(180deg)}
    .parallax-stage{position:relative;width:min(420px,92%);height:200px;border-radius:16px;overflow:hidden;background:#0d1426;border:1px solid #24314f;display:grid;place-items:center}
    .parallax-stage span{position:absolute;border-radius:50%;background:var(--c);opacity:.35;transition:transform .1s linear}
    .skel{width:min(380px,92%);display:flex;flex-direction:column;gap:10px}
    .skel .b{height:14px;border-radius:8px;background:linear-gradient(90deg,#18233d 25%,#24314f 37%,#18233d 63%);background-size:400% 100%;animation:shimmer calc(1.4s / var(--spd)) ease infinite}
    .skel .b.lg{height:120px}.skel .b.sm{width:40%}.skel .row{display:flex;gap:12px;align-items:center}
    .skel .av{width:48px;height:48px;border-radius:50%;flex:none}
    @keyframes shimmer{0%{background-position:100% 0}100%{background-position:0 0}}
    .prog{width:min(360px,92%);height:12px;background:#0d1426;border-radius:999px;overflow:hidden;border:1px solid #24314f}
    .prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--c),#22d3ee);transition:width 1s}
    .prog.indeterminate i{width:40%;animation:indeterm calc(1.2s / var(--spd)) ease-in-out infinite}
    @keyframes indeterm{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
    .ringp{width:96px;height:96px;border-radius:50%;background:conic-gradient(var(--c) var(--p,40%),#24314f 0);display:grid;place-items:center}
    .ringp::after{content:attr(data-v);width:70%;height:70%;border-radius:50%;background:#0d1426;display:grid;place-items:center;font-weight:700;color:var(--text,#e8eefc)}
    .rip-host{position:relative;overflow:hidden;padding:16px 28px;border-radius:12px;background:var(--c);color:#0b1020;font-weight:700;border:0;cursor:pointer}
    .rip-host span.r{position:absolute;border-radius:50%;background:rgba(255,255,255,.45);transform:scale(0);animation:rip .6s ease-out forwards;pointer-events:none}
    @keyframes rip{to{transform:scale(12);opacity:0}}
    .acc{width:min(400px,92%);display:flex;flex-direction:column;gap:8px}
    .acc details{background:#18233d;border:1px solid #24314f;border-radius:12px;padding:4px 12px;transition:border-color .2s}
    .acc details[open]{border-color:var(--c)}
    .acc summary{cursor:pointer;padding:10px 4px;font-weight:600;list-style:none}
    .acc summary::-webkit-details-marker{display:none}
    .acc .body{padding:0 4px 12px;color:var(--muted,#93a0c0);font-size:13px;animation:fadeIn .3s}
    @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .modal-back{position:absolute;inset:0;background:rgba(5,8,16,.65);display:grid;place-items:center;opacity:0;pointer-events:none;transition:.3s;z-index:5}
    .modal-back.on{opacity:1;pointer-events:auto}
    .modal-panel{width:min(320px,86%);background:#18233d;border:1px solid #24314f;border-radius:16px;padding:20px;transform:scale(.9);transition:.3s}
    .modal-back.on .modal-panel{transform:none}
    .modal-back.blur-bg{backdrop-filter:blur(8px)}
    .car{width:min(400px,92%);overflow:hidden;border-radius:14px;border:1px solid #24314f;position:relative}
    .car-track{display:flex;transition:transform .45s ease}
    .car-track .slide{min-width:100%;height:160px;display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff}
    .neon-t{font-size:42px;font-weight:900;color:#fff;text-shadow:0 0 6px var(--c),0 0 18px var(--c),0 0 36px var(--c);animation:neonBreath calc(2s / var(--spd)) ease-in-out infinite}
    @keyframes neonBreath{50%{filter:brightness(1.25)}}
    .liquid-btn{padding:14px 28px;border:0;border-radius:999px;background:var(--c);color:#0b1020;font-weight:800;cursor:pointer;transition:border-radius .35s,transform .2s}
    .liquid-btn:hover{border-radius:16px 40px 16px 40px;transform:scale(1.04)}
    .marq{width:min(420px,92%);overflow:hidden;border:1px solid #24314f;border-radius:12px;background:#0d1426;padding:12px 0}
    .marq-inner{display:flex;gap:32px;width:max-content;animation:marq calc(12s / var(--spd)) linear infinite;font-weight:700;color:var(--text,#e8eefc)}
    .marq:hover .marq-inner{animation-play-state:paused}
    @keyframes marq{to{transform:translateX(-50%)}}
    .kb{width:min(360px,90%);height:180px;border-radius:14px;background:radial-gradient(circle at 30% 40%,var(--c),#22d3ee 40%,#0d1426 70%);animation:kburn calc(8s / var(--spd)) ease-in-out infinite alternate;border:1px solid #24314f}
    @keyframes kburn{from{background-size:100% 100%;background-position:30% 40%}to{background-size:140% 140%;background-position:70% 60%}}
    .shake-box{padding:18px 24px;border-radius:12px;background:#18233d;border:1px solid #24314f;font-weight:700;color:var(--text,#e8eefc)}
    .shake-box.go-x{animation:shx .4s}.shake-box.go-y{animation:shy .4s}.shake-box.go-r{animation:shr .4s}
    @keyframes shx{10%,90%{transform:translateX(-4px)}20%,80%{transform:translateX(6px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
    @keyframes shy{10%,90%{transform:translateY(-3px)}30%,70%{transform:translateY(6px)}50%{transform:translateY(-6px)}}
    @keyframes shr{20%{transform:rotate(-4deg)}40%{transform:rotate(4deg)}60%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}}
    .reveal-box{width:min(280px,80%);height:160px;border-radius:14px;background:linear-gradient(135deg,var(--c),#22d3ee);display:grid;place-items:center;font-weight:800;color:#0b1020;position:relative;overflow:hidden}
    .reveal-box::after{content:'';position:absolute;inset:0;background:#0b1020;transition:clip-path .7s,opacity .7s;clip-path:circle(75% at 50% 50%)}
    .reveal-box.on::after{clip-path:circle(0% at 50% 50%);opacity:0}
    .blend-stage{position:relative;width:min(360px,90%);height:200px;border-radius:16px;overflow:hidden;background:#111}
    .blend-stage .a,.blend-stage .b{position:absolute;width:160px;height:160px;border-radius:50%;top:20px}
    .blend-stage .a{left:40px;background:var(--c)}.blend-stage .b{right:40px;background:#22d3ee}
  `);

  const root = document.createElement('div');
  root.className = 'kit-css';
  root.style.setProperty('--c', hsl(n));
  stage.appendChild(root);

  const easings = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'cubic-bezier(.55,0,1,.45)', 'cubic-bezier(0,.55,.45,1)',
    'cubic-bezier(.34,1.56,.64,1)', 'cubic-bezier(.5,1.8,.5,.8)',
    'steps(5)', 'cubic-bezier(.68,-.55,.27,1.55)', 'cubic-bezier(.17,.67,.42,1.3)',
  ];
  const clips = [
    'circle(20% at 50% 50%)', 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
    'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
    'polygon(0 0,100% 0,100% 70%,0 100%)',
    'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    'polygon(0 20%,100% 0,100% 80%,0 100%)', 'polygon(0 0,100% 0,0 100%)', 'circle(0% at 50% 50%)',
    'polygon(40% 0,60% 0,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0 60%,0 40%,40% 40%)',
    'inset(10% 20% round 40px)',
  ];
  const blends = ['screen', 'multiply', 'overlay', 'difference', 'exclusion', 'color-dodge', 'hard-light', 'soft-light'];
  const parts = id.split('-');
  const kind = parts.slice(0, -1).join('-') || parts[0];
  let html = '';

  if (kind === 'pulse') {
    html = `<div class="box k-pulse" style="--c:${hsl(n)}">PULSE ${n}</div>`;
  } else if (kind === 'loader') {
    const kinds = ['ring','dots','bars','flip','breathe','orbit','ripple','cross','dual','bounce','tri','arc'];
    const k = kinds[(n - 1) % kinds.length];
    if (k === 'ring') html = `<div class="k-loader" style="--c:${hsl(n)}"></div>`;
    else if (k === 'dots' || k === 'bounce') html = `<div class="k-dots" style="--c:${hsl(n)}"><i></i><i></i><i></i>${k==='bounce'?'<i></i>':''}</div>`;
    else if (k === 'bars') html = `<div class="k-bars" style="--c:${hsl(n)}"><i></i><i></i><i></i><i></i><i></i></div>`;
    else if (k === 'flip') html = `<div class="box k-flip" style="--c:${hsl(n)};width:80px;height:80px"></div>`;
    else if (k === 'breathe') html = `<div class="box k-breathe" style="--c:${hsl(n)};width:80px;height:80px"></div>`;
    else if (k === 'orbit') html = `<div class="k-orbit" style="--c:${hsl(n)}"><span></span><i></i></div>`;
    else if (k === 'ripple') html = `<div class="box k-ripple-box" style="--c:${hsl(n)};width:72px;height:72px"></div>`;
    else if (k === 'cross') html = `<div class="k-cross" style="--c:${hsl(n)}"></div>`;
    else if (k === 'dual') html = `<div class="k-dual" style="--c:${hsl(n)}"></div>`;
    else if (k === 'tri') html = `<div class="k-tri" style="--c:${hsl(n)}"></div>`;
    else html = `<div class="k-arc" style="--c:${hsl(n)}"></div>`;
  } else if (kind === 'hover') {
    const cls = ['hover-lift','hover-scale','hover-glow','hover-shine','hover-tilt','hover-marquee','hover-shadow','hover-blur','hover-neon','hover-mag','hover-uline','hover-fill'][(n-1)%12];
    html = `<div class="card ${cls}" style="--c:${hsl(n)}"><b>Hover me</b><div style="color:var(--muted);font-size:12px;margin-top:6px">${cls}</div></div>`;
  } else if (kind === 'grad') {
    html = `<div class="grad-flow" style="--c:${hsl(n)}">Gradient Flow ${n}</div>`;
  } else if (kind === 'ease') {
    html = `<div class="list" style="gap:14px;align-items:center"><div style="color:var(--muted);font-size:12px">${easings[(n-1)%easings.length]}</div><div class="ease-track"><div class="ease-ball" data-ball style="--c:${hsl(n)}"></div></div></div>`;
  } else if (kind === 'spring') {
    html = `<div class="spring-box" data-spring style="--c:${hsl(n)}">SPRING</div>`;
  } else if (kind === 'stagger') {
    html = `<div class="list stagger" data-st>${[1,2,3,4,5,6].map(i=>`<div class="item">Stagger item ${i}</div>`).join('')}</div>`;
  } else if (kind === 'flip') {
    html = `<div class="flip-grid" data-flip>${[1,2,3,4,5,6,7,8,9].map(i=>`<div class="cell" style="--c:${hsl(i+n)}">${i}</div>`).join('')}</div>`;
  } else if (kind === 'clip') {
    html = `<div class="clip-demo" data-clip style="--c:${hsl(n)};clip-path:${clips[(n-1)%clips.length]}">CLIP</div>`;
  } else if (kind === 'xform3d') {
    html = n % 2 === 1
      ? `<div class="scene3d"><div class="cube3d" style="--c:${hsl(n)}"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i></div></div>`
      : `<div class="card3d" data-flip3d style="--c:${hsl(n)}"><div class="f">Front</div><div class="b">Back</div></div>`;
  } else if (kind === 'trans') {
    const props = ['background','width','opacity','transform','box-shadow','border-radius','font-size','border-color','filter','all'];
    const p = props[(n-1)%props.length];
    html = `<div class="card" data-trans data-prop="${p}" style="--c:${hsl(n)};transition:${p} .5s">transition: ${p}<div style="font-size:12px;color:var(--muted);margin-top:8px">悬停变化</div></div>`;
  } else if (kind === 'parallax') {
    html = `<div class="parallax-stage" data-par>${[0,1,2,3,4].map(i=>`<span style="width:${40+i*20}px;height:${40+i*20}px;left:${10+i*15}%;top:${20+i*10}%;opacity:${0.2+i*0.1};background:${hsl(n+i)}" data-d="${0.2+i*0.2}"></span>`).join('')}<b style="position:relative;z-index:2;color:#fff">Parallax</b></div>`;
  } else if (kind === 'filter') {
    html = `<div class="box" data-filt style="--c:${hsl(n)}">FILTER</div>`;
  } else if (kind === 'blend') {
    const m = blends[(n-1)%blends.length];
    html = `<div class="blend-stage" data-blend><div class="a" style="--c:${hsl(n)};background:${hsl(n)}"></div><div class="b" style="mix-blend-mode:${m}"></div><b style="position:absolute;bottom:12px;left:0;right:0;text-align:center;color:#fff">${m}</b></div>`;
  } else if (kind === 'skeleton') {
    html = n % 2
      ? `<div class="skel"><div class="b lg"></div><div class="b"></div><div class="b sm"></div></div>`
      : `<div class="skel"><div class="row"><div class="b av"></div><div style="flex:1"><div class="b"></div><div class="b sm" style="margin-top:8px"></div></div></div><div class="b"></div><div class="b"></div></div>`;
  } else if (kind === 'progress') {
    if (n === 3 || n === 4) html = `<div class="ringp" data-ring data-v="40%" style="--c:${hsl(n)};--p:40%"></div>`;
    else if (n === 2) html = `<div class="prog indeterminate" style="--c:${hsl(n)}"><i></i></div>`;
    else html = `<div class="prog" style="--c:${hsl(n)}"><i data-p></i></div>`;
  } else if (kind === 'ripple') {
    html = `<button class="rip-host" data-rip style="--c:${hsl(n)}">Click ripple</button>`;
  } else if (kind === 'accordion') {
    html = `<div class="acc">${[1,2,3].map(i=>`<details ${i===1?'open':''}><summary>Section ${i}</summary><div class="body">Accordion content ${i}</div></details>`).join('')}</div>`;
  } else if (kind === 'modal') {
    html = `<button class="btn" data-open>打开弹层</button><div class="modal-back ${n===4?'blur-bg':''}" data-modal><div class="modal-panel" style="border-color:${hsl(n)}"><h3 style="margin:0 0 8px">Modal ${n}</h3><p style="color:var(--muted);font-size:13px">Enter / exit transition.</p><button class="btn" data-close>关闭</button></div></div>`;
  } else if (kind === 'carousel') {
    html = `<div class="car"><div class="car-track" data-car>${[1,2,3,4].map(i=>`<div class="slide" style="background:${hsl(n+i)}">${i}</div>`).join('')}</div></div><div class="row" style="margin-top:12px"><button class="btn" data-prev>‹</button><button class="btn" data-next>›</button></div>`;
  } else if (kind === 'reveal') {
    html = `<div class="reveal-box" data-rev style="--c:${hsl(n)}">REVEAL</div>`;
  } else if (kind === 'neon') {
    html = `<div class="neon-t" style="--c:${hsl(n)}">NEON</div>`;
  } else if (kind === 'liquid') {
    html = `<button class="liquid-btn" style="--c:${hsl(n)}">Liquid</button>`;
  } else if (kind === 'marquee') {
    const t = 'Clyune · CSS · Motion · Transition · ';
    html = `<div class="marq"><div class="marq-inner" style="animation-direction:${n%2?'reverse':'normal'}"><span>${t}</span><span>${t}</span></div></div>`;
  } else if (kind === 'kenburns') {
    html = `<div class="kb" style="--c:${hsl(n)}"></div>`;
  } else if (kind === 'shake') {
    html = `<div class="shake-box" data-shake>Shake me</div>`;
  } else if (kind === 'keyseq') {
    html = `<div class="box" data-keyseq style="--c:${hsl(n)};animation:kp calc(1.2s / var(--spd)) ease-in-out infinite">KF ${n}</div>`;
  } else {
    html = `<div class="grad-flow" style="--c:${hsl(n)}">${id}</div>`;
  }
  root.innerHTML = html;

  const spd = host.querySelector('[data-spd]');
  const col = host.querySelector('[data-col]');
  const act = host.querySelector('[data-act]');
  spd?.addEventListener('input', () => root.style.setProperty('--spd', spd.value));
  col?.addEventListener('input', () => root.style.setProperty('--c', col.value));

  if (kind === 'ease') {
    const run = () => {
      const b = root.querySelector('[data-ball]');
      if (!b) return;
      b.style.transition = 'none'; b.style.left = '12px'; b.getBoundingClientRect();
      b.style.transition = `left ${1.2 / (parseFloat(spd?.value)||1)}s ${easings[(n-1)%easings.length]}`;
      b.style.left = 'calc(100% - 52px)';
    };
    act?.addEventListener('click', run); setTimeout(run, 200);
  }
  if (kind === 'spring') {
    const run = () => {
      const el = root.querySelector('[data-spring]'); if (!el) return;
      const maps = ['scale(0.2)','scale(1.4)','scale(1.35)','scale(0.85) translateY(8px)','translateY(40px)','translateX(30px)','rotate(25deg) scale(1.1)','translateY(-20px)'];
      el.style.transition = 'none'; el.style.transform = maps[(n-1)%maps.length]; el.getBoundingClientRect();
      el.style.transition = `transform ${0.7/(parseFloat(spd?.value)||1)}s cubic-bezier(.34,1.56,.64,1)`; el.style.transform = 'none';
    };
    act?.addEventListener('click', run); setTimeout(run, 150);
  }
  if (kind === 'stagger') {
    const run = () => { const el = root.querySelector('[data-st]'); el?.classList.remove('run'); void el?.offsetWidth; el?.classList.add('run'); };
    act?.addEventListener('click', run); setTimeout(run, 100);
  }
  if (kind === 'flip') {
    act?.addEventListener('click', () => {
      const g = root.querySelector('[data-flip]'); if (!g) return;
      const cells = [...g.children];
      const first = cells.map(c => c.getBoundingClientRect());
      for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); g.appendChild(cells[j]); cells.splice(j,1); }
      [...g.children].forEach((c, i) => {
        const last = c.getBoundingClientRect();
        const dx = first[i].left - last.left, dy = first[i].top - last.top;
        c.style.transition = 'none'; c.style.transform = `translate(${dx}px,${dy}px)`; c.getBoundingClientRect();
        c.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)'; c.style.transform = 'none';
      });
    });
  }
  if (kind === 'clip') {
    let on = false; const el = root.querySelector('[data-clip]');
    const tog = () => { on = !on; el.style.clipPath = on ? 'circle(75% at 50% 50%)' : clips[(n-1)%clips.length]; };
    el?.addEventListener('click', tog); act?.addEventListener('click', tog);
  }
  if (kind === 'xform3d') root.querySelector('[data-flip3d]')?.addEventListener('click', (e) => e.currentTarget.classList.toggle('flipped'));
  if (kind === 'trans') {
    const el = root.querySelector('[data-trans]'); const prop = el?.dataset.prop;
    el?.addEventListener('mouseenter', () => {
      if (prop === 'background') el.style.background = hsl(n+3);
      if (prop === 'width') el.style.width = '280px';
      if (prop === 'opacity') el.style.opacity = '0.45';
      if (prop === 'transform') el.style.transform = 'scale(1.08) rotate(-2deg)';
      if (prop === 'box-shadow') el.style.boxShadow = `0 12px 40px ${hsl(n)}`;
      if (prop === 'border-radius') el.style.borderRadius = '40px';
      if (prop === 'font-size') el.style.fontSize = '20px';
      if (prop === 'border-color') el.style.borderColor = hsl(n);
      if (prop === 'filter') el.style.filter = 'hue-rotate(90deg)';
      if (prop === 'all') { el.style.transform = 'translateY(-6px)'; el.style.background = '#1d2a4a'; el.style.borderColor = hsl(n); }
    });
    el?.addEventListener('mouseleave', () => { el.style.background=''; el.style.width=''; el.style.opacity=''; el.style.transform=''; el.style.boxShadow=''; el.style.borderRadius=''; el.style.fontSize=''; el.style.borderColor=''; el.style.filter=''; });
  }
  if (kind === 'parallax') {
    const stageEl = root.querySelector('[data-par]');
    stageEl?.addEventListener('pointermove', (e) => {
      const r = stageEl.getBoundingClientRect();
      const x = (e.clientX - r.left)/r.width - 0.5, y = (e.clientY - r.top)/r.height - 0.5;
      stageEl.querySelectorAll('span').forEach((s) => { const d = parseFloat(s.dataset.d)||0.3; s.style.transform = `translate(${x*40*d}px,${y*30*d}px)`; });
    });
  }
  if (kind === 'filter') {
    const filters = ['blur(6px)','saturate(2.5)','hue-rotate(180deg)','contrast(1.8)','grayscale(1)','drop-shadow(0 0 12px var(--c))','brightness(0.6)','blur(1px) contrast(1.4) saturate(1.8)'];
    const el = root.querySelector('[data-filt]'); let i = 0;
    const run = () => { el.style.transition = 'filter .6s'; el.style.filter = filters[(n-1+i++)%filters.length]; };
    act?.addEventListener('click', run); setTimeout(run, 200);
  }
  if (kind === 'blend') {
    const stageEl = root.querySelector('[data-blend]');
    stageEl?.addEventListener('pointermove', (e) => {
      const r = stageEl.getBoundingClientRect(); const b = stageEl.querySelector('.b');
      if (b) { b.style.left = `${e.clientX - r.left - 80}px`; b.style.top = `${e.clientY - r.top - 80}px`; b.style.right = 'auto'; }
    });
  }
  if (kind === 'progress') {
    const run = () => {
      const p = root.querySelector('[data-p]');
      if (p) { p.style.width = '0%'; p.getBoundingClientRect(); p.style.width = `${30+Math.random()*60}%`; }
      const ring = root.querySelector('[data-ring]');
      if (ring) { const v = 20+Math.floor(Math.random()*75); ring.style.setProperty('--p', `${v}%`); ring.dataset.v = `${v}%`; }
    };
    act?.addEventListener('click', run); setTimeout(run, 200);
  }
  if (kind === 'ripple') {
    root.querySelector('[data-rip]')?.addEventListener('click', (e) => {
      const btn = e.currentTarget; const r = btn.getBoundingClientRect();
      const s = document.createElement('span'); s.className = 'r';
      const size = Math.max(r.width, r.height);
      s.style.width = s.style.height = `${size}px`;
      s.style.left = `${e.clientX - r.left - size/2}px`; s.style.top = `${e.clientY - r.top - size/2}px`;
      btn.appendChild(s); setTimeout(() => s.remove(), 600);
    });
  }
  if (kind === 'modal') {
    const back = root.querySelector('[data-modal]');
    root.querySelector('[data-open]')?.addEventListener('click', () => back.classList.add('on'));
    root.querySelector('[data-close]')?.addEventListener('click', () => back.classList.remove('on'));
    back?.addEventListener('click', (e) => { if (e.target === back) back.classList.remove('on'); });
  }
  if (kind === 'carousel') {
    let idx = 0; const track = root.querySelector('[data-car]');
    const go = (d) => { idx = (idx + d + 4) % 4; track.style.transform = `translateX(-${idx*100}%)`; };
    root.querySelector('[data-prev]')?.addEventListener('click', () => go(-1));
    root.querySelector('[data-next]')?.addEventListener('click', () => go(1));
  }
  if (kind === 'reveal') {
    const el = root.querySelector('[data-rev]');
    const tog = () => el?.classList.toggle('on');
    act?.addEventListener('click', tog); el?.addEventListener('click', tog);
  }
  if (kind === 'shake') {
    const el = root.querySelector('[data-shake]');
    const cls = ['go-x','go-y','go-r','go-x','go-y','go-r'][(n-1)%6];
    const run = () => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    act?.addEventListener('click', run); el?.addEventListener('click', run);
  }

  return () => { rm(); host.innerHTML = ''; };
}
