/**
 * kit-audio — audio-visualisation families on the shared canvas stage.
 * Every picture is computed from a real signal: a small additive synth (band-limited sine/square/saw/
 * triangle partials + synthetic drums + noise) rendered into a sample buffer, then analysed with a real
 * radix-2 FFT (Hann window). Hover / drag any part of the picture: the info panel shows the frequency,
 * note, level or time under the pointer live, plus 公式/说明/参数/步骤 in beginner Chinese.
 * Tap the 「声音」 pill (top-right) to actually hear the same signal through Web Audio.
 */
import { withControls } from './withControls.js';
import { paramsFromSpec } from './_shared.js';
import { createCanvasStage, hexRgb, hueOf, clamp, TAU, fmt } from './canvas-stage.js';
import { F } from './info-panel.js';

const R = (key, label, min, max, step, value) => ({ key, type: 'range', label, min, max, step, value });
const T = (key, label, value) => ({ key, type: 'toggle', label, value });
const SPD = (label, max = 3) => ({ label, min: 0, max, step: 0.1, value: 1 });
const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
const on = (x) => x === true || x === 'true' || x === 1 || x === '1';
const yes = (x) => (on(x) ? '开' : '关');
const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const lerp = (a, b, k) => a + (b - a) * k;
const rgba = (hex, a) => { const c = hexRgb(hex || '#818cf8'); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const rrect = (ctx, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const fsz = (W, H, k = 1) => clamp(Math.min(W, H) / 30, 10, 13) * k;
const text = (ctx, s, x, y, { size = 12, col = '#cbd5e1', align = 'left', base = 'middle', bold = false } = {}) => {
  ctx.font = `${bold ? '600 ' : ''}${size}px ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
};
const tip = (ctx, W, H, x, y, lines, accent = '#818cf8') => {
  if (!lines || !lines.length) return;
  const s = fsz(W, H, 0.95); ctx.font = `${s}px ui-sans-serif,system-ui,"PingFang SC",sans-serif`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18, h = lines.length * (s + 5) + 10;
  let bx = x + 14, by = y + 14; if (bx + w > W - 4) bx = x - w - 14; if (by + h > H - 4) by = y - h - 14;
  bx = clamp(bx, 4, Math.max(4, W - w - 4)); by = clamp(by, 4, Math.max(4, H - h - 4));
  ctx.fillStyle = 'rgba(8,13,26,.92)'; rrect(ctx, bx, by, w, h, 7); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
  lines.forEach((l, i) => text(ctx, l, bx + 9, by + 5 + (s + 5) * i + s / 2 + 1, { size: s, col: i ? '#cbd5e1' : '#f8fafc', bold: !i }));
};
const vline = (ctx, x, y0, y1, col = 'rgba(255,255,255,.35)') => { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.setLineDash([]); };
const glow = (ctx, W, H, C, a = 0.14) => { const h = hueOf(C.color); const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65); g.addColorStop(0, hsla(h, 70, 50, a)); g.addColorStop(1, hsla(h, 70, 50, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };

/* ───────────────────────── DSP core ───────────────────────── */
const SR = 16000, NF = 1024;
const WN = ['正弦波', '方波', '锯齿波', '三角波'];
const WT = ['sine', 'square', 'sawtooth', 'triangle'];
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const ftom = (f) => 69 + 12 * Math.log2(Math.max(1e-6, f) / 440);
const nname = (m) => { const r = Math.round(m); return NN[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); };
const noteOf = (f) => { if (!(f > 16)) return '—'; const m = ftom(f), c = Math.round((m - Math.round(m)) * 100); return `${nname(m)}${c ? (c > 0 ? ' +' : ' ') + c + '¢' : ''}`; };
const hz = (f) => (f >= 1000 ? `${fmt(f / 1000, 2)} kHz` : `${fmt(f, 0)} Hz`);
const pct = (x, d = 0) => `${fmt(x * 100, d)}%`;
const db = (x) => `${fmt(x, 1)} dB`;
const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
/** band-limited Fourier partials of a basic waveform: [ω, amplitude, k] */
const partials = (v, sr = SR) => {
  const out = [], w = v.w | 0, hmax = v.h ?? 24;
  for (let k = 1; k <= hmax; k++) {
    if (k * v.f >= sr / 2) break;
    let a = 0;
    if (w === 0) a = k === 1 ? 1 : 0;
    else if (w === 1) a = k % 2 ? 4 / (Math.PI * k) : 0;
    else if (w === 2) a = ((2 / Math.PI) * (k % 2 ? 1 : -1)) / k;
    else a = k % 2 ? ((8 / (Math.PI * Math.PI)) * (((k - 1) / 2) % 2 ? -1 : 1)) / (k * k) : 0;
    if (a) out.push([TAU * k * v.f, a * v.a, k]);
  }
  return out;
};
const drum = (k, age, idx) => {
  if (k === 'kick') return Math.sin(TAU * (50 * age + (110 / 30) * (1 - Math.exp(-30 * age)))) * Math.exp(-7 * age);
  if (k === 'snare') return hash(idx) * 0.55 * Math.exp(-16 * age) + Math.sin(TAU * 190 * age) * 0.4 * Math.exp(-22 * age);
  if (k === 'hat') return (hash(idx) - hash(idx - 1)) * 0.28 * Math.exp(-60 * age);
  if (k === 'clap') return hash(idx) * 0.5 * Math.exp(-24 * age) * (age < 0.03 && Math.floor(age * 300) % 2 ? 0.3 : 1);
  return 0;
};
/** render n samples ending at time t (seconds) from a model {voices, hits, noise} */
const render = (n, t, M, sr = SR, out = new Float32Array(n)) => {
  const P = []; for (const v of M.voices || []) for (const p of partials(v, sr)) P.push(p);
  for (let i = 0; i < n; i++) { const ts = t - (n - 1 - i) / sr; let s = 0; for (const p of P) s += p[1] * Math.sin(p[0] * ts); out[i] = s; }
  for (const h of M.hits || []) {
    const a = h.a ?? 1;
    for (let i = 0; i < n; i++) { const ts = t - (n - 1 - i) / sr, age = ts - h.t0; if (age < 0 || age > 0.7) continue; out[i] += drum(h.k, age, Math.round(ts * sr)) * a; }
  }
  return out;
};
const hannC = {};
const fft = (re, im) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
};
/** magnitude spectrum in dB (0 dB ≈ a full-scale sine) */
const spectrum = (buf, sr = SR) => {
  const n = buf.length; const w = hannC[n] || (hannC[n] = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / (n - 1))));
  const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = buf[i] * w[i];
  fft(re, im); const out = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) out[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / (n / 4) + 1e-7);
  return { db: out, bin: sr / n, sr };
};
const rms = (buf) => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };
const bandDb = (S, f0, f1) => { const a = Math.max(1, Math.floor(f0 / S.bin)), b = Math.max(a, Math.min(S.db.length - 1, Math.ceil(f1 / S.bin))); let p = 0; for (let k = a; k <= b; k++) p += Math.pow(10, S.db[k] / 10); return 10 * Math.log10(p / (b - a + 1) + 1e-12); };
const bandPow = (S, f0, f1) => { const a = Math.max(1, Math.floor(f0 / S.bin)), b = Math.max(a, Math.min(S.db.length - 1, Math.ceil(f1 / S.bin))); let p = 0; for (let k = a; k <= b; k++) p += Math.pow(10, S.db[k] / 10); return p; };
const dbAt = (S, f) => { const k = clamp(f / S.bin, 1, S.db.length - 2), i = Math.floor(k), u = k - i; return lerp(S.db[i], S.db[i + 1], u); };
const centroid = (S) => { let a = 0, b = 0; for (let k = 1; k < S.db.length; k++) { const p = Math.pow(10, S.db[k] / 20); a += p * k * S.bin; b += p; } return a / (b || 1); };
const FMIN = 40, FMAX = 7600;
const logU = (f) => Math.log(clamp(f, FMIN, FMAX) / FMIN) / Math.log(FMAX / FMIN);
const logF = (u) => FMIN * Math.pow(FMAX / FMIN, clamp(u, 0, 1));

/** the demo "song": I–V–vi–IV in C, bass + pad + arpeggio lead + drum kit, all from t */
const PROG = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const PNAME = ['C', 'G', 'Am', 'F'];
const song = (t, o = {}) => {
  const bpm = o.bpm || 112, b = (t * bpm) / 60, bar = Math.floor(b / 4), ci = ((bar % 4) + 4) % 4, ch = PROG[ci];
  const V = [];
  if (o.bass !== false) V.push({ f: mtof(ch[0] - 24), a: 0.32, w: 2, h: 14, role: '贝斯' });
  if (o.pad !== false) ch.forEach((m) => V.push({ f: mtof(m), a: 0.1, w: 3, h: 9, role: '和弦垫' }));
  let lead = null;
  if (o.mel !== false) { const e = Math.floor(b * 2), arp = [0, 1, 2, 1, 2, 0, 2, 1]; const m = ch[arp[((e % 8) + 8) % 8]] + 12; const env = Math.exp(-((b * 2) % 1) * 2.2); lead = { f: mtof(m), a: 0.26 * env + 0.04, w: o.lw ?? 2, h: 16, m, role: '主旋律' }; V.push(lead); }
  const hits = [];
  if (o.drums !== false) {
    const e0 = Math.floor(b * 2 - (0.7 * bpm) / 30), e1 = Math.floor(b * 2);
    for (let e = e0; e <= e1; e++) { const te = ((e / 2) * 60) / bpm, q = ((e % 8) + 8) % 8; if (q === 0 || q === 4 || q === 5) hits.push({ k: 'kick', t0: te, e }); if (q === 2 || q === 6) hits.push({ k: 'snare', t0: te, e }); hits.push({ k: 'hat', t0: te, a: q % 2 ? 0.6 : 1, e }); }
  }
  return { voices: V, hits, b, bar, ci, chord: PNAME[ci], lead, bpm };
};

/* ───────────────────────── real sound (Web Audio) ───────────────────────── */
const mkAudio = () => {
  let ac = null, master = null, pool = [], nz = null, bufs = {}, mic = null, an = null;
  const ensure = () => { if (ac) return ac; const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); master = ac.createGain(); master.gain.value = 0.16; master.connect(ac.destination); return ac; };
  const api = {
    get on() { return !!ac && !mic; }, get mic() { return !!mic; }, get sr() { return ac ? ac.sampleRate : 48000; },
    toggle() { if (ac) { api.close(); return false; } ensure(); return !!ac; },
    voices(list) {
      if (!ac || mic) return;
      while (pool.length < list.length && pool.length < 8) { const o = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master); o.start(); pool.push({ o, g }); }
      const now = ac.currentTime;
      pool.forEach((p, i) => { const v = list[i]; if (v) { if (p.o.type !== WT[v.w | 0]) p.o.type = WT[v.w | 0]; p.o.frequency.setTargetAtTime(v.f, now, 0.008); p.g.gain.setTargetAtTime(v.a * 0.35, now, 0.015); } else p.g.gain.setTargetAtTime(0, now, 0.03); });
    },
    hit(k, a = 1) {
      if (!ac || mic) return;
      if (!bufs[k]) { const n = Math.round(ac.sampleRate * 0.6), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = drum(k, i / ac.sampleRate, i) * 0.9; bufs[k] = b; }
      const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = a; s.buffer = bufs[k]; s.connect(g).connect(master); s.start();
    },
    noise(cfg) {
      if (!ac || mic) return;
      if (!nz) { const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; s.loop = true; const f = ac.createBiquadFilter(), c = ac.createBiquadFilter(), g = ac.createGain(); s.connect(c).connect(f).connect(g).connect(master); s.start(); nz = { s, f, c, g }; }
      const now = ac.currentTime; nz.f.type = cfg.type; nz.f.frequency.setTargetAtTime(cfg.f, now, 0.02); nz.f.Q.setTargetAtTime(cfg.q, now, 0.02);
      nz.c.type = 'lowpass'; nz.c.frequency.value = cfg.col === 0 ? 20000 : cfg.col === 1 ? 2500 : 500; nz.g.gain.setTargetAtTime(cfg.g, now, 0.03);
    },
    async startMic() {
      if (!ensure()) throw new Error('no audio');
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic = { st, src: ac.createMediaStreamSource(st) }; an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; mic.src.connect(an);
      pool.forEach((p) => p.g.gain.setTargetAtTime(0, ac.currentTime, 0.02));
    },
    micBuf(n) { if (!an) return null; const a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); return a.subarray(an.fftSize - n); },
    close() { try { mic?.st.getTracks().forEach((t) => t.stop()); } catch (_) { /* ignore */ } mic = null; an = null; try { ac?.close(); } catch (_) { /* ignore */ } ac = null; pool = []; nz = null; bufs = {}; },
  };
  return api;
};
/** schedule drum hits whose onset crossed into (t0, t1] */
const playHits = (A, hits, t0, t1) => { if (!A.on || !(t1 > t0) || t1 - t0 > 0.25) return; for (const h of hits) if (h.t0 > t0 && h.t0 <= t1) A.hit(h.k, h.a ?? 1); };
let _mc = null;
const measure = (s, size) => { _mc ??= document.createElement('canvas').getContext('2d'); _mc.font = `600 ${size}px ui-sans-serif,system-ui,"PingFang SC","Microsoft YaHei",sans-serif`; return _mc.measureText(s).width; };
/** pill sized to its widest label (icon + gap + text + right padding) so text never spills past the border */
const spkRect = (W, H, label = '声音') => { const fs = fsz(W, H), h = fs * 1.9; const tw = Math.max(measure(`${label} 开`, fs * 0.9), measure(`${label} 关`, fs * 0.9)); const w = Math.ceil(h * 1.05 + tw + h * 0.5); return { x: W - w - fs * 0.5, y: fs * 0.5, w, h }; };
const inRect = (P, r) => P.x >= r.x && P.x <= r.x + r.w && P.y >= r.y && P.y <= r.y + r.h;
const drawSpk = (ctx, W, H, A, C, label) => {
  const r = spkRect(W, H, label ? label.replace(/ [开关]$/, '') : '声音'), fs = fsz(W, H), lit = A.on || A.mic;
  ctx.fillStyle = lit ? rgba(C.color, 0.9) : 'rgba(15,23,42,.85)'; rrect(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(255,255,255,.7)' : 'rgba(148,163,184,.45)'; ctx.lineWidth = 1; ctx.stroke();
  const cx = r.x + r.h * 0.55, cy = r.y + r.h / 2, s = r.h * 0.22;
  ctx.fillStyle = lit ? '#0b1020' : '#cbd5e1'; ctx.beginPath(); ctx.moveTo(cx - s, cy - s * 0.6); ctx.lineTo(cx - s * 0.3, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy - s * 1.3); ctx.lineTo(cx + s * 0.5, cy + s * 1.3); ctx.lineTo(cx - s * 0.3, cy + s * 0.6); ctx.lineTo(cx - s, cy + s * 0.6); ctx.closePath(); ctx.fill();
  text(ctx, label || (lit ? '声音 开' : '声音 关'), r.x + r.h * 1.05, cy + 0.5, { size: fs * 0.9, col: lit ? '#0b1020' : '#cbd5e1', bold: true });
};

const FAM = {};
const evalAt = (P, ts) => { let s = 0; for (const p of P) s += p[1] * Math.sin(p[0] * ts); return s; };
const levelRow = (v) => `${fmt(v, 1)} dB`;

/* ───────────────────────── synth ───────────────────────── */
const MEL = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2];
FAM.synth = {
  spec: { color: { label: '音色颜色', value: '#818cf8' }, speed: SPD('自动演奏速度'), size: { label: '音量', min: 0.1, max: 1, step: 0.05, value: 0.7 }, count: { label: '谐波上限', min: 1, max: 24, step: 1, value: 12, buttons: true }, extras: [R('wave', '波形（0正弦 1方 2锯齿 3三角）', 0, 3, 1, 2), R('lfo', '颤音速率 Hz', 0, 8, 0.1, 5), R('dep', '颤音深度（音分）', 0, 60, 1, 12), R('oct', '八度', 2, 6, 1, 4)], remountKeys: [] },
  presets: { 默认: {}, 纯正弦: { wave: 0 }, 方波: { wave: 1, count: 15 }, 三角柔音: { wave: 3 }, 强颤音: { lfo: 6.5, dep: 50 }, 低八度: { oct: 3, count: 20 } },
  doc: {
    title: '合成器 · 波形、谐波与频谱',
    rows: (v) => [['当前音符 / 基频 f₀', `${v.note} / ${hz(v.f0)}`, 'note'], ['波形 / 谐波上限', `${v.wn} / ${v.h} 个`], ['悬停区域', v.zone, 'zone'], ['悬停频率', v.fz, 'fz'], ['该处强度', v.lv, 'lv'], ['最近的谐波', v.kh, 'kh'], ['颤音 速率 / 深度', `${fmt(v.lfo, 1)} Hz / ${v.dep}¢`], ['音量', fmt(v.vol, 2)]],
    formula: () => F('音高：f₀ = 440 × 2^((n − 69) / 12)　（n = MIDI 音符号，A4 = 69）') + F('锯齿波 = Σ (1/k)·sin(2π·k·f₀·t)，方波只取奇数 k，三角波 1/k² 衰减') + F('颤音：f(t) = f₀ × 2^(深度·sin(2π·速率·t) / 1200)'),
    explain: '<p><b>合成器</b>用数学函数直接"造"出声音。最简单的是<b>正弦波</b>：只有一个频率，听起来像口哨。方波、锯齿波、三角波都可以拆成很多个正弦波相加——这些正弦叫<b>谐波</b>，频率正好是基频 f₀ 的 1、2、3… 倍。</p><p>上方是<b>波形</b>（声音随时间的样子），中间是<b>频谱</b>（每个频率有多响），用 FFT（快速傅里叶变换）从波形算出来。你会看到频谱上等间距的"尖峰"，就是一根根谐波；谐波越多、越强，声音越"亮"、越"刺"。</p><p>下方琴键可以点按演奏；不碰它时会自动弹一段旋律。点右上角「声音」可以真的听到它。</p>',
    params: [['音色颜色', '波形与频谱的颜色'], ['自动演奏速度', '自动旋律的快慢；0 = 停在当前音'], ['音量', '振幅大小，波形高度与频谱整体抬高'], ['谐波上限', '最多叠加多少根谐波（越多越接近理想方波/锯齿）'], ['波形', '0 正弦、1 方波、2 锯齿、3 三角'], ['颤音速率 Hz', '音高每秒抖动几次'], ['颤音深度（音分）', '抖动幅度，100 音分 = 半音'], ['八度', '整体音高往上/下移']],
    example: (v) => `<ol><li>当前音符 ${v.note}，MIDI 号 n = ${v.m}</li><li>f₀ = 440 × 2^((${v.m} − 69)/12) = ${fmt(v.f0, 1)} Hz</li><li>第 ${v.k} 根谐波频率 = ${v.k} × ${fmt(v.f0, 1)} = ${fmt(v.k * v.f0, 0)} Hz，理论强度 ${v.kth}</li></ol>`,
    tip: '点琴键弹奏；把指针放到频谱上看每根谐波的频率和强度。',
  },
  build(S, A) {
    const st = { hold: null, holdT: -1 };
    const L = (W, H) => { const fs = fsz(W, H), ml = fs * 2.8, mr = fs * 0.8, mt = fs * 3, gap = fs * 1.1; const kh = clamp(H * 0.22, 44, 110); const avail = H - mt - kh - gap * 2 - fs * 0.6; return { fs, ml, mr, mt, wy: mt, wh: avail * 0.42, sy: mt + avail * 0.42 + gap, sh: avail * 0.58, ky: H - kh - fs * 0.6, kh }; };
    const keys = (W, H, oct) => { const l = L(W, H), nw = 15, kw = (W - l.ml - l.mr) / nw, out = []; const wm = [0, 2, 4, 5, 7, 9, 11]; for (let i = 0; i < nw; i++) out.push({ m: (oct + 1) * 12 + Math.floor(i / 7) * 12 + wm[i % 7], x: l.ml + i * kw, y: l.ky, w: kw, h: l.kh, blk: false }); const bm = [1, 3, null, 6, 8, 10, null]; for (let i = 0; i < nw - 1; i++) { const b = bm[i % 7]; if (b == null) continue; out.push({ m: (oct + 1) * 12 + Math.floor(i / 7) * 12 + b, x: l.ml + (i + 0.68) * kw, y: l.ky, w: kw * 0.64, h: l.kh * 0.6, blk: true }); } return out; };
    const keyAt = (W, H, oct, P) => { const ks = keys(W, H, oct); for (let i = ks.length - 1; i >= 0; i--) { const k = ks[i]; if (P.x >= k.x && P.x <= k.x + k.w && P.y >= k.y && P.y <= k.y + k.h) return k; } return null; };
    S.onDown((P) => { if (P.ui) return; const C = S.get(); const k = keyAt(S.W, S.H, clamp(Math.round(num(C.oct, 4)), 2, 6), P); if (k) { st.hold = k.m; st.holdT = 1e9; } });
    S.onUp(() => { if (st.hold != null) st.holdT = S.t + 1.2; });
    let lastT = 0;
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.1);
      const l = L(W, H), fs = l.fs, oct = clamp(Math.round(num(C.oct, 4)), 2, 6), w = clamp(Math.round(num(C.wave, 2)), 0, 3), hmax = clamp(Math.round(num(C.count, 12)), 1, 24), vol = num(C.size, 0.7), lfo = num(C.lfo, 5), dep = num(C.dep, 12);
      if (st.hold != null && t > st.holdT) st.hold = null;
      const step = Math.floor(t * 2.5), m = st.hold ?? (oct + 1) * 12 + MEL[((step % 16) + 16) % 16];
      const env = st.hold != null ? 1 : 0.55 + 0.45 * Math.exp(-((t * 2.5) % 1) * 3);
      const f0 = mtof(m) * Math.pow(2, (dep * Math.sin(TAU * lfo * t)) / 1200);
      const v = { f: f0, a: vol * env * 0.8, w, h: hmax };
      const PT = partials(v);
      A.voices([v]); lastT = t;
      const h = hueOf(C.color);
      // waveform (3 periods ending at t)
      const span = 3 / f0, x0 = l.ml, ww = W - l.ml - l.mr;
      ctx.strokeStyle = 'rgba(148,163,184,.18)'; ctx.lineWidth = 1; ctx.strokeRect(x0, l.wy, ww, l.wh);
      ctx.beginPath(); ctx.moveTo(x0, l.wy + l.wh / 2); ctx.lineTo(x0 + ww, l.wy + l.wh / 2); ctx.stroke();
      ctx.strokeStyle = C.color; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 240; i++) { const u = i / 240, y = evalAt(PT, t - span + u * span); const yy = l.wy + l.wh / 2 - clamp(y, -1.4, 1.4) * (l.wh * 0.34); i ? ctx.lineTo(x0 + u * ww, yy) : ctx.moveTo(x0 + u * ww, yy); }
      ctx.stroke();
      text(ctx, `波形 · ${WN[w]} · 3 个周期 = ${fmt(span * 1000, 2)} ms`, x0, l.wy - fs * 0.8, { size: fs * 0.9, col: '#94a3b8' });
      // spectrum (linear 0..FS)
      const FSx = 4000, Sp = spectrum(render(NF, t, { voices: [v] }));
      const fx = (f) => x0 + (f / FSx) * ww, dy = (d) => l.sy + l.sh - clamp((d + 72) / 72, 0, 1) * l.sh;
      ctx.strokeStyle = 'rgba(148,163,184,.18)'; ctx.strokeRect(x0, l.sy, ww, l.sh);
      for (const g of [-60, -40, -20, 0]) { ctx.strokeStyle = 'rgba(148,163,184,.1)'; ctx.beginPath(); ctx.moveTo(x0, dy(g)); ctx.lineTo(x0 + ww, dy(g)); ctx.stroke(); text(ctx, `${g}`, x0 - 4, dy(g), { size: fs * 0.75, col: '#64748b', align: 'right' }); }
      const grd = ctx.createLinearGradient(0, l.sy, 0, l.sy + l.sh); grd.addColorStop(0, hsla(h, 85, 70, 0.9)); grd.addColorStop(1, hsla(h, 85, 40, 0.15));
      ctx.beginPath(); ctx.moveTo(x0, l.sy + l.sh); for (let k = 1; k * Sp.bin <= FSx; k++) ctx.lineTo(fx(k * Sp.bin), dy(Sp.db[k])); ctx.lineTo(x0 + ww, l.sy + l.sh); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = hsla(h, 90, 75); ctx.lineWidth = 1.4; ctx.beginPath(); for (let k = 1; k * Sp.bin <= FSx; k++) { const X = fx(k * Sp.bin), Y = dy(Sp.db[k]); k > 1 ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke();
      for (const p of PT) { const fk = p[0] / TAU; if (fk > FSx) break; if (p[2] <= 12 || p[2] % 2) text(ctx, String(p[2]), fx(fk), l.sy + fs * 0.6, { size: fs * 0.72, col: '#94a3b8', align: 'center' }); }
      for (const f of [0, 1000, 2000, 3000, 4000]) text(ctx, f ? `${f / 1000}k` : '0', fx(f), l.sy + l.sh + fs * 0.7, { size: fs * 0.75, col: '#64748b', align: 'center' });
      text(ctx, '频谱（FFT）· 横轴频率 Hz · 竖轴 dB · 小数字 = 第 k 根谐波', x0, l.sy - fs * 0.6, { size: fs * 0.9, col: '#94a3b8' });
      // keyboard
      const ks = keys(W, H, oct), hk = keyAt(W, H, oct, P);
      for (const k of ks) { const lit = Math.round(k.m) === Math.round(m); ctx.fillStyle = k.blk ? (lit ? hsla(h, 85, 55) : '#111827') : lit ? hsla(h, 85, 72) : k === hk ? '#e2e8f0' : '#cbd5e1'; rrect(ctx, k.x + 1, k.y, k.w - 2, k.h, 4); ctx.fill(); if (!k.blk && k.m % 12 === 0) text(ctx, nname(k.m), k.x + k.w / 2, k.y + k.h - fs * 0.7, { size: fs * 0.75, col: '#334155', align: 'center' }); }
      if (hk && hk.blk) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; rrect(ctx, hk.x + 1, hk.y, hk.w - 2, hk.h, 4); ctx.stroke(); }
      // hover
      let zone = '波形', fz = '—', lvv = '—', kh = '—', k = 1, ix = 'w';
      const inSp = P.y >= l.sy && P.y <= l.sy + l.sh && P.x >= x0 && P.x <= x0 + ww;
      if (inSp) { const f = ((P.x - x0) / ww) * FSx; k = Math.max(1, Math.round(f / f0)); zone = '频谱'; fz = `${hz(f)}（${noteOf(f)}）`; lvv = db(dbAt(Sp, f)); kh = `第 ${k} 根 = ${hz(k * f0)}`; vline(ctx, P.x, l.sy, l.sy + l.sh); tip(ctx, W, H, P.x, P.y, [hz(f), `强度 ${lvv}`, `≈ 第 ${k} 谐波`], C.color); ix = `s${Math.round(f / 10)}`; }
      else if (hk) { zone = `琴键 ${nname(hk.m)}`; fz = hz(mtof(hk.m)); lvv = '点按发声'; kh = `基频 ${hz(mtof(hk.m))}`; ix = `k${hk.m}`; tip(ctx, W, H, P.x, P.y, [`${nname(hk.m)}`, hz(mtof(hk.m))], C.color); }
      else if (P.y >= l.wy && P.y <= l.wy + l.wh) { const u = clamp((P.x - x0) / ww, 0, 1), y = evalAt(PT, t - span + u * span); zone = '波形'; fz = `t = ${fmt((u - 1) * span * 1000, 2)} ms`; lvv = `振幅 ${fmt(y, 3)}`; vline(ctx, P.x, l.wy, l.wy + l.wh); ix = `w${Math.round(u * 60)}`; }
      const amp = (wv, kk) => { const p = partials({ f: 1, a: 1, w: wv, h: kk }).find((q) => q[2] === kk); return p ? Math.abs(p[1]) : 0; };
      const ka = amp(w, Math.min(k, 24)); const kth = k > hmax ? '已被谐波上限截掉' : ka ? `${fmt(ka, 3)}（${fmt(20 * Math.log10(ka / (amp(w, 1) || 1)), 1)} dB）` : '0（该波形没有这根谐波）';
      return { note: noteOf(f0), m, f0, wn: WN[w], h: hmax, zone, fz, lv: lvv, kh, lfo, dep, vol, k, kth, ix };
    };
  },
};

/* ───────────────────────── mic ───────────────────────── */
const VOW = [['啊 a', 800, 1200], ['哦 o', 500, 900], ['衣 i', 300, 2300], ['乌 u', 320, 800], ['鹅 e', 500, 1500]];
FAM.mic = {
  label: '麦克风',
  spec: { color: { label: '频谱颜色', value: '#22d3ee' }, speed: SPD('元音切换速度'), size: { label: '环半径', min: 0.5, max: 1.25, step: 0.05, value: 1 }, count: { label: '频带数', min: 16, max: 128, step: 8, value: 64 }, extras: [R('gain', '灵敏度', 0.5, 3, 0.1, 1.2), R('smooth', '平滑 τ', 0, 0.95, 0.05, 0.6), T('mir', '左右镜像', true), T('wave', '中心波形', true)], remountKeys: [] },
  presets: { 默认: {}, 高灵敏: { gain: 2.6 }, 细腻: { count: 128, smooth: 0.3 }, 粗犷: { count: 24, size: 1.2 }, 不镜像: { mir: false }, 无波形: { wave: false } },
  doc: {
    title: '麦克风环形频谱 · 元音的"共振峰"',
    rows: (v) => [['信号来源', v.src, 'src'], ['基频 f₀ / 音符', `${hz(v.f0)} / ${noteOf(v.f0)}`], ['元音 · 共振峰 F1 / F2', v.vw], ['悬停频带', v.band, 'band'], ['频率范围', v.rng, 'rng'], ['该频带电平', v.lv, 'lv'], ['总音量 RMS', fmt(v.rms, 3)], ['灵敏度 / 平滑 τ', `${fmt(v.gain, 1)} / ${fmt(v.sm, 2)}`]],
    formula: () => F('频带 i 的范围：f = 60 × (5000/60)^(i/N) … 60 × (5000/60)^((i+1)/N)') + F('电平 L = 10·log₁₀(该频带内功率的平均)') + F('平滑：显示值 ← τ·旧值 + (1−τ)·新值'),
    explain: '<p>人说话时，声带振动产生<b>基频 f₀</b>（决定音高）和一串谐波；口腔、舌头的形状像一个"滤波器"，会让某几个频率特别响，这些"鼓包"叫<b>共振峰</b> F1、F2。不同元音（a、i、u…）的 F1/F2 不同，所以我们能听出是哪个音。</p><p>这里把 64 个频带绕成一圈：<b>角度 = 频率</b>（从低到高，按对数分布，和人耳感觉一致），<b>向外的长度 = 响度</b>。默认播放一段模拟人声，在 a/o/i/u/e 之间循环；点右上角「麦克风」授权后，就换成你自己的声音。</p>',
    params: [['频谱颜色', '圆环的主色'], ['元音切换速度', '演示人声换元音的快慢'], ['环半径', '圆环大小'], ['频带数', '圆环被分成多少段'], ['灵敏度', '把电平放大多少倍再画'], ['平滑 τ', '越大越平稳，越小越跳动'], ['左右镜像', '左右对称画两遍，更像"花瓣"'], ['中心波形', '圆心画出原始波形']],
    example: (v) => `<ol><li>悬停的是 ${v.band}，覆盖 ${v.rng}</li><li>把这段频率里每个 FFT 点的功率取平均，再取 10·log₁₀ → ${v.lv}</li><li>长度 = (电平 + 80) / 80 × 灵敏度 ${fmt(v.gain, 1)}</li></ol>`,
    tip: '点右上角「麦克风」用真实声音；指针绕圆环转一圈看每个频带。',
  },
  build(S, A) {
    const st = { lv: [], err: '' };
    S.onDown(async (P) => { if (!P.uiHit) return; P.ui = true; if (A.mic) { A.close(); return; } try { await A.startMic(); st.err = ''; } catch (e) { st.err = '未授权 / 不支持'; } });
    return ({ ctx, W, H, t, dtw, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.12);
      const fs = fsz(W, H), N = clamp(Math.round(num(C.count, 64)), 8, 160), gain = num(C.gain, 1.2), sm = num(C.smooth, 0.6), mir = on(C.mir);
      const vi = t * 0.5, a = Math.floor(vi), u = clamp(((vi - a) - 0.7) / 0.3, 0, 1), V0 = VOW[((a % 5) + 5) % 5], V1 = VOW[(((a + 1) % 5) + 5) % 5];
      const F1 = lerp(V0[1], V1[1], u), F2 = lerp(V0[2], V1[2], u), f0 = 130 + 25 * Math.sin(t * 0.9);
      let buf, sr = SR, src = '演示人声（模拟）';
      if (A.mic) { buf = A.micBuf(NF); sr = A.sr; src = '🎤 你的麦克风'; }
      if (!buf) { const vs = []; for (let k = 1; k * f0 < 6000; k++) { const f = k * f0, e = 1 / (1 + ((f - F1) / 110) ** 2) + 0.7 / (1 + ((f - F2) / 150) ** 2) + 0.02; vs.push({ f, a: (0.45 * e) / Math.pow(k, 0.3), w: 0, h: 1 }); } buf = render(NF, t, { voices: vs }); }
      const Sp = spectrum(buf, sr);
      const cx = W / 2, cy = H / 2 + fs * 0.6, R0 = Math.min(W, H) * 0.2 * num(C.size, 1), Rmax = Math.min(W, H) * 0.47 - fs;
      const fr = (i) => 60 * Math.pow(5000 / 60, i / N);
      const k = 1 - Math.pow(1 - (1 - sm), Math.max(1, dtw * 60));
      for (let i = 0; i < N; i++) { const L = bandDb(Sp, fr(i), fr(i + 1)); st.lv[i] = st.lv[i] == null || dtw === 0 ? (st.lv[i] ?? L) : lerp(st.lv[i], L, k); }
      const h = hueOf(C.color), seg = mir ? Math.PI / N : TAU / N;
      const len = (i) => clamp(((st.lv[i] + 80) / 80) * gain, 0, 1.6) * (Rmax - R0) * 0.7;
      const ang = (i, side) => (mir ? -Math.PI / 2 + side * (i + 0.5) * seg : -Math.PI / 2 + (i + 0.5) * seg);
      for (const side of mir ? [1, -1] : [1]) for (let i = 0; i < N; i++) { const an = ang(i, side), L = len(i), c = Math.cos(an), s = Math.sin(an); ctx.strokeStyle = hsla(h + (i / N) * 70, 85, 58 + 18 * clamp(L / (Rmax - R0), 0, 1)); ctx.lineWidth = Math.max(1.5, R0 * seg * 0.75); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + c * R0, cy + s * R0); ctx.lineTo(cx + c * (R0 + L + 2), cy + s * (R0 + L + 2)); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(148,163,184,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R0 - 3, 0, TAU); ctx.stroke();
      if (on(C.wave)) { ctx.strokeStyle = 'rgba(226,232,240,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); const n = 200; for (let i = 0; i <= n; i++) { const x = cx - R0 * 0.8 + (i / n) * R0 * 1.6, y = cy + clamp(buf[Math.floor((i / n) * (buf.length - 1))], -1, 1) * R0 * 0.45; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      text(ctx, A.mic ? '🎤 实时' : `元音 ${lerp(0, 1, u) > 0.5 ? V1[0] : V0[0]}`, cx, cy - R0 * 0.55, { size: fs, col: '#e2e8f0', align: 'center', bold: true });
      if (st.err) text(ctx, `麦克风：${st.err}`, fs, H - fs, { size: fs * 0.9, col: '#fca5a5' });
      // hover → band
      const dx = P.x - cx, dy = P.y - cy; let an = Math.atan2(dy, dx) + Math.PI / 2; an = ((an % TAU) + TAU) % TAU;
      let bi = mir ? Math.floor((an > Math.PI ? TAU - an : an) / seg) : Math.floor(an / seg); bi = clamp(bi, 0, N - 1);
      const near = Math.hypot(dx, dy) > R0 * 0.6;
      if (near) { const side = mir && an > Math.PI ? -1 : 1, a2 = ang(bi, side), L = len(bi); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * R0, cy + Math.sin(a2) * R0); ctx.lineTo(cx + Math.cos(a2) * (R0 + L + 4), cy + Math.sin(a2) * (R0 + L + 4)); ctx.stroke(); tip(ctx, W, H, P.x, P.y, [`第 ${bi + 1} 段 · ${hz(fr(bi))}–${hz(fr(bi + 1))}`, `电平 ${db(st.lv[bi])}`], C.color); }
      const hx = cx + Math.cos(ang(bi, 1)) * (R0 + len(bi)), hy = cy + Math.sin(ang(bi, 1)) * (R0 + len(bi));
      return { src, f0, vw: A.mic ? '（实时输入）' : `${(u > 0.5 ? V1 : V0)[0]} · ${fmt(F1, 0)} / ${fmt(F2, 0)} Hz`, band: near ? `第 ${bi + 1} / ${N} 段` : '（移到圆环上）', rng: `${hz(fr(bi))} – ${hz(fr(bi + 1))}`, lv: db(st.lv[bi]), rms: rms(buf), gain, sm, hx, hy, ix: near ? `b${bi}` : '-' };
    };
  },
};

/* ───────────────────────── bars ───────────────────────── */
FAM.bars = {
  spec: { color: { label: '柱子颜色', value: '#34d399' }, speed: SPD('音乐播放速度'), size: { label: '柱宽占比', min: 0.2, max: 1, step: 0.05, value: 0.72 }, count: { label: '频带数', min: 8, max: 96, step: 4, value: 32 }, extras: [R('fall', '峰值下落 dB/s', 5, 80, 1, 24), R('smooth', '平滑 τ', 0, 0.95, 0.05, 0.5), T('log', '对数频率轴', true), T('dbs', '分贝刻度', true)], remountKeys: [] },
  presets: { 默认: {}, 细柱: { count: 80, size: 0.6 }, 粗柱: { count: 12, size: 0.9 }, 线性轴: { log: false }, 线性幅度: { dbs: false }, 慢峰值: { fall: 6, smooth: 0.85 } },
  doc: {
    title: '柱状频谱 · 每一段频率有多响',
    rows: (v) => [['正在播放', `${v.chord} 和弦 · 第 ${v.beat} 拍`], ['频带数 / 频率轴', `${v.n} / ${v.ax}`], ['悬停频带', v.band, 'band'], ['频率范围', v.rng, 'rng'], ['当前电平', v.lv, 'lv'], ['峰值（缓慢下落）', v.pk], ['平滑 τ / 峰值下落', `${fmt(v.sm, 2)} / ${v.fall} dB/s`]],
    formula: () => F('对数分段：fᵢ = 40 × (7600/40)^(i/N)') + F('频带电平 L = 10·log₁₀( 平均 |X(k)|² )　（X = FFT 结果）') + F('峰值：peak ← max(peak − 下落速度·Δt, L)'),
    explain: '<p>播放器里跳动的"音乐柱"就是它。先把最近 64 毫秒的声音做一次 <b>FFT</b>，得到 512 个频率点的强度；再把它们分组成 N 段，每段画一根柱子，柱子越高这段频率越响。</p><p><b>对数频率轴</b>：人耳觉得 100→200 Hz 和 1000→2000 Hz 的"跨度"一样大，所以按倍数分段更自然；关掉后低音会挤在最左边。<b>分贝刻度</b>同理：响度按 log 压缩，小声也看得见。柱顶的小横条是<b>峰值</b>，会慢慢落下，方便看最近最响到过哪里。</p>',
    params: [['柱子颜色', '柱子的主色（越高越亮）'], ['音乐播放速度', '演示音乐的快慢；0 = 定格'], ['柱宽占比', '柱子占每格宽度的比例'], ['频带数', '分成多少根柱子'], ['峰值下落 dB/s', '峰值小横条每秒下降多少分贝'], ['平滑 τ', '越大柱子越"稳"'], ['对数频率轴', '按倍数分段（更像人耳）'], ['分贝刻度', '高度用 dB 而不是线性幅度']],
    example: (v) => `<ol><li>悬停 ${v.band}，范围 ${v.rng}</li><li>该段 FFT 点的平均功率取 10·log₁₀ → ${v.lv}</li><li>柱高 = ${fmt(v.hk, 2)} × 最大高度（分贝刻度下 = (电平 + 70) / 70）</li></ol>`,
    tip: '指针扫过柱子看每段频率；试试关掉"对数频率轴"对比低音位置。',
  },
  build(S, A) {
    const st = { lv: [], pk: [], lt: 0 };
    return ({ ctx, W, H, t, dt, dtw, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.08);
      const fs = fsz(W, H), N = clamp(Math.round(num(C.count, 32)), 4, 128), bw = num(C.size, 0.72), sm = num(C.smooth, 0.5), fall = num(C.fall, 24), lg = on(C.log), dbs = on(C.dbs);
      const M = song(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const Sp = spectrum(render(NF, t, M));
      const fr = (i) => (lg ? logF(i / N) : FMIN + ((FMAX - FMIN) * i) / N);
      const ml = fs * 2.6, mr = fs * 0.8, mt = fs * 3, mb = fs * 2.2, w = W - ml - mr, h = H - mt - mb, cw = w / N;
      const hk = (L) => (dbs ? clamp((L + 70) / 70, 0, 1) : clamp(Math.pow(10, L / 20) * 3, 0, 1));
      const k = dtw > 0 ? 1 - Math.pow(sm, dtw * 60) : 0;
      for (let i = 0; i < N; i++) { const L = bandDb(Sp, fr(i), fr(i + 1)); st.lv[i] = st.lv[i] == null ? L : lerp(st.lv[i], L, sm === 0 ? 1 : k); st.pk[i] = Math.max((st.pk[i] ?? -90) - fall * dt, st.lv[i]); }
      for (const g of dbs ? [-60, -40, -20, 0] : [0.25, 0.5, 0.75, 1]) { const y = mt + h - (dbs ? hk(g) : g) * h; ctx.strokeStyle = 'rgba(148,163,184,.1)'; ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + w, y); ctx.stroke(); text(ctx, dbs ? `${g}` : fmt(g / 3, 2), ml - 4, y, { size: fs * 0.75, col: '#64748b', align: 'right' }); }
      const hue = hueOf(C.color); const hi = P.x >= ml && P.x <= ml + w && P.y >= mt - fs && P.y <= mt + h + mb ? clamp(Math.floor((P.x - ml) / cw), 0, N - 1) : -1;
      for (let i = 0; i < N; i++) {
        const q = hk(st.lv[i]), bh = Math.max(2, q * h), x = ml + i * cw + (cw * (1 - bw)) / 2, y = mt + h - bh;
        const g = ctx.createLinearGradient(0, mt + h, 0, y); g.addColorStop(0, hsla(hue, 80, 30, 0.9)); g.addColorStop(1, hsla(hue + 25 * q, 90, 50 + 25 * q)); ctx.fillStyle = i === hi ? '#f8fafc' : g;
        rrect(ctx, x, y, cw * bw, bh, Math.min(3, cw * bw * 0.3)); ctx.fill();
        const py = mt + h - hk(st.pk[i]) * h; ctx.fillStyle = hsla(hue, 90, 82); ctx.fillRect(x, py - 2, cw * bw, 2);
      }
      for (const f of [100, 300, 1000, 3000]) { const u = lg ? logU(f) : (f - FMIN) / (FMAX - FMIN); text(ctx, f >= 1000 ? `${f / 1000}k` : String(f), ml + u * w, mt + h + fs * 0.9, { size: fs * 0.75, col: '#64748b', align: 'center' }); }
      text(ctx, `频率（Hz，${lg ? '对数轴' : '线性轴'}）`, ml + w, mt + h + fs * 1.9, { size: fs * 0.8, col: '#64748b', align: 'right' });
      text(ctx, `${M.chord} 和弦 · ${M.bpm} BPM`, ml, mt - fs * 1.4, { size: fs * 0.95, col: '#94a3b8', bold: true });
      const bi = hi >= 0 ? hi : 0;
      if (hi >= 0) tip(ctx, W, H, P.x, P.y, [`第 ${hi + 1} 段 · ${hz(fr(hi))}–${hz(fr(hi + 1))}`, `电平 ${db(st.lv[hi])} · 峰值 ${db(st.pk[hi])}`], C.color);
      return { chord: M.chord, beat: (Math.floor(M.b) % 4) + 1, n: N, ax: lg ? '对数' : '线性', band: hi >= 0 ? `第 ${hi + 1} / ${N} 段` : '（移到柱子上）', rng: `${hz(fr(bi))} – ${hz(fr(bi + 1))}`, lv: db(st.lv[bi]), pk: db(st.pk[bi]), sm, fall, hk: hk(st.lv[bi]), hx: ml + (bi + 0.5) * cw, hy: mt + h - hk(st.lv[bi]) * h, ix: hi >= 0 ? `b${hi}` : '-' };
    };
  },
};

/* ───────────────────────── circle-wave ───────────────────────── */
FAM['circle-wave'] = {
  spec: { color: { label: '波形颜色', value: '#a78bfa' }, speed: SPD('音乐播放速度'), size: { label: '振幅放大', min: 0.2, max: 2.5, step: 0.05, value: 1 }, count: { label: '历史环数', min: 1, max: 6, step: 1, value: 3, buttons: true }, extras: [R('rad', '基准半径', 0.15, 0.42, 0.01, 0.28), R('win', '一圈的时长 ms', 4, 64, 1, 24), R('lw', '线宽', 0.5, 5, 0.1, 2), T('fill', '填充', true)], remountKeys: [] },
  presets: { 默认: {}, 细线: { lw: 0.8, fill: false }, 粗线: { lw: 4.5 }, 多环: { count: 6 }, 单环: { count: 1 }, 长窗口: { win: 60, size: 1.6 } },
  doc: {
    title: '圆形波 · 把波形绕成一圈',
    rows: (v) => [['正在播放', `${v.chord} 和弦 · ${v.bpm} BPM`], ['一圈 = 时长', `${v.win} ms = ${v.ns} 个采样`], ['悬停角度', `${fmt(v.deg, 0)}°`, 'deg'], ['对应时刻', `${fmt(v.tm, 2)} ms 前`, 'tm'], ['该处采样值 x', fmt(v.x, 3), 'x'], ['半径 r = R + A·x', `${fmt(v.r, 1)} px`], ['RMS 音量', fmt(v.rms, 3)]],
    formula: () => F('角度 θ = 2π × (采样序号 / 一圈的采样数)') + F('半径 r(θ) = R₀ + A · x(θ)　（x 是 −1…1 的采样值）') + F('点坐标 (cx + r·cos θ, cy + r·sin θ)'),
    explain: '<p>普通示波器把声音画成<b>从左到右</b>的曲线：横轴是时间，纵轴是振幅。这里把横轴"卷"成一个圆：<b>转一圈 = 一小段时间</b>（默认 24 毫秒），半径在基准圆上下起伏表示振幅。</p><p>采样值 x 为正，曲线就鼓出去；为负就凹进来。声音越响，圆越"毛"；低音（频率低）一圈里起伏次数少，高音起伏密。外面的淡色环是之前几个时刻的形状，形成拖影。</p>',
    params: [['波形颜色', '曲线主色'], ['音乐播放速度', '演示音乐的快慢'], ['振幅放大', 'A，起伏放大倍数'], ['历史环数', '保留几圈之前的形状'], ['基准半径', 'R₀ 相对画布大小'], ['一圈的时长 ms', '多长的声音绕成一圈'], ['线宽', '曲线粗细'], ['填充', '曲线内部是否填色']],
    example: (v) => `<ol><li>指针角度 θ = ${fmt(v.deg, 0)}°，占一圈的 ${fmt(v.deg / 3.6, 1)}%</li><li>对应 ${fmt(v.tm, 2)} ms 前的采样，x = ${fmt(v.x, 3)}</li><li>r = ${fmt(v.R0, 1)} + ${fmt(v.A, 1)} × ${fmt(v.x, 3)} = ${fmt(v.r, 1)} px</li></ol>`,
    tip: '指针绕圆心转，看每个角度对应的时刻和振幅。',
  },
  build(S, A) {
    const st = { lt: 0 };
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.12);
      const fs = fsz(W, H), win = clamp(num(C.win, 24), 2, 80) / 1000, ns = Math.round(win * SR), rings = clamp(Math.round(num(C.count, 3)), 1, 8), Amp = num(C.size, 1), lw = num(C.lw, 2);
      const M = song(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const cx = W / 2, cy = H / 2 + fs * 0.4, R0 = Math.min(W, H) * num(C.rad, 0.28), Ap = Math.min(W, H) * 0.16 * Amp;
      const hue = hueOf(C.color);
      let cur = null;
      for (let r = rings - 1; r >= 0; r--) {
        const buf = render(ns, t - r * 0.09, M), a = r ? 0.55 * (1 - r / (rings + 0.5)) : 1;
        ctx.beginPath(); for (let i = 0; i <= ns; i++) { const x = buf[i % ns], th = -Math.PI / 2 + (i / ns) * TAU, rr = R0 * (1 + r * 0.12) + Ap * clamp(x, -1.5, 1.5); const X = cx + Math.cos(th) * rr, Y = cy + Math.sin(th) * rr; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath();
        if (on(C.fill) && !r) { ctx.fillStyle = hsla(hue, 80, 55, 0.18); ctx.fill(); }
        ctx.strokeStyle = hsla(hue + r * 25, 85, r ? 60 : 70, a); ctx.lineWidth = r ? Math.max(0.6, lw * 0.6) : lw; ctx.stroke();
        if (!r) cur = buf;
      }
      ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, '0 ms', cx, cy - R0 - Ap * 1.1 - fs * 0.5, { size: fs * 0.75, col: '#64748b', align: 'center' });
      text(ctx, `${M.chord}`, cx, cy, { size: fs * 1.6, col: hsla(hue, 60, 80, 0.8), align: 'center', bold: true });
      let th = Math.atan2(P.y - cy, P.x - cx) + Math.PI / 2; th = ((th % TAU) + TAU) % TAU;
      const i = clamp(Math.floor((th / TAU) * ns), 0, ns - 1), x = cur[i], rr = R0 + Ap * clamp(x, -1.5, 1.5), a2 = th - Math.PI / 2;
      const hx = cx + Math.cos(a2) * rr, hy = cy + Math.sin(a2) * rr;
      vline(ctx, cx, cy, cy); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.fill();
      const tm = (1 - i / ns) * win * 1000;
      tip(ctx, W, H, P.x, P.y, [`θ ${fmt((th * 180) / Math.PI, 0)}° · ${fmt(tm, 2)} ms 前`, `x = ${fmt(x, 3)}`], C.color);
      return { chord: M.chord, bpm: M.bpm, win: Math.round(win * 1000), ns, deg: (th * 180) / Math.PI, tm, x, r: rr, R0, A: Ap, rms: rms(cur), hx, hy, ix: `a${i}` };
    };
  },
};

/* ───────────────────────── eq ───────────────────────── */
/** RBJ peaking-EQ biquad magnitude in dB */
const peakDb = (f, f0, g, Q, sr = 44100) => {
  const A0 = Math.pow(10, g / 40), w0 = (TAU * f0) / sr, al = Math.sin(w0) / (2 * Q), cw = Math.cos(w0);
  const b0 = 1 + al * A0, b1 = -2 * cw, b2 = 1 - al * A0, a0 = 1 + al / A0, a1 = -2 * cw, a2 = 1 - al / A0;
  const w = (TAU * f) / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
};
FAM.eq = {
  cursor: 'grab',
  spec: { color: { label: '曲线颜色', value: '#fbbf24' }, speed: SPD('音乐播放速度'), size: { label: '最大增益 dB', min: 6, max: 24, step: 1, value: 12 }, count: { label: '频段数', min: 3, max: 8, step: 1, value: 5, buttons: true }, extras: [R('q', 'Q 值（越大越窄）', 0.3, 6, 0.1, 1.2), R('amt', '自动摆动幅度', 0, 1, 0.05, 0.6), T('spec', '显示频谱', true), T('pre', '显示原始频谱', true)], remountKeys: [] },
  presets: { 默认: {}, 少段: { count: 3 }, 多段: { count: 8, q: 2.4 }, 窄带: { q: 5 }, 宽带: { q: 0.5, size: 18 }, 静止: { amt: 0 } },
  doc: {
    title: '均衡器 EQ · 拖动频段改变音色',
    rows: (v) => [['频段数 / Q', `${v.n} / ${fmt(v.q, 1)}`], ['选中频段', v.band, 'band'], ['中心频率 f₀', hz(v.f0), 'f0'], ['增益 G', `${v.g >= 0 ? '+' : ''}${fmt(v.g, 1)} dB`, 'g'], ['指针处频率', hz(v.fp), 'fp'], ['指针处总响应', `${v.rp >= 0 ? '+' : ''}${fmt(v.rp, 1)} dB`, 'rp'], ['处理前 → 处理后', `${db(v.l0)} → ${db(v.l1)}`]],
    formula: () => F('每个频段是一个"峰值滤波器"：A = 10^(G/40)，ω₀ = 2π f₀ / fs，α = sin ω₀ / (2Q)') + F('总响应（dB）= Σ 各频段响应（dB 直接相加）') + F('处理后频谱 = 原始频谱 + 总响应'),
    explain: '<p><b>均衡器</b>（EQ）就是"分频段的音量旋钮"：把低音、中音、高音分别调大或调小。每个圆点是一个频段，<b>左右拖 = 改中心频率，上下拖 = 改增益</b>（往上提升、往下衰减）。</p><p>黄色曲线是所有频段叠加后的<b>频率响应</b>：曲线在 0 dB 以上的频率会被放大。底下暗色是原始频谱，亮色是处理后的频谱，你能看到被"抬起"或"压下"的区域。Q 值决定每个鼓包有多宽：Q 大 = 窄而尖，只影响一小段频率。</p>',
    params: [['曲线颜色', '响应曲线与圆点颜色'], ['音乐播放速度', '演示音乐的快慢'], ['最大增益 dB', '纵轴范围，也是拖动的上下限'], ['频段数', '有几个可拖的圆点'], ['Q 值', '每个鼓包的宽窄'], ['自动摆动幅度', '无人操作时圆点自动上下摆动'], ['显示频谱', '画处理后的频谱'], ['显示原始频谱', '同时画处理前的频谱对比']],
    example: (v) => `<ol><li>${v.band}：f₀ = ${hz(v.f0)}，G = ${fmt(v.g, 1)} dB，Q = ${fmt(v.q, 1)}</li><li>在 ${hz(v.fp)} 处各频段响应相加 = ${fmt(v.rp, 1)} dB</li><li>原始 ${db(v.l0)} + ${fmt(v.rp, 1)} = 处理后 ${db(v.l1)}</li></ol>`,
    tip: '抓住圆点拖动：左右改频率，上下改增益。',
  },
  build(S, A) {
    const st = { b: [], drag: -1, lt: 0, n: 0 };
    const L = (W, H) => { const fs = fsz(W, H); return { fs, ml: fs * 2.8, mr: fs * 0.8, mt: fs * 3, mb: fs * 2 }; };
    const geo = (W, H, G) => { const l = L(W, H), w = W - l.ml - l.mr, h = H - l.mt - l.mb; return { ...l, w, h, X: (f) => l.ml + logU(f) * w, Y: (d) => l.mt + h / 2 - (d / G) * (h / 2), fX: (x) => logF((x - l.ml) / w), dY: (y) => ((l.mt + h / 2 - y) / (h / 2)) * G }; };
    const pos = (b, G, t, amt) => ({ f: b.f, g: clamp(b.g + (b.man ? 0 : amt * G * 0.45 * Math.sin(t * 0.8 + b.ph)), -G, G) });
    S.onDown((P) => { if (P.ui) return; const C = S.get(), G = num(C.size, 12), g = geo(S.W, S.H, G); let best = -1, bd = 1e9; st.b.forEach((b, i) => { const p = pos(b, G, S.t, num(C.amt, 0.6)); const d = Math.hypot(g.X(p.f) - P.x, g.Y(p.g) - P.y); if (d < bd) { bd = d; best = i; } }); if (best >= 0 && bd < 40) { const b = st.b[best], p = pos(b, G, S.t, num(C.amt, 0.6)); b.g = p.g; b.man = true; st.drag = best; } });
    S.onMove((P) => { if (st.drag < 0 || !P.down) return; const C = S.get(), G = num(C.size, 12), g = geo(S.W, S.H, G), b = st.b[st.drag]; b.f = clamp(g.fX(P.x), 40, 7000); b.g = clamp(g.dY(P.y), -G, G); });
    S.onUp(() => { st.drag = -1; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.08);
      const N = clamp(Math.round(num(C.count, 5)), 2, 10), G = num(C.size, 12), Q = num(C.q, 1.2), amt = num(C.amt, 0.6);
      if (st.n !== N) { st.n = N; st.b = Array.from({ length: N }, (_, i) => ({ f: logF((i + 0.5) / N), g: [4, -3, 2, -4, 5, -2, 3, -5][i % 8] * (G / 12), ph: i * 1.7, man: false })); }
      const g = geo(W, H, G), fs = g.fs, hue = hueOf(C.color);
      const M = song(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const Sp = spectrum(render(NF, t, M));
      const B = st.b.map((b) => pos(b, G, t, amt));
      const resp = (f) => B.reduce((a, b) => a + peakDb(f, b.f, b.g, Q), 0);
      for (const d of [-G, -G / 2, 0, G / 2, G]) { ctx.strokeStyle = d ? 'rgba(148,163,184,.1)' : 'rgba(148,163,184,.35)'; ctx.beginPath(); ctx.moveTo(g.ml, g.Y(d)); ctx.lineTo(g.ml + g.w, g.Y(d)); ctx.stroke(); text(ctx, `${d > 0 ? '+' : ''}${fmt(d, 0)}`, g.ml - 4, g.Y(d), { size: fs * 0.75, col: '#64748b', align: 'right' }); }
      for (const f of [100, 300, 1000, 3000]) { vline(ctx, g.X(f), g.mt, g.mt + g.h, 'rgba(148,163,184,.12)'); text(ctx, f >= 1000 ? `${f / 1000}k` : String(f), g.X(f), g.mt + g.h + fs * 0.8, { size: fs * 0.75, col: '#64748b', align: 'center' }); }
      const sY = (d) => g.mt + g.h - clamp((d + 80) / 80, 0, 1) * g.h;
      const NS = 160;
      if (on(C.pre)) { ctx.beginPath(); ctx.moveTo(g.ml, g.mt + g.h); for (let i = 0; i <= NS; i++) { const f = logF(i / NS); ctx.lineTo(g.ml + (i / NS) * g.w, sY(dbAt(Sp, f))); } ctx.lineTo(g.ml + g.w, g.mt + g.h); ctx.closePath(); ctx.fillStyle = 'rgba(100,116,139,.25)'; ctx.fill(); }
      if (on(C.spec)) { ctx.beginPath(); ctx.moveTo(g.ml, g.mt + g.h); for (let i = 0; i <= NS; i++) { const f = logF(i / NS); ctx.lineTo(g.ml + (i / NS) * g.w, sY(dbAt(Sp, f) + resp(f))); } ctx.lineTo(g.ml + g.w, g.mt + g.h); ctx.closePath(); ctx.fillStyle = hsla(hue, 85, 55, 0.28); ctx.fill(); }
      ctx.beginPath(); for (let i = 0; i <= NS; i++) { const f = logF(i / NS), y = g.Y(clamp(resp(f), -G * 1.2, G * 1.2)); i ? ctx.lineTo(g.ml + (i / NS) * g.w, y) : ctx.moveTo(g.ml, y); } ctx.strokeStyle = C.color; ctx.lineWidth = 2.5; ctx.stroke();
      const fp = clamp(g.fX(P.x), FMIN, FMAX);
      let hb = st.drag; if (hb < 0) { let bd = 1e9; B.forEach((b, i) => { const d = Math.hypot(g.X(b.f) - P.x, g.Y(b.g) - P.y); if (d < bd) { bd = d; hb = i; } }); }
      B.forEach((b, i) => { ctx.fillStyle = i === hb ? '#fff' : hsla(hue + i * 30, 85, 62); ctx.beginPath(); ctx.arc(g.X(b.f), g.Y(b.g), i === hb ? 8 : 6, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(6,10,20,.8)'; ctx.lineWidth = 1.5; ctx.stroke(); text(ctx, String(i + 1), g.X(b.f), g.Y(b.g) - fs * 1.1, { size: fs * 0.8, col: '#cbd5e1', align: 'center' }); });
      vline(ctx, P.x, g.mt, g.mt + g.h);
      const b = B[hb], rp = resp(fp), l0 = dbAt(Sp, fp);
      tip(ctx, W, H, P.x, P.y, [`${hz(fp)} · 响应 ${rp >= 0 ? '+' : ''}${fmt(rp, 1)} dB`, `频段 ${hb + 1}：${hz(b.f)} ${b.g >= 0 ? '+' : ''}${fmt(b.g, 1)} dB`], C.color);
      text(ctx, '频率响应（所有频段叠加）', g.ml, g.mt - fs * 1.3, { size: fs * 0.9, col: '#94a3b8' });
      return { n: N, q: Q, band: `第 ${hb + 1} 段${st.drag >= 0 ? '（拖动中）' : ''}`, f0: b.f, g: b.g, fp, rp, l0, l1: l0 + rp, hx: g.X(b.f), hy: g.Y(b.g), ix: `${hb}:${Math.round(b.f)}:${Math.round(b.g * 10)}` };
    };
  },
};

/* ───────────────────────── part-audio ───────────────────────── */
FAM['part-audio'] = {
  cursor: 'grab',
  spec: { color: { label: '粒子颜色', value: '#38bdf8' }, speed: SPD('音乐播放速度'), size: { label: '粒子大小', min: 0.4, max: 3, step: 0.1, value: 1 }, count: { label: '最多粒子数', min: 100, max: 2000, step: 50, value: 700 }, extras: [R('gain', '灵敏度', 0.3, 3, 0.1, 1), R('grav', '重力', 0, 2, 0.05, 0.4), T('trail', '拖尾', true), T('hue', '按音色变色', true)], remountKeys: [] },
  presets: { 默认: {}, 少: { count: 200 }, 多: { count: 1800, size: 0.7 }, 大点: { size: 2.6 }, 爆发: { gain: 2.6, grav: 0.1 }, 平稳: { gain: 0.5, trail: false } },
  doc: {
    title: '粒子随音 · 声音的能量驱动粒子',
    rows: (v) => [['正在播放', `${v.chord} 和弦 · 第 ${v.beat} 拍`], ['低频 / 中频 / 高频 能量', v.bands, 'bands'], ['总音量 RMS', fmt(v.rms, 3), 'rms'], ['频谱质心（"亮度"）', hz(v.cen), 'cen'], ['本帧发射', `${v.emit} 个`], ['存活 / 上限', `${v.alive} / ${v.cap}`], ['重力 / 按音色变色', `${fmt(v.grav, 2)} / ${yes(v.hue)}`], ['发射点 (x, y)', v.pos, 'pos']],
    formula: () => F('发射数 ∝ RMS × 灵敏度　　RMS = √(Σx² / N)') + F('初速度 ∝ 低频能量（鼓点越重，喷得越远）') + F('颜色 ∝ 频谱质心 = Σ f·|X(f)| / Σ |X(f)|'),
    explain: '<p>这是音乐可视化里最常见的玩法：把声音拆成几个"数字"，再让这些数字控制画面。</p><p><b>RMS</b>（均方根）代表整体有多响——越响喷出的粒子越多；<b>低频能量</b>（鼓和贝斯）决定喷射速度，所以每次底鼓"咚"一下就会爆开一团；<b>频谱质心</b>表示声音的"亮度"，高音多时质心高，粒子偏向另一种颜色。</p><p>按住并拖动可以移动发射点。</p>',
    params: [['粒子颜色', '粒子基础颜色'], ['音乐播放速度', '演示音乐的快慢'], ['粒子大小', '粒子半径倍数'], ['最多粒子数', '同时存在的粒子上限'], ['灵敏度', '能量 → 粒子数/速度的放大倍数'], ['重力', '粒子下落的快慢'], ['拖尾', '保留上一帧的残影'], ['按音色变色', '用频谱质心改变色相']],
    example: (v) => `<ol><li>本帧 RMS = ${fmt(v.rms, 3)}，低频能量 ${fmt(v.bass, 2)}</li><li>发射数 ≈ RMS × 灵敏度 × 常数 = ${v.emit}</li><li>质心 ${hz(v.cen)} → 色相偏移 ${fmt(v.hs, 0)}°</li></ol>`,
    tip: '按住拖动改变发射点；鼓点出现时注意粒子"爆开"。',
  },
  build(S, A) {
    const st = { ps: [], ex: null, ey: null, lt: 0, acc: 0 };
    return ({ ctx, W, H, t, dt, C, P }) => {
      if (on(C.trail)) S.clear(0.22); else S.clear();
      const fs = fsz(W, H), cap = clamp(Math.round(num(C.count, 700)), 50, 4000), gain = num(C.gain, 1), sz = num(C.size, 1), gv = num(C.grav, 0.4);
      const M = song(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const buf = render(NF, t, M), Sp = spectrum(buf), R = rms(buf);
      const lo = bandPow(Sp, 40, 200), mi = bandPow(Sp, 200, 2000), hi = bandPow(Sp, 2000, 7600), tot = lo + mi + hi || 1, cen = centroid(Sp);
      if (P.down || st.ex == null) { st.ex = P.down ? P.x : W / 2; st.ey = P.down ? P.y : H * 0.62; }
      const ex = st.ex, ey = st.ey, hue = hueOf(C.color), hs = on(C.hue) ? clamp((cen - 600) / 2400, 0, 1) * 120 : 0;
      const bass = Math.sqrt(lo / tot);
      st.acc += R * gain * 900 * dt; let emit = 0;
      while (st.acc >= 1 && st.ps.length < cap) { st.acc -= 1; emit++; const a = Math.random() * TAU, sp = (40 + 260 * bass * gain) * (0.4 + Math.random()); st.ps.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, l: 1, h: hue + hs + (Math.random() - 0.5) * 30 }); }
      if (st.ps.length >= cap) st.acc = 0;
      for (const p of st.ps) { p.vy += gv * 300 * dt; p.vx *= 1 - 0.6 * dt; p.vy *= 1 - 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt * 0.55; }
      st.ps = st.ps.filter((p) => p.l > 0 && p.x > -20 && p.x < W + 20 && p.y < H + 20);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of st.ps) { ctx.fillStyle = hsla(p.h, 85, 60, clamp(p.l, 0, 1) * 0.8); ctx.beginPath(); ctx.arc(p.x, p.y, (1.2 + 2.2 * p.l) * sz, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hsla(hue + hs, 85, 70); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, 8 + 30 * R * gain, 0, TAU); ctx.stroke();
      // meters
      const mw = fs * 0.9, mh = Math.min(H * 0.35, fs * 9), mx = fs, my = H - fs - mh;
      [['低', lo / tot], ['中', mi / tot], ['高', hi / tot]].forEach(([n, v], i) => { ctx.fillStyle = 'rgba(148,163,184,.15)'; ctx.fillRect(mx + i * mw * 1.6, my, mw, mh); ctx.fillStyle = hsla(hue + i * 40, 85, 60); ctx.fillRect(mx + i * mw * 1.6, my + mh * (1 - v), mw, mh * v); text(ctx, n, mx + i * mw * 1.6 + mw / 2, my + mh + fs * 0.6, { size: fs * 0.75, col: '#94a3b8', align: 'center' }); });
      return { chord: M.chord, beat: (Math.floor(M.b) % 4) + 1, bands: `${pct(lo / tot)} / ${pct(mi / tot)} / ${pct(hi / tot)}`, rms: R, cen, emit, alive: st.ps.length, cap, pos: `${Math.round(ex)}, ${Math.round(ey)}`, grav: gv, hue: on(C.hue), bass, hs, hx: ex, hy: ey, ix: `e${Math.round(ex / 8)},${Math.round(ey / 8)}` };
    };
  },
};

/* ───────────────────────── scope ───────────────────────── */
FAM.scope = {
  cursor: 'ns-resize',
  spec: { color: { label: '光迹颜色', value: '#4ade80' }, speed: SPD('信号播放速度'), size: { label: '线宽', min: 0.5, max: 4, step: 0.1, value: 1.6 }, count: { label: '时间/格 ms', min: 0.5, max: 10, step: 0.5, value: 2 }, extras: [R('vdiv', '幅度/格', 0.05, 1, 0.05, 0.25), R('trig', '触发电平', -0.8, 0.8, 0.05, 0), T('xy', 'XY 李萨如模式', false), T('glow', '荧光余辉', true)], remountKeys: [] },
  presets: { 默认: {}, 细线: { size: 0.7 }, 粗线: { size: 3.5 }, 高幅: { vdiv: 0.1 }, 慢扫: { count: 8 }, 李萨如: { xy: true } },
  doc: {
    title: '示波器 · 触发让波形"站住"',
    rows: (v) => [['信号', v.sig], ['时间/格 · 幅度/格', `${fmt(v.td, 1)} ms · ${fmt(v.vd, 2)}`], ['触发电平', `${fmt(v.trig, 2)}（${v.found ? '已触发' : '未找到上升沿'}）`, 'trig'], ['指针时刻', `${fmt(v.tm, 2)} ms`, 'tm'], ['该时刻电压', fmt(v.y, 3), 'y'], ['测得周期 / 频率', `${fmt(v.per, 2)} ms / ${hz(v.fq)}`], ['峰峰值 Vpp', fmt(v.vpp, 3)]],
    formula: () => F('横向：1 格 = 时间/格（ms），屏幕共 10 格') + F('纵向：1 格 = 幅度/格，屏幕共 8 格') + F('触发：在缓冲区里找第一个 x[i−1] < 电平 ≤ x[i] 的上升沿，从这里开始画'),
    explain: '<p><b>示波器</b>把电压随时间的变化画成曲线。问题是声音一直在变，如果每帧从任意位置开始画，波形会左右乱跑。<b>触发</b>的作用是：每次都从"信号向上穿过某个电平"的那一刻开始画，于是周期性的波形就像被钉住一样静止。</p><p>这里的信号是两个音（比例 3:2 的纯五度）叠加。上下拖动画面可以改<b>触发电平</b>（右侧小三角），横向的"时间/格"决定一屏显示多长时间。打开 <b>XY 模式</b>后，横轴用第一个音、纵轴用第二个音，画出的是<b>李萨如图形</b>，频率比越简单图形越稳定。</p>',
    params: [['光迹颜色', '扫描线颜色'], ['信号播放速度', '信号时间流动快慢（触发后看起来不动）'], ['线宽', '扫描线粗细'], ['时间/格 ms', '每一格代表多少毫秒'], ['幅度/格', '每一格代表多大电压'], ['触发电平', '从信号穿过这个值的那一刻开始画'], ['XY 李萨如模式', '两个声道分别作 X、Y'], ['荧光余辉', '模拟老式示波器的拖影发光']],
    example: (v) => `<ol><li>屏幕宽 10 格 × ${fmt(v.td, 1)} ms = ${fmt(v.td * 10, 1)} ms</li><li>指针在第 ${fmt(v.tm / v.td, 1)} 格 → ${fmt(v.tm, 2)} ms，电压 ${fmt(v.y, 3)} = ${fmt(v.y / v.vd, 2)} 格</li><li>相邻两个上升沿相隔 ${fmt(v.per, 2)} ms → 频率 = 1000 / ${fmt(v.per, 2)} = ${hz(v.fq)}</li></ol>`,
    tip: '上下拖动设置触发电平；试试 XY 模式看李萨如图形。',
  },
  build(S, A) {
    const st = {};
    const geo = (W, H) => { const fs = fsz(W, H), m = fs * 1.2, top = fs * 3; const gw = W - m * 2 - fs * 1.4, gh = H - top - fs * 2.4; return { fs, x0: m, y0: top, gw, gh }; };
    S.onMove((P) => { if (!P.down || P.ui) return; const g = geo(S.W, S.H), C = S.get(), vd = num(C.vdiv, 0.25); const v = clamp(((g.y0 + g.gh / 2 - P.y) / (g.gh / 8)) * vd, -0.8, 0.8); st.trig = Math.round(v * 20) / 20; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(on(C.glow) ? 0.35 : 1);
      const g = geo(W, H), fs = g.fs, td = num(C.count, 2), vd = num(C.vdiv, 0.25), lw = num(C.size, 1.6), xy = on(C.xy);
      if (st.trig == null || st.ctrig !== num(C.trig, 0)) { st.trig = num(C.trig, 0); st.ctrig = num(C.trig, 0); }
      const trig = st.trig, base = 55 * Math.pow(2, Math.floor(((t * 0.25) % 4))) * 2;
      const v1 = { f: base, a: 0.5, w: 3, h: 9 }, v2 = { f: base * 1.5, a: 0.35, w: 0, h: 1 };
      A.voices([v1, v2]);
      const span = (td * 10) / 1000, n = Math.round(span * SR) + 2400;
      const buf = render(n, t, { voices: [v1, v2] });
      ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { const x = g.x0 + (i / 10) * g.gw; ctx.beginPath(); ctx.moveTo(x, g.y0); ctx.lineTo(x, g.y0 + g.gh); ctx.stroke(); }
      for (let j = 0; j <= 8; j++) { const y = g.y0 + (j / 8) * g.gh; ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x0 + g.gw, y); ctx.stroke(); }
      const Y = (v) => g.y0 + g.gh / 2 - (v / vd) * (g.gh / 8);
      const hue = hueOf(C.color);
      ctx.shadowColor = C.color; ctx.shadowBlur = on(C.glow) ? 8 : 0;
      let s0 = 0, found = false; for (let i = 1; i < n - span * SR; i++) if (buf[i - 1] < trig && buf[i] >= trig) { s0 = i; found = true; break; }
      const ns = Math.round(span * SR);
      let per = 0; { let a = -1; for (let i = s0 + 1; i < n; i++) if (buf[i - 1] < trig && buf[i] >= trig) { a = i; break; } per = a > 0 ? ((a - s0) / SR) * 1000 : 0; }
      ctx.strokeStyle = C.color; ctx.lineWidth = lw; ctx.beginPath();
      if (xy) { const N2 = Math.min(n, 1600), P1 = partials(v1), P2 = partials(v2); for (let i = 0; i < N2; i++) { const a = evalAt(P1, t - i / SR), b = evalAt(P2, t - i / SR); const X = g.x0 + g.gw / 2 + (a / vd) * (g.gw / 10), YY = Y(b); i ? ctx.lineTo(X, YY) : ctx.moveTo(X, YY); } }
      else for (let i = 0; i <= ns; i++) { const X = g.x0 + (i / ns) * g.gw, YY = Y(buf[s0 + i] ?? 0); i ? ctx.lineTo(X, YY) : ctx.moveTo(X, YY); }
      ctx.stroke(); ctx.shadowBlur = 0;
      const ty = Y(trig); ctx.fillStyle = hsla(hue, 85, 65); ctx.beginPath(); ctx.moveTo(g.x0 + g.gw + 2, ty); ctx.lineTo(g.x0 + g.gw + fs * 1.2, ty - fs * 0.5); ctx.lineTo(g.x0 + g.gw + fs * 1.2, ty + fs * 0.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hsla(hue, 70, 60, 0.35); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(g.x0, ty); ctx.lineTo(g.x0 + g.gw, ty); ctx.stroke(); ctx.setLineDash([]);
      let vmax = -9, vmin = 9; for (let i = s0; i < s0 + ns && i < n; i++) { vmax = Math.max(vmax, buf[i]); vmin = Math.min(vmin, buf[i]); }
      const u = clamp((P.x - g.x0) / g.gw, 0, 1), tm = u * td * 10, y = buf[s0 + Math.round(u * ns)] ?? 0;
      if (!xy) { vline(ctx, P.x, g.y0, g.y0 + g.gh); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(g.x0 + u * g.gw, Y(y), 4, 0, TAU); ctx.fill(); tip(ctx, W, H, P.x, P.y, [`${fmt(tm, 2)} ms`, `电压 ${fmt(y, 3)}`], C.color); }
      text(ctx, `${fmt(td, 1)} ms/格   ${fmt(vd, 2)} /格   触发 ${fmt(trig, 2)} ↑`, g.x0, g.y0 - fs * 1.2, { size: fs * 0.9, col: hsla(hue, 60, 75) });
      return { sig: `${noteOf(v1.f)} + ${noteOf(v2.f)}（3:2 五度）`, td, vd, trig, found, tm, y, per, fq: per ? 1000 / per : 0, vpp: vmax - vmin, hx: g.x0 + g.gw - fs * 0.5, hy: ty, ix: `${Math.round(u * 100)}|${Math.round(trig * 20)}` };
    };
  },
};

/* ───────────────────────── polar ───────────────────────── */
FAM.polar = {
  spec: { color: { label: '起始色相', value: '#f472b6' }, speed: SPD('音乐播放速度'), size: { label: '外圈半径', min: 0.5, max: 1.2, step: 0.05, value: 1 }, count: { label: '采样点数', min: 24, max: 256, step: 8, value: 120 }, extras: [R('floor', '底噪门限 dB', -90, -30, 1, -72), R('rot', '旋转速度', 0, 1, 0.05, 0.15), T('rainbow', '彩虹色', true), T('fill', '填充', true)], remountKeys: [] },
  presets: { 默认: {}, 密采样: { count: 256 }, 疏采样: { count: 32 }, 大半径: { size: 1.2 }, 单色: { rainbow: false }, 高门限: { floor: -45 } },
  doc: {
    title: '极坐标频谱 · 角度是频率，半径是响度',
    rows: (v) => [['正在播放', `${v.chord} 和弦`], ['采样点数 / 门限', `${v.n} / ${v.fl} dB`], ['悬停角度', `${fmt(v.deg, 0)}°`, 'deg'], ['对应频率', `${hz(v.f)}（${noteOf(v.f)}）`, 'f'], ['该处电平', db(v.l), 'l'], ['半径 r', `${fmt(v.r, 1)} px`], ["旋转速度", fmt(v.rot, 2)], ['最响频率', `${hz(v.fpk)}（${noteOf(v.fpk)}）`]],
    formula: () => F('角度 θ = 2π × log(f / 40) / log(7600 / 40)　（对数频率绕一圈）') + F('半径 r = R × (L − 门限) / (0 − 门限)') + F('点 = (cx + r·cos θ, cy + r·sin θ)'),
    explain: '<p>把普通的"频谱曲线"从直角坐标换成<b>极坐标</b>：沿着圆周走一圈就是从 40 Hz 到 7600 Hz（按倍数均匀分布），离圆心越远表示这个频率越响。</p><p>音乐里的低音、和弦、旋律会在不同角度鼓出"花瓣"；每换一个和弦，花瓣的位置就跳一下。<b>门限</b>以下的声音当成 0，避免一圈细碎的噪声。</p>',
    params: [['起始色相', '颜色起点'], ['音乐播放速度', '演示音乐快慢'], ['外圈半径', '最大半径相对画布'], ['采样点数', '一圈取多少个频率点'], ['底噪门限 dB', '低于它的电平记为 0'], ['旋转速度', '整个图形缓慢旋转'], ['彩虹色', '按角度变化颜色'], ['填充', '花瓣内部填色']],
    example: (v) => `<ol><li>指针角度 ${fmt(v.deg, 0)}° = 一圈的 ${fmt(v.deg / 3.6, 1)}%</li><li>f = 40 × (7600/40)^${fmt(v.deg / 360, 3)} = ${hz(v.f)}</li><li>电平 ${db(v.l)} → r = R × (${fmt(v.l, 1)} − ${v.fl}) / ${-v.fl} = ${fmt(v.r, 1)} px</li></ol>`,
    tip: '指针绕圆心转一圈，扫过所有频率。',
  },
  build(S, A) {
    const st = { lt: 0, rot: 0 };
    return ({ ctx, W, H, t, dt, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.12);
      const fs = fsz(W, H), N = clamp(Math.round(num(C.count, 120)), 8, 400), fl = num(C.floor, -72), rb = on(C.rainbow);
      st.rot += num(C.rot, 0.15) * dt;
      const M = song(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const Sp = spectrum(render(NF, t, M));
      const cx = W / 2, cy = H / 2 + fs * 0.5, R = (Math.min(W, H) / 2 - fs * 1.8) * num(C.size, 1), hue = hueOf(C.color);
      const rr = (L) => clamp((L - fl) / -fl, 0, 1.1) * R;
      for (const k of [0.33, 0.66, 1]) { ctx.strokeStyle = 'rgba(148,163,184,.12)'; ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, TAU); ctx.stroke(); }
      for (const f of [100, 300, 1000, 3000]) { const a = -Math.PI / 2 + logU(f) * TAU + st.rot; ctx.strokeStyle = 'rgba(148,163,184,.1)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); text(ctx, f >= 1000 ? `${f / 1000}k` : String(f), cx + Math.cos(a) * (R + fs * 0.9), cy + Math.sin(a) * (R + fs * 0.9), { size: fs * 0.75, col: '#64748b', align: 'center' }); }
      const pts = []; let fpk = 100, lpk = -999;
      for (let i = 0; i < N; i++) { const u = i / N, f = logF(u), L = dbAt(Sp, f); if (L > lpk) { lpk = L; fpk = f; } const a = -Math.PI / 2 + u * TAU + st.rot, r = rr(L); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, u]); }
      if (on(C.fill)) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = hsla(hue, 80, 55, 0.2); ctx.fill(); }
      for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; ctx.strokeStyle = rb ? hsla(hue + a[2] * 300, 85, 62) : hsla(hue, 85, 65); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      let th = Math.atan2(P.y - cy, P.x - cx) + Math.PI / 2 - st.rot; th = ((th % TAU) + TAU) % TAU;
      const f = logF(th / TAU), L = dbAt(Sp, f), r = rr(L), a = th - Math.PI / 2 + st.rot, hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r;
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.fill();
      text(ctx, M.chord, cx, cy, { size: fs * 1.5, col: 'rgba(226,232,240,.75)', align: 'center', bold: true });
      tip(ctx, W, H, P.x, P.y, [`${hz(f)} · ${noteOf(f)}`, `电平 ${db(L)}`], C.color);
      return { chord: M.chord, n: N, fl, rot: num(C.rot, 0.15), deg: (th * 180) / Math.PI, f, l: L, r, fpk, hx, hy, ix: `p${Math.round((th / TAU) * N)}` };
    };
  },
};

/* ───────────────────────── waterfall ───────────────────────── */
FAM.waterfall = {
  spec: { color: { label: '高能颜色', value: '#22d3ee' }, speed: SPD('滚动速度'), size: { label: '对比度 γ', min: 0.4, max: 2.5, step: 0.05, value: 1.8 }, count: { label: '频率列数', min: 32, max: 256, step: 8, value: 128 }, extras: [R('rows', '历史行数', 40, 240, 10, 120), R('floor', '底噪门限 dB', -90, -30, 1, -62), T('log', '对数频率轴', true), T('sweep', '叠加扫频音', true)], remountKeys: [] },
  presets: { 默认: {}, 密行: { rows: 240 }, 疏行: { rows: 50 }, 高对比: { size: 2.2 }, 线性轴: { log: false }, 只听音乐: { sweep: false } },
  doc: {
    title: '瀑布图（声谱图）· 频谱随时间流下来',
    rows: (v) => [['正在播放', `${v.chord} 和弦`], ['列 × 行', `${v.cols} × ${v.rows}`], ['悬停时间', `${fmt(v.ago, 2)} s 前`, 'ago'], ['悬停频率', `${hz(v.f)}（${noteOf(v.f)}）`, 'f'], ['该点电平', db(v.l), 'l'], ['扫频音当前', v.sw], ['对比度 γ / 门限', `${fmt(v.gam, 2)} / ${v.fl} dB`]],
    formula: () => F('每一行 = 一次 FFT（某一时刻的频谱）') + F('亮度 = ((L − 门限) / (0 − 门限))^γ') + F('新的一行从顶部进入，旧的往下移 → 纵轴就是时间'),
    explain: '<p>柱状频谱只能看"此刻"，<b>瀑布图</b>（也叫声谱图、语谱图）把每个时刻的频谱排成一行，一行行往下流，于是<b>横轴 = 频率、纵轴 = 时间、亮度 = 响度</b>，一张图就能看到整段声音。</p><p>图里竖直的亮线是持续的音（和弦、贝斯），一格一格跳的是旋律，横向的亮条是鼓点（它们一瞬间覆盖很多频率），斜着划过的是<b>扫频音</b>（频率随时间变化）。语音识别、鸟叫分析都靠它。</p>',
    params: [['高能颜色', '最响处的颜色'], ['滚动速度', '每秒新增多少行（随播放速度）'], ['对比度 γ', '亮度曲线的指数'], ['频率列数', '横向分辨率'], ['历史行数', '保留多长时间的历史'], ['底噪门限 dB', '低于它显示为黑'], ['对数频率轴', '按倍数排列频率'], ['叠加扫频音', '额外加一个上下滑动的音']],
    example: (v) => `<ol><li>指针在 ${fmt(v.ago, 2)} s 前、${hz(v.f)}</li><li>那一刻该频率电平 ${db(v.l)}</li><li>亮度 = ((${fmt(v.l, 1)} − ${v.fl}) / ${-v.fl})^${fmt(v.gam, 2)} = ${fmt(v.q, 3)}</li></ol>`,
    tip: '指针移到图上任意一点，看那一刻那个频率有多响。',
  },
  build(S, A) {
    const st = { hist: [], lt: 0, acc: 0, cv: document.createElement('canvas'), key: '' };
    const RATE = 24;
    return ({ ctx, W, H, t, dt, C, P }) => {
      S.clear();
      const fs = fsz(W, H), cols = clamp(Math.round(num(C.count, 128)), 16, 400), rows = clamp(Math.round(num(C.rows, 120)), 10, 400), fl = num(C.floor, -62), gam = num(C.size, 1.8), lg = on(C.log), sw = on(C.sweep);
      const swF = (tt) => 300 * Math.pow(2, 2.5 * (0.5 - 0.5 * Math.cos(tt * 0.7)));
      const model = (tt) => { const M = song(tt); if (sw) M.voices.push({ f: swF(tt), a: 0.3, w: 0, h: 1 }); return M; };
      const M = model(t); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      const key = `${cols}|${lg}|${sw}`; if (key !== st.key) { st.key = key; st.hist = []; st.acc = 0; }
      const fcol = (i) => (lg ? logF((i + 0.5) / cols) : FMIN + ((FMAX - FMIN) * (i + 0.5)) / cols);
      const rowAt = (tt) => { const Sp = spectrum(render(512, tt, model(tt))); const r = new Float32Array(cols); for (let i = 0; i < cols; i++) r[i] = dbAt(Sp, fcol(i)); return { t: tt, r }; };
      if (!st.hist.length) for (let k = rows - 1; k >= 0; k--) st.hist.push(rowAt(t - k / RATE));
      st.acc += dt * RATE; let guard = 0; while (st.acc >= 1 && guard++ < 6) { st.acc -= 1; st.hist.push(rowAt(t)); }
      if (st.acc > 6) st.acc = 0;
      while (st.hist.length > rows) st.hist.shift();
      const ml = fs * 2.8, mr = fs * 0.8, mt = fs * 3, mb = fs * 2, w = W - ml - mr, h = H - mt - mb;
      const c = hexRgb(C.color), q = (L) => Math.pow(clamp((L - fl) / -fl, 0, 1), gam);
      const cv = st.cv; if (cv.width !== cols || cv.height !== rows) { cv.width = cols; cv.height = rows; }
      const cx = cv.getContext('2d'), img = cx.createImageData(cols, rows);
      const n = st.hist.length;
      for (let j = 0; j < rows; j++) { const row = st.hist[n - 1 - j]; for (let i = 0; i < cols; i++) { const v = row ? q(row.r[i]) : 0, o = (j * cols + i) * 4, m = v < 0.75 ? v / 0.75 : 1, wv = v < 0.75 ? 0 : (v - 0.75) / 0.25 * 0.6; img.data[o] = lerp(lerp(6, c[0], m), 255, wv); img.data[o + 1] = lerp(lerp(10, c[1], m), 255, wv); img.data[o + 2] = lerp(lerp(22, c[2], m), 255, wv); img.data[o + 3] = 255; } }
      cx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, ml, mt, w, h); ctx.imageSmoothingEnabled = true;
      for (const f of [100, 300, 1000, 3000]) { const u = lg ? logU(f) : (f - FMIN) / (FMAX - FMIN); text(ctx, f >= 1000 ? `${f / 1000}k` : String(f), ml + u * w, mt + h + fs * 0.8, { size: fs * 0.75, col: '#64748b', align: 'center' }); }
      text(ctx, '现在', ml - 4, mt + fs * 0.3, { size: fs * 0.75, col: '#64748b', align: 'right' }); text(ctx, `${fmt(rows / RATE, 1)}s 前`, ml - 4, mt + h - fs * 0.3, { size: fs * 0.72, col: '#64748b', align: 'right' });
      text(ctx, '时间 ↓ 频率 →', ml, mt - fs * 1.2, { size: fs * 0.9, col: '#94a3b8' });
      const i = clamp(Math.floor(((P.x - ml) / w) * cols), 0, cols - 1), j = clamp(Math.floor(((P.y - mt) / h) * rows), 0, rows - 1), row = st.hist[n - 1 - j] || st.hist[n - 1];
      const L = row.r[i], ago = j / RATE;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(ml + (i / cols) * w - 1, mt + (j / rows) * h - 1, w / cols + 2, h / rows + 2);
      tip(ctx, W, H, P.x, P.y, [`${fmt(ago, 2)} s 前 · ${hz(fcol(i))}`, `电平 ${db(L)}`], C.color);
      return { chord: M.chord, cols, rows, ago, f: fcol(i), l: L, q: q(L), sw: sw ? hz(swF(t)) : '关', gam, fl, ix: `${i},${j}` };
    };
  },
};

/* ───────────────────────── beat ───────────────────────── */
FAM.beat = {
  spec: { color: { label: '脉冲颜色', value: '#f472b6' }, speed: SPD('播放速度'), size: { label: '脉冲大小', min: 0.4, max: 2, step: 0.05, value: 1 }, count: { label: '鼓点 BPM', min: 60, max: 180, step: 1, value: 112 }, extras: [R('sens', '检测灵敏度 C', 1.05, 2.5, 0.05, 1.5), R('hist', '平均窗口 s', 0.3, 2, 0.05, 0.8), T('low', '只看低频（鼓）', true), T('ring', '节拍环', true)], remountKeys: [] },
  presets: { 默认: {}, 大脉: { size: 1.8 }, 小脉: { size: 0.6 }, 快歌: { count: 160 }, 慢歌: { count: 76 }, 迟钝: { sens: 2.2 } },
  doc: {
    title: '节拍检测 · 能量突然变大就是"一拍"',
    rows: (v) => [['设定 BPM / 测得 BPM', `${v.bpm} / ${v.est ? fmt(v.est, 0) : '计算中'}`, 'est'], ['当前能量 E', fmt(v.e, 3), 'e'], ['局部平均 Ē × C', `${fmt(v.avg, 3)} × ${fmt(v.sens, 2)} = ${fmt(v.avg * v.sens, 3)}`], ['是否判为节拍', v.on ? '是 ✓' : '否'], ['节拍环 / 只看低频', `${yes(v.ring)} / ${yes(v.low)}`], ['悬停时刻', v.hov, 'hov'], ['该时刻 E / 阈值', v.hv, 'hv'], ['最近检出间隔', v.iv]],
    formula: () => F('能量 E(t) = 低频段功率之和（约 40–150 Hz）') + F('阈值 = C × Ē　（Ē = 过去一段时间的平均能量）') + F('E > 阈值 且 是局部峰 → 判为一拍；BPM = 60 / 平均间隔'),
    explain: '<p>音乐软件跟着节奏闪光，靠的是<b>节拍检测</b>。最朴素的办法：持续计算低频（底鼓所在频段）的<b>能量</b>，再和"最近一段时间的平均能量"比较——如果此刻突然比平均高出 C 倍，就认为来了一拍。</p><p>下方曲线是能量随时间的变化，虚线是阈值 C×Ē，红点是被判为节拍的时刻。把相邻两拍的时间间隔取平均，就能估算 <b>BPM</b>（每分钟拍数）。C 太小会把小鼓、哈特也当成拍；太大又会漏拍。</p>',
    params: [['脉冲颜色', '中心脉冲和曲线颜色'], ['播放速度', '整体时间流速'], ['脉冲大小', '检出节拍时圆圈放大多少'], ['鼓点 BPM', '演示鼓点的真实速度'], ['检测灵敏度 C', '能量要超过平均值多少倍'], ['平均窗口 s', 'Ē 用过去多长时间计算'], ['只看低频（鼓）', '关掉后用全频段能量'], ['节拍环', '每拍从中心扩散一个圆环']],
    example: (v) => `<ol><li>此刻 E = ${fmt(v.e, 3)}，过去 ${fmt(v.win, 2)} s 平均 Ē = ${fmt(v.avg, 3)}</li><li>阈值 = ${fmt(v.sens, 2)} × ${fmt(v.avg, 3)} = ${fmt(v.avg * v.sens, 3)} → ${v.e > v.avg * v.sens ? '超过，判为节拍' : '未超过'}</li><li>${v.est ? `平均间隔 ${fmt(60 / v.est, 3)} s → BPM = 60 / ${fmt(60 / v.est, 3)} = ${fmt(v.est, 0)}` : '检出的拍还不够两个，暂不能估算'}</li></ol>`,
    tip: '指针移到下方能量曲线上，看每个时刻的能量和阈值。',
  },
  build(S, A) {
    const st = { lt: 0, pulse: 0, rings: [], last: -1 };
    const DT = 1 / 60;
    return ({ ctx, W, H, t, dt, dtw, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.1);
      const fs = fsz(W, H), bpm = clamp(Math.round(num(C.count, 112)), 40, 240), sens = num(C.sens, 1.5), win = num(C.hist, 0.8), low = on(C.low), sz = num(C.size, 1);
      const o = { bpm, mel: true }; const M = song(t, o); A.voices(M.voices); playHits(A, M.hits, st.lt, t); st.lt = t;
      // analytic energy from the drum + tonal model (deterministic, so frozen frames are stable)
      const E = (tt) => { const m = song(tt, o); let e = low ? 0.02 : 0.06; for (const h of m.hits) { const a = tt - h.t0; if (a < 0) continue; if (h.k === 'kick') e += Math.exp(-7 * a) ** 2; else if (!low) e += (h.k === 'snare' ? 0.35 : 0.05 * (h.a ?? 1)) * Math.exp(-(h.k === 'snare' ? 16 : 60) * a) ** 2; else if (h.k === 'snare') e += 0.08 * Math.exp(-16 * a) ** 2; } return e; };
      const span = 4, ns = Math.round(span / DT), wn = Math.round(win / DT);
      const es = new Float32Array(ns + wn), ts = new Float32Array(ns + wn);
      for (let i = 0; i < ns + wn; i++) { ts[i] = t - (ns + wn - 1 - i) * DT; es[i] = E(ts[i]); }
      const avg = (i) => { let s = 0; for (let k = i - wn; k < i; k++) s += es[k]; return s / wn; };
      const beats = [];
      for (let i = wn + 1; i < ns + wn - 1; i++) { const th = avg(i) * sens; if (es[i] > th && es[i] >= es[i - 1] && es[i] >= es[i + 1] && (!beats.length || ts[i] - beats[beats.length - 1] > 0.18)) beats.push(ts[i]); }
      const iE = ns + wn - 1, eNow = es[iE], aNow = avg(iE), isOn = eNow > aNow * sens;
      const lastB = beats.length ? beats[beats.length - 1] : -1;
      if (lastB > st.last + 1e-6) { st.last = lastB; if (dtw > 0) { st.pulse = 1; if (on(C.ring)) st.rings.push(0); } }
      st.pulse *= Math.exp(-dtw * 6); st.rings = st.rings.map((r) => r + dtw * 1.4).filter((r) => r < 1);
      let est = 0; if (beats.length >= 3) { const iv = []; for (let k = 1; k < beats.length; k++) iv.push(beats[k] - beats[k - 1]); iv.sort((a, b) => a - b); const med = iv[iv.length >> 1]; est = 60 / med; while (est < 70) est *= 2; while (est > 190) est /= 2; }
      const hue = hueOf(C.color), cx = W / 2, cy = H * 0.36, R0 = Math.min(W, H) * 0.11 * sz;
      for (const r of st.rings) { ctx.strokeStyle = hsla(hue, 85, 65, (1 - r) * 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R0 * (1 + r * 2.2), 0, TAU); ctx.stroke(); }
      const rr = R0 * (1 + 0.55 * st.pulse);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, hsla(hue, 90, 75, 0.95)); g.addColorStop(1, hsla(hue, 85, 50, 0.25 + 0.4 * st.pulse)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
      text(ctx, est ? `${fmt(est, 0)}` : '…', cx, cy - fs * 0.2, { size: fs * 1.8, col: '#0b1020', align: 'center', bold: true }); text(ctx, 'BPM', cx, cy + fs * 1.2, { size: fs * 0.8, col: '#0b1020', align: 'center', bold: true });
      // energy plot
      const ml = fs * 2.6, mr = fs, pt = H * 0.62, ph = H - pt - fs * 1.8, pw = W - ml - mr; let mx = 0.2; for (let i = wn; i < ns + wn; i++) mx = Math.max(mx, es[i], avg(i) * sens);
      const X = (i) => ml + ((i - wn) / (ns - 1)) * pw, Y = (v) => pt + ph - (v / mx) * ph;
      ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.strokeRect(ml, pt, pw, ph);
      ctx.beginPath(); for (let i = wn; i < ns + wn; i++) { i > wn ? ctx.lineTo(X(i), Y(es[i])) : ctx.moveTo(X(i), Y(es[i])); } ctx.strokeStyle = C.color; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath(); for (let i = wn; i < ns + wn; i += 2) { i > wn ? ctx.lineTo(X(i), Y(avg(i) * sens)) : ctx.moveTo(X(i), Y(avg(i) * sens)); } ctx.strokeStyle = 'rgba(226,232,240,.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      for (const b of beats) { const i = Math.round((b - ts[0]) / DT); ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.arc(X(i), Y(es[i]), 3.5, 0, TAU); ctx.fill(); }
      text(ctx, `低频能量 E（实线）与阈值 C×Ē（虚线）· 最近 ${span} 秒`, ml, pt - fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      text(ctx, '现在', ml + pw, pt + ph + fs * 0.8, { size: fs * 0.75, col: '#64748b', align: 'right' }); text(ctx, `-${span}s`, ml, pt + ph + fs * 0.8, { size: fs * 0.75, col: '#64748b', align: 'left' });
      let hov = '（移到曲线上）', hv = '—', ix = '-', hx = cx, hy = cy;
      if (P.y >= pt - fs && P.x >= ml && P.x <= ml + pw) { const i = clamp(Math.round(((P.x - ml) / pw) * (ns - 1)) + wn, wn, ns + wn - 1); hov = `${fmt(t - ts[i], 2)} s 前`; hv = `${fmt(es[i], 3)} / ${fmt(avg(i) * sens, 3)}`; ix = `h${i}`; hx = X(i); hy = Y(es[i]); vline(ctx, X(i), pt, pt + ph); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, TAU); ctx.fill(); tip(ctx, W, H, P.x, P.y, [hov, `E ${fmt(es[i], 3)} · 阈值 ${fmt(avg(i) * sens, 3)}`], C.color); }
      const ivs = beats.length > 1 ? `${fmt(beats[beats.length - 1] - beats[beats.length - 2], 3)} s` : '—';
      return { bpm, est, ring: on(C.ring), low, e: eNow, avg: aNow, sens, win, on: isOn, hov, hv, iv: ivs, hx, hy, ix };
    };
  },
};

/* ───────────────────────── chord ───────────────────────── */
const CHORDS = [['C', 60, [0, 4, 7]], ['G', 55, [0, 4, 7]], ['Am', 57, [0, 3, 7]], ['F', 53, [0, 4, 7]], ['Dm', 62, [0, 3, 7]], ['Em', 64, [0, 3, 7]], ['E', 64, [0, 4, 7]], ['Bdim', 59, [0, 3, 6]], ['D', 62, [0, 4, 7]], ['A', 57, [0, 4, 7]], ['Bb', 58, [0, 4, 7]], ['Fm', 53, [0, 3, 7]]];
const RAT = { 0: '1', 3: '6/5', 4: '5/4', 6: '√2≈45/32', 7: '3/2', 10: '9/5', 11: '15/8' };
FAM.chord = {
  spec: { color: { label: '和弦板颜色', value: '#60a5fa' }, speed: SPD('和弦进行速度'), size: { label: '板间距', min: 2, max: 18, step: 1, value: 8 }, count: { label: '和弦板数', min: 4, max: 12, step: 2, value: 8, buttons: true }, extras: [R('inv', '转位（0 原位 1 一转 2 二转）', 0, 2, 1, 0), R('oct', '整体八度偏移', -1, 1, 1, 0), T('sev', '加七音', false), T('pulse', '节拍脉动', true)], remountKeys: [] },
  presets: { 默认: {}, 四块: { count: 4, size: 14 }, 十二块: { count: 12, size: 4 }, 七和弦: { sev: true }, 一转位: { inv: 1 }, 低八度: { oct: -1 } },
  doc: {
    title: '和弦板 · 三个音为什么好听',
    rows: (v) => [['正在响的和弦', v.cur, 'cur'], ['组成音', v.notes, 'notes'], ['频率', v.freqs], ['相对根音的频率比', v.ratio, 'ratio'], ['悬停的和弦板', v.hov, 'hov'], ['转位 / 七音 / 脉动', `${v.inv} / ${v.sev} / ${v.pul}`], ['和弦进行', v.prog]],
    formula: () => F('大三和弦 = 根音 + 4 个半音 + 7 个半音　≈ 频率比 4 : 5 : 6') + F('小三和弦 = 根音 + 3 + 7 个半音　≈ 10 : 12 : 15') + F('每升一个半音，频率 × 2^(1/12) ≈ 1.0595'),
    explain: '<p><b>和弦</b>就是同时响起的几个音。最常见的<b>三和弦</b>由根音、三音、五音组成：大三和弦（如 C = do-mi-sol）听起来明亮，小三和弦（如 Am = la-do-mi）听起来柔和、带点忧伤。</p><p>它们好听的原因在频率比：C 大三和弦三个音的频率接近 <b>4:5:6</b>，波形会周期性地对齐，耳朵觉得"融合"。下方的小琴键标出组成音，波形是三个音相加的结果。点任意和弦板就能切换；不碰时会自动按 C–G–Am–F 进行。</p>',
    params: [['和弦板颜色', '板的主色'], ['和弦进行速度', '自动切换的快慢'], ['板间距', '板与板之间的空隙'], ['和弦板数', '显示多少个和弦'], ['转位', '把最低的音移高一个八度'], ['整体八度偏移', '所有音整体升/降一个八度'], ['加七音', '加上第 4 个音，变成七和弦'], ['节拍脉动', '跟着拍子轻微发光']],
    example: (v) => `<ol><li>${v.cur} 的根音 ${v.root}，频率 ${hz(v.f0)}</li><li>三音高 ${v.i3} 个半音：${hz(v.f0)} × 2^(${v.i3}/12) = ${hz(v.f0 * Math.pow(2, v.i3 / 12))}</li><li>五音高 7 个半音：× 2^(7/12) = ${fmt(Math.pow(2, 7 / 12), 4)} ≈ 3/2</li></ol>`,
    tip: '点和弦板切换；看下方琴键上亮起的组成音。',
  },
  build(S, A) {
    const st = { sel: -1, selT: -1, cur: -1 };
    const grid = (W, H, n, gap) => { const fs = fsz(W, H), cols = W < 520 ? Math.min(4, n) : Math.min(n <= 8 ? 4 : 6, n), rws = Math.ceil(n / cols), top = fs * 3, bot = H * 0.36, gw = W - fs * 2, gh = H - top - bot - fs; const cw = (gw - gap * (cols - 1)) / cols, ch = (gh - gap * (rws - 1)) / rws; return Array.from({ length: n }, (_, i) => ({ i, x: fs + (i % cols) * (cw + gap), y: top + Math.floor(i / cols) * (ch + gap), w: cw, h: ch })); };
    const padAt = (P) => { const C = S.get(); const g = grid(S.W, S.H, clamp(Math.round(num(C.count, 8)), 2, 12), num(C.size, 8)); return g.find((r) => inRect(P, r)); };
    S.onDown((P) => { if (P.ui) return; const r = padAt(P); if (r) { st.sel = r.i; st.selT = S.t + 4; } });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.1);
      const fs = fsz(W, H), n = clamp(Math.round(num(C.count, 8)), 2, 12), gap = num(C.size, 8), inv = clamp(Math.round(num(C.inv, 0)), 0, 2), oc = clamp(Math.round(num(C.oct, 0)), -2, 2), sev = on(C.sev);
      if (st.sel >= 0 && t > st.selT) st.sel = -1;
      const bpos = t * 2, auto = [0, 1, 2, 3][Math.floor(bpos / 4) % 4];
      const cur = st.sel >= 0 && st.sel < n ? st.sel : auto;
      const notes = (ci) => { const [, root, iv] = CHORDS[ci]; let ms = iv.map((x) => root + x + oc * 12); if (sev) ms.push(root + (iv[1] === 3 || iv[2] === 6 ? 10 : 10) + oc * 12); for (let k = 0; k < inv; k++) { ms.sort((a, b) => a - b); ms[0] += 12; } return ms.sort((a, b) => a - b); };
      const ms = notes(cur), env = 0.6 + 0.4 * Math.exp(-(bpos % 1) * 3);
      const vs = ms.map((m) => ({ f: mtof(m), a: 0.22 * env, w: 3, h: 7 })); vs.push({ f: mtof(CHORDS[cur][1] - 24 + oc * 12), a: 0.25, w: 0, h: 1 });
      A.voices(vs);
      const hue = hueOf(C.color), G = grid(W, H, n, gap), hp = G.find((r) => inRect(P, r));
      for (const r of G) { const c = CHORDS[r.i], minor = c[2][1] === 3, lit = r.i === cur, pul = on(C.pulse) && lit ? 0.25 * Math.exp(-(bpos % 1) * 4) : 0; ctx.fillStyle = lit ? hsla(hue, 85, 55 + 15 * pul) : hsla(hue + (minor ? 40 : 0), 45, r === hp ? 32 : 22); rrect(ctx, r.x, r.y, r.w, r.h, Math.min(14, r.h * 0.2)); ctx.fill(); if (r === hp) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } text(ctx, c[0], r.x + r.w / 2, r.y + r.h / 2 - fs * 0.3, { size: Math.min(r.h * 0.32, fs * 2), col: lit ? '#0b1020' : '#e2e8f0', align: 'center', bold: true }); text(ctx, minor ? '小三' : c[2][2] === 6 ? '减三' : '大三', r.x + r.w / 2, r.y + r.h / 2 + fs * 0.9, { size: fs * 0.75, col: lit ? '#0b1020' : '#94a3b8', align: 'center' }); }
      // mini keyboard (2 octaves from C3+oc) + waveform
      const ky = H * 0.66, kh = H * 0.15, kx = fs, kw = (W - fs * 2) / 2 - fs * 0.5, base = 48 + oc * 12 + (inv ? 0 : 0);
      const wm = [0, 2, 4, 5, 7, 9, 11], wk = 21, ww = kw / wk;
      const lit = new Set(ms.map((m) => m - base));
      for (let i = 0; i < wk; i++) { const m = Math.floor(i / 7) * 12 + wm[i % 7]; ctx.fillStyle = lit.has(m) ? hsla(hue, 85, 65) : '#cbd5e1'; ctx.fillRect(kx + i * ww + 0.5, ky, ww - 1, kh); }
      const bm = [1, 3, null, 6, 8, 10, null]; for (let i = 0; i < wk - 1; i++) { const b = bm[i % 7]; if (b == null) continue; const m = Math.floor(i / 7) * 12 + b; ctx.fillStyle = lit.has(m) ? hsla(hue, 85, 50) : '#0f172a'; ctx.fillRect(kx + (i + 0.65) * ww, ky, ww * 0.7, kh * 0.6); }
      const wx = kx + kw + fs, wwid = W - wx - fs, P0 = []; for (const v of vs) for (const p of partials(v)) P0.push(p); const span = 0.03;
      ctx.strokeStyle = C.color; ctx.lineWidth = 1.6; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const y = evalAt(P0, t - span + (i / 200) * span); const Y = ky + kh / 2 - clamp(y, -1.2, 1.2) * kh * 0.45; i ? ctx.lineTo(wx + (i / 200) * wwid, Y) : ctx.moveTo(wx, Y); } ctx.stroke();
      text(ctx, '组成音', kx, ky - fs * 0.7, { size: fs * 0.85, col: '#94a3b8' }); text(ctx, '合成波形（30 ms）', wx, ky - fs * 0.7, { size: fs * 0.85, col: '#94a3b8' });
      const r0 = ms[0], rat = ms.map((m) => RAT[(m - r0) % 12] ? `${RAT[(m - r0) % 12]}${m - r0 >= 12 ? '×2' : ''}` : fmt(Math.pow(2, (m - r0) / 12), 3)).join(' : ');
      const hc = hp ? CHORDS[hp.i] : null;
      if (hp) tip(ctx, W, H, P.x, P.y, [`${hc[0]} 和弦`, notes(hp.i).map(nname).join(' · ')], C.color);
      const pr = hp || G[cur] || G[0];
      return { cur: `${CHORDS[cur][0]}${sev ? '7' : ''}${st.sel >= 0 ? '（手动）' : '（自动进行）'}`, notes: ms.map(nname).join(' · '), freqs: ms.map((m) => fmt(mtof(m), 0)).join(' / ') + ' Hz', ratio: rat, hov: hc ? `${hc[0]}：${notes(hp.i).map(nname).join(' ')}` : '（移到板上）', inv: ['原位', '第一转位', '第二转位'][inv], sev: yes(sev), pul: yes(on(C.pulse)), prog: 'C → G → Am → F', root: nname(ms[0]), f0: mtof(ms[0]), i3: ms[1] - ms[0], hx: pr.x + pr.w / 2, hy: pr.y + pr.h / 2, ix: hp ? `p${hp.i}` : `c${cur}` };
    };
  },
};

/* ───────────────────────── noise-pad ───────────────────────── */
const FTN = ['低通', '带通', '高通'], FTW = ['lowpass', 'bandpass', 'highpass'], NCN = ['白噪声', '粉红噪声', '棕噪声'];
/** RBJ biquad magnitude (dB) for lowpass / bandpass / highpass */
const biq = (type, f, f0, Q, sr = 44100) => {
  const w0 = (TAU * f0) / sr, al = Math.sin(w0) / (2 * Q), cw = Math.cos(w0);
  let b0, b1, b2; if (type === 0) { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else if (type === 1) { b0 = al; b1 = 0; b2 = -al; } else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al, w = (TAU * f) / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-12);
};
FAM['noise-pad'] = {
  cursor: 'crosshair',
  spec: { color: { label: '滤波颜色', value: '#a78bfa' }, speed: SPD('自动漂移速度'), size: { label: '光点大小', min: 0.5, max: 3, step: 0.1, value: 1 }, count: { label: '频谱柱数', min: 32, max: 160, step: 8, value: 96 }, extras: [R('type', '滤波类型（0低通 1带通 2高通）', 0, 2, 1, 0), R('ncol', '噪声颜色（0白 1粉 2棕）', 0, 2, 1, 1), R('qmax', 'Q 上限', 2, 20, 0.5, 10), T('grid', '显示网格', true)], remountKeys: [] },
  presets: { 默认: {}, 带通: { type: 1 }, 高通: { type: 2 }, 白噪声: { ncol: 0 }, 棕噪声: { ncol: 2 }, 尖锐共振: { qmax: 20 } },
  doc: {
    title: '噪声垫 · 用滤波器"雕刻"噪声',
    rows: (v) => [['噪声 / 滤波器', `${v.nc} / ${v.ft}`], ['截止频率 fc（横向）', hz(v.fc), 'fc'], ['共振 Q（纵向）', fmt(v.q, 2), 'q'], ['fc 处增益', db(v.gc), 'gc'], ['−3 dB 带宽', v.bw], ['指针下电平（频谱区）', v.lv, 'lv'], ['听起来像', v.feel]],
    formula: () => F('白噪声：每个频率能量相同；粉红：∝ 1/f（每个八度能量相同）；棕：∝ 1/f²') + F('二阶滤波器（RBJ biquad）：ω₀ = 2π·fc/fs，α = sin ω₀ / (2Q)') + F('输出频谱 = 噪声频谱 + 滤波器响应（dB 相加）'),
    explain: '<p><b>噪声</b>是所有频率都有的随机声音，像电视雪花"沙沙"声。只要在后面接一个<b>滤波器</b>，就能把它变成风声、海浪、呼吸声：低通只留低频（闷、像远处的风），高通只留高频（嘶嘶声），带通只留中间一段（像吹口哨的风）。</p><p>这块 XY 垫子：<b>横向 = 截止频率</b>，<b>纵向 = 共振 Q</b>（越往上，截止频率附近越"尖"，会听到一个像音高的鸣响）。下方是滤波后的频谱和滤波器曲线。点右上角「声音」能听到真实效果。</p>',
    params: [['滤波颜色', '曲线与光点颜色'], ['自动漂移速度', '无人操作时光点自己漂移'], ['光点大小', 'XY 光点的大小'], ['频谱柱数', '下方频谱分成多少条'], ['滤波类型', '0 低通、1 带通、2 高通'], ['噪声颜色', '0 白、1 粉红、2 棕（越往后越"闷"）'], ['Q 上限', '纵向顶部对应的 Q 值'], ['显示网格', '垫子上的参考网格']],
    example: (v) => `<ol><li>指针横向位置 → fc = 80 × (8000/80)^${fmt(v.ux, 2)} = ${hz(v.fc)}</li><li>纵向位置 → Q = 0.5 + ${fmt(v.uy, 2)} × (${fmt(v.qmax, 1)} − 0.5) = ${fmt(v.q, 2)}</li><li>${v.ft}在 fc 处的增益 = ${db(v.gc)}${v.q > 0.8 ? '（Q 大于 0.707 时会出现共振凸起）' : ''}</li></ol>`,
    tip: '在上方垫子里拖动：左右改截止频率，上下改共振。',
  },
  build(S, A) {
    const st = { ux: 0.45, uy: 0.3, man: -1 };
    const L = (W, H) => { const fs = fsz(W, H), m = fs, top = fs * 3, padH = (H - top - fs * 2) * 0.55; return { fs, x0: m, y0: top, w: W - m * 2, ph: padH, sy: top + padH + fs * 1.6, sh: H - (top + padH + fs * 1.6) - fs * 1.8 }; };
    S.onMove((P) => { if (!P.down || P.ui) return; const l = L(S.W, S.H); if (P.y > l.y0 + l.ph + 10) return; st.ux = clamp((P.x - l.x0) / l.w, 0, 1); st.uy = clamp(1 - (P.y - l.y0) / l.ph, 0, 1); st.man = S.t + 5; });
    S.onDown((P) => { if (P.ui) return; const l = L(S.W, S.H); if (P.y > l.y0 + l.ph + 10) return; st.ux = clamp((P.x - l.x0) / l.w, 0, 1); st.uy = clamp(1 - (P.y - l.y0) / l.ph, 0, 1); st.man = S.t + 5; });
    return ({ ctx, W, H, t, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.1);
      const l = L(W, H), fs = l.fs, ty = clamp(Math.round(num(C.type, 0)), 0, 2), nc = clamp(Math.round(num(C.ncol, 1)), 0, 2), qmax = num(C.qmax, 10), N = clamp(Math.round(num(C.count, 96)), 16, 240);
      if (t > st.man && !P.down) { st.ux = 0.5 + 0.38 * Math.sin(t * 0.37); st.uy = 0.35 + 0.3 * Math.sin(t * 0.53 + 1); }
      const fc = 80 * Math.pow(100, st.ux), q = 0.5 + st.uy * (qmax - 0.5);
      A.noise({ type: FTW[ty], f: fc, q, col: nc, g: 0.5 });
      const hue = hueOf(C.color);
      // pad
      const pg = ctx.createLinearGradient(l.x0, 0, l.x0 + l.w, 0); pg.addColorStop(0, hsla(hue + 40, 60, 16)); pg.addColorStop(1, hsla(hue - 30, 60, 22)); ctx.fillStyle = pg; rrect(ctx, l.x0, l.y0, l.w, l.ph, 12); ctx.fill();
      if (on(C.grid)) { ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.lineWidth = 1; for (let i = 1; i < 8; i++) { const x = l.x0 + (i / 8) * l.w; ctx.beginPath(); ctx.moveTo(x, l.y0); ctx.lineTo(x, l.y0 + l.ph); ctx.stroke(); } for (let j = 1; j < 4; j++) { const y = l.y0 + (j / 4) * l.ph; ctx.beginPath(); ctx.moveTo(l.x0, y); ctx.lineTo(l.x0 + l.w, y); ctx.stroke(); } }
      text(ctx, '截止频率 →', l.x0 + l.w - fs * 0.4, l.y0 + l.ph - fs * 0.7, { size: fs * 0.8, col: '#94a3b8', align: 'right' }); text(ctx, '↑ 共振 Q', l.x0 + fs * 0.4, l.y0 + fs * 0.8, { size: fs * 0.8, col: '#94a3b8' });
      const px = l.x0 + st.ux * l.w, py = l.y0 + (1 - st.uy) * l.ph, pr = fs * 0.9 * num(C.size, 1);
      const gl = ctx.createRadialGradient(px, py, 0, px, py, pr * 3); gl.addColorStop(0, hsla(hue, 90, 75, 0.9)); gl.addColorStop(1, hsla(hue, 90, 60, 0)); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, pr * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, pr * 0.5, 0, TAU); ctx.fill();
      text(ctx, `${hz(fc)} · Q ${fmt(q, 1)}`, clamp(px, l.x0 + fs * 4, l.x0 + l.w - fs * 4), py < l.y0 + fs * 2.5 ? py + pr * 2.2 : py - pr * 2.2, { size: fs * 0.85, col: '#f8fafc', align: 'center', bold: true });
      // spectrum
      const fr = (u) => 40 * Math.pow(8000 / 40, u), tilt = (f) => [0, -10 * Math.log10(f / 1000), -20 * Math.log10(f / 1000)][nc];
      const Y = (d) => l.sy + l.sh - clamp((d + 60) / 80, 0, 1) * l.sh, cw = l.w / N, fr0 = Math.floor(t * 12);
      ctx.strokeStyle = 'rgba(148,163,184,.2)'; ctx.strokeRect(l.x0, l.sy, l.w, l.sh);
      for (let i = 0; i < N; i++) { const f = fr((i + 0.5) / N), j = hash(i * 7.1 + fr0 * 13.7) * 3 + hash(i * 3.3 + (fr0 + 1) * 5.1) * 2, d = tilt(f) + biq(ty, f, fc, q) + j - 12; const y = Y(d); ctx.fillStyle = hsla(hue + (i / N) * 50, 75, 55, 0.75); ctx.fillRect(l.x0 + i * cw + 0.5, y, Math.max(1, cw - 1), l.sy + l.sh - y); }
      ctx.beginPath(); for (let i = 0; i <= 160; i++) { const f = fr(i / 160), d = biq(ty, f, fc, q) - 12; const yy = Y(d); i ? ctx.lineTo(l.x0 + (i / 160) * l.w, yy) : ctx.moveTo(l.x0, yy); } ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.6; ctx.stroke();
      vline(ctx, l.x0 + (Math.log(fc / 40) / Math.log(200)) * l.w, l.sy, l.sy + l.sh, hsla(hue, 80, 70, 0.7));
      for (const f of [100, 300, 1000, 3000]) text(ctx, f >= 1000 ? `${f / 1000}k` : String(f), l.x0 + (Math.log(f / 40) / Math.log(200)) * l.w, l.sy + l.sh + fs * 0.8, { size: fs * 0.75, col: '#64748b', align: 'center' });
      const gc = biq(ty, fc, fc, q);
      let bw = '—'; { const pass = []; for (let i = 0; i <= 400; i++) { const f = fr(i / 400); if (biq(ty, f, fc, q) >= Math.max(gc, 0) - 3) pass.push(f); } if (pass.length) bw = `${hz(pass[0])} – ${hz(pass[pass.length - 1])}`; }
      let lv = '（移到下方频谱）', ix = `${Math.round(st.ux * 100)},${Math.round(st.uy * 100)}`;
      if (P.y >= l.sy && P.y <= l.sy + l.sh) { const u = clamp((P.x - l.x0) / l.w, 0, 1), f = fr(u), d = tilt(f) + biq(ty, f, fc, q) - 12; lv = `${hz(f)}：${db(d)}`; ix += `|s${Math.round(u * N)}`; tip(ctx, W, H, P.x, P.y, [hz(f), `滤波响应 ${db(biq(ty, f, fc, q))}`], C.color); }
      const feel = ty === 0 ? (fc < 400 ? '远处的闷风 / 雷声' : fc < 2000 ? '海浪、呼吸' : '雨声') : ty === 1 ? (q > 5 ? '口哨般的风声' : '吹过缝隙的风') : fc > 3000 ? '嘶嘶声、蒸汽' : '沙沙的雨';
      return { nc: NCN[nc], ft: FTN[ty], fc, q, qmax, gc, bw, lv, feel, ux: st.ux, uy: st.uy, hx: px, hy: py, ix };
    };
  },
};

/* ───────────────────────── drum ───────────────────────── */
const INST = [['底鼓 Kick', 'kick'], ['军鼓 Snare', 'snare'], ['拍手 Clap', 'clap'], ['踩镲 Hi-hat', 'hat']];
const PAT0 = ['x...x...x.x.x...', '....x.......x...', '............x..x', 'x.x.x.x.x.x.x.xx'];
FAM.drum = {
  cursor: 'pointer',
  spec: { color: { label: '鼓垫颜色', value: '#38bdf8' }, speed: SPD('播放速度倍率'), size: { label: '垫子圆角', min: 0, max: 0.5, step: 0.02, value: 0.2 }, count: { label: '步数', min: 8, max: 16, step: 4, value: 16, buttons: true }, extras: [R('bpm', 'BPM（每分钟拍数）', 60, 180, 1, 104), R('swing', '摇摆 swing', 0, 0.6, 0.02, 0), T('acc', '重音标记', true), T('wave', '底部波形', true)], remountKeys: [] },
  presets: { 默认: {}, 快: { bpm: 160 }, 慢: { bpm: 72 }, 八步: { count: 8 }, 摇摆: { swing: 0.45 }, 圆垫: { size: 0.5 } },
  doc: {
    title: '鼓机 · 16 步音序器',
    rows: (v) => [['BPM / 每步时长', `${v.bpm} / ${fmt(v.sms, 0)} ms`], ['当前步', `${v.step} / ${v.n}`, 'step'], ['悬停格子', v.cell, 'cell'], ['该格时刻（小节.拍.16分）', v.pos, 'pos'], ['该格开关', v.onv, 'onv'], ['本步触发', v.trig], ['摇摆 swing', `${fmt(v.sw * 100, 0)}%`]],
    formula: () => F('一拍时长 = 60 / BPM 秒；一步 = 1/4 拍（十六分音符）') + F('第 k 步的时刻 = k × 一步时长（奇数步再推迟 swing × 一步）') + F('鼓声音全部是合成的：底鼓 = 下滑的正弦，军鼓 = 噪声 + 190 Hz 音，踩镲 = 高频噪声'),
    explain: '<p><b>鼓机</b>把一小节分成 16 个小格（每格一个"十六分音符"），每一行是一种鼓，亮着的格子就会在播放头经过时敲一下。电子音乐、嘻哈的节奏几乎都是这样排出来的。</p><p>点击格子可以打开/关闭。BPM 决定快慢：BPM 120 时一拍 0.5 秒，一格 0.125 秒。<b>Swing</b>（摇摆）会把每个偶数后面的格子稍微推迟，节奏马上变得"晃"起来，爵士和 Lo-fi 常用。点右上角「声音」能听到。</p>',
    params: [['鼓垫颜色', '亮格子的颜色'], ['播放速度倍率', '在 BPM 基础上整体加速/减速'], ['垫子圆角', '格子的圆角大小'], ['步数', '一小节分成几步（8/12/16）'], ['BPM', '每分钟多少拍'], ['摇摆 swing', '奇数步推迟的比例'], ['重音标记', '每拍第一格加亮边'], ['底部波形', '显示当前鼓声波形']],
    example: (v) => `<ol><li>一拍 = 60 / ${v.bpm} = ${fmt(60 / v.bpm, 3)} s，一步 = ${fmt(v.sms, 0)} ms</li><li>悬停的是第 ${v.k + 1} 步 → 时刻 ${v.k} × ${fmt(v.sms, 0)}${v.k % 2 && v.sw ? ` + ${fmt(v.sw * 100, 0)}% × ${fmt(v.sms, 0)}` : ''} = ${fmt(v.tk, 0)} ms</li><li>${v.cell}：${v.onv}</li></ol>`,
    tip: '点格子开关鼓点；拖 BPM 和 swing 听节奏怎么变。',
  },
  build(S, A) {
    const st = { pat: PAT0.map((r) => r.split('').map((c) => c === 'x')), fl: [0, 0, 0, 0], last: -1, lt: 0 };
    const geo = (W, H, n) => { const fs = fsz(W, H), ml = Math.min(fs * 7.2, W * 0.24), mt = fs * 3, wv = H * 0.2; const gw = W - ml - fs, gh = H - mt - wv - fs * 1.6; return { fs, ml, mt, cw: gw / n, ch: gh / 4, gw, gh, wy: H - wv - fs * 0.6, wv }; };
    const cellAt = (P) => { const C = S.get(), n = clamp(Math.round(num(C.count, 16) / 4) * 4, 4, 16), g = geo(S.W, S.H, n); const i = Math.floor((P.x - g.ml) / g.cw), j = Math.floor((P.y - g.mt) / g.ch); return i >= 0 && i < n && j >= 0 && j < 4 ? [i, j] : null; };
    S.onDown((P) => { if (P.ui) return; const c = cellAt(P); if (c) st.pat[c[1]][c[0]] = !st.pat[c[1]][c[0]]; });
    return ({ ctx, W, H, t, dtw, C, P }) => {
      S.clear(); glow(ctx, W, H, C, 0.08);
      const n = clamp(Math.round(num(C.count, 16) / 4) * 4, 4, 16), bpm = num(C.bpm, 104), sw = num(C.swing, 0), sd = 60 / bpm / 4, g = geo(W, H, n), fs = g.fs, hue = hueOf(C.color);
      const pos = t / sd, k0 = Math.floor(pos), kk = ((k0 % n) + n) % n, frac = pos - k0;
      const swOff = (k) => (k % 2 ? sw * sd : 0);
      const stepNow = frac * sd >= swOff(kk) ? kk : (kk + n - 1) % n;
      // hits model (for waveform + sound)
      const hits = []; for (let b = k0 - 6; b <= k0; b++) { const kq = ((b % n) + n) % n; for (let r = 0; r < 4; r++) if (st.pat[r][kq]) hits.push({ k: INST[r][1], t0: b * sd + swOff(kq), a: r === 3 ? 0.7 : 1, r }); }
      playHits(A, hits, st.lt, t); A.voices([]); st.lt = t;
      if (stepNow !== st.last) { st.last = stepNow; for (let r = 0; r < 4; r++) if (st.pat[r][stepNow]) st.fl[r] = 1; }
      st.fl = st.fl.map((f) => f * Math.exp(-dtw * 7));
      for (let r = 0; r < 4; r++) { const y = g.mt + r * g.ch; text(ctx, INST[r][0], g.ml - fs * 0.6, y + g.ch / 2, { size: fs * 0.85, col: st.fl[r] > 0.3 ? '#f8fafc' : '#94a3b8', align: 'right', bold: st.fl[r] > 0.3 }); }
      const hc = cellAt(P);
      for (let r = 0; r < 4; r++) for (let i = 0; i < n; i++) {
        const x = g.ml + i * g.cw + 2, y = g.mt + r * g.ch + 2, w = g.cw - 4, h = g.ch - 4, onv = st.pat[r][i], cur = i === stepNow;
        ctx.fillStyle = onv ? hsla(hue + r * 22, 85, cur ? 70 : 52) : cur ? 'rgba(148,163,184,.28)' : i % 4 === 0 ? 'rgba(148,163,184,.16)' : 'rgba(148,163,184,.09)';
        rrect(ctx, x, y, w, h, Math.min(w, h) * num(C.size, 0.2)); ctx.fill();
        if (on(C.acc) && i % 4 === 0) { ctx.strokeStyle = 'rgba(226,232,240,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
        if (hc && hc[0] === i && hc[1] === r) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      const phx = g.ml + (stepNow + 0.5) * g.cw; ctx.fillStyle = hsla(hue, 90, 70); ctx.beginPath(); ctx.moveTo(phx - 5, g.mt - 9); ctx.lineTo(phx + 5, g.mt - 9); ctx.lineTo(phx, g.mt - 2); ctx.closePath(); ctx.fill();
      for (let i = 0; i < n; i += 4) text(ctx, String(i / 4 + 1), g.ml + (i + 0.5) * g.cw, g.mt - fs * 1.4, { size: fs * 0.75, col: '#64748b', align: 'center' });
      if (on(C.wave)) { const buf = render(1600, t, { hits }); ctx.strokeStyle = hsla(hue, 80, 65, 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const v = buf[Math.floor((i / 300) * 1599)], X = g.ml + (i / 300) * g.gw, Y = g.wy + g.wv / 2 - clamp(v, -1.2, 1.2) * g.wv * 0.42; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); text(ctx, '最近 0.1 s 的鼓声波形', g.ml - fs * 0.6, g.wy + g.wv / 2, { size: fs * 0.75, col: '#64748b', align: 'right' }); }
      const [ci, cr] = hc || [stepNow, 0];
      const tk = (ci * sd + swOff(ci)) * 1000;
      if (hc) tip(ctx, W, H, P.x, P.y, [`${INST[cr][0]} · 第 ${ci + 1} 步`, st.pat[cr][ci] ? '开（点击关闭）' : '关（点击打开）'], C.color);
      const trig = INST.filter((_, r) => st.pat[r][stepNow]).map((x) => x[0].split(' ')[0]).join(' + ') || '（空拍）';
      return { bpm, sms: sd * 1000, step: stepNow + 1, n, cell: hc ? `${INST[cr][0]} · 第 ${ci + 1} 步` : '（移到格子上）', pos: `1.${Math.floor(ci / 4) + 1}.${(ci % 4) + 1}`, onv: st.pat[cr][ci] ? '开' : '关', trig, sw, k: ci, tk, hx: g.ml + (ci + 0.5) * g.cw, hy: g.mt + (cr + 0.5) * g.ch, ix: hc ? `${ci},${cr}` : `s${stepNow}` };
    };
  },
};

/* ───────────────────────── mount ───────────────────────── */
const FAMILIES = Object.keys(FAM);

export function mount(host, opts = {}) {
  const raw = String(opts.variant || 'bars');
  const parsed = FAMILIES.includes(raw) ? raw : raw.replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'bars';
  const F0 = FAM[fam];
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-audio',
    title: fam,
    fallbackVariant: fam,
    params: paramsFromSpec(F0.spec),
    remountKeys: F0.spec.remountKeys || [],
    liveKeys: ['color', 'speed', 'size', 'count'],
    presets: F0.presets ? Object.keys(F0.presets) : undefined,
    // '默认' is a NAMED_COLOR (#818cf8) in _shared; pin each family's own default colour instead
    presetDefaults: F0.presets && { ...F0.presets, 默认: { color: F0.spec.color.value, ...(F0.presets['默认'] || {}) } },
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy: (box, o) => mountFamily(fam, box, o),
  });
}
export const mountSynth = (host, opts = {}) => mount(host, { ...opts, variant: 'synth' });
export const mountMic = (host, opts = {}) => mount(host, { ...opts, variant: 'mic' });

function mountFamily(fam, host, opts) {
  const F0 = FAM[fam];
  const S = createCanvasStage(host, opts, { doc: F0.doc, spec: F0.spec, bg: '#060a14', auto: true, cursor: F0.cursor || 'crosshair' });
  const Au = mkAudio();
  S.onDown((P) => { P.uiHit = inRect(P, spkRect(S.W, S.H, F0.label || '声音')); P.ui = false; if (P.uiHit && !F0.label) { P.ui = true; Au.toggle(); } });
  const step = F0.build(S, Au);
  S.onFrame(step);
  S.onFrame(({ ctx, W, H, C }) => { drawSpk(ctx, W, H, Au, C, F0.label ? `${F0.label} ${Au.mic ? '开' : '关'}` : null); return { snd: Au.on ? '开' : '关' }; });
  return () => { Au.close(); S.destroy(); };
}
