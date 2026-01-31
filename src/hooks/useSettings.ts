/**
 * Settings-related hooks using React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/tauri';
import type { UpdateSettingsRequest, ClearCacheRequest } from '../types';

// Query keys for React Query
export const settingsQueryKeys = {
  settings: ['settings'] as const,
  cacheStats: ['cache', 'stats'] as const,
};

/**
 * Hook to get all settings
 */
export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.settings,
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000, // Consider settings fresh for 5 minutes
  });
}

/**
 * Hook to update settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => api.updateSettings(request),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQueryKeys.settings, data);
    },
  });
}

/**
 * Hook to reset settings to defaults
 */
export function useResetSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.resetSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQueryKeys.settings, data);
    },
  });
}

/**
 * Hook to get cache statistics
 */
export function useCacheStats() {
  return useQuery({
    queryKey: settingsQueryKeys.cacheStats,
    queryFn: api.getCacheStats,
    staleTime: 30 * 1000, // Consider stats fresh for 30 seconds
  });
}

/**
 * Hook to clear cache
 */
export function useClearCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ClearCacheRequest) => api.clearCache(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.cacheStats });
    },
  });
}

/**
 * Hook to evict old cache entries
 */
export function useEvictCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.evictOldCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.cacheStats });
    },
  });
}
