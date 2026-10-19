import { Avatar, makeStyles } from '@fluentui/react-components'

// Light blue with blue initials, as in the Figma design.
const useStyles = makeStyles({
  initials: { backgroundColor: '#d8e7f5', color: '#0f548c', boxShadow: 'inset 0 0 0 1px #c1d9ed' },
})

export function PersonAvatar({ name, initials, size }: { name: string; initials?: string; size: 24 | 32 }) {
  const styles = useStyles()
  return <Avatar name={name} size={size} initials={{ children: initials, className: styles.initials }} />
}
