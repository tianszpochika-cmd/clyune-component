mod api;
mod db;
mod seed;
mod seo;

use api::{categories, health, one_demo, AppState};
use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde_json::Value;
use std::{net::SocketAddr, path::PathBuf};
use tower::ServiceExt;
use std::sync::Arc;
use tower_http::{compression::CompressionLayer, cors::CorsLayer, services::ServeDir, trace::TraceLayer};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "clyune_component=info,tower_http=info,sqlx=warn".into()),
        )
        .init();

    let registry_path = resolve_registry();
    let raw = std::fs::read_to_string(&registry_path).map_err(|e| {
        anyhow::anyhow!("failed to read registry at {}: {e}", registry_path.display())
    })?;
    let fallback_registry: Value = serde_json::from_str(&raw)?;
    let dist = resolve_dist();
    let index = dist.join("index.html");
    if !index.exists() {
        anyhow::bail!("missing {}", index.display());
    }

    tracing::info!("registry: {}", registry_path.display());
    tracing::info!("static dist: {} (exists={})", dist.display(), dist.exists());

    let pool = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => {
            tracing::info!("DATABASE_URL set — connecting Postgres");
            let pool = db::connect(&url).await?;
            seed::seed_from_registry(&pool, &registry_path).await?;
            Some(pool)
        }
        _ => {
            tracing::warn!("DATABASE_URL unset — API uses embedded registry JSON fallback");
            None
        }
    };

    let seo_registry = fallback_registry.clone();
    let state = AppState {
        pool,
        fallback_registry,
    };

    let api_router = Router::new()
        .route("/health", get(health))
        .route("/categories", get(categories))
        .route("/demos/:category/:slug", get(one_demo))
        .with_state(state);

    // SEO: per-route head tags + crawlable snapshot injected into index.html; robots/sitemap from registry.
    let site_url = std::env::var("SITE_URL").unwrap_or_else(|_| "https://component.clyune.com".into());
    let lastmod = std::fs::metadata(&registry_path)
        .and_then(|m| m.modified())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|_| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let seo = Arc::new(seo::Seo::new(&seo_registry, &site_url, lastmod));
    tracing::info!("seo: {} categories, {} demos, base {}", seo.cats.len(), seo.total, seo.base);

    let txt = |body: String, ct: &'static str| {
        Response::builder()
            .header(header::CONTENT_TYPE, ct)
            .header(header::CACHE_CONTROL, "public, max-age=3600")
            .body(Body::from(body))
            .unwrap()
    };
    let (s1, s2, s3) = (seo.clone(), seo.clone(), seo.clone());

    // Serve built assets; SPA routes get index.html with per-route SEO. Unknown routes → 404 + noindex.
    // Re-read index.html on every request so docker-cp / rsync deploys take effect without restart.
    let dist_for_fallback = dist.clone();
    let index_path = index.clone();

    let app = Router::new()
        .nest("/api", api_router)
        .route("/robots.txt", get(move || { let s = s1.clone(); async move { txt(s.robots.clone(), "text/plain; charset=utf-8") } }))
        .route("/sitemap.xml", get(move || { let s = s2.clone(); async move { txt(s.sitemap.clone(), "application/xml; charset=utf-8") } }))
        .route("/urls.txt", get(move || { let s = s3.clone(); async move { txt(s.url_list(), "text/plain; charset=utf-8") } }))
        .fallback(move |req: Request<Body>| {
            let dist = dist_for_fallback.clone();
            let index_path = index_path.clone();
            let seo = seo.clone();
            async move {
                let path = req.uri().path().to_string();
                let lang = seo::lang_from_query(req.uri().query());
                let html = |status: StatusCode, body: String| {
                    Response::builder()
                        .status(status)
                        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                        .header(header::CACHE_CONTROL, "no-cache")
                        .header(header::CONTENT_LANGUAGE, if lang == seo::Lang::En { "en" } else { "zh-CN" })
                        .body(Body::from(body))
                        .unwrap()
                };
                match seo.resolve(&path) {
                    seo::Resolved::Page(page) => {
                        let tpl = tokio::fs::read_to_string(&index_path).await.unwrap_or_default();
                        return html(StatusCode::OK, seo.render(&tpl, &page, lang));
                    }
                    seo::Resolved::Redirect(to) => {
                        let to = if lang == seo::Lang::En { format!("{to}?lang=en") } else { to };
                        return Response::builder()
                            .status(StatusCode::MOVED_PERMANENTLY)
                            .header(header::LOCATION, to)
                            .body(Body::empty())
                            .unwrap();
                    }
                    seo::Resolved::NotFound => {}
                }
                let immutable = path.starts_with("/assets/");
                let svc = ServeDir::new(dist).append_index_html_on_directories(false);
                match svc.oneshot(req).await {
                    Ok(res) if res.status() == StatusCode::NOT_FOUND => {
                        let last = path.rsplit('/').next().unwrap_or("");
                        if last.contains('.') {
                            return (StatusCode::NOT_FOUND, "not found").into_response();
                        }
                        let tpl = tokio::fs::read_to_string(&index_path).await.unwrap_or_default();
                        html(StatusCode::NOT_FOUND, seo.render_404(&tpl, lang))
                    }
                    Ok(res) => {
                        let mut r = res.map(Body::new);
                        if immutable && r.status().is_success() {
                            r.headers_mut().insert(header::CACHE_CONTROL, header::HeaderValue::from_static("public, max-age=31536000, immutable"));
                        }
                        r
                    }
                    Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "static error").into_response(),
                }
            }
        })
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn resolve_registry() -> PathBuf {
    if let Ok(p) = std::env::var("REGISTRY_PATH") {
        return PathBuf::from(p);
    }
    let candidates = [
        PathBuf::from("data/registry.json"),
        PathBuf::from("backend/data/registry.json"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("data/registry.json"),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("data/registry.json"))
}

fn resolve_dist() -> PathBuf {
    if let Ok(p) = std::env::var("STATIC_DIR") {
        return PathBuf::from(p);
    }
    let candidates = [
        PathBuf::from("frontend/dist"),
        PathBuf::from("../frontend/dist"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../frontend/dist"),
    ];
    candidates
        .into_iter()
        .find(|p| p.join("index.html").exists())
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../frontend/dist"))
}
