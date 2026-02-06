-- Initial database schema for LabRat App
-- Migration: 001_initial_schema

-- GitLab Accounts
CREATE TABLE IF NOT EXISTS gitlab_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    instance_url TEXT NOT NULL,
    username TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL
);

-- Projects (cached)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES gitlab_accounts(id) ON DELETE CASCADE,
    path_with_namespace TEXT NOT NULL,
    name TEXT NOT NULL,
    web_url TEXT NOT NULL,
    avatar_url TEXT,
    last_activity_at TEXT NOT NULL,
    cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_account ON projects(account_id);

-- Merge Requests (cached)
CREATE TABLE IF NOT EXISTS merge_requests (
    id INTEGER PRIMARY KEY,
    iid INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    state TEXT NOT NULL,
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    author_json TEXT NOT NULL,      -- JSON blob
    assignees_json TEXT NOT NULL,   -- JSON array
    reviewers_json TEXT NOT NULL,   -- JSON array
    labels_json TEXT NOT NULL,      -- JSON array
    milestone_json TEXT,            -- JSON blob
    web_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    merged_at TEXT,
    has_conflicts INTEGER NOT NULL,
    pipeline_status TEXT,
    draft INTEGER NOT NULL,
    blocking_discussions_resolved INTEGER NOT NULL,
    user_notes_count INTEGER NOT NULL,
    cached_at TEXT NOT NULL,
    diff_cached INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mr_project ON merge_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_mr_updated ON merge_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_mr_state ON merge_requests(state);

-- Diffs (cached, potentially large)
CREATE TABLE IF NOT EXISTS diffs (
    mr_id INTEGER PRIMARY KEY REFERENCES merge_requests(id) ON DELETE CASCADE,
    base_commit_sha TEXT NOT NULL,
    head_commit_sha TEXT NOT NULL,
    start_commit_sha TEXT NOT NULL,
    files_json TEXT NOT NULL,       -- JSON array (compressed)
    cached_at TEXT NOT NULL
);

-- AI Providers
CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES gitlab_accounts(id) ON DELETE SET NULL,
    provider_type TEXT NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

-- AI Suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id TEXT PRIMARY KEY,
    mr_id INTEGER NOT NULL REFERENCES merge_requests(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_code TEXT,
    original_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggestions_mr ON ai_suggestions(mr_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON ai_suggestions(status);

-- Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL DEFAULT 'system',
    mr_refresh_interval_seconds INTEGER NOT NULL DEFAULT 300,
    cache_size_mb INTEGER NOT NULL DEFAULT 500,
    ai_auto_analyze INTEGER NOT NULL DEFAULT 1,
    default_ai_provider_id TEXT REFERENCES ai_providers(id) ON DELETE SET NULL,
    sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
    diff_view_mode TEXT NOT NULL DEFAULT 'unified',
    show_whitespace INTEGER NOT NULL DEFAULT 0,
    font_size INTEGER NOT NULL DEFAULT 14,
    keyboard_shortcuts_enabled INTEGER NOT NULL DEFAULT 1
);

-- Initialize settings with default values
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Filter presets (user-saved filters)
CREATE TABLE IF NOT EXISTS filter_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filters_json TEXT NOT NULL,    -- JSON blob of filter state
    created_at TEXT NOT NULL
);

-- Discussions (cached)
CREATE TABLE IF NOT EXISTS discussions (
    id TEXT PRIMARY KEY,
    mr_id INTEGER NOT NULL REFERENCES merge_requests(id) ON DELETE CASCADE,
    individual_note INTEGER NOT NULL,
    notes_json TEXT NOT NULL,       -- JSON array of notes
    cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discussions_mr ON discussions(mr_id);
