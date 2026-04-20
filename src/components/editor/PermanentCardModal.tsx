'use client'

import { createClient } from '@/lib/supabase/client'
import {
  isWritePermanentSectionsUnavailable,
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
import type { Dispatch, SetStateAction } from 'react'

export function PermanentCardModal({
  projectId,
  permForm,
  setPermForm,
  aiErr,
  setAiErr,
  setPermanent,
  setIdeas,
}: {
  projectId: string
  permForm: PermFormState
  setPermForm: Dispatch<SetStateAction<PermFormState | null>>
  aiErr: string | null
  setAiErr: Dispatch<SetStateAction<string | null>>
  setPermanent: Dispatch<SetStateAction<PermanentCardRow[]>>
  setIdeas: Dispatch<SetStateAction<IdeaCardRow[]>>
}) {
  function closeModal() {
    setPermForm(null)
    setAiErr(null)
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
      </div>
    </div>
  )
}
