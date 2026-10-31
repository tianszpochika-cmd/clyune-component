/**
 * Chart.js laboratory — one mount() covers many chart types via variant.
 * DemoControls: presets (styles) + color / density / animation / tension / fill / legend / border.
 */
import { panel, parseVariant, colorToRgb } from './_shared.js';

const CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.6/auto/+esm';

const LABELS7 = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const LABELS12 = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const CAT5 = ['产品A', '产品B', '产品C', '产品D', '产品E'];
const CAT6 = ['电信', '联通', '移动', '教育网', '海外', '其他'];

const TYPE_META = {
  line: { title: '折线图', presets: ['平滑', '折线', '虚线', '粗线', '多色点'] },
  multiline: { title: '多序列折线', presets: ['双线', '三线', '对比', '填充差'] },
  area: { title: '面积图', presets: ['单面', '渐变', '堆叠感', '透明'] },
  stepline: { title: '阶梯折线', presets: ['before', 'after', 'middle', '虚线阶梯'] },
  bar: { title: '柱状图', presets: ['圆角', '扁平', '细柱', '宽柱'] },
  hbar: { title: '横向柱图', presets: ['基础', '圆角', '分组感', '细条'] },
  stackedbar: { title: '堆叠柱图', presets: ['三层', '百分比', '圆角', '细柱'] },
  stackedarea: { title: '堆叠面积', presets: ['三层', '平滑', '百分比', '高对比'] },
  groupedbar: { title: '分组柱图', presets: ['双组', '三组', '窄缝', '宽缝'] },
  pie: { title: '饼图', presets: ['标准', '描边', '旋转', '小扇突出'] },
  doughnut: { title: '环形图', presets: ['标准', '细环', '粗环', '半环感'] },
  radar: { title: '雷达图', presets: ['填充', '描边', '双雷达', '尖角'] },
  polar: { title: '极坐标面积', presets: ['标准', '描边', '旋转', '高对比'] },
  scatter: { title: '散点图', presets: ['圆点', '大点', '多系列', '连线感'] },
  bubble: { title: '气泡图', presets: ['标准', '多彩', '稀疏', '密集'] },
  mixed: { title: '混合图', presets: ['柱+线', '双轴', '面积+柱', '三合一'] },
  sparkline: { title: '迷你折线', presets: ['细线', '面积', '阶梯', '无坐标'] },
  gauge: { title: '仪表盘', presets: ['半环', '全环', '粗轨', '细针'] },
  progress: { title: '进度环', presets: ['单环', '双环', '粗', '细'] },
  waterfall: { title: '瀑布图(柱)', presets: ['盈亏', '累计', '彩色', '细柱'] },
  combo: { title: '组合图', presets: ['柱线', '面积线', '双柱线', '阴影线'] },
  logline: { title: '对数坐标折线', presets: ['平滑', '折线', '面积', '多线'] },
  horizstack: { title: '横向堆叠', presets: ['三层', '百分比', '圆角', '细条'] },
  density: { title: '密度柱', presets: ['日', '周', '月', '热力感'] },
  realtime: { title: '实时流图', presets: ['滚动', '追加', '双线', '面积流'] },
  radarfill: { title: '雷达填充对比', presets: ['双层', '三层', '描边', '透明'] },
  doughnutlegend: { title: '图例环形', presets: ['右图例', '底图例', '百分比', '细环'] },
  barline: { title: '柱线双轴', presets: ['左柱右线', '粗线', '面积线', '对比色'] },
  pieexplode: { title: '分离饼图', presets: ['突出1', '突出2', '全分离', '描边'] },
  bubblepack: { title: '气泡矩阵', presets: ['稀疏', '中等', '密集', '彩色'] },
  sparkbar: { title: '迷你柱列', presets: ['细', '中', '宽', '圆角'] },
  areaRange: { title: '区间面积', presets: ['带状', '透明', '双色', '平滑'] },
  categoryPie: { title: '分类占比', presets: ['6类', '描边', '环形', '旋转'] },
  weekday: { title: '工作日对比', presets: ['柱', '线', '面积', '分组'] },
  kpi: { title: 'KPI 环', presets: ['目标', '完成', '双KPI', '粗环'] },
};

function randSeries(n, base = 40, spread = 60) {
  const out = [];
  let v = base + Math.random() * spread * 0.4;
  for (let i = 0; i < n; i++) {
    v = Math.max(4, v + (Math.random() - 0.48) * spread * 0.35);
    out.push(Math.round(v));
  }
  return out;
}

