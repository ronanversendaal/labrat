//! Merge request API operations
//!
//! This module provides wrappers for merge request-related GitLab API endpoints.

use super::client::{GitLabClient, GitLabClientError};
use super::types::{ApprovalState, ApproveResponse, MergeRequest, MergeRequestFilter, MergeRequestState};
use tracing::debug;

/// Default number of items per page for pagination
const DEFAULT_PER_PAGE: u32 = 100;

impl GitLabClient {
    /// Get all merge requests assigned to the current user (as reviewer or assignee)
    ///
    /// This combines MRs where the user is a reviewer with MRs where they are assigned
    pub async fn get_assigned_merge_requests(&self) -> Result<Vec<MergeRequest>, GitLabClientError> {
        // Get current user ID for reviewer query (some GitLab versions don't support "self")
        let current_user = self.get_current_user().await?;
        let user_id = current_user.id;

        // Fetch MRs where the current user is assigned
        let path = "/merge_requests?scope=assigned_to_me&state=opened";
        debug!("Fetching assigned MRs: {}", path);
        let assigned: Vec<MergeRequest> = self.get_all_pages(path, DEFAULT_PER_PAGE).await?;

        // Fetch MRs where the current user is a reviewer (use numeric ID for compatibility)
        let review_path = format!("/merge_requests?scope=all&reviewer_id={}&state=opened", user_id);
        debug!("Fetching review MRs: {}", review_path);
        let for_review: Vec<MergeRequest> = self.get_all_pages(&review_path, DEFAULT_PER_PAGE).await?;

        // Merge and deduplicate by ID
        let mut all_mrs = assigned;
        let existing_ids: std::collections::HashSet<_> = all_mrs.iter().map(|mr| mr.id).collect();

        for mr in for_review {
            if !existing_ids.contains(&mr.id) {
                all_mrs.push(mr);
            }
        }

        Ok(all_mrs)
    }

    /// List merge requests assigned to the current user for review
    ///
    /// GET /merge_requests?reviewer_username={username}&state=opened
    pub async fn list_merge_requests_for_review(
        &self,
        username: &str,
    ) -> Result<Vec<MergeRequest>, GitLabClientError> {
        let path = format!(
            "/merge_requests?reviewer_username={}&state=opened&scope=all",
            urlencoding::encode(username)
        );
        debug!("Fetching MRs for review: {}", path);

        self.get_all_pages(&path, DEFAULT_PER_PAGE).await
    }

    /// List merge requests authored by the current user
    ///
    /// GET /merge_requests?author_username={username}&state=opened
    pub async fn list_authored_merge_requests(
        &self,
        username: &str,
    ) -> Result<Vec<MergeRequest>, GitLabClientError> {
        let path = format!(
            "/merge_requests?author_username={}&state=opened&scope=all",
            urlencoding::encode(username)
        );
        debug!("Fetching authored MRs: {}", path);

        self.get_all_pages(&path, DEFAULT_PER_PAGE).await
    }

    /// List merge requests with optional filters
    ///
    /// GET /merge_requests with query parameters
    pub async fn list_merge_requests(
        &self,
        filter: Option<&MergeRequestFilter>,
    ) -> Result<Vec<MergeRequest>, GitLabClientError> {
        let mut params = Vec::new();
        params.push("scope=all".to_string());

        if let Some(f) = filter {
            if let Some(state) = &f.state {
                params.push(format!("state={}", state));
            } else {
                params.push("state=opened".to_string());
            }

            if let Some(project_id) = f.project_id {
                // Use project-specific endpoint for better performance
                return self.list_project_merge_requests(project_id, filter).await;
            }

            if let Some(author) = &f.author_username {
                params.push(format!("author_username={}", urlencoding::encode(author)));
            }

            if let Some(labels) = &f.labels {
                if !labels.is_empty() {
                    params.push(format!("labels={}", labels.join(",")));
                }
            }
        } else {
            params.push("state=opened".to_string());
        }

        let path = format!("/merge_requests?{}", params.join("&"));
        debug!("Fetching MRs: {}", path);

        let mut mrs: Vec<MergeRequest> = self.get_all_pages(&path, DEFAULT_PER_PAGE).await?;

        // Apply client-side filters that GitLab API doesn't support directly
        if let Some(f) = filter {
            mrs = self.apply_client_side_filters(mrs, f);
        }

        Ok(mrs)
    }

