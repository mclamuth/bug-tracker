import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  mergeClasses,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components'
import { ArrowDownload16Regular, Attach16Regular, Delete16Regular } from '@fluentui/react-icons'
import { useRef, useState } from 'react'
import { apiDownload } from '../api/client'
import { useDeleteAttachment, useMe, useUploadAttachments } from '../api/queries'
import type { AttachmentDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { dateTime, fileKind, fileSize } from '../utils/format'
import { checkFile, MAX_FILE_LABEL } from './attachments'
import { problemText } from './saveTicket'

const useStyles = makeStyles({
  section: { padding: '21px 24px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  card: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    ':hover': {
      backgroundColor: '#f8fbfe',
      borderTopColor: '#9abbd6',
      borderRightColor: '#9abbd6',
      borderBottomColor: '#9abbd6',
      borderLeftColor: '#9abbd6',
    },
  },
  remove: { marginRight: '6px' },
  hidden: { display: 'none' },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  count: {
    padding: '2px 6px',
    borderRadius: '9px',
    backgroundColor: '#ededed',
    color: tokens.colorNeutralForeground3,
    fontSize: '11px',
    fontWeight: tokens.fontWeightRegular,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '13px' },
  file: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    minWidth: 0,
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}` },
  },
  thumb: {
    width: '36px',
    height: '40px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '4px',
    backgroundColor: '#fde7e9',
    color: '#b10e1c',
    fontSize: '10px',
    fontWeight: tokens.fontWeightBold,
  },
  image: { backgroundColor: '#e8f4e8', color: '#107c10' },
  document: { backgroundColor: '#ebf3fc', color: '#0f548c' },
  info: { display: 'grid', gap: '3px', flex: 1, minWidth: 0 },
  name: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  empty: { display: 'block', marginTop: '8px', color: tokens.colorNeutralForeground3 },
})

/** Files on the ticket: click one to download it, add more, or remove ones you uploaded. */
export function AttachmentList({ ticketNumber, attachments }: { ticketNumber: number; attachments: AttachmentDto[] }) {
  const styles = useStyles()
  const notify = useNotify()
  const me = useMe()
  const upload = useUploadAttachments(ticketNumber)
  const remove = useDeleteAttachment(ticketNumber)
  const input = useRef<HTMLInputElement>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [removing, setRemoving] = useState<AttachmentDto | null>(null)

  const download = async (a: AttachmentDto) => {
    setDownloading(a.id)
    try {
      await apiDownload(`/api/v1/attachments/${a.id}`, a.fileName)
    } catch (error) {
      notify(`Couldn’t download ${a.fileName}`, { intent: 'error', body: (error as Error).message })
    } finally {
      setDownloading(null)
    }
  }

  const add = (list: FileList | null) => {
    const files: File[] = []
    for (const file of Array.from(list ?? [])) {
      const problem = checkFile(file)
      if (problem) notify('That file can’t be attached', { intent: 'warning', body: problem })
      else files.push(file)
    }
    if (files.length === 0) return
    upload.mutate(files, {
      onSuccess: (failed) => {
        const added = files.length - failed.length
        if (added > 0)
          notify(
            added === 1 ? `${files.find((f) => !failed.includes(f.name))!.name} attached` : `${added} files attached`,
          )
        if (failed.length > 0) notify('Some files weren’t attached', { intent: 'warning', body: failed.join(', ') })
      },
    })
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          Attachments {attachments.length > 0 && <span className={styles.count}>{attachments.length}</span>}
        </h2>
        <Button
          icon={upload.isPending ? <Spinner size="tiny" /> : <Attach16Regular />}
          disabled={upload.isPending}
          title={MAX_FILE_LABEL}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? 'Attaching…' : 'Add file'}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className={styles.hidden}
          aria-label="Add files"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {attachments.length === 0 ? (
        <Text className={styles.empty}>No files attached.</Text>
      ) : (
        <div className={styles.grid}>
          {attachments.map((a) => {
            const kind = fileKind(a.fileName)
            const isImage = a.contentType.startsWith('image/')
            const isPdf = kind === 'PDF'
            return (
              <div key={a.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.file}
                  title={`Added by ${a.uploadedBy.displayName}, ${dateTime(a.uploadedAt)}`}
                  onClick={() => void download(a)}
                >
                  <span
                    className={mergeClasses(
                      styles.thumb,
                      isImage && styles.image,
                      !isImage && !isPdf && styles.document,
                    )}
                  >
                    {kind}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.name}>{a.fileName}</span>
                    <span className={styles.muted}>
                      {kind} · {fileSize(a.sizeBytes)}
                    </span>
                  </span>
                  {downloading === a.id ? <Spinner size="tiny" /> : <ArrowDownload16Regular aria-label="Download" />}
                </button>
                {a.uploadedBy.id === me.data?.id && (
                  <Button
                    appearance="subtle"
                    size="small"
                    className={styles.remove}
                    icon={<Delete16Regular />}
                    aria-label={`Remove ${a.fileName}`}
                    title="Remove"
                    onClick={() => setRemoving(a)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {removing && (
        <Dialog open onOpenChange={(_, d) => !d.open && setRemoving(null)}>
          <DialogSurface style={{ width: 440 }}>
            <DialogBody>
              <DialogTitle>Remove {removing.fileName}?</DialogTitle>
              <DialogContent>
                The file is removed from the ticket for everyone. The ticket’s history notes that it was removed.
                {remove.isError && <Text block>Couldn’t remove it: {problemText(remove.error)}</Text>}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRemoving(null)}>Cancel</Button>
                <Button
                  appearance="primary"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(removing.id, {
                      onSuccess: () => {
                        notify(`${removing.fileName} removed`)
                        setRemoving(null)
                      },
                    })
                  }
                >
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </section>
  )
}
