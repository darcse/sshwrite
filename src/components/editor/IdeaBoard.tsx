'use client'

import { createClient } from '@/lib/supabase/client'
import { GitBranch, LayoutGrid, Lightbulb, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type IdeaStatus = 'pending' | 'converted'

type IdeaCardRow = {
  id: string
  content: string
  created_at: string
  status: IdeaStatus
}

export type PermanentCardType = 'event' | 'character' | 'worldview' | 'place'

type PermanentCardRow = {
  id: string
  note_number: string
  type: PermanentCardType
  title: string
  created_at: string
  sections: Record<string, string>
}

type PermFormState =
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

function typeStringForPermanentInsert(formType: PermanentCardType): string {
  let t: string = PERMANENT_EN_TO_DB_KO[formType] ?? String(formType).trim()
  console.log(t, JSON.stringify(t))
  if (!(PERMANENT_DB_TYPE_KO as readonly string[]).includes(t)) t = '사건'
  return t
}

function nextIndependentNoteNumber(existing: Iterable<string>): string {
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

function resolveNoteNumberFromApi(candidate: string, existingNoteNumbers: Set<string>): string {
  const c = candidate.trim()
  if (c && !existingNoteNumbers.has(c)) return c
  return nextIndependentNoteNumber(existingNoteNumbers)
}

function normalizeSections(
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
  console.log('normalizeSections input:', raw)
  console.log('normalizeSections output:', out)
  return out
}

function parsePermanentRow(r: Record<string, unknown>): PermanentCardRow | null {
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
    sections,
  }
}

function isWritePermanentSectionsUnavailable(err: {
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

type TreeNode = {
  segment: string
  notePath: string
  card: PermanentCardRow | null
  children: Map<string, TreeNode>
}

function sortSegmentKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    const aNum = Number.isFinite(na) && String(na) === a
    const bNum = Number.isFinite(nb) && String(nb) === b
    if (aNum && bNum) return na - nb
    return a.localeCompare(b, 'ko', { numeric: true })
  })
}

