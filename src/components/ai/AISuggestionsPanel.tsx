/**
 * AISuggestionsPanel - Panel showing AI suggestions for a merge request
 */

import { useState, useCallback } from 'react';
import type { AISuggestion, SuggestionCategory, SuggestionStatus } from '../../types';
import { useAISuggestions, useAnalyzeDiff, useUpdateSuggestionStatus, useAnalysisProgress } from '../../hooks/useAI';
import { usePostComment, useDiff } from '../../hooks/useGitLab';
import { SuggestionCard } from './SuggestionCard';
import { PostSuggestionModal } from './PostSuggestionModal';
import { Button, Skeleton, useToast } from '../common';

interface AISuggestionsPanelProps {
  projectId: number;
  mrIid: number;
  onJumpToLine?: (filePath: string, line: number) => void;
}

type FilterCategory = SuggestionCategory | 'all';
type FilterStatus = SuggestionStatus | 'all';

const categoryOptions: { value: FilterCategory; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'potential_bug', label: 'Potential Bugs' },
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance' },
  { value: 'code_quality', label: 'Code Quality' },
  { value: 'best_practice', label: 'Best Practice' },
  { value: 'readability', label: 'Readability' },
  { value: 'documentation', label: 'Documentation' },
];

const statusOptions: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'posted', label: 'Posted' },
];

