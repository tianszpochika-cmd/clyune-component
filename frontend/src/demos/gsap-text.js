import { libs } from '../lib/load.js';
import { addStyle } from '../lib/canvas.js';
export async function mount(host) {
  const gsap = await libs.gsap();
  const rm = addStyle(`
  .gx { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 16px 20px; gap:18px; text-align:center; overflow:hidden; }
  .gx h3 { margin:0; font-size:clamp(30px,7vw,64px); line-height:1.15; perspective:600px; }
  .gx h3 .ch { display:inline-block; will-change:transform; }
  .gx .en { font-size:clamp(16px,3vw,24px); color:var(--muted); letter-spacing:.05em; }
  .gx .en .w { display:inline-block; margin:0 .2em; overflow:hidden; vertical-align:top; } .gx .en .w span { display:inline-block; }
  .gx .grad { background:linear-gradient(90deg,#818cf8,#22d3ee,#f472b6); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .gx .scr { font-family:ui-monospace,monospace; color:#34d399; font-size:clamp(14px,2.6vw,20px); min-height:1.4em; }
  `);
  const effects = { rise: '上升', flip: '翻转', scatter: '散开', wave: '波浪', elastic: '弹性' };
  host.innerHTML = `<div class="fx-bar">${Object.entries(effects).map(([k, v]) => `<button class="btn" data-e="${k}">${v}</button>`).join('')}</div>
    <div class="gx"><h3 id="gxT">你好，云澜！前端特效</h3><div class="en" id="gxE">Animate every character with GSAP stagger</div><div class="scr" id="gxS"></div></div>`;
  const split = (el) => { const t = el.textContent; el.innerHTML = [...t].map((c) => `<span class="ch ${/[\u4e00-\u9fa5]/.test(c) ? 'grad' : ''}">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); return el.querySelectorAll('.ch'); };
  const chars = split(host.querySelector('#gxT'));
  const en = host.querySelector('#gxE');
  en.innerHTML = en.textContent.split(' ').map((w) => `<span class="w"><span>${w}</span></span>`).join('');
  const words = en.querySelectorAll('.w > span');
  const scr = host.querySelector('#gxS');
  const target = '> npm i gsap && build --wow';
  const glyphs = '!<>-_\\/[]{}—=+*^?#01';
  let tl;
  const scramble = () => {
    const o = { p: 0 };
    return gsap.to(o, { p: 1, duration: 1.6, ease: 'none', onUpdate: () => {
      const n = Math.floor(o.p * target.length);
      scr.textContent = target.slice(0, n) + Array.from({ length: Math.min(6, target.length - n) }, () => glyphs[(Math.random() * glyphs.length) | 0]).join('');
    } });
  };
  const play = (k) => {
    tl && tl.kill();
    gsap.set([chars, words], { clearProps: 'all' });
    host.querySelectorAll('[data-e]').forEach((b) => b.classList.toggle('on', b.dataset.e === k));
    tl = gsap.timeline();
    const from = {
      rise: { y: 80, opacity: 0, duration: .8, ease: 'power4.out', stagger: .05 },
      flip: { rotationX: -100, transformOrigin: '50% 50% -30px', opacity: 0, duration: .9, ease: 'back.out(2)', stagger: .06 },
      scatter: { x: () => gsap.utils.random(-300, 300), y: () => gsap.utils.random(-200, 200), rotation: () => gsap.utils.random(-180, 180), opacity: 0, duration: 1.2, ease: 'expo.out', stagger: { each: .03, from: 'random' } },
      wave: { y: -50, opacity: 0, duration: .6, ease: 'sine.out', stagger: { each: .06, from: 'center', yoyo: true } },
      elastic: { scale: 0, opacity: 0, duration: 1.2, ease: 'elastic.out(1,0.35)', stagger: { each: .05, from: 'edges' } },
    }[k];
    tl.from(chars, from).from(words, { yPercent: 110, duration: .6, ease: 'power3.out', stagger: .06 }, '-=0.4').add(scramble(), '-=0.3');
  };
  host.querySelector('.fx-bar').addEventListener('click', (e) => { const k = e.target.closest('[data-e]')?.dataset.e; if (k) play(k); });
  host.querySelector('.gx').addEventListener('click', () => play(host.querySelector('[data-e].on')?.dataset.e || 'rise'));
  play('rise');
  return () => { tl && tl.kill(); rm(); host.innerHTML = ''; };
}
