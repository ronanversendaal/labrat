/**
 * CollapsibleDescription - Collapsible MR details section for the Changes tab
 * Contains description, labels, milestone, assignees, reviewers, and timestamps
 */

import { useState } from 'react';
import type { MergeRequest } from '../../types';
import { Avatar } from '../common';

interface CollapsibleDescriptionProps {
  mr: MergeRequest;
}

export function CollapsibleDescription({ mr }: CollapsibleDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMetadata =
    mr.description ||
    mr.labels.length > 0 ||
    mr.milestone ||
    mr.assignees.length > 0 ||
    mr.reviewers.length > 0;

  if (!hasMetadata) return null;

  return (
    <div className="border-b border-edge">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3 text-xs text-content-secondary min-w-0">
          <span className="text-sm font-medium text-content-muted shrink-0">Details</span>
          {/* Inline summary when collapsed */}
          {!isExpanded && (
            <>
              {mr.assignees.length > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  {mr.assignees.slice(0, 2).map((a) => (
                    <Avatar key={a.id} src={a.avatar_url} name={a.name} size="xs" />
                  ))}
                  {mr.assignees.length > 2 && <span>+{mr.assignees.length - 2}</span>}
                </span>
              )}
              {mr.labels.length > 0 && (
                <span className="flex items-center gap-1 truncate">
                  {mr.labels.slice(0, 3).map((label) => (
                    <span key={label} className="px-1.5 py-0.5 bg-surface-alt rounded shrink-0">
                      {label}
                    </span>
                  ))}
                  {mr.labels.length > 3 && <span>+{mr.labels.length - 3}</span>}
                </span>
              )}
              {mr.milestone && (
                <span className="shrink-0">{mr.milestone.title}</span>
              )}
            </>
          )}
        </div>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Description */}
          {mr.description && (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-content-muted text-sm">
                {mr.description}
              </p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            {/* Assignees */}
            {mr.assignees.length > 0 && (
              <>
                <span className="text-content-secondary">Assignees</span>
                <div className="flex flex-wrap gap-3">
                  {mr.assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center gap-1.5">
                      <Avatar src={assignee.avatar_url} name={assignee.name} size="xs" />
                      <span className="text-content-muted">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Reviewers */}
            {mr.reviewers.length > 0 && (
              <>
                <span className="text-content-secondary">Reviewers</span>
                <div className="flex flex-wrap gap-3">
                  {mr.reviewers.map((reviewer) => (
                    <div key={reviewer.id} className="flex items-center gap-1.5">
                      <Avatar src={reviewer.avatar_url} name={reviewer.name} size="xs" />
                      <span className="text-content-muted">{reviewer.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Labels */}
            {mr.labels.length > 0 && (
              <>
                <span className="text-content-secondary">Labels</span>
                <div className="flex flex-wrap gap-1.5">
                  {mr.labels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-0.5 text-xs font-medium bg-surface-alt text-content-muted rounded"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Milestone */}
            {mr.milestone && (
              <>
                <span className="text-content-secondary">Milestone</span>
                <div className="flex items-center gap-2 text-content-muted">
                  <span>{mr.milestone.title}</span>
                  {mr.milestone.due_date && (
                    <span className="text-xs text-content-secondary">
                      Due: {new Date(mr.milestone.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Timestamps */}
            <>
              <span className="text-content-secondary">Created</span>
              <span className="text-content-muted">{new Date(mr.created_at).toLocaleString()}</span>
            </>
            <>
              <span className="text-content-secondary">Updated</span>
              <span className="text-content-muted">{new Date(mr.updated_at).toLocaleString()}</span>
            </>
            {mr.merged_at && (
              <>
                <span className="text-content-secondary">Merged</span>
                <span className="text-content-muted">{new Date(mr.merged_at).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
