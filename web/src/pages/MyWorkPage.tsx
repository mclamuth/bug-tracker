import {
  Button,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Tab,
  TabList,
  tokens,
} from '@fluentui/react-components'
import {
  CalendarLtr20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  ChevronUp16Regular,
  Checkmark20Regular,
  TaskListLtr20Regular,
  Warning20Regular,
} from '@fluentui/react-icons'
import { useState } from 'react'
import { Link } from 'react-router'
import { useDashboard, useMe } from '../api/queries'
import type { DashboardDto } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'
import { usePageTitle } from '../components/usePageTitle'
import {
  dashboardRoles,
  rememberedRole,
  rememberRole,
  roleNames,
  summaryCards,
  type DashboardRole,
  type SummaryCard,
  type Tone,
} from '../myWork/dashboard'
import {
  Count,
  MyWorkGroups,
  Panel,
  RecentActivity,
  ReportedList,
  TeamWorkload,
  TestingQueue,
  TriageQueue,
  ViewAll,
} from '../myWork/panels'
import { greeting } from '../utils/greeting'

const toneColors: Record<Tone, { color: string; backgroundColor: string }> = {
  blue: { color: '#0f548c', backgroundColor: '#ebf3fc' },
  purple: { color: '#5c2e91', backgroundColor: '#f3e8ff' },
  red: { color: '#b10e1c', backgroundColor: '#fde7e9' },
  amber: { color: '#8a5a00', backgroundColor: '#fff4ce' },
}

const toneIcons: Record<Tone, typeof TaskListLtr20Regular> = {
  blue: TaskListLtr20Regular,
  purple: CalendarLtr20Regular,
  red: Warning20Regular,
  amber: Checkmark20Regular,
}

