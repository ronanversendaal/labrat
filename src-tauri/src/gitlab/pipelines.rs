//! Pipeline API operations
//!
//! This module provides wrappers for pipeline-related GitLab API endpoints.

use super::client::{GitLabClient, GitLabClientError};
use super::types::{
    PipelineDetail, PipelineFilter, PipelineJob, PipelineStage, PipelineStatus,
    ProjectSearchResult, TestReport,
};
use tracing::debug;

/// Default number of items per page for pagination
const DEFAULT_PER_PAGE: u32 = 100;

impl GitLabClient {
    /// Search for projects by name
    ///
    /// GET /projects?search={query}&membership=true&order_by=last_activity_at
    pub async fn search_projects(
        &self,
        query: &str,
    ) -> Result<Vec<ProjectSearchResult>, GitLabClientError> {
        let path = format!(
            "/projects?search={}&membership=true&order_by=last_activity_at&per_page=20",
            urlencoding::encode(query)
        );
        debug!("Searching projects: {}", path);

        self.get(&path).await
    }

    /// List pipelines for a project
    ///
    /// GET /projects/{id}/pipelines
    pub async fn list_pipelines(
        &self,
        project_id: i64,
        filter: Option<&PipelineFilter>,
        page: Option<u32>,
        per_page: Option<u32>,
    ) -> Result<Vec<PipelineDetail>, GitLabClientError> {
        let mut params = Vec::new();

        let pp = per_page.unwrap_or(DEFAULT_PER_PAGE);
        params.push(format!("per_page={}", pp));

        if let Some(p) = page {
            params.push(format!("page={}", p));
        }

        params.push("order_by=updated_at".to_string());
        params.push("sort=desc".to_string());

        if let Some(f) = filter {
            if let Some(ref status) = f.status {
                params.push(format!("status={}", status));
            }
            if let Some(ref ref_name) = f.ref_name {
                params.push(format!("ref={}", urlencoding::encode(ref_name)));
            }
            if let Some(ref source) = f.source {
                params.push(format!("source={}", urlencoding::encode(source)));
            }
            if let Some(ref username) = f.username {
                params.push(format!("username={}", urlencoding::encode(username)));
            }
        }

        let path = format!("/projects/{}/pipelines?{}", project_id, params.join("&"));
        debug!("Listing pipelines: {}", path);

        self.get(&path).await
    }

    /// Get a single pipeline by ID
    ///
    /// GET /projects/{id}/pipelines/{pipeline_id}
    pub async fn get_pipeline(
        &self,
        project_id: i64,
        pipeline_id: i64,
    ) -> Result<PipelineDetail, GitLabClientError> {
        let path = format!("/projects/{}/pipelines/{}", project_id, pipeline_id);
        debug!("Fetching pipeline: {}", path);

        self.get(&path).await
    }

    /// Get jobs for a pipeline
    ///
    /// GET /projects/{id}/pipelines/{pipeline_id}/jobs
    pub async fn get_pipeline_jobs(
        &self,
        project_id: i64,
        pipeline_id: i64,
    ) -> Result<Vec<PipelineJob>, GitLabClientError> {
        let path = format!("/projects/{}/pipelines/{}/jobs", project_id, pipeline_id);
        debug!("Fetching pipeline jobs: {}", path);

        self.get_all_pages(&path, DEFAULT_PER_PAGE).await
    }

    /// Get the log (trace) for a specific job
    ///
    /// GET /projects/{id}/jobs/{job_id}/trace
    pub async fn get_job_log(
        &self,
        project_id: i64,
        job_id: i64,
    ) -> Result<String, GitLabClientError> {
        let path = format!("/projects/{}/jobs/{}/trace", project_id, job_id);
        debug!("Fetching job log: {}", path);

        self.get_text(&path).await
    }

    /// Get partial job log content starting from a byte offset.
    /// Returns (content, new_offset, complete) where complete is true if the job has finished.
    pub async fn get_job_log_partial(
        &self,
        project_id: i64,
        job_id: i64,
        offset: u64,
    ) -> Result<(String, u64, bool), GitLabClientError> {
        let url = format!(
            "{}/projects/{}/jobs/{}/trace",
            self.base_url(),
            project_id,
            job_id
        );
        debug!("GET (text range) {}", url);

        let response = self.get_text_with_range(&url, offset).await?;
        Ok(response)
    }

    /// Retry a pipeline
    ///
    /// POST /projects/{id}/pipelines/{pipeline_id}/retry
    pub async fn retry_pipeline(
        &self,
        project_id: i64,
        pipeline_id: i64,
    ) -> Result<PipelineDetail, GitLabClientError> {
        let path = format!("/projects/{}/pipelines/{}/retry", project_id, pipeline_id);
        debug!("Retrying pipeline: {}", path);

        let body = serde_json::json!({});
        self.post(&path, &body).await
    }

