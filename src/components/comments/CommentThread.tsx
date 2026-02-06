/**
 * CommentThread - Display a single discussion thread with all its notes
 * GitLab-style UI with Owner badge, action icons, and improved footer layout
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { Discussion, Note, Author } from '../../types';
import { Avatar, Button } from '../common';
import { ReplyForm } from './ReplyForm';
import { useResolveDiscussion } from '../../hooks/useGitLab';
import { NoteBody } from '../../utils/renderNoteBody';

interface CommentThreadProps {
  discussion: Discussion;
  projectId: number;
  mrIid: number;
  /** MR Author - used to display "Owner" badge */
  mrAuthor?: Author;
  onReplySuccess?: () => void;
  /** Called when thread height changes (for view zone resizing) */
  onHeightChange?: (height: number) => void;
  /** Compact mode for inline display */
  compact?: boolean;
}

/**
 * A single comment thread displaying all notes in a discussion
 */
export function CommentThread({
  discussion,
  projectId,
  mrIid,
  mrAuthor,
  onReplySuccess,
  onHeightChange,
  compact = false,
}: CommentThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const resolveMutation = useResolveDiscussion();

  const firstNote = discussion.notes[0];
  const isResolvable = discussion.notes.some((n) => n.resolvable);
  const isResolved = discussion.notes.every((n) => !n.resolvable || n.resolved);
  const replyCount = discussion.notes.length - 1;

  // Get position info if this is an inline comment
  const position = firstNote?.position;
  const isInlineComment = !!position?.new_path;

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
      onReplySuccess?.();
    } catch (error) {
      console.error('Failed to toggle resolve:', error);
    }
  }, [resolveMutation, projectId, mrIid, discussion.id, isResolved, onReplySuccess]);

  const handleReplySuccess = useCallback(() => {
    setIsReplying(false);
    onReplySuccess?.();
  }, [onReplySuccess]);

  if (!firstNote) return null;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'border rounded-lg overflow-hidden',
        isResolved
          ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700',
        compact && 'text-sm'
      )}
    >
      {/* Position indicator for inline comments */}
      {isInlineComment && position && !compact && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500">{position.new_path}</span>
          {position.new_line && (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              line {position.new_line}
            </span>
          )}
        </div>
      )}

      {/* Thread header / first note */}
      <NoteDisplay
        note={firstNote}
        isFirst
        isOwner={mrAuthor && firstNote.author.id === mrAuthor.id}
        compact={compact}
      />

      {/* Collapsed state */}
      {isCollapsed && replyCount > 0 && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
        >
          Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {/* Replies */}
      {!isCollapsed && replyCount > 0 && (
        <>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-full px-4 py-1 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-left border-t border-gray-200 dark:border-gray-700"
          >
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
          {discussion.notes.slice(1).map((note) => (
            <NoteDisplay
              key={note.id}
              note={note}
              isFirst={false}
              isOwner={mrAuthor && note.author.id === mrAuthor.id}
              compact={compact}
            />
          ))}
        </>
      )}

      {/* Reply form */}
      {isReplying ? (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <ReplyForm
            projectId={projectId}
            mrIid={mrIid}
            discussionId={discussion.id}
            onSuccess={handleReplySuccess}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      ) : (
        /* GitLab-style footer with Reply on left, Resolve on right */
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={() => setIsReplying(true)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Reply...
          </button>

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
      )}
    </div>
  );
}

interface NoteDisplayProps {
  note: Note;
  isFirst: boolean;
  /** Whether the note author is the MR owner */
  isOwner?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

function NoteDisplay({
  note,
  isFirst,
  isOwner,
  compact,
}: NoteDisplayProps) {
  return (
    <div
      className={clsx(
        compact ? 'p-3' : 'p-4',
        !isFirst && 'border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={note.author.avatar_url}
          name={note.author.name}
          size={compact ? 'xs' : 'sm'}
        />

        <div className="flex-1 min-w-0">
          {/* Author line with Owner badge */}
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <span className={clsx(
              'font-medium text-gray-900 dark:text-gray-100',
              compact ? 'text-xs' : 'text-sm'
            )}>
              {note.author.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              @{note.author.username}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatRelativeTime(note.created_at)}
            </span>
            {isOwner && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 rounded">
                Owner
              </span>
            )}
          </div>

          {/* Note body */}
          <div className={clsx(
            'prose dark:prose-invert max-w-none',
            compact ? 'prose-xs' : 'prose-sm'
          )}>
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

export default CommentThread;
