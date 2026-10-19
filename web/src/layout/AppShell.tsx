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
import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useMe, useTicketCounts } from '../api/queries'
import { roleLabel } from '../api/types'
import { useAuth } from '../auth/authContext'
import { BrandLogo } from '../components/BrandLogo'
import { AppLauncher } from './AppLauncher'

const TOP_BAR = '64px'
const SEARCH_BAR = '52px'
const SIDEBAR = '232px'

const useStyles = makeStyles({
  topBar: {
    position: 'fixed',
    inset: `0 0 auto 0`,
    height: TOP_BAR,
    zIndex: 30,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  topLeft: { display: 'flex', alignItems: 'center', height: TOP_BAR },
  appName: { padding: '0 18px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  logo: { display: 'flex', alignItems: 'center' },
  searchBar: {
    position: 'fixed',
    top: TOP_BAR,
    left: SIDEBAR,
    right: 0,
    height: SEARCH_BAR,
    zIndex: 15,
    display: 'flex',
    alignItems: 'center',
    padding: '0 32px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  searchForm: { width: 'min(520px, 48vw)' },
  search: {
    width: '100%',
    maxWidth: 'none',
    // Light grey field, as in the design; white while typing.
    backgroundColor: tokens.colorNeutralBackground3,
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
    ':focus-within': { backgroundColor: tokens.colorNeutralBackground1 },
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
  userAvatar: { backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorBrandForeground1 },
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
  navCount: { marginLeft: 'auto', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  sidebarFoot: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    display: 'grid',
  },
  main: {
    marginLeft: SIDEBAR,
    paddingTop: `calc(${TOP_BAR} + ${SEARCH_BAR})`,
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
  const counts = useTicketCounts()
  const { pathname } = useLocation()
  const [search, setSearch] = useState('')

  /** "BT-1042" opens that ticket; anything else searches all tickets by number, title and description. */
  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const term = search.trim()
    if (!term) return
    const ticket = /^BT-?(\d{1,9})$/i.exec(term)
    void navigate(ticket ? `/tickets/${ticket[1]}` : `/tickets?${new URLSearchParams({ view: 'all', search: term })}`)
    setSearch('')
  }

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
        <div className={styles.logo}>
          <BrandLogo variant="white" width={178} />
        </div>
        <div className={styles.topRight}>
          <Menu positioning="below-end">
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="transparent"
                className={styles.userButton}
                icon={<Avatar name={user.displayName} size={32} initials={{ className: styles.userAvatar }} />}
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

      <div className={styles.searchBar}>
        <form role="search" className={styles.searchForm} onSubmit={onSearch}>
          <SearchBox
            className={styles.search}
            placeholder="Search tickets by number or title"
            aria-label="Search all tickets"
            value={search}
            onChange={(_, d) => setSearch(d.value)}
          />
        </form>
      </div>

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
        <NavLink
          to="/tickets"
          // Ticket pages count as All Tickets, except the new ticket form (it has its own button).
          className={({ isActive }) => `${styles.navLink}${isActive && pathname !== '/tickets/new' ? ' active' : ''}`}
        >
          <TaskListLtr20Regular /> All Tickets
          {counts.data && (
            <span className={styles.navCount} title="Open tickets">
              {counts.data.open}
            </span>
          )}
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
