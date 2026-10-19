import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ApiError } from './api/client'
import { AuthProvider } from './auth/AuthProvider'
import { NotifyProvider } from './components/NotifyProvider'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry errors the user can't fix by waiting (401, 403, 404, validation).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

// Fluent 2's default brand colour (#0F6CBD) is the blue used throughout the Figma design.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={queryClient}>
        <NotifyProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </NotifyProvider>
      </QueryClientProvider>
    </FluentProvider>
  </StrictMode>,
)
