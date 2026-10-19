import { makeStyles, mergeClasses, Spinner, Text, tokens } from '@fluentui/react-components'
import { ArrowDownload16Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { apiDownload } from '../api/client'
import type { AttachmentDto } from '../api/types'
import { useNotify } from '../components/notifyContext'
import { dateTime, fileKind, fileSize } from '../utils/format'

const useStyles = makeStyles({
  section: { padding: '21px 24px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
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
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    minWidth: 0,
    ':hover': {
      backgroundColor: '#f8fbfe',
      borderTopColor: '#9abbd6',
      borderRightColor: '#9abbd6',
      borderBottomColor: '#9abbd6',
      borderLeftColor: '#9abbd6',
    },
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

/** Files on the ticket; click one to download it. */
export function AttachmentList({ attachments }: { attachments: AttachmentDto[] }) {
  const styles = useStyles()
  const notify = useNotify()
  const [downloading, setDownloading] = useState<number | null>(null)

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

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>
        Attachments {attachments.length > 0 && <span className={styles.count}>{attachments.length}</span>}
      </h2>
      {attachments.length === 0 ? (
        <Text className={styles.empty}>No files attached.</Text>
      ) : (
        <div className={styles.grid}>
          {attachments.map((a) => {
            const kind = fileKind(a.fileName)
            const isImage = a.contentType.startsWith('image/')
            const isPdf = kind === 'PDF'
            return (
              <button
                key={a.id}
                type="button"
                className={styles.file}
                title={`Added by ${a.uploadedBy.displayName}, ${dateTime(a.uploadedAt)}`}
                onClick={() => void download(a)}
              >
                <span
                  className={mergeClasses(styles.thumb, isImage && styles.image, !isImage && !isPdf && styles.document)}
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
            )
          })}
        </div>
      )}
    </section>
  )
}
