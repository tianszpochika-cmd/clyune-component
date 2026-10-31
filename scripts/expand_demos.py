#!/usr/bin/env python3
"""Expand thin categories into family pages; sync presets + registry."""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path('/workspace/clyune-component')
PRESETS_JS = ROOT / 'frontend/src/demos/kits/presets.js'
REGISTRY_TS = ROOT / 'frontend/src/registry.ts'
REGISTRY_JSON = ROOT / 'backend/data/registry.json'
PUBLIC_JSON = ROOT / 'frontend/public/registry.json'

# --- Family definitions: (slug, title, hint, desc, presets) ---
PARTICLES = [
  ('starfield','星空','星空漂浮 · 调数量/颜色','星点与慢漂粒子场',['疏','密','快','慢','彩点','远近']),
  ('snow','降雪','雪花下落 · 调速度','飘雪粒子',['细雪','暴雪','斜风','大片','慢飘','彩雪']),
  ('goldrain','金雨','金色雨帘','矩阵金雨感',['细','密','快','慢','宽','窄']),
  ('smoke-col','烟柱','上升烟柱','烟雾粒子柱',['轻','浓','快喷','慢散','彩烟','双柱感']),
  ('firefly','萤火','萤火虫闪烁','闪烁光点',['疏','密','慢闪','快闪','暖色','冷色']),
  ('fountain','火花喷泉','底部喷泉 · Burst','上喷火花',['弱','强','宽口','窄口','彩火','连喷']),
  ('attractor','引力井','鼠标吸引','粒子吸入',['弱吸','强吸','旋吸','脉冲','密群','疏群']),
  ('repulsor','排斥场','鼠标排斥','推开粒子',['弱','强','环形','脉冲','密','疏']),
  ('follow-swarm','跟随群','鼠标跟随群','蜂群跟随',['紧随','松散','延迟','加速','彩虹','单色']),
  ('explode','爆炸碎屑','点击爆发','碎屑喷射',['小爆','大爆','环爆','星爆','彩屑','慢散']),
  ('galaxy','螺旋星系','旋转星系臂','臂状粒子',['双臂','多臂','密核','疏臂','彩旋','慢转']),
  ('heartfield','心形场','心形吸引','爱心轨迹',['小','大','密','疏','脉动','慢聚']),
  ('text-dots','文字点阵','点阵聚字','粒子成字',['密点','疏点','弹性','慢聚','彩点','单色']),
  ('grid-pulse','网格跳动','网格脉冲','点阵呼吸',['疏网','密网','强脉','弱脉','彩格','单色']),
  ('wave-part','波浪粒子','波面起伏','正弦波粒子',['低波','高波','多层','快','慢','彩波']),
  ('comet','彗星','拖尾彗星','流星划过',['单星','雨幕','长尾','短尾','彩尾','慢掠']),
  ('bubbles','泡泡上升','上升气泡','透明泡感',['小泡','大泡','密','疏','慢升','快升']),
  ('leaves','落叶','飘落叶','摇摆下落',['秋叶','密落','疏落','大风','微风','彩叶']),
  ('dust','沙尘','沙尘漂浮','扬尘场',['细尘','粗尘','风暴','静','彩尘','暗尘']),
  ('neon-dots','霓虹点','霓虹闪点','发光粒子',['冷霓虹','暖霓虹','密闪','疏闪','脉冲','常亮']),
  ('quantum','量子抖','随机跃迁','量子抖动',['微抖','狂抖','低频','高频','彩跳','单色']),
  ('net','连接网','近邻连线','粒子网络',['短链','长链','密网','疏网','发光','淡线']),
  ('blackhole','黑洞吸积','中心吸入','吸积盘',['弱','强','盘旋','急吸','彩盘','暗核']),
  ('rainbow','彩虹喷泉','彩虹喷射','多彩喷泉',['全彩','半弧','密喷','疏喷','高柱','矮柱']),
]

