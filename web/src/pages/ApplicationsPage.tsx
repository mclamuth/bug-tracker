import {
  Button,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Select,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from '@fluentui/react-components'
import {
  Add20Regular,
  Apps20Regular,
  ChevronRight16Regular,
  Dismiss20Regular,
  Open16Regular,
} from '@fluentui/react-icons'
import { useState, type KeyboardEvent } from 'react'
import { ApiError } from '../api/client'
import { useApplications, useSaveApplication, useUsers } from '../api/queries'
import type { ApplicationDto, SaveApplicationRequest } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'
import { PersonAvatar } from '../components/PersonAvatar'

const useStyles = makeStyles({
  table: { tableLayout: 'auto' },
  headerCell: {
    backgroundColor: '#fafafa',
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  row: {
    cursor: 'pointer',
    ':hover': { backgroundColor: '#f8fbfe' },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: '-2px' },
  },
  inactive: { color: tokens.colorNeutralForeground4, backgroundColor: '#fafafa' },
  name: { display: 'flex', alignItems: 'center', gap: '10px', color: tokens.colorBrandForeground1 },
  nameInactive: { color: '#737373' },
  nameIcon: {
    width: '30px',
    height: '30px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
  nameIconInactive: { backgroundColor: '#ededed' },
  person: { display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' },
  muted: { color: tokens.colorNeutralForeground3 },
  count: {
    minWidth: '24px',
    height: '24px',
    padding: '0 6px',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: '12px',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  drawerBody: { display: 'grid', gap: '18px', alignContent: 'start', paddingTop: '8px' },
  eyebrow: { display: 'block', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  footer: { justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
})

type SortKey = 'name' | 'description' | 'defaultAssigneeName' | 'openTickets' | 'isActive'

const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'defaultAssigneeName', label: 'Default assignee' },
  { key: 'openTickets', label: 'Open tickets' },
  { key: 'isActive', label: 'Active' },
]

function compare(a: ApplicationDto, b: ApplicationDto, key: SortKey): number {
  if (key === 'openTickets') return a.openTickets - b.openTickets
  if (key === 'isActive') return Number(b.isActive) - Number(a.isActive)
  return (a[key] ?? '').localeCompare(b[key] ?? '', undefined, { sensitivity: 'base' })
}

/** The tracked applications: who picks up their tickets by default and what the app launcher links to. */
export function ApplicationsPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const notify = useNotify()
  const apps = useApplications()
  const save = useSaveApplication()
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' })
  const [editing, setEditing] = useState<ApplicationDto | 'new' | null>(null)

  const sorted = [...(apps.data ?? [])].sort(
    (a, b) => compare(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1) || compare(a, b, 'name'),
  )
  const changeSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    )

  const toggle = (app: ApplicationDto, isActive: boolean) =>
    save.mutate(
      { id: app.id, ...toRequest(app), isActive },
      {
        onSuccess: () =>
          notify(isActive ? `${app.name} switched on` : `${app.name} switched off`, {
            body: isActive
              ? 'It can be chosen for new tickets again.'
              : 'Its tickets stay, but it can’t be chosen for new ones and is hidden from the app launcher.',
          }),
        onError: (e) => notify(`Couldn’t change ${app.name}`, { intent: 'error', body: e.message }),
      },
    )

  const onRowKey = (e: KeyboardEvent, app: ApplicationDto) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) setEditing(app)
  }

  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Administration / Applications"
        title="Applications"
        description="Manage tracked applications, their default developer and app launcher links."
        action={
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing('new')}>
            Add application
          </Button>
        }
      />

      <section className={page.panel} style={{ overflow: 'hidden' }}>
        {apps.isPending && <Spinner label="Loading applications…" style={{ padding: 32 }} />}
        {apps.isError && (
          <MessageBar intent="error">
            <MessageBarBody>Could not load applications: {apps.error.message}</MessageBarBody>
          </MessageBar>
        )}
        {apps.isSuccess && (
          <Table aria-label="Applications" className={styles.table}>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHeaderCell
                    key={c.key}
                    className={styles.headerCell}
                    sortable
                    sortDirection={
                      sort.key === c.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    onClick={() => changeSort(c.key)}
                  >
                    {c.label}
                  </TableHeaderCell>
                ))}
                <TableHeaderCell className={styles.headerCell} aria-label="Edit" style={{ width: 40 }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((app) => (
                <TableRow
                  key={app.id}
                  className={mergeClasses(styles.row, !app.isActive && styles.inactive)}
                  tabIndex={0}
                  aria-label={`${app.name}${app.isActive ? '' : ' (switched off)'}`}
                  onClick={() => setEditing(app)}
                  onKeyDown={(e) => onRowKey(e, app)}
                >
                  <TableCell>
                    <span className={mergeClasses(styles.name, !app.isActive && styles.nameInactive)}>
                      <span className={mergeClasses(styles.nameIcon, !app.isActive && styles.nameIconInactive)}>
                        <Apps20Regular />
                      </span>
                      <Text weight="semibold">{app.name}</Text>
                      {app.launcherUrl && (
                        <Tooltip content="In the app launcher" relationship="label">
                          <Open16Regular className={styles.muted} />
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{app.description}</TableCell>
                  <TableCell>
                    {app.defaultAssigneeName ? (
                      <span className={styles.person}>
                        <PersonAvatar name={app.defaultAssigneeName} size={24} />
                        {app.defaultAssigneeName}
                      </span>
                    ) : (
                      <Text italic className={styles.muted}>
                        None
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={styles.count}>{app.openTickets}</span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Switch
                      checked={app.isActive}
                      aria-label={`${app.name} is active`}
                      disabled={save.isPending && save.variables?.id === app.id}
                      onChange={(_, d) => toggle(app, d.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <ChevronRight16Regular className={styles.muted} aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {editing && (
        <ApplicationDrawer
          key={editing === 'new' ? 'new' : editing.id}
          app={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

const toRequest = (app: ApplicationDto): SaveApplicationRequest => ({
  name: app.name,
  description: app.description,
  defaultAssigneeId: app.defaultAssigneeId,
  launcherUrl: app.launcherUrl,
  isActive: app.isActive,
})

/** Side panel for adding an application or editing one. */
function ApplicationDrawer({ app, onClose }: { app: ApplicationDto | null; onClose: () => void }) {
  const styles = useStyles()
  const notify = useNotify()
  const developers = useUsers('developer')
  const save = useSaveApplication()
  const [draft, setDraft] = useState<SaveApplicationRequest>(
    app ? toRequest(app) : { name: '', description: null, defaultAssigneeId: null, launcherUrl: null, isActive: true },
  )
  const [submitted, setSubmitted] = useState(false)
  const set = <K extends keyof SaveApplicationRequest>(key: K, value: SaveApplicationRequest[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const url = draft.launcherUrl?.trim() ?? ''
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const errors = {
    name: (submitted && !draft.name.trim() ? 'Enter the application’s name.' : undefined) ?? serverErrors.name,
    launcherUrl:
      (submitted && url && !/^https?:\/\/\S+$/i.test(url)
        ? 'Enter a full web address starting with https://'
        : undefined) ?? serverErrors.launcherUrl,
    description: serverErrors.description,
    defaultAssigneeId: serverErrors.defaultAssigneeId,
  }

  const submit = () => {
    setSubmitted(true)
    if (!draft.name.trim() || (url && !/^https?:\/\/\S+$/i.test(url))) return
    save.mutate(
      { id: app?.id, ...draft, launcherUrl: url || null, description: draft.description?.trim() || null },
      {
        onSuccess: (saved) => {
          notify(app ? `${saved.name} saved` : `${saved.name} added`, {
            body: !app && saved.launcherUrl ? 'It’s also in the app launcher now.' : undefined,
          })
          onClose()
        },
      },
    )
  }

  const otherError =
    save.error && !(save.error instanceof ApiError && save.error.status === 400) ? save.error.message : null
  // A default developer who is no longer a developer still shows, so the choice isn't silently changed.
  const options = developers.data ?? []
  const missingDefault = app?.defaultAssigneeId && !options.some((d) => d.id === app.defaultAssigneeId) ? app : null

  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />}
        >
          <span className={styles.eyebrow}>Application</span>
          {app ? `Edit ${app.name}` : 'Add application'}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <form
          className={styles.drawerBody}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="Application name" required validationMessage={errors.name}>
            <Input
              value={draft.name}
              onChange={(_, d) => set('name', d.value)}
              placeholder="Application name"
              maxLength={100}
              autoFocus
            />
          </Field>
          <Field label="Description" validationMessage={errors.description}>
            <Textarea
              rows={4}
              resize="vertical"
              value={draft.description ?? ''}
              onChange={(_, d) => set('description', d.value)}
              placeholder="What is this application used for?"
              maxLength={500}
            />
          </Field>
          <Field
            label="Default assignee"
            hint="New tickets for this application are assigned to them unless the reporter picks someone else."
            validationMessage={errors.defaultAssigneeId}
          >
            <Select
              value={draft.defaultAssigneeId ?? ''}
              onChange={(_, d) => set('defaultAssigneeId', d.value ? Number(d.value) : null)}
            >
              <option value="">No default — new tickets go to triage</option>
              {missingDefault && (
                <option value={missingDefault.defaultAssigneeId!}>{missingDefault.defaultAssigneeName}</option>
              )}
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Launcher URL"
            hint="Leave blank to hide this app from the launcher."
            validationMessage={errors.launcherUrl}
          >
            <Input
              type="url"
              value={draft.launcherUrl ?? ''}
              onChange={(_, d) => set('launcherUrl', d.value)}
              placeholder="https://"
              maxLength={500}
            />
          </Field>
          <Field
            label="Active"
            hint={
              draft.isActive
                ? 'Can be chosen for new tickets.'
                : 'Its tickets stay, but it can’t be chosen for new ones and is hidden from the launcher.'
            }
          >
            <Switch
              checked={draft.isActive}
              label={draft.isActive ? 'On' : 'Off'}
              onChange={(_, d) => set('isActive', d.checked)}
            />
          </Field>
          {otherError && (
            <MessageBar intent="error">
              <MessageBarBody>Couldn’t save: {otherError}</MessageBarBody>
            </MessageBar>
          )}
          <button type="submit" hidden />
        </form>
      </DrawerBody>
      <DrawerFooter className={styles.footer}>
        <Button onClick={onClose}>Cancel</Button>
        <Button appearance="primary" disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : app ? 'Save changes' : 'Add application'}
        </Button>
      </DrawerFooter>
    </OverlayDrawer>
  )
}
