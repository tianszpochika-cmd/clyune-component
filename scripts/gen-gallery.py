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
  for i, name in enumerate(["环","点阵","条","方块翻转","呼吸","轨道","涟漪","交叉"], 1)
] + [
  (f"hover-{i}", f"悬停动效 {name}", "悬停卡片", f"卡片悬停：{name}", "hover", f"hover-{i}")
  for i, name in enumerate(["上浮","缩放","边光","扫光","倾斜","边框跑马","阴影扩散","模糊聚焦"], 1)
] + [
  (f"grad-{i}", f"渐变流动 {i}", "自动播放", f"多色渐变背景流动 #{i}", "gradient", f"grad-{i}")
  for i in range(1, 7)
]
VARIANTS += pack(0, "css-fx", "kit-css", css_fx_more)

canvas_more = [
  (f"orbits-{i}", f"轨道粒子 {i}", "移动指针扰动", f"多轨粒子系统变体 #{i}", "orbit", f"orbits-{i}")
  for i in range(1, 8)
] + [
  (f"trail-{i}", f"指针拖尾 {name}", "移动画出拖尾", f"指针拖尾效果：{name}", "trail", f"trail-{i}")
  for i, name in enumerate(["霓虹","烟","星屑","墨迹","彩虹","像素","火花"], 1)
] + [
  (f"blob-{i}", f"软体 Blob {i}", "拖动变形", f"metaball 风格软体 #{i}", "blob", f"blob-{i}")
  for i in range(1, 7)
] + [
  (f"rain-{i}", f"粒子雨 {i}", "点击切换风向", f"重力粒子雨变体 #{i}", "rain", f"rain-{i}")
  for i in range(1, 6)
]
VARIANTS += pack(0, "canvas", "kit-canvas", canvas_more)

svg_more = [
  (f"stroke-{i}", f"描边路径 {name}", "点击重播", f"SVG stroke-dash 描边：{name}", "stroke", f"stroke-{i}")
  for i, name in enumerate(["圆","星","心","波浪","折线","螺旋","六边形","字母"], 1)
] + [
  (f"icon-anim-{i}", f"图标动效 {name}", "点击切换", f"SVG 图标状态切换：{name}", "icons", f"icon-{i}")
  for i, name in enumerate(["汉堡","播放","爱心","铃铛","搜索","下载","设置","云"], 1)
] + [
  (f"morph-{i}", f"形变 Morph {i}", "点击变形", f"路径 morph 变体 #{i}", "morph", f"morph-{i}")
  for i in range(1, 5)
]
VARIANTS += pack(0, "svg", "kit-svg", svg_more)

ui_more = [
  (f"input-{i}", f"输入控件 {name}", "点击/输入交互", f"表单控件演示：{name}", "form", f"input-{i}")
  for i, name in enumerate(["文本框","开关组","滑块","分段","标签输入","评分","步进器","搜索栏","进度条","通知条"], 1)
] + [
  (f"nav-{i}", f"导航样式 {name}", "点击切换激活项", f"导航组件：{name}", "nav", f"nav-{i}")
  for i, name in enumerate(["侧栏","顶栏 Tabs","面包屑","分页","步骤条","胶囊菜单","抽屉","命令面板"], 1)
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
