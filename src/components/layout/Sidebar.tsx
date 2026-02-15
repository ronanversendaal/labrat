import { type ReactNode, useState, useEffect } from 'react';
import { useUpdateStore } from '../../stores/updateStore';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onUpdateClick?: () => void;
  children?: ReactNode;
}

export function Sidebar({ collapsed = false, onToggleCollapse, onUpdateClick, children }: SidebarProps) {
  const updateStatus = useUpdateStore((s) => s.status);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const hasUpdate = updateStatus === 'available' || updateStatus === 'ready';
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    import('@tauri-apps/api/app').then((m) => m.getVersion()).then(setAppVersion).catch(() => {});
  }, []);
  return (
    <aside
      className={`
        flex flex-col
        h-full bg-sidebar text-sidebar-text
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo/Brand */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <span className="font-semibold text-lg whitespace-nowrap">LabRat</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded hover:bg-sidebar-hover focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Navigation content */}
      <nav className="flex-1 overflow-y-auto py-4">
        {children}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        {hasUpdate ? (
          collapsed ? (
            <button
              onClick={onUpdateClick}
              className="flex justify-center w-full"
              title={`v${updateInfo?.version} available`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            </button>
          ) : (
            <button
              onClick={onUpdateClick}
              className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              v{updateInfo?.version} available
            </button>
          )
        ) : (
          !collapsed && (
            <div className="text-xs text-sidebar-muted">
              {appVersion ? `v${appVersion}` : ''}
            </div>
          )
        )}
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  badge?: number;
}

export function SidebarItem({
  icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  badge,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full flex items-center gap-3 px-4 py-2.5
        transition-colors duration-150
        ${active
          ? 'bg-primary text-white'
          : 'text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-sm font-medium">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  );
}

interface SidebarSectionProps {
  title?: string;
  collapsed?: boolean;
  children: ReactNode;
}

export function SidebarSection({ title, collapsed, children }: SidebarSectionProps) {
  return (
    <div className="mb-4">
      {title && !collapsed && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
