import { addStyle, bar, hsl } from './_shared.js';
export function mount(host, opts = {}) {
  const id = opts.variant || 'input-1';
  const n = parseInt(id.split('-').pop(), 10) || 1;
  const { stage } = bar(host, id);
  const rm = addStyle(`
    .ku{position:absolute;inset:0;overflow:auto;padding:22px;color:var(--text)}
    .ku h3{margin:0 0 12px;font-size:14px;color:var(--muted)}
    .ku .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px}
    .ku input[type=text],.ku input[type=search]{background:#0d1426;border:1px solid #24314f;border-radius:10px;padding:10px 12px;color:var(--text);min-width:200px}
    .ku input:focus{outline:none;border-color:${hsl(n)};box-shadow:0 0 0 3px color-mix(in srgb,${hsl(n)} 25%,transparent)}
    .ku .sw{width:46px;height:26px;border-radius:999px;background:#24314f;position:relative;cursor:pointer;transition:.2s}
    .ku .sw.on{background:${hsl(n)}} .ku .sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
    .ku .sw.on i{left:23px}
    .ku .seg{display:flex;border:1px solid #24314f;border-radius:10px;overflow:hidden}
    .ku .seg button{background:transparent;border:0;color:var(--muted);padding:8px 14px;cursor:pointer}
    .ku .seg button.on{background:color-mix(in srgb,${hsl(n)} 25%,#121a2f);color:var(--text)}
    .ku .stars span{cursor:pointer;font-size:22px;opacity:.35} .ku .stars span.on{opacity:1;color:${hsl(n)}}
    .ku .step{display:flex;align-items:center;gap:0;border:1px solid #24314f;border-radius:10px;overflow:hidden}
    .ku .step button{width:34px;height:34px;border:0;background:#18233d;color:var(--text);cursor:pointer}
    .ku .step b{min-width:40px;text-align:center}
    .ku .tags{display:flex;flex-wrap:wrap;gap:6px}.ku .tag{background:#18233d;border:1px solid #24314f;border-radius:999px;padding:4px 10px;font-size:12px}
    .ku .prog{height:10px;background:#0d1426;border-radius:999px;overflow:hidden;width:min(360px,100%)}.ku .prog i{display:block;height:100%;width:40%;background:linear-gradient(90deg,${hsl(n)},#22d3ee)}
    .ku .toast{background:#18233d;border:1px solid ${hsl(n)};padding:10px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    .ku .nav{display:flex;gap:6px;flex-wrap:wrap}.ku .nav a{padding:8px 12px;border-radius:8px;color:var(--muted);text-decoration:none;border:1px solid transparent}
    .ku .nav a.on{color:var(--text);background:color-mix(in srgb,${hsl(n)} 18%,transparent);border-color:#24314f}
    .ku .pager button{min-width:34px;height:34px;border-radius:8px;border:1px solid #24314f;background:#121a2f;color:var(--text);cursor:pointer}
    .ku .pager button.on{background:${hsl(n)};color:#0b1020;border:none;font-weight:700}
    .ku .steps{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ku .steps .s{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#18233d;border:1px solid #24314f;font-size:12px}
    .ku .steps .s.on{background:${hsl(n)};color:#0b1020;border:none;font-weight:700}
    .ku .drawer{position:absolute;right:0;top:0;bottom:0;width:min(280px,80%);background:#121a2f;border-left:1px solid #24314f;padding:18px;transform:translateX(105%);transition:.25s}
    .ku .drawer.open{transform:none}
  `);
  const root = document.createElement('div'); root.className = 'ku'; stage.appendChild(root);
  const title = id;
  if (id.startsWith('input')) {
    const kinds = ['text','switch','range','seg','tags','stars','step','search','prog','toast'];
    const k = kinds[(n-1)%10];
    if (k==='text') root.innerHTML = `<h3>${title}</h3><div class="row"><input type="text" placeholder="输入点什么…"></div>`;
    else if (k==='switch') { root.innerHTML = `<h3>${title}</h3><div class="row"><div class="sw" data-sw><i></i></div><span>启用通知</span></div>`; root.querySelector('[data-sw]').onclick = (e)=>e.currentTarget.classList.toggle('on'); }
    else if (k==='range') root.innerHTML = `<h3>${title}</h3><div class="row"><input type="range" min="0" max="100" value="40" style="width:220px"><b data-v>40</b></div>`, root.querySelector('input').oninput = (e)=> root.querySelector('[data-v]').textContent = e.target.value;
    else if (k==='seg') { root.innerHTML = `<h3>${title}</h3><div class="seg">${['日','周','月'].map((t,i)=>`<button class="${i===0?'on':''}">${t}</button>`).join('')}</div>`; root.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{root.querySelectorAll('.seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');}); }
    else if (k==='tags') root.innerHTML = `<h3>${title}</h3><div class="tags">${['React','Rust','Vite','Axum'].map(t=>`<span class="tag">${t} ×</span>`).join('')}</div><div class="row" style="margin-top:10px"><input type="text" placeholder="添加标签后回车"><button class="btn">Add</button></div>`;
    else if (k==='stars') { root.innerHTML = `<h3>${title}</h3><div class="stars">${[1,2,3,4,5].map(i=>`<span data-i="${i}">★</span>`).join('')}</div>`; const paint=(v)=>root.querySelectorAll('.stars span').forEach(s=>s.classList.toggle('on', +s.dataset.i<=v)); root.querySelectorAll('.stars span').forEach(s=>s.onclick=()=>paint(+s.dataset.i)); paint(3); }
    else if (k==='step') { let v=1; root.innerHTML = `<h3>${title}</h3><div class="step"><button data-m>-</button><b data-v>1</b><button data-p>+</button></div>`; const el=root.querySelector('[data-v]'); root.querySelector('[data-m]').onclick=()=>{v=Math.max(0,v-1);el.textContent=v}; root.querySelector('[data-p]').onclick=()=>{v++;el.textContent=v}; }
    else if (k==='search') root.innerHTML = `<h3>${title}</h3><div class="row"><input type="search" placeholder="搜索 demos…"><button class="btn">Search</button></div>`;
    else if (k==='prog') { root.innerHTML = `<h3>${title}</h3><div class="prog"><i data-p></i></div><div class="row"><button class="btn" data-go>Animate</button></div>`; root.querySelector('[data-go]').onclick=()=>{const p=root.querySelector('[data-p]');p.style.transition='width 1s';p.style.width=(20+Math.random()*75)+'%';}; }
    else root.innerHTML = `<h3>${title}</h3><div class="toast">已保存设置 · Just now</div>`;
  } else {
    const kinds = ['side','tabs','crumb','pager','steps','pills','drawer','cmd'];
    const k = kinds[(n-1)%8];
    if (k==='tabs' || k==='side' || k==='pills') {
      root.innerHTML = `<h3>${title}</h3><div class="nav">${['Overview','Demos','Settings','Docs'].map((t,i)=>`<a href="#" class="${i===0?'on':''}">${t}</a>`).join('')}</div>`;
      root.querySelectorAll('.nav a').forEach(a=>a.onclick=(e)=>{e.preventDefault();root.querySelectorAll('.nav a').forEach(x=>x.classList.remove('on'));a.classList.add('on');});
    } else if (k==='crumb') root.innerHTML = `<h3>${title}</h3><div class="row" style="color:var(--muted)">Home / CSS / <b style="color:var(--text)">Filters</b></div>`;
    else if (k==='pager') { root.innerHTML = `<h3>${title}</h3><div class="pager row">${[1,2,3,4,5].map(i=>`<button class="${i===2?'on':''}">${i}</button>`).join('')}</div>`; root.querySelectorAll('.pager button').forEach(b=>b.onclick=()=>{root.querySelectorAll('.pager button').forEach(x=>x.classList.remove('on'));b.classList.add('on');}); }
    else if (k==='steps') root.innerHTML = `<h3>${title}</h3><div class="steps"><div class="s on">1</div>—<div class="s on">2</div>—<div class="s">3</div>—<div class="s">4</div></div>`;
    else if (k==='drawer') { root.innerHTML = `<h3>${title}</h3><button class="btn" data-open>打开抽屉</button><div class="drawer" data-d><h3>Drawer</h3><p style="color:var(--muted)">侧滑面板示例</p><button class="btn" data-close>关闭</button></div>`; const d=root.querySelector('[data-d]'); root.querySelector('[data-open]').onclick=()=>d.classList.add('open'); root.querySelector('[data-close]').onclick=()=>d.classList.remove('open'); }
    else root.innerHTML = `<h3>${title}</h3><div class="row"><input type="search" placeholder="> 输入命令" style="min-width:min(420px,100%)"></div><div class="tags"><span class="tag">go home</span><span class="tag">open demo</span><span class="tag">toggle theme</span></div>`;
  }
  return () => { rm(); host.innerHTML=''; };
}
