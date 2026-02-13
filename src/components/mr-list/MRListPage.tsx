/**
 * MR List Page - Main container for displaying and managing merge requests
 * Wires MRList to Tauri backend via useGitLab hooks
 */

import { useMemo, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMergeRequests, useRefresh, useAccounts, queryKeys } from '../../hooks/useGitLab';
import { MRList } from './MRList';
import { MRFilters } from './MRFilters';
import { useMRStore, useUIStore } from '../../stores';
import { MRDetailView } from '../mr-detail';
import type { MergeRequest, ApprovalState } from '../../types';
import type { NegatedFilter, SpecialFilters } from '../../stores/mrStore';
import { getApprovalState } from '../../services/tauri';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useFocusStore } from '../../hooks/useFocusManager';

/** Apply negated filters to a list of MRs (client-side) */
function applyNegatedFilters(mrs: MergeRequest[], negatedFilters: NegatedFilter[]): MergeRequest[] {
  if (negatedFilters.length === 0) return mrs;

  return mrs.filter((mr) => {
    for (const nf of negatedFilters) {
      switch (nf.type) {
        case 'author':
          if (mr.author.username.toLowerCase() === nf.value.toLowerCase()) {
            return false; // Exclude this MR
          }
          break;
        case 'project':
          if (mr.project_path?.toLowerCase().includes(nf.value.toLowerCase())) {
            return false;
          }
          break;
        case 'label':
          if (mr.labels.some(l => l.toLowerCase() === nf.value.toLowerCase())) {
            return false;
          }
          break;
        case 'status':
          // Handle negated status filters
          if (nf.value === 'draft' && mr.draft) return false;
          if (nf.value === 'conflicts' && mr.has_conflicts) return false;
          if (nf.value === 'failed' && mr.head_pipeline?.status === 'failed') return false;
          break;
      }
    }
    return true; // Keep this MR
  });
}

/** Apply special filters that require additional data */
function applySpecialFilters(
  mrs: MergeRequest[],
  specialFilters: SpecialFilters,
  approvalStates: Map<number, ApprovalState>,
  currentUsername?: string
): MergeRequest[] {
  return mrs.filter((mr) => {
    // Filter: exclude MRs already approved by me
    if (specialFilters.excludeApprovedByMe) {
      const approvalState = approvalStates.get(mr.id);
      if (approvalState?.user_has_approved) {
        return false;
      }
    }

    // Filter: only show MRs where I'm explicitly a reviewer
    if (specialFilters.reviewerIsMe && currentUsername) {
      const isReviewer = mr.reviewers.some(
        r => r.username.toLowerCase() === currentUsername.toLowerCase()
      );
      if (!isReviewer) {
        return false;
      }
    }

    return true;
  });
}

