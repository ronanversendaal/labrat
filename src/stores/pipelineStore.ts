import { create } from 'zustand';
import type { PipelineFilter } from '../types/gitlab';

interface PipelineState {
  // Selected state
  selectedProjectId: number | null;
  selectedPipelineId: number | null;
  expandedJobId: number | null;

  // Filters
  pipelineFilter: PipelineFilter;

  // Actions
  setSelectedProjectId: (projectId: number | null) => void;
  setSelectedPipelineId: (pipelineId: number | null) => void;
  setExpandedJobId: (jobId: number | null) => void;
  setPipelineFilter: (filter: PipelineFilter) => void;
  resetPipelineFilter: () => void;
}

const defaultFilter: PipelineFilter = {};

export const usePipelineStore = create<PipelineState>((set) => ({
  // Initial state
  selectedProjectId: null,
  selectedPipelineId: null,
  expandedJobId: null,
  pipelineFilter: defaultFilter,

  // Actions
  setSelectedProjectId: (selectedProjectId) =>
    set({ selectedProjectId, selectedPipelineId: null, expandedJobId: null }),

  setSelectedPipelineId: (selectedPipelineId) =>
    set({ selectedPipelineId, expandedJobId: null }),

  setExpandedJobId: (expandedJobId) => set({ expandedJobId }),

  setPipelineFilter: (pipelineFilter) => set({ pipelineFilter }),

  resetPipelineFilter: () => set({ pipelineFilter: defaultFilter }),
}));