function rgba(hex, a) {
  try {
    const [r, g, b] = colorToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  } catch {
    return hex;
  }
}

function shiftHex(hex, deg) {
  try {
    const [r, g, b] = colorToRgb(hex);
    // simple channel rotate
    const rr = Math.min(255, Math.max(0, r + deg));
    const gg = Math.min(255, Math.max(0, g + ((deg * 2) % 80) - 20));
    const bb = Math.min(255, Math.max(0, b - deg));
    return `#${[rr, gg, bb].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return hex;
  }
}

function labelsFor(n, kind = 'week') {
  if (kind === 'month') return LABELS12.slice(0, Math.min(n, 12));
  if (kind === 'cat') return CAT5.slice(0, Math.min(n, 5));
  if (kind === 'isp') return CAT6.slice(0, Math.min(n, 6));
  if (n <= 7) return LABELS7.slice(0, n);
  return Array.from({ length: n }, (_, i) => `${i + 1}`);
}

function buildConfig(type, style, ctrl) {
  const color = ctrl.color || '#818cf8';
  const color2 = ctrl.color2 || shiftHex(color, 40);
  const color3 = ctrl.color3 || shiftHex(color, -50);
  const points = Math.round(ctrl.points ?? 12);
  const tension = Number(ctrl.tension ?? 0.35);
  const fill = !!ctrl.fill;
  const legend = ctrl.legend !== false;
  const border = Number(ctrl.border ?? 2);
  const animMs = Math.max(0, Math.round(1200 / (Number(ctrl.speed) || 1)));
  const n = Math.max(3, Math.min(48, points));

  const darkTicks = { color: '#93a0c0' };
  const grid = { color: '#24314f' };
  const legendOpt = { display: legend, labels: { color: '#c7d2fe', boxWidth: 12 } };
  const anim = { duration: animMs, easing: 'easeOutQuart' };

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: anim,
    plugins: { legend: legendOpt },
  };

  const xyScales = {
    x: { ticks: darkTicks, grid },
    y: { ticks: darkTicks, grid, beginAtZero: true },
  };

  const mkLine = (extra = {}) => ({
    type: 'line',
    data: {
      labels: labelsFor(n),
      datasets: [{
        label: '序列 A',
        data: randSeries(n),
        borderColor: color,
        backgroundColor: rgba(color, fill || extra.fill ? 0.25 : 0),
        fill: fill || !!extra.fill,
        tension: extra.stepped ? 0 : tension,
        borderWidth: border,
        borderDash: extra.dash || [],
        pointRadius: extra.pointRadius ?? 3,
        stepped: extra.stepped || false,
        ...extra.ds,
      }],
    },
    options: { ...baseOpts, scales: xyScales, ...extra.options },
  });

  switch (type) {
    case 'line': {
      const styles = [
        { tension, fill: false },
        { tension: 0, fill: false },
        { tension, dash: [6, 4], fill: false },
        { tension, border: border + 2, pointRadius: 5 },
        { tension, pointRadius: 6, fill: false },
      ][style % 5];
      return mkLine(styles);
    }
    case 'multiline': {
      return {
        type: 'line',
        data: {
          labels: labelsFor(n),
          datasets: [
            { label: 'A', data: randSeries(n), borderColor: color, backgroundColor: rgba(color, 0.15), fill: style === 3, tension, borderWidth: border },
            { label: 'B', data: randSeries(n, 30, 50), borderColor: color2, backgroundColor: rgba(color2, 0.15), fill: style === 3, tension, borderWidth: border },
            ...(style >= 1 ? [{ label: 'C', data: randSeries(n, 20, 40), borderColor: color3, backgroundColor: rgba(color3, 0.12), fill: false, tension, borderWidth: border }] : []),
          ],
        },
        options: { ...baseOpts, scales: xyScales },
      };
    }
    case 'area':
      return mkLine({ fill: true, pointRadius: style === 0 ? 0 : 3 });
    case 'stepline': {
      const modes = ['before', 'after', 'middle', 'before'];
      return mkLine({ stepped: modes[style % 4], dash: style === 3 ? [4, 3] : [], fill: false, tension: 0 });
    }
    case 'bar':
    case 'density':
    case 'weekday':
    case 'sparkbar': {
      const bw = type === 'sparkbar' ? (0.4 + style * 0.15) : (style === 2 ? 0.35 : style === 3 ? 0.85 : 0.6);
      return {
        type: 'bar',
        data: {
          labels: type === 'weekday' ? LABELS7 : labelsFor(n, type === 'density' ? 'month' : 'week'),
          datasets: [{
            label: '数值',
            data: randSeries(type === 'weekday' ? 7 : n),
            backgroundColor: rgba(color, 0.75),
            borderColor: color,
            borderWidth: 1,
            borderRadius: style === 0 || type === 'sparkbar' && style === 3 ? 8 : 2,
            barPercentage: bw,
          }],
        },
        options: { ...baseOpts, scales: xyScales, plugins: { legend: { display: type !== 'sparkbar' && legend, labels: legendOpt.labels } } },
      };
    }
    case 'hbar':
    case 'horizstack': {
      const stacked = type === 'horizstack';
      const datasets = stacked
        ? [color, color2, color3].map((c, i) => ({
            label: `层${i + 1}`,
            data: randSeries(Math.min(n, 8), 10, 30),
            backgroundColor: rgba(c, 0.8),
            borderRadius: style === 2 ? 6 : 0,
          }))
        : [{
            label: '数值',
            data: randSeries(Math.min(n, 8), 20, 70),
            backgroundColor: rgba(color, 0.8),
            borderRadius: style === 1 ? 8 : 0,
          }];
      return {
        type: 'bar',
        data: { labels: labelsFor(Math.min(n, 8), 'cat'), datasets },
        options: {
          ...baseOpts,
          indexAxis: 'y',
          scales: {
            x: { stacked, ticks: darkTicks, grid, beginAtZero: true },
            y: { stacked, ticks: darkTicks, grid },
          },
        },
      };
    }
    case 'stackedbar':
    case 'groupedbar': {
      const stacked = type === 'stackedbar';
      const pct = stacked && style === 1;
      const raw = [0, 1, 2].map((i) => randSeries(Math.min(n, 10), 15 + i * 5, 35));
      let datasets = raw.map((data, i) => ({
        label: `系列 ${i + 1}`,
        data,
        backgroundColor: rgba([color, color2, color3][i], 0.8),
        borderRadius: style === 2 ? 6 : 0,
        barPercentage: style === 3 ? 0.4 : 0.7,
      }));
      if (pct) {
        datasets = datasets.map((ds, i) => ({
          ...ds,
          data: ds.data.map((_, idx) => {
            const sum = raw.reduce((s, arr) => s + arr[idx], 0) || 1;
            return Math.round((raw[i][idx] / sum) * 100);
          }),
        }));
      }
      return {
        type: 'bar',
        data: { labels: labelsFor(Math.min(n, 10)), datasets },
        options: {
          ...baseOpts,
          scales: {
            x: { stacked, ticks: darkTicks, grid },
            y: { stacked, ticks: darkTicks, grid, beginAtZero: true, max: pct ? 100 : undefined },
          },
        },
      };
    }
    case 'stackedarea':
    case 'areaRange': {
      return {
        type: 'line',
        data: {
          labels: labelsFor(n),
          datasets: [color, color2, color3].map((c, i) => ({
            label: `层${i + 1}`,
            data: randSeries(n, 15 + i * 8, 30),
            borderColor: c,
            backgroundColor: rgba(c, 0.35),
            fill: true,
            tension: style === 1 ? 0.45 : tension,
            borderWidth: border,
            pointRadius: 0,
          })),
        },
        options: { ...baseOpts, scales: { ...xyScales, y: { ...xyScales.y, stacked: true } } },
      };
    }
    case 'pie':
    case 'pieexplode':
    case 'categoryPie': {
      const cats = type === 'categoryPie' ? CAT6 : CAT5;
      const m = cats.length;
      const data = randSeries(m, 12, 40);
      const colors = [color, color2, color3, shiftHex(color, 70), shiftHex(color2, 30), shiftHex(color3, 50)].slice(0, m);
      const offset = type === 'pieexplode'
        ? (style === 2 ? data.map(() => 12) : data.map((_, i) => (i === style % m ? 18 : 0)))
        : undefined;
      return {
        type: 'pie',
        data: {
          labels: cats,
          datasets: [{
            data,
            backgroundColor: colors.map((c) => rgba(c, 0.85)),
            borderColor: '#0b1020',
            borderWidth: style === 1 || style === 3 ? 3 : 1,
            offset,
          }],
        },
        options: {
          ...baseOpts,
          rotation: style === 2 ? 45 * Math.PI / 180 : 0,
          plugins: { legend: legendOpt },
        },
      };
    }
    case 'doughnut':
    case 'doughnutlegend':
    case 'progress':
    case 'kpi':
    case 'gauge': {
      if (type === 'gauge' || type === 'progress' || type === 'kpi') {
        const val = 55 + Math.round(Math.random() * 35);
        const cut = type === 'gauge' && style === 0 ? 50 : (type === 'gauge' && style === 1 ? 0 : 25);
        const thick = style === 2 ? 18 : style === 3 ? 6 : 12;
        return {
          type: 'doughnut',
          data: {
            labels: ['已完成', '剩余'],
            datasets: [{
              data: [val, 100 - val],
              backgroundColor: [rgba(color, 0.9), '#1c2744'],
              borderWidth: 0,
              circumference: 360 - cut * 3.6,
              rotation: cut ? 225 : -90,
            }],
          },
          options: {
            ...baseOpts,
            cutout: `${Math.max(40, 78 - thick)}%`,
            plugins: {
              legend: { display: false },
              title: {
                display: true,
                text: `${val}%`,
                color: '#e8eefc',
                font: { size: 28, weight: '700' },
              },
            },
          },
        };
      }
      const m = 5;
      return {
        type: 'doughnut',
        data: {
          labels: CAT5,
          datasets: [{
            data: randSeries(m, 10, 40),
            backgroundColor: [color, color2, color3, shiftHex(color, 60), shiftHex(color2, -40)].map((c) => rgba(c, 0.85)),
            borderWidth: 2,
            borderColor: '#0b1020',
          }],
        },
        options: {
          ...baseOpts,
          cutout: style === 1 ? '78%' : style === 2 ? '45%' : '62%',
          plugins: {
            legend: {
              display: legend,
              position: type === 'doughnutlegend' && style === 0 ? 'right' : 'bottom',
              labels: legendOpt.labels,
            },
          },
        },
      };
    }
    case 'radar':
    case 'radarfill': {
      const labs = ['速度', '稳定', '成本', '易用', '扩展', '安全'];
      const ds = (c, label, alpha) => ({
        label,
        data: labs.map(() => 40 + Math.round(Math.random() * 55)),
        borderColor: c,
        backgroundColor: rgba(c, alpha),
        borderWidth: border,
        pointBackgroundColor: c,
      });
      const datasets = style >= 1
        ? [ds(color, 'A', 0.25), ds(color2, 'B', 0.2), ...(style >= 2 ? [ds(color3, 'C', 0.15)] : [])]
        : [ds(color, '评分', 0.3)];
      return {
        type: 'radar',
        data: { labels: labs, datasets },
        options: {
          ...baseOpts,
          scales: {
            r: {
              angleLines: { color: '#24314f' },
              grid: { color: '#24314f' },
              pointLabels: { color: '#c7d2fe' },
              ticks: { display: false, backdropColor: 'transparent' },
              suggestedMin: 0,
              suggestedMax: 100,
            },
          },
        },
      };
    }
    case 'polar': {
      return {
        type: 'polarArea',
        data: {
          labels: CAT5,
          datasets: [{
            data: randSeries(5, 20, 60),
            backgroundColor: [color, color2, color3, shiftHex(color, 55), shiftHex(color2, -35)].map((c) => rgba(c, 0.7)),
            borderWidth: style === 1 ? 2 : 0,
          }],
        },
        options: {
          ...baseOpts,
          scales: {
            r: {
              grid: { color: '#24314f' },
              ticks: { display: false, backdropColor: 'transparent' },
            },
          },
        },
      };
    }
    case 'scatter':
    case 'bubble':
    case 'bubblepack': {
      const mkPts = (count, withR) => Array.from({ length: count }, () => ({
        x: Math.round(Math.random() * 100),
        y: Math.round(Math.random() * 100),
        ...(withR ? { r: 4 + Math.random() * (type === 'bubblepack' ? 18 : 14) } : {}),
      }));
      const count = type === 'bubblepack' ? (style === 0 ? 12 : style === 1 ? 20 : style === 2 ? 36 : 28) : Math.max(8, Math.round(n * 1.5));
      const multi = style >= 2 && type === 'scatter';
      return {
        type: type === 'scatter' ? 'scatter' : 'bubble',
        data: {
          datasets: [
            { label: 'A', data: mkPts(count, type !== 'scatter'), backgroundColor: rgba(color, 0.65), borderColor: color },
            ...(multi || type === 'bubblepack' && style === 3
              ? [{ label: 'B', data: mkPts(Math.round(count * 0.7), type !== 'scatter'), backgroundColor: rgba(color2, 0.55), borderColor: color2 }]
              : []),
          ],
        },
        options: {
          ...baseOpts,
          scales: {
            x: { ticks: darkTicks, grid, min: 0, max: 100 },
            y: { ticks: darkTicks, grid, min: 0, max: 100 },
          },
        },
      };
    }
    case 'mixed':
    case 'combo':
    case 'barline': {
      const dual = type === 'barline' || style === 1;
      return {
        data: {
          labels: labelsFor(Math.min(n, 12)),
          datasets: [
            {
              type: 'bar',
              label: '柱',
              data: randSeries(Math.min(n, 12), 30, 50),
              backgroundColor: rgba(color, 0.7),
              borderRadius: 4,
              yAxisID: 'y',
              order: 2,
            },
            {
              type: 'line',
              label: '线',
              data: randSeries(Math.min(n, 12), 40, 40),
              borderColor: color2,
              backgroundColor: rgba(color2, style === 2 || type === 'combo' ? 0.2 : 0),
              fill: style === 2 || type === 'combo',
              tension,
              borderWidth: border + (style === 1 ? 1 : 0),
              yAxisID: dual ? 'y1' : 'y',
              order: 1,
            },
          ],
        },
        options: {
          ...baseOpts,
          scales: {
            x: { ticks: darkTicks, grid },
            y: { ticks: darkTicks, grid, beginAtZero: true, position: 'left' },
            ...(dual ? { y1: { ticks: darkTicks, grid: { drawOnChartArea: false }, position: 'right', beginAtZero: true } } : {}),
          },
        },
      };
    }
    case 'sparkline': {
      return {
        type: 'line',
        data: {
          labels: labelsFor(n),
          datasets: [{
            data: randSeries(n, 30, 40),
            borderColor: color,
            backgroundColor: rgba(color, style === 1 ? 0.3 : 0),
            fill: style === 1,
            tension: style === 2 ? 0 : tension,
            stepped: style === 2,
            borderWidth: style === 0 ? 1.5 : border,
            pointRadius: 0,
          }],
        },
        options: {
          ...baseOpts,
          plugins: { legend: { display: false } },
          scales: style === 3
            ? { x: { display: false }, y: { display: false } }
            : { x: { display: false, grid: { display: false } }, y: { display: false, grid: { display: false } } },
        },
      };
    }
    case 'waterfall': {
      // emulate waterfall with floating bars via base+height trick using two datasets
      const steps = randSeries(Math.min(n, 8), 10, 25).map((v, i) => (i % 3 === 2 ? -v : v));
      let acc = 40;
      const base = [];
      const mid = [];
      steps.forEach((v) => {
        if (v >= 0) { base.push(acc); mid.push(v); acc += v; }
        else { acc += v; base.push(acc); mid.push(-v); }
      });
      return {
        type: 'bar',
        data: {
          labels: labelsFor(steps.length),
          datasets: [
            { label: 'base', data: base, backgroundColor: 'transparent', stack: 'w' },
            {
              label: '变动',
              data: mid,
              backgroundColor: steps.map((v) => rgba(v >= 0 ? color : color2, 0.85)),
              stack: 'w',
              borderRadius: 4,
            },
          ],
        },
        options: {
          ...baseOpts,
          plugins: { legend: { display: false } },
          scales: {
            x: { stacked: true, ticks: darkTicks, grid },
            y: { stacked: true, ticks: darkTicks, grid, beginAtZero: true },
          },
        },
      };
    }
    case 'logline': {
      const cfg = mkLine({ fill: style === 2 });
      cfg.data.datasets[0].data = randSeries(n, 5, 80).map((v) => Math.max(1, v));
      if (style === 3) {
        cfg.data.datasets.push({
          label: 'B',
          data: randSeries(n, 8, 60).map((v) => Math.max(1, v)),
          borderColor: color2,
          backgroundColor: rgba(color2, 0),
          tension,
          borderWidth: border,
        });
      }
      cfg.options.scales = {
        x: { ticks: darkTicks, grid },
        y: { type: 'logarithmic', ticks: darkTicks, grid },
      };
      return cfg;
    }
    case 'realtime': {
      const data = randSeries(n, 40, 30);
      return {
        type: 'line',
        data: {
          labels: labelsFor(n),
          datasets: [
            {
              label: '流',
              data,
              borderColor: color,
              backgroundColor: rgba(color, style === 3 ? 0.25 : 0),
              fill: style === 3,
              tension,
              borderWidth: border,
              pointRadius: 0,
            },
            ...(style === 2 ? [{
              label: '流2',
              data: randSeries(n, 30, 25),
              borderColor: color2,
              tension,
              borderWidth: border,
              pointRadius: 0,
            }] : []),
          ],
        },
        options: { ...baseOpts, scales: xyScales },
        _realtime: true,
      };
    }
    default:
      return mkLine();
  }
}

export function mount(host, opts = {}) {
  const parsed = parseVariant(opts.variant || 'line', 'line');
  const family = TYPE_META[parsed.family] ? parsed.family : 'line';
  const meta = TYPE_META[family];
  const presets = (opts.presets && opts.presets.length) ? opts.presets : meta.presets;

  let chart;
  let timer;
  let Chart;
  let disposed = false;

  const ui = panel(host, meta.title, {
    presets,
    params: [
      { key: 'color', type: 'color', label: '主色', value: '#818cf8' },
      { key: 'color2', type: 'color', label: '辅色', value: '#22d3ee' },
      { key: 'points', type: 'range', label: '数据点', min: 4, max: 36, step: 1, value: 12, buttons: true },
      { key: 'speed', type: 'range', label: '动画速度', min: 0.3, max: 2.5, step: 0.1, value: 1 },
      { key: 'tension', type: 'range', label: '曲线张力', min: 0, max: 1, step: 0.05, value: 0.35 },
      { key: 'border', type: 'range', label: '线宽', min: 1, max: 6, step: 0.5, value: 2 },
      { key: 'fill', type: 'toggle', label: '填充', value: family === 'area' || family === 'stackedarea' },
      { key: 'legend', type: 'toggle', label: '图例', value: true },
    ],
    actions: [
      { key: 'reshuffle', label: '换数据' },
      { key: 'reset', label: '重置' },
    ],
    presetIndex: parsed.style % presets.length,
    onChange(state, metaInfo) {
      if (metaInfo.reason === 'action' && metaInfo.key === 'reset') {
        ui.set({
          color: '#818cf8', color2: '#22d3ee', points: 12, speed: 1,
          tension: 0.35, border: 2, fill: false, legend: true, style: 0, styleName: presets[0],
        });
        rebuild(ui.get());
        return;
      }
      rebuild(state);
    },
  });

  const canvas = document.createElement('canvas');
  ui.stage.style.padding = '12px';
  ui.stage.appendChild(canvas);

  async function ensureChart() {
    if (Chart) return Chart;
    const mod = await import(/* @vite-ignore */ CDN);
    Chart = mod.Chart || mod.default;
    return Chart;
  }

  async function rebuild(state) {
    if (disposed) return;
    const C = await ensureChart();
    if (disposed) return;
    if (timer) { clearInterval(timer); timer = null; }
    if (chart) { try { chart.destroy(); } catch (_) {} chart = null; }

    const style = state.style ?? 0;
    const cfg = buildConfig(family, style, state);
    const ctx = canvas.getContext('2d');
    chart = new C(ctx, cfg);

    if (cfg._realtime) {
      timer = setInterval(() => {
        if (!chart || disposed) return;
        const ds = chart.data.datasets[0];
        ds.data.push(Math.max(4, (ds.data[ds.data.length - 1] || 40) + (Math.random() - 0.45) * 18));
        ds.data.shift();
        chart.data.datasets.slice(1).forEach((d) => {
          d.data.push(Math.max(4, (d.data[d.data.length - 1] || 30) + (Math.random() - 0.45) * 14));
          d.data.shift();
        });
        chart.update('none');
      }, Math.max(200, 900 / (Number(state.speed) || 1)));
    }
  }

  rebuild(ui.get());

  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
    try { chart?.destroy(); } catch (_) {}
    try { ui.destroy?.(); } catch (_) {}
    host.innerHTML = '';
  };
}
