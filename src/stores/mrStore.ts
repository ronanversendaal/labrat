import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MergeRequest, MergeRequestFilter, MergeRequestSort, FilterType, ParsedFilter } from '../types/gitlab';
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
  appliedFilters: ParsedFilter[];
  specialFilters: SpecialFilters;
  sort: MergeRequestSort;
  searchQuery: string;
  groupBy: GroupByOption;
  toolbarVisible: boolean;
  searchVisible: boolean;

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
  replaceFilter: (filter: Partial<MergeRequestFilter>) => void;
  setNegatedFilters: (filters: NegatedFilter[]) => void;
  addAppliedFilter: (filter: ParsedFilter) => void;
  removeAppliedFilter: (filter: ParsedFilter) => void;
  setSpecialFilters: (filters: Partial<SpecialFilters>) => void;
  setSort: (sort: MergeRequestSort) => void;
  setSearchQuery: (query: string) => void;
  setGroupBy: (groupBy: GroupByOption) => void;
  toggleToolbar: () => void;
  setSearchVisible: (visible: boolean) => void;
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
const defaultSpecialFilters: SpecialFilters = {
  excludeApprovedByMe: false,
  reviewerIsMe: false,
};

/** Read persisted state synchronously so the very first render uses saved filters. */
function loadPersistedState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem('labrat-filters');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version === 6 && parsed.state) return parsed.state;
    // v5 → v6: add appliedFilters
    if (parsed.version === 5 && parsed.state) {
      return { ...parsed.state, appliedFilters: [] };
    }
    // v4 → v6 migration: rename groupingVisible → toolbarVisible
    if (parsed.version === 4 && parsed.state) {
      const { groupingVisible, ...rest } = parsed.state;
      return { ...rest, toolbarVisible: groupingVisible ?? false };
    }
    // v3 → v5 migration: add toolbarVisible
    if (parsed.version === 3 && parsed.state) {
      return { ...parsed.state, toolbarVisible: false };
    }
    // v2 → v5 migration: add negatedFilters, specialFilters, toolbarVisible
    if (parsed.version === 2 && parsed.state) {
      return { ...parsed.state, negatedFilters: [], specialFilters: defaultSpecialFilters, toolbarVisible: false };
    }
  } catch { /* ignore */ }
  return null;
}

const persisted = loadPersistedState();

export const useMRStore = create<MRState>()(
  persist(
    (set) => ({
      // Initial state — use persisted values so the first query is correct
      selectedMrId: null,
      selectedMr: null,
      isDetailOpen: false,
      filter: (persisted?.filter as MergeRequestFilter) ?? defaultFilter,
      negatedFilters: (persisted?.negatedFilters as NegatedFilter[]) ?? [],
      appliedFilters: (persisted?.appliedFilters as ParsedFilter[]) ?? [],
      specialFilters: (persisted?.specialFilters as SpecialFilters) ?? defaultSpecialFilters,
      sort: (persisted?.sort as MergeRequestSort) ?? defaultSort,
      searchQuery: (persisted?.searchQuery as string) ?? '',
      groupBy: (persisted?.groupBy as GroupByOption) ?? 'none',
      toolbarVisible: (persisted?.toolbarVisible as boolean) ?? false,
      searchVisible: false,
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

      replaceFilter: (newFilter) => set({ filter: newFilter as MergeRequestFilter }),

      setNegatedFilters: (negatedFilters) => set({ negatedFilters }),

      addAppliedFilter: (filter) =>
        set((state) => {
          const isDuplicate = state.appliedFilters.some(
            (f) => f.type === filter.type && f.value === filter.value && f.negated === filter.negated
          );
          if (isDuplicate) return state;
          return { appliedFilters: [...state.appliedFilters, filter] };
        }),

      removeAppliedFilter: (filter) =>
        set((state) => ({
          appliedFilters: state.appliedFilters.filter(
            (f) => !(f.type === filter.type && f.value === filter.value && f.negated === filter.negated)
          ),
        })),

      setSpecialFilters: (specialFilters) =>
        set((state) => ({
          specialFilters: { ...state.specialFilters, ...specialFilters },
        })),

      setSort: (sort) => set({ sort }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setGroupBy: (groupBy) => set({ groupBy }),

      toggleToolbar: () => set((state) => ({ toolbarVisible: !state.toolbarVisible })),

      setSearchVisible: (searchVisible) => set({ searchVisible }),

      clearFilters: () =>
        set({
          filter: defaultFilter,
          negatedFilters: [],
          appliedFilters: [],
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
      version: 6, // Bump version: add appliedFilters
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted: unknown, version: number) => {
        let state = persisted as Record<string, unknown>;
        if (version < 3) {
          state = {
            ...state,
            negatedFilters: [],
            specialFilters: { excludeApprovedByMe: false, reviewerIsMe: false },
          };
        }
        if (version < 5) {
          // v3/v4 → v5: rename groupingVisible → toolbarVisible
          const { groupingVisible, ...rest } = state;
          state = { ...rest, toolbarVisible: groupingVisible ?? false };
        }
        if (version < 6) {
          state = { ...state, appliedFilters: [] };
        }
        return state;
      },
      // Persist filter-related state and viewed files
      partialize: (state) => ({
        filter: state.filter,
        negatedFilters: state.negatedFilters,
        appliedFilters: state.appliedFilters,
        specialFilters: state.specialFilters,
        sort: state.sort,
        searchQuery: state.searchQuery,
        groupBy: state.groupBy,
        toolbarVisible: state.toolbarVisible,
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