const useStyles = makeStyles({
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '18px',
    '@media (max-width: 1150px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
  },
  card: {
    display: 'flex',
    // Counts line up across the row even when a note wraps to two lines.
    alignItems: 'flex-start',
    gap: '13px',
    padding: '17px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    backgroundColor: tokens.colorNeutralBackground1,
    color: 'inherit',
    textDecoration: 'none',
    transition: 'box-shadow .15s, transform .15s',
    ':hover': {
      boxShadow: '0 2px 6px rgba(0,0,0,.08)',
      transform: 'translateY(-1px)',
      borderTopColor: '#b4c8dc',
      borderRightColor: '#b4c8dc',
      borderBottomColor: '#b4c8dc',
      borderLeftColor: '#b4c8dc',
    },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}` },
  },
  cardIcon: {
    width: '38px',
    height: '38px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '8px',
  },
  cardText: { display: 'grid', flex: 1, minWidth: 0 },
  cardCount: { fontSize: '25px', lineHeight: 1.05, fontWeight: tokens.fontWeightBold },
  cardLabel: { marginTop: '2px', fontSize: '13px', fontWeight: tokens.fontWeightSemibold },
  cardNote: { marginTop: '4px', color: tokens.colorNeutralForeground3, fontSize: '11px' },
  arrow: { color: '#8a8886', flexShrink: 0, alignSelf: 'center' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.65fr) minmax(310px, .75fr)',
    gap: '18px',
    alignItems: 'start',
  },
  supervisorGrid: {
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(340px, 1fr)',
  },
  stack: { display: 'grid', gap: '18px' },
  roleSwitch: { alignSelf: 'flex-end' },
  otherToggle: { display: 'flex', justifyContent: 'center', marginTop: '24px' },
  others: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '12px' },
  otherLink: { display: 'block', padding: '0 20px 18px' },
  skeletonCard: { height: '84px' },
})

/** The home page: what needs your attention, laid out for your role. */
export function MyWorkPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const me = useMe()
  const dashboard = useDashboard()
  const [now] = useState(() => new Date())
  const roles = me.data ? dashboardRoles(me.data) : []
  const [chosen, setChosen] = useState<DashboardRole | null>(null)
  const role = chosen && roles.includes(chosen) ? chosen : roles.length ? rememberedRole(roles) : null
  const [showOthers, setShowOthers] = useState(false)
  usePageTitle('My Work')

  const choose = (next: DashboardRole) => {
    setChosen(next)
    rememberRole(next)
  }

  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Home / My Work"
        title={`${greeting(now)}, ${me.data?.displayName.split(' ')[0] ?? ''}`}
        description="Here’s what needs your attention today."
        action={
          role && roles.length > 1 ? (
            <TabList
              className={styles.roleSwitch}
              selectedValue={role}
              onTabSelect={(_, d) => choose(d.value as DashboardRole)}
              aria-label="View My Work as"
            >
              {roles.map((r) => (
                <Tab key={r} value={r}>
                  {roleNames[r]}
                </Tab>
              ))}
            </TabList>
          ) : undefined
        }
      />

      {dashboard.isError && (
        <MessageBar intent="error">
          <MessageBarBody>Couldn’t load your work: {dashboard.error.message}</MessageBarBody>
        </MessageBar>
      )}

      {(dashboard.isPending || !role) && !dashboard.isError && <Loading />}

      {dashboard.data && role && (
        <>
          <div className={styles.cards}>
            {summaryCards[role].map((card) => (
              <Card key={card.label} card={card} count={card.count(dashboard.data.counts)} />
            ))}
          </div>

          {role === 'developer' && <DeveloperView data={dashboard.data} />}
          {role === 'ica' && <IcaView data={dashboard.data} />}
          {role === 'supervisor' && <SupervisorView data={dashboard.data} />}

          <div className={styles.otherToggle}>
            <Button
              appearance="transparent"
              icon={showOthers ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
              iconPosition="after"
              aria-expanded={showOthers}
              onClick={() => setShowOthers((v) => !v)}
            >
              Other sections
            </Button>
          </div>
          {showOthers && <OtherSections role={role} data={dashboard.data} />}
        </>
      )}
    </div>
  )
}

function Card({ card, count }: { card: SummaryCard; count: number }) {
  const styles = useStyles()
  const Icon = toneIcons[card.tone]
  return (
    <Link to={card.to} className={styles.card}>
      <span className={styles.cardIcon} style={toneColors[card.tone]} aria-hidden>
        <Icon />
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardCount}>{count}</span> <span className={styles.cardLabel}>{card.label}</span>{' '}
        <span className={styles.cardNote}>{card.note}</span>
      </span>
      <ChevronRight16Regular className={styles.arrow} aria-hidden />
    </Link>
  )
}

function DeveloperView({ data }: { data: DashboardDto }) {
  const styles = useStyles()
  return (
    <div className={styles.grid}>
      <Panel
        title="Assigned to me"
        sub="Your active development work"
        aside={<ViewAll to="/tickets?view=assigned-to-me" />}
      >
        <MyWorkGroups tickets={data.myActive} />
      </Panel>
      <Panel title="Recently updated" sub="Activity across your team">
        <RecentActivity items={data.recentActivity} />
      </Panel>
    </div>
  )
}

function IcaView({ data }: { data: DashboardDto }) {
  const styles = useStyles()
  return (
    <div className={styles.stack}>
      <Panel
        title="Ready for Test"
        sub="Tickets waiting for ICA verification"
        aside={<Count value={data.counts.readyForTest} label="ready for test" />}
      >
        <TestingQueue tickets={data.readyForTest} />
      </Panel>
      <Panel
        title="Reported by me"
        sub="Your open tickets and current status"
        aside={<ViewAll to="/tickets?view=reported-by-me" />}
      >
        <ReportedList tickets={data.reportedByMe} />
      </Panel>
    </div>
  )
}

function SupervisorView({ data }: { data: DashboardDto }) {
  const styles = useStyles()
  return (
    <div className={mergeClasses(styles.grid, styles.supervisorGrid)}>
      <Panel
        title="Needs triage"
        sub="New tickets awaiting review and assignment"
        aside={<Count value={data.counts.needsTriage} label="to triage" />}
      >
        <TriageQueue tickets={data.needsTriage} total={data.counts.needsTriage} />
      </Panel>
      <Panel title="Team workload" sub="Open development work by status">
        <TeamWorkload workload={data.workload} />
      </Panel>
    </div>
  )
}

/** Links to the other roles' queues, for anyone who wants to look across. */
function OtherSections({ role, data }: { role: DashboardRole; data: DashboardDto }) {
  const styles = useStyles()
  const c = data.counts
  const sections = [
    role !== 'developer' && {
      title: 'Developer · Assigned work',
      sub: `${c.activeDevelopment} active ${c.activeDevelopment === 1 ? 'ticket' : 'tickets'} across the developer team`,
      to: '/tickets?sort=assignee&direction=asc',
      link: 'View developer work',
    },
    role !== 'ica' && {
      title: 'ICA · Ready for Test',
      sub: `${c.readyForTest} ${c.readyForTest === 1 ? 'ticket' : 'tickets'} awaiting verification`,
      to: '/tickets?statusId=5',
      link: 'View testing queue',
    },
    role !== 'supervisor' && {
      title: 'Supervisor · Needs triage',
      sub: `${c.needsTriage} new ${c.needsTriage === 1 ? 'ticket' : 'tickets'}`,
      to: '/tickets?statusId=1&sort=created&direction=asc',
      link: 'View triage queue',
    },
  ].filter((s) => s !== false)

  return (
    <div className={styles.others}>
      {sections.map((s) => (
        <Panel key={s.title} title={s.title} sub={s.sub}>
          <div className={styles.otherLink}>
            <ViewAll to={s.to} label={s.link} />
          </div>
        </Panel>
      ))}
    </div>
  )
}

function Loading() {
  const page = usePageStyles()
  const styles = useStyles()
  return (
    <Skeleton aria-label="Loading your work">
      <div className={styles.cards}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={mergeClasses(page.panel, styles.skeletonCard)}
            style={{ padding: 17, display: 'grid', gap: 10 }}
          >
            <SkeletonItem size={24} style={{ width: '30%' }} />
            <SkeletonItem style={{ width: '70%' }} />
          </div>
        ))}
      </div>
      <div className={styles.grid}>
        <div className={page.panel} style={{ display: 'grid', gap: 16, padding: 20 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
        <div className={page.panel} style={{ display: 'grid', gap: 16, padding: 20 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      </div>
    </Skeleton>
  )
}
