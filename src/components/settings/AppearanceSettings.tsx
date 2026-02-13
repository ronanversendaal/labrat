/**
 * AppearanceSettings - Theme, fonts, diff view, and generated file settings
 */

import { useState } from 'react';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { Button, Skeleton } from '../common';
import { ThemePicker } from './ThemePicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { UI_FONT_OPTIONS, CODE_FONT_OPTIONS } from '../../types/settings';
import { DEFAULT_GENERATED_PATTERNS } from '../../utils/generatedFiles';
import type { DiffViewMode } from '../../types';

export function AppearanceSettings() {
  const { isLoading: isLoadingSettings } = useSettings();
  const updateSettings = useUpdateSettings();

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
  const hideGeneratedFiles = useSettingsStore((s) => s.hideGeneratedFiles);
  const setHideGeneratedFiles = useSettingsStore((s) => s.setHideGeneratedFiles);
  const generatedFilePatterns = useSettingsStore((s) => s.generatedFilePatterns);
  const setGeneratedFilePatterns = useSettingsStore((s) => s.setGeneratedFilePatterns);

  const [patternsText, setPatternsText] = useState(generatedFilePatterns.join('\n'));

  const handleDiffModeChange = (mode: DiffViewMode) => {
    setDiffViewMode(mode);
    updateSettings.mutate({ diff_view_mode: mode });
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

          {/* Hide Generated Files */}
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

          {/* Generated File Patterns */}
          <div className="p-4 border border-edge rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-content">Generated File Patterns</p>
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
    </div>
  );
}
