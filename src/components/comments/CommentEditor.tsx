/**
 * TipTap-based rich text editor for MR comments
 *
 * Provides a markdown-like editing experience with toolbar controls
 * for formatting and code suggestions.
 */

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import clsx from 'clsx';
import { SuggestionExtension } from './SuggestionExtension';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

export interface CommentEditorProps {
  /** Initial content (markdown) */
  initialContent?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Called when content changes */
  onChange?: (content: string) => void;
  /** Called when submitting (Cmd/Ctrl+Enter) */
  onSubmit?: (content: string) => void;
  /** Called when canceling (Escape) */
  onCancel?: () => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether to show the suggestion button */
  showSuggestionButton?: boolean;
  /** Original code for suggestion (line content from diff) */
  originalCode?: string;
  /** Whether to auto-focus the editor */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Minimum height */
  minHeight?: string;
}

export interface CommentEditorRef {
  /** Get the current markdown content */
  getMarkdown: () => string;
  /** Clear the editor content */
  clear: () => void;
  /** Focus the editor */
  focus: () => void;
  /** Insert a suggestion block */
  insertSuggestion: (suggestionCode?: string) => void;
}

/**
 * Toolbar button component
 */
function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'px-2 py-1.5 rounded text-sm font-medium transition-colors',
        active
          ? 'bg-editor-toolbar text-primary-text'
          : 'text-content-tertiary hover:bg-editor-toolbar hover:text-content-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Editor toolbar with formatting controls
 */
