/**
 * GeneralSettings - General application settings panel
 */

import { useState } from 'react';
import { useSettings, useUpdateSettings, useCacheStats, useClearCache, useEvictCache } from '../../hooks/useSettings';
import { Button, Skeleton } from '../common';
import { ThemePicker } from './ThemePicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { UI_FONT_OPTIONS, CODE_FONT_OPTIONS } from '../../types/settings';
import { DEFAULT_GENERATED_PATTERNS } from '../../utils/generatedFiles';
import type { DiffViewMode } from '../../types';

export function GeneralSettings() {
  const { isLoading: isLoadingSettings } = useSettings();
  const { data: cacheStats, isLoading: isLoadingCache } = useCacheStats();
  const updateSettings = useUpdateSettings();
  const clearCache = useClearCache();
  const evictCache = useEvictCache();

  const codeFontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamilyUI = useSettingsStore((s) => s.fontFamilyUI);
  const fontFamilyCode = useSettingsStore((s) => s.fontFamilyCode);
  const setFontFamilyUI = useSettingsStore((s) => s.setFontFamilyUI);
  const setFontFamilyCode = useSettingsStore((s) => s.setFontFamilyCode);

  const diffViewMode = useSettingsStore((s) => s.diffViewMode);
  const setDiffViewMode = useSettingsStore((s) => s.setDiffViewMode);
  const showWhitespace = useSettingsStore((s) => s.showWhitespace);
  const setShowWhitespace = useSettingsStore((s) => s.setShowWhitespace);
  const keyboardShortcutsEnabled = useSettingsStore((s) => s.keyboardShortcutsEnabled);
  const setKeyboardShortcutsEnabled = useSettingsStore((s) => s.setKeyboardShortcutsEnabled);
  const mrRefreshInterval = useSettingsStore((s) => s.mrRefreshInterval);
  const setMrRefreshInterval = useSettingsStore((s) => s.setMrRefreshInterval);
  const cacheSizeMb = useSettingsStore((s) => s.cacheSizeMb);
  const setCacheSizeMb = useSettingsStore((s) => s.setCacheSizeMb);
  const hideGeneratedFiles = useSettingsStore((s) => s.hideGeneratedFiles);
  const setHideGeneratedFiles = useSettingsStore((s) => s.setHideGeneratedFiles);
  const generatedFilePatterns = useSettingsStore((s) => s.generatedFilePatterns);
  const setGeneratedFilePatterns = useSettingsStore((s) => s.setGeneratedFilePatterns);

  // Local state for the patterns textarea (committed on blur)
  const [patternsText, setPatternsText] = useState(generatedFilePatterns.join('\n'));

  const handleDiffModeChange = (mode: DiffViewMode) => {
    setDiffViewMode(mode);
    updateSettings.mutate({ diff_view_mode: mode });
  };

  const handleRefreshIntervalChange = (seconds: number) => {
    setMrRefreshInterval(seconds);
    updateSettings.mutate({ mr_refresh_interval_seconds: seconds });
  };

  const handleCacheSizeChange = (mb: number) => {
    setCacheSizeMb(mb);
    updateSettings.mutate({ cache_size_mb: mb });
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    updateSettings.mutate({ font_size: size });
  };

  const handleFontFamilyUIChange = (font: string | null) => {
    setFontFamilyUI(font);
    updateSettings.mutate({ font_family_ui: font });
  };

  const handleFontFamilyCodeChange = (font: string | null) => {
    setFontFamilyCode(font);
    updateSettings.mutate({ font_family_code: font });
  };

  const handleWhitespaceToggle = (show: boolean) => {
    setShowWhitespace(show);
    updateSettings.mutate({ show_whitespace: show });
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
      {/* Theme */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Theme</h2>
        <div className="p-4 border border-edge rounded-lg">
          <ThemePicker />
        </div>
      </section>

      {/* Fonts */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Fonts</h2>
        <div className="space-y-4">
          {/* Code Font Size */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Code Font Size</p>
              <p className="text-sm text-content-secondary">Font size for diff view and code blocks</p>
            </div>
            <select
              value={codeFontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
            >
              <option value={12}>12px</option>
              <option value={13}>13px</option>
              <option value={14}>14px</option>
              <option value={15}>15px</option>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
            </select>
          </div>

          {/* UI Font Family Override */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">UI Font Override</p>
              <p className="text-sm text-content-secondary">Override the theme's default UI font</p>
            </div>
            <select
              value={fontFamilyUI ?? ''}
              onChange={(e) => handleFontFamilyUIChange(e.target.value || null)}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
            >
              {UI_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Code Font Family Override */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Code Font Override</p>
              <p className="text-sm text-content-secondary">Override the theme's default code font</p>
            </div>
            <select
              value={fontFamilyCode ?? ''}
              onChange={(e) => handleFontFamilyCodeChange(e.target.value || null)}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
            >
              {CODE_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Diff View */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Diff View</h2>
        <div className="space-y-4">
          {/* Diff Mode */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Diff View Mode</p>
              <p className="text-sm text-content-secondary">Choose how diffs are displayed</p>
            </div>
            <select
              value={diffViewMode}
              onChange={(e) => handleDiffModeChange(e.target.value as DiffViewMode)}
              className="px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
            >
              <option value="unified">Unified</option>
              <option value="split">Split</option>
            </select>
          </div>

          {/* Show Whitespace */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Show Whitespace</p>
              <p className="text-sm text-content-secondary">Display whitespace characters in diffs</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showWhitespace}
                onChange={(e) => handleWhitespaceToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Generated Files */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Generated Files</h2>
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
            <div>
              <p className="font-medium text-content">Hide Generated Files</p>
              <p className="text-sm text-content-secondary">Hide auto-generated files (lock files, minified bundles, etc.) from the diff view</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hideGeneratedFiles}
                onChange={(e) => setHideGeneratedFiles(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Patterns textarea */}
          <div className="p-4 border border-edge rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-content">File Patterns</p>
                <p className="text-sm text-content-secondary">Glob patterns to match generated files (one per line)</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setGeneratedFilePatterns(DEFAULT_GENERATED_PATTERNS);
                  setPatternsText(DEFAULT_GENERATED_PATTERNS.join('\n'));
                }}
              >
                Reset to Defaults
              </Button>
            </div>
            <textarea
              value={patternsText}
              onChange={(e) => setPatternsText(e.target.value)}
              onBlur={() => {
                const patterns = patternsText
                  .split('\n')
                  .map((p) => p.trim())
                  .filter(Boolean);
                setGeneratedFilePatterns(patterns);
              }}
              rows={8}
              className="w-full px-3 py-2 text-sm font-mono bg-surface border border-edge-strong rounded-md text-content resize-y"
              placeholder="*.lock&#10;*.min.js&#10;dist/**"
            />
          </div>
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
    </div>
  );
}
