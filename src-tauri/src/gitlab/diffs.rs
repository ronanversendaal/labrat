//! Diff retrieval and parsing
//!
//! This module provides wrappers for diff-related GitLab API endpoints.

use super::client::{GitLabClient, GitLabClientError};
use super::types::{Diff, DiffFile};
use serde::Deserialize;
use tracing::debug;

/// Raw diff response from GitLab API
#[derive(Debug, Deserialize)]
struct ChangesResponse {
    diff_refs: Option<DiffRefs>,
    changes: Vec<GitLabDiffFile>,
}

#[derive(Debug, Deserialize)]
struct DiffRefs {
    base_sha: String,
    head_sha: String,
    start_sha: String,
}

#[derive(Debug, Deserialize)]
struct GitLabDiffFile {
    old_path: String,
    new_path: String,
    diff: String,
    new_file: bool,
    renamed_file: bool,
    deleted_file: bool,
    #[serde(default)]
    generated_file: bool,
}

impl GitLabClient {
    /// Get the diff/changes for a merge request
    ///
    /// GET /projects/{id}/merge_requests/{merge_request_iid}/changes
    pub async fn get_merge_request_diff(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<Diff, GitLabClientError> {
        let path = format!(
            "/projects/{}/merge_requests/{}/changes",
            project_id, mr_iid
        );
        debug!("Fetching MR diff: {}", path);

        let response: ChangesResponse = self.get(&path).await?;

        let diff_refs = response.diff_refs.unwrap_or(DiffRefs {
            base_sha: String::new(),
            head_sha: String::new(),
            start_sha: String::new(),
        });

        let files: Vec<DiffFile> = response
            .changes
            .into_iter()
            .map(|f| {
                let (additions, deletions) = count_diff_lines(&f.diff);
                DiffFile {
                    old_path: f.old_path,
                    new_path: f.new_path,
                    diff: f.diff,
                    new_file: f.new_file,
                    renamed_file: f.renamed_file,
                    deleted_file: f.deleted_file,
                    generated_file: f.generated_file,
                    additions,
                    deletions,
                    highlighted_lines: None, // Will be populated by syntax highlighter
                }
            })
            .collect();

        Ok(Diff {
            mr_id: mr_iid,
            base_commit_sha: diff_refs.base_sha,
            head_commit_sha: diff_refs.head_sha,
            start_commit_sha: diff_refs.start_sha,
            files,
            cached_at: None,
        })
    }

    /// Get the raw diff for a merge request (plain text format)
    ///
    /// GET /projects/{id}/merge_requests/{merge_request_iid}/diffs
    pub async fn get_merge_request_diffs_raw(
        &self,
        project_id: i64,
        mr_iid: i64,
    ) -> Result<Vec<DiffFile>, GitLabClientError> {
        let path = format!("/projects/{}/merge_requests/{}/diffs", project_id, mr_iid);
        debug!("Fetching MR diffs: {}", path);

        let files: Vec<GitLabDiffFile> = self.get(&path).await?;

        Ok(files
            .into_iter()
            .map(|f| {
                let (additions, deletions) = count_diff_lines(&f.diff);
                DiffFile {
                    old_path: f.old_path,
                    new_path: f.new_path,
                    diff: f.diff,
                    new_file: f.new_file,
                    renamed_file: f.renamed_file,
                    deleted_file: f.deleted_file,
                    generated_file: f.generated_file,
                    additions,
                    deletions,
                    highlighted_lines: None,
                }
            })
            .collect())
    }

    /// Get the raw content of a file at a specific commit ref
    ///
    /// GET /projects/{id}/repository/files/{file_path}/raw?ref={ref}
    pub async fn get_file_content(
        &self,
        project_id: i64,
        file_path: &str,
        ref_sha: &str,
    ) -> Result<String, GitLabClientError> {
        let encoded_path = urlencoding::encode(file_path);
        let path = format!(
            "/projects/{}/repository/files/{}/raw?ref={}",
            project_id, encoded_path, ref_sha
        );
        debug!("Fetching file content: {}", path);

        self.get_text(&path).await
    }
}

/// Count additions and deletions from a unified diff string
fn count_diff_lines(diff: &str) -> (i32, i32) {
    let mut additions = 0;
    let mut deletions = 0;

    for line in diff.lines() {
        if line.starts_with('+') && !line.starts_with("+++") {
            additions += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            deletions += 1;
        }
    }

    (additions, deletions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_diff_lines() {
        let diff = r#"--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 unchanged
-removed line
+added line
+another addition
"#;
        let (additions, deletions) = count_diff_lines(diff);
        assert_eq!(additions, 2);
        assert_eq!(deletions, 1);
    }

    #[test]
    fn test_count_diff_lines_empty() {
        let (additions, deletions) = count_diff_lines("");
        assert_eq!(additions, 0);
        assert_eq!(deletions, 0);
    }
}
