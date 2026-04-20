'use client'

import { createClient } from '@/lib/supabase/client'
import {
  isWritePermanentSectionsUnavailable,
  nextIndependentNoteNumber,
  nextNoteNumberForCreate,
  normalizeSections,
  parsePermanentRow,
  PERMANENT_SECTION_KEYS,
  typeStringForPermanentInsert,
} from '@/components/editor/ideaBoardShared'
import type {
  IdeaCardRow,
  PermanentCardRow,
  PermanentCardType,
  PermFormState,
} from '@/components/editor/ideaBoardShared'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function PermanentCardModal({
  projectId,
  permForm,
  setPermForm,
  aiErr,
  setAiErr,
  setPermanent,
  setIdeas,
  permanent,
  isInline = false,
  setSelectedCard,
}: {
  projectId: string
  permForm: PermFormState
  setPermForm: Dispatch<SetStateAction<PermFormState | null>>
  aiErr: string | null
  setAiErr: Dispatch<SetStateAction<string | null>>
  setPermanent: Dispatch<SetStateAction<PermanentCardRow[]>>
  setIdeas: Dispatch<SetStateAction<IdeaCardRow[]>>
  permanent: PermanentCardRow[]
  isInline?: boolean
  setSelectedCard?: Dispatch<SetStateAction<PermanentCardRow | null>>
}) {
  const [parentId, setParentId] = useState<string | null>(null)
  const [parentNoteNumber, setParentNoteNumber] = useState<string | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [kanbanPickerOpen, setKanbanPickerOpen] = useState(false)
  const [kanbanColumns, setKanbanColumns] = useState<Array<{ id: string; title: string }>>([])
  const [selectedKanbanColumnId, setSelectedKanbanColumnId] = useState('')

  const sortedForParent = useMemo(
    () =>
      [...permanent].sort((a, b) =>
        a.note_number.localeCompare(b.note_number, undefined, { numeric: true })
      ),
    [permanent]
  )

  const parentResetKey =
    permForm.mode === 'create' ? permForm.ideaId : permForm.mode === 'edit' ? permForm.id : ''
  useEffect(() => {
    if (permForm.mode === 'create') {
      setParentId(null)
      setParentNoteNumber(null)
      return
    }
    const selfNote = permForm.note_number.trim()
    let picked: PermanentCardRow | null = null
    for (const c of sortedForParent) {
      if (c.id === permForm.id) continue
      const pn = c.note_number.trim()
      if (!pn) continue
      if (!selfNote.startsWith(pn)) continue
      if (selfNote.length <= pn.length) continue
      if (!picked || pn.length > picked.note_number.trim().length) picked = c
    }
    setParentId(picked?.id ?? null)
    setParentNoteNumber(picked?.note_number?.trim() ?? null)
  }, [permForm.mode, parentResetKey])

  const parentOptions = useMemo(() => {
    if (permForm.mode === 'edit') {
      return sortedForParent.filter((c) => c.id !== permForm.id)
    }
    return sortedForParent
  }, [sortedForParent, permForm.mode, permForm.mode === 'edit' ? permForm.id : ''])

  const mergeCards = useMemo(() => {
    if (permForm.mode !== 'edit') return []
    return sortedForParent
  }, [permForm.mode, sortedForParent])

  const alreadyExported = permForm.mode === 'edit' && !!permForm.exported_at

  const mergeResetKey = permForm.mode === 'edit' ? permForm.id : permForm.mode
  useEffect(() => {
    if (permForm.mode !== 'edit') {
      setMergeOpen(false)
      setMergeSelectedIds([])
      return
    }
    setMergeSelectedIds((prev) => {
      const next = prev.filter((id) => id !== permForm.id)
      return [permForm.id, ...next]
    })
  }, [permForm.mode, mergeResetKey])

  useEffect(() => {
    if (permForm.mode !== 'edit' || permForm.type !== 'event' || !kanbanPickerOpen) return
    let live = true
    async function loadColumns() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('write_kanban_columns')
        .select('id,title')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })
      if (!live) return
      if (error) {
        setAiErr('칸반 컬럼을 불러오지 못했습니다.')
        return
      }
      const rows = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        id: typeof r.id === 'string' ? r.id : '',
        title: typeof r.title === 'string' ? r.title : '',
      }))
      const filtered = rows.filter((r) => r.id)
      setKanbanColumns(filtered)
      if (!selectedKanbanColumnId && filtered.length > 0) {
        setSelectedKanbanColumnId(filtered[0].id)
      }
    }
    void loadColumns()
    return () => {
      live = false
    }
  }, [permForm.mode, permForm.type, kanbanPickerOpen, projectId, setAiErr, selectedKanbanColumnId])

  useEffect(() => {
    if (permForm.mode === 'edit' && permForm.type === 'event' && alreadyExported) {
      setKanbanPickerOpen(true)
      return
    }
    setKanbanPickerOpen(false)
  }, [permForm.mode, permForm.type, alreadyExported, permForm.mode === 'edit' ? permForm.id : ''])

  function applyParent(id: string | null) {
    setParentId(id)
    const row = id ? sortedForParent.find((c) => c.id === id) : undefined
    const pnn = row?.note_number?.trim() ? row.note_number.trim() : null
    setParentNoteNumber(pnn)
    const allNums = permanent.map((c) => c.note_number.trim()).filter(Boolean)
    const savedSelfNn =
      permForm.mode === 'edit'
        ? permanent.find((c) => c.id === permForm.id)?.note_number?.trim() ?? ''
        : ''
    const exclude = savedSelfNn ? [savedSelfNn] : undefined
    const nn = nextNoteNumberForCreate(pnn, allNums, exclude)
    setPermForm((p) => (p ? { ...p, note_number: nn } : p))
  }
  function closeModal() {
    setPermForm(null)
    setAiErr(null)
    if (isInline) setSelectedCard?.(null)
  }

  async function markExportedAtNow() {
    if (permForm.mode !== 'edit') return false
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('write_permanent_cards')
      .update({ exported_at: nowIso })
      .eq('id', permForm.id)
      .eq('user_id', user.id)
    if (error) {
      setAiErr(error.message ? `내보내기에 실패했습니다: ${error.message}` : '내보내기에 실패했습니다.')
      return false
    }
    setPermanent((prev) =>
      prev.map((c) => (c.id === permForm.id ? { ...c, exported_at: nowIso } : c))
    )
    setSelectedCard?.((prev) => (prev && prev.id === permForm.id ? { ...prev, exported_at: nowIso } : prev))
    setPermForm((p) =>
      p && p.mode === 'edit' && p.id === permForm.id
        ? { ...p, exported_at: nowIso }
        : p
    )
    return true
  }

  async function exportToCharacter(kind: 'character' | 'place') {
    if (permForm.mode !== 'edit' || exporting) return
    setExporting(true)
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
      const payload =
        kind === 'character'
          ? {
              project_id: projectId,
              user_id: user.id,
              type: 'character',
              name: permForm.title,
              description: permForm.sections['인물'] || null,
              memo: [permForm.sections['욕망'], permForm.sections['갈등']].filter(Boolean).join('\n\n') || null,
            }
          : {
              project_id: projectId,
              user_id: user.id,
              type: 'place',
              name: permForm.title,
              description: permForm.sections['장소'] || null,
              memo: [permForm.sections['분위기'], permForm.sections['역할']].filter(Boolean).join('\n\n') || null,
            }
      const { data: maxRows } = await supabase
        .from('write_characters')
        .select('order_index')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('type', kind)
        .order('order_index', { ascending: false })
        .limit(1)
      const nextOrder =
        maxRows && maxRows.length > 0 && typeof maxRows[0].order_index === 'number'
          ? maxRows[0].order_index + 1
          : 0
      const { error } = await supabase.from('write_characters').insert({
        ...payload,
        order_index: nextOrder,
      })
      if (error) {
        setAiErr(error.message ? `내보내기에 실패했습니다: ${error.message}` : '내보내기에 실패했습니다.')
        return
      }
      const ok = await markExportedAtNow()
      if (ok) window.dispatchEvent(new CustomEvent('write:characters:changed'))
    } finally {
      setExporting(false)
    }
  }

  async function exportToKanban() {
    if (permForm.mode !== 'edit' || exporting) return
    if (!selectedKanbanColumnId) {
      setAiErr('칸반 컬럼을 선택해 주세요.')
      return
    }
    setExporting(true)
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
      const { data: maxRows } = await supabase
        .from('write_kanban_cards')
        .select('order_index')
        .eq('column_id', selectedKanbanColumnId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: false })
        .limit(1)
      const nextOrder =
        maxRows && maxRows.length > 0 && typeof maxRows[0].order_index === 'number'
          ? maxRows[0].order_index + 1
          : 0
      const body = [permForm.sections['사건'], permForm.sections['전개']].filter(Boolean).join('\n\n') || null
      const { error } = await supabase.from('write_kanban_cards').insert({
        column_id: selectedKanbanColumnId,
        user_id: user.id,
        title: permForm.title,
        body,
        order_index: nextOrder,
      })
      if (error) {
        setAiErr(error.message ? `내보내기에 실패했습니다: ${error.message}` : '내보내기에 실패했습니다.')
        return
      }
      const ok = await markExportedAtNow()
      if (ok) setKanbanPickerOpen(false)
    } finally {
      setExporting(false)
    }
  }

  function toggleMergeSelection(id: string, checked: boolean) {
    if (permForm.mode !== 'edit') return
    if (id === permForm.id) return
    setMergeSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev
        return [...prev, id]
      }
      return prev.filter((x) => x !== id)
    })
  }

  async function mergeSelectedCards() {
    if (permForm.mode !== 'edit') return
    const picked = mergeCards.filter((c) => mergeSelectedIds.includes(c.id))
    if (picked.length < 2) return
    setMergeLoading(true)
    setAiErr(null)
    try {
      const existingCards = sortedForParent.map((r) => ({
        note_number: r.note_number,
        type: r.type,
        title: r.title,
      }))
      const res = await fetch('/api/merge-permanent-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: picked,
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
      const existingNoteSet = new Set(
        existingCards.map((x) => x.note_number).filter((n) => n.length > 0)
      )
      const nn = nextIndependentNoteNumber(existingNoteSet)
      setMergeOpen(false)
      setMergeSelectedIds([])
      setPermForm({
        mode: 'create',
        ideaId: '',
        note_number: nn,
        type: ct,
        title: String(data.title ?? '').trim(),
        sections,
      })
    } catch {
      setAiErr('요청 처리 중 오류가 발생했습니다.')
    } finally {
      setMergeLoading(false)
    }
  }

  async function savePermForm() {
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
      const ideaRowId = String(permForm.ideaId).trim()
      if (ideaRowId) {
        const { data: ideaUpd, error: ue } = await supabase
          .from('write_idea_cards')
          .update({ status: 'converted' })
          .eq('id', ideaRowId)
          .eq('user_id', user.id)
          .select('id')
        if (ue) {
          ideaArchiveErr = ue
          console.log('write_idea_cards update error', {
            message: ue.message,
            code: ue.code,
            details: ue.details,
            hint: ue.hint,
          })
          setAiErr(
            ue.message
              ? `아이디어 카드를 아카이브하지 못했습니다: ${ue.message}`
              : '아이디어 카드를 아카이브하지 못했습니다.'
          )
        } else if (!ideaUpd || ideaUpd.length === 0) {
          ideaArchiveErr = { message: 'no rows' }
          console.error('write_idea_cards update: 0 rows', ideaRowId, { userId: user.id })
          setAiErr('아이디어 카드를 아카이브하지 못했습니다.')
        } else {
          setIdeas((prev) =>
            prev.map((i) => (i.id === ideaRowId ? { ...i, status: 'converted' as const } : i))
          )
        }
      }
    } else {
      const typeForDb = typeStringForPermanentInsert(permForm.type)
      let { error } = await supabase
        .from('write_permanent_cards')
        .update({
          note_number: nn,
          type: typeForDb,
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
            type: typeForDb,
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
      if (isInline) {
        setSelectedCard?.((prev) =>
          prev && prev.id === permForm.id
            ? {
                ...prev,
                note_number: nn,
                type: permForm.type,
                title: tt,
                sections: { ...permForm.sections },
              }
            : prev
        )
        setPermForm({
          mode: 'edit',
          id: permForm.id,
          note_number: nn,
          type: permForm.type,
          title: tt,
          exported_at: permForm.exported_at ?? null,
          sections: { ...permForm.sections },
        })
        if (!ideaArchiveErr) setAiErr(null)
        return
      }
    }
    setPermForm(null)
    if (!ideaArchiveErr) setAiErr(null)
  }

  async function deletePermanentCard() {
    if (permForm.mode !== 'edit') return
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
    if (isInline) setSelectedCard?.(null)
  }

  const panelInner = (
    <>
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-base font-semibold text-[var(--foreground)]">
            Permanent 카드 {permForm.mode === 'create' ? '생성' : '편집'}
          </span>
          <button
            type="button"
            onClick={closeModal}
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
          <div className="flex shrink-0 flex-nowrap items-end gap-3 overflow-x-auto pb-0.5">
            <label className="flex min-w-0 flex-1 flex-col text-sm text-[var(--muted)]">
              부모 카드 선택
              <select
                key="perm-modal-parent"
                value={parentId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  applyParent(v === '' ? null : v)
                }}
                className="select-apple mt-1.5 box-border h-11 w-full min-w-[10rem] px-3 py-0 text-base leading-[2.75rem]"
              >
                <option value="">선택 안 함</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.note_number} {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-[7.5rem] shrink-0 flex-col text-sm text-[var(--muted)] sm:w-32">
              note_number
              <input
                type="text"
                value={permForm.note_number}
                onChange={(e) =>
                  setPermForm((p) => (p ? { ...p, note_number: e.target.value } : p))
                }
                className="input-apple mt-1.5 box-border h-11 w-full px-3 py-0 text-base leading-[2.75rem]"
              />
            </label>
            <label className="flex w-[6.75rem] shrink-0 flex-col text-sm text-[var(--muted)] sm:w-36">
              타입
              <select
                key="perm-modal-type"
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
                className="select-apple mt-1.5 box-border h-11 w-full px-3 py-0 text-base leading-[2.75rem]"
              >
                <option value="event">사건</option>
                <option value="character">캐릭터</option>
                <option value="worldview">세계관</option>
                <option value="place">장소</option>
              </select>
            </label>
          </div>
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
        {permForm.mode === 'edit' ? (
          <div className="shrink-0 space-y-2 border-t border-[var(--border)] pt-4">
            {permForm.type === 'event' ? (
              <>
                <button
                  type="button"
                  onClick={() => setKanbanPickerOpen((v) => !v)}
                  disabled={exporting}
                  className="btn-apple btn-apple-secondary rounded-lg px-3 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
                >
                  {alreadyExported ? '내보냄 ✓' : '칸반으로 내보내기'}
                </button>
                {kanbanPickerOpen ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedKanbanColumnId}
                      onChange={(e) => setSelectedKanbanColumnId(e.target.value)}
                      className="select-apple min-w-[12rem] px-3 py-2 text-sm"
                      disabled={exporting}
                    >
                      {kanbanColumns.length === 0 ? (
                        <option value="">컬럼 없음</option>
                      ) : (
                        kanbanColumns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title || '(제목 없음)'}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => void exportToKanban()}
                      disabled={exporting || !selectedKanbanColumnId}
                      className="btn-apple btn-apple-primary rounded-lg px-3 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
                    >
                      {exporting ? '내보내는 중...' : '내보내기'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : permForm.type === 'character' ? (
              <button
                type="button"
                onClick={() => void exportToCharacter('character')}
                disabled={exporting}
                className="btn-apple btn-apple-secondary rounded-lg px-3 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              >
                {alreadyExported ? '내보냄 ✓' : '캐릭터로 내보내기'}
              </button>
            ) : permForm.type === 'place' ? (
              <button
                type="button"
                onClick={() => void exportToCharacter('place')}
                disabled={exporting}
                className="btn-apple btn-apple-secondary rounded-lg px-3 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              >
                {alreadyExported ? '내보냄 ✓' : '장소로 내보내기'}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          <div>
            {permForm.mode === 'edit' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMergeOpen((v) => !v)}
                  className="btn-apple btn-apple-secondary rounded-lg px-3 py-2 text-sm font-semibold"
                  disabled={mergeLoading || exporting}
                >
                  카드 합성
                </button>
                <button
                  type="button"
                  onClick={() => void deletePermanentCard()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10"
                  disabled={mergeLoading || exporting}
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeModal}
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
        {permForm.mode === 'edit' && mergeOpen ? (
          <div className="shrink-0 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-3">
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {mergeCards.map((c) => {
                const checked = mergeSelectedIds.includes(c.id)
                const fixed = c.id === permForm.id
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={fixed || mergeLoading}
                      onChange={(e) => toggleMergeSelection(c.id, e.target.checked)}
                    />
                    <span className="text-xs text-[var(--muted)]">{c.note_number}</span>
                    <span className="truncate">{c.title}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void mergeSelectedCards()}
                disabled={mergeLoading || mergeSelectedIds.length < 2}
                className="btn-apple btn-apple-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              >
                {mergeLoading ? '합성 중...' : '합성'}
              </button>
            </div>
          </div>
        ) : null}
    </>
  )

  if (isInline) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-5">
          {panelInner}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[540] flex items-center justify-center p-5 sm:p-8 modal-overlay-apple"
      role="presentation"
      onClick={closeModal}
    >
      <div
        className="modal-panel-apple flex max-h-[min(92vh,52rem)] w-full max-w-4xl flex-col gap-4 overflow-hidden p-5 sm:p-6 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        {panelInner}
      </div>
    </div>
  )
}
