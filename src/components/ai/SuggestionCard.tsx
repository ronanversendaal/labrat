/**
 * SuggestionCard - Individual AI suggestion display with actions
 */

import { useState } from 'react';
import type { AISuggestion, SuggestionStatus } from '../../types';
import { Button } from '../common';

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onUpdateStatus: (id: string, status: SuggestionStatus) => void;
  onPostToGitLab?: (suggestion: AISuggestion) => void;
  onJumpToLine?: (filePath: string, line: number) => void;
  isUpdating?: boolean;
}

const categoryColors: Record<string, string> = {
  code_quality: 'bg-primary-muted text-primary-text',
  potential_bug: 'bg-negative-muted text-negative-text',
  performance: 'bg-caution-muted text-caution-text',
  security: 'bg-info-muted text-info-text',
  best_practice: 'bg-positive-muted text-positive-text',
  readability: 'bg-info-muted text-info-text',
  documentation: 'bg-surface-alt text-content-secondary',
};

const severityIcons: Record<string, { icon: string; color: string }> = {
  error: { icon: '!', color: 'text-red-500' },
  warning: { icon: '⚠', color: 'text-yellow-500' },
  info: { icon: 'i', color: 'text-blue-500' },
};

const categoryLabels: Record<string, string> = {
  code_quality: 'Code Quality',
  potential_bug: 'Potential Bug',
  performance: 'Performance',
  security: 'Security',
  best_practice: 'Best Practice',
  readability: 'Readability',
  documentation: 'Documentation',
};

export function SuggestionCard({
  suggestion,
  onUpdateStatus,
  onPostToGitLab,
  onJumpToLine,
  isUpdating,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const severity = severityIcons[suggestion.severity] || severityIcons.info;
  const categoryColor = categoryColors[suggestion.category] || categoryColors.code_quality;
  const categoryLabel = categoryLabels[suggestion.category] || suggestion.category;

  const isResolved = suggestion.status !== 'pending';

  return (
    <div
      className={`
        border rounded-lg overflow-hidden transition-all
        ${isResolved
          ? 'border-edge opacity-60'
          : 'border-edge-strong'
        }
      `}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-start gap-3 p-3 cursor-pointer hover:bg-surface-hover text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={`suggestion-${suggestion.id}-content`}
      >
        {/* Severity indicator */}
        <span className={`text-lg font-bold ${severity.color}`}>{severity.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryColor}`}>
              {categoryLabel}
            </span>
            {suggestion.status !== 'pending' && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${
                  suggestion.status === 'accepted'
                    ? 'bg-positive-muted text-positive-text'
                    : suggestion.status === 'posted'
                      ? 'bg-primary-muted text-primary-text'
                      : 'bg-surface-alt text-content-secondary'
                }`}
              >
                {suggestion.status}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-content">{suggestion.title}</h4>
          <button
            className="text-xs text-primary-text hover:underline mt-0.5 text-left"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToLine?.(suggestion.file_path, suggestion.start_line);
            }}
            title="Jump to line in diff"
          >
            {suggestion.file_path}:{suggestion.start_line}
            {suggestion.end_line > suggestion.start_line && `-${suggestion.end_line}`}
          </button>
        </div>

        {/* Expand icon */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div id={`suggestion-${suggestion.id}-content`} className="border-t border-edge">
          <div className="p-3">
            <p className="text-sm text-content-muted mb-3">{suggestion.description}</p>

            {/* Code comparison */}
            {(suggestion.original_code || suggestion.suggested_code) && (
              <div className="space-y-2">
                {suggestion.original_code && (
                  <div>
                    <span className="text-xs font-medium text-content-secondary">
                      Original:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-negative-muted rounded overflow-x-auto">
                      <code className="text-negative-text">{suggestion.original_code}</code>
                    </pre>
                  </div>
                )}
                {suggestion.suggested_code && (
                  <div>
                    <span className="text-xs font-medium text-content-secondary">
                      Suggested:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-positive-muted rounded overflow-x-auto">
                      <code className="text-positive-text">
                        {suggestion.suggested_code}
                      </code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {!isResolved && (
            <div className="flex items-center gap-2 px-3 pb-3">
              <Button
                size="sm"
                variant="primary"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(suggestion.id, 'accepted')}
              >
                Accept
              </Button>
              {onPostToGitLab && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isUpdating}
                  onClick={() => onPostToGitLab(suggestion)}
                >
                  Post to GitLab
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(suggestion.id, 'dismissed')}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
