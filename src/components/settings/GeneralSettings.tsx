/**
 * GeneralSettings - General application settings panel
 */

import { useSettings, useUpdateSettings, useCacheStats, useClearCache, useEvictCache } from '../../hooks/useSettings';
import { Button, Skeleton } from '../common';
import type { Theme, DiffViewMode } from '../../types';

export function GeneralSettings() {
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const { data: cacheStats, isLoading: isLoadingCache } = useCacheStats();
  const updateSettings = useUpdateSettings();
  const clearCache = useClearCache();
  const evictCache = useEvictCache();

  const handleThemeChange = (theme: Theme) => {
    updateSettings.mutate({ theme });
  };

  const handleDiffModeChange = (mode: DiffViewMode) => {
    updateSettings.mutate({ diff_view_mode: mode });
  };

  const handleRefreshIntervalChange = (seconds: number) => {
    updateSettings.mutate({ mr_refresh_interval_seconds: seconds });
  };

  const handleCacheSizeChange = (mb: number) => {
    updateSettings.mutate({ cache_size_mb: mb });
  };

  const handleFontSizeChange = (size: number) => {
    updateSettings.mutate({ font_size: size });
  };

  const handleWhitespaceToggle = (show: boolean) => {
    updateSettings.mutate({ show_whitespace: show });
  };

  const handleKeyboardShortcutsToggle = (enabled: boolean) => {
    updateSettings.mutate({ keyboard_shortcuts_enabled: enabled });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="rectangular" height={200} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Appearance</h2>
        <div className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Theme</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred color scheme</p>
            </div>
            <select
              value={settings?.theme ?? 'system'}
              onChange={(e) => handleThemeChange(e.target.value as Theme)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Code Font Size</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Font size for diff view and code blocks</p>
            </div>
            <select
              value={settings?.font_size ?? 14}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value={12}>12px</option>
              <option value={13}>13px</option>
              <option value={14}>14px</option>
              <option value={15}>15px</option>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
            </select>
          </div>
        </div>
      </section>

      {/* Diff View */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Diff View</h2>
        <div className="space-y-4">
          {/* Diff Mode */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Diff View Mode</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose how diffs are displayed</p>
            </div>
            <select
              value={settings?.diff_view_mode ?? 'unified'}
              onChange={(e) => handleDiffModeChange(e.target.value as DiffViewMode)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="unified">Unified</option>
              <option value="split">Split</option>
            </select>
          </div>

          {/* Show Whitespace */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Show Whitespace</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Display whitespace characters in diffs</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.show_whitespace ?? false}
                onChange={(e) => handleWhitespaceToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Data & Sync */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data & Sync</h2>
        <div className="space-y-4">
          {/* Refresh Interval */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Auto-Refresh Interval</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">How often to check for MR updates</p>
            </div>
            <select
              value={settings?.mr_refresh_interval_seconds ?? 300}
              onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value={60}>1 minute</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={1800}>30 minutes</option>
              <option value={0}>Manual only</option>
            </select>
          </div>

          {/* Cache Size */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Maximum Cache Size</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Limit for cached MR data</p>
            </div>
            <select
              value={settings?.cache_size_mb ?? 500}
              onChange={(e) => handleCacheSizeChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value={100}>100 MB</option>
              <option value={250}>250 MB</option>
              <option value={500}>500 MB</option>
              <option value={1000}>1 GB</option>
              <option value={2000}>2 GB</option>
            </select>
          </div>
        </div>
      </section>

      {/* Cache Management */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Cache Management</h2>
        {isLoadingCache ? (
          <Skeleton variant="rectangular" height={120} />
        ) : (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Size</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatBytes(cacheStats?.total_size_bytes ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Merge Requests</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{cacheStats?.mr_count ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Diffs</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{cacheStats?.diff_count ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI Suggestions</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{cacheStats?.suggestion_count ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => evictCache.mutate()}
                loading={evictCache.isPending}
              >
                Evict Old Entries
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => clearCache.mutate({ all: true })}
                loading={clearCache.isPending}
              >
                Clear All Cache
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Keyboard */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Keyboard</h2>
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Keyboard Shortcuts</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enable keyboard shortcuts for navigation (press ? to see shortcuts)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.keyboard_shortcuts_enabled ?? true}
              onChange={(e) => handleKeyboardShortcutsToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </section>
    </div>
  );
}
