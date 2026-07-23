import './styles/main.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

const queryClient = createQueryClient();
const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('renderer document is missing its #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createAppRouter({ queryClient })} />
    </QueryClientProvider>
  </StrictMode>,
);
