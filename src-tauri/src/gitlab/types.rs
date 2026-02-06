//! GitLab API response types
//!
//! This module defines all types used for GitLab API responses
//! and internal representations of GitLab entities.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A GitLab account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabAccount {
    pub id: String,
    pub name: String,
    pub instance_url: String,
    pub username: String,
    pub user_id: i64,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
}

/// A GitLab project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub account_id: String,
    pub path_with_namespace: String,
    pub name: String,
    pub web_url: String,
    pub avatar_url: Option<String>,
    pub last_activity_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_at: Option<DateTime<Utc>>,
}

/// A user/author in GitLab
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub web_url: String,
}

/// A milestone in GitLab
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: i64,
    pub iid: i64,
    pub title: String,
    pub state: String,
    pub due_date: Option<String>,
}

/// Pipeline status values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PipelineStatus {
    Pending,
    Running,
    Success,
    Failed,
    Canceled,
    Skipped,
    Manual,
    Scheduled,
    Created,
}

impl std::fmt::Display for PipelineStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineStatus::Pending => write!(f, "pending"),
            PipelineStatus::Running => write!(f, "running"),
            PipelineStatus::Success => write!(f, "success"),
            PipelineStatus::Failed => write!(f, "failed"),
            PipelineStatus::Canceled => write!(f, "canceled"),
            PipelineStatus::Skipped => write!(f, "skipped"),
            PipelineStatus::Manual => write!(f, "manual"),
            PipelineStatus::Scheduled => write!(f, "scheduled"),
            PipelineStatus::Created => write!(f, "created"),
        }
    }
}

/// Merge request state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MergeRequestState {
    Opened,
    Closed,
    Merged,
    All,
}

impl std::fmt::Display for MergeRequestState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MergeRequestState::Opened => write!(f, "opened"),
            MergeRequestState::Closed => write!(f, "closed"),
            MergeRequestState::Merged => write!(f, "merged"),
            MergeRequestState::All => write!(f, "all"),
        }
    }
}

/// A merge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub id: i64,
    pub iid: i64,
    pub project_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub state: MergeRequestState,
    pub source_branch: String,
    pub target_branch: String,
    pub author: Author,
    #[serde(default)]
    pub assignees: Vec<Author>,
    #[serde(default)]
    pub reviewers: Vec<Author>,
    #[serde(default)]
    pub labels: Vec<String>,
    pub milestone: Option<Milestone>,
    pub web_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,
    pub has_conflicts: bool,
    pub head_pipeline: Option<Pipeline>,
    pub draft: bool,
    pub blocking_discussions_resolved: bool,
    pub user_notes_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub diff_cached: bool,
}

impl MergeRequest {
    /// Extract project path from web_url if project_path is not set
    /// web_url format: https://gitlab.example.com/namespace/project/-/merge_requests/1
    pub fn with_extracted_project_path(mut self) -> Self {
        if self.project_path.is_none() {
            if let Some(path) = extract_project_path_from_url(&self.web_url) {
                self.project_path = Some(path.clone());
                // Extract just the project name (last segment)
                if self.project_name.is_none() {
                    self.project_name = path.rsplit('/').next().map(String::from);
                }
            }
        }
        self
    }
}

/// Extract project path from GitLab MR web_url
/// web_url format: https://gitlab.example.com/namespace/project/-/merge_requests/1
fn extract_project_path_from_url(url: &str) -> Option<String> {
    // Find the /-/merge_requests pattern
    let mr_marker = "/-/merge_requests/";
    if let Some(mr_idx) = url.find(mr_marker) {
        // Get the part before /-/merge_requests/
        let path_part = &url[..mr_idx];
        // Find the domain end (after https://domain/)
        if let Some(scheme_end) = path_part.find("://") {
            let after_scheme = &path_part[scheme_end + 3..];
            // Find the first slash after the domain
            if let Some(domain_end) = after_scheme.find('/') {
                let project_path = &after_scheme[domain_end + 1..];
                if !project_path.is_empty() {
                    return Some(project_path.to_string());
                }
            }
        }
    }
    None
}

/// Pipeline information (simplified)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub id: i64,
    pub status: PipelineStatus,
    pub web_url: String,
}

/// A diff for a merge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diff {
    pub mr_id: i64,
    pub base_commit_sha: String,
    pub head_commit_sha: String,
    pub start_commit_sha: String,
    pub files: Vec<DiffFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_at: Option<DateTime<Utc>>,
}

impl Diff {
    /// Calculate total additions across all files
    pub fn total_additions(&self) -> i32 {
        self.files.iter().map(|f| f.additions).sum()
    }

    /// Calculate total deletions across all files
    pub fn total_deletions(&self) -> i32 {
        self.files.iter().map(|f| f.deletions).sum()
    }
}

/// A single file in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffFile {
    pub old_path: String,
    pub new_path: String,
    pub diff: String,
    pub new_file: bool,
    pub renamed_file: bool,
    pub deleted_file: bool,
    #[serde(default)]
    pub generated_file: bool,
    #[serde(default)]
    pub additions: i32,
    #[serde(default)]
    pub deletions: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted_lines: Option<Vec<HighlightedLine>>,
}

/// A highlighted line in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightedLine {
    pub line_type: LineType,
    pub old_line: Option<i32>,
    pub new_line: Option<i32>,
    pub content: String,
    pub html: String,
}

