import { addStyle, makeCanvas, loop, localPoint, bar, panel, hsl, rand, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';
import { FAMILY_PRESETS } from './presets.js';

const TITLES={input:'输入控件',nav:'导航样式',acc:'手风琴组件',mod:'对话框',car:'走马灯组件',toast:'Toast',drop:'下拉',tip:'提示',skel:'加载占位',btn:'按钮动效',switch:'开关弹簧',sheet:'底栏/浮层',tabs:'Tabs 动效',timeline:'时间线',tree:'树形',fab:'FAB',chip:'芯片/标签',table:'表格交互',avatar:'头像组',stepper:'步骤条动效',kanban:'看板',colorpick:'取色器',notify:'通知中心',command:'命令面板',pagination:'分页器',breadcrumb:'面包屑',rating:'评分星',empty:'空状态',banner:'顶栏横幅'};
export function mount(host, opts = {}) {
  return withControls(host, opts, {
    kitKey: 'kit-ui',
    title: TITLES[parseVariant(opts.variant||'input').family]||'UI',
    fallbackVariant: 'input',
    params: defaultParams({color:true,speed:true,size:false}),
    
    mountLegacy,
  });
}


function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'input-1';
  const n = parseInt(String(id).split('-').pop(), 10) || 1;
  const parts = id.split('-');
  const kind = parts.slice(0, -1).join('-') || parts[0];
  const { stage } = bar(host, id);
  const ctrl = opts._controls || {};
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);
  const c = ctrl.color || hsl(n);
  const rm = addStyle(`
    .ku{position:absolute;inset:0;overflow:auto;padding:22px;color:var(--text,#e8eefc);/* --c inherited */}
    .ku h3{margin:0 0 12px;font-size:14px;color:var(--muted,#93a0c0)}
    .ku .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px}
    .ku input[type=text],.ku input[type=search],.ku input[type=password]{background:#0d1426;border:1px solid #24314f;border-radius:10px;padding:10px 12px;color:var(--text);min-width:200px}
    .ku input:focus{outline:none;border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 25%,transparent)}
    .ku .sw{width:46px;height:26px;border-radius:999px;background:#24314f;position:relative;cursor:pointer;transition:.25s cubic-bezier(.34,1.56,.64,1)}
    .ku .sw.on{background:var(--c)} .ku .sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.25s cubic-bezier(.34,1.56,.64,1)}
    .ku .sw.on i{left:23px}
    .ku .seg{display:flex;border:1px solid #24314f;border-radius:10px;overflow:hidden;position:relative}
    .ku .seg button{background:transparent;border:0;color:var(--muted);padding:8px 14px;cursor:pointer;position:relative;z-index:1}
    .ku .seg button.on{color:var(--text)}
    .ku .seg .pill{position:absolute;inset:2px auto 2px 2px;width:0;background:color-mix(in srgb,var(--c) 30%,#121a2f);border-radius:8px;transition:left .25s,width .25s}
    .ku .stars span{cursor:pointer;font-size:22px;opacity:.35;transition:.15s} .ku .stars span.on{opacity:1;color:var(--c)}
    .ku .step{display:flex;align-items:center;gap:0;border:1px solid #24314f;border-radius:10px;overflow:hidden}
    .ku .step button{width:34px;height:34px;border:0;background:#18233d;color:var(--text);cursor:pointer}
    .ku .step b{min-width:40px;text-align:center}
    .ku .tags{display:flex;flex-wrap:wrap;gap:6px}.ku .tag{background:#18233d;border:1px solid #24314f;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer;transition:.2s}
    .ku .tag.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 20%,#18233d)}
    .ku .prog{height:10px;background:#0d1426;border-radius:999px;overflow:hidden;width:min(360px,100%)}.ku .prog i{display:block;height:100%;width:40%;background:linear-gradient(90deg,var(--c),#22d3ee);transition:width .6s}
    .ku .toast{background:#18233d;border:1px solid var(--c);padding:10px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);animation:pop .35s cubic-bezier(.34,1.56,.64,1)}
    .ku .toast-stack{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;gap:8px;z-index:5}
    @keyframes pop{from{opacity:0;transform:translateY(-8px) scale(.96)}to{opacity:1;transform:none}}
    .ku .nav{display:flex;gap:6px;flex-wrap:wrap}.ku .nav a{padding:8px 12px;border-radius:8px;color:var(--muted);text-decoration:none;border:1px solid transparent;transition:.2s}
    .ku .nav a.on{color:var(--text);background:color-mix(in srgb,var(--c) 18%,transparent);border-color:#24314f}
    .ku .pager button{min-width:34px;height:34px;border-radius:8px;border:1px solid #24314f;background:#121a2f;color:var(--text);cursor:pointer}
    .ku .pager button.on{background:var(--c);color:#0b1020;border:none;font-weight:700}
    .ku .steps{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ku .steps .s{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#18233d;border:1px solid #24314f;font-size:12px;transition:.25s}
    .ku .steps .s.on{background:var(--c);color:#0b1020;border:none;font-weight:700}
    .ku .drawer{position:absolute;right:0;top:0;bottom:0;width:min(280px,80%);background:#121a2f;border-left:1px solid #24314f;padding:18px;transform:translateX(105%);transition:.28s cubic-bezier(.2,.8,.2,1);z-index:6}
    .ku .drawer.open{transform:none}
    .ku .acc details{background:#18233d;border:1px solid #24314f;border-radius:12px;padding:4px 12px;margin-bottom:8px;transition:.2s}
    .ku .acc details[open]{border-color:var(--c)}
    .ku .acc summary{cursor:pointer;padding:10px 4px;font-weight:600;list-style:none}
    .ku .modal-b{position:absolute;inset:0;background:rgba(5,8,16,.6);display:grid;place-items:center;opacity:0;pointer-events:none;transition:.25s;z-index:8}
    .ku .modal-b.on{opacity:1;pointer-events:auto}
    .ku .modal-p{width:min(340px,90%);background:#18233d;border:1px solid #24314f;border-radius:16px;padding:18px;transform:translateY(12px) scale(.96);transition:.25s}
    .ku .modal-b.on .modal-p{transform:none}
    .ku .car{overflow:hidden;border-radius:14px;border:1px solid #24314f}
    .ku .car-t{display:flex;transition:transform .4s}
    .ku .car-t .sl{min-width:100%;height:140px;display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff}
    .ku .btn-m{position:relative;overflow:hidden;padding:10px 18px;border:0;border-radius:10px;background:var(--c);color:#0b1020;font-weight:700;cursor:pointer}
    .ku .btn-m .r{position:absolute;border-radius:50%;background:#fff8;transform:scale(0);animation:rip .55s ease-out forwards;pointer-events:none}
    @keyframes rip{to{transform:scale(14);opacity:0}}
    .ku .sheet{position:absolute;left:0;right:0;bottom:0;background:#121a2f;border-top:1px solid #24314f;border-radius:16px 16px 0 0;padding:12px 16px 24px;transform:translateY(110%);transition:.3s;z-index:7}
    .ku .sheet.open{transform:none}
    .ku .handle{width:42px;height:4px;border-radius:4px;background:#24314f;margin:0 auto 12px}
    .ku .tabs{display:flex;gap:4px;position:relative;border-bottom:1px solid #24314f;margin-bottom:12px}
    .ku .tabs button{background:0;border:0;color:var(--muted);padding:10px 14px;cursor:pointer}
    .ku .tabs button.on{color:var(--text)}
    .ku .tabs .ind{position:absolute;bottom:-1px;height:2px;background:var(--c);transition:left .25s,width .25s}
    .ku .tip{position:relative;display:inline-block}
    .ku .tip .bubble{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);background:#0d1426;border:1px solid #24314f;padding:6px 10px;border-radius:8px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:.2s}
    .ku .tip:hover .bubble{opacity:1;transform:translateX(-50%) translateY(0)}
    .ku .skel .b{height:12px;border-radius:8px;background:linear-gradient(90deg,#18233d 25%,#24314f 37%,#18233d 63%);background-size:400% 100%;animation:sh 1.3s ease infinite;margin-bottom:8px}
    .ku .skel .b.lg{height:80px}.ku .skel .av{width:40px;height:40px;border-radius:50%}
    @keyframes sh{to{background-position:-100% 0}}
    .ku .tree details{margin-left:12px}
    .ku .tree summary{cursor:pointer;padding:4px 0}
    .ku .fab{position:absolute;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:var(--c);color:#0b1020;border:0;font-size:28px;font-weight:700;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:4}
    .ku .fab-menu{position:absolute;right:20px;bottom:88px;display:flex;flex-direction:column;gap:8px;opacity:0;pointer-events:none;transform:translateY(10px);transition:.25s;z-index:4}
    .ku .fab-menu.on{opacity:1;pointer-events:auto;transform:none}
    .ku .fab-menu button{border:0;border-radius:999px;padding:8px 14px;background:#18233d;color:var(--text);cursor:pointer;border:1px solid #24314f}
    .ku .avatars{display:flex}
    .ku .avatars span{width:36px;height:36px;border-radius:50%;border:2px solid #0b1020;margin-left:-10px;background:var(--c);display:grid;place-items:center;font-size:12px;font-weight:700;color:#0b1020}
    .ku .avatars span:first-child{margin-left:0}
    .ku table{width:100%;border-collapse:collapse;font-size:13px}
    .ku th,.ku td{padding:8px 10px;border-bottom:1px solid #24314f;text-align:left}
    .ku th{cursor:pointer;color:var(--muted)}
    .ku tr{transition:background .2s}
    .ku tr:hover{background:#18233d}
    .ku .otp{display:flex;gap:8px}.ku .otp input{width:40px;height:44px;text-align:center;font-size:18px;font-weight:700}
    .ku .drop{position:relative;display:inline-block}
    .ku .drop .menu{position:absolute;top:calc(100% + 6px);left:0;min-width:160px;background:#121a2f;border:1px solid #24314f;border-radius:10px;padding:6px;display:none;z-index:5;box-shadow:0 12px 40px rgba(0,0,0,.4)}
    .ku .drop.open .menu{display:block;animation:pop .2s}
    .ku .drop .menu button{display:block;width:100%;text-align:left;background:0;border:0;color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer}
    .ku .drop .menu button:hover{background:#18233d}
    .ku .tl{border-left:2px solid #24314f;margin-left:12px;padding-left:16px}
    .ku .tl .e{position:relative;padding-bottom:16px}
    .ku .tl .e::before{content:'';position:absolute;left:-21px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--c)}
  `);
  const root = document.createElement('div');
  root.className = 'ku'; root.style.setProperty('--c', c);
  stage.appendChild(root);
  const title = id;

  const wireSeg = (rootEl) => {
    const seg = rootEl.querySelector('.seg');
    if (!seg) return;
    const pill = document.createElement('div'); pill.className = 'pill'; seg.prepend(pill);
    const place = (btn) => {
      const r = seg.getBoundingClientRect(); const b = btn.getBoundingClientRect();
      pill.style.left = `${b.left - r.left}px`; pill.style.width = `${b.width}px`;
    };
    const buttons = [...seg.querySelectorAll('button')];
    buttons.forEach((b) => b.onclick = () => { buttons.forEach((x) => x.classList.remove('on')); b.classList.add('on'); place(b); });
    setTimeout(() => place(seg.querySelector('button.on') || buttons[0]), 30);
  };

  if (kind === 'input') {
    const kinds = ['text','switch','range','seg','tags','stars','step','search','prog','toast','pass','otp'];
    const k = kinds[(n-1)%kinds.length];
    if (k==='text') root.innerHTML = `<h3>${title}</h3><div class="row"><input type="text" placeholder="输入点什么…"></div>`;
    else if (k==='switch') { root.innerHTML = `<h3>${title}</h3><div class="row"><div class="sw" data-sw><i></i></div><span>启用通知</span></div>`; root.querySelector('[data-sw]').onclick = (e)=>e.currentTarget.classList.toggle('on'); }
    else if (k==='range') { root.innerHTML = `<h3>${title}</h3><div class="row"><input type="range" min="0" max="100" value="40" style="width:220px"><b data-v>40</b></div>`; root.querySelector('input').oninput = (e)=> root.querySelector('[data-v]').textContent = e.target.value; }
    else if (k==='seg') { root.innerHTML = `<h3>${title}</h3><div class="seg">${['日','周','月'].map((t,i)=>`<button class="${i===0?'on':''}">${t}</button>`).join('')}</div>`; wireSeg(root); }
    else if (k==='tags') root.innerHTML = `<h3>${title}</h3><div class="tags">${['React','Rust','Vite','Axum'].map(t=>`<span class="tag">${t} ×</span>`).join('')}</div>`;
    else if (k==='stars') { root.innerHTML = `<h3>${title}</h3><div class="stars">${[1,2,3,4,5].map(i=>`<span data-i="${i}">★</span>`).join('')}</div>`; const paint=(v)=>root.querySelectorAll('.stars span').forEach(s=>s.classList.toggle('on', +s.dataset.i<=v)); root.querySelectorAll('.stars span').forEach(s=>s.onclick=()=>paint(+s.dataset.i)); paint(3); }
    else if (k==='step') { let v=1; root.innerHTML = `<h3>${title}</h3><div class="step"><button data-m>-</button><b data-v>1</b><button data-p>+</button></div>`; const el=root.querySelector('[data-v]'); root.querySelector('[data-m]').onclick=()=>{v=Math.max(0,v-1);el.textContent=v}; root.querySelector('[data-p]').onclick=()=>{v++;el.textContent=v}; }
    else if (k==='search') root.innerHTML = `<h3>${title}</h3><div class="row"><input type="search" placeholder="搜索 demos…"><button class="btn">Search</button></div>`;
    else if (k==='prog') { root.innerHTML = `<h3>${title}</h3><div class="prog"><i data-p></i></div><div class="row"><button class="btn" data-go>Animate</button></div>`; root.querySelector('[data-go]').onclick=()=>{const p=root.querySelector('[data-p]');p.style.width=(20+Math.random()*75)+'%';}; }
    else if (k==='pass') { root.innerHTML = `<h3>${title}</h3><div class="row"><input type="password" data-pw placeholder="密码"><button class="btn" data-tog>显示</button></div>`; root.querySelector('[data-tog]').onclick=()=>{const i=root.querySelector('[data-pw]');i.type=i.type==='password'?'text':'password';}; }
    else if (k==='otp') { root.innerHTML = `<h3>${title}</h3><div class="otp">${[0,1,2,3,4,5].map(()=>`<input maxlength="1">`).join('')}</div>`; const inputs=[...root.querySelectorAll('.otp input')]; inputs.forEach((inp,i)=>{inp.oninput=()=>{if(inp.value&&i<inputs.length-1)inputs[i+1].focus();};}); }
    else root.innerHTML = `<h3>${title}</h3><div class="toast">已保存设置 · Just now</div>`;
  } else if (kind === 'nav') {
    const kinds = ['side','tabs','crumb','pager','steps','pills','drawer','cmd','bottom','anchor'];
    const k = kinds[(n-1)%kinds.length];
    if (k==='tabs' || k==='side' || k==='pills' || k==='bottom' || k==='anchor') {
      root.innerHTML = `<h3>${title}</h3><div class="nav">${['Overview','Demos','Settings','Docs'].map((t,i)=>`<a href="#" class="${i===0?'on':''}">${t}</a>`).join('')}</div>`;
      root.querySelectorAll('.nav a').forEach(a=>a.onclick=(e)=>{e.preventDefault();root.querySelectorAll('.nav a').forEach(x=>x.classList.remove('on'));a.classList.add('on');});
    } else if (k==='crumb') root.innerHTML = `<h3>${title}</h3><div class="row" style="color:var(--muted)">Home / CSS / <b style="color:var(--text)">Filters</b></div>`;
    else if (k==='pager') { root.innerHTML = `<h3>${title}</h3><div class="pager row">${[1,2,3,4,5].map(i=>`<button class="${i===2?'on':''}">${i}</button>`).join('')}</div>`; root.querySelectorAll('.pager button').forEach(b=>b.onclick=()=>{root.querySelectorAll('.pager button').forEach(x=>x.classList.remove('on'));b.classList.add('on');}); }
    else if (k==='steps') root.innerHTML = `<h3>${title}</h3><div class="steps"><div class="s on">1</div>—<div class="s on">2</div>—<div class="s">3</div>—<div class="s">4</div></div>`;
    else if (k==='drawer') { root.innerHTML = `<h3>${title}</h3><button class="btn" data-open>打开抽屉</button><div class="drawer" data-d><h3>Drawer</h3><p style="color:var(--muted)">侧滑面板示例</p><button class="btn" data-close>关闭</button></div>`; const d=root.querySelector('[data-d]'); root.querySelector('[data-open]').onclick=()=>d.classList.add('open'); root.querySelector('[data-close]').onclick=()=>d.classList.remove('open'); }
    else root.innerHTML = `<h3>${title}</h3><div class="row"><input type="search" placeholder="> 输入命令" style="min-width:min(420px,100%)"></div><div class="tags"><span class="tag">go home</span><span class="tag">open demo</span><span class="tag">toggle theme</span></div>`;
  } else if (kind === 'acc') {
    const mode = (n-1)%6;
    const items = mode===5
      ? ['如何开始？','支持哪些平台？','如何取消订阅？','数据存在哪里？']
      : ['什么是 Reality？','如何刷新订阅？','绿云换 IP 收费吗？'];
    const multi = mode===1 || mode===5;
    const card = mode===4 || mode===2;
    root.innerHTML = `<h3>${title}</h3><div class="acc" style="${card?'display:grid;gap:10px':''}">${items.map((t,i)=>`<details ${(!multi && i===0) || (multi && i<2)?'open':''} style="${card?'background:#121a2f;border:1px solid #24314f;border-radius:14px;padding:8px 12px':''}"><summary>${mode===3?'✦ ':''}${t}</summary><p style="color:var(--muted);font-size:13px;padding:0 4px 10px">${mode===2?'嵌套示例 · ':''}Accordion body ${i+1}${mode===4?' · 卡片风格':''}。</p>${mode===2 && i===0?'<details style="margin:6px 0 8px 12px"><summary>子项 A</summary><p style="color:var(--muted);font-size:12px;padding:0 4px 8px">Nested panel</p></details>':''}</details>`).join('')}</div>`;
  } else if (kind === 'mod') {
    root.innerHTML = `<h3>${title}</h3><button class="btn" data-open>打开对话框</button>
      <div class="modal-b" data-m><div class="modal-p"><h3 style="margin:0 0 8px">${['确认','表单','全屏','抽屉式','焦点','堆叠'][(n-1)%6]}</h3>
      <p style="color:var(--muted);font-size:13px">Modal enter/exit demo.</p>
      ${n===2?'<div class="row"><input type="text" placeholder="名称"></div>':''}
      <div class="row"><button class="btn" data-close>关闭</button><button class="btn-m">确认</button></div></div></div>`;
    const m = root.querySelector('[data-m]');
    root.querySelector('[data-open]').onclick = () => m.classList.add('on');
    root.querySelector('[data-close]').onclick = () => m.classList.remove('on');
    m.onclick = (e) => { if (e.target === m) m.classList.remove('on'); };
  } else if (kind === 'car') {
    root.innerHTML = `<h3>${title}</h3><div class="car"><div class="car-t" data-t>${[1,2,3,4].map(i=>`<div class="sl" style="background:${hsl(n+i)}">${i}</div>`).join('')}</div></div>
      <div class="row"><button class="btn" data-p>‹</button><span data-d>••••</span><button class="btn" data-n>›</button></div>`;
    let idx = 0; const t = root.querySelector('[data-t]');
    const go = (d) => { idx = (idx + d + 4) % 4; t.style.transform = `translateX(-${idx*100}%)`; root.querySelector('[data-d]').textContent = '••••'.split('').map((x,i)=>i===idx?'●':'•').join(''); };
    root.querySelector('[data-p]').onclick = () => go(-1);
    root.querySelector('[data-n]').onclick = () => go(1);
  } else if (kind === 'toast') {
    const kinds = ['成功 ✓','错误 ✕','信息 i','上传中…','已撤销','多条堆叠'];
    const label = kinds[(n-1)%kinds.length];
    root.innerHTML = `<h3>${title}</h3><div class="row"><button class="btn" data-go>弹出 Toast</button><span style="color:var(--muted);font-size:12px">预设：${label}</span></div><div class="toast-stack" data-s><div class="toast">${label}</div></div>`;
    root.querySelector('[data-go]').onclick = () => {
      const s = root.querySelector('[data-s]');
      const el = document.createElement('div'); el.className = 'toast'; el.textContent = label;
      s.appendChild(el); setTimeout(() => el.remove(), 2400);
    };
  } else if (kind === 'drop') {
    const menus = [
      ['新建','打开','导出','删除'],
      ['复制','粘贴','剪切'],
      ['分享到…','生成链接','嵌入代码'],
      ['按名称','按时间','按大小'],
      ['账户','账单','退出'],
      ['浅色','深色','跟随系统'],
    ];
    const items = menus[(n-1)%menus.length];
    root.innerHTML = `<h3>${title}</h3><div class="drop open" data-d><button class="btn" data-t>菜单 ▾</button><div class="menu">${items.map(x=>`<button>${x}</button>`).join('')}</div></div>`;
    const d = root.querySelector('[data-d]');
    root.querySelector('[data-t]').onclick = () => d.classList.toggle('open');
  } else if (kind === 'tip') {
    const places = ['上','下','左','右','富文本','延迟'];
    root.innerHTML = `<h3>${title}</h3><div class="row"><div class="tip"><button class="btn">悬停我</button><div class="bubble">Tooltip · ${places[(n-1)%6]}</div></div></div>`;
  } else if (kind === 'skel') {
    root.innerHTML = `<h3>${title}</h3><div class="skel">${n%2?`<div class="b lg"></div><div class="b"></div><div class="b" style="width:50%"></div>`:`<div class="row"><div class="b av"></div><div style="flex:1"><div class="b"></div><div class="b" style="width:40%"></div></div></div><div class="b"></div><div class="b"></div>`}</div>`;
  } else if (kind === 'btn') {
    root.innerHTML = `<h3>${title}</h3><div class="row"><button class="btn-m" data-b>${['涟漪','加载中','成功','磁性','抖动','渐变边','图标→','按压'][(n-1)%8]}</button></div>`;
    const b = root.querySelector('[data-b]');
    b.onclick = (e) => {
      if (n === 1 || n === 6) {
        const r = b.getBoundingClientRect(); const s = document.createElement('span'); s.className = 'r';
        const size = Math.max(r.width, r.height);
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size/2) + 'px'; s.style.top = (e.clientY - r.top - size/2) + 'px';
        b.appendChild(s); setTimeout(() => s.remove(), 550);
      }
      if (n === 2) { b.textContent = '…'; setTimeout(() => b.textContent = '完成', 800); }
      if (n === 3) { b.textContent = '✓ 成功'; }
      if (n === 5) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = 'pop .35s'; }
    };
  } else if (kind === 'switch') {
    const labels = ['通知','深色模式','自动播放','省流','同步','开发者模式'];
    const on = n%2===0;
    root.innerHTML = `<h3>${title}</h3><div class="row"><div class="sw ${on?'on':''}" data-sw><i></i></div><span>${labels[(n-1)%labels.length]}</span></div>`;
    root.querySelector('[data-sw]').onclick = (e) => e.currentTarget.classList.toggle('on');
  } else if (kind === 'sheet') {
    root.innerHTML = `<h3>${title}</h3><button class="btn" data-o>打开底栏</button><div class="sheet" data-s><div class="handle"></div><h3 style="margin:0 0 8px">Bottom sheet</h3><p style="color:var(--muted);font-size:13px">拖拽句柄语义 / 关闭按钮</p><button class="btn" data-c>关闭</button></div>`;
    const s = root.querySelector('[data-s]');
    root.querySelector('[data-o]').onclick = () => s.classList.add('open');
    root.querySelector('[data-c]').onclick = () => s.classList.remove('open');
  } else if (kind === 'tabs') {
    root.innerHTML = `<h3>${title}</h3><div class="tabs" data-tabs>${['一','二','三','四'].map((t,i)=>`<button class="${i===0?'on':''}">${t}</button>`).join('')}<div class="ind"></div></div><div data-p style="color:var(--muted)">面板内容 A</div>`;
    const tabs = root.querySelector('[data-tabs]');
    const ind = tabs.querySelector('.ind');
    const place = (btn) => { const r = tabs.getBoundingClientRect(); const b = btn.getBoundingClientRect(); ind.style.left = (b.left-r.left)+'px'; ind.style.width = b.width+'px'; };
    tabs.querySelectorAll('button').forEach((b,i) => b.onclick = () => {
      tabs.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); place(b);
      root.querySelector('[data-p]').textContent = '面板内容 ' + 'ABCD'[i];
    });
    setTimeout(() => place(tabs.querySelector('button.on')), 30);
  } else if (kind === 'timeline') {
    root.innerHTML = `<h3>${title}</h3><div class="tl">${['下单','出库','运输中','派送','签收'].map((t,i)=>`<div class="e"><b>${t}</b><div style="color:var(--muted);font-size:12px">Step ${i+1}</div></div>`).join('')}</div>`;
  } else if (kind === 'tree') {
    root.innerHTML = `<h3>${title}</h3><div class="tree"><details open><summary>src</summary><details open><summary>demos</summary><div style="margin-left:16px;color:var(--muted)">kit-css.js</div><div style="margin-left:16px;color:var(--muted)">kit-ui.js</div></details><details><summary>components</summary><div style="margin-left:16px;color:var(--muted)">DemoHost.tsx</div></details></details></div>`;
  } else if (kind === 'fab') {
    const menus = [
      ['编辑','分享','上传'],
      ['拍照','相册'],
      ['新建文档','新建表格','新建幻灯'],
      ['点赞','收藏','转发','举报'],
      ['语音','视频','屏幕共享'],
      ['仅主按钮'],
    ];
    const items = menus[(n-1)%menus.length];
    const single = items.length===1 && items[0]==='仅主按钮';
    root.innerHTML = `<h3>${title}</h3><p style="color:var(--muted)">右下角 FAB · ${['单按钮展开','双项','三项文档','社交','通话','仅主按钮'][(n-1)%6]}</p>${single?'':`<div class="fab-menu on" data-m>${items.map(x=>`<button type="button">${x}</button>`).join('')}</div>`}<button class="fab" data-f type="button">${single?'★':'+'}</button>`;
    const menu = root.querySelector('[data-m]');
    root.querySelector('[data-f]').onclick = () => menu?.classList.toggle('on');
  } else if (kind === 'chip') {
    root.innerHTML = `<h3>${title}</h3><div class="tags">${['全部','CSS','Canvas','SVG','UI'].map((t,i)=>`<span class="tag ${i===0?'on':''}">${t}</span>`).join('')}</div>`;
    root.querySelectorAll('.tag').forEach(t => t.onclick = () => { root.querySelectorAll('.tag').forEach(x=>x.classList.remove('on')); t.classList.add('on'); });
  } else if (kind === 'table') {
    const rows = [['cube','Three','basics'],['pulse-1','CSS','pulse'],['network','Canvas','particles'],['draw','SVG','stroke']];
    root.innerHTML = `<h3>${title}</h3><table><thead><tr><th data-k="0">Slug</th><th data-k="1">Cat</th><th data-k="2">Tag</th></tr></thead><tbody data-b>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
    let asc = true;
    root.querySelectorAll('th').forEach(th => th.onclick = () => {
      const k = +th.dataset.k; asc = !asc;
      rows.sort((a,b) => asc ? a[k].localeCompare(b[k]) : b[k].localeCompare(a[k]));
      root.querySelector('[data-b]').innerHTML = rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
    });
  } else if (kind === 'avatar') {
    root.innerHTML = `<h3>${title}</h3><div class="avatars">${['A','B','C','D','+3'].map((t,i)=>`<span style="background:${hsl(n+i)}">${t}</span>`).join('')}</div>`;
  } else if (kind === 'stepper') {
    root.innerHTML = `<h3>${title}</h3><div class="steps" data-s>${[1,2,3,4].map(i=>`<div class="s ${i<=1?'on':''}">${i}</div>${i<4?'—':''}`).join('')}</div><div class="row"><button class="btn" data-n>下一步</button></div>`;
    let step = 1;
    root.querySelector('[data-n]').onclick = () => {
      step = Math.min(4, step + 1);
      root.querySelectorAll('.steps .s').forEach((s,i) => s.classList.toggle('on', i < step));
    };
  } else if (kind === 'kanban') {
    const cols = ['待办','进行中','评审','完成'];
    root.innerHTML = `<h3>${title}</h3><div class="row" style="align-items:stretch;overflow:auto">${cols.map((c,i)=>`<div style="min-width:140px;flex:1;background:#121a2f;border:1px solid #24314f;border-radius:12px;padding:10px"><b style="font-size:12px;color:var(--muted)">${c}</b>${[0,1,2].slice(0,3-i||1).map(j=>`<div class="tag on" style="display:block;margin-top:8px;cursor:grab">卡片 ${i+1}-${j+1}</div>`).join('')}</div>`).join('')}</div>`;
  } else if (kind === 'colorpick') {
    root.innerHTML = `<h3>${title}</h3><div class="row"><input type="color" data-cp value="${c}"/><code data-hex>${c}</code></div><div class="row">${['#818cf8','#22d3ee','#f472b6','#34d399','#fbbf24','#fb923c'].map(h=>`<button class="btn" data-sw="${h}" style="background:${h};border:0;width:28px;height:28px;border-radius:8px"></button>`).join('')}</div><div data-prev style="margin-top:12px;height:80px;border-radius:12px;border:1px solid #24314f;background:${c}"></div>`;
    const syncPrev = (v) => { root.querySelector('[data-hex]').textContent = v; root.querySelector('[data-prev]').style.background = v; root.style.setProperty('--c', v); };
    root.querySelector('[data-cp]').oninput = (e) => syncPrev(e.target.value);
    root.querySelectorAll('[data-sw]').forEach((b) => b.onclick = () => { root.querySelector('[data-cp]').value = b.dataset.sw; syncPrev(b.dataset.sw); });
  } else if (kind === 'notify') {
    root.innerHTML = `<h3>${title}</h3><div class="row"><button class="btn" data-push>推送通知</button><button class="btn" data-clear>清空</button></div><div class="toast-stack" data-stack></div>`;
    const stack = root.querySelector('[data-stack]');
    const types = ['信息','成功','警告','错误'];
    root.querySelector('[data-push]').onclick = () => {
      const t = document.createElement('div'); t.className = 'toast';
      t.textContent = types[Math.floor(Math.random()*types.length)] + ' · ' + new Date().toLocaleTimeString();
      stack.prepend(t); setTimeout(() => t.remove(), 3200);
    };
    root.querySelector('[data-clear]').onclick = () => { stack.innerHTML = ''; };
  } else if (kind === 'command') {
    root.innerHTML = `<h3>${title}</h3><div style="width:min(420px,95%);background:#121a2f;border:1px solid #24314f;border-radius:14px;overflow:hidden">
      <input type="search" placeholder="搜索命令…" style="width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #24314f;border-radius:0;padding:12px 14px" data-q/>
      <div data-list>${['打开文件','切换主题','导出 JSON','新建演示','复制链接','设置'].map((x,i)=>`<div class="tag" style="display:block;margin:0;border-radius:0;border:0;border-bottom:1px solid #1a2440;padding:10px 14px">${x}<span style="float:right;opacity:.45;font-size:11px">⌘${i+1}</span></div>`).join('')}</div></div>`;
    const list = root.querySelector('[data-list]');
    root.querySelector('[data-q]').oninput = (e) => {
      const q = e.target.value.trim();
      [...list.children].forEach((el) => { el.style.display = !q || el.textContent.includes(q) ? '' : 'none'; });
    };
  } else if (kind === 'pagination') {
    root.innerHTML = `<h3>${title}</h3><div class="row" data-pg>${[1,2,3,'…',8,9].map((x)=>`<button class="btn ${x===1?'on':''}" data-p="${x}" style="${x===1?'border-color:var(--c)':''}">${x}</button>`).join('')}</div>`;
    root.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
      if (b.dataset.p === '…') return;
      root.querySelectorAll('[data-p]').forEach((x) => { x.classList.remove('on'); x.style.borderColor=''; });
      b.classList.add('on'); b.style.borderColor='var(--c)';
    });
  } else if (kind === 'breadcrumb') {
    root.innerHTML = `<h3>${title}</h3><div class="row" style="gap:6px;color:var(--muted);font-size:13px"><a href="#" style="color:var(--c)">首页</a><span>/</span><a href="#" style="color:var(--c)">组件</a><span>/</span><a href="#" style="color:var(--c)">UI</a><span>/</span><b style="color:#e8eefc">当前页</b></div>`;
  } else if (kind === 'rating') {
    root.innerHTML = `<h3>${title}</h3><div class="stars" data-stars>${[1,2,3,4,5].map(i=>`<span data-s="${i}">★</span>`).join('')}</div><div style="margin-top:8px;color:var(--muted);font-size:12px" data-lab>0 / 5</div>`;
    const stars = root.querySelector('[data-stars]');
    const lab = root.querySelector('[data-lab]');
    const paint = (n) => { stars.querySelectorAll('span').forEach((s) => s.classList.toggle('on', +s.dataset.s <= n)); lab.textContent = `${n} / 5`; };
    stars.querySelectorAll('span').forEach((s) => s.onclick = () => paint(+s.dataset.s));
  } else if (kind === 'empty') {
    root.innerHTML = `<h3>${title}</h3><div style="text-align:center;padding:28px;border:1px dashed #24314f;border-radius:16px;max-width:360px">
      <div style="font-size:42px;margin-bottom:8px">📭</div>
      <b>暂无数据</b>
      <p style="color:var(--muted);font-size:13px;margin:8px 0 14px">创建或筛选后这里会显示结果</p>
      <button class="btn">新建一条</button></div>`;
  } else if (kind === 'banner') {
    root.innerHTML = `<h3>${title}</h3><div data-ban style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--c) 22%,#18233d);border:1px solid var(--c);width:min(480px,95%)">
      <span style="flex:1;font-size:13px">系统将于今晚 23:00 维护，请提前保存。</span>
      <button class="btn" data-x style="padding:4px 10px">关闭</button></div>`;
    root.querySelector('[data-x]').onclick = () => { root.querySelector('[data-ban]').style.display='none'; };
  } else {
    root.innerHTML = `<h3>${title}</h3><div class="toast">UI demo ${id}</div>`;
  }

  const sync = setInterval(() => {
    const L = live();
    root.style.setProperty('--c', L.color);
    stage.style.setProperty('--c', L.color);
  }, 80);
  return () => { clearInterval(sync); rm(); host.innerHTML = ''; };
}