GENERATIVE = [
  ('flowfield','Perlin 流场','噪声流场 · 重生','粒子沿噪声流动',['疏','密','快','慢','粗线','细线']),
  ('julia','Julia 集','Julia 漫游','复平面 Julia',['经典','旋动','高对比','柔和','深探','浅探']),
  ('mandelbrot','Mandelbrot','曼德勃漫游','分形缩放',['经典','火彩','冷色','深潜','宽景','细部']),
  ('gol','生命游戏','细胞自动机','Conway GOL',['疏','密','快演化','慢演化','大格','小格']),
  ('voronoi','沃罗诺伊','Voronoi 色块','最近点图',['少核','多核','动核','静态','高对比','柔边']),
  ('tree','递归树','分形树','递归枝干',['矮','高','密枝','疏枝','摇摆','静']),
  ('sierpinski','Sierpinski','三角分形','垫片递归',['浅','深','线','面','动','静']),
  ('circles','圆形填充','圆堆积','随机圆填充',['疏','密','描边','填充','大小差','均匀']),
  ('terrain','噪声地形','等高噪声','伪地形',['高山','丘陵','细纹','粗纹','动态','静态']),
  ('walk','随机游走','醉步轨迹','随机折线',['短','长','粗','细','彩色','单色']),
  ('lsystem','L-System','文法植物','L 系统草',['草','灌','树','密','疏','摇摆']),
  ('interfere','波纹干涉','双波干涉','同心干涉',['双源','三源','快','慢','强','弱']),
  ('diffuse','染色扩散','墨染扩散','径向扩散',['少点','多点','慢','快','浓','淡']),
  ('mosaic','马赛克噪声','块噪声','像素马赛克',['大块','小块','动','静','彩虹','单色']),
  ('polar-flower','极坐标花','极坐标曲线','玫瑰线',['少瓣','多瓣','旋转','呼吸','描边','填充']),
  ('tri','三角剖分','三角网','随机三角',['疏','密','线','面','动','静']),
  ('subdiv','方块细分','四叉细分','递归方块',['浅','深','线框','色块','动','静']),
  ('contour','等高线','噪声等高','层状等高',['少层','多层','细线','粗线','动','静']),
  ('inkdrop','墨水滴','涟漪墨滴','扩散环',['单滴','多滴','慢','快','浓','淡']),
  ('fiber','光纤束','竖向光纤','束状曲线',['疏','密','摆动','静','彩','单色']),
  ('pixelsort','像素排序感','行偏移','排序错位',['弱','强','动','静','彩','灰']),
  ('cellgrow','细胞增长','圆胞扩张','生长圆',['慢','快','少','多','描边','填充']),
  ('gravline','引力绘线','向心力轨迹','吸引折线',['弱','强','多线','少线','彩','单']),
  ('spiral-gen','螺旋采样','阿基米德螺线','螺旋采样点',['紧','松','旋转','静','彩','单']),
]

TEXT = [
  ('typewriter','打字机','逐字打出 · 重播','打字机效果',['慢','中','快','闪标','无标','循环']),
  ('glitch','故障 Glitch','故障抖动','RGB 错位',['轻','重','快闪','慢闪','彩错','单色']),
  ('gradient','渐变扫光','渐变流动字','扫光渐变',['冷','暖','霓虹','慢扫','快扫','三色']),
  ('outline','描边填充','空心描边','描边字',['细描','粗描','双描','填充延迟','闪边','静']),
  ('split-fall','拆分下落','字母落下','拆分入场',['上落','下落','旋转落','弹性','快','慢']),
  ('bounce-in','弹性弹入','过冲弹入','弹性缩放',['轻弹','重弹','交错','同步','快','慢']),
  ('blur-clear','模糊清晰','从糊到清','模糊入场',['轻糊','重糊','快清','慢清','带色','白']),
  ('mirror','镜像翻转','镜像还原','翻转显现',['水平','垂直','快','慢','弹性','线性']),
  ('wave-text','波浪字','逐字起伏','波浪动画',['低波','高波','快','慢','彩','单色']),
  ('perspective','3D 透视','透视翻转','3D 字',['Y转','X转','慢','快','大','小']),
  ('neon-text','霓虹灯管','霓虹发光','灯管字',['冷','暖','闪烁','常亮','双色','单色']),
  ('scramble','打散重组','散开再聚','重组动画',['轻散','狂散','快聚','慢聚','旋转','平移']),
  ('counter','计数滚动','数字递增','计数器',['百','千','万','快','慢','带号']),
  ('decode','密码解码','乱码解码','解码显现',['字母','符号','快','慢','循环','一次']),
  ('ribbon','打印色带','色带扫过','打印感',['慢扫','快扫','彩带','单色','循环','一次']),
  ('handwrite','手写进度','逐步显现','手写感',['慢','快','描边','填充','循环','一次']),
  ('karaoke','字幕卡拉OK','逐字高亮','卡拉OK',['慢','快','发光','朴素','循环','一次']),
  ('vertical','竖排滚动','竖排文字','竖排展示',['慢滚','静','密距','疏距','彩','单']),
  ('pageflip','切页翻转','翻页字','翻转入场',['慢','快','弹性','线性','大','小']),
  ('liquid','液态变形','液态缩放','果冻字',['轻','重','快','慢','交错','同步']),
  ('pixel','像素显现','像素风字','像素字',['细','粗','闪现','静','彩','单']),
  ('smoke','烟雾消散','烟散消失','消散字',['慢散','快散','上飘','糊散','循环','一次']),
  ('magnetic','磁吸排列','指针磁吸','字母磁吸',['弱','强','近距','远距','回弹','粘滞']),
  ('rainbow','彩虹跳动','彩虹起伏','彩虹字',['慢跳','快跳','全彩','双色','低波','高波']),
]

