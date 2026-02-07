/**
 * Utility to process and render GitLab note body with proper suggestion styling
 */

import { useMemo, useCallback } from 'react';

/**
 * Parse the suggestion range from suggestion syntax
 * ```suggestion:-N+M means:
 * - Replace from N lines before the comment line
 * - To M lines after the comment line
 * Default is ```suggestion:-0+0 (just the line the comment is on)
 */
export function parseSuggestionRange(body: string): { linesBefore: number; linesAfter: number } {
  const match = body.match(/```suggestion[:\s]*(-?\d+)?([+-]\d+)?/);
  if (match) {
    // GitLab format is like -0+0 or -3+0
    const fullMatch = body.match(/```suggestion[:\s]*([-+]?\d+)?([-+]\d+)?/);
    if (fullMatch) {
      const first = parseInt(fullMatch[1] || '0', 10);
      const second = parseInt(fullMatch[2] || '0', 10);
      // In GitLab, the format is -N+M where:
      // N = lines before (negative means before)
      // M = lines after (positive means after)
      return {
        linesBefore: Math.abs(first),
        linesAfter: Math.abs(second),
      };
    }
  }
  return { linesBefore: 0, linesAfter: 0 };
}

/**
 * Process HTML to transform GitLab suggestion blocks into styled diff format
 * Now accepts originalLines to show deletions and suggestionId for apply functionality
 */
export function processNoteHtml(html: string, originalLines?: string[], suggestionId?: string): string {
  if (!html) return html;

  let processed = html;

  // Pattern 1: pre tag with lang attribute starting with "suggestion"
  processed = processed.replace(
    /<pre([^>]*?)lang=["']suggestion[^"']*["']([^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, _before, _after, content) => {
      const codeContent = content.replace(/<\/?code[^>]*>/gi, '').trim();
      return createSuggestionHtml(decodeHtmlEntities(codeContent), originalLines, suggestionId);
    }
  );

  // Pattern 2: pre/code block containing ```suggestion markdown
  processed = processed.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, content) => {
      const decoded = decodeHtmlEntities(content);
      // Check if this contains a suggestion block
      const suggestionMatch = decoded.match(/```suggestion[^\n]*\n([\s\S]*?)```/);
      if (suggestionMatch) {
        return createSuggestionHtml(suggestionMatch[1].trim(), originalLines, suggestionId);
      }
      return _match; // Return original if no suggestion found
    }
  );

  // Pattern 3: code tag (inline) containing suggestion markdown
  processed = processed.replace(
    /<code[^>]*>(```suggestion[^\n]*\n)([\s\S]*?)(```)<\/code>/gi,
    (_match, _header, content, _footer) => {
      return createSuggestionHtml(decodeHtmlEntities(content).trim(), originalLines, suggestionId);
    }
  );

  // Pattern 4: Plain text suggestion blocks (fallback)
  processed = processed.replace(
    /```suggestion[^\n]*\n([\s\S]*?)```/g,
    (_match, content) => {
      return createSuggestionHtml(content.trim(), originalLines, suggestionId);
    }
  );

  // Pattern 5: GitLab's div-based suggestion format
  processed = processed.replace(
    /<div[^>]*class="[^"]*suggestion[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, content) => {
      const codeContent = content.replace(/<[^>]+>/g, '').trim();
      return createSuggestionHtml(decodeHtmlEntities(codeContent), originalLines, suggestionId);
    }
  );

  // Pattern 6: Content in <p> tags with <code> containing suggestion (GitLab sometimes does this)
  processed = processed.replace(
    /<p[^>]*><code[^>]*>(`{3}suggestion[^`]*)([\s\S]*?)(`{3})<\/code><\/p>/gi,
    (_match, _header, content, _footer) => {
      return createSuggestionHtml(decodeHtmlEntities(content).trim(), originalLines, suggestionId);
    }
  );

  // Pattern 7: Handle when GitLab encodes backticks as HTML entities
  // &#96; = backtick, or when content is spread across multiple <p>/<code> tags
  const backtickPattern = /(?:&#96;|`){3}suggestion[^\n]*\n([\s\S]*?)(?:&#96;|`){3}/gi;
  processed = processed.replace(backtickPattern, (_match, content) => {
    return createSuggestionHtml(decodeHtmlEntities(content).trim(), originalLines, suggestionId);
  });

  return processed;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
    '&#96;': '`',
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x60;': '`',
  };
  // Also handle numeric entities like &#96;
  return text
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&[a-zA-Z]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Get the common leading whitespace from a set of lines
 */
function getCommonIndent(lines: string[]): string {
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  if (nonEmptyLines.length === 0) return '';

  // Get leading whitespace from each non-empty line
  const indents = nonEmptyLines.map(line => {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  });

  // Find minimum indent length
  const minLength = Math.min(...indents.map(i => i.length));
  return indents[0].substring(0, minLength);
}

/**
 * Create HTML for a styled suggestion block with both deletions and additions
 */
function createSuggestionHtml(code: string, originalLines?: string[], suggestionId?: string): string {
  // Split into lines and create diff-style output
  const newLines = code.split('\n');

  // Get the common indentation from original lines to apply to suggestion lines
  const commonIndent = originalLines && originalLines.length > 0
    ? getCommonIndent(originalLines)
    : '';

  // Create deletion lines (original code being replaced)
  const deletionLines = (originalLines || []).map(line => {
    const escapedLine = escapeHtml(line);
    return `<div class="suggestion-line suggestion-line--deletion"><span class="suggestion-minus">-</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  // Create addition lines (suggested replacement) with aligned indentation
  const additionLines = newLines.map(line => {
    // If suggestion line doesn't have the common indent, add it
    // This handles cases where GitLab strips leading whitespace from suggestions
    let alignedLine = line;
    if (commonIndent && !line.startsWith(commonIndent) && line.trim().length > 0) {
      alignedLine = commonIndent + line;
    }
    const escapedLine = escapeHtml(alignedLine);
    return `<div class="suggestion-line suggestion-line--addition"><span class="suggestion-plus">+</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  const applyButton = suggestionId
    ? `<button class="suggestion-apply-btn" data-suggestion-id="${escapeHtml(suggestionId)}" type="button">Apply suggestion</button>`
    : '';

  return `
    <div class="suggestion-block-wrapper" ${suggestionId ? `data-suggestion-id="${escapeHtml(suggestionId)}"` : ''}>
      <div class="suggestion-header">
        <span>Suggested change</span>
        ${applyButton}
      </div>
      <div class="suggestion-content">${deletionLines}${additionLines}</div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Hook to process note body HTML
 */
export function useProcessedNoteHtml(
  html: string | undefined,
  originalLines?: string[],
  suggestionId?: string
): string {
  return useMemo(() => {
    if (!html) return '';
    return processNoteHtml(html, originalLines, suggestionId);
  }, [html, originalLines, suggestionId]);
}

/**
 * Component props for NoteBody
 */
interface NoteBodyProps {
  html?: string;
  text?: string;
  className?: string;
  /** Original lines being replaced by the suggestion (for showing deletions) */
  originalLines?: string[];
  /** Suggestion ID for apply functionality */
  suggestionId?: string;
  /** Callback when Apply Suggestion is clicked */
  onApplySuggestion?: (suggestionId: string) => void;
}

/**
 * Component to render note body with processed suggestions
 */
export function NoteBody({ html, text, className = '', originalLines, suggestionId, onApplySuggestion }: NoteBodyProps) {
  const processedHtml = useProcessedNoteHtml(html, originalLines, suggestionId);

  // Handle click events for apply button
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('suggestion-apply-btn') && onApplySuggestion) {
      const id = target.getAttribute('data-suggestion-id');
      if (id) {
        e.preventDefault();
        e.stopPropagation();
        onApplySuggestion(id);
      }
    }
  }, [onApplySuggestion]);

  // If we have processed HTML, use it
  if (processedHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onClick={handleClick}
      />
    );
  }

  // If we have plain text, check for suggestion syntax and process it
  if (text) {
    // Check if plain text contains suggestion markdown
    const suggestionMatch = text.match(/```suggestion[^\n]*\n([\s\S]*?)```/);
    if (suggestionMatch) {
      const beforeSuggestion = text.substring(0, text.indexOf('```suggestion'));
      const afterSuggestion = text.substring(text.indexOf('```', text.indexOf('```suggestion') + 3) + 3);
      const suggestionCode = suggestionMatch[1].trim();

      return (
        <div className={className} onClick={handleClick}>
          {beforeSuggestion && (
            <p className="whitespace-pre-wrap text-gray-300 text-sm mb-2">{beforeSuggestion.trim()}</p>
          )}
          <div
            dangerouslySetInnerHTML={{ __html: createSuggestionBlock(suggestionCode, originalLines, suggestionId) }}
          />
          {afterSuggestion.trim() && (
            <p className="whitespace-pre-wrap text-gray-300 text-sm mt-2">{afterSuggestion.trim()}</p>
          )}
        </div>
      );
    }

    return (
      <p className={`whitespace-pre-wrap text-gray-300 text-sm ${className}`}>
        {text}
      </p>
    );
  }

  return null;
}

