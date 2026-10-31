# Clyune Component Gallery

Rust (Axum) + React (Vite + TypeScript) + **lightweight Postgres** port of [component.clyune.com](https://component.clyune.com).

中文：云澜 Component 演示站源码。演示元数据可存在 **Postgres**（Docker Compose，内存硬限约 512MB–1GB）；未配置 `DATABASE_URL` 时回退到内嵌 `registry.json`。不引入 CloudStudy 那套重 MySQL/Kafka。

English: Axum serves `/api/*` + the React SPA. Optional Postgres (sqlx + migrations). Seeded from the live site registry (12 categories / 40 demos). Target RAM for db+api well under 2GB.

## Architecture

```
frontend/               Vite + React 18 + TS (admin gallery shell)
  src/demos/            Original mount() demos (ESM)
  src/lib/              canvas helpers + CDN loader
  src/registry.ts       Client-side registry (routing / sidebar)
backend/
  src/                  Axum + sqlx
  migrations/           Postgres schema
  data/registry.json    Seed + JSON fallback
docker-compose.yml      db (always) + api (profile: full)
```

### API

| Method | Path | Source |
|--------|------|--------|
| GET | `/api/health` | process |
| GET | `/api/categories` | Postgres (or JSON fallback) |
| GET | `/api/demos/:category/:slug` | Postgres (or JSON fallback) |

### Schema (Postgres)

- `categories` — key, name, icon, intro, tech JSONB, sort_order
- `demos` — slug, category_id, title, hint, description, tag, tech JSONB, mount_mod, mount_fn, published
- `demo_stats` — demo_id, day, pv (optional analytics)

## Quick start

```bash
cp .env.example .env

# 1) Postgres only (~512MB mem_limit)
docker compose up -d db

# 2) Frontend
cd frontend && npm install && npm run build && cd ..

# 3) API (reads DB; seeds once if empty)
cd backend && cargo run
# or from repo root with env from .env
```

Full stack image (optional):

```bash
cd frontend && npm install && npm run build && cd ..
docker compose --profile full up -d --build
```

Without Docker DB: unset `DATABASE_URL` — API still works from `registry.json`.

## Resource budget (GreenCloud SJC later — not deployed from this PR)

| Service | mem_limit | Notes |
|---------|-----------|-------|
| Postgres 16 alpine | **512m** (compose default; raise to 1g via `POSTGRES_MEM_LIMIT`) | shared_buffers=128MB, max_connections=50 |
| Axum API | **256m** | typically 30–80MB RSS + static |
| **Total** | **≲ 768MB–1.25GB** | hard cap stay under 2GB |

Do **not** reuse CloudStudy MySQL for this app unless you create a dedicated small DB `clyune_component` and keep connections tiny — Postgres in Compose is preferred.

## Demo deps

- **Bundled (npm):** `three@0.170` (+ `three/addons` → `examples/jsm`)
- **CDN (runtime, China-friendly fallbacks in `src/lib/load.js`):** gsap, matter-js, echarts, d3, lottie-web; Chart.js via jsDelivr ESM URL

## License

MIT
