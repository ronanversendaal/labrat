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
  fontSize: number;

  // Loading states
  isRefreshing: boolean;
  isAnalyzing: boolean;

  // Filter panel
  filterPanelExpanded: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  setDiffViewMode: (mode: 'unified' | 'split') => void;
  toggleWhitespace: () => void;
  setFontSize: (size: number) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  toggleFilterPanel: () => void;
  setFilterPanelExpanded: (expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  activeModal: null,
  modalData: {},
  diffViewMode: 'unified',
  showWhitespace: false,
  fontSize: 14,
  isRefreshing: false,
  isAnalyzing: false,
  filterPanelExpanded: true,

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

  setFontSize: (fontSize) => set({ fontSize }),

  setRefreshing: (isRefreshing) => set({ isRefreshing }),

  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  toggleFilterPanel: () =>
    set((state) => ({ filterPanelExpanded: !state.filterPanelExpanded })),

  setFilterPanelExpanded: (filterPanelExpanded) => set({ filterPanelExpanded }),
}));
