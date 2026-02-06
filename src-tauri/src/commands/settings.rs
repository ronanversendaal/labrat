//! Settings-related Tauri commands
//!
//! This module contains all settings-related IPC commands.

use crate::settings::config::{DiffViewMode, Settings, Theme, UpdateSettingsRequest};
use crate::settings::credentials::CredentialManager;
use crate::{SharedAppState, TauriError, TauriResult};
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

/// Response from secure storage availability check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecureStorageStatus {
    pub available: bool,
    pub warning: Option<String>,
}

/// Helper to save settings to database
async fn save_settings(pool: &sqlx::SqlitePool, settings: &Settings) -> TauriResult<()> {
    sqlx::query(
        "INSERT OR REPLACE INTO settings (id, theme, mr_refresh_interval_seconds, cache_size_mb, ai_auto_analyze,
         default_ai_provider_id, sidebar_collapsed, diff_view_mode, show_whitespace, font_size, keyboard_shortcuts_enabled)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(settings.theme.to_string())
    .bind(settings.mr_refresh_interval_seconds)
    .bind(settings.cache_size_mb)
    .bind(if settings.ai_auto_analyze { 1 } else { 0 })
    .bind(&settings.default_ai_provider_id)
    .bind(if settings.sidebar_collapsed { 1 } else { 0 })
    .bind(settings.diff_view_mode.to_string())
    .bind(if settings.show_whitespace { 1 } else { 0 })
    .bind(settings.font_size)
    .bind(if settings.keyboard_shortcuts_enabled { 1 } else { 0 })
    .execute(pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    Ok(())
}

/// Parse a settings row into a Settings struct
fn parse_settings_row(
    (theme, refresh_interval, cache_size, ai_auto, ai_provider_id, sidebar, diff_mode, whitespace, font_size, shortcuts): (String, i32, i32, i64, Option<String>, i64, String, i64, i32, i64),
) -> Settings {
    Settings {
        theme: match theme.as_str() {
            "light" => Theme::Light,
            "dark" => Theme::Dark,
            _ => Theme::System,
        },
        mr_refresh_interval_seconds: refresh_interval,
        cache_size_mb: cache_size,
        ai_auto_analyze: ai_auto != 0,
        default_ai_provider_id: ai_provider_id,
        sidebar_collapsed: sidebar != 0,
        diff_view_mode: match diff_mode.as_str() {
            "split" => DiffViewMode::Split,
            _ => DiffViewMode::Unified,
        },
        show_whitespace: whitespace != 0,
        font_size,
        keyboard_shortcuts_enabled: shortcuts != 0,
    }
}

// ============================================================================
// Inner functions — shared by Tauri + HTTP
// ============================================================================

/// Get all settings (inner)
pub async fn get_inner(state: &SharedAppState) -> TauriResult<Settings> {
    let state = state.read().await;

    let row = sqlx::query_as::<_, (String, i32, i32, i64, Option<String>, i64, String, i64, i32, i64)>(
        "SELECT theme, mr_refresh_interval_seconds, cache_size_mb, ai_auto_analyze, default_ai_provider_id,
                sidebar_collapsed, diff_view_mode, show_whitespace, font_size, keyboard_shortcuts_enabled
         FROM settings WHERE id = 1"
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    match row {
        Some(r) => Ok(parse_settings_row(r)),
        None => {
            // Initialize default settings in database
            let settings = Settings::default();
            save_settings(&state.db_pool, &settings).await?;
            Ok(settings)
        }
    }
}

/// Update settings (inner)
pub async fn update_inner(
    state: &SharedAppState,
    request: UpdateSettingsRequest,
) -> TauriResult<Settings> {
    let state = state.read().await;

    // Get current settings
    let mut settings = {
        let row = sqlx::query_as::<_, (String, i32, i32, i64, Option<String>, i64, String, i64, i32, i64)>(
            "SELECT theme, mr_refresh_interval_seconds, cache_size_mb, ai_auto_analyze, default_ai_provider_id,
                    sidebar_collapsed, diff_view_mode, show_whitespace, font_size, keyboard_shortcuts_enabled
             FROM settings WHERE id = 1"
        )
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

        match row {
            Some(r) => parse_settings_row(r),
            None => Settings::default(),
        }
    };

    // Apply updates
    settings.apply_update(request);

    // Save updated settings
    save_settings(&state.db_pool, &settings).await?;

    info!("Settings updated");
    Ok(settings)
}

/// Reset settings to defaults (inner)
pub async fn reset_inner(state: &SharedAppState) -> TauriResult<Settings> {
    let state = state.read().await;
    let settings = Settings::default();
    save_settings(&state.db_pool, &settings).await?;
    info!("Settings reset to defaults");
    Ok(settings)
}

/// Check if secure storage (keychain/keyring) is available (inner)
pub fn check_secure_storage_inner() -> TauriResult<SecureStorageStatus> {
    match CredentialManager::is_secure_storage_available() {
        Ok(true) => Ok(SecureStorageStatus {
            available: true,
            warning: None,
        }),
        Ok(false) => Ok(SecureStorageStatus {
            available: false,
            warning: Some(
                "Secure storage is not available on this system. Credentials will be stored less securely. \
                 Consider installing a keyring daemon (e.g., GNOME Keyring, KWallet) for better security."
                    .to_string(),
            ),
        }),
        Err(e) => Ok(SecureStorageStatus {
            available: false,
            warning: Some(format!("Failed to check secure storage: {}", e)),
        }),
    }
}

// ============================================================================
// Tauri command wrappers
// ============================================================================

/// Get all settings
#[tauri::command]
pub async fn settings_get(state: State<'_, SharedAppState>) -> TauriResult<Settings> {
    get_inner(&state).await
}

/// Update settings
#[tauri::command]
pub async fn settings_update(
    state: State<'_, SharedAppState>,
    request: UpdateSettingsRequest,
) -> TauriResult<Settings> {
    update_inner(&state, request).await
}

/// Reset settings to defaults
#[tauri::command]
pub async fn settings_reset(state: State<'_, SharedAppState>) -> TauriResult<Settings> {
    reset_inner(&state).await
}

/// Check if secure storage (keychain/keyring) is available
#[tauri::command]
pub async fn settings_check_secure_storage() -> TauriResult<SecureStorageStatus> {
    check_secure_storage_inner()
}
