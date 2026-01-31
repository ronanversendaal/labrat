//! AI analysis-related Tauri commands
//!
//! This module contains all AI-related IPC commands.

use crate::ai::{
    AIProvider, AddProviderRequest, AnalyzeDiffRequest, AnalyzeDiffResponse, CliAvailableResponse,
    UpdateSuggestionRequest,
};
use crate::TauriResult;

/// List configured AI providers
#[tauri::command]
pub async fn ai_list_providers() -> TauriResult<Vec<AIProvider>> {
    // TODO: Implement provider listing from database
    Ok(vec![])
}

/// Add or update an AI provider configuration
#[tauri::command]
pub async fn ai_add_provider(request: AddProviderRequest) -> TauriResult<AIProvider> {
    // TODO: Implement provider addition
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "ai_add_provider not yet implemented",
    ))
}

/// Remove an AI provider
#[tauri::command]
pub async fn ai_remove_provider(provider_id: String) -> TauriResult<()> {
    // TODO: Implement provider removal
    let _ = provider_id;
    Err(crate::TauriError::new(
        "not_implemented",
        "ai_remove_provider not yet implemented",
    ))
}

/// Set the default AI provider
#[tauri::command]
pub async fn ai_set_default_provider(provider_id: String) -> TauriResult<()> {
    // TODO: Implement setting default provider
    let _ = provider_id;
    Err(crate::TauriError::new(
        "not_implemented",
        "ai_set_default_provider not yet implemented",
    ))
}

/// Analyze a merge request diff with AI
#[tauri::command]
pub async fn ai_analyze_diff(request: AnalyzeDiffRequest) -> TauriResult<AnalyzeDiffResponse> {
    // TODO: Implement AI analysis
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "ai_analyze_diff not yet implemented",
    ))
}

/// Update the status of an AI suggestion
#[tauri::command]
pub async fn ai_update_suggestion_status(request: UpdateSuggestionRequest) -> TauriResult<()> {
    // TODO: Implement suggestion status update
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "ai_update_suggestion_status not yet implemented",
    ))
}

/// Check if Claude CLI is available
#[tauri::command]
pub async fn ai_check_cli_available() -> TauriResult<CliAvailableResponse> {
    // TODO: Implement CLI availability check
    Ok(CliAvailableResponse {
        available: false,
        version: None,
        path: None,
        error: Some("Not yet implemented".to_string()),
    })
}
