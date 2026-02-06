/**
 * Settings types for the frontend
 *
 * These types mirror the Rust backend types and match the
 * Tauri command contracts defined in tauri-commands.md
 */

/** Theme identifier */
export type ThemeId = 'system' | 'default-light' | 'default-dark' | 'kanagawa' | 'catppuccin-mocha' | 'rose-pine';

/** Application theme — alias for backward compat */
export type Theme = ThemeId;

/** Diff view mode */
export type DiffViewMode = 'unified' | 'split';

/** File view mode for file tree */
export type FileViewMode = 'flat' | 'tree';

/** Whether a theme is light or dark */
export type ThemeType = 'light' | 'dark';

/** A selectable font option */
export interface FontOption {
  label: string;
  /** null = theme default */
  value: string | null;
}

/** UI font options (sans-serif + serif) */
export const UI_FONT_OPTIONS: FontOption[] = [
  { label: 'Theme default', value: null },
  { label: 'System Sans', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif" },
  { label: 'Noto Serif', value: "'Noto Serif', Georgia, serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
];

/** Code/mono font options */
export const CODE_FONT_OPTIONS: FontOption[] = [
  { label: 'Theme default', value: null },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { label: 'Victor Mono', value: "'Victor Mono', monospace" },
  { label: 'SF Mono', value: "'SF Mono', Menlo, monospace" },
  { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
];

/** Metadata about each theme for the picker UI */
export interface ThemeMeta {
  id: ThemeId;
  label: string;
  type: ThemeType;
  colors: {
    canvas: string;
    surface: string;
    primary: string;
    content: string;
    contentSecondary: string;
  };
  fonts: {
    ui: string;
    code: string;
  };
}

export const THEME_LIST: ThemeMeta[] = [
  {
    id: 'default-light',
    label: 'Default Light',
    type: 'light',
    colors: { canvas: '#ffffff', surface: '#f8fafc', primary: '#2563eb', content: '#1e293b', contentSecondary: '#64748b' },
    fonts: { ui: 'System Sans', code: 'JetBrains Mono' },
  },
  {
    id: 'default-dark',
    label: 'Default Dark',
    type: 'dark',
    colors: { canvas: '#111827', surface: '#1f2937', primary: '#3b82f6', content: '#f1f5f9', contentSecondary: '#94a3b8' },
    fonts: { ui: 'System Sans', code: 'JetBrains Mono' },
  },
  {
    id: 'kanagawa',
    label: 'Kanagawa Wave',
    type: 'dark',
    colors: { canvas: '#1f1f28', surface: '#2a2a37', primary: '#7e9cd8', content: '#dcd7ba', contentSecondary: '#c8c093' },
    fonts: { ui: 'Noto Serif', code: 'IBM Plex Mono' },
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    type: 'dark',
    colors: { canvas: '#1e1e2e', surface: '#313244', primary: '#89b4fa', content: '#cdd6f4', contentSecondary: '#a6adc8' },
    fonts: { ui: 'Inter', code: 'Cascadia Code' },
  },
  {
    id: 'rose-pine',
    label: 'Ros\u00e9 Pine',
    type: 'dark',
    colors: { canvas: '#191724', surface: '#1f1d2e', primary: '#c4a7e7', content: '#e0def4', contentSecondary: '#908caa' },
    fonts: { ui: 'Inter', code: 'Victor Mono' },
  },
];

/** Resolve 'system' to an actual theme based on OS preference */
export function resolveThemeId(theme: ThemeId, prefersDark: boolean): Exclude<ThemeId, 'system'> {
  if (theme === 'system') {
    return prefersDark ? 'default-dark' : 'default-light';
  }
  return theme;
}

/** Get the ThemeType for a given theme id */
export function getThemeType(themeId: Exclude<ThemeId, 'system'>): ThemeType {
  const meta = THEME_LIST.find((t) => t.id === themeId);
  return meta?.type ?? 'dark';
}

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
  font_family_ui: string | null;
  font_family_code: string | null;
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
  font_family_ui?: string | null;
  font_family_code?: string | null;
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