/// Type of diff line
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineType {
    Context,
    Addition,
    Deletion,
    Header,
}

/// A discussion on a merge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Discussion {
    pub id: String,
    pub notes: Vec<Note>,
    pub individual_note: bool,
}

/// A note (comment) in a discussion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub discussion_id: String,
    pub author: Author,
    pub body: String,
    #[serde(default)]
    pub body_html: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub resolved: bool,
    #[serde(default)]
    pub resolvable: bool,
    pub position: Option<DiffPosition>,
}

/// Position of a comment in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffPosition {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub old_line: Option<i32>,
    pub new_line: Option<i32>,
    pub position_type: PositionType,
}

/// Type of position in a diff
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PositionType {
    Text,
    Image,
    File,
}

/// Request to validate a GitLab token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateTokenRequest {
    pub instance_url: String,
    pub access_token: String,
}

/// Response from token validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateTokenResponse {
    pub valid: bool,
    pub username: Option<String>,
    pub user_id: Option<i64>,
    pub scopes: Vec<String>,
    pub error: Option<String>,
}

/// Request to add a GitLab account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddAccountRequest {
    pub name: String,
    pub instance_url: String,
    pub access_token: String,
}

/// Filter options for listing merge requests
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MergeRequestFilter {
    pub project_id: Option<i64>,
    pub author_username: Option<String>,
    pub labels: Option<Vec<String>>,
    pub state: Option<MergeRequestState>,
    pub has_conflicts: Option<bool>,
    pub pipeline_failed: Option<bool>,
    pub is_draft: Option<bool>,
}

/// Sort options for listing merge requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequestSort {
    pub field: MergeRequestSortField,
    pub direction: SortDirection,
}

/// Fields available for sorting merge requests
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MergeRequestSortField {
    CreatedAt,
    UpdatedAt,
    Title,
}

/// Sort direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}

/// Request to list merge requests
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ListMergeRequestsRequest {
    pub filter: Option<MergeRequestFilter>,
    pub sort: Option<MergeRequestSort>,
    pub search: Option<String>,
    #[serde(default = "default_true")]
    pub use_cache: bool,
    /// When true, fetch approval states for all returned MRs in parallel on the backend
    #[serde(default)]
    pub include_approvals: bool,
}

fn default_true() -> bool {
    true
}

/// Response from listing merge requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListMergeRequestsResponse {
    pub merge_requests: Vec<MergeRequest>,
    pub from_cache: bool,
    pub cached_at: Option<DateTime<Utc>>,
    /// Approval states keyed by MR id, populated when `include_approvals` is true
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approval_states: Option<std::collections::HashMap<i64, ApprovalState>>,
}

/// Request to get a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDiffRequest {
    pub project_id: i64,
    pub mr_iid: i64,
    #[serde(default = "default_true")]
    pub use_cache: bool,
}

/// Request to post a comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostCommentRequest {
    pub project_id: i64,
    pub mr_iid: i64,
    pub body: String,
    pub position: Option<CommentPosition>,
    #[serde(default)]
    pub as_suggestion: bool,
}

/// Position for a comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentPosition {
    pub base_sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_sha: Option<String>,
    pub head_sha: String,
    pub old_path: Option<String>,
    pub new_path: String,
    pub old_line: Option<i32>,
    pub new_line: i32,
    pub position_type: PositionType,
}

/// Response from posting a comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostCommentResponse {
    pub discussion_id: String,
    pub note_id: i64,
    pub web_url: String,
}

/// Request to refresh data
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RefreshRequest {
    #[serde(default)]
    pub merge_requests: bool,
    #[serde(default)]
    pub projects: bool,
    pub specific_mr: Option<SpecificMr>,
}

/// Specific MR to refresh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecificMr {
    pub project_id: i64,
    pub mr_iid: i64,
}

/// Connection status for a GitLab account
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Checking,
    Error,
}

/// Connection status event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatusEvent {
    pub account_id: String,
    pub status: ConnectionStatus,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
}

/// A user who has approved an MR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Approver {
    pub user: ApproverUser,
    #[serde(default)]
    pub approved_at: Option<String>,
}

/// User info within an Approver
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproverUser {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

/// Approval state for a merge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalState {
    /// Whether the MR is fully approved
    #[serde(default)]
    pub approved: bool,
    /// List of users who have approved
    #[serde(default)]
    pub approved_by: Vec<Approver>,
    /// Total approvals required
    #[serde(default)]
    pub approvals_required: i32,
    /// Approvals still needed
    #[serde(default)]
    pub approvals_left: i32,
    /// Whether current user has approved (computed client-side, not from API)
    #[serde(default)]
    pub user_has_approved: bool,
    /// Whether current user can approve (computed client-side, not from API)
    #[serde(default = "default_can_approve")]
    pub user_can_approve: bool,
}

fn default_can_approve() -> bool {
    true // Default to true, will be computed correctly on frontend
}

/// Response from approve/unapprove actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveResponse {
    pub approved: bool,
    pub approvals_required: i32,
    pub approvals_left: i32,
}

/// Request to reply to an existing discussion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyToDiscussionRequest {
    pub project_id: i64,
    pub mr_iid: i64,
    pub discussion_id: String,
    pub body: String,
}

/// Request to resolve or unresolve a discussion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveDiscussionRequest {
    pub project_id: i64,
    pub mr_iid: i64,
    pub discussion_id: String,
    pub resolved: bool,
}