SCROLL = [
  ('parallax','视差层','面板内滚动 · 视差','滚动视差',['浅','深','双层','三层','慢','快']),
  ('progress','进度条','顶栏进度','滚动进度',['细','粗','渐变','单色','发光','朴素']),
  ('pin','章节钉住','Sticky 钉住','章节钉住',['短','长','卡片','标题','双钉','单钉']),
  ('reveal','淡入揭示','滚入淡入','揭示卡片',['上滑','淡入','快','慢','交错','同步']),
  ('scale-in','缩放进入','滚入缩放','缩放显现',['轻缩','重缩','快','慢','弹性','线性']),
  ('h-gallery','横向画廊','横向滚动','画廊轨道',['少卡','多卡','宽卡','窄卡','吸附','自由']),
  ('stack','卡片堆叠','Sticky 堆叠','堆叠卡片',['少','多','紧','松','彩色','单色']),
  ('wipe-text','文字擦除','擦除显现','擦除揭示',['左擦','右擦','快','慢','强','弱']),
  ('path-draw','路径随滚','描边随滚','路径绘制',['短径','长径','粗','细','发光','朴素']),
  ('countup','数字递增','滚入计数','数字递增',['百','千','快','慢','多组','单组']),
  ('bg-shift','背景变色','滚改背景','背景渐变',['冷暖','霓虹','慢变','快变','双色','多色']),
  ('split-wipe','分屏擦除','左右分屏','分屏揭示',['左右','上下','快','慢','强对比','柔']),
  ('snap','惯性吸附','段落吸附','滚动吸附',['强吸','弱吸','多段','少段','快','慢']),
  ('toc','目录高亮','锚点高亮','目录联动',['顶栏','侧栏','密','疏','胶囊','下划线']),
  ('cover','封面揭开','封面滚走','封面层',['高封面','矮封面','渐变','纯色','字大','字小']),
  ('timeline','滚动时间线','竖向时间线','时间线',['紧凑','宽松','彩点','单色','卡片','纯文']),
  ('lazy-img','图片懒显','滚入显图','懒显卡片',['淡入','上滑','快','慢','网格','单列']),
  ('stagger-grid','交错网格','网格交错显','交错入场',['3列','4列','快','慢','对角','行优']),
  ('totop','回顶气泡','回顶按钮','回顶',['右下','左下','大','小','渐显','常显']),
  ('story','滚动叙事','长文叙事','叙事滚屏',['短章','长章','大字','小字','插图','纯文']),
]

GSAP = [
  ('bounce','弹跳入场','弹跳循环 · Play','bounce.out 入场',['轻弹','重弹','慢','快','大','小']),
  ('stagger','交错卡片','交错入场','stagger 卡片',['从左','从中','从边','快','慢','回弹']),
  ('path','路径跟随','折线路径','路径位移',['方径','三角','8字感','快','慢','平滑']),
  ('spin-out','旋转出场','旋转缩小','旋转出场再入',['180','360','快','慢','弹性入','淡入']),
  ('elastic','弹性缩放','elastic 缩放','弹性缩放',['轻','重','慢','快','yoyo','单次感']),
  ('colorflash','颜色闪烁','色闪循环','颜色关键',['双色','三色','快闪','慢闪','霓虹','柔和']),
  ('flipcard','翻转牌','rotateY 翻牌','卡片翻转',['单面','三牌','快','慢','交错','同步']),
  ('ring','进度环','旋转环','环形旋转',['细环','粗环','快','慢','双环感','单环']),
  ('type','打字机','GSAP 打字','打字机时间轴',['慢','中','快','删除回放','仅打出','循环']),
  ('parallax-g','视差层','多层位移','视差时间轴',['浅','深','三层','二层','慢','快']),
  ('grid-stagger','网格交错','网格 stagger','中心扩散网格',['3x4','快','慢','回弹','淡出','边缘优先']),
  ('scrub','时间轴 scrub','拖动进度','scrub 时间轴',['位转','缩放色','复合','慢感','快感','线性']),
]

