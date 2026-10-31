import { libs } from '../lib/load.js';
import { addStyle } from '../lib/canvas.js';

// ---------- Lottie: animation data built inline (no external JSON fetch) ----------
const kf = (frames, ease = [0.45, 0, 0.2, 1]) => ({ a: 1, k: frames.map(([t, v], i) => (i < frames.length - 1
  ? { t, s: Array.isArray(v) ? v : [v], i: { x: [ease[2]], y: [ease[3]] }, o: { x: [ease[0]], y: [ease[1]] } }
  : { t, s: Array.isArray(v) ? v : [v] })) });
const st = (v) => ({ a: 0, k: v });
const tr = (p = [0, 0], s = [100, 100], r = 0) => ({ ty: 'tr', p: st(p), a: st([0, 0]), s: st(s), r: st(r), o: st(100), sk: st(0), sa: st(0) });
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];
const layer = (ind, nm, shapes, ks = {}) => ({ ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: 120, st: 0, bm: 0, shapes,
  ks: { o: ks.o || st(100), r: ks.r || st(0), p: ks.p || st([200, 200, 0]), a: st([0, 0, 0]), s: ks.s || st([100, 100, 100]) } });
function buildLottie() {
  const ring = (ind, r, color, w, delay, dir) => layer(ind, 'ring' + ind, [{ ty: 'gr', nm: 'g', it: [
    { ty: 'el', d: 1, p: st([0, 0]), s: st([r, r]) },
    { ty: 'tm', m: 1, o: st(0), s: kf([[delay, 0], [60 + delay, 0], [110, 100]]), e: kf([[0, 0], [50 + delay, 100], [120, 100]]) },
    { ty: 'st', c: st(hex(color)), o: st(100), w: st(w), lc: 2, lj: 2, ml: 4 },
    tr()] }], { r: kf([[0, 0], [120, 360 * dir]], [0.3, 0, 0.7, 1]) });
  const dot = (ind, x, color, d) => layer(ind, 'dot' + ind, [{ ty: 'gr', nm: 'g', it: [
    { ty: 'el', d: 1, p: st([0, 0]), s: st([26, 26]) }, { ty: 'fl', c: st(hex(color)), o: st(100), r: 1 }, tr()] }],
    { p: kf([[0 + d, [x, 200, 0]], [20 + d, [x, 165, 0]], [40 + d, [x, 200, 0]], [120, [x, 200, 0]]]), s: kf([[0 + d, [100, 100, 100]], [20 + d, [80, 120, 100]], [40 + d, [100, 100, 100]], [120, [100, 100, 100]]]) });
  const core = layer(10, 'core', [{ ty: 'gr', nm: 'g', it: [
    { ty: 'rc', d: 1, p: st([0, 0]), s: st([70, 70]), r: kf([[0, 8], [60, 35], [120, 8]]) },
    { ty: 'fl', c: kf([[0, hex('#6366f1')], [60, hex('#22d3ee')], [120, hex('#6366f1')]]), o: st(22), r: 1 }, tr()] }],
    { r: kf([[0, 0], [120, -180]]), s: kf([[0, [100, 100, 100]], [60, [160, 160, 100]], [120, [100, 100, 100]]]) });
  return { v: '5.7.4', fr: 60, ip: 0, op: 120, w: 400, h: 400, nm: 'clyune-loader', ddd: 0, assets: [],
    layers: [ring(1, 300, '#818cf8', 10, 0, 1), ring(2, 250, '#22d3ee', 8, 8, -1), ring(3, 200, '#f472b6', 6, 16, 1),
      dot(4, 160, '#818cf8', 0), dot(5, 200, '#22d3ee', 8), dot(6, 240, '#f472b6', 16), core] };
}

