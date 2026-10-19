import type { ApplicationDto } from '../api/types'

/** Apps shown in the launcher: active, with a link, sorted A–Z, optionally filtered by name. */
export function launcherApps(apps: ApplicationDto[], search: string): ApplicationDto[] {
  const term = search.trim().toLowerCase()
  return apps
    .filter((a) => a.isActive && a.launcherUrl)
    .filter((a) => term === '' || a.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
}
