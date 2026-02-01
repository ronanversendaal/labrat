/**
 * Settings types for the frontend
 *
 * These types mirror the Rust backend types and match the
 * Tauri command contracts defined in tauri-commands.md
 */

/** Application theme */
export type Theme = 'light' | 'dark' | 'system';

/** Diff view mode */
export type DiffViewMode = 'unified' | 'split';

/** File view mode for file tree */
export type FileViewMode = 'flat' | 'tree';

/** Application settings */
export interface Settings {
  theme: Theme;
  mr_refresh_interval_seconds: number;
  cache_size_mb: number;
  ai_auto_analyze: boolean;
  default_ai_provider_id: string | null;
  sidebar_collapsed: boolean;
  diff_view_mode: DiffViewMode;
  show_whitespace: boolean;
  font_size: number;
  keyboard_shortcuts_enabled: boolean;
}

/** Request to update settings (partial update) */
export interface UpdateSettingsRequest {
  theme?: Theme;
  mr_refresh_interval_seconds?: number;
  cache_size_mb?: number;
  ai_auto_analyze?: boolean;
  default_ai_provider_id?: string | null;
  sidebar_collapsed?: boolean;
  diff_view_mode?: DiffViewMode;
  show_whitespace?: boolean;
  font_size?: number;
  keyboard_shortcuts_enabled?: boolean;
}

/** Cache statistics */
export interface CacheStats {
  total_size_bytes: number;
  mr_count: number;
  diff_count: number;
  suggestion_count: number;
  oldest_entry: string | null;
  newest_entry: string | null;
}

/** Request to clear cache */
export interface ClearCacheRequest {
  merge_requests?: boolean;
  diffs?: boolean;
  suggestions?: boolean;
  all?: boolean;
}

/** Response from evicting old cache entries */
export interface EvictCacheResponse {
  evicted_count: number;
  freed_bytes: number;
}

/** Tauri error response */
export interface TauriError {
  code: string;
  message: string;
  details?: unknown;
}

/** Common error codes */
export type ErrorCode =
  | 'not_authenticated'
  | 'network_error'
  | 'api_error'
  | 'rate_limited'
  | 'invalid_input'
  | 'not_found'
  | 'permission_denied'
  | 'ai_error'
  | 'cache_error'
  | 'invalid_token'
  | 'invalid_url'
  | 'duplicate_name';

/** Secure storage availability status */
export interface SecureStorageStatus {
  available: boolean;
  warning: string | null;
}
