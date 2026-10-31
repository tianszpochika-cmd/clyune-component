import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant, readLiveControls, colorToRgb } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-dataviz',
    title: '数据图',
    fallbackVariant: 'viz-1',
    params: defaultParams({color:true,speed:true}),
    
    mountLegacy,
  });
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'viz-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id, `<button class="btn" data-gen>Regenerate</button>`);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const { canvas, ctx, state, dispose } = makeCanvas(stage);
  let cells = [];
  const regen = () => { cells = Array.from({length: 64}, () => rand(0,1)); };
  regen();
  host.querySelector('[data-gen]')?.addEventListener('click', regen);
  const kind = (n-1)%12;
  const stop = loop((dt,t) => {
    const L = live(); const tint=L.color; const tt=t*L.speed;
    const {w,h}=state; ctx.fillStyle='#060a14'; ctx.fillRect(0,0,w,h);
    if (kind===0) { // heat grid
      const cols=8, rows=8; const cw=w/cols, ch=h/rows;
      for (let i=0;i<64;i++){ const v=(cells[i]+0.5+0.5*Math.sin(tt+i))%1; ctx.fillStyle=`hsla(${240-v*200} 80% ${30+v*40}%)`; ctx.fillRect((i%cols)*cw,(i/cols|0)*ch,cw-1,ch-1); }
    } else if (kind===1) { // radar
      const cx=w/2,cy=h/2,R=Math.min(w,h)*0.35; const axes=6;
      ctx.strokeStyle='#24314f'; for(let r=1;r<=3;r++){ ctx.beginPath(); for(let i=0;i<=axes;i++){ const a=-Math.PI/2+i/axes*Math.PI*2; const x=cx+Math.cos(a)*R*r/3,y=cy+Math.sin(a)*R*r/3; i?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.closePath(); ctx.stroke(); }
      ctx.beginPath(); ctx.strokeStyle=tint; ctx.fillStyle=`color-mix(in srgb, ${tint} 25%, transparent)`;
      for(let i=0;i<=axes;i++){ const a=-Math.PI/2+i/axes*Math.PI*2; const v=0.4+0.5*((Math.sin(tt+i)+1)/2); const x=cx+Math.cos(a)*R*v,y=cy+Math.sin(a)*R*v; i?ctx.lineTo(x,y):ctx.moveTo(x,y);} ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (kind===3) { // bubbles
      for (let i=0;i<24;i++){ const x=(Math.sin(i*1.7+tt*0.2)*0.4+0.5)*w; const y=(Math.cos(i*1.3+tt*0.15)*0.4+0.5)*h; const r=8+cells[i%64]*30; ctx.beginPath(); ctx.fillStyle=tint; ctx.globalAlpha=.55; ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    } else if (kind===4) { // calendar heat
      const cols=14, rows=7; const cw=(w-20)/cols, ch=(h-20)/rows;
      for(let i=0;i<cols*rows;i++){ const v=cells[i%64]; ctx.fillStyle=`hsla(${140+v*80} 70% ${25+v*40}%)`; ctx.fillRect(10+(i%cols)*cw,10+((i/cols)|0)*ch,cw-2,ch-2); }
    } else if (kind===7) { // box-ish
      const groups=5; for(let i=0;i<groups;i++){ const x=40+i*((w-60)/groups); const mid=h*0.45+Math.sin(tt+i)*20; ctx.strokeStyle=hsl(n+i*20); ctx.strokeRect(x, mid-40, 28, 80); ctx.beginPath(); ctx.moveTo(x+14,mid-70); ctx.lineTo(x+14,mid+70); ctx.stroke(); }
    } else if (kind===10) { // word cloud simple
      const words=['Rust','React','Vite','Canvas','SVG','WebGL','GSAP','CSS','Three','Axum','Postgres','Demo'];
      words.forEach((word,i)=>{ ctx.font=`${12+cells[i]*22|0}px sans-serif`; ctx.fillStyle=hsl(n+i*25); ctx.fillText(word, 20+(i%4)*(w/4), 40+(i/4|0)*40 + Math.sin(tt+i)*6); });
    } else {
      // arcs / sankey-ish / default bars
      for (let i=0;i<12;i++){
        const v = 0.3+0.6*((Math.sin(tt*0.8+i)+1)/2);
        ctx.strokeStyle=tint; ctx.lineWidth=6; ctx.beginPath();
        ctx.arc(w/2,h/2, 30+i*10, -Math.PI/2, -Math.PI/2 + Math.PI*1.6*v); ctx.stroke();
      }
    }
  });
  return () => { stop(); dispose(); host.innerHTML=''; };
}
