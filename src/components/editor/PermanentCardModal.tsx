'use client'

import { createClient } from '@/lib/supabase/client'
import {
  isWritePermanentSectionsUnavailable,
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
