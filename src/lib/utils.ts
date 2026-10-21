export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((completed / total) * 100))
}

export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) code += alphabet[b % alphabet.length]
  return code
}

export function startOfWeekUtc(d = new Date()): Date {
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - diff)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

type Phrase = (key: 'time.justNow' | 'time.minutesAgo' | 'time.hoursAgo', vars?: Record<string, string | number>) => string

export function dateLocale(locale: string): string {
  return locale === 'my' ? 'my-MM' : 'en'
}

export function formatRelative(iso: string, t: Phrase, locale = 'en'): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.round((now - then) / 1000)
  if (sec < 60) return t('time.justNow')
  const min = Math.round(sec / 60)
  if (min < 60) return t('time.minutesAgo', { count: min })
  const hr = Math.round(min / 60)
  if (hr < 48) return t('time.hoursAgo', { count: hr })
  return new Date(iso).toLocaleDateString(dateLocale(locale), { month: 'short', day: 'numeric' })
}

/** Absolute created timestamp for comments (always shown). */
export function formatTimestamp(iso: string, locale = 'en'): string {
  return new Date(iso).toLocaleString(dateLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export type CommentTreeNode<T extends { id: string; parent_id?: string | null; created_at: string }> = T & {
  children: CommentTreeNode<T>[]
}

/** Build a Reddit-style branch tree; orphans (missing parent in set) become roots. */
export function buildCommentTree<T extends { id: string; parent_id?: string | null; created_at: string }>(
  comments: T[],
): CommentTreeNode<T>[] {
  const map = new Map<string, CommentTreeNode<T>>()
  for (const c of comments) {
    map.set(c.id, { ...c, parent_id: c.parent_id ?? null, children: [] })
  }

  const roots: CommentTreeNode<T>[] = []
  for (const node of map.values()) {
    const parentId = node.parent_id
    if (parentId && map.has(parentId) && parentId !== node.id) {
      map.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortRecursive = (nodes: CommentTreeNode<T>[]) => {
    nodes.sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (const n of nodes) sortRecursive(n.children)
  }
  sortRecursive(roots)
  return roots
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
