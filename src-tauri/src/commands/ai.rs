//! AI analysis-related Tauri commands
//!
//! This module contains all AI-related IPC commands.

use crate::ai::{
    AIProvider, AIProviderType, AISuggestion, AddProviderRequest, AnalysisContext,
    AnalyzeDiffRequest, AnalyzeDiffResponse, ClaudeCliProvider, CliAvailableResponse,
    FileContext, SuggestionStatus, UpdateSuggestionRequest,
};
use crate::ai::types::AIProvider as AIProviderConfig;
use crate::settings::credentials::CredentialManager;
use crate::{SharedAppState, TauriError, TauriResult};
use chrono::Utc;
use std::time::Instant;
use tauri::State;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// List configured AI providers
#[tauri::command]
pub async fn ai_list_providers(state: State<'_, SharedAppState>) -> TauriResult<Vec<AIProviderConfig>> {
    let state = state.read().await;

    let rows = sqlx::query_as::<_, (String, Option<String>, String, String, Option<String>, i64, i64, String)>(
        "SELECT id, account_id, provider_type, name, model, is_default, enabled, created_at
         FROM ai_providers ORDER BY name"
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let mut providers = Vec::new();
    for (id, account_id, provider_type, name, model, is_default, enabled, created_at) in rows {
        let provider_type = match provider_type.as_str() {
            "claude_cli" => AIProviderType::ClaudeCli,
            "anthropic_api" => AIProviderType::AnthropicApi,
            "openai_api" => AIProviderType::OpenaiApi,
            _ => continue,
        };

        // Check if provider is available
        let is_available = match provider_type {
            AIProviderType::ClaudeCli => {
                ClaudeCliProvider::check_cli().await
                    .map(|(available, _, _)| available)
                    .unwrap_or(false)
            }
            AIProviderType::AnthropicApi | AIProviderType::OpenaiApi => {
                // Check if we have an API key
                CredentialManager::get_ai_key(&id)
                    .map(|opt| opt.is_some())
                    .unwrap_or(false)
            }
        };

        providers.push(AIProviderConfig {
            id,
            account_id,
            provider_type,
            name,
            model,
            is_default: is_default != 0,
            enabled: enabled != 0,
            is_available,
            created_at: created_at.parse().unwrap_or_default(),
        });
    }

    Ok(providers)
}

/// Add or update an AI provider configuration
#[tauri::command]
pub async fn ai_add_provider(
    state: State<'_, SharedAppState>,
    request: AddProviderRequest,
) -> TauriResult<AIProviderConfig> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let now_str = now.to_rfc3339();

    // Store API key if provided
    if let Some(api_key) = &request.api_key {
        CredentialManager::store_ai_key(&id, api_key)
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
    }

    let state = state.read().await;

    // Check if this is the first provider - if so, make it default
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ai_providers")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let is_default = count.0 == 0;

    sqlx::query(
        "INSERT INTO ai_providers (id, account_id, provider_type, name, model, is_default, enabled, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, 1, ?)"
    )
    .bind(&id)
    .bind(request.provider_type.to_string())
    .bind(&request.name)
    .bind(&request.model)
    .bind(if is_default { 1 } else { 0 })
    .bind(&now_str)
    .execute(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Added AI provider: {} ({})", request.name, request.provider_type);

    Ok(AIProviderConfig {
        id,
        account_id: None,
        provider_type: request.provider_type,
        name: request.name,
        model: request.model,
        is_default,
        enabled: true,
        is_available: true, // Will be checked on next list
        created_at: now,
    })
}

/// Remove an AI provider
#[tauri::command]
pub async fn ai_remove_provider(
    state: State<'_, SharedAppState>,
    provider_id: String,
) -> TauriResult<()> {
    // Remove API key from keyring
    let _ = CredentialManager::delete_ai_key(&provider_id);

    let state = state.read().await;
    sqlx::query("DELETE FROM ai_providers WHERE id = ?")
        .bind(&provider_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Removed AI provider: {}", provider_id);
    Ok(())
}

/// Set the default AI provider
#[tauri::command]
pub async fn ai_set_default_provider(
    state: State<'_, SharedAppState>,
    provider_id: String,
) -> TauriResult<()> {
    let state = state.read().await;

    // Clear default flag on all providers
    sqlx::query("UPDATE ai_providers SET is_default = 0")
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Set the new default
    sqlx::query("UPDATE ai_providers SET is_default = 1 WHERE id = ?")
        .bind(&provider_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Set default AI provider: {}", provider_id);
    Ok(())
}

/// Analyze a merge request diff with AI
#[tauri::command]
pub async fn ai_analyze_diff(
    state: State<'_, SharedAppState>,
    request: AnalyzeDiffRequest,
) -> TauriResult<AnalyzeDiffResponse> {
    let start_time = Instant::now();

    // Get the provider to use
    let (provider_id, provider_type, model) = {
        let state = state.read().await;

        let query = if let Some(id) = &request.provider_id {
            sqlx::query_as::<_, (String, String, Option<String>)>(
                "SELECT id, provider_type, model FROM ai_providers WHERE id = ? AND enabled = 1"
            )
            .bind(id)
        } else {
            sqlx::query_as::<_, (String, String, Option<String>)>(
                "SELECT id, provider_type, model FROM ai_providers WHERE is_default = 1 AND enabled = 1"
            )
        };

        query.fetch_optional(&state.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?
            .ok_or_else(|| TauriError::ai_error("No AI provider configured"))?
    };

    // Get the diff for this MR
    let diff = {
        let state = state.read().await;
        let cache = crate::cache::diff_cache::DiffCache::new(state.db_pool.clone());
        cache.get(request.mr_iid).await
            .map_err(|e| TauriError::cache_error(e.to_string()))?
            .ok_or_else(|| TauriError::not_found("Diff not cached"))?
    };

    // Build analysis context
    let context = AnalysisContext {
        mr_id: request.mr_iid,
        mr_title: format!("MR #{}", request.mr_iid), // TODO: Get actual title
        mr_description: None,
        files: diff.files.iter().map(|f| FileContext {
            path: f.new_path.clone(),
            old_path: if f.renamed_file { Some(f.old_path.clone()) } else { None },
            diff: f.diff.clone(),
            is_new: f.new_file,
            is_deleted: f.deleted_file,
            is_renamed: f.renamed_file,
        }).collect(),
    };

    // Create provider instance and analyze
    let provider_type_enum = match provider_type.as_str() {
        "claude_cli" => AIProviderType::ClaudeCli,
        "anthropic_api" => AIProviderType::AnthropicApi,
        "openai_api" => AIProviderType::OpenaiApi,
        _ => return Err(TauriError::ai_error("Unknown provider type")),
    };

    let raw_suggestions = match provider_type_enum {
        AIProviderType::ClaudeCli => {
            let provider = ClaudeCliProvider::new(provider_id.clone(), "Claude CLI".to_string(), None);
            provider.analyze(&context).await
                .map_err(|e| TauriError::ai_error(e.to_string()))?
        }
        AIProviderType::AnthropicApi => {
            let api_key = CredentialManager::get_ai_key(&provider_id)
                .map_err(|e| TauriError::cache_error(e.to_string()))?
                .ok_or_else(|| TauriError::ai_error("Anthropic API key not found"))?;
            let provider = crate::ai::AnthropicProvider::new(provider_id.clone(), "Anthropic".to_string(), api_key, model);
            provider.analyze(&context).await
                .map_err(|e| TauriError::ai_error(e.to_string()))?
        }
        AIProviderType::OpenaiApi => {
            let api_key = CredentialManager::get_ai_key(&provider_id)
                .map_err(|e| TauriError::cache_error(e.to_string()))?
                .ok_or_else(|| TauriError::ai_error("OpenAI API key not found"))?;
            let provider = crate::ai::OpenAIProvider::new(provider_id.clone(), "OpenAI".to_string(), api_key, model);
            provider.analyze(&context).await
                .map_err(|e| TauriError::ai_error(e.to_string()))?
        }
    };

    // Convert raw suggestions to AISuggestion and store
    let mut suggestions = Vec::new();
    let state = state.read().await;

    for raw in raw_suggestions {
        let suggestion_id = Uuid::new_v4().to_string();
        let suggestion = raw.to_suggestion(suggestion_id.clone(), request.mr_iid, provider_id.clone());

        // Store in database
        let now = Utc::now().to_rfc3339();
        if let Err(e) = sqlx::query(
            "INSERT INTO ai_suggestions (id, mr_id, provider_id, file_path, start_line, end_line, category, severity, title, description, suggested_code, original_code, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)"
        )
        .bind(&suggestion.id)
        .bind(suggestion.mr_id)
        .bind(&suggestion.provider_id)
        .bind(&suggestion.file_path)
        .bind(suggestion.start_line)
        .bind(suggestion.end_line)
        .bind(suggestion.category.to_string())
        .bind(suggestion.severity.to_string())
        .bind(&suggestion.title)
        .bind(&suggestion.description)
        .bind(&suggestion.suggested_code)
        .bind(&suggestion.original_code)
        .bind(&now)
        .execute(&state.db_pool)
        .await {
            warn!("Failed to store suggestion: {}", e);
        }

        suggestions.push(suggestion);
    }

    let analysis_time = start_time.elapsed().as_millis() as u64;
    info!("AI analysis complete: {} suggestions in {}ms", suggestions.len(), analysis_time);

    Ok(AnalyzeDiffResponse {
        suggestions,
        provider_used: provider_id,
        analysis_time_ms: analysis_time,
    })
}

/// Update the status of an AI suggestion
#[tauri::command]
pub async fn ai_update_suggestion_status(
    state: State<'_, SharedAppState>,
    request: UpdateSuggestionRequest,
) -> TauriResult<()> {
    let state = state.read().await;

    let status_str = match request.status {
        SuggestionStatus::Pending => "pending",
        SuggestionStatus::Accepted => "accepted",
        SuggestionStatus::Dismissed => "dismissed",
        SuggestionStatus::Posted => "posted",
    };

    sqlx::query("UPDATE ai_suggestions SET status = ? WHERE id = ?")
        .bind(status_str)
        .bind(&request.suggestion_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    debug!("Updated suggestion {} status to {}", request.suggestion_id, status_str);
    Ok(())
}

/// Check if Claude CLI is available
#[tauri::command]
pub async fn ai_check_cli_available() -> TauriResult<CliAvailableResponse> {
    let (available, version, path) = ClaudeCliProvider::check_cli().await
        .map_err(|e| TauriError::ai_error(e.to_string()))?;

    Ok(CliAvailableResponse {
        available,
        version,
        path,
        error: if available { None } else { Some("Claude CLI not found".to_string()) },
    })
}

/// Get suggestions for a specific MR
#[tauri::command]
pub async fn ai_get_suggestions(
    state: State<'_, SharedAppState>,
    mr_id: i64,
) -> TauriResult<Vec<AISuggestion>> {
    let state = state.read().await;

    let rows = sqlx::query_as::<_, (String, i64, String, String, i32, i32, String, String, String, String, Option<String>, String, String, String)>(
        "SELECT id, mr_id, provider_id, file_path, start_line, end_line, category, severity, title, description, suggested_code, original_code, status, created_at
         FROM ai_suggestions WHERE mr_id = ? ORDER BY file_path, start_line"
    )
    .bind(mr_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let suggestions = rows.into_iter().map(|(id, mr_id, provider_id, file_path, start_line, end_line, category, severity, title, description, suggested_code, original_code, status, created_at)| {
        use crate::ai::{SuggestionCategory, SuggestionSeverity, SuggestionStatus};

        AISuggestion {
            id,
            mr_id,
            provider_id,
            file_path,
            start_line,
            end_line,
            category: match category.as_str() {
                "code_quality" => SuggestionCategory::CodeQuality,
                "potential_bug" => SuggestionCategory::PotentialBug,
                "performance" => SuggestionCategory::Performance,
                "security" => SuggestionCategory::Security,
                "best_practice" => SuggestionCategory::BestPractice,
                "readability" => SuggestionCategory::Readability,
                "documentation" => SuggestionCategory::Documentation,
                _ => SuggestionCategory::CodeQuality,
            },
            severity: match severity.as_str() {
                "error" => SuggestionSeverity::Error,
                "warning" => SuggestionSeverity::Warning,
                _ => SuggestionSeverity::Info,
            },
            title,
            description,
            suggested_code,
            original_code,
            status: match status.as_str() {
                "accepted" => SuggestionStatus::Accepted,
                "dismissed" => SuggestionStatus::Dismissed,
                "posted" => SuggestionStatus::Posted,
                _ => SuggestionStatus::Pending,
            },
            created_at: created_at.parse().unwrap_or_default(),
        }
    }).collect();

    Ok(suggestions)
}
