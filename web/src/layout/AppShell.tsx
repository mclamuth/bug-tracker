import {
  Avatar,
  Button,
  Caption1,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SearchBox,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  Add20Regular,
  Apps20Regular,
  ChevronDown16Regular,
  Home20Regular,
  PersonSwap20Regular,
  SignOut20Regular,
  TaskListLtr20Regular,
} from '@fluentui/react-icons'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useMe } from '../api/queries'
import { roleLabel } from '../api/types'
import { useAuth } from '../auth/authContext'
import { AppLauncher } from './AppLauncher'

const TOP_BAR = '64px'
const SIDEBAR = '232px'

const useStyles = makeStyles({
  topBar: {
    position: 'fixed',
    inset: `0 0 auto 0`,
    height: TOP_BAR,
    zIndex: 30,
    display: 'grid',
    gridTemplateColumns: '1fr minmax(240px, 500px) 1fr',
    alignItems: 'center',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  topLeft: { display: 'flex', alignItems: 'center', height: TOP_BAR },
  appName: { padding: '0 18px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  search: {
    width: '100%',
    // Stay white on the blue bar, including while search is switched off.
    backgroundColor: tokens.colorNeutralBackground1,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1 },
  },
  topRight: { justifySelf: 'end', paddingRight: '16px' },
  userButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    height: '48px',
    ':hover': { backgroundColor: 'rgba(255,255,255,.12)', color: tokens.colorNeutralForegroundOnBrand },
    ':hover:active': { backgroundColor: 'rgba(255,255,255,.2)', color: tokens.colorNeutralForegroundOnBrand },
  },
  userText: { display: 'grid', textAlign: 'left', lineHeight: '1.2', marginLeft: '6px' },
  userRole: { color: 'rgba(255,255,255,.8)' },
  sidebar: {
    position: 'fixed',
    inset: `${TOP_BAR} auto 0 0`,
    width: SIDEBAR,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '4px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  newTicket: { marginBottom: '16px', width: '100%' },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground2,
    textDecoration: 'none',
    position: 'relative',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    '&.active': {
      color: tokens.colorBrandForeground1,
      backgroundColor: tokens.colorBrandBackground2,
      fontWeight: tokens.fontWeightSemibold,
    },
    '&.active::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      width: '3px',
      height: '20px',
      borderRadius: '3px',
      backgroundColor: tokens.colorBrandBackground,
    },
  },
  sidebarFoot: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    display: 'grid',
  },
  main: {
    marginLeft: SIDEBAR,
    paddingTop: TOP_BAR,
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  loading: { minHeight: '100vh', display: 'grid', placeItems: 'center' },
})

/** The signed-in frame: blue top bar with the app launcher, search and user menu, plus the left navigation. */
export function AppShell() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { mode, signOut } = useAuth()
  const me = useMe()

  // A stale development sign-in (e.g. the database was reset) comes back as 401: start over.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) void signOut()
  }, [me.error, signOut])

  if (me.isPending) {
    return (
      <div className={styles.loading}>
        <Spinner label="Signing in…" />
      </div>
    )
  }
  if (me.isError) {
    return (
      <div className={styles.loading}>
        <Text>Couldn’t load your profile: {me.error.message}</Text>
      </div>
    )
  }

  const user = me.data

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <AppLauncher />
          <span className={styles.appName}>ISSD Bug Tracker</span>
        </div>
        <SearchBox
          className={styles.search}
          placeholder="Search tickets by number or title"
          aria-label="Search tickets"
          disabled
          title="Ticket search arrives with the ticket list (Milestone 3)"
        />
        <div className={styles.topRight}>
          <Menu positioning="below-end">
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="transparent"
                className={styles.userButton}
                icon={<Avatar name={user.displayName} size={32} color="neutral" />}
                iconPosition="before"
              >
                <span className={styles.userText}>
                  <Text weight="semibold">{user.displayName}</Text>
                  <Caption1 className={styles.userRole}>{roleLabel(user)}</Caption1>
                </span>
                <ChevronDown16Regular />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {mode === 'Development' && (
                  <MenuItem
                    icon={<PersonSwap20Regular />}
                    onClick={() => {
                      // A different person sees a different dashboard, so start from My Work.
                      void navigate('/')
                      void signOut()
                    }}
                  >
                    Switch user
                  </MenuItem>
                )}
                {mode === 'Development' && <MenuDivider />}
                <MenuItem icon={<SignOut20Regular />} onClick={() => void signOut()}>
                  Sign out
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </header>

      <nav className={styles.sidebar} aria-label="Main navigation">
        <Button
          appearance="primary"
          size="large"
          icon={<Add20Regular />}
          className={styles.newTicket}
          onClick={() => void navigate('/tickets/new')}
        >
          New Ticket
        </Button>
        <NavLink to="/" end className={styles.navLink}>
          <Home20Regular /> My Work
        </NavLink>
        <NavLink to="/tickets" end className={styles.navLink}>
          <TaskListLtr20Regular /> All Tickets
        </NavLink>
        <NavLink to="/applications" className={styles.navLink}>
          <Apps20Regular /> Applications
        </NavLink>
        <div className={styles.sidebarFoot}>
          <Caption1>ISSD internal tools</Caption1>
          <Caption1>CTA · Information Systems &amp; Services Division</Caption1>
        </div>
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}
