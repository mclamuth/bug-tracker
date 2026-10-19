import { Home20Regular } from '@fluentui/react-icons'
import { useState } from 'react'
import { useMe } from '../api/queries'
import { roleLabel } from '../api/types'
import { ComingSoon } from '../components/ComingSoon'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'
import { greeting } from '../utils/greeting'

export function MyWorkPage() {
  const page = usePageStyles()
  const me = useMe()
  const [now] = useState(() => new Date())
  const firstName = me.data?.displayName.split(' ')[0] ?? ''

  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Home / My Work"
        title={`${greeting(now)}, ${firstName}`}
        description="Here’s what needs your attention today."
      />
      <ComingSoon icon={<Home20Regular />} title="Your dashboard is on the way">
        You’re signed in as {me.data?.displayName} ({me.data ? roleLabel(me.data) : ''}). The role-based My Work
        dashboard arrives in Milestone 6, once tickets exist.
      </ComingSoon>
    </div>
  )
}
