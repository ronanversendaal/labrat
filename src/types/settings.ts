/**
 * Settings types for the frontend
 *
 * These types mirror the Rust backend types and match the
 * Tauri command contracts defined in tauri-commands.md
 */

/** Theme identifier */
export type ThemeId =
  | 'system'
  | 'default-light'
  | 'default-dark'
  | 'kanagawa'
  | 'catppuccin-mocha'
  | 'rose-pine'
  | 'tokyo-night'
  | 'nord'
  | 'everforest-dark'
  | 'dracula'
  | 'github-light'
  | 'solarized-light'
  | 'gruvbox-light'
  | 'everforest-light'
  | 'catppuccin-latte'
  | 'rose-pine-dawn'
  | 'one-light';

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
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    type: 'dark',
    colors: { canvas: '#1a1b26', surface: '#24283b', primary: '#7aa2f7', content: '#a9b1d6', contentSecondary: '#565f89' },
    fonts: { ui: 'Inter', code: 'JetBrains Mono' },
  },
  {
    id: 'nord',
    label: 'Nord',
    type: 'dark',
    colors: { canvas: '#2e3440', surface: '#3b4252', primary: '#88c0d0', content: '#d8dee9', contentSecondary: '#4c566a' },
    fonts: { ui: 'Inter', code: 'Fira Code' },
  },
  {
    id: 'everforest-dark',
    label: 'Everforest Dark',
    type: 'dark',
    colors: { canvas: '#2d353b', surface: '#343f44', primary: '#a7c080', content: '#d3c6aa', contentSecondary: '#7a8478' },
    fonts: { ui: 'System Sans', code: 'Source Code Pro' },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    type: 'dark',
    colors: { canvas: '#282a36', surface: '#343746', primary: '#bd93f9', content: '#f8f8f2', contentSecondary: '#6272a4' },
    fonts: { ui: 'System Sans', code: 'Fira Code' },
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    type: 'light',
    colors: { canvas: '#ffffff', surface: '#f6f8fa', primary: '#0969da', content: '#1f2328', contentSecondary: '#6a737d' },
    fonts: { ui: 'System Sans', code: 'SF Mono' },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    type: 'light',
    colors: { canvas: '#fdf6e3', surface: '#eee8d5', primary: '#268bd2', content: '#657b83', contentSecondary: '#93a1a1' },
    fonts: { ui: 'Georgia', code: 'Source Code Pro' },
  },
  {
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    type: 'light',
    colors: { canvas: '#fbf1c7', surface: '#ebdbb2', primary: '#d65d0e', content: '#3c3836', contentSecondary: '#928374' },
    fonts: { ui: 'System Sans', code: 'IBM Plex Mono' },
  },
  {
    id: 'everforest-light',
    label: 'Everforest Light',
    type: 'light',
    colors: { canvas: '#fdf6e3', surface: '#efebd4', primary: '#8da101', content: '#5c6a72', contentSecondary: '#939f91' },
    fonts: { ui: 'System Sans', code: 'Source Code Pro' },
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    type: 'light',
    colors: { canvas: '#eff1f5', surface: '#e6e9ef', primary: '#1e66f5', content: '#4c4f69', contentSecondary: '#8c8fa1' },
    fonts: { ui: 'Inter', code: 'Cascadia Code' },
  },
  {
    id: 'rose-pine-dawn',
    label: 'Ros\u00e9 Pine Dawn',
    type: 'light',
    colors: { canvas: '#faf4ed', surface: '#f2e9e1', primary: '#907aa9', content: '#575279', contentSecondary: '#9893a5' },
    fonts: { ui: 'Inter', code: 'Victor Mono' },
  },
  {
    id: 'one-light',
    label: 'One Light',
    type: 'light',
    colors: { canvas: '#fafafa', surface: '#f0f0f0', primary: '#4078f2', content: '#383a42', contentSecondary: '#a0a1a7' },
    fonts: { ui: 'System Sans', code: 'JetBrains Mono' },
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
