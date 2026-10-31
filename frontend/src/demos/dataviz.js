import { libs } from '../lib/load.js';

const TXT = '#c7d2fe', MUTED = '#93a0c0';
const PALETTE = ['#818cf8', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#c084fc', '#fb7185', '#38bdf8'];

function echartsHost(host) {
  host.style.padding = '8px';
  const el = document.createElement('div'); el.style.cssText = 'width:100%;height:100%';
  host.appendChild(el); return el;
}
function bindResize(host, chart) { const ro = new ResizeObserver(() => chart.resize()); ro.observe(host); return ro; }

const STACK = {
  '前端框架': ['Vue', 'React', 'Svelte', 'Angular'],
  '图形渲染': ['Three.js', 'WebGL', 'Canvas', 'SVG', 'PixiJS'],
  '动画': ['GSAP', 'Lottie', 'CSS Animation', 'Web Animations'],
  '可视化': ['ECharts', 'D3', 'Chart.js'],
  '工程化': ['Vite', 'TypeScript', 'ESLint', 'pnpm'],
  '服务端': ['Node.js', 'nginx', 'Docker'],
};
const LINKS = [['Three.js', 'WebGL'], ['PixiJS', 'WebGL'], ['Chart.js', 'Canvas'], ['ECharts', 'Canvas'], ['D3', 'SVG'], ['Lottie', 'SVG'], ['GSAP', 'CSS Animation'], ['Vue', 'Vite'], ['React', 'Vite'], ['Svelte', 'Vite'], ['Vite', 'Node.js'], ['TypeScript', 'Vue'], ['TypeScript', 'React'], ['TypeScript', 'Angular'], ['Docker', 'nginx'], ['Web Animations', 'CSS Animation'], ['pnpm', 'Node.js'], ['ESLint', 'TypeScript']];

export async function mountGraph(host) {
  const echarts = await libs.echarts();
  const chart = echarts.init(echartsHost(host), null, { renderer: 'canvas' });
  const cats = Object.keys(STACK);
  const nodes = [], links = [];
  cats.forEach((c, i) => { nodes.push({ id: c, name: c, category: i, symbolSize: 46, label: { show: true, fontWeight: 'bold' } });
    STACK[c].forEach((t) => { nodes.push({ id: t, name: t, category: i, symbolSize: 18 + Math.random() * 14 }); links.push({ source: c, target: t }); }); });
  LINKS.forEach(([a, b]) => links.push({ source: a, target: b, lineStyle: { type: 'dashed', opacity: .35 } }));
  cats.forEach((c, i) => links.push({ source: 'Web 前端', target: c, lineStyle: { width: 2, opacity: .6 } }));
  nodes.push({ id: 'Web 前端', name: 'Web 前端', symbolSize: 66, itemStyle: { color: '#e8eefc' }, label: { show: true, color: '#0b1020', fontWeight: 'bold' }, category: 0 });
  chart.setOption({
    color: PALETTE, backgroundColor: 'transparent',
    tooltip: { formatter: (p) => p.dataType === 'node' ? p.name : `${p.data.source} → ${p.data.target}` },
    legend: { data: cats, textStyle: { color: TXT }, top: 4, type: 'scroll' },
    series: [{ type: 'graph', layout: 'force', roam: true, draggable: true, data: nodes, links, categories: cats.map((name) => ({ name })),
      force: { repulsion: 220, edgeLength: [40, 110], gravity: .08 }, label: { show: true, position: 'right', color: TXT, fontSize: 11 },
      lineStyle: { color: 'source', curveness: .15, opacity: .7 }, emphasis: { focus: 'adjacency', lineStyle: { width: 3 } } }],
  });
  const ro = bindResize(host, chart);
  return () => { ro.disconnect(); chart.dispose(); host.innerHTML = ''; host.style.padding = ''; };
}

export async function mountTreemap(host) {
  const echarts = await libs.echarts();
  const chart = echarts.init(echartsHost(host));
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  const data = Object.entries(STACK).map(([name, items]) => ({ name, children: items.map((t) => ({ name: t, children: ['文档', '示例', '源码', '测试'].map((k) => ({ name: `${t} ${k}`, value: rnd(20, 300) })) })) }));
  chart.setOption({
    color: PALETTE, backgroundColor: 'transparent',
    tooltip: { formatter: (p) => `${p.treePathInfo.map((x) => x.name).filter(Boolean).join(' / ')}<br/>规模：<b>${p.value}</b>` },
    series: [{ type: 'treemap', name: '前端技术栈', data, top: 10, bottom: 34, left: 4, right: 4, roam: false, leafDepth: 2,
      breadcrumb: { bottom: 4, itemStyle: { color: '#18233d', borderColor: '#24314f', textStyle: { color: TXT } } },
      label: { show: true, formatter: '{b}', color: '#fff' }, upperLabel: { show: true, height: 22, color: '#fff', fontWeight: 'bold' },
      itemStyle: { borderColor: '#0b1020', borderWidth: 2, gapWidth: 2 },
      levels: [{ itemStyle: { borderWidth: 0, gapWidth: 4 } }, { itemStyle: { gapWidth: 2 }, colorSaturation: [.35, .6] }, { colorSaturation: [.3, .5], itemStyle: { gapWidth: 1, borderColorSaturation: .6 } }] }],
  });
  const ro = bindResize(host, chart);
  return () => { ro.disconnect(); chart.dispose(); host.innerHTML = ''; host.style.padding = ''; };
}

export async function mountD3Force(host) {
  const d3 = await libs.d3();
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const svg = d3.select(host).append('svg').attr('width', '100%').attr('height', '100%').style('display', 'block').style('touch-action', 'none');
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([.3, 4]).on('zoom', (e) => g.attr('transform', e.transform)));
  const nodes = [{ id: 'Web 前端', grp: -1, r: 22 }], links = [];
  Object.entries(STACK).forEach(([c, items], i) => { nodes.push({ id: c, grp: i, r: 14 }); links.push({ source: 'Web 前端', target: c });
    items.forEach((t) => { nodes.push({ id: t, grp: i, r: 8 }); links.push({ source: c, target: t }); }); });
  LINKS.forEach(([a, b]) => links.push({ source: a, target: b, weak: true }));
  const color = (d) => d.grp < 0 ? '#e8eefc' : PALETTE[d.grp % PALETTE.length];
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance((l) => l.weak ? 90 : 50).strength((l) => l.weak ? .05 : .7))
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(W() / 2, H() / 2))
    .force('collide', d3.forceCollide().radius((d) => d.r + 6));
  const link = g.append('g').selectAll('line').data(links).join('line').attr('stroke', (l) => l.weak ? '#3b4a6b' : '#4b5b85').attr('stroke-dasharray', (l) => l.weak ? '3 3' : null).attr('stroke-width', (l) => l.weak ? 1 : 1.5);
  const node = g.append('g').selectAll('g').data(nodes).join('g').style('cursor', 'grab');
  node.append('circle').attr('r', (d) => d.r).attr('fill', color).attr('stroke', '#0b1020').attr('stroke-width', 2);
  node.append('text').text((d) => d.id).attr('x', (d) => d.r + 4).attr('y', 4).attr('fill', TXT).attr('font-size', (d) => d.r > 12 ? 13 : 11).attr('font-weight', (d) => d.r > 12 ? 700 : 400).style('pointer-events', 'none');
  node.on('mouseenter', (e, d) => { link.attr('stroke-opacity', (l) => l.source === d || l.target === d ? 1 : .15); node.attr('opacity', (n) => n === d || links.some((l) => (l.source === d && l.target === n) || (l.target === d && l.source === n)) ? 1 : .3); })
    .on('mouseleave', () => { link.attr('stroke-opacity', 1); node.attr('opacity', 1); });
  node.call(d3.drag()
    .on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  sim.on('tick', () => {
    link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });
  const hint = d3.select(host).append('div').attr('class', 'fx-bar').html('<span class="chip">d3-force · d3-zoom · d3-drag</span>');
  const ro = new ResizeObserver(() => { sim.force('center', d3.forceCenter(W() / 2, H() / 2)); sim.alpha(.3).restart(); });
  ro.observe(host);
  return () => { ro.disconnect(); sim.stop(); hint.remove(); svg.remove(); host.innerHTML = ''; };
}
