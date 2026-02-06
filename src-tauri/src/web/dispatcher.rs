//! Command dispatcher for the HTTP web server
//!
//! Routes incoming `POST /api/invoke` requests to the corresponding
//! inner command functions, matching Tauri's invoke semantics.

use crate::commands::{ai, cache, gitlab, settings};
use crate::{SharedAppState, TauriError};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Incoming invoke request (matches frontend's fetch body)
#[derive(Debug, Deserialize)]
pub struct InvokeRequest {
    pub command: String,
    #[serde(default)]
    pub args: Value,
}

/// Error invoke response
#[derive(Serialize)]
struct InvokeErr {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
}

/// Convert TauriError into an HTTP response
impl IntoResponse for InvokeErr {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// Helper to extract a field from the args object
fn get_arg<T: serde::de::DeserializeOwned>(args: &Value, key: &str) -> Result<T, TauriError> {
    args.get(key)
        .ok_or_else(|| TauriError::invalid_input(format!("Missing argument: {}", key)))
        .and_then(|v| {
            serde_json::from_value(v.clone())
                .map_err(|e| TauriError::invalid_input(format!("Invalid argument '{}': {}", key, e)))
        })
}

/// Optional arg extraction
fn get_optional_arg<T: serde::de::DeserializeOwned>(args: &Value, key: &str) -> Result<Option<T>, TauriError> {
    match args.get(key) {
        Some(v) if !v.is_null() => serde_json::from_value(v.clone())
            .map(Some)
            .map_err(|e| TauriError::invalid_input(format!("Invalid argument '{}': {}", key, e))),
        _ => Ok(None),
    }
}

/// Main invoke handler
pub async fn handle_invoke(
    State(state): State<SharedAppState>,
    Json(req): Json<InvokeRequest>,
) -> Response {
    match dispatch(&state, &req.command, &req.args).await {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(err) => InvokeErr {
            code: err.code,
            message: err.message,
            details: err.details,
        }
        .into_response(),
    }
}

/// Dispatch a command to the appropriate inner function
async fn dispatch(
    state: &SharedAppState,
    command: &str,
    args: &Value,
) -> Result<Value, TauriError> {
    match command {
        // ====================================================================
        // GitLab commands
        // ====================================================================
        "gitlab_list_accounts" => {
            let result = gitlab::list_accounts_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_add_account" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::add_account_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_remove_account" => {
            let account_id = get_arg(args, "accountId")?;
            gitlab::remove_account_inner(state, account_id).await?;
            Ok(Value::Null)
        }
        "gitlab_set_active_account" => {
            let account_id = get_arg(args, "accountId")?;
            gitlab::set_active_account_inner(state, account_id).await?;
            Ok(Value::Null)
        }
        "gitlab_validate_token" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::validate_token_inner(request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_list_merge_requests" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::list_merge_requests_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_get_merge_request" => {
            let project_id = get_arg(args, "projectId")?;
            let mr_iid = get_arg(args, "mrIid")?;
            let result = gitlab::get_merge_request_inner(state, project_id, mr_iid).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_get_diff" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::get_diff_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_get_discussions" => {
            let project_id = get_arg(args, "projectId")?;
            let mr_iid = get_arg(args, "mrIid")?;
            let result = gitlab::get_discussions_inner(state, project_id, mr_iid).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_post_comment" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::post_comment_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_get_file_content" => {
            let project_id = get_arg(args, "projectId")?;
            let file_path = get_arg(args, "filePath")?;
            let ref_sha = get_arg(args, "refSha")?;
            let result = gitlab::get_file_content_inner(state, project_id, file_path, ref_sha).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_refresh" => {
            let request = get_arg(args, "request")?;
            gitlab::refresh_inner(state, request).await?;
            Ok(Value::Null)
        }
        "gitlab_check_connection" => {
            let account_id = get_arg(args, "accountId")?;
            let result = gitlab::check_connection_inner(None, state, account_id).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_get_approval_state" => {
            let project_id = get_arg(args, "projectId")?;
            let mr_iid = get_arg(args, "mrIid")?;
            let result = gitlab::get_approval_state_inner(state, project_id, mr_iid).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_approve_mr" => {
            let project_id = get_arg(args, "projectId")?;
            let mr_iid = get_arg(args, "mrIid")?;
            let sha = get_optional_arg(args, "sha")?;
            let result = gitlab::approve_mr_inner(state, project_id, mr_iid, sha).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_unapprove_mr" => {
            let project_id = get_arg(args, "projectId")?;
            let mr_iid = get_arg(args, "mrIid")?;
            let result = gitlab::unapprove_mr_inner(state, project_id, mr_iid).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_fetch_avatar" => {
            let avatar_url = get_arg(args, "avatarUrl")?;
            let result = gitlab::fetch_avatar_inner(state, avatar_url).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_reply_to_discussion" => {
            let request = get_arg(args, "request")?;
            let result = gitlab::reply_to_discussion_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "gitlab_resolve_discussion" => {
            let request = get_arg(args, "request")?;
            gitlab::resolve_discussion_inner(state, request).await?;
            Ok(Value::Null)
        }

        // ====================================================================
        // AI commands
        // ====================================================================
        "ai_list_providers" => {
            let result = ai::list_providers_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "ai_add_provider" => {
            let request = get_arg(args, "request")?;
            let result = ai::add_provider_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "ai_remove_provider" => {
            let provider_id = get_arg(args, "providerId")?;
            ai::remove_provider_inner(state, provider_id).await?;
            Ok(Value::Null)
        }
        "ai_set_default_provider" => {
            let provider_id = get_arg(args, "providerId")?;
            ai::set_default_provider_inner(state, provider_id).await?;
            Ok(Value::Null)
        }
        "ai_analyze_diff" => {
            let request = get_arg(args, "request")?;
            let result = ai::analyze_diff_inner(None, state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "ai_update_suggestion_status" => {
            let request = get_arg(args, "request")?;
            ai::update_suggestion_status_inner(state, request).await?;
            Ok(Value::Null)
        }
        "ai_check_cli_available" => {
            let result = ai::check_cli_available_inner().await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "ai_get_suggestions" => {
            let mr_id = get_arg(args, "mrId")?;
            let result = ai::get_suggestions_inner(state, mr_id).await?;
            Ok(serde_json::to_value(result).unwrap())
        }

        // ====================================================================
        // Settings commands
        // ====================================================================
        "settings_get" => {
            let result = settings::get_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "settings_update" => {
            let request = get_arg(args, "request")?;
            let result = settings::update_inner(state, request).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "settings_reset" => {
            let result = settings::reset_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "settings_check_secure_storage" => {
            let result = settings::check_secure_storage_inner()?;
            Ok(serde_json::to_value(result).unwrap())
        }

        // ====================================================================
        // Cache commands
        // ====================================================================
        "cache_get_stats" => {
            let result = cache::get_stats_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }
        "cache_clear" => {
            let request = get_arg(args, "request")?;
            cache::clear_inner(state, request).await?;
            Ok(Value::Null)
        }
        "cache_evict_old" => {
            let result = cache::evict_old_inner(state).await?;
            Ok(serde_json::to_value(result).unwrap())
        }

        _ => Err(TauriError::invalid_input(format!(
            "Unknown command: {}",
            command
        ))),
    }
}
