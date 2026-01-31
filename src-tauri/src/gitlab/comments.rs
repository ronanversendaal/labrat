//! Comment and discussion operations
//!
//! This module provides wrappers for discussion/comment-related GitLab API endpoints.

use super::client::{GitLabClient, GitLabClientError};
use super::types::{Author, DiffPosition, Discussion, Note, PositionType};
use serde::{Deserialize, Serialize};
use tracing::debug;

/// Raw discussion response from GitLab API
#[derive(Debug, Clone, Deserialize)]
struct GitLabDiscussion {
    id: String,
    notes: Vec<GitLabNote>,
    individual_note: bool,
}

/// Raw note response from GitLab API
#[derive(Debug, Clone, Deserialize)]
struct GitLabNote {
    id: i64,
    author: GitLabAuthor,
    body: String,
    #[serde(default)]
    body_html: String,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    resolvable: bool,
    #[serde(default)]
    resolved: bool,
    position: Option<GitLabPosition>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitLabAuthor {
    id: i64,
    username: String,
    name: String,
    avatar_url: Option<String>,
    web_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GitLabPosition {
    old_path: Option<String>,
    new_path: Option<String>,
    old_line: Option<i32>,
    new_line: Option<i32>,
    position_type: String,
}

/// Request body for creating a discussion
#[derive(Debug, Serialize)]
struct CreateDiscussionRequest {
    body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    position: Option<PositionRequest>,
}

#[derive(Debug, Serialize)]
struct PositionRequest {
    base_sha: String,
    head_sha: String,
    start_sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_path: Option<String>,
    new_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_line: Option<i32>,
    new_line: i32,
    position_type: String,
}

impl GitLabClient {
    /// Get discussions for a merge request
    ///
    /// GET /projects/{id}/merge_requests/{merge_request_iid}/discussions
    pub async fn get_merge_request_discussions(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<Vec<Discussion>, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/discussions",
            project_id, mr_iid
        );
        debug!("Fetching MR discussions: {}", path);

        let discussions: Vec<GitLabDiscussion> = self.get_all_pages(&path, 100).await?;

        Ok(discussions
            .into_iter()
            .map(|d| Discussion {
                id: d.id.clone(),
                individual_note: d.individual_note,
                notes: d
                    .notes
                    .into_iter()
                    .map(|n| Note {
                        id: n.id,
                        discussion_id: d.id.clone(),
                        author: Author {
                            id: n.author.id,
                            username: n.author.username,
                            name: n.author.name,
                            avatar_url: n.author.avatar_url,
                            web_url: n.author.web_url,
                        },
                        body: n.body,
                        body_html: n.body_html,
                        created_at: n.created_at.parse().unwrap_or_default(),
                        updated_at: n.updated_at.parse().unwrap_or_default(),
                        resolvable: n.resolvable,
                        resolved: n.resolved,
                        position: n.position.map(|p| DiffPosition {
                            old_path: p.old_path,
                            new_path: p.new_path,
                            old_line: p.old_line,
                            new_line: p.new_line,
                            position_type: match p.position_type.as_str() {
                                "image" => PositionType::Image,
                                "file" => PositionType::File,
                                _ => PositionType::Text,
                            },
                        }),
                    })
                    .collect(),
            })
            .collect())
    }

    /// Post a comment to a merge request
    ///
    /// POST /projects/{id}/merge_requests/{merge_request_iid}/discussions
    pub async fn post_discussion(
        &self,
        project_id: i64,
        mr_iid: i64,
        body: &str,
        position: Option<PositionData>,
    ) -> Result<Discussion, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/discussions",
            project_id, mr_iid
        );
        debug!("Posting MR discussion: {}", path);

        let request = CreateDiscussionRequest {
            body: body.to_string(),
            position: position.map(|p| PositionRequest {
                base_sha: p.base_sha,
                head_sha: p.head_sha,
                start_sha: p.start_sha,
                old_path: p.old_path,
                new_path: p.new_path,
                old_line: p.old_line,
                new_line: p.new_line,
                position_type: match p.position_type {
                    PositionType::Image => "image".to_string(),
                    PositionType::File => "file".to_string(),
                    PositionType::Text => "text".to_string(),
                },
            }),
        };

        let response: GitLabDiscussion = self.post(&path, &request).await?;