WEBGL = [
  ('voronoi','Voronoi','细胞噪声','Voronoi 着色',['经典','高对比','柔边','动核','冷','暖']),
  ('warp','域扭曲','噪声扭曲','域扭曲着色',['轻扭曲','重扭曲','快','慢','细噪','粗噪']),
  ('spiral','螺旋','极坐标螺旋','螺旋着色',['紧','松','快转','慢转','多臂','单臂']),
  ('checker','棋盘扭曲','扭曲棋盘','棋盘着色',['密格','疏格','强扭','弱扭','高对比','柔']),
  ('tunnel','隧道','隧道穿梭','隧道着色',['快','慢','密环','疏环','霓虹','暗']),
  ('ripple','涟漪','鼠标涟漪','涟漪着色',['密波','疏波','强','弱','快','慢']),
  ('stars','星野','分形星野','星野着色',['密星','疏星','亮','暗','冷','暖']),
  ('lava','熔岩','熔岩噪声','熔岩着色',['炽热','暗岩','快涌','慢涌','高对比','柔']),
  ('grid3d','透视网格','地平网格','透视网格',['密','疏','快','慢','霓虹','暗']),
  ('kaleido','万花筒','万花筒对称','万花筒',['4瓣','8瓣','快','慢','彩','单']),
  ('hsv','HSV 旋转','色相轮','HSV 着色',['全轮','半轮','快转','慢转','饱和','淡']),
  ('scan','扫描线','CRT 扫描','扫描着色',['密线','疏线','绿幕','霓虹','快','慢']),
  ('metaball','双 Metaball','双球融合','Metaball',['近','远','快','慢','高亮','柔']),
  ('fog','体积雾','层叠雾','体积雾',['浓','淡','快飘','慢飘','冷','暖']),
  ('stripes','流光条纹','斜向条纹','流光条纹',['密','疏','快','慢','霓虹','柔']),
  ('circle-sdf','SDF 圆','距离场圆','SDF 圆',['细环','粗环','双环','鼠标跟','亮','暗']),
  ('water','水面','多层水面','水面着色',['静水','涌浪','快','慢','清','浊']),
  ('crt','CRT','CRT 效果','CRT 着色',['强扫描','弱扫描','强暗角','弱暗角','绿','彩']),
  ('julia-sh','Julia','Julia 着色器','Julia 集',['经典','旋动','深','浅','火','冰']),
  ('snow-sh','飘雪','着色器雪','飘雪',['细雪','密雪','慢','快','大片','小片']),
  ('oil','油画噪声','油画感','油画噪声',['粗笔','细笔','快','慢','彩','暗']),
]

PHYSICS = [
  ('wall-ball','弹球墙','重力弹球','弹球墙碰撞',['少球','多球','大','小','高弹','低弹']),
  ('multigrav','多重力','可变重力','多重力场',['无重力','反重力','低g','高g','侧向','混沌']),
  ('spring','弹簧链','弹簧拉拽','弹簧链',['软簧','硬簧','少点','多点','鼠标拉','静']),
  ('box-collide','碰撞盒','盒体碰撞','碰撞盒',['少','多','大','小','高弹','粘滞']),
  ('bubbles','漂浮气泡','上浮气泡','漂浮气泡',['少','多','大','小','慢升','快升']),
  ('pendulum','摆锤','单摆感','摆锤',['长臂','短臂','重锤','轻锤','阻尼大','阻尼小']),
  ('hourglass','沙漏粒子','沙漏下落','沙漏粒子',['细沙','粗沙','快漏','慢漏','密','疏']),
  ('magnet','磁力点','鼠标磁力','磁力点',['弱磁','强磁','斥力','吸力','多点','少点']),
  ('rope','弹性绳','中心弹性绳','弹性绳',['软','硬','多节','少节','彩','单']),
  ('billiard','台球','台球碰撞','台球',['少球','多球','大','小','高摩擦','低摩擦']),
  ('orbit-p','轨道物理','圆周轨道','轨道物理',['近轨','远轨','快','慢','椭圆感','圆']),
  ('softbody','软体感','软体挤压','软体球',['软','硬','大','小','多','少']),
]

AUDIO = [
  ('bars','柱状频谱','Play tone · 柱状','柱状频谱',['细柱','粗柱','密','疏','霓虹','柔']),
  ('circle-wave','圆形波','圆形频谱','圆形波',['细线','粗线','多环感','单环','快','慢']),
  ('eq','条形均衡','均衡器条','条形均衡',['少段','多段','高对比','柔','霓虹','暗']),
  ('part-audio','粒子随音','音驱动粒子','粒子随音',['少','多','大点','小点','爆发','平稳']),
  ('scope','示波器','波形示波','示波器',['细线','粗线','高幅','低幅','霓虹','绿']),
  ('polar','极坐标','极坐标频谱','极坐标',['密采样','疏采样','大半径','小','彩','单']),
  ('waterfall','瀑布图','频谱瀑布','瀑布图',['密行','疏行','高对比','柔','冷','暖']),
  ('beat','节拍脉冲','中心脉冲','节拍脉冲',['大脉','小脉','快感','慢感','霓虹','柔']),
  ('chord','和弦板','垫板网格','和弦板',['4x2','亮','暗','彩','单','脉动']),
  ('noise-pad','噪声垫','噪声垫','噪声垫',['柔','硬','亮','暗','冷','暖']),
  ('drum','鼓机垫','鼓机网格','鼓机垫',['亮击','暗','彩','单','密闪','疏']),
]

