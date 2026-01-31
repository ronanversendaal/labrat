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
  code_quality: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  potential_bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  security: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  best_practice: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  readability: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
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
          ? 'border-gray-200 dark:border-gray-700 opacity-60'
          : 'border-gray-300 dark:border-gray-600'
        }
      `}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={() => setIsExpanded(!isExpanded)}
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
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : suggestion.status === 'posted'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {suggestion.status}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.title}</h4>
          <button
            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline mt-0.5 text-left"
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
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{suggestion.description}</p>

            {/* Code comparison */}
            {(suggestion.original_code || suggestion.suggested_code) && (
              <div className="space-y-2">
                {suggestion.original_code && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Original:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-red-50 dark:bg-red-900/20 rounded overflow-x-auto">
                      <code className="text-red-700 dark:text-red-300">{suggestion.original_code}</code>
                    </pre>
                  </div>
                )}
                {suggestion.suggested_code && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Suggested:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-green-50 dark:bg-green-900/20 rounded overflow-x-auto">
                      <code className="text-green-700 dark:text-green-300">
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
