//! Merge request metadata caching
//!
//! This module handles caching of merge request data in SQLite.

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use tracing::{debug, warn};

use crate::gitlab::types::{Author, MergeRequest, MergeRequestState, Milestone, Pipeline};

/// Error type for MR cache operations
#[derive(Debug, thiserror::Error)]
pub enum MrCacheError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

/// MR cache operations
pub struct MrCache;

impl MrCache {
    /// Store or update a merge request in the cache
    pub async fn upsert(pool: &SqlitePool, mr: &MergeRequest) -> Result<(), MrCacheError> {
        let author_json = serde_json::to_string(&mr.author)?;
        let assignees_json = serde_json::to_string(&mr.assignees)?;
        let reviewers_json = serde_json::to_string(&mr.reviewers)?;
        let labels_json = serde_json::to_string(&mr.labels)?;
        let milestone_json = mr
            .milestone
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let pipeline_status = mr.head_pipeline.as_ref().map(|p| p.status.to_string());
        let cached_at = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO merge_requests (
                id, iid, project_id, title, description, state,
                source_branch, target_branch, author_json, assignees_json,
                reviewers_json, labels_json, milestone_json, web_url,
                created_at, updated_at, merged_at, has_conflicts,
                pipeline_status, draft, blocking_discussions_resolved,
                user_notes_count, cached_at, diff_cached
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            "#,
        )
        .bind(mr.id)
        .bind(mr.iid)
        .bind(mr.project_id)
        .bind(&mr.title)
        .bind(&mr.description)
        .bind(mr.state.to_string())
        .bind(&mr.source_branch)
        .bind(&mr.target_branch)
        .bind(&author_json)
        .bind(&assignees_json)
        .bind(&reviewers_json)
        .bind(&labels_json)
        .bind(&milestone_json)
        .bind(&mr.web_url)
        .bind(mr.created_at.to_rfc3339())
        .bind(mr.updated_at.to_rfc3339())
        .bind(mr.merged_at.map(|dt| dt.to_rfc3339()))
        .bind(mr.has_conflicts)
        .bind(&pipeline_status)
        .bind(mr.draft)
        .bind(mr.blocking_discussions_resolved)
        .bind(mr.user_notes_count)
        .bind(&cached_at)
        .bind(mr.diff_cached)
        .execute(pool)
        .await?;

        debug!("Cached MR {} (iid: {})", mr.id, mr.iid);
        Ok(())
    }

    /// Store multiple merge requests
    pub async fn upsert_many(
        pool: &SqlitePool,
        mrs: &[MergeRequest],
    ) -> Result<(), MrCacheError> {
        for mr in mrs {
            Self::upsert(pool, mr).await?;
        }
        Ok(())
    }

    /// Get a merge request from the cache
    pub async fn get(
        pool: &SqlitePool,
        mr_id: i64,
    ) -> Result<Option<MergeRequest>, MrCacheError> {
        let row = sqlx::query_as::<_, MrRow>(
            r#"
            SELECT id, iid, project_id, title, description, state,
                   source_branch, target_branch, author_json, assignees_json,
                   reviewers_json, labels_json, milestone_json, web_url,
                   created_at, updated_at, merged_at, has_conflicts,
                   pipeline_status, draft, blocking_discussions_resolved,
                   user_notes_count, cached_at, diff_cached
            FROM merge_requests
            WHERE id = ?
            "#,
        )
        .bind(mr_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(row) => Ok(Some(row.into_merge_request()?)),
            None => Ok(None),
        }
    }

