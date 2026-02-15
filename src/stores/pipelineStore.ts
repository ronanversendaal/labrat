import { create } from 'zustand';
import type { PipelineFilter } from '../types/gitlab';

interface PipelineState {
  // Selected state
  selectedProjectId: number | null;
  selectedPipelineId: number | null;

  // Filters
  pipelineFilter: PipelineFilter;

  // Actions
  setSelectedProjectId: (projectId: number | null) => void;
  setSelectedPipelineId: (pipelineId: number | null) => void;
  setPipelineFilter: (filter: PipelineFilter) => void;
  resetPipelineFilter: () => void;
}

const defaultFilter: PipelineFilter = {};

export const usePipelineStore = create<PipelineState>((set) => ({
  // Initial state
  selectedProjectId: null,
  selectedPipelineId: null,
  pipelineFilter: defaultFilter,

  // Actions
  setSelectedProjectId: (selectedProjectId) =>
    set({ selectedProjectId, selectedPipelineId: null }),

  setSelectedPipelineId: (selectedPipelineId) =>
    set({ selectedPipelineId }),

  setPipelineFilter: (pipelineFilter) => set({ pipelineFilter }),

  resetPipelineFilter: () => set({ pipelineFilter: defaultFilter }),
}));
