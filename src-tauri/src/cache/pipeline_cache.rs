//! Pipeline data caching
//!
//! This module handles caching of pipeline and job data in SQLite.

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use tracing::debug;

use crate::gitlab::types::{PinnedProject, PipelineDetail, PipelineJob, PipelineStatus};

/// Error type for pipeline cache operations
#[derive(Debug, thiserror::Error)]
pub enum PipelineCacheError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

/// Pipeline cache operations
pub struct PipelineCache;

impl PipelineCache {
    /// Store or update a pipeline in the cache
    pub async fn upsert_pipeline(
        pool: &SqlitePool,
        pipeline: &PipelineDetail,
    ) -> Result<(), PipelineCacheError> {
        let user_json = pipeline
            .user
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let cached_at = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO pipelines (
                id, iid, project_id, ref_name, sha, status, source, name,
                created_at, updated_at, started_at, finished_at,
                duration, queued_duration, web_url, user_json, cached_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                iid = excluded.iid,
                status = excluded.status,
                name = excluded.name,
                updated_at = excluded.updated_at,
                started_at = excluded.started_at,
                finished_at = excluded.finished_at,
                duration = excluded.duration,
                queued_duration = excluded.queued_duration,
                user_json = excluded.user_json,
                cached_at = excluded.cached_at
            "#,
        )
        .bind(pipeline.id)
        .bind(pipeline.iid)
        .bind(pipeline.project_id)
        .bind(&pipeline.ref_name)
        .bind(&pipeline.sha)
        .bind(pipeline.status.to_string())
        .bind(&pipeline.source)
        .bind(&pipeline.name)
        .bind(pipeline.created_at.to_rfc3339())
        .bind(pipeline.updated_at.map(|dt| dt.to_rfc3339()))
        .bind(pipeline.started_at.map(|dt| dt.to_rfc3339()))
        .bind(pipeline.finished_at.map(|dt| dt.to_rfc3339()))
        .bind(pipeline.duration)
        .bind(pipeline.queued_duration)
        .bind(&pipeline.web_url)
        .bind(&user_json)
        .bind(&cached_at)
        .execute(pool)
        .await?;

        debug!("Cached pipeline {}", pipeline.id);
        Ok(())
    }

