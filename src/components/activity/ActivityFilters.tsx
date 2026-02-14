/**
 * ActivityFilters - Pill-style filter bar for the activity timeline
 */

export type ActivityFilterType = 'all' | 'comments' | 'activity';

interface ActivityFiltersProps {
  activeFilter: ActivityFilterType;
  onFilterChange: (filter: ActivityFilterType) => void;
  unresolvedOnly: boolean;
  onUnresolvedOnlyChange: (value: boolean) => void;
  unresolvedCount: number;
}

export function ActivityFilters({
  activeFilter,
  onFilterChange,
  unresolvedOnly,
  onUnresolvedOnlyChange,
  unresolvedCount,
}: ActivityFiltersProps) {
  const filters: { key: ActivityFilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'comments', label: 'Comments' },
    { key: 'activity', label: 'System activity' },
  ];

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-edge bg-surface">
      <div className="flex items-center gap-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`
              px-3 py-1 text-sm rounded-full transition-colors
              ${activeFilter === key
                ? 'bg-primary text-white'
                : 'bg-surface-alt text-content-secondary hover:text-content-muted'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-edge" />

      {/* Unresolved toggle */}
      <button
        onClick={() => onUnresolvedOnlyChange(!unresolvedOnly)}
        className={`
          flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors
          ${unresolvedOnly
            ? 'bg-warning-muted text-warning-text ring-1 ring-warning-text/30'
            : unresolvedCount > 0
              ? 'bg-warning-muted/50 text-warning-text hover:bg-warning-muted'
              : 'bg-surface-alt text-content-secondary hover:text-content-muted'
          }
        `}
      >
        <span className={`w-2 h-2 rounded-full ${unresolvedCount > 0 ? 'bg-yellow-500' : 'bg-content-tertiary'}`} />
        Unresolved
        {unresolvedCount > 0 && (
          <span className={`
            px-1.5 py-0.5 text-xs rounded-full
            ${unresolvedOnly ? 'bg-warning-text/20' : 'bg-warning-text/10'}
          `}>
            {unresolvedCount}
          </span>
        )}
      </button>
    </div>
  );
}
