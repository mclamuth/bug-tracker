import {
  Button,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Select,
  Text,
  tokens,
} from '@fluentui/react-components'
import { CalendarLtr16Regular, Edit16Regular } from '@fluentui/react-icons'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { useApplications, useUpdateTicket } from '../api/queries'
import type { Priority, Severity, TicketDetailDto, TicketEnvironment, UpdateTicketRequest } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { usePageStyles } from '../components/pageStyles'
import { calendarDate, dateTime, relativeTime } from '../utils/format'
import { environments, priorities, resolutionLabel, severities } from './labels'
import { saveTicket } from './saveTicket'
import { PersonLabel, PriorityTag, SeverityLabel, StatusBadge } from './TicketBits'

const useStyles = makeStyles({
  panel: { paddingBottom: '16px' },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '57px', // the same with or without the edit button
    padding: '12px 12px 12px 18px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  title: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  field: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr',
    gap: '10px',
    alignItems: 'center',
    minHeight: '42px',
    padding: '5px 18px',
    fontSize: '13px',
    '@media (max-width: 1150px)': { gridTemplateColumns: '90px 1fr' },
  },
  label: { color: tokens.colorNeutralForeground3 },
  value: { minWidth: 0 },
  control: { width: '100%' },
  withIcon: { display: 'flex', alignItems: 'center', gap: '6px' },
  none: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
  link: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold, textDecoration: 'none' },
  divider: { margin: '8px 18px', borderTop: `1px solid ${tokens.colorNeutralStroke3}` },
  error: { margin: '8px 18px 0' },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '7px',
    marginTop: '12px',
    padding: '13px 18px 0',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
})

interface Draft {
  applicationId: string
  severity: Severity | ''
  priority: Priority
  environment: TicketEnvironment | ''
  dueDate: string
}

const draftFrom = (t: TicketDetailDto): Draft => ({
  applicationId: String(t.applicationId),
  severity: t.severity ?? '',
  priority: t.priority,
  environment: t.environment ?? '',
  dueDate: t.dueDate ?? '',
})

/** The right-hand Details panel. The pencil switches the editable fields to inputs. */
export function DetailsPanel({ ticket: t, onConflict }: { ticket: TicketDetailDto; onConflict: () => void }) {
  const page = usePageStyles()
  const styles = useStyles()
  const notify = useNotify()
  const applications = useApplications()
  const update = useUpdateTicket(t.number)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => draftFrom(t))

  const isDefect = t.type === 'Defect'
  // Active applications, plus the current one even if it has since been switched off.
  const appOptions = (applications.data ?? []).filter((a) => a.isActive || a.id === t.applicationId)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const cancel = () => {
    setDraft(draftFrom(t))
    setEditing(false)
    update.reset()
  }

  const save = async () => {
    const request: UpdateTicketRequest = { rowVersion: t.rowVersion }
    const before = draftFrom(t)
    if (draft.applicationId !== before.applicationId) request.applicationId = Number(draft.applicationId)
    if (draft.priority !== before.priority) request.priority = draft.priority
    if (draft.dueDate !== before.dueDate) request.dueDate = draft.dueDate || null
    if (isDefect && draft.severity !== before.severity) request.severity = draft.severity || null
    if (isDefect && draft.environment !== before.environment) request.environment = draft.environment || null
    if (Object.keys(request).length === 1) {
      setEditing(false) // nothing changed
      return
    }
    // On success the page re-renders this panel with the new version, which closes the editor.
    if (await saveTicket(update.mutateAsync, request, onConflict)) notify('Ticket details updated')
  }

  const validation =
    update.error instanceof ApiError && update.error.status === 400
      ? Object.values(update.error.fieldErrors).join(' ') || update.error.message
      : update.error && !(update.error instanceof ApiError && update.error.status === 409)
        ? update.error.message
        : null

  return (
    <aside className={mergeClasses(page.panel, styles.panel)} aria-label="Details">
      <div className={styles.head}>
        <h2 className={styles.title}>Details</h2>
        {!editing && (
          <Button
            appearance="subtle"
            icon={<Edit16Regular />}
            aria-label="Edit details"
            title="Edit details"
            onClick={() => setEditing(true)}
          />
        )}
      </div>

      <Row label="Status">
        <StatusBadge name={t.statusName} />
      </Row>
      {t.resolution && <Row label="Resolution">{resolutionLabel(t.resolution)}</Row>}
      {t.duplicateOfNumber && (
        <Row label="Duplicate of">
          <Link className={styles.link} to={`/tickets/${t.duplicateOfNumber}`}>
            BT-{t.duplicateOfNumber}
          </Link>
        </Row>
      )}
      <Row label="Assignee">
        <PersonLabel person={t.assignee} />
      </Row>
      <Row label="Application">
        {editing ? (
          <Select
            className={styles.control}
            size="small"
            aria-label="Application"
            value={draft.applicationId}
            onChange={(_, d) => set('applicationId', d.value)}
          >
            {appOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        ) : (
          <Link className={styles.link} to={`/tickets?view=all&applicationId=${t.applicationId}`}>
            {t.applicationName}
          </Link>
        )}
      </Row>
      {isDefect && (
        <Row label="Severity">
          {editing ? (
            <Select
              className={styles.control}
              size="small"
              aria-label="Severity"
              value={draft.severity}
              onChange={(_, d) => set('severity', d.value as Severity)}
            >
              {severities.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <SeverityLabel severity={t.severity} />
          )}
        </Row>
      )}
      <Row label="Priority">
        {editing ? (
          <Select
            className={styles.control}
            size="small"
            aria-label="Priority"
            value={draft.priority}
            onChange={(_, d) => set('priority', d.value as Priority)}
          >
            {priorities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : (
          <PriorityTag priority={t.priority} />
        )}
      </Row>
      {isDefect && (
        <Row label="Environment">
          {editing ? (
            <Select
              className={styles.control}
              size="small"
              aria-label="Environment"
              value={draft.environment}
              onChange={(_, d) => set('environment', d.value as TicketEnvironment | '')}
            >
              <option value="">Not specified</option>
              {environments.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            (t.environment ?? <span className={styles.none}>Not specified</span>)
          )}
        </Row>
      )}
      <Row label="Due date">
        {editing ? (
          <Input
            className={styles.control}
            size="small"
            type="date"
            aria-label="Due date"
            value={draft.dueDate}
            onChange={(_, d) => set('dueDate', d.value)}
          />
        ) : t.dueDate ? (
          <span className={styles.withIcon}>
            <CalendarLtr16Regular />
            {calendarDate(t.dueDate)}
          </span>
        ) : (
          <span className={styles.none}>None</span>
        )}
      </Row>

      <div className={styles.divider} />

      <Row label="Reported by">
        <PersonLabel person={t.reporter} emptyText="Unknown" />
      </Row>
      <Row label="Created">{dateTime(t.createdAt)}</Row>
      <Row label="Last updated">
        <span title={dateTime(t.updatedAt)}>{relativeTime(t.updatedAt)}</span>
      </Row>
      {t.closedAt && <Row label="Closed">{dateTime(t.closedAt)}</Row>}

      {editing && validation && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>{validation}</MessageBarBody>
        </MessageBar>
      )}
      {editing && (
        <div className={styles.actions}>
          <Button onClick={cancel} disabled={update.isPending}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={() => void save()} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </aside>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles()
  return (
    <div className={styles.field}>
      <Text className={styles.label}>{label}</Text>
      <div className={styles.value}>{children}</div>
    </div>
  )
}
