//! LabRat App Backend
//!
//! This is the Rust backend for the LabRat application,
//! providing API clients, caching, and AI integration.

pub mod ai;
pub mod cache;
pub mod commands;
pub mod gitlab;
pub mod settings;
pub mod utils;
#[cfg(feature = "web-server")]
pub mod web;

use cache::db::Database;
use gitlab::pipeline_poller::PipelinePoller;
use serde::{Deserialize, Serialize};
use settings::credentials::CredentialCache;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

/// Application state shared across all commands
pub struct AppState {
    /// Database connection pool
    pub db_pool: SqlitePool,
    /// In-memory credential cache to avoid repeated OS keychain prompts
    pub credential_cache: CredentialCache,
    /// Pipeline polling engine
    pub pipeline_poller: PipelinePoller,
}

impl AppState {
    /// Create a new app state with initialized database
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = Database::default_path();
        let db = Database::new(db_path).await?;

        Ok(Self {
            db_pool: db.pool().clone(),
            credential_cache: CredentialCache::new(),
            pipeline_poller: PipelinePoller::new(),
        })
    }
}

/// Thread-safe wrapper for app state
pub type SharedAppState = Arc<RwLock<AppState>>;

/// Error type for Tauri IPC commands
///
/// All errors returned from Tauri commands should use this type
/// for consistent error handling on the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TauriError {
    /// Machine-readable error code
    pub code: String,
    /// Human-readable error message
    pub message: String,
    /// Additional context (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl TauriError {
    /// Create a new error
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    /// Create a new error with details
    pub fn with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: serde_json::Value,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: Some(details),
        }
    }

    /// No active GitLab account
    pub fn not_authenticated() -> Self {
        Self::new("not_authenticated", "No active GitLab account configured")
    }

    /// Network error reaching GitLab
    pub fn network_error(message: impl Into<String>) -> Self {
        Self::new("network_error", message)
    }

    /// GitLab API returned an error
    pub fn api_error(message: impl Into<String>) -> Self {
        Self::new("api_error", message)
    }

    /// Hit GitLab rate limit
    pub fn rate_limited(retry_after: Option<u64>) -> Self {
        let mut error = Self::new("rate_limited", "GitLab API rate limit exceeded");
        if let Some(seconds) = retry_after {
            error.details = Some(serde_json::json!({ "retry_after_seconds": seconds }));
        }
        error
    }

    /// Invalid request parameters
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new("invalid_input", message)
    }

    /// Resource not found
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::new("not_found", format!("{} not found", resource.into()))
    }

    /// Insufficient permissions
    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::new("permission_denied", message)
    }

    /// AI analysis failed
    pub fn ai_error(message: impl Into<String>) -> Self {
        Self::new("ai_error", message)
    }

    /// Cache operation failed
    pub fn cache_error(message: impl Into<String>) -> Self {
        Self::new("cache_error", message)
    }

    /// Invalid token
    pub fn invalid_token(message: impl Into<String>) -> Self {
        Self::new("invalid_token", message)
    }

    /// Invalid URL
    pub fn invalid_url(message: impl Into<String>) -> Self {
        Self::new("invalid_url", message)
    }

    /// Duplicate name
    pub fn duplicate_name(name: impl Into<String>) -> Self {
        Self::new(
            "duplicate_name",
            format!("Name '{}' already exists", name.into()),
        )
    }
}

impl std::fmt::Display for TauriError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for TauriError {}

