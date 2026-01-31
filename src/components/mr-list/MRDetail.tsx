/**
 * MR Detail - Placeholder component for displaying merge request details
 * Full implementation will be in Phase 5 (User Story 3)
 */

import type { MergeRequest } from '../../types';
import { ImpedimentBadge } from './ImpedimentBadge';

interface MRDetailProps {
  mr: MergeRequest;
}

export function MRDetail({ mr }: MRDetailProps) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>{mr.project_path || `Project #${mr.project_id}`}</span>
          <span>•</span>
          <span>!{mr.iid}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {mr.draft && <span className="text-gray-400 dark:text-gray-500">Draft: </span>}
          {mr.title}
        </h1>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <ImpedimentBadge mr={mr} />
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            {mr.author.avatar_url ? (
              <img
                src={mr.author.avatar_url}
                alt={mr.author.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                {mr.author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{mr.author.name}</span>
          </div>
          <span>•</span>
          <span>
            {mr.source_branch} → {mr.target_branch}
          </span>
        </div>
      </div>

      {/* Description */}
      {mr.description && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Description
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{mr.description}</p>
          </div>
        </div>
      )}

      {/* Labels */}
      {mr.labels.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Labels</h2>
          <div className="flex flex-wrap gap-2">
            {mr.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviewers */}
      {mr.reviewers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Reviewers</h2>
          <div className="flex flex-wrap gap-3">
            {mr.reviewers.map((reviewer) => (
              <div key={reviewer.id} className="flex items-center gap-2">
                {reviewer.avatar_url ? (
                  <img
                    src={reviewer.avatar_url}
                    alt={reviewer.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    {reviewer.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">{reviewer.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignees */}
      {mr.assignees.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Assignees</h2>
          <div className="flex flex-wrap gap-3">
            {mr.assignees.map((assignee) => (
              <div key={assignee.id} className="flex items-center gap-2">
                {assignee.avatar_url ? (
                  <img
                    src={assignee.avatar_url}
                    alt={assignee.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    {assignee.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">{assignee.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href={mr.web_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <ExternalLinkIcon />
          Open in GitLab
        </a>
      </div>

      {/* Diff placeholder */}
      <div className="mt-8 p-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">
          Diff view will be available in a future update
        </p>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
