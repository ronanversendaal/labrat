# Data Model: GitLab MR Review App

**Date**: 2026-01-31
**Feature**: 001-gitlab-mr-review-app

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│  GitLabAccount  │───────│     Project     │
└─────────────────┘  1:N  └─────────────────┘
         │                         │
         │                         │ 1:N
         │                         ▼
         │                ┌─────────────────┐
         │                │  MergeRequest   │
         │                └─────────────────┘
         │                         │
         │                    1:1  │  1:N
         │              ┌──────────┼──────────┐
         │              ▼          ▼          ▼
         │      ┌───────────┐ ┌────────┐ ┌──────────┐
         │      │   Diff    │ │ Author │ │Discussion│
         │      └───────────┘ └────────┘ └──────────┘
         │            │                        │
         │       1:N  │                   1:N  │
         │            ▼                        ▼
         │      ┌───────────┐           ┌──────────┐
         │      │ DiffFile  │           │  Note    │
         │      └───────────┘           └──────────┘
         │
         │      ┌─────────────────┐
         └──────│   AIProvider    │
           1:N  └─────────────────┘
                         │
                    1:N  │
                         ▼
                ┌─────────────────┐
                │  AISuggestion   │
                └─────────────────┘
```

## Core Entities

### GitLabAccount

Represents a configured GitLab instance connection.

```rust
pub struct GitLabAccount {
    pub id: Uuid,
    pub name: String,              // User-friendly name (e.g., "Work GitLab")
    pub instance_url: String,      // Base URL (e.g., "https://gitlab.com")
    pub username: String,          // Authenticated user's username
    pub user_id: i64,              // GitLab user ID
    pub avatar_url: Option<String>,
    pub is_active: bool,           // Currently selected account
    pub created_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
}
```

**Storage**: SQLite `gitlab_accounts` table
**Credentials**: Personal access token stored in OS keychain (key: `gitlab-mr-review:{account_id}`)

### Project

A GitLab project/repository.

```rust
pub struct Project {
    pub id: i64,                   // GitLab project ID
    pub account_id: Uuid,          // Foreign key to GitLabAccount
    pub path_with_namespace: String, // e.g., "group/subgroup/project"
    pub name: String,
    pub web_url: String,
    pub avatar_url: Option<String>,
    pub last_activity_at: DateTime<Utc>,
    pub cached_at: DateTime<Utc>,
}
```

**Storage**: SQLite `projects` table (cached from GitLab API)

### MergeRequest

The central entity representing a GitLab merge request.

```rust
pub struct MergeRequest {
    pub id: i64,                   // GitLab MR ID (global)
    pub iid: i64,                  // Project-scoped MR number
    pub project_id: i64,           // Foreign key to Project
    pub title: String,
    pub description: Option<String>,
    pub state: MRState,            // opened, closed, merged
    pub source_branch: String,
    pub target_branch: String,
    pub author: Author,
    pub assignees: Vec<Author>,
    pub reviewers: Vec<Author>,
    pub labels: Vec<String>,
    pub milestone: Option<Milestone>,
    pub web_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub merged_at: Option<DateTime<Utc>>,

    // Impediment tracking
    pub has_conflicts: bool,
    pub pipeline_status: Option<PipelineStatus>,
    pub draft: bool,
    pub blocking_discussions_resolved: bool,
    pub user_notes_count: i64,

    // Cache metadata
    pub cached_at: DateTime<Utc>,
    pub diff_cached: bool,
}

pub enum MRState {
    Opened,
    Closed,
    Merged,
}

pub enum PipelineStatus {
    Pending,
    Running,
    Success,
    Failed,
    Canceled,
    Skipped,
}
```

**Storage**: SQLite `merge_requests` table

### Author

User information (can be MR author, assignee, or reviewer).

```rust
pub struct Author {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub web_url: String,
}
```

**Storage**: Embedded in MergeRequest JSON or normalized to `users` table

### Diff

The complete diff for a merge request.

```rust
pub struct Diff {
    pub mr_id: i64,                // Foreign key to MergeRequest
    pub base_commit_sha: String,
    pub head_commit_sha: String,
    pub start_commit_sha: String,
    pub files: Vec<DiffFile>,
    pub cached_at: DateTime<Utc>,
}

