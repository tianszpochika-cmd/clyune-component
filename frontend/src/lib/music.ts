/**
 * Global background music — self-generated WebAudio ambient (no assets, no CDN).
 * One AudioContext owned by this module (never remounted by React routes). Default OFF, sticky.
 * Ducks while any other AudioContext (an audio demo) is running or a <audio>/<video> plays.
 */
import { useEffect, useState } from 'react';

const KEY = 'cc-music', VKEY = 'cc-music-vol', EVT = 'cc-music';
type St = { on: boolean; vol: number; ducked: boolean; blocked: boolean };
const st: St = {
  on: (() => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } })(),
  vol: (() => { try { const v = parseFloat(localStorage.getItem(VKEY) || ''); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.35; } catch (_) { return 0.35; } })(),
  ducked: false, blocked: false,
};
const emit = () => window.dispatchEvent(new CustomEvent(EVT));

type AC = AudioContext;
const NativeAC: typeof AudioContext | undefined = typeof window !== 'undefined'
  ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
let ctx: AC | null = null;
let master: GainNode | null = null;
let timer = 0;
let creatingOwn = false;
const others = new Set<AC>();
let mediaPlaying = 0;
const MAXV = 0.16; // master ceiling at vol=1 (keep it quiet)

/* Track demo AudioContexts so we can duck under them. */
if (NativeAC && typeof window !== 'undefined' && !(window as unknown as { __ccACWrapped?: boolean }).__ccACWrapped) {
  (window as unknown as { __ccACWrapped?: boolean }).__ccACWrapped = true;
  const Wrapped = function (this: unknown, ...a: unknown[]) {
    const c = new (NativeAC as unknown as new (...x: unknown[]) => AC)(...a);
    if (!creatingOwn) { others.add(c); c.addEventListener('statechange', () => { if (c.state === 'closed') others.delete(c); updateDuck(); }); queueMicrotask(updateDuck); }
    return c;
  } as unknown as typeof AudioContext;
  Wrapped.prototype = NativeAC.prototype;
  Object.setPrototypeOf(Wrapped, NativeAC);
  try { window.AudioContext = Wrapped; } catch (_) { /* ignore */ }
  try { (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = Wrapped; } catch (_) { /* ignore */ }
  document.addEventListener('play', (e) => { if (e.target instanceof HTMLMediaElement && !e.target.muted) { mediaPlaying++; updateDuck(); } }, true);
  const down = (e: Event) => { if (e.target instanceof HTMLMediaElement) { mediaPlaying = Math.max(0, mediaPlaying - 1); updateDuck(); } };
  document.addEventListener('pause', down, true); document.addEventListener('ended', down, true);
}
function shouldDuck() {
  for (const c of others) if (c.state === 'running') return true;
  return mediaPlaying > 0;
}
function target() { return st.on && !st.ducked ? st.vol * MAXV : 0; }
function ramp(t = 1.2) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(target(), now + t);
}
function updateDuck() {
  const d = shouldDuck();
  if (d !== st.ducked) { st.ducked = d; ramp(d ? 0.6 : 2.5); emit(); }
}

/* ---- generative ambient: slow pad chords + sparse pentatonic bells through a feedback delay ---- */
const ROOT = 220; // A3
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const CHORDS = [[0, 7, 16], [-3, 4, 12], [-7, 0, 9], [-5, 2, 11]];
const hz = (semi: number) => ROOT * Math.pow(2, semi / 12);
let bus: GainNode | null = null;
let chordI = 0;

function build() {
  if (ctx || !NativeAC) return;
  creatingOwn = true;
  try { ctx = new NativeAC({ latencyHint: 'playback' }); } finally { creatingOwn = false; }
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.3;
  const dly = ctx.createDelay(2); dly.delayTime.value = 0.62;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  bus = ctx.createGain(); bus.gain.value = 1;
  bus.connect(lp); lp.connect(master); lp.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(master);
}
function voice(f: number, t0: number, dur: number, peak: number, type: OscillatorType, detune = 0) {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
  const g = ctx.createGain(); g.gain.value = 0;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.35);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
}
function schedule() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.1;
  const ch = CHORDS[chordI++ % CHORDS.length];
  for (const s of ch) { voice(hz(s - 12), t, 9, 0.11, 'sine', -4); voice(hz(s - 12), t, 9, 0.07, 'triangle', 5); }
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const s = SCALE[Math.floor(Math.random() * SCALE.length)];
    voice(hz(s + 12), t + 0.8 + Math.random() * 6, 2.6, 0.05, 'sine');
  }
}
function startLoop() {
  if (timer) return;
  schedule();
  timer = window.setInterval(() => { if (ctx && ctx.state === 'running' && st.on) schedule(); }, 8000);
}
function stopLoop() { if (timer) { clearInterval(timer); timer = 0; } }

async function resume() {
  if (!ctx) return;
  try { await ctx.resume(); } catch (_) { /* ignore */ }
  const b = ctx.state !== 'running';
  if (b !== st.blocked) { st.blocked = b; emit(); }
  if (!b) { startLoop(); ramp(2); }
}
/* Autoplay policy: retry resume on first user gesture. */
function armGesture() {
  const go = () => { if (st.on) resume(); if (!st.blocked) { window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true); } };
  window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
}

export function setMusic(on: boolean) {
  st.on = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
  if (on) { build(); st.ducked = shouldDuck(); resume(); }
  else { ramp(0.5); stopLoop(); window.setTimeout(() => { if (!st.on) ctx?.suspend().catch(() => {}); }, 700); }
  emit();
}
export function setMusicVol(v: number) {
  st.vol = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(VKEY, String(st.vol)); } catch (_) { /* ignore */ }
  ramp(0.15); emit();
}
export function useMusic() {
  const [, force] = useState(0);
  useEffect(() => { const h = () => force((n) => n + 1); window.addEventListener(EVT, h); return () => window.removeEventListener(EVT, h); }, []);
  return { ...st };
}
export function initMusic() {
  if (st.on) { build(); resume(); }
  armGesture();
}
