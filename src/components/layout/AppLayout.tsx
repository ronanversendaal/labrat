import { useState, type ReactNode } from 'react';
import { Sidebar, SidebarItem, SidebarSection } from './Sidebar';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { useAccounts, useSetActiveAccount } from '../../hooks/useGitLab';
import { useUIStore, useMRStore } from '../../stores';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: accounts } = useAccounts();
  const setActiveAccount = useSetActiveAccount();
  const { openModal } = useUIStore();
  const { setFilter, clearFilters } = useMRStore();

  const activeAccount = accounts?.find((a) => a.is_active);

  const handleSelectAccount = (accountId: string) => {
    setActiveAccount.mutate(accountId);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {/* Account selector */}
        {accounts && accounts.length > 0 && (
          <SidebarSection title="Accounts" collapsed={sidebarCollapsed}>
            {accounts.map((account) => (
              <SidebarItem
                key={account.id}
                icon={
                  account.avatar_url ? (
                    <img
                      src={account.avatar_url}
                      alt={account.name}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                      {account.name.charAt(0).toUpperCase()}
                    </div>
                  )
                }
                label={account.name}
                active={account.is_active}
                collapsed={sidebarCollapsed}
                onClick={() => handleSelectAccount(account.id)}
              />
            ))}
            <SidebarItem
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              label="Add Account"
              collapsed={sidebarCollapsed}
              onClick={() => openModal('addAccount')}
            />
          </SidebarSection>
        )}

        <SidebarSection collapsed={sidebarCollapsed}>
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
            label="My Reviews"
            active
            collapsed={sidebarCollapsed}
            onClick={() => clearFilters()}
          />
        </SidebarSection>

        <SidebarSection title="Quick Filters" collapsed={sidebarCollapsed}>
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            label="Has Conflicts"
            collapsed={sidebarCollapsed}
            onClick={() => setFilter({ has_conflicts: true })}
          />
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            label="Pipeline Failed"
            collapsed={sidebarCollapsed}
            onClick={() => setFilter({ pipeline_failed: true })}
          />
        </SidebarSection>

        <SidebarSection title="Settings" collapsed={sidebarCollapsed}>
          <SidebarItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
            label="Settings"
            collapsed={sidebarCollapsed}
            onClick={() => openModal('settings')}
          />
        </SidebarSection>
      </Sidebar>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={activeAccount ? `${activeAccount.name} - My Reviews` : 'My Pending Reviews'} />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
