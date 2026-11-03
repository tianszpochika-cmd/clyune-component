use serde::Deserialize;
use serde_json::Value;
use sqlx::PgPool;
use std::path::PathBuf;
use tracing::info;

#[derive(Debug, Deserialize)]
struct RegistryFile {
    categories: Vec<RegCategory>,
    #[serde(rename = "totalDemos")]
    #[allow(dead_code)]
    total_demos: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct RegCategory {
    key: String,
    name: String,
    icon: String,
    intro: String,
    #[serde(default)]
    name_en: String,
    #[serde(default)]
    intro_en: String,
    tech: Vec<String>,
    demos: Vec<RegDemo>,
}

#[derive(Debug, Deserialize)]
struct RegDemo {
    slug: String,
    title: String,
    hint: String,
    desc: String,
    #[serde(default)]
    title_en: String,
    #[serde(default)]
    hint_en: String,
    #[serde(default)]
    desc_en: String,
    tag: String,
    #[serde(rename = "mod")]
    mount_mod: String,
    #[serde(rename = "fn")]
    mount_fn: String,
}

/// Upsert categories + demos from registry.json on every boot so new demos appear
/// without wiping stats (demo_stats stay attached via demos.id when slug unchanged).
pub async fn seed_from_registry(pool: &PgPool, path: &PathBuf) -> anyhow::Result<()> {
    let raw = std::fs::read_to_string(path)?;
    let reg: RegistryFile = serde_json::from_str(&raw)?;
    info!(
        "upserting {} categories / ~{} demos from {}",
        reg.categories.len(),
        reg.total_demos.unwrap_or(0),
        path.display()
    );

    let mut demo_total = 0usize;
    for (i, c) in reg.categories.iter().enumerate() {
        let tech = Value::Array(c.tech.iter().cloned().map(Value::String).collect());
        let cat_id: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO categories (key, name, icon, intro, tech, sort_order, name_en, intro_en, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (key) DO UPDATE SET
                name = EXCLUDED.name,
                name_en = EXCLUDED.name_en,
                intro_en = EXCLUDED.intro_en,
                icon = EXCLUDED.icon,
                intro = EXCLUDED.intro,
                tech = EXCLUDED.tech,
                sort_order = EXCLUDED.sort_order,
                updated_at = NOW()
            RETURNING id
            "#,
        )
        .bind(&c.key)
        .bind(&c.name)
        .bind(&c.icon)
        .bind(&c.intro)
        .bind(&tech)
        .bind(i as i32)
        .bind(&c.name_en)
        .bind(&c.intro_en)
        .fetch_one(pool)
        .await?;

        for (j, d) in c.demos.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO demos (
                    category_id, slug, title, hint, description, tag,
                    tech, mount_mod, mount_fn, published, sort_order,
                    title_en, hint_en, description_en, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8,TRUE,$9,$10,$11,$12,NOW())
                ON CONFLICT (category_id, slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    title_en = EXCLUDED.title_en,
                    hint_en = EXCLUDED.hint_en,
                    description_en = EXCLUDED.description_en,
                    hint = EXCLUDED.hint,
                    description = EXCLUDED.description,
                    tag = EXCLUDED.tag,
                    mount_mod = EXCLUDED.mount_mod,
                    mount_fn = EXCLUDED.mount_fn,
                    published = TRUE,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = NOW()
                "#,
            )
            .bind(cat_id.0)
            .bind(&d.slug)
            .bind(&d.title)
            .bind(&d.hint)
            .bind(&d.desc)
            .bind(&d.tag)
            .bind(&d.mount_mod)
            .bind(&d.mount_fn)
            .bind(j as i32)
            .bind(&d.title_en)
            .bind(&d.hint_en)
            .bind(&d.desc_en)
            .execute(pool)
            .await?;
            demo_total += 1;
        }
    }

    // Unpublish demos removed from registry (same category key) so API count matches seed.
    // We only mark unpublished when category still exists and slug not in latest seed set —
    // done per category for safety.
    for c in &reg.categories {
        let slugs: Vec<String> = c.demos.iter().map(|d| d.slug.clone()).collect();
        if slugs.is_empty() {
            continue;
        }
        sqlx::query(
            r#"
            UPDATE demos d
            SET published = FALSE, updated_at = NOW()
            FROM categories c
            WHERE d.category_id = c.id
              AND c.key = $1
              AND NOT (d.slug = ANY($2))
            "#,
        )
        .bind(&c.key)
        .bind(&slugs)
        .execute(pool)
        .await?;
    }

    info!("seed upsert complete: {demo_total} demos");
    Ok(())
}
