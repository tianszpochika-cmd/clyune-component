import { addStyle, bar, defaultParams, parseVariant, readLiveControls } from './_shared.js';
import { withControls } from './withControls.js';

const TITLES = { grid: 'Grid 布局', flex: 'Flex 布局' };

const GRID_PRESET_KEYS = [
  '基础栅格', '瀑布流模拟', '圣杯', '侧栏可调', '卡片等分', '密集自动填充',
  '命名区域', '子网格感', '居中舞台', '杂志排版', '仪表盘', '响应列',
  '间隔实验', '对齐线', '重叠层', '不等列宽', '行列跨越', '对齐内容',
  '密集打包', '流式卡片', '双栏正文', '页脚贴底', '看板列', '相片墙',
];

const FLEX_PRESET_KEYS = [
  '主轴分布', '换行', '等高卡片', '工具栏', '聊天气泡', '标签云',
  '底部操作栏', '垂直导航', '居中英雄', '间距推开', '两端对齐', '基线对齐',
  '反向排列', '均分伸展', '粘性页脚栏', '面包屑', '头像组', '统计条',
  '表单行', '媒体对象', '按钮组', '分栏对照', '滚动轨道', '角标叠放',
];

export function mount(host, opts = {}) {
  const family = parseVariant(opts.variant || 'grid').family;
  const isFlex = family.startsWith('flex');
  return withControls(host, opts, {
    kitKey: 'kit-layout',
    title: TITLES[family] || 'Layout',
    fallbackVariant: 'grid',
    params: defaultParams({ color: true, speed: false, size: false }).concat([
      { key: 'cols', type: 'range', label: isFlex ? '参考列感' : '列数', min: 1, max: 12, step: 1, value: isFlex ? 4 : 3 },
      { key: 'gap', type: 'range', label: '间距', min: 0, max: 48, step: 2, value: 12 },
      { key: 'items', type: 'range', label: '元素数', min: 3, max: 24, step: 1, value: isFlex ? 8 : 12 },
      { key: 'radius', type: 'range', label: '圆角', min: 0, max: 28, step: 1, value: 14 },
      { key: 'minh', type: 'range', label: '最小高度', min: 36, max: 160, step: 4, value: 64 },
      ...(isFlex ? [
        {
          key: 'justify', type: 'select', label: '主轴对齐', value: 'flex-start',
          options: [
            { label: 'start', value: 'flex-start' },
            { label: 'center', value: 'center' },
            { label: 'end', value: 'flex-end' },
            { label: 'between', value: 'space-between' },
            { label: 'around', value: 'space-around' },
            { label: 'evenly', value: 'space-evenly' },
          ],
        },
        {
          key: 'align', type: 'select', label: '交叉轴', value: 'stretch',
          options: [
            { label: 'stretch', value: 'stretch' },
            { label: 'start', value: 'flex-start' },
            { label: 'center', value: 'center' },
            { label: 'end', value: 'flex-end' },
            { label: 'baseline', value: 'baseline' },
          ],
        },
        {
          key: 'direction', type: 'select', label: '方向', value: 'row',
          options: [
            { label: 'row', value: 'row' },
            { label: 'row-reverse', value: 'row-reverse' },
            { label: 'column', value: 'column' },
            { label: 'column-reverse', value: 'column-reverse' },
          ],
        },
        {
          key: 'wrap', type: 'select', label: '换行', value: 'wrap',
          options: [
            { label: 'wrap', value: 'wrap' },
            { label: 'nowrap', value: 'nowrap' },
            { label: 'wrap-reverse', value: 'wrap-reverse' },
          ],
        },
      ] : [
        {
          key: 'justifyItems', type: 'select', label: '单元格对齐', value: 'stretch',
          options: [
            { label: 'stretch', value: 'stretch' },
            { label: 'start', value: 'start' },
            { label: 'center', value: 'center' },
            { label: 'end', value: 'end' },
          ],
        },
        {
          key: 'autoFlow', type: 'select', label: '自动流向', value: 'row',
          options: [
            { label: 'row', value: 'row' },
            { label: 'column', value: 'column' },
            { label: 'dense', value: 'dense' },
            { label: 'row dense', value: 'row dense' },
          ],
        },
      ]),
    ]),
    remountKeys: ['cols', 'gap', 'items', 'radius', 'minh', 'justify', 'align', 'direction', 'wrap', 'justifyItems', 'autoFlow'],
    liveKeys: ['color'],
    mountLegacy,
  });
}

