-- Lightweight schema for Clyune Component Gallery (Postgres)
-- Designed for tens of demos, not thousands of resources.

CREATE TABLE IF NOT EXISTS categories (
    id              BIGSERIAL PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    icon            TEXT NOT NULL DEFAULT '',
    intro           TEXT NOT NULL DEFAULT '',
    tech            JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demos (
    id              BIGSERIAL PRIMARY KEY,
    category_id     BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,
    title           TEXT NOT NULL,
    hint            TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    tag             TEXT NOT NULL DEFAULT '',
    tech            JSONB NOT NULL DEFAULT '[]'::jsonb,
    mount_mod       TEXT NOT NULL,
    mount_fn        TEXT NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_demos_category ON demos(category_id);
CREATE INDEX IF NOT EXISTS idx_demos_published ON demos(published);

CREATE TABLE IF NOT EXISTS demo_stats (
    id              BIGSERIAL PRIMARY KEY,
    demo_id         BIGINT NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
    day             DATE NOT NULL,
    pv              BIGINT NOT NULL DEFAULT 0,
    UNIQUE (demo_id, day)
);

CREATE INDEX IF NOT EXISTS idx_demo_stats_day ON demo_stats(day);