    /// List merge requests for a specific project
    ///
    /// GET /projects/{id}/merge_requests
    pub async fn list_project_merge_requests(
        &self,
        project_id: i64,
        filter: Option<&MergeRequestFilter>,
    ) -> Result<Vec<MergeRequest>, GitLabClientError> {
        let mut params = Vec::new();

        if let Some(f) = filter {
            if let Some(state) = &f.state {
                params.push(format!("state={}", state));
            } else {
                params.push("state=opened".to_string());
            }

            if let Some(author) = &f.author_username {
                params.push(format!("author_username={}", urlencoding::encode(author)));
            }

            if let Some(labels) = &f.labels {
                if !labels.is_empty() {
                    params.push(format!("labels={}", labels.join(",")));
                }
            }
        } else {
            params.push("state=opened".to_string());
        }

        let path = if params.is_empty() {
            format!("/projects/{}/merge_requests", project_id)
        } else {
            format!("/projects/{}/merge_requests?{}", project_id, params.join("&"))
        };

        debug!("Fetching project MRs: {}", path);

        let mut mrs: Vec<MergeRequest> = self.get_all_pages(&path, DEFAULT_PER_PAGE).await?;

        // Apply client-side filters
        if let Some(f) = filter {
            mrs = self.apply_client_side_filters(mrs, f);
        }

        Ok(mrs)
    }

    /// Get a single merge request by project and IID
    ///
    /// GET /projects/{id}/merge_requests/{merge_request_iid}
    pub async fn get_merge_request(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<MergeRequest, GitLabClientError> {
        let path = format!("/projects/{}/merge_requests/{}", project_id, mr_iid);
        debug!("Fetching MR: {}", path);

        self.get(&path).await
    }

    /// Apply client-side filters that the GitLab API doesn't support
    fn apply_client_side_filters(
        &self,
        mrs: Vec<MergeRequest>,
        filter: &MergeRequestFilter,
    ) -> Vec<MergeRequest> {
        mrs.into_iter()
            .filter(|mr| {
                // Filter by has_conflicts
                if let Some(has_conflicts) = filter.has_conflicts {
                    if mr.has_conflicts != has_conflicts {
                        return false;
                    }
                }

                // Filter by pipeline_failed
                if let Some(pipeline_failed) = filter.pipeline_failed {
                    let is_failed = mr
                        .head_pipeline
                        .as_ref()
                        .map(|p| p.status == super::types::PipelineStatus::Failed)
                        .unwrap_or(false);
                    if is_failed != pipeline_failed {
                        return false;
                    }
                }

                // Filter by is_draft
                if let Some(is_draft) = filter.is_draft {
                    if mr.draft != is_draft {
                        return false;
                    }
                }

                true
            })
            .collect()
    }

    /// Search merge requests by text (title/description)
    pub fn search_merge_requests(
        &self,
        mrs: Vec<MergeRequest>,
        query: &str,
    ) -> Vec<MergeRequest> {
        if query.is_empty() {
            return mrs;
        }

        let query_lower = query.to_lowercase();
        mrs.into_iter()
            .filter(|mr| {
                mr.title.to_lowercase().contains(&query_lower)
                    || mr
                        .description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&query_lower))
                        .unwrap_or(false)
            })
            .collect()
    }

    /// Get the approval state for a merge request
    ///
    /// GET /projects/{id}/merge_requests/{mr_iid}/approval_state
    pub async fn get_approval_state(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<ApprovalState, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/approval_state",
            project_id, mr_iid
        );
        debug!("Fetching approval state: {}", path);

        self.get(&path).await
    }

    /// Approve a merge request
    ///
    /// POST /projects/{id}/merge_requests/{mr_iid}/approve
    pub async fn approve_mr(
        &self,
        project_id: i64,
        mr_iid: i64,
        sha: Option<String>,
    ) -> Result<ApproveResponse, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/approve",
            project_id, mr_iid
        );
        debug!("Approving MR: {}", path);

        let body = match sha {
            Some(s) => serde_json::json!({ "sha": s }),
            None => serde_json::json!({}),
        };
        self.post(&path, &body).await
    }

    /// Remove approval from a merge request
    ///
    /// POST /projects/{id}/merge_requests/{mr_iid}/unapprove
    pub async fn unapprove_mr(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<ApproveResponse, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/unapprove",
            project_id, mr_iid
        );
        debug!("Unapproving MR: {}", path);

        let body = serde_json::json!({});
        self.post(&path, &body).await
    }
}

/// Build query string for MR state
impl MergeRequestState {
    pub fn to_query_param(&self) -> &'static str {
        match self {
            MergeRequestState::Opened => "opened",
            MergeRequestState::Closed => "closed",
            MergeRequestState::Merged => "merged",
            MergeRequestState::All => "all",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_to_query_param() {
        assert_eq!(MergeRequestState::Opened.to_query_param(), "opened");
        assert_eq!(MergeRequestState::Merged.to_query_param(), "merged");
    }
}
