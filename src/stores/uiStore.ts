import { create } from 'zustand';

type ModalType = 'addAccount' | 'settings' | 'aiProvider' | 'postComment' | 'saveFilterPreset' | null;

interface UIState {
  // Modals
  activeModal: ModalType;
  modalData: Record<string, unknown>;

  // Transient view settings (not persisted)
  wordWrap: boolean;

  // Loading states
  isRefreshing: boolean;
  isAnalyzing: boolean;

  // Inline comments - track which resolved threads are expanded
  expandedResolvedThreads: Set<string>;

  // Actions
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  toggleWordWrap: () => void;
  setRefreshing: (isRefreshing: boolean) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  toggleResolvedThread: (discussionId: string) => void;
  clearExpandedThreads: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  activeModal: null,
  modalData: {},
  wordWrap: false,
  isRefreshing: false,
  isAnalyzing: false,
  expandedResolvedThreads: new Set(),

  // Actions
  openModal: (activeModal, data = {}) =>
    set({ activeModal, modalData: data }),

  closeModal: () =>
    set({ activeModal: null, modalData: {} }),

  toggleWordWrap: () =>
    set((state) => ({ wordWrap: !state.wordWrap })),

  setRefreshing: (isRefreshing) => set({ isRefreshing }),

  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

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
