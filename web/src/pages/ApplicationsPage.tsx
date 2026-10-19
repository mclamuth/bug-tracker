import {
  Badge,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
  Tooltip,
} from '@fluentui/react-components'
import { Apps20Regular, Open16Regular } from '@fluentui/react-icons'
import { useApplications } from '../api/queries'
import { PageHeader } from '../components/PageHeader'
import { PersonAvatar } from '../components/PersonAvatar'
import { usePageStyles } from '../components/pageStyles'

const useStyles = makeStyles({
  name: { display: 'flex', alignItems: 'center', gap: '10px', color: tokens.colorBrandForeground1 },
  nameIcon: {
    width: '30px',
    height: '30px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
  person: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  muted: { color: tokens.colorNeutralForeground3 },
  inactive: { color: tokens.colorNeutralForeground4 },
  note: { marginBottom: '16px' },
})

/** Read-only list for now; adding and editing applications comes with Milestone 4. */
export function ApplicationsPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const apps = useApplications()

  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Administration / Applications"
        title="Applications"
        description="Tracked applications, their default developer and app launcher links."
      />

      <MessageBar className={styles.note}>
        <MessageBarBody>Adding and editing applications and launcher links arrives in Milestone 4.</MessageBarBody>
      </MessageBar>

      <section className={page.panel}>
        {apps.isPending && <Spinner label="Loading applications…" style={{ padding: 32 }} />}
        {apps.isError && (
          <MessageBar intent="error">
            <MessageBarBody>Could not load applications: {apps.error.message}</MessageBarBody>
          </MessageBar>
        )}
        {apps.isSuccess && (
          <Table aria-label="Applications">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Default assignee</TableHeaderCell>
                <TableHeaderCell>Open tickets</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.data.map((app) => (
                <TableRow key={app.id} className={app.isActive ? undefined : styles.inactive}>
                  <TableCell>
                    <span className={styles.name}>
                      <span className={styles.nameIcon}>
                        <Apps20Regular />
                      </span>
                      <Text weight="semibold">{app.name}</Text>
                      {app.launcherUrl && (
                        <Tooltip content="In the app launcher" relationship="label">
                          <Open16Regular className={styles.muted} />
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{app.description}</TableCell>
                  <TableCell>
                    {app.defaultAssigneeName ? (
                      <span className={styles.person}>
                        <PersonAvatar name={app.defaultAssigneeName} size={24} />
                        {app.defaultAssigneeName}
                      </span>
                    ) : (
                      <Text italic className={styles.muted}>
                        None
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge appearance="tint" shape="circular">
                      {app.openTickets}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge appearance="tint" color={app.isActive ? 'success' : 'subtle'}>
                      {app.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
