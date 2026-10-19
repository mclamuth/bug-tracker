import { makeStyles, Subtitle1, Text, tokens } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  box: {
    padding: '64px 24px',
    display: 'grid',
    justifyItems: 'center',
    gap: '8px',
    textAlign: 'center',
  },
  icon: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  text: { color: tokens.colorNeutralForeground3, maxWidth: '520px' },
})

/** Placeholder for screens that arrive in a later milestone. */
export function ComingSoon({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const styles = useStyles()
  const page = usePageStyles()
  return (
    <section className={`${page.panel} ${styles.box}`}>
      <span className={styles.icon}>{icon}</span>
      <Subtitle1 as="h2">{title}</Subtitle1>
      <Text className={styles.text}>{children}</Text>
    </section>
  )
}
