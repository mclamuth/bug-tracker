import {
  Button,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components'
import { Edit12Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { useAddComment, useMe } from '../api/queries'
import type { HistoryEntryDto, TicketDetailDto } from '../api/types'
import { activityTime, dateTime } from '../utils/format'
import { buildActivity, splitMentions, type ActivityItem } from './activity'
import { PersonAvatar } from '../components/PersonAvatar'

const useStyles = makeStyles({
  section: { padding: '21px 24px' },
  title: { margin: '0 0 4px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  tabs: { marginTop: '6px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  composer: { padding: '16px 0 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  box: { display: 'flex', gap: '10px' },
  editor: {
    flex: 1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '6px',
    overflow: 'hidden',
    ':focus-within': { outline: `2px solid rgba(15,108,189,.18)` },
  },
  textarea: { width: '100%', border: 'none', borderRadius: 0, '::after': { display: 'none' } },
  editorBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '6px',
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: '#fafafa',
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
  commentHead: { display: 'flex', alignItems: 'center', gap: '8px' },
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
          item.kind === 'comment' ? <Comment key={item.id} item={item} /> : <Event key={item.id} item={item} />,
        )}
      </div>
    </section>
  )
}

function CommentComposer({ ticketNumber }: { ticketNumber: number }) {
  const styles = useStyles()
  const me = useMe()
  const add = useAddComment(ticketNumber)
  const [body, setBody] = useState('')

  const submit = () => {
    const text = body.trim()
    if (!text || add.isPending) return
    add.mutate(text, { onSuccess: () => setBody('') })
  }

  return (
    <div className={styles.composer}>
      <div className={styles.box}>
        {me.data && <PersonAvatar name={me.data.displayName} initials={me.data.initials} size={32} />}
        <div className={styles.editor}>
          <Textarea
            className={styles.textarea}
            appearance="outline"
            resize="vertical"
            rows={3}
            aria-label="Add a comment"
            placeholder="Add a comment or mention a teammate with @Full Name…"
            value={body}
            onChange={(_, d) => setBody(d.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <div className={styles.editorBar}>
            <Button appearance="primary" size="small" disabled={!body.trim() || add.isPending} onClick={submit}>
              {add.isPending ? 'Adding…' : 'Add comment'}
            </Button>
          </div>
        </div>
      </div>
      <Text className={styles.hint}>People you @mention get an email. Ctrl+Enter adds the comment.</Text>
      {add.isError && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>Couldn’t add the comment: {add.error.message}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  )
}

function Comment({ item }: { item: Extract<ActivityItem, { kind: 'comment' }> }) {
  const styles = useStyles()
  const { comment } = item
  return (
    <article className={styles.comment}>
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
        </div>
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
      </div>
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
