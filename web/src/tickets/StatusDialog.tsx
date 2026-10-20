import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  mergeClasses,
  Select,
  Text,
  Textarea,
} from '@fluentui/react-components'
import { ArrowRight16Regular, Checkmark20Regular, Dismiss20Regular, Warning20Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { ApiError } from '../api/client'
import { useTicket, useTransitionTicket } from '../api/queries'
import type { Resolution, TicketDetailDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { useDialogStyles } from './dialogStyles'
import { parseTicketNumber, StatusIds } from './labels'
import { tryTicketChange } from './saveTicket'
import { StatusBadge } from './TicketBits'
import { dialogTarget, type StatusDialogKind } from './workflow'

const copy: Record<StatusDialogKind, { title: string; confirm: string }> = {
  ready: { title: 'Send to testing', confirm: 'Confirm' },
  reopen: { title: 'Reopen ticket', confirm: 'Confirm reopen' },
  wontfix: { title: 'Close as Won’t Fix', confirm: 'Confirm' },
}

const resolutions: { value: Resolution; label: string }[] = [
  { value: 'WontFix', label: 'Won’t Fix' },
  { value: 'Duplicate', label: 'Duplicate' },
  { value: 'CannotReproduce', label: 'Cannot Reproduce' },
  { value: 'ByDesign', label: 'By Design' },
]

/** The status changes that need more than a click: Ready for Test (optional note), Reopen and Won't Fix. */
export function StatusDialog({
  kind,
  ticket,
  onClose,
  onConflict,
}: {
  kind: StatusDialogKind
  ticket: TicketDetailDto
  onClose: () => void
  onConflict: () => void
}) {
  const styles = useDialogStyles()
  const notify = useNotify()
  const transition = useTransitionTicket(ticket.number)
  const [comment, setComment] = useState('')
  const [resolution, setResolution] = useState<Resolution>('WontFix')
  const [duplicateText, setDuplicateText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toStatusId = dialogTarget[kind]
  const rule = ticket.allowedTransitions.find((t) => t.toStatusId === toStatusId)
  const commentRequired = rule?.requiresComment ?? kind !== 'ready'
  const toName = kind === 'ready' ? 'Ready for Test' : kind === 'reopen' ? 'Reopened' : 'Won’t Fix'

  // For a duplicate, look the other ticket up as it's typed so the user can see they have the right one.
  const duplicateNumber = parseTicketNumber(duplicateText)
  const duplicate = useTicket(
    resolution === 'Duplicate' && duplicateNumber !== ticket.number ? (duplicateNumber ?? 0) : 0,
  )

  const serverErrors = transition.error instanceof ApiError ? transition.error.fieldErrors : {}
  const errors = {
    comment:
      (submitted && commentRequired && !comment.trim()
        ? kind === 'reopen'
          ? 'Say why it’s being reopened.'
          : 'Explain why this ticket won’t be fixed.'
        : undefined) ?? serverErrors.comment,
    duplicate:
      (submitted && resolution === 'Duplicate' && !duplicateNumber
        ? 'Enter the ticket number, like BT-1042.'
        : submitted && duplicateNumber === ticket.number
          ? 'A ticket can’t be a duplicate of itself.'
          : undefined) ?? serverErrors.duplicateOfNumber,
  }

  const confirm = async () => {
    setSubmitted(true)
    if (commentRequired && !comment.trim()) return
    if (kind === 'wontfix' && resolution === 'Duplicate' && (!duplicateNumber || duplicateNumber === ticket.number))
      return

    const ok = await tryTicketChange(
      () =>
        transition.mutateAsync({
          toStatusId,
          comment: comment.trim() || null,
          resolution: kind === 'wontfix' ? resolution : null,
          duplicateOfNumber: kind === 'wontfix' && resolution === 'Duplicate' ? duplicateNumber : null,
          rowVersion: ticket.rowVersion,
        }),
      () => {
        onClose()
        onConflict()
      },
    )
    if (ok) {
      notify(`Status changed to ${toName}`, {
        body:
          kind === 'ready'
            ? `${ticket.reporter.displayName} has been emailed to test it.`
            : kind === 'reopen' && ticket.assignee
              ? `${ticket.assignee.displayName} has been emailed.`
              : undefined,
      })
      onClose()
    }
  }

  const placeholder =
    kind === 'reopen'
      ? ticket.statusId === StatusIds.ReadyForTest
        ? 'What failed during testing?'
        : 'Why is this being reopened?'
      : kind === 'wontfix'
        ? 'Explain why this ticket will not be fixed.'
        : 'Testing notes or areas to focus on…'

  const otherError =
    transition.error && !(transition.error instanceof ApiError && [400, 409].includes(transition.error.status))
      ? transition.error.message
      : null

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />}
          >
            <span className={styles.title}>
              <span className={mergeClasses(styles.icon, kind === 'reopen' && styles.danger)} aria-hidden>
                {kind === 'reopen' ? <Warning20Regular /> : <Checkmark20Regular />}
              </span>
              {copy[kind].title}
            </span>
          </DialogTitle>
          <DialogContent className={styles.content}>
            <div className={styles.transition} aria-label={`From ${ticket.statusName} to ${toName}`}>
              <StatusBadge name={ticket.statusName} />
              <ArrowRight16Regular aria-hidden />
              <StatusBadge name={toName} />
            </div>

            {kind === 'wontfix' && (
              <Field label="Resolution" required>
                <Select value={resolution} onChange={(_, d) => setResolution(d.value as Resolution)}>
                  {resolutions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {kind === 'wontfix' && resolution === 'Duplicate' && (
              <Field
                label="Duplicate of"
                required
                validationMessage={errors.duplicate}
                hint={
                  duplicate.data
                    ? `${duplicate.data.displayNumber}: ${duplicate.data.title}`
                    : duplicate.isError && duplicateNumber
                      ? `There’s no BT-${duplicateNumber}.`
                      : undefined
                }
              >
                <Input
                  value={duplicateText}
                  onChange={(_, d) => setDuplicateText(d.value)}
                  placeholder="Ticket number, like BT-1042"
                  autoFocus
                />
              </Field>
            )}

            <Field
              label="Comment"
              required={commentRequired}
              hint={kind === 'ready' ? 'Optional — include anything the tester should know.' : undefined}
              validationMessage={errors.comment}
            >
              <Textarea
                rows={4}
                resize="vertical"
                value={comment}
                onChange={(_, d) => setComment(d.value)}
                placeholder={placeholder}
                autoFocus={kind !== 'wontfix'}
              />
            </Field>
            {otherError && <Text className={styles.error}>{otherError}</Text>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              className={kind === 'reopen' ? styles.dangerButton : undefined}
              disabled={transition.isPending}
              onClick={() => void confirm()}
            >
              {transition.isPending ? 'Saving…' : copy[kind].confirm}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