DATAVIZ = [
  ('heatmap','热力格子','热力格子','热力格子',['8x8','高对比','冷热','动','静','柔']),
  ('radar','雷达图','多维雷达','雷达图',['填充','描边','双层感','尖角','快脉','静']),
  ('sankey','桑基简化','流向桑基','桑基简化',['少流','多流','粗带','细带','彩','单']),
  ('bubbles','气泡散点','气泡散点','气泡散点',['疏','密','大泡','小泡','动','静']),
  ('cal-heat','日历热力','周历热力','日历热力',['年感','月感','高活','低活','绿谱','火谱']),
  ('sunburst','旭日简化','旭日层级','旭日简化',['双层','三层','亮','暗','彩','单']),
  ('chord','和弦弧','和弦关系','和弦弧',['密弧','疏弧','粗','细','彩','单']),
  ('boxplot','箱线图','箱线','箱线图',['多组','少组','高对比','柔','彩','单']),
  ('parallel','平行坐标','平行坐标','平行坐标',['多轴','少轴','高亮','淡','动','静']),
  ('stream','流图','层流图','流图',['多层','少层','高波','低波','彩','单']),
  ('wordcloud','词云简化','词云','词云简化',['密','疏','大字','小字','彩','单']),
  ('hierarchy','层级列表','层级条','层级列表',['深','浅','缩进','色条','动','静']),
  ('funnel','漏斗','转化漏斗','漏斗图',['5层','陡','缓','彩','单','高对比']),
  ('candle','烛台','K 线烛台','烛台图',['多柱','少柱','涨跌色','细','粗','动']),
  ('icicle','树状冰柱','冰柱图','树状冰柱',['三层','二层','彩','单','密','疏']),
  ('arc','弧形进度','多层弧','弧形进度',['多层','单层','粗','细','霓虹','柔']),
]

MICRO = [
  ('heart','心跳赞','点击点赞','心跳赞',['粉','红','大','小','带Toast','静赞']),
  ('check','勾选弹跳','勾选弹跳','勾选弹跳',['方框','圆框','快弹','慢弹','彩','单']),
  ('send','发送纸飞机','发送反馈','发送纸飞机',['快反馈','慢','成功色','默认','大钮','小钮']),
  ('copy','复制成功','复制 Toast','复制成功',['短提示','长提示','快消','慢消','彩边','单']),
  ('download','下载进度','进度条下载','下载进度',['快满','慢满','粗条','细条','霓虹','柔']),
  ('skeleton','骨架屏','加载骨架','骨架屏',['列表','卡片','快闪','慢闪','亮','暗']),
  ('toast','Toast','弹出提示','Toast',['底中','快','慢','成功','信息','警告感']),
  ('badge','徽章跳动','数字徽章','徽章跳动',['快跳','慢跳','红点','数字','大','小']),
  ('drag','拖动卡片','拖拽','拖动卡片',['自由拖','大卡','小卡','彩','单','回弹感']),
  ('longpress','长按确认','长按触发','长按确认',['短阈','长阈','大钮','小钮','成功','静']),
  ('shake','摇一摇提示','快速晃动','摇一摇提示',['灵敏','钝感','大提示','小','彩','单']),
  ('slide-verify','滑动验证','滑块验证','滑动验证',['短轨','长轨','大块','小块','成功色','默认']),
  ('dblzoom','双击放大','双击缩放','双击放大',['大缩放','小缩放','快','慢','彩','单']),
  ('hover-mag','悬停磁吸','磁吸按钮','悬停磁吸',['弱吸','强吸','近','远','大钮','小钮']),
  ('press-ripple','按压波纹','点击涟漪','按压波纹',['大波','小波','快','慢','白涟漪','色涟漪']),
  ('toggle-spring','开关弹簧','弹簧开关','开关弹簧',['大','小','彩轨','快弹','慢弹','图标感']),
]

THREE = [
  ('lattice','晶格','3x3x3 晶格','立方晶格',['疏','密','快转','慢转','金属','哑光']),
  ('torus','环带','Torus','环带',['细管','粗管','快','慢','金属','玻璃感']),
  ('nebula','星云球','点球面','星云球',['密点','疏点','大点','小点','快','慢']),
  ('polycubes','多立方','环绕立方','多立方',['少','多','快','慢','金属','哑光']),
  ('helix','螺旋柱','螺旋导管','螺旋柱',['紧螺','松螺','细管','粗管','快','慢']),
  ('glass','玻璃球','透射球','玻璃球',['高透','低透','大','小','快转','慢转']),
  ('wire','线框球','Icosahedron 线框','线框球',['细线','密线','快','慢','亮','暗']),
  ('instanced','Instanced','实例化方块','Instanced Mesh',['少','多','散布','聚拢','快','慢']),
  ('terrain-3','起伏面','顶点起伏','起伏面',['高波','低波','密网','疏网','快','慢']),
  ('ringcloud','点云环','环状点云','点云环',['密','疏','厚环','薄环','快','慢']),
  ('pillar','光柱','圆柱光柱','光柱',['细柱','粗柱','高','矮','快转','慢转']),
  ('mirror-floor','反射地板','地板+球','反射地板',['大球','小球','亮地','暗地','快','慢']),
  ('knots','环结','TorusKnot 感','环结',['紧','松','快','慢','金属','线框感']),
  ('orbit-moons','卫星轨道','多卫星','卫星轨道',['双星','三星','近','远','快','慢']),
]

