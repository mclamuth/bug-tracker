import {
  Button,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Skeleton,
  SkeletonItem,
  Text,
  tokens,
} from '@fluentui/react-components'
import { ArrowLeft16Regular, Checkmark16Regular, Edit16Regular, Warning16Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useTicket, useTicketHistory, useTransitionTicket, useUpdateTicket } from '../api/queries'
import type { TicketDetailDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { usePageStyles } from '../components/pageStyles'
import { ActivityFeed } from './ActivityFeed'
import { AssignDialog } from './AssignDialog'
import { AttachmentList } from './AttachmentList'
import { DetailsPanel } from './DetailsPanel'
import { problemText, saveTicket, tryTicketChange } from './saveTicket'
import { StatusDialog } from './StatusDialog'
import { StatusBadge, TypeIcon } from './TicketBits'
import { canAssign, ticketActions, type StatusDialogKind, type TicketAction } from './workflow'

const useStyles = makeStyles({
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    paddingBottom: '12px',
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  banner: { marginBottom: '12px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '20px 22px',
    marginBottom: '16px',
  },
  heading: { flex: 1, minWidth: 0 },
  actions: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    paddingTop: '2px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  actionError: {
    flexBasis: '100%',
    textAlign: 'right',
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  metaNumber: { color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightSemibold },
  titleLine: { display: 'flex', alignItems: 'center', gap: '6px' },
  title: { margin: '8px 0 7px', fontSize: '22px', lineHeight: 1.35, fontWeight: 650 },
  titleEdit: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0 7px' },
  titleInput: { flex: 1, fontSize: '18px' },
  sub: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  appLink: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold, textDecoration: 'none' },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, .75fr)',
    gap: '16px',
    alignItems: 'start',
    '@media (max-width: 1150px)': { gridTemplateColumns: 'minmax(0, 1.5fr) 300px' },
  },
  main: { overflow: 'hidden' },
  section: { padding: '21px 24px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  sectionTitle: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  text: {
    margin: '9px 0 0',
    lineHeight: 1.65,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  calledIn: {
    margin: '10px 0 12px',
    padding: '8px 10px',
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: '#f3f8fc',
    color: tokens.colorNeutralForeground2,
  },
  compare: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  compareCell: { padding: '20px 24px' },
  actual: { backgroundColor: '#fffaf0', borderLeft: `1px solid ${tokens.colorNeutralStroke3}` },
  compareTitle: { margin: '0 0 8px', fontSize: '13px', fontWeight: tokens.fontWeightSemibold },
  compareText: {
    margin: 0,
    lineHeight: 1.55,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  none: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
  notFound: { padding: '48px 24px', display: 'grid', justifyItems: 'center', gap: '10px', textAlign: 'center' },
})

type OpenDialog = { kind: 'assign' } | { kind: 'status'; dialog: StatusDialogKind } | null

