/**
 * GeneralSettings - Updates, data, cache, and keyboard settings
 */

import { useSettings, useUpdateSettings, useCacheStats, useClearCache, useEvictCache } from '../../hooks/useSettings';
import { useUpdater } from '../../hooks/useUpdater';
import { Button, Skeleton } from '../common';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateStore } from '../../stores/updateStore';

export function GeneralSettings() {
  const { isLoading: isLoadingSettings } = useSettings();
  const { data: cacheStats, isLoading: isLoadingCache } = useCacheStats();
  const updateSettings = useUpdateSettings();
  const clearCache = useClearCache();
  const evictCache = useEvictCache();

  const keyboardShortcutsEnabled = useSettingsStore((s) => s.keyboardShortcutsEnabled);
  const setKeyboardShortcutsEnabled = useSettingsStore((s) => s.setKeyboardShortcutsEnabled);
  const mrRefreshInterval = useSettingsStore((s) => s.mrRefreshInterval);
  const setMrRefreshInterval = useSettingsStore((s) => s.setMrRefreshInterval);
  const cacheSizeMb = useSettingsStore((s) => s.cacheSizeMb);
  const setCacheSizeMb = useSettingsStore((s) => s.setCacheSizeMb);
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates);
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates);

  const updateStatus = useUpdateStore((s) => s.status);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const updateError = useUpdateStore((s) => s.error);
  const lastChecked = useUpdateStore((s) => s.lastChecked);

  const { checkForUpdate, downloadAndInstall, restartApp } = useUpdater();

  const handleRefreshIntervalChange = (seconds: number) => {
    setMrRefreshInterval(seconds);
    updateSettings.mutate({ mr_refresh_interval_seconds: seconds });
  };

  const handleCacheSizeChange = (mb: number) => {
    setCacheSizeMb(mb);
    updateSettings.mutate({ cache_size_mb: mb });
  };

  const handleKeyboardShortcutsToggle = (enabled: boolean) => {
    setKeyboardShortcutsEnabled(enabled);
    updateSettings.mutate({ keyboard_shortcuts_enabled: enabled });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const progressPercent =
    downloadProgress?.contentLength && downloadProgress.contentLength > 0
      ? Math.round((downloadProgress.totalDownloaded / downloadProgress.contentLength) * 100)
      : null;

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
      {/* Updates */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Updates</h2>
        <div className="space-y-4">
          {/* Current version + check button */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">v0.1.1</p>
              <p className="text-sm text-content-secondary">Current version</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={checkForUpdate}
              loading={updateStatus === 'checking'}
            >
              Check for Updates
            </Button>
          </div>

          {/* Auto-check toggle */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Automatic Updates</p>
              <p className="text-sm text-content-secondary">
                Check for updates when the app starts
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={(e) => setAutoCheckUpdates(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Update available card */}
          {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'ready') && updateInfo && (
            <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-content">v{updateInfo.version}</p>
                  {updateInfo.date && (
                    <p className="text-sm text-content-secondary">
                      {new Date(updateInfo.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {updateStatus === 'available' && (
                  <Button variant="primary" size="sm" onClick={downloadAndInstall}>
                    Download & Install
                  </Button>
                )}
                {updateStatus === 'ready' && (
                  <Button variant="primary" size="sm" onClick={restartApp}>
                    Restart Now
                  </Button>
                )}
              </div>

              {/* Download progress */}
              {updateStatus === 'downloading' && (
                <div className="space-y-1">
                  <div className="w-full bg-surface-alt rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent ?? 0}%` }}
                    />
                  </div>
                  {progressPercent !== null && (
                    <p className="text-xs text-content-secondary text-right">{progressPercent}%</p>
                  )}
                </div>
              )}

              {/* Release notes */}
              {updateInfo.body && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-content-secondary hover:text-content">
                    Release notes
                  </summary>
                  <div className="mt-2 text-content-secondary whitespace-pre-wrap text-xs leading-relaxed">
                    {updateInfo.body}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Error state */}
          {updateStatus === 'error' && updateError && (
            <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-400">Update check failed</p>
                  <p className="text-sm text-content-secondary mt-1">{updateError}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={checkForUpdate}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Last checked */}
          {updateStatus === 'idle' && lastChecked && (
            <p className="text-xs text-content-secondary">
              Last checked: {lastChecked.toLocaleString()}
            </p>
          )}
        </div>
      </section>

      {/* Keyboard */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Keyboard</h2>
        <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
          <div>
            <p className="font-medium text-content">Keyboard Shortcuts</p>
            <p className="text-sm text-content-secondary">
              Enable keyboard shortcuts for navigation (press ? to see shortcuts)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={keyboardShortcutsEnabled}
              onChange={(e) => handleKeyboardShortcutsToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </section>

      {/* Data & Sync */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Data & Sync</h2>
        <div className="space-y-4">
          {/* Refresh Interval */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Auto-Refresh Interval</p>
              <p className="text-sm text-content-secondary">How often to check for MR updates</p>
            </div>
            <select
              value={mrRefreshInterval}
              onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
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
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Maximum Cache Size</p>
              <p className="text-sm text-content-secondary">Limit for cached MR data</p>
            </div>
            <select
              value={cacheSizeMb}
              onChange={(e) => handleCacheSizeChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
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
        <h2 className="text-lg font-medium text-content mb-4">Cache Management</h2>
        {isLoadingCache ? (
          <Skeleton variant="rectangular" height={120} />
        ) : (
          <div className="p-4 border border-edge rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-content-secondary">Total Size</p>
                <p className="font-medium text-content">
                  {formatBytes(cacheStats?.total_size_bytes ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-content-secondary">Merge Requests</p>
                <p className="font-medium text-content">{cacheStats?.mr_count ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-content-secondary">Diffs</p>
                <p className="font-medium text-content">{cacheStats?.diff_count ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-content-secondary">AI Suggestions</p>
                <p className="font-medium text-content">{cacheStats?.suggestion_count ?? 0}</p>
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
    </div>
  );
}
