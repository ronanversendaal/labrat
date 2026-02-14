-- Pipeline support tables
-- Migration: 004_pipeline_support

-- Pinned projects for the pipeline browser
CREATE TABLE IF NOT EXISTS pinned_projects (
    project_id INTEGER NOT NULL,
    account_id TEXT NOT NULL REFERENCES gitlab_accounts(id) ON DELETE CASCADE,
    path_with_namespace TEXT NOT NULL,
    name TEXT NOT NULL,
    web_url TEXT NOT NULL,
    avatar_url TEXT,
    pinned_at TEXT NOT NULL,
    PRIMARY KEY (project_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_pinned_projects_account ON pinned_projects(account_id);

-- Cached pipelines
CREATE TABLE IF NOT EXISTS pipelines (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    ref_name TEXT NOT NULL,
    sha TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    started_at TEXT,
    finished_at TEXT,
    duration REAL,
    queued_duration REAL,
    web_url TEXT NOT NULL,
    user_json TEXT,
    cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipelines_project ON pipelines(project_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_updated ON pipelines(updated_at);

-- Cached pipeline jobs
CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id INTEGER PRIMARY KEY,
    pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    ref_name TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    duration REAL,
    queued_duration REAL,
    web_url TEXT NOT NULL,
    runner_json TEXT,
    artifacts_json TEXT,
    allow_failure INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_pipeline ON pipeline_jobs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON pipeline_jobs(status);
