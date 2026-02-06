/**
 * AI-related hooks using React Query
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../services/tauri';
import type {
  AddProviderRequest,
  AnalyzeDiffRequest,
  AnalysisProgressEvent,
  UpdateSuggestionRequest,
} from '../types';

// Query keys for React Query
export const aiQueryKeys = {
  providers: ['ai', 'providers'] as const,
  cliStatus: ['ai', 'cliStatus'] as const,
  suggestions: (mrId: number) => ['ai', 'suggestions', mrId] as const,
};

/**
 * Hook to list all AI providers
 */
export function useAIProviders() {
  return useQuery({
    queryKey: aiQueryKeys.providers,
    queryFn: api.listProviders,
  });
}

/**
 * Hook to add a new AI provider
 */
export function useAddProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AddProviderRequest) => api.addProvider(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiQueryKeys.providers });
    },
  });
}

/**
 * Hook to remove an AI provider
 */
export function useRemoveProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => api.removeProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiQueryKeys.providers });
    },
  });
}

/**
 * Hook to set the default AI provider
 */
export function useSetDefaultProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (providerId: string) => api.setDefaultProvider(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiQueryKeys.providers });
    },
  });
}

/**
 * Hook to check Claude CLI availability
 */
export function useCliStatus() {
  return useQuery({
    queryKey: aiQueryKeys.cliStatus,
    queryFn: api.checkCliAvailable,
    staleTime: 60 * 1000, // Check every minute
  });
}

/**
 * Hook to get AI suggestions for a merge request
 */
export function useAISuggestions(mrId: number) {
  return useQuery({
    queryKey: aiQueryKeys.suggestions(mrId),
    queryFn: () => api.getSuggestions(mrId),
    enabled: mrId > 0,
  });
}

/**
 * Hook to analyze a merge request with AI
 */
export function useAnalyzeDiff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AnalyzeDiffRequest) => api.analyzeDiff(request),
    onSuccess: (_data, variables) => {
      // Invalidate suggestions for this MR
      queryClient.invalidateQueries({
        queryKey: aiQueryKeys.suggestions(variables.mr_iid),
      });
    },
  });
}

/**
 * Hook to update suggestion status
 */
export function useUpdateSuggestionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateSuggestionRequest) => api.updateSuggestionStatus(request),
    onSuccess: () => {
      // Invalidate all suggestions queries
      queryClient.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
    },
  });
}

/**
 * Hook to listen for AI analysis progress events
 * @param mrId - The MR ID to listen for (or null for all MRs)
 * @param onProgress - Callback when progress updates are received
 */
export function useAnalysisProgress(
  mrId: number | null,
  onProgress?: (event: AnalysisProgressEvent) => void
) {
  const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null);

  const handleProgress = useCallback(
    (event: AnalysisProgressEvent) => {
      // Filter by MR ID if specified
      if (mrId !== null && event.mr_id !== mrId) return;

      setProgress(event);
      onProgress?.(event);
    },
    [mrId, onProgress]
  );

  useEffect(() => {
    // Tauri event listeners only work inside the Tauri webview
    if (!('__TAURI_INTERNALS__' in window)) return;

    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<AnalysisProgressEvent>('ai:analysis_progress', (event) => {
        handleProgress(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleProgress]);

  const reset = useCallback(() => {
    setProgress(null);
  }, []);

  return { progress, reset };
}
