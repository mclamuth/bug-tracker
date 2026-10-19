import {
  Avatar,
  Button,
  Caption1,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  Title2,
  tokens,
} from '@fluentui/react-components'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { roleLabel, type UserDto } from '../api/types'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from './authContext'

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '32px 16px',
    background: 'linear-gradient(145deg, #f4f7fa, #e8f1f8)',
  },
  card: {
    width: '440px',
    maxWidth: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    padding: '40px 36px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'center',
  },
  brand: { display: 'grid', justifyItems: 'center', gap: '8px' },
  tagline: { color: tokens.colorNeutralForeground3 },
  msButton: { height: '44px' },
  msLogo: { width: '19px', height: '19px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' },
  people: { display: 'grid', gap: '4px', textAlign: 'left' },
  members: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' },
  groupLabel: { color: tokens.colorNeutralForeground3, marginTop: '8px' },
  person: { justifyContent: 'flex-start', height: 'auto', padding: '8px 10px', gap: '10px', minWidth: 0 },
  personText: { display: 'grid', textAlign: 'left' },
  footer: {
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground4,
  },
})

/** Sign-in page: Microsoft sign-in in Entra mode, or a "sign in as" list in local development. */
export function SignInPage() {
  const styles = useStyles()
  const { mode, error, signInWithMicrosoft } = useAuth()

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <BrandLogo variant="blue" width={220} />
          <Title2 as="h1">ISSD Bug Tracker</Title2>
          <Text className={styles.tagline}>Track defects and enhancements for ISSD applications</Text>
        </div>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {mode === 'Entra' && (
          <>
            <Button className={styles.msButton} size="large" onClick={() => void signInWithMicrosoft()}>
              <span className={styles.msLogo} aria-hidden="true">
                <i style={{ background: '#f25022' }} />
                <i style={{ background: '#7fba00' }} />
                <i style={{ background: '#00a4ef' }} />
                <i style={{ background: '#ffb900' }} />
              </span>
              &nbsp;Sign in with Microsoft
            </Button>
            <Caption1 className={styles.tagline}>Use your CTA Microsoft work account to continue.</Caption1>
          </>
        )}

        {mode === 'Development' && <DevelopmentSignIn />}
        {mode === null && !error && <Spinner label="Loading…" />}

        <Caption1 className={styles.footer}>CTA · Information Systems &amp; Services Division</Caption1>
      </div>
    </main>
  )
}

function DevelopmentSignIn() {
  const styles = useStyles()
  const { signInAsDeveloper } = useAuth()
  const people = useQuery({
    queryKey: ['dev-sign-in-options'],
    queryFn: () => apiFetch<UserDto[]>('/api/v1/dev/sign-in-options'),
  })

  if (people.isPending) return <Spinner label="Loading the team…" />
  if (people.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>Could not load the team. Is the API running?</MessageBarBody>
      </MessageBar>
    )
  }

  const groups: [string, UserDto[]][] = [
    ['Developers', people.data.filter((p) => p.isDeveloper)],
    ['ICAs', people.data.filter((p) => p.isIca && !p.isDeveloper)],
    ['ISSD Supervisor', people.data.filter((p) => p.isSupervisor)],
  ]

  return (
    <>
      <MessageBar intent="warning">
        <MessageBarBody>Development sign-in: local use only. Pick who you want to test as.</MessageBarBody>
      </MessageBar>
      <div className={styles.people} role="group" aria-label="Sign in as">
        {groups.map(([label, members]) => (
          <div key={label}>
            <Subtitle2 as="h2" className={styles.groupLabel} block>
              {label}
            </Subtitle2>
            <div className={styles.members}>
              {members.map((person) => (
                <Button
                  key={person.id}
                  appearance="subtle"
                  className={styles.person}
                  onClick={() => signInAsDeveloper(person.id)}
                  icon={<Avatar name={person.displayName} size={32} color="colorful" />}
                >
                  <span className={styles.personText}>
                    <Text weight="semibold">{person.displayName}</Text>
                    <Caption1>{roleLabel(person)}</Caption1>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
