/**
 * CollapsibleDescription - A collapsible MR description for the Changes tab
 */

import { useState } from 'react';
import type { MergeRequest } from '../../types';

interface CollapsibleDescriptionProps {
  mr: MergeRequest;
}

export function CollapsibleDescription({ mr }: CollapsibleDescriptionProps) {
  // Use local state - persisting expand/collapse would be excessive
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render if no description
  if (!mr.description) {
    return null;
  }

  return (
    <div className="border-b border-edge">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors"
      >
        <span className="text-sm font-medium text-content-muted">
          Description
        </span>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-content-muted text-sm">
              {mr.description}
            </p>
          </div>

          {/* Quick metadata */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-content-secondary">
            {mr.labels.length > 0 && (
              <div className="flex items-center gap-1">
                <span>Labels:</span>
                {mr.labels.slice(0, 3).map((label) => (
                  <span
                    key={label}
                    className="px-1.5 py-0.5 bg-surface-alt rounded"
                  >
                    {label}
                  </span>
                ))}
                {mr.labels.length > 3 && (
                  <span className="text-gray-400">+{mr.labels.length - 3}</span>
                )}
              </div>
            )}
            {mr.milestone && (
              <div>
                Milestone: <span className="font-medium">{mr.milestone.title}</span>
              </div>
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
