import { addStyle, makeCanvas, loop, localPoint } from '../../lib/canvas.js';

/**
 * Interactive control panel for demos.
 * Preset buttons switch style; sliders/toggles live-update params.
 * onChange(state, meta) — meta.reason = 'preset'|'param'|'action'
 */
export function panel(host, title, {
  presets = [],
  params = [],
  actions = [],
  presetIndex = 0,
  onChange,
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'fx-root';
  const barEl = document.createElement('div');
  barEl.className = 'fx-bar demo-controls';
  const stage = document.createElement('div');
  stage.className = 'kit-stage';
  stage.style.cssText = 'position:absolute;inset:0';

  const chip = document.createElement('span');
  chip.className = 'chip accent';
  chip.textContent = title;
  barEl.appendChild(chip);

  const state = {
    style: Math.max(0, Math.min(presetIndex, Math.max(presets.length - 1, 0))),
    styleName: presets[0] || '默认',
  };

  for (const p of params) {
    if (p.type === 'toggle') state[p.key] = !!p.value;
    else if (p.type === 'color') state[p.key] = p.value || '#818cf8';
    else if (p.type === 'select') state[p.key] = p.value ?? p.options?.[0]?.value;
    else if (p.type === 'range') state[p.key] = p.value ?? p.min ?? 0;
  }

  const presetWrap = document.createElement('div');
  presetWrap.className = 'preset-row';
  if (presets.length > 1) {
    presets.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset-btn' + (i === state.style ? ' on' : '');
      b.textContent = name;
      b.title = name;
      b.addEventListener('click', () => {
        state.style = i;
        state.styleName = name;
        presetWrap.querySelectorAll('.preset-btn').forEach((el, j) => {
          el.classList.toggle('on', j === i);
        });
        onChange?.(clone(state), { reason: 'preset', key: 'style' });
      });
      presetWrap.appendChild(b);
    });
    barEl.appendChild(presetWrap);
  } else if (presets.length === 1) {
    state.styleName = presets[0];
  }

  const paramWrap = document.createElement('div');
  paramWrap.className = 'param-row';
  for (const p of params) {
    const label = document.createElement('label');
    label.className = 'param';
    if (p.type === 'range') {
      label.innerHTML = `${p.label || p.key} <input type="range" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.step ?? 0.1}" value="${state[p.key]}" data-k="${p.key}"><em data-v>${fmt(state[p.key])}</em>`;
      const input = label.querySelector('input');
      const em = label.querySelector('[data-v]');
      input.addEventListener('input', () => {
        state[p.key] = parseFloat(input.value);
        em.textContent = fmt(state[p.key]);
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    } else if (p.type === 'color') {
      label.innerHTML = `${p.label || '颜色'} <input type="color" value="${state[p.key]}" data-k="${p.key}">`;
      label.querySelector('input').addEventListener('input', (e) => {
        state[p.key] = e.target.value;
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    } else if (p.type === 'select') {
      const opts = (p.options || []).map((o) => `<option value="${esc(String(o.value))}" ${String(o.value) === String(state[p.key]) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      label.innerHTML = `${p.label || p.key} <select data-k="${p.key}">${opts}</select>`;
      label.querySelector('select').addEventListener('change', (e) => {
        state[p.key] = e.target.value;
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    } else if (p.type === 'toggle') {
      label.classList.add('toggle');
      label.innerHTML = `<input type="checkbox" data-k="${p.key}" ${state[p.key] ? 'checked' : ''}> ${p.label || p.key}`;
      label.querySelector('input').addEventListener('change', (e) => {
        state[p.key] = e.target.checked;
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    }
    paramWrap.appendChild(label);
  }
  if (params.length) barEl.appendChild(paramWrap);

  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = a.label || a.key;
    b.addEventListener('click', () => {
      onChange?.(clone(state), { reason: 'action', key: a.key });
    });
    barEl.appendChild(b);
  }

  wrap.appendChild(barEl);
  wrap.appendChild(stage);
  host.appendChild(wrap);

  return {
    wrap,
    stage,
    bar: barEl,
    get: () => clone(state),
    set(patch) {
      Object.assign(state, patch);
      if (typeof patch.style === 'number' && presets.length) {
        state.styleName = presets[state.style] || state.styleName;
        presetWrap.querySelectorAll('.preset-btn').forEach((el, j) => {
          el.classList.toggle('on', j === state.style);
        });
      }
      for (const p of params) {
        const el = paramWrap.querySelector(`[data-k="${p.key}"]`);
        if (!el) continue;
        if (p.type === 'toggle') el.checked = !!state[p.key];
        else el.value = state[p.key];
        const em = el.parentElement?.querySelector?.('[data-v]');
        if (em) em.textContent = fmt(state[p.key]);
      }
    },
    destroy() {
      host.innerHTML = '';
    },
  };
}

/** Backward-compatible thin bar. Prefer panel(). Skips outer chrome when already inside withControls. */
export function bar(host, title, controlsHtml = '') {
  if (host.classList?.contains('kit-inner') || host.closest?.('.demo-controls') || host.parentElement?.classList?.contains('kit-stage')) {
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;inset:0';
    if (controlsHtml) {
      const mini = document.createElement('div');
      mini.className = 'fx-bar nested-actions';
      mini.innerHTML = controlsHtml;
      host.appendChild(mini);
      stage.style.top = '44px';
    }
    host.appendChild(stage);
    return { wrap: host, stage, bar: null };
  }
  const wrap = document.createElement('div');
  wrap.className = 'fx-root';
  wrap.innerHTML = `<div class="fx-bar"><span class="chip accent">${title}</span>${controlsHtml}</div><div class="kit-stage" style="position:absolute;inset:0"></div>`;
  host.appendChild(wrap);
  return { wrap, stage: wrap.querySelector('.kit-stage'), bar: wrap.querySelector('.fx-bar') };
}

export function hsl(i, s = 70, l = 55) {
  return `hsl(${(Number(i) * 47) % 360} ${s}% ${l}%)`;
}

export function hexFromHue(i) {
  const h = (Number(i) * 47) % 360;
  return hslToHex(h, 70, 55);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function rand(a = 0, b = 1) {
  return a + Math.random() * (b - a);
}

/** Normalize legacy `pulse-3` → family `pulse`, style index 2 */
export function parseVariant(variant, fallback = 'demo') {
  const id = String(variant || fallback);
  const m = id.match(/^(.*)-(\d+)$/);
  if (m) return { family: m[1], style: Math.max(0, parseInt(m[2], 10) - 1), raw: id };
  return { family: id, style: 0, raw: id };
}

export function defaultParams({ color = true, speed = true, size = false, count = false, blur = false, easing = false } = {}) {
  const params = [];
  if (color) params.push({ key: 'color', type: 'color', label: '颜色', value: '#818cf8' });
  if (speed) params.push({ key: 'speed', type: 'range', label: '速度', min: 0.3, max: 2.5, step: 0.1, value: 1 });
  if (size) params.push({ key: 'size', type: 'range', label: '尺寸', min: 0.5, max: 2, step: 0.1, value: 1 });
  if (count) params.push({ key: 'count', type: 'range', label: '数量', min: 1, max: 200, step: 1, value: 40 });
  if (blur) params.push({ key: 'blur', type: 'range', label: '模糊', min: 0, max: 20, step: 1, value: 0 });
  if (easing) {
    params.push({
      key: 'easing', type: 'select', label: '缓动', value: 'ease',
      options: [
        { label: 'linear', value: 'linear' },
        { label: 'ease', value: 'ease' },
        { label: 'ease-in', value: 'ease-in' },
        { label: 'ease-out', value: 'ease-out' },
        { label: 'ease-in-out', value: 'ease-in-out' },
        { label: 'back', value: 'cubic-bezier(.34,1.56,.64,1)' },
        { label: 'steps', value: 'steps(5)' },
      ],
    });
  }
  return params;
}

function clone(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}
function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export { addStyle, makeCanvas, loop, localPoint };