FILTERS = [
  ('blur','模糊','高斯模糊','模糊滤镜',['轻','中','重','呼吸','定向感','静']),
  ('brightness','亮度','亮度脉动','亮度',['暗','亮','脉动','静','强脉','弱脉']),
  ('contrast','对比','对比度','对比',['低','高','闪','静','强','弱']),
  ('saturate','饱和','饱和脉动','饱和',['灰','艳','脉动','静','强','弱']),
  ('hue','色相旋转','色相旋转','色相',['慢转','快转','小幅','大幅','霓虹','柔']),
  ('invert','反相','反相','反相',['全反','半反','闪反','静','彩底','暗底']),
  ('grayscale','灰度','灰度','灰度',['全灰','半灰','回彩','静','高对比','柔']),
  ('sepia','褐色','褐色','褐色',['浅褐','深褐','脉动','静','暖','冷褐']),
  ('drop-shadow','投影发光','投影','投影发光',['轻光','重光','大模糊','小模糊','彩光','白光']),
  ('neon-combo','组合霓虹','多滤镜霓虹','组合霓虹',['冷霓虹','暖霓虹','强','弱','快闪','常亮']),
  ('glass','毛玻璃','毛玻璃背板','毛玻璃',['轻糊','重糊','亮','暗','彩边','无边']),
  ('duotone','双色调','双色调','双色调',['冷双色','暖双色','高对比','柔','动','静']),
  ('glitch-f','故障抖动','故障滤镜','故障抖动',['轻','重','快','慢','彩错','单']),
  ('vignette','暗角','暗角','暗角',['轻','重','呼吸','静','冷','暖']),
  ('glow-edge','发光描边','描边光','发光描边',['细','粗','强光','弱光','彩','白']),
  ('backdrop','背板模糊','backdrop 感','背板模糊',['轻','重','亮卡','暗卡','彩','单']),
]

LAYOUT_EXTRA = [
  ('bento','Bento 拼贴','Bento 网格','Bento 拼贴',['2x2','不等块','密','疏','彩块','单色']),
  ('holy','圣杯经典','圣杯三栏','圣杯布局',['宽侧','窄侧','顶栏高','顶栏矮','彩','单']),
  ('aspect','纵横比卡片','aspect-ratio','纵横比',['16:9','1:1','4:3','21:9','密','疏']),
  ('overlap','重叠层叠','负边距重叠','重叠卡片',['轻叠','重叠','对角','水平','彩','单']),
  ('subgrid','子网格感','子网格对齐','子网格感',['双层','三列','对齐','错位','彩','单']),
]

CSS_EXTRA = [
  ('neumorph','新拟态','Neumorphism','新拟态按钮/卡片',['凸起','凹陷','软','硬','彩光','单']),
  ('cursor-fx','自定义光标','跟随光标','自定义光标环',['环','点','拖尾','混合','大','小']),
  ('text-stroke','文字描边动','描边奔跑','文字描边',['细','粗','快','慢','霓虹','单']),
  ('border-beam','边框光束','旋转边光','边框光束',['快','慢','粗光','细光','双色','单色']),
  ('spotlight','聚光跟随','指针聚光','聚光卡片',['小光','大光','强','弱','彩','白']),
]

UI_EXTRA = [
  ('command','命令面板','⌘K 面板','命令面板',['短列表','长列表','分组','搜索感','暗','亮点']),
  ('pagination','分页器','页码分页','分页器',['少页','多页','含省略','简洁','彩','单']),
  ('breadcrumb','面包屑','路径面包屑','面包屑',['三级','五级','图标','纯文','彩','单']),
  ('rating','评分星','星级评分','评分',['5星','半星感','大','小','彩','单']),
  ('empty','空状态','空状态插画感','空状态',['无数据','无网络','可操作','纯文','彩','单']),
  ('banner','顶栏横幅','通知横幅','顶栏横幅',['信息','成功','警告','可关','彩','单']),
]

