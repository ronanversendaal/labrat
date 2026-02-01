/**
 * MR Filters - Search-based filter controls for merge request list
 *
 * Supports filter syntax:
 *   - author:username - Filter by author
 *   - project:path - Filter by project
 *   - status:draft|conflicts|failed|ready - Filter by status
 *   - label:name - Filter by label
 *   - free text - Search in titles and descriptions
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMRStore, useUIStore } from '../../stores';
import type { ParsedFilter } from '../../types';
import {
  parseFilterQuery,
  filtersToMRFilter,
  getFilterSuggestions,
} from '../../utils/filterParser';

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
  labels?: string[];
}

export function MRFilters({ projects = [], authors = [], labels = [] }: MRFiltersProps) {
  const { filter, setFilter, setSearchQuery, clearFilters, groupBy, setGroupBy } = useMRStore();
  const { filterPanelExpanded, toggleFilterPanel } = useUIStore();

  // Local state for the search input
  const [localQuery, setLocalQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(localQuery, 300);

  // Parse the query into structured filters
  const parsedFilters = useMemo(
    () => parseFilterQuery(debouncedQuery),
    [debouncedQuery]
  );

  // Get the current word being typed for suggestions
  const currentWord = useMemo(() => {
    const cursorPos = inputRef.current?.selectionStart ?? localQuery.length;
    const beforeCursor = localQuery.slice(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    return words[words.length - 1] || '';
  }, [localQuery]);

  // Get suggestions based on current input
  const suggestions = useMemo(
    () => getFilterSuggestions(currentWord, { authors, projects, labels }),
    [currentWord, authors, projects, labels]
  );

  // Build project lookup map
  const projectLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      map.set(p.path.toLowerCase(), p.id);
      // Also add just the repo name
      const parts = p.path.split('/');
      if (parts.length > 1) {
        map.set(parts[parts.length - 1].toLowerCase(), p.id);
      }
    }
    return map;
  }, [projects]);

  // Apply parsed filters to store when debounced query changes
  useEffect(() => {
    const { filter: newFilter, searchText } = filtersToMRFilter(parsedFilters, projectLookup);
    setFilter(newFilter);
    setSearchQuery(searchText);
  }, [parsedFilters, projectLookup, setFilter, setSearchQuery]);

  // Handle suggestion selection
  const applySuggestion = useCallback((suggestion: { value: string }) => {
    const cursorPos = inputRef.current?.selectionStart ?? localQuery.length;
    const beforeCursor = localQuery.slice(0, cursorPos);
    const afterCursor = localQuery.slice(cursorPos);

    // Find the start of the current word
    const words = beforeCursor.split(/\s+/);
    const currentWordStart = beforeCursor.length - (words[words.length - 1]?.length ?? 0);

    // Replace the current word with the suggestion
    const newQuery =
      localQuery.slice(0, currentWordStart) +
      suggestion.value +
      (suggestion.value.endsWith(':') ? '' : ' ') +
      afterCursor.trimStart();

    setLocalQuery(newQuery);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);

    // Focus input and move cursor after the suggestion
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = currentWordStart + suggestion.value.length + (suggestion.value.endsWith(':') ? 0 : 1);
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [localQuery]);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            applySuggestion(suggestions[selectedSuggestionIndex]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion]
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Remove a specific filter chip
  const removeFilter = useCallback((filterToRemove: ParsedFilter) => {
    // Remove the filter's raw text from the query
    const newQuery = localQuery
      .replace(filterToRemove.raw, '')
      .replace(/\s+/g, ' ')
      .trim();
    setLocalQuery(newQuery);
  }, [localQuery]);

  const hasActiveFilters = parsedFilters.length > 0;

  return (
    <div className="mb-4">
      {/* Search input with suggestions */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Filter merge requests"
            placeholder="Filter: author:name project:path status:draft or free text..."
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedSuggestionIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {localQuery && (
            <button
              onClick={() => {
                setLocalQuery('');
                clearFilters();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear filter"
            >
              <CloseIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.value}
                  onClick={() => applySuggestion(suggestion)}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center justify-between
                    ${index === selectedSuggestionIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }
                  `}
                >
                  <span className="font-mono">{suggestion.label}</span>
                  {suggestion.description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {suggestion.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter toggle button for advanced options */}
        <button
          onClick={toggleFilterPanel}
          className={`
            p-2 rounded-md border transition-colors
            ${filterPanelExpanded
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }
          `}
          aria-label={filterPanelExpanded ? 'Hide options' : 'Show options'}
          aria-expanded={filterPanelExpanded}
        >
          <SettingsIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {parsedFilters.map((pf, index) => (
            <FilterChip
              key={`${pf.type}-${pf.value}-${index}`}
              filter={pf}
              onRemove={() => removeFilter(pf)}
            />
          ))}
        </div>
      )}

      {/* Expanded options panel (grouping, etc.) */}
      {filterPanelExpanded && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Quick filter buttons */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Quick filters
              </label>
              <div className="flex flex-wrap gap-1">
                <QuickFilterButton
                  label="Drafts"
                  isActive={filter.is_draft === true}
                  onClick={() => {
                    if (filter.is_draft) {
                      setLocalQuery(localQuery.replace(/\bstatus:draft\b\s*/g, '').trim());
                    } else {
                      setLocalQuery((localQuery + ' status:draft').trim());
                    }
                  }}
                />
                <QuickFilterButton
                  label="Conflicts"
                  isActive={filter.has_conflicts === true}
                  onClick={() => {
                    if (filter.has_conflicts) {
                      setLocalQuery(localQuery.replace(/\bstatus:conflicts\b\s*/g, '').trim());
                    } else {
                      setLocalQuery((localQuery + ' status:conflicts').trim());
                    }
                  }}
                />
                <QuickFilterButton
                  label="Failed"
                  isActive={filter.pipeline_failed === true}
                  onClick={() => {
                    if (filter.pipeline_failed) {
                      setLocalQuery(localQuery.replace(/\bstatus:failed\b\s*/g, '').trim());
                    } else {
                      setLocalQuery((localQuery + ' status:failed').trim());
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Filter syntax help */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Filter syntax:</span>{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">author:name</code>{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">project:path</code>{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">status:draft|conflicts|failed|ready</code>{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">label:name</code>{' '}
              or free text
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter chip component
function FilterChip({ filter, onRemove }: { filter: ParsedFilter; onRemove: () => void }) {
  const getLabel = () => {
    switch (filter.type) {
      case 'author':
        return `Author: @${filter.value}`;
      case 'project':
        return `Project: ${filter.value}`;
      case 'status':
        return `Status: ${filter.value}`;
      case 'label':
        return `Label: ${filter.value}`;
      case 'text':
        return `"${filter.value}"`;
      default:
        return filter.raw;
    }
  };

  const getColor = () => {
    switch (filter.type) {
      case 'author':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'project':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'status':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'label':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${getColor()}`}>
      {getLabel()}
      <button
        onClick={onRemove}
        className="hover:opacity-70"
        aria-label={`Remove filter: ${getLabel()}`}
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

// Quick filter button
function QuickFilterButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1 text-xs rounded transition-colors
        ${isActive
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }
      `}
    >
      {label}
    </button>
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

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
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
