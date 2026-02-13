import React from 'react';
import type { MergeRequest, ApprovalState } from '../../types';
import { Avatar } from '../common';
import { useToast } from '../common/Toast';
import { ImpedimentBadge } from '../mr-list/ImpedimentBadge';
import { useMergeMR, useRebaseMR } from '../../hooks/useGitLab';
import { isMergeReady } from '../../utils/mergeReadiness';

interface MyMRCardProps {
  mr: MergeRequest;
  approvalState?: ApprovalState;
  selected?: boolean;
  onClick?: () => void;
}

export const MyMRCard = React.forwardRef<HTMLDivElement, MyMRCardProps>(function MyMRCard({ mr, approvalState, selected, onClick }, ref) {
  const toast = useToast();
  const mergeMR = useMergeMR();
  const rebaseMR = useRebaseMR();

  const ready = isMergeReady(mr, approvalState);

  const timeAgo = getTimeAgo(new Date(mr.updated_at));

  const approvedCount = approvalState?.approved_by?.length ?? 0;
  const requiredCount = approvalState?.approvals_required ?? 0;

  const handleMerge = (e: React.MouseEvent) => {
    e.stopPropagation();
    mergeMR.mutate(
      { project_id: mr.project_id, mr_iid: mr.iid, merge_when_pipeline_succeeds: false },
      {
        onSuccess: () => toast.success(`Merged !${mr.iid}`),
        onError: (err) => toast.error(`Merge failed: ${err.message}`),
      }
    );
  };

  const handleRebase = (e: React.MouseEvent) => {
    e.stopPropagation();
    rebaseMR.mutate(
      { projectId: mr.project_id, mrIid: mr.iid },
      {
        onSuccess: () => toast.success(`Rebase started for !${mr.iid}`),
        onError: (err) => toast.error(`Rebase failed: ${err.message}`),
      }
    );
  };

  const handleOpenInGitLab = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(mr.web_url);
    } catch {
      window.open(mr.web_url, '_blank');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      ref={ref}
      className={`p-4 border rounded-lg cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        selected ? 'border-primary bg-primary/5' : 'border-edge hover:border-edge-strong'
      }`}
    >
      {/* Header: Project and time */}
      <div className="flex items-center justify-between text-sm text-content-secondary mb-2">
        <span className="font-medium truncate max-w-[200px]" title={mr.project_path || undefined}>
          {mr.project_name || mr.project_path?.split('/').pop() || `Project #${mr.project_id}`}
        </span>
        <span className="text-xs">{timeAgo}</span>
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-content mb-2 line-clamp-2">
        {mr.draft && <span className="text-content-tertiary mr-1">Draft:</span>}
        {mr.title}
      </h3>

      {/* Branch info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-xs text-content-tertiary flex items-center gap-1">
          <span className="truncate max-w-[120px]">{mr.source_branch}</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="truncate max-w-[120px]">{mr.target_branch}</span>
        </div>
      </div>

      {/* Status row: badges + approval */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ImpedimentBadge mr={mr} />

        {ready && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-positive-muted text-positive-text">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready to merge
          </span>
        )}

        {approvalState && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
            approvalState.approved ? 'bg-positive-muted text-positive-text' : 'bg-surface-alt text-content-secondary'
          }`}>
            {approvedCount}/{requiredCount} approval{requiredCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Reviewer avatars */}
      {approvalState && approvalState.approved_by.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-content-secondary">Approved by:</span>
          <div className="flex -space-x-2">
            {approvalState.approved_by.slice(0, 5).map((approver) => (
              <Avatar
                key={approver.user.id}
                src={approver.user.avatar_url}
                name={approver.user.name}
                size="xs"
                className="border border-canvas"
              />
            ))}
            {approvalState.approved_by.length > 5 && (
              <span className="text-xs text-content-tertiary ml-2">
                +{approvalState.approved_by.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-edge">
        <button
          onClick={handleMerge}
          disabled={!ready || mergeMR.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-positive text-white hover:bg-positive/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {mergeMR.isPending ? 'Merging...' : 'Merge'}
        </button>

        <button
          onClick={handleRebase}
          disabled={!mr.has_conflicts || rebaseMR.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-alt text-content hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {rebaseMR.isPending ? 'Rebasing...' : 'Rebase'}
        </button>

        <button
          onClick={handleOpenInGitLab}
          className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md text-content-secondary hover:text-content hover:bg-surface-hover transition-colors"
        >
          Open in GitLab
        </button>
      </div>
    </div>
  );
});

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
