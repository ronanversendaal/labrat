/**
 * Filter Parser - Parses search-based filter syntax into structured filters
 *
 * Supports syntax like:
 *   - author:johndoe
 *   - author:!=johndoe (negated - NOT author johndoe)
 *   - project:my-app
 *   - status:draft
 *   - label:bug
 *   - free text search
 */

import type { ParsedFilter, FilterType, MergeRequestFilter } from '../types';

/** Valid filter prefixes */
const FILTER_PREFIXES: Record<string, FilterType> = {
  'author:': 'author',
  'project:': 'project',
  'status:': 'status',
  'label:': 'label',
};

/** Negation prefix that can follow the colon */
const NEGATION_PREFIX = '!=';

/** Status value mappings for user-friendly input */
const STATUS_MAPPINGS: Record<string, Partial<MergeRequestFilter>> = {
  'draft': { is_draft: true },
  'conflicts': { has_conflicts: true },
  'failed': { pipeline_failed: true },
  'ready': { has_conflicts: false, pipeline_failed: false, is_draft: false },
};

/**
 * Parse a filter query string into structured filter tokens
 */
export function parseFilterQuery(query: string): ParsedFilter[] {
  const filters: ParsedFilter[] = [];
  const trimmed = query.trim();

  if (!trimmed) {
    return filters;
  }

  // Match quoted strings or non-space sequences
  // This handles: author:"John Doe" or author:johndoe or "search text"
  const tokenRegex = /(\w+:(?:"[^"]*"|'[^']*'|\S+))|("[^"]*"|'[^']*'|\S+)/g;
  const matches = trimmed.matchAll(tokenRegex);

  for (const match of matches) {
    const token = match[0];
    let parsed = false;

    // Check for filter prefixes
    for (const [prefix, type] of Object.entries(FILTER_PREFIXES)) {
      if (token.toLowerCase().startsWith(prefix)) {
        let value = token.slice(prefix.length);
        let negated = false;

        // Check for negation prefix (!=)
        if (value.startsWith(NEGATION_PREFIX)) {
          negated = true;
          value = value.slice(NEGATION_PREFIX.length);
        }

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (value) {
          filters.push({ type, value, raw: token, negated });
        }
        parsed = true;
        break;
      }
    }

    // If not a prefixed filter, treat as free text search
    if (!parsed) {
      let value = token;
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (value) {
        filters.push({ type: 'text', value, raw: token });
      }
    }
  }

  return filters;
}

/** Negated filter for client-side filtering */
export interface NegatedFilter {
  type: FilterType;
  value: string;
}

/**
 * Convert parsed filters to MergeRequestFilter and search query
 * Returns negated filters separately for client-side filtering
 */
export function filtersToMRFilter(
  parsedFilters: ParsedFilter[],
  projectLookup?: Map<string, number>
): { filter: Partial<MergeRequestFilter>; searchText: string; negatedFilters: NegatedFilter[] } {
  const filter: Partial<MergeRequestFilter> = {};
  const textParts: string[] = [];
  const labels: string[] = [];
  const negatedFilters: NegatedFilter[] = [];

  for (const pf of parsedFilters) {
    // Handle negated filters separately
    if (pf.negated) {
      negatedFilters.push({
        type: pf.type,
        value: pf.type === 'author' ? pf.value.replace(/^@/, '') : pf.value,
      });
      continue;
    }

    switch (pf.type) {
      case 'author':
        // Remove @ prefix if present
        filter.author_username = pf.value.replace(/^@/, '');
        break;

      case 'project':
        // Try to look up project ID, otherwise store the path for client-side filtering
        if (projectLookup) {
          const projectId = projectLookup.get(pf.value.toLowerCase());
          if (projectId) {
            filter.project_id = projectId;
          }
        }
        break;

      case 'status':
        // Map status values to filter fields
        const statusFilter = STATUS_MAPPINGS[pf.value.toLowerCase()];
        if (statusFilter) {
          Object.assign(filter, statusFilter);
        }
        break;

      case 'label':
        labels.push(pf.value);
        break;

      case 'text':
        textParts.push(pf.value);
        break;
    }
  }

  if (labels.length > 0) {
    filter.labels = labels;
  }

  return {
    filter,
    searchText: textParts.join(' '),
    negatedFilters,
  };
}

/**
 * Generate autocomplete suggestions based on current input
 */
export function getFilterSuggestions(
  input: string,
  context: {
    authors?: Array<{ username: string; name: string }>;
    projects?: Array<{ id: number; path: string }>;
    labels?: string[];
  }
): Array<{ label: string; value: string; description?: string }> {
  const suggestions: Array<{ label: string; value: string; description?: string }> = [];
  const lower = input.toLowerCase();

  // If input is empty or just spaces, show filter type hints
  if (!input.trim()) {
    return [
      { label: 'author:', value: 'author:', description: 'Filter by author username' },
      { label: 'author:!=', value: 'author:!=', description: 'Exclude author username' },
      { label: 'project:', value: 'project:', description: 'Filter by project' },
      { label: 'status:', value: 'status:', description: 'Filter by status (draft, conflicts, failed, ready)' },
      { label: 'label:', value: 'label:', description: 'Filter by label' },
    ];
  }

  // Check if user is typing a filter prefix
  const prefixes = ['author:', 'project:', 'status:', 'label:'];
  for (const prefix of prefixes) {
    if (prefix.startsWith(lower) && prefix !== lower) {
      suggestions.push({
        label: prefix,
        value: prefix,
        description: `Filter by ${prefix.slice(0, -1)}`,
      });
    }
  }

  // If typing after author:, suggest authors (including negated)
  if (lower.startsWith('author:') && context.authors) {
    const afterColon = input.slice(7);
    const isNegated = afterColon.startsWith('!=');
    const partial = (isNegated ? afterColon.slice(2) : afterColon).toLowerCase().replace(/^@/, '');
    const prefix = isNegated ? 'author:!=' : 'author:';

    for (const author of context.authors) {
      if (author.username.toLowerCase().includes(partial) ||
          author.name.toLowerCase().includes(partial)) {
        suggestions.push({
          label: `${prefix}${author.username}`,
          value: `${prefix}${author.username}`,
          description: isNegated ? `Exclude ${author.name}` : author.name,
        });
      }
    }
  }

  // If typing after project:, suggest projects
  if (lower.startsWith('project:') && context.projects) {
    const partial = input.slice(8).toLowerCase();
    for (const project of context.projects) {
      if (project.path.toLowerCase().includes(partial)) {
        suggestions.push({
          label: `project:${project.path}`,
          value: `project:${project.path}`,
          description: project.path,
        });
      }
    }
  }

  // If typing after status:, suggest status values
  if (lower.startsWith('status:')) {
    const partial = input.slice(7).toLowerCase();
    const statuses = [
      { value: 'draft', description: 'Show draft MRs' },
      { value: 'conflicts', description: 'Show MRs with conflicts' },
      { value: 'failed', description: 'Show MRs with failed pipelines' },
      { value: 'ready', description: 'Show MRs ready to merge' },
    ];
    for (const status of statuses) {
      if (status.value.startsWith(partial)) {
        suggestions.push({
          label: `status:${status.value}`,
          value: `status:${status.value}`,
          description: status.description,
        });
      }
    }
  }

  // If typing after label:, suggest labels
  if (lower.startsWith('label:') && context.labels) {
    const partial = input.slice(6).toLowerCase();
    for (const label of context.labels) {
      if (label.toLowerCase().includes(partial)) {
        suggestions.push({
          label: `label:${label}`,
          value: `label:${label}`,
        });
      }
    }
  }

  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

/**
 * Build a query string from structured filters
 */
export function buildQueryFromFilters(
  filter: Partial<MergeRequestFilter>,
  searchText?: string
): string {
  const parts: string[] = [];

  if (filter.author_username) {
    parts.push(`author:${filter.author_username}`);
  }

  if (filter.is_draft) {
    parts.push('status:draft');
  } else if (filter.has_conflicts) {
    parts.push('status:conflicts');
  } else if (filter.pipeline_failed) {
    parts.push('status:failed');
  }

  if (filter.labels && filter.labels.length > 0) {
    for (const label of filter.labels) {
      parts.push(`label:${label.includes(' ') ? `"${label}"` : label}`);
    }
  }

  if (searchText) {
    parts.push(searchText);
  }

  return parts.join(' ');
}
