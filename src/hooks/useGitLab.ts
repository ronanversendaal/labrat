/**
 * GitLab data fetching hooks using React Query
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../services/tauri';
import type {
  ListMergeRequestsRequest,
  ListMergeRequestsResponse,
  AddAccountRequest,
  ValidateTokenRequest,
  GetDiffRequest,
  ConnectionStatusEvent,
} from '../types';
import { useMRStore } from '../stores';

// Query keys for React Query
export const queryKeys = {
  accounts: ['accounts'] as const,
  mergeRequests: (filters?: ListMergeRequestsRequest) => ['mergeRequests', filters] as const,
  mergeRequest: (projectId: number, mrIid: number) => ['mergeRequest', projectId, mrIid] as const,
  diff: (projectId: number, mrIid: number) => ['diff', projectId, mrIid] as const,
  discussions: (projectId: number, mrIid: number) => ['discussions', projectId, mrIid] as const,
};

/**
 * Hook to list all GitLab accounts
 */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: api.listAccounts,
  });
}

/**
 * Hook to add a new GitLab account
 */
export function useAddAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AddAccountRequest) => api.addAccount(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}

/**
 * Hook to validate a GitLab token
 */
export function useValidateToken() {
  return useMutation({
    mutationFn: (request: ValidateTokenRequest) => api.validateToken(request),
  });
}

/**
 * Hook to set the active GitLab account
 */
export function useSetActiveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => api.setActiveAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: ['mergeRequests'] });
    },
  });
}

/**
 * Hook to remove a GitLab account
 */
export function useRemoveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => api.removeAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
  });
}

/**
 * Hook to list merge requests with optional filters
 */
export function useMergeRequests(request?: ListMergeRequestsRequest) {
  const { filter, sort, searchQuery } = useMRStore();

  const mergedRequest: ListMergeRequestsRequest = {
    filter: request?.filter ?? filter,
    sort: request?.sort ?? sort,
    search: request?.search ?? searchQuery,
    use_cache: request?.use_cache ?? true,
  };

  return useQuery({
    queryKey: queryKeys.mergeRequests(mergedRequest),
    queryFn: () => api.listMergeRequests(mergedRequest),
    select: (data: ListMergeRequestsResponse) => data.merge_requests,
  });
}

/**
 * Hook to get a single merge request
 * @param refetchInterval - Optional interval in ms to refetch (default: undefined, no polling)
 */
export function useMergeRequest(projectId: number, mrIid: number, refetchInterval?: number) {
  return useQuery({
    queryKey: queryKeys.mergeRequest(projectId, mrIid),
    queryFn: () => api.getMergeRequest(projectId, mrIid),
    enabled: projectId > 0 && mrIid > 0,
    refetchInterval,
  });
}

/**
 * Hook to get diff for a merge request
 */
export function useDiff(projectId: number, mrIid: number, useCache = true) {
  const request: GetDiffRequest = {
    project_id: projectId,
    mr_iid: mrIid,
    use_cache: useCache,
  };

  return useQuery({
    queryKey: queryKeys.diff(projectId, mrIid),
    queryFn: () => api.getDiff(request),
    enabled: projectId > 0 && mrIid > 0,
  });
}

/**
 * Hook to get discussions for a merge request
 */
export function useDiscussions(projectId: number, mrIid: number) {
  return useQuery({
    queryKey: queryKeys.discussions(projectId, mrIid),
    queryFn: () => api.getDiscussions(projectId, mrIid),
    enabled: projectId > 0 && mrIid > 0,
  });
}

/**
 * Hook to refresh MR data
 */
export function useRefresh() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.refresh({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mergeRequests'] });
    },
  });
}

/**
 * Hook to post a comment
 */
export function usePostComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.postComment,
    onSuccess: (_, variables) => {
      // Invalidate discussions for this MR
      queryClient.invalidateQueries({
        queryKey: queryKeys.discussions(variables.project_id, variables.mr_iid),
      });
    },
  });
}

/**
 * Hook to check connection status for a GitLab account
 */
export function useCheckConnection() {
  return useMutation({
    mutationFn: (accountId: string) => api.checkConnection(accountId),
  });
}

/**
 * Hook to listen for connection status events
 * @param accountId - Optional account ID to filter events
 * @param onStatusChange - Callback when status changes
 */
export function useConnectionStatus(
  accountId?: string,
  onStatusChange?: (event: ConnectionStatusEvent) => void
) {
  const [status, setStatus] = useState<ConnectionStatusEvent | null>(null);

  const handleStatusChange = useCallback(
    (event: ConnectionStatusEvent) => {
      // Filter by account ID if specified
      if (accountId && event.account_id !== accountId) return;

      setStatus(event);
      onStatusChange?.(event);
    },
    [accountId, onStatusChange]
  );

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ConnectionStatusEvent>('connection:status', (event) => {
        handleStatusChange(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleStatusChange]);

  const reset = useCallback(() => {
    setStatus(null);
  }, []);

  return { status, reset };
}
