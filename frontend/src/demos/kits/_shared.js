import { addStyle, makeCanvas, loop, localPoint } from '../../lib/canvas.js';

/**
 * Interactive control panel for demos.
 * Layout: top toolbar (title + preset button-group + actions) | stage | right ops sidebar (sliders/toggles).
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
  wrap.className = 'fx-root fx-layout';

  const main = document.createElement('div');
  main.className = 'fx-main';

  const toolbar = document.createElement('div');
  toolbar.className = 'fx-toolbar demo-controls';

  const stage = document.createElement('div');
  stage.className = 'kit-stage';

  const ops = document.createElement('aside');
  ops.className = 'fx-ops';
  ops.setAttribute('aria-label', '参数面板');

  const chip = document.createElement('span');
  chip.className = 'chip accent fx-title';
  chip.textContent = title;
  toolbar.appendChild(chip);

  const state = {
    style: Math.max(0, Math.min(presetIndex, Math.max(presets.length - 1, 0))),
    styleName: presets[Math.max(0, Math.min(presetIndex, Math.max(presets.length - 1, 0)))] || presets[0] || '默认',
  };

  for (const p of params) {
    if (p.type === 'toggle') state[p.key] = !!p.value;
    else if (p.type === 'color') state[p.key] = p.value || '#818cf8';
    else if (p.type === 'select') state[p.key] = p.value ?? p.options?.[0]?.value;
    else if (p.type === 'range') state[p.key] = p.value ?? p.min ?? 0;
  }

  const presetGroup = document.createElement('div');
  presetGroup.className = 'btn-group preset-group';
  presetGroup.setAttribute('role', 'group');
  presetGroup.setAttribute('aria-label', '预设');

  if (presets.length > 1) {
    presets.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset-btn' + (i === state.style ? ' on' : '');
      b.textContent = name;
      b.title = name;
      b.setAttribute('aria-pressed', i === state.style ? 'true' : 'false');
      b.addEventListener('click', () => {
        state.style = i;
        state.styleName = name;
        syncPresetButtons();
        onChange?.(clone(state), { reason: 'preset', key: 'style' });
      });
      presetGroup.appendChild(b);
    });
    toolbar.appendChild(presetGroup);
  } else if (presets.length === 1) {
    state.styleName = presets[0];
  }

  const actionGroup = document.createElement('div');
  actionGroup.className = 'btn-group action-group';
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn action-btn';
    b.textContent = a.label || a.key;
    b.dataset.action = a.key;
    b.addEventListener('click', () => {
      onChange?.(clone(state), { reason: 'action', key: a.key });
    });
    actionGroup.appendChild(b);
  }
  if (actions.length) toolbar.appendChild(actionGroup);

  const opsToggle = document.createElement('button');
  opsToggle.type = 'button';
  opsToggle.className = 'btn fx-ops-toggle on';
  opsToggle.textContent = '参数';
  opsToggle.title = '显示/隐藏参数面板';
  opsToggle.addEventListener('click', () => {
    wrap.classList.toggle('ops-collapsed');
    opsToggle.classList.toggle('on', !wrap.classList.contains('ops-collapsed'));
  });
  toolbar.appendChild(opsToggle);

  const opsHead = document.createElement('div');
  opsHead.className = 'fx-ops-head';
  opsHead.innerHTML = '<span>参数</span><button type="button" class="fx-ops-close" aria-label="收起">✕</button>';
  opsHead.querySelector('.fx-ops-close').addEventListener('click', () => {
    wrap.classList.add('ops-collapsed');
    opsToggle.classList.remove('on');
  });
  ops.appendChild(opsHead);

  const paramWrap = document.createElement('div');
  paramWrap.className = 'fx-ops-body param-row';

  for (const p of params) {
    const label = document.createElement('label');
    label.className = 'param param-' + (p.type || 'range');
    if (p.type === 'range') {
      const minus = p.buttons ? `<button type="button" class="param-step" data-dir="-1" aria-label="减少">−</button>` : '';
      const plus = p.buttons ? `<button type="button" class="param-step" data-dir="1" aria-label="增加">+</button>` : '';
      label.innerHTML = `<span class="param-label">${esc(p.label || p.key)}</span>
        <div class="param-ctrl">${minus}<input type="range" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.step ?? 0.1}" value="${state[p.key]}" data-k="${p.key}">${plus}<em data-v>${fmt(state[p.key])}</em></div>`;
      const input = label.querySelector('input');
      const em = label.querySelector('[data-v]');
      const emitRange = () => {
        state[p.key] = parseFloat(input.value);
        em.textContent = fmt(state[p.key]);
        onChange?.(clone(state), { reason: 'param', key: p.key });
      };
      input.addEventListener('input', emitRange);
      label.querySelectorAll('.param-step').forEach((btn) => {
        btn.addEventListener('click', () => {
          const dir = Number(btn.dataset.dir) || 0;
          const step = Number(p.step) || 1;
          const min = p.min ?? 0;
          const max = p.max ?? 1;
          const next = Math.max(min, Math.min(max, (Number(state[p.key]) || 0) + dir * step));
          state[p.key] = next;
          input.value = String(next);
          em.textContent = fmt(next);
          onChange?.(clone(state), { reason: 'param', key: p.key });
        });
      });
    } else if (p.type === 'color') {
      label.innerHTML = `<span class="param-label">${esc(p.label || '颜色')}</span>
        <div class="param-ctrl"><input type="color" value="${esc(state[p.key])}" data-k="${p.key}"><code data-v>${esc(state[p.key])}</code></div>`;
      const input = label.querySelector('input');
      const code = label.querySelector('[data-v]');
      input.addEventListener('input', (e) => {
        state[p.key] = e.target.value;
        code.textContent = state[p.key];
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    } else if (p.type === 'select') {
      const optsHtml = (p.options || []).map((o) => `<option value="${esc(String(o.value))}" ${String(o.value) === String(state[p.key]) ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      label.innerHTML = `<span class="param-label">${esc(p.label || p.key)}</span>
        <div class="param-ctrl"><select data-k="${p.key}">${optsHtml}</select></div>`;
      label.querySelector('select').addEventListener('change', (e) => {
        state[p.key] = e.target.value;
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    } else if (p.type === 'toggle') {
      label.classList.add('toggle');
      label.innerHTML = `<span class="param-label">${esc(p.label || p.key)}</span>
        <div class="param-ctrl"><input type="checkbox" data-k="${p.key}" ${state[p.key] ? 'checked' : ''}></div>`;
      label.querySelector('input').addEventListener('change', (e) => {
        state[p.key] = e.target.checked;
        onChange?.(clone(state), { reason: 'param', key: p.key });
      });
    }
    paramWrap.appendChild(label);
  }

  if (params.length) {
    ops.appendChild(paramWrap);
  } else {
    const empty = document.createElement('div');
    empty.className = 'fx-ops-empty';
    empty.textContent = '此演示无可调参数';
    ops.appendChild(empty);
  }

  if (actions.length) {
    const opsActions = document.createElement('div');
    opsActions.className = 'fx-ops-actions btn-group';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = a.label || a.key;
      b.addEventListener('click', () => {
        onChange?.(clone(state), { reason: 'action', key: a.key });
      });
      opsActions.appendChild(b);
    }
    ops.appendChild(opsActions);
  }

  main.appendChild(toolbar);
  main.appendChild(stage);
  wrap.appendChild(main);
  wrap.appendChild(ops);
  host.appendChild(wrap);

  if (params.length === 0 && actions.length === 0) {
    wrap.classList.add('ops-collapsed');
    opsToggle.style.display = 'none';
  } else {
    // Phones: start with params sheet closed so the stage gets full height.
    try {
      const narrow = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
      if (narrow) {
        wrap.classList.add('ops-collapsed');
        opsToggle.classList.remove('on');
      }
    } catch (_) { /* ignore */ }
  }

  function syncPresetButtons() {
    presetGroup.querySelectorAll('.preset-btn').forEach((el, j) => {
      const on = j === state.style;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  return {
    wrap,
    stage,
    bar: toolbar,
    ops,
    get: () => clone(state),
    set(patch) {
      Object.assign(state, patch);
      if (typeof patch.style === 'number' && presets.length) {
        state.styleName = presets[state.style] || state.styleName;
        syncPresetButtons();
      }
      for (const p of params) {
        const el = paramWrap.querySelector(`[data-k="${p.key}"]`);
        if (!el) continue;
        if (p.type === 'toggle') el.checked = !!state[p.key];
        else el.value = state[p.key];
        const em = el.closest('.param')?.querySelector?.('[data-v]');
        if (em) em.textContent = p.type === 'color' ? state[p.key] : fmt(state[p.key]);
      }
    },
    destroy() {
      host.innerHTML = '';
    },
  };
}

/** Named color presets used by pulse / neon / grad families */
export const NAMED_COLORS = {
  '靛紫': '#818cf8',
  '青绿': '#22d3ee',
  '玫红': '#f472b6',
  '琥珀': '#fbbf24',
  '翠绿': '#34d399',
  '天蓝': '#38bdf8',
  '橙': '#fb923c',
  '品红': '#e879f9',
  '默认': '#818cf8',
  '冷色': '#22d3ee',
  '暖色': '#fb923c',
  '霓虹': '#e879f9',
  '日落': '#f472b6',
  '极光': '#34d399',
  '绿紫': '#a78bfa',
  '蓝青': '#22d3ee',
  '粉橙': '#fb7185',
  '慢漂': '#34d399',
};

/** Backward-compatible thin bar. Prefer panel(). Skips outer chrome when already inside withControls. */
export function bar(host, title, controlsHtml = '') {
  if (host.classList?.contains('kit-inner') || host.closest?.('.demo-controls') || host.parentElement?.classList?.contains('kit-stage') || host.closest?.('.kit-stage')) {
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;inset:0';
    if (controlsHtml) {
      const mini = document.createElement('div');
      mini.className = 'fx-bar nested-actions';
      mini.innerHTML = controlsHtml;
      host.appendChild(mini);
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
  const on = (flag) => flag === true || (flag && typeof flag === 'object');
  const merge = (base, flag) => (flag && typeof flag === 'object' ? { ...base, ...flag } : base);
  if (on(color)) params.push(merge({ key: 'color', type: 'color', label: '颜色', value: '#818cf8' }, color));
  if (on(speed)) params.push(merge({ key: 'speed', type: 'range', label: '速度', min: 0.3, max: 2.5, step: 0.1, value: 1 }, speed));
  if (on(size)) params.push(merge({ key: 'size', type: 'range', label: '尺寸', min: 0.5, max: 2, step: 0.1, value: 1 }, size));
  if (on(count)) params.push(merge({ key: 'count', type: 'range', label: '数量', min: 1, max: 200, step: 1, value: 40, buttons: true }, count));
  if (on(blur)) params.push(merge({ key: 'blur', type: 'range', label: '模糊', min: 0, max: 20, step: 1, value: 0 }, blur));
  if (on(easing)) {
    params.push(merge({
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
    }, easing));
  }
  return params;
}

/** Build param list from a family control declaration: { color, speed, size, count, extras?, remountKeys? }. */
export function paramsFromSpec(spec = {}) {
  const { extras = [], remountKeys, ...flags } = spec;
  return [...defaultParams(flags), ...extras];
}

function clone(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}
function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export { addStyle, makeCanvas, loop, localPoint };

/** Read live control CSS vars (set by withControls/panel) with _controls fallback. */
export function readLiveControls(roots, ctrl = {}) {
  const els = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
  const read = (name, fallback) => {
    for (const el of els) {
      try {
        const v = getComputedStyle(el).getPropertyValue(name).trim();
        if (v) return v;
      } catch (_) { /* ignore */ }
    }
    if (fallback != null && fallback !== '') return String(fallback);
    return '';
  };
  const num = (name, fallback) => {
    const raw = read(name, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : fallback;
  };
  const speed = num('--spd', ctrl.speed ?? 1);
  const size = num('--sz', ctrl.size ?? 1);
  const count = Math.round(num('--count', ctrl.count ?? 40));
  const blur = num('--blur', ctrl.blur ?? 0);
  return {
    color: read('--c', ctrl.color || '#818cf8') || '#818cf8',
    speed: speed > 0 ? speed : 1,
    size: size > 0 ? size : 1,
    count: Number.isFinite(count) && count > 0 ? count : 40,
    blur: Number.isFinite(blur) ? blur : 0,
  };
}

/** Parse #rgb / #rrggbb into [r,g,b] 0..1 for WebGL / canvas. */
export function colorToRgb(color) {
  const s = String(color || '#818cf8').trim();
  if (s.startsWith('#') && (s.length === 4 || s.length === 7)) {
    const hex = s.length === 4
      ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
      : s;
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    ];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [(+m[1]) / 255, (+m[2]) / 255, (+m[3]) / 255];
  return [0.506, 0.549, 0.973];
}
