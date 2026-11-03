# SEO（Google + 百度）

站点：<https://component.clyune.com>

## 方案

这是一个 React SPA。百度对纯前端渲染的支持很弱，所以 **Axum 服务端在返回 `index.html` 时按路由注入 SEO 内容**（`backend/src/seo.rs`），不依赖浏览器执行 JS：

| 内容 | 位置 |
| --- | --- |
| 每页唯一的 `<title>`、`description`、`canonical`、`hreflang`（zh-CN / en / x-default）、Open Graph、Twitter Card、JSON-LD | `<!--seo:begin-->…<!--seo:end-->` 之间 |
| 可抓取的静态 HTML 快照：H1、简介、面包屑、全部分类和 Demo 的 `<a href>` 链接 | `#root` 内的 `<!--seo:body-->`，React 挂载后会替换掉 |
| `<html lang>` 与 `Content-Language` | 按 `?lang=` 切换 |

- 语言放在 URL 里：`/path` 是中文（默认，也是 x-default），`/path?lang=en` 是英文。前端语言切换会同步地址栏，爬虫 UA 不会被浏览器语言带偏。
- `/robots.txt`、`/sitemap.xml`（首页 + 20 个分类 + 445 个 Demo，中英各一份，共 932 条，带 hreflang），以及 `/urls.txt`（每行一个中文 URL，方便百度主动推送），都在启动时由 registry 生成。
- 不存在的路由返回 **404 + noindex**，不再是软 404；`/threejs/trig-waves` 301 跳到 `/math/trig-waves`。
- `/assets/*` 带长期缓存（immutable），并开启 gzip/br 压缩。
- 前端在 SPA 内跳转时由 `frontend/src/lib/seo.ts` 同步 title/description/canonical/hreflang/OG（标题和描述公式与 `seo.rs` 保持一致）。
- JSON-LD：首页为 WebSite + Organization（云澜 Clyune，sameAs GitHub 仓库）+ 分类 ItemList；分类页为 CollectionPage + ItemList + BreadcrumbList；Demo 页为 CreativeWork + BreadcrumbList。
- 百度专用：`applicable-device`、`no-transform`、`no-siteapp`，首页带少量 `keywords`。

## 站长验证

不需要改代码。在服务器 `.env` 里设置后重建 api 容器即可（`.env` 不进 git）：

```env
GOOGLE_SITE_VERIFICATION=<Google Search Console「HTML 标记」里 content 的值>
BAIDU_SITE_VERIFICATION=<百度搜索资源平台「HTML标签验证」里 content 的值，如 codeva-xxxx>
```

服务端会注入 `<meta name="google-site-verification">` 和 `<meta name="baidu-site-verification">`。也可以把平台给的验证 `.html` 文件放进 `frontend/public/`。

`docker-compose.sjc.yml` 已透传这两个变量。

## 提交

- Google Search Console：添加网址前缀资源 `https://component.clyune.com/` → 验证 → 站点地图提交 `sitemap.xml`。
- 百度搜索资源平台：添加站点 `https://component.clyune.com` → 验证 → 普通收录 → sitemap 提交 `https://component.clyune.com/sitemap.xml`；也可以用 API 推送 `/urls.txt` 里的 URL。
