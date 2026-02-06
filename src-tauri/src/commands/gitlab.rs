//! GitLab-related Tauri commands
//!
//! This module contains all GitLab-related IPC commands.

use crate::cache::diff_cache::DiffCache;
use crate::cache::mr_cache::MrCache;
use crate::gitlab::client::GitLabClient;
use crate::gitlab::comments::PositionData;
use crate::gitlab::types::{
    AddAccountRequest, ApprovalState, ApproveResponse, ConnectionStatus, ConnectionStatusEvent,
    Diff, Discussion, GetDiffRequest, GitLabAccount, ListMergeRequestsRequest,
    ListMergeRequestsResponse, MergeRequest, Note, PostCommentRequest, PostCommentResponse,
    RefreshRequest, ReplyToDiscussionRequest, ResolveDiscussionRequest, ValidateTokenRequest,
    ValidateTokenResponse,
};
use crate::{SharedAppState, TauriError, TauriResult};
use chrono::Utc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tracing::{debug, info, warn};
use uuid::Uuid;

// ============================================================================
// Inner functions — shared by Tauri + HTTP
// ============================================================================

/// Get the active account and its GitLab client
pub async fn get_active_client(state: &SharedAppState) -> TauriResult<(GitLabAccount, GitLabClient)> {
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

    // Get token from cache (falls back to keychain on first access)
    let token = state.credential_cache.get_token(&id)
        .map_err(|e| TauriError::cache_error(format!("Failed to retrieve token: {}", e)))?
        .ok_or_else(|| TauriError::cache_error("Token not found in keyring"))?;

    let client = GitLabClient::new(&instance_url, &token)
        .map_err(|e| TauriError::network_error(e.to_string()))?;

    Ok((account, client))
}

