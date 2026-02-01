import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme, DiffViewMode, FileViewMode } from '../types/settings';

interface SettingsState {
  // Appearance
  theme: Theme;
  fontSize: number;

  // Behavior
  mrRefreshInterval: number; // seconds
  cacheSizeMb: number;
  aiAutoAnalyze: boolean;
  keyboardShortcutsEnabled: boolean;

  // View preferences
  sidebarCollapsed: boolean;
  diffViewMode: DiffViewMode;
  showWhitespace: boolean;
  fileViewMode: FileViewMode;

  // AI
  defaultAiProviderId: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  setMrRefreshInterval: (seconds: number) => void;
  setCacheSizeMb: (mb: number) => void;
  setAiAutoAnalyze: (enabled: boolean) => void;
  setKeyboardShortcutsEnabled: (enabled: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDiffViewMode: (mode: DiffViewMode) => void;
  setShowWhitespace: (show: boolean) => void;
  setFileViewMode: (mode: FileViewMode) => void;
  setDefaultAiProviderId: (id: string | null) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  theme: 'system' as Theme,
  fontSize: 14,
  mrRefreshInterval: 300,
  cacheSizeMb: 500,
  aiAutoAnalyze: true,
  keyboardShortcutsEnabled: true,
  sidebarCollapsed: false,
  diffViewMode: 'unified' as DiffViewMode,
  showWhitespace: false,
  fileViewMode: 'tree' as FileViewMode,
  defaultAiProviderId: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      // Actions
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setMrRefreshInterval: (mrRefreshInterval) => set({ mrRefreshInterval }),
      setCacheSizeMb: (cacheSizeMb) => set({ cacheSizeMb }),
      setAiAutoAnalyze: (aiAutoAnalyze) => set({ aiAutoAnalyze }),
      setKeyboardShortcutsEnabled: (keyboardShortcutsEnabled) =>
        set({ keyboardShortcutsEnabled }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
      setShowWhitespace: (showWhitespace) => set({ showWhitespace }),
      setFileViewMode: (fileViewMode) => set({ fileViewMode }),
      setDefaultAiProviderId: (defaultAiProviderId) =>
        set({ defaultAiProviderId }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'gitlab-mr-review-settings',
      version: 1,
    }
  )
);
