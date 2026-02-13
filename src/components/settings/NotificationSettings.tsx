/**
 * NotificationSettings - Notification preferences panel
 */

import { useSettingsStore } from '../../stores/settingsStore';

export function NotificationSettings() {
  const notifyMergeReady = useSettingsStore((s) => s.notifyMergeReady);
  const setNotifyMergeReady = useSettingsStore((s) => s.setNotifyMergeReady);
  const notifyMrUpdatedBanner = useSettingsStore((s) => s.notifyMrUpdatedBanner);
  const setNotifyMrUpdatedBanner = useSettingsStore((s) => s.setNotifyMrUpdatedBanner);
  const toastNotifications = useSettingsStore((s) => s.toastNotifications);
  const setToastNotifications = useSettingsStore((s) => s.setToastNotifications);

  return (
    <div className="space-y-8">
      {/* Desktop Notifications */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Desktop Notifications</h2>
        <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
          <div>
            <p className="font-medium text-content">Ready to Merge</p>
            <p className="text-sm text-content-secondary">
              Show an OS notification when a merge request becomes ready to merge
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyMergeReady}
              onChange={(e) => setNotifyMergeReady(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </section>

      {/* In-App Notifications */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">In-App Notifications</h2>
        <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
          <div>
            <p className="font-medium text-content">MR Updated Banner</p>
            <p className="text-sm text-content-secondary">
              Show a banner in the detail view when a merge request has been updated
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifyMrUpdatedBanner}
              onChange={(e) => setNotifyMrUpdatedBanner(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </section>

      {/* Toast Notifications */}
      <section>
        <h2 className="text-lg font-medium text-content mb-4">Toast Notifications</h2>
        <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
          <div>
            <p className="font-medium text-content">Toast Popups</p>
            <p className="text-sm text-content-secondary">
              Show success, info, and warning toasts. Error toasts are always shown.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={toastNotifications}
              onChange={(e) => setToastNotifications(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </section>
    </div>
  );
}
