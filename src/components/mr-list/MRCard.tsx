import { forwardRef } from 'react';
import type { MergeRequest } from '../../types';
import { Avatar } from '../common';
import { ImpedimentBadge } from './ImpedimentBadge';

interface MRCardProps {
  mr: MergeRequest;
  selected?: boolean;
  onClick?: () => void;
}

export const MRCard = forwardRef<HTMLDivElement, MRCardProps>(function MRCard({ mr, selected = false, onClick }, ref) {
  const timeAgo = getTimeAgo(new Date(mr.updated_at));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-selected={selected}
      aria-label={`Open merge request: ${mr.title}${mr.draft ? ' (Draft)' : ''}`}
      className={`
        p-4 border rounded-lg cursor-pointer
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${selected
          ? 'border-blue-500 bg-primary-muted'
          : 'border-edge hover:border-edge-strong'
        }
      `}
    >
      {/* Header: Project and time */}
      <div className="flex items-center justify-between text-sm text-content-secondary mb-2">
        <span
          className="font-medium truncate max-w-[200px]"
          title={mr.project_path || undefined}
        >
          {mr.project_name || mr.project_path?.split('/').pop() || `Project #${mr.project_id}`}
        </span>
        <span className="text-xs">{timeAgo}</span>
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-content mb-2 line-clamp-2">
        {mr.draft && (
          <span className="text-content-tertiary mr-1">Draft:</span>
        )}
        {mr.title}
      </h3>

      {/* Author and branch info */}
      <div className="flex items-center gap-3 mb-3">
        {/* Author avatar and name */}
        <div className="flex items-center gap-2">
          <Avatar src={mr.author.avatar_url} name={mr.author.name} size="sm" />
          <span className="text-sm text-content-secondary">
            {mr.author.name}
          </span>
        </div>

        {/* Branch info */}
        <div className="text-xs text-content-tertiary flex items-center gap-1">
          <span className="truncate max-w-[100px]">{mr.source_branch}</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="truncate max-w-[100px]">{mr.target_branch}</span>
        </div>
      </div>

      {/* Impediment badges */}
      <div className="flex flex-wrap items-center gap-2">
        <ImpedimentBadge mr={mr} />

        {/* Labels */}
        {mr.labels.slice(0, 3).map((label) => (
          <span
            key={label}
            className="px-2 py-0.5 text-xs font-medium bg-surface-alt text-content-secondary rounded"
          >
            {label}
          </span>
        ))}
        {mr.labels.length > 3 && (
          <span className="text-xs text-gray-400">+{mr.labels.length - 3}</span>
        )}
      </div>

      {/* Reviewers */}
      {mr.reviewers.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-content-secondary">Reviewers:</span>
          <div className="flex -space-x-2">
            {mr.reviewers.slice(0, 3).map((reviewer) => (
              <Avatar
                key={reviewer.id}
                src={reviewer.avatar_url}
                name={reviewer.name}
                size="xs"
                className="border border-canvas"
              />
            ))}
            {mr.reviewers.length > 3 && (
              <span className="text-xs text-gray-400 ml-2">
                +{mr.reviewers.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
