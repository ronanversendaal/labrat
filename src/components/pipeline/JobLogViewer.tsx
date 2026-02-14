import { useRef, useEffect, useState, useCallback } from 'react';
import Anser from 'anser';
import type { PipelineJob } from '../../types';
import { useJobLog, useJobLogStream } from '../../hooks/usePipeline';
import { PipelineStatusIcon, getStatusLabel } from './PipelineStatusIcon';
import { Button } from '../common/Button';

interface JobLogViewerProps {
  projectId: number;
  job: PipelineJob;
  onClose: () => void;
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

export function JobLogViewer({ projectId, job, onClose }: JobLogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const isActive = job.status === 'running' || job.status === 'pending';

  // Fetch initial log
  const { data: initialLog, isLoading } = useJobLog(projectId, job.id);

  // Stream live updates when job is active
  const { logContent: streamContent, isComplete } = useJobLogStream(
    isActive ? projectId : 0,
    isActive ? job.id : 0
  );

  // Use stream content if available and job is active, otherwise initial log
  const rawLog = (isActive && streamContent) ? streamContent : (initialLog ?? '');

  // Convert ANSI to HTML
  const logHtml = Anser.ansiToHtml(rawLog, { use_classes: true });

  // Auto-scroll to bottom
  useEffect(() => {
    if (pinnedToBottom && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logHtml, pinnedToBottom]);

  // Detect user scroll to unpin
  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setPinnedToBottom(atBottom);
  }, []);

  const handleDownload = useCallback(() => {
    // eslint-disable-next-line no-undef
    const blob = new Blob([rawLog], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.name}-${job.id}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rawLog, job.name, job.id]);

  return (
    <div className="border border-edge rounded-lg overflow-hidden bg-surface-inset">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <PipelineStatusIcon status={job.status} size={14} />
          <span className="text-sm font-medium text-content truncate">{job.name}</span>
          <span className="text-xs text-content-tertiary">{getStatusLabel(job.status)}</span>
          {job.duration != null && (
            <span className="text-xs text-content-secondary">{formatDuration(job.duration)}</span>
          )}
          {isActive && !isComplete && (
            <span className="text-xs text-info animate-pulse">Live</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!pinnedToBottom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPinnedToBottom(true)}
              title="Scroll to bottom"
            >
              <ArrowDownIcon className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download log">
            <DownloadIcon className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Close log">
            <CloseIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="overflow-auto font-code text-xs leading-relaxed"
        style={{ maxHeight: '400px' }}
      >
        {isLoading ? (
          <div className="p-4 text-content-tertiary text-sm">Loading log...</div>
        ) : rawLog.length === 0 ? (
          <div className="p-4 text-content-tertiary text-sm">No log output available.</div>
        ) : (
          <pre
            className="p-3 m-0 whitespace-pre-wrap break-words text-content anser-container"
            dangerouslySetInnerHTML={{ __html: logHtml }}
          />
        )}
      </div>
    </div>
  );
}

function ArrowDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
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

function CloseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