export function MRListPage() {
  const { selectedMr, isDetailOpen, closeDetail, groupBy, negatedFilters, specialFilters, toggleToolbar, setSearchVisible } = useMRStore();
  const currentZone = useFocusStore((s) => s.currentZone);
  const { data: accounts } = useAccounts();

  const handleToggleToolbar = useCallback(() => {
    toggleToolbar();
  }, [toggleToolbar]);

  const handleShowSearch = useCallback(() => {
    setSearchVisible(true);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Filter merge requests"]');
      input?.focus();
    });
  }, [setSearchVisible]);

  useKeyboardShortcuts(
    [
      {
        id: 'toggle-toolbar',
        keys: ['g'],
        handler: handleToggleToolbar,
        label: 'Toggle Toolbar',
        description: 'Show/hide group & sort toolbar',
        category: 'mr-list',
      },
      {
        id: 'show-search',
        keys: ['/'],
        handler: handleShowSearch,
        label: 'Search',
        description: 'Show search & focus input',
        category: 'mr-list',
      },
    ],
    { enabled: currentZone === 'mr-list', scope: 'mr-list' }
  );
  // When excludeApprovedByMe is active, ask the backend to batch-fetch approval states
  const mrQueryRequest = useMemo(() => (
    specialFilters.excludeApprovedByMe ? { include_approvals: true } : undefined
  ), [specialFilters.excludeApprovedByMe]);
  const { data: mergeRequests, isLoading, isFetching, isError, error, refetch } = useMergeRequests(mrQueryRequest);
  const refreshMutation = useRefresh();

  const activeAccount = accounts?.find((a) => a.is_active);

  const handleRefresh = async () => {
    await refreshMutation.mutateAsync();
    refetch();
  };

  const hasActiveAccount = accounts?.some((a) => a.is_active);

  // Reactive approval state subscriptions — each MR gets its own query subscription
  // so that optimistic updates via setQueryData trigger immediate re-renders.
  // Data is already seeded in cache by the batch response, so no extra network calls.
  const approvalQueries = useQueries({
    queries: (specialFilters.excludeApprovedByMe && mergeRequests?.length)
      ? mergeRequests.map((mr) => ({
          queryKey: queryKeys.approvalState(mr.project_id, mr.iid),
          queryFn: () => getApprovalState(mr.project_id, mr.iid),
          // Don't refetch if already seeded — the batch response handles freshness
          staleTime: 5 * 60 * 1000,
        }))
      : [],
  });

  const approvalStates = useMemo(() => {
    if (!specialFilters.excludeApprovedByMe || !mergeRequests?.length) {
      return new Map<number, ApprovalState>();
    }
    const map = new Map<number, ApprovalState>();
    mergeRequests.forEach((mr, i) => {
      const data = approvalQueries[i]?.data;
      if (data) {
        map.set(mr.id, data);
      }
    });
    return map;
  }, [specialFilters.excludeApprovedByMe, mergeRequests, approvalQueries]);

  // Apply negated filters client-side
  const negatedFilteredMRs = useMemo(() => {
    if (!mergeRequests?.length) return [];
    return applyNegatedFilters(mergeRequests, negatedFilters);
  }, [mergeRequests, negatedFilters]);

  // Synchronous check: are we still waiting for approval data?
  const awaitingApprovalData = specialFilters.excludeApprovedByMe &&
    negatedFilteredMRs.length > 0 && approvalQueries.some((q) => q.isLoading);

  // Apply special filters (requires approval states).
  // Return empty while waiting for approval data — prevents flash of unfiltered MRs.
  const filteredMergeRequests = useMemo(() => {
    if (awaitingApprovalData) return [];
    return applySpecialFilters(
      negatedFilteredMRs,
      specialFilters,
      approvalStates,
      activeAccount?.username
    );
  }, [negatedFilteredMRs, specialFilters, approvalStates, activeAccount?.username, awaitingApprovalData]);

  // Extract unique projects and authors from MRs for filter dropdowns
  const { projects, authors } = useMemo(() => {
    if (!mergeRequests?.length) {
      return { projects: [], authors: [] };
    }

    const projectMap = new Map<number, string>();
    const authorMap = new Map<string, string>();

    for (const mr of mergeRequests) {
      if (mr.project_path) {
        projectMap.set(mr.project_id, mr.project_path);
      }
      authorMap.set(mr.author.username, mr.author.name);
    }

    return {
      projects: Array.from(projectMap.entries()).map(([id, path]) => ({ id, path })),
      authors: Array.from(authorMap.entries()).map(([username, name]) => ({ username, name })),
    };
  }, [mergeRequests]);

  // If no accounts configured, show setup prompt
  if (!isLoading && accounts && accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <NoAccountsState />
      </div>
    );
  }

  // If no active account, prompt to select one
  if (!isLoading && accounts && accounts.length > 0 && !hasActiveAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <SelectAccountState />
      </div>
    );
  }

  // Show detail view when open and MR is selected
  if (isDetailOpen && selectedMr) {
    return (
      <div className="h-full overflow-hidden">
        <MRDetailView mr={selectedMr} onClose={closeDetail} />
      </div>
    );
  }

  // Show MR list
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-content flex items-center gap-2">
            Review Requests
            {isFetching && !isLoading && (
              <svg className="w-4 h-4 animate-spin text-content-tertiary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="p-2 text-content-secondary hover:text-content-muted rounded-md hover:bg-surface-hover disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon spinning={refreshMutation.isPending} />
          </button>
        </div>

        <MRFilters projects={projects} authors={authors} />

        <MRList
          mergeRequests={filteredMergeRequests}
          isLoading={isLoading || awaitingApprovalData}
          isError={isError}
          error={error as Error | null}
          onRetry={() => refetch()}
          groupBy={groupBy}
        />
      </div>
    </div>
  );
}

function NoAccountsState() {
  const { openModal } = useUIStore();

  return (
    <>
      <svg
        className="w-16 h-16 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
      <h2 className="text-xl font-semibold text-content mb-2">
        No GitLab Accounts
      </h2>
      <p className="text-content-secondary text-center max-w-md mb-4">
        Add a GitLab account to start reviewing merge requests. You'll need a personal access token
        with <code className="text-sm bg-surface px-1 rounded">api</code> scope.
      </p>
      <button
        onClick={() => openModal('addAccount')}
        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
      >
        Add GitLab Account
      </button>
    </>
  );
}

function SelectAccountState() {
  return (
    <>
      <svg
        className="w-16 h-16 text-gray-400 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 9l4-4 4 4m0 6l-4 4-4-4"
        />
      </svg>
      <h2 className="text-xl font-semibold text-content mb-2">
        Select an Account
      </h2>
      <p className="text-content-secondary text-center max-w-md">
        You have GitLab accounts configured, but none are currently active. Select an account from
        the sidebar to view your merge requests.
      </p>
    </>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
