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
    tech: Vec<String>,
    demos: Vec<RegDemo>,
}

#[derive(Debug, Deserialize)]
struct RegDemo {
    slug: String,
    title: String,
    hint: String,
    desc: String,
    tag: String,
    #[serde(rename = "mod")]
    mount_mod: String,
    #[serde(rename = "fn")]
    mount_fn: String,
}

pub async fn seed_from_registry(pool: &PgPool, path: &PathBuf) -> anyhow::Result<()> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
        .fetch_one(pool)
        .await?;
    if count.0 > 0 {
        info!("categories already present ({}); skip seed", count.0);
        return Ok(());
    }

    let raw = std::fs::read_to_string(path)?;
    let reg: RegistryFile = serde_json::from_str(&raw)?;
    info!("seeding {} categories from {}", reg.categories.len(), path.display());

    for (i, c) in reg.categories.iter().enumerate() {
        let tech = Value::Array(c.tech.iter().cloned().map(Value::String).collect());
        let cat_id: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO categories (key, name, icon, intro, tech, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#,
        )
        .bind(&c.key)
        .bind(&c.name)
        .bind(&c.icon)
        .bind(&c.intro)
        .bind(&tech)
        .bind(i as i32)
        .fetch_one(pool)
        .await?;

        for (j, d) in c.demos.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO demos (
                    category_id, slug, title, hint, description, tag,
                    tech, mount_mod, mount_fn, published, sort_order
                ) VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8,TRUE,$9)
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
            .execute(pool)
            .await?;
        }
    }
    info!("seed complete");
    Ok(())
}
