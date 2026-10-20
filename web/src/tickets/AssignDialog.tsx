import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  mergeClasses,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components'
import { Checkmark16Regular, Dismiss20Regular, Mail16Regular, PersonAdd20Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { useApplications, useAssignTicket, useMe, useTransitionTicket, useUsers } from '../api/queries'
import { roleLabel, type TicketDetailDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { PersonAvatar } from '../components/PersonAvatar'
import { useDialogStyles } from './dialogStyles'
import { StatusIds } from './labels'
import { problemText, tryTicketChange } from './saveTicket'

const useStyles = makeStyles({
  picker: { display: 'grid', gap: '4px', maxHeight: '255px', overflowY: 'auto' },
  developer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '48px',
    padding: '7px 9px',
    border: '1px solid transparent',
    borderRadius: '5px',
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': { backgroundColor: '#f7f7f7' },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}` },
  },
  selected: {
    backgroundColor: '#f3f8fc',
    borderTopColor: '#8ab8dc',
    borderRightColor: '#8ab8dc',
    borderBottomColor: '#8ab8dc',
    borderLeftColor: '#8ab8dc',
    ':hover': { backgroundColor: '#f3f8fc' },
  },
  who: { display: 'grid', gap: '2px', flex: 1 },
  current: { color: tokens.colorNeutralForeground3, fontSize: '11px' },
  check: { color: tokens.colorBrandForeground1 },
  note: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '9px 10px',
    borderRadius: '5px',
    backgroundColor: '#f3f8fc',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  backlog: {
    justifySelf: 'start',
    padding: 0,
    minWidth: 0,
    color: tokens.colorBrandForeground1,
    ':hover': { color: tokens.colorBrandForeground2, textDecoration: 'underline' },
  },
})

/**
 * Pick the developer for a ticket. On a New ticket this is Ken's triage step, with the option to park it
 * in the backlog (Triaged) instead. Tickets already being worked keep their status and just change hands.
 */
export function AssignDialog({
  ticket,
  onClose,
  onConflict,
}: {
  ticket: TicketDetailDto
  onClose: () => void
  onConflict: () => void
}) {
  const styles = useStyles()
  const dialog = useDialogStyles()
  const notify = useNotify()
  const me = useMe()
  const developers = useUsers('developer')
  const applications = useApplications()
  const assign = useAssignTicket(ticket.number)
  const transition = useTransitionTicket(ticket.number)

  const appDefault = applications.data?.find((a) => a.id === ticket.applicationId)?.defaultAssigneeId
  const fallback = ticket.assignee?.id ?? appDefault ?? developers.data?.[0]?.id ?? null
  const [chosen, setChosen] = useState<number | null>(null)
  const selectedId = chosen ?? fallback
  const selected = developers.data?.find((d) => d.id === selectedId)
  const [comment, setComment] = useState('')

  const isNew = ticket.statusId === StatusIds.New
  const canBacklog = isNew && ticket.allowedTransitions.some((t) => t.toStatusId === StatusIds.Triaged)
  const unchanged = selectedId === ticket.assignee?.id && !comment.trim()
  const busy = assign.isPending || transition.isPending
  const conflict = () => {
    onClose()
    onConflict()
  }

  const confirm = async () => {
    if (!selectedId) return
    const ok = await tryTicketChange(
      () =>
        assign.mutateAsync({ assigneeId: selectedId, comment: comment.trim() || null, rowVersion: ticket.rowVersion }),
      conflict,
    )
    if (ok) {
      notify(`Ticket assigned to ${selected?.displayName ?? 'the developer'}`, {
        body: selectedId === me.data?.id ? undefined : 'They’ve been emailed.',
      })
      onClose()
    }
  }

  const moveToBacklog = async () => {
    const ok = await tryTicketChange(
      () =>
        transition.mutateAsync({
          toStatusId: StatusIds.Triaged,
          comment: comment.trim() || null,
          rowVersion: ticket.rowVersion,
        }),
      conflict,
    )
    if (ok) {
      notify('Ticket moved to the backlog', { body: 'It’s triaged and waiting for a developer.' })
      onClose()
    }
  }

  const error = problemText(assign.error) ?? problemText(transition.error)

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={dialog.surface}>
        <DialogBody>
          <DialogTitle
            action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />}
          >
            <span className={dialog.title}>
              <span className={dialog.icon} aria-hidden>
                <PersonAdd20Regular />
              </span>
              {isNew ? 'Triage and assign' : ticket.assignee ? 'Reassign ticket' : 'Assign ticket'}
            </span>
          </DialogTitle>
          <DialogContent className={dialog.content}>
            <div className={styles.picker} role="radiogroup" aria-label="Developer">
              {(developers.data ?? []).map((d) => {
                const isSelected = d.id === selectedId
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={mergeClasses(styles.developer, isSelected && styles.selected)}
                    onClick={() => setChosen(d.id)}
                  >
                    <PersonAvatar name={d.displayName} initials={d.initials} size={32} />
                    <span className={styles.who}>
                      <Text weight="semibold">{d.displayName}</Text>
                      <Text size={200} className={dialog.muted}>
                        {roleLabel(d)}
                      </Text>
                    </span>
                    {d.id === ticket.assignee?.id && <span className={styles.current}>Current</span>}
                    {isSelected && <Checkmark16Regular className={styles.check} aria-hidden />}
                  </button>
                )
              })}
            </div>

            <Field label="Comment">
              <Textarea
                rows={3}
                resize="vertical"
                value={comment}
                onChange={(_, d) => setComment(d.value)}
                placeholder="Add an optional note for the assignee…"
              />
            </Field>

            {selected && selected.id !== me.data?.id && (
              <div className={styles.note}>
                <Mail16Regular aria-hidden />
                {selected.displayName} will be notified by email.
              </div>
            )}

            {canBacklog && (
              <Button
                appearance="transparent"
                className={mergeClasses(styles.backlog)}
                disabled={busy}
                onClick={() => void moveToBacklog()}
              >
                Move to backlog without assigning
              </Button>
            )}
            {error && <Text className={dialog.error}>{error}</Text>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={busy || !selectedId || unchanged} onClick={() => void confirm()}>
              {assign.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
