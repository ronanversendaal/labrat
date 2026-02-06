import { useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, KeyboardHelpModal, useKeyboardHelpModal } from './components/common';
import { MRListPage } from './components/mr-list';
import { AddAccountModal, SettingsModal } from './components/settings';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore, useMRStore } from './stores';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcuts';
import { useAccounts } from './hooks/useGitLab';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Hook to synchronize theme setting with document class
function useThemeSync() {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      root.classList.remove('light', 'dark');
      root.classList.add(isDark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // Use explicit theme setting
      applyTheme(theme === 'dark');
    }
  }, [theme]);
}

function AppContent() {
  const keyboardHelp = useKeyboardHelpModal();
  const { openModal } = useUIStore();
  const { closeDetail, clearFilters, setNegatedFilters, setSpecialFilters } = useMRStore();
  const { data: accounts } = useAccounts();
  const activeAccount = accounts?.find((a) => a.is_active);
  const queryClientInstance = useQueryClient();

  // Synchronize theme with document class
  useThemeSync();

  // Register settings shortcut (Cmd+, on Mac, Ctrl+, on Windows/Linux)
  const handleOpenSettings = useCallback(() => {
    openModal('settings');
  }, [openModal]);

  useKeyboardShortcut(['meta+,'], handleOpenSettings, {
    label: 'Settings',
    description: 'Open settings',
    category: 'global',
  });

  // Register "My Reviews" shortcut (Shift+R)
  const handleGoToMyReviews = useCallback(() => {
    // Close detail view if open
    closeDetail();
    // Clear existing filters
    clearFilters();
    // Apply default "My Reviews" filters
    if (activeAccount?.username) {
      setNegatedFilters([
        { type: 'author', value: activeAccount.username },
      ]);
      setSpecialFilters({
        excludeApprovedByMe: true,
        reviewerIsMe: true,
      });
    }
  }, [closeDetail, clearFilters, setNegatedFilters, setSpecialFilters, activeAccount?.username]);

  useKeyboardShortcut(['shift+r'], handleGoToMyReviews, {
    label: 'My Reviews',
    description: 'Go to your review requests',
    category: 'global',
  });

  // Register refresh shortcut (Cmd+R on Mac, Ctrl+R on Windows/Linux)
  const handleRefresh = useCallback(() => {
    queryClientInstance.invalidateQueries({ queryKey: ['mergeRequests'] });
  }, [queryClientInstance]);

  useKeyboardShortcut(['meta+r'], handleRefresh, {
    label: 'Refresh',
    description: 'Reload merge request list',
    category: 'global',
  });

  return (
    <>
      <AppLayout>
        <MRListPage />
      </AppLayout>
      <KeyboardHelpModal isOpen={keyboardHelp.isOpen} onClose={keyboardHelp.close} />
      <AddAccountModal />
      <SettingsModal />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
