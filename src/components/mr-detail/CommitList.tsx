/**
 * CommitList - Display a list of commits for a merge request
 */

import type { Commit } from '../../types';

interface CommitListProps {
  commits: Commit[];
  isLoading?: boolean;
  onCommitClick?: (commit: Commit) => void;
}

export function CommitList({ commits, isLoading, onCommitClick }: CommitListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="p-8 text-center">
        <CommitIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No commits found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {commits.map((commit) => (
        <CommitItem
          key={commit.id}
          commit={commit}
          onClick={onCommitClick ? () => onCommitClick(commit) : undefined}
        />
      ))}
    </div>
  );
}

interface CommitItemProps {
  commit: Commit;
  onClick?: () => void;
}

function CommitItem({ commit, onClick }: CommitItemProps) {
  const authorInitials = getInitials(commit.author_name);
  const formattedDate = formatDate(commit.authored_date);

  return (
    <div
      className={`px-4 py-3 ${
        onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Author avatar placeholder */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
          {authorInitials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Commit title */}
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {commit.title}
            </h4>
          </div>

          {/* Commit metadata */}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              {commit.short_id}
            </span>
            <span>{commit.author_name}</span>
            <span>authored {formattedDate}</span>
          </div>

          {/* Full message if different from title */}
          {commit.message !== commit.title && commit.message.length > commit.title.length && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">
              {commit.message.slice(commit.title.length).trim()}
            </p>
          )}
        </div>

        {/* External link */}
        {commit.web_url && (
          <a
            href={commit.web_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={(e) => e.stopPropagation()}
            title="View commit in GitLab"
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function CommitIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v6M12 16v6" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