pub struct DiffFile {
    pub old_path: String,
    pub new_path: String,
    pub diff: String,              // Unified diff format
    pub new_file: bool,
    pub renamed_file: bool,
    pub deleted_file: bool,
    pub generated_file: bool,
    pub additions: i64,
    pub deletions: i64,
}
```

**Storage**: SQLite `diffs` table (diff content may be compressed)

### Discussion

A discussion thread on a merge request.

```rust
pub struct Discussion {
    pub id: String,                // GitLab discussion ID
    pub mr_id: i64,
    pub notes: Vec<Note>,
    pub individual_note: bool,     // Single comment vs thread
}

pub struct Note {
    pub id: i64,
    pub discussion_id: String,
    pub author: Author,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved: bool,
    pub resolvable: bool,
    pub position: Option<DiffPosition>,
}

pub struct DiffPosition {
    pub base_sha: String,
    pub head_sha: String,
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub old_line: Option<i64>,
    pub new_line: Option<i64>,
    pub position_type: PositionType,
}

pub enum PositionType {
    Text,
    Image,
    File,
}
```

**Storage**: SQLite `discussions` and `notes` tables

### AIProvider

Configuration for an AI analysis backend.

```rust
pub struct AIProvider {
    pub id: Uuid,
    pub account_id: Uuid,          // Associated GitLab account (for scope)
    pub provider_type: AIProviderType,
    pub name: String,              // User-friendly name
    pub model: Option<String>,     // e.g., "claude-3-opus", "gpt-4"
    pub is_default: bool,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

pub enum AIProviderType {
    ClaudeCLI,                     // Uses local `claude` binary
    AnthropicAPI,                  // Direct Anthropic API
    OpenAIAPI,                     // Direct OpenAI API
}
```

**Storage**: SQLite `ai_providers` table
**API Keys**: Stored in OS keychain (key: `gitlab-mr-review:ai:{provider_id}`)

### AISuggestion

A code improvement suggestion generated by AI.

```rust
pub struct AISuggestion {
    pub id: Uuid,
    pub mr_id: i64,
    pub provider_id: Uuid,
    pub file_path: String,
    pub start_line: i64,
    pub end_line: i64,
    pub category: SuggestionCategory,
    pub severity: SuggestionSeverity,
    pub title: String,
    pub description: String,
    pub suggested_code: Option<String>,
    pub original_code: String,
    pub status: SuggestionStatus,
    pub created_at: DateTime<Utc>,
}

pub enum SuggestionCategory {
    CodeQuality,
    PotentialBug,
    Performance,
    Security,
    BestPractice,
    Readability,
    Documentation,
}

pub enum SuggestionSeverity {
    Info,
    Warning,
    Error,
}

pub enum SuggestionStatus {
    Pending,                       // Not yet reviewed
    Accepted,                      // User agreed, may post
    Dismissed,                     // User disagreed
    Posted,                        // Posted to GitLab
}
```

**Storage**: SQLite `ai_suggestions` table

### Settings

Application configuration.

```rust
pub struct Settings {
    // General
    pub theme: Theme,
    pub mr_refresh_interval_seconds: i64,  // Default: 300 (5 min)
    pub cache_size_mb: i64,                // Default: 500

    // AI
    pub ai_auto_analyze: bool,             // Default: true
    pub default_ai_provider_id: Option<Uuid>,

    // UI
    pub sidebar_collapsed: bool,
    pub diff_view_mode: DiffViewMode,      // Unified or Split
    pub show_whitespace: bool,
    pub font_size: i64,

