/**
 * MR List Page - Main container for displaying and managing merge requests
 * Wires MRList to Tauri backend via useGitLab hooks
 */

import { useMemo } from 'react';
import { useMergeRequests, useRefresh, useAccounts } from '../../hooks/useGitLab';
import { MRList } from './MRList';
import { MRFilters } from './MRFilters';
import { useMRStore, useUIStore } from '../../stores';
import { MRDetailView } from '../mr-detail';

export function MRListPage() {
  const { selectedMr, groupBy } = useMRStore();
  const { data: accounts } = useAccounts();
  const { data: mergeRequests, isLoading, isError, error, refetch } = useMergeRequests();
  const refreshMutation = useRefresh();

  const handleRefresh = async () => {
    await refreshMutation.mutateAsync();
    refetch();
  };

  const hasActiveAccount = accounts?.some((a) => a.is_active);

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

  return (
    <div className="flex h-full">
      {/* MR List Panel */}
      <div
        className={`
          flex-shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700
          ${selectedMr ? 'w-1/3 min-w-[320px] max-w-[480px]' : 'w-full'}
        `}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Merge Requests
            </h2>
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshIcon spinning={refreshMutation.isPending} />
            </button>
          </div>

          <MRFilters projects={projects} authors={authors} />

          <MRList
            mergeRequests={mergeRequests ?? []}
            isLoading={isLoading}
            isError={isError}
            error={error as Error | null}
            onRetry={() => refetch()}
            groupBy={groupBy}
          />
        </div>
      </div>

      {/* MR Detail Panel */}
      {selectedMr && (
        <div className="flex-1 overflow-hidden">
          <MRDetailView mr={selectedMr} onClose={() => useMRStore.getState().setSelectedMr(null)} />
        </div>
      )}
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
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        No GitLab Accounts
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
        Add a GitLab account to start reviewing merge requests. You'll need a personal access token
        with <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">api</code> scope.
      </p>
      <button
        onClick={() => openModal('addAccount')}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Select an Account
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
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
