# 参与贡献 / Contributing

感谢你愿意参与！Thanks for helping out! / [README](README.md) · [English README](README.en.md)

## 可以贡献什么 / What to contribute

- 新 Demo、修 Bug、性能优化 / New demos, bug fixes, performance
- 润色中英文说明（英文部分为机器翻译，非常欢迎改进）/ Better zh/en copy (much of the English is machine-translated)
- 移动端和无障碍改进 / Mobile and accessibility fixes

## 开发流程 / Workflow

1. Fork 本仓库并新建分支 / Fork and create a branch: `git checkout -b feat/my-demo`
2. `cd frontend && npm install && npm run dev`
3. 修改后执行 / After changes run: `npm run build` (includes `tsc --noEmit`)
4. 跑检查脚本 / Run the QA scripts (Playwright):
   ```bash
   npx vite preview --port 4179 &
   node knob-audit.mjs      # 每个旋钮都会改变画面 / every knob changes the output
   node info-audit.mjs      # 说明面板齐全 / info panel complete
   node overlap-audit.mjs   # 移动端无重叠 / no overlap on mobile
   node motion-audit.mjs    # 无闪烁卡顿 / no flicker or jank
   ```
5. 提交 PR，写清楚改了什么，附截图或 GIF / Open a PR describing the change with a screenshot or GIF.

## Demo 标准 / Demo checklist

- 只放真正起作用的参数 / Only knobs that actually change something
- 有实时数据读数 / A live data readout
- 有新手能看懂的「公式 / 说明 / 参数 / 用法」，中英文都要 / Beginner-level formula, explanation, params, usage in zh and en
- 默认不自动播放交互动画，遵守「自动演示」开关 / Respect the auto-demo toggle (off by default)
- 舞台占满，手机上不遮挡 / Fill the stage; no overlap on mobile
- `mount()` 返回清理函数，卸载时停止动画和监听 / `mount()` returns a cleanup that stops loops and listeners
- 支持 `prefers-reduced-motion` 更佳 / Bonus: honor `prefers-reduced-motion`

## 提交规范 / Commits

简短、说明意图即可，例如 / Short and descriptive, e.g. `feat(math): add Fourier series demo`, `fix(mobile): header overlap`.

## 安全 / Security

不要提交 `.env`、密钥或服务器地址。/ Never commit `.env`, keys, or server addresses.
