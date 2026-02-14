/**
 * ActivityTimeline - Chronological timeline view replacing the old ActivityTab
 */

import { useState, useMemo } from 'react';
import type { Discussion, Author } from '../../types';
import { Skeleton } from '../common';
import { CommentComposer } from '../comments';
import { ActivityFilters, type ActivityFilterType } from './ActivityFilters';
import { ActivityEvent } from './ActivityEvent';
import { getDateLabel } from '../../utils/dateFormat';

interface ActivityTimelineProps {
  discussions: Discussion[];
  isLoading: boolean;
  projectId: number;
  mrIid: number;
  mrAuthor?: Author;
}

type TimelineItem =
  | { type: 'date-separator'; label: string; key: string }
  | { type: 'event'; discussion: Discussion; key: string };

export function ActivityTimeline({
  discussions,
  isLoading,
  projectId,
  mrIid,
  mrAuthor,
}: ActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<ActivityFilterType>('all');
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const unresolvedCount = useMemo(
    () => discussions.filter((d) => d.notes.some((n) => n.resolvable && !n.resolved)).length,
    [discussions]
  );

  const timelineItems = useMemo(() => {
    // 1. Filter by type
    let filtered = discussions;

    if (activeFilter === 'comments') {
      filtered = filtered.filter((d) => !d.notes[0]?.system);
    } else if (activeFilter === 'activity') {
      filtered = filtered.filter((d) => d.notes[0]?.system);
    }

    // 2. Filter by unresolved
    if (unresolvedOnly) {
      filtered = filtered.filter(
        (d) => d.notes.some((n) => n.resolvable && !n.resolved)
      );
    }

    // 3. Sort chronologically by first note's created_at
    const sorted = [...filtered].sort((a, b) => {
      const aTime = new Date(a.notes[0]?.created_at || 0).getTime();
      const bTime = new Date(b.notes[0]?.created_at || 0).getTime();
      return bTime - aTime;
    });

    // 4. Insert date separators
    const items: TimelineItem[] = [];
    let lastDateLabel = '';

    for (const discussion of sorted) {
      const firstNote = discussion.notes[0];
      if (!firstNote) continue;

      const dateLabel = getDateLabel(firstNote.created_at);

      if (dateLabel !== lastDateLabel) {
        items.push({
          type: 'date-separator',
          label: dateLabel,
          key: `sep-${dateLabel}`,
        });
        lastDateLabel = dateLabel;
      }

      items.push({
        type: 'event',
        discussion,
        key: discussion.id,
      });
    }

    return items;
  }, [discussions, activeFilter, unresolvedOnly]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={100} />
        <Skeleton variant="rectangular" height={100} />
      </div>
    );
  }

  const emptyMessage = (() => {
    if (unresolvedOnly) return 'No unresolved threads';
    if (activeFilter === 'comments') return 'No comments yet';
    if (activeFilter === 'activity') return 'No system activity';
    return 'No activity yet';
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Sticky filter bar */}
      <ActivityFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        unresolvedOnly={unresolvedOnly}
        onUnresolvedOnlyChange={setUnresolvedOnly}
        unresolvedCount={unresolvedCount}
      />

      {/* Scrollable timeline body */}
      <div className="flex-1 overflow-auto py-4">
        {timelineItems.length === 0 ? (
          <div className="text-center text-content-secondary py-12">
            <p>{emptyMessage}</p>
            {activeFilter === 'all' && !unresolvedOnly && (
              <p className="text-sm mt-1 text-content-tertiary">
                Start a conversation by adding a comment below
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {timelineItems.map((item) => {
              if (item.type === 'date-separator') {
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-6 py-2 first:pt-0"
                  >
                    <div className="h-px flex-1 bg-edge" />
                    <span className="text-xs font-medium text-content-tertiary shrink-0">
                      {item.label}
                    </span>
                    <div className="h-px flex-1 bg-edge" />
                  </div>
                );
              }

              return (
                <ActivityEvent
                  key={item.key}
                  discussion={item.discussion}
                  projectId={projectId}
                  mrIid={mrIid}
                  mrAuthor={mrAuthor}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pinned comment composer at bottom */}
      <div className="border-t border-edge px-6 py-3 bg-surface">
        {showComposer ? (
          <CommentComposer
            projectId={projectId}
            mrIid={mrIid}
            onSuccess={() => setShowComposer(false)}
            onCancel={() => setShowComposer(false)}
            placeholder="Write a comment..."
          />
        ) : (
          <button
            onClick={() => setShowComposer(true)}
            className="w-full text-left px-4 py-2.5 text-sm text-content-tertiary bg-surface-alt rounded-lg border border-edge hover:border-content-tertiary transition-colors"
          >
            Write a comment...
          </button>
        )}
      </div>
    </div>
  );
}
