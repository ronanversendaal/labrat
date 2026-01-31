# Tauri IPC Commands Contract

**Date**: 2026-01-31
**Feature**: 001-gitlab-mr-review-app

This document defines the contract between the TypeScript frontend and Rust backend via Tauri's IPC command system.

## Command Naming Convention

All commands follow the pattern: `{domain}_{action}`

## GitLab Commands

### gitlab_list_accounts

List all configured GitLab accounts.

```typescript
// Request
invoke('gitlab_list_accounts')

// Response
interface GitLabAccount {
  id: string;
  name: string;
  instance_url: string;
  username: string;
  user_id: number;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string;
}
type Response = GitLabAccount[];
```

### gitlab_add_account

Add a new GitLab account.

```typescript
// Request
interface AddAccountRequest {
  name: string;
  instance_url: string;
  access_token: string;
}
invoke('gitlab_add_account', { request })

// Response
interface Response {
  account: GitLabAccount;
}

// Errors
// - "invalid_token": Token validation failed
// - "invalid_url": URL is not a valid GitLab instance
// - "duplicate_name": Account name already exists
```

### gitlab_remove_account

Remove a GitLab account and all associated data.

```typescript
invoke('gitlab_remove_account', { accountId: string })
// Response: void (success) or error
```

### gitlab_set_active_account

Switch the active GitLab account.

```typescript
invoke('gitlab_set_active_account', { accountId: string })
// Response: void (success) or error
```

### gitlab_validate_token

Validate a GitLab personal access token.

```typescript
interface ValidateTokenRequest {
  instance_url: string;
  access_token: string;
}
invoke('gitlab_validate_token', { request })

// Response
interface ValidateTokenResponse {
  valid: boolean;
  username: string | null;
  user_id: number | null;
  scopes: string[];
  error: string | null;
}
```

### gitlab_list_merge_requests

Fetch merge requests for the active account.

```typescript
interface ListMRsRequest {
  filter?: {
    project_id?: number;
    author_username?: string;
    labels?: string[];
    state?: 'opened' | 'closed' | 'merged';
    has_conflicts?: boolean;
    pipeline_failed?: boolean;
    is_draft?: boolean;
  };
  sort?: {
    field: 'created_at' | 'updated_at' | 'title';
    direction: 'asc' | 'desc';
  };
  search?: string;
  use_cache?: boolean;  // Default: true
}
invoke('gitlab_list_merge_requests', { request })

// Response
interface MergeRequest {
  id: number;
  iid: number;
  project_id: number;
  project_path: string;
  project_name: string;
  title: string;
  description: string | null;
  state: 'opened' | 'closed' | 'merged';
  source_branch: string;
  target_branch: string;
  author: Author;
  assignees: Author[];
  reviewers: Author[];
  labels: string[];
  milestone: Milestone | null;
  web_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  has_conflicts: boolean;
  pipeline_status: PipelineStatus | null;
  draft: boolean;
  blocking_discussions_resolved: boolean;
  user_notes_count: number;
}

interface Author {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  web_url: string;
}

interface Milestone {
  id: number;
  iid: number;
  title: string;
  state: string;
  due_date: string | null;
}

type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

interface ListMRsResponse {
  merge_requests: MergeRequest[];
  from_cache: boolean;
  cached_at: string | null;
}
```

### gitlab_get_merge_request

Get full details for a single merge request.

```typescript
invoke('gitlab_get_merge_request', { projectId: number, mrIid: number })

// Response: MergeRequest (same as above)
```

### gitlab_get_diff

Fetch the diff for a merge request.

```typescript
interface GetDiffRequest {
  project_id: number;
  mr_iid: number;
  use_cache?: boolean;
}
invoke('gitlab_get_diff', { request })

// Response
interface DiffFile {
  old_path: string;
  new_path: string;
  diff: string;  // Unified diff format
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  generated_file: boolean;
  additions: number;
  deletions: number;
  // Pre-processed for display
  highlighted_diff?: HighlightedLine[];
}

interface HighlightedLine {
  type: 'context' | 'addition' | 'deletion' | 'header';
  old_line: number | null;
  new_line: number | null;
  content: string;
  html: string;  // Syntax-highlighted HTML
}

interface Diff {
  mr_id: number;
  base_commit_sha: string;
  head_commit_sha: string;
  files: DiffFile[];
  total_additions: number;
  total_deletions: number;
  from_cache: boolean;
}
```

