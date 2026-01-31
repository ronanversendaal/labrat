//! GitLab-related Tauri commands
//!
//! This module contains all GitLab-related IPC commands.

use crate::gitlab::types::{
    AddAccountRequest, GetDiffRequest, GitLabAccount, ListMergeRequestsRequest,
    ListMergeRequestsResponse, MergeRequest, PostCommentRequest, PostCommentResponse,
    RefreshRequest, ValidateTokenRequest, ValidateTokenResponse,
};
use crate::TauriResult;

/// List all configured GitLab accounts
#[tauri::command]
pub async fn gitlab_list_accounts() -> TauriResult<Vec<GitLabAccount>> {
    // TODO: Implement account listing from database
    Ok(vec![])
}

/// Add a new GitLab account
#[tauri::command]
pub async fn gitlab_add_account(request: AddAccountRequest) -> TauriResult<GitLabAccount> {
    // TODO: Implement account addition with token validation
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_add_account not yet implemented",
    ))
}

/// Remove a GitLab account
#[tauri::command]
pub async fn gitlab_remove_account(account_id: String) -> TauriResult<()> {
    // TODO: Implement account removal
    let _ = account_id;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_remove_account not yet implemented",
    ))
}

/// Set the active GitLab account
#[tauri::command]
pub async fn gitlab_set_active_account(account_id: String) -> TauriResult<()> {
    // TODO: Implement setting active account
    let _ = account_id;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_set_active_account not yet implemented",
    ))
}

/// Validate a GitLab personal access token
#[tauri::command]
pub async fn gitlab_validate_token(
    request: ValidateTokenRequest,
) -> TauriResult<ValidateTokenResponse> {
    // TODO: Implement token validation
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_validate_token not yet implemented",
    ))
}

/// List merge requests for the active account
#[tauri::command]
pub async fn gitlab_list_merge_requests(
    request: ListMergeRequestsRequest,
) -> TauriResult<ListMergeRequestsResponse> {
    // TODO: Implement MR listing
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_list_merge_requests not yet implemented",
    ))
}

/// Get full details for a single merge request
#[tauri::command]
pub async fn gitlab_get_merge_request(
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<MergeRequest> {
    // TODO: Implement MR details fetching
    let _ = (project_id, mr_iid);
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_get_merge_request not yet implemented",
    ))
}

/// Fetch the diff for a merge request
#[tauri::command]
pub async fn gitlab_get_diff(request: GetDiffRequest) -> TauriResult<crate::gitlab::types::Diff> {
    // TODO: Implement diff fetching
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_get_diff not yet implemented",
    ))
}

/// Fetch discussions/comments for a merge request
#[tauri::command]
pub async fn gitlab_get_discussions(
    project_id: i64,
    mr_iid: i64,
) -> TauriResult<Vec<crate::gitlab::types::Discussion>> {
    // TODO: Implement discussions fetching
    let _ = (project_id, mr_iid);
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_get_discussions not yet implemented",
    ))
}

/// Post a comment or suggestion to a merge request
#[tauri::command]
pub async fn gitlab_post_comment(request: PostCommentRequest) -> TauriResult<PostCommentResponse> {
    // TODO: Implement comment posting
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_post_comment not yet implemented",
    ))
}

/// Force refresh data from GitLab (bypass cache)
#[tauri::command]
pub async fn gitlab_refresh(request: RefreshRequest) -> TauriResult<()> {
    // TODO: Implement data refresh
    let _ = request;
    Err(crate::TauriError::new(
        "not_implemented",
        "gitlab_refresh not yet implemented",
    ))
}
