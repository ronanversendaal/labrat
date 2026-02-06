/**
 * MR Detail - Placeholder component for displaying merge request details
 * Full implementation will be in Phase 5 (User Story 3)
 */

import type { MergeRequest } from '../../types';
import { Avatar } from '../common';
import { ImpedimentBadge } from './ImpedimentBadge';

interface MRDetailProps {
  mr: MergeRequest;
}

export function MRDetail({ mr }: MRDetailProps) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-content-secondary mb-2">
          <span>{mr.project_path || `Project #${mr.project_id}`}</span>
          <span>•</span>
          <span>!{mr.iid}</span>
        </div>
        <h1 className="text-2xl font-bold text-content mb-4">
          {mr.draft && <span className="text-content-tertiary">Draft: </span>}
          {mr.title}
        </h1>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <ImpedimentBadge mr={mr} />
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-content-secondary">
          <div className="flex items-center gap-2">
            <Avatar src={mr.author.avatar_url} name={mr.author.name} size="sm" />
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
          <h2 className="text-lg font-semibold text-content mb-2">
            Description
          </h2>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-content-muted">{mr.description}</p>
          </div>
        </div>
      )}

      {/* Labels */}
      {mr.labels.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-content mb-2">Labels</h2>
          <div className="flex flex-wrap gap-2">
            {mr.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-1 text-xs font-medium bg-surface-alt text-content-secondary rounded"
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
          <h2 className="text-lg font-semibold text-content mb-2">Reviewers</h2>
          <div className="flex flex-wrap gap-3">
            {mr.reviewers.map((reviewer) => (
              <div key={reviewer.id} className="flex items-center gap-2">
                <Avatar src={reviewer.avatar_url} name={reviewer.name} size="md" />
                <span className="text-sm text-content-muted">{reviewer.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignees */}
      {mr.assignees.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-content mb-2">Assignees</h2>
          <div className="flex flex-wrap gap-3">
            {mr.assignees.map((assignee) => (
              <div key={assignee.id} className="flex items-center gap-2">
                <Avatar src={assignee.avatar_url} name={assignee.name} size="md" />
                <span className="text-sm text-content-muted">{assignee.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-edge">
        <a
          href={mr.web_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
        >
          <ExternalLinkIcon />
          Open in GitLab
        </a>
      </div>

      {/* Diff placeholder */}
      <div className="mt-8 p-8 border border-dashed border-edge-strong rounded-lg text-center">
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
        <p className="text-content-secondary">
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
