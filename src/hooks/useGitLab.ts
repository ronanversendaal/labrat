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
  ApprovalState,
  MergeMrRequest,
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
  myMergeRequests: ['myMergeRequests'] as const,
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

      // If we got cached data, trigger a background refetch with use_cache: false
      if (data.from_cache) {
        const freshRequest = { ...mergedRequest, use_cache: false };
        api.listMergeRequests(freshRequest).then((freshData) => {
          queryClient.setQueryData(
            queryKeys.mergeRequests(mergedRequest),
            freshData
          );
          // Seed approval caches from fresh data too
          if (freshData.approval_states) {
            for (const mr of freshData.merge_requests) {
              const approvalState = freshData.approval_states[mr.id];
              if (approvalState) {
                queryClient.setQueryData(
                  queryKeys.approvalState(mr.project_id, mr.iid),
                  approvalState
                );
              }
            }
          }
        }).catch(() => {
          // Silent failure — cached data remains displayed, next interval will retry
        });
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
    onMutate: async (variables) => {
      // Cancel in-flight approval state queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.approvalState(variables.projectId, variables.mrIid),
      });

      // Snapshot previous state for rollback
      const previousState = queryClient.getQueryData<ApprovalState>(
        queryKeys.approvalState(variables.projectId, variables.mrIid)
      );

      // Optimistically update approval state
      if (previousState) {
        queryClient.setQueryData(
          queryKeys.approvalState(variables.projectId, variables.mrIid),
          {
            ...previousState,
            user_has_approved: true,
            user_can_approve: false,
            approvals_left: Math.max(0, previousState.approvals_left - 1),
          }
        );
      }

      return { previousState };
    },
    onError: (_error, variables, context) => {
      // Roll back to previous state on failure
      if (context?.previousState) {
        queryClient.setQueryData(
          queryKeys.approvalState(variables.projectId, variables.mrIid),
          context.previousState
        );
      }
    },
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

/**
 * Hook to apply a suggestion from a merge request note
 */
export function useApplySuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      project_id: number;
      mr_iid: number;
      suggestion_id: number;
      commit_message?: string;
    }) => api.applySuggestion(params.project_id, params.mr_iid, params.suggestion_id, params.commit_message),
    onSuccess: (_, variables) => {
      // Invalidate discussions and diff for this MR since applying a suggestion creates a new commit
      queryClient.invalidateQueries({
        queryKey: queryKeys.discussions(variables.project_id, variables.mr_iid),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.diff(variables.project_id, variables.mr_iid),
      });
    },
  });
}

/**
 * Hook to list merge requests authored by the current user
 */
export function useMyMergeRequests() {
  const mrRefreshInterval = useSettingsStore((s) => s.mrRefreshInterval);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.myMergeRequests,
    queryFn: async () => {
      const data = await api.listMergeRequests({
        scope: 'authored_by_me',
        include_approvals: true,
      });

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
    refetchInterval: mrRefreshInterval > 0 ? mrRefreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to merge a merge request
 */
export function useMergeMR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MergeMrRequest) => api.mergeMR(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mergeRequests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.myMergeRequests });
    },
  });
}

/**
 * Hook to rebase a merge request
 */
export function useRebaseMR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, mrIid }: { projectId: number; mrIid: number }) =>
      api.rebaseMR(projectId, mrIid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mergeRequests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.myMergeRequests });
    },
  });
}

