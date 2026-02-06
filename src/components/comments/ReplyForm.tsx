/**
 * ReplyForm - Form for replying to an existing discussion thread
 */

import { useState, useRef, useCallback } from 'react';
import { Button } from '../common';
import { CommentEditor, type CommentEditorRef } from './CommentEditor';
import { useReplyToDiscussion } from '../../hooks/useGitLab';

interface ReplyFormProps {
  projectId: number;
  mrIid: number;
  discussionId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Form for replying to an existing discussion
 */
export function ReplyForm({
  projectId,
  mrIid,
  discussionId,
  onSuccess,
  onCancel,
}: ReplyFormProps) {
  const [content, setContent] = useState('');
  const editorRef = useRef<CommentEditorRef>(null);
  const replyMutation = useReplyToDiscussion();

  const handleSubmit = useCallback(
    async (markdown: string) => {
      const body = markdown.trim();
      if (!body) return;

      try {
        await replyMutation.mutateAsync({
          project_id: projectId,
          mr_iid: mrIid,
          discussion_id: discussionId,
          body,
        });

        // Clear editor and notify success
        editorRef.current?.clear();
        setContent('');
        onSuccess?.();
      } catch (error) {
        console.error('Failed to reply:', error);
        // Error is handled by the mutation, toast will show
      }
    },
    [replyMutation, projectId, mrIid, discussionId, onSuccess]
  );

  const handleCancel = useCallback(() => {
    editorRef.current?.clear();
    setContent('');
    onCancel?.();
  }, [onCancel]);

  return (
    <div className="space-y-3">
      <CommentEditor
        ref={editorRef}
        placeholder="Write a reply..."
        onChange={setContent}
        onSubmit={handleSubmit}
        onCancel={onCancel ? handleCancel : undefined}
        disabled={replyMutation.isPending}
        autoFocus
        minHeight="80px"
      />

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={replyMutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSubmit(content)}
          disabled={!content.trim() || replyMutation.isPending}
        >
          {replyMutation.isPending ? 'Sending...' : 'Reply'}
        </Button>
      </div>
    </div>
  );
}

export default ReplyForm;
