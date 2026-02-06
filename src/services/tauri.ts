/**
 * Tauri IPC service - typed wrapper for Tauri invoke
 *
 * This module provides type-safe wrappers for all Tauri commands,
 * ensuring consistent error handling and type safety between
 * the frontend and backend.
 */

import { invoke } from '@tauri-apps/api/core';
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
} from '../types/gitlab';
import type {
  AIProvider,
  AISuggestion,
  AddProviderRequest,
  AnalyzeDiffRequest,
  AnalyzeDiffResponse,
  UpdateSuggestionRequest,
  CliAvailableResponse,
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
 * Invoke a Tauri command with error handling
 */
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Tauri errors come as objects with code/message
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      throw new TauriCommandError(error as TauriError);
    }
    // Re-throw unknown errors
    throw error;
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
