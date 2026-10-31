#!/usr/bin/env python3
"""Generate ≥300 interactive demo registry + kit modules for clyune-component."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path("/workspace/clyune-component")
FE = ROOT / "frontend"
BE = ROOT / "backend"
KITS = FE / "src" / "demos" / "kits"

# ---------- Base demos (existing 40) ----------
BASE = [
  ("threejs","Three.js","◈","基于 WebGL 的 3D 渲染库：场景、相机、光照、材质与自定义着色器。",["three@0.170","WebGL","OrbitControls"],[
    ("cube","Rotating Cube","自动旋转 · MeshStandardMaterial","基础场景、光照与线框。","basics","cube","mountCube"),
    ("orbit","Orbit + Lights","拖拽旋转 · 滚轮缩放","OrbitControls 与多光源。","controls","orbit","mountOrbit"),
    ("particles","Particles","移动鼠标扰动粒子场","Points 粒子场与鼠标交互。","points","particles","mountParticles"),
    ("gallery","Geometry Gallery","点击几何体切换高亮","内置几何体与射线拾取。","geometry","gallery","mountGallery"),
    ("wave","Wave Terrain","程序化起伏地形","顶点动画生成地形。","terrain","wave","mountWave"),
    ("character","Character","程序化角色 · 摆臂动画","层级模型与骨骼式动画。","model","gltf-shapes","mountGltfShapes"),
    ("shader","Shader Blob","自定义顶点/片元着色器","ShaderMaterial 变形球体。","shader","shader-blob","mountShaderBlob"),
  ]),
  ("charts","Charts","▦","Chart.js 轻量图表：响应式折线、柱状与环形图。",["Chart.js 4","Canvas"],[
    ("line","Line Chart","Chart.js 折线图","多序列趋势折线。","line","charts-line","mountChartLine"),
    ("bar","Bar Chart","Chart.js 柱状图","三网延迟对比柱状图。","bar","charts-bar","mountChartBar"),
    ("doughnut","Doughnut","Chart.js 环形图","占比环形图。","doughnut","charts-doughnut","mountChartDoughnut"),
  ]),
  ("ui","UI Components","▣","后台常用基础组件：按钮、卡片与弹层，纯 CSS + 原生 JS。",["CSS","Vanilla JS"],[
    ("buttons","Buttons","按钮变体与尺寸","按钮变体、尺寸与禁用态。","actions","ui-buttons","mountUiButtons"),
    ("cards","Cards + Modal","卡片与弹层交互","卡片布局与模态框。","overlay","ui-cards-modal","mountUiCardsModal"),
  ]),
  ("css-fx","CSS 动画与特效","✦","纯 CSS 实现的动效：@keyframes、transition、backdrop-filter、3D transform 与滚动驱动动画。",["@keyframes","transition","backdrop-filter","transform-3d","animation-timeline"],[
    ("keyframes","Keyframes 与渐变文字","悬停卡片查看 transition · 渐变流光文字","加载动画、过渡曲线对比与流光渐变文字。","keyframes","css-keyframes","mount"),
    ("glass","玻璃拟态 Glassmorphism","拖动滑块调节模糊与透明度","backdrop-filter 毛玻璃卡片与流动背景。","glass","css-glass","mount"),
    ("tilt","3D 翻转与倾斜卡片","移动指针倾斜 · 点击翻转","perspective + rotateX/Y 的 3D 卡片。","3d","css-tilt","mount"),
    ("scroll","滚动驱动动画","在面板内滚动","animation-timeline: view()，不支持时回退 IntersectionObserver。","scroll","css-scroll","mount"),
  ]),
  ("canvas","Canvas 2D","◐","HTML5 Canvas 2D 即时绘制：粒子系统、字符雨、烟花物理与手绘画板。",["CanvasRenderingContext2D","requestAnimationFrame","Pointer Events"],[
    ("network","粒子网络","移动指针吸引粒子","粒子间距离连线的经典网络背景。","particles","canvas-network","mount"),
    ("matrix","代码雨 Matrix","点击切换颜色","黑客帝国风格的字符雨。","text","canvas-matrix","mount"),
    ("fireworks","烟花","点击任意位置发射","带重力与拖尾的粒子烟花。","physics","canvas-fireworks","mount"),
    ("draw","画板","按住拖动绘画 · 支持触屏","平滑笔刷、颜色、粗细、撤销与导出 PNG。","tool","canvas-draw","mount"),
  ]),
  ("svg","SVG 动画","◇","矢量图形动画：stroke-dasharray 描边、路径插值变形与 SMIL / CSS 图标动效。",["SVG","stroke-dashoffset","path morph","SMIL"],[
    ("draw","路径描边动画","点击重播","利用 getTotalLength 实现手写描边。","stroke","svg-draw","mount"),
    ("morph","形状变形 Morph","点击按钮切换形状","同构路径点插值，平滑形变。","morph","svg-morph","mount"),
    ("icons","动画图标","点击图标切换状态","菜单/关闭、播放/暂停、加载、对勾等图标动效。","icons","svg-icons","mount"),
  ]),
  ("gsap","GSAP 动画","➶","GSAP 专业级动画引擎：时间轴编排、ScrollTrigger 滚动联动与文字逐字交错。",["gsap@3.12","Timeline","ScrollTrigger","stagger"],[
    ("timeline","Timeline 时间轴","播放 / 暂停 / 倒放 / 拖动进度","多段动画编排与进度控制。","timeline","gsap-timeline","mount"),
    ("scroll","ScrollTrigger","在面板内向下滚动","滚动进度驱动的固定、视差与进度条。","scroll","gsap-scroll","mount"),
    ("text","文字交错动画","点击重播 · 切换效果","逐字拆分 + stagger 的标题入场。","text","gsap-text","mount"),
  ]),
  ("webgl","WebGL / Shader","◉","原生 WebGL 全屏片元着色器：程序化噪声、等离子与光线步进，全部在 GPU 实时计算。",["WebGL 1","GLSL","fragment shader","raymarching"],[
    ("noise","噪声流体背景","移动指针扰动","FBM 分形噪声 + 域扭曲的流动背景。","noise","webgl-shader","mountNoise"),
    ("plasma","等离子 Plasma","经典 demoscene 效果","多重正弦叠加的彩色等离子。","plasma","webgl-shader","mountPlasma"),
    ("raymarch","光线步进 Metaballs","移动指针旋转视角","SDF 光线步进的融合球体与光照。","sdf","webgl-shader","mountRaymarch"),
  ]),
  ("physics","物理与交互","⚛","物理引擎与指针交互：Matter.js 刚体模拟、拖拽排序与磁吸 / 光标跟随效果。",["matter-js@0.20","Pointer Events","FLIP"],[
    ("matter","Matter.js 物理","拖动物体 · 点击空白处生成","重力、碰撞、弹性与鼠标约束。","matter","physics-matter","mount"),
    ("drag","拖拽排序","按住卡片拖动排序 · 支持触屏","Pointer Events + FLIP 动画的看板拖拽。","dnd","physics-drag","mount"),
    ("magnetic","磁吸与光标跟随","把指针移向按钮","磁吸按钮、弹性光标与跟随拖尾。","cursor","physics-magnetic","mount"),
  ]),
  ("audio","音频可视化","♫","Web Audio API：振荡器合成声音，AnalyserNode 提取频谱与波形并实时绘制。",["Web Audio API","OscillatorNode","AnalyserNode","getUserMedia"],[
    ("synth","合成器频谱","点击播放 · 点击琴键演奏","振荡器 + LFO 合成音色的频谱/波形可视化。","oscillator","audio-viz","mountSynth"),
    ("mic","麦克风可视化","点击按钮授权麦克风","实时麦克风输入的环形频谱（需浏览器授权）。","mic","audio-viz","mountMic"),
  ]),
  ("dataviz","数据可视化进阶","⌬","ECharts 与 D3：关系图谱、矩形树图与力导向布局，适合复杂数据结构展示。",["echarts@5.5","d3@7","force layout","treemap"],[
    ("graph","ECharts 关系图","拖动节点 · 滚轮缩放","力引导布局的技术栈关系网络。","graph","dataviz","mountGraph"),
    ("treemap","ECharts 矩形树图","点击下钻 · 面包屑返回","层级数据的矩形树图。","treemap","dataviz","mountTreemap"),
    ("d3-force","D3 力导向图","拖动节点","d3-force 模拟 + SVG 渲染。","d3","dataviz","mountD3Force"),
  ]),
  ("micro","Lottie / 微交互","❤","细节动效提升体验：Lottie 矢量动画、点赞粒子、开关与涟漪反馈。",["lottie-web@5.12","CSS","Web Animations API"],[
    ("lottie","Lottie 动画","播放 / 暂停 / 调速","lottie-web 播放内联 JSON 动画数据。","lottie","micro","mountLottie"),
    ("like","点赞与反馈","点击爱心与按钮","点赞粒子爆发、收藏、计数滚动。","like","micro","mountLike"),
    ("controls","开关与涟漪","点击各类控件","Toggle、Checkbox 描边、Material 涟漪与加载按钮。","controls","micro","mountControls"),
  ]),
]

# New categories metadata
NEW_CATS = [
  ("layout","CSS 布局玩具","▦","Flex / Grid / 容器查询等布局实验：可调间距、列数与对齐。",["CSS Grid","Flexbox","gap","container"]),
  ("filters","CSS 滤镜与混合","✧","filter / backdrop-filter / mix-blend-mode 视觉实验。",["filter","backdrop-filter","mix-blend-mode"]),
  ("particles-fx","粒子特效包","✦","Canvas 粒子套件：星空、雪、烟、引力场等可调参数变体。",["Canvas","particles","RAF"]),
  ("generative","生成艺术","◐","程序化生成图案：噪声场、细胞自动机、递归分形与随机游走。",["Canvas","noise","fractal"]),
  ("text-fx","文字特效","Aa","打字机、故障、渐变、描边、拆分入场等文字动效。",["CSS","Canvas","WAAPI"]),
  ("scroll-fx","滚动特效","↕","面板内滚动驱动的视差、进度、钉住与揭示效果。",["IntersectionObserver","scroll","parallax"]),
]

# Variant packs: (category_key, kit_mod, list of (slug, title, hint, desc, tag, variant_id))
def pack(n, cat, kit, items):
    return [(cat, kit, *it) for it in items]

VARIANTS = []

# --- expand existing via kits ---

css_fx_more = [
  (f"pulse-{i}", f"脉冲环 #{i}", "拖动滑块调节速度", f"CSS 脉冲环变体 #{i}，可调周期与颜色。", "pulse", f"pulse-{i}")
  for i in range(1, 9)
] + [
  (f"loader-{i}", f"加载器样式 {name}", "悬停暂停", f"纯 CSS 加载动画：{name}", "loader", f"loader-{i}")
  for i, name in enumerate(["环","点阵","条","方块翻转","呼吸","轨道","涟漪","交叉","双环","弹跳点","旋转三角","进度弧"], 1)
] + [
  (f"hover-{i}", f"悬停动效 {name}", "悬停卡片", f"卡片悬停：{name}", "hover", f"hover-{i}")
  for i, name in enumerate(["上浮","缩放","边光","扫光","倾斜","边框跑马","阴影扩散","模糊聚焦","霓虹描边","磁吸位移","下划线展开","背景填充"], 1)
] + [
  (f"grad-{i}", f"渐变流动 {i}", "自动播放", f"多色渐变背景流动 #{i}", "gradient", f"grad-{i}")
  for i in range(1, 9)
] + [
  (f"ease-{i}", f"缓动曲线 {name}", "点击重播对比", f"CSS transition-timing-function：{name}", "easing", f"ease-{i}")
  for i, name in enumerate(["linear","ease","ease-in","ease-out","ease-in-out","cubic-in","cubic-out","back","elastic感","steps","bounce感","自定义贝塞尔"], 1)
] + [
  (f"spring-{i}", f"弹簧感 {name}", "点击触发", f"近似弹簧/回弹：{name}", "spring", f"spring-{i}")
  for i, name in enumerate(["弹入","弹出","过冲缩放","橡皮筋","沉降回弹","左右晃回","旋转过冲","连环弹跳"], 1)
] + [
  (f"stagger-{i}", f"交错入场 {name}", "点击重播", f"子元素 stagger：{name}", "stagger", f"stagger-{i}")
  for i, name in enumerate(["列表淡入","卡片瀑布","网格对角","字母拆分","从中心扩散","反向收起","缩放交错","旋转交错"], 1)
] + [
  (f"flip-{i}", f"FLIP 布局 {name}", "点击打乱/排序", f"First-Last-Invert-Play：{name}", "flip", f"flip-{i}")
  for i, name in enumerate(["网格重排","列表排序","展开卡片","交换两格","过滤显隐","尺寸变形"], 1)
] + [
  (f"clip-{i}", f"Clip-path {name}", "悬停/点击变形", f"clip-path 动画：{name}", "clip", f"clip-{i}")
  for i, name in enumerate(["圆揭示","菱形","多边形","斜切","星形","波浪边","对角擦除","圆形收缩","十字","胶囊"], 1)
] + [
  (f"xform3d-{i}", f"3D Transform {name}", "拖动/悬停旋转", f"perspective 三维：{name}", "3d", f"xform3d-{i}")
  for i, name in enumerate(["立方体","翻转牌","旋转木马","层叠卡片","门轴打开","翻书","倾斜面板","球体感","棱柱","行列翻转"], 1)
] + [
  (f"trans-{i}", f"过渡属性 {name}", "悬停观察", f"CSS transition 专属属性：{name}", "transition", f"trans-{i}")
  for i, name in enumerate(["颜色","宽高","透明度","变换","阴影","圆角","字号","边框","滤镜","复合多属性"], 1)
] + [
  (f"parallax-{i}", f"视差 {name}", "移动指针或滚动", f"CSS 视差层：{name}", "parallax", f"parallax-{i}")
  for i, name in enumerate(["多层深度","指针跟随","背景慢移","前景快移","卡片深度","文字层差"], 1)
] + [
  (f"filter-{i}", f"滤镜动效 {name}", "拖动滑块", f"animated filter：{name}", "filter", f"filter-{i}")
  for i, name in enumerate(["模糊进出","饱和脉动","色相旋转","对比闪","灰度到彩色","霓虹发光","暗角呼吸","色散感"], 1)
] + [
  (f"blend-{i}", f"混合模式 {name}", "移动色块", f"mix-blend-mode：{name}", "blend", f"blend-{i}")
  for i, name in enumerate(["screen","multiply","overlay","difference","exclusion","color-dodge","hard-light","soft-light"], 1)
] + [
  (f"skeleton-{i}", f"骨架屏 {name}", "自动闪烁", f"Skeleton loading：{name}", "skeleton", f"skeleton-{i}")
  for i, name in enumerate(["卡片","列表","头像行","图表占位","文章段落","网格瓷砖"], 1)
] + [
  (f"progress-{i}", f"进度条 {name}", "点击开始", f"进度动效：{name}", "progress", f"progress-{i}")
  for i, name in enumerate(["线性","条纹不确定","环形","半环","分段步进","水波填充","像素块","渐变扫"], 1)
] + [
  (f"ripple-{i}", f"涟漪 {name}", "点击产生涟漪", f"Material/水波纹：{name}", "ripple", f"ripple-{i}")
  for i, name in enumerate(["圆心扩散","按钮内裁切","双波","彩色","方块波","长按放大"], 1)
] + [
  (f"accordion-{i}", f"手风琴 {name}", "点击展开收起", f"高度过渡手风琴：{name}", "accordion", f"accordion-{i}")
  for i, name in enumerate(["单开","多开","图标旋转","淡入内容","边框高亮","卡片式"], 1)
] + [
  (f"modal-{i}", f"弹层进出 {name}", "打开/关闭", f"Modal enter/exit：{name}", "modal", f"modal-{i}")
  for i, name in enumerate(["淡入缩放","自下滑入","自右滑入","模糊背景","弹跳入","翻转入"], 1)
] + [
  (f"carousel-{i}", f"轮播 {name}", "箭头/自动播放", f"Carousel：{name}", "carousel", f"carousel-{i}")
  for i, name in enumerate(["滑移","淡入淡出","3D 封面流","卡片堆","垂直","无限循环"], 1)
] + [
  (f"reveal-{i}", f"揭示 {name}", "点击/滚动触发", f"内容揭示：{name}", "reveal", f"reveal-{i}")
  for i, name in enumerate(["遮罩擦除","百叶窗","圆形扩散","对角线","像素块","模糊清晰"], 1)
] + [
  (f"neon-{i}", f"霓虹 {name}", "自动呼吸", f"霓虹发光字/边：{name}", "neon", f"neon-{i}")
  for i, name in enumerate(["文字","边框","按钮","图标","双色交替","故障闪"], 1)
] + [
  (f"liquid-{i}", f"液态 {name}", "悬停变形", f"液态/果冻感：{name}", "liquid", f"liquid-{i}")
  for i, name in enumerate(["按钮变形","blob 边","水滴菜单","果冻点击","波浪底边","粘滞切换"], 1)
] + [
  (f"marquee-{i}", f"跑马灯 {name}", "悬停暂停", f"无限滚动：{name}", "marquee", f"marquee-{i}")
  for i, name in enumerate(["横向文字","反向","双行","徽标带","垂直","变速"], 1)
] + [
  (f"kenburns-{i}", f"Ken Burns {i}", "自动推拉", f"图片缓动缩放平移 #{i}", "kenburns", f"kenburns-{i}")
  for i in range(1, 5)
] + [
  (f"shake-{i}", f"抖动反馈 {name}", "点击触发", f"错误/提醒抖动：{name}", "shake", f"shake-{i}")
  for i, name in enumerate(["左右","上下","旋转","弹性","心跳","震动条"], 1)
] + [
  (f"keyseq-{i}", f"关键帧序列 {name}", "播放控制", f"复杂 @keyframes：{name}", "keyframes", f"keyseq-{i}")
  for i, name in enumerate(["行走循环","加载变形","颜色节拍","路径感位移","缩放呼吸组合","旋转+位移","闪烁摩斯","多段叙事"], 1)
]
VARIANTS += pack(0, "css-fx", "kit-css", css_fx_more)

canvas_more = [
  (f"orbits-{i}", f"轨道粒子 {i}", "移动指针扰动", f"多轨粒子系统变体 #{i}", "orbit", f"orbits-{i}")
  for i in range(1, 10)
] + [
  (f"trail-{i}", f"指针拖尾 {name}", "移动画出拖尾", f"指针拖尾效果：{name}", "trail", f"trail-{i}")
  for i, name in enumerate(["霓虹","烟","星屑","墨迹","彩虹","像素","火花","光剑","萤火","水彩"], 1)
] + [
  (f"blob-{i}", f"软体 Blob {i}", "拖动变形", f"metaball 风格软体 #{i}", "blob", f"blob-{i}")
  for i in range(1, 8)
] + [
  (f"rain-{i}", f"粒子雨 {i}", "点击切换风向", f"重力粒子雨变体 #{i}", "rain", f"rain-{i}")
  for i in range(1, 8)
] + [
  (f"wave-{i}", f"波浪 {name}", "拖动振幅/频率", f"Canvas 波浪：{name}", "wave", f"wave-{i}")
  for i, name in enumerate(["正弦叠层","干涉纹","液体面","声波","海岸线","多层视差波","极坐标波","噪声波"], 1)
] + [
  (f"noise-{i}", f"噪声场 {name}", "拖动缩放", f"程序噪声：{name}", "noise", f"noise-{i}")
  for i, name in enumerate(["Value","FBM 流","域扭曲","云层","大理石","电浆","像素风","湍流"], 1)
] + [
  (f"flock-{i}", f"群体 {name}", "移动吸引点", f"Boids/群体：{name}", "flock", f"flock-{i}")
  for i, name in enumerate(["鸟群","鱼群","避障","环绕","捕食逃逸","网格对齐"], 1)
] + [
  (f"burst-{i}", f"爆发 {name}", "点击爆发", f"粒子爆发：{name}", "burst", f"burst-{i}")
  for i, name in enumerate(["烟花","彩纸","星爆","环波","像素碎","火花四射","爱心雨","字母喷"], 1)
] + [
  (f"flow-{i}", f"流场 {name}", "点击重置种子", f"向量场粒子：{name}", "flow", f"flow-{i}")
  for i, name in enumerate(["旋涡","螺旋","网格风","噪声流","吸引子","双涡"], 1)
] + [
  (f"gridwave-{i}", f"网格起伏 {i}", "移动指针扰动", f"点阵/网格顶点波动 #{i}", "grid", f"gridwave-{i}")
  for i in range(1, 7)
] + [
  (f"ink-{i}", f"墨水扩散 {i}", "点击滴墨", f"墨水/扩散模拟 #{i}", "ink", f"ink-{i}")
  for i in range(1, 5)
] + [
  (f"aurora-{i}", f"极光 {i}", "自动流动", f"极光色带 #{i}", "aurora", f"aurora-{i}")
  for i in range(1, 5)
] + [
  (f"constellation-{i}", f"星座连线 {i}", "移动成线", f"近邻连线星空 #{i}", "constellation", f"constellation-{i}")
  for i in range(1, 5)
] + [
  (f"sand-{i}", f"沙粒 {i}", "点击倾倒", f"沙漏/沙堆简化 #{i}", "sand", f"sand-{i}")
  for i in range(1, 4)
] + [
  (f"kaleido-{i}", f"万花筒 {i}", "移动图案", f"对称镜像绘制 #{i}", "kaleido", f"kaleido-{i}")
  for i in range(1, 5)
] + [
  (f"lightning-{i}", f"闪电折线 {i}", "点击放雷", f"随机闪电路径 #{i}", "lightning", f"lightning-{i}")
  for i in range(1, 4)
] + [
  (f"cloth-{i}", f"布料感 {i}", "拖拽扰动", f"弹簧网格布料简化 #{i}", "cloth", f"cloth-{i}")
  for i in range(1, 4)
] + [
  (f"spiral-{i}", f"螺旋采样 {i}", "自动旋转", f"阿基米德/对数螺旋 #{i}", "spiral", f"spiral-{i}")
  for i in range(1, 5)
] + [
  (f"tunnel-{i}", f"隧道穿梭 {i}", "前进感", f"2D 隧道伪 3D #{i}", "tunnel", f"tunnel-{i}")
  for i in range(1, 4)
]
VARIANTS += pack(0, "canvas", "kit-canvas", canvas_more)

svg_more = [
  (f"stroke-{i}", f"描边路径 {name}", "点击重播", f"SVG stroke-dash 描边：{name}", "stroke", f"stroke-{i}")
  for i, name in enumerate(["圆","星","心","波浪","折线","螺旋","六边形","字母","无穷","齿轮感","山脉","签名"], 1)
] + [
  (f"icon-anim-{i}", f"图标动效 {name}", "点击切换", f"SVG 图标状态切换：{name}", "icons", f"icon-{i}")
  for i, name in enumerate(["汉堡","播放","爱心","铃铛","搜索","下载","设置","云","勾选","箭头","菜单变X","加载弧"], 1)
] + [
  (f"morph-{i}", f"形变 Morph {i}", "点击变形", f"路径 morph 变体 #{i}", "morph", f"morph-{i}")
  for i in range(1, 10)
] + [
  (f"smil-{i}", f"SMIL/CSS 动画 {name}", "自动播放", f"SVG 声明式动画：{name}", "smil", f"smil-{i}")
  for i, name in enumerate(["animate","animateTransform","路径上运动","颜色渐变","描边呼吸","缩放弹跳","旋转齿轮","闪烁点"], 1)
] + [
  (f"dash-{i}", f"虚线流转 {name}", "调节速度", f"stroke-dashoffset 循环：{name}", "dash", f"dash-{i}")
  for i, name in enumerate(["圆环","方框","曲线","箭头流","虚线边框","多段色"], 1)
] + [
  (f"drawtext-{i}", f"文字描边 {name}", "点击重播", f"SVG 文字路径描边：{name}", "text", f"drawtext-{i}")
  for i, name in enumerate(["单行","渐变描边","逐字","弧形字","填充延迟","中文"], 1)
] + [
  (f"ring-{i}", f"环形进度 {name}", "拖动数值", f"SVG 圆环进度：{name}", "ring", f"ring-{i}")
  for i, name in enumerate(["单环","双环","刻度","渐变弧","缺口环","仪表针"], 1)
] + [
  (f"filter-svg-{i}", f"SVG 滤镜 {name}", "拖动参数", f"feGaussianBlur 等：{name}", "filter", f"filter-svg-{i}")
  for i, name in enumerate(["模糊","阴影","浮雕","湍流噪","位移贴图","色彩矩阵","形态学","光晕"], 1)
] + [
  (f"mask-{i}", f"遮罩 {name}", "移动遮罩", f"SVG mask/clipPath：{name}", "mask", f"mask-{i}")
  for i, name in enumerate(["圆形窥视","文字镂空","渐变淡出","条纹","菱形窗","跟随指针"], 1)
] + [
  (f"follow-{i}", f"路径跟随 {name}", "播放", f"物体沿 path 运动：{name}", "follow", f"follow-{i}")
  for i, name in enumerate(["圆点","箭头朝向","多点队列","往返","变速","无限符"], 1)
] + [
  (f"blob-svg-{i}", f"SVG Blob {i}", "自动变形", f"path 插值有机形 #{i}", "blob", f"blob-svg-{i}")
  for i in range(1, 6)
] + [
  (f"chart-draw-{i}", f"图表描出 {name}", "点击重播", f"折线/面积描画：{name}", "chart", f"chart-draw-{i}")
  for i, name in enumerate(["折线","面积","柱生长","雷达","饼弧","散点连"], 1)
] + [
  (f"sprite-{i}", f"图标精灵 {name}", "悬停切换", f"SVG sprite / use：{name}", "sprite", f"sprite-{i}")
  for i, name in enumerate(["状态色","线面切换","旋转集","大小集"], 1)
] + [
  (f"gradient-svg-{i}", f"渐变动画 {name}", "自动", f"linear/radialGradient 动画：{name}", "gradient", f"gradient-svg-{i}")
  for i, name in enumerate(["线性扫","径向呼吸","锥感","双停色移动","描边渐变","文字渐变"], 1)
]
VARIANTS += pack(0, "svg", "kit-svg", svg_more)

ui_more = [
  (f"input-{i}", f"输入控件 {name}", "点击/输入交互", f"表单控件演示：{name}", "form", f"input-{i}")
  for i, name in enumerate(["文本框","开关组","滑块","分段","标签输入","评分","步进器","搜索栏","进度条","通知条","密码可见","OTP 格"], 1)
] + [
  (f"nav-{i}", f"导航样式 {name}", "点击切换激活项", f"导航组件：{name}", "nav", f"nav-{i}")
  for i, name in enumerate(["侧栏","顶栏 Tabs","面包屑","分页","步骤条","胶囊菜单","抽屉","命令面板","底部 Tab","锚点目录"], 1)
] + [
  (f"acc-{i}", f"手风琴组件 {name}", "展开/收起", f"UI Accordion：{name}", "accordion", f"acc-{i}")
  for i, name in enumerate(["基础","多开","嵌套感","图标","卡片","FAQ"], 1)
] + [
  (f"mod-{i}", f"对话框 {name}", "打开关闭", f"Modal/Dialog：{name}", "modal", f"mod-{i}")
  for i, name in enumerate(["确认","表单","全屏","抽屉式","无障碍焦点","堆叠"], 1)
] + [
  (f"car-{i}", f"走马灯组件 {name}", "切换幻灯", f"UI Carousel：{name}", "carousel", f"car-{i}")
  for i, name in enumerate(["指示点","缩略图","自动播","卡片多可见","淡入","垂直"], 1)
] + [
  (f"toast-{i}", f"Toast {name}", "触发通知", f"通知栈：{name}", "toast", f"toast-{i}")
  for i, name in enumerate(["成功","错误","信息","进度","可撤销","堆叠多条"], 1)
] + [
  (f"drop-{i}", f"下拉 {name}", "打开菜单", f"Dropdown/Select：{name}", "dropdown", f"drop-{i}")
  for i, name in enumerate(["基础","分组","搜索过滤","多选","右键菜单","级联"], 1)
] + [
  (f"tip-{i}", f"提示 {name}", "悬停显示", f"Tooltip/Popover：{name}", "tooltip", f"tip-{i}")
  for i, name in enumerate(["上","下","左","右","富文本","延迟"], 1)
] + [
  (f"skel-{i}", f"加载占位 {name}", "脉冲", f"UI Skeleton：{name}", "skeleton", f"skel-{i}")
  for i, name in enumerate(["列表","卡片墙","表格","详情","头像墙"], 1)
] + [
  (f"btn-{i}", f"按钮动效 {name}", "点击反馈", f"Button micro：{name}", "button", f"btn-{i}")
  for i, name in enumerate(["涟漪","加载中","成功勾","磁性","抖动失败","渐变边","图标滑入","按压缩放"], 1)
] + [
  (f"switch-{i}", f"开关弹簧 {name}", "切换", f"Spring switch：{name}", "switch", f"switch-{i}")
  for i, name in enumerate(["基础","带图标","三态","尺寸","彩色轨","软弹"], 1)
] + [
  (f"sheet-{i}", f"底栏/浮层 {name}", "拖拽关闭", f"Bottom sheet：{name}", "sheet", f"sheet-{i}")
  for i, name in enumerate(["半屏","全屏","句柄","操作表","分享板"], 1)
] + [
  (f"tabs-{i}", f"Tabs 动效 {name}", "切换", f"指示条滑动 Tabs：{name}", "tabs", f"tabs-{i}")
  for i, name in enumerate(["下滑条","胶囊滑块","下划线","淡入面板","垂直","图标"], 1)
] + [
  (f"timeline-{i}", f"时间线 {name}", "滚动查看", f"Timeline UI：{name}", "timeline", f"timeline-{i}")
  for i, name in enumerate(["垂直","交替","进度点","卡片","紧凑"], 1)
] + [
  (f"tree-{i}", f"树形 {name}", "展开节点", f"Tree view：{name}", "tree", f"tree-{i}")
  for i, name in enumerate(["文件夹","懒展开","选中高亮","连接线"], 1)
] + [
  (f"fab-{i}", f"FAB {name}", "展开动作", f"浮动操作按钮：{name}", "fab", f"fab-{i}")
  for i, name in enumerate(["单按钮","扇形","速度拨号","工具条"], 1)
] + [
  (f"chip-{i}", f"芯片/标签 {name}", "选择", f"Chip/Tag：{name}", "chip", f"chip-{i}")
  for i, name in enumerate(["筛选","可删","头像芯片","拖排序"], 1)
] + [
  (f"table-{i}", f"表格交互 {name}", "排序筛选", f"Table UX：{name}", "table", f"table-{i}")
  for i, name in enumerate(["排序动画","行展开","骨架载入","行选中"], 1)
] + [
  (f"avatar-{i}", f"头像组 {name}", "悬停", f"Avatar stack：{name}", "avatar", f"avatar-{i}")
  for i, name in enumerate(["重叠","加号剩余","状态点","呼吸边"], 1)
] + [
  (f"stepper-{i}", f"步骤条动效 {name}", "下一步", f"Stepper：{name}", "stepper", f"stepper-{i}")
  for i, name in enumerate(["水平","垂直","进度填充","勾选完成"], 1)
]
VARIANTS += pack(0, "ui", "kit-ui", ui_more)


charts_more = [
  (f"spark-{i}", f"迷你趋势 {i}", "悬停看数值", f"Sparkline 迷你图 #{i}", "spark", f"spark-{i}")
  for i in range(1, 7)
] + [
  (f"gauge-{i}", f"仪表盘 {i}", "拖动滑块", f"环形仪表盘变体 #{i}", "gauge", f"gauge-{i}")
  for i in range(1, 5)
] + [
  (f"stack-{i}", f"堆叠图 {name}", "点击图例", f"堆叠{name}图", "stack", f"stack-{i}")
  for i, name in enumerate(["柱","面积","横向","百分比"], 1)
]
VARIANTS += pack(0, "charts", "kit-chart", charts_more)

webgl_more = [
  (f"shader-{name}", f"着色器 {label}", "移动指针", f"片元着色器：{label}", "shader", f"shader-{name}")
  for name, label in [
    ("voronoi","Voronoi"),("warp","域扭曲"),("spiral","螺旋"),("checker","棋盘扭曲"),
    ("tunnel","隧道"),("ripple","涟漪"),("stars","星野"),("lava","熔岩"),
    ("grid","透视网格"),("kaleido","万花筒"),("hsv","HSV 旋转"),("scan","扫描线"),
    ("metaball2","双 Metaball"),("fog","体积雾"),("stripes","流光条纹"),("circle-sdf","SDF 圆"),
  ]
]
VARIANTS += pack(0, "webgl", "kit-webgl", webgl_more)

three_more = [
  (f"scene-{i}", f"Three 场景 {name}", "拖拽旋转", f"Three.js 场景包：{name}", "scene", f"scene-{i}")
  for i, name in enumerate(["晶格","环带","星云球","多立方","螺旋柱","玻璃球","线框球","Instanced","起伏面","点云环","光柱","反射地板"], 1)
]
VARIANTS += pack(0, "threejs", "kit-three", three_more)

gsap_more = [
  (f"seq-{i}", f"GSAP 序列 {name}", "播放控制", f"GSAP 时间线：{name}", "seq", f"seq-{i}")
  for i, name in enumerate(["弹跳入场","交错卡片","路径跟随","旋转出场","弹性缩放","颜色闪烁","翻转牌","进度环","打字机","视差层"], 1)
]
VARIANTS += pack(0, "gsap", "kit-gsap", gsap_more)

physics_more = [
  (f"sim-{i}", f"物理模拟 {name}", "拖拽交互", f"轻量物理：{name}", "sim", f"sim-{i}")
  for i, name in enumerate(["弹球墙","多重力","弹簧链","碰撞盒","漂浮气泡","摆锤","沙漏粒子","磁力点","弹性绳","台球"], 1)
]
VARIANTS += pack(0, "physics", "kit-physics", physics_more)

audio_more = [
  (f"viz-{i}", f"音频视觉 {name}", "点击播放合成音", f"Web Audio 可视化：{name}", "viz", f"viz-{i}")
  for i, name in enumerate(["柱状频谱","圆形波","条形均衡","粒子随音","示波器","极坐标","瀑布图","节拍脉冲","和弦板","噪声垫","鼓机垫"], 1)
]
VARIANTS += pack(0, "audio", "kit-audio", audio_more)

dataviz_more = [
  (f"viz-{i}", f"数据图 {name}", "交互探索", f"数据可视化：{name}", "viz", f"viz-{i}")
  for i, name in enumerate(["热力格子","雷达图","桑基简化","气泡散点","日历热力","旭日简化","和弦弧","箱线","平行坐标","流图","词云简化","层级列表"], 1)
]
VARIANTS += pack(0, "dataviz", "kit-dataviz", dataviz_more)

micro_more = [
  (f"mi-{i}", f"微交互 {name}", "点击反馈", f"微交互组件：{name}", "micro", f"mi-{i}")
  for i, name in enumerate(["心跳赞","勾选弹跳","发送纸飞机","复制成功","下载进度","骨架屏","Toast","徽章跳动","拖动阈值","长按确认","摇一摇提示","滑动验证"], 1)
]
VARIANTS += pack(0, "micro", "kit-micro", micro_more)

# New categories full packs
layout_items = [
  (f"grid-{i}", f"Grid 布局 {name}", "拖动滑块改列数/间距", f"CSS Grid 玩具：{name}", "grid", f"grid-{i}")
  for i, name in enumerate(["基础栅格","瀑布流模拟","圣杯","侧栏可调","卡片等分","密集自动填充","命名区域","子网格感","居中舞台","杂志排版","仪表盘","响应列","间隔实验","对齐线","重叠层"], 1)
] + [
  (f"flex-{i}", f"Flex 布局 {name}", "点击切换方向/对齐", f"Flexbox 玩具：{name}", "flex", f"flex-{i}")
  for i, name in enumerate(["主轴分布","换行","等高卡片","工具栏","聊天气泡","标签云","底部操作栏","垂直导航","居中英雄","间距推开"], 1)
]
VARIANTS += pack(0, "layout", "kit-layout", layout_items)

filter_items = [
  (f"f-{i}", f"滤镜 {name}", "拖动滑块调节", f"CSS filter：{name}", "filter", f"f-{i}")
  for i, name in enumerate(["模糊","亮度","对比","饱和","色相旋转","反相","灰度","褐色","投影","组合霓虹","毛玻璃背板","混合叠加","排除混合","彩色闪烁","像素感","锐化模拟","暗角","发光描边","双色调","故障抖动"], 1)
]
VARIANTS += pack(0, "filters", "kit-filters", filter_items)

particle_items = [
  (f"p-{i}", f"粒子 {name}", "移动指针 / 点击爆发", f"粒子套件：{name}", "particles", f"p-{i}")
  for i, name in enumerate([
    "星空","降雪","金雨","烟柱","萤火","火花喷泉","引力井","排斥场","鼠标跟随群","爆炸碎屑",
    "螺旋星系","心形场","文字点阵","网格跳动","波浪粒子","彗星","泡泡上升","落叶","雷电折线","沙尘",
    "霓虹点","量子抖","连接网2","黑洞吸积","彩虹喷泉"], 1)
]
VARIANTS += pack(0, "particles-fx", "kit-particles", particle_items)

gen_items = [
  (f"g-{i}", f"生成 {name}", "点击重生 / 拖动参数", f"生成艺术：{name}", "gen", f"g-{i}")
  for i, name in enumerate([
    "Perlin 流场","Julia 简化","Mandelbrot 漫游","生命游戏","沃罗诺伊","递归树","Sierpinski",
    "圆形填充","噪声地形","随机游走","L-System 草","波纹干涉","染色扩散","马赛克噪声",
    "极坐标花","三角剖分感","方块细分","等高线","墨水滴","光纤束","像素排序感","彩虹噪声",
    "细胞增长","引力绘线","螺旋采样"], 1)
]
VARIANTS += pack(0, "generative", "kit-generative", gen_items)

text_items = [
  (f"t-{i}", f"文字 {name}", "点击重播", f"文字特效：{name}", "text", f"t-{i}")
  for i, name in enumerate([
    "打字机","故障 Glitch","渐变扫光","描边填充","拆分下落","弹性弹入","模糊清晰","镜像翻转",
    "波浪字","3D 透视","霓虹灯管","打散重组","计数滚动","密码解码","打印色带","手写进度",
    "字幕卡拉OK","竖排滚动","切页翻转","液态变形","像素显现","烟雾消散","磁吸排列","彩虹跳动","打地鼠高亮"], 1)
]
VARIANTS += pack(0, "text-fx", "kit-text", text_items)

scroll_items = [
  (f"s-{i}", f"滚动 {name}", "在面板内滚动", f"滚动特效：{name}", "scroll", f"s-{i}")
  for i, name in enumerate([
    "视差层","进度条","章节钉住","淡入揭示","缩放进入","横向滚动画廊","卡片堆叠",
    "文字擦除","路径绘制随滚","数字递增","背景变色","分屏擦除","惯性吸附","目录高亮",
    "封面揭开","时间线","图片懒显","交错网格","回顶气泡","滚动叙事"], 1)
]
VARIANTS += pack(0, "scroll-fx", "kit-scroll", scroll_items)

# Build category map
from collections import OrderedDict
cats = OrderedDict()
for key, name, icon, intro, tech, demos in BASE:
    cats[key] = {
        "key": key, "name": name, "icon": icon, "intro": intro, "tech": tech,
        "demos": [
            {"slug":s,"title":t,"hint":h,"desc":d,"tag":tag,"mod":m,"fn":fn,"path":f"/{key}/{s}"}
            for s,t,h,d,tag,m,fn in demos
        ],
    }
for key, name, icon, intro, tech in NEW_CATS:
    cats[key] = {"key":key,"name":name,"icon":icon,"intro":intro,"tech":tech,"demos":[]}

seen = { (c["key"], d["slug"]) for c in cats.values() for d in c["demos"] }
for cat, kit, slug, title, hint, desc, tag, variant in VARIANTS:
    k = (cat, slug)
    if k in seen:
        continue
    seen.add(k)
    cats[cat]["demos"].append({
        "slug": slug, "title": title, "hint": hint, "desc": desc, "tag": tag,
        "mod": kit, "fn": "mount", "variant": variant, "path": f"/{cat}/{slug}",
    })

total = sum(len(c["demos"]) for c in cats.values())
print("total demos", total)
assert total >= 300, total
for c in cats.values():
    print(f"  {c['key']}: {len(c['demos'])}")

registry = {"categories": list(cats.values()), "totalDemos": total}

# Write JSON
for path in [BE / "data" / "registry.json", FE / "public" / "registry.json"]:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Write TypeScript registry
def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")

lines = []
lines.append("/** Auto-generated by scripts/gen-gallery.py — do not edit by hand. */")
lines.append("export type DemoMeta = {")
lines.append("  slug: string; title: string; hint: string; desc: string; tag: string;")
lines.append("  mod: string; fn: string; variant?: string; path?: string; cat?: Category;")
lines.append("};")
lines.append("export type Category = {")
lines.append("  key: string; name: string; icon: string; intro: string; tech: string[]; demos: DemoMeta[];")
lines.append("};")
lines.append("export const categories: Category[] = [")
for c in cats.values():
    tech = ", ".join(f"'{esc(t)}'" for t in c["tech"])
    lines.append("  {")
    lines.append(f"    key: '{c['key']}', name: '{esc(c['name'])}', icon: '{esc(c['icon'])}',")
    lines.append(f"    intro: '{esc(c['intro'])}',")
    lines.append(f"    tech: [{tech}],")
    lines.append("    demos: [")
    for d in c["demos"]:
        var = f", variant: '{esc(d['variant'])}'" if d.get("variant") else ""
        lines.append(
            "      {{ slug: '{slug}', title: '{title}', hint: '{hint}', desc: '{desc}', tag: '{tag}', mod: '{mod}', fn: '{fn}'{var} }},".format(
                slug=esc(d["slug"]), title=esc(d["title"]), hint=esc(d["hint"]),
                desc=esc(d["desc"]), tag=esc(d["tag"]), mod=esc(d["mod"]), fn=esc(d["fn"]), var=var,
            )
        )
    lines.append("    ],")
    lines.append("  },")
lines.append("];")
lines.append("export const routes: Record<string, DemoMeta> = {};")
lines.append("for (const c of categories) {")
lines.append("  for (const d of c.demos) {")
lines.append("    d.path = `/${c.key}/${d.slug}`;")
lines.append("    d.cat = c;")
lines.append("    routes[d.path] = d;")
lines.append("  }")
lines.append("}")
lines.append("export const totalDemos = categories.reduce((n, c) => n + c.demos.length, 0);")
(FE / "src" / "registry.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote registry.ts + json")
