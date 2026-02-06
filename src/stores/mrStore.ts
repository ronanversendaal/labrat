import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest, MergeRequestFilter, MergeRequestSort, FilterType } from '../types/gitlab';
import type { AISuggestion } from '../types/ai';

type GroupByOption = 'project' | 'author' | 'date' | 'none';

/** Negated filter for client-side filtering */
export interface NegatedFilter {
  type: FilterType;
  value: string;
}

/** Special filters that require additional data fetching */
export interface SpecialFilters {
  /** Exclude MRs already approved by current user */
  excludeApprovedByMe: boolean;
  /** Only show MRs where current user is explicitly a reviewer */
  reviewerIsMe: boolean;
}

/**
 * Tracks which files have been viewed in a specific MR
 * Key format: "{mrId}:{filePath}"
 */
interface ViewedFilesState {
  [key: string]: {
    viewedAt: string;
    sha: string; // The commit SHA when marked as viewed
  };
}

interface MRState {
  // Selected MR
  selectedMrId: number | null;
  selectedMr: MergeRequest | null;
  isDetailOpen: boolean; // Whether to show the detail view (Enter opens, ESC closes)

  // Filters and sorting
  filter: MergeRequestFilter;
  negatedFilters: NegatedFilter[];
  specialFilters: SpecialFilters;
  sort: MergeRequestSort;
  searchQuery: string;
  groupBy: GroupByOption;

  // UI state
  expandedFiles: Set<string>;
  selectedSuggestion: AISuggestion | null;

  // Viewed files tracking
  viewedFiles: ViewedFilesState;

  // Actions
  setSelectedMr: (mr: MergeRequest | null) => void;
  openDetail: () => void;
  closeDetail: () => void;
  setFilter: (filter: Partial<MergeRequestFilter>) => void;
  setNegatedFilters: (filters: NegatedFilter[]) => void;
  setSpecialFilters: (filters: Partial<SpecialFilters>) => void;
  setSort: (sort: MergeRequestSort) => void;
  setSearchQuery: (query: string) => void;
  setGroupBy: (groupBy: GroupByOption) => void;
  clearFilters: () => void;
  toggleFileExpanded: (filePath: string) => void;
  setSelectedSuggestion: (suggestion: AISuggestion | null) => void;

  // Viewed files actions
  markFileViewed: (mrId: number, filePath: string, sha: string) => void;
  unmarkFileViewed: (mrId: number, filePath: string) => void;
  isFileViewed: (mrId: number, filePath: string, currentSha: string) => boolean;
  clearViewedFiles: (mrId: number) => void;
}

const defaultFilter: MergeRequestFilter = {};
const defaultSort: MergeRequestSort = {
  field: 'updated_at',
  direction: 'desc',
};

export const useMRStore = create<MRState>()(
  persist(
    (set) => ({
      // Initial state
      selectedMrId: null,
      selectedMr: null,
      isDetailOpen: false,
      filter: defaultFilter,
      negatedFilters: [],
      specialFilters: {
        excludeApprovedByMe: false,
        reviewerIsMe: false,
      },
      sort: defaultSort,
      searchQuery: '',
      groupBy: 'none',
      expandedFiles: new Set(),
      selectedSuggestion: null,
      viewedFiles: {},

      // Actions
      setSelectedMr: (mr) =>
        set({
          selectedMr: mr,
          selectedMrId: mr?.id ?? null,
          selectedSuggestion: null, // Clear suggestion when changing MR
        }),

      openDetail: () => set({ isDetailOpen: true }),

      closeDetail: () => set({ isDetailOpen: false }),

      setFilter: (newFilter) =>
        set((state) => ({
          filter: { ...state.filter, ...newFilter },
        })),

      setNegatedFilters: (negatedFilters) => set({ negatedFilters }),

      setSpecialFilters: (specialFilters) =>
        set((state) => ({
          specialFilters: { ...state.specialFilters, ...specialFilters },
        })),

      setSort: (sort) => set({ sort }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setGroupBy: (groupBy) => set({ groupBy }),

      clearFilters: () =>
        set({
          filter: defaultFilter,
          negatedFilters: [],
          specialFilters: {
            excludeApprovedByMe: false,
            reviewerIsMe: false,
          },
          searchQuery: '',
        }),

      toggleFileExpanded: (filePath) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFiles);
          if (newExpanded.has(filePath)) {
            newExpanded.delete(filePath);
          } else {
            newExpanded.add(filePath);
          }
          return { expandedFiles: newExpanded };
        }),

      setSelectedSuggestion: (selectedSuggestion) => set({ selectedSuggestion }),

      // Viewed files actions
      markFileViewed: (mrId, filePath, sha) =>
        set((state) => ({
          viewedFiles: {
            ...state.viewedFiles,
            [`${mrId}:${filePath}`]: {
              viewedAt: new Date().toISOString(),
              sha,
            },
          },
        })),

      unmarkFileViewed: (mrId, filePath) =>
        set((state) => {
          const newViewedFiles = { ...state.viewedFiles };
          delete newViewedFiles[`${mrId}:${filePath}`];
          return { viewedFiles: newViewedFiles };
        }),

      // Note: isFileViewed is defined as a method but should be used as a selector
      // Use the helper function isFileViewedSelector instead
      isFileViewed: () => false,

      clearViewedFiles: (mrId) =>
        set((state) => {
          const newViewedFiles = { ...state.viewedFiles };
          Object.keys(newViewedFiles).forEach((key) => {
            if (key.startsWith(`${mrId}:`)) {
              delete newViewedFiles[key];
            }
          });
          return { viewedFiles: newViewedFiles };
        }),
    }),
    {
      name: 'labrat-filters',
      version: 2, // Bump version for new viewedFiles state
      storage: createJSONStorage(() => localStorage),
      // Persist filter-related state and viewed files
      partialize: (state) => ({
        filter: state.filter,
        sort: state.sort,
        searchQuery: state.searchQuery,
        groupBy: state.groupBy,
        viewedFiles: state.viewedFiles,
      }),
    }
  )
);

/**
 * Helper function to check if a file is viewed for the current SHA
 * Use this instead of the store's isFileViewed method
 */
export function isFileViewedSelector(
  viewedFiles: ViewedFilesState,
  mrId: number,
  filePath: string,
  currentSha: string
): boolean {
  const key = `${mrId}:${filePath}`;
  const viewedFile = viewedFiles[key];
  if (!viewedFile) return false;
  // Only consider viewed if the SHA matches (content hasn't changed)
  return viewedFile.sha === currentSha;
}
