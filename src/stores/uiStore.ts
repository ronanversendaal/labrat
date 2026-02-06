import { create } from 'zustand';

type ModalType = 'addAccount' | 'settings' | 'aiProvider' | 'postComment' | 'saveFilterPreset' | null;

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;

  // Modals
  activeModal: ModalType;
  modalData: Record<string, unknown>;

  // View settings
  diffViewMode: 'unified' | 'split';
  showWhitespace: boolean;
  wordWrap: boolean;
  fontSize: number;

  // Loading states
  isRefreshing: boolean;
  isAnalyzing: boolean;

  // Filter panel
  filterPanelExpanded: boolean;

  // Inline comments - track which resolved threads are expanded
  expandedResolvedThreads: Set<string>;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  toggleWhitespace: () => void;
  toggleWordWrap: () => void;
  setFontSize: (size: number) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  toggleFilterPanel: () => void;
  setFilterPanelExpanded: (expanded: boolean) => void;
  toggleResolvedThread: (discussionId: string) => void;
  clearExpandedThreads: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarCollapsed: true,
  activeModal: null,
  modalData: {},
  diffViewMode: 'unified',
  showWhitespace: false,
  wordWrap: false,
  fontSize: 14,
  isRefreshing: false,
  isAnalyzing: false,
  filterPanelExpanded: true,
  expandedResolvedThreads: new Set(),

  // Actions
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  openModal: (activeModal, data = {}) =>
    set({ activeModal, modalData: data }),

  closeModal: () =>
    set({ activeModal: null, modalData: {} }),

  setDiffViewMode: (diffViewMode) => set({ diffViewMode }),

  toggleWhitespace: () =>
    set((state) => ({ showWhitespace: !state.showWhitespace })),

  toggleWordWrap: () =>
    set((state) => ({ wordWrap: !state.wordWrap })),

  setFontSize: (fontSize) => set({ fontSize }),

  setRefreshing: (isRefreshing) => set({ isRefreshing }),

  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  toggleFilterPanel: () =>
    set((state) => ({ filterPanelExpanded: !state.filterPanelExpanded })),

  setFilterPanelExpanded: (filterPanelExpanded) => set({ filterPanelExpanded }),

  toggleResolvedThread: (discussionId) =>
    set((state) => {
      const newSet = new Set(state.expandedResolvedThreads);
      if (newSet.has(discussionId)) {
        newSet.delete(discussionId);
      } else {
        newSet.add(discussionId);
      }
      return { expandedResolvedThreads: newSet };
    }),

  clearExpandedThreads: () => set({ expandedResolvedThreads: new Set() }),
}));
