import { Caption1, makeStyles, Text, Title2, tokens } from '@fluentui/react-components'
import type { ReactNode } from 'react'

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '24px',
    marginBottom: '22px',
  },
  breadcrumb: { color: tokens.colorNeutralForeground3 },
  description: { color: tokens.colorNeutralForeground3, display: 'block', marginTop: '4px' },
})

export function PageHeader({
  breadcrumb,
  title,
  description,
  action,
}: {
  breadcrumb?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  const styles = useStyles()
  return (
    <div className={styles.header}>
      <div>
        {breadcrumb && <Caption1 className={styles.breadcrumb}>{breadcrumb}</Caption1>}
        <Title2 as="h1" block>
          {title}
        </Title2>
        {description && <Text className={styles.description}>{description}</Text>}
      </div>
      {action}
    </div>
  )
}
