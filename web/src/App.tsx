import { Button, makeStyles, Spinner, Text } from '@fluentui/react-components'
import { createBrowserRouter, RouterProvider, useNavigate, useRouteError } from 'react-router'
import { useAuth } from './auth/authContext'
import { SignInPage } from './auth/SignInPage'
import { AppShell } from './layout/AppShell'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { MyWorkPage } from './pages/MyWorkPage'

const useStyles = makeStyles({
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', gap: '12px', textAlign: 'center' },
})

function PageLoading() {
  const styles = useStyles()
  return (
    <div className={styles.center}>
      <Spinner label="Loading…" />
    </div>
  )
}

/** Shown if a screen fails unexpectedly, instead of a blank page. */
function ErrorPage() {
  const styles = useStyles()
  const error = useRouteError()
  console.error(error)
  return (
    <div className={styles.center}>
      <div>
        <Text size={500} weight="semibold" block>
          Something went wrong
        </Text>
        <Text block style={{ margin: '8px 0 16px' }}>
          The page hit a problem it couldn’t recover from. Reloading usually fixes it.
        </Text>
        <Button appearance="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>{' '}
        <Button onClick={() => window.location.assign('/')}>Go to My Work</Button>
      </div>
    </div>
  )
}

function NotFoundPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  return (
    <div className={styles.center}>
      <div>
        <Text size={500} weight="semibold" block>
          Page not found
        </Text>
        <Button onClick={() => void navigate('/')}>Go to My Work</Button>
      </div>
    </div>
  )
}

const routes = [
  {
    path: '/',
    element: <AppShell />,
    // Shown while a screen that loads on demand arrives, when the app is opened directly on it.
    hydrateFallbackElement: <PageLoading />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <MyWorkPage /> },
      // The ticket screens load on first visit, keeping the first download small.
      { path: 'tickets', lazy: async () => ({ Component: (await import('./tickets/TicketListPage')).TicketListPage }) },
      {
        path: 'tickets/new',
        lazy: async () => ({ Component: (await import('./tickets/NewTicketPage')).NewTicketPage }),
      },
      {
        path: 'tickets/:number',
        lazy: async () => ({ Component: (await import('./tickets/TicketDetailPage')).TicketDetailPage }),
      },
      { path: 'applications', element: <ApplicationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

const router = createBrowserRouter(routes)

export default function App() {
  const styles = useStyles()
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className={styles.center}>
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (status !== 'signedIn') return <SignInPage />
  return <RouterProvider router={router} />
}
