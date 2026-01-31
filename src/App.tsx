import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider } from './components/common';
import { MRListPage } from './components/mr-list';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppLayout>
          <MRListPage />
        </AppLayout>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