export async function mountLottie(host) {
  const lottie = await libs.lottie();
  host.innerHTML = `<div class="fx-bar"><button class="btn on" data-a="toggle">❚❚ 暂停</button><button class="btn" data-a="dir">⇄ 方向</button>
    <label>速度 <input type="range" id="lsp" min="25" max="300" value="100"></label><label>帧 <input type="range" id="lfr" min="0" max="119" value="0"></label></div>
    <div id="lot" style="position:absolute;inset:50px 10px 10px;display:grid;place-items:center"></div>`;
  const box = host.querySelector('#lot');
  const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, animationData: buildLottie(), rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
  const svgFit = () => { const s = box.querySelector('svg'); if (s) { s.style.maxWidth = '420px'; s.style.maxHeight = '100%'; } };
  anim.addEventListener('DOMLoaded', svgFit);
  const fr = host.querySelector('#lfr');
  anim.addEventListener('enterFrame', () => { fr.value = Math.floor(anim.currentFrame); });
  let dir = 1;
  host.querySelector('.fx-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'toggle') { anim.isPaused ? anim.play() : anim.pause(); b.textContent = anim.isPaused ? '▶ 播放' : '❚❚ 暂停'; b.classList.toggle('on', !anim.isPaused); }
    else { dir *= -1; anim.setDirection(dir); }
  });
  host.querySelector('#lsp').addEventListener('input', (e) => anim.setSpeed(e.target.value / 100));
  fr.addEventListener('input', () => { anim.goToAndStop(+fr.value, true); const b = host.querySelector('[data-a=toggle]'); b.textContent = '▶ 播放'; b.classList.remove('on'); });
  return () => { anim.destroy(); host.innerHTML = ''; };
}

// ---------- Like / feedback ----------
export function mountLike(host) {
  const rm = addStyle(`
  .ml { position:absolute; inset:0; overflow:auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:28px; padding:30px 16px; }
  .ml-card { background:#18233d; border:1px solid #24314f; border-radius:16px; padding:22px; min-width:200px; display:flex; flex-direction:column; align-items:center; gap:12px; }
  .ml-card small { color:var(--muted); font-size:12px; }
  .ml-heart { position:relative; width:72px; height:72px; border-radius:50%; border:none; background:transparent; cursor:pointer; display:grid; place-items:center; }
  .ml-heart svg { width:44px; height:44px; transition:transform .2s; } .ml-heart path { fill:none; stroke:#93a0c0; stroke-width:2; transition:fill .2s, stroke .2s; }
  .ml-heart.on path { fill:#f43f5e; stroke:#f43f5e; } .ml-heart.on svg { animation:ml-pop .45s cubic-bezier(.17,.89,.32,1.49); }
  @keyframes ml-pop { 0%{transform:scale(.2)} 60%{transform:scale(1.25)} 100%{transform:scale(1)} }
  .ml-heart::before { content:''; position:absolute; inset:10px; border-radius:50%; border:2px solid #f43f5e; opacity:0; }
  .ml-heart.on::before { animation:ml-ring .5s ease-out; } @keyframes ml-ring { from{transform:scale(.3);opacity:1;border-width:18px} to{transform:scale(1.3);opacity:0;border-width:0} }
  .ml-p { position:absolute; left:50%; top:50%; width:7px; height:7px; border-radius:50%; pointer-events:none; }
  .ml-count { height:24px; overflow:hidden; font-weight:700; font-variant-numeric:tabular-nums; display:flex; }
  .ml-count span { display:block; transition:transform .35s cubic-bezier(.2,.8,.2,1); }
  .ml-count .col { display:flex; flex-direction:column; line-height:24px; }
  .ml-clap { position:relative; padding:12px 22px; border-radius:999px; border:1px solid #24314f; background:#0d1426; color:var(--text); font-size:20px; cursor:pointer; transition:transform .1s; }
  .ml-clap:active { transform:scale(.92); }
  .ml-float { position:absolute; left:50%; top:-6px; transform:translateX(-50%); background:#6366f1; color:#fff; font-size:12px; font-weight:700; border-radius:999px; padding:3px 9px; pointer-events:none; }
  .ml-star { font-size:40px; background:none; border:none; cursor:pointer; color:#3b4a6b; transition:color .2s, transform .3s; }
  .ml-star.on { color:#fbbf24; transform:rotate(72deg) scale(1.1); text-shadow:0 0 18px rgba(251,191,36,.6); }
  .ml-copy { padding:10px 18px; border-radius:10px; border:1px solid #24314f; background:#0d1426; color:var(--text); cursor:pointer; min-width:140px; transition:background .25s, border-color .25s; }
  .ml-copy.ok { background:#064e3b; border-color:#34d399; }
  `);
  host.innerHTML = `<div class="ml">
    <div class="ml-card"><button class="ml-heart" id="mlH" aria-label="like"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.3 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.7 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg></button><div class="ml-count" id="mlC"></div><small>点赞 · 粒子爆发 + 数字滚动</small></div>
    <div class="ml-card"><button class="ml-clap" id="mlClap">👏 <b id="mlClapN">0</b></button><small>连续点击鼓掌 +1</small></div>
    <div class="ml-card"><button class="ml-star" id="mlS">★</button><small>收藏</small></div>
    <div class="ml-card"><button class="ml-copy" id="mlCopy">复制链接</button><small>操作反馈状态</small></div></div>`;
  const heart = host.querySelector('#mlH'), cnt = host.querySelector('#mlC');
  let likes = 1287;
  const renderCount = (n) => {
    const s = String(n);
    if (cnt.children.length !== s.length) cnt.innerHTML = [...s].map(() => `<div class="col">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</div>`).join('');
    [...s].forEach((d, i) => cnt.children[i].querySelectorAll('span').forEach((sp) => { sp.style.transform = `translateY(${-24 * +d}px)`; }));
  };
  renderCount(likes);
  heart.addEventListener('click', () => {
    const on = !heart.classList.contains('on');
    heart.classList.toggle('on', on); likes += on ? 1 : -1; renderCount(likes);
    if (!on) return;
    const colors = ['#f43f5e', '#fbbf24', '#818cf8', '#22d3ee', '#34d399'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('i'); p.className = 'ml-p'; p.style.background = colors[i % colors.length]; heart.appendChild(p);
      const a = (i / 14) * Math.PI * 2, d = 40 + Math.random() * 18;
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }], { duration: 600 + Math.random() * 200, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
  });
  const clap = host.querySelector('#mlClap'), clapN = host.querySelector('#mlClapN'); let claps = 0;
  clap.addEventListener('click', () => {
    clapN.textContent = ++claps;
    const f = document.createElement('span'); f.className = 'ml-float'; f.textContent = '+1'; clap.appendChild(f);
    f.animate([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-40px)', opacity: 0 }], { duration: 700, easing: 'ease-out' }).onfinish = () => f.remove();
  });
  host.querySelector('#mlS').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));
  const copy = host.querySelector('#mlCopy'); let ct;
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(location.href).catch(() => {});
    copy.classList.add('ok'); copy.textContent = '✓ 已复制'; clearTimeout(ct);
    ct = setTimeout(() => { copy.classList.remove('ok'); copy.textContent = '复制链接'; }, 1600);
  });
  return () => { clearTimeout(ct); rm(); host.innerHTML = ''; };
}

