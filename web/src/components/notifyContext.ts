import type { ToastIntent } from '@fluentui/react-components'
import { createContext, useContext } from 'react'

export type Notify = (title: string, options?: { body?: string; intent?: ToastIntent }) => void

export const NotifyContext = createContext<Notify>(() => {})

/** Shows a short confirmation (or warning) in the bottom-right corner. */
export const useNotify = () => useContext(NotifyContext)