/** One ticket: what was reported, its files, the activity feed and the editable details. */
export function TicketDetailPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const location = useLocation()
  const number = Number(useParams().number)
  const ticket = useTicket(number)
  const history = useTicketHistory(number)
  const [conflict, setConflict] = useState(false)
  const [dialog, setDialog] = useState<OpenDialog>(null)

  // Back to the list as it was left (filters, sort, page), when we came from it.
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? ''
  const backLink = (
    <Link to={`/tickets${listSearch}`} className={styles.back}>
      <ArrowLeft16Regular /> All Tickets
    </Link>
  )

  if (ticket.isPending) {
    return (
      <div className={page.page}>
        {backLink}
        <LoadingTicket />
      </div>
    )
  }

  if (ticket.isError) {
    const missing = ticket.error instanceof ApiError && ticket.error.status === 404
    return (
      <div className={page.page}>
        {backLink}
        <section className={mergeClasses(page.panel, styles.notFound)}>
          <Text as="h1" size={500} weight="semibold">
            {missing ? `BT-${number} doesn’t exist` : 'Couldn’t load this ticket'}
          </Text>
          <Text className={styles.none}>
            {missing ? 'Check the ticket number, or find it from the ticket list.' : ticket.error.message}
          </Text>
        </section>
      </div>
    )
  }

  const t = ticket.data
  const reload = () => {
    setConflict(false)
    void ticket.refetch()
    void history.refetch()
  }

  return (
    <div className={page.page}>
      {backLink}

      {conflict && (
        <MessageBar intent="warning" className={styles.banner}>
          <MessageBarBody>
            <MessageBarTitle>Someone else updated this ticket.</MessageBarTitle>
            Reload to see the latest changes, then make your edit again.
          </MessageBarBody>
          <MessageBarActions>
            <Button onClick={reload}>Reload</Button>
          </MessageBarActions>
        </MessageBar>
      )}

      {/* Keyed by version, so a successful save or a reload closes any open edit. */}
      <TicketHeader
        key={`h-${t.rowVersion}`}
        ticket={t}
        onConflict={() => setConflict(true)}
        onDialog={(d) => setDialog(d === 'assign' ? { kind: 'assign' } : { kind: 'status', dialog: d })}
      />

      <div className={styles.layout}>
        <div className={mergeClasses(page.panel, styles.main)}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            {t.endUserName && (
              <p className={mergeClasses(styles.text, styles.calledIn)}>
                <strong>Called in by:</strong> {t.endUserName}
              </p>
            )}
            <p className={styles.text}>{t.description}</p>
          </section>

          {t.type === 'Defect' && t.stepsToReproduce && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Steps to reproduce</h2>
              <p className={styles.text}>{t.stepsToReproduce}</p>
            </section>
          )}

          {t.type === 'Defect' && (t.expectedResult || t.actualResult) && (
            <section className={styles.compare}>
              <Compare title="Expected result" text={t.expectedResult} />
              <Compare title="Actual result" text={t.actualResult} actual />
            </section>
          )}

          <AttachmentList ticketNumber={t.number} attachments={t.attachments} />

          <ActivityFeed ticket={t} history={history.data ?? []} historyLoading={history.isPending} />
        </div>

        <DetailsPanel
          key={`d-${t.rowVersion}`}
          ticket={t}
          onConflict={() => setConflict(true)}
          onAssign={canAssign(t.statusId) ? () => setDialog({ kind: 'assign' }) : undefined}
        />
      </div>

      {dialog?.kind === 'assign' && (
        <AssignDialog ticket={t} onClose={() => setDialog(null)} onConflict={() => setConflict(true)} />
      )}
      {dialog?.kind === 'status' && (
        <StatusDialog
          kind={dialog.dialog}
          ticket={t}
          onClose={() => setDialog(null)}
          onConflict={() => setConflict(true)}
        />
      )}
    </div>
  )
}

function Compare({ title, text, actual = false }: { title: string; text: string | null; actual?: boolean }) {
  const styles = useStyles()
  return (
    <div className={mergeClasses(styles.compareCell, actual && styles.actual)}>
      <h3 className={styles.compareTitle}>{title}</h3>
      <p className={mergeClasses(styles.compareText, !text && styles.none)}>{text ?? 'Not provided'}</p>
    </div>
  )
}

