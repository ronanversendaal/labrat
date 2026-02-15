import { useCallback, useEffect } from 'react';
import { useUpdateStore } from '../stores/updateStore';
import { useSettingsStore } from '../stores/settingsStore';

// Module-level state to persist across hook instances
let pendingUpdate: Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>> | null = null;
let startupCheckDone = false;

export function useUpdater() {
  const store = useUpdateStore();
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates);

  const checkForUpdate = useCallback(async () => {
    store.setChecking();
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      store.setLastChecked(new Date());

      if (update) {
        pendingUpdate = update;
        store.setAvailable({
          version: update.version,
          date: update.date,
          body: update.body ?? undefined,
        });
      } else {
        pendingUpdate = null;
        store.setIdle();
      }
    } catch (e) {
      store.setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  const downloadAndInstall = useCallback(async () => {
    if (!pendingUpdate) return;
    store.setDownloading();
    try {
      let totalDownloaded = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          store.setProgress({
            contentLength: event.data.contentLength ?? undefined,
            chunkLength: 0,
            totalDownloaded: 0,
          });
        } else if (event.event === 'Progress') {
          totalDownloaded += event.data.chunkLength;
          store.setProgress({
            chunkLength: event.data.chunkLength,
            totalDownloaded,
          });
        } else if (event.event === 'Finished') {
          store.setReady();
        }
      });
      store.setReady();
    } catch (e) {
      store.setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  const restartApp = useCallback(async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      store.setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  // Startup auto-check (once per app lifecycle)
  useEffect(() => {
    if (!autoCheckUpdates || startupCheckDone) return;
    startupCheckDone = true;

    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    return () => clearTimeout(timer);
  }, [autoCheckUpdates, checkForUpdate]);

  return { checkForUpdate, downloadAndInstall, restartApp };
}
