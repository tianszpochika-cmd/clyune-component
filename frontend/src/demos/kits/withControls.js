import { panel, defaultParams, parseVariant, NAMED_COLORS } from './_shared.js';
import { FAMILY_PRESETS } from './presets.js';

/**
 * Wrap a legacy kit mount(host, { variant }) so it gets preset buttons + param sliders.
 * On preset change, remounts with variant `${family}-${style+1}` (1-based), matching old kits.
 * Color/speed/size applied as CSS vars on stage + child roots; count remounts.
 */
export function withControls(host, opts, {
  kitKey,
  title,
  fallbackVariant = 'demo-1',
  params,
  actions = [{ key: 'reset', label: '重置' }],
  mapVariant, // (family, styleIndex1based) => variant string
  mountLegacy,
  liveKeys = ['color', 'speed', 'size', 'count', 'blur'],
  remountKeys = ['count'],
  presets: presetsOverride,
  presetDefaults = {}, // { '换行': { items: 24, wrap: 'wrap' }, ... }
}) {
  const parsed = parseVariant(opts.variant || fallbackVariant, fallbackVariant);
  let family = parsed.family;
  const presetKey = `${kitKey}:${opts.variant || family}`;
  const presetKey2 = `${kitKey}:${family}`;
  let presets = presetsOverride || FAMILY_PRESETS[presetKey] || FAMILY_PRESETS[presetKey2];

  if (!presets && FAMILY_PRESETS[`${kitKey}:${parsed.raw}`]) {
    family = parsed.raw;
    presets = FAMILY_PRESETS[`${kitKey}:${family}`];
  }
  presets = presets || ['默认'];

  const paramDefs = params || defaultParams({ color: true, speed: true, size: true, count: false });
  let innerDispose;

  const ui = panel(host, title || family, {
    presets,
    params: paramDefs,
    actions,
    presetIndex: parsed.style % presets.length,
    onChange(state, meta) {
      if (meta.reason === 'preset') {
        const named = NAMED_COLORS[state.styleName];
        const patch = {};
        if (named && paramDefs.some((p) => p.key === 'color')) {
          patch.color = named;
        }
        const pd = presetDefaults?.[state.styleName];
        if (pd && typeof pd === 'object') Object.assign(patch, pd);
        if (Object.keys(patch).length) {
          Object.assign(state, patch);
          ui.set(patch);
        }
      }
      if (meta.reason === 'action' && (meta.key === 'add-item' || meta.key === 'remove-item')) {
        const def = paramDefs.find((p) => p.key === 'items') || paramDefs.find((p) => p.key === 'count');
        if (def) {
          const cur = Number(ui.get()[def.key]);
          const base = Number.isFinite(cur) ? cur : (def.value ?? def.min ?? 1);
          const step = Number(def.step) || 1;
          const next = meta.key === 'add-item'
            ? Math.min(def.max ?? 48, base + step)
            : Math.max(def.min ?? 1, base - step);
          ui.set({ [def.key]: next });
          const s = ui.get();
          applyLive(s);
          remount(s);
        }
        return;
      }
      applyLive(state);
      if (meta.reason === 'preset' || meta.reason === 'action') {
        remount(ui.get());
        return;
      }
      if (meta.reason === 'param' && remountKeys.includes(meta.key)) {
        remount(state);
      }
    },
  });

  // Seed named color + preset-specific defaults if starting preset maps to them
  const init = ui.get();
  const seed = {};
  const named0 = NAMED_COLORS[init.styleName];
  if (named0 && paramDefs.some((p) => p.key === 'color')) seed.color = named0;
  const pd0 = presetDefaults?.[init.styleName];
  if (pd0 && typeof pd0 === 'object') Object.assign(seed, pd0);
  if (Object.keys(seed).length) ui.set(seed);

  function applyLive(state) {
    if (!state) return;
    const targets = [
      ui.stage,
      ui.wrap,
      ...ui.stage.querySelectorAll('.kit-inner, .kit-css, .ks, .ku, .ck, .kf, .kg, [data-kit-root], canvas'),
    ];
    for (const el of targets) {
      if (!el || !el.style) continue;
      if (liveKeys.includes('color') && state.color) el.style.setProperty('--c', state.color);
      if (liveKeys.includes('speed') && state.speed != null) el.style.setProperty('--spd', String(state.speed));
      if (liveKeys.includes('size') && state.size != null) el.style.setProperty('--sz', String(state.size));
      if (liveKeys.includes('count') && state.count != null) el.style.setProperty('--count', String(state.count));
      if (liveKeys.includes('blur') && state.blur != null) el.style.setProperty('--blur', String(state.blur));
    }
  }

  function remount(state) {
    try { innerDispose?.(); } catch (_) {}
    innerDispose = undefined;
    ui.stage.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'kit-inner';
    box.style.cssText = 'position:absolute;inset:0';
    ui.stage.appendChild(box);
    const style1 = (state?.style ?? 0) + 1;
    const variant = mapVariant
      ? mapVariant(family, style1, state)
      : `${family}-${style1}`;
    const result = mountLegacy(box, { ...opts, variant, _controls: state });
    if (result && typeof result.then === 'function') {
      result.then((d) => { innerDispose = typeof d === 'function' ? d : undefined; applyLive(state); });
    } else {
      innerDispose = typeof result === 'function' ? result : undefined;
      applyLive(state);
    }
  }

  remount(ui.get());
  return () => {
    try { innerDispose?.(); } catch (_) {}
    ui.destroy();
  };
}


/**
 * Wrap a legacy mount(host) that has no panel, adding DemoControls.
 * Color/speed/size applied as CSS vars; count (and optional remountKeys) remount.
 * Inner mount receives opts._controls; CSS demos can rely on --c/--spd/--sz on stage.
 */
export function wrapLegacyMount(host, opts = {}, {
  title = 'Demo',
  presets = ['默认'],
  params,
  actions = [{ key: 'reset', label: '重置' }],
  remountKeys = ['count'],
  liveKeys = ['color', 'speed', 'size', 'count', 'blur'],
  mountInner,
} = {}) {
  return withControls(host, { ...opts, variant: opts.variant || opts.slug || 'legacy-1' }, {
    kitKey: 'legacy',
    title,
    fallbackVariant: 'legacy-1',
    params: params || defaultParams({ color: true, speed: true, size: true, count: true }),
    actions,
    remountKeys,
    liveKeys,
    presets,
    mapVariant: () => opts.variant || opts.slug || 'legacy-1',
    mountLegacy: (box, o) => mountInner(box, o),
  });
}
