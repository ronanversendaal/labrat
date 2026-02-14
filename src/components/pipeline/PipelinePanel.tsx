import { usePipelineDetail, usePipelineStages, usePipelineUpdates, useRetryPipeline, useCancelPipeline } from '../../hooks/usePipeline';
import { PipelineStatusIcon, getStatusLabel } from './PipelineStatusIcon';
import { StageColumn } from './StageColumn';
import { Skeleton } from '../common/Skeleton';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface PipelinePanelProps {
  projectId: number;
  pipelineId: number;
  compact?: boolean;
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

export function PipelinePanel({ projectId, pipelineId, compact = false }: PipelinePanelProps) {
  const toast = useToast();

  const { data: pipeline, isLoading: pipelineLoading } = usePipelineDetail(projectId, pipelineId);
  const { data: stages, isLoading: stagesLoading } = usePipelineStages(projectId, pipelineId);

  // Subscribe to live updates
  usePipelineUpdates(projectId, pipelineId);

  const retryPipeline = useRetryPipeline();
  const cancelPipeline = useCancelPipeline();

  const isRunning = pipeline?.status === 'running' || pipeline?.status === 'pending';
  const isFailed = pipeline?.status === 'failed';

  const handleRetry = () => {
    retryPipeline.mutate(
      { projectId, pipelineId },
      { onError: () => toast.error('Failed to retry pipeline') }
    );
  };

  const handleCancel = () => {
    cancelPipeline.mutate(
      { projectId, pipelineId },
      { onError: () => toast.error('Failed to cancel pipeline') }
    );
  };

  if (pipelineLoading) {
    return (
      <div className="border border-edge rounded-lg p-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width="40%" height="1rem" />
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[180px]">
              <Skeleton variant="text" width="60%" height="0.75rem" className="mb-3" />
              <Skeleton.List items={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="border border-edge rounded-lg p-6 text-center text-content-secondary text-sm">
        Pipeline not found.
      </div>
    );
  }

  return (
    <div className="border border-edge overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 ${compact ? 'py-2' : 'py-3'} bg-surface border-b border-edge`}>
        <div className="flex items-center gap-2 min-w-0">
          <PipelineStatusIcon status={pipeline.status} size={compact ? 16 : 20} />
          <span className={`font-semibold text-content ${compact ? 'text-sm' : 'text-base'}`}>
            #{pipeline.iid}
          </span>
          <span className={`text-content-secondary ${compact ? 'text-xs' : 'text-sm'}`}>
            {getStatusLabel(pipeline.status)}
          </span>
          {!compact && (
            <>
              <span className="text-content-tertiary text-xs">|</span>
              <span className="text-xs text-content-secondary font-mono truncate">
                {pipeline.ref_name}
              </span>
              <span className="text-xs text-content-tertiary font-mono">
                {pipeline.sha.slice(0, 8)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-content-secondary tabular-nums">
            {formatDuration(pipeline.duration)}
          </span>

          {isFailed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              loading={retryPipeline.isPending}
              leftIcon={<RetryIcon className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          )}
          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              loading={cancelPipeline.isPending}
              leftIcon={<CancelIcon className="w-3.5 h-3.5" />}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Stages layout */}
      <div className="p-3 overflow-x-auto">
        {stagesLoading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-w-[180px]">
                <Skeleton variant="text" width="60%" height="0.75rem" className="mb-3" />
                <Skeleton.List items={2} />
              </div>
            ))}
          </div>
        ) : stages && stages.length > 0 ? (
          <div className="flex gap-3">
            {stages.map((stage) => (
              <StageColumn
                key={stage.name}
                projectId={projectId}
                pipelineId={pipelineId}
                stage={stage}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-content-tertiary text-sm">
            No stages found for this pipeline.
          </div>
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