export function AISuggestionsPanel({ projectId, mrIid, onJumpToLine }: AISuggestionsPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [postingSuggestion, setPostingSuggestion] = useState<AISuggestion | null>(null);
  const [batchPosting, setBatchPosting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const toast = useToast();
  const { data: suggestions, isLoading } = useAISuggestions(mrIid);
  const { data: diff } = useDiff(projectId, mrIid);
  const analyzeMutation = useAnalyzeDiff();
  const updateStatusMutation = useUpdateSuggestionStatus();
  const postCommentMutation = usePostComment();
  const { progress, reset: resetProgress } = useAnalysisProgress(mrIid);

  const handleAnalyze = () => {
    resetProgress();
    analyzeMutation.mutate({
      project_id: projectId,
      mr_iid: mrIid,
    });
  };

  const handleUpdateStatus = (suggestionId: string, status: SuggestionStatus) => {
    updateStatusMutation.mutate({
      suggestion_id: suggestionId,
      status,
    });
  };

  const handlePostToGitLab = (suggestion: AISuggestion) => {
    setPostingSuggestion(suggestion);
  };

  const handlePost = (suggestion: AISuggestion, body: string, asSuggestion: boolean) => {
    if (!diff) return;

    // Build position data
    const position = {
      base_sha: diff.base_commit_sha,
      head_sha: diff.head_commit_sha,
      new_path: suggestion.file_path,
      new_line: suggestion.start_line,
      position_type: 'text' as const,
    };

    postCommentMutation.mutate(
      {
        project_id: projectId,
        mr_iid: mrIid,
        body,
        position,
        as_suggestion: asSuggestion,
      },
      {
        onSuccess: () => {
          // Update suggestion status to 'posted'
          updateStatusMutation.mutate({
            suggestion_id: suggestion.id,
            status: 'posted',
          });
          setPostingSuggestion(null);
          toast.success(
            `Suggestion posted to GitLab! View it in the MR discussion.`
          );
        },
        onError: (error) => {
          toast.error(`Failed to post suggestion: ${error.message}`);
        },
      }
    );
  };

  const acceptedSuggestions = suggestions?.filter((s) => s.status === 'accepted') || [];
  const [includeDescription, setIncludeDescription] = useState(true);

  const buildPostBody = useCallback((suggestion: AISuggestion) => {
    const desc = includeDescription
      ? `**${suggestion.title}**\n\n${suggestion.description}`
      : '';

    if (suggestion.suggested_code) {
      // Format as GitLab suggestion block with optional description prefix
      const suggestionBlock = `\`\`\`suggestion\n${suggestion.suggested_code}\n\`\`\``;
      return {
        body: desc ? `${desc}\n\n${suggestionBlock}` : suggestionBlock,
        // We format the suggestion block ourselves, so don't let the backend wrap it again
        asSuggestion: false,
      };
    }

    return {
      body: desc || suggestion.title,
      asSuggestion: false,
    };
  }, [includeDescription]);

  const handlePostAllAccepted = useCallback(async () => {
    if (!diff || acceptedSuggestions.length === 0) return;

    setBatchPosting(true);
    setBatchProgress({ current: 0, total: acceptedSuggestions.length });

    let posted = 0;
    let failed = 0;

    for (const suggestion of acceptedSuggestions) {
      const position = {
        base_sha: diff.base_commit_sha,
        head_sha: diff.head_commit_sha,
        new_path: suggestion.file_path,
        new_line: suggestion.start_line,
        position_type: 'text' as const,
      };

      const { body, asSuggestion } = buildPostBody(suggestion);

      try {
        await postCommentMutation.mutateAsync({
          project_id: projectId,
          mr_iid: mrIid,
          body,
          position,
          as_suggestion: asSuggestion,
        });
        updateStatusMutation.mutate({
          suggestion_id: suggestion.id,
          status: 'posted',
        });
        posted++;
      } catch {
        failed++;
      }
      setBatchProgress({ current: posted + failed, total: acceptedSuggestions.length });
    }

    setBatchPosting(false);
    if (failed === 0) {
      toast.success(`Posted ${posted} suggestion${posted !== 1 ? 's' : ''} to GitLab`);
    } else {
      toast.error(`Posted ${posted}, failed ${failed} suggestion${failed !== 1 ? 's' : ''}`);
    }
  }, [diff, acceptedSuggestions, buildPostBody, postCommentMutation, updateStatusMutation, projectId, mrIid, toast]);

  // Filter suggestions
  const filteredSuggestions = suggestions?.filter((s) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  }) || [];

  // Group by severity for summary
  const summary = suggestions?.reduce(
    (acc, s) => {
      if (s.status === 'pending') {
        acc[s.severity] = (acc[s.severity] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  const pendingCount = suggestions?.filter((s) => s.status === 'pending').length || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-edge">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-content">AI Suggestions</h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-muted text-primary-text rounded">
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {acceptedSuggestions.length > 0 && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-content-secondary cursor-pointer" title="Include title and description in GitLab comments">
                  <input
                    type="checkbox"
                    checked={includeDescription}
                    onChange={(e) => setIncludeDescription(e.target.checked)}
                    className="rounded"
                  />
                  With context
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={batchPosting}
                  onClick={handlePostAllAccepted}
                >
                  {batchPosting
                    ? `Posting ${batchProgress.current}/${batchProgress.total}...`
                    : `Post ${acceptedSuggestions.length} accepted`}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="primary"
              loading={analyzeMutation.isPending}
              onClick={handleAnalyze}
              leftIcon={<AIIcon />}
            >
              {suggestions?.length ? 'Re-analyze' : 'Analyze with AI'}
            </Button>
          </div>
        </div>

        {/* Summary badges */}
        {Object.keys(summary).length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            {summary.error && (
              <span className="px-2 py-0.5 text-xs font-medium bg-negative-muted text-negative-text rounded">
                {summary.error} errors
              </span>
            )}
            {summary.warning && (
              <span className="px-2 py-0.5 text-xs font-medium bg-caution-muted text-caution-text rounded">
                {summary.warning} warnings
              </span>
            )}
            {summary.info && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-muted text-primary-text rounded">
                {summary.info} info
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as FilterCategory)}
            className="px-2 py-1 text-xs border border-edge-strong rounded bg-surface text-content"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="px-2 py-1 text-xs border border-edge-strong rounded bg-surface text-content"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton variant="rectangular" height={100} />
            <Skeleton variant="rectangular" height={100} />
            <Skeleton variant="rectangular" height={100} />
          </div>
        ) : analyzeMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-48 mb-4">
              <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress?.progress ?? 0}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-content-secondary">
              {progress?.message || 'Analyzing merge request...'}
            </p>
            <p className="text-xs text-content-tertiary mt-1">
              {progress?.progress ? `${progress.progress}%` : 'This may take a moment'}
            </p>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="text-center py-12">
            {suggestions?.length === 0 ? (
              <>
                <AIIcon className="w-12 h-12 mx-auto text-content-tertiary mb-4" />
                <p className="text-sm text-content-secondary">
                  No AI suggestions yet
                </p>
                <p className="text-xs text-content-tertiary mt-1">
                  Click "Analyze with AI" to get code review suggestions
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-content-secondary">
                  No suggestions match your filters
                </p>
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600 mt-1"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUpdateStatus={handleUpdateStatus}
                onPostToGitLab={handlePostToGitLab}
                onJumpToLine={onJumpToLine}
                isUpdating={updateStatusMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {analyzeMutation.isError && (
          <div className="mt-4 p-3 bg-negative-muted border border-negative-muted rounded-lg">
            <p className="text-sm text-negative-text">
              Analysis failed: {analyzeMutation.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={handleAnalyze}
              className="text-xs text-negative-text mt-1"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Post suggestion modal */}
      <PostSuggestionModal
        isOpen={!!postingSuggestion}
        onClose={() => setPostingSuggestion(null)}
        suggestion={postingSuggestion}
        onPost={handlePost}
        isPosting={postCommentMutation.isPending}
      />
    </div>
  );
}

function AIIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}
