/**
 * ApprovalButton - MR approval/unapproval button with status display
 */

import { useApprovalState, useApproveMR, useUnapproveMR } from '../../hooks/useGitLab';
import { Avatar } from './Avatar';
import { Button, useToast } from './index';

interface ApprovalButtonProps {
  projectId: number;
  mrIid: number;
  authorId: number;
  currentUserId: number;
  sha?: string;
}

export function ApprovalButton({
  projectId,
  mrIid,
  authorId,
  currentUserId,
  sha,
}: ApprovalButtonProps) {
  const toast = useToast();
  const { data: approvalState, isLoading, error } = useApprovalState(projectId, mrIid);
  const approveMutation = useApproveMR();
  const unapproveMutation = useUnapproveMR();

  const isAuthor = authorId === currentUserId;
  const isApproving = approveMutation.isPending;
  const isUnapproving = unapproveMutation.isPending;
  const isBusy = isApproving || isUnapproving;

  // Compute user approval status from approved_by list since API doesn't provide it directly
  const userHasApproved = approvalState?.approved_by?.some(
    (approver) => approver.user.id === currentUserId
  ) ?? false;

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ projectId, mrIid, sha });
      toast.success('MR approved successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve MR';
      toast.error(message);
    }
  };

  const handleUnapprove = async () => {
    try {
      await unapproveMutation.mutateAsync({ projectId, mrIid });
      toast.success('Approval removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove approval';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <Button variant="secondary" size="sm" disabled loading>
        Loading...
      </Button>
    );
  }

  if (error) {
    return (
      <Button variant="secondary" size="sm" disabled title="Failed to load approval state">
        Approve
      </Button>
    );
  }

  // Authors cannot approve their own MRs
  if (isAuthor) {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled
        title="You cannot approve your own merge request"
      >
        Approve
      </Button>
    );
  }

  // User has already approved - show unapprove button
  if (userHasApproved) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={handleUnapprove}
        disabled={isBusy}
        loading={isUnapproving}
        leftIcon={
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        }
      >
        Approved
      </Button>
    );
  }

  // User can approve - show approve button
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleApprove}
      disabled={isBusy}
      loading={isApproving}
    >
      Approve
    </Button>
  );
}

/**
 * ApprovalStatus - Display approval count and avatars
 */
interface ApprovalStatusProps {
  projectId: number;
  mrIid: number;
}

export function ApprovalStatus({ projectId, mrIid }: ApprovalStatusProps) {
  const { data: approvalState, isLoading } = useApprovalState(projectId, mrIid);

  if (isLoading || !approvalState) {
    return null;
  }

  const { approved_by, approvals_required, approvals_left } = approvalState;
  const approvalCount = approved_by.length;

  return (
    <div className="flex items-center gap-2">
      {/* Approval count */}
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {approvalCount}/{approvals_required} approvals
        {approvals_left > 0 && ` (${approvals_left} needed)`}
      </span>

      {/* Approver avatars */}
      {approved_by.length > 0 && (
        <div className="flex -space-x-2">
          {approved_by.slice(0, 5).map((approver) => (
            <Avatar
              key={approver.user.id}
              src={approver.user.avatar_url}
              name={approver.user.name}
              size="sm"
              title={`Approved by ${approver.user.name}`}
              className="border-2 border-white dark:border-gray-800"
            />
          ))}
          {approved_by.length > 5 && (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 text-xs">
              +{approved_by.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
