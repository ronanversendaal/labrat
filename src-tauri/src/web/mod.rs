//! HTTP web server module for browser/Playwright support
//!
//! Provides an axum-based HTTP server that mirrors Tauri's invoke semantics
//! via a single `POST /api/invoke` endpoint.

pub mod dispatcher;

use crate::SharedAppState;
use axum::{routing::{get, post}, Router};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

/// Build the axum router with shared state
pub fn build_router(state: SharedAppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/invoke", post(dispatcher::handle_invoke))
        .route("/api/health", get(health_check))
        .layer(cors)
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "ok"
}

/// Start the web server on the given port
pub async fn start_server(state: SharedAppState, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let router = build_router(state);
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
    info!("Web server listening on http://127.0.0.1:{}", port);
    axum::serve(listener, router).await?;
    Ok(())
}
