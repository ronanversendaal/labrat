/**
 * ActivityEvent - Renders a single timeline event (system note or discussion thread)
 */

import type { Discussion, Author } from '../../types';
import { CommentThread } from '../comments';
import { Avatar } from '../common';
import { formatRelativeTime } from '../../utils/dateFormat';

interface ActivityEventProps {
  discussion: Discussion;
  projectId: number;
  mrIid: number;
  mrAuthor?: Author;
}

type EventKind =
  | 'approved'
  | 'unapproved'
  | 'label'
  | 'milestone'
  | 'merge'
  | 'close'
  | 'reopen'
  | 'assign'
  | 'unassign'
  | 'title'
  | 'description'
  | 'branch'
  | 'draft'
  | 'pipeline'
  | 'commit'
  | 'resolve'
  | 'reviewer'
  | 'unknown';

function detectEventKind(body: string): EventKind {
  const lower = body.toLowerCase();
  if (lower.startsWith('approved this merge request')) return 'approved';
  if (lower.startsWith('unapproved this merge request')) return 'unapproved';
  if (lower.includes('added') && lower.includes('label')) return 'label';
  if (lower.includes('removed') && lower.includes('label')) return 'label';
  if (lower.includes('changed milestone')) return 'milestone';
  if (lower.includes('removed milestone')) return 'milestone';
  if (lower.startsWith('merged')) return 'merge';
  if (lower.startsWith('closed')) return 'close';
  if (lower.startsWith('reopened')) return 'reopen';
  if (lower.includes('assigned to')) return 'assign';
  if (lower.includes('unassigned')) return 'unassign';
  if (lower.includes('changed title')) return 'title';
  if (lower.includes('changed the description')) return 'description';
  if (lower.includes('target branch')) return 'branch';
  if (lower.includes('marked this merge request as **draft**')) return 'draft';
  if (lower.includes('marked this merge request as **ready**')) return 'draft';
  if (lower.includes('resolved all threads')) return 'resolve';
  if (lower.includes('requested review')) return 'reviewer';
  if (lower.includes('added') && lower.includes('commit')) return 'commit';
  return 'unknown';
}

function EventIcon({ kind }: { kind: EventKind }) {
  const base = 'w-4 h-4 shrink-0';

  switch (kind) {
    case 'approved':
      return (
        <svg className={`${base} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'unapproved':
      return (
        <svg className={`${base} text-orange-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'label':
      return (
        <svg className={`${base} text-orange-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case 'milestone':
      return (
        <svg className={`${base} text-purple-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      );
    case 'merge':
      return (
        <svg className={`${base} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5m0 2H6m10 10v2m0-2h2" />
        </svg>
      );
    case 'close':
      return (
        <svg className={`${base} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
    case 'reopen':
      return (
        <svg className={`${base} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'assign':
    case 'unassign':
    case 'reviewer':
      return (
        <svg className={`${base} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'title':
    case 'description':
      return (
        <svg className={`${base} text-content-secondary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'branch':
      return (
        <svg className={`${base} text-content-secondary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5m0 2H6" />
        </svg>
      );
    case 'draft':
      return (
        <svg className={`${base} text-content-secondary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    case 'commit':
      return (
        <svg className={`${base} text-content-secondary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 3v6m0 6v6" />
        </svg>
      );
    case 'resolve':
      return (
        <svg className={`${base} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={`${base} text-content-tertiary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function SystemEvent({ discussion }: { discussion: Discussion }) {
  const note = discussion.notes[0];
  if (!note) return null;

  const kind = detectEventKind(note.body);

  return (
    <div className="flex items-center gap-3 py-2 px-4 group">
      <EventIcon kind={kind} />
      <Avatar
        src={note.author.avatar_url}
        name={note.author.name}
        size="xs"
      />
      <div className="flex-1 min-w-0 text-sm text-content-secondary">
        <span className="font-medium text-content">{note.author.name}</span>
        {' '}
        <span dangerouslySetInnerHTML={{ __html: note.body_html || note.body }} />
      </div>
      <span className="text-xs text-content-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {formatRelativeTime(note.created_at)}
      </span>
    </div>
  );
}

export function ActivityEvent({ discussion, projectId, mrIid, mrAuthor }: ActivityEventProps) {
  const firstNote = discussion.notes[0];
  if (!firstNote) return null;

  // System events render as compact timeline items
  if (firstNote.system) {
    return <SystemEvent discussion={discussion} />;
  }

  // Regular discussions delegate to CommentThread
  return (
    <div className="px-4">
      <CommentThread
        discussion={discussion}
        projectId={projectId}
        mrIid={mrIid}
        mrAuthor={mrAuthor}
      />
    </div>
  );
}
