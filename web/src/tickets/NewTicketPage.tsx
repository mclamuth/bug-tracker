import {
  Button,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Select,
  shorthands,
  Spinner,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowUpload24Regular,
  Bug20Regular,
  Dismiss16Regular,
  Document20Regular,
  Lightbulb20Regular,
} from '@fluentui/react-icons'
import { useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, uploadAttachment, useApplications, useCreateTicket, useMe, useUsers } from '../api/queries'
import type { Priority, Severity, TicketEnvironment, TicketType } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'
import { usePageTitle } from '../components/usePageTitle'
import { fileSize } from '../utils/format'
import { checkFile, MAX_FILE_LABEL } from './attachments'
import { environments, priorities, severities } from './labels'
import { PersonAvatar } from '../components/PersonAvatar'

const useStyles = makeStyles({
  page: { maxWidth: '1060px' },
  reportedBy: {
    width: 'fit-content',
    minHeight: '38px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '-8px 0 14px',
    padding: '6px 10px',
    borderRadius: '5px',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: '13px',
  },
  card: { padding: '24px 26px', marginBottom: '16px' },
  sectionHead: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    paddingBottom: '17px',
    marginBottom: '20px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  step: {
    width: '26px',
    height: '26px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightBold,
  },
  sectionTitle: { margin: '0 0 3px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  grid: { display: 'grid', gap: '18px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' },
  segmented: {
    width: 'fit-content',
    display: 'flex',
    padding: '3px',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '5px',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  segment: {
    minWidth: '135px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 16px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: tokens.colorNeutralForeground2,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    cursor: 'pointer',
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}` },
  },
  segmentActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    boxShadow: '0 1px 3px rgba(0,0,0,.12)',
  },
  dropzone: {
    minHeight: '115px',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '5px',
    padding: '16px',
    border: '1px dashed #a6a6a6',
    borderRadius: '6px',
    backgroundColor: '#fafafa',
    color: tokens.colorNeutralForeground3,
    cursor: 'pointer',
    ':hover': { ...shorthands.borderColor(tokens.colorBrandStroke1) },
  },
  dropzoneActive: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  browse: { color: tokens.colorBrandForeground1 },
  files: { display: 'grid', gap: '6px', marginTop: '10px' },
  file: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 6px 6px 10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
  },
  fileName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '8px 0 20px' },
  hidden: { display: 'none' },
})

type FieldErrors = Record<string, string | undefined>

/** Report a defect or request an enhancement. */
export function NewTicketPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const navigate = useNavigate()
  const notify = useNotify()
  const me = useMe()
  const applications = useApplications()
  const developers = useUsers('developer')
  const supervisors = useUsers('supervisor')
  const create = useCreateTicket()
  usePageTitle('New ticket')
  const queryClient = useQueryClient()

  const [type, setType] = useState<TicketType>('Defect')
  const [applicationId, setApplicationId] = useState('')
  const [title, setTitle] = useState('')
  const [endUserName, setEndUserName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [environment, setEnvironment] = useState<TicketEnvironment>('Production')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [priority, setPriority] = useState<Priority>('P3Normal')
  const [assigneeId, setAssigneeId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [uploading, setUploading] = useState(false)

  const isDefect = type === 'Defect'
  const activeApps = (applications.data ?? []).filter((a) => a.isActive)
  const supervisorFirstName = supervisors.data?.[0]?.displayName.split(' ')[0]

  const clientErrors: FieldErrors = {
    applicationId: applicationId ? undefined : 'Select an application.',
    title: !title.trim()
      ? 'Enter a concise title.'
      : title.trim().length > 200
        ? 'Keep the title under 200 characters.'
        : undefined,
    description: description.trim() ? undefined : 'Describe the issue or request.',
    severity: isDefect && !severity ? 'Select a severity.' : undefined,
  }
  const errorFor = (field: string) => (submitted ? clientErrors[field] : undefined) ?? serverErrors[field]

  const chooseApplication = (id: string) => {
    setApplicationId(id)
    // Default to the application's developer, as long as they can still be assigned.
    const app = activeApps.find((a) => String(a.id) === id)
    const developer = developers.data?.find((d) => d.id === app?.defaultAssigneeId)
    setAssigneeId(developer ? String(developer.id) : '')
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const problems: string[] = []
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      const problem = checkFile(file)
      if (problem) problems.push(problem)
      else accepted.push(file)
    }
    setFiles((current) => [...current, ...accepted])
    setFileErrors(problems)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerErrors({})
    if (Object.values(clientErrors).some(Boolean)) return

    let ticket
    try {
      ticket = await create.mutateAsync({
        type,
        applicationId: Number(applicationId),
        title: title.trim(),
        description: description.trim(),
        endUserName: endUserName.trim() || null,
        stepsToReproduce: isDefect ? steps.trim() || null : null,
        expectedResult: isDefect ? expected.trim() || null : null,
        actualResult: isDefect ? actual.trim() || null : null,
        environment: isDefect ? environment : null,
        severity: isDefect ? (severity as Severity) : null,
        priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) setServerErrors(error.fieldErrors)
      return
    }

    // The ticket exists now; attach the files one at a time and report any that didn't make it.
    const failed: string[] = []
    if (files.length > 0) {
      setUploading(true)
      for (const file of files) {
        try {
          await uploadAttachment(ticket.number, file)
        } catch {
          failed.push(file.name)
        }
      }
      setUploading(false)
      // The ticket was cached before the files were added; fetch it again so they show.
      await queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticket.number) })
    }

    notify(`${ticket.displayNumber} created`, {
      body: ticket.assignee
        ? `Assigned to ${ticket.assignee.displayName}, who’s been emailed.`
        : `${supervisorFirstName ?? 'The supervisor'} has been emailed to triage it.`,
    })
    if (failed.length > 0) {
      notify('Some files weren’t attached', {
        intent: 'warning',
        body: `${failed.join(', ')}. You can add them from the ticket.`,
      })
    }
    void navigate(`/tickets/${ticket.number}`, { replace: true })
  }

  const busy = create.isPending || uploading
  const generalError =
    create.error && !(create.error instanceof ApiError && create.error.status === 400) ? create.error.message : null

  return (
    <div className={mergeClasses(page.page, styles.page)}>
      <PageHeader
        breadcrumb="Tickets / New Ticket"
        title="Create a new ticket"
        description="Provide enough detail for the team to understand and reproduce the issue."
      />
      {me.data && (
        <div className={styles.reportedBy}>
          <PersonAvatar name={me.data.displayName} initials={me.data.initials} size={24} />
          <span>
            Reported by <strong>{me.data.displayName}</strong>
          </span>
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} noValidate>
        <Section number={1} title="Ticket details" description="Describe the defect or enhancement request.">
          <div className={styles.grid}>
            <Field label="Type" required>
              <div className={styles.segmented} role="radiogroup" aria-label="Type">
                <TypeOption current={type} value="Defect" icon={<Bug20Regular />} onSelect={setType} />
                <TypeOption current={type} value="Enhancement" icon={<Lightbulb20Regular />} onSelect={setType} />
              </div>
            </Field>
            <Field label="Application" required validationMessage={errorFor('applicationId')}>
              <Select value={applicationId} onChange={(_, d) => chooseApplication(d.value)}>
                <option value="">Select an application</option>
                {activeApps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" required validationMessage={errorFor('title')}>
              <Input
                value={title}
                onChange={(_, d) => setTitle(d.value)}
                placeholder="Summarize the issue or request"
                maxLength={200}
              />
            </Field>
            <Field
              label="Called in by (end user)"
              hint="If an end user reported this, enter their name and department."
              validationMessage={errorFor('endUserName')}
            >
              <Input
                value={endUserName}
                onChange={(_, d) => setEndUserName(d.value)}
                placeholder="Name and department"
                maxLength={200}
              />
            </Field>
            <Field label="Description" required validationMessage={errorFor('description')}>
              <Textarea
                value={description}
                onChange={(_, d) => setDescription(d.value)}
                placeholder="What happened? Include any important context."
                rows={5}
                resize="vertical"
              />
            </Field>
          </div>
        </Section>

        {isDefect && (
          <Section
            number={2}
            title="Reproduction details"
            description="Help the developer reproduce and diagnose the defect."
          >
            <div className={styles.grid}>
              <Field label="Steps to reproduce">
                <Textarea
                  value={steps}
                  onChange={(_, d) => setSteps(d.value)}
                  placeholder={'1. Go to…\n2. Select…\n3. Observe…'}
                  rows={4}
                  resize="vertical"
                />
              </Field>
              <div className={styles.twoCol}>
                <Field label="Expected result">
                  <Textarea
                    value={expected}
                    onChange={(_, d) => setExpected(d.value)}
                    placeholder="What should have happened?"
                    rows={3}
                    resize="vertical"
                  />
                </Field>
                <Field label="Actual result">
                  <Textarea
                    value={actual}
                    onChange={(_, d) => setActual(d.value)}
                    placeholder="What happened instead?"
                    rows={3}
                    resize="vertical"
                  />
                </Field>
              </div>
              <div className={styles.twoCol}>
                <Field label="Environment">
                  <Select value={environment} onChange={(_, d) => setEnvironment(d.value as TicketEnvironment)}>
                    {environments.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Severity" required validationMessage={errorFor('severity')}>
                  <Select value={severity} onChange={(_, d) => setSeverity(d.value as Severity | '')}>
                    <option value="">Select severity</option>
                    {severities.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Section>
        )}

        <Section
          number={isDefect ? 3 : 2}
          title="Assignment and supporting files"
          description="Set priority, ownership, and add any helpful files."
        >
          <div className={styles.grid}>
            <div className={styles.twoCol}>
              <Field label="Priority" required>
                <Select value={priority} onChange={(_, d) => setPriority(d.value as Priority)}>
                  {priorities.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Assign to"
                hint="Defaults to the application’s developer; select Unassigned for supervisor triage"
                validationMessage={errorFor('assigneeId')}
              >
                <Select value={assigneeId} onChange={(_, d) => setAssigneeId(d.value)}>
                  <option value="">
                    Unassigned — {supervisorFirstName ? `${supervisorFirstName} will` : 'the supervisor will'} triage it
                  </option>
                  {(developers.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Attachments" validationMessage={fileErrors.length ? fileErrors.join(' ') : undefined}>
              <FileDrop onFiles={addFiles} />
              {files.length > 0 && (
                <div className={styles.files}>
                  {files.map((file, i) => (
                    <div key={`${file.name}-${i}`} className={styles.file}>
                      <Document20Regular />
                      <Text className={styles.fileName}>{file.name}</Text>
                      <Text className={styles.muted}>{fileSize(file.size)}</Text>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss16Regular />}
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
        </Section>

        {generalError && (
          <MessageBar intent="error" style={{ marginBottom: 12 }}>
            <MessageBarBody>Couldn’t create the ticket: {generalError}</MessageBarBody>
          </MessageBar>
        )}

        <div className={styles.actions}>
          <Button onClick={() => void navigate(-1)} disabled={busy}>
            Cancel
          </Button>
          <Button appearance="primary" type="submit" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
            {uploading ? 'Attaching files…' : create.isPending ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description: string
  children: ReactNode
}) {
  const page = usePageStyles()
  const styles = useStyles()
  return (
    <section className={mergeClasses(page.panel, styles.card)}>
      <div className={styles.sectionHead}>
        <span className={styles.step} aria-hidden>
          {number}
        </span>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <Text className={styles.muted}>{description}</Text>
        </div>
      </div>
      {children}
    </section>
  )
}

function TypeOption({
  current,
  value,
  icon,
  onSelect,
}: {
  current: TicketType
  value: TicketType
  icon: ReactNode
  onSelect: (value: TicketType) => void
}) {
  const styles = useStyles()
  const selected = current === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={mergeClasses(styles.segment, selected && styles.segmentActive)}
      onClick={() => onSelect(value)}
    >
      {icon}
      {value}
    </button>
  )
}

/** A drop area that also opens the file picker when clicked or activated from the keyboard. */
function FileDrop({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const styles = useStyles()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    onFiles(e.dataTransfer.files)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={mergeClasses(styles.dropzone, over && styles.dropzoneActive)}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            input.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <ArrowUpload24Regular />
        <Text weight="semibold">
          Drag files here or <span className={styles.browse}>browse</span>
        </Text>
        <Text size={200}>{MAX_FILE_LABEL}</Text>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        className={styles.hidden}
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = '' // so choosing the same file again still fires
        }}
      />
    </>
  )
}
