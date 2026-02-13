/**
 * Tauri IPC service - typed wrapper for Tauri invoke
 *
 * This module provides type-safe wrappers for all Tauri commands,
 * ensuring consistent error handling and type safety between
 * the frontend and backend.
 */

import type {
  GitLabAccount,
  AddAccountRequest,
  ValidateTokenRequest,
  ValidateTokenResponse,
  ListMergeRequestsRequest,
  ListMergeRequestsResponse,
  MergeRequest,
  GetDiffRequest,
  Diff,
  Discussion,
  Note,
  PostCommentRequest,
  PostCommentResponse,
  RefreshRequest,
  ConnectionStatusEvent,
  ApprovalState,
  ApproveResponse,
  ReplyToDiscussionRequest,
  ResolveDiscussionRequest,
  MergeMrRequest,
  RebaseMrResponse,
} from '../types/gitlab';
import type {
  AIProvider,
  AIProviderType,
  AISuggestion,
  AddProviderRequest,
  AnalyzeDiffRequest,
  AnalyzeDiffResponse,
  UpdateSuggestionRequest,
  CliAvailableResponse,
  CliCheckResponse,
  ModelsResponse,
  ValidateCliPathResponse,
} from '../types/ai';
import type {
  Settings,
  UpdateSettingsRequest,
  CacheStats,
  ClearCacheRequest,
  EvictCacheResponse,
  TauriError,
  SecureStorageStatus,
} from '../types/settings';

/**
 * Detect whether we're running inside Tauri's webview
 */
function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/** API base URL for browser mode (configurable via env var) */
const API_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:3001';

/**
 * Custom error class for Tauri command errors
 */
export class TauriCommandError extends Error {
  code: string;
  details?: unknown;

  constructor(error: TauriError) {
    super(error.message);
    this.name = 'TauriCommandError';
    this.code = error.code;
    this.details = error.details;
  }
}

