import { makeStyles, mergeClasses, Text, Textarea, tokens, useId, type TextareaProps } from '@fluentui/react-components'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useUsers } from '../api/queries'
import { roleLabel } from '../api/types'
import { PersonAvatar } from '../components/PersonAvatar'
import { findMentionQuery, insertMention, matchPeople, type MentionQuery } from './mentions'

const useStyles = makeStyles({
  wrap: { position: 'relative' },
  menu: {
    position: 'absolute',
    zIndex: 8,
    left: '8px',
    top: 'calc(100% - 6px)',
    width: '270px',
    display: 'grid',
    padding: '5px',
    margin: 0,
    listStyle: 'none',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: '0 8px 20px rgba(0,0,0,.14)',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '7px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  active: { backgroundColor: tokens.colorNeutralBackground1Hover },
  who: { display: 'grid', gap: '2px' },
  muted: { color: tokens.colorNeutralForeground3 },
})

/**
 * A comment box that suggests teammates after "@". Arrow keys move through the list, Enter or Tab picks,
 * Escape closes it. Picking inserts "@Full Name", which is what the server recognises as a mention.
 */
export function MentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  ...props
}: Omit<TextareaProps, 'value' | 'onChange'> & { value: string; onValueChange: (value: string) => void }) {
  const styles = useStyles()
  const listId = useId('mentions')
  const users = useUsers()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionQuery | null>(null)
  const [active, setActive] = useState(0)

  const options = mention ? matchPeople(users.data ?? [], mention.query) : []
  const open = options.length > 0

  const track = (text: string, caret: number) => {
    const next = findMentionQuery(text, caret)
    setMention(next)
    if (next?.query !== mention?.query) setActive(0)
  }

  const pick = (name: string) => {
    const el = ref.current
    if (!mention || !el) return
    const result = insertMention(value, mention, el.selectionStart, name)
    onValueChange(result.text)
    setMention(null)
    // Put the caret after the inserted name once React has updated the box.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.caret, result.caret)
    })
  }

  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
        return
      }
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Tab') {
        e.preventDefault()
        pick(options[active]!.displayName)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation() // don't also close a surrounding dialog
        setMention(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className={styles.wrap}>
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(e, d) => {
          onValueChange(d.value)
          track(d.value, e.target.selectionStart)
        }}
        onKeyDown={keyDown}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) track(value, e.currentTarget.selectionStart)
        }}
        onClick={(e) => track(value, e.currentTarget.selectionStart)}
        onBlur={() => setMention(null)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label="Mention a teammate" className={styles.menu}>
          {options.map((person, i) => (
            <li
              key={person.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={mergeClasses(styles.option, i === active && styles.active)}
              // mousedown, not click: the box would lose focus (and close the list) first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(person.displayName)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <PersonAvatar name={person.displayName} initials={person.initials} size={24} />
              <span className={styles.who}>
                <Text weight="semibold">{person.displayName}</Text>
                <Text size={200} className={styles.muted}>
                  {roleLabel(person)}
                </Text>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
