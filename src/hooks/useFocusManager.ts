/**
 * Focus management hook for keyboard navigation
 *
 * Tracks the current focus zone to enable context-aware keyboard shortcuts:
 * - 'mr-list': Focus is on the MR list, j/k navigates MRs
 * - 'file-list': Focus is on the file list in MR detail, j/k navigates files
 * - 'diff': Focus is on the diff view
 *
 * DiffMode controls sub-modes within the diff view:
 * - 'file-nav': j/k navigates files (default when in file-list zone)
 * - 'line-nav': j/k navigates lines within a file
 * - 'comment': Comment form is open
 * - 'suggest': Suggestion editor is open
 */

import { create } from 'zustand';

export type FocusZone = 'mr-list' | 'file-list' | 'diff' | 'none';
export type DiffMode = 'file-nav' | 'line-nav' | 'comment' | 'suggest';

interface FocusState {
  currentZone: FocusZone;
  previousZone: FocusZone;
  diffMode: DiffMode;
  focusedLine: number | null;
  setFocusZone: (zone: FocusZone) => void;
  returnToPreviousZone: () => void;
  setDiffMode: (mode: DiffMode) => void;
  setFocusedLine: (line: number | null) => void;
}

export const useFocusStore = create<FocusState>((set) => ({
  currentZone: 'mr-list',
  previousZone: 'none',
  diffMode: 'file-nav',
  focusedLine: null,

  setFocusZone: (zone) => set((state) => ({
    previousZone: state.currentZone,
    currentZone: zone,
  })),

  returnToPreviousZone: () => set((state) => ({
    currentZone: state.previousZone !== 'none' ? state.previousZone : 'mr-list',
    previousZone: 'none',
  })),

  setDiffMode: (mode) => set({ diffMode: mode }),

  setFocusedLine: (line) => set({ focusedLine: line }),
}));

/**
 * Hook to get the current focus zone
 */
export function useFocusZone() {
  return useFocusStore((state) => state.currentZone);
}

/**
 * Hook to check if a specific zone is focused
 */
export function useIsFocused(zone: FocusZone) {
  return useFocusStore((state) => state.currentZone === zone);
}