    // Keyboard
    pub keyboard_shortcuts_enabled: bool,
}

pub enum Theme {
    Light,
    Dark,
    System,
}

pub enum DiffViewMode {
    Unified,
    Split,
}
```

**Storage**: SQLite `settings` table (single row)

### Milestone

Milestone information for MR grouping.

```rust
pub struct Milestone {
    pub id: i64,
    pub iid: i64,
    pub title: String,
    pub state: String,             // active, closed
    pub due_date: Option<NaiveDate>,
}
```

**Storage**: Embedded in MergeRequest or normalized

## SQLite Schema

```sql
-- GitLab Accounts
CREATE TABLE gitlab_accounts (
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
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES gitlab_accounts(id),
    path_with_namespace TEXT NOT NULL,
    name TEXT NOT NULL,
    web_url TEXT NOT NULL,
    avatar_url TEXT,
    last_activity_at TEXT NOT NULL,
    cached_at TEXT NOT NULL
);
CREATE INDEX idx_projects_account ON projects(account_id);

-- Merge Requests (cached)
CREATE TABLE merge_requests (
    id INTEGER PRIMARY KEY,
    iid INTEGER NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id),
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
CREATE INDEX idx_mr_project ON merge_requests(project_id);
CREATE INDEX idx_mr_updated ON merge_requests(updated_at);
CREATE INDEX idx_mr_state ON merge_requests(state);

-- Diffs (cached, potentially large)
CREATE TABLE diffs (
    mr_id INTEGER PRIMARY KEY REFERENCES merge_requests(id),
    base_commit_sha TEXT NOT NULL,
    head_commit_sha TEXT NOT NULL,
    start_commit_sha TEXT NOT NULL,
    files_json TEXT NOT NULL,       -- JSON array (compressed)
    cached_at TEXT NOT NULL
);

-- AI Providers
CREATE TABLE ai_providers (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES gitlab_accounts(id),
    provider_type TEXT NOT NULL,
    name TEXT NOT NULL,
    model TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

-- AI Suggestions
CREATE TABLE ai_suggestions (
    id TEXT PRIMARY KEY,
    mr_id INTEGER NOT NULL REFERENCES merge_requests(id),
    provider_id TEXT NOT NULL REFERENCES ai_providers(id),
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
CREATE INDEX idx_suggestions_mr ON ai_suggestions(mr_id);
CREATE INDEX idx_suggestions_status ON ai_suggestions(status);

-- Settings (single row)
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL DEFAULT 'system',
    mr_refresh_interval_seconds INTEGER NOT NULL DEFAULT 300,
    cache_size_mb INTEGER NOT NULL DEFAULT 500,
    ai_auto_analyze INTEGER NOT NULL DEFAULT 1,
    default_ai_provider_id TEXT REFERENCES ai_providers(id),
    sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
    diff_view_mode TEXT NOT NULL DEFAULT 'unified',
    show_whitespace INTEGER NOT NULL DEFAULT 0,
    font_size INTEGER NOT NULL DEFAULT 14,
    keyboard_shortcuts_enabled INTEGER NOT NULL DEFAULT 1
);

-- Initialize settings
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Filter presets (user-saved filters)
CREATE TABLE filter_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filters_json TEXT NOT NULL,    -- JSON blob of filter state
    created_at TEXT NOT NULL
);
```

## Validation Rules

### GitLabAccount
- `instance_url` must be valid HTTPS URL (or localhost for dev)
- `name` must be unique across accounts
- Only one account can have `is_active = true`

### MergeRequest
- `iid` is unique per project
- `state` must be one of: opened, closed, merged
- `pipeline_status` must be valid enum value if present

### AIProvider
- Only one provider per type per account can be default
- `model` required for API-based providers

### AISuggestion
- `start_line` <= `end_line`
- `category`, `severity`, `status` must be valid enum values

## State Transitions

### MergeRequest.state
```
opened → closed (author/admin closes)
opened → merged (MR merged)
closed → opened (reopened)
```

### AISuggestion.status
```
pending → accepted (user agrees)
pending → dismissed (user dismisses)
accepted → posted (user posts to GitLab)
dismissed → pending (user reconsiders - undo)
```

## Cache Invalidation

| Entity | Invalidation Trigger |
|--------|---------------------|
| Projects | Manual refresh, account switch |
| MergeRequests | `updated_at` changed, manual refresh, periodic poll |
| Diffs | MR `head_commit_sha` changed |
| AISuggestions | MR diff changed (invalidate all for that MR) |
