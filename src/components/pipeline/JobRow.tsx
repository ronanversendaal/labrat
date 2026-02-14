import type { PipelineJob } from '../../types';
import { PipelineStatusIcon } from './PipelineStatusIcon';
import { JobLogViewer } from './JobLogViewer';
import { useRetryJob, useCancelJob, useDownloadArtifacts } from '../../hooks/usePipeline';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useToast } from '../common/Toast';

interface JobRowProps {
  projectId: number;
  pipelineId: number;
  job: PipelineJob;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function JobRow({ projectId, pipelineId, job }: JobRowProps) {
  const { expandedJobId, setExpandedJobId } = usePipelineStore();
  const isExpanded = expandedJobId === job.id;
  const toast = useToast();

  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();
  const downloadArtifacts = useDownloadArtifacts();

  const isFailed = job.status === 'failed';
  const isRunning = job.status === 'running';
  const hasArtifacts = job.artifacts.length > 0;

  const handleToggle = () => {
    setExpandedJobId(isExpanded ? null : job.id);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    retryJob.mutate(
      { projectId, jobId: job.id, pipelineId },
      { onError: () => toast.error(`Failed to retry job "${job.name}"`) }
    );
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelJob.mutate(
      { projectId, jobId: job.id, pipelineId },
      { onError: () => toast.error(`Failed to cancel job "${job.name}"`) }
    );
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadArtifacts.mutate(
      { projectId, jobId: job.id },
      {
        onSuccess: () => toast.success('Artifacts downloaded'),
        onError: () => toast.error('Failed to download artifacts'),
      }
    );
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
          hover:bg-surface-hover transition-colors
          ${isExpanded ? 'bg-surface-hover' : ''}
        `}
      >
        <PipelineStatusIcon status={job.status} size={14} />

        <span className="flex-1 min-w-0 truncate text-content">{job.name}</span>

        {job.allow_failure && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase rounded bg-caution-muted text-caution-text">
            allowed to fail
          </span>
        )}

        <span className="flex-shrink-0 text-xs text-content-tertiary tabular-nums">
          {formatDuration(job.duration)}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retryJob.isPending}
              className="p-1 rounded text-content-secondary hover:text-content hover:bg-surface-active"
              title="Retry job"
            >
              <RetryIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleCancel}
              disabled={cancelJob.isPending}
              className="p-1 rounded text-content-secondary hover:text-negative hover:bg-surface-active"
              title="Cancel job"
            >
              <CancelIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {hasArtifacts && (
            <button
              onClick={handleDownload}
              disabled={downloadArtifacts.isPending}
              className="p-1 rounded text-content-secondary hover:text-content hover:bg-surface-active"
              title="Download artifacts"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded log viewer */}
      {isExpanded && (
        <div className="mt-1 mb-2">
          <JobLogViewer
            projectId={projectId}
            job={job}
            onClose={() => setExpandedJobId(null)}
          />
        </div>
      )}
    </div>
  );
}

function RetryIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function CancelIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
