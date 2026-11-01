/** Live readout rows + explanation content for kit-convert families. */
import { fmt, F, frac } from './info-panel.js';

const n = (x, d = 2) => `<span class="n">${fmt(x, d)}</span>`;
const hm = (h) => { const H = Math.floor(h), M = Math.floor((h % 1) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
const SLIDER = ['底部滑条', '拖动设定基准值（读数实时跟随）'];
const COMMON = [['颜色', '强调色'], ['速度', '基准值的微小自动波动']];

export const CONVERT_DOCS = {
  temperature: {
    title: '温度换算',
    tip: '拖动底部滑条设定摄氏温度',
    rows: (v) => [['摄氏 °C', fmt(v.c, 2)], ['华氏 °F', fmt(v.f, 2)], ['开尔文 K', fmt(v.k, 2)], ['兰氏 °R', fmt(v.r, 2)], ['相对冰点', `${v.c >= 0 ? '+' : ''}${fmt(v.c, 1)} °C`], ['状态(水)', v.c <= 0 ? '冰' : v.c >= 100 ? '汽' : '液']],
    formula: F(`°F = °C × ${frac('9', '5')} + 32`) + F('K = °C + 273.15') + F(`°R = K × ${frac('9', '5')}`),
    explain: '摄氏与开尔文刻度间隔相同、只差零点；华氏与兰氏刻度间隔是摄氏的 5/9。−40° 时摄氏与华氏数值相等。',
    params: [SLIDER, ['尺寸', '未拖动时的默认温度'], ['预设', '冰点 / 常温 / 沸点旁'], ...COMMON],
    example: (v) => `<ol><li>°F = ${n(v.c)} × 1.8 + 32 = ${n(v.f)}</li><li>K = ${n(v.c)} + 273.15 = ${n(v.k)}</li><li>°R = ${n(v.k)} × 1.8 = ${n(v.r)}</li></ol>`,
  },
  timezone: {
    title: '世界时差',
    tip: '拖动底部滑条设定 UTC 时间',
    rows: (v) => [['UTC', hm(v.utcH)], ...(v.cities || []).map((c) => [`${c.name} (UTC${c.offset >= 0 ? '+' : ''}${c.offset})`, `${hm(c.local)}${c.local < 6 || c.local >= 19 ? ' 🌙' : ''}`])],
    formula: F('本地时间 = UTC + 时区偏移（mod 24）') + F('两地时差 = 偏移₁ − 偏移₂'),
    explain: '地球每小时自转 15°，全球按经度划分时区。UTC 是基准时间；向东每个时区 +1 小时。示例未考虑夏令时。',
    params: [SLIDER, ['数量', '显示城市数（3–8）'], ['速度', '自动走时快慢'], ['预设', '亚洲 / 欧美 / 多城'], ['颜色', '强调色']],
    example: (v) => { const c = (v.cities || [])[0] || { name: '—', offset: 0, local: 0 }; return `<ol><li>UTC = ${hm(v.utcH)}</li><li>${c.name}：${hm(v.utcH)} + ${c.offset} h = ${hm(c.local)}</li></ol>`; },
  },
  mass: {
    title: '质量换算',
    tip: '拖动底部滑条设定千克数',
    rows: (v) => [['千克 kg', fmt(v.kg, 3)], ['克 g', fmt(v.kg * 1000, 1)], ['磅 lb', fmt(v.kg * 2.20462262, 3)], ['盎司 oz', fmt(v.kg * 35.2739619, 2)], ['斤', fmt(v.kg * 2, 3)], ['两', fmt(v.kg * 20, 2)]],
    formula: F('1 kg = 1000 g = 2 斤 = 20 两') + F('1 lb = 0.45359237 kg，1 lb = 16 oz'),
    explain: '公制以 10 为进位；英制 1 磅 = 16 盎司；市制 1 斤 = 500 g = 10 两。',
    params: [SLIDER, ['尺寸 / 预设', '默认基准（轻物/厨房/货运…）'], ...COMMON],
    example: (v) => `<ol><li>lb = ${n(v.kg, 3)} ÷ 0.45359 = ${n(v.kg * 2.20462262, 3)}</li><li>oz = lb × 16 = ${n(v.kg * 35.2739619)}</li><li>斤 = kg × 2 = ${n(v.kg * 2, 3)}</li></ol>`,
  },
  length: {
    title: '长度换算',
    tip: '拖动底部滑条（对数刻度）',
    rows: (v) => [['米 m', fmt(v.m, 3)], ['千米 km', fmt(v.m / 1000, 4)], ['英里 mile', fmt(v.m / 1609.344, 4)], ['英尺 ft', fmt(v.m / 0.3048, 2)], ['英寸 in', fmt(v.m / 0.0254, 1)], ['市里', fmt(v.m / 500, 4)], ['海里 nmi', fmt(v.m / 1852, 4)], ['画布行数', String(v.show)]],
    formula: F('1 mile = 1609.344 m，1 ft = 0.3048 m，1 in = 2.54 cm') + F('1 nmi = 1852 m，1 里 = 500 m'),
    explain: '滑条是对数刻度：从约 1 m 到约 500 km，每移动 1/6 长度放大 10 倍，方便跨数量级对比。',
    params: [SLIDER, ['尺寸', '基准倍率'], ['数量', '画布显示的单位行数'], ...COMMON.slice(0, 1)],
    example: (v) => `<ol><li>${n(v.m)} m ÷ 1609.344 = ${n(v.m / 1609.344, 4)} mile</li><li>${n(v.m)} m ÷ 0.3048 = ${n(v.m / 0.3048)} ft</li></ol>`,
  },
  'area-volume': {
    title: '面积 / 体积换算',
    tip: '拖动底部滑条；数量奇偶切换面积/体积',
    rows: (v) => v.mode === 0
      ? [['模式', '面积'], ['平方米 m²', fmt(v.m2, 2)], ['公顷 ha', fmt(v.m2 / 10000, 4)], ['英亩 acre', fmt(v.m2 / 4046.8564224, 4)], ['坪', fmt(v.m2 / 3.305785, 2)], ['亩', fmt(v.m2 / 666.667, 3)]]
      : [['模式', '体积'], ['升 L', fmt(v.liters, 3)], ['毫升 ml', fmt(v.liters * 1000, 1)], ['美制加仑 gal', fmt(v.liters / 3.785411784, 3)], ['立方米 m³', fmt(v.liters / 1000, 4)]],
    formula: (v) => v.mode === 0 ? F('1 ha = 10 000 m²，1 acre ≈ 4046.86 m²') + F('1 坪 ≈ 3.3058 m²，1 亩 ≈ 666.67 m²') : F('1 L = 1000 ml = 1 dm³') + F('1 gal(US) = 3.785 L，1 m³ = 1000 L'),
    explain: '面积单位是长度单位的平方，体积是立方：长度扩大 10 倍，面积扩大 100 倍、体积扩大 1000 倍。',
    params: [SLIDER, ['数量 / 预设', '奇偶切换 面积 ↔ 体积'], ['尺寸', '基准倍率'], ...COMMON.slice(0, 1)],
    example: (v) => v.mode === 0 ? `<ol><li>${n(v.m2)} m² ÷ 10000 = ${n(v.m2 / 10000, 4)} ha</li><li>÷ 4046.86 = ${n(v.m2 / 4046.8564224, 4)} acre</li></ol>` : `<ol><li>${n(v.liters, 3)} L ÷ 3.785 = ${n(v.liters / 3.785411784, 3)} gal</li><li>÷ 1000 = ${n(v.liters / 1000, 4)} m³</li></ol>`,
  },
  radix: {
    title: '进制转换',
    tip: '点击比特翻转，或拖动底部滑条设定数值',
    rows: (v) => [['十进制', String(v.use)], ['二进制', v.bin || '—', null, 'wide'], ['八进制', (v.use ?? 0).toString(8)], ['十六进制', `0x${(v.use ?? 0).toString(16).toUpperCase()}`], ['位宽', `${v.bits} bit`], ['1 的个数', String((v.bin || '').split('').filter((c) => c === '1').length)], ['模式', v.user ? '手动' : '自动递增']],
    formula: F('N = Σ bᵢ · 2ⁱ') + F('1 位十六进制 = 4 位二进制，1 位八进制 = 3 位二进制'),
    explain: '同一个数换不同底数书写。二进制每一位代表 2 的幂；把二进制每 4 位一组就能直接读出十六进制。',
    params: [['点击比特', '翻转该位（XOR）'], SLIDER, ['数量', '位宽 (count+4)'], ['尺寸', '自动模式的起始值'], ['速度', '自动递增速度'], ['颜色', '强调色']],
    example: (v) => { const bin = v.bin || ''; const terms = bin.split('').map((b, i) => (b === '1' ? `2^${bin.length - 1 - i}` : null)).filter(Boolean); return `<ol><li>${bin}₂ = ${terms.join(' + ') || '0'}</li><li>= ${n(v.use, 0)}₁₀ = 0x${(v.use ?? 0).toString(16).toUpperCase()}</li></ol>`; },
  },
  speed: {
    title: '速度换算',
    tip: '拖动底部滑条设定 km/h',
    rows: (v) => [['km/h', fmt(v.kmh, 2)], ['mph', fmt(v.kmh / 1.609344, 2)], ['m/s', fmt(v.kmh / 3.6, 3)], ['节 knot', fmt(v.kmh / 1.852, 2)], ['马赫(海平面)', fmt(v.kmh / 1225, 4)], ['跑 100 m', `${fmt(360 / v.kmh, 2)} s`]],
    formula: F('1 m/s = 3.6 km/h') + F('1 mph = 1.609344 km/h，1 knot = 1.852 km/h'),
    explain: 'km/h ÷ 3.6 得到 m/s（1000 m / 3600 s）。航海航空常用“节”，即每小时 1 海里。',
    params: [SLIDER, ['尺寸 / 预设', '步行 / 车速 / 高铁 / 航速'], ...COMMON],
    example: (v) => `<ol><li>${n(v.kmh)} km/h ÷ 3.6 = ${n(v.kmh / 3.6, 3)} m/s</li><li>÷ 1.609 = ${n(v.kmh / 1.609344)} mph</li></ol>`,
  },
  pressure: {
    title: '压力换算',
    tip: '拖动底部滑条设定 bar',
    rows: (v) => [['bar', fmt(v.bar, 3)], ['kPa', fmt(v.bar * 100, 2)], ['psi', fmt(v.bar * 14.5037738, 2)], ['atm', fmt(v.bar / 1.01325, 3)], ['mmHg', fmt(v.bar * 750.062, 1)], ['水柱 m', fmt(v.bar * 10.197, 2)]],
    formula: F('1 bar = 100 kPa = 10⁵ Pa') + F('1 atm = 1.01325 bar = 760 mmHg ≈ 14.696 psi'),
    explain: '压强 = 力 / 面积。1 atm 是海平面大气压；水下每深 10 m 约增加 1 bar。',
    params: [SLIDER, ['尺寸 / 预设', '低压 / 常压 / 高压'], ...COMMON],
    example: (v) => `<ol><li>${n(v.bar, 3)} bar × 100 = ${n(v.bar * 100)} kPa</li><li>× 14.504 = ${n(v.bar * 14.5037738)} psi</li><li>÷ 1.01325 = ${n(v.bar / 1.01325, 3)} atm</li></ol>`,
  },
  energy: {
    title: '能量换算',
    tip: '拖动底部滑条（对数刻度）',
    rows: (v) => [['焦耳 J', fmt(v.J, 2)], ['卡路里 cal', fmt(v.J / 4.184, 2)], ['千卡 kcal', fmt(v.J / 4184, 3)], ['千瓦时 kWh', fmt(v.J / 3.6e6, 5)], ['电子伏特 eV', fmt(v.J / 1.602176634e-19, 3)], ['画布卡片', String(v.show)]],
    formula: F('1 cal = 4.184 J，1 kWh = 3.6 × 10⁶ J') + F('1 eV = 1.602 × 10⁻¹⁹ J'),
    explain: '焦耳是国际单位；食物热量常用千卡（大卡），电费按千瓦时（度）计算；微观粒子用电子伏特。',
    params: [SLIDER, ['尺寸', '基准倍率'], ['数量', '卡片数与格点数'], ...COMMON.slice(0, 1)],
    example: (v) => `<ol><li>${n(v.J)} J ÷ 4.184 = ${n(v.J / 4.184)} cal</li><li>÷ 3.6e6 = ${n(v.J / 3.6e6, 5)} kWh（度）</li></ol>`,
  },
};
