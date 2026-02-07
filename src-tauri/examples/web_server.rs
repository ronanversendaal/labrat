//! Standalone web server binary for browser/Playwright support
//!
//! Run with: `cargo run --bin labrat-web --features web-server`
//!
//! This starts the axum HTTP server on port 3001 (or LABRAT_PORT env var)
//! without requiring the Tauri runtime, enabling browser-based access
//! to the same backend functionality.

use labrat_lib::{AppState, SharedAppState};
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tracing::info!("Starting LabRat web server...");

    // Initialize app state (same as Tauri setup)
    let app_state = AppState::new().await?;
    let shared_state: SharedAppState = Arc::new(RwLock::new(app_state));

    tracing::info!("App state initialized successfully");

    // Get port from env or default to 3001
    let port: u16 = std::env::var("LABRAT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    // Start the web server
    labrat_lib::web::start_server(shared_state, port).await?;

    Ok(())
}
