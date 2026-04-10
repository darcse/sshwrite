type DocLike = { order_index: number; parent_id: string | null }

export function sortByOrder<T extends DocLike>(docs: T[]): T[] {
  return [...docs].sort((a, b) => a.order_index - b.order_index)
}

export function getChildren<T extends DocLike>(docs: T[], parentId: string | null): T[] {
  return sortByOrder(docs.filter((d) => d.parent_id === parentId))
}

export function tiptapToPlainText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const visit = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const o = node as { text?: string; content?: unknown[] }
    const text = typeof o.text === 'string' ? o.text : ''
    const children = Array.isArray(o.content) ? o.content.map(visit).join(' ') : ''
    return `${text} ${children}`.trim()
  }
  return visit(raw).replace(/\s+/g, ' ').trim()
}