CANVAS_EXTRA = [
  ('metaballs2d','2D Metaball','软体融合','2D Metaball',['双球','三球','软','硬','彩','单']),
  ('pixelate','像素化游标','指针像素化','像素化',['大像素','小像素','强','弱','彩','单']),
  ('ascii','ASCII 艺术','字符画','ASCII',['密字','疏字','动','静','彩','单']),
  ('ripple-c','水波纹点击','点击涟漪','水波纹',['单波','多波','快','慢','强','弱']),
]

SVG_EXTRA = [
  ('line-draw','线条生长','路径生长','线条生长',['快','慢','粗','细','虚线','实线']),
  ('check-morph','勾选变形','形态到勾','勾选 Morph',['快','慢','弹','线性','彩','单']),
  ('loader-svg','SVG 加载弧','旋转弧','SVG 加载',['细弧','粗弧','双弧','单','快','慢']),
  ('menu-morph','菜单变形','汉堡变 X','菜单 Morph',['快','慢','弹','线性','粗','细']),
]

THREE_KEEP = None  # use THREE list replacing lab

def demo_entry(slug, title, hint, desc, tag, mod, fn, variant, presets):
    return {
        'slug': slug, 'title': title, 'hint': hint, 'desc': desc, 'tag': tag,
        'mod': mod, 'fn': fn, 'variant': variant, 'presets': presets,
    }

def fam_demos(items, mod, tag_prefix, kit_variant_is_slug=True):
    out = []
    for slug, title, hint, desc, presets in items:
        out.append(demo_entry(slug, title, hint, desc, tag_prefix, mod, 'mount', slug if kit_variant_is_slug else slug, presets))
    return out

# Load existing registry
reg = json.loads(REGISTRY_JSON.read_text())
cats = {c['key']: c for c in reg['categories']}

def replace_demos(key, new_demos, keep_legacy=None):
    c = cats[key]
    legacy = []
    if keep_legacy is True:
        legacy = [d for d in c['demos'] if not str(d.get('mod','')).startswith('kit-')]
    elif isinstance(keep_legacy, (set, list, tuple)):
        keep = set(keep_legacy)
        legacy = [d for d in c['demos'] if (not str(d.get('mod','')).startswith('kit-')) or d['slug'] in keep]
    c['demos'] = legacy + new_demos

replace_demos('particles-fx', fam_demos(PARTICLES, 'kit-particles', 'particles'), keep_legacy=[])
# generative
replace_demos('generative', fam_demos(GENERATIVE, 'kit-generative', 'gen'), keep_legacy=[])
# text-fx
replace_demos('text-fx', fam_demos(TEXT, 'kit-text', 'text'), keep_legacy=[])
# scroll-fx
replace_demos('scroll-fx', fam_demos(SCROLL, 'kit-scroll', 'scroll'), keep_legacy=[])

# gsap: keep 3 legacy + families
replace_demos('gsap', fam_demos(GSAP, 'kit-gsap', 'gsap'), keep_legacy=True)
# webgl
replace_demos('webgl', fam_demos(WEBGL, 'kit-webgl', 'shader'), keep_legacy=True)
# physics
replace_demos('physics', fam_demos(PHYSICS, 'kit-physics', 'sim'), keep_legacy=True)
# audio
replace_demos('audio', fam_demos(AUDIO, 'kit-audio', 'audio'), keep_legacy=True)
# dataviz
replace_demos('dataviz', fam_demos(DATAVIZ, 'kit-dataviz', 'viz'), keep_legacy=True)
# micro
replace_demos('micro', fam_demos(MICRO, 'kit-micro', 'micro'), keep_legacy=True)
# threejs: keep 7 legacy cubes etc, replace scene lab with families
three_legacy = [d for d in cats['threejs']['demos'] if d.get('mod') != 'kit-three']
cats['threejs']['demos'] = three_legacy + fam_demos(THREE, 'kit-three', 'scene')
# filters
replace_demos('filters', fam_demos(FILTERS, 'kit-filters', 'filter'), keep_legacy=[])

# append extras to dense cats
def append_unique(key, items, mod, tag):
    existing = {d['slug'] for d in cats[key]['demos']}
    for slug, title, hint, desc, presets in items:
        if slug in existing: continue
        cats[key]['demos'].append(demo_entry(slug, title, hint, desc, tag, mod, 'mount', slug, presets))

append_unique('layout', LAYOUT_EXTRA, 'kit-layout', 'layout')
append_unique('css-fx', CSS_EXTRA, 'kit-css', 'css')
append_unique('ui', UI_EXTRA, 'kit-ui', 'ui')
append_unique('canvas', CANVAS_EXTRA, 'kit-canvas', 'canvas')
append_unique('svg', SVG_EXTRA, 'kit-svg', 'svg')

# Rebuild categories list order preserved
reg['categories'] = [cats[c['key']] if c['key'] in cats else c for c in reg['categories']]
# actually cats values mutated in place already
reg['categories'] = list(cats[c['key']] for c in json.loads(REGISTRY_JSON.read_text())['categories'])

