import { makeStyles, tokens } from '@fluentui/react-components'

/** Shared page padding and the white bordered panel used across screens. */
export const usePageStyles = makeStyles({
  page: { padding: '28px 32px 48px', maxWidth: '1600px', margin: '0 auto' },
  panel: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
})
