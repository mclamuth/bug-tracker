import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  tokens,
} from '@fluentui/react-components'
import {
  Attach16Regular,
  Delete16Regular,
  Dismiss12Regular,
  Edit12Regular,
  Edit16Regular,
  MoreHorizontal16Regular,
} from '@fluentui/react-icons'
import { useRef, useState } from 'react'
import { apiDownload } from '../api/client'
import { useAddComment, useDeleteComment, useEditComment, useMe } from '../api/queries'
import type { AttachmentDto, CommentDto, HistoryEntryDto, TicketDetailDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { PersonAvatar } from '../components/PersonAvatar'
import { activityTime, dateTime, fileSize } from '../utils/format'
import { buildActivity, splitMentions, type ActivityItem } from './activity'
import { checkFile } from './attachments'
import { MentionTextarea } from './MentionTextarea'
import { problemText } from './saveTicket'

const useStyles = makeStyles({
  section: { padding: '21px 24px' },
  title: { margin: '0 0 4px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  tabs: { marginTop: '6px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  composer: { padding: '16px 0 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  box: { display: 'flex', gap: '10px' },
  editor: {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '6px',
    ':focus-within': { outline: `2px solid rgba(15,108,189,.18)` },
  },
  textarea: { width: '100%', border: 'none', borderRadius: '6px 6px 0 0', '::after': { display: 'none' } },
  editorBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px',
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: '0 0 6px 6px',
    backgroundColor: '#fafafa',
  },
  grow: { flex: 1 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 6px 6px' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 4px 2px 8px',
    borderRadius: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: tokens.fontSizeBase200,
  },
  hint: {
    display: 'block',
    margin: '7px 0 0 42px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  error: { marginTop: '8px' },
  feed: { padding: '8px 0' },
  comment: { display: 'flex', gap: '11px', padding: '15px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  commentBody: { flex: 1, minWidth: 0 },
  commentHead: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' },
  more: { marginLeft: 'auto' },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  bubble: {
    margin: '8px 0 0',
    padding: '10px 12px',
    borderRadius: '4px',
    backgroundColor: '#f7f7f7',
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  mention: {
    padding: '1px 6px',
    borderRadius: '10px',
    backgroundColor: '#dceefc',
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  files: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' },
  fileLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForeground1,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    ':hover': { backgroundColor: '#f8fbfe' },
  },
  editActions: { display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' },
  editBox: { marginTop: '8px' },
  event: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '13px 4px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  eventIcon: {
    width: '25px',
    height: '25px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  eventText: { margin: '2px 0 0', fontSize: '13px', overflowWrap: 'anywhere' },
  eventTime: { display: 'block', marginTop: '4px', color: tokens.colorNeutralForeground3 },
  empty: { display: 'block', padding: '18px 0', color: tokens.colorNeutralForeground3 },
  hidden: { display: 'none' },
})

type Filter = 'all' | 'comments' | 'history'

/** Comments and changes, newest first, with a box to add a comment. */
export function ActivityFeed({
  ticket,
  history,
  historyLoading,
}: {
  ticket: TicketDetailDto
  history: HistoryEntryDto[]
  historyLoading: boolean
}) {
  const styles = useStyles()
  const [filter, setFilter] = useState<Filter>('all')
  const items = buildActivity(ticket.comments, history).filter(
    (i) => filter === 'all' || (filter === 'comments' ? i.kind === 'comment' : i.kind === 'history'),
  )

  return (
    <section className={styles.section} aria-label="Activity">
      <h2 className={styles.title}>Activity</h2>
      <TabList
        className={styles.tabs}
        size="small"
        selectedValue={filter}
        onTabSelect={(_, d) => setFilter(d.value as Filter)}
      >
        <Tab value="all">All</Tab>
        <Tab value="comments">Comments</Tab>
        <Tab value="history">History</Tab>
      </TabList>

      <CommentComposer ticketNumber={ticket.number} />

      <div className={styles.feed}>
        {historyLoading && filter !== 'comments' && <Spinner size="tiny" label="Loading history…" />}
        {items.length === 0 && !historyLoading && (
          <Text className={styles.empty}>{filter === 'comments' ? 'No comments yet.' : 'Nothing here yet.'}</Text>
        )}
        {items.map((item) =>
          item.kind === 'comment' ? (
            <Comment
              key={item.id}
              ticketNumber={ticket.number}
              comment={item.comment}
              files={ticket.attachments.filter((a) => a.commentId === item.comment.id)}
            />
          ) : (
            <Event key={item.id} item={item} />
          ),
        )}
      </div>
    </section>
  )
}

function CommentComposer({ ticketNumber }: { ticketNumber: number }) {
  const styles = useStyles()
  const notify = useNotify()
  const me = useMe()
  const add = useAddComment(ticketNumber)
  const fileInput = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const chooseFiles = (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const problem = checkFile(file)
      if (problem) notify('That file can’t be attached', { intent: 'warning', body: problem })
      else setFiles((current) => [...current, file])
    }
  }

  const submit = () => {
    const text = body.trim()
    if (!text || add.isPending) return
    add.mutate(
      { body: text, files },
      {
        onSuccess: ({ failed }) => {
          setBody('')
          setFiles([])
          if (failed.length > 0) {
            notify('Some files weren’t attached', {
              intent: 'warning',
              body: `${failed.join(', ')}. Try adding them again.`,
            })
          }
        },
      },
    )
  }

  return (
    <div className={styles.composer}>
      <div className={styles.box}>
        {me.data && <PersonAvatar name={me.data.displayName} initials={me.data.initials} size={32} />}
        <div className={styles.editor}>
          <MentionTextarea
            className={styles.textarea}
            appearance="outline"
            resize="vertical"
            rows={3}
            aria-label="Add a comment"
            placeholder="Add a comment or mention a teammate with @…"
            value={body}
            onValueChange={setBody}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submit()
              }
            }}
          />
          {files.length > 0 && (
            <div className={styles.chips}>
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className={styles.chip}>
                  {f.name} · {fileSize(f.size)}
                  <Button
                    appearance="transparent"
                    size="small"
                    icon={<Dismiss12Regular />}
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                  />
                </span>
              ))}
            </div>
          )}
          <div className={styles.editorBar}>
            <Button
              appearance="subtle"
              size="small"
              icon={<Attach16Regular />}
              aria-label="Attach files to this comment"
              title="Attach files"
              onClick={() => fileInput.current?.click()}
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              className={styles.hidden}
              onChange={(e) => {
                chooseFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <span className={styles.grow} />
            <Button appearance="primary" size="small" disabled={!body.trim() || add.isPending} onClick={submit}>
              {add.isPending ? 'Adding…' : 'Add comment'}
            </Button>
          </div>
        </div>
      </div>
      <Text className={styles.hint}>People you @mention get an email. Ctrl+Enter adds the comment.</Text>
      {add.isError && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>Couldn’t add the comment: {problemText(add.error)}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  )
}

function Comment({
  ticketNumber,
  comment,
  files,
}: {
  ticketNumber: number
  comment: CommentDto
  files: AttachmentDto[]
}) {
  const styles = useStyles()
  const notify = useNotify()
  const me = useMe()
  const edit = useEditComment(ticketNumber)
  const remove = useDeleteComment(ticketNumber)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mine = me.data?.id === comment.author.id

  const save = () => {
    const text = draft.trim()
    if (!text) return
    if (text === comment.body) return setEditing(false)
    edit.mutate({ id: comment.id, body: text }, { onSuccess: () => setEditing(false) })
  }

  return (
    <article className={styles.comment} aria-label={`Comment by ${comment.author.displayName}`}>
      <PersonAvatar name={comment.author.displayName} initials={comment.author.initials} size={32} />
      <div className={styles.commentBody}>
        <div className={styles.commentHead}>
          <Text weight="semibold">{comment.author.displayName}</Text>
          <span className={styles.muted} title={dateTime(comment.createdAt)}>
            {activityTime(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className={styles.muted} title={`Edited ${dateTime(comment.editedAt)}`}>
              (edited)
            </span>
          )}
          {mine && !editing && (
            <Menu positioning="below-end">
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  size="small"
                  className={styles.more}
                  icon={<MoreHorizontal16Regular />}
                  aria-label="Comment actions"
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<Edit16Regular />}
                    onClick={() => {
                      setDraft(comment.body)
                      setEditing(true)
                    }}
                  >
                    Edit
                  </MenuItem>
                  <MenuItem icon={<Delete16Regular />} onClick={() => setConfirmDelete(true)}>
                    Delete
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>

        {editing ? (
          <div className={styles.editBox}>
            <MentionTextarea
              resize="vertical"
              rows={3}
              aria-label="Edit comment"
              value={draft}
              onValueChange={setDraft}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false)
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  save()
                }
              }}
            />
            {edit.isError && <Text className={styles.muted}>Couldn’t save: {problemText(edit.error)}</Text>}
            <div className={styles.editActions}>
              <Button size="small" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="small" appearance="primary" disabled={!draft.trim() || edit.isPending} onClick={save}>
                {edit.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <p className={styles.bubble}>
            {splitMentions(comment.body, comment.mentions).map((part, i) =>
              part.mention ? (
                <span key={i} className={styles.mention}>
                  {part.text}
                </span>
              ) : (
                part.text
              ),
            )}
          </p>
        )}

        {files.length > 0 && (
          <div className={styles.files}>
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.fileLink}
                onClick={() =>
                  void apiDownload(`/api/v1/attachments/${f.id}`, f.fileName).catch((e: Error) =>
                    notify(`Couldn’t download ${f.fileName}`, { intent: 'error', body: e.message }),
                  )
                }
              >
                <Attach16Regular aria-hidden />
                {f.fileName}
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={(_, d) => !d.open && setConfirmDelete(false)}>
          <DialogSurface style={{ width: 440 }}>
            <DialogBody>
              <DialogTitle>Delete this comment?</DialogTitle>
              <DialogContent>
                {files.length > 0
                  ? 'Its attached files stay on the ticket. This can’t be undone.'
                  : 'This can’t be undone.'}
                {remove.isError && <Text block>Couldn’t delete it: {problemText(remove.error)}</Text>}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button
                  appearance="primary"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(comment.id, {
                      onSuccess: () => {
                        setConfirmDelete(false)
                        notify('Comment deleted')
                      },
                    })
                  }
                >
                  {remove.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </article>
  )
}

function Event({ item }: { item: Extract<ActivityItem, { kind: 'history' }> }) {
  const styles = useStyles()
  return (
    <div className={styles.event}>
      <span className={styles.eventIcon} aria-hidden>
        <Edit12Regular />
      </span>
      <p className={styles.eventText}>
        <strong>{item.person.displayName}</strong> {item.text}
        <small className={styles.eventTime} title={dateTime(item.at)}>
          {activityTime(item.at)}
        </small>
      </p>
    </div>
  )
}
