import type { MergeRequest } from '../../types';
import { ImpedimentBadge } from './ImpedimentBadge';

interface MRCardProps {
  mr: MergeRequest;
  selected?: boolean;
  onClick?: () => void;
}

export function MRCard({ mr, selected = false, onClick }: MRCardProps) {
  const timeAgo = getTimeAgo(new Date(mr.updated_at));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-selected={selected}
      aria-label={`Open merge request: ${mr.title}${mr.draft ? ' (Draft)' : ''}`}
      className={`
        p-4 border rounded-lg cursor-pointer
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      {/* Header: Project and time */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span className="font-medium truncate max-w-[200px]">
          {mr.project_path || `Project #${mr.project_id}`}
        </span>
        <span className="text-xs">{timeAgo}</span>
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
        {mr.draft && (
          <span className="text-gray-400 dark:text-gray-500 mr-1">Draft:</span>
        )}
        {mr.title}
      </h3>

      {/* Author and branch info */}
      <div className="flex items-center gap-3 mb-3">
        {/* Author avatar and name */}
        <div className="flex items-center gap-2">
          {mr.author.avatar_url ? (
            <img
              src={mr.author.avatar_url}
              alt={mr.author.name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
              {mr.author.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {mr.author.name}
          </span>
        </div>

        {/* Branch info */}
        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
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
            className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
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
          <span className="text-xs text-gray-500 dark:text-gray-400">Reviewers:</span>
          <div className="flex -space-x-2">
            {mr.reviewers.slice(0, 3).map((reviewer) => (
              reviewer.avatar_url ? (
                <img
                  key={reviewer.id}
                  src={reviewer.avatar_url}
                  alt={reviewer.name}
                  title={reviewer.name}
                  className="w-5 h-5 rounded-full border border-white dark:border-gray-800"
                />
              ) : (
                <div
                  key={reviewer.id}
                  title={reviewer.name}
                  className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 border border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300"
                >
                  {reviewer.name.charAt(0).toUpperCase()}
                </div>
              )
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
}

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
