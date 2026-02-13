import { useEffect, useRef, useMemo, type ReactNode } from 'react';
import { Sidebar, SidebarItem, SidebarSection } from './Sidebar';
import { MainContent } from './MainContent';
import { Avatar } from '../common';
import { useAccounts, useSetActiveAccount, useMyMergeRequests } from '../../hooks/useGitLab';
import { useUIStore, useMRStore } from '../../stores';
import { useSettingsStore } from '../../stores/settingsStore';
import { isMergeReady } from '../../utils/mergeReadiness';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSettingsStore((s) => s.toggleSidebarCollapsed);
  const { data: accounts } = useAccounts();
  const setActiveAccount = useSetActiveAccount();
  const { openModal, activeView, setActiveView } = useUIStore();
  const { negatedFilters, specialFilters, setNegatedFilters, setSpecialFilters, clearFilters, closeDetail, setSelectedMr } = useMRStore();

  const activeAccount = accounts?.find((a) => a.is_active);
  const defaultsApplied = useRef(false);

  // Keep My MRs data fresh for sidebar badge regardless of active view
  const { data: myMRsData } = useMyMergeRequests();
  const readyCount = useMemo(() => {
    if (!myMRsData?.merge_requests) return 0;
    return myMRsData.merge_requests.filter((mr) =>
      isMergeReady(mr, myMRsData.approval_states?.[mr.id])
    ).length;
  }, [myMRsData]);

  // Apply default "My Reviews" filters:
  // - NOT authored by current user
  // - NOT already approved by me
  // - Reviewer is me
  const applyMyReviewsDefaults = () => {
    clearFilters();
    if (activeAccount?.username) {
      setNegatedFilters([
        { type: 'author', value: activeAccount.username },
      ]);
      setSpecialFilters({
        excludeApprovedByMe: true,
        reviewerIsMe: true,
      });
    }
  };

  // Auto-apply "My Reviews" defaults only on first run (no persisted filters).
  // Once the user has filters persisted from a previous session, respect those.
  useEffect(() => {
    if (defaultsApplied.current || !activeAccount?.username) return;
    defaultsApplied.current = true;

    const hasPersistedFilters = negatedFilters.length > 0 ||
      specialFilters.excludeApprovedByMe ||
      specialFilters.reviewerIsMe;
    if (hasPersistedFilters) return;

    setNegatedFilters([
      { type: 'author', value: activeAccount.username },
    ]);
    setSpecialFilters({
      excludeApprovedByMe: true,
      reviewerIsMe: true,
    });
  }, [activeAccount?.username, negatedFilters, specialFilters, setNegatedFilters, setSpecialFilters]);

  const handleSelectAccount = (accountId: string) => {
    setActiveAccount.mutate(accountId);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas">
      {/* macOS-style toolbar / drag region — spans full window width */}
      <div
        data-tauri-drag-region="true"
        className="h-[38px] flex-shrink-0 flex items-center bg-surface border-b border-edge select-none"
      />

      {/* Sidebar + content below the toolbar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        >
          {/* Account selector */}
          {accounts && accounts.length > 0 && (
            <SidebarSection title="Accounts" collapsed={sidebarCollapsed}>
              {accounts.map((account) => (
                <SidebarItem
                  key={account.id}
                  icon={<Avatar src={account.avatar_url} name={account.name} size="xs" />}
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
              active={activeView === 'my-reviews'}
              collapsed={sidebarCollapsed}
              onClick={() => {
                setActiveView('my-reviews');
                closeDetail();
                setSelectedMr(null);
                applyMyReviewsDefaults();
              }}
            />
            <SidebarItem
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="18" cy="18" r="3" strokeWidth={2} />
                  <circle cx="6" cy="6" r="3" strokeWidth={2} />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 21V9a9 9 0 0 0 9 9"
                  />
                </svg>
              }
              label="My Merge Requests"
              active={activeView === 'my-mrs'}
              collapsed={sidebarCollapsed}
              onClick={() => {
                setActiveView('my-mrs');
                closeDetail();
                setSelectedMr(null);
              }}
              badge={readyCount}
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
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </div>
  );
}
