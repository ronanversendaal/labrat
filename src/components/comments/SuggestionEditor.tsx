/**
 * SuggestionEditor - Monaco-based editor for creating code suggestions
 * Renders in a view zone with full syntax highlighting and editing support
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Button, useToast } from '../common';
import { usePostComment } from '../../hooks/useGitLab';
import { isMac } from '../../services/keyboard';
import type { CommentPosition } from '../../types';
import type * as Monaco from 'monaco-editor';
import { useResolvedTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { registerMonacoThemes, getMonacoThemeName } from '../../styles/themes/monaco';

interface SuggestionEditorProps {
  /** Original code content for the line(s) */
  originalCode: string;
  /** Line number being suggested on */
  lineNumber: number;
  /** Language for syntax highlighting */
  language: string;
  /** Project ID for API */
  projectId: number;
  /** MR IID for API */
  mrIid: number;
  /** Position data for the comment */
  position: CommentPosition;
  /** Called on submit success */
  onSubmit?: () => void;
  /** Called on cancel */
  onCancel?: () => void;
  /** Called when discussions change */
  onDiscussionsChange?: () => void;
}

export function SuggestionEditor({
  originalCode,
  lineNumber,
  language,
  projectId,
  mrIid,
  position,
  onSubmit,
  onCancel,
  onDiscussionsChange,
}: SuggestionEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monaco = useMonaco();
  const codeFontSize = useSettingsStore((s) => s.fontSize);
  const resolvedTheme = useResolvedTheme();
  const monacoThemeName = getMonacoThemeName(resolvedTheme);
  const postCommentMutation = usePostComment();
  const toast = useToast();
  const [editedCode, setEditedCode] = useState(originalCode);

  // Register themes when Monaco is available
  useEffect(() => {
    if (monaco) {
      registerMonacoThemes(monaco);
    }
  }, [monaco]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const code = editedCode;
    // Build GitLab suggestion markdown
    const body = `\`\`\`suggestion:-0+0\n${code}\n\`\`\``;

    try {
      await postCommentMutation.mutateAsync({
        project_id: projectId,
        mr_iid: mrIid,
        body,
        position,
      });

      toast.success('Suggestion posted');
      onDiscussionsChange?.();
      onSubmit?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to post suggestion: ${message}`);
    }
  }, [editedCode, projectId, mrIid, position, postCommentMutation, toast, onDiscussionsChange, onSubmit]);

  // Handle Cmd/Ctrl+Enter to submit
  const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Add Cmd/Ctrl+Enter keybinding
    editor.addAction({
      id: 'submit-suggestion',
      label: 'Submit Suggestion',
      keybindings: [
        monaco?.KeyMod.CtrlCmd! | monaco?.KeyCode.Enter!,
      ],
      run: () => {
        handleSubmit();
      },
    });

    // Add Escape keybinding
    editor.addAction({
      id: 'cancel-suggestion',
      label: 'Cancel',
      keybindings: [monaco?.KeyCode.Escape!],
      run: () => {
        onCancel?.();
      },
    });

    // Focus the editor
    editor.focus();
    // Move cursor to end
    const model = editor.getModel();
    if (model) {
      const lastLine = model.getLineCount();
      const lastCol = model.getLineMaxColumn(lastLine);
      editor.setPosition({ lineNumber: lastLine, column: lastCol });
    }
  }, [monaco, handleSubmit, onCancel]);

  const lineCount = originalCode.split('\n').length;
  const editorHeight = Math.max(60, Math.min(200, lineCount * 20 + 20));

  return (
    <div className="bg-editor-bg border border-editor-border rounded shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-editor-toolbar border-b border-editor-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-positive-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-positive-text font-medium">Suggest a change</span>
          <span className="text-content-secondary">line {lineNumber}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-content-tertiary">
          <kbd className="px-1.5 py-0.5 bg-surface-alt rounded text-content-secondary">
            {isMac() ? '\u2318' : 'Ctrl'}+\u21b5
          </kbd>
          <span>submit</span>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ height: editorHeight }}>
        <Editor
          value={editedCode}
          language={language}
          theme={monacoThemeName}
          onChange={(value) => setEditedCode(value || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            fontSize: codeFontSize,
            fontFamily: "var(--th-font-code)",
            renderWhitespace: 'none',
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'auto',
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-editor-toolbar border-t border-editor-border flex items-center justify-end gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={postCommentMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={postCommentMutation.isPending}
        >
          {postCommentMutation.isPending ? 'Posting...' : 'Suggest'}
        </Button>
      </div>
    </div>
  );
}