/// Result type for Tauri commands
pub type TauriResult<T> = Result<T, TauriError>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Position window: full height, aligned to the right of the screen
            if let Some(window) = app.get_webview_window("main") {
                if let Some(monitor) = window.current_monitor().ok().flatten() {
                    let screen_size = monitor.size();
                    let screen_pos = monitor.position();
                    let scale = monitor.scale_factor();

                    let screen_w = screen_size.width as f64 / scale;
                    let screen_h = screen_size.height as f64 / scale;

                    let win_width = 1200.0_f64.min(screen_w);
                    let x = screen_pos.x as f64 / scale + (screen_w - win_width);

                    let _ = window.set_size(tauri::LogicalSize::new(win_width, screen_h));
                    let _ = window.set_position(tauri::LogicalPosition::new(x, 0.0));
                }

                // Set initial NSWindow background color (default-dark canvas: #111827)
                // This prevents white flash and makes the overlay titlebar match the theme.
                #[cfg(target_os = "macos")]
                {
                    use objc2_app_kit::{NSColor, NSWindow};

                    if let Ok(ns_win_ptr) = window.ns_window() {
                        let ns_win = unsafe { &*(ns_win_ptr as *const NSWindow) };
                        let color = NSColor::colorWithRed_green_blue_alpha(
                            17.0 / 255.0, // #11
                            24.0 / 255.0, // #18
                            39.0 / 255.0, // #27
                            1.0,
                        );
                        ns_win.setBackgroundColor(Some(&color));
                    }
                }
            }

            // Initialize app state asynchronously
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match AppState::new().await {
                    Ok(state) => {
                        handle.manage(Arc::new(RwLock::new(state)));
                        tracing::info!("App state initialized successfully");
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialize app state: {}", e);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // GitLab commands
            commands::gitlab::gitlab_list_accounts,
            commands::gitlab::gitlab_add_account,
            commands::gitlab::gitlab_remove_account,
            commands::gitlab::gitlab_set_active_account,
            commands::gitlab::gitlab_validate_token,
            commands::gitlab::gitlab_list_merge_requests,
            commands::gitlab::gitlab_get_merge_request,
            commands::gitlab::gitlab_get_diff,
            commands::gitlab::gitlab_get_file_content,
            commands::gitlab::gitlab_get_discussions,
            commands::gitlab::gitlab_post_comment,
            commands::gitlab::gitlab_refresh,
            commands::gitlab::gitlab_check_connection,
            commands::gitlab::gitlab_get_approval_state,
            commands::gitlab::gitlab_approve_mr,
            commands::gitlab::gitlab_unapprove_mr,
            commands::gitlab::gitlab_fetch_avatar,
            commands::gitlab::gitlab_reply_to_discussion,
            commands::gitlab::gitlab_resolve_discussion,
            commands::gitlab::gitlab_apply_suggestion,
            commands::gitlab::gitlab_merge_mr,
            commands::gitlab::gitlab_rebase_mr,
            // Pipeline commands
            commands::pipeline::gitlab_search_projects,
            commands::pipeline::gitlab_list_pipelines,
            commands::pipeline::gitlab_get_pipeline_detail,
            commands::pipeline::gitlab_get_pipeline_stages,
            commands::pipeline::gitlab_get_job_log,
            commands::pipeline::gitlab_get_test_report,
            commands::pipeline::gitlab_retry_pipeline,
            commands::pipeline::gitlab_cancel_pipeline,
            commands::pipeline::gitlab_retry_job,
            commands::pipeline::gitlab_cancel_job,
            commands::pipeline::gitlab_download_artifacts,
            commands::pipeline::gitlab_pin_project,
            commands::pipeline::gitlab_unpin_project,
            commands::pipeline::gitlab_get_pinned_projects,
            commands::pipeline::gitlab_start_pipeline_polling,
            commands::pipeline::gitlab_stop_pipeline_polling,
            commands::pipeline::gitlab_start_job_log_streaming,
            commands::pipeline::gitlab_stop_job_log_streaming,
            // AI commands
            commands::ai::ai_list_providers,
            commands::ai::ai_add_provider,
            commands::ai::ai_remove_provider,
            commands::ai::ai_set_default_provider,
            commands::ai::ai_analyze_diff,
            commands::ai::ai_update_suggestion_status,
            commands::ai::ai_check_cli_available,
            commands::ai::ai_get_suggestions,
            commands::ai::ai_check_cli_binary,
            commands::ai::ai_list_models,
            commands::ai::ai_validate_cli_path,
            // Settings commands
            commands::settings::settings_get,
            commands::settings::settings_update,
            commands::settings::settings_reset,
            commands::settings::settings_check_secure_storage,
            // Cache commands
            commands::cache::cache_get_stats,
            commands::cache::cache_clear,
            commands::cache::cache_evict_old,
            // Window commands
            commands::window::set_window_bg_color,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
