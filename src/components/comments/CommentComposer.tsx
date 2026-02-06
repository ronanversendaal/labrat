/**
 * CommentComposer - Form for creating new discussion threads (general comments)
 */

import { useState, useRef, useCallback } from 'react';
import { Button } from '../common';
import { CommentEditor, type CommentEditorRef } from './CommentEditor';
import { usePostComment } from '../../hooks/useGitLab';
import type { CommentPosition } from '../../types';

interface CommentComposerProps {
  projectId: number;
  mrIid: number;
  /** Position data for inline comments (omit for general comments) */
  position?: CommentPosition;
  /** Original code from the line being commented on (for suggestions) */
  originalCode?: string;
  /** Whether to show the suggestion button */
  showSuggestionButton?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Form for creating a new discussion thread (comment)
 */
export function CommentComposer({
  projectId,
  mrIid,
  position,
  originalCode,
  showSuggestionButton = false,
  onSuccess,
  onCancel,
  placeholder = 'Write a comment...',
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const editorRef = useRef<CommentEditorRef>(null);
  const postCommentMutation = usePostComment();

  const handleSubmit = useCallback(
    async (markdown: string) => {
      const body = markdown.trim();
      if (!body) return;

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
      } catch (error) {
        console.error('Failed to post comment:', error);
        // Error is handled by the mutation, toast will show
      }
    },
    [postCommentMutation, projectId, mrIid, position, onSuccess]
  );

  const handleCancel = useCallback(() => {
    editorRef.current?.clear();
    setContent('');
    onCancel?.();
  }, [onCancel]);

  return (
    <div>
      {/* Editor section */}
      <div className="p-3">
        <CommentEditor
          ref={editorRef}
          placeholder={placeholder}
          onChange={setContent}
          onSubmit={handleSubmit}
          onCancel={onCancel ? handleCancel : undefined}
          disabled={postCommentMutation.isPending}
          showSuggestionButton={showSuggestionButton}
          originalCode={originalCode}
          autoFocus
          minHeight="80px"
        />
      </div>

      {/* Action buttons footer */}
      <div className="px-3 py-2 bg-surface border-t border-edge-strong flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={postCommentMutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSubmit(content)}
          disabled={!content.trim() || postCommentMutation.isPending}
        >
          {postCommentMutation.isPending ? 'Posting...' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}

export default CommentComposer;
