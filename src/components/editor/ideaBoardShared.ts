export type IdeaStatus = 'pending' | 'converted'

export type IdeaCardRow = {
  id: string
  content: string
  created_at: string
  status: IdeaStatus
}

export type PermanentCardType = 'event' | 'character' | 'worldview' | 'place'

export type PermanentCardRow = {
  id: string
  note_number: string
  type: PermanentCardType
  title: string
  created_at: string
  exported_at: string | null
  sections: Record<string, string>
}

export type PermFormState =
  | {
      mode: 'create'
      ideaId: string
      note_number: string
      type: PermanentCardType
      title: string
      sections: Record<string, string>
    }
  | {
      mode: 'edit'
      id: string
      note_number: string
      type: PermanentCardType
      title: string
      exported_at?: string | null
      sections: Record<string, string>
    }

export const PERMANENT_SECTION_KEYS: Record<PermanentCardType, string[]> = {
  event: ['사건', '맥락', '전개', '여파', '파생'],
  character: ['인물', '욕망', '갈등', '관계', '파생'],
  worldview: ['설정', '작동 원리', '모순과 긴장', '파생'],
  place: ['장소', '분위기', '역할', '파생'],
}

const PERMANENT_DB_TYPE_KO = ['사건', '캐릭터', '세계관', '장소'] as const
type PermanentDbTypeKo = (typeof PERMANENT_DB_TYPE_KO)[number]
const PERMANENT_EN_TO_DB_KO: Record<PermanentCardType, PermanentDbTypeKo> = {
  event: '사건',
  character: '캐릭터',
  worldview: '세계관',
  place: '장소',
}
const PERMANENT_DB_KO_TO_EN: Record<PermanentDbTypeKo, PermanentCardType> = {
  사건: 'event',
  캐릭터: 'character',
  세계관: 'worldview',
  장소: 'place',
}

export function typeStringForPermanentInsert(formType: PermanentCardType): string {
  let t: string = PERMANENT_EN_TO_DB_KO[formType] ?? String(formType).trim()
  if (!(PERMANENT_DB_TYPE_KO as readonly string[]).includes(t)) t = '사건'
  return t
}

export function nextIndependentNoteNumber(existing: Iterable<string>): string {
  let mx = 0
  for (const n of existing) {
    const t = typeof n === 'string' ? n.trim() : ''
    if (/^\d+$/.test(t)) {
      const v = parseInt(t, 10)
      if (Number.isFinite(v) && v > mx) mx = v
    }
  }
  return String(mx + 1).padStart(4, '0')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextNoteNumberForCreate(
  parentNoteNumber: string | null | undefined,
  existingNoteNumbers: Iterable<string>,
  excludeNoteNumbers?: Iterable<string> | null
): string {
  const exclude = new Set(
    [...(excludeNoteNumbers ?? [])]
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter(Boolean)
  )
  const existing = new Set(
    [...existingNoteNumbers]
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter(Boolean)
      .filter((n) => !exclude.has(n))
  )
  if (!parentNoteNumber || !String(parentNoteNumber).trim()) {
    return nextIndependentNoteNumber(existing)
  }
  const P = String(parentNoteNumber).trim()
  const last = P[P.length - 1] ?? ''
  const lastIsDigit = /[0-9]/.test(last)
  const lastIsLetter = /[a-zA-Z]/.test(last)

  if (lastIsDigit) {
    const re = new RegExp(`^${escapeRegExp(P)}([a-z])$`, 'i')
    let maxCode = 96
    for (const n of existing) {
      const m = n.match(re)
      if (m) {
        const code = m[1].toLowerCase().charCodeAt(0)
        if (code > maxCode) maxCode = code
      }
    }
    if (maxCode < 97) return P + 'a'
    const nextCode = maxCode + 1
    if (nextCode <= 122) return P + String.fromCharCode(nextCode)
    let maxTail = 0
    const reZ = new RegExp(`^${escapeRegExp(P)}z(\\d+)$`)
    for (const n of existing) {
      const m = n.match(reZ)
      if (m) {
        const v = parseInt(m[1], 10)
        if (Number.isFinite(v) && v > maxTail) maxTail = v
      }
    }
    return P + 'z' + String(maxTail + 1)
  }

  if (lastIsLetter) {
    const re = new RegExp(`^${escapeRegExp(P)}(\\d+)$`)
    let maxNum = 0
    for (const n of existing) {
      const m = n.match(re)
      if (m) {
        const v = parseInt(m[1], 10)
        if (Number.isFinite(v) && v > maxNum) maxNum = v
      }
    }
    return P + String(maxNum + 1)
  }

  return nextIndependentNoteNumber(existing)
}

export function normalizeSections(
  cardType: PermanentCardType,
  raw: Record<string, unknown> | null | undefined
): Record<string, string> {
  const keys = PERMANENT_SECTION_KEYS[cardType]
  const out: Record<string, string> = {}
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined
  for (const k of keys) {
    if (k === '파생') {
      const usable = (v: unknown) => {
        if (v === undefined || v === null) return false
        if (typeof v === 'string') return v.trim().length > 0
        if (Array.isArray(v)) return v.length > 0
        return true
      }
      let picked: unknown
      if (o) {
        if (usable(o['파생 사건'])) picked = o['파생 사건']
        else if (usable(o['파생 질문'])) picked = o['파생 질문']
        else if (usable(o['파생'])) picked = o['파생']
        else picked = undefined
      } else picked = undefined
      if (picked === undefined) {
        out[k] = ''
      } else if (Array.isArray(picked)) {
        out[k] = picked.map((x) => (typeof x === 'string' ? x : String(x))).join('\n')
      } else if (typeof picked === 'string') {
        out[k] = picked
      } else {
        out[k] = ''
      }
      continue
    }
    const v = o ? o[k] : undefined
    out[k] = typeof v === 'string' ? v : ''
  }
  return out
}

export function parsePermanentRow(r: Record<string, unknown>): PermanentCardRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const note_number = typeof r.note_number === 'string' ? r.note_number : ''
  const rawT = typeof r.type === 'string' ? r.type.trim() : ''
  let typ: PermanentCardType
  if ((PERMANENT_DB_TYPE_KO as readonly string[]).includes(rawT)) {
    typ = PERMANENT_DB_KO_TO_EN[rawT as PermanentDbTypeKo]
  } else if (['event', 'character', 'worldview', 'place'].includes(rawT)) {
    typ = rawT as PermanentCardType
  } else return null
  const title = typeof r.title === 'string' ? r.title : ''
  if (!id) return null
  const sections = normalizeSections(
    typ,
    r.sections as Record<string, unknown> | null | undefined
  )
  return {
    id,
    note_number,
    type: typ,
    title,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    exported_at: typeof r.exported_at === 'string' ? r.exported_at : null,
    sections,
  }
}