    /// Store or update jobs for a pipeline
    pub async fn upsert_jobs(
        pool: &SqlitePool,
        pipeline_id: i64,
        jobs: &[PipelineJob],
    ) -> Result<(), PipelineCacheError> {
        let cached_at = Utc::now().to_rfc3339();

        for job in jobs {
            let runner_json = job.runner.as_ref().map(serde_json::to_string).transpose()?;
            let artifacts_json = serde_json::to_string(&job.artifacts)?;

            sqlx::query(
                r#"
                INSERT INTO pipeline_jobs (
                    id, pipeline_id, name, stage, status, ref_name,
                    created_at, started_at, finished_at,
                    duration, queued_duration, web_url,
                    runner_json, artifacts_json, allow_failure,
                    failure_reason, cached_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    started_at = excluded.started_at,
                    finished_at = excluded.finished_at,
                    duration = excluded.duration,
                    queued_duration = excluded.queued_duration,
                    runner_json = excluded.runner_json,
                    artifacts_json = excluded.artifacts_json,
                    failure_reason = excluded.failure_reason,
                    cached_at = excluded.cached_at
                "#,
            )
            .bind(job.id)
            .bind(pipeline_id)
            .bind(&job.name)
            .bind(&job.stage)
            .bind(job.status.to_string())
            .bind(&job.ref_name)
            .bind(job.created_at.to_rfc3339())
            .bind(job.started_at.map(|dt| dt.to_rfc3339()))
            .bind(job.finished_at.map(|dt| dt.to_rfc3339()))
            .bind(job.duration)
            .bind(job.queued_duration)
            .bind(&job.web_url)
            .bind(&runner_json)
            .bind(&artifacts_json)
            .bind(job.allow_failure)
            .bind(&job.failure_reason)
            .bind(&cached_at)
            .execute(pool)
            .await?;
        }

        debug!("Cached {} jobs for pipeline {}", jobs.len(), pipeline_id);
        Ok(())
    }

    /// Get cached pipelines for a project, ordered by updated_at desc
    pub async fn get_pipelines_for_project(
        pool: &SqlitePool,
        project_id: i64,
        limit: Option<i64>,
    ) -> Result<Vec<PipelineDetail>, PipelineCacheError> {
        let limit = limit.unwrap_or(50);
        let rows = sqlx::query_as::<_, PipelineRow>(
            r#"
            SELECT id, iid, project_id, ref_name, sha, status, source, name,
                   created_at, updated_at, started_at, finished_at,
                   duration, queued_duration, web_url, user_json, cached_at
            FROM pipelines
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(project_id)
        .bind(limit)
        .fetch_all(pool)
        .await?;

        let mut pipelines = Vec::with_capacity(rows.len());
        for row in rows {
            pipelines.push(row.into_pipeline_detail()?);
        }
        Ok(pipelines)
    }

    /// Get cached jobs for a pipeline
    pub async fn get_jobs_for_pipeline(
        pool: &SqlitePool,
        pipeline_id: i64,
    ) -> Result<Vec<PipelineJob>, PipelineCacheError> {
        let rows = sqlx::query_as::<_, JobRow>(
            r#"
            SELECT id, pipeline_id, name, stage, status, ref_name,
                   created_at, started_at, finished_at,
                   duration, queued_duration, web_url,
                   runner_json, artifacts_json, allow_failure,
                   failure_reason, cached_at
            FROM pipeline_jobs
            WHERE pipeline_id = ?
            ORDER BY id ASC
            "#,
        )
        .bind(pipeline_id)
        .fetch_all(pool)
        .await?;

        let mut jobs = Vec::with_capacity(rows.len());
        for row in rows {
            jobs.push(row.into_pipeline_job()?);
        }
        Ok(jobs)
    }

    /// Get a single pipeline from cache
    pub async fn get_pipeline(
        pool: &SqlitePool,
        pipeline_id: i64,
    ) -> Result<Option<PipelineDetail>, PipelineCacheError> {
        let row = sqlx::query_as::<_, PipelineRow>(
            r#"
            SELECT id, iid, project_id, ref_name, sha, status, source, name,
                   created_at, updated_at, started_at, finished_at,
                   duration, queued_duration, web_url, user_json, cached_at
            FROM pipelines
            WHERE id = ?
            "#,
        )
        .bind(pipeline_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(row) => Ok(Some(row.into_pipeline_detail()?)),
            None => Ok(None),
        }
    }

    /// Pin a project for the pipeline browser
    pub async fn pin_project(
        pool: &SqlitePool,
        project: &PinnedProject,
    ) -> Result<(), PipelineCacheError> {
        let pinned_at = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO pinned_projects
                (project_id, account_id, path_with_namespace, name, web_url, avatar_url, pinned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(project.project_id)
        .bind(&project.account_id)
        .bind(&project.path_with_namespace)
        .bind(&project.name)
        .bind(&project.web_url)
        .bind(&project.avatar_url)
        .bind(&pinned_at)
        .execute(pool)
        .await?;

        debug!(
            "Pinned project {} for account {}",
            project.project_id, project.account_id
        );
        Ok(())
    }

    /// Unpin a project
    pub async fn unpin_project(
        pool: &SqlitePool,
        project_id: i64,
        account_id: &str,
    ) -> Result<(), PipelineCacheError> {
        sqlx::query("DELETE FROM pinned_projects WHERE project_id = ? AND account_id = ?")
            .bind(project_id)
            .bind(account_id)
            .execute(pool)
            .await?;

        debug!("Unpinned project {} for account {}", project_id, account_id);
        Ok(())
    }

    /// Get all pinned projects for an account
    pub async fn get_pinned_projects(
        pool: &SqlitePool,
        account_id: &str,
    ) -> Result<Vec<PinnedProject>, PipelineCacheError> {
        let rows =
            sqlx::query_as::<_, (i64, String, String, String, String, Option<String>, String)>(
                r#"
            SELECT project_id, account_id, path_with_namespace, name, web_url, avatar_url, pinned_at
            FROM pinned_projects
            WHERE account_id = ?
            ORDER BY name ASC
            "#,
            )
            .bind(account_id)
            .fetch_all(pool)
            .await?;

        let projects = rows
            .into_iter()
            .map(
                |(project_id, account_id, path, name, web_url, avatar_url, pinned_at)| {
                    PinnedProject {
                        project_id,
                        account_id,
                        path_with_namespace: path,
                        name,
                        web_url,
                        avatar_url,
                        pinned_at: pinned_at
                            .parse::<DateTime<Utc>>()
                            .unwrap_or_else(|_| Utc::now()),
                    }
                },
            )
            .collect();

        Ok(projects)
    }

    /// Check if a project is pinned
    pub async fn is_pinned(
        pool: &SqlitePool,
        project_id: i64,
        account_id: &str,
    ) -> Result<bool, PipelineCacheError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM pinned_projects WHERE project_id = ? AND account_id = ?",
        )
        .bind(project_id)
        .bind(account_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0 > 0)
    }

    /// Clear all cached pipelines and jobs for a project
    pub async fn clear_project(
        pool: &SqlitePool,
        project_id: i64,
    ) -> Result<(), PipelineCacheError> {
        // Jobs will cascade-delete via FK
        sqlx::query("DELETE FROM pipelines WHERE project_id = ?")
            .bind(project_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    /// Clear all cached pipeline data
    pub async fn clear_all(pool: &SqlitePool) -> Result<(), PipelineCacheError> {
        sqlx::query("DELETE FROM pipeline_jobs")
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM pipelines").execute(pool).await?;

        Ok(())
    }
}

/// Database row representation for pipelines
#[derive(sqlx::FromRow)]
struct PipelineRow {
    id: i64,
    iid: Option<i64>,
    project_id: i64,
    ref_name: String,
    sha: String,
    status: String,
    source: Option<String>,
    name: Option<String>,
    created_at: String,
    updated_at: Option<String>,
    started_at: Option<String>,
    finished_at: Option<String>,
    duration: Option<f64>,
    queued_duration: Option<f64>,
    web_url: String,
    user_json: Option<String>,
    #[allow(dead_code)]
    cached_at: String,
}

impl PipelineRow {
    fn into_pipeline_detail(self) -> Result<PipelineDetail, PipelineCacheError> {
        let user = self
            .user_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?;

        Ok(PipelineDetail {
            id: self.id,
            iid: self.iid,
            project_id: self.project_id,
            ref_name: self.ref_name,
            sha: self.sha,
            status: parse_pipeline_status(&self.status),
            source: self.source,
            name: self.name,
            created_at: self
                .created_at
                .parse::<DateTime<Utc>>()
                .unwrap_or_else(|_| Utc::now()),
            updated_at: self
                .updated_at
                .as_deref()
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            started_at: self
                .started_at
                .as_deref()
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            finished_at: self
                .finished_at
                .as_deref()
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            duration: self.duration,
            queued_duration: self.queued_duration,
            web_url: self.web_url,
            user,
        })
    }
}

/// Database row representation for pipeline jobs
#[derive(sqlx::FromRow)]
struct JobRow {
    id: i64,
    #[allow(dead_code)]
    pipeline_id: i64,
    name: String,
    stage: String,
    status: String,
    ref_name: Option<String>,
    created_at: String,
    started_at: Option<String>,
    finished_at: Option<String>,
    duration: Option<f64>,
    queued_duration: Option<f64>,
    web_url: String,
    runner_json: Option<String>,
    artifacts_json: Option<String>,
    allow_failure: bool,
    failure_reason: Option<String>,
    #[allow(dead_code)]
    cached_at: String,
}

impl JobRow {
    fn into_pipeline_job(self) -> Result<PipelineJob, PipelineCacheError> {
        let runner = self
            .runner_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?;
        let artifacts = self
            .artifacts_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()?
            .unwrap_or_default();

        Ok(PipelineJob {
            id: self.id,
            name: self.name,
            stage: self.stage,
            status: parse_pipeline_status(&self.status),
            ref_name: self.ref_name,
            created_at: self
                .created_at
                .parse::<DateTime<Utc>>()
                .unwrap_or_else(|_| Utc::now()),
            started_at: self
                .started_at
                .as_deref()
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            finished_at: self
                .finished_at
                .as_deref()
                .and_then(|s| s.parse::<DateTime<Utc>>().ok()),
            duration: self.duration,
            queued_duration: self.queued_duration,
            web_url: self.web_url,
            runner,
            artifacts,
            allow_failure: self.allow_failure,
            failure_reason: self.failure_reason,
            pipeline: None,
        })
    }
}

/// Parse a pipeline status string into the enum
fn parse_pipeline_status(s: &str) -> PipelineStatus {
    match s {
        "pending" => PipelineStatus::Pending,
        "running" => PipelineStatus::Running,
        "success" => PipelineStatus::Success,
        "failed" => PipelineStatus::Failed,
        "canceled" => PipelineStatus::Canceled,
        "skipped" => PipelineStatus::Skipped,
        "manual" => PipelineStatus::Manual,
        "scheduled" => PipelineStatus::Scheduled,
        "created" => PipelineStatus::Created,
        "waiting_for_resource" => PipelineStatus::WaitingForResource,
        "preparing" => PipelineStatus::Preparing,
        _ => PipelineStatus::Other,
    }
}
