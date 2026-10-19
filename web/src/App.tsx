import { Button, makeStyles, Spinner, Text } from '@fluentui/react-components'
import { createBrowserRouter, RouterProvider, useNavigate } from 'react-router'
import { useAuth } from './auth/authContext'
import { SignInPage } from './auth/SignInPage'
import { AppShell } from './layout/AppShell'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { MyWorkPage } from './pages/MyWorkPage'

const useStyles = makeStyles({
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', gap: '12px', textAlign: 'center' },
})

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
