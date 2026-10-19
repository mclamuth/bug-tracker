import { Button } from '@fluentui/react-components'
import { Add20Regular, TaskListLtr20Regular } from '@fluentui/react-icons'
import { useNavigate } from 'react-router'
import { ComingSoon } from '../components/ComingSoon'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'

export function TicketsPage() {
  const page = usePageStyles()
  const navigate = useNavigate()
  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Tickets / All Tickets"
        title="All Tickets"
        description="Track defects and enhancements across ISSD applications."
        action={
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => void navigate('/tickets/new')}>
            New Ticket
          </Button>
        }
      />
      <ComingSoon icon={<TaskListLtr20Regular />} title="The ticket list arrives in Milestone 3">
        Quick views, filters, sorting and paging will live here.
      </ComingSoon>
    </div>
  )
}

export function NewTicketPage() {
  const page = usePageStyles()
  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Tickets / New Ticket"
        title="Create a new ticket"
        description="Provide enough detail for the team to understand and reproduce the issue."
      />
      <ComingSoon icon={<Add20Regular />} title="The ticket form arrives in Milestone 3">
        The database and workflow are ready; the form comes with the core screens.
      </ComingSoon>
    </div>
  )
}
