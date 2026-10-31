import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';


const FAMILIES = ["heart", "check", "send", "copy", "download", "skeleton", "toast", "badge", "drag", "longpress", "shake", "slide-verify", "dblzoom", "hover-mag", "press-ripple", "toggle-spring"];
export function mount(host, opts = {}) {
  const parsed = String(opts.variant || 'heart').replace(/-\d+$/, '');
  const fam = FAMILIES.includes(parsed) ? parsed : 'heart';
  return withControls(host, { ...opts, variant: opts.variant || fam }, {
    kitKey: 'kit-micro',
    title: fam,
    fallbackVariant: fam,
    params: defaultParams({color:true,speed:true,size:true}),
    mapVariant: (family, n) => `${family}-${n}`,
    mountLegacy,
  });
}


function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'heart-1';
  const partsId = String(id).split('-');
  const last = partsId[partsId.length - 1];
  let family = /^\d+$/.test(last) ? partsId.slice(0, -1).join('-') : String(id);
  if (!FAMILIES.includes(family)) {
    for (let i = partsId.length - 1; i >= 1; i--) {
      const cand = partsId.slice(0, i).join('-');
      if (FAMILIES.includes(cand)) { family = cand; break; }
    }
  }
  if (!FAMILIES.includes(family)) {
    const num = parseInt(String(id).split('-').pop(), 10) || 1;
    family = FAMILIES[(num - 1) % FAMILIES.length];
  }
  const n = FAMILIES.indexOf(family) + 1;
  const { stage } = bar(host, id);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const rm = addStyle(`
    .km{position:absolute;inset:0;display:grid;place-items:center;padding:20px;overflow:auto}
    .km .btnx{border:0;border-radius:999px;padding:14px 22px;font-weight:700;cursor:pointer;background:var(--c);color:#0b1020;position:relative;overflow:hidden}
    .km .heart{font-size:48px;cursor:pointer;user-select:none;transition:transform .15s}
    .km .heart.on{color:#f472b6;transform:scale(1.2)}
    .km .check{width:36px;height:36px;border:2px solid #24314f;border-radius:8px;display:grid;place-items:center;cursor:pointer;transition:.2s}
    .km .check.on{background:var(--c);border-color:transparent;color:#0b1020;animation:pop calc(.35s / var(--spd, 1))}
    @keyframes pop{50%{transform:scale(1.2)}}
    .km .toast{position:absolute;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);opacity:0;background:#18233d;border:1px solid var(--c);padding:10px 16px;border-radius:10px;transition:.3s}
    .km .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .km .badge{position:relative}.km .badge em{position:absolute;top:-6px;right:-6px;background:#f43f5e;color:#fff;font-size:10px;border-radius:999px;padding:2px 6px;font-style:normal;animation:bounce calc(.6s / var(--spd, 1))}
    @keyframes bounce{50%{transform:translateY(-4px)}}
    .km .skel{width:min(360px,90%);display:grid;gap:10px}.km .skel i{display:block;height:14px;border-radius:8px;background:linear-gradient(90deg,#18233d,#24314f,#18233d);background-size:200% 100%;animation:sh calc(1.2s / var(--spd, 1)) linear infinite}
    @keyframes sh{to{background-position:-200% 0}}
    .km .prog{width:min(280px,80%);height:8px;background:#18233d;border-radius:999px;overflow:hidden}.km .prog b{display:block;height:100%;width:0;background:var(--c);transition:width .4s}
  `);
  const root = document.createElement('div'); root.className='km'; stage.appendChild(root);
  const kind=(n-1)%15;
  if (kind===0) {
    root.innerHTML=`<div class="heart" data-h>♡</div><div class="toast" data-t>Liked!</div>`;
    const h=root.querySelector('[data-h]'), t=root.querySelector('[data-t]');
    h.onclick=()=>{ h.textContent = h.classList.toggle('on') ? '♥' : '♡'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),900); };
  } else if (kind===1) {
    root.innerHTML=`<div class="check" data-c>✓</div>`; root.querySelector('[data-c]').onclick=e=>e.currentTarget.classList.toggle('on');
  } else if (kind===2) {
    root.innerHTML=`<button class="btnx" data-b>Send ✈</button>`; const b=root.querySelector('[data-b]');
    b.onclick=()=>{ b.textContent='Sent ✓'; setTimeout(()=>b.textContent='Send ✈',1000); };
  } else if (kind===3) {
    root.innerHTML=`<button class="btnx" data-b>Copy</button><div class="toast" data-t>Copied</div>`;
    const b=root.querySelector('[data-b]'), t=root.querySelector('[data-t]');
    b.onclick=async()=>{ try{await navigator.clipboard.writeText('clyune-component');}catch{} t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),800); };
  } else if (kind===4) {
    root.innerHTML=`<div class="prog"><b data-p></b></div><button class="btnx" style="margin-top:14px" data-b>Download</button>`;
    const p=root.querySelector('[data-p]'); root.querySelector('[data-b]').onclick=()=>{ p.style.width='0%'; requestAnimationFrame(()=>p.style.width='100%'); };
  } else if (kind===5) {
    root.innerHTML=`<div class="skel"><i></i><i style="width:80%"></i><i style="width:60%"></i><i style="height:64px"></i></div>`;
  } else if (kind===6) {
    root.innerHTML=`<button class="btnx" data-b>Show toast</button><div class="toast" data-t>Hello from micro kit</div>`;
    const t=root.querySelector('[data-t]'); root.querySelector('[data-b]').onclick=()=>{ t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
  } else if (kind===7) {
    root.innerHTML=`<div class="badge btnx">Inbox <em data-e>3</em></div>`;
    const e=root.querySelector('[data-e]'); setInterval(()=>{ e.textContent = String((+e.textContent%9)+1); }, 1200);
  } else if (kind===8) {
    root.innerHTML=`<div class="btnx" data-d style="width:160px;touch-action:none">Drag me</div>`;
    const el=root.querySelector('[data-d]'); let ox=0,oy=0,dx=0,dy=0,drag=false;
    el.onpointerdown=(ev)=>{ drag=true; el.setPointerCapture(ev.pointerId); ox=ev.clientX-dx; oy=ev.clientY-dy; };
    el.onpointermove=(ev)=>{ if(!drag)return; dx=ev.clientX-ox; dy=ev.clientY-oy; el.style.transform=`translate(${dx}px,${dy}px)`; };
    el.onpointerup=()=>drag=false;
  } else if (kind===9) {
    root.innerHTML=`<button class="btnx" data-b>长按确认</button><div class="toast" data-t>Confirmed</div>`;
    const b=root.querySelector('[data-b]'), t=root.querySelector('[data-t]'); let timer;
    const start=()=>{ timer=setTimeout(()=>{ t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),800); },650); };
    const end=()=>clearTimeout(timer);
    b.onpointerdown=start; b.onpointerup=end; b.onpointerleave=end;
  } else if (kind===10) {
    root.innerHTML=`<div style="color:var(--muted)">摇动 / 快速晃动指针试试</div><div class="toast" data-t>Shake detected</div>`;
    const t=root.querySelector('[data-t]'); let last=0, lx=0;
    stage.onpointermove=(e)=>{ const v=Math.abs(e.clientX-lx); lx=e.clientX; if(v>40 && performance.now()-last>500){ last=performance.now(); t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),700);} };
  } else if (kind===11) {
    root.innerHTML=`<div style="width:min(280px,80%);height:48px;border-radius:12px;background:#18233d;border:1px solid #24314f;position:relative;overflow:hidden">
      <div data-s style="position:absolute;inset:4px;width:42%;border-radius:8px;background:var(--c);display:grid;place-items:center;font-size:12px;font-weight:700;color:#0b1020;cursor:pointer;touch-action:none">Slide →</div></div>`;
    const s=root.querySelector('[data-s]'); let drag=false, startX=0, x=0;
    const max=()=> (s.parentElement.clientWidth - s.clientWidth - 8);
    s.onpointerdown=(e)=>{ drag=true; s.setPointerCapture(e.pointerId); startX=e.clientX-x; };
    s.onpointermove=(e)=>{ if(!drag)return; x=Math.max(0,Math.min(max(), e.clientX-startX)); s.style.transform=`translateX(${x}px)`; if(x>max()*0.9){ s.textContent='OK'; } };
    s.onpointerup=()=>{ drag=false; if(x<=max()*0.9){ x=0; s.style.transform='translateX(0)'; s.textContent='Slide →'; } };
  } else if (kind===12) {
    root.innerHTML=`<div class="btnx" data-b style="transition:transform .25s">双击放大</div>`;
    const b=root.querySelector('[data-b]'); let big=false;
    b.ondblclick=()=>{ big=!big; b.style.transform = big ? 'scale(1.35)' : 'scale(1)'; };
  } else if (kind===13) {
    root.innerHTML=`<button class="btnx" data-b>磁吸悬停</button>`;
    const b=root.querySelector('[data-b]');
    stage.onpointermove=(e)=>{
      const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=e.clientX-cx, dy=e.clientY-cy; const d=Math.hypot(dx,dy)||1;
      if(d<120) b.style.transform=`translate(${dx*0.25}px,${dy*0.25}px)`; else b.style.transform='';
    };
  } else {
    root.innerHTML=`<button class="btnx" data-b style="position:relative;overflow:hidden">按压波纹</button>`;
    const b=root.querySelector('[data-b]');
    b.onclick=(e)=>{
      const r=b.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
      const s=document.createElement('span');
      s.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:50%;background:#fff8;transform:translate(-50%,-50%) scale(0);animation:pop .55s ease-out forwards;pointer-events:none`;
      b.appendChild(s); setTimeout(()=>s.remove(),560);
    };
  }
  const sync = setInterval(() => { const L = live(); root.style.setProperty('--c', L.color); root.style.setProperty('--spd', String(L.speed)); stage.style.setProperty('--c', L.color); }, 80);
  return () => { clearInterval(sync); rm(); host.innerHTML=''; };
}