// ---------- Toggles / ripple / checkbox / loading ----------
export function mountControls(host) {
  const rm = addStyle(`
  .mc { position:absolute; inset:0; overflow:auto; padding:24px; display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:16px; align-content:start; }
  .mc-box { background:#18233d; border:1px solid #24314f; border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:14px; }
  .mc-box h4 { margin:0; font-size:13px; color:var(--muted); font-weight:600; }
  .mc-sw { position:relative; width:52px; height:30px; border-radius:999px; background:#0d1426; border:1px solid #24314f; cursor:pointer; transition:background .3s; flex:none; }
  .mc-sw::after { content:''; position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:#93a0c0; transition:transform .35s cubic-bezier(.68,-0.55,.27,1.55), background .3s, width .2s; }
  .mc-sw:active::after { width:28px; }
  .mc-sw.on { background:linear-gradient(135deg,#6366f1,#22d3ee); border-color:transparent; } .mc-sw.on::after { transform:translateX(22px); background:#fff; }
  .mc-sw.on:active::after { transform:translateX(16px); }
  .mc-row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:14px; }
  .mc-chk { display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px; user-select:none; }
  .mc-chk svg { width:24px; height:24px; flex:none; } .mc-chk rect { fill:none; stroke:#3b4a6b; stroke-width:2; transition:stroke .2s, fill .2s; }
  .mc-chk path { fill:none; stroke:#fff; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:20; stroke-dashoffset:20; transition:stroke-dashoffset .3s .05s; }
  .mc-chk.on rect { fill:#6366f1; stroke:#6366f1; } .mc-chk.on path { stroke-dashoffset:0; } .mc-chk.on span { color:var(--muted); text-decoration:line-through; }
  .mc-rip { position:relative; overflow:hidden; padding:12px 18px; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; color:#fff; background:#4f46e5; }
  .mc-rip.alt { background:#0e7490; } .mc-rip.ghost { background:transparent; border:1px solid #24314f; color:var(--text); }
  .mc-rip i { position:absolute; border-radius:50%; background:rgba(255,255,255,.45); transform:scale(0); pointer-events:none; animation:mc-r .6s ease-out forwards; }
  @keyframes mc-r { to { transform:scale(4); opacity:0; } }
  .mc-load { position:relative; height:46px; border:none; border-radius:999px; background:#4f46e5; color:#fff; font-weight:600; cursor:pointer; transition:width .35s, background .3s, border-radius .35s; width:180px; align-self:center; }
  .mc-load.busy { width:46px; } .mc-load.busy span { opacity:0; }
  .mc-load.busy::after { content:''; position:absolute; inset:12px; border-radius:50%; border:3px solid rgba(255,255,255,.3); border-top-color:#fff; animation:mc-spin .7s linear infinite; }
  .mc-load.done { background:#059669; } @keyframes mc-spin { to { transform:rotate(360deg); } }
  .mc-seg { position:relative; display:flex; background:#0d1426; border:1px solid #24314f; border-radius:12px; padding:4px; }
  .mc-seg button { position:relative; z-index:1; flex:1; background:none; border:none; color:var(--muted); padding:8px 0; font-size:13px; cursor:pointer; transition:color .25s; }
  .mc-seg button.on { color:#0b1020; font-weight:600; }
  .mc-seg .ind { position:absolute; top:4px; bottom:4px; border-radius:9px; background:linear-gradient(135deg,#818cf8,#22d3ee); transition:left .35s cubic-bezier(.4,1.3,.5,1), width .35s; }
  .mc-range { display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--muted); }
  .mc-range input { accent-color:#818cf8; }
  `);
  host.innerHTML = `<div class="mc">
    <div class="mc-box"><h4>Toggle 开关</h4>${['Wi-Fi', '蓝牙', '深色模式', '通知推送'].map((t, i) => `<div class="mc-row">${t}<div class="mc-sw ${i % 2 ? '' : 'on'}" role="switch"></div></div>`).join('')}</div>
    <div class="mc-box"><h4>Checkbox 描边动画</h4>${['完成 Canvas 示例', '接入 GSAP', '编写 Shader', '上线部署'].map((t, i) => `<label class="mc-chk ${i === 0 ? 'on' : ''}"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6"/><path d="M7 12.5l3.2 3.2L17 9"/></svg><span>${t}</span></label>`).join('')}</div>
    <div class="mc-box"><h4>Material 涟漪</h4><button class="mc-rip">Primary Ripple</button><button class="mc-rip alt">Secondary Ripple</button><button class="mc-rip ghost">Ghost Ripple</button></div>
    <div class="mc-box"><h4>加载按钮 · 分段控件</h4><button class="mc-load" id="mcLoad"><span>提交</span></button>
      <div class="mc-seg" id="mcSeg"><div class="ind"></div><button class="on">日</button><button>周</button><button>月</button><button>年</button></div>
      <div class="mc-range">滑块 <input type="range" value="60"></div></div></div>`;
  const root = host.querySelector('.mc');
  root.querySelectorAll('.mc-sw').forEach((s) => s.addEventListener('click', () => s.classList.toggle('on')));
  root.querySelectorAll('.mc-chk').forEach((c) => c.addEventListener('click', (e) => { e.preventDefault(); c.classList.toggle('on'); }));
  root.querySelectorAll('.mc-rip').forEach((b) => b.addEventListener('pointerdown', (e) => {
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), i = document.createElement('i');
    i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(i); setTimeout(() => i.remove(), 650);
  }));
  const load = host.querySelector('#mcLoad'); const timers = [];
  load.addEventListener('click', () => {
    if (load.classList.contains('busy')) return;
    load.classList.remove('done'); load.classList.add('busy');
    timers.push(setTimeout(() => { load.classList.remove('busy'); load.classList.add('done'); load.firstElementChild.textContent = '✓ 成功'; }, 1500));
    timers.push(setTimeout(() => { load.classList.remove('done'); load.firstElementChild.textContent = '提交'; }, 3200));
  });
  const seg = host.querySelector('#mcSeg'), ind = seg.querySelector('.ind');
  const place = () => { const b = seg.querySelector('button.on'); ind.style.left = b.offsetLeft + 'px'; ind.style.width = b.offsetWidth + 'px'; };
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); place(); }));
  const ro = new ResizeObserver(place); ro.observe(seg); place();
  return () => { timers.forEach(clearTimeout); ro.disconnect(); rm(); host.innerHTML = ''; };
}
