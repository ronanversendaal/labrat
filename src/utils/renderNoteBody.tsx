/**
 * Utility to process and render GitLab note body with proper suggestion styling
 * and AI comment formatting with labels, color swatches, and structured layout
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
 * Severity/type to CSS class mapping for badges
 */
const SEVERITY_CLASSES: Record<string, string> = {
  'error': 'ai-badge--error',
  'warning': 'ai-badge--warning',
  'info': 'ai-badge--info',
  'suggestion': 'ai-badge--info',
  'style': 'ai-badge--style',
  'performance': 'ai-badge--performance',
  'security': 'ai-badge--security',
};

/**
 * Parse AI-structured comment format
 * Format example:
 * **Code Quality** | warning
 * **Hardcoded hex color instead of variable**
 * The value `#dedede` is used directly...
 */
interface ParsedAIComment {
  category?: string;
  severity?: string;
  title?: string;
  content: string;
  isAIFormat: boolean;
}

function parseAICommentStructure(text: string): ParsedAIComment {
  // Try to match the AI comment format: **Category** | severity
  const headerMatch = text.match(/^\s*\*\*([^*]+)\*\*\s*\|\s*(\w+)\s*\n/);

  if (!headerMatch) {
    return { content: text, isAIFormat: false };
  }

  const category = headerMatch[1].trim();
  const severity = headerMatch[2].trim().toLowerCase();
  let remaining = text.substring(headerMatch[0].length);

  // Try to match the title: **Title text**
  const titleMatch = remaining.match(/^\s*\*\*([^*]+)\*\*\s*\n/);
  let title: string | undefined;

  if (titleMatch) {
    title = titleMatch[1].trim();
    remaining = remaining.substring(titleMatch[0].length);
  }

  return {
    category,
    severity,
    title,
    content: remaining.trim(),
    isAIFormat: true,
  };
}

/**
 * Add color swatches to hex color codes in text
 * Converts #dedede or `#dedede` to include a visual color swatch
 */
function addColorSwatches(html: string): string {
  // Match hex colors in various formats
  // Pattern: optional backtick, #, 3 or 6 hex chars, optional backtick
  return html.replace(
    /(`?)#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(`?)/g,
    (_match, openTick, hex, closeTick) => {
      const fullHex = hex.length === 3
        ? hex.split('').map((c: string) => c + c).join('')
        : hex;
      const colorValue = `#${fullHex}`;
      const swatch = `<span class="color-swatch" style="background-color: ${colorValue};" title="${colorValue}"></span>`;
      const code = openTick || closeTick
        ? `<code class="color-code">${colorValue}</code>`
        : `<span class="color-code">${colorValue}</span>`;
      return `${swatch}${code}`;
    }
  );
}

/**
 * Format AI-structured comment into styled HTML
 */
function formatAIComment(parsed: ParsedAIComment): string {
  if (!parsed.isAIFormat) {
    // Just add color swatches to regular content
    return addColorSwatches(parsed.content);
  }

  const severityClass = SEVERITY_CLASSES[parsed.severity || ''] || 'ai-badge--info';

  let html = '<div class="ai-comment">';

  // Header with badges
  html += '<div class="ai-comment__header">';
  if (parsed.category) {
    html += `<span class="ai-badge ai-badge--category">${escapeHtml(parsed.category)}</span>`;
  }
  if (parsed.severity) {
    html += `<span class="ai-badge ${severityClass}">${escapeHtml(parsed.severity)}</span>`;
  }
  html += '</div>';

  // Title
  if (parsed.title) {
    html += `<div class="ai-comment__title">${escapeHtml(parsed.title)}</div>`;
  }

  // Content with color swatches and monospace for code
  if (parsed.content) {
    const processedContent = addColorSwatches(escapeHtml(parsed.content));
    html += `<div class="ai-comment__content">${processedContent}</div>`;
  }

  html += '</div>';

  return html;
}

/**
 * Check if content looks like an AI-structured comment
 * Supports both markdown (**text**) and HTML (<strong>text</strong>) formats
 */
