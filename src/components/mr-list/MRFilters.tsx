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
import { useMRStore } from '../../stores';
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
  const { appliedFilters, addAppliedFilter, removeAppliedFilter, replaceFilter, setNegatedFilters, specialFilters, setSpecialFilters, setSearchQuery, setSort, sort, clearFilters, groupBy, setGroupBy, toolbarVisible, searchVisible, setSearchVisible } = useMRStore();

  // Local state for the search input (only used for composing new filters / free text)
  const [localQuery, setLocalQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-undef
  const toolbarFirstRef = useRef<HTMLSelectElement>(null);

  const debouncedQuery = useDebounce(localQuery, 300);

  // Get the current word being typed for suggestions
  const currentWord = useMemo(() => {
    const cursorPos = inputRef.current?.selectionStart ?? localQuery.length;
    const beforeCursor = localQuery.slice(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    return words[words.length - 1] || '';
  }, [localQuery]);

  // Get suggestions based on current input, excluding already-applied filters
  const suggestions = useMemo(
    () => getFilterSuggestions(currentWord, { authors, projects, labels }, appliedFilters),
    [currentWord, authors, projects, labels, appliedFilters]
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

  // Sync applied filters → store filter + negatedFilters (replace, not merge)
  useEffect(() => {
    const { filter: newFilter, negatedFilters: parsedNegatedFilters } = filtersToMRFilter(appliedFilters, projectLookup);
    replaceFilter(newFilter);
    setNegatedFilters(parsedNegatedFilters);
  }, [appliedFilters, projectLookup, replaceFilter, setNegatedFilters]);

  // Sync free text from input → searchQuery
  useEffect(() => {
    const parsed = parseFilterQuery(debouncedQuery);
    const textParts = parsed.filter((f) => f.type === 'text').map((f) => f.value);
    setSearchQuery(textParts.join(' '));
  }, [debouncedQuery, setSearchQuery]);

  // Handle suggestion selection
  const isFilterPrefix = (value: string) => value.endsWith(':') || value.endsWith(':!=');

  const applySuggestion = useCallback((suggestion: { value: string }) => {
    const cursorPos = inputRef.current?.selectionStart ?? localQuery.length;
    const beforeCursor = localQuery.slice(0, cursorPos);
    const afterCursor = localQuery.slice(cursorPos);
    const words = beforeCursor.split(/\s+/);
    const currentWordStart = beforeCursor.length - (words[words.length - 1]?.length ?? 0);

    if (isFilterPrefix(suggestion.value)) {
      // Prefix suggestion — keep in input for further typing
      const newQuery =
        localQuery.slice(0, currentWordStart) +
        suggestion.value +
        afterCursor.trimStart();
      setLocalQuery(newQuery);
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
        const pos = currentWordStart + suggestion.value.length;
        inputRef.current?.setSelectionRange(pos, pos);
      }, 0);
    } else {
      // Complete filter — add to store and clear from input
      const parsed = parseFilterQuery(suggestion.value);
      if (parsed.length > 0) {
        addAppliedFilter(parsed[0]);
      }
      const newQuery = (localQuery.slice(0, currentWordStart) + afterCursor.trimStart()).trim();
      setLocalQuery(newQuery);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [localQuery, addAppliedFilter]);

  // Handle keyboard navigation in suggestions + Escape to hide search
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop all handled keys from bubbling to parent handlers (e.g. MR list Enter/Escape)
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showSuggestions && suggestions.length > 0) {
          // First Escape: close suggestions, keep search bar
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        } else {
          // Second Escape: hide search bar and blur input
          setSearchVisible(false);
          inputRef.current?.blur();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
          applySuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          // Commit any structured filters from input, keep free text
          const currentParsed = parseFilterQuery(localQuery);
          const structured = currentParsed.filter((f) => f.type !== 'text');
          const freeText = currentParsed.filter((f) => f.type === 'text').map((f) => f.value).join(' ');
          for (const sf of structured) {
            addAppliedFilter(sf);
          }
          setLocalQuery(freeText);
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        return;
      }

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
        case 'Tab':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            applySuggestion(suggestions[selectedSuggestionIndex]);
          } else {
            // Auto-complete with first suggestion
            applySuggestion(suggestions[0]);
          }
          break;
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion, setSearchVisible, localQuery, addAppliedFilter]
  );

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const selected = suggestionsRef.current.querySelector(
        `[data-suggestion-index="${selectedSuggestionIndex}"]`
      );
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedSuggestionIndex]);

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

  // Focus first toolbar element when toolbar becomes visible
  useEffect(() => {
    if (toolbarVisible) {
      requestAnimationFrame(() => toolbarFirstRef.current?.focus());
    }
  }, [toolbarVisible]);

  const hasSpecialFilters = specialFilters.excludeApprovedByMe || specialFilters.reviewerIsMe;
  const hasActiveFilters = appliedFilters.length > 0 || hasSpecialFilters;

  // Remove a special filter
  const removeSpecialFilter = useCallback((filterKey: keyof typeof specialFilters) => {
    setSpecialFilters({ [filterKey]: false });
  }, [setSpecialFilters]);

  return (
    <div className="mb-4">
      {/* Search input + filter chips (toggled via `/` keybinding) */}
      {searchVisible && (
        <>
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
                      tabIndex={-1}
                      data-suggestion-index={index}
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
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {specialFilters.reviewerIsMe && (
                <SpecialFilterChip
                  label="Reviewer: Me"
                  onRemove={() => removeSpecialFilter('reviewerIsMe')}
                />
              )}
              {specialFilters.excludeApprovedByMe && (
                <SpecialFilterChip
                  label="NOT Approved by me"
                  onRemove={() => removeSpecialFilter('excludeApprovedByMe')}
                />
              )}
              {appliedFilters.map((af, index) => (
                <FilterChip
                  key={`${af.negated ? 'neg-' : ''}${af.type}-${af.value}-${index}`}
                  filter={af}
                  onRemove={() => removeAppliedFilter(af)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Unified toolbar: group + sort (toggled via `g` keybinding) */}
      {toolbarVisible && (
        <div className="mb-2 flex items-center gap-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Group by
            </label>
            <select
              ref={toolbarFirstRef}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'project' | 'author' | 'date' | 'none')}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="none">None</option>
              <option value="project">Project</option>
              <option value="author">Author</option>
              <option value="date">Last updated</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Sort
            </label>
            <select
              value={sort.field}
              onChange={(e) => setSort({ ...sort, field: e.target.value as 'updated_at' | 'created_at' | 'title' })}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="updated_at">Updated</option>
              <option value="created_at">Created</option>
              <option value="title">Title</option>
            </select>
            <button
              onClick={() => setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
              className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
              title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
            >
              <SortDirectionIcon direction={sort.direction} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter chip component
function FilterChip({ filter, onRemove }: { filter: ParsedFilter; onRemove: () => void }) {
  const getLabel = () => {
    const negatePrefix = filter.negated ? 'NOT ' : '';
    switch (filter.type) {
      case 'author':
        return `${negatePrefix}Author: @${filter.value}`;
      case 'project':
        return `${negatePrefix}Project: ${filter.value}`;
      case 'status':
        return `${negatePrefix}Status: ${filter.value}`;
      case 'label':
        return `${negatePrefix}Label: ${filter.value}`;
      case 'text':
        return `"${filter.value}"`;
      default:
        return filter.raw;
    }
  };

  const getColor = () => {
    // Negated filters get a red-ish tint
    if (filter.negated) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
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

// Special filter chip (for programmatic filters like "reviewer is me")
function SpecialFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-70"
        aria-label={`Remove filter: ${label}`}
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

function SortDirectionIcon({ direction, className }: { direction: 'asc' | 'desc'; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {direction === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      )}
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
