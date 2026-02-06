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
  ReplyToDiscussionRequest,
  ResolveDiscussionRequest,
} from '../types';
import { useMRStore } from '../stores';
import { useSettingsStore } from '../stores/settingsStore';

// Query keys for React Query
export const queryKeys = {
  accounts: ['accounts'] as const,
  mergeRequests: (filters?: ListMergeRequestsRequest) => ['mergeRequests', filters] as const,
  mergeRequest: (projectId: number, mrIid: number) => ['mergeRequest', projectId, mrIid] as const,
  diff: (projectId: number, mrIid: number) => ['diff', projectId, mrIid] as const,
  discussions: (projectId: number, mrIid: number) => ['discussions', projectId, mrIid] as const,
  approvalState: (projectId: number, mrIid: number) => ['approvalState', projectId, mrIid] as const,
  fileContent: (projectId: number, filePath: string, refSha: string) => ['fileContent', projectId, filePath, refSha] as const,
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
  const mrRefreshInterval = useSettingsStore((s) => s.mrRefreshInterval);
  const queryClient = useQueryClient();

  const mergedRequest: ListMergeRequestsRequest = {
    filter: request?.filter ?? filter,
    sort: request?.sort ?? sort,
    search: request?.search ?? searchQuery,
    use_cache: request?.use_cache ?? true,
    include_approvals: request?.include_approvals,
  };

  return useQuery({
    queryKey: queryKeys.mergeRequests(mergedRequest),
    queryFn: async () => {
      const data = await api.listMergeRequests(mergedRequest);

      // Seed individual approval state caches from batch response
      if (data.approval_states) {
        for (const mr of data.merge_requests) {
          const state = data.approval_states[mr.id];
          if (state) {
            queryClient.setQueryData(
              queryKeys.approvalState(mr.project_id, mr.iid),
              state
            );
          }
        }
      }

      return data;
    },
    select: (data: ListMergeRequestsResponse) => data.merge_requests,
    refetchInterval: mrRefreshInterval > 0 ? mrRefreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
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
    staleTime: 10 * 60 * 1000, // 10 min — diffs rarely change, also SQLite-cached on backend
  });
}

/**
 * Hook to get raw file content at a specific commit SHA
 */
export function useFileContent(projectId: number, filePath: string, refSha: string) {
  return useQuery({
    queryKey: queryKeys.fileContent(projectId, filePath, refSha),
    queryFn: () => api.getFileContent(projectId, filePath, refSha),
    enabled: projectId > 0 && !!filePath && !!refSha,
    staleTime: Infinity, // File content at a specific SHA never changes
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
    // Tauri event listeners only work inside the Tauri webview
    if (!('__TAURI_INTERNALS__' in window)) return;

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

/**
 * Hook to get approval state for a merge request
 */
export function useApprovalState(projectId: number, mrIid: number) {
  return useQuery({
    queryKey: queryKeys.approvalState(projectId, mrIid),
    queryFn: () => api.getApprovalState(projectId, mrIid),
    enabled: projectId > 0 && mrIid > 0,
  });
}

/**
 * Hook to approve a merge request
 */
export function useApproveMR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, mrIid, sha }: { projectId: number; mrIid: number; sha?: string }) =>
      api.approveMR(projectId, mrIid, sha),
    onSuccess: (_, variables) => {
      // Invalidate approval state for this MR
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvalState(variables.projectId, variables.mrIid),
      });
    },
  });
}

/**
 * Hook to remove approval from a merge request
 */
export function useUnapproveMR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, mrIid }: { projectId: number; mrIid: number }) =>
      api.unapproveMR(projectId, mrIid),
    onSuccess: (_, variables) => {
      // Invalidate approval state for this MR
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvalState(variables.projectId, variables.mrIid),
      });
    },
  });
}

/**
 * Hook to reply to an existing discussion
 */
export function useReplyToDiscussion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ReplyToDiscussionRequest) => api.replyToDiscussion(request),
    onSuccess: (_, variables) => {
      // Invalidate discussions for this MR
      queryClient.invalidateQueries({
        queryKey: queryKeys.discussions(variables.project_id, variables.mr_iid),
      });
    },
  });
}

/**
 * Hook to resolve or unresolve a discussion
 */
export function useResolveDiscussion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ResolveDiscussionRequest) => api.resolveDiscussion(request),
    onSuccess: (_, variables) => {
      // Invalidate discussions for this MR
      queryClient.invalidateQueries({
        queryKey: queryKeys.discussions(variables.project_id, variables.mr_iid),
      });
    },
  });
}
