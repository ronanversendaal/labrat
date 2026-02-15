import { create } from 'zustand';

interface DetailNavState {
  /** Currently active tab in MR detail view */
  detailTab: string;
  /** Whether a job log is currently open in PipelinePanel */
  jobLogOpen: boolean;

  setDetailTab: (tab: string) => void;
  setJobLogOpen: (open: boolean) => void;
  reset: () => void;
}

export const useDetailNavStore = create<DetailNavState>((set) => ({
  detailTab: 'changes',
  jobLogOpen: false,

  setDetailTab: (detailTab) => set({ detailTab }),
  setJobLogOpen: (jobLogOpen) => set({ jobLogOpen }),
  reset: () => set({ detailTab: 'changes', jobLogOpen: false }),
}));
