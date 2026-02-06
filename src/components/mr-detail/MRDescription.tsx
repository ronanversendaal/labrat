/**
 * MR Description - Display MR description, labels, milestone, and metadata
 */

import type { MergeRequest } from '../../types';
import { Avatar } from '../common';

interface MRDescriptionProps {
  mr: MergeRequest;
}

export function MRDescription({ mr }: MRDescriptionProps) {
  return (
    <div className="space-y-6">
      {/* Description */}
      {mr.description && (
        <div>
          <h3 className="text-sm font-medium text-content-secondary mb-2">
            Description
          </h3>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-content-muted">
              {mr.description}
            </p>
          </div>
        </div>
      )}

      {/* Labels */}
      {mr.labels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-content-secondary mb-2">
            Labels
          </h3>
          <div className="flex flex-wrap gap-2">
            {mr.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-1 text-xs font-medium bg-surface-alt text-content-muted rounded"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Milestone */}
      {mr.milestone && (
        <div>
          <h3 className="text-sm font-medium text-content-secondary mb-2">
            Milestone
          </h3>
          <div className="flex items-center gap-2">
            <MilestoneIcon />
            <span className="text-sm text-content-muted">
              {mr.milestone.title}
            </span>
            {mr.milestone.due_date && (
              <span className="text-xs text-content-secondary">
                Due: {new Date(mr.milestone.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Assignees */}
      {mr.assignees.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-content-secondary mb-2">
            Assignees
          </h3>
          <div className="flex flex-wrap gap-3">
            {mr.assignees.map((assignee) => (
              <UserBadge key={assignee.id} user={assignee} />
            ))}
          </div>
        </div>
      )}

      {/* Reviewers */}
      {mr.reviewers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-content-secondary mb-2">
            Reviewers
          </h3>
          <div className="flex flex-wrap gap-3">
            {mr.reviewers.map((reviewer) => (
              <UserBadge key={reviewer.id} user={reviewer} />
            ))}
          </div>
        </div>
      )}

      {/* Branch info */}
      <div>
        <h3 className="text-sm font-medium text-content-secondary mb-2">
          Branches
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <code className="px-2 py-1 bg-surface-alt rounded">
            {mr.source_branch}
          </code>
          <ArrowIcon />
          <code className="px-2 py-1 bg-surface-alt rounded">
            {mr.target_branch}
          </code>
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-content-secondary space-y-1">
        <div>Created: {new Date(mr.created_at).toLocaleString()}</div>
        <div>Updated: {new Date(mr.updated_at).toLocaleString()}</div>
        {mr.merged_at && <div>Merged: {new Date(mr.merged_at).toLocaleString()}</div>}
      </div>
    </div>
  );
}

function UserBadge({ user }: { user: { id: number; name: string; avatar_url: string | null } }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar src={user.avatar_url} name={user.name} size="sm" />
      <span className="text-sm text-content-muted">{user.name}</span>
    </div>
  );
}

function MilestoneIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
