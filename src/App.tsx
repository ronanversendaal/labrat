import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider } from './components/common';

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
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              GitLab MR Review
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome to the GitLab MR Review App
            </p>
          </div>
        </AppLayout>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
