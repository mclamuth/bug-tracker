/** The "@name" being typed just before the caret: where its "@" is and what follows it. */
export interface MentionQuery {
  start: number
  query: string
}

/**
 * Finds a mention in progress: an "@" at the start or after a space, followed by up to 30 characters
 * with no line break or second "@", ending at the caret. "email@cta.org" doesn't count.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const match = /(^|\s)@([^@\n]{0,30})$/.exec(before)
  if (!match) return null
  const query = match[2] ?? ''
  if (query.startsWith(' ')) return null
  return { start: before.length - query.length - 1, query }
}

/** People whose name matches what's typed after "@": any word of the name starting with it, first names first. */
export function matchPeople<T extends { displayName: string }>(people: T[], query: string, limit = 6): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return people.slice(0, limit)
  const scored = people
    .map((p) => {
      const name = p.displayName.toLowerCase()
      const score = name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : -1
      return { p, score }
    })
    .filter((x) => x.score >= 0)
  return scored
    .sort((a, b) => a.score - b.score || a.p.displayName.localeCompare(b.p.displayName))
    .slice(0, limit)
    .map((x) => x.p)
}

/** Replaces the "@query" with "@Full Name " and says where the caret goes. */
export function insertMention(text: string, mention: MentionQuery, caret: number, name: string) {
  const inserted = `@${name} `
  const next = text.slice(0, mention.start) + inserted + text.slice(caret).replace(/^ /, '')
  return { text: next, caret: mention.start + inserted.length }
}
