import type { PipelineJob } from '../../types';
import { PipelineStatusIcon } from './PipelineStatusIcon';
import { useRetryJob, useCancelJob, useDownloadArtifacts } from '../../hooks/usePipeline';
import { useToast } from '../common/Toast';

interface JobRowProps {
  projectId: number;
  pipelineId: number;
  job: PipelineJob;
  isExpanded: boolean;
  onSelect: (job: PipelineJob | null) => void;
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

export function JobRow({ projectId, pipelineId, job, isExpanded, onSelect }: JobRowProps) {
  const toast = useToast();

  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();
  const downloadArtifacts = useDownloadArtifacts();

  const isFailed = job.status === 'failed';
  const isRunning = job.status === 'running';
  const hasArtifacts = job.artifacts.length > 0;

  const handleToggle = () => {
    onSelect(isExpanded ? null : job);
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
    toast.info(`Downloading artifacts for "${job.name}"...`);
    downloadArtifacts.mutate(
      { projectId, jobId: job.id, jobName: job.name },
      {
        onSuccess: (result) => {
          const sizeMB = (result.size_bytes / (1024 * 1024)).toFixed(1);
          toast.success(`Downloaded "${job.name}" artifacts (${sizeMB} MB)`);
        },
        onError: () => toast.error(`Failed to download "${job.name}" artifacts`),
      }
    );
  };

  return (
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
        hover:bg-surface-hover transition-colors cursor-pointer
        ${isExpanded ? 'bg-surface-hover ring-1 ring-primary/30' : ''}
      `}
    >
      <PipelineStatusIcon status={job.status} size={14} />

      <span className="flex-1 min-w-0 truncate text-content" title={job.name}>{job.name}</span>

      {job.allow_failure && (
        <span className="flex-shrink-0 text-caution-text/60" title="Allowed to fail">
          <AllowFailureIcon className="w-3.5 h-3.5" />
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
            {downloadArtifacts.isPending ? (
              <SpinnerIcon className="w-3.5 h-3.5" />
            ) : (
              <DownloadIcon className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
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

function SpinnerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function AllowFailureIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
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
