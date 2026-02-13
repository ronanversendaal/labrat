import { useMemo } from 'react';
import { useMyMergeRequests } from '../../hooks/useGitLab';
import { useMRStore } from '../../stores';
import { MRDetailView } from '../mr-detail';
import { MyMRCard } from './MyMRCard';
import type { ApprovalState } from '../../types';

export function MyMRsPage() {
  const { selectedMr, isDetailOpen, openDetail, closeDetail, setSelectedMr } = useMRStore();
  const { data, isLoading, isFetching, isError, error, refetch } = useMyMergeRequests();

  const mergeRequests = data?.merge_requests ?? [];
  const approvalStates: Record<number, ApprovalState> = data?.approval_states ?? {};

  // Sort by updated_at desc
  const sortedMRs = useMemo(() => {
    return [...mergeRequests].sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [mergeRequests]);

  // Show detail view when open and MR is selected
  if (isDetailOpen && selectedMr) {
    return (
      <div className="h-full overflow-hidden">
        <MRDetailView mr={selectedMr} onClose={closeDetail} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-content flex items-center gap-2">
            My Merge Requests
            {isFetching && !isLoading && (
              <svg className="w-4 h-4 animate-spin text-content-tertiary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </h2>
          <button
            onClick={() => refetch()}
            className="p-2 text-content-secondary hover:text-content-muted rounded-md hover:bg-surface-hover"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-8 h-8 animate-spin text-primary mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-content-secondary">Loading your merge requests...</p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-negative mb-2">Failed to load merge requests</p>
            <p className="text-content-secondary text-sm mb-4">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && sortedMRs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-16 h-16 text-content-tertiary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <p className="text-content-secondary">No open merge requests authored by you</p>
          </div>
        )}

        {/* MR list */}
        {!isLoading && !isError && sortedMRs.length > 0 && (
          <div className="space-y-3">
            {sortedMRs.map((mr) => (
              <MyMRCard
                key={mr.id}
                mr={mr}
                approvalState={approvalStates[mr.id]}
                onClick={() => {
                  setSelectedMr(mr);
                  openDetail();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
