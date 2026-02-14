//! Adaptive pipeline polling engine
//!
//! This module provides background polling for pipeline status updates
//! and job log streaming.

use std::collections::HashMap;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

use super::client::GitLabClient;
use super::types::{JobLogUpdateEvent, PipelineUpdateEvent};
use crate::cache::pipeline_cache::PipelineCache;
use sqlx::SqlitePool;

/// Interval for polling active (running/pending) pipelines
const ACTIVE_POLL_INTERVAL_SECS: u64 = 5;

/// Interval for streaming job logs
const LOG_STREAM_INTERVAL_SECS: u64 = 2;

/// Key for pipeline polling tasks
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct PipelineKey {
    project_id: i64,
    pipeline_id: i64,
}

/// Key for job log streaming tasks
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct JobLogKey {
    project_id: i64,
    job_id: i64,
}

/// Pipeline polling engine
pub struct PipelinePoller {
    pipeline_tasks: Arc<Mutex<HashMap<PipelineKey, CancellationToken>>>,
    log_tasks: Arc<Mutex<HashMap<JobLogKey, CancellationToken>>>,
}

impl Default for PipelinePoller {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelinePoller {
    pub fn new() -> Self {
        Self {
            pipeline_tasks: Arc::new(Mutex::new(HashMap::new())),
            log_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start polling a pipeline for status updates.
    /// If already polling this pipeline, the old task is cancelled first.
    pub async fn start_pipeline_polling(
        &self,
        app: AppHandle,
        client: GitLabClient,
        pool: SqlitePool,
        project_id: i64,
        pipeline_id: i64,
    ) {
        let key = PipelineKey {
            project_id,
            pipeline_id,
        };

        // Cancel existing poller for this pipeline
        {
            let mut tasks = self.pipeline_tasks.lock().await;
            if let Some(token) = tasks.remove(&key) {
                token.cancel();
            }
        }

        let token = CancellationToken::new();
        {
            let mut tasks = self.pipeline_tasks.lock().await;
            tasks.insert(key.clone(), token.clone());
        }

        let tasks = self.pipeline_tasks.clone();

        tokio::spawn(async move {
            info!(
                "Starting pipeline polling: project={} pipeline={}",
                project_id, pipeline_id
            );

            loop {
                // Check cancellation
                if token.is_cancelled() {
                    debug!("Pipeline polling cancelled: {}/{}", project_id, pipeline_id);
                    break;
                }

                // Fetch pipeline detail
                let pipeline = match client.get_pipeline(project_id, pipeline_id).await {
                    Ok(p) => p,
                    Err(e) => {
                        warn!("Failed to fetch pipeline {}: {}", pipeline_id, e);
                        tokio::time::sleep(std::time::Duration::from_secs(
                            ACTIVE_POLL_INTERVAL_SECS,
                        ))
                        .await;
                        continue;
                    }
                };

                // Fetch jobs
                let jobs = match client.get_pipeline_jobs(project_id, pipeline_id).await {
                    Ok(j) => j,
                    Err(e) => {
                        warn!("Failed to fetch jobs for pipeline {}: {}", pipeline_id, e);
                        vec![]
                    }
                };

                // Cache
                let _ = PipelineCache::upsert_pipeline(&pool, &pipeline).await;
                let _ = PipelineCache::upsert_jobs(&pool, pipeline_id, &jobs).await;

                // Emit event
                let event = PipelineUpdateEvent {
                    project_id,
                    pipeline: pipeline.clone(),
                    jobs,
                };
                let _ = app.emit("pipeline:update", &event);

                // If terminal, stop polling
                if pipeline.is_terminal() {
                    info!(
                        "Pipeline {} reached terminal state: {}",
                        pipeline_id, pipeline.status
                    );
                    break;
                }

                // Wait before next poll
                tokio::select! {
                    _ = tokio::time::sleep(std::time::Duration::from_secs(ACTIVE_POLL_INTERVAL_SECS)) => {}
                    _ = token.cancelled() => {
                        debug!("Pipeline polling cancelled during sleep: {}/{}", project_id, pipeline_id);
                        break;
                    }
                }
            }

            // Clean up
            let mut tasks_lock = tasks.lock().await;
            tasks_lock.remove(&PipelineKey {
                project_id,
                pipeline_id,
            });
        });
    }

    /// Stop polling a specific pipeline
    pub async fn stop_pipeline_polling(&self, project_id: i64, pipeline_id: i64) {
        let key = PipelineKey {
            project_id,
            pipeline_id,
        };
        let mut tasks = self.pipeline_tasks.lock().await;
        if let Some(token) = tasks.remove(&key) {
            token.cancel();
            info!(
                "Stopped pipeline polling: project={} pipeline={}",
                project_id, pipeline_id
            );
        }
    }

    /// Start streaming a job's log output
    pub async fn start_job_log_streaming(
        &self,
        app: AppHandle,
        client: GitLabClient,
        project_id: i64,
        job_id: i64,
    ) {
        let key = JobLogKey { project_id, job_id };

        // Cancel existing streamer for this job
        {
            let mut tasks = self.log_tasks.lock().await;
            if let Some(token) = tasks.remove(&key) {
                token.cancel();
            }
        }

        let token = CancellationToken::new();
        {
            let mut tasks = self.log_tasks.lock().await;
            tasks.insert(key.clone(), token.clone());
        }

        let tasks = self.log_tasks.clone();

        tokio::spawn(async move {
            info!(
                "Starting job log streaming: project={} job={}",
                project_id, job_id
            );

            let mut offset: u64 = 0;

            loop {
                if token.is_cancelled() {
                    debug!("Job log streaming cancelled: {}/{}", project_id, job_id);
                    break;
                }

                match client.get_job_log_partial(project_id, job_id, offset).await {
                    Ok((content, new_offset, complete)) => {
                        if !content.is_empty() {
                            let event = JobLogUpdateEvent {
                                job_id,
                                content,
                                offset,
                                complete,
                            };
                            let _ = app.emit("job:log_update", &event);
                            offset = new_offset;
                        }

                        if complete {
                            info!("Job {} log streaming complete", job_id);
                            // Send a final empty event with complete=true
                            let event = JobLogUpdateEvent {
                                job_id,
                                content: String::new(),
                                offset,
                                complete: true,
                            };
                            let _ = app.emit("job:log_update", &event);
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("Failed to fetch job log for {}: {}", job_id, e);
                    }
                }

                // Wait before next poll
                tokio::select! {
                    _ = tokio::time::sleep(std::time::Duration::from_secs(LOG_STREAM_INTERVAL_SECS)) => {}
                    _ = token.cancelled() => {
                        debug!("Job log streaming cancelled during sleep: {}/{}", project_id, job_id);
                        break;
                    }
                }
            }

            // Clean up
            let mut tasks_lock = tasks.lock().await;
            tasks_lock.remove(&JobLogKey { project_id, job_id });
        });
    }

    /// Stop streaming a specific job's log
    pub async fn stop_job_log_streaming(&self, project_id: i64, job_id: i64) {
        let key = JobLogKey { project_id, job_id };
        let mut tasks = self.log_tasks.lock().await;
        if let Some(token) = tasks.remove(&key) {
            token.cancel();
            info!(
                "Stopped job log streaming: project={} job={}",
                project_id, job_id
            );
        }
    }

    /// Stop all polling and streaming tasks
    pub async fn stop_all(&self) {
        {
            let mut tasks = self.pipeline_tasks.lock().await;
            for (_, token) in tasks.drain() {
                token.cancel();
            }
        }
        {
            let mut tasks = self.log_tasks.lock().await;
            for (_, token) in tasks.drain() {
                token.cancel();
            }
        }
        info!("Stopped all pipeline polling and log streaming");
    }
}
