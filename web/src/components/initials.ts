/** "Max Caber" → "MC", matching DirectoryService.Initials on the server. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return (parts[0]!.slice(0, 1) + parts.at(-1)!.slice(0, 1)).toUpperCase()
}
