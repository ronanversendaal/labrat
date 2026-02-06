/**
 * Utility to process and render GitLab note body with proper suggestion styling
 */

import { useMemo } from 'react';

/**
 * Process HTML to transform GitLab suggestion blocks into styled diff format
 */
export function processNoteHtml(html: string): string {
  if (!html) return html;

  let processed = html;

  // Pattern 1: pre tag with lang attribute starting with "suggestion"
  processed = processed.replace(
    /<pre([^>]*?)lang=["']suggestion[^"']*["']([^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, _before, _after, content) => {
      const codeContent = content.replace(/<\/?code[^>]*>/gi, '').trim();
      return createSuggestionHtml(decodeHtmlEntities(codeContent));
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
        return createSuggestionHtml(suggestionMatch[1].trim());
      }
      return _match; // Return original if no suggestion found
    }
  );

  // Pattern 3: code tag (inline) containing suggestion markdown
  processed = processed.replace(
    /<code[^>]*>(```suggestion[^\n]*\n)([\s\S]*?)(```)<\/code>/gi,
    (_match, _header, content, _footer) => {
      return createSuggestionHtml(decodeHtmlEntities(content).trim());
    }
  );

  // Pattern 4: Plain text suggestion blocks (fallback)
  processed = processed.replace(
    /```suggestion[^\n]*\n([\s\S]*?)```/g,
    (_match, content) => {
      return createSuggestionHtml(content.trim());
    }
  );

  // Pattern 5: GitLab's div-based suggestion format
  processed = processed.replace(
    /<div[^>]*class="[^"]*suggestion[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, content) => {
      const codeContent = content.replace(/<[^>]+>/g, '').trim();
      return createSuggestionHtml(decodeHtmlEntities(codeContent));
    }
  );

  // Pattern 6: Content in <p> tags with <code> containing suggestion (GitLab sometimes does this)
  processed = processed.replace(
    /<p[^>]*><code[^>]*>(`{3}suggestion[^`]*)([\s\S]*?)(`{3})<\/code><\/p>/gi,
    (_match, _header, content, _footer) => {
      return createSuggestionHtml(decodeHtmlEntities(content).trim());
    }
  );

  // Pattern 7: Handle when GitLab encodes backticks as HTML entities
  // &#96; = backtick, or when content is spread across multiple <p>/<code> tags
  const backtickPattern = /(?:&#96;|`){3}suggestion[^\n]*\n([\s\S]*?)(?:&#96;|`){3}/gi;
  processed = processed.replace(backtickPattern, (_match, content) => {
    return createSuggestionHtml(decodeHtmlEntities(content).trim());
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
 * Create HTML for a styled suggestion block
 */
function createSuggestionHtml(code: string): string {
  // Split into lines and create diff-style output
  const lines = code.split('\n');
  const styledLines = lines.map(line => {
    const escapedLine = escapeHtml(line);
    return `<div class="suggestion-line"><span class="suggestion-plus">+</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  return `
    <div class="suggestion-block-wrapper">
      <div class="suggestion-header">Suggested change</div>
      <div class="suggestion-content">${styledLines}</div>
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
export function useProcessedNoteHtml(html: string | undefined): string {
  return useMemo(() => {
    if (!html) return '';
    return processNoteHtml(html);
  }, [html]);
}

/**
 * Component props for NoteBody
 */
interface NoteBodyProps {
  html?: string;
  text?: string;
  className?: string;
}

/**
 * Component to render note body with processed suggestions
 */
export function NoteBody({ html, text, className = '' }: NoteBodyProps) {
  const processedHtml = useProcessedNoteHtml(html);

  // If we have processed HTML, use it
  if (processedHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
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
        <div className={className}>
          {beforeSuggestion && (
            <p className="whitespace-pre-wrap text-gray-300 text-sm mb-2">{beforeSuggestion.trim()}</p>
          )}
          <div
            dangerouslySetInnerHTML={{ __html: createSuggestionBlock(suggestionCode) }}
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
function createSuggestionBlock(code: string): string {
  const lines = code.split('\n');
  const styledLines = lines.map(line => {
    const escapedLine = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="suggestion-line"><span class="suggestion-plus">+</span><span class="suggestion-code">${escapedLine || ' '}</span></div>`;
  }).join('');

  return `
    <div class="suggestion-block-wrapper">
      <div class="suggestion-header">Suggested change</div>
      <div class="suggestion-content">${styledLines}</div>
    </div>
  `;
}
