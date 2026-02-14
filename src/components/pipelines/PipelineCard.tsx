/**
 * PipelineCard - Pipeline list item with expandable detail
 */

import type { PipelineDetail } from '../../types/gitlab';
import { PipelineStatusIcon, getStatusLabel, getStatusColorClass } from '../pipeline';
import { usePipelineStore } from '../../stores/pipelineStore';
import { PipelinePanel } from '../pipeline';
import { Avatar } from '../common';

interface PipelineCardProps {
  pipeline: PipelineDetail;
  projectId: number;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

const sourceBadgeStyles: Record<string, string> = {
  push: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
  web: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25',
  schedule: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  api: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/25',
  trigger: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  merge_request_event: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
  external_pull_request_event: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/25',
  parent_pipeline: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25',
  chat: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/25',
};

const sourceLabels: Record<string, string> = {
  push: 'push',
  web: 'web',
  schedule: 'schedule',
  api: 'api',
  trigger: 'trigger',
  merge_request_event: 'merge request',
  external_pull_request_event: 'external PR',
  parent_pipeline: 'parent',
  chat: 'chat',
};

function getSourceLabel(source: string | null): string | null {
  if (!source) return null;
  return sourceLabels[source] ?? source;
}

function getSourceBadgeStyle(source: string | null): string {
  if (!source) return 'bg-surface-hover text-secondary border-edge';
  return sourceBadgeStyles[source] ?? 'bg-surface-hover text-secondary border-edge';
}

export function PipelineCard({ pipeline, projectId }: PipelineCardProps) {
  const { selectedPipelineId, setSelectedPipelineId } = usePipelineStore();
  const isExpanded = selectedPipelineId === pipeline.id;

  const toggle = () => {
    setSelectedPipelineId(isExpanded ? null : pipeline.id);
  };

  const statusLabel = getStatusLabel(pipeline.status);
  const statusColor = getStatusColorClass(pipeline.status);
  const sourceLabel = getSourceLabel(pipeline.source);
  const sourceBadgeStyle = getSourceBadgeStyle(pipeline.source);
  const pipelineLabel = pipeline.iid ? `#${pipeline.iid}` : `#${pipeline.id}`;

  return (
    <div>
      <button
        onClick={toggle}
        className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer ${
          isExpanded ? 'bg-surface-hover' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className="flex-shrink-0 pt-0.5">
            <PipelineStatusIcon status={pipeline.status} size={20} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Pipeline name / commit message */}
            <div className="text-sm font-medium text-primary truncate">
              {pipeline.name || pipeline.ref_name}
            </div>

            {/* Row 2: Status, pipeline #, source branch, SHA, source badge */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-xs font-medium ${statusColor}`}>
                {statusLabel}
              </span>
              <span className="text-xs text-tertiary">{pipelineLabel}</span>

              <span className="text-xs text-tertiary">&middot;</span>

              {/* Source branch */}
              <svg className="w-3 h-3 text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path strokeLinecap="round" d="M6 21V9a9 9 0 0 0 9 9" />
              </svg>
              <span className="text-xs text-secondary font-mono truncate max-w-[160px]">
                {pipeline.ref_name}
              </span>

              <span className="text-xs text-tertiary">&middot;</span>

              {/* SHA */}
              <span className="text-xs text-tertiary font-mono">
                {pipeline.sha.slice(0, 8)}
              </span>

              {/* Source badge */}
              {sourceLabel && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border leading-none font-medium ${sourceBadgeStyle}`}>
                  {sourceLabel}
                </span>
              )}
            </div>
          </div>

          {/* Right side: avatar, duration/time, chevron */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Created by */}
            {pipeline.user && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={pipeline.user.avatar_url}
                  name={pipeline.user.name || pipeline.user.username}
                  size="sm"
                />
                <span className="text-xs text-secondary hidden xl:inline max-w-[80px] truncate">
                  {pipeline.user.username}
                </span>
              </div>
            )}

            {/* Duration + time */}
            <div className="flex flex-col items-end gap-0.5 min-w-[52px]">
              {pipeline.duration != null && (
                <span className="text-xs text-secondary tabular-nums">
                  {formatDuration(pipeline.duration)}
                </span>
              )}
              <span className="text-xs text-tertiary">
                {formatRelativeTime(pipeline.created_at)}
              </span>
            </div>

            {/* Expand chevron */}
            <svg
              className={`w-4 h-4 text-tertiary transition-transform flex-shrink-0 ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-edge bg-canvas">
          <PipelinePanel projectId={projectId} pipelineId={pipeline.id} />
        </div>
      )}
    </div>
  );
}
