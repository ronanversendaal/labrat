/**
 * MR Filters - Filter and search controls for merge request list
 */

import { useState, useEffect, useCallback } from 'react';
import { useMRStore, useUIStore } from '../../stores';
import type { MergeRequestFilter } from '../../types';

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface MRFiltersProps {
  projects?: Array<{ id: number; path: string }>;
  authors?: Array<{ username: string; name: string }>;
}

export function MRFilters({ projects = [], authors = [] }: MRFiltersProps) {
  const { filter, setFilter, searchQuery, setSearchQuery, clearFilters, groupBy, setGroupBy } = useMRStore();
  const { filterPanelExpanded, toggleFilterPanel } = useUIStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Sync debounced search to store
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  const handleFilterChange = useCallback(
    (key: keyof MergeRequestFilter, value: unknown) => {
      setFilter({ [key]: value === '' ? undefined : value });
    },
    [setFilter]
  );

  const hasActiveFilters =
    Object.values(filter).some((v) => v !== undefined && v !== null) || searchQuery !== '';

  return (
    <div className="mb-4">
      {/* Search and filter toggle row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Search input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            aria-label="Search merge requests"
            placeholder="Search merge requests..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <CloseIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filter toggle button */}
        <button
          onClick={toggleFilterPanel}
          className={`
            p-2 rounded-md border transition-colors
            ${filterPanelExpanded
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }
          `}
          aria-label={filterPanelExpanded ? 'Hide filters' : 'Show filters'}
          aria-expanded={filterPanelExpanded}
        >
          <FilterIcon className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Clear filters button (only visible when filters are active) */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              clearFilters();
              setLocalSearch('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {filterPanelExpanded && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project filter */}
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Project
                </label>
                <select
                  value={filter.project_id ?? ''}
                  onChange={(e) => handleFilterChange('project_id', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.path}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Author filter */}
            {authors.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Author
                </label>
                <select
                  value={filter.author_username ?? ''}
                  onChange={(e) => handleFilterChange('author_username', e.target.value || undefined)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All authors</option>
                  {authors.map((a) => (
                    <option key={a.username} value={a.username}>
                      {a.name} (@{a.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Impediment filters */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Status
              </label>
              <select
                value={getImpedimentValue(filter)}
                onChange={(e) => applyImpedimentFilter(e.target.value, setFilter)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="conflicts">Has conflicts</option>
                <option value="pipeline_failed">Pipeline failed</option>
                <option value="draft">Draft MRs</option>
                <option value="ready">Ready to merge</option>
              </select>
            </div>

            {/* Group by */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Group by
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'project' | 'author' | 'date' | 'none')}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="none">No grouping</option>
                <option value="project">Project</option>
                <option value="author">Author</option>
                <option value="date">Last updated</option>
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
              {filter.project_id && (
                <FilterChip
                  label={`Project: ${projects.find((p) => p.id === filter.project_id)?.path || filter.project_id}`}
                  onRemove={() => handleFilterChange('project_id', undefined)}
                />
              )}
              {filter.author_username && (
                <FilterChip
                  label={`Author: @${filter.author_username}`}
                  onRemove={() => handleFilterChange('author_username', undefined)}
                />
              )}
              {filter.has_conflicts && (
                <FilterChip label="Has conflicts" onRemove={() => handleFilterChange('has_conflicts', undefined)} />
              )}
              {filter.pipeline_failed && (
                <FilterChip label="Pipeline failed" onRemove={() => handleFilterChange('pipeline_failed', undefined)} />
              )}
              {filter.is_draft && (
                <FilterChip label="Draft" onRemove={() => handleFilterChange('is_draft', undefined)} />
              )}
              {searchQuery && (
                <FilterChip label={`Search: "${searchQuery}"`} onRemove={() => {
                  setLocalSearch('');
                  setSearchQuery('');
                }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to get current impediment filter value
function getImpedimentValue(filter: MergeRequestFilter): string {
  if (filter.has_conflicts) return 'conflicts';
  if (filter.pipeline_failed) return 'pipeline_failed';
  if (filter.is_draft) return 'draft';
  if (filter.has_conflicts === false && filter.pipeline_failed === false && filter.is_draft === false) {
    return 'ready';
  }
  return '';
}

// Helper to apply impediment filter
function applyImpedimentFilter(
  value: string,
  setFilter: (filter: Partial<MergeRequestFilter>) => void
) {
  // Clear all impediment filters first
  const clearImpediments = {
    has_conflicts: undefined,
    pipeline_failed: undefined,
    is_draft: undefined,
  };

  switch (value) {
    case 'conflicts':
      setFilter({ ...clearImpediments, has_conflicts: true });
      break;
    case 'pipeline_failed':
      setFilter({ ...clearImpediments, pipeline_failed: true });
      break;
    case 'draft':
      setFilter({ ...clearImpediments, is_draft: true });
      break;
    case 'ready':
      setFilter({ has_conflicts: false, pipeline_failed: false, is_draft: false });
      break;
    default:
      setFilter(clearImpediments);
  }
}

// Filter chip component
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-blue-900 dark:hover:text-blue-200"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