/**
 * Invoke a Tauri command with error handling.
 * In Tauri mode: uses IPC invoke().
 * In browser mode: uses fetch() to the HTTP web server.
 */
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    // Tauri mode — use IPC
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        throw new TauriCommandError(error as TauriError);
      }
      throw error;
    }
  } else {
    // Browser mode — use HTTP
    const response = await fetch(`${API_URL}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args: args ?? {} }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      if (errorBody && typeof errorBody === 'object' && 'code' in errorBody && 'message' in errorBody) {
        throw new TauriCommandError(errorBody as TauriError);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as T;
  }
}

// ============================================================================
// GitLab Commands
// ============================================================================

/**
 * List all configured GitLab accounts
 */
export async function listAccounts(): Promise<GitLabAccount[]> {
  return invokeCommand<GitLabAccount[]>('gitlab_list_accounts');
}

/**
 * Add a new GitLab account
 */
export async function addAccount(request: AddAccountRequest): Promise<GitLabAccount> {
  return invokeCommand<GitLabAccount>('gitlab_add_account', { request });
}

/**
 * Remove a GitLab account
 */
export async function removeAccount(accountId: string): Promise<void> {
  return invokeCommand<void>('gitlab_remove_account', { accountId });
}

/**
 * Set the active GitLab account
 */
export async function setActiveAccount(accountId: string): Promise<void> {
  return invokeCommand<void>('gitlab_set_active_account', { accountId });
}

/**
 * Validate a GitLab personal access token
 */
export async function validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
  return invokeCommand<ValidateTokenResponse>('gitlab_validate_token', { request });
}

/**
 * List merge requests for the active account
 */
export async function listMergeRequests(
  request: ListMergeRequestsRequest = {}
): Promise<ListMergeRequestsResponse> {
  return invokeCommand<ListMergeRequestsResponse>('gitlab_list_merge_requests', { request });
}

/**
 * Get full details for a single merge request
 */
export async function getMergeRequest(projectId: number, mrIid: number): Promise<MergeRequest> {
  return invokeCommand<MergeRequest>('gitlab_get_merge_request', { projectId, mrIid });
}

/**
 * Fetch the diff for a merge request
 */
export async function getDiff(request: GetDiffRequest): Promise<Diff> {
  return invokeCommand<Diff>('gitlab_get_diff', { request });
}

/**
 * Fetch discussions/comments for a merge request
 */
export async function getDiscussions(projectId: number, mrIid: number): Promise<Discussion[]> {
  return invokeCommand<Discussion[]>('gitlab_get_discussions', { projectId, mrIid });
}

/**
 * Post a comment or suggestion to a merge request
 */
export async function postComment(request: PostCommentRequest): Promise<PostCommentResponse> {
  return invokeCommand<PostCommentResponse>('gitlab_post_comment', { request });
}

/**
 * Fetch raw file content at a specific commit SHA
 */
export async function getFileContent(
  projectId: number,
  filePath: string,
  refSha: string
): Promise<string> {
  return invokeCommand<string>('gitlab_get_file_content', { projectId, filePath, refSha });
}

/**
 * Force refresh data from GitLab (bypass cache)
 */
export async function refresh(request: RefreshRequest = {}): Promise<void> {
  return invokeCommand<void>('gitlab_refresh', { request });
}

/**
 * Get the approval state for a merge request
 */
export async function getApprovalState(projectId: number, mrIid: number): Promise<ApprovalState> {
  return invokeCommand<ApprovalState>('gitlab_get_approval_state', { projectId, mrIid });
}

/**
 * Approve a merge request
 */
export async function approveMR(
  projectId: number,
  mrIid: number,
  sha?: string
): Promise<ApproveResponse> {
  return invokeCommand<ApproveResponse>('gitlab_approve_mr', { projectId, mrIid, sha });
}

/**
 * Remove approval from a merge request
 */
export async function unapproveMR(projectId: number, mrIid: number): Promise<ApproveResponse> {
  return invokeCommand<ApproveResponse>('gitlab_unapprove_mr', { projectId, mrIid });
}

/**
 * Reply to an existing discussion on a merge request
 */
export async function replyToDiscussion(request: ReplyToDiscussionRequest): Promise<Note> {
  return invokeCommand<Note>('gitlab_reply_to_discussion', { request });
}

/**
 * Resolve or unresolve a discussion on a merge request
 */
export async function resolveDiscussion(request: ResolveDiscussionRequest): Promise<void> {
  return invokeCommand<void>('gitlab_resolve_discussion', { request });
}

/**
 * Apply a suggestion from a merge request note
 */
export async function applySuggestion(
  projectId: number,
  mrIid: number,
  suggestionId: number,
  commitMessage?: string
): Promise<void> {
  return invokeCommand<void>('gitlab_apply_suggestion', {
    project_id: projectId,
    mr_iid: mrIid,
    suggestion_id: suggestionId,
    commit_message: commitMessage,
  });
}

/**
 * Merge a merge request
 */
export async function mergeMR(request: MergeMrRequest): Promise<MergeRequest> {
  return invokeCommand<MergeRequest>('gitlab_merge_mr', { request });
}

/**
 * Rebase a merge request
 */
export async function rebaseMR(projectId: number, mrIid: number): Promise<RebaseMrResponse> {
  return invokeCommand<RebaseMrResponse>('gitlab_rebase_mr', { projectId, mrIid });
}

// ============================================================================
// AI Commands
// ============================================================================

/**
 * List configured AI providers
 */
export async function listProviders(): Promise<AIProvider[]> {
  return invokeCommand<AIProvider[]>('ai_list_providers');
}

/**
 * Add or update an AI provider configuration
 */
export async function addProvider(request: AddProviderRequest): Promise<AIProvider> {
  return invokeCommand<AIProvider>('ai_add_provider', { request });
}

/**
 * Remove an AI provider
 */
export async function removeProvider(providerId: string): Promise<void> {
  return invokeCommand<void>('ai_remove_provider', { providerId });
}

/**
 * Set the default AI provider
 */
export async function setDefaultProvider(providerId: string): Promise<void> {
  return invokeCommand<void>('ai_set_default_provider', { providerId });
}

/**
 * Analyze a merge request diff with AI
 */
export async function analyzeDiff(request: AnalyzeDiffRequest): Promise<AnalyzeDiffResponse> {
  return invokeCommand<AnalyzeDiffResponse>('ai_analyze_diff', { request });
}

/**
 * Update the status of an AI suggestion
 */
export async function updateSuggestionStatus(request: UpdateSuggestionRequest): Promise<void> {
  return invokeCommand<void>('ai_update_suggestion_status', { request });
}

/**
 * Check if Claude CLI is available
 */
export async function checkCliAvailable(): Promise<CliAvailableResponse> {
  return invokeCommand<CliAvailableResponse>('ai_check_cli_available');
}

/**
 * Get AI suggestions for a merge request
 */
export async function getSuggestions(mrId: number): Promise<AISuggestion[]> {
  return invokeCommand<AISuggestion[]>('ai_get_suggestions', { mrId });
}

/**
 * Check if a specific CLI binary is available
 */
export async function checkCliBinary(
  providerType: AIProviderType,
  cliPath?: string
): Promise<CliCheckResponse> {
  return invokeCommand<CliCheckResponse>('ai_check_cli_binary', { providerType, cliPath });
}

/**
 * List available models for a provider
 */
export async function listModels(
  providerType: AIProviderType,
  providerId?: string,
  cliPath?: string,
  apiKey?: string
): Promise<ModelsResponse> {
  return invokeCommand<ModelsResponse>('ai_list_models', { providerType, providerId, cliPath, apiKey });
}

/**
 * Validate a CLI executable path
 */
export async function validateCliPath(path: string): Promise<ValidateCliPathResponse> {
  return invokeCommand<ValidateCliPathResponse>('ai_validate_cli_path', { path });
}

// ============================================================================
// Settings Commands
// ============================================================================

/**
 * Get all settings
 */
export async function getSettings(): Promise<Settings> {
  return invokeCommand<Settings>('settings_get');
}

/**
 * Update settings
 */
export async function updateSettings(request: UpdateSettingsRequest): Promise<Settings> {
  return invokeCommand<Settings>('settings_update', { request });
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<Settings> {
  return invokeCommand<Settings>('settings_reset');
}

// ============================================================================
// Cache Commands
// ============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  return invokeCommand<CacheStats>('cache_get_stats');
}

/**
 * Clear the cache
 */
export async function clearCache(request: ClearCacheRequest = {}): Promise<void> {
  return invokeCommand<void>('cache_clear', { request });
}

/**
 * Evict old cache entries to stay within size limit
 */
export async function evictOldCache(): Promise<EvictCacheResponse> {
  return invokeCommand<EvictCacheResponse>('cache_evict_old');
}

/**
 * Check connection status for a GitLab account
 */
export async function checkConnection(accountId: string): Promise<ConnectionStatusEvent> {
  return invokeCommand<ConnectionStatusEvent>('gitlab_check_connection', { accountId });
}

/**
 * Check if secure storage (keychain) is available
 */
export async function checkSecureStorage(): Promise<SecureStorageStatus> {
  return invokeCommand<SecureStorageStatus>('settings_check_secure_storage');
}

// ============================================================================
// Window commands
// ============================================================================

/**
 * Set native window background color (syncs titlebar/chrome with theme)
 */
export async function setWindowBgColor(r: number, g: number, b: number): Promise<void> {
  return invokeCommand<void>('set_window_bg_color', { r, g, b });
}

// ============================================================================
// Grouped API objects for convenience
// ============================================================================

/**
 * GitLab API functions
 */
export const gitlab = {
  listAccounts,
  addAccount,
  removeAccount,
  setActiveAccount,
  validateToken,
  listMergeRequests,
  getMergeRequest,
  getDiff,
  getFileContent,
  getDiscussions,
  postComment,
  refresh,
  getApprovalState,
  approveMR,
  unapproveMR,
  replyToDiscussion,
  resolveDiscussion,
  applySuggestion,
  mergeMR,
  rebaseMR,
};

/**
 * AI API functions
 */
export const ai = {
  listProviders,
  addProvider,
  removeProvider,
  setDefaultProvider,
  analyzeDiff,
  updateSuggestionStatus,
  checkCliAvailable,
  getSuggestions,
  checkCliBinary,
  listModels,
  validateCliPath,
};

/**
 * Settings API functions
 */
export const settings = {
  get: getSettings,
  update: updateSettings,
  reset: resetSettings,
};

/**
 * Cache API functions
 */
export const cache = {
  getStats: getCacheStats,
  clear: clearCache,
  evictOld: evictOldCache,
};
