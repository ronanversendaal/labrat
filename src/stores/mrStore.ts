import { create } from 'zustand';
import type { MergeRequest, MergeRequestFilter, MergeRequestSort } from '../types/gitlab';
import type { AISuggestion } from '../types/ai';

type GroupByOption = 'project' | 'author' | 'date' | 'none';

interface MRState {
  // Selected MR
  selectedMrId: number | null;
  selectedMr: MergeRequest | null;

  // Filters and sorting
  filter: MergeRequestFilter;
  sort: MergeRequestSort;
  searchQuery: string;
  groupBy: GroupByOption;

  // UI state
  expandedFiles: Set<string>;
  selectedSuggestion: AISuggestion | null;

  // Actions
  setSelectedMr: (mr: MergeRequest | null) => void;
  setFilter: (filter: Partial<MergeRequestFilter>) => void;
  setSort: (sort: MergeRequestSort) => void;
  setSearchQuery: (query: string) => void;
  setGroupBy: (groupBy: GroupByOption) => void;
  clearFilters: () => void;
  toggleFileExpanded: (filePath: string) => void;
  setSelectedSuggestion: (suggestion: AISuggestion | null) => void;
}

const defaultFilter: MergeRequestFilter = {};
const defaultSort: MergeRequestSort = {
  field: 'updated_at',
  direction: 'desc',
};

export const useMRStore = create<MRState>((set) => ({
  // Initial state
  selectedMrId: null,
  selectedMr: null,
  filter: defaultFilter,
  sort: defaultSort,
  searchQuery: '',
  groupBy: 'none',
  expandedFiles: new Set(),
  selectedSuggestion: null,

  // Actions
  setSelectedMr: (mr) =>
    set({
      selectedMr: mr,
      selectedMrId: mr?.id ?? null,
      selectedSuggestion: null, // Clear suggestion when changing MR
    }),

  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  setSort: (sort) => set({ sort }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setGroupBy: (groupBy) => set({ groupBy }),

  clearFilters: () =>
    set({
      filter: defaultFilter,
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
}));
