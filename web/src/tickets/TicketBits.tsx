import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { Bug16Regular, Lightbulb16Regular, Warning16Filled, Warning16Regular } from '@fluentui/react-icons'
import type { PersonDto, Priority, Severity, TicketType } from '../api/types'
import { priorityLabel } from './labels'
import { PersonAvatar } from '../components/PersonAvatar'

// Colours from the Figma design (status badges, severity text, type icons).
const statusColors: Record<string, { color: string; background: string }> = {
  New: { color: '#424242', background: '#f0f0f0' },
  Triaged: { color: '#5c2e91', background: '#f3e8ff' },
  Assigned: { color: '#0f548c', background: '#ebf3fc' },
  'In Progress': { color: '#006666', background: '#d7f4f2' },
  'Ready for Test': { color: '#7a4d00', background: '#fff4ce' },
  Verified: { color: '#107c10', background: '#dff6dd' },
  Closed: { color: '#424242', background: '#e0e0e0' },
  Reopened: { color: '#a4262c', background: '#fde7e9' },
  'Won’t Fix': { color: '#616161', background: '#ededed' },
  "Won't Fix": { color: '#616161', background: '#ededed' },
}

const severityColors: Record<Severity, string> = {
  Critical: '#b10e1c',
  High: '#a15c00',
  Medium: '#7a5d00',
  Low: '#616161',
}

const useStyles = makeStyles({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    width: 'fit-content',
    borderRadius: '999px',
    padding: '3px 8px',
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  dot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 },
  wontFix: { fontStyle: 'italic' },
  severity: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '13px',
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  none: { color: tokens.colorNeutralForeground3 },
  priority: {
    display: 'inline-flex',
    padding: '2px 6px',
    fontSize: '13px',
    lineHeight: '18px',
    whiteSpace: 'nowrap',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
  },
  typeIcon: {
    width: '26px',
    height: '26px',
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    borderRadius: '5px',
    color: '#0f548c',
    backgroundColor: '#ebf3fc',
  },
  enhancement: { color: '#6b4f00', backgroundColor: '#fff4ce' },
  small: { width: '23px', height: '23px' },
  person: { display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', minWidth: 0 },
  unassigned: { color: tokens.colorNeutralForeground3, fontStyle: 'italic', fontSize: '13px' },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
  },
})

export function StatusBadge({ name }: { name: string }) {
  const styles = useStyles()
  const colors = statusColors[name] ?? statusColors.New
  const isWontFix = name.startsWith('Won')
  return (
    <span
      className={mergeClasses(styles.badge, isWontFix && styles.wontFix)}
      style={colors}
      title={name === 'Triaged' ? 'Accepted, not yet assigned' : undefined}
    >
      <span className={styles.dot} aria-hidden />
      {name}
    </span>
  )
}

export function SeverityLabel({ severity }: { severity: Severity | null }) {
  const styles = useStyles()
  if (!severity) {
    return (
      <span className={styles.none} aria-label="No severity">
        —
      </span>
    )
  }
  const Icon = severity === 'Critical' ? Warning16Filled : Warning16Regular
  return (
    <span className={styles.severity} style={{ color: severityColors[severity] }}>
      <Icon aria-hidden />
      {severity}
    </span>
  )
}

export function PriorityTag({ priority }: { priority: Priority }) {
  const styles = useStyles()
  return <span className={styles.priority}>{priorityLabel(priority)}</span>
}

export function TypeIcon({ type, small = false }: { type: TicketType; small?: boolean }) {
  const styles = useStyles()
  return (
    <span
      className={mergeClasses(styles.typeIcon, type === 'Enhancement' && styles.enhancement, small && styles.small)}
      title={type}
    >
      {type === 'Defect' ? <Bug16Regular aria-hidden /> : <Lightbulb16Regular aria-hidden />}
      <span className={styles.srOnly}>{type}</span>
    </span>
  )
}

/** Avatar and name, or "Unassigned" in grey italics. */
export function PersonLabel({ person, emptyText = 'Unassigned' }: { person: PersonDto | null; emptyText?: string }) {
  const styles = useStyles()
  if (!person) return <span className={styles.unassigned}>{emptyText}</span>
  return (
    <span className={styles.person}>
      <PersonAvatar name={person.displayName} initials={person.initials} size={24} />
      {person.displayName}
    </span>
  )
}