export function isWritePermanentSectionsUnavailable(err: {
  code?: string
  message?: string
} | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42703') return true
  const m = (err.message ?? '').toLowerCase()
  if (!m.includes('sections')) return false
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('unknown column')
  )
}

export function isWriteIdeaStatusColumnUnavailable(err: {
  code?: string
  message?: string
} | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42703') return true
  const m = (err.message ?? '').toLowerCase()
  if (!m.includes('status')) return false
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('unknown column')
  )
}

export type TreeNode = {
  segment: string
  notePath: string
  card: PermanentCardRow | null
  children: Map<string, TreeNode>
}

export function sortSegmentKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    const aNum = Number.isFinite(na) && String(na) === a
    const bNum = Number.isFinite(nb) && String(nb) === b
    if (aNum && bNum) return na - nb
    return a.localeCompare(b, 'ko', { numeric: true })
  })
}

export function buildTree(cards: PermanentCardRow[]) {
  const root = new Map<string, TreeNode>()
  for (const card of cards) {
    const segs = card.note_number.split('.').filter((s) => s.length > 0)
    if (segs.length === 0) continue
    let cur = root
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      if (!cur.has(s)) {
        const path = segs.slice(0, i + 1).join('.')
        cur.set(s, { segment: s, notePath: path, card: null, children: new Map() })
      }
      const node = cur.get(s)!
      if (i === segs.length - 1) node.card = card
      cur = node.children
    }
  }
  return root
}

function longestStrictPrefixParent(
  childNote: string,
  cards: PermanentCardRow[]
): PermanentCardRow | null {
  let best: PermanentCardRow | null = null
  let bestLen = -1
  for (const p of cards) {
    const pn = p.note_number
    if (childNote === pn) continue
    if (childNote.length <= pn.length) continue
    if (!childNote.startsWith(pn)) continue
    if (pn.length > bestLen) {
      bestLen = pn.length
      best = p
    }
  }
  return best
}

export function buildZettelkastenTree(cards: PermanentCardRow[]): Map<string, TreeNode> {
  if (cards.length === 0) return new Map()
  const sorted = [...cards].sort((a, b) =>
    a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
  )
  const parentById = new Map<string, PermanentCardRow | null>()
  for (const c of sorted) {
    parentById.set(c.id, longestStrictPrefixParent(c.note_number, sorted))
  }

  function buildNode(card: PermanentCardRow): TreeNode {
    const childCards = sorted.filter((x) => parentById.get(x.id)?.id === card.id)
    const childKeys = sortSegmentKeys(childCards.map((ch) => ch.note_number))
    const children = new Map<string, TreeNode>()
    const byNote = new Map(childCards.map((ch) => [ch.note_number, ch]))
    for (const note of childKeys) {
      const ch = byNote.get(note)!
      children.set(note, buildNode(ch))
    }
    return {
      segment: card.note_number,
      notePath: card.note_number,
      card,
      children,
    }
  }

  const roots = sorted.filter((c) => parentById.get(c.id) == null)
  const root = new Map<string, TreeNode>()
  const rootKeys = sortSegmentKeys(roots.map((r) => r.note_number))
  const rootByNote = new Map(roots.map((r) => [r.note_number, r]))
  for (const note of rootKeys) {
    root.set(note, buildNode(rootByNote.get(note)!))
  }
  return root
}

export function typeLabel(t: PermanentCardType) {
  if (t === 'event') return '사건'
  if (t === 'character') return '캐릭터'
  if (t === 'worldview') return '세계관'
  return '장소'
}
