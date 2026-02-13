/**
 * MRDetailView - Full merge request detail view with tabs for description, diff, activity, AI
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// open() is dynamically imported only in Tauri mode
import type { MergeRequest, Discussion, MRChangeSnapshot } from '../../types';
import { useDiff, useDiscussions, useMergeRequest, useAccounts, useApproveMR, useApprovalState, useMergeMR, useRebaseMR } from '../../hooks/useGitLab';
import { isMergeReady } from '../../utils/mergeReadiness';
import { useMRStore, isFileViewedSelector } from '../../stores/mrStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAISuggestions } from '../../hooks/useAI';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useFocusStore } from '../../hooks/useFocusManager';
import { MonacoDiffView, type MonacoDiffViewHandle } from './MonacoDiffView';
import { FileTree } from './FileTree';
import { QuickFilePicker } from './QuickFilePicker';
import { CollapsibleDescription } from './CollapsibleDescription';
import { ImpedimentBadge } from '../mr-list/ImpedimentBadge';
import { Skeleton, Button, useToast, ApprovalButton, ApprovalStatus } from '../common';
import { AISuggestionsPanel } from '../ai';
import { CommentThread, CommentComposer } from '../comments';

interface MRDetailViewProps {
  mr: MergeRequest;
  onClose?: () => void;
}

type Tab = 'changes' | 'activity' | 'ai';

export function MRDetailView({ mr, onClose }: MRDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('changes');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [targetLine, setTargetLine] = useState<number | undefined>(undefined);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: accounts } = useAccounts();
  const activeAccount = accounts?.find((a) => a.is_active);
  const currentUserId = activeAccount?.user_id ?? 0;
  const markFileViewed = useMRStore((state) => state.markFileViewed);
  const unmarkFileViewed = useMRStore((state) => state.unmarkFileViewed);
  const viewedFiles = useMRStore((state) => state.viewedFiles);
  const clearViewedFiles = useMRStore((state) => state.clearViewedFiles);
  const fileViewMode = useSettingsStore((state) => state.fileViewMode);

  // Focus store for mode-aware keyboard shortcuts
  const { currentZone, diffMode, setFocusZone, setDiffMode, setFocusedLine } = useFocusStore();

  // Set initial zone on mount
  useEffect(() => {
    setFocusZone('file-list');
    setDiffMode('file-nav');
    return () => {
      setFocusZone('mr-list');
      setDiffMode('file-nav');
      setFocusedLine(null);
    };
  }, [setFocusZone, setDiffMode, setFocusedLine]);

  // Ref for diff view to access scroll functions
  const diffViewRef = useRef<MonacoDiffViewHandle>(null);

  // Scroll navigation handlers for in-file navigation
  const scrollDown = useCallback(() => {
    diffViewRef.current?.scrollDown();
  }, []);

  const scrollUp = useCallback(() => {
    diffViewRef.current?.scrollUp();
  }, []);

  // Snapshot of MR fields from the first poll response, used to detect real updates.
  // We intentionally wait for the first useMergeRequest response rather than using
  // the mr prop, because the prop comes from the list endpoint (possibly cached)
  // and may differ from the individual MR endpoint, causing false update banners.
  const initialSnapshot = useRef<MRChangeSnapshot | null>(null);
  const snapshotInitialized = useRef(false);

  // Poll for MR updates every 30 seconds
  const { data: currentMR, refetch: refetchMR } = useMergeRequest(mr.project_id, mr.iid, 30000);

  // Initialize snapshot from first poll response
  if (currentMR && !snapshotInitialized.current) {
    snapshotInitialized.current = true;
    initialSnapshot.current = {
      sha: currentMR.sha || null,
      state: currentMR.state,
      user_notes_count: currentMR.user_notes_count,
      has_conflicts: currentMR.has_conflicts,
    };
  }

  // Check if MR has meaningful updates (not just metadata changes)
  const hasRealUpdates = useMemo(() => {
    if (!currentMR || !initialSnapshot.current || dismissedUpdate) return false;
    const snapshot = initialSnapshot.current;
    const newSha = currentMR.sha || null;

    return (
      // Code was pushed (pipeline changed)
      newSha !== snapshot.sha ||
      // State changed (opened -> merged/closed)
      currentMR.state !== snapshot.state ||
      // New comments added
      currentMR.user_notes_count > snapshot.user_notes_count ||
      // Conflict status changed
      currentMR.has_conflicts !== snapshot.has_conflicts
    );
  }, [currentMR, dismissedUpdate]);

  const stateChanged = currentMR && initialSnapshot.current && currentMR.state !== initialSnapshot.current.state;

  // Handle refresh action - update snapshot to current values
  const handleRefresh = () => {
    if (currentMR) {
      initialSnapshot.current = {
        sha: currentMR.sha || null,
        state: currentMR.state,
        user_notes_count: currentMR.user_notes_count,
        has_conflicts: currentMR.has_conflicts,
      };
    }
    setDismissedUpdate(false);
    // Force refetch all data
    refetchMR();
  };

  const { data: diff, isLoading: isLoadingDiff, refetch: refetchDiff } = useDiff(mr.project_id, mr.iid);
  const { data: discussions, isLoading: isLoadingDiscussions, refetch: refetchDiscussions } = useDiscussions(mr.project_id, mr.iid);
  const { data: aiSuggestions } = useAISuggestions(mr.iid);
  const pendingAISuggestions = aiSuggestions?.filter((s) => s.status === 'pending').length || 0;

  // Current SHA for file viewed tracking (use head_commit_sha from diff or MR sha)
  const currentSha = diff?.head_commit_sha || mr.sha || '';

  // Auto-refresh on update detection
  useEffect(() => {
    if (hasRealUpdates && !dismissedUpdate) {
      // When updates are detected, we can refresh data or show the banner
      // The banner is already handled by the hasRealUpdates check below
    }
  }, [hasRealUpdates, dismissedUpdate]);

  // Sort files alphabetically for flat view (same order as FileTree displays)
  const sortedFiles = useMemo(() => {
    if (!diff?.files.length) return [];
    if (fileViewMode === 'flat') {
      return [...diff.files].sort((a, b) => a.new_path.localeCompare(b.new_path));
    }
    // For tree view, use original order (matches FileTree's tree traversal)
    return diff.files;
  }, [diff?.files, fileViewMode]);

  // Auto-select first file when diff loads
  const selectedFile = useMemo(() => {
    if (!sortedFiles.length) return null;
    const path = selectedFilePath || sortedFiles[0].new_path;
    return sortedFiles.find((f) => f.new_path === path) || null;
  }, [sortedFiles, selectedFilePath]);

  // Enter diff line-nav mode from file-list
  const enterDiffMode = useCallback(() => {
    if (diffMode === 'file-nav' && selectedFile) {
      setFocusZone('diff');
      setDiffMode('line-nav');
      diffViewRef.current?.enterLineNavMode();
    }
  }, [diffMode, selectedFile, setFocusZone, setDiffMode]);

  // Handle closing - layered Escape behavior
  const handleClose = useCallback(() => {
    if (currentZone === 'diff' && (diffMode === 'comment' || diffMode === 'suggest')) {
      // Let the comment/suggestion overlay handle Escape
      return;
    }
    if (currentZone === 'diff' && diffMode === 'line-nav') {
      // Exit line-nav back to file-nav
      setFocusZone('file-list');
      setDiffMode('file-nav');
      setFocusedLine(null);
      diffViewRef.current?.exitLineNavMode();
      return;
    }
    // Default: close detail view
    onClose?.();
  }, [currentZone, diffMode, onClose, setFocusZone, setDiffMode, setFocusedLine]);

  const handleToggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  // Navigate to next file in the sorted order (matches visual order in FileTree)
  const handleNextFile = useCallback(() => {
    if (!sortedFiles.length || !selectedFile) return;
    const currentIndex = sortedFiles.findIndex((f) => f.new_path === selectedFile.new_path);
    if (currentIndex < sortedFiles.length - 1) {
      setSelectedFilePath(sortedFiles[currentIndex + 1].new_path);
    }
  }, [sortedFiles, selectedFile]);

  // Navigate to previous file in the sorted order (matches visual order in FileTree)
  const handlePrevFile = useCallback(() => {
    if (!sortedFiles.length || !selectedFile) return;
    const currentIndex = sortedFiles.findIndex((f) => f.new_path === selectedFile.new_path);
    if (currentIndex > 0) {
      setSelectedFilePath(sortedFiles[currentIndex - 1].new_path);
    }
  }, [sortedFiles, selectedFile]);

  const unresolvedThreads = discussions?.filter(
    (d) => d.notes.some((n) => n.resolvable && !n.resolved)
  ).length || 0;

  // Handle jumping to a specific file and line from AI suggestions
  const handleJumpToLine = (filePath: string, line: number) => {
    setSelectedFilePath(filePath);
    setTargetLine(line);
    setActiveTab('changes');
    // Clear target line after a short delay so subsequent clicks work
    setTimeout(() => setTargetLine(undefined), 100);
  };

  // Keyboard shortcut to open quick file picker
  const openQuickPicker = useCallback(() => {
    if (diff?.files.length) {
      setIsQuickPickerOpen(true);
    }
  }, [diff?.files.length]);

  // Handle opening MR in GitLab using Tauri shell
  const handleOpenInGitLab = useCallback(async () => {
    try {
      if ('__TAURI_INTERNALS__' in window) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(mr.web_url);
      } else {
        window.open(mr.web_url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
      toast.error('Could not open the GitLab URL in your default browser.');
    }
  }, [mr.web_url, toast]);

  // Approve MR via keyboard shortcut
  const approveMutation = useApproveMR();
  const { data: approvalState } = useApprovalState(mr.project_id, mr.iid);
  const userHasApproved = approvalState?.approved_by?.some(
    (approver) => approver.user.id === currentUserId
  ) ?? false;
  const isAuthor = mr.author.id === currentUserId;

  const handleApproveMR = useCallback(() => {
    if (isAuthor) {
      toast.error('You cannot approve your own merge request');
      return;
    }
    if (userHasApproved) {
      toast.info('You have already approved this MR');
      return;
    }
    if (approveMutation.isPending) return;

    // Fire-and-forget: onMutate optimistically updates the cache before the network call
    approveMutation.mutate(
      {
        projectId: mr.project_id,
        mrIid: mr.iid,
        sha: mr.sha ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success('MR approved successfully');
          queryClient.invalidateQueries({ queryKey: ['mergeRequests'] });
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to approve MR';
          toast.error(message);
        },
      }
    );

    // Close immediately — optimistic cache update already happened in onMutate
    onClose?.();
  }, [isAuthor, userHasApproved, approveMutation, mr.project_id, mr.iid, mr.sha, toast, queryClient, onClose]);

  // Toggle viewed status for current file
  const toggleFileViewed = useCallback(() => {
    if (!selectedFile || !currentSha) return;
    const filePath = selectedFile.new_path;
    const isCurrentlyViewed = isFileViewedSelector(viewedFiles, mr.iid, filePath, currentSha);

    if (isCurrentlyViewed) {
      unmarkFileViewed(mr.iid, filePath);
      toast.info(`Unmarked ${filePath.split('/').pop()} as viewed`);
    } else {
      markFileViewed(mr.iid, filePath, currentSha);
      toast.success(`Marked ${filePath.split('/').pop()} as viewed`);
    }
  }, [selectedFile, currentSha, viewedFiles, mr.iid, markFileViewed, unmarkFileViewed, toast]);

  // Clear viewed files when SHA changes (MR was updated with new code)
  useEffect(() => {
    const prevSha = initialSnapshot.current?.sha ?? null;
    const newSha = currentMR?.sha || null;
    if (prevSha && newSha && prevSha !== newSha) {
      clearViewedFiles(mr.iid);
    }
  }, [currentMR?.sha, mr.iid, clearViewedFiles]);

  // Reset diff mode when file changes (back to file-nav)
  useEffect(() => {
    if (currentZone === 'diff') {
      setFocusZone('file-list');
      setDiffMode('file-nav');
      setFocusedLine(null);
    }
  }, [selectedFilePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // File-nav shortcuts: j/k navigate files (only in file-nav mode)
  useKeyboardShortcuts([
    {
      id: 'next-file',
      label: 'Next File',
      description: 'Select next file in the diff',
      keys: ['j', 'arrowdown'],
      category: 'diff',
      handler: handleNextFile,
      preventDefault: true,
    },
    {
      id: 'prev-file',
      label: 'Previous File',
      description: 'Select previous file in the diff',
      keys: ['k', 'arrowup'],
      category: 'diff',
      handler: handlePrevFile,
      preventDefault: true,
    },
  ], { enabled: diffMode === 'file-nav', scope: 'mr-detail-file-nav' });

  // Enter diff from file-list
  useKeyboardShortcuts([
    {
      id: 'enter-diff',
      label: 'Enter Diff',
      description: 'Enter diff line navigation',
      keys: ['enter'],
      category: 'diff',
      handler: enterDiffMode,
      preventDefault: true,
    },
  ], { enabled: diffMode === 'file-nav' && !!selectedFile, scope: 'mr-detail-enter' });

  // General shortcuts (always active in detail view)
  useKeyboardShortcuts([
    {
      id: 'close-mr-detail',
      label: 'Close',
      description: 'Close MR detail / exit diff mode',
      keys: ['escape'],
      category: 'navigation',
      handler: handleClose,
      preventDefault: true,
    },
    {
      id: 'quick-file-picker',
      label: 'Quick File',
      description: 'Open quick file picker',
      keys: ['meta+p', 't'],
      category: 'diff',
      handler: openQuickPicker,
      preventDefault: true,
    },
    {
      id: 'toggle-viewed',
      label: 'Toggle Viewed',
      description: 'Mark/unmark current file as viewed',
      keys: ['v'],
      category: 'diff',
      handler: toggleFileViewed,
      preventDefault: true,
    },
    {
      id: 'scroll-down',
      label: 'Scroll Down',
      description: 'Scroll down in the diff view',
      keys: ['n'],
      category: 'diff',
      handler: scrollDown,
      preventDefault: true,
    },
    {
      id: 'scroll-up',
      label: 'Scroll Up',
      description: 'Scroll up in the diff view',
      keys: ['p'],
      category: 'diff',
      handler: scrollUp,
      preventDefault: true,
    },
    {
      id: 'approve-mr',
      label: 'Approve',
      description: 'Approve merge request',
      keys: ['shift+a'],
      category: 'review',
      handler: handleApproveMR,
      preventDefault: true,
    },
  ], { scope: 'mr-detail' });

  return (
    <div className="flex flex-col h-full">
      {/* Update notification banner */}
      {hasRealUpdates && (
        <div
          role="status"
          aria-live="polite"
          className="px-6 py-3 bg-primary-muted border-b border-primary"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-primary-text">
                {stateChanged
                  ? `This merge request has been ${currentMR?.state === 'merged' ? 'merged' : 'closed'}.`
                  : 'This merge request has been updated.'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  handleRefresh();
                  refetchDiff();
                  refetchDiscussions();
                }}
              >
                Refresh
              </Button>
              <button
                onClick={() => setDismissedUpdate(true)}
                className="p-1 text-blue-500 hover:text-primary-text"
                aria-label="Dismiss update notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-edge">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Project path + branches */}
            <div className="flex items-center gap-2 text-sm text-content-secondary mb-1">
              <span>{mr.project_path || `Project #${mr.project_id}`}</span>
              <span>•</span>
              <span>!{mr.iid}</span>
              <span>•</span>
              <code className="px-1.5 py-0.5 text-xs bg-surface-alt rounded">{mr.source_branch}</code>
              <span className="text-content-tertiary">&rarr;</span>
              <code className="px-1.5 py-0.5 text-xs bg-surface-alt rounded">{mr.target_branch}</code>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-content mb-2">
              {mr.draft && <span className="text-content-tertiary">Draft: </span>}
              {mr.title}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <ImpedimentBadge mr={mr} />
            </div>
          </div>

          {/* Approval Status & Actions */}
          <div className="flex items-center gap-4 ml-4">
            {/* Approval status display */}
            <ApprovalStatus projectId={mr.project_id} mrIid={mr.iid} />

            {/* Approval button */}
            <ApprovalButton
              projectId={mr.project_id}
              mrIid={mr.iid}
              authorId={mr.author.id}
              currentUserId={currentUserId}
              sha={mr.sha ?? undefined}
            />

            <button
              onClick={handleOpenInGitLab}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Open in GitLab
            </button>
            {onClose && (
              <button
                onClick={handleClose}
                className="p-1.5 text-content-tertiary hover:text-content-muted"
                aria-label="Close merge request detail view (ESC)"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 -mb-4">
          <TabButton
            active={activeTab === 'changes'}
            onClick={() => setActiveTab('changes')}
            badge={diff?.files.length}
          >
            Changes
          </TabButton>
          <TabButton
            active={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
            badge={unresolvedThreads > 0 ? unresolvedThreads : undefined}
          >
            Activity
          </TabButton>
          <TabButton
            active={activeTab === 'ai'}
            onClick={() => setActiveTab('ai')}
            badge={pendingAISuggestions > 0 ? pendingAISuggestions : undefined}
          >
            AI Review
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'changes' && (
          <div className="flex flex-col h-full">
            {/* Collapsible description at the top */}
            <CollapsibleDescription mr={mr} />

            <div className="flex flex-1 min-h-0">
              {/* File tree sidebar */}
              <div className="w-64 flex-shrink-0 border-r border-edge overflow-auto">
                {isLoadingDiff ? (
                <div className="p-4 space-y-2">
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="70%" />
                </div>
              ) : diff?.files.length ? (
                <FileTree
                  files={diff.files}
                  selectedFile={selectedFile?.new_path || null}
                  onSelectFile={setSelectedFilePath}
                  expandedFolders={expandedFolders}
                  onToggleFolder={handleToggleFolder}
                  mrId={mr.iid}
                  currentSha={currentSha}
                />
              ) : (
                <div className="p-4 text-sm text-gray-500">No changes</div>
              )}
            </div>

            {/* Diff view */}
            <div className="flex-1 overflow-hidden">
              {isLoadingDiff ? (
                <div className="p-6 space-y-4">
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="rectangular" height={300} />
                </div>
              ) : selectedFile ? (
                <MonacoDiffView
                  key={selectedFile.new_path}
                  ref={diffViewRef}
                  file={selectedFile}
                  onNextFile={handleNextFile}
                  onPrevFile={handlePrevFile}
                  targetLine={targetLine}
                  projectId={mr.project_id}
                  mrIid={mr.iid}
                  discussions={discussions}
                  baseSha={diff?.base_commit_sha}
                  headSha={diff?.head_commit_sha}
                  onDiscussionsChange={() => refetchDiscussions()}
                  mrAuthor={mr.author}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a file to view changes
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityTab
            discussions={discussions || []}
            isLoading={isLoadingDiscussions}
            projectId={mr.project_id}
            mrIid={mr.iid}
          />
        )}

        {activeTab === 'ai' && (
          <AISuggestionsPanel
            projectId={mr.project_id}
            mrIid={mr.iid}
            onJumpToLine={handleJumpToLine}
          />
        )}
      </div>

      {/* Quick file picker modal */}
      <QuickFilePicker
        isOpen={isQuickPickerOpen}
        onClose={() => setIsQuickPickerOpen(false)}
        files={diff?.files || []}
        onSelectFile={(filePath) => {
          setSelectedFilePath(filePath);
          setActiveTab('changes');
        }}
        currentFile={selectedFilePath}
      />
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
        ${active
          ? 'bg-surface text-content border-t border-x border-edge'
          : 'text-content-secondary hover:text-content-muted'
        }
      `}
    >
      {children}
      {badge !== undefined && (
        <span className="ml-2 px-1.5 py-0.5 text-xs bg-surface-alt rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Activity tab content with discussion threads and comment composer
 */
function ActivityTab({
  discussions,
  isLoading,
  projectId,
  mrIid,
}: {
  discussions: Discussion[];
  isLoading: boolean;
  projectId: number;
  mrIid: number;
}) {
  const [showComposer, setShowComposer] = useState(false);

  // Separate unresolved and resolved discussions
  const unresolvedDiscussions = discussions.filter(
    (d) => d.notes.some((n) => n.resolvable && !n.resolved)
  );
  const resolvedDiscussions = discussions.filter(
    (d) => !d.notes.some((n) => n.resolvable && !n.resolved)
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="rectangular" height={100} />
        <Skeleton variant="rectangular" height={100} />
      </div>
    );
  }

  return (
    <div className="p-6 overflow-auto h-full">
      {/* New comment button */}
      <div className="mb-6">
        {showComposer ? (
          <div className="border border-edge rounded-lg p-4">
            <h3 className="text-sm font-medium text-content mb-3">
              New Comment
            </h3>
            <CommentComposer
              projectId={projectId}
              mrIid={mrIid}
              onSuccess={() => setShowComposer(false)}
              onCancel={() => setShowComposer(false)}
              placeholder="Write a general comment on this merge request..."
            />
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setShowComposer(true)}
            className="w-full"
          >
            + Add Comment
          </Button>
        )}
      </div>

      {/* Unresolved discussions */}
      {unresolvedDiscussions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-content-muted mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Unresolved ({unresolvedDiscussions.length})
          </h3>
          <div className="space-y-4">
            {unresolvedDiscussions.map((discussion) => (
              <CommentThread
                key={discussion.id}
                discussion={discussion}
                projectId={projectId}
                mrIid={mrIid}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved discussions */}
      {resolvedDiscussions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-content-secondary mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Resolved ({resolvedDiscussions.length})
          </h3>
          <div className="space-y-4">
            {resolvedDiscussions.map((discussion) => (
              <CommentThread
                key={discussion.id}
                discussion={discussion}
                projectId={projectId}
                mrIid={mrIid}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {discussions.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>No discussions yet</p>
          <p className="text-sm mt-1">Start a conversation by adding a comment above</p>
        </div>
      )}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