### gitlab_get_discussions

Fetch discussions/comments for a merge request.

```typescript
invoke('gitlab_get_discussions', { projectId: number, mrIid: number })

// Response
interface Discussion {
  id: string;
  notes: Note[];
  individual_note: boolean;
}

interface Note {
  id: number;
  discussion_id: string;
  author: Author;
  body: string;
  body_html: string;  // Rendered markdown
  created_at: string;
  updated_at: string;
  resolved: boolean;
  resolvable: boolean;
  position: DiffPosition | null;
}

interface DiffPosition {
  old_path: string | null;
  new_path: string | null;
  old_line: number | null;
  new_line: number | null;
  position_type: 'text' | 'image' | 'file';
}

type Response = Discussion[];
```

### gitlab_post_comment

Post a comment or suggestion to a merge request.

```typescript
interface PostCommentRequest {
  project_id: number;
  mr_iid: number;
  body: string;
  position?: {
    base_sha: string;
    head_sha: string;
    old_path?: string;
    new_path: string;
    old_line?: number;
    new_line: number;
    position_type: 'text';
  };
  // If true, wraps body in GitLab suggestion syntax
  as_suggestion?: boolean;
}
invoke('gitlab_post_comment', { request })

// Response
interface PostCommentResponse {
  discussion_id: string;
  note_id: number;
  web_url: string;
}
```

### gitlab_refresh

Force refresh data from GitLab (bypass cache).

```typescript
interface RefreshRequest {
  merge_requests?: boolean;
  projects?: boolean;
  specific_mr?: { project_id: number; mr_iid: number };
}
invoke('gitlab_refresh', { request })
// Response: void
```

## AI Commands

### ai_list_providers

List configured AI providers.

```typescript
invoke('ai_list_providers')

// Response
interface AIProvider {
  id: string;
  provider_type: 'claude_cli' | 'anthropic_api' | 'openai_api';
  name: string;
  model: string | null;
  is_default: boolean;
  enabled: boolean;
  is_available: boolean;  // e.g., CLI found in PATH
}
type Response = AIProvider[];
```

### ai_add_provider

Add or update an AI provider configuration.

```typescript
interface AddProviderRequest {
  provider_type: 'claude_cli' | 'anthropic_api' | 'openai_api';
  name: string;
  model?: string;
  api_key?: string;  // Required for API types
  cli_path?: string; // Optional override for claude_cli
}
invoke('ai_add_provider', { request })

// Response
interface Response {
  provider: AIProvider;
}
```

### ai_remove_provider

Remove an AI provider.

```typescript
invoke('ai_remove_provider', { providerId: string })
// Response: void
```

### ai_set_default_provider

Set the default AI provider.

```typescript
invoke('ai_set_default_provider', { providerId: string })
// Response: void
```

### ai_analyze_diff

Analyze a merge request diff with AI.

```typescript
interface AnalyzeDiffRequest {
  project_id: number;
  mr_iid: number;
  provider_id?: string;  // Uses default if not specified
}
invoke('ai_analyze_diff', { request })

// Response (streamed via events, final response below)
interface AISuggestion {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  category: 'code_quality' | 'potential_bug' | 'performance' | 'security' | 'best_practice' | 'readability' | 'documentation';
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  suggested_code: string | null;
  original_code: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'posted';
}

interface AnalyzeDiffResponse {
  suggestions: AISuggestion[];
  provider_used: string;
  analysis_time_ms: number;
}

// Progress events emitted during analysis
// Event: 'ai:analysis_progress'
interface AnalysisProgressEvent {
  mr_id: number;
  status: 'started' | 'processing' | 'completed' | 'error';
  progress: number;  // 0-100
  message: string;
}
```

