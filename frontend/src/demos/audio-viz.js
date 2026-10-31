import { makeCanvas, loop } from '../lib/canvas.js';

function overlay(host, html) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;z-index:4;background:rgba(6,10,20,.55);backdrop-filter:blur(3px);text-align:center;padding:20px';
  d.innerHTML = html; host.appendChild(d); return d;
}

export function mountSynth(host) {
  const { canvas, ctx, state, dispose } = makeCanvas(host);
  const bar = document.createElement('div'); bar.className = 'fx-bar';
  bar.innerHTML = `<select id="aw"><option value="sawtooth">锯齿波</option><option value="square">方波</option><option value="triangle">三角波</option><option value="sine">正弦波</option></select>
    <select id="am"><option value="bars">频谱柱</option><option value="wave">波形</option><option value="radial">环形</option></select>
    <label>音量 <input type="range" id="av" min="0" max="100" value="35"></label><button class="btn" id="ap">▶ 自动旋律</button>`;
  host.appendChild(bar);
  const keys = document.createElement('div');
  keys.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:4px;z-index:3;max-width:calc(100% - 24px)';
  const notes = [['C', 261.63], ['D', 293.66], ['E', 329.63], ['F', 349.23], ['G', 392], ['A', 440], ['B', 493.88], ['C5', 523.25]];
  keys.innerHTML = notes.map(([n, f]) => `<button class="btn" data-f="${f}" style="width:44px;height:64px;display:flex;align-items:flex-end;justify-content:center;background:rgba(232,238,252,.92);color:#0b1020;font-weight:700;touch-action:none">${n}</button>`).join('');
  host.appendChild(keys);
  const ov = overlay(host, '<div><div style="font-size:42px;margin-bottom:8px">♫</div><button class="btn" id="aStart" style="font-size:14px;padding:10px 20px">点击开启音频</button><p class="hint" style="margin-top:10px">浏览器要求用户交互后才能播放声音</p></div>');
  let ac = null, master, an, data, wave, seqTimer = 0, playing = false, step = 0;
  const init = () => {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = .35;
    an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = .82;
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2400; filt.Q.value = 6;
    const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = .3; lfoG.gain.value = 1600; lfo.connect(lfoG).connect(filt.frequency); lfo.start();
    master.connect(filt).connect(an).connect(ac.destination);
    data = new Uint8Array(an.frequencyBinCount); wave = new Uint8Array(an.fftSize);
    ov.remove();
  };
  const note = (f, dur = .4) => {
    if (!ac) init();
    const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = o2.type = bar.querySelector('#aw').value; o.frequency.value = f; o2.frequency.value = f * 1.005; o2.detune.value = -8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
  };
  ov.querySelector('#aStart').addEventListener('click', () => { init(); playing = true; bar.querySelector('#ap').classList.add('on'); });
  keys.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-f]'); if (b) note(+b.dataset.f, .8); });
  bar.querySelector('#av').addEventListener('input', (e) => { if (master) master.gain.value = e.target.value / 100; });
  bar.querySelector('#ap').addEventListener('click', (e) => { init(); playing = !playing; e.target.classList.toggle('on', playing); });
  const melody = [0, 2, 4, 7, 4, 2, 5, 7, 9, 7, 5, 4, 2, 4, 0, -3];
  const stop = loop((dt) => {
    const { w, h } = state;
    ctx.fillStyle = 'rgba(6,10,20,.35)'; ctx.fillRect(0, 0, w, h);
    if (!an) return;
    if (playing) { seqTimer -= dt; if (seqTimer <= 0) { seqTimer = .22; const s = melody[step++ % melody.length]; note(220 * Math.pow(2, s / 12), .35); if (step % 4 === 0) note(110 * Math.pow(2, melody[(step / 4 | 0) % 4] / 12), .8); } }
    const mode = bar.querySelector('#am').value;
    if (mode === 'wave') {
      an.getByteTimeDomainData(wave);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#22d3ee'; ctx.shadowBlur = 12; ctx.shadowColor = '#22d3ee'; ctx.beginPath();
      for (let i = 0; i < wave.length; i++) { const x = i / wave.length * w, y = (wave[i] / 255) * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    } else if (mode === 'bars') {
      an.getByteFrequencyData(data);
      const n = 96, bw = w / n;
      for (let i = 0; i < n; i++) { const v = data[Math.floor(Math.pow(i / n, 1.6) * data.length * .6)] / 255, bh = v * h * .8;
        const g = ctx.createLinearGradient(0, h, 0, h - bh); g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#22d3ee');
        ctx.fillStyle = g; ctx.fillRect(i * bw + 1, h - bh - 90, bw - 2, bh); ctx.fillStyle = 'rgba(99,102,241,.25)'; ctx.fillRect(i * bw + 1, h - 88, bw - 2, bh * .25); }
    } else {
      an.getByteFrequencyData(data);
      const cx = w / 2, cy = h / 2 - 30, R = Math.min(w, h) * .18, n = 128;
      for (let i = 0; i < n; i++) { const v = data[Math.floor(i / n * data.length * .5)] / 255, a = i / n * Math.PI * 2 - Math.PI / 2, l = R + v * R * 1.3;
        ctx.strokeStyle = `hsl(${220 + v * 120},90%,${50 + v * 20}%)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); }
    }
  });
  return () => { stop(); playing = false; ac && ac.close(); dispose(); host.innerHTML = ''; };
}

export function mountMic(host) {
  const { ctx, state, dispose } = makeCanvas(host);
  const ov = overlay(host, `<div><div style="font-size:42px;margin-bottom:8px">🎤</div><button class="btn" id="mStart" style="font-size:14px;padding:10px 20px">授权并开启麦克风</button><p class="hint" style="margin-top:10px">点击后浏览器会弹出麦克风权限请求；音频只在本地分析，不会上传。</p><p class="hint" id="mErr" style="color:#fca5a5"></p></div>`);
  let ac, an, stream, data, wave, rot = 0;
  ov.querySelector('#mStart').addEventListener('click', async () => {
    const err = ov.querySelector('#mErr');
    if (!navigator.mediaDevices?.getUserMedia) { err.textContent = '当前浏览器/环境不支持 getUserMedia（需要 HTTPS）'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      ac = new (window.AudioContext || window.webkitAudioContext)();
      an = ac.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .8;
      ac.createMediaStreamSource(stream).connect(an);
      data = new Uint8Array(an.frequencyBinCount); wave = new Uint8Array(an.fftSize);
      ov.remove();
    } catch (e) { err.textContent = '无法访问麦克风：' + (e.name === 'NotAllowedError' ? '权限被拒绝' : e.message); }
  });
  const stop = loop((dt) => {
    const { w, h } = state;
    ctx.fillStyle = 'rgba(6,10,20,.25)'; ctx.fillRect(0, 0, w, h);
    if (!an) return;
    an.getByteFrequencyData(data); an.getByteTimeDomainData(wave);
    let sum = 0; for (let i = 0; i < wave.length; i++) { const v = (wave[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / wave.length);
    rot += dt * (.2 + rms * 4);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * (.16 + rms * .25), n = 160;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    for (let i = 0; i < n; i++) { const v = data[Math.floor(i / n * data.length * .7)] / 255, a = i / n * Math.PI * 2, l = R + v * Math.min(w, h) * .3;
      ctx.strokeStyle = `hsla(${180 + i / n * 180},90%,60%,.9)`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = `rgba(129,140,248,${.15 + rms})`; ctx.beginPath(); ctx.arc(cx, cy, R * .85, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8eefc'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`音量 ${(rms * 100).toFixed(0)}`, cx, cy + 4);
  });
  return () => { stop(); stream && stream.getTracks().forEach((t) => t.stop()); ac && ac.close(); dispose(); host.innerHTML = ''; };
}
