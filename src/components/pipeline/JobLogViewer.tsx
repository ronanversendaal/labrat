import { useRef, useEffect, useState, useCallback } from 'react';
import Anser from 'anser';
import type { PipelineJob } from '../../types';
import { useJobLog, useJobLogStream } from '../../hooks/usePipeline';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { PipelineStatusIcon, getStatusLabel } from './PipelineStatusIcon';
import { Button } from '../common/Button';

interface JobLogViewerProps {
  projectId: number;
  job: PipelineJob;
  onClose: () => void;
  /** All sibling jobs for prev/next navigation */
  allJobs?: PipelineJob[];
  /** Callback to navigate to a different job */
  onNavigateJob?: (job: PipelineJob) => void;
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

export function JobLogViewer({ projectId, job, onClose, allJobs = [], onNavigateJob }: JobLogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  // Prev/next navigation
  const currentIndex = allJobs.findIndex((j) => j.id === job.id);
  const prevJob = currentIndex > 0 ? allJobs[currentIndex - 1] : null;
  const nextJob = currentIndex >= 0 && currentIndex < allJobs.length - 1 ? allJobs[currentIndex + 1] : null;

  const goToPrev = useCallback(() => {
    if (prevJob && onNavigateJob) onNavigateJob(prevJob);
  }, [prevJob, onNavigateJob]);

  const goToNext = useCallback(() => {
    if (nextJob && onNavigateJob) onNavigateJob(nextJob);
  }, [nextJob, onNavigateJob]);

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

  // Reset scroll position when switching jobs
  useEffect(() => {
    setPinnedToBottom(true);
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [job.id]);

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

  // Keyboard navigation: j/k or [/] for prev/next job
  // Escape is NOT handled here — MRDetailView handles it via detailNavStore
  useKeyboardShortcuts([
    {
      id: 'prev-job',
      label: 'Previous Job',
      description: 'Navigate to previous job',
      keys: ['k', '['],
      category: 'navigation',
      handler: goToPrev,
      preventDefault: true,
    },
    {
      id: 'next-job',
      label: 'Next Job',
      description: 'Navigate to next job',
      keys: ['j', ']'],
      category: 'navigation',
      handler: goToNext,
      preventDefault: true,
    },
  ], { scope: 'job-log' });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-edge flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content transition-colors"
            title="Back to pipeline (Esc)"
          >
            <BackIcon className="w-4 h-4" />
            <span>Pipeline</span>
          </button>
          <span className="text-content-tertiary">/</span>
          <PipelineStatusIcon status={job.status} size={16} />
          <span className="text-sm font-semibold text-content truncate">{job.name}</span>
          <span className="text-xs text-content-tertiary px-1.5 py-0.5 rounded bg-surface-inset font-mono">
            {job.stage}
          </span>
          <span className="text-xs text-content-secondary">{getStatusLabel(job.status)}</span>
          {job.duration != null && (
            <span className="text-xs text-content-tertiary tabular-nums">{formatDuration(job.duration)}</span>
          )}
          {isActive && !isComplete && (
            <span className="text-xs text-info font-medium animate-pulse">Live</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Job navigation */}
          {allJobs.length > 1 && (
            <div className="flex items-center gap-0.5 mr-1 border-r border-edge pr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrev}
                disabled={!prevJob}
                title={prevJob ? `Previous job: ${prevJob.name} (k / [)` : 'No previous job'}
              >
                <ChevronUpIcon className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-content-tertiary tabular-nums min-w-[3ch] text-center">
                {currentIndex >= 0 ? currentIndex + 1 : '?'}/{allJobs.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNext}
                disabled={!nextJob}
                title={nextJob ? `Next job: ${nextJob.name} (j / ])` : 'No next job'}
              >
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
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
          <Button variant="ghost" size="sm" onClick={onClose} title="Close log (Esc)">
            <CloseIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Log content — fills remaining space */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-auto bg-surface-inset font-code text-xs leading-relaxed"
      >
        {isLoading ? (
          <div className="p-4 text-content-tertiary text-sm">Loading log...</div>
        ) : rawLog.length === 0 ? (
          <div className="p-4 text-content-tertiary text-sm">No log output available.</div>
        ) : (
          <pre
            className="p-4 m-0 whitespace-pre-wrap break-words text-content anser-container"
            dangerouslySetInnerHTML={{ __html: logHtml }}
          />
        )}
      </div>
    </div>
  );
}

function ChevronUpIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function BackIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
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
