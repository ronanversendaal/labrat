//! Settings-related Tauri commands
//!
//! This module contains all settings-related IPC commands.

use crate::settings::config::{Settings, UpdateSettingsRequest};
use crate::TauriResult;

/// Get all settings
#[tauri::command]
pub async fn settings_get() -> TauriResult<Settings> {
    // TODO: Implement settings retrieval from database
    Ok(Settings::default())
}

/// Update settings
#[tauri::command]
pub async fn settings_update(request: UpdateSettingsRequest) -> TauriResult<Settings> {
    // TODO: Implement settings update
    let mut settings = Settings::default();
    settings.apply_update(request);
    Ok(settings)
}

/// Reset settings to defaults
#[tauri::command]
pub async fn settings_reset() -> TauriResult<Settings> {
    // TODO: Implement settings reset in database
    Ok(Settings::default())
}
