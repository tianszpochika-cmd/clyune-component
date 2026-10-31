import { addStyle, panel, defaultParams, parseVariant, hsl, NAMED_COLORS } from './_shared.js';
import { FAMILY_PRESETS } from './presets.js';

const PRESETS = {
  pulse: ['靛紫','青绿','玫红','琥珀','翠绿','天蓝','橙','品红'],
  loader: ['环','点阵','条','方块翻转','呼吸','轨道','涟漪','交叉','双环','弹跳点','旋转三角','进度弧'],
  hover: ['上浮','缩放','边光','扫光','倾斜','边框跑马','阴影扩散','模糊聚焦','霓虹描边','磁吸位移','下划线展开','背景填充'],
  grad: ['默认','冷色','暖色','霓虹','日落','极光'],
  ease: ['linear','ease','ease-in','ease-out','ease-in-out','cubic-in','cubic-out','back','elastic感','steps','bounce感','自定义贝塞尔'],
  spring: ['弹入','弹出','过冲缩放','橡皮筋','沉降回弹','左右晃回','旋转过冲','连环弹跳'],
  stagger: ['列表淡入','卡片瀑布','网格对角','字母拆分','从中心扩散','反向收起','缩放交错','旋转交错'],
  flip: ['网格重排','列表排序','展开卡片','交换两格','过滤显隐','尺寸变形'],
  clip: ['圆揭示','菱形','多边形','斜切','星形','波浪边','对角擦除','圆形收缩','十字','胶囊'],
  xform3d: ['立方体','翻转牌','旋转木马','层叠卡片','门轴打开','翻书','倾斜面板','球体感','棱柱','行列翻转'],
  trans: ['颜色','宽高','透明度','变换','阴影','圆角','字号','边框','滤镜','复合多属性'],
  parallax: ['多层深度','指针跟随','背景慢移','前景快移','卡片深度','文字层差'],
  filter: ['模糊进出','饱和脉动','色相旋转','对比闪','灰度到彩色','霓虹发光','暗角呼吸','色散感'],
  blend: ['screen','multiply','overlay','difference','exclusion','color-dodge','hard-light','soft-light'],
  skeleton: ['卡片','列表','头像行','图表占位','文章段落','网格瓷砖'],
  progress: ['线性','条纹不确定','环形','半环','分段步进','水波填充','像素块','渐变扫'],
  ripple: ['圆心扩散','按钮内裁切','双波','彩色','方块波','长按放大'],
  accordion: ['单开','多开','图标旋转','淡入内容','边框高亮','卡片式'],
  modal: ['淡入缩放','自下滑入','自右滑入','模糊背景','弹跳入','翻转入'],
  carousel: ['滑移','淡入淡出','3D 封面流','卡片堆','垂直','无限循环'],
  reveal: ['遮罩擦除','百叶窗','圆形扩散','对角线','像素块','模糊清晰'],
  neon: ['文字','边框','按钮','图标','双色交替','故障闪'],
  liquid: ['按钮变形','blob 边','水滴菜单','果冻点击','波浪底边','粘滞切换'],
  marquee: ['横向文字','反向','双行','徽标带','垂直','变速'],
  kenburns: ['默认','慢推','对角','急拉'],
  shake: ['左右','上下','旋转','弹性','心跳','震动条'],
  keyseq: ['行走循环','加载变形','颜色节拍','路径感位移','缩放呼吸组合','旋转+位移','闪烁摩斯','多段叙事'],
};

