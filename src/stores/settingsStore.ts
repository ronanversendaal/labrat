import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme, DiffViewMode, FileViewMode } from '../types/settings';
import { DEFAULT_GENERATED_PATTERNS } from '../utils/generatedFiles';

interface SettingsState {
  // Appearance
  theme: Theme;
  fontSize: number;
  fontFamilyUI: string | null;
  fontFamilyCode: string | null;

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

  // Notifications
  notifyMergeReady: boolean;
  notifyMrUpdatedBanner: boolean;
  toastNotifications: boolean;

  // Generated files
  hideGeneratedFiles: boolean;
  generatedFilePatterns: string[];

  // Updates
  autoCheckUpdates: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  setFontFamilyUI: (font: string | null) => void;
  setFontFamilyCode: (font: string | null) => void;
  setMrRefreshInterval: (seconds: number) => void;
  setCacheSizeMb: (mb: number) => void;
  setAiAutoAnalyze: (enabled: boolean) => void;
  setKeyboardShortcutsEnabled: (enabled: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setDiffViewMode: (mode: DiffViewMode) => void;
  setShowWhitespace: (show: boolean) => void;
  toggleShowWhitespace: () => void;
  setFileViewMode: (mode: FileViewMode) => void;
  setDefaultAiProviderId: (id: string | null) => void;
  setNotifyMergeReady: (enabled: boolean) => void;
  setNotifyMrUpdatedBanner: (enabled: boolean) => void;
  setToastNotifications: (enabled: boolean) => void;
  setHideGeneratedFiles: (hide: boolean) => void;
  setGeneratedFilePatterns: (patterns: string[]) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  theme: 'system' as Theme,
  fontSize: 14,
  fontFamilyUI: null as string | null,
  fontFamilyCode: null as string | null,
  mrRefreshInterval: 300,
  cacheSizeMb: 500,
  aiAutoAnalyze: false,
  keyboardShortcutsEnabled: true,
  sidebarCollapsed: false,
  diffViewMode: 'unified' as DiffViewMode,
  showWhitespace: false,
  fileViewMode: 'tree' as FileViewMode,
  defaultAiProviderId: null,
  notifyMergeReady: true,
  notifyMrUpdatedBanner: true,
  toastNotifications: true,
  hideGeneratedFiles: true,
  generatedFilePatterns: DEFAULT_GENERATED_PATTERNS,
  autoCheckUpdates: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      // Actions
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamilyUI: (fontFamilyUI) => set({ fontFamilyUI }),
      setFontFamilyCode: (fontFamilyCode) => set({ fontFamilyCode }),
      setMrRefreshInterval: (mrRefreshInterval) => set({ mrRefreshInterval }),
      setCacheSizeMb: (cacheSizeMb) => set({ cacheSizeMb }),
      setAiAutoAnalyze: (aiAutoAnalyze) => set({ aiAutoAnalyze }),
      setKeyboardShortcutsEnabled: (keyboardShortcutsEnabled) =>
        set({ keyboardShortcutsEnabled }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
      setShowWhitespace: (showWhitespace) => set({ showWhitespace }),
      toggleShowWhitespace: () =>
        set((state) => ({ showWhitespace: !state.showWhitespace })),
      setFileViewMode: (fileViewMode) => set({ fileViewMode }),
      setDefaultAiProviderId: (defaultAiProviderId) =>
        set({ defaultAiProviderId }),
      setNotifyMergeReady: (notifyMergeReady) => set({ notifyMergeReady }),
      setNotifyMrUpdatedBanner: (notifyMrUpdatedBanner) =>
        set({ notifyMrUpdatedBanner }),
      setToastNotifications: (toastNotifications) =>
        set({ toastNotifications }),
      setHideGeneratedFiles: (hideGeneratedFiles) =>
        set({ hideGeneratedFiles }),
      setGeneratedFilePatterns: (generatedFilePatterns) =>
        set({ generatedFilePatterns }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'labrat-settings',
      version: 5,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          // Migrate old theme values: 'light' → 'default-light', 'dark' → 'default-dark'
          const oldTheme = state.theme as string;
          if (oldTheme === 'light') state.theme = 'default-light';
          else if (oldTheme === 'dark') state.theme = 'default-dark';
          // Add new font fields
          if (!('fontFamilyUI' in state)) state.fontFamilyUI = null;
          if (!('fontFamilyCode' in state)) state.fontFamilyCode = null;
        }
        if (version < 3) {
          if (!('notifyMergeReady' in state)) state.notifyMergeReady = true;
          if (!('notifyMrUpdatedBanner' in state)) state.notifyMrUpdatedBanner = true;
          if (!('toastNotifications' in state)) state.toastNotifications = true;
        }
        if (version < 4) {
          if (!('hideGeneratedFiles' in state)) state.hideGeneratedFiles = true;
          if (!('generatedFilePatterns' in state)) state.generatedFilePatterns = DEFAULT_GENERATED_PATTERNS;
        }
        if (version < 5) {
          if (!('autoCheckUpdates' in state)) state.autoCheckUpdates = true;
        }
        return state as unknown as SettingsState;
      },
    }
  )
);
