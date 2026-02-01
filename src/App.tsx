import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, KeyboardHelpModal, useKeyboardHelpModal } from './components/common';
import { MRListPage } from './components/mr-list';
import { AddAccountModal, SettingsModal } from './components/settings';
import { useSettingsStore } from './stores/settingsStore';

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

  // Synchronize theme with document class
  useThemeSync();

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
