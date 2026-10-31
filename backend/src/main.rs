mod api;
mod db;
mod seed;

use api::{categories, health, one_demo, AppState};
use axum::{routing::get, Router};
use serde_json::Value;
use std::{net::SocketAddr, path::PathBuf};
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

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

    let state = AppState {
        pool,
        fallback_registry,
    };

    let api_router = Router::new()
        .route("/health", get(health))
        .route("/categories", get(categories))
        .route("/demos/:category/:slug", get(one_demo))
        .with_state(state);

    let static_files = ServeDir::new(&dist).not_found_service(ServeFile::new(&index));

    let app = Router::new()
        .nest("/api", api_router)
        .fallback_service(static_files)
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
