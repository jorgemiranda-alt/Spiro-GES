/** Project-number search over the employee's own assigned projects. Pure, so it stays easy to test. */

export interface SearchableProject {
  /** Project number. Always a string: leading zeros and punctuation are kept as written. */
  code: string
}

/** Most rows the list renders at once; the rest are reached by typing more of the number. */
export const MAX_RESULTS = 50

const norm = (v: string) => v.trim().toLocaleLowerCase()

/** 0 = exact, 1 = starts with the query, 2 = contains it, -1 = no match. */
export function matchRank(code: string, query: string): number {
  const c = norm(code), q = norm(query)
  if (!q || !c.includes(q)) return -1
  if (c === q) return 0
  return c.startsWith(q) ? 1 : 2
}

/**
 * Matches by project number only: exact first, then prefix, then other substrings.
 * Ties keep the order of `items`, so the list does not shuffle as the employee types.
 * An empty or whitespace-only query returns nothing.
 */
export function searchProjects<T extends SearchableProject>(items: readonly T[], query: string): T[] {
  if (!norm(query)) return []
  const ranked: { item: T; rank: number; at: number }[] = []
  items.forEach((item, at) => {
    const rank = matchRank(item.code, query)
    if (rank >= 0) ranked.push({ item, rank, at })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.at - b.at).map(x => x.item)
}
