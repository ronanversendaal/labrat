/**
 * InlineCommentThread - GitLab-style thread component for Monaco view zones
 * Displays comment threads inline in the diff view, matching GitLab's web UI
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { Discussion, Note, Author } from '../../types';
import { Avatar, Button, useToast } from '../common';
import { ReplyForm } from './ReplyForm';
import { CommentEditor, type CommentEditorRef } from './CommentEditor';
import { useResolveDiscussion, usePostComment } from '../../hooks/useGitLab';
import type { CommentPosition } from '../../types';
import { NoteBody } from '../../utils/renderNoteBody';

interface InlineCommentThreadProps {
  /** The discussion to display */
  discussion: Discussion;
  /** Project ID for API calls */
  projectId: number;
  /** MR IID for API calls */
  mrIid: number;
  /** The MR author - used to show "Owner" badge */
  mrAuthor?: Author;
  /** Position data for new comments on the same line */
  position?: CommentPosition;
  /** Called when thread height changes (for view zone resizing) */
  onHeightChange?: (height: number) => void;
  /** Called after a successful comment/reply/resolve */
  onSuccess?: () => void;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Maximum height of the thread container */
  maxHeight?: number;
  /** Called when user wants to collapse a resolved thread */
  onCollapse?: () => void;
}

/**
 * GitLab-style inline comment thread for display in Monaco view zones
 */
