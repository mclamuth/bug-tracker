import { Button, mergeClasses, Spinner, Text } from '@fluentui/react-components'
import { ArrowRight16Regular, ChevronRight16Regular } from '@fluentui/react-icons'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTicket } from '../api/queries'
import type { ActivityDto, TicketListItemDto, WorkloadDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { usePageStyles } from '../components/pageStyles'
import { PersonAvatar } from '../components/PersonAvatar'
import { AssignDialog } from '../tickets/AssignDialog'
import { StatusDialog } from '../tickets/StatusDialog'
import { PriorityTag, SeverityLabel, StatusBadge, TypeIcon } from '../tickets/TicketBits'
import { relativeTime } from '../utils/format'
import { activityWords } from './dashboard'
import { usePanelStyles } from './panelStyles'

export function Panel({
  title,
  sub,
  aside,
  children,
}: {
  title: string
  sub: string
  aside?: ReactNode
  children: ReactNode
}) {
  const page = usePageStyles()
  const styles = usePanelStyles()
  return (
    <section className={mergeClasses(page.panel, styles.panel)} aria-label={title}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          <Text className={styles.sub}>{sub}</Text>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function ViewAll({ to, label = 'View all' }: { to: string; label?: string }) {
  const styles = usePanelStyles()
  return (
    <Link to={to} className={styles.viewAll}>
      {label} <ArrowRight16Regular aria-hidden />
    </Link>
  )
}

export function Count({ value, label }: { value: number; label: string }) {
  const styles = usePanelStyles()
  return (
    <span className={styles.count} aria-label={`${value} ${label}`}>
      {value}
    </span>
  )
}

const ticketPath = (t: { number: number }) => `/tickets/${t.number}`

/** A developer's active work, grouped Reopened → In Progress → Assigned. */
export function MyWorkGroups({ tickets }: { tickets: TicketListItemDto[] }) {
  const styles = usePanelStyles()
  if (tickets.length === 0) {
    return <Text className={styles.empty}>Nothing assigned to you right now.</Text>
  }
  const groups = ['Reopened', 'In Progress', 'Assigned']
    .map((status) => ({ status, items: tickets.filter((t) => t.statusName === status) }))
    .filter((g) => g.items.length > 0)
  return (
    <>
      {groups.map((g) => (
        <div key={g.status} className={styles.group} role="group" aria-label={g.status}>
          <div className={styles.groupLabel}>
            <StatusBadge name={g.status} />
            <span className={styles.muted}>{g.items.length}</span>
          </div>
          {g.items.map((t) => (
            <Link key={t.number} to={ticketPath(t)} className={mergeClasses(styles.row, styles.workRow)}>
              <TypeIcon type={t.type} />
              <span className={styles.ticketTitle}>
                <span className={styles.ellipsis}>{t.title}</span>
                <span className={styles.muted}>
                  {t.displayNumber} · {t.applicationName}
                </span>
              </span>
              <SeverityLabel severity={t.severity} />
              <PriorityTag priority={t.priority} />
              <span className={mergeClasses(styles.muted, styles.hideNarrow)}>{relativeTime(t.updatedAt)}</span>
              <ChevronRight16Regular className={styles.arrow} aria-hidden />
            </Link>
          ))}
        </div>
      ))}
    </>
  )
}

/** Ready for Test, with a "Start testing" link on each. */
export function TestingQueue({ tickets }: { tickets: TicketListItemDto[] }) {
  const styles = usePanelStyles()
  if (tickets.length === 0) {
    return <Text className={styles.empty}>Nothing is waiting for testing.</Text>
  }
  return (
    <div>
      {tickets.map((t) => (
        <Link key={t.number} to={ticketPath(t)} className={mergeClasses(styles.row, styles.testRow)}>
          <TypeIcon type={t.type} />
          <span className={styles.ticketTitle}>
            <span className={styles.ellipsis}>{t.title}</span>
            <span className={styles.muted}>
              {t.displayNumber} · {t.applicationName}
              {t.assignee && ` · Assigned to ${t.assignee.displayName}`}
            </span>
          </span>
          <SeverityLabel severity={t.severity} />
          <span className={styles.startTesting}>
            Start testing <ArrowRight16Regular aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Open tickets the person reported, with their status. */
export function ReportedList({ tickets }: { tickets: TicketListItemDto[] }) {
  const styles = usePanelStyles()
  if (tickets.length === 0) {
    return <Text className={styles.empty}>You have no open tickets.</Text>
  }
  return (
    <div>
      {tickets.map((t) => (
        <Link key={t.number} to={ticketPath(t)} className={mergeClasses(styles.row, styles.reportedRow)}>
          <span className={styles.ticketTitle}>
            <span className={styles.ellipsis}>{t.title}</span>
            <span className={styles.muted}>
              {t.displayNumber} · {t.applicationName} · updated {relativeTime(t.updatedAt).toLowerCase()}
            </span>
          </span>
          <StatusBadge name={t.statusName} />
        </Link>
      ))}
    </div>
  )
}

/** Recent reports, status changes, assignments and comments across the team. */
export function RecentActivity({ items }: { items: ActivityDto[] }) {
  const styles = usePanelStyles()
  if (items.length === 0) {
    return <Text className={styles.empty}>No activity yet.</Text>
  }
  return (
    <div className={styles.activity}>
      {items.map((a, i) => {
        const { before, after } = activityWords(a)
        return (
          <div key={i} className={styles.activityItem}>
            <PersonAvatar name={a.by.displayName} initials={a.by.initials} size={24} />
            <p className={styles.activityText}>
              <strong>{a.by.displayName}</strong> {before}{' '}
              <Link to={`/tickets/${a.ticketNumber}`} className={styles.ticketLink} title={a.ticketTitle}>
                BT-{a.ticketNumber}
              </Link>
              {after && ` ${after}`}
              <small className={styles.activityTime}>{relativeTime(a.at)}</small>
            </p>
          </div>
        )
      })}
    </div>
  )
}

const TRIAGE_SHOWN = 8

/** New tickets, oldest first, with Triage and Won't Fix right here. The oldest eight, then a link to the rest. */
export function TriageQueue({ tickets, total }: { tickets: TicketListItemDto[]; total: number }) {
  const styles = usePanelStyles()
  const [action, setAction] = useState<{ number: number; kind: 'triage' | 'wontfix' } | null>(null)
  if (tickets.length === 0) {
    return <Text className={styles.empty}>Nothing to triage. New tickets show up here.</Text>
  }
  return (
    <div>
      {tickets.slice(0, TRIAGE_SHOWN).map((t) => (
        <div key={t.number} className={styles.triageItem}>
          <Link to={ticketPath(t)} className={styles.triageTicket}>
            <span className={styles.ticketLink}>{t.displayNumber}</span>
            <span className={styles.ticketTitle}>
              <span className={styles.ellipsis}>{t.title}</span>
              <span className={styles.muted}>
                {t.applicationName} · Reported by {t.reporter.displayName} · {relativeTime(t.createdAt).toLowerCase()}
              </span>
            </span>
          </Link>
          <span className={styles.triageActions}>
            <Button appearance="primary" size="small" onClick={() => setAction({ number: t.number, kind: 'triage' })}>
              Triage
            </Button>
            <Button size="small" onClick={() => setAction({ number: t.number, kind: 'wontfix' })}>
              Won’t Fix
            </Button>
          </span>
        </div>
      ))}
      {total > TRIAGE_SHOWN && (
        <div className={styles.more}>
          <ViewAll to="/tickets?statusId=1&sort=created&direction=asc" label={`View all ${total} to triage`} />
        </div>
      )}
      {action && <TicketDialog key={`${action.kind}-${action.number}`} {...action} onClose={() => setAction(null)} />}
    </div>
  )
}

/** Loads the full ticket (for its version and allowed moves), then opens the same dialog as the ticket page. */
function TicketDialog({ number, kind, onClose }: { number: number; kind: 'triage' | 'wontfix'; onClose: () => void }) {
  const notify = useNotify()
  const ticket = useTicket(number)
  const onConflict = () =>
    notify(`BT-${number} was changed by someone else`, {
      intent: 'warning',
      body: 'The list has been refreshed. Try again.',
    })

  const failed = ticket.isError ? ticket.error.message : null
  useEffect(() => {
    if (failed === null) return
    notify(`Couldn’t open BT-${number}`, { intent: 'error', body: failed })
    onClose()
  }, [failed, notify, number, onClose])

  if (ticket.isPending) return <Spinner size="tiny" label={`Opening BT-${number}…`} />
  if (ticket.isError) return null
  return kind === 'triage' ? (
    <AssignDialog ticket={ticket.data} onClose={onClose} onConflict={onConflict} />
  ) : (
    <StatusDialog kind="wontfix" ticket={ticket.data} onClose={onClose} onConflict={onConflict} />
  )
}

/** Each developer's active tickets by status; click one to see their tickets. */
export function TeamWorkload({ workload }: { workload: WorkloadDto[] }) {
  const styles = usePanelStyles()
  return (
    <div>
      {workload.map((w) => {
        const total = w.assigned + w.inProgress + w.reopened
        return (
          <Link
            key={w.developer.id}
            to={`/tickets?assigneeId=${w.developer.id}`}
            className={mergeClasses(styles.row, styles.workload)}
          >
            <PersonAvatar name={w.developer.displayName} initials={w.developer.initials} size={32} />
            <span className={styles.ticketTitle}>
              <span className={styles.ellipsis}>{w.developer.displayName}</span>
              <span className={styles.muted}>
                {total} active {total === 1 ? 'ticket' : 'tickets'}
              </span>
            </span>
            <span className={styles.workloadCounts}>
              <WorkloadCount value={w.assigned} label="Assigned" />
              <WorkloadCount value={w.inProgress} label="In progress" />
              <WorkloadCount value={w.reopened} label="Reopened" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function WorkloadCount({ value, label }: { value: number; label: string }) {
  const styles = usePanelStyles()
  return (
    <span className={styles.workloadCount}>
      {value}
      <small className={styles.tiny}>{label}</small>
    </span>
  )
}
