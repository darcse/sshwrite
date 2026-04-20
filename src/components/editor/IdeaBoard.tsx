'use client'

import { createClient } from '@/lib/supabase/client'
import { IdeaCardList } from '@/components/editor/IdeaCardList'
import { PermanentCardList } from '@/components/editor/PermanentCardList'
import { PermanentCardModal } from '@/components/editor/PermanentCardModal'
import {
  isWriteIdeaStatusColumnUnavailable,
  isWritePermanentSectionsUnavailable,
  parsePermanentRow,
} from '@/components/editor/ideaBoardShared'
import type {
  IdeaCardRow,
  PermanentCardRow,
  PermanentCardType,
  PermFormState,
} from '@/components/editor/ideaBoardShared'
import { Lightbulb, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export type { PermanentCardType } from '@/components/editor/ideaBoardShared'
export { PERMANENT_SECTION_KEYS } from '@/components/editor/ideaBoardShared'

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
    const ir =
      irStatus.error && isWriteIdeaStatusColumnUnavailable(irStatus.error)
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
      setIdeas([])
    } else {
      const rows = (ir.data as Record<string, unknown>[]) ?? []
      setIdeas(
        rows.map((r) => {
          const st = String(r.status ?? '').trim().toLowerCase()
          return {
            id: String(r.id),
            content: typeof r.content === 'string' ? r.content : '',
            created_at: typeof r.created_at === 'string' ? r.created_at : '',
            status: st === 'converted' ? 'converted' : 'pending',
          }
        })
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
    if (!open) {
      setIdeas([])
      setPermanent([])
      return
    }
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

  if (!open) return null

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
          <IdeaCardList
            projectId={projectId}
            ideas={ideas}
            setIdeas={setIdeas}
            ideaDraft={ideaDraft}
            setIdeaDraft={setIdeaDraft}
            ideaFilter={ideaFilter}
            setIdeaFilter={setIdeaFilter}
            transformIdeaId={transformIdeaId}
            setTransformIdeaId={setTransformIdeaId}
            setPermForm={setPermForm}
            setAiErr={setAiErr}
            setLoadErr={setLoadErr}
          />
          <PermanentCardList
            permanent={permanent}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            rightView={rightView}
            setRightView={setRightView}
            onPickCard={openPermanentEditor}
          />
        </div>

        <div className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-center text-xs text-[var(--muted)]">
          ESC로 닫기
        </div>
      </div>

      {permForm ? (
        <PermanentCardModal
          projectId={projectId}
          permForm={permForm}
          setPermForm={setPermForm}
          aiErr={aiErr}
          setAiErr={setAiErr}
          setPermanent={setPermanent}
          setIdeas={setIdeas}
          permanent={permanent}
        />
      ) : null}
    </div>
  )
}
