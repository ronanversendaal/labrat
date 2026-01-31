import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, KeyboardHelpModal, useKeyboardHelpModal } from './components/common';
import { MRListPage } from './components/mr-list';
import { AddAccountModal, SettingsModal } from './components/settings';

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
