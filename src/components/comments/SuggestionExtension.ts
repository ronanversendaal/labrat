/**
 * Custom TipTap extension for GitLab code suggestions
 *
 * This extension provides a custom node type for GitLab's ```suggestion code blocks,
 * which are used to propose inline code changes in merge request comments.
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface SuggestionOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      /**
       * Insert a suggestion code block
       */
      insertSuggestion: (code?: string) => ReturnType;
    };
  }
}

/**
 * Custom TipTap node for GitLab suggestion blocks
 *
 * Renders as:
 * ```suggestion
 * <code>
 * ```
 */
export const SuggestionExtension = Node.create<SuggestionOptions>({
  name: 'suggestion',

  group: 'block',

  content: 'text*',

  marks: '',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre[data-type="suggestion"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'suggestion',
        class: 'suggestion-block',
      }),
      ['code', 0],
    ];
  },

  addCommands() {
    return {
      insertSuggestion:
        (suggestionCode = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: suggestionCode ? [{ type: 'text', text: suggestionCode }] : [],
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Escape from suggestion block to a new paragraph
      Escape: () => {
        if (!this.editor.isActive(this.name)) {
          return false;
        }

        return this.editor.commands.insertContentAt(
          this.editor.state.selection.to + 1,
          { type: 'paragraph' }
        );
      },
    };
  },
});

/**
 * Convert TipTap content to GitLab markdown format
 *
 * This function takes TipTap JSON content and converts suggestion nodes
 * to GitLab's markdown format: ```suggestion\n<code>\n```
 */
export function serializeSuggestionToMarkdown(content: string): string {
  // This is a simple text-based serialization for suggestion blocks
  // The TipTap editor already outputs markdown-like content
  return content;
}

/**
 * Parse GitLab markdown to detect suggestion blocks
 */
export function parseSuggestionFromMarkdown(markdown: string): {
  hasSuggestion: boolean;
  suggestionCode: string | null;
  contextText: string;
} {
  const suggestionRegex = /```suggestion\n([\s\S]*?)\n```/;
  const match = markdown.match(suggestionRegex);

  if (match) {
    const suggestionCode = match[1];
    const contextText = markdown.replace(suggestionRegex, '').trim();
    return {
      hasSuggestion: true,
      suggestionCode,
      contextText,
    };
  }

  return {
    hasSuggestion: false,
    suggestionCode: null,
    contextText: markdown,
  };
}
