import type { ReactElement } from 'react';
import type { MergeRequest } from '../../types';

interface ImpedimentBadgeProps {
  mr: MergeRequest;
}

export function ImpedimentBadge({ mr }: ImpedimentBadgeProps) {
  const impediments: ReactElement[] = [];

  // Conflict badge
  if (mr.has_conflicts) {
    impediments.push(
      <Badge key="conflict" type="error" icon={<ConflictIcon />}>
        Conflicts
      </Badge>
    );
  }

  // Pipeline failed badge
  if (mr.head_pipeline?.status === 'failed') {
    impediments.push(
      <Badge key="pipeline" type="error" icon={<PipelineIcon />}>
        Pipeline Failed
      </Badge>
    );
  }

  // Pipeline running badge
  if (mr.head_pipeline?.status === 'running') {
    impediments.push(
      <Badge key="pipeline-running" type="info" icon={<PipelineRunningIcon />}>
        Running
      </Badge>
    );
  }

  // Unresolved discussions badge
  if (!mr.blocking_discussions_resolved && mr.user_notes_count > 0) {
    impediments.push(
      <Badge key="discussions" type="warning" icon={<DiscussionIcon />}>
        {mr.user_notes_count} thread{mr.user_notes_count !== 1 ? 's' : ''}
      </Badge>
    );
  }

  // Draft badge
  if (mr.draft) {
    impediments.push(
      <Badge key="draft" type="neutral" icon={<DraftIcon />}>
        Draft
      </Badge>
    );
  }

  // Pipeline success badge (small indicator)
  if (mr.head_pipeline?.status === 'success') {
    impediments.push(
      <Badge key="pipeline-success" type="success" icon={<PipelineSuccessIcon />}>
        Passed
      </Badge>
    );
  }

  return <>{impediments}</>;
}

type BadgeType = 'error' | 'warning' | 'info' | 'success' | 'neutral';

interface BadgeProps {
  type: BadgeType;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const typeClasses: Record<BadgeType, string> = {
  error: 'bg-negative-muted text-negative-text',
  warning: 'bg-caution-muted text-caution-text',
  info: 'bg-primary-muted text-primary-text',
  success: 'bg-positive-muted text-positive-text',
  neutral: 'bg-surface-alt text-content-secondary',
};

function Badge({ type, icon, children }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        text-xs font-medium rounded
        ${typeClasses[type]}
      `}
    >
      {icon}
      {children}
    </span>
  );
}

// Icons
function ConflictIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PipelineRunningIcon() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function PipelineSuccessIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function DiscussionIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}