function pastelPair(i, accentHex) {
  const h = (i * 53 + hashHue(accentHex)) % 360;
  const h2 = (h + 28 + (i % 5) * 8) % 360;
  const a = `hsl(${h} 72% 78%)`;
  const b = `hsl(${h2} 68% 88%)`;
  return `linear-gradient(135deg, ${a} 0%, ${b} 55%, hsl(${(h + 50) % 360} 60% 92%) 100%)`;
}

function hashHue(hex) {
  const s = String(hex || '#818cf8');
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n % 360;
}

function cellHtml(i, label, extraStyle = '', extraClass = '') {
  return `<div class="cell ${extraClass}" style="${extraStyle}" data-i="${i}"><span>${label}</span></div>`;
}

function mountLegacy(host, opts = {}) {
  const id = opts.variant || 'grid-1';
  const parsed = parseVariant(id, 'grid-1');
  const isFlex = parsed.family.startsWith('flex');
  const styleIdx = parsed.style;
  const ctrl = opts._controls || {};
  const { stage } = bar(host, id);
  const live = () => readLiveControls([host, stage, host.parentElement], ctrl);

  const rm = addStyle(`
  .kl{position:absolute;inset:0;overflow:auto;padding:16px;box-sizing:border-box}
  .kl-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
  .kl-meta .chip{font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid #24314f;background:#121a30;color:#9aa8c7}
  .kl-meta .chip em{color:#c7d2fe;font-style:normal;margin-left:4px}
  .kl .board{min-height:220px;border:1px dashed #2a3858;border-radius:14px;padding:12px;background:#0d1426;position:relative}
  .kl .board.show-lines{background-image:linear-gradient(#0d1426,#0d1426),repeating-linear-gradient(0deg,transparent,transparent 23px,#1a2540 23px,#1a2540 24px),repeating-linear-gradient(90deg,transparent,transparent 23px,#1a2540 23px,#1a2540 24px);background-blend-mode:normal}
  .kl .cell{border-radius:var(--radius,14px);min-height:var(--minh,64px);display:grid;place-items:center;color:#1e293b;font-size:12px;font-weight:700;
    border:1px solid rgba(255,255,255,.35);box-shadow:0 6px 18px rgba(15,23,42,.12), inset 0 1px 0 rgba(255,255,255,.45);
    text-shadow:0 1px 0 rgba(255,255,255,.35);transition:transform .15s ease, box-shadow .15s;padding:8px;box-sizing:border-box}
  .kl .cell span{pointer-events:none}
  .kl .cell:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(15,23,42,.18)}
  .kl .cell.ghost{opacity:.55;border-style:dashed}
  .kl .cell.tall{min-height:calc(var(--minh,64px) * 1.8)}
  .kl .cell.wide{grid-column:span 2}
  .kl .g{display:grid;gap:var(--gap,12px);width:100%}
  .kl .f{display:flex;gap:var(--gap,12px);width:100%;min-height:180px;box-sizing:border-box}
  .kl .holy{display:grid;gap:var(--gap,12px);grid-template-columns:180px 1fr 140px;grid-template-rows:auto 1fr auto;min-height:280px}
  .kl .holy .h{grid-column:1/-1}
  .kl .holy .ftr{grid-column:1/-1}
  .kl .masonry{columns:var(--cols,3);column-gap:var(--gap,12px)}
  .kl .masonry .cell{break-inside:avoid;margin-bottom:var(--gap,12px);display:flex;align-items:center;justify-content:center}
  .kl .areas{display:grid;gap:var(--gap,12px);grid-template-columns:1.2fr 1fr 1fr;grid-template-rows:auto 1fr auto;min-height:280px;
    grid-template-areas:"head head head" "side main aside" "foot foot foot"}
  .kl .areas .a-head{grid-area:head}.kl .areas .a-side{grid-area:side}.kl .areas .a-main{grid-area:main}.kl .areas .a-aside{grid-area:aside}.kl .areas .a-foot{grid-area:foot}
  .kl .overlap{display:grid;place-items:center;min-height:260px}
  .kl .overlap .stack{display:grid;width:min(420px,90%);aspect-ratio:4/3}
  .kl .overlap .cell{grid-area:1/1;width:70%;height:70%;justify-self:center;align-self:center}
  .kl .dash{display:grid;gap:var(--gap,12px);grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,minmax(70px,1fr));min-height:300px}
  .kl .mag{display:grid;gap:var(--gap,12px);grid-template-columns:2fr 1fr 1fr;grid-auto-rows:minmax(70px,auto);min-height:280px}
  .kl .subgrid-like{display:grid;gap:var(--gap,12px);grid-template-columns:repeat(2,1fr)}
  .kl .subgrid-like .panel{display:grid;gap:calc(var(--gap,12px) * .7);grid-template-columns:repeat(2,1fr);padding:10px;border:1px dashed #334261;border-radius:14px;background:#0b1220aa}
  .kl .chat{display:flex;flex-direction:column;gap:var(--gap,12px);align-items:stretch;max-width:480px;margin:0 auto}
  .kl .chat .cell{align-self:flex-start;max-width:78%;min-height:44px}
  .kl .chat .cell.me{align-self:flex-end}
  .kl .tags{display:flex;flex-wrap:wrap;gap:var(--gap,12px);align-content:flex-start}
  .kl .tags .cell{flex:0 0 auto;min-width:72px;min-height:36px;padding:6px 14px}
  .kl .toolbar{display:flex;gap:var(--gap,12px);align-items:center;min-height:64px}
  .kl .toolbar .grow{flex:1 1 auto}
  .kl .toolbar .cell{flex:0 0 auto;min-width:56px;min-height:40px}
  .kl .avatars{display:flex;align-items:center}
  .kl .avatars .cell{width:48px;height:48px;min-height:48px;border-radius:50%;margin-left:-12px;flex:none}
  .kl .avatars .cell:first-child{margin-left:0}
  .kl .track{display:flex;gap:var(--gap,12px);overflow:auto;padding-bottom:6px;scroll-snap-type:x mandatory}
  .kl .track .cell{flex:0 0 140px;scroll-snap-align:start;min-height:100px}
  .kl .legend{font-size:11px;color:#8090b0;margin-top:10px;line-height:1.5}
  `);

  const root = document.createElement('div');
  root.className = 'kl';
  stage.appendChild(root);

  const apply = () => {
    const L = live();
    const accent = L.color || ctrl.color || '#818cf8';
    const cols = clamp(Number(ctrl.cols) || (isFlex ? 4 : 3), 1, 12);
    const gap = Number.isFinite(Number(ctrl.gap)) ? Number(ctrl.gap) : 12;
    const items = clamp(Number(ctrl.items) || (isFlex ? 8 : 12), 3, 24);
    const radius = Number.isFinite(Number(ctrl.radius)) ? Number(ctrl.radius) : 14;
    const minh = Number.isFinite(Number(ctrl.minh)) ? Number(ctrl.minh) : 64;
    const list = isFlex ? FLEX_PRESET_KEYS : GRID_PRESET_KEYS;
    const presetName = list[styleIdx % list.length];

    root.style.setProperty('--c', accent);
    root.style.setProperty('--gap', `${gap}px`);
    root.style.setProperty('--cols', String(cols));
    root.style.setProperty('--radius', `${radius}px`);
    root.style.setProperty('--minh', `${minh}px`);
    stage.style.setProperty('--c', accent);

    root.innerHTML = isFlex
      ? renderFlex(presetName, { cols, gap, items, accent, ctrl })
      : renderGrid(presetName, { cols, gap, items, accent, ctrl });
  };

  apply();
  const sync = setInterval(() => {
    const L = live();
    const accent = L.color || ctrl.color || '#818cf8';
    root.style.setProperty('--c', accent);
    stage.style.setProperty('--c', accent);
    root.querySelectorAll('.cell').forEach((el, i) => {
      if (!el.dataset.lockBg) el.style.background = pastelPair(i, accent);
    });
  }, 160);

  return () => { clearInterval(sync); rm(); host.innerHTML = ''; };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function cells(n, accent, mapFn) {
  return Array.from({ length: n }, (_, i) => {
    const bg = pastelPair(i, accent);
    const extra = mapFn ? mapFn(i) : {};
    const style = `background:${bg};${extra.style || ''}`;
    return cellHtml(i, extra.label || `Item ${i + 1}`, style, extra.className || '');
  }).join('');
}

function meta(preset, bits) {
  return `<div class="kl-meta"><span class="chip">预设<em>${preset}</em></span>${bits.map((b) => `<span class="chip">${b}</span>`).join('')}</div>`;
}

function renderGrid(preset, { cols, gap, items, accent, ctrl }) {
  const ji = ctrl.justifyItems || 'stretch';
  const flow = ctrl.autoFlow || 'row';
  const n = items;
  let boardClass = 'board';
  let body = '';
  let note = '';

  switch (preset) {
    case '瀑布流模拟':
      body = `<div class="masonry">${cells(n, accent, (i) => ({ style: `height:${56 + (i % 5) * 28}px`, label: `Card ${i + 1}` }))}</div>`;
      note = 'column-count 模拟瀑布流；调「列数 / 元素数 / 间距」。';
      break;
    case '圣杯':
      body = `<div class="holy">
        ${cellHtml(0, 'Header', `background:${pastelPair(0, accent)}`, 'h')}
        ${cellHtml(1, 'Nav', `background:${pastelPair(1, accent)}`)}
        ${cellHtml(2, 'Main', `background:${pastelPair(2, accent)};min-height:160px`)}
        ${cellHtml(3, 'Aside', `background:${pastelPair(3, accent)}`)}
        ${cellHtml(4, 'Footer', `background:${pastelPair(4, accent)}`, 'ftr')}
      </div>`;
      note = '经典圣杯：header / nav / main / aside / footer。';
      break;
    case '侧栏可调':
      body = `<div class="g" style="grid-template-columns:minmax(120px,${80 + cols * 18}px) 1fr;min-height:260px">
        ${cellHtml(0, 'Sidebar', `background:${pastelPair(0, accent)}`)}
        ${cellHtml(1, 'Content', `background:${pastelPair(1, accent)}`)}
      </div>`;
      note = '侧栏宽度随「列数」滑条变化（示意）。';
      break;
    case '卡片等分':
      body = `<div class="g" style="grid-template-columns:repeat(${cols},1fr);justify-items:${ji}">${cells(Math.max(cols, n), accent)}</div>`;
      note = `repeat(${cols}, 1fr) 等分列。`;
      break;
    case '密集自动填充':
      body = `<div class="g" style="grid-template-columns:repeat(auto-fill,minmax(${90 + cols * 8}px,1fr));justify-items:${ji}">${cells(n, accent)}</div>`;
      note = 'auto-fill + minmax，窗口变窄自动折行。';
      break;
    case '命名区域':
      body = `<div class="areas">
        ${cellHtml(0, 'head', `background:${pastelPair(0, accent)}`, 'a-head')}
        ${cellHtml(1, 'side', `background:${pastelPair(1, accent)}`, 'a-side')}
        ${cellHtml(2, 'main', `background:${pastelPair(2, accent)};min-height:140px`, 'a-main')}
        ${cellHtml(3, 'aside', `background:${pastelPair(3, accent)}`, 'a-aside')}
        ${cellHtml(4, 'foot', `background:${pastelPair(4, accent)}`, 'a-foot')}
      </div>`;
      note = 'grid-template-areas 命名区域布局。';
      break;
    case '子网格感':
      body = `<div class="subgrid-like">
        <div class="panel">${cells(4, accent, (i) => ({ label: `A${i + 1}` }))}</div>
        <div class="panel">${cells(4, accent, (i) => ({ label: `B${i + 1}` }))}</div>
      </div>`;
      note = '嵌套 grid 模拟 subgrid 分区。';
      break;
    case '居中舞台':
      body = `<div class="g" style="place-items:center;min-height:260px;grid-template-columns:1fr">
        ${cellHtml(0, 'Stage', `background:${pastelPair(0, accent)};width:min(360px,80%);min-height:140px`)}
      </div>`;
      note = 'place-items:center 单格居中舞台。';
      break;
    case '杂志排版':
      body = `<div class="mag">
        ${cellHtml(0, 'Hero', `background:${pastelPair(0, accent)};grid-row:span 2;min-height:180px`)}
        ${cells(Math.max(4, n - 1), accent, (i) => ({ label: `Blk ${i + 2}` }))}
      </div>`;
      note = '不等行列跨度的杂志栅格。';
      break;
    case '仪表盘':
      body = `<div class="dash">
        ${cellHtml(0, 'KPI', `background:${pastelPair(0, accent)};grid-column:span 2`)}
        ${cellHtml(1, 'Chart', `background:${pastelPair(1, accent)};grid-column:span 2;grid-row:span 2`)}
        ${cellHtml(2, 'List', `background:${pastelPair(2, accent)};grid-row:span 2`)}
        ${cells(Math.max(3, n - 3), accent, (i) => ({ label: `W${i + 1}` }))}
      </div>`;
      note = '仪表盘：跨列/跨行小组件。';
      break;
    case '响应列':
      body = `<div class="g" style="grid-template-columns:repeat(auto-fit,minmax(${110 + cols * 6}px,1fr));justify-items:${ji}">${cells(n, accent)}</div>`;
      note = 'auto-fit 响应列，尽量拉伸填满。';
      break;
    case '间隔实验':
      body = `<div class="g" style="grid-template-columns:repeat(${cols},1fr);gap:${gap}px ${Math.max(0, gap * 1.6)}px;justify-items:${ji}">${cells(n, accent)}</div>`;
      note = 'row-gap / column-gap 不等间距。';
      break;
    case '对齐线':
      boardClass = 'board show-lines';
      body = `<div class="g" style="grid-template-columns:repeat(${cols},1fr);justify-items:${ji};align-items:center">${cells(n, accent, (i) => ({ style: `min-height:${40 + (i % 4) * 22}px`, label: `${i + 1}` }))}</div>`;
      note = '背景参考线 + justify-items / 高度变化。';
      break;
    case '重叠层':
      body = `<div class="overlap"><div class="stack">
        ${[0, 1, 2, 3].map((i) => cellHtml(i, `Layer ${i + 1}`, `background:${pastelPair(i, accent)};transform:translate(${i * 18}px,${i * 14}px) rotate(${i * 3}deg);opacity:${1 - i * 0.12}`)).join('')}
      </div></div>`;
      note = '同格重叠 + translate 层叠。';
      break;
    case '不等列宽':
      body = `<div class="g" style="grid-template-columns:2fr 1fr 1.4fr;justify-items:${ji}">${cells(Math.max(6, n), accent)}</div>`;
      note = 'fr 比例列：2fr / 1fr / 1.4fr。';
      break;
    case '行列跨越':
      body = `<div class="g" style="grid-template-columns:repeat(${Math.max(3, cols)},1fr);grid-auto-flow:${flow}">
        ${cells(n, accent, (i) => ({
          className: i % 5 === 0 ? 'wide tall' : i % 3 === 0 ? 'wide' : i % 4 === 0 ? 'tall' : '',
          label: i % 5 === 0 ? '2x2' : i % 3 === 0 ? 'span2' : `Item ${i + 1}`,
        }))}
      </div>`;
      note = `grid-column/row span + auto-flow: ${flow}。`;
      break;
    case '对齐内容':
      body = `<div class="g" style="grid-template-columns:repeat(${cols},80px);justify-content:space-between;align-content:space-around;min-height:260px;justify-items:${ji}">${cells(Math.min(n, cols * 2), accent)}</div>`;
      note = '固定轨宽 + justify-content / align-content。';
      break;
    case '密集打包':
      body = `<div class="g" style="grid-template-columns:repeat(${Math.max(4, cols)},1fr);grid-auto-flow:dense">
        ${cells(n, accent, (i) => ({ className: i % 4 === 0 ? 'wide' : '', label: i % 4 === 0 ? 'wide' : `${i + 1}` }))}
      </div>`;
      note = 'grid-auto-flow: dense 填补空洞。';
      break;
    case '流式卡片':
      body = `<div class="g" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">${cells(n, accent, (i) => ({ label: `Card ${i + 1}`, style: 'aspect-ratio:4/3' }))}</div>`;
      note = '等比例流式卡片墙。';
      break;
    case '双栏正文':
      body = `<div class="g" style="grid-template-columns:2.2fr 1fr;gap:${gap}px;min-height:240px">
        ${cellHtml(0, 'Article', `background:${pastelPair(0, accent)};min-height:200px`)}
        <div class="g" style="grid-template-columns:1fr;gap:${gap}px">${cells(Math.max(3, Math.min(6, n - 1)), accent, (i) => ({ label: `Aside ${i + 1}` }))}</div>
      </div>`;
      note = '主栏 + 侧栏信息流。';
      break;
    case '页脚贴底':
      body = `<div class="g" style="grid-template-rows:auto 1fr auto;min-height:280px">
        ${cellHtml(0, 'Header', `background:${pastelPair(0, accent)}`)}
        ${cellHtml(1, 'Flexible Main', `background:${pastelPair(1, accent)}`)}
        ${cellHtml(2, 'Footer', `background:${pastelPair(2, accent)}`)}
      </div>`;
      note = '1fr 中间行把页脚推到底。';
      break;
    case '看板列':
      body = `<div class="g" style="grid-template-columns:repeat(${Math.min(cols, 5)},1fr);align-items:start">
        ${Array.from({ length: Math.min(cols, 5) }, (_, col) => `
          <div class="g" style="gap:${Math.max(6, gap * 0.7)}px;padding:8px;border:1px solid #24314f;border-radius:12px;background:#0b122088">
            ${cellHtml(col * 10, `Col ${col + 1}`, `background:${pastelPair(col, accent)};min-height:36px`)}
            ${cells(2 + (col % 3), accent, (i) => ({ label: `T${col + 1}-${i + 1}`, style: 'min-height:48px' }))}
          </div>`).join('')}
      </div>`;
      note = '多列看板（每列内部再 grid）。';
      break;
    case '相片墙':
      body = `<div class="g" style="grid-template-columns:repeat(${Math.max(3, cols)},1fr);grid-auto-rows:80px;grid-auto-flow:dense">
        ${cells(n, accent, (i) => {
          const spanC = i % 7 === 0 ? 2 : 1;
          const spanR = i % 5 === 0 ? 2 : 1;
          return { style: `grid-column:span ${spanC};grid-row:span ${spanR}`, label: `${spanC}x${spanR}` };
        })}
      </div>`;
      note = '相片墙：不规则 span + dense。';
      break;
    default:
      body = `<div class="g" style="grid-template-columns:repeat(${cols},1fr);justify-items:${ji};grid-auto-flow:${flow}">${cells(n, accent)}</div>`;
      note = `基础 CSS Grid：${cols} 列 · gap ${gap}px。`;
  }

  return `${meta(preset, [`cols ${cols}`, `gap ${gap}`, `items ${n}`, `justify-items ${ji}`])}
    <div class="${boardClass}">${body}</div>
    <p class="legend">${note} 单元格为浅色随机渐变，强调色影响色相种子。</p>`;
}

function renderFlex(preset, { cols, gap, items, accent, ctrl }) {
  const justify = ctrl.justify || 'flex-start';
  const align = ctrl.align || 'stretch';
  const direction = ctrl.direction || 'row';
  const wrap = ctrl.wrap || 'wrap';
  const n = items;
  let body = '';
  let note = '';
  const baseStyle = `justify-content:${justify};align-items:${align};flex-direction:${direction};flex-wrap:${wrap};gap:${gap}px`;

  switch (preset) {
    case '换行':
      body = `<div class="f" style="${baseStyle}">${cells(n, accent, (i) => ({ style: `flex:0 0 ${70 + (i % 3) * 24}px`, label: `${i + 1}` }))}</div>`;
      note = 'flex-wrap + 不等宽度项。';
      break;
    case '等高卡片':
      body = `<div class="f" style="align-items:stretch;flex-wrap:wrap;gap:${gap}px">${cells(Math.max(cols, n), accent, (i) => ({ style: `flex:1 1 ${Math.floor(100 / Math.max(1, cols))}%;min-width:120px;min-height:120px`, label: `Card ${i + 1}` }))}</div>`;
      note = 'stretch 让同行卡片等高。';
      break;
    case '工具栏':
      body = `<div class="toolbar" style="gap:${gap}px">
        ${cellHtml(0, 'Logo', `background:${pastelPair(0, accent)}`)}
        ${cellHtml(1, 'Nav', `background:${pastelPair(1, accent)};flex:1 1 auto`, 'grow')}
        ${cellHtml(2, 'Search', `background:${pastelPair(2, accent)}`)}
        ${cellHtml(3, 'Avatar', `background:${pastelPair(3, accent)};border-radius:50%;width:40px;min-width:40px`)}
      </div>`;
      note = '工具栏：两端元素 + 中间弹性区。';
      break;
    case '聊天气泡':
      body = `<div class="chat" style="gap:${gap}px">${cells(Math.min(n, 10), accent, (i) => ({
        className: i % 2 ? 'me' : '',
        label: i % 2 ? `Me ${i + 1}` : `Them ${i + 1}`,
        style: `max-width:${55 + (i % 3) * 10}%`,
      }))}</div>`;
      note = 'column + align-self 聊天气泡。';
      break;
    case '标签云':
      body = `<div class="tags" style="gap:${gap}px">${cells(n, accent, (i) => ({ label: ['React', 'CSS', 'Grid', 'Flex', 'Vite', 'Rust', 'Axum', 'SVG', 'WebGL', 'GSAP'][i % 10], style: `font-size:${11 + (i % 4)}px` }))}</div>`;
      note = 'wrap 标签云，宽度随内容。';
      break;
    case '底部操作栏':
      body = `<div class="f" style="flex-direction:column;min-height:260px;justify-content:space-between;gap:${gap}px">
        ${cellHtml(0, 'Content', `background:${pastelPair(0, accent)};flex:1 1 auto;min-height:140px`)}
        <div class="f" style="justify-content:space-between;gap:${gap}px">${cells(3, accent, (i) => ({ label: ['取消', '次要', '主操作'][i], style: 'flex:1;min-height:44px' }))}</div>
      </div>`;
      note = '内容区弹性伸展，底部操作栏贴底。';
      break;
    case '垂直导航':
      body = `<div class="f" style="flex-direction:column;align-items:stretch;gap:${gap}px;max-width:220px">${cells(Math.min(n, 8), accent, (i) => ({ label: `Menu ${i + 1}`, style: 'min-height:40px' }))}</div>`;
      note = 'column 垂直导航列表。';
      break;
    case '居中英雄':
      body = `<div class="f" style="justify-content:center;align-items:center;min-height:260px;flex-direction:column;gap:${gap}px">
        ${cellHtml(0, 'Hero Title', `background:${pastelPair(0, accent)};min-width:220px;min-height:72px`)}
        ${cellHtml(1, 'CTA', `background:${pastelPair(1, accent)};min-width:120px;min-height:40px`)}
      </div>`;
      note = '主轴/交叉轴双 center。';
      break;
    case '间距推开':
      body = `<div class="f" style="justify-content:space-between;align-items:center;gap:${gap}px">${cells(Math.min(n, 5), accent)}</div>`;
      note = 'space-between 把项目推到两端。';
      break;
    case '两端对齐':
      body = `<div class="f" style="justify-content:space-between;align-items:${align};gap:${gap}px;flex-wrap:${wrap}">${cells(n, accent, (i) => ({ style: `flex:0 1 ${90 + (i % 3) * 20}px` }))}</div>`;
      note = 'space-between + 可变宽度。';
      break;
    case '基线对齐':
      body = `<div class="f" style="align-items:baseline;gap:${gap}px;flex-wrap:wrap">${cells(Math.min(n, 8), accent, (i) => ({ style: `font-size:${14 + (i % 5) * 6}px;min-height:auto;padding:8px 12px`, label: `Aa ${i + 1}` }))}</div>`;
      note = 'align-items: baseline 文字基线对齐。';
      break;
    case '反向排列':
      body = `<div class="f" style="flex-direction:row-reverse;justify-content:${justify};align-items:${align};gap:${gap}px;flex-wrap:${wrap}">${cells(n, accent)}</div>`;
      note = 'row-reverse 视觉顺序反转。';
      break;
    case '均分伸展':
      body = `<div class="f" style="gap:${gap}px">${cells(Math.min(n, Math.max(3, cols)), accent, () => ({ style: 'flex:1 1 0;min-width:0' }))}</div>`;
      note = 'flex:1 1 0 均分剩余空间。';
      break;
    case '粘性页脚栏':
      body = `<div class="f" style="flex-direction:column;min-height:280px;gap:${gap}px">
        ${cellHtml(0, 'Header', `background:${pastelPair(0, accent)};flex:0 0 auto`)}
        ${cellHtml(1, 'Scrollable / grow', `background:${pastelPair(1, accent)};flex:1 1 auto`)}
        ${cellHtml(2, 'Sticky Footer Bar', `background:${pastelPair(2, accent)};flex:0 0 auto`)}
      </div>`;
      note = 'column + flex-grow 中间撑开。';
      break;
    case '面包屑':
      body = `<div class="f" style="align-items:center;gap:${Math.max(4, gap / 2)}px;flex-wrap:wrap">
        ${Array.from({ length: Math.min(n, 6) }, (_, i) => `${cellHtml(i, ['Home', 'Libs', 'Layout', 'Flex', 'Demo', 'Here'][i], `background:${pastelPair(i, accent)};min-height:32px;padding:4px 12px`)}${i < Math.min(n, 6) - 1 ? '<span style="color:#66748f">/</span>' : ''}`).join('')}
      </div>`;
      note = '行内面包屑分隔。';
      break;
    case '头像组':
      body = `<div class="avatars">${cells(Math.min(n, 8), accent, (i) => ({ label: String.fromCharCode(65 + i) }))}</div>`;
      note = '负 margin 叠放头像组。';
      break;
    case '统计条':
      body = `<div class="f" style="gap:${gap}px;flex-wrap:wrap">${cells(Math.min(n, 4), accent, (i) => ({ label: ['12.4k', '98%', '3.2s', 'A/B'][i % 4], style: 'flex:1 1 120px;min-height:88px;font-size:18px' }))}</div>`;
      note = '等分统计卡片条。';
      break;
    case '表单行':
      body = `<div class="f" style="flex-direction:column;gap:${gap}px;max-width:520px">
        ${[0, 1, 2].map((row) => `<div class="f" style="gap:${gap}px;align-items:center">
          ${cellHtml(row * 2, ['邮箱', '密码', '角色'][row], `background:${pastelPair(row * 2, accent)};flex:0 0 88px;min-height:40px`)}
          ${cellHtml(row * 2 + 1, '输入区', `background:${pastelPair(row * 2 + 1, accent)};flex:1 1 auto;min-height:40px`)}
        </div>`).join('')}
      </div>`;
      note = 'label + field 表单行。';
      break;
    case '媒体对象':
      body = `<div class="f" style="gap:${gap}px;align-items:flex-start;max-width:560px">
        ${cellHtml(0, 'Img', `background:${pastelPair(0, accent)};flex:0 0 96px;width:96px;height:96px;min-height:96px`)}
        <div class="f" style="flex-direction:column;gap:${Math.max(6, gap / 2)}px;flex:1 1 auto">
          ${cellHtml(1, 'Title', `background:${pastelPair(1, accent)};min-height:36px`)}
          ${cellHtml(2, 'Description block', `background:${pastelPair(2, accent)};min-height:72px`)}
        </div>
      </div>`;
      note = '经典 media object：左图右文。';
      break;
    case '按钮组':
      body = `<div class="f" style="gap:0;align-items:stretch">${cells(Math.min(n, 5), accent, (i) => ({
        label: ['左', '中A', '中B', '中C', '右'][i],
        style: `flex:1;min-height:44px;border-radius:${i === 0 ? '12px 0 0 12px' : i === Math.min(n, 5) - 1 ? '0 12px 12px 0' : '0'}`,
      }))}</div>`;
      note = '无缝按钮组（合并圆角）。';
      break;
    case '分栏对照':
      body = `<div class="f" style="gap:${gap}px;align-items:stretch">${cells(2, accent, (i) => ({ label: i ? '方案 B' : '方案 A', style: 'flex:1;min-height:200px;font-size:16px' }))}</div>`;
      note = '双栏对照布局。';
      break;
    case '滚动轨道':
      body = `<div class="track" style="gap:${gap}px">${cells(Math.max(n, 10), accent, (i) => ({ label: `Slide ${i + 1}` }))}</div>`;
      note = '横向 overflow 滚动轨道 + scroll-snap。';
      break;
    case '角标叠放':
      body = `<div class="f" style="justify-content:center;align-items:center;min-height:220px;position:relative">
        <div style="position:relative;width:160px;height:160px">
          ${cellHtml(0, 'Card', `background:${pastelPair(0, accent)};width:160px;height:160px;min-height:160px`)}
          ${cellHtml(1, '99+', `background:${pastelPair(1, accent)};position:absolute;right:-10px;top:-10px;width:44px;height:44px;min-height:44px;border-radius:50%;font-size:11px`)}
        </div>
      </div>`;
      note = '相对定位角标叠放。';
      break;
    default:
      body = `<div class="f" style="${baseStyle}">${cells(n, accent, (i) => ({ style: `flex:0 1 ${80 + (i % 4) * 16}px` }))}</div>`;
      note = `主轴 ${justify} · 交叉轴 ${align} · ${direction} / ${wrap}。`;
  }

  return `${meta(preset, [`justify ${justify}`, `align ${align}`, `dir ${direction}`, `wrap ${wrap}`])}
    <div class="board">${body}</div>
    <p class="legend">${note} 右侧可继续改主轴/交叉轴/方向/换行；单元格浅色渐变。</p>`;
}
