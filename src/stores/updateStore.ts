import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  contentLength?: number;
  chunkLength: number;
  totalDownloaded: number;
}

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  error: string | null;
  lastChecked: Date | null;

  setChecking: () => void;
  setAvailable: (info: UpdateInfo) => void;
  setDownloading: () => void;
  setProgress: (progress: DownloadProgress) => void;
  setReady: () => void;
  setError: (error: string) => void;
  setIdle: () => void;
  setLastChecked: (date: Date) => void;
}

export const useUpdateStore = create<UpdateState>()((set) => ({
  status: 'idle',
  updateInfo: null,
  downloadProgress: null,
  error: null,
  lastChecked: null,

  setChecking: () => set({ status: 'checking', error: null }),
  setAvailable: (info) => set({ status: 'available', updateInfo: info, error: null }),
  setDownloading: () => set({ status: 'downloading', downloadProgress: null, error: null }),
  setProgress: (progress) => set({ downloadProgress: progress }),
  setReady: () => set({ status: 'ready', downloadProgress: null }),
  setError: (error) => set({ status: 'error', error }),
  setIdle: () => set({ status: 'idle', updateInfo: null, downloadProgress: null, error: null }),
  setLastChecked: (date) => set({ lastChecked: date }),
}));
