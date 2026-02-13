import type { MergeRequest, ApprovalState } from '../types/gitlab';

/**
 * Check if a merge request is ready to merge
 */
export function isMergeReady(mr: MergeRequest, approvalState?: ApprovalState): boolean {
  return (
    !mr.draft &&
    !mr.has_conflicts &&
    mr.blocking_discussions_resolved &&
    mr.head_pipeline?.status === 'success' &&
    (approvalState?.approved ?? false)
  );
}
