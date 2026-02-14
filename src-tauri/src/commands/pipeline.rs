//! Pipeline-related Tauri commands
//!
//! This module contains all pipeline-related IPC commands.

use crate::cache::pipeline_cache::PipelineCache;
use crate::commands::gitlab::get_active_client;
use crate::gitlab::client::GitLabClient;
use crate::gitlab::types::{
    PinnedProject, PipelineDetail, PipelineFilter, PipelineJob, PipelineStage, ProjectSearchResult,
    TestReport,
};
use crate::{SharedAppState, TauriError, TauriResult};
use tauri::{AppHandle, State};
use tracing::{debug, info, warn};

// ============================================================================
// Inner functions
// ============================================================================

/// Search for projects (inner)
pub async fn search_projects_inner(
    state: &SharedAppState,
    query: String,
) -> TauriResult<Vec<ProjectSearchResult>> {
    let (_account, client) = get_active_client(state).await?;

    let results = client
        .search_projects(&query)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    debug!("Found {} projects matching '{}'", results.len(), query);
    Ok(results)
}

/// List pipelines for a project (inner)
pub async fn list_pipelines_inner(
    state: &SharedAppState,
    project_id: i64,
    filter: Option<PipelineFilter>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> TauriResult<Vec<PipelineDetail>> {
    let (_account, client) = get_active_client(state).await?;

    let pipelines = client
        .list_pipelines(project_id, filter.as_ref(), page, per_page)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache results
    {
        let state_read = state.read().await;
        for pipeline in &pipelines {
            if let Err(e) = PipelineCache::upsert_pipeline(&state_read.db_pool, pipeline).await {
                warn!("Failed to cache pipeline {}: {}", pipeline.id, e);
            }
        }
    }

    debug!(
        "Fetched {} pipelines for project {}",
        pipelines.len(),
        project_id
    );
    Ok(pipelines)
}

/// Get pipeline detail with jobs (inner)
pub async fn get_pipeline_detail_inner(
    state: &SharedAppState,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    let (_account, client) = get_active_client(state).await?;

    let pipeline = client
        .get_pipeline(project_id, pipeline_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache
    {
        let state_read = state.read().await;
        let _ = PipelineCache::upsert_pipeline(&state_read.db_pool, &pipeline).await;
    }

    Ok(pipeline)
}

/// Get pipeline stages grouped from jobs (inner)
pub async fn get_pipeline_stages_inner(
    state: &SharedAppState,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<Vec<PipelineStage>> {
    let (_account, client) = get_active_client(state).await?;

    let jobs = client
        .get_pipeline_jobs(project_id, pipeline_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    // Cache jobs
    {
        let state_read = state.read().await;
        let _ = PipelineCache::upsert_jobs(&state_read.db_pool, pipeline_id, &jobs).await;
    }

    let stages = GitLabClient::group_jobs_into_stages(&jobs);
    Ok(stages)
}

/// Get job log (inner)
pub async fn get_job_log_inner(
    state: &SharedAppState,
    project_id: i64,
    job_id: i64,
) -> TauriResult<String> {
    let (_account, client) = get_active_client(state).await?;

    let log = client
        .get_job_log(project_id, job_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    Ok(log)
}

/// Get test report for a pipeline (inner)
pub async fn get_test_report_inner(
    state: &SharedAppState,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<TestReport> {
    let (_account, client) = get_active_client(state).await?;

    let report = client
        .get_test_report(project_id, pipeline_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    Ok(report)
}

/// Retry a pipeline (inner)
pub async fn retry_pipeline_inner(
    state: &SharedAppState,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    let (_account, client) = get_active_client(state).await?;

    let pipeline = client
        .retry_pipeline(project_id, pipeline_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Retried pipeline {} in project {}", pipeline_id, project_id);
    Ok(pipeline)
}

/// Cancel a pipeline (inner)
pub async fn cancel_pipeline_inner(
    state: &SharedAppState,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    let (_account, client) = get_active_client(state).await?;

    let pipeline = client
        .cancel_pipeline(project_id, pipeline_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!(
        "Cancelled pipeline {} in project {}",
        pipeline_id, project_id
    );
    Ok(pipeline)
}

/// Retry a job (inner)
pub async fn retry_job_inner(
    state: &SharedAppState,
    project_id: i64,
    job_id: i64,
) -> TauriResult<PipelineJob> {
    let (_account, client) = get_active_client(state).await?;

    let job = client
        .retry_job(project_id, job_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Retried job {} in project {}", job_id, project_id);
    Ok(job)
}

/// Cancel a job (inner)
pub async fn cancel_job_inner(
    state: &SharedAppState,
    project_id: i64,
    job_id: i64,
) -> TauriResult<PipelineJob> {
    let (_account, client) = get_active_client(state).await?;

    let job = client
        .cancel_job(project_id, job_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!("Cancelled job {} in project {}", job_id, project_id);
    Ok(job)
}

/// Download job artifacts (inner) — saves to temp file and returns path
pub async fn download_artifacts_inner(
    state: &SharedAppState,
    project_id: i64,
    job_id: i64,
) -> TauriResult<Vec<u8>> {
    let (_account, client) = get_active_client(state).await?;

    let bytes = client
        .download_job_artifacts(project_id, job_id)
        .await
        .map_err(|e| TauriError::api_error(e.to_string()))?;

    info!(
        "Downloaded {} bytes of artifacts for job {}",
        bytes.len(),
        job_id
    );
    Ok(bytes)
}

/// Pin a project (inner)
pub async fn pin_project_inner(
    state: &SharedAppState,
    project_id: i64,
    path: String,
    name: String,
    web_url: String,
    avatar_url: Option<String>,
) -> TauriResult<()> {
    let (account, _client) = get_active_client(state).await?;
    let project = PinnedProject {
        project_id,
        account_id: account.id.clone(),
        path_with_namespace: path,
        name,
        web_url,
        avatar_url,
        pinned_at: chrono::Utc::now(),
    };
    let state_read = state.read().await;
    PipelineCache::pin_project(&state_read.db_pool, &project)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;
    Ok(())
}

/// Unpin a project (inner)
pub async fn unpin_project_inner(
    state: &SharedAppState,
    project_id: i64,
) -> TauriResult<()> {
    let (account, _client) = get_active_client(state).await?;
    let state_read = state.read().await;
    PipelineCache::unpin_project(&state_read.db_pool, project_id, &account.id)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;
    Ok(())
}

/// Get pinned projects (inner)
pub async fn get_pinned_projects_inner(state: &SharedAppState) -> TauriResult<Vec<PinnedProject>> {
    let (account, _client) = get_active_client(state).await?;
    let state_read = state.read().await;
    let projects = PipelineCache::get_pinned_projects(&state_read.db_pool, &account.id)
        .await
        .map_err(|e| TauriError::cache_error(e.to_string()))?;
    Ok(projects)
}

// ============================================================================
// Tauri command wrappers
// ============================================================================

/// Search for projects by name
#[tauri::command]
pub async fn gitlab_search_projects(
    state: State<'_, SharedAppState>,
    query: String,
) -> TauriResult<Vec<ProjectSearchResult>> {
    search_projects_inner(&state, query).await
}

/// List pipelines for a project
#[tauri::command]
pub async fn gitlab_list_pipelines(
    state: State<'_, SharedAppState>,
    project_id: i64,
    filter: Option<PipelineFilter>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> TauriResult<Vec<PipelineDetail>> {
    list_pipelines_inner(&state, project_id, filter, page, per_page).await
}

/// Get pipeline detail
#[tauri::command]
pub async fn gitlab_get_pipeline_detail(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    get_pipeline_detail_inner(&state, project_id, pipeline_id).await
}

/// Get pipeline stages (jobs grouped by stage)
#[tauri::command]
pub async fn gitlab_get_pipeline_stages(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<Vec<PipelineStage>> {
    get_pipeline_stages_inner(&state, project_id, pipeline_id).await
}

/// Get the full log for a job
#[tauri::command]
pub async fn gitlab_get_job_log(
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<String> {
    get_job_log_inner(&state, project_id, job_id).await
}

/// Get the test report for a pipeline
#[tauri::command]
pub async fn gitlab_get_test_report(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<TestReport> {
    get_test_report_inner(&state, project_id, pipeline_id).await
}

/// Retry a pipeline
#[tauri::command]
pub async fn gitlab_retry_pipeline(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    retry_pipeline_inner(&state, project_id, pipeline_id).await
}

/// Cancel a pipeline
#[tauri::command]
pub async fn gitlab_cancel_pipeline(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<PipelineDetail> {
    cancel_pipeline_inner(&state, project_id, pipeline_id).await
}

/// Retry a job
#[tauri::command]
pub async fn gitlab_retry_job(
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<PipelineJob> {
    retry_job_inner(&state, project_id, job_id).await
}

/// Cancel a job
#[tauri::command]
pub async fn gitlab_cancel_job(
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<PipelineJob> {
    cancel_job_inner(&state, project_id, job_id).await
}

/// Download artifacts for a job (returns raw bytes)
#[tauri::command]
pub async fn gitlab_download_artifacts(
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<Vec<u8>> {
    download_artifacts_inner(&state, project_id, job_id).await
}

/// Pin a project for the pipeline browser
#[tauri::command]
pub async fn gitlab_pin_project(
    state: State<'_, SharedAppState>,
    project_id: i64,
    path: String,
    name: String,
    web_url: String,
    avatar_url: Option<String>,
) -> TauriResult<()> {
    pin_project_inner(&state, project_id, path, name, web_url, avatar_url).await
}

/// Unpin a project
#[tauri::command]
pub async fn gitlab_unpin_project(
    state: State<'_, SharedAppState>,
    project_id: i64,
) -> TauriResult<()> {
    unpin_project_inner(&state, project_id).await
}

/// Get pinned projects
#[tauri::command]
pub async fn gitlab_get_pinned_projects(
    state: State<'_, SharedAppState>,
) -> TauriResult<Vec<PinnedProject>> {
    get_pinned_projects_inner(&state).await
}

/// Start polling a pipeline for live updates
#[tauri::command]
pub async fn gitlab_start_pipeline_polling(
    app: AppHandle,
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<()> {
    let (_account, client) = get_active_client(&state).await?;
    let pool = {
        let state_read = state.read().await;
        state_read.db_pool.clone()
    };

    let poller = {
        let state_read = state.read().await;
        // We need to get a reference to the poller, but since it's behind RwLock,
        // we call the method directly while holding the lock
        state_read
            .pipeline_poller
            .start_pipeline_polling(app, client, pool, project_id, pipeline_id)
            .await;
        // Return unit so the lock is released
    };
    let _ = poller;

    Ok(())
}

/// Stop polling a pipeline
#[tauri::command]
pub async fn gitlab_stop_pipeline_polling(
    state: State<'_, SharedAppState>,
    project_id: i64,
    pipeline_id: i64,
) -> TauriResult<()> {
    let state_read = state.read().await;
    state_read
        .pipeline_poller
        .stop_pipeline_polling(project_id, pipeline_id)
        .await;
    Ok(())
}

/// Start streaming job log output
#[tauri::command]
pub async fn gitlab_start_job_log_streaming(
    app: AppHandle,
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<()> {
    let (_account, client) = get_active_client(&state).await?;

    let state_read = state.read().await;
    state_read
        .pipeline_poller
        .start_job_log_streaming(app, client, project_id, job_id)
        .await;

    Ok(())
}

/// Stop streaming job log output
#[tauri::command]
pub async fn gitlab_stop_job_log_streaming(
    state: State<'_, SharedAppState>,
    project_id: i64,
    job_id: i64,
) -> TauriResult<()> {
    let state_read = state.read().await;
    state_read
        .pipeline_poller
        .stop_job_log_streaming(project_id, job_id)
        .await;
    Ok(())
}