# counts
print('COUNTS:')
total = 0
for c in reg['categories']:
    n = len(c['demos'])
    total += n
    print(f"  {c['key']}: {n}")
print('TOTAL', total)

# Write JSON
REGISTRY_JSON.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n')
PUBLIC_JSON.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n')

# Generate presets.js FAMILY_PRESETS — merge with existing non-overridden
# Keep chart/css/canvas/ui/svg/layout existing keys; override lab keys; add new family keys
old_presets_text = PRESETS_JS.read_text()
# We'll rebuild fully from current dense cats + new families

FAMILY_PRESETS = {}

# From existing dense kits — pull from current registry demos that have presets
for c in reg['categories']:
    for d in c['demos']:
        mod = d.get('mod', '')
        if not mod.startswith('kit-'): continue
        variant = d.get('variant') or d['slug']
        presets = d.get('presets') or ['默认']
        FAMILY_PRESETS[f"{mod}:{variant}"] = presets

# Also keep numbered chart variants already in registry (variant == slug for kit-charts)
lines = ['/** Auto-generated family presets */', 'export const FAMILY_PRESETS = {']
for k, v in sorted(FAMILY_PRESETS.items()):
    arr = json.dumps(v, ensure_ascii=False)
    lines.append(f'  {json.dumps(k, ensure_ascii=False)}: {arr},')
lines.append('};')
lines.append('')
PRESETS_JS.write_text('\n'.join(lines))

# Generate registry.ts from JSON
def ts_escape(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")

def demo_ts(d):
    parts = [
        f"slug: '{d['slug']}'",
        f"title: '{ts_escape(d['title'])}'",
        f"hint: '{ts_escape(d['hint'])}'",
        f"desc: '{ts_escape(d['desc'])}'",
        f"tag: '{ts_escape(d['tag'])}'",
        f"mod: '{d['mod']}'",
        f"fn: '{d['fn']}'",
    ]
    if d.get('variant'):
        parts.append(f"variant: '{d['variant']}'")
    if d.get('presets'):
        pr = ', '.join("'" + ts_escape(p) + "'" for p in d['presets'])
        parts.append(f"presets: [{pr}]")
    return '      { ' + ', '.join(parts) + ' },'

ts = []
ts.append('/** Auto-generated by scripts/expand_demos.py — do not edit by hand. */')
ts.append('export type DemoMeta = {')
ts.append("  slug: string; title: string; hint: string; desc: string; tag: string;")
ts.append("  mod: string; fn: string; variant?: string; path?: string; cat?: Category; presets?: string[];")
ts.append('};')
ts.append('export type Category = {')
ts.append("  key: string; name: string; icon: string; intro: string; tech: string[]; demos: DemoMeta[];")
ts.append('};')
ts.append('export const categories: Category[] = [')
for c in reg['categories']:
    tech = ', '.join("'" + ts_escape(t) + "'" for t in c.get('tech', []))
    ts.append('  {')
    ts.append(f"    key: '{c['key']}', name: '{ts_escape(c['name'])}', icon: '{ts_escape(c['icon'])}',")
    ts.append(f"    intro: '{ts_escape(c['intro'])}',")
    ts.append(f"    tech: [{tech}],")
    ts.append('    demos: [')
    for d in c['demos']:
        ts.append(demo_ts(d))
    ts.append('    ],')
    ts.append('  },')
ts.append('];')
ts.append('export const routes: Record<string, DemoMeta> = {};')
ts.append('for (const c of categories) {')
ts.append('  for (const d of c.demos) {')
ts.append('    d.path = `/${c.key}/${d.slug}`;')
ts.append('    d.cat = c;')
ts.append('    routes[d.path] = d;')
ts.append('  }')
ts.append('}')
ts.append('export const totalDemos = categories.reduce((n, c) => n + c.demos.length, 0);')
ts.append('')
REGISTRY_TS.write_text('\n'.join(ts))

# Save family index maps for kit patching
maps = {
  'particles': [x[0] for x in PARTICLES],
  'generative': [x[0] for x in GENERATIVE],
  'text': [x[0] for x in TEXT],
  'scroll': [x[0] for x in SCROLL],
  'gsap': [x[0] for x in GSAP],
  'webgl': [x[0] for x in WEBGL],
  'physics': [x[0] for x in PHYSICS],
  'audio': [x[0] for x in AUDIO],
  'dataviz': [x[0] for x in DATAVIZ],
  'micro': [x[0] for x in MICRO],
  'three': [x[0] for x in THREE],
  'filters': [x[0] for x in FILTERS],
}
Path('/tmp/family_maps.json').write_text(json.dumps(maps, ensure_ascii=False, indent=2))
print('Wrote registry + presets; family maps at /tmp/family_maps.json')