        Ok(Discussion {
            id: response.id.clone(),
            individual_note: response.individual_note,
            notes: response
                .notes
                .into_iter()
                .map(|n| Note {
                    id: n.id,
                    discussion_id: response.id.clone(),
                    author: Author {
                        id: n.author.id,
                        username: n.author.username,
                        name: n.author.name,
                        avatar_url: n.author.avatar_url,
                        web_url: n.author.web_url,
                    },
                    body: n.body,
                    body_html: n.body_html,
                    created_at: n.created_at.parse().unwrap_or_default(),
                    updated_at: n.updated_at.parse().unwrap_or_default(),
                    resolvable: n.resolvable,
                    resolved: n.resolved,
                    position: n.position.map(|p| DiffPosition {
                        old_path: p.old_path,
                        new_path: p.new_path,
                        old_line: p.old_line,
                        new_line: p.new_line,
                        position_type: match p.position_type.as_str() {
                            "image" => PositionType::Image,
                            "file" => PositionType::File,
                            _ => PositionType::Text,
                        },
                    }),
                })
                .collect(),
        })
    }

    /// Reply to an existing discussion
    ///
    /// POST /projects/{id}/merge_requests/{merge_request_iid}/discussions/{discussion_id}/notes
    pub async fn reply_to_discussion(
        &self,
        project_id: i64,
        mr_iid: i64,
        discussion_id: &str,
        body: &str,
    ) -> Result<Note, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/discussions/{}/notes",
            project_id, mr_iid, discussion_id
        );
        debug!("Replying to discussion: {}", path);

        #[derive(Serialize)]
        struct ReplyRequest {
            body: String,
        }

        let request = ReplyRequest {
            body: body.to_string(),
        };

        let response: GitLabNote = self.post(&path, &request).await?;

        Ok(Note {
            id: response.id,
            discussion_id: discussion_id.to_string(),
            author: Author {
                id: response.author.id,
                username: response.author.username,
                name: response.author.name,
                avatar_url: response.author.avatar_url,
                web_url: response.author.web_url,
            },
            body: response.body,
            body_html: response.body_html,
            created_at: response.created_at.parse().unwrap_or_default(),
            updated_at: response.updated_at.parse().unwrap_or_default(),
            resolvable: response.resolvable,
            resolved: response.resolved,
            position: response.position.map(|p| DiffPosition {
                old_path: p.old_path,
                new_path: p.new_path,
                old_line: p.old_line,
                new_line: p.new_line,
                position_type: match p.position_type.as_str() {
                    "image" => PositionType::Image,
                    "file" => PositionType::File,
                    _ => PositionType::Text,
                },
            }),
        })
    }

    /// Resolve or unresolve a discussion
    ///
    /// PUT /projects/{id}/merge_requests/{merge_request_iid}/discussions/{discussion_id}
    pub async fn resolve_discussion(
        &self,
        project_id: i64,
        mr_iid: i64,
        discussion_id: &str,
        resolved: bool,
    ) -> Result<(), GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/discussions/{}",
            project_id, mr_iid, discussion_id
        );
        debug!("Resolving discussion: {} -> {}", path, resolved);

        #[derive(Serialize)]
        struct ResolveRequest {
            resolved: bool,
        }

        let request = ResolveRequest { resolved };
        let _: serde_json::Value = self.put(&path, &request).await?;

        Ok(())
    }
}

/// Position data for creating a line comment
pub struct PositionData {
    pub base_sha: String,
    pub head_sha: String,
    pub start_sha: String,
    pub old_path: Option<String>,
    pub new_path: String,
    pub old_line: Option<i32>,
    pub new_line: i32,
    pub position_type: PositionType,
}

/// Format a code suggestion in GitLab's suggestion block format
pub fn format_code_suggestion(_original_code: &str, suggested_code: &str, context: Option<&str>) -> String {
    let mut result = String::new();

    if let Some(ctx) = context {
        result.push_str(ctx);
        result.push_str("\n\n");
    }

    result.push_str("```suggestion\n");
    result.push_str(suggested_code);
    if !suggested_code.ends_with('\n') {
        result.push('\n');
    }
    result.push_str("```");

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_code_suggestion() {
        let original = "let x = 1;";
        let suggested = "const x = 1;";

        let result = format_code_suggestion(original, suggested, Some("Consider using const"));

        assert!(result.contains("Consider using const"));
        assert!(result.contains("```suggestion"));
        assert!(result.contains("const x = 1;"));
        assert!(result.contains("```"));
    }

    #[test]
    fn test_format_code_suggestion_no_context() {
        let result = format_code_suggestion("old", "new", None);

        assert!(!result.contains("\n\n```"));
        assert!(result.starts_with("```suggestion"));
    }
}