export function InlineCommentThread({
  discussion,
  projectId,
  mrIid,
  mrAuthor,
  position,
  onHeightChange,
  onSuccess,
  compact = false,
  maxHeight = 350,
  onCollapse,
}: InlineCommentThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [isStartingNewThread, setIsStartingNewThread] = useState(false);
  const [newThreadContent, setNewThreadContent] = useState('');
  const newThreadEditorRef = useRef<CommentEditorRef>(null);

  const resolveMutation = useResolveDiscussion();
  const postCommentMutation = usePostComment();
  const toast = useToast();

  const firstNote = discussion.notes[0];
  const isResolvable = discussion.notes.some((n) => n.resolvable);
  const isResolved = discussion.notes.every((n) => !n.resolvable || n.resolved);
  const replyCount = discussion.notes.length - 1;

  // Notify parent when height changes
  useEffect(() => {
    if (!onHeightChange || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [onHeightChange]);

  const handleToggleResolve = useCallback(async () => {
    try {
      await resolveMutation.mutateAsync({
        project_id: projectId,
        mr_iid: mrIid,
        discussion_id: discussion.id,
        resolved: !isResolved,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Failed to toggle resolve:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to ${isResolved ? 'unresolve' : 'resolve'} thread: ${message}`);
    }
  }, [resolveMutation, projectId, mrIid, discussion.id, isResolved, onSuccess, toast]);

  const handleReplySuccess = useCallback(() => {
    setIsReplying(false);
    onSuccess?.();
  }, [onSuccess]);

  const handleStartNewThread = useCallback(async (markdown: string) => {
    if (!markdown.trim()) return;

    // Validate position data for inline comments
    if (!position?.base_sha || !position?.head_sha) {
      toast.error('Cannot start thread: missing diff position data. Please refresh and try again.');
      console.error('Missing position data for new thread:', position);
      return;
    }

    try {
      await postCommentMutation.mutateAsync({
        project_id: projectId,
        mr_iid: mrIid,
        body: markdown,
        position,
      });
      newThreadEditorRef.current?.clear();
      setNewThreadContent('');
      setIsStartingNewThread(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to start new thread:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to start thread: ${message}`);
    }
  }, [postCommentMutation, projectId, mrIid, position, onSuccess, toast]);

  const handleCancelNewThread = useCallback(() => {
    newThreadEditorRef.current?.clear();
    setNewThreadContent('');
    setIsStartingNewThread(false);
  }, []);

  if (!firstNote) return null;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'inline-comment-thread flex flex-col',
        isResolved && 'inline-comment-thread--resolved',
        compact && 'inline-comment-thread--compact'
      )}
      style={{ maxHeight: `${maxHeight}px` }}
    >
      {/* Thread notes - scrollable area */}
      <div className="inline-comment-thread__notes flex-1 overflow-y-auto min-h-0">
        {/* First note (main comment) */}
        <InlineNoteDisplay
          note={firstNote}
          isFirst
          isOwner={mrAuthor && firstNote.author.id === mrAuthor.id}
          isResolvable={isResolvable}
          isResolved={isResolved}
          onToggleResolve={handleToggleResolve}
          isResolving={resolveMutation.isPending}
          compact={compact}
        />

        {/* Reply count / expand toggle */}
        {replyCount > 0 && (
          <div className="inline-comment-thread__replies">
            {discussion.notes.slice(1).map((note) => (
              <InlineNoteDisplay
                key={note.id}
                note={note}
                isFirst={false}
                isOwner={mrAuthor && note.author.id === mrAuthor.id}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply form */}
      {isReplying ? (
        <div className="inline-comment-thread__reply-form">
          <ReplyForm
            projectId={projectId}
            mrIid={mrIid}
            discussionId={discussion.id}
            onSuccess={handleReplySuccess}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      ) : (
        <div className="inline-comment-thread__reply-trigger">
          <button
            onClick={() => setIsReplying(true)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
          >
            <span className="text-gray-500">Reply...</span>
          </button>
        </div>
      )}

      {/* New thread form */}
      {isStartingNewThread && position && (
        <div className="inline-comment-thread__new-thread-form">
          <div className="border-t border-[#3d3d5c] mt-3 pt-3">
            <CommentEditor
              ref={newThreadEditorRef}
              placeholder="Start a new thread..."
              onChange={setNewThreadContent}
              onSubmit={handleStartNewThread}
              onCancel={handleCancelNewThread}
              disabled={postCommentMutation.isPending}
              autoFocus
              minHeight="80px"
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelNewThread}
                disabled={postCommentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStartNewThread(newThreadContent)}
                disabled={!newThreadContent.trim() || postCommentMutation.isPending}
              >
                {postCommentMutation.isPending ? 'Commenting...' : 'Comment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with actions - always visible */}
      <div className="inline-comment-thread__footer flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left side - Start another thread */}
          {position && !isStartingNewThread && (
            <button
              onClick={() => setIsStartingNewThread(true)}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Start another thread
            </button>
          )}
          {!position && <div />}

          {/* Right side - Resolve thread */}
          {isResolvable && (
            <Button
              size="sm"
              variant={isResolved ? 'secondary' : 'primary'}
              onClick={handleToggleResolve}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending
                ? '...'
                : isResolved
                  ? 'Unresolve thread'
                  : 'Resolve thread'}
            </Button>
          )}
        </div>
      </div>

      {/* Collapse button for resolved threads */}
      {isResolved && onCollapse && (
        <button
          onClick={onCollapse}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-700/50"
          title="Collapse resolved thread"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface InlineNoteDisplayProps {
  note: Note;
  isFirst: boolean;
  isOwner?: boolean;
  isResolvable?: boolean;
  isResolved?: boolean;
  onToggleResolve?: () => void;
  isResolving?: boolean;
  compact?: boolean;
}

function InlineNoteDisplay({
  note,
  isFirst,
  isOwner,
  compact,
}: InlineNoteDisplayProps) {
  return (
    <div
      className={clsx(
        'inline-note',
        !isFirst && 'inline-note--reply',
        compact && 'inline-note--compact'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={note.author.avatar_url} name={note.author.name} size={compact ? 'xs' : 'sm'} />

        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-medium text-sm text-gray-100">
              {note.author.name}
            </span>
            <span className="text-xs text-gray-500">
              @{note.author.username}
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(note.created_at)}
            </span>
            {isOwner && (
              <span className="inline-note__owner-badge">
                Owner
              </span>
            )}
          </div>

          {/* Note body */}
          <div className="prose prose-sm prose-invert max-w-none">
            <NoteBody html={note.body_html} text={note.body} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Format a date string to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString();
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

export default InlineCommentThread;
