/** Shared mobile / performance heuristics for demos + shell. */

export function isCoarsePointer() {
  try {
    return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(pointer: coarse)').matches;
  } catch (_) {
    return false;
  }
}

export function isNarrow(max = 860) {
  try {
    return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia(`(max-width: ${max}px)`).matches;
  } catch (_) {
    return typeof window !== 'undefined' && window.innerWidth <= max;
  }
}

export function preferReducedMotion() {
  try {
    return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

/** Cap devicePixelRatio for WebGL / canvas demos. */
export function maxDpr(cap = 2) {
  const mobile = isCoarsePointer() || isNarrow(720);
  const hard = mobile ? Math.min(cap, 1.5) : cap;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.min(dpr, hard);
}

/** Prefer lighter FX (fewer particles / moons / trails) on phones. */
export function preferLiteFx() {
  return isCoarsePointer() || isNarrow(720) || preferReducedMotion();
}

/** Configure OrbitControls for thumb-friendly touch without fighting page scroll. */
export function tuneOrbitControls(controls, { mobile = preferLiteFx() } = {}) {
  if (!controls) return controls;
  controls.enableDamping = true;
  controls.dampingFactor = mobile ? 0.1 : 0.07;
  controls.rotateSpeed = mobile ? 0.55 : 0.6;
  controls.zoomSpeed = mobile ? 0.85 : 0.7;
  controls.panSpeed = mobile ? 0.6 : 0.8;
  controls.touches = controls.touches || {};
  // ONE finger rotate, TWO finger dolly+pan — standard OrbitControls defaults
  if (typeof controls.touches === 'object') {
    // THREE.TOUCH.ROTATE = 0, DOLLY_PAN = 1, etc. Keep defaults if already set.
  }
  return controls;
}
