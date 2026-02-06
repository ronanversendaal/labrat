//! AI analysis-related Tauri commands
//!
//! This module contains all AI-related IPC commands.

use crate::ai::{
    AIProvider, AIProviderType, AISuggestion, AddProviderRequest, AnalysisContext,
    AnalyzeDiffRequest, AnalyzeDiffResponse, ClaudeCliProvider, CliAvailableResponse,
    FileContext, SuggestionStatus, UpdateSuggestionRequest, AnalysisProgressEvent, AnalysisStatus,
};
use crate::ai::types::AIProvider as AIProviderConfig;
use crate::{SharedAppState, TauriError, TauriResult};
use chrono::Utc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Helper function to emit analysis progress events (only when AppHandle is available)
fn emit_progress(app: Option<&AppHandle>, mr_id: i64, status: AnalysisStatus, progress: u8, message: &str) {
    if let Some(app) = app {
        let event = AnalysisProgressEvent {
            mr_id,
            status,
            progress,
            message: message.to_string(),
        };
        if let Err(e) = app.emit("ai:analysis_progress", &event) {
            warn!("Failed to emit analysis progress event: {}", e);
        }
    }
}

// ============================================================================
// Inner functions — shared by Tauri + HTTP
// ============================================================================

/// Auto-register Claude CLI provider if the binary is detected and no claude_cli provider exists.
/// Returns the (id, provider_type, model) tuple if a new provider was registered.
async fn auto_register_cli_provider(state: &SharedAppState) -> TauriResult<Option<(String, String, Option<String>)>> {
    let state_read = state.read().await;

    let has_cli_provider: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM ai_providers WHERE provider_type = 'claude_cli'"
    )
    .fetch_one(&state_read.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    if has_cli_provider.0 != 0 {
        return Ok(None);
    }

    let (available, version, _path) = ClaudeCliProvider::check_cli().await
        .unwrap_or((false, None, None));

    if !available {
        return Ok(None);
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let name = format!("Claude CLI{}", version.as_deref().map(|v| format!(" ({})", v)).unwrap_or_default());

    // Set as default if no other providers exist
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ai_providers")
        .fetch_one(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;
    let is_default = count.0 == 0;

    sqlx::query(
        "INSERT OR IGNORE INTO ai_providers (id, account_id, provider_type, name, model, is_default, enabled, created_at)
         VALUES (?, NULL, 'claude_cli', ?, NULL, ?, 1, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(if is_default { 1 } else { 0 })
    .bind(&now)
    .execute(&state_read.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Auto-registered Claude CLI provider: {}", name);

    Ok(Some((id, "claude_cli".to_string(), None)))
}

/// List configured AI providers (inner)
pub async fn list_providers_inner(state: &SharedAppState) -> TauriResult<Vec<AIProviderConfig>> {
    // Auto-register Claude CLI provider if binary is detected and no claude_cli provider exists
    auto_register_cli_provider(state).await?;

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

        let is_available = match provider_type {
            AIProviderType::ClaudeCli => {
                ClaudeCliProvider::check_cli().await
                    .map(|(available, _, _)| available)
                    .unwrap_or(false)
            }
            AIProviderType::AnthropicApi | AIProviderType::OpenaiApi => {
                state.credential_cache.get_ai_key(&id)
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

/// Add or update an AI provider configuration (inner)
pub async fn add_provider_inner(
    state: &SharedAppState,
    request: AddProviderRequest,
) -> TauriResult<AIProviderConfig> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let now_str = now.to_rfc3339();

    // Store API key if provided
    {
        let state_read = state.read().await;
        if let Some(api_key) = &request.api_key {
            state_read.credential_cache.store_ai_key(&id, api_key)
                .map_err(|e| TauriError::cache_error(e.to_string()))?;
        }
    }

    let state_read = state.read().await;

    // Check if this is the first provider
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ai_providers")
        .fetch_one(&state_read.db_pool)
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
    .execute(&state_read.db_pool)
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
        is_available: true,
        created_at: now,
    })
}

/// Remove an AI provider (inner)
pub async fn remove_provider_inner(
    state: &SharedAppState,
    provider_id: String,
) -> TauriResult<()> {
    let state_read = state.read().await;
    let _ = state_read.credential_cache.delete_ai_key(&provider_id);
    sqlx::query("DELETE FROM ai_providers WHERE id = ?")
        .bind(&provider_id)
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Removed AI provider: {}", provider_id);
    Ok(())
}

/// Set the default AI provider (inner)
pub async fn set_default_provider_inner(
    state: &SharedAppState,
    provider_id: String,
) -> TauriResult<()> {
    let state_read = state.read().await;

    sqlx::query("UPDATE ai_providers SET is_default = 0")
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    sqlx::query("UPDATE ai_providers SET is_default = 1 WHERE id = ?")
        .bind(&provider_id)
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Set default AI provider: {}", provider_id);
    Ok(())
}

/// Analyze a merge request diff with AI (inner)
/// When `app` is Some, emits progress events via Tauri; when None (HTTP mode), skips events.
pub async fn analyze_diff_inner(
    app: Option<&AppHandle>,
    state: &SharedAppState,
    request: AnalyzeDiffRequest,
) -> TauriResult<AnalyzeDiffResponse> {
    let start_time = Instant::now();
    let mr_id = request.mr_iid;

    emit_progress(app, mr_id, AnalysisStatus::Started, 0, "Starting AI analysis...");

    // Get the provider to use (auto-register Claude CLI if needed)
    emit_progress(app, mr_id, AnalysisStatus::Processing, 10, "Loading AI provider...");
    let (provider_id, provider_type, model) = {
        let state_read = state.read().await;

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

        let result = query.fetch_optional(&state_read.db_pool)
            .await
            .map_err(|e| {
                emit_progress(app, mr_id, AnalysisStatus::Error, 0, &format!("Cache error: {}", e));
                TauriError::cache_error(e.to_string())
            })?;

        match result {
            Some(row) => row,
            None if request.provider_id.is_none() => {
                // No default provider found — try auto-registering Claude CLI
                drop(state_read);
                if let Some(provider) = auto_register_cli_provider(state).await? {
                    (provider.0, provider.1, provider.2)
                } else {
                    emit_progress(app, mr_id, AnalysisStatus::Error, 0, "No AI provider configured");
                    return Err(TauriError::ai_error("No AI provider configured. Add a provider in Settings → AI."));
                }
            }
            None => {
                emit_progress(app, mr_id, AnalysisStatus::Error, 0, "No AI provider configured");
                return Err(TauriError::ai_error("No AI provider configured"));
            }
        }
    };

    // Get the diff for this MR (fetch from API if not cached)
    emit_progress(app, mr_id, AnalysisStatus::Processing, 20, "Loading diff...");
    let diff = {
        use crate::gitlab::types::GetDiffRequest;
        super::gitlab::get_diff_inner(state, GetDiffRequest {
            project_id: request.project_id,
            mr_iid: request.mr_iid,
            use_cache: true,
        }).await
            .map_err(|e| {
                emit_progress(app, mr_id, AnalysisStatus::Error, 0, &format!("Failed to load diff: {}", e));
                e
            })?
    };

    // Resolve the global MR id for DB storage (FK requires merge_requests.id, not iid)
    let mr_global_id = diff.mr_id;

    // Clear old suggestions before re-analyzing
    {
        let state_read = state.read().await;
        sqlx::query("DELETE FROM ai_suggestions WHERE mr_id = ?")
            .bind(mr_global_id)
            .execute(&state_read.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?;
    }

    // Fetch MR title and description
    emit_progress(app, mr_id, AnalysisStatus::Processing, 30, "Preparing analysis context...");
    let (mr_title, mr_description) = {
        let state_read = state.read().await;
        sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT title, description FROM merge_requests WHERE id = ?"
        )
        .bind(mr_global_id)
        .fetch_optional(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?
        .unwrap_or_else(|| (format!("MR #{}", request.mr_iid), None))
    };

    // Build analysis context
    let context = AnalysisContext {
        mr_id: mr_global_id,
        mr_title,
        mr_description,
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
    emit_progress(app, mr_id, AnalysisStatus::Processing, 40, "Sending to AI for analysis...");
    let provider_type_enum = match provider_type.as_str() {
        "claude_cli" => AIProviderType::ClaudeCli,
        "anthropic_api" => AIProviderType::AnthropicApi,
        "openai_api" => AIProviderType::OpenaiApi,
        _ => {
            emit_progress(app, mr_id, AnalysisStatus::Error, 0, "Unknown provider type");
            return Err(TauriError::ai_error("Unknown provider type"));
        }
    };

    let raw_suggestions = match provider_type_enum {
        AIProviderType::ClaudeCli => {
            emit_progress(app, mr_id, AnalysisStatus::Processing, 50, "Analyzing with Claude CLI...");
            let provider = ClaudeCliProvider::new(provider_id.clone(), "Claude CLI".to_string(), None);
            provider.analyze(&context).await
                .map_err(|e| {
                    emit_progress(app, mr_id, AnalysisStatus::Error, 0, &format!("AI analysis failed: {}", e));
                    TauriError::ai_error(e.to_string())
                })?
        }
        AIProviderType::AnthropicApi => {
            emit_progress(app, mr_id, AnalysisStatus::Processing, 50, "Analyzing with Anthropic API...");
            let api_key = {
                let state_read = state.read().await;
                state_read.credential_cache.get_ai_key(&provider_id)
                    .map_err(|e| {
                        emit_progress(app, mr_id, AnalysisStatus::Error, 0, "Failed to retrieve API key");
                        TauriError::cache_error(e.to_string())
                    })?
                    .ok_or_else(|| {
                        emit_progress(app, mr_id, AnalysisStatus::Error, 0, "Anthropic API key not found");
                        TauriError::ai_error("Anthropic API key not found")
                    })?
            };
            let provider = crate::ai::AnthropicProvider::new(provider_id.clone(), "Anthropic".to_string(), api_key, model);
            provider.analyze(&context).await
                .map_err(|e| {
                    emit_progress(app, mr_id, AnalysisStatus::Error, 0, &format!("AI analysis failed: {}", e));
                    TauriError::ai_error(e.to_string())
                })?
        }
        AIProviderType::OpenaiApi => {
            emit_progress(app, mr_id, AnalysisStatus::Processing, 50, "Analyzing with OpenAI API...");
            let api_key = {
                let state_read = state.read().await;
                state_read.credential_cache.get_ai_key(&provider_id)
                    .map_err(|e| {
                        emit_progress(app, mr_id, AnalysisStatus::Error, 0, "Failed to retrieve API key");
                        TauriError::cache_error(e.to_string())
                    })?
                    .ok_or_else(|| {
                        emit_progress(app, mr_id, AnalysisStatus::Error, 0, "OpenAI API key not found");
                        TauriError::ai_error("OpenAI API key not found")
                    })?
            };
            let provider = crate::ai::OpenAIProvider::new(provider_id.clone(), "OpenAI".to_string(), api_key, model);
            provider.analyze(&context).await
                .map_err(|e| {
                    emit_progress(app, mr_id, AnalysisStatus::Error, 0, &format!("AI analysis failed: {}", e));
                    TauriError::ai_error(e.to_string())
                })?
        }
    };

    // Convert raw suggestions to AISuggestion and store
    emit_progress(app, mr_id, AnalysisStatus::Processing, 80, "Saving suggestions...");
    let mut suggestions = Vec::new();
    let state_read = state.read().await;

    let total_suggestions = raw_suggestions.len();
    for (i, raw) in raw_suggestions.into_iter().enumerate() {
        let suggestion_id = Uuid::new_v4().to_string();
        let suggestion = raw.to_suggestion(suggestion_id.clone(), mr_global_id, provider_id.clone());
        debug!(
            "AI suggestion '{}': file={} start_line={} end_line={} original_code={:?}",
            suggestion.title, suggestion.file_path, suggestion.start_line, suggestion.end_line, suggestion.original_code
        );

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
        .execute(&state_read.db_pool)
        .await {
            warn!("Failed to store suggestion: {}", e);
        }

        suggestions.push(suggestion);

        if total_suggestions > 0 {
            let progress = 80 + ((i + 1) * 15 / total_suggestions) as u8;
            emit_progress(app, mr_id, AnalysisStatus::Processing, progress, &format!("Saved {}/{} suggestions", i + 1, total_suggestions));
        }
    }

    let analysis_time = start_time.elapsed().as_millis() as u64;
    info!("AI analysis complete: {} suggestions in {}ms", suggestions.len(), analysis_time);

    emit_progress(app, mr_id, AnalysisStatus::Completed, 100, &format!("Analysis complete: {} suggestions found", suggestions.len()));

    Ok(AnalyzeDiffResponse {
        suggestions,
        provider_used: provider_id,
        analysis_time_ms: analysis_time,
    })
}

/// Update the status of an AI suggestion (inner)
pub async fn update_suggestion_status_inner(
    state: &SharedAppState,
    request: UpdateSuggestionRequest,
) -> TauriResult<()> {
    let state_read = state.read().await;

    let status_str = match request.status {
        SuggestionStatus::Pending => "pending",
        SuggestionStatus::Accepted => "accepted",
        SuggestionStatus::Dismissed => "dismissed",
        SuggestionStatus::Posted => "posted",
    };

    sqlx::query("UPDATE ai_suggestions SET status = ? WHERE id = ?")
        .bind(status_str)
        .bind(&request.suggestion_id)
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    debug!("Updated suggestion {} status to {}", request.suggestion_id, status_str);
    Ok(())
}

/// Check if Claude CLI is available (inner)
pub async fn check_cli_available_inner() -> TauriResult<CliAvailableResponse> {
    let (available, version, path) = ClaudeCliProvider::check_cli().await
        .map_err(|e| TauriError::ai_error(e.to_string()))?;

    Ok(CliAvailableResponse {
        available,
        version,
        path,
        error: if available { None } else { Some("Claude CLI not found".to_string()) },
    })
}

/// Get suggestions for a specific MR (inner)
/// Note: `mr_id` here is the MR iid (per-project number) as passed from the frontend.
/// We resolve it to the global merge_requests.id for the DB query.
pub async fn get_suggestions_inner(
    state: &SharedAppState,
    mr_id: i64,
) -> TauriResult<Vec<AISuggestion>> {
    let state_read = state.read().await;

    // The frontend passes iid, but ai_suggestions.mr_id stores the global merge_requests.id.
    // Join through merge_requests to resolve.
    let rows = sqlx::query_as::<_, (String, i64, String, String, i32, i32, String, String, String, String, Option<String>, String, String, String)>(
        "SELECT s.id, s.mr_id, s.provider_id, s.file_path, s.start_line, s.end_line, s.category, s.severity, s.title, s.description, s.suggested_code, s.original_code, s.status, s.created_at
         FROM ai_suggestions s
         JOIN merge_requests m ON s.mr_id = m.id
         WHERE m.iid = ?
         ORDER BY s.file_path, s.start_line"
    )
    .bind(mr_id)
    .fetch_all(&state_read.db_pool)
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

// ============================================================================
// Tauri command wrappers
// ============================================================================

/// List configured AI providers
#[tauri::command]
pub async fn ai_list_providers(state: State<'_, SharedAppState>) -> TauriResult<Vec<AIProviderConfig>> {
    list_providers_inner(&state).await
}

/// Add or update an AI provider configuration
#[tauri::command]
pub async fn ai_add_provider(
    state: State<'_, SharedAppState>,
    request: AddProviderRequest,
) -> TauriResult<AIProviderConfig> {
    add_provider_inner(&state, request).await
}

/// Remove an AI provider
#[tauri::command]
pub async fn ai_remove_provider(
    state: State<'_, SharedAppState>,
    provider_id: String,
) -> TauriResult<()> {
    remove_provider_inner(&state, provider_id).await
}

/// Set the default AI provider
#[tauri::command]
pub async fn ai_set_default_provider(
    state: State<'_, SharedAppState>,
    provider_id: String,
) -> TauriResult<()> {
    set_default_provider_inner(&state, provider_id).await
}

/// Analyze a merge request diff with AI
#[tauri::command]
pub async fn ai_analyze_diff(
    app: AppHandle,
    state: State<'_, SharedAppState>,
    request: AnalyzeDiffRequest,
) -> TauriResult<AnalyzeDiffResponse> {
    analyze_diff_inner(Some(&app), &state, request).await
}

/// Update the status of an AI suggestion
#[tauri::command]
pub async fn ai_update_suggestion_status(
    state: State<'_, SharedAppState>,
    request: UpdateSuggestionRequest,
) -> TauriResult<()> {
    update_suggestion_status_inner(&state, request).await
}

/// Check if Claude CLI is available
#[tauri::command]
pub async fn ai_check_cli_available() -> TauriResult<CliAvailableResponse> {
    check_cli_available_inner().await
}

/// Get suggestions for a specific MR
#[tauri::command]
pub async fn ai_get_suggestions(
    state: State<'_, SharedAppState>,
    mr_id: i64,
) -> TauriResult<Vec<AISuggestion>> {
    get_suggestions_inner(&state, mr_id).await
}
