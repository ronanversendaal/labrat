import { useEffect, useRef } from 'react';
import type { ListMergeRequestsResponse } from '../types/gitlab';
import { isMergeReady } from '../utils/mergeReadiness';
import { useSettingsStore } from '../stores/settingsStore';

let permissionGranted: boolean | null = null;

/**
 * Request notification permission once at startup so it's already granted
 * by the time a notification needs to fire.
 *
 * Note: On macOS, the notification icon is always the app's bundle icon.
 * In dev mode this shows as Terminal; in production builds it shows the
 * LabRat icon automatically.
 */
export function useNotificationPermission() {
  useEffect(() => {
    if (permissionGranted !== null) return;
    permissionGranted = false; // mark as in-progress to avoid duplicate requests

    (async () => {
      try {
        const { isPermissionGranted, requestPermission } = await import(
          '@tauri-apps/plugin-notification'
        );
        const granted = await isPermissionGranted();
        if (granted) {
          permissionGranted = true;
        } else {
          const result = await requestPermission();
          permissionGranted = result === 'granted';
        }
      } catch {
        // Not in Tauri context
      }
    })();
  }, []);
}

/**
 * Sends OS notifications when MRs become merge-ready.
 * Tracks which MRs have already been notified to avoid duplicates.
 */
export function useMergeReadyNotifications(data: ListMergeRequestsResponse | undefined) {
  const notifiedMRs = useRef<Set<number>>(new Set());
  const notifyMergeReady = useSettingsStore((s) => s.notifyMergeReady);

  useEffect(() => {
    if (!notifyMergeReady || !data?.merge_requests || !permissionGranted) return;

    const checkAndNotify = async () => {
      let notify: typeof import('@tauri-apps/plugin-notification') | null = null;

      try {
        notify = await import('@tauri-apps/plugin-notification');
      } catch {
        return;
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

