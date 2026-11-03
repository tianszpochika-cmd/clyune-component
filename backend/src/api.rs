use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: Option<PgPool>,
    pub fallback_registry: Value,
}

#[derive(Serialize)]
pub struct Health {
    pub ok: bool,
    pub service: &'static str,
    pub version: &'static str,
    pub db: &'static str,
}

pub async fn health(State(state): State<AppState>) -> Json<Health> {
    let db = if state.pool.is_some() {
        "postgres"
    } else {
        "fallback-json"
    };
    Json(Health {
        ok: true,
        service: "clyune-component",
        version: env!("CARGO_PKG_VERSION"),
        db,
    })
}

pub async fn categories(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    if let Some(pool) = &state.pool {
        match load_categories_from_db(pool).await {
            Ok(v) => return Ok(Json(v)),
            Err(e) => {
                tracing::error!("db categories failed: {e:#}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }
    Ok(Json(state.fallback_registry.clone()))
}

pub async fn one_demo(
    State(state): State<AppState>,
    Path((category, slug)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    if let Some(pool) = &state.pool {
        match load_one_demo(pool, &category, &slug).await {
            Ok(Some(v)) => return Ok(Json(v)),
            Ok(None) => return Err(StatusCode::NOT_FOUND),
            Err(e) => {
                tracing::error!("db one_demo failed: {e:#}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    // JSON fallback
    let cats = state
        .fallback_registry
        .get("categories")
        .and_then(|v| v.as_array())
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    for c in cats {
        if c.get("key").and_then(|v| v.as_str()) != Some(category.as_str()) {
            continue;
        }
        if let Some(demos) = c.get("demos").and_then(|v| v.as_array()) {
            for d in demos {
                if d.get("slug").and_then(|v| v.as_str()) == Some(slug.as_str()) {
                    let mut out = d.clone();
                    if let Some(obj) = out.as_object_mut() {
                        obj.insert("category".into(), Value::String(category.clone()));
                        if let Some(name) = c.get("name") {
                            obj.insert("category_name".into(), name.clone());
                        }
                    }
                    return Ok(Json(out));
                }
            }
        }
    }
    Err(StatusCode::NOT_FOUND)
}

async fn load_categories_from_db(pool: &PgPool) -> anyhow::Result<Value> {
    let cats = sqlx::query_as::<_, (i64, String, String, String, String, Value, i32, String, String)>(
        r#"
        SELECT id, key, name, icon, intro, tech, sort_order, name_en, intro_en
        FROM categories
        ORDER BY sort_order, id
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut out_cats = Vec::new();
    let mut total = 0u64;

    for (id, key, name, icon, intro, tech, _, name_en, intro_en) in cats {
        let demos = sqlx::query_as::<_, (String, String, String, String, String, String, String, Value, String, String, String)>(
            r#"
            SELECT slug, title, hint, description, tag, mount_mod, mount_fn, tech, title_en, hint_en, description_en
            FROM demos
            WHERE category_id = $1 AND published = TRUE
            ORDER BY sort_order, id
            "#,
        )
        .bind(id)
        .fetch_all(pool)
        .await?;

        let demo_vals: Vec<Value> = demos
            .into_iter()
            .map(|(slug, title, hint, desc, tag, mount_mod, mount_fn, dtech, title_en, hint_en, desc_en)| {
                total += 1;
                json!({
                    "slug": slug,
                    "title": title,
                    "hint": hint,
                    "desc": desc,
                    "title_en": title_en,
                    "hint_en": hint_en,
                    "desc_en": desc_en,
                    "tag": tag,
                    "mod": mount_mod,
                    "fn": mount_fn,
                    "tech": dtech,
                    "path": format!("/{key}/{slug}"),
                })
            })
            .collect();

        out_cats.push(json!({
            "key": key,
            "name": name,
            "name_en": name_en,
            "icon": icon,
            "intro": intro,
            "intro_en": intro_en,
            "tech": tech,
            "demos": demo_vals,
        }));
    }

    Ok(json!({
        "categories": out_cats,
        "totalDemos": total,
    }))
}

async fn load_one_demo(pool: &PgPool, category: &str, slug: &str) -> anyhow::Result<Option<Value>> {
    let row = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            Value,
            String,
            String,
            String,
            String,
            String,
        ),
    >(
        r#"
        SELECT d.slug, d.title, d.hint, d.description, d.tag,
               d.mount_mod, d.mount_fn, c.key, d.tech, c.name,
               d.title_en, d.hint_en, d.description_en, c.name_en
        FROM demos d
        JOIN categories c ON c.id = d.category_id
        WHERE c.key = $1 AND d.slug = $2 AND d.published = TRUE
        "#,
    )
    .bind(category)
    .bind(slug)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(
        |(slug, title, hint, desc, tag, mount_mod, mount_fn, cat_key, tech, cat_name, title_en, hint_en, desc_en, cat_name_en)| {
            json!({
                "slug": slug,
                "title": title,
                "hint": hint,
                "desc": desc,
                "title_en": title_en,
                "hint_en": hint_en,
                "desc_en": desc_en,
                "category_name_en": cat_name_en,
                "tag": tag,
                "mod": mount_mod,
                "fn": mount_fn,
                "tech": tech,
                "path": format!("/{cat_key}/{slug}"),
                "category": cat_key,
                "category_name": cat_name,
            })
        },
    ))
}