    /// Cancel a pipeline
    ///
    /// POST /projects/{id}/pipelines/{pipeline_id}/cancel
    pub async fn cancel_pipeline(
        &self,
        project_id: i64,
        pipeline_id: i64,
    ) -> Result<PipelineDetail, GitLabClientError> {
        let path = format!("/projects/{}/pipelines/{}/cancel", project_id, pipeline_id);
        debug!("Cancelling pipeline: {}", path);

        let body = serde_json::json!({});
        self.post(&path, &body).await
    }

    /// Retry a single job
    ///
    /// POST /projects/{id}/jobs/{job_id}/retry
    pub async fn retry_job(
        &self,
        project_id: i64,
        job_id: i64,
    ) -> Result<PipelineJob, GitLabClientError> {
        let path = format!("/projects/{}/jobs/{}/retry", project_id, job_id);
        debug!("Retrying job: {}", path);

        let body = serde_json::json!({});
        self.post(&path, &body).await
    }

    /// Cancel a single job
    ///
    /// POST /projects/{id}/jobs/{job_id}/cancel
    pub async fn cancel_job(
        &self,
        project_id: i64,
        job_id: i64,
    ) -> Result<PipelineJob, GitLabClientError> {
        let path = format!("/projects/{}/jobs/{}/cancel", project_id, job_id);
        debug!("Cancelling job: {}", path);

        let body = serde_json::json!({});
        self.post(&path, &body).await
    }

    /// Download job artifacts (returns raw bytes)
    ///
    /// GET /projects/{id}/jobs/{job_id}/artifacts
    pub async fn download_job_artifacts(
        &self,
        project_id: i64,
        job_id: i64,
    ) -> Result<Vec<u8>, GitLabClientError> {
        let url = format!(
            "{}/projects/{}/jobs/{}/artifacts",
            self.base_url(),
            project_id,
            job_id
        );
        debug!("Downloading job artifacts: {}", url);

        self.fetch_bytes(&url).await
    }

    /// Get the test report for a pipeline
    ///
    /// GET /projects/{id}/pipelines/{pipeline_id}/test_report
    pub async fn get_test_report(
        &self,
        project_id: i64,
        pipeline_id: i64,
    ) -> Result<TestReport, GitLabClientError> {
        let path = format!(
            "/projects/{}/pipelines/{}/test_report",
            project_id, pipeline_id
        );
        debug!("Fetching test report: {}", path);

        self.get(&path).await
    }

    /// Group pipeline jobs into stages
    pub fn group_jobs_into_stages(jobs: &[PipelineJob]) -> Vec<PipelineStage> {
        use std::collections::BTreeMap;

        // Collect stage order as encountered
        let mut stage_order: Vec<String> = Vec::new();
        let mut stage_map: BTreeMap<String, Vec<PipelineJob>> = BTreeMap::new();

        // Sort jobs by ID ascending to ensure correct order
        // (the API may return them in descending order)
        let mut sorted_jobs = jobs.to_vec();
        sorted_jobs.sort_by_key(|j| j.id);

        for job in &sorted_jobs {
            if !stage_map.contains_key(&job.stage) {
                stage_order.push(job.stage.clone());
            }
            stage_map
                .entry(job.stage.clone())
                .or_default()
                .push(job.clone());
        }

        stage_order
            .into_iter()
            .filter_map(|name| {
                let jobs = stage_map.remove(&name)?;
                let status = Self::compute_stage_status(&jobs);
                Some(PipelineStage { name, status, jobs })
            })
            .collect()
    }

    /// Compute aggregate status for a stage based on its jobs
    fn compute_stage_status(jobs: &[PipelineJob]) -> PipelineStatus {
        if jobs
            .iter()
            .any(|j| j.status == PipelineStatus::Failed && !j.allow_failure)
        {
            PipelineStatus::Failed
        } else if jobs.iter().any(|j| j.status == PipelineStatus::Running) {
            PipelineStatus::Running
        } else if jobs.iter().any(|j| j.status == PipelineStatus::Pending) {
            PipelineStatus::Pending
        } else if jobs.iter().any(|j| j.status == PipelineStatus::Canceled) {
            PipelineStatus::Canceled
        } else if jobs
            .iter()
            .any(|j| j.status == PipelineStatus::Manual || j.status == PipelineStatus::Scheduled)
        {
            PipelineStatus::Manual
        } else if jobs.iter().all(|j| {
            j.status == PipelineStatus::Success
                || j.status == PipelineStatus::Skipped
                || (j.status == PipelineStatus::Failed && j.allow_failure)
        }) {
            PipelineStatus::Success
        } else if jobs.iter().all(|j| j.status == PipelineStatus::Created) {
            PipelineStatus::Created
        } else {
            PipelineStatus::Pending
        }
    }
}