function buildTree(cards: PermanentCardRow[]) {
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

function typeLabel(t: PermanentCardType) {
  if (t === 'event') return '사건'
  if (t === 'character') return '캐릭터'
  if (t === 'worldview') return '세계관'
  return '장소'
}

function PermTreeNodes({
  nodes,
  depth,
  onPick,
}: {
  nodes: Map<string, TreeNode>
  depth: number
  onPick: (c: PermanentCardRow) => void
}) {
  const keys = sortSegmentKeys([...nodes.keys()])
  return (
    <ul className="space-y-1" style={{ paddingLeft: depth ? 12 : 0 }}>
      {keys.map((k) => {
        const n = nodes.get(k)!
        return (
          <li key={n.notePath} className="text-sm">
            {n.card ? (
              <button
                type="button"
                onClick={() => onPick(n.card!)}
                className="w-full rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--badge-bg)]"
              >
                <span className="text-xs text-[var(--muted)]">{n.card.note_number}</span>{' '}
                <span className="text-xs text-[var(--muted)]">
                  [{typeLabel(n.card.type)}]
                </span>{' '}
                <span className="font-medium">{n.card.title}</span>
              </button>
            ) : (
              <div className="py-0.5 text-xs text-[var(--muted)]">{n.notePath}</div>
            )}
            {n.children.size > 0 ? (
              <PermTreeNodes nodes={n.children} depth={depth + 1} onPick={onPick} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function IdeaBoard({
  projectId,
  open,
  onClose,
}: {
  projectId: string
  open: boolean
  onClose: () => void
}) {
  const [ideaDraft, setIdeaDraft] = useState('')
  const [ideas, setIdeas] = useState<IdeaCardRow[]>([])
  const [permanent, setPermanent] = useState<PermanentCardRow[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [rightView, setRightView] = useState<'card' | 'tree'>('card')
  const [typeFilter, setTypeFilter] = useState<PermanentCardType | 'all'>('all')
  const [ideaFilter, setIdeaFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [permForm, setPermForm] = useState<PermFormState | null>(null)
  const [transformIdeaId, setTransformIdeaId] = useState<string | null>(null)
  const [aiErr, setAiErr] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoadErr(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoadErr('로그인이 필요합니다.')
      return
    }
    const irStatus = await supabase
      .from('write_idea_cards')
      .select('id,content,created_at,status')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const ir = irStatus.error
      ? await supabase
          .from('write_idea_cards')
          .select('id,content,created_at')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      : irStatus
    const prWithSections = await supabase
      .from('write_permanent_cards')
      .select('id,note_number,type,title,created_at,sections')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('note_number', { ascending: true })
    const pr =
      prWithSections.error && isWritePermanentSectionsUnavailable(prWithSections.error)
        ? await supabase
            .from('write_permanent_cards')
            .select('id,note_number,type,title,created_at')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .order('note_number', { ascending: true })
        : prWithSections
    if (ir.error) {
      console.warn(
        'write_idea_cards',
        ir.error.message ?? ir.error.code ?? String(ir.error)
      )
      setLoadErr('아이디어를 불러오지 못했습니다.')
    } else {
      const rows = (ir.data as Record<string, unknown>[]) ?? []
      setIdeas(
        rows.map((r) => ({
          id: String(r.id),
          content: typeof r.content === 'string' ? r.content : '',
          created_at: typeof r.created_at === 'string' ? r.created_at : '',
          status: r.status === 'converted' ? 'converted' : 'pending',
        }))
      )
    }
    if (pr.error) {
      console.warn(
        'write_permanent_cards',
        pr.error.message ?? pr.error.code ?? String(pr.error)
      )
      setLoadErr('Permanent 카드를 불러오지 못했습니다.')
    } else {
      const rows = (pr.data as Record<string, unknown>[]) ?? []
      const parsed = rows
        .map((r) => parsePermanentRow(r))
        .filter((x): x is PermanentCardRow => x != null)
      setPermanent(parsed)
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    void loadAll()
  }, [open, loadAll])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (permForm) {
        setPermForm(null)
        setAiErr(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, permForm])

  const displayPermanent = useMemo(() => {
    const arr =
      typeFilter === 'all'
        ? [...permanent]
        : permanent.filter((c) => c.type === typeFilter)
    arr.sort((a, b) =>
      a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
    )
    return arr
  }, [permanent, typeFilter])

  const displayIdeas = useMemo(() => {
    if (ideaFilter === 'all') return ideas
    if (ideaFilter === 'active') return ideas.filter((i) => i.status === 'pending')
    return ideas.filter((i) => i.status === 'converted')
  }, [ideas, ideaFilter])

  const treeRoot = useMemo(() => buildTree(displayPermanent), [displayPermanent])

  async function addIdea() {
    const text = ideaDraft.trim()
    if (!text) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('write_idea_cards')
      .insert({ project_id: projectId, user_id: user.id, content: text })
      .select('id,content,created_at')
      .single()
    if (error) {
      console.warn('write_idea_cards insert', error.message ?? error.code ?? String(error))
      setLoadErr('아이디어를 저장하지 못했습니다.')
      return
    }
    setLoadErr(null)
    const r = data as Record<string, unknown>
    setIdeaDraft('')
    setIdeas((prev) => [
      {
        id: String(r.id),
        content: typeof r.content === 'string' ? r.content : '',
        created_at: typeof r.created_at === 'string' ? r.created_at : '',
        status: r.status === 'converted' ? 'converted' : 'pending',
      },
      ...prev,
    ])
  }

  async function removeIdea(id: string) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('write_idea_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.warn('write_idea_cards delete', error.message ?? error.code ?? String(error))
      return
    }
    setIdeas((prev) => prev.filter((x) => x.id !== id))
  }

  function openPermanentEditor(c: PermanentCardRow) {
    setAiErr(null)
    setPermForm({
      mode: 'edit',
      id: c.id,
      note_number: c.note_number,
      type: c.type,
      title: c.title,
      sections: { ...c.sections },
    })
  }

  async function developIdea(it: IdeaCardRow) {
    if (it.status === 'converted') return
    setTransformIdeaId(it.id)
    setAiErr(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setAiErr('로그인이 필요합니다.')
        return
      }
      const { data: permRows, error: permErr } = await supabase
        .from('write_permanent_cards')
        .select('note_number, type, title')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
      if (permErr) {
        console.warn(
          'write_permanent_cards prefetch',
          permErr.message ?? permErr.code ?? String(permErr)
        )
        setAiErr('Permanent 카드를 불러오지 못했습니다.')
        return
      }
      const existingCards = ((permRows as Record<string, unknown>[]) ?? []).map((r) => ({
        note_number: typeof r.note_number === 'string' ? r.note_number : '',
        type: typeof r.type === 'string' ? r.type : '',
        title: typeof r.title === 'string' ? r.title : '',
      }))
      const existingNoteSet = new Set(
        existingCards.map((x) => x.note_number).filter((n) => n.length > 0)
      )
      const res = await fetch('/api/generate-permanent-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: it.content,
          existingCards,
          projectId,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        id?: string
        note_number?: string
        type?: string
        title?: string
        sections?: Record<string, string>
      }
      if (!res.ok) {
        setAiErr(data.error || '요청에 실패했습니다.')
        return
      }
      const ct = data.type as PermanentCardType
      if (!['event', 'character', 'worldview', 'place'].includes(ct)) {
        setAiErr('응답 형식이 올바르지 않습니다.')
        return
      }
      const sections = normalizeSections(ct, data.sections as Record<string, unknown> | undefined)
      const rawCand = String(data.id ?? data.note_number ?? '').trim()
      const nn = resolveNoteNumberFromApi(rawCand, existingNoteSet)
      setPermForm({
        mode: 'create',
        ideaId: it.id,
        note_number: nn,
        type: ct,
        title: String(data.title ?? '').trim(),
        sections,
      })
    } catch {
      setAiErr('요청 처리 중 오류가 발생했습니다.')
    } finally {
      setTransformIdeaId(null)
    }
  }

  async function savePermForm() {
    if (!permForm) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    let ideaArchiveErr: { message?: string; code?: string } | null = null
    const nn = permForm.note_number.trim()
    const tt = permForm.title.trim()
    if (!nn || !tt) {
      setAiErr('번호와 제목을 입력해 주세요.')
      return
    }
    if (permForm.mode === 'create') {
      const typeForDb = typeStringForPermanentInsert(permForm.type)
      let sectionsFallback = false
      let { data, error } = await supabase
        .from('write_permanent_cards')
        .insert({
          project_id: projectId,
          user_id: user.id,
          note_number: nn,
          type: typeForDb,
          title: tt,
          sections: permForm.sections,
        })
        .select('id,note_number,type,title,created_at,sections')
        .single()
      if (error && isWritePermanentSectionsUnavailable(error)) {
        sectionsFallback = true
        ;({ data, error } = await supabase
          .from('write_permanent_cards')
          .insert({
            project_id: projectId,
            user_id: user.id,
            note_number: nn,
            type: typeForDb,
            title: tt,
          })
          .select('id,note_number,type,title,created_at')
          .single())
      }
      if (error) {
        console.warn('write_permanent_cards insert', error.message ?? error.code ?? String(error))
        setAiErr(
          error.message ? `저장에 실패했습니다: ${error.message}` : '저장에 실패했습니다.'
        )
        return
      }
      const parsed = parsePermanentRow(data as Record<string, unknown>)
      const row =
        parsed && sectionsFallback
          ? { ...parsed, sections: { ...permForm.sections } }
          : parsed
      if (row) {
        setPermanent((prev) =>
          [...prev, row].sort((a, b) =>
            a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
          )
        )
      }
      const { error: ue } = await supabase
        .from('write_idea_cards')
        .update({ status: 'converted' })
        .eq('id', permForm.ideaId)
        .eq('project_id', projectId)
        .eq('user_id', user.id)
      if (ue) {
        ideaArchiveErr = ue
        console.warn('write_idea_cards update', ue.message ?? ue.code ?? String(ue))
        setAiErr(
          ue.message
            ? `아이디어 카드를 아카이브하지 못했습니다: ${ue.message}`
            : '아이디어 카드를 아카이브하지 못했습니다.'
        )
      } else {
        setIdeas((prev) =>
          prev.map((i) => (i.id === permForm.ideaId ? { ...i, status: 'converted' as const } : i))
        )
      }
    } else {
      let { error } = await supabase
        .from('write_permanent_cards')
        .update({
          note_number: nn,
          type: permForm.type,
          title: tt,
          sections: permForm.sections,
        })
        .eq('id', permForm.id)
        .eq('user_id', user.id)
      if (error && isWritePermanentSectionsUnavailable(error)) {
        ;({ error } = await supabase
          .from('write_permanent_cards')
          .update({
            note_number: nn,
            type: permForm.type,
            title: tt,
          })
          .eq('id', permForm.id)
          .eq('user_id', user.id))
      }
      if (error) {
        console.warn('write_permanent_cards update', error.message ?? error.code ?? String(error))
        setAiErr(
          error.message ? `저장에 실패했습니다: ${error.message}` : '저장에 실패했습니다.'
        )
        return
      }
      setPermanent((prev) =>
        prev
          .map((c) =>
            c.id === permForm.id
              ? {
                  ...c,
                  note_number: nn,
                  type: permForm.type,
                  title: tt,
                  sections: { ...permForm.sections },
                }
              : c
          )
          .sort((a, b) =>
            a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
          )
      )
    }
    setPermForm(null)
    if (!ideaArchiveErr) setAiErr(null)
  }

  async function deletePermanentCard() {
    if (!permForm || permForm.mode !== 'edit') return
    if (!window.confirm('이 Permanent 카드를 삭제할까요?')) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('write_permanent_cards')
      .delete()
      .eq('id', permForm.id)
      .eq('user_id', user.id)
    if (error) {
      console.warn('write_permanent_cards delete', error.message ?? error.code ?? String(error))
      setAiErr('삭제에 실패했습니다.')
      return
    }
    setPermanent((prev) => prev.filter((c) => c.id !== permForm.id))
    setPermForm(null)
    setAiErr(null)
  }

  if (!open) return null

  const emptyIdeaHint =
    ideas.length === 0
      ? '아이디어를 입력해보세요'
      : ideaFilter === 'active'
        ? '활성 아이디어가 없습니다'
        : ideaFilter === 'archived'
          ? '아카이브된 아이디어가 없습니다'
          : '아이디어를 입력해보세요'

  return (
    <div
      className="modal-overlay-apple fixed inset-0 z-[530] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idea-board-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-full min-h-0 w-full flex-col bg-[var(--background)] shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[var(--muted)]" aria-hidden />
            <h2 id="idea-board-title" className="text-lg font-semibold text-[var(--foreground)]">
              아이디어 보드
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {loadErr ? (
          <p className="shrink-0 px-4 py-2 text-center text-sm text-red-500">{loadErr}</p>
        ) : null}
        {aiErr && !permForm ? (
          <p className="shrink-0 px-4 py-2 text-center text-sm text-red-500" role="alert">
            {aiErr}
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <section className="flex min-h-0 w-full shrink-0 flex-col border-b border-[var(--border)] md:w-[min(42%,28rem)] md:border-b-0 md:border-r">
            <div className="shrink-0 space-y-2 border-b border-[var(--border)] p-3">
              <textarea
                value={ideaDraft}
                onChange={(e) => setIdeaDraft(e.target.value)}
                placeholder="아이디어를 입력하세요"
                rows={4}
                className="input-apple w-full resize-y px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void addIdea()}
                disabled={!ideaDraft.trim()}
                className="btn-apple btn-apple-primary inline-flex w-full min-h-8 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                추가
              </button>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--border)] px-3 py-2">
              {(
                [
                  ['all', '전체'] as const,
                  ['active', '활성'] as const,
                  ['archived', '아카이브'] as const,
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setIdeaFilter(val)}
                  className={
                    ideaFilter === val
                      ? 'rounded-full bg-[var(--badge-bg)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]'
                      : 'rounded-full border border-transparent px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--border)]'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {displayIdeas.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--muted)]">{emptyIdeaHint}</p>
              ) : (
                displayIdeas.map((it) => (
                  <div
                    key={it.id}
                    className={
                      it.status === 'converted'
                        ? 'rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 text-sm text-[var(--foreground)] opacity-50'
                        : 'rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3 text-sm text-[var(--foreground)]'
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap">{it.content}</p>
                      {it.status === 'converted' ? (
                        <span className="shrink-0 rounded-full bg-[var(--badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          변환 완료
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={it.status === 'converted' || transformIdeaId !== null}
                        onClick={() => void developIdea(it)}
                        className="btn-apple btn-apple-secondary inline-flex min-h-7 min-w-[5.5rem] items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--muted)] disabled:pointer-events-none disabled:opacity-45"
                        title="IDEA-002"
                      >
                        {transformIdeaId === it.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : null}
                        Develope
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeIdea(it.id)}
                        className="inline-flex items-center gap-1 rounded p-1 text-[var(--muted)] hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
              <div
                className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-0.5"
                role="group"
                aria-label="보기 전환"
              >
                <button
                  type="button"
                  onClick={() => setRightView('card')}
                  title="카드 보기"
                  aria-label="카드 보기"
                  aria-pressed={rightView === 'card'}
                  className={
                    rightView === 'card'
                      ? 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--badge-bg)] text-[var(--foreground)]'
                      : 'inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]'
                  }
                >
                  <LayoutGrid className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setRightView('tree')}
                  title="트리 보기"
                  aria-label="트리 보기"
                  aria-pressed={rightView === 'tree'}
                  className={
                    rightView === 'tree'
                      ? 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--badge-bg)] text-[var(--foreground)]'
                      : 'inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]'
                  }
                >
                  <GitBranch className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['all', '전체'] as const,
                    ['event', '사건'] as const,
                    ['character', '캐릭터'] as const,
                    ['worldview', '세계관'] as const,
                    ['place', '장소'] as const,
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTypeFilter(val)}
                    className={
                      typeFilter === val
                        ? 'rounded-full bg-[var(--badge-bg)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]'
                        : 'rounded-full border border-transparent px-2.5 py-1 text-xs text-[var(--muted)] hover:border-[var(--border)]'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {displayPermanent.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--muted)]">생성된 카드가 없습니다</p>
              ) : rightView === 'card' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
                  {displayPermanent.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openPermanentEditor(c)}
                      className="min-h-[8.5rem] rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left transition-colors hover:bg-[var(--badge-bg)]"
                    >
                      <div className="text-sm text-[var(--muted)]">{c.note_number}</div>
                      <div className="text-sm text-[var(--muted)]">[{typeLabel(c.type)}]</div>
                      <div className="mt-2 line-clamp-4 text-base font-medium leading-snug text-[var(--foreground)]">
                        {c.title}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <PermTreeNodes nodes={treeRoot} depth={0} onPick={openPermanentEditor} />
              )}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted)]">
          ESC로 닫기
        </div>
      </div>

      {permForm ? (
        <div
          className="fixed inset-0 z-[540] flex items-center justify-center p-5 sm:p-8 modal-overlay-apple"
          role="presentation"
          onClick={() => {
            setPermForm(null)
            setAiErr(null)
          }}
        >
          <div
            className="modal-panel-apple flex max-h-[min(92vh,52rem)] w-full max-w-4xl flex-col gap-4 overflow-hidden p-5 sm:p-6 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2">
              <span className="text-base font-semibold text-[var(--foreground)]">
                Permanent 카드 {permForm.mode === 'create' ? '생성' : '편집'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPermForm(null)
                  setAiErr(null)
                }}
                className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--badge-bg)]"
                aria-label="닫기"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {aiErr ? (
              <p className="shrink-0 text-sm text-red-500" role="alert">
                {aiErr}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <label className="block text-sm text-[var(--muted)]">
                note_number
                <input
                  type="text"
                  value={permForm.note_number}
                  onChange={(e) =>
                    setPermForm((p) => (p ? { ...p, note_number: e.target.value } : p))
                  }
                  className="input-apple mt-1.5 w-full px-3 py-2.5 text-base"
                />
              </label>
              <label className="block text-sm text-[var(--muted)]">
                타입
                <select
                  value={permForm.type}
                  onChange={(e) => {
                    const nextType = e.target.value as PermanentCardType
                    setPermForm((p) =>
                      p
                        ? {
                            ...p,
                            type: nextType,
                            sections: normalizeSections(
                              nextType,
                              p.sections as unknown as Record<string, unknown>
                            ),
                          }
                        : p
                    )
                  }}
                  className="select-apple mt-1.5 w-full px-3 py-2.5 text-base"
                >
                  <option value="event">사건</option>
                  <option value="character">캐릭터</option>
                  <option value="worldview">세계관</option>
                  <option value="place">장소</option>
                </select>
              </label>
              <label className="block text-sm text-[var(--muted)]">
                제목
                <input
                  type="text"
                  value={permForm.title}
                  onChange={(e) =>
                    setPermForm((p) => (p ? { ...p, title: e.target.value } : p))
                  }
                  className="input-apple mt-1.5 w-full px-3 py-2.5 text-base"
                />
              </label>
              {PERMANENT_SECTION_KEYS[permForm.type].map((key) => {
                const worldviewCompact =
                  key === '설정' || key === '작동 원리' || key === '모순과 긴장'
                return (
                <label key={key} className="block text-sm text-[var(--muted)]">
                  {key}
                  <textarea
                    value={permForm.sections[key] ?? ''}
                    onChange={(e) =>
                      setPermForm((p) =>
                        p
                          ? {
                              ...p,
                              sections: { ...p.sections, [key]: e.target.value },
                            }
                          : p
                      )
                    }
                    rows={worldviewCompact ? 4 : 6}
                    className={
                      worldviewCompact
                        ? 'input-apple mt-1.5 min-h-[6.3rem] w-full resize-y px-3 py-2.5 text-base leading-relaxed'
                        : 'input-apple mt-1.5 min-h-[9rem] w-full resize-y px-3 py-2.5 text-base leading-relaxed'
                    }
                  />
                </label>
                )
              })}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
              <div>
                {permForm.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => void deletePermanentCard()}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPermForm(null)
                    setAiErr(null)
                  }}
                  className="btn-apple btn-apple-secondary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void savePermForm()}
                  className="btn-apple btn-apple-primary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