function isAIStructuredComment(text: string): boolean {
  // Check for markdown pattern: **Something** | word
  if (/^\s*\*\*[^*]+\*\*\s*\|\s*\w+/.test(text)) {
    return true;
  }
  // Check for HTML pattern: <strong>Something</strong> | word or <p><strong>...
  if (/^\s*(?:<p[^>]*>)?\s*<strong>([^<]+)<\/strong>\s*\|\s*(\w+)/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Parse AI-structured comment from HTML format
 * Format: <p><strong>Code Quality</strong> | warning</p>
 *         <p><strong>Title here</strong></p>
 *         <p>Content...</p>
 */
function parseAICommentFromHtml(html: string): ParsedAIComment {
  // Match header: <strong>Category</strong> | severity
  const headerMatch = html.match(/^\s*(?:<p[^>]*>)?\s*<strong>([^<]+)<\/strong>\s*\|\s*(\w+)\s*(?:<\/p>)?/i);

  if (!headerMatch) {
    return { content: html, isAIFormat: false };
  }

  const category = headerMatch[1].trim();
  const severity = headerMatch[2].trim().toLowerCase();
  let remaining = html.substring(headerMatch[0].length).trim();

  // Try to match the title: <p><strong>Title</strong></p> or <strong>Title</strong>
  const titleMatch = remaining.match(/^\s*(?:<p[^>]*>)?\s*<strong>([^<]+)<\/strong>\s*(?:<\/p>)?/i);
  let title: string | undefined;

  if (titleMatch) {
    title = titleMatch[1].trim();
    remaining = remaining.substring(titleMatch[0].length).trim();
  }

  // Clean up remaining content - strip outer <p> tags but keep inner formatting
  remaining = remaining
    .replace(/^<p[^>]*>/gi, '')
    .replace(/<\/p>\s*$/gi, '')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .trim();

  return {
    category,
    severity,
    title,
    content: remaining,
    isAIFormat: true,
  };
}

/**
 * Format AI comment from HTML source (preserves some HTML formatting in content)
 */
function formatAICommentFromHtml(parsed: ParsedAIComment): string {
  if (!parsed.isAIFormat) {
    return parsed.content;
  }

  const severityClass = SEVERITY_CLASSES[parsed.severity || ''] || 'ai-badge--info';

  let html = '<div class="ai-comment">';

  // Header with badges
  html += '<div class="ai-comment__header">';
  if (parsed.category) {
    html += `<span class="ai-badge ai-badge--category">${escapeHtml(parsed.category)}</span>`;
  }
  if (parsed.severity) {
    html += `<span class="ai-badge ${severityClass}">${escapeHtml(parsed.severity)}</span>`;
  }
  html += '</div>';

  // Title
  if (parsed.title) {
    html += `<div class="ai-comment__title">${escapeHtml(parsed.title)}</div>`;
  }

  // Content - already HTML, just add color swatches
  if (parsed.content) {
    const processedContent = addColorSwatchesToHtml(parsed.content);
    html += `<div class="ai-comment__content">${processedContent}</div>`;
  }

  html += '</div>';

  return html;
}

/**
 * Add color swatches to hex colors in HTML content
 * More careful version that avoids breaking HTML attributes
 */
function addColorSwatchesToHtml(html: string): string {
  // Split by HTML tags to only process text content
  const parts = html.split(/(<[^>]+>)/);
  return parts.map(part => {
    // If it's an HTML tag, don't modify it
    if (part.startsWith('<')) {
      return part;
    }
    // Process text content for hex colors
    return part.replace(
      /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![0-9A-Fa-f])/g,
      (_match, hex) => {
        const fullHex = hex.length === 3
          ? hex.split('').map((c: string) => c + c).join('')
          : hex;
        const colorValue = `#${fullHex}`;
        return `<span class="color-swatch" style="background-color: ${colorValue};" title="${colorValue}"></span><span class="color-code">${colorValue}</span>`;
      }
    );
  }).join('');
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
    // Check if this looks like an AI-structured comment in the source text (markdown format)
    const sourceText = text || '';
    if (isAIStructuredComment(sourceText)) {
      const parsed = parseAICommentStructure(sourceText);
      const aiHtml = formatAIComment(parsed);
      return (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: aiHtml }}
          onClick={handleClick}
        />
      );
    }

    // Check if the HTML itself contains AI-structured comment (HTML format from GitLab)
    if (html && isAIStructuredComment(html)) {
      const parsed = parseAICommentFromHtml(html);
      const aiHtml = formatAICommentFromHtml(parsed);
      return (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: aiHtml }}
          onClick={handleClick}
        />
      );
    }

    // Don't modify suggestion blocks - return as-is
    // Color swatches can break HTML structure in suggestion content
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
    // Check if this is an AI-structured comment
    if (isAIStructuredComment(text)) {
      const parsed = parseAICommentStructure(text);
      const aiHtml = formatAIComment(parsed);
      return (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: aiHtml }}
          onClick={handleClick}
        />
      );
    }

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

    // Regular text - add color swatches
    const textWithSwatches = addColorSwatches(escapeHtml(text));
    return (
      <div
        className={`whitespace-pre-wrap text-sm ${className}`}
        dangerouslySetInnerHTML={{ __html: textWithSwatches }}
      />
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
