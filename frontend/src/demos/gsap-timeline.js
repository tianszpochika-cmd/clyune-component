import { libs } from '../lib/load.js';
import { addStyle } from '../lib/canvas.js';
export async function mount(host) {
  const gsap = await libs.gsap();
  const rm = addStyle(`
  .gt { position:absolute; inset:0; display:flex; flex-direction:column; padding:56px 20px 16px; gap:14px; }
  .gt-stage { flex:1; position:relative; border:1px dashed #24314f; border-radius:14px; overflow:hidden; min-height:220px; }
  .gt-box { position:absolute; width:56px; height:56px; border-radius:12px; top:30px; left:20px; display:grid; place-items:center; font-weight:800; color:#0b1020; }
  .gt-b1 { background:#818cf8; } .gt-b2 { background:#22d3ee; top:110px; } .gt-b3 { background:#f472b6; top:190px; border-radius:50%; }
  .gt-line { position:absolute; left:20px; right:20px; bottom:22px; height:4px; border-radius:2px; background:linear-gradient(90deg,#818cf8,#22d3ee); transform-origin:0 50%; transform:scaleX(0); }
  .gt-ctrl { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .gt-ctrl input { flex:1; min-width:140px; accent-color:#818cf8; }
  .gt-ctrl code { font-size:11px; color:var(--muted); min-width:64px; }
  `);
  host.innerHTML = `<div class="fx-bar"><button class="btn" data-a="play">▶ 播放</button><button class="btn" data-a="pause">❚❚ 暂停</button><button class="btn" data-a="reverse">◀ 倒放</button><button class="btn" data-a="restart">↺ 重播</button><button class="btn" data-a="speed">速度 1x</button></div>
  <div class="gt"><div class="gt-stage" id="gtStage"><div class="gt-box gt-b1">A</div><div class="gt-box gt-b2">B</div><div class="gt-box gt-b3">C</div><div class="gt-line"></div></div>
  <div class="gt-ctrl"><input type="range" min="0" max="1000" value="0" id="gtProg"><code id="gtTime">0.00s</code></div></div>`;
  const stage = host.querySelector('#gtStage');
  const dist = () => Math.max(60, stage.clientWidth - 100);
  const tl = gsap.timeline({ repeat: -1, repeatDelay: .6, yoyo: false, defaults: { ease: 'power3.inOut', duration: .9 } });
  tl.to('.gt-line', { scaleX: 1, duration: 1.2 })
    .to('.gt-b1', { x: dist, rotation: 360 }, '<')
    .to('.gt-b2', { x: dist, ease: 'bounce.out', duration: 1.2 }, '-=0.5')
    .to('.gt-b3', { x: dist, scale: 1.4, ease: 'elastic.out(1,0.4)', duration: 1.4 }, '-=0.8')
    .to('.gt-box', { y: '+=20', stagger: .1, yoyo: true, repeat: 1, duration: .3, ease: 'power1.inOut' })
    .to('.gt-box', { x: 0, rotation: 0, scale: 1, stagger: { each: .12, from: 'end' } })
    .to('.gt-line', { scaleX: 0, transformOrigin: '100% 50%' }, '<');
  const prog = host.querySelector('#gtProg'), time = host.querySelector('#gtTime');
  tl.eventCallback('onUpdate', () => { prog.value = Math.round(tl.progress() * 1000); time.textContent = tl.time().toFixed(2) + 's'; });
  prog.addEventListener('input', () => { tl.pause(); tl.progress(prog.value / 1000); });
  const speeds = [1, 2, .5]; let si = 0;
  host.querySelector('.fx-bar').addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'speed') { si = (si + 1) % speeds.length; tl.timeScale(speeds[si]); e.target.textContent = `速度 ${speeds[si]}x`; }
    else if (a === 'play') { tl.reversed(false); tl.play(); }
    else tl[a]();
  });
  return () => { tl.kill(); rm(); host.innerHTML = ''; };
}
