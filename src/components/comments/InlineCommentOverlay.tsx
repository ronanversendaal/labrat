/**
 * InlineCommentOverlay - GitLab-style inline comment form below diff lines
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Discussion, CommentPosition } from '../../types';
import { CommentThread } from './CommentThread';
import { CommentEditor, type CommentEditorRef } from './CommentEditor';
import { Button, useToast } from '../common';
import { usePostComment } from '../../hooks/useGitLab';

interface InlineCommentOverlayProps {
  /** Project ID for API calls */
  projectId: number;
  /** MR IID for API calls */
  mrIid: number;
  /** The file path this overlay is for */
  filePath: string;
  /** The line number this overlay is for */
  lineNumber: number;
  /** Position data for new comments */
  position: CommentPosition;
  /** Original line content for suggestions */
  originalCode?: string;
  /** Existing discussions on this line */
  discussions?: Discussion[];
  /** Whether this is a new comment (show composer) or existing thread */
  isNew?: boolean;
  /** Called when the overlay should close */
  onClose?: () => void;
  /** Called after a successful comment/reply */
  onSuccess?: () => void;
  /** When true, disables click-outside-to-close (e.g. when rendered inside a view zone) */
  disableClickOutside?: boolean;
}

/**
 * Renders a GitLab-style comment form inline below a diff line
 */
export function InlineCommentOverlay({
  projectId,
  mrIid,
  filePath,
  lineNumber,
  position,
  originalCode,
  discussions = [],
  isNew = false,
  onClose,
  onSuccess,
  disableClickOutside = false,
}: InlineCommentOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CommentEditorRef>(null);
  const [content, setContent] = useState('');
  const postCommentMutation = usePostComment();
  const toast = useToast();

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle click outside to close (for new comments only, not in view zones)
  useEffect(() => {
    if (!isNew || disableClickOutside) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as globalThis.Node)) {
        onClose?.();
      }
    };

    // Delay to prevent immediate close from trigger click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNew, onClose, disableClickOutside]);

  const handleSubmit = useCallback(
    async (markdown: string) => {
      const body = markdown.trim();
      if (!body) return;

      // Validate position data for inline comments
      if (!position?.base_sha || !position?.head_sha) {
        toast.error('Cannot post inline comment: missing diff position data. Please refresh and try again.');
        console.error('Missing position data for inline comment:', position);
        return;
      }

      try {
        await postCommentMutation.mutateAsync({
          project_id: projectId,
          mr_iid: mrIid,
          body,
          position,
        });

        // Clear editor and notify success
        editorRef.current?.clear();
        setContent('');
        onSuccess?.();
        onClose?.();
      } catch (error) {
        console.error('Failed to post comment:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to post comment: ${message}`);
      }
    },
    [postCommentMutation, projectId, mrIid, position, onSuccess, onClose, toast]
  );

  const handleCancel = useCallback(() => {
    editorRef.current?.clear();
    setContent('');
    onClose?.();
  }, [onClose]);

  const hasExistingDiscussions = discussions.length > 0;

  return (
    <div
      ref={overlayRef}
      className="bg-editor-bg border border-editor-border rounded shadow-2xl overflow-hidden"
    >
      {/* Header - GitLab style "Commenting on lines" */}
      <div className="px-4 py-2.5 bg-editor-toolbar border-b border-editor-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-content-muted">
          <span className="font-mono text-content-tertiary text-xs">{filePath}</span>
          <span className="text-content-secondary">line {lineNumber}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content-muted p-1 transition-colors rounded hover:bg-surface-hover"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Existing discussions */}
      {hasExistingDiscussions && (
        <div className="border-b border-editor-border max-h-[200px] overflow-auto">
          {discussions.map((discussion) => (
            <CommentThread
              key={discussion.id}
              discussion={discussion}
              projectId={projectId}
              mrIid={mrIid}
              onReplySuccess={onSuccess}
            />
          ))}
        </div>
      )}

      {/* New comment form - GitLab style */}
      {isNew && (
        <div>
          {/* Editor */}
          <div className="p-3">
            <CommentEditor
              ref={editorRef}
              placeholder="Start a new discussion on this line..."
              onChange={setContent}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              disabled={postCommentMutation.isPending}
              showSuggestionButton={!!originalCode}
              originalCode={originalCode}
              autoFocus
              minHeight="100px"
            />
          </div>

          {/* Action buttons - GitLab style footer */}
          <div className="px-4 py-3 bg-editor-toolbar border-t border-editor-border flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={postCommentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit(content)}
              disabled={!content.trim() || postCommentMutation.isPending}
            >
              {postCommentMutation.isPending ? 'Commenting...' : 'Comment'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InlineCommentOverlay;
