import { Toast, ToastBody, Toaster, ToastTitle, useId, useToastController } from '@fluentui/react-components'
import { useCallback, type ReactNode } from 'react'
import { NotifyContext, type Notify } from './notifyContext'

/** Hosts the toast area (bottom right) and lets any screen show a short confirmation. */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const toasterId = useId('toaster')
  const { dispatchToast } = useToastController(toasterId)

  const notify = useCallback<Notify>(
    (title, { body, intent = 'success' } = {}) =>
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
          {body && <ToastBody>{body}</ToastBody>}
        </Toast>,
        { intent, timeout: intent === 'success' ? 4000 : 8000 },
      ),
    [dispatchToast],
  )
  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Toaster toasterId={toasterId} position="bottom-end" />
    </NotifyContext.Provider>
  )
}
