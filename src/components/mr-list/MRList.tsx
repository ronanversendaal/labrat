import { useMemo, useCallback, useEffect } from 'react';
import type { MergeRequest, MergeRequestSortField } from '../../types';
import { MRCard } from './MRCard';
import { Skeleton } from '../common';
import { EmptyState, ErrorState } from '../layout';
import { useMRStore } from '../../stores';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface MRListProps {
  mergeRequests: MergeRequest[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  groupBy?: 'project' | 'author' | 'date' | 'none';
}

export function MRList({
  mergeRequests,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  groupBy = 'none',
}: MRListProps) {
  const { selectedMrId, setSelectedMr, sort } = useMRStore();

  // Sort merge requests
  const sortedMRs = useMemo(() => {
    if (!mergeRequests?.length) return [];

    return [...mergeRequests].sort((a, b) => {
      const aVal = getSortValue(a, sort.field);
      const bVal = getSortValue(b, sort.field);

      if (sort.direction === 'asc') {
        return aVal.localeCompare(bVal);
      }
      return bVal.localeCompare(aVal);
    });
  }, [mergeRequests, sort]);

  // Group merge requests
  const groupedMRs = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: null, mrs: sortedMRs }];
    }

    const groups = new Map<string, MergeRequest[]>();

    for (const mr of sortedMRs) {
      const groupKey = getGroupKey(mr, groupBy);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(mr);
    }

    return Array.from(groups.entries()).map(([key, mrs]) => ({
      key,
      label: getGroupLabel(mrs[0], groupBy),
      mrs,
    }));
  }, [sortedMRs, groupBy]);

  // Flatten MRs for navigation
  const flatMRs = useMemo(() => {
    return groupedMRs.flatMap((group) => group.mrs);
  }, [groupedMRs]);

  // Get current index
  const currentIndex = useMemo(() => {
    if (!selectedMrId) return -1;
    return flatMRs.findIndex((mr) => mr.id === selectedMrId);
  }, [flatMRs, selectedMrId]);

  // Navigation handlers
  const selectNext = useCallback(() => {
    if (flatMRs.length === 0) return;
    const nextIndex = currentIndex < flatMRs.length - 1 ? currentIndex + 1 : 0;
    setSelectedMr(flatMRs[nextIndex]);
  }, [flatMRs, currentIndex, setSelectedMr]);

  const selectPrev = useCallback(() => {
    if (flatMRs.length === 0) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatMRs.length - 1;
    setSelectedMr(flatMRs[prevIndex]);
  }, [flatMRs, currentIndex, setSelectedMr]);

  // Select first MR when list loads if none selected
  useEffect(() => {
    if (flatMRs.length > 0 && selectedMrId === null) {
      // Don't auto-select, just make keyboard navigation available
    }
  }, [flatMRs, selectedMrId]);

  // Register keyboard shortcuts for MR list navigation
  useKeyboardShortcuts([
    {
      id: 'next-mr',
      label: 'Next MR',
      description: 'Select next merge request',
      keys: ['j', 'arrowdown'],
      category: 'mr-list',
      handler: selectNext,
      preventDefault: true,
    },
    {
      id: 'prev-mr',
      label: 'Previous MR',
      description: 'Select previous merge request',
      keys: ['k', 'arrowup'],
      category: 'mr-list',
      handler: selectPrev,
      preventDefault: true,
    },
  ], { scope: 'mr-list' });

  // Loading state
  if (isLoading && !mergeRequests?.length) {
    return <MRListSkeleton />;
  }

  // Error state
  if (isError && error) {
    return (
      <ErrorState
        title="Failed to load merge requests"
        message={error.message}
        retry={onRetry}
      />
    );
  }

  // Empty state
  if (!mergeRequests?.length) {
    return (
      <EmptyState
        icon={<EmptyIcon />}
        title="No merge requests"
        description="No merge requests match your current filters. Try adjusting your filters or check back later."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groupedMRs.map(({ key, label, mrs }) => (
        <div key={key}>
          {label && (
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">
              {label}
              <span className="ml-2 text-gray-400 dark:text-gray-500">({mrs.length})</span>
            </h3>
          )}
          <div className="space-y-3">
            {mrs.map((mr) => (
              <MRCard
                key={mr.id}
                mr={mr}
                selected={mr.id === selectedMrId}
                onClick={() => setSelectedMr(mr)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MRListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <Skeleton variant="text" width="40%" height="0.875rem" />
            <Skeleton variant="text" width="60px" height="0.75rem" />
          </div>
          <Skeleton variant="text" width="90%" height="1rem" className="mb-2" />
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={24} height={24} />
              <Skeleton variant="text" width="100px" height="0.875rem" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width="70px" height="22px" />
            <Skeleton variant="rectangular" width="60px" height="22px" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getSortValue(mr: MergeRequest, field: MergeRequestSortField): string {
  switch (field) {
    case 'created_at':
      return mr.created_at;
    case 'updated_at':
      return mr.updated_at;
    case 'title':
      return mr.title.toLowerCase();
    default:
      return mr.updated_at;
  }
}

function getGroupKey(mr: MergeRequest, groupBy: string): string {
  switch (groupBy) {
    case 'project':
      return mr.project_path || String(mr.project_id);
    case 'author':
      return mr.author.username;
    case 'date':
      return new Date(mr.updated_at).toISOString().split('T')[0];
    default:
      return 'all';
  }
}

function getGroupLabel(mr: MergeRequest, groupBy: string): string {
  switch (groupBy) {
    case 'project':
      return mr.project_path || `Project #${mr.project_id}`;
    case 'author':
      return mr.author.name;
    case 'date':
      return formatDate(new Date(mr.updated_at));
    default:
      return '';
  }
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function EmptyIcon() {
  return (
    <svg
      className="w-12 h-12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7v4m0 0v-4m0 4h-4m4 0h4"
      />
    </svg>
  );
}
