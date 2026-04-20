'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  IdeaCardRow,
  PermFormState,
  PermanentCardType,
} from '@/components/editor/ideaBoardShared'
import { nextIndependentNoteNumber, normalizeSections } from '@/components/editor/ideaBoardShared'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function IdeaCardList({
  projectId,
  ideas,
  setIdeas,
  ideaDraft,
  setIdeaDraft,
  ideaFilter,
  setIdeaFilter,
  transformIdeaId,
  setTransformIdeaId,
  setPermForm,
  setAiErr,
  setLoadErr,
  ideaPanelExpanded,
  setIdeaPanelExpanded,
}: {
  projectId: string
  ideas: IdeaCardRow[]
  setIdeas: Dispatch<SetStateAction<IdeaCardRow[]>>
  ideaDraft: string
  setIdeaDraft: Dispatch<SetStateAction<string>>
  ideaFilter: 'all' | 'active' | 'archived'
  setIdeaFilter: Dispatch<SetStateAction<'all' | 'active' | 'archived'>>
  transformIdeaId: string | null
  setTransformIdeaId: Dispatch<SetStateAction<string | null>>
  setPermForm: Dispatch<SetStateAction<PermFormState | null>>
  setAiErr: Dispatch<SetStateAction<string | null>>
  setLoadErr: Dispatch<SetStateAction<string | null>>
  ideaPanelExpanded: boolean
  setIdeaPanelExpanded: Dispatch<SetStateAction<boolean>>
}) {
  const displayIdeas = useMemo(() => {
    if (ideaFilter === 'all') return ideas
    if (ideaFilter === 'active') return ideas.filter((i) => i.status === 'pending')
    return ideas.filter((i) => i.status === 'converted')
  }, [ideas, ideaFilter])

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
      .select('id,content,created_at,status')
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
        status:
          String(r.status ?? '').trim().toLowerCase() === 'converted'
            ? 'converted'
            : 'pending',
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
      setLoadErr('아이디어를 삭제하지 못했습니다.')
      return
    }
    setIdeas((prev) => prev.filter((x) => x.id !== id))
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
      const nn = nextIndependentNoteNumber(existingNoteSet)
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

  const emptyIdeaHint =
    ideas.length === 0
      ? '아이디어를 입력해보세요'
      : ideaFilter === 'active'
        ? '활성 아이디어가 없습니다'
        : ideaFilter === 'archived'
          ? '아카이브된 아이디어가 없습니다'
          : '아이디어를 입력해보세요'

  if (!ideaPanelExpanded) {
    return (
      <section className="flex min-h-0 w-10 shrink-0 flex-col self-stretch border-r border-[var(--border)] bg-[var(--background)]">
        <button
          type="button"
          onClick={() => setIdeaPanelExpanded(true)}
          className="flex h-11 w-10 shrink-0 items-center justify-center text-[var(--muted)] hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
          aria-label="아이디어 패널 펼치기"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 w-72 shrink-0 flex-col self-stretch border-r border-[var(--border)] bg-[var(--background)]">
      <div className="flex shrink-0 items-center justify-end border-b border-[var(--border)] px-2 py-1">
        <button
          type="button"
          onClick={() => setIdeaPanelExpanded(false)}
          className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
          aria-label="아이디어 패널 접기"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
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
      <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto p-3">
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
              <div className="flex flex-wrap items-start gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-wrap">{it.content}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {it.status === 'converted' ? (
                  <span className="shrink-0 rounded-full bg-[var(--badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    변환 완료
                  </span>
                ) : null}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
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
            </div>
          ))
        )}
      </div>
    </section>
  )
}
