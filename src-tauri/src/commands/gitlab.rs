//! GitLab-related Tauri commands
//!
//! This module contains all GitLab-related IPC commands.

use crate::cache::diff_cache::DiffCache;
use crate::gitlab::client::GitLabClient;
use crate::gitlab::comments::PositionData;
use crate::gitlab::types::{
    AddAccountRequest, ApprovalState, ApproveResponse, ConnectionStatus, ConnectionStatusEvent,
    Diff, Discussion, GetDiffRequest, GitLabAccount, ListMergeRequestsRequest,
    ListMergeRequestsResponse, MergeRequest, PostCommentRequest, PostCommentResponse,
    RefreshRequest, ValidateTokenRequest, ValidateTokenResponse,
};
use crate::settings::credentials::CredentialManager;
use crate::{SharedAppState, TauriError, TauriResult};
use chrono::Utc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tracing::{debug, info, warn};
use uuid::Uuid;

/// List all configured GitLab accounts
#[tauri::command]
pub async fn gitlab_list_accounts(state: State<'_, SharedAppState>) -> TauriResult<Vec<GitLabAccount>> {
    let state = state.read().await;

    let rows = sqlx::query_as::<_, (String, String, String, String, i64, Option<String>, i64, String, String)>(
        "SELECT id, name, instance_url, username, user_id, avatar_url, is_active, created_at, last_used_at
         FROM gitlab_accounts ORDER BY name"
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let accounts = rows
        .into_iter()
        .map(|(id, name, instance_url, username, user_id, avatar_url, is_active, created_at, last_used_at)| {
            GitLabAccount {
                id,
                name,
                instance_url,
                username,
                user_id,
                avatar_url,
                is_active: is_active != 0,
                created_at: created_at.parse().unwrap_or_default(),
                last_used_at: last_used_at.parse().unwrap_or_default(),
            }
        })
        .collect();

    Ok(accounts)
}

/// Add a new GitLab account
#[tauri::command]
pub async fn gitlab_add_account(
    state: State<'_, SharedAppState>,
    request: AddAccountRequest,
) -> TauriResult<GitLabAccount> {
    // First validate the token
    let client = GitLabClient::new(&request.instance_url, &request.access_token)
        .map_err(|e| TauriError::invalid_url(e.to_string()))?;

    // Get user info to validate token
    let user_info = client
        .get_current_user()
        .await
        .map_err(|e| TauriError::invalid_token(e.to_string()))?;

    // Store token securely
    let id = Uuid::new_v4().to_string();
    info!("Attempting to store token in keyring for account id: {}", id);
    match CredentialManager::store_token(&id, &request.access_token) {
        Ok(()) => info!("Token stored successfully in keyring"),
        Err(e) => {
            warn!("Failed to store token in keyring: {:?}", e);
            return Err(TauriError::cache_error(format!("Failed to store token: {}", e)));
        }
    }

    let now = Utc::now();
    let now_str = now.to_rfc3339();

    // Insert account into database
    let state = state.read().await;
    sqlx::query(
        "INSERT INTO gitlab_accounts (id, name, instance_url, username, user_id, avatar_url, is_active, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)"
    )
    .bind(&id)
    .bind(&request.name)
    .bind(&request.instance_url)
    .bind(&user_info.username)
    .bind(user_info.id)
    .bind(&user_info.avatar_url)
    .bind(&now_str)
    .bind(&now_str)
    .execute(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Added GitLab account: {} ({})", request.name, user_info.username);

    Ok(GitLabAccount {
        id,
        name: request.name,
        instance_url: request.instance_url,
        username: user_info.username,
        user_id: user_info.id,
        avatar_url: user_info.avatar_url,
        is_active: false,
        created_at: now,
        last_used_at: now,
    })
}

/// Remove a GitLab account
#[tauri::command]
pub async fn gitlab_remove_account(
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<()> {
    // Remove token from keyring
    let _ = CredentialManager::delete_token(&account_id);

    let state = state.read().await;
    sqlx::query("DELETE FROM gitlab_accounts WHERE id = ?")
        .bind(&account_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Removed GitLab account: {}", account_id);
    Ok(())
}

/// Set the active GitLab account
#[tauri::command]
pub async fn gitlab_set_active_account(
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<()> {
    let state = state.read().await;

    // Deactivate all accounts first
    sqlx::query("UPDATE gitlab_accounts SET is_active = 0")
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Activate the specified account and update last_used_at
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE gitlab_accounts SET is_active = 1, last_used_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&account_id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Set active GitLab account: {}", account_id);
    Ok(())
}

/// Validate a GitLab personal access token
#[tauri::command]
pub async fn gitlab_validate_token(
    request: ValidateTokenRequest,
) -> TauriResult<ValidateTokenResponse> {
    let client = match GitLabClient::new(&request.instance_url, &request.access_token) {
        Ok(c) => c,
        Err(e) => {
            return Ok(ValidateTokenResponse {
                valid: false,
                username: None,
                user_id: None,
                scopes: vec![],
                error: Some(e.to_string()),
            });
        }
    };

    match client.get_current_user().await {
        Ok(user) => Ok(ValidateTokenResponse {
            valid: true,
            username: Some(user.username),
            user_id: Some(user.id),
            scopes: vec!["api".to_string()], // GitLab doesn't expose scopes easily
            error: None,
        }),
        Err(e) => Ok(ValidateTokenResponse {
            valid: false,
            username: None,
            user_id: None,
            scopes: vec![],
            error: Some(e.to_string()),
        }),
    }
}

/// Get the active account and its GitLab client
async fn get_active_client(state: &SharedAppState) -> TauriResult<(GitLabAccount, GitLabClient)> {
    let state = state.read().await;

    let row = sqlx::query_as::<_, (String, String, String, String, i64, Option<String>, i64, String, String)>(
        "SELECT id, name, instance_url, username, user_id, avatar_url, is_active, created_at, last_used_at
         FROM gitlab_accounts WHERE is_active = 1 LIMIT 1"
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| TauriError::cache_error(e.to_string()))?;

    let (id, name, instance_url, username, user_id, avatar_url, is_active, created_at, last_used_at) =
        row.ok_or_else(TauriError::not_authenticated)?;

    let account = GitLabAccount {
        id: id.clone(),
        name,
        instance_url: instance_url.clone(),
        username,
        user_id,
        avatar_url,
        is_active: is_active != 0,
        created_at: created_at.parse().unwrap_or_default(),
        last_used_at: last_used_at.parse().unwrap_or_default(),
    };

    // Get token from keyring
    let token = CredentialManager::get_token(&id)
        .map_err(|e| TauriError::cache_error(format!("Failed to retrieve token: {}", e)))?
        .ok_or_else(|| TauriError::cache_error("Token not found in keyring"))?;

    let client = GitLabClient::new(&instance_url, &token)
        .map_err(|e| TauriError::network_error(e.to_string()))?;

    Ok((account, client))
}

/// List merge requests for the active account
#[tauri::command]
pub async fn gitlab_list_merge_requests(
    state: State<'_, SharedAppState>,
    request: ListMergeRequestsRequest,
) -> TauriResult<ListMergeRequestsResponse> {
    let (_account, client) = get_active_client(&state).await?;

    // Fetch MRs from GitLab API
    let merge_requests = client
        .get_assigned_merge_requests()
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched {} merge requests", merge_requests.len());

    // Apply filtering if specified
    let filtered = if let Some(filter) = &request.filter {
        merge_requests
            .into_iter()
            .filter(|mr| {
                // Filter by project
                if let Some(project_id) = filter.project_id {
                    if mr.project_id != project_id {
                        return false;
                    }
                }
                // Filter by author
                if let Some(ref author) = filter.author_username {
                    if mr.author.username != *author {
                        return false;
                    }
                }
                // Filter by conflicts
                if let Some(has_conflicts) = filter.has_conflicts {
                    if mr.has_conflicts != has_conflicts {
                        return false;
                    }
                }
                // Filter by draft status
                if let Some(is_draft) = filter.is_draft {
                    if mr.draft != is_draft {
                        return false;
                    }
                }
                // Filter by pipeline failure
                if let Some(pipeline_failed) = filter.pipeline_failed {
                    let failed = mr
                        .head_pipeline
                        .as_ref()
                        .map(|p| p.status == crate::gitlab::types::PipelineStatus::Failed)
                        .unwrap_or(false);
                    if failed != pipeline_failed {
                        return false;
                    }
                }
                true
            })
            .collect()
    } else {
        merge_requests
    };

    // Apply search if specified
    let searched = if let Some(ref query) = request.search {
        let query_lower = query.to_lowercase();
        filtered
            .into_iter()
            .filter(|mr| {
                mr.title.to_lowercase().contains(&query_lower)
                    || mr.description.as_ref().is_some_and(|d| d.to_lowercase().contains(&query_lower))
            })
            .collect()
    } else {
        filtered
    };

    Ok(ListMergeRequestsResponse {
        merge_requests: searched,
        from_cache: false,
        cached_at: None,
    })
}

/// Get full details for a single merge request
#[tauri::command]
pub async fn gitlab_get_merge_request(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<MergeRequest> {
    let (_account, client) = get_active_client(&state).await?;

    let mr = client
        .get_merge_request(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    Ok(mr)
}

/// Fetch the diff for a merge request
#[tauri::command]
pub async fn gitlab_get_diff(
    state: State<'_, SharedAppState>,
    request: GetDiffRequest,
) -> TauriResult<Diff> {
    // Try cache first if allowed
    if request.use_cache {
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());

        if let Ok(Some(cached_diff)) = cache.get(request.mr_iid).await {
            debug!("Returning cached diff for MR {}", request.mr_iid);
            return Ok(cached_diff);
        }
    }

    let (_account, client) = get_active_client(&state).await?;

    // Fetch from API
    let diff = client
        .get_merge_request_diff(request.project_id, request.mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache the result
    let state_read = state.read().await;
    let cache = DiffCache::new(state_read.db_pool.clone());
    if let Err(e) = cache.store(&diff).await {
        warn!("Failed to cache diff: {}", e);
    }

    Ok(diff)
}

/// Fetch discussions/comments for a merge request
#[tauri::command]
pub async fn gitlab_get_discussions(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<Vec<Discussion>> {
    let (_account, client) = get_active_client(&state).await?;

    let discussions = client
        .get_merge_request_discussions(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched {} discussions for MR {}", discussions.len(), mr_iid);
    Ok(discussions)
}

/// Post a comment or suggestion to a merge request
#[tauri::command]
pub async fn gitlab_post_comment(
    state: State<'_, SharedAppState>,
    request: PostCommentRequest,
) -> TauriResult<PostCommentResponse> {
    let (_account, client) = get_active_client(&state).await?;

    // Check MR state - cannot post to merged or closed MRs
    let mr = client
        .get_merge_request(request.project_id, request.mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    match mr.state {
        crate::gitlab::types::MergeRequestState::Merged => {
            return Err(TauriError::invalid_input(
                "Cannot post comment: Merge request has already been merged"
            ));
        }
        crate::gitlab::types::MergeRequestState::Closed => {
            return Err(TauriError::invalid_input(
                "Cannot post comment: Merge request is closed"
            ));
        }
        _ => {} // "opened" is valid
    }

    // If as_suggestion, format the body accordingly
    let body = if request.as_suggestion {
        crate::gitlab::comments::format_code_suggestion("", &request.body, None)
    } else {
        request.body.clone()
    };

    // Build position data if provided
    let position = request.position.map(|p| {
        let start_sha = p.base_sha.clone(); // GitLab often uses base_sha as start_sha
        PositionData {
            base_sha: p.base_sha,
            head_sha: p.head_sha,
            start_sha,
            old_path: p.old_path,
            new_path: p.new_path,
            old_line: p.old_line,
            new_line: p.new_line,
            position_type: p.position_type,
        }
    });

    let discussion = client
        .post_discussion(request.project_id, request.mr_iid, &body, position)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    let note = discussion.notes.first()
        .ok_or_else(|| TauriError::api_error("No note returned from GitLab"))?;

    Ok(PostCommentResponse {
        discussion_id: discussion.id,
        note_id: note.id,
        web_url: format!("{}#note_{}", note.author.web_url, note.id), // Approximate
    })
}

/// Force refresh data from GitLab (bypass cache)
#[tauri::command]
pub async fn gitlab_refresh(
    state: State<'_, SharedAppState>,
    request: RefreshRequest,
) -> TauriResult<()> {
    if let Some(specific) = request.specific_mr {
        // Clear cache for specific MR
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());
        let _ = cache.delete(specific.mr_iid).await;
        info!("Cleared cache for MR {}", specific.mr_iid);
    }

    if request.merge_requests {
        // Clear all MR-related cache
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());
        let _ = cache.clear().await;
        info!("Cleared all diff cache");
    }

    Ok(())
}

/// Check connection status for a GitLab account
/// Emits a connection:status event with the result
#[tauri::command]
pub async fn gitlab_check_connection(
    app: AppHandle,
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<ConnectionStatusEvent> {
    // Emit checking status
    let checking_event = ConnectionStatusEvent {
        account_id: account_id.clone(),
        status: ConnectionStatus::Checking,
        error: None,
        latency_ms: None,
    };
    let _ = app.emit("connection:status", &checking_event);

    // Get the account token
    let token = match CredentialManager::get_token(&account_id) {
        Ok(Some(t)) => t,
        Ok(None) => {
            let event = ConnectionStatusEvent {
                account_id: account_id.clone(),
                status: ConnectionStatus::Error,
                error: Some("No token found for account".to_string()),
                latency_ms: None,
            };
            let _ = app.emit("connection:status", &event);
            return Ok(event);
        }
        Err(e) => {
            let event = ConnectionStatusEvent {
                account_id: account_id.clone(),
                status: ConnectionStatus::Error,
                error: Some(format!("Failed to retrieve token: {}", e)),
                latency_ms: None,
            };
            let _ = app.emit("connection:status", &event);
            return Ok(event);
        }
    };

    // Get account instance URL from database
    let instance_url = {
        let state = state.read().await;
        sqlx::query_as::<_, (String,)>("SELECT instance_url FROM gitlab_accounts WHERE id = ?")
            .bind(&account_id)
            .fetch_optional(&state.db_pool)
            .await
            .map_err(|e| TauriError::cache_error(e.to_string()))?
            .map(|(url,)| url)
    };

    let instance_url = match instance_url {
        Some(url) => url,
        None => {
            let event = ConnectionStatusEvent {
                account_id: account_id.clone(),
                status: ConnectionStatus::Error,
                error: Some("Account not found".to_string()),
                latency_ms: None,
            };
            let _ = app.emit("connection:status", &event);
            return Ok(event);
        }
    };

    // Try to connect and measure latency
    let start = Instant::now();
    let client = match GitLabClient::new(&instance_url, &token) {
        Ok(c) => c,
        Err(e) => {
            let event = ConnectionStatusEvent {
                account_id: account_id.clone(),
                status: ConnectionStatus::Error,
                error: Some(format!("Failed to create client: {}", e)),
                latency_ms: None,
            };
            let _ = app.emit("connection:status", &event);
            return Ok(event);
        }
    };

    match client.get_current_user().await {
        Ok(_) => {
            let latency = start.elapsed().as_millis() as u64;
            let event = ConnectionStatusEvent {
                account_id,
                status: ConnectionStatus::Connected,
                error: None,
                latency_ms: Some(latency),
            };
            let _ = app.emit("connection:status", &event);
            Ok(event)
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            let event = ConnectionStatusEvent {
                account_id,
                status: ConnectionStatus::Disconnected,
                error: Some(e.to_string()),
                latency_ms: Some(latency),
            };
            let _ = app.emit("connection:status", &event);
            Ok(event)
        }
    }
}

/// Get the approval state for a merge request
#[tauri::command]
pub async fn gitlab_get_approval_state(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApprovalState> {
    let (_account, client) = get_active_client(&state).await?;

    let approval_state = client
        .get_approval_state(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched approval state for MR {}: approved={}", mr_iid, approval_state.approved);
    Ok(approval_state)
}

/// Approve a merge request
#[tauri::command]
pub async fn gitlab_approve_mr(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
    sha: Option<String>,
) -> TauriResult<ApproveResponse> {
    let (_account, client) = get_active_client(&state).await?;

    let response = client
        .approve_mr(project_id, mr_iid, sha)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Approved MR {} in project {}", mr_iid, project_id);
    Ok(response)
}

/// Remove approval from a merge request
#[tauri::command]
pub async fn gitlab_unapprove_mr(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApproveResponse> {
    let (_account, client) = get_active_client(&state).await?;

    let response = client
        .unapprove_mr(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Unapproved MR {} in project {}", mr_iid, project_id);
    Ok(response)
}