### ai_update_suggestion_status

Update the status of an AI suggestion.

```typescript
interface UpdateSuggestionRequest {
  suggestion_id: string;
  status: 'accepted' | 'dismissed' | 'pending';
}
invoke('ai_update_suggestion_status', { request })
// Response: void
```

### ai_check_cli_available

Check if Claude CLI is available.

```typescript
invoke('ai_check_cli_available')

// Response
interface Response {
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}
```

## Settings Commands

### settings_get

Get all settings.

```typescript
invoke('settings_get')

// Response
interface Settings {
  theme: 'light' | 'dark' | 'system';
  mr_refresh_interval_seconds: number;
  cache_size_mb: number;
  ai_auto_analyze: boolean;
  default_ai_provider_id: string | null;
  sidebar_collapsed: boolean;
  diff_view_mode: 'unified' | 'split';
  show_whitespace: boolean;
  font_size: number;
  keyboard_shortcuts_enabled: boolean;
}
```

### settings_update

Update settings.

```typescript
interface UpdateSettingsRequest {
  theme?: 'light' | 'dark' | 'system';
  mr_refresh_interval_seconds?: number;
  cache_size_mb?: number;
  ai_auto_analyze?: boolean;
  default_ai_provider_id?: string | null;
  sidebar_collapsed?: boolean;
  diff_view_mode?: 'unified' | 'split';
  show_whitespace?: boolean;
  font_size?: number;
  keyboard_shortcuts_enabled?: boolean;
}
invoke('settings_update', { request })
// Response: Settings (updated)
```

### settings_reset

Reset settings to defaults.

```typescript
invoke('settings_reset')
// Response: Settings (defaults)
```

## Cache Commands

### cache_get_stats

Get cache statistics.

```typescript
invoke('cache_get_stats')

// Response
interface CacheStats {
  total_size_bytes: number;
  mr_count: number;
  diff_count: number;
  suggestion_count: number;
  oldest_entry: string | null;
  newest_entry: string | null;
}
```

### cache_clear

Clear the cache.

```typescript
interface ClearCacheRequest {
  merge_requests?: boolean;
  diffs?: boolean;
  suggestions?: boolean;
  all?: boolean;
}
invoke('cache_clear', { request })
// Response: void
```

### cache_evict_old

Evict old cache entries to stay within size limit.

```typescript
invoke('cache_evict_old')
// Response: { evicted_count: number; freed_bytes: number }
```

## Events (Backend → Frontend)

### mr:list_updated

Emitted when MR list is refreshed in background.

```typescript
interface MRListUpdatedEvent {
  count: number;
  new_count: number;
  updated_count: number;
}
```

### mr:updated

Emitted when a specific MR is updated.

```typescript
interface MRUpdatedEvent {
  project_id: number;
  mr_iid: number;
  changes: ('status' | 'pipeline' | 'discussions' | 'diff')[];
}
```

### ai:analysis_progress

Emitted during AI analysis (see above).

### connection:status

Emitted when connection status changes.

```typescript
interface ConnectionStatusEvent {
  account_id: string;
  status: 'connected' | 'disconnected' | 'error';
  error: string | null;
}
```

### cache:size_warning

Emitted when cache approaches size limit.

```typescript
interface CacheSizeWarningEvent {
  current_size_bytes: number;
  limit_bytes: number;
  percentage: number;
}
```

## Error Handling

All commands may return errors in this format:

```typescript
interface TauriError {
  code: string;      // Machine-readable error code
  message: string;   // Human-readable message
  details?: any;     // Additional context
}

// Common error codes:
// - "not_authenticated": No active GitLab account
// - "network_error": Failed to reach GitLab
// - "api_error": GitLab API returned error
// - "rate_limited": Hit GitLab rate limit
// - "invalid_input": Invalid request parameters
// - "not_found": Resource not found
// - "permission_denied": Insufficient permissions
// - "ai_error": AI analysis failed
// - "cache_error": Cache operation failed
```