    /// Get all cached merge requests for a project
    pub async fn get_by_project(
        pool: &SqlitePool,
        project_id: i64,
    ) -> Result<Vec<MergeRequest>, MrCacheError> {
        let rows = sqlx::query_as::<_, MrRow>(
            r#"
            SELECT id, iid, project_id, title, description, state,
                   source_branch, target_branch, author_json, assignees_json,
                   reviewers_json, labels_json, milestone_json, web_url,
                   created_at, updated_at, merged_at, has_conflicts,
                   pipeline_status, draft, blocking_discussions_resolved,
                   user_notes_count, cached_at, diff_cached
            FROM merge_requests
            WHERE project_id = ?
            ORDER BY updated_at DESC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let mut mrs = Vec::with_capacity(rows.len());
        for row in rows {
            mrs.push(row.into_merge_request()?);
        }
        Ok(mrs)
    }

    /// Get all cached merge requests with opened state
    pub async fn get_all_open(pool: &SqlitePool) -> Result<Vec<MergeRequest>, MrCacheError> {
        let rows = sqlx::query_as::<_, MrRow>(
            r#"
            SELECT id, iid, project_id, title, description, state,
                   source_branch, target_branch, author_json, assignees_json,
                   reviewers_json, labels_json, milestone_json, web_url,
                   created_at, updated_at, merged_at, has_conflicts,
                   pipeline_status, draft, blocking_discussions_resolved,
                   user_notes_count, cached_at, diff_cached
            FROM merge_requests
            WHERE state = 'opened'
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(pool)
        .await?;

        let mut mrs = Vec::with_capacity(rows.len());
        for row in rows {
            mrs.push(row.into_merge_request()?);
        }
        Ok(mrs)
    }

    /// Delete a merge request from the cache
    pub async fn delete(pool: &SqlitePool, mr_id: i64) -> Result<(), MrCacheError> {
        sqlx::query("DELETE FROM merge_requests WHERE id = ?")
            .bind(mr_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Delete all merge requests for a project
    pub async fn delete_by_project(pool: &SqlitePool, project_id: i64) -> Result<(), MrCacheError> {
        sqlx::query("DELETE FROM merge_requests WHERE project_id = ?")
            .bind(project_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Clear all cached merge requests
    pub async fn clear_all(pool: &SqlitePool) -> Result<u64, MrCacheError> {
        let result = sqlx::query("DELETE FROM merge_requests")
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Get count of cached MRs
    pub async fn count(pool: &SqlitePool) -> Result<i64, MrCacheError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM merge_requests")
            .fetch_one(pool)
            .await?;
        Ok(row.0)
    }
}

/// Database row representation for merge requests
#[derive(sqlx::FromRow)]
struct MrRow {
    id: i64,
    iid: i64,
    project_id: i64,
    title: String,
    description: Option<String>,
    state: String,
    source_branch: String,
    target_branch: String,
    author_json: String,
    assignees_json: String,
    reviewers_json: String,
    labels_json: String,
    milestone_json: Option<String>,
    web_url: String,
    created_at: String,
    updated_at: String,
    merged_at: Option<String>,
    has_conflicts: bool,
    pipeline_status: Option<String>,
    draft: bool,
    blocking_discussions_resolved: bool,
    user_notes_count: i32,
    cached_at: String,
    diff_cached: bool,
}

impl MrRow {
    fn into_merge_request(self) -> Result<MergeRequest, MrCacheError> {
        let author: Author = serde_json::from_str(&self.author_json)?;
        let assignees: Vec<Author> = serde_json::from_str(&self.assignees_json)?;
        let reviewers: Vec<Author> = serde_json::from_str(&self.reviewers_json)?;
        let labels: Vec<String> = serde_json::from_str(&self.labels_json)?;
        let milestone: Option<Milestone> = self
            .milestone_json
            .as_ref()
            .map(|s| serde_json::from_str(s))
            .transpose()?;

        let state = match self.state.as_str() {
            "opened" => MergeRequestState::Opened,
            "closed" => MergeRequestState::Closed,
            "merged" => MergeRequestState::Merged,
            _ => {
                warn!("Unknown MR state: {}", self.state);
                MergeRequestState::Opened
            }
        };

        let created_at = DateTime::parse_from_rfc3339(&self.created_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&self.updated_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let merged_at = self.merged_at.as_ref().and_then(|s| {
            DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });
        let cached_at = DateTime::parse_from_rfc3339(&self.cached_at)
            .map(|dt| dt.with_timezone(&Utc))
            .ok();

        // Parse pipeline status into Pipeline struct if present
        let head_pipeline = self.pipeline_status.and_then(|status| {
            let pipeline_status = match status.as_str() {
                "pending" => crate::gitlab::types::PipelineStatus::Pending,
                "running" => crate::gitlab::types::PipelineStatus::Running,
                "success" => crate::gitlab::types::PipelineStatus::Success,
                "failed" => crate::gitlab::types::PipelineStatus::Failed,
                "canceled" => crate::gitlab::types::PipelineStatus::Canceled,
                "skipped" => crate::gitlab::types::PipelineStatus::Skipped,
                "manual" => crate::gitlab::types::PipelineStatus::Manual,
                "scheduled" => crate::gitlab::types::PipelineStatus::Scheduled,
                "created" => crate::gitlab::types::PipelineStatus::Created,
                _ => return None,
            };
            Some(Pipeline {
                id: 0, // We don't store the pipeline ID
                status: pipeline_status,
                web_url: String::new(),
            })
        });

        Ok(MergeRequest {
            id: self.id,
            iid: self.iid,
            project_id: self.project_id,
            project_path: None,
            project_name: None,
            title: self.title,
            description: self.description,
            state,
            source_branch: self.source_branch,
            target_branch: self.target_branch,
            author,
            assignees,
            reviewers,
            labels,
            milestone,
            web_url: self.web_url,
            created_at,
            updated_at,
            merged_at,
            has_conflicts: self.has_conflicts,
            head_pipeline,
            draft: self.draft,
            blocking_discussions_resolved: self.blocking_discussions_resolved,
            user_notes_count: self.user_notes_count,
            cached_at,
            diff_cached: self.diff_cached,
        })
    }
}