export function mount(host, opts = {}) {
  const { family: kind, style: initialStyle } = parseVariant(opts.variant || 'pulse', 'pulse');
  const presets = FAMILY_PRESETS[`kit-css:${kind}`] || PRESETS[kind] || ['默认'];
  const titles = { pulse:'脉冲环', loader:'加载器', hover:'悬停动效', grad:'渐变流动', ease:'缓动曲线', spring:'弹簧感', stagger:'交错入场', flip:'FLIP 布局', clip:'Clip-path', xform3d:'3D Transform', trans:'过渡属性', parallax:'视差', filter:'滤镜动效', blend:'混合模式', skeleton:'骨架屏', progress:'进度条', ripple:'涟漪', accordion:'手风琴', modal:'弹层进出', carousel:'轮播', reveal:'揭示', neon:'霓虹', liquid:'液态', marquee:'跑马灯', kenburns:'Ken Burns', shake:'抖动反馈', keyseq:'关键帧序列' };

  const needsEasing = kind === 'ease' || kind === 'trans' || kind === 'spring';
  const params = defaultParams({ color: true, speed: true, size: true, easing: needsEasing });
  if (kind === 'parallax') params.push({ key: 'depth', type: 'range', label: '深度', min: 0.2, max: 2, step: 0.1, value: 1 });

  const actions = [];
  if (['ease','spring','stagger','flip','clip','filter','progress','reveal','shake','keyseq','ripple'].includes(kind)) {
    actions.push({ key: 'trigger', label: '触发 / 重播' });
  }
  if (kind === 'modal') actions.push({ key: 'trigger', label: '打开' });
  if (kind === 'carousel') {
    actions.push({ key: 'prev', label: '‹' });
    actions.push({ key: 'next', label: '›' });
  }

  let live = { style: initialStyle % presets.length, color: '#818cf8', speed: 1, size: 1, easing: 'ease', depth: 1 };
  let disposers = [];

  const ui = panel(host, titles[kind] || kind, {
    presets,
    params,
    actions,
    presetIndex: live.style,
    onChange(state, meta) {
      live = { ...live, ...state };
      if (meta.reason === 'preset') {
        const named = NAMED_COLORS[state.styleName];
        if (named) {
          live.color = named;
          ui.set({ color: named });
        }
        remount();
        return;
      }
      if (meta.reason === 'param') {
        applyLive();
        if (meta.key === 'easing' && kind === 'ease') remount();
        return;
      }
      if (meta.reason === 'action') {
        trigger(meta.key);
      }
    },
  });

  const rmStyle = addStyle(`
    .kit-css{position:absolute;inset:0;display:grid;place-items:center;padding:20px;overflow:auto;--c:#818cf8;--spd:1;--sz:1}
    .kit-css .box{width:calc(min(260px,70%) * var(--sz));aspect-ratio:1;border-radius:20px;display:grid;place-items:center;font-weight:700;color:#fff;position:relative;background:var(--c)}
    .kit-css .card{width:calc(min(220px,85%) * var(--sz));padding:16px;border-radius:14px;background:#18233d;border:1px solid #24314f;transition:.35s;text-align:center;color:var(--text,#e8eefc)}
    .kit-css .row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
    .kit-css .list{display:flex;flex-direction:column;gap:8px;width:min(360px,92%)}
    .kit-css .list .item{padding:12px 14px;border-radius:10px;background:#18233d;border:1px solid #24314f}
    .kit-css .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(360px,92%)}
    .k-pulse{animation:kp calc(1.8s / var(--spd)) ease-out infinite}
    .k-pulse::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c);animation:kr calc(1.8s / var(--spd)) ease-out infinite}
    @keyframes kp{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes kr{from{transform:scale(1);opacity:.8}to{transform:scale(1.55);opacity:0}}
    .k-loader{width:calc(56px * var(--sz));height:calc(56px * var(--sz));border:4px solid #24314f;border-top-color:var(--c);border-radius:50%;animation:kl calc(1s / var(--spd)) linear infinite}
    @keyframes kl{to{transform:rotate(360deg)}}
    .k-dots{display:flex;gap:8px}.k-dots i{width:calc(12px * var(--sz));height:calc(12px * var(--sz));border-radius:50%;background:var(--c);animation:kb calc(.9s / var(--spd)) ease-in-out infinite}
    .k-dots i:nth-child(2){animation-delay:.15s}.k-dots i:nth-child(3){animation-delay:.3s}
    @keyframes kb{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-14px);opacity:1}}
    .k-bars{display:flex;gap:5px;align-items:flex-end;height:calc(48px * var(--sz))}.k-bars i{width:7px;background:var(--c);border-radius:3px;animation:ke calc(1s / var(--spd)) ease-in-out infinite}
    .k-bars i:nth-child(2){animation-delay:-.2s}.k-bars i:nth-child(3){animation-delay:-.4s}.k-bars i:nth-child(4){animation-delay:-.6s}.k-bars i:nth-child(5){animation-delay:-.8s}
    @keyframes ke{0%,100%{height:10px}50%{height:48px}}
    .k-flip{animation:kf calc(2.4s / var(--spd)) ease-in-out infinite;background:linear-gradient(135deg,var(--c),#22d3ee)}
    @keyframes kf{0%,100%{border-radius:16px;transform:rotateY(0)}50%{border-radius:50%;transform:rotateY(180deg)}}
    .k-breathe{animation:kbr calc(2s / var(--spd)) ease-in-out infinite;box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 50%,transparent)}
    @keyframes kbr{0%,100%{transform:scale(1);box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 45%,transparent)}50%{transform:scale(1.08);box-shadow:0 0 0 18px transparent}}
    .k-orbit{width:calc(64px * var(--sz));height:calc(64px * var(--sz));position:relative}.k-orbit span{position:absolute;inset:0;border:2px dashed color-mix(in srgb,var(--c) 50%,#24314f);border-radius:50%;animation:ko calc(3s / var(--spd)) linear infinite}
    .k-orbit i{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--c);top:50%;left:50%;margin:-7px;animation:ko calc(3s / var(--spd)) linear infinite}
    @keyframes ko{to{transform:rotate(360deg) translateX(32px)}}
    .k-ripple-box{border-radius:50%}.k-ripple-box::before,.k-ripple-box::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--c);animation:kri calc(2s / var(--spd)) ease-out infinite}
    .k-ripple-box::after{animation-delay:1s}
    @keyframes kri{from{transform:scale(1);opacity:.7}to{transform:scale(2.2);opacity:0}}
    .k-cross{width:48px;height:48px;position:relative}.k-cross:before,.k-cross:after{content:'';position:absolute;background:var(--c);border-radius:4px;animation:kc calc(1.2s / var(--spd)) ease-in-out infinite}
    .k-cross:before{inset:0 40%}.k-cross:after{inset:40% 0;animation-delay:.3s}
    @keyframes kc{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
    .k-dual{width:56px;height:56px;border:3px solid transparent;border-top-color:var(--c);border-bottom-color:#22d3ee;border-radius:50%;animation:kl calc(.8s / var(--spd)) linear infinite}
    .k-tri{width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:30px solid var(--c);animation:kt calc(1.2s / var(--spd)) linear infinite;transform-origin:50% 70%}
    @keyframes kt{to{transform:rotate(360deg)}}
    .k-arc{width:64px;height:64px;border-radius:50%;background:conic-gradient(var(--c) 0 120deg,transparent 0);-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 6px),#000 0);mask:radial-gradient(farthest-side,#0000 calc(100% - 6px),#000 0);animation:kl calc(1s / var(--spd)) linear infinite}
    .hover-lift:hover{transform:translateY(-8px);box-shadow:0 16px 32px -12px rgba(129,140,248,.55);border-color:var(--c)}
    .hover-scale:hover{transform:scale(1.06)}
    .hover-glow:hover{box-shadow:0 0 0 2px var(--c),0 0 28px color-mix(in srgb,var(--c) 45%,transparent)}
    .hover-shine{overflow:hidden;position:relative}.hover-shine::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.25),transparent 60%);transform:translateX(-120%);transition:transform .6s}
    .hover-shine:hover::after{transform:translateX(120%)}
    .hover-tilt:hover{transform:perspective(600px) rotateX(8deg) rotateY(-8deg)}
    .hover-marquee{position:relative;overflow:hidden}.hover-marquee::before{content:'';position:absolute;inset:0;border:2px solid transparent;border-radius:inherit;background:linear-gradient(#18233d,#18233d) padding-box,linear-gradient(90deg,var(--c),#22d3ee,var(--c)) border-box;background-size:200% 100%;opacity:0;transition:.2s}
    .hover-marquee:hover::before{opacity:1;animation:km calc(1.5s / var(--spd)) linear infinite}
    @keyframes km{to{background-position:200% 0}}
    .hover-shadow:hover{box-shadow:0 20px 40px -10px color-mix(in srgb,var(--c) 55%,transparent)}
    .hover-blur{filter:blur(.3px);transition:.3s}.hover-blur:hover{filter:none;background:#1d2a4a}
    .hover-neon:hover{box-shadow:0 0 8px var(--c),0 0 24px var(--c),0 0 48px color-mix(in srgb,var(--c) 50%,transparent);color:var(--c)}
    .hover-mag{transition:transform .2s}.hover-mag:hover{transform:translate(6px,-4px)}
    .hover-uline{position:relative}.hover-uline::after{content:'';position:absolute;left:16px;right:16px;bottom:10px;height:2px;background:var(--c);transform:scaleX(0);transition:.3s}
    .hover-uline:hover::after{transform:scaleX(1)}
    .hover-fill{position:relative;overflow:hidden;z-index:0}.hover-fill::before{content:'';position:absolute;inset:0;background:var(--c);transform:scaleY(0);transform-origin:bottom;transition:.35s;z-index:-1}
    .hover-fill:hover::before{transform:scaleY(1)}.hover-fill:hover{color:#0b1020;border-color:var(--c)}
    .grad-flow{width:min(420px,90%);height:140px;border-radius:18px;background:linear-gradient(120deg,var(--c),#22d3ee,#f472b6,var(--c));background-size:300% 300%;animation:kg calc(6s / var(--spd)) linear infinite;display:grid;place-items:center;font-weight:700;color:#fff}
    @keyframes kg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    .ease-track{width:min(420px,92%);height:64px;background:#0d1426;border-radius:12px;position:relative;border:1px solid #24314f}
    .ease-ball{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:50%;background:var(--c)}
    .spring-box{width:calc(100px * var(--sz));height:calc(100px * var(--sz));border-radius:18px;background:var(--c);display:grid;place-items:center;font-weight:800;color:#0b1020}
    .stagger .item{opacity:0;transform:translateY(16px)}
    .stagger.run .item{animation:stIn calc(.55s / var(--spd)) forwards}
    .stagger.run .item:nth-child(1){animation-delay:.05s}.stagger.run .item:nth-child(2){animation-delay:.12s}
    .stagger.run .item:nth-child(3){animation-delay:.19s}.stagger.run .item:nth-child(4){animation-delay:.26s}
    .stagger.run .item:nth-child(5){animation-delay:.33s}.stagger.run .item:nth-child(6){animation-delay:.4s}
    @keyframes stIn{to{opacity:1;transform:none}}
    .flip-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(320px,90%)}
    .flip-grid .cell{height:72px;border-radius:12px;background:color-mix(in srgb,var(--c) 45%,#121a2f);display:grid;place-items:center;font-weight:700;color:#fff;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
    .clip-demo{width:calc(min(280px,80%) * var(--sz));aspect-ratio:1;background:linear-gradient(135deg,var(--c),#22d3ee);display:grid;place-items:center;font-weight:800;color:#0b1020;transition:clip-path .55s}
    .scene3d{perspective:900px;width:min(280px,80%);height:180px;display:grid;place-items:center}
    .cube3d{width:100px;height:100px;position:relative;transform-style:preserve-3d;animation:spin3d calc(6s / var(--spd)) linear infinite}
    .cube3d i{position:absolute;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 70%,#000);border:1px solid #fff3;font-weight:700}
    .cube3d i:nth-child(1){transform:translateZ(50px)}.cube3d i:nth-child(2){transform:rotateY(90deg) translateZ(50px)}
    .cube3d i:nth-child(3){transform:rotateY(180deg) translateZ(50px)}.cube3d i:nth-child(4){transform:rotateY(-90deg) translateZ(50px)}
    .cube3d i:nth-child(5){transform:rotateX(90deg) translateZ(50px)}.cube3d i:nth-child(6){transform:rotateX(-90deg) translateZ(50px)}
    @keyframes spin3d{to{transform:rotateX(360deg) rotateY(360deg)}}
    .card3d{width:160px;height:100px;transform-style:preserve-3d;transition:transform .6s;cursor:pointer;position:relative}
    .card3d .f,.card3d .b{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;display:grid;place-items:center;font-weight:700}
    .card3d .f{background:var(--c);color:#0b1020}.card3d .b{background:#22d3ee;color:#0b1020;transform:rotateY(180deg)}
    .card3d.flipped{transform:rotateY(180deg)}
    .parallax-stage{position:relative;width:min(420px,92%);height:200px;border-radius:16px;overflow:hidden;background:#0d1426;border:1px solid #24314f;display:grid;place-items:center}
    .parallax-stage span{position:absolute;border-radius:50%;background:var(--c);opacity:.35;transition:transform .1s linear}
    .skel{width:min(380px,92%);display:flex;flex-direction:column;gap:10px}
    .skel .b{height:14px;border-radius:8px;background:linear-gradient(90deg,#18233d 25%,#24314f 37%,#18233d 63%);background-size:400% 100%;animation:shimmer calc(1.4s / var(--spd)) ease infinite}
    .skel .b.lg{height:120px}.skel .b.sm{width:40%}.skel .row{display:flex;gap:12px;align-items:center}
    .skel .av{width:48px;height:48px;border-radius:50%;flex:none}
    @keyframes shimmer{0%{background-position:100% 0}100%{background-position:0 0}}
    .prog{width:min(360px,92%);height:12px;background:#0d1426;border-radius:999px;overflow:hidden;border:1px solid #24314f}
    .prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--c),#22d3ee);transition:width 1s}
    .prog.indeterminate i{width:40%;animation:indeterm calc(1.2s / var(--spd)) ease-in-out infinite}
    @keyframes indeterm{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
    .ringp{width:96px;height:96px;border-radius:50%;background:conic-gradient(var(--c) var(--p,40%),#24314f 0);display:grid;place-items:center}
    .ringp::after{content:attr(data-v);width:70%;height:70%;border-radius:50%;background:#0d1426;display:grid;place-items:center;font-weight:700;color:var(--text,#e8eefc)}
    .rip-host{position:relative;overflow:hidden;padding:16px 28px;border-radius:12px;background:var(--c);color:#0b1020;font-weight:700;border:0;cursor:pointer}
    .rip-host span.r{position:absolute;border-radius:50%;background:rgba(255,255,255,.45);transform:scale(0);animation:rip .6s ease-out forwards;pointer-events:none}
    @keyframes rip{to{transform:scale(12);opacity:0}}
    .acc{width:min(400px,92%);display:flex;flex-direction:column;gap:8px}
    .acc details{background:#18233d;border:1px solid #24314f;border-radius:12px;padding:4px 12px;transition:border-color .2s}
    .acc details[open]{border-color:var(--c)}
    .acc summary{cursor:pointer;padding:10px 4px;font-weight:600;list-style:none}
    .acc summary::-webkit-details-marker{display:none}
    .acc .body{padding:0 4px 12px;color:var(--muted,#93a0c0);font-size:13px;animation:fadeIn .3s}
    @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .modal-back{position:absolute;inset:0;background:rgba(5,8,16,.65);display:grid;place-items:center;opacity:0;pointer-events:none;transition:.3s;z-index:5}
    .modal-back.on{opacity:1;pointer-events:auto}
    .modal-panel{width:min(320px,86%);background:#18233d;border:1px solid #24314f;border-radius:16px;padding:20px;transform:scale(.9);transition:.3s}
    .modal-back.on .modal-panel{transform:none}
    .modal-back.blur-bg{backdrop-filter:blur(8px)}
    .car{width:min(400px,92%);overflow:hidden;border-radius:14px;border:1px solid #24314f;position:relative}
    .car-track{display:flex;transition:transform .45s ease}
    .car-track .slide{min-width:100%;height:160px;display:grid;place-items:center;font-weight:800;font-size:28px;color:#fff}
    .neon-t{font-size:calc(42px * var(--sz));font-weight:900;color:#fff;text-shadow:0 0 6px var(--c),0 0 18px var(--c),0 0 36px var(--c);animation:neonBreath calc(2s / var(--spd)) ease-in-out infinite}
    @keyframes neonBreath{50%{filter:brightness(1.25)}}
    .liquid-btn{padding:14px 28px;border:0;border-radius:999px;background:var(--c);color:#0b1020;font-weight:800;cursor:pointer;transition:border-radius .35s,transform .2s}
    .liquid-btn:hover{border-radius:16px 40px 16px 40px;transform:scale(1.04)}
    .marq{width:min(420px,92%);overflow:hidden;border:1px solid #24314f;border-radius:12px;background:#0d1426;padding:12px 0}
    .marq-inner{display:flex;gap:32px;width:max-content;animation:marq calc(12s / var(--spd)) linear infinite;font-weight:700;color:var(--text,#e8eefc)}
    .marq:hover .marq-inner{animation-play-state:paused}
    @keyframes marq{to{transform:translateX(-50%)}}
    .kb{width:min(360px,90%);height:180px;border-radius:14px;background:radial-gradient(circle at 30% 40%,var(--c),#22d3ee 40%,#0d1426 70%);animation:kburn calc(8s / var(--spd)) ease-in-out infinite alternate;border:1px solid #24314f}
    @keyframes kburn{from{background-size:100% 100%;background-position:30% 40%}to{background-size:140% 140%;background-position:70% 60%}}
    .shake-box{padding:18px 24px;border-radius:12px;background:#18233d;border:1px solid #24314f;font-weight:700;color:var(--text,#e8eefc)}
    .shake-box.go-x{animation:shx .4s}.shake-box.go-y{animation:shy .4s}.shake-box.go-r{animation:shr .4s}
    @keyframes shx{10%,90%{transform:translateX(-4px)}20%,80%{transform:translateX(6px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
    @keyframes shy{10%,90%{transform:translateY(-3px)}30%,70%{transform:translateY(6px)}50%{transform:translateY(-6px)}}
    @keyframes shr{20%{transform:rotate(-4deg)}40%{transform:rotate(4deg)}60%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}}
    .reveal-box{width:min(280px,80%);height:160px;border-radius:14px;background:linear-gradient(135deg,var(--c),#22d3ee);display:grid;place-items:center;font-weight:800;color:#0b1020;position:relative;overflow:hidden}
    .reveal-box::after{content:'';position:absolute;inset:0;background:#0b1020;transition:clip-path .7s,opacity .7s;clip-path:circle(75% at 50% 50%)}
    .reveal-box.on::after{clip-path:circle(0% at 50% 50%);opacity:0}
    .blend-stage{position:relative;width:min(360px,90%);height:200px;border-radius:16px;overflow:hidden;background:#111}
    .blend-stage .a,.blend-stage .b{position:absolute;width:160px;height:160px;border-radius:50%;top:20px}
    .blend-stage .a{left:40px;background:var(--c)}.blend-stage .b{right:40px;background:#22d3ee}
  `);

  const root = document.createElement('div');
  root.className = 'kit-css';
  ui.stage.appendChild(root);

  const easings = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'cubic-bezier(.55,0,1,.45)', 'cubic-bezier(0,.55,.45,1)',
    'cubic-bezier(.34,1.56,.64,1)', 'cubic-bezier(.5,1.8,.5,.8)',
    'steps(5)', 'cubic-bezier(.68,-.55,.27,1.55)', 'cubic-bezier(.17,.67,.42,1.3)',
  ];
  const clips = [
    'circle(20% at 50% 50%)', 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
    'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
    'polygon(0 0,100% 0,100% 70%,0 100%)',
    'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    'polygon(0 20%,100% 0,100% 80%,0 100%)', 'polygon(0 0,100% 0,0 100%)', 'circle(0% at 50% 50%)',
    'polygon(40% 0,60% 0,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0 60%,0 40%,40% 40%)',
    'inset(10% 20% round 40px)',
  ];
  const blends = ['screen', 'multiply', 'overlay', 'difference', 'exclusion', 'color-dodge', 'hard-light', 'soft-light'];
  let carIdx = 0;
  let handlers = {};

  function n() { return (live.style || 0) + 1; }
  function applyLive() {
    const c = live.color || '#818cf8';
    const spd = String(live.speed || 1);
    const sz = String(live.size || 1);
    for (const el of [root, ui.stage]) {
      if (!el) continue;
      el.style.setProperty('--c', c);
      el.style.setProperty('--spd', spd);
      el.style.setProperty('--sz', sz);
    }
  }

  function buildHtml() {
    const si = live.style || 0;
    const color = live.color || '#818cf8';
    if (kind === 'pulse') return `<div class="box k-pulse">PULSE</div>`;
    if (kind === 'loader') {
      const kinds = ['ring','dots','bars','flip','breathe','orbit','ripple','cross','dual','bounce','tri','arc'];
      const k = kinds[si % kinds.length];
      if (k === 'ring') return `<div class="k-loader"></div>`;
      if (k === 'dots' || k === 'bounce') return `<div class="k-dots"><i></i><i></i><i></i>${k==='bounce'?'<i></i>':''}</div>`;
      if (k === 'bars') return `<div class="k-bars"><i></i><i></i><i></i><i></i><i></i></div>`;
      if (k === 'flip') return `<div class="box k-flip" style="width:80px;height:80px"></div>`;
      if (k === 'breathe') return `<div class="box k-breathe" style="width:80px;height:80px"></div>`;
      if (k === 'orbit') return `<div class="k-orbit"><span></span><i></i></div>`;
      if (k === 'ripple') return `<div class="box k-ripple-box" style="width:72px;height:72px"></div>`;
      if (k === 'cross') return `<div class="k-cross"></div>`;
      if (k === 'dual') return `<div class="k-dual"></div>`;
      if (k === 'tri') return `<div class="k-tri"></div>`;
      return `<div class="k-arc"></div>`;
    }
    if (kind === 'hover') {
      const cls = ['hover-lift','hover-scale','hover-glow','hover-shine','hover-tilt','hover-marquee','hover-shadow','hover-blur','hover-neon','hover-mag','hover-uline','hover-fill'][si % 12];
      return `<div class="card ${cls}"><b>Hover me</b><div style="color:var(--muted);font-size:12px;margin-top:6px">${presets[si] || cls}</div></div>`;
    }
    if (kind === 'grad') return `<div class="grad-flow">Gradient Flow</div>`;
    if (kind === 'ease') return `<div class="list" style="gap:14px;align-items:center"><div style="color:var(--muted);font-size:12px">${easings[si % easings.length]}</div><div class="ease-track"><div class="ease-ball" data-ball></div></div></div>`;
    if (kind === 'spring') return `<div class="spring-box" data-spring>SPRING</div>`;
    if (kind === 'stagger') return `<div class="list stagger" data-st>${[1,2,3,4,5,6].map(i=>`<div class="item">Stagger item ${i}</div>`).join('')}</div>`;
    if (kind === 'flip') return `<div class="flip-grid" data-flip>${[1,2,3,4,5,6,7,8,9].map(i=>`<div class="cell">${i}</div>`).join('')}</div>`;
    if (kind === 'clip') return `<div class="clip-demo" data-clip style="clip-path:${clips[si % clips.length]}">CLIP</div>`;
    if (kind === 'xform3d') {
      return si % 2 === 0
        ? `<div class="scene3d"><div class="cube3d"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i></div></div>`
        : `<div class="card3d" data-flip3d><div class="f">Front</div><div class="b">Back</div></div>`;
    }
    if (kind === 'trans') {
      const props = ['background','width','opacity','transform','box-shadow','border-radius','font-size','border-color','filter','all'];
      const p = props[si % props.length];
      return `<div class="card" data-trans data-prop="${p}">transition: ${p}<div style="font-size:12px;color:var(--muted);margin-top:8px">悬停变化</div></div>`;
    }
    if (kind === 'parallax') {
      return `<div class="parallax-stage" data-par>${[0,1,2,3,4].map(i=>`<span style="width:${40+i*20}px;height:${40+i*20}px;left:${10+i*15}%;top:${20+i*10}%;opacity:${0.2+i*0.1};background:${hsl(i+si)}" data-d="${0.2+i*0.2}"></span>`).join('')}<b style="position:relative;z-index:2;color:#fff">Parallax</b></div>`;
    }
    if (kind === 'filter') return `<div class="box" data-filt>FILTER</div>`;
    if (kind === 'blend') {
      const m = blends[si % blends.length];
      return `<div class="blend-stage" data-blend><div class="a"></div><div class="b" style="mix-blend-mode:${m}"></div><b style="position:absolute;bottom:12px;left:0;right:0;text-align:center;color:#fff">${m}</b></div>`;
    }
    if (kind === 'skeleton') {
      return si % 2 === 0
        ? `<div class="skel"><div class="b lg"></div><div class="b"></div><div class="b sm"></div></div>`
        : `<div class="skel"><div class="row"><div class="b av"></div><div style="flex:1"><div class="b"></div><div class="b sm" style="margin-top:8px"></div></div></div><div class="b"></div><div class="b"></div></div>`;
    }
    if (kind === 'progress') {
      if (si === 2 || si === 3) return `<div class="ringp" data-ring data-v="40%" style="--p:40%"></div>`;
      if (si === 1) return `<div class="prog indeterminate"><i></i></div>`;
      return `<div class="prog"><i data-p></i></div>`;
    }
    if (kind === 'ripple') return `<button class="rip-host" data-rip>Click ripple</button>`;
    if (kind === 'accordion') return `<div class="acc">${[1,2,3].map(i=>`<details ${i===1?'open':''}><summary>Section ${i}</summary><div class="body">Accordion content ${i}</div></details>`).join('')}</div>`;
    if (kind === 'modal') return `<button class="btn" data-open>打开弹层</button><div class="modal-back ${si===3?'blur-bg':''}" data-modal><div class="modal-panel"><h3 style="margin:0 0 8px">Modal</h3><p style="color:var(--muted);font-size:13px">Enter / exit · ${presets[si]||''}</p><button class="btn" data-close>关闭</button></div></div>`;
    if (kind === 'carousel') return `<div class="car"><div class="car-track" data-car>${[1,2,3,4].map(i=>`<div class="slide" style="background:${hsl(i+si)}">${i}</div>`).join('')}</div></div>`;
    if (kind === 'reveal') return `<div class="reveal-box" data-rev>REVEAL</div>`;
    if (kind === 'neon') return `<div class="neon-t">NEON</div>`;
    if (kind === 'liquid') return `<button class="liquid-btn">Liquid</button>`;
    if (kind === 'marquee') {
      const t = 'Clyune · CSS · Motion · Transition · ';
      return `<div class="marq"><div class="marq-inner" style="animation-direction:${si%2?'reverse':'normal'}"><span>${t}</span><span>${t}</span></div></div>`;
    }
    if (kind === 'kenburns') return `<div class="kb"></div>`;
    if (kind === 'shake') return `<div class="shake-box" data-shake>Shake me</div>`;
    if (kind === 'keyseq') return `<div class="box" data-keyseq style="animation:kp calc(1.2s / var(--spd)) ease-in-out infinite">KF</div>`;
    return `<div class="grad-flow">${kind}</div>`;
  }

  function wire() {
    disposers.forEach((fn) => { try { fn(); } catch (_) {} });
    disposers = [];
    handlers = {};
    const si = live.style || 0;

    if (kind === 'ease') {
      handlers.trigger = () => {
        const b = root.querySelector('[data-ball]');
        if (!b) return;
        const ease = live.easing || easings[si % easings.length];
        b.style.transition = 'none'; b.style.left = '12px'; b.getBoundingClientRect();
        b.style.transition = `left ${1.2 / (live.speed || 1)}s ${ease}`;
        b.style.left = 'calc(100% - 52px)';
      };
      setTimeout(() => handlers.trigger?.(), 150);
    }
    if (kind === 'spring') {
      handlers.trigger = () => {
        const el = root.querySelector('[data-spring]'); if (!el) return;
        const maps = ['scale(0.2)','scale(1.4)','scale(1.35)','scale(0.85) translateY(8px)','translateY(40px)','translateX(30px)','rotate(25deg) scale(1.1)','translateY(-20px)'];
        el.style.transition = 'none'; el.style.transform = maps[si % maps.length]; el.getBoundingClientRect();
        el.style.transition = `transform ${0.7/(live.speed||1)}s cubic-bezier(.34,1.56,.64,1)`; el.style.transform = 'none';
      };
      setTimeout(() => handlers.trigger?.(), 120);
    }
    if (kind === 'stagger') {
      handlers.trigger = () => { const el = root.querySelector('[data-st]'); el?.classList.remove('run'); void el?.offsetWidth; el?.classList.add('run'); };
      setTimeout(() => handlers.trigger?.(), 80);
    }
    if (kind === 'flip') {
      handlers.trigger = () => {
        const g = root.querySelector('[data-flip]'); if (!g) return;
        const cells = [...g.children];
        const first = cells.map((c) => c.getBoundingClientRect());
        const arr = [...cells];
        for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); g.appendChild(arr[j]); arr.splice(j, 1); }
        [...g.children].forEach((c, i) => {
          const last = c.getBoundingClientRect();
          const dx = first[i].left - last.left, dy = first[i].top - last.top;
          c.style.transition = 'none'; c.style.transform = `translate(${dx}px,${dy}px)`; c.getBoundingClientRect();
          c.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)'; c.style.transform = 'none';
        });
      };
    }
    if (kind === 'clip') {
      let on = false; const el = root.querySelector('[data-clip]');
      handlers.trigger = () => { on = !on; if (el) el.style.clipPath = on ? 'circle(75% at 50% 50%)' : clips[si % clips.length]; };
      el?.addEventListener('click', handlers.trigger);
    }
    if (kind === 'xform3d') {
      const el = root.querySelector('[data-flip3d]');
      const fn = (e) => e.currentTarget.classList.toggle('flipped');
      el?.addEventListener('click', fn);
      if (el) disposers.push(() => el.removeEventListener('click', fn));
    }
    if (kind === 'trans') {
      const el = root.querySelector('[data-trans]'); const prop = el?.dataset.prop;
      const enter = () => {
        if (!el) return;
        if (prop === 'background') el.style.background = hsl(si + 3);
        if (prop === 'width') el.style.width = '280px';
        if (prop === 'opacity') el.style.opacity = '0.45';
        if (prop === 'transform') el.style.transform = 'scale(1.08) rotate(-2deg)';
        if (prop === 'box-shadow') el.style.boxShadow = `0 12px 40px ${live.color}`;
        if (prop === 'border-radius') el.style.borderRadius = '40px';
        if (prop === 'font-size') el.style.fontSize = '20px';
        if (prop === 'border-color') el.style.borderColor = live.color;
        if (prop === 'filter') el.style.filter = 'hue-rotate(90deg)';
        if (prop === 'all') { el.style.transform = 'translateY(-6px)'; el.style.background = '#1d2a4a'; el.style.borderColor = live.color; }
      };
      const leave = () => { if (!el) return; el.style.background=''; el.style.width=''; el.style.opacity=''; el.style.transform=''; el.style.boxShadow=''; el.style.borderRadius=''; el.style.fontSize=''; el.style.borderColor=''; el.style.filter=''; };
      el?.addEventListener('mouseenter', enter); el?.addEventListener('mouseleave', leave);
      if (el) disposers.push(() => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
    }
    if (kind === 'parallax') {
      const stageEl = root.querySelector('[data-par]');
      const move = (e) => {
        const r = stageEl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        const depth = live.depth || 1;
        stageEl.querySelectorAll('span').forEach((s) => { const d = (parseFloat(s.dataset.d) || 0.3) * depth; s.style.transform = `translate(${x * 40 * d}px,${y * 30 * d}px)`; });
      };
      stageEl?.addEventListener('pointermove', move);
      if (stageEl) disposers.push(() => stageEl.removeEventListener('pointermove', move));
    }
    if (kind === 'filter') {
      const filters = ['blur(6px)','saturate(2.5)','hue-rotate(180deg)','contrast(1.8)','grayscale(1)','drop-shadow(0 0 12px var(--c))','brightness(0.6)','blur(1px) contrast(1.4) saturate(1.8)'];
      const el = root.querySelector('[data-filt]');
      handlers.trigger = () => { if (!el) return; el.style.transition = 'filter .6s'; el.style.filter = filters[si % filters.length]; };
      setTimeout(() => handlers.trigger?.(), 120);
    }
    if (kind === 'blend') {
      const stageEl = root.querySelector('[data-blend]');
      const move = (e) => {
        const r = stageEl.getBoundingClientRect(); const b = stageEl.querySelector('.b');
        if (b) { b.style.left = `${e.clientX - r.left - 80}px`; b.style.top = `${e.clientY - r.top - 80}px`; b.style.right = 'auto'; }
      };
      stageEl?.addEventListener('pointermove', move);
      if (stageEl) disposers.push(() => stageEl.removeEventListener('pointermove', move));
    }
    if (kind === 'progress') {
      handlers.trigger = () => {
        const p = root.querySelector('[data-p]');
        if (p) { p.style.width = '0%'; p.getBoundingClientRect(); p.style.width = `${30 + Math.random() * 60}%`; }
        const ring = root.querySelector('[data-ring]');
        if (ring) { const v = 20 + Math.floor(Math.random() * 75); ring.style.setProperty('--p', `${v}%`); ring.dataset.v = `${v}%`; }
      };
      setTimeout(() => handlers.trigger?.(), 120);
    }
    if (kind === 'ripple') {
      const btn = root.querySelector('[data-rip]');
      const click = (e) => {
        const r = btn.getBoundingClientRect();
        const s = document.createElement('span'); s.className = 'r';
        const size = Math.max(r.width, r.height);
        s.style.width = s.style.height = `${size}px`;
        s.style.left = `${e.clientX - r.left - size / 2}px`; s.style.top = `${e.clientY - r.top - size / 2}px`;
        btn.appendChild(s); setTimeout(() => s.remove(), 600);
      };
      btn?.addEventListener('click', click);
      handlers.trigger = () => btn?.click();
      if (btn) disposers.push(() => btn.removeEventListener('click', click));
    }
    if (kind === 'modal') {
      const back = root.querySelector('[data-modal]');
      const open = () => back?.classList.add('on');
      const close = () => back?.classList.remove('on');
      root.querySelector('[data-open]')?.addEventListener('click', open);
      root.querySelector('[data-close]')?.addEventListener('click', close);
      back?.addEventListener('click', (e) => { if (e.target === back) close(); });
      handlers.trigger = open;
    }
    if (kind === 'carousel') {
      carIdx = 0;
      const track = root.querySelector('[data-car]');
      const go = (d) => { carIdx = (carIdx + d + 4) % 4; if (track) track.style.transform = `translateX(-${carIdx * 100}%)`; };
      handlers.prev = () => go(-1); handlers.next = () => go(1); handlers.trigger = () => go(1);
    }
    if (kind === 'reveal') {
      const el = root.querySelector('[data-rev]');
      handlers.trigger = () => el?.classList.toggle('on');
      el?.addEventListener('click', handlers.trigger);
    }
    if (kind === 'shake') {
      const el = root.querySelector('[data-shake]');
      const cls = ['go-x','go-y','go-r','go-x','go-y','go-r'][si % 6];
      handlers.trigger = () => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
      el?.addEventListener('click', handlers.trigger);
    }
  }

  function remount() {
    root.innerHTML = buildHtml();
    applyLive();
    wire();
  }
  function trigger(key) {
    if (key === 'prev') handlers.prev?.();
    else if (key === 'next') handlers.next?.();
    else handlers.trigger?.();
  }

  // Seed color from named preset (pulse/grad/neon)
  {
    const named = NAMED_COLORS[presets[live.style] || ''];
    if (named) { live.color = named; ui.set({ color: named }); }
  }
  remount();
  return () => { disposers.forEach((fn) => { try { fn(); } catch (_) {} }); rmStyle(); ui.destroy(); };
}