/**
 * Create suggestion block HTML (exported for use in NoteBody)
 */
function createSuggestionBlock(code: string, originalLines?: string[], suggestionId?: string): string {
  const newLines = code.split('\n');

  // Get the common indentation from original lines to apply to suggestion lines
  const commonIndent = originalLines && originalLines.length > 0
    ? getCommonIndent(originalLines)
    : '';

  // Create deletion lines (original code being replaced)
  const deletionLinesHtml = (originalLines || []).map(line => {
    const escapedLine = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="suggestion-line suggestion-line--deletion"><span class="suggestion-minus">-</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  // Create addition lines (suggested replacement) with aligned indentation
  const additionLinesHtml = newLines.map(line => {
    // If suggestion line doesn't have the common indent, add it
    let alignedLine = line;
    if (commonIndent && !line.startsWith(commonIndent) && line.trim().length > 0) {
      alignedLine = commonIndent + line;
    }
    const escapedLine = alignedLine
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="suggestion-line suggestion-line--addition"><span class="suggestion-plus">+</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  const applyButton = suggestionId
    ? `<button class="suggestion-apply-btn" data-suggestion-id="${suggestionId.replace(/"/g, '&quot;')}" type="button">Apply suggestion</button>`
    : '';

  return `
    <div class="suggestion-block-wrapper" ${suggestionId ? `data-suggestion-id="${suggestionId.replace(/"/g, '&quot;')}"` : ''}>
      <div class="suggestion-header">
        <span>Suggested change</span>
        ${applyButton}
      </div>
      <div class="suggestion-content">${deletionLinesHtml}${additionLinesHtml}</div>
    </div>
  `;
}
