import { addStyle, makeCanvas, loop, localPoint } from '../../lib/canvas.js';

export function bar(host, title, controlsHtml = '') {
  const wrap = document.createElement('div');
  wrap.className = 'fx-root';
  wrap.innerHTML = `<div class="fx-bar"><span class="chip accent">${title}</span>${controlsHtml}</div><div class="kit-stage" style="position:absolute;inset:0"></div>`;
  host.appendChild(wrap);
  return { wrap, stage: wrap.querySelector('.kit-stage'), bar: wrap.querySelector('.fx-bar') };
}

export function hsl(i, s = 70, l = 55) {
  return `hsl(${(i * 47) % 360} ${s}% ${l}%)`;
}

export function rand(a = 0, b = 1) {
  return a + Math.random() * (b - a);
}

export { addStyle, makeCanvas, loop, localPoint };