/** Type, number, title (editable in place), status and application, with the next steps in the workflow. */
function TicketHeader({
  ticket: t,
  onConflict,
  onDialog,
}: {
  ticket: TicketDetailDto
  onConflict: () => void
  onDialog: (dialog: StatusDialogKind | 'assign') => void
}) {
  const page = usePageStyles()
  const styles = useStyles()
  const notify = useNotify()
  const update = useUpdateTicket(t.number)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(t.title)

  const save = async () => {
    const next = title.trim()
    if (!next || next === t.title) {
      setEditing(false)
      return
    }
    const ok = await saveTicket(update.mutateAsync, { rowVersion: t.rowVersion, title: next }, onConflict)
    if (ok) notify('Title updated')
  }

  return (
    <header className={mergeClasses(page.panel, styles.header)}>
      <div className={styles.heading}>
        <div className={styles.meta}>
          <TypeIcon type={t.type} small />
          <span>{t.type}</span>
          <span aria-hidden>•</span>
          <span className={styles.metaNumber}>{t.displayNumber}</span>
        </div>
        {editing ? (
          <form
            className={styles.titleEdit}
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Input
              className={styles.titleInput}
              value={title}
              onChange={(_, d) => setTitle(d.value)}
              maxLength={200}
              aria-label="Title"
              autoFocus
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            />
            <Button appearance="primary" type="submit" disabled={update.isPending || !title.trim()}>
              Save
            </Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <div className={styles.titleLine}>
            <h1 className={styles.title}>{t.title}</h1>
            <Button
              appearance="subtle"
              icon={<Edit16Regular />}
              aria-label="Edit title"
              title="Edit title"
              onClick={() => setEditing(true)}
            />
          </div>
        )}
        <div className={styles.sub}>
          <StatusBadge name={t.statusName} />
          <span>in</span>
          <Link className={styles.appLink} to={`/tickets?view=all&applicationId=${t.applicationId}`}>
            {t.applicationName}
          </Link>
        </div>
      </div>
      <TicketActions ticket={t} onConflict={onConflict} onDialog={onDialog} />
    </header>
  )
}

/** The workflow buttons for the ticket's status. One-click moves happen here; the rest open a dialog. */
function TicketActions({
  ticket: t,
  onConflict,
  onDialog,
}: {
  ticket: TicketDetailDto
  onConflict: () => void
  onDialog: (dialog: StatusDialogKind | 'assign') => void
}) {
  const styles = useStyles()
  const notify = useNotify()
  const transition = useTransitionTicket(t.number)
  const actions = ticketActions(t)

  const run = async (action: TicketAction) => {
    if (action.kind === 'assign') return onDialog('assign')
    if (action.kind === 'dialog') return onDialog(action.dialog)
    const ok = await tryTicketChange(
      () => transition.mutateAsync({ toStatusId: action.toStatusId, rowVersion: t.rowVersion }),
      onConflict,
    )
    if (ok) notify(action.done)
  }

  if (actions.length === 0) return null
  const error = problemText(transition.error)
  return (
    <div className={styles.actions} role="group" aria-label="Workflow">
      {actions.map((action, i) => (
        <Button
          key={action.label}
          appearance={i === 0 ? 'primary' : 'secondary'}
          icon={
            action.label === 'Mark Verified' ? (
              <Checkmark16Regular />
            ) : action.label === 'Reopen' && actions.length > 1 ? (
              <Warning16Regular />
            ) : undefined
          }
          disabled={transition.isPending}
          onClick={() => void run(action)}
        >
          {action.label}
        </Button>
      ))}
      {error && <span className={styles.actionError}>{error}</span>}
    </div>
  )
}

function LoadingTicket() {
  const page = usePageStyles()
  const styles = useStyles()
  return (
    <Skeleton aria-label="Loading ticket">
      <div className={mergeClasses(page.panel, styles.header)} style={{ display: 'grid', gap: 14 }}>
        <SkeletonItem style={{ width: '20%' }} />
        <SkeletonItem size={24} style={{ width: '70%' }} />
        <SkeletonItem style={{ width: '25%' }} />
      </div>
      <div className={styles.layout}>
        <div className={page.panel} style={{ display: 'grid', gap: 18, padding: 24 }}>
          <SkeletonItem style={{ width: '30%' }} />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem style={{ width: '60%' }} />
        </div>
        <div className={page.panel} style={{ display: 'grid', gap: 18, padding: 18 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      </div>
    </Skeleton>
  )
}
