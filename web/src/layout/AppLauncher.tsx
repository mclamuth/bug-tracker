import {
  Button,
  Caption1,
  Link,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SearchBox,
  shorthands,
  Spinner,
  Subtitle1,
  Text,
  tokens,
  Tooltip,
} from '@fluentui/react-components'
import { AppGeneric24Regular, ArrowRight16Regular, Dismiss20Regular } from '@fluentui/react-icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApplications } from '../api/queries'
import { launcherApps } from './launcherApps'

const SEARCH_THRESHOLD = 9

const useStyles = makeStyles({
  trigger: {
    width: '55px',
    height: '56px',
    minWidth: '55px',
    borderRadius: 0,
    color: tokens.colorNeutralForegroundOnBrand,
    position: 'relative',
    // A short divider between the launcher and the app name, as in the CTA Training app.
    '::after': {
      content: '""',
      position: 'absolute',
      right: 0,
      top: '16px',
      height: '24px',
      width: '1px',
      backgroundColor: 'rgba(255,255,255,.4)',
    },
    ':hover': { backgroundColor: 'rgba(255,255,255,.12)', color: tokens.colorNeutralForegroundOnBrand },
    ':hover:active': { backgroundColor: 'rgba(255,255,255,.2)', color: tokens.colorNeutralForegroundOnBrand },
  },
  surface: { width: '360px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
    maxHeight: '380px',
    overflowY: 'auto',
  },
  tile: {
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '8px',
    minHeight: '92px',
    padding: '8px 4px',
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    textDecoration: 'none',
    border: '1px solid transparent',
    ':hover': { backgroundColor: tokens.colorBrandBackground2, ...shorthands.borderColor(tokens.colorBrandStroke2) },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  tileIcon: {
    width: '34px',
    height: '34px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  tileName: { fontSize: tokens.fontSizeBase200, lineHeight: '1.25', fontWeight: tokens.fontWeightSemibold },
  empty: { color: tokens.colorNeutralForeground3, padding: '12px 4px' },
  manage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '10px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    fontWeight: tokens.fontWeightSemibold,
  },
})

/** Nine square dots, as in the CTA Training app's launcher. */
function WaffleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false">
      {[0, 6, 12].flatMap((y) => [0, 6, 12].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />))}
    </svg>
  )
}

/** The waffle button in the top bar: shortcuts to CTA's internal applications. */
export function AppLauncher() {
  const styles = useStyles()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const apps = useApplications()

  const withLinks = useMemo(() => launcherApps(apps.data ?? [], ''), [apps.data])
  const visible = useMemo(() => launcherApps(apps.data ?? [], search), [apps.data, search])

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)} positioning="below-start" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip content="CTA applications" relationship="label">
          <Button appearance="transparent" className={styles.trigger} icon={<WaffleIcon />} />
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface} aria-label="CTA applications">
        <div className={styles.head}>
          <Subtitle1 as="h2">CTA applications</Subtitle1>
          <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close" onClick={() => setOpen(false)} />
        </div>

        {withLinks.length > SEARCH_THRESHOLD && (
          <SearchBox
            placeholder="Search applications"
            value={search}
            onChange={(_, data) => setSearch(data.value)}
            aria-label="Search applications"
          />
        )}

        {apps.isPending && <Spinner size="small" label="Loading applications…" />}

        {apps.isSuccess && withLinks.length === 0 && (
          <Text className={styles.empty}>
            No applications have a launcher link yet. Add links on the Applications page.
          </Text>
        )}

        {visible.length > 0 && (
          <div className={styles.grid}>
            {visible.map((app) => (
              <a
                key={app.id}
                className={styles.tile}
                href={app.launcherUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <span className={styles.tileIcon}>
                  <AppGeneric24Regular />
                </span>
                <span className={styles.tileName}>{app.name}</span>
              </a>
            ))}
          </div>
        )}

        {withLinks.length > 0 && visible.length === 0 && (
          <Caption1 className={styles.empty}>No applications match “{search}”.</Caption1>
        )}

        <Link
          className={styles.manage}
          onClick={() => {
            setOpen(false)
            void navigate('/applications')
          }}
        >
          Manage applications <ArrowRight16Regular />
        </Link>
      </PopoverSurface>
    </Popover>
  )
}
