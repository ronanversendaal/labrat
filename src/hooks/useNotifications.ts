import { useEffect, useRef } from 'react';
import type { ListMergeRequestsResponse } from '../types/gitlab';
import { isMergeReady } from '../utils/mergeReadiness';

/**
 * Sends OS notifications when MRs become merge-ready.
 * Tracks which MRs have already been notified to avoid duplicates.
 */
export function useMergeReadyNotifications(data: ListMergeRequestsResponse | undefined) {
  const notifiedMRs = useRef<Set<number>>(new Set());
  const permissionChecked = useRef(false);

  useEffect(() => {
    if (!data?.merge_requests) return;

    const checkAndNotify = async () => {
      // Lazy-import to avoid issues outside Tauri
      let notify: typeof import('@tauri-apps/plugin-notification') | null = null;

      try {
        notify = await import('@tauri-apps/plugin-notification');
      } catch {
        // Not in Tauri context
        return;
      }

      // Request permission once
      if (!permissionChecked.current) {
        permissionChecked.current = true;
        const granted = await notify.isPermissionGranted();
        if (!granted) {
          const result = await notify.requestPermission();
          if (result !== 'granted') return;
        }
      }

      // Track current MR IDs to clean up old entries
      const currentIds = new Set(data.merge_requests.map((mr) => mr.id));

      // Clean up notifiedMRs for MRs no longer in the list
      for (const id of notifiedMRs.current) {
        if (!currentIds.has(id)) {
          notifiedMRs.current.delete(id);
        }
      }

      // Check for newly merge-ready MRs
      for (const mr of data.merge_requests) {
        if (notifiedMRs.current.has(mr.id)) continue;

        const approvalState = data.approval_states?.[mr.id];
        if (isMergeReady(mr, approvalState)) {
          notifiedMRs.current.add(mr.id);
          const projectName = mr.project_name || mr.project_path?.split('/').pop() || '';
          notify.sendNotification({
            title: 'Ready to merge',
            body: `${projectName} !${mr.iid}: ${mr.title}`,
          });
        }
      }
    };

    checkAndNotify();
  }, [data]);
}