function EditorToolbar({
  editor,
  showSuggestionButton,
  onInsertSuggestion,
  disabled,
}: {
  editor: Editor | null;
  showSuggestionButton?: boolean;
  onInsertSuggestion: () => void;
  disabled?: boolean;
}) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 p-2 border-b border-editor-border bg-editor-toolbar">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        disabled={disabled}
        title="Bold (Cmd+B)"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={disabled}
        title="Italic (Cmd+I)"
      >
        <em>I</em>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={disabled}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>

      <div className="w-px h-4 bg-editor-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        disabled={disabled}
        title="Inline Code"
      >
        <code className="text-xs">{`<>`}</code>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        disabled={disabled}
        title="Code Block"
      >
        <span className="text-xs font-mono">{'{ }'}</span>
      </ToolbarButton>

      <div className="w-px h-4 bg-editor-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        disabled={disabled}
        title="Bullet List"
      >
        <span className="text-xs">•</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        disabled={disabled}
        title="Numbered List"
      >
        <span className="text-xs">1.</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        disabled={disabled}
        title="Quote"
      >
        <span className="text-xs">"</span>
      </ToolbarButton>

      {showSuggestionButton && (
        <>
          <div className="w-px h-4 bg-editor-border mx-1" />

          <ToolbarButton
            onClick={onInsertSuggestion}
            active={editor.isActive('suggestion')}
            disabled={disabled}
            title="Insert Code Suggestion"
          >
            <span className="text-xs text-positive-text font-semibold">
              +/-
            </span>
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

/**
 * Convert TipTap HTML/JSON to markdown
 * Simple conversion for common elements
 */
function htmlToMarkdown(html: string): string {
  let markdown = html;

  // Convert common HTML to markdown
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<b>(.*?)<\/b>/g, '**$1**');
  markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<i>(.*?)<\/i>/g, '*$1*');
  markdown = markdown.replace(/<s>(.*?)<\/s>/g, '~~$1~~');
  markdown = markdown.replace(/<strike>(.*?)<\/strike>/g, '~~$1~~');
  markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
  markdown = markdown.replace(/<br\s*\/?>/g, '\n');
  markdown = markdown.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
  markdown = markdown.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');

  // Convert code blocks
  markdown = markdown.replace(
    /<pre[^>]*><code[^>]*(?:class="language-(\w+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/g,
    (_, lang, code) => {
      const language = lang || '';
      return `\`\`\`${language}\n${code}\n\`\`\`\n`;
    }
  );

  // Convert suggestion blocks
  markdown = markdown.replace(
    /<pre[^>]*data-type="suggestion"[^>]*><code>([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => `\`\`\`suggestion\n${code}\n\`\`\`\n`
  );

  // Convert lists
  markdown = markdown.replace(/<ul>([\s\S]*?)<\/ul>/g, (_, content) => {
    return content.replace(/<li>(.*?)<\/li>/g, '- $1\n');
  });
  markdown = markdown.replace(/<ol>([\s\S]*?)<\/ol>/g, (_, content) => {
    let counter = 0;
    return content.replace(/<li>(.*?)<\/li>/g, () => {
      counter++;
      return `${counter}. $1\n`;
    });
  });

  // Clean up remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  markdown = markdown.replace(/&nbsp;/g, ' ');

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();

  return markdown;
}

/**
 * Rich text editor for MR comments with TipTap
 */
export const CommentEditor = forwardRef<CommentEditorRef, CommentEditorProps>(
  function CommentEditor(
    {
      initialContent = '',
      placeholder = 'Write a comment...',
      onChange,
      onSubmit,
      onCancel,
      disabled = false,
      showSuggestionButton = false,
      originalCode,
      autoFocus = false,
      className,
      minHeight = '100px',
    },
    ref
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false, // We use CodeBlockLowlight instead
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary-text underline',
          },
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass:
            'before:content-[attr(data-placeholder)] before:text-content-tertiary before:float-left before:h-0 before:pointer-events-none',
        }),
        CodeBlockLowlight.configure({
          lowlight,
          HTMLAttributes: {
            class: 'bg-surface rounded p-3 font-mono text-sm',
          },
        }),
        SuggestionExtension,
      ],
      content: initialContent,
      editable: !disabled,
      autofocus: autoFocus,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const markdown = htmlToMarkdown(html);
        onChange?.(markdown);
      },
      editorProps: {
        attributes: {
          class: clsx(
            'prose prose-sm max-w-none',
            'focus:outline-none',
            'p-3'
          ),
          style: `min-height: ${minHeight}`,
        },
        handleKeyDown: (_, event) => {
          // Submit on Cmd/Ctrl+Enter
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            if (editor) {
              const html = editor.getHTML();
              const markdown = htmlToMarkdown(html);
              onSubmit?.(markdown);
            }
            return true;
          }

          // Cancel on Escape (only if at the start of empty editor)
          if (event.key === 'Escape') {
            if (editor?.isEmpty) {
              event.preventDefault();
              onCancel?.();
              return true;
            }
          }

          return false;
        },
      },
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor) return '';
        return htmlToMarkdown(editor.getHTML());
      },
      clear: () => {
        editor?.commands.clearContent();
      },
      focus: () => {
        editor?.commands.focus();
      },
      insertSuggestion: (code?: string) => {
        editor?.commands.insertSuggestion(code || originalCode || '');
      },
    }));

    // Handle disabled state changes
    useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled);
      }
    }, [editor, disabled]);

    const handleInsertSuggestion = useCallback(() => {
      if (!editor) return;

      // Insert suggestion block with original code if available
      const code = originalCode || '';
      editor.chain().focus().insertSuggestion(code).run();
    }, [editor, originalCode]);

    return (
      <div
        className={clsx(
          'border border-editor-border rounded overflow-hidden',
          'focus-within:ring-1 focus-within:ring-ring focus-within:border-ring',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        <EditorToolbar
          editor={editor}
          showSuggestionButton={showSuggestionButton}
          onInsertSuggestion={handleInsertSuggestion}
          disabled={disabled}
        />

        <EditorContent
          editor={editor}
          className={clsx(
            'bg-editor-bg',
            disabled && 'pointer-events-none'
          )}
        />

        <div className="flex items-center justify-between px-3 py-2 bg-editor-toolbar border-t border-editor-border">
          <span className="text-xs text-content-tertiary">
            Markdown supported.{' '}
            <kbd className="px-1.5 py-0.5 bg-editor-toolbar rounded text-xs text-content-muted">
              {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
            </kbd>{' '}
            to submit
          </span>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-content-tertiary hover:text-content-muted transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }
);

export default CommentEditor;
