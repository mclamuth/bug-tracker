import { useEffect } from 'react'

const APP = 'ISSD Bug Tracker'

/** Sets the browser tab's title ("BT-1042 Mileage total doubles · ISSD Bug Tracker") while the page is shown. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
    return () => {
      document.title = APP
    }
  }, [title])
}
