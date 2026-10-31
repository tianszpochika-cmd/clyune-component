import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';

const TITLES={stroke:'描边路径','icon-anim':'图标动效',morph:'形变 Morph',smil:'SMIL/CSS',dash:'虚线流转',drawtext:'文字描边',ring:'环形进度','filter-svg':'SVG 滤镜',mask:'遮罩',follow:'路径跟随','blob-svg':'SVG Blob','chart-draw':'图表描出',sprite:'图标精灵','gradient-svg':'渐变动画'};
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-svg',
    title: TITLES[parseVariant(opts.variant||'stroke').family]||'SVG',
    fallbackVariant: 'stroke',
    params: defaultParams({color:true,speed:true,size:true}),
    
    mountLegacy,
  });
}


function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'stroke-1';
  const n = parseInt(String(id).split('-').pop(), 10) || 1;
  const parts = id.split('-');
  // handle filter-svg-N, blob-svg-N, chart-draw-N, gradient-svg-N, icon-anim -> icon
  let kind = parts.slice(0, -1).join('-') || parts[0];
  if (kind === 'icon-anim' || kind.startsWith('icon')) kind = 'icon';
  if (kind === 'filter-svg') kind = 'filter';
  if (kind === 'blob-svg') kind = 'blobsvg';
  if (kind === 'chart-draw') kind = 'chartdraw';
  if (kind === 'gradient-svg') kind = 'grads';
  if (kind === 'drawtext') kind = 'drawtext';

  const { stage } = bar(host, id, `<button class="btn" data-replay>Replay</button>`);
  const c = (opts._controls && opts._controls.color) || hsl(n);
  const rm = addStyle(`
    .ks{position:absolute;inset:0;display:grid;place-items:center;padding:16px;overflow:auto;/* --c inherited from stage */}
    .ks svg{width:min(340px,86%);height:auto;overflow:visible}
    .ks path,.ks polyline,.ks circle,.ks rect,.ks polygon,.ks line,.ks ellipse{fill:none;stroke:var(--c);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
    .ks .fillable{fill:color-mix(in srgb,var(--c) 18%,transparent)}
    .ks .ico{width:84px;height:84px;cursor:pointer;border:1px solid #24314f;border-radius:18px;display:grid;place-items:center;background:#121a2f}
    .ks .ico svg{width:40px;height:40px}
    .ks .panel{width:min(380px,92%);background:#121a2f;border:1px solid #24314f;border-radius:14px;padding:16px}
    .ks .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}
    .ks text{font-family:ui-sans-serif,system-ui;font-weight:800;font-size:42px}
  `);
  const root = document.createElement('div');
  root.className = 'ks';
  stage.appendChild(root);

  const paths = {
    1: 'M40 100 A60 60 0 1 1 40.1 100',
    2: 'M100 20 L120 70 L175 70 L130 105 L148 160 L100 125 L52 160 L70 105 L25 70 L80 70 Z',
    3: 'M100 30 C60 30 40 70 100 120 C160 70 140 30 100 30',
    4: 'M20 100 Q60 40 100 100 T180 100',
    5: 'M20 40 L60 160 L100 40 L140 160 L180 40',
    6: 'M100 100 m0-70 a70 70 0 0 1 0 140 a50 50 0 0 1 0-100 a30 30 0 0 1 0 60',
    7: 'M100 25 L155 55 L155 115 L100 145 L45 115 L45 55 Z',
    8: 'M40 140 L40 60 L70 60 Q100 60 100 85 Q100 110 70 110 L40 110 M70 110 L105 140',
    9: 'M40 100 C60 40 140 40 160 100 C140 160 60 160 40 100',
    10: 'M100 40 L120 80 L160 80 L130 110 L140 150 L100 125 L60 150 L70 110 L40 80 L80 80 Z',
    11: 'M20 140 L40 80 L70 120 L100 40 L130 120 L160 80 L180 140',
    12: 'M30 120 C50 40 80 40 100 90 C120 140 150 140 170 60',
  };

  let on = false;
  let spd = (opts._controls && opts._controls.speed) || 1;
  const syncSpd = () => {
    const v = parseFloat(getComputedStyle(host).getPropertyValue('--spd'))
      || parseFloat(getComputedStyle(stage).getPropertyValue('--spd'))
      || parseFloat(getComputedStyle(host.parentElement || host).getPropertyValue('--spd'));
    if (Number.isFinite(v) && v > 0) spd = v;
  };

  const strokeAnim = (el, dur = 1.2) => {
    if (!el || !el.getTotalLength) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset ${dur / spd}s ease`;
    el.style.strokeDashoffset = '0';
  };

  const render = () => {
    if (kind === 'icon') {
      const icons = [
        `<path d="M30 50 H70 M30 70 H70 M30 90 H70"/>`,
        on ? `<path d="M40 40 L40 110 M40 40 L90 75 L40 110"/>` : `<path d="M40 40 L90 75 L40 110 Z"/>`,
        `<path class="fillable" d="M70 95 C50 75 40 60 55 48 C65 40 75 48 70 58 C65 48 75 40 85 48 C100 60 90 75 70 95"/>`,
        `<path d="M70 40 A20 20 0 0 1 70 80 H40 V40 Z"/><circle cx="70" cy="35" r="4"/>`,
        `<circle cx="70" cy="70" r="28"/><path d="M70 50 V70 L85 85"/>`,
        `<path d="M45 70 H95 M70 55 L95 70 L70 85"/><path d="M50 90 H90"/>`,
        `<circle cx="70" cy="70" r="24"/><path d="M70 50 V70 L82 78"/><circle cx="70" cy="70" r="4"/>`,
        `<path d="M40 75 Q70 40 100 75 V95 H40 Z"/><path d="M55 95 V105 H85 V95"/>`,
        on ? `<path d="M40 70 L60 90 L100 50"/>` : `<circle cx="70" cy="70" r="28"/>`,
        `<path d="M40 70 H100 M75 45 L100 70 L75 95"/>`,
        on ? `<path d="M45 45 L95 95 M95 45 L45 95"/>` : `<path d="M35 50 H95 M35 70 H95 M35 90 H95"/>`,
        `<circle cx="70" cy="70" r="28" stroke-dasharray="40 80"><animateTransform attributeName="transform" type="rotate" from="0 70 70" to="360 70 70" dur="${1.2/spd}s" repeatCount="indefinite"/></circle>`,
      ];
      const i = (n - 1) % icons.length;
      root.innerHTML = `<div class="ico" data-ico><svg viewBox="0 0 140 140" stroke="${c}" fill="none" stroke-width="8" stroke-linecap="round">${icons[i]}</svg></div>`;
      root.querySelector('[data-ico]').onclick = () => { on = !on; render(); setTimeout(() => strokeAnim(root.querySelector('path')), 30); };
    } else if (kind === 'morph') {
      const shapes = [paths[2], paths[3], paths[7], paths[1], paths[9], paths[4]];
      const a = shapes[(n - 1) % shapes.length], b = shapes[n % shapes.length];
      root.innerHTML = `<svg viewBox="0 0 200 200"><path id="mp" d="${a}"/></svg>`;
      const p = root.querySelector('#mp');
      let flip = false;
      const go = () => {
        flip = !flip;
        p.setAttribute('d', flip ? b : a);
        p.style.opacity = '0.25';
        requestAnimationFrame(() => { p.style.transition = `opacity ${0.45/spd}s`; p.style.opacity = '1'; });
        strokeAnim(p, 0.8);
      };
      host.querySelector('[data-replay]').onclick = () => { syncSpd(); go(); };
      setTimeout(go, 250);
    } else if (kind === 'smil') {
      const demos = [
        `<circle cx="100" cy="100" r="40"><animate attributeName="r" values="20;50;20" dur="${2/spd}s" repeatCount="indefinite"/></circle>`,
        `<rect x="60" y="60" width="80" height="80" rx="12"><animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="${3/spd}s" repeatCount="indefinite"/></rect>`,
        `<circle r="8" fill="${c}" stroke="none"><animateMotion dur="${3/spd}s" repeatCount="indefinite" path="M40 100 Q100 20 160 100 Q100 180 40 100"/></circle><path d="M40 100 Q100 20 160 100 Q100 180 40 100" opacity=".35"/>`,
        `<circle cx="100" cy="100" r="40"><animate attributeName="stroke" values="${c};#22d3ee;${c}" dur="${2/spd}s" repeatCount="indefinite"/></circle>`,
        `<circle cx="100" cy="100" r="40" stroke-dasharray="60 180"><animate attributeName="stroke-dashoffset" values="0;-240" dur="${2/spd}s" repeatCount="indefinite"/></circle>`,
        `<rect x="70" y="70" width="60" height="60" rx="12"><animateTransform attributeName="transform" type="scale" values="1;1.25;1" dur="${1.4/spd}s" repeatCount="indefinite" additive="sum"/><animateTransform attributeName="transform" type="translate" values="-10 -10;0 0;-10 -10" dur="${1.4/spd}s" repeatCount="indefinite" additive="sum"/></rect>`,
        `<g><circle cx="100" cy="100" r="50"/><g><animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="${4/spd}s" repeatCount="indefinite"/><path d="M100 55 L105 75 L100 70 L95 75 Z" fill="${c}" stroke="none"/></g></g>`,
        `<circle cx="100" cy="100" r="12" fill="${c}" stroke="none"><animate attributeName="opacity" values="1;0.2;1" dur="${1/spd}s" repeatCount="indefinite"/></circle>`,
      ];
      root.innerHTML = `<svg viewBox="0 0 200 200">${demos[(n-1)%demos.length]}</svg>`;
    } else if (kind === 'dash') {
      const shapes = [
        `<circle cx="100" cy="100" r="55" stroke-dasharray="12 10"/>`,
        `<rect x="40" y="40" width="120" height="120" rx="16" stroke-dasharray="14 8"/>`,
        `<path d="M30 100 Q70 30 100 100 T170 100" stroke-dasharray="10 8"/>`,
        `<path d="M40 100 H160 M140 70 L160 100 L140 130" stroke-dasharray="8 6"/>`,
        `<rect x="30" y="30" width="140" height="140" rx="20" stroke-dasharray="20 12"/>`,
        `<circle cx="100" cy="100" r="55" stroke-dasharray="30 20 5 20"/>`,
      ];
      root.innerHTML = `<svg viewBox="0 0 200 200">${shapes[(n-1)%shapes.length]}</svg>`;
      const el = root.querySelector('circle,rect,path');
      if (el) {
        el.style.animation = `ksdash ${2/spd}s linear infinite`;
        const st = document.createElement('style');
        st.textContent = `@keyframes ksdash{to{stroke-dashoffset:-200}}`;
        root.appendChild(st);
      }
    } else if (kind === 'drawtext') {
      const labels = ['CLYUNE', 'MOTION', 'SVG', 'DRAW', 'FLOW', '云澜'];
      const t = labels[(n - 1) % labels.length];
      root.innerHTML = `<svg viewBox="0 0 400 120"><text id="tx" x="200" y="78" text-anchor="middle" fill="transparent" stroke="${c}" stroke-width="2">${t}</text></svg>`;
      // approximate with path length via getComputedTextLength workaround: animate opacity + dash on a underline + letter spacing
      const tx = root.querySelector('#tx');
      tx.style.strokeDasharray = '400';
      tx.style.strokeDashoffset = '400';
      tx.getBoundingClientRect();
      tx.style.transition = `stroke-dashoffset ${1.4/spd}s ease, fill ${0.4/spd}s ease ${1/spd}s`;
      tx.style.strokeDashoffset = '0';
      setTimeout(() => { tx.setAttribute('fill', `color-mix(in srgb, ${c} 35%, transparent)`); }, 200);
    } else if (kind === 'ring') {
      const v = 35 + (n * 9) % 60;
      root.innerHTML = `<div class="panel" style="text-align:center">
        <svg viewBox="0 0 120 120" width="140" height="140">
          <circle cx="60" cy="60" r="48" stroke="#24314f" stroke-width="10"/>
          <circle id="rg" cx="60" cy="60" r="48" stroke="${c}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${2*Math.PI*48}" stroke-dashoffset="${2*Math.PI*48}" transform="rotate(-90 60 60)"/>
          ${n===6?`<line x1="60" y1="60" x2="60" y2="28" stroke="${c}" stroke-width="3" id="needle"/>`:''}
          <text x="60" y="66" text-anchor="middle" fill="#e8eefc" stroke="none" font-size="18" id="rv">${v}%</text>
        </svg>
        <input type="range" min="0" max="100" value="${v}" data-ring style="width:80%">
      </div>`;
      const circ = 2 * Math.PI * 48;
      const apply = (val) => {
        const el = root.querySelector('#rg');
        el.style.transition = `stroke-dashoffset ${0.5/spd}s ease`;
        el.style.strokeDashoffset = String(circ * (1 - val / 100));
        root.querySelector('#rv').textContent = `${val}%`;
        const needle = root.querySelector('#needle');
        if (needle) needle.setAttribute('transform', `rotate(${val * 2.7 - 135} 60 60)`);
      };
      root.querySelector('[data-ring]').oninput = (e) => apply(+e.target.value);
      setTimeout(() => apply(v), 100);
    } else if (kind === 'filter') {
      const filters = [
        `<filter id="f"><feGaussianBlur stdDeviation="3"/></filter>`,
        `<filter id="f"><feDropShadow dx="4" dy="6" stdDeviation="4" flood-color="${c}"/></filter>`,
        `<filter id="f"><feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/><feSpecularLighting in="b" surfaceScale="5" specularConstant="1" specularExponent="20" result="s" lighting-color="#fff"><fePointLight x="50" y="30" z="40"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in"/><feComposite in="SourceGraphic"/></filter>`,
        `<filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="12"/></filter>`,
        `<filter id="f"><feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="18"/></filter>`,
        `<filter id="f"><feColorMatrix type="hueRotate" values="90"/></filter>`,
        `<filter id="f"><feMorphology operator="dilate" radius="2"/></filter>`,
        `<filter id="f"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
      ];
      root.innerHTML = `<svg viewBox="0 0 200 200"><defs>${filters[(n-1)%filters.length]}</defs>
        <path filter="url(#f)" class="fillable" d="${paths[3]}"/>
        <circle filter="url(#f)" cx="150" cy="50" r="18" fill="${c}" stroke="none"/>
      </svg>`;
    } else if (kind === 'mask') {
      root.innerHTML = `<svg viewBox="0 0 200 200">
        <defs>
          <mask id="m"><rect width="200" height="200" fill="#000"/>
            <circle id="mc" cx="100" cy="100" r="40" fill="#fff"/>
          </mask>
        </defs>
        <rect width="200" height="200" fill="#18233d"/>
        <g mask="url(#m)">
          <rect width="200" height="200" fill="url(#g)" />
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c}"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
          <text x="100" y="110" text-anchor="middle" fill="#0b1020" stroke="none" font-size="28">MASK</text>
        </g>
      </svg>`;
      const mc = root.querySelector('#mc');
      root.querySelector('svg').addEventListener('pointermove', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 200;
        const y = ((e.clientY - r.top) / r.height) * 200;
        mc.setAttribute('cx', x); mc.setAttribute('cy', y);
      });
    } else if (kind === 'follow') {
      root.innerHTML = `<svg viewBox="0 0 200 200">
        <path id="fp" d="M30 100 C60 20 140 20 170 100 C140 180 60 180 30 100" opacity=".35"/>
        <circle id="dot" r="8" fill="${c}" stroke="none">
          <animateMotion dur="${3/spd}s" repeatCount="indefinite" rotate="auto" path="M30 100 C60 20 140 20 170 100 C140 180 60 180 30 100"/>
        </circle>
      </svg>`;
    } else if (kind === 'blobsvg') {
      const mk = (t) => {
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = 50 + Math.sin(t + i * 1.3) * 14 + Math.cos(t * 0.7 + i) * 8;
          pts.push([100 + Math.cos(a) * r, 100 + Math.sin(a) * r]);
        }
        let d = `M${pts[0][0]} ${pts[0][1]}`;
        for (let i = 0; i < pts.length; i++) {
          const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
          const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
          d += ` Q${p0[0]} ${p0[1]} ${mx} ${my}`;
        }
        return d + ' Z';
      };
      root.innerHTML = `<svg viewBox="0 0 200 200"><path id="bp" class="fillable" d="${mk(0)}"/></svg>`;
      const bp = root.querySelector('#bp');
      let t0 = performance.now();
      let raf;
      const tick = (now) => {
        const t = (now - t0) / 1000 * spd;
        bp.setAttribute('d', mk(t + n));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      root._cleanup = () => cancelAnimationFrame(raf);
    } else if (kind === 'chartdraw') {
      const pts = [20,80,45,30,90,50,70,25,60].map((y,i)=>[20+i*20, 20+y]);
      const line = pts.map((p,i)=> (i?'L':'M')+p[0]+' '+p[1]).join(' ');
      const area = line + ` L${pts.at(-1)[0]} 180 L20 180 Z`;
      const bars = pts.map((p,i)=>`<rect x="${p[0]-6}" y="${p[1]}" width="12" height="${180-p[1]}" rx="3"/>`).join('');
      const kinds = [
        `<path id="sp" d="${line}"/>`,
        `<path id="sp" class="fillable" d="${area}"/>`,
        bars,
        `<polygon id="sp" points="100,30 160,70 140,140 60,140 40,70"/>`,
        `<path id="sp" d="M40 100 A60 60 0 1 1 40.1 100" stroke-dasharray="200" />`,
        `<path id="sp" d="${line}"/><g fill="${c}" stroke="none">${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('')}</g>`,
      ];
      root.innerHTML = `<svg viewBox="0 0 200 200">${kinds[(n-1)%kinds.length]}</svg>`;
      root.querySelectorAll('#sp, path, rect, polygon').forEach((el) => strokeAnim(el));
    } else if (kind === 'sprite') {
      root.innerHTML = `<div class="row">${[0,1,2,3].map(i=>`
        <div class="ico" data-s="${i}"><svg viewBox="0 0 140 140" stroke="${hsl(n+i)}" fill="none" stroke-width="8" stroke-linecap="round">
          <path d="M40 70 H100 M70 40 V100"/>
        </svg></div>`).join('')}</div>`;
      root.querySelectorAll('[data-s]').forEach((el) => {
        el.onmouseenter = () => { el.style.background = 'color-mix(in srgb, var(--c) 25%, #121a2f)'; el.querySelector('path').style.transform = 'rotate(45deg)'; el.querySelector('path').style.transformOrigin = '70px 70px'; el.querySelector('path').style.transition = '.3s'; };
        el.onmouseleave = () => { el.style.background = ''; el.querySelector('path').style.transform = ''; };
      });
    } else if (kind === 'grads') {
      root.innerHTML = `<svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c}"><animate attributeName="stop-color" values="${c};#22d3ee;${c}" dur="${3/spd}s" repeatCount="indefinite"/></stop>
            <stop offset="100%" stop-color="#22d3ee"><animate attributeName="offset" values="100%;40%;100%" dur="${3/spd}s" repeatCount="indefinite"/></stop>
          </linearGradient>
        </defs>
        <rect x="30" y="40" width="140" height="120" rx="20" fill="url(#lg)" stroke="none"/>
        <text x="100" y="115" text-anchor="middle" fill="#0b1020" stroke="none" font-size="22">GRAD</text>
      </svg>`;
    } else {
      // stroke default
      const d = paths[((n - 1) % 12) + 1];
      root.innerHTML = `<svg viewBox="0 0 200 200"><path id="sp" d="${d}"/></svg>`;
      setTimeout(() => strokeAnim(root.querySelector('#sp')), 40);
    }
  };

  render();
  syncSpd();
  host.querySelector('[data-replay]')?.addEventListener('click', () => {
    syncSpd();
    if (root._cleanup) root._cleanup();
    render();
    setTimeout(() => strokeAnim(root.querySelector('#sp, #mp, path')), 40);
  });

  return () => { if (root._cleanup) root._cleanup(); rm(); host.innerHTML = ''; };
}
