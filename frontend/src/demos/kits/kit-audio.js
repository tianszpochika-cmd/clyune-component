import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-audio',
    title: '音频视觉',
    fallbackVariant: 'viz-1',
    params: defaultParams({color:true,speed:true}),
    
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'viz-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-play>Play tone</button><button class="btn" data-stop>Stop</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  let ac, osc, gain, analyser, data, playing=false;
  const start = async () => {
    if (playing) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    osc = ac.createOscillator(); gain = ac.createGain(); analyser = ac.createAnalyser();
    analyser.fftSize = 256; data = new Uint8Array(analyser.frequencyBinCount);
    osc.type = ['sine','square','sawtooth','triangle'][(n-1)%4];
    osc.frequency.value = 180 + n * 20;
    gain.gain.value = 0.04;
    osc.connect(gain); gain.connect(analyser); analyser.connect(ac.destination);
    osc.start(); playing = true;
  };
  const stopAudio = () => { try { osc?.stop(); ac?.close(); } catch {} playing=false; };
  host.querySelector('[data-play]')?.addEventListener('click', start);
  host.querySelector('[data-stop]')?.addEventListener('click', stopAudio);
  const kind = (n-1)%11;
  const stop = loop((dt,t) => {
    const { w,h } = state; ctx.fillStyle='#060a14'; ctx.fillRect(0,0,w,h);
    if (analyser) analyser.getByteFrequencyData(data);
    else data = data || new Uint8Array(64).map((_,i)=> 40+30*Math.sin(t*4+i));
    const arr = data || new Uint8Array(64);
    const N = arr.length;
    if (kind===0 || kind===2) {
      const bw = w/N;
      for (let i=0;i<N;i++){ const v=arr[i]/255; ctx.fillStyle=hsl(n+i); ctx.fillRect(i*bw, h - v*h, bw-1, v*h); }
    } else if (kind===1 || kind===5) {
      ctx.beginPath();
      for (let i=0;i<N;i++){ const a=(i/N)*Math.PI*2; const r=40+ (arr[i]/255)*Math.min(w,h)*0.28; const x=w/2+Math.cos(a)*r; const y=h/2+Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.closePath(); ctx.strokeStyle=hsl(n); ctx.stroke();
    } else if (kind===3) {
      for (let i=0;i<40;i++){ const v=arr[i%N]/255; ctx.beginPath(); ctx.fillStyle=hsl(n+i*5); ctx.arc((i*37+t*30)%w, h*(0.3+0.4*v), 2+v*6, 0, Math.PI*2); ctx.fill(); }
    } else if (kind===4) {
      ctx.beginPath();
      for (let i=0;i<N;i++){ const x=(i/(N-1))*w; const y=h/2 + ((arr[i]-128)/128)*h*0.35; i?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.strokeStyle=hsl(n); ctx.stroke();
    } else if (kind===6) {
      for (let i=0;i<32;i++){ const v=arr[i]/255; ctx.fillStyle=`hsla(${(n*40+i*8)%360} 80% 60% / ${v})`; ctx.fillRect(0, i*(h/32), w*v, h/32-1); }
    } else if (kind===7) {
      const v = arr[4]/255; ctx.beginPath(); ctx.fillStyle=hsl(n); ctx.arc(w/2,h/2, 30+v*80,0,Math.PI*2); ctx.fill();
    } else {
      // pad / drum grid
      const cols=4, rows=2; 
      for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
        const i=r*cols+c; const v=arr[(i*7)%N]/255; 
        ctx.fillStyle=`hsla(${(n*40+i*30)%360} 70% 55% / ${0.35+v*0.65})`;
        const x=20+c*((w-40)/cols), y=20+r*((h-40)/rows), ww=(w-40)/cols-10, hh=(h-40)/rows-10;
        ctx.fillRect(x,y,ww,hh);
      }
    }
  });
  return () => { stopAudio(); stop(); dispose(); host.innerHTML=''; };
}
