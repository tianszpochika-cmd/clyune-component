/**
 * Site-wide SOUND master switch (top-right speaker). Default OFF, sticky in localStorage ('cc-sound').
 * ON  → every audio demo plays its sound as soon as it is entered, and stays on across demos.
 * OFF → every demo is silent (no per-demo sound pill any more).
 * One shared AudioContext lives here (never remounted by routes); demos build their graph on it via getAudio().
 * Autoplay: the toggle click is a user gesture and resumes the context; if the preference is ON on a fresh load,
 * the context starts suspended and resumes on the first pointer/key gesture (st.blocked → small hint in the header).
 */
import { useEffect, useState } from 'react';

const KEY = 'cc-sound', EVT = 'cc-sound';
type St = { on: boolean; blocked: boolean };
const st: St = {
  on: (() => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } })(),
  blocked: false,
};
/* the retired background-music preference must not linger */
try { localStorage.removeItem('cc-music'); localStorage.removeItem('cc-music-vol'); } catch (_) { /* ignore */ }

const emit = () => window.dispatchEvent(new CustomEvent(EVT, { detail: st.on }));
const NativeAC: typeof AudioContext | undefined = typeof window !== 'undefined'
  ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
let ctx: AudioContext | null = null;

function build(): AudioContext | null {
  if (ctx || !NativeAC) return ctx;
  try { ctx = new NativeAC(); } catch (_) { ctx = null; }
  ctx?.addEventListener('statechange', sync);
  return ctx;
}
function sync() {
  const b = st.on && !!ctx && ctx.state !== 'running';
  if (b !== st.blocked) { st.blocked = b; emit(); }
}
async function resume() {
  if (!ctx) return;
  try { await ctx.resume(); } catch (_) { /* ignore */ }
  sync();
}

/** Shared AudioContext while sound is ON (null when OFF or unsupported). */
export function getAudio(): AudioContext | null { return st.on ? build() : null; }
export const soundOn = () => st.on;
/** Subscribe to master-switch changes; returns disposer. */
export function onSound(fn: (on: boolean) => void) {
  const h = () => fn(st.on);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}
export function setSound(on: boolean) {
  if (on === st.on) return;
  st.on = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
  if (on) { build(); resume(); } else { ctx?.suspend().catch(() => {}); }
  sync(); emit();
}
export function useSound() {
  const [, force] = useState(0);
  useEffect(() => { const h = () => force((n) => n + 1); window.addEventListener(EVT, h); return () => window.removeEventListener(EVT, h); }, []);
  return { ...st };
}
export function initSound() {
  if (st.on) { build(); resume(); }
  const go = () => { if (st.on) { build(); resume(); } };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
  window.addEventListener('touchend', go, true);
}