/// List all configured GitLab accounts (inner)
pub async fn list_accounts_inner(state: &SharedAppState) -> TauriResult<Vec<GitLabAccount>> {
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

/// Add a new GitLab account (inner)
pub async fn add_account_inner(
    state: &SharedAppState,
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

    // Store token securely (keychain + in-memory cache)
    let id = Uuid::new_v4().to_string();
    info!("Attempting to store token in keyring for account id: {}", id);
    {
        let state_read = state.read().await;
        match state_read.credential_cache.store_token(&id, &request.access_token) {
            Ok(()) => info!("Token stored successfully in keyring"),
            Err(e) => {
                warn!("Failed to store token in keyring: {:?}", e);
                return Err(TauriError::cache_error(format!("Failed to store token: {}", e)));
            }
        }
    }

    let now = Utc::now();
    let now_str = now.to_rfc3339();

    // Insert account into database
    let state_read = state.read().await;
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
    .execute(&state_read.db_pool)
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

/// Remove a GitLab account (inner)
pub async fn remove_account_inner(
    state: &SharedAppState,
    account_id: String,
) -> TauriResult<()> {
    let state_read = state.read().await;
    let _ = state_read.credential_cache.delete_token(&account_id);

    sqlx::query("DELETE FROM gitlab_accounts WHERE id = ?")
        .bind(&account_id)
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Removed GitLab account: {}", account_id);
    Ok(())
}

/// Set the active GitLab account (inner)
pub async fn set_active_account_inner(
    state: &SharedAppState,
    account_id: String,
) -> TauriResult<()> {
    let state_read = state.read().await;

    // Deactivate all accounts first
    sqlx::query("UPDATE gitlab_accounts SET is_active = 0")
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    // Activate the specified account and update last_used_at
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE gitlab_accounts SET is_active = 1, last_used_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&account_id)
        .execute(&state_read.db_pool)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;

    info!("Set active GitLab account: {}", account_id);
    Ok(())
}

/// Validate a GitLab personal access token (inner)
pub async fn validate_token_inner(
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
            scopes: vec!["api".to_string()],
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

/// List merge requests for the active account (inner)
pub async fn list_merge_requests_inner(
    state: &SharedAppState,
    request: ListMergeRequestsRequest,
) -> TauriResult<ListMergeRequestsResponse> {
    let (account, client) = get_active_client(state).await?;

    // Fetch MRs from GitLab API
    let merge_requests = client
        .get_assigned_merge_requests()
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched {} merge requests", merge_requests.len());

    // Cache MRs to the database (ensure projects exist first for FK constraint)
    {
        let state_read = state.read().await;
        let now = Utc::now().to_rfc3339();

        // Upsert placeholder project rows so MR FK constraint is satisfied
        let mut seen_projects = std::collections::HashSet::new();
        for mr in &merge_requests {
            if seen_projects.insert(mr.project_id) {
                let path = mr.project_path.as_deref().unwrap_or("unknown");
                let name = mr.project_name.as_deref().unwrap_or("Unknown");
                let web_url = mr.web_url.split("/-/").next().unwrap_or("");
                if let Err(e) = sqlx::query(
                    "INSERT OR IGNORE INTO projects (id, account_id, path_with_namespace, name, web_url, last_activity_at, cached_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(mr.project_id)
                .bind(&account.id)
                .bind(path)
                .bind(name)
                .bind(web_url)
                .bind(&now)
                .bind(&now)
                .execute(&state_read.db_pool)
                .await {
                    warn!("Failed to cache project {}: {}", mr.project_id, e);
                }
            }
        }

        if let Err(e) = MrCache::upsert_many(&state_read.db_pool, &merge_requests).await {
            warn!("Failed to cache merge requests: {}", e);
        }
    }

    // Apply filtering if specified
    let filtered = if let Some(filter) = &request.filter {
        merge_requests
            .into_iter()
            .filter(|mr| {
                if let Some(project_id) = filter.project_id {
                    if mr.project_id != project_id {
                        return false;
                    }
                }
                if let Some(ref author) = filter.author_username {
                    if mr.author.username != *author {
                        return false;
                    }
                }
                if let Some(has_conflicts) = filter.has_conflicts {
                    if mr.has_conflicts != has_conflicts {
                        return false;
                    }
                }
                if let Some(is_draft) = filter.is_draft {
                    if mr.draft != is_draft {
                        return false;
                    }
                }
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

    // Optionally fetch approval states for all MRs in parallel
    let approval_states = if request.include_approvals && !searched.is_empty() {
        let mut approvals = std::collections::HashMap::new();
        let batch_size = 10;

        for chunk in searched.chunks(batch_size) {
            let mut join_set = tokio::task::JoinSet::new();

            for mr in chunk {
                let client_clone = client.clone();
                let project_id = mr.project_id;
                let mr_iid = mr.iid;
                let mr_id = mr.id;

                join_set.spawn(async move {
                    let result = client_clone.get_approval_state(project_id, mr_iid).await;
                    (mr_id, result)
                });
            }

            while let Some(result) = join_set.join_next().await {
                if let Ok((mr_id, Ok(state))) = result {
                    approvals.insert(mr_id, state);
                }
            }
        }

        debug!("Fetched {} approval states in batch", approvals.len());
        Some(approvals)
    } else {
        None
    };

    Ok(ListMergeRequestsResponse {
        merge_requests: searched,
        from_cache: false,
        cached_at: None,
        approval_states,
    })
}

/// Get full details for a single merge request (inner)
pub async fn get_merge_request_inner(
    state: &SharedAppState,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<MergeRequest> {
    let (account, client) = get_active_client(state).await?;

    let mr = client
        .get_merge_request(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache the MR (ensure project exists first for FK constraint)
    {
        let state_read = state.read().await;
        let now = Utc::now().to_rfc3339();
        let path = mr.project_path.as_deref().unwrap_or("unknown");
        let name = mr.project_name.as_deref().unwrap_or("Unknown");
        let web_url = mr.web_url.split("/-/").next().unwrap_or("");
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO projects (id, account_id, path_with_namespace, name, web_url, last_activity_at, cached_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(mr.project_id)
        .bind(&account.id)
        .bind(path)
        .bind(name)
        .bind(web_url)
        .bind(&now)
        .bind(&now)
        .execute(&state_read.db_pool)
        .await;

        if let Err(e) = MrCache::upsert(&state_read.db_pool, &mr).await {
            warn!("Failed to cache merge request: {}", e);
        }
    }

    Ok(mr)
}

/// Fetch the diff for a merge request (inner)
pub async fn get_diff_inner(
    state: &SharedAppState,
    request: GetDiffRequest,
) -> TauriResult<Diff> {
    // Look up the global MR id from the merge_requests table (diffs.mr_id is an FK to merge_requests.id)
    let mr_global_id = {
        let state_read = state.read().await;
        sqlx::query_scalar::<_, i64>(
            "SELECT id FROM merge_requests WHERE project_id = ? AND iid = ?",
        )
        .bind(request.project_id)
        .bind(request.mr_iid)
        .fetch_optional(&state_read.db_pool)
        .await
        .ok()
        .flatten()
    };

    // Try cache first if allowed
    if request.use_cache {
        if let Some(global_id) = mr_global_id {
            let state_read = state.read().await;
            let cache = DiffCache::new(state_read.db_pool.clone());

            if let Ok(Some(cached_diff)) = cache.get(global_id).await {
                debug!("Returning cached diff for MR {}", request.mr_iid);
                return Ok(cached_diff);
            }
        }
    }

    let (_account, client) = get_active_client(state).await?;

    // Fetch from API
    let mut diff = client
        .get_merge_request_diff(request.project_id, request.mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache the result using the global MR id (required by FK constraint)
    if let Some(global_id) = mr_global_id {
        diff.mr_id = global_id;
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());
        if let Err(e) = cache.store(&diff).await {
            warn!("Failed to cache diff: {}", e);
        }
    }

    Ok(diff)
}

/// Fetch discussions/comments for a merge request (inner)
pub async fn get_discussions_inner(
    state: &SharedAppState,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<Vec<Discussion>> {
    let (_account, client) = get_active_client(state).await?;

    let discussions = client
        .get_merge_request_discussions(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched {} discussions for MR {}", discussions.len(), mr_iid);
    Ok(discussions)
}

/// Post a comment or suggestion to a merge request (inner)
pub async fn post_comment_inner(
    state: &SharedAppState,
    request: PostCommentRequest,
) -> TauriResult<PostCommentResponse> {
    let (_account, client) = get_active_client(state).await?;

    // Check MR state
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
        _ => {}
    }

    let body = if request.as_suggestion {
        crate::gitlab::comments::format_code_suggestion("", &request.body, None)
    } else {
        request.body.clone()
    };

    let position = request.position.map(|p| {
        let start_sha = p.start_sha.unwrap_or_else(|| p.base_sha.clone());
        debug!(
            "Posting comment position: new_path={} new_line={} old_line={:?} old_path={:?} base_sha={} start_sha={} head_sha={}",
            p.new_path, p.new_line, p.old_line, p.old_path, p.base_sha, start_sha, p.head_sha
        );
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
        web_url: format!("{}#note_{}", note.author.web_url, note.id),
    })
}

/// Fetch raw file content at a specific commit SHA (inner)
pub async fn get_file_content_inner(
    state: &SharedAppState,
    project_id: i64,
    file_path: String,
    ref_sha: String,
) -> TauriResult<String> {
    let (_account, client) = get_active_client(state).await?;

    let content = client
        .get_file_content(project_id, &file_path, &ref_sha)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    Ok(content)
}

/// Force refresh data from GitLab (inner)
pub async fn refresh_inner(
    state: &SharedAppState,
    request: RefreshRequest,
) -> TauriResult<()> {
    if let Some(specific) = request.specific_mr {
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());
        let _ = cache.delete(specific.mr_iid).await;
        info!("Cleared cache for MR {}", specific.mr_iid);
    }

    if request.merge_requests {
        let state_read = state.read().await;
        let cache = DiffCache::new(state_read.db_pool.clone());
        let _ = cache.clear().await;
        info!("Cleared all diff cache");
    }

    Ok(())
}

/// Check connection status for a GitLab account (inner)
/// When `app` is Some, emits progress events via Tauri; when None (HTTP mode), skips events.
pub async fn check_connection_inner(
    app: Option<&AppHandle>,
    state: &SharedAppState,
    account_id: String,
) -> TauriResult<ConnectionStatusEvent> {
    // Emit checking status
    let checking_event = ConnectionStatusEvent {
        account_id: account_id.clone(),
        status: ConnectionStatus::Checking,
        error: None,
        latency_ms: None,
    };
    if let Some(app) = app {
        let _ = app.emit("connection:status", &checking_event);
    }

    // Get the account token
    let token = {
        let state_read = state.read().await;
        match state_read.credential_cache.get_token(&account_id) {
            Ok(Some(t)) => t,
            Ok(None) => {
                let event = ConnectionStatusEvent {
                    account_id: account_id.clone(),
                    status: ConnectionStatus::Error,
                    error: Some("No token found for account".to_string()),
                    latency_ms: None,
                };
                if let Some(app) = app {
                    let _ = app.emit("connection:status", &event);
                }
                return Ok(event);
            }
            Err(e) => {
                let event = ConnectionStatusEvent {
                    account_id: account_id.clone(),
                    status: ConnectionStatus::Error,
                    error: Some(format!("Failed to retrieve token: {}", e)),
                    latency_ms: None,
                };
                if let Some(app) = app {
                    let _ = app.emit("connection:status", &event);
                }
                return Ok(event);
            }
        }
    };

    // Get account instance URL from database
    let instance_url = {
        let state_read = state.read().await;
        sqlx::query_as::<_, (String,)>("SELECT instance_url FROM gitlab_accounts WHERE id = ?")
            .bind(&account_id)
            .fetch_optional(&state_read.db_pool)
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
            if let Some(app) = app {
                let _ = app.emit("connection:status", &event);
            }
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
            if let Some(app) = app {
                let _ = app.emit("connection:status", &event);
            }
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
            if let Some(app) = app {
                let _ = app.emit("connection:status", &event);
            }
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
            if let Some(app) = app {
                let _ = app.emit("connection:status", &event);
            }
            Ok(event)
        }
    }
}

/// Get the approval state for a merge request (inner)
pub async fn get_approval_state_inner(
    state: &SharedAppState,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApprovalState> {
    let (_account, client) = get_active_client(state).await?;

    let approval_state = client
        .get_approval_state(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Fetched approval state for MR {}: approved={}", mr_iid, approval_state.approved);
    Ok(approval_state)
}

/// Approve a merge request (inner)
pub async fn approve_mr_inner(
    state: &SharedAppState,
    project_id: i64,
    mr_iid: i64,
    sha: Option<String>,
) -> TauriResult<ApproveResponse> {
    let (_account, client) = get_active_client(state).await?;

    let response = client
        .approve_mr(project_id, mr_iid, sha)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Approved MR {} in project {}", mr_iid, project_id);
    Ok(response)
}

/// Remove approval from a merge request (inner)
pub async fn unapprove_mr_inner(
    state: &SharedAppState,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApproveResponse> {
    let (_account, client) = get_active_client(state).await?;

    let response = client
        .unapprove_mr(project_id, mr_iid)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Unapproved MR {} in project {}", mr_iid, project_id);
    Ok(response)
}

/// Fetch an avatar image through the authenticated GitLab client (inner)
pub async fn fetch_avatar_inner(
    state: &SharedAppState,
    avatar_url: String,
) -> TauriResult<Option<String>> {
    if avatar_url.is_empty() {
        return Ok(None);
    }

    let (_account, client) = get_active_client(state).await?;

    let instance_url = client.instance_url();
    info!("Avatar fetch requested: {} (instance: {})", avatar_url, instance_url);

    if !avatar_url.starts_with(instance_url) {
        info!("Skipping proxy - URL doesn't start with instance URL");
        return Ok(None);
    }

    let api_url = if let Some(caps) = extract_user_id_from_avatar_url(&avatar_url) {
        format!("{}/api/v4/users/{}/avatar", instance_url, caps)
    } else {
        avatar_url.clone()
    };

    info!("Proxying avatar fetch via: {}", api_url);

    match client.fetch_bytes(&api_url).await {
        Ok(bytes) => {
            use base64::Engine;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

            let mime_type = if avatar_url.ends_with(".png") || bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                "image/png"
            } else if avatar_url.ends_with(".gif") || bytes.starts_with(&[0x47, 0x49, 0x46]) {
                "image/gif"
            } else if avatar_url.ends_with(".webp") || bytes.starts_with(&[0x52, 0x49, 0x46, 0x46]) {
                "image/webp"
            } else {
                "image/jpeg"
            };

            Ok(Some(format!("data:{};base64,{}", mime_type, encoded)))
        }
        Err(e) => {
            warn!("Failed to fetch avatar {}: {}", avatar_url, e);
            Ok(None)
        }
    }
}

/// Reply to an existing discussion on a merge request (inner)
pub async fn reply_to_discussion_inner(
    state: &SharedAppState,
    request: ReplyToDiscussionRequest,
) -> TauriResult<Note> {
    let (_account, client) = get_active_client(state).await?;

    let note = client
        .reply_to_discussion(
            request.project_id,
            request.mr_iid,
            &request.discussion_id,
            &request.body,
        )
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!(
        "Replied to discussion {} on MR {}",
        request.discussion_id, request.mr_iid
    );
    Ok(note)
}

/// Resolve or unresolve a discussion on a merge request (inner)
pub async fn resolve_discussion_inner(
    state: &SharedAppState,
    request: ResolveDiscussionRequest,
) -> TauriResult<()> {
    let (_account, client) = get_active_client(state).await?;

    client
        .resolve_discussion(
            request.project_id,
            request.mr_iid,
            &request.discussion_id,
            request.resolved,
        )
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!(
        "Set discussion {} resolved={} on MR {}",
        request.discussion_id, request.resolved, request.mr_iid
    );
    Ok(())
}

/// Extract user ID from GitLab avatar URL
fn extract_user_id_from_avatar_url(url: &str) -> Option<String> {
    let parts: Vec<&str> = url.split('/').collect();
    for (i, part) in parts.iter().enumerate() {
        if *part == "avatar" && i > 0 && parts.get(i - 1) == Some(&"user") {
            if let Some(id) = parts.get(i + 1) {
                if id.chars().all(|c| c.is_ascii_digit()) {
                    return Some(id.to_string());
                }
            }
        }
    }
    None
}

// ============================================================================
// Tauri command wrappers
// ============================================================================

/// List all configured GitLab accounts
#[tauri::command]
pub async fn gitlab_list_accounts(state: State<'_, SharedAppState>) -> TauriResult<Vec<GitLabAccount>> {
    list_accounts_inner(&state).await
}

/// Add a new GitLab account
#[tauri::command]
pub async fn gitlab_add_account(
    state: State<'_, SharedAppState>,
    request: AddAccountRequest,
) -> TauriResult<GitLabAccount> {
    add_account_inner(&state, request).await
}

/// Remove a GitLab account
#[tauri::command]
pub async fn gitlab_remove_account(
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<()> {
    remove_account_inner(&state, account_id).await
}

/// Set the active GitLab account
#[tauri::command]
pub async fn gitlab_set_active_account(
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<()> {
    set_active_account_inner(&state, account_id).await
}

/// Validate a GitLab personal access token
#[tauri::command]
pub async fn gitlab_validate_token(
    request: ValidateTokenRequest,
) -> TauriResult<ValidateTokenResponse> {
    validate_token_inner(request).await
}

/// List merge requests for the active account
#[tauri::command]
pub async fn gitlab_list_merge_requests(
    state: State<'_, SharedAppState>,
    request: ListMergeRequestsRequest,
) -> TauriResult<ListMergeRequestsResponse> {
    list_merge_requests_inner(&state, request).await
}

/// Get full details for a single merge request
#[tauri::command]
pub async fn gitlab_get_merge_request(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<MergeRequest> {
    get_merge_request_inner(&state, project_id, mr_iid).await
}

/// Fetch the diff for a merge request
#[tauri::command]
pub async fn gitlab_get_diff(
    state: State<'_, SharedAppState>,
    request: GetDiffRequest,
) -> TauriResult<Diff> {
    get_diff_inner(&state, request).await
}

/// Fetch discussions/comments for a merge request
#[tauri::command]
pub async fn gitlab_get_discussions(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<Vec<Discussion>> {
    get_discussions_inner(&state, project_id, mr_iid).await
}

/// Post a comment or suggestion to a merge request
#[tauri::command]
pub async fn gitlab_post_comment(
    state: State<'_, SharedAppState>,
    request: PostCommentRequest,
) -> TauriResult<PostCommentResponse> {
    post_comment_inner(&state, request).await
}

/// Fetch raw file content at a specific commit SHA
#[tauri::command]
pub async fn gitlab_get_file_content(
    state: State<'_, SharedAppState>,
    project_id: i64,
    file_path: String,
    ref_sha: String,
) -> TauriResult<String> {
    get_file_content_inner(&state, project_id, file_path, ref_sha).await
}

/// Force refresh data from GitLab (bypass cache)
#[tauri::command]
pub async fn gitlab_refresh(
    state: State<'_, SharedAppState>,
    request: RefreshRequest,
) -> TauriResult<()> {
    refresh_inner(&state, request).await
}

/// Check connection status for a GitLab account
#[tauri::command]
pub async fn gitlab_check_connection(
    app: AppHandle,
    state: State<'_, SharedAppState>,
    account_id: String,
) -> TauriResult<ConnectionStatusEvent> {
    check_connection_inner(Some(&app), &state, account_id).await
}

/// Get the approval state for a merge request
#[tauri::command]
pub async fn gitlab_get_approval_state(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApprovalState> {
    get_approval_state_inner(&state, project_id, mr_iid).await
}

/// Approve a merge request
#[tauri::command]
pub async fn gitlab_approve_mr(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
    sha: Option<String>,
) -> TauriResult<ApproveResponse> {
    approve_mr_inner(&state, project_id, mr_iid, sha).await
}

/// Remove approval from a merge request
#[tauri::command]
pub async fn gitlab_unapprove_mr(
    state: State<'_, SharedAppState>,
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<ApproveResponse> {
    unapprove_mr_inner(&state, project_id, mr_iid).await
}

/// Fetch an avatar image through the authenticated GitLab client
#[tauri::command]
pub async fn gitlab_fetch_avatar(
    state: State<'_, SharedAppState>,
    avatar_url: String,
) -> TauriResult<Option<String>> {
    fetch_avatar_inner(&state, avatar_url).await
}

/// Reply to an existing discussion on a merge request
#[tauri::command]
pub async fn gitlab_reply_to_discussion(
    state: State<'_, SharedAppState>,
    request: ReplyToDiscussionRequest,
) -> TauriResult<Note> {
    reply_to_discussion_inner(&state, request).await
}

/// Resolve or unresolve a discussion on a merge request
#[tauri::command]
pub async fn gitlab_resolve_discussion(
    state: State<'_, SharedAppState>,
    request: ResolveDiscussionRequest,
) -> TauriResult<()> {
    resolve_discussion_inner(&state, request).await
}
