import { panel, defaultParams, parseVariant } from './_shared.js';
import { FAMILY_PRESETS } from './presets.js';

/**
 * Wrap a legacy kit mount(host, { variant }) so it gets preset buttons + param sliders.
 * On preset change, remounts with variant `${family}-${style+1}` (1-based), matching old kits.
 * Color/speed/size applied as CSS vars on stage; optional mapVariant for lab slugs.
 */
export function withControls(host, opts, {
  kitKey,
  title,
  fallbackVariant = 'demo-1',
  params,
  actions = [{ key: 'reset', label: '重置' }],
  mapVariant, // (family, styleIndex1based) => variant string
  mountLegacy,
  liveKeys = ['color', 'speed', 'size'],
}) {
  const parsed = parseVariant(opts.variant || fallbackVariant, fallbackVariant);
  let family = parsed.family;
  // lab families in registry use names like particles-lab; presets keyed as kitKey:particles-lab
  const presetKey = `${kitKey}:${opts.variant || family}`;
  const presetKey2 = `${kitKey}:${family}`;
  let presets = FAMILY_PRESETS[presetKey] || FAMILY_PRESETS[presetKey2];

  // If variant was already family without number (new registry), use it
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
      applyLive(state);
      if (meta.reason === 'preset' || meta.reason === 'action') {
        remount(state);
      }
    },
  });

  function applyLive(state) {
    if (!state) return;
    if (liveKeys.includes('color') && state.color) ui.stage.style.setProperty('--c', state.color);
    if (liveKeys.includes('speed') && state.speed != null) ui.stage.style.setProperty('--spd', String(state.speed));
    if (liveKeys.includes('size') && state.size != null) ui.stage.style.setProperty('--sz', String(state.size));
    if (state.count != null) ui.stage.style.setProperty('--count', String(state.count));
    if (state.blur != null) ui.stage.style.setProperty('--blur', String(state.blur));
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
