/**
 * GitLab API types for the frontend
 *
 * These types mirror the Rust backend types and match the
 * Tauri command contracts defined in tauri-commands.md
 */

/** A GitLab account configuration */
export interface GitLabAccount {
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

/** A GitLab project */
export interface Project {
  id: number;
  account_id: string;
  path_with_namespace: string;
  name: string;
  web_url: string;
  avatar_url: string | null;
  last_activity_at: string;
  cached_at?: string;
}

/** A user/author in GitLab */
export interface Author {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  web_url: string;
}

/** A milestone in GitLab */
export interface Milestone {
  id: number;
  iid: number;
  title: string;
  state: string;
  due_date: string | null;
}

/** Pipeline status values */
export type PipelineStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'scheduled'
  | 'created';

/** Merge request state */
export type MergeRequestState = 'opened' | 'closed' | 'merged';

/** Pipeline information */
export interface Pipeline {
  id: number;
  status: PipelineStatus;
  web_url: string;
}

/** A merge request */
export interface MergeRequest {
  id: number;
  iid: number;
  project_id: number;
  project_path?: string;
  project_name?: string;
  title: string;
  description: string | null;
  state: MergeRequestState;
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
  head_pipeline: Pipeline | null;
  draft: boolean;
  blocking_discussions_resolved: boolean;
  user_notes_count: number;
  cached_at?: string;
  diff_cached: boolean;
}

/** Type of diff line */
export type LineType = 'context' | 'addition' | 'deletion' | 'header';

/** A highlighted line in a diff */
export interface HighlightedLine {
  line_type: LineType;
  old_line: number | null;
  new_line: number | null;
  content: string;
  html: string;
}

/** A single file in a diff */
export interface DiffFile {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  generated_file: boolean;
  additions: number;
  deletions: number;
  highlighted_lines?: HighlightedLine[];
}

/** A diff for a merge request */
export interface Diff {
  mr_id: number;
  base_commit_sha: string;
  head_commit_sha: string;
  start_commit_sha: string;
  files: DiffFile[];
  cached_at?: string;
  total_additions?: number;
  total_deletions?: number;
  from_cache?: boolean;
}

/** Type of position in a diff */
export type PositionType = 'text' | 'image' | 'file';

/** Position of a comment in a diff */
export interface DiffPosition {
  old_path: string | null;
  new_path: string | null;
  old_line: number | null;
  new_line: number | null;
  position_type: PositionType;
}

/** A note (comment) in a discussion */
export interface Note {
  id: number;
  discussion_id: string;
  author: Author;
  body: string;
  body_html: string;
  created_at: string;
  updated_at: string;
  resolved: boolean;
  resolvable: boolean;
  position: DiffPosition | null;
}

/** A discussion on a merge request */
export interface Discussion {
  id: string;
  notes: Note[];
  individual_note: boolean;
}

/** Request to validate a GitLab token */
export interface ValidateTokenRequest {
  instance_url: string;
  access_token: string;
}

/** Response from token validation */
export interface ValidateTokenResponse {
  valid: boolean;
  username: string | null;
  user_id: number | null;
  scopes: string[];
  error: string | null;
}

/** Request to add a GitLab account */
export interface AddAccountRequest {
  name: string;
  instance_url: string;
  access_token: string;
}

/** Filter options for listing merge requests */
export interface MergeRequestFilter {
  project_id?: number;
  author_username?: string;
  labels?: string[];
  state?: MergeRequestState;
  has_conflicts?: boolean;
  pipeline_failed?: boolean;
  is_draft?: boolean;
}

/** Sort field for merge requests */
export type MergeRequestSortField = 'created_at' | 'updated_at' | 'title';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Sort options for listing merge requests */
export interface MergeRequestSort {
  field: MergeRequestSortField;
  direction: SortDirection;
}

/** Request to list merge requests */
export interface ListMergeRequestsRequest {
  filter?: MergeRequestFilter;
  sort?: MergeRequestSort;
  search?: string;
  use_cache?: boolean;
}

/** Response from listing merge requests */
export interface ListMergeRequestsResponse {
  merge_requests: MergeRequest[];
  from_cache: boolean;
  cached_at: string | null;
}

/** Request to get a diff */
export interface GetDiffRequest {
  project_id: number;
  mr_iid: number;
  use_cache?: boolean;
}

/** Position for a comment */
export interface CommentPosition {
  base_sha: string;
  head_sha: string;
  old_path?: string;
  new_path: string;
  old_line?: number;
  new_line: number;
  position_type: PositionType;
}

/** Request to post a comment */
export interface PostCommentRequest {
  project_id: number;
  mr_iid: number;
  body: string;
  position?: CommentPosition;
  as_suggestion?: boolean;
}

/** Response from posting a comment */
export interface PostCommentResponse {
  discussion_id: string;
  note_id: number;
  web_url: string;
}

/** Request to refresh data */
export interface RefreshRequest {
  merge_requests?: boolean;
  projects?: boolean;
  specific_mr?: {
    project_id: number;
    mr_iid: number;
  };
}

/** A saved filter preset */
export interface FilterPreset {
  id: string;
  name: string;
  filter: MergeRequestFilter;
  search_query: string | null;
  created_at: string;
}

/** Request to create a filter preset */
export interface CreateFilterPresetRequest {
  name: string;
  filter: MergeRequestFilter;
  search_query?: string;
}

/** A commit in GitLab */
export interface Commit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
}

/** Connection status for a GitLab account */
export type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'error';

/** Connection status event payload */
export interface ConnectionStatusEvent {
  account_id: string;
  status: ConnectionStatus;
  error: string | null;
  latency_ms: number | null;
}

/**
 * Snapshot of MR fields used to detect meaningful updates.
 * Used to avoid false "MR updated" notifications when only
 * metadata (like updated_at) changes without real changes.
 */
export interface MRChangeSnapshot {
  /** HEAD commit SHA - changes when code is updated */
  sha: string | null;
  /** MR state - opened, merged, closed */
  state: MergeRequestState;
  /** Number of comments - increases when discussions occur */
  user_notes_count: number;
  /** Conflict status */
  has_conflicts: boolean;
}

/** A user who has approved an MR */
export interface Approver {
  user: {
    id: number;
    username: string;
    name: string;
    avatar_url: string | null;
  };
  approved_at: string;
}

/** Approval state for a merge request */
export interface ApprovalState {
  /** Whether the MR is fully approved */
  approved: boolean;
  /** List of users who have approved */
  approved_by: Approver[];
  /** Total approvals required */
  approvals_required: number;
  /** Approvals still needed */
  approvals_left: number;
  /** Whether current user has approved */
  user_has_approved: boolean;
  /** Whether current user can approve (not author, has permission) */
  user_can_approve: boolean;
}

/** Response from approve/unapprove actions */
export interface ApproveResponse {
  approved: boolean;
  approvals_required: number;
  approvals_left: number;
}

/** Types of filter tokens for search-based filtering */
export type FilterType = 'author' | 'project' | 'status' | 'label' | 'text';

/** A parsed filter token from the search bar */
export interface ParsedFilter {
  /** Type of filter */
  type: FilterType;
  /** The filter value */
  value: string;
  /** Original raw text that was parsed */
  raw: string;
}
