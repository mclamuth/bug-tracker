import { makeStyles, tokens } from '@fluentui/react-components'

/** Shared look for the ticket dialogs (status change, assignment), from the Figma design. */
export const useDialogStyles = makeStyles({
  surface: { width: '500px', maxWidth: 'calc(100vw - 32px)' },
  title: { display: 'flex', alignItems: 'center', gap: '10px' },
  icon: {
    width: '34px',
    height: '34px',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: '#dff6dd',
    color: '#107c10',
  },
  danger: { backgroundColor: '#fde7e9', color: '#b10e1c' },
  content: { display: 'grid', gap: '17px' },
  transition: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '5px',
    backgroundColor: '#f7f7f7',
  },
  dangerButton: {
    backgroundColor: '#c50f1f',
    color: tokens.colorNeutralForegroundOnBrand,
    ':hover': { backgroundColor: '#a80000', color: tokens.colorNeutralForegroundOnBrand },
    ':hover:active': { backgroundColor: '#8b0000', color: tokens.colorNeutralForegroundOnBrand },
  },
  error: { color: tokens.colorPaletteRedForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
})
