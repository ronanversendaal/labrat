import { useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, KeyboardHelpModal, useKeyboardHelpModal } from './components/common';
import { MRListPage } from './components/mr-list';
import { AddAccountModal, SettingsModal } from './components/settings';
import { useUIStore, useMRStore } from './stores';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcuts';
import { useAccounts } from './hooks/useGitLab';
import { useThemeSync } from './hooks/useTheme';

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
