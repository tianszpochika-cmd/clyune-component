import { makeCanvas, loop, bar, hsl, rand } from './_shared.js';
export function mount(host, opts = {}) {
  const id = opts.variant || 'spark-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-reshuffle>Shuffle</button>`);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  let data = Array.from({ length: 24 }, () => rand(20, 100));
  const reshuffle = () => { data = data.map(() => rand(20, 100)); };
  host.querySelector('[data-reshuffle]')?.addEventListener('click', reshuffle);
  const mouse = { x: -1 };
  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; });
  const stop = loop((dt, t) => {
    const { w, h } = state; ctx.clearRect(0,0,w,h);
    const pad = 28, cw = w - pad * 2, ch = h - pad * 2;
    ctx.strokeStyle = '#24314f'; ctx.strokeRect(pad, pad, cw, ch);
    if (id.startsWith('gauge')) {
      const v = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t));
      const cx = w/2, cy = h*0.62, R = Math.min(w,h)*0.32;
      ctx.beginPath(); ctx.arc(cx,cy,R,Math.PI,0); ctx.strokeStyle='#24314f'; ctx.lineWidth=14; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,R,Math.PI,Math.PI + Math.PI*v); ctx.strokeStyle=hsl(n); ctx.lineCap='round'; ctx.stroke();
      ctx.fillStyle=hsl(n); ctx.font='700 28px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText(Math.round(v*100)+'%', cx, cy-8);
      return;
    }
    const max = Math.max(...data, 1);
    if (id.startsWith('stack')) {
      const kinds = ['bar','area','hbar','pct']; const k = kinds[(n-1)%4];
      const series = [data, data.map(v => v*0.6), data.map(v => v*0.35)];
      const m = 3;
      if (k === 'hbar') {
        for (let i=0;i<8;i++){
          let x = pad; const y = pad + i*(ch/8)+4; const hh = ch/8-8;
          for (let s=0;s<m;s++){ const ww = (series[s][i]/max)*cw*0.45; ctx.fillStyle=hsl(n+s*40); ctx.fillRect(x,y,ww,hh); x+=ww; }
        }
      } else {
        for (let i=0;i<data.length;i++){
          const x = pad + (i+0.1)*(cw/data.length); const bw = cw/data.length*0.7;
          let y = pad + ch; let acc = 0;
          for (let s=0;s<m;s++){ const val = series[s][i]; const bh = (val/max)*ch*0.55; y -= bh; ctx.fillStyle=hsl(n+s*40); if(k==='area' && s===0){/*skip*/} ctx.fillRect(x,y,bw,bh); acc+=val; }
        }
      }
      return;
    }
    // sparkline default
    ctx.beginPath();
    data.forEach((v,i)=>{
      const x = pad + (i/(data.length-1))*cw;
      const y = pad + ch - (v/max)*ch;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.strokeStyle = hsl(n); ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(pad+cw, pad+ch); ctx.lineTo(pad, pad+ch); ctx.closePath();
    ctx.fillStyle = `color-mix(in srgb, ${hsl(n)} 22%, transparent)`; ctx.fill();
    if (mouse.x >= pad && mouse.x <= pad+cw) {
      const idx = Math.round(((mouse.x-pad)/cw)*(data.length-1));
      const x = pad + (idx/(data.length-1))*cw;
      const y = pad + ch - (data[idx]/max)*ch;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = varText(); ctx.font='12px sans-serif'; ctx.fillText(String(Math.round(data[idx])), x+8, y-8);
    }
  });
  function varText(){ return '#e8eefc'; }
  return () => { stop(); dispose(); host.innerHTML=''; };
}
