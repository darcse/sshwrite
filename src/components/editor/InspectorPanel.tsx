'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import { PermanentCardModal } from '@/components/editor/PermanentCardModal'
import { SnapshotPanel } from '@/components/editor/SnapshotPanel'
import type { IdeaCardRow, PermFormState, PermanentCardRow } from '@/components/editor/ideaBoardShared'
import {
  isWritePermanentSectionsUnavailable,
  parsePermanentRow,
  typeLabel,
} from '@/components/editor/ideaBoardShared'
import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import { LABEL_COLORS } from '@/lib/workspace-layout'
import { CheckCircle2, Circle, Loader2, PenLine, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function InspectorPanel() {
  const {
    projectId,
    projectType,
    documents,
    labels,
    selectedDocId,
    updateDocument,
    refresh,
    loading,
  } = useBinderContext()
  const [saving, setSaving] = useState(false)
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0])
  const [labelName, setLabelName] = useState('')
  const [synopsisDraft, setSynopsisDraft] = useState('')
  const [synopsisGenerating, setSynopsisGenerating] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')
  const [relatedPermanentCards, setRelatedPermanentCards] = useState<PermanentCardRow[]>([])
  const [relatedCardIds, setRelatedCardIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelection, setPickerSelection] = useState<string[]>([])
  const [pickerSaving, setPickerSaving] = useState(false)
  const [allPermanentCards, setAllPermanentCards] = useState<PermanentCardRow[]>([])
  const [allPermanentLoaded, setAllPermanentLoaded] = useState(false)
  const [permForm, setPermForm] = useState<PermFormState | null>(null)
  const [permModalErr, setPermModalErr] = useState<string | null>(null)
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  const docLabelId = (doc?.label_id ?? doc?.label) ?? null
  const selectedLabel = labels.find((l) => l.id === docLabelId)

  async function patch(p: Parameters<typeof updateDocument>[1]) {
    if (!doc) return
    setSaving(true)
    await updateDocument(doc.id, p)
    setSaving(false)
  }

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    setSynopsisDraft(doc.synopsis ?? '')
    setMemoDraft(doc.memo ?? '')
    if (selectedLabel) {
      setLabelColor(selectedLabel.color)
      setLabelName(selectedLabel.name)
    } else {
      setLabelColor(LABEL_COLORS[0])
      setLabelName('')
    }
  }, [doc?.id, doc?.synopsis, doc?.label, selectedLabel?.id, selectedLabel?.color, selectedLabel?.name])

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    const timer = setTimeout(() => {
      const next = synopsisDraft.trim()
      if ((doc.synopsis ?? '') === next) return
      void patch({ synopsis: next || null })
    }, 1000)
    return () => clearTimeout(timer)
  }, [synopsisDraft, doc?.id])

  useEffect(() => {
    if (!doc || doc.type !== 'document') return
    const timer = setTimeout(async () => {
      const next = memoDraft.trim()
      const current = doc.memo ?? ''
      if (current === next) return
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('write_documents')
        .update({ memo: next || null })
        .eq('id', doc.id)
        .eq('user_id', user.id)
      if (error) {
        console.error('memo 저장 실패', error)
      } else {
        await refresh()
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [memoDraft, doc?.id, refresh])

  const loadRelatedPermanentCards = useCallback(async () => {
    if (!selectedDocId) {
      setRelatedPermanentCards([])
      setRelatedCardIds([])
      return
    }
    const d = documents.find((x) => x.id === selectedDocId)
    if (!d || d.type !== 'document') {
      setRelatedPermanentCards([])
      setRelatedCardIds([])
      return
    }
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRelatedPermanentCards([])
      setRelatedCardIds([])
      return
    }
    const { data: links, error: linkErr } = await supabase
      .from('write_permanent_card_documents')
      .select('card_id')
      .eq('document_id', d.id)
      .eq('user_id', user.id)
    if (linkErr || !links?.length) {
      setRelatedPermanentCards([])
      setRelatedCardIds([])
      return
    }
    const cardIds = links.map((l) => l.card_id)
    setRelatedCardIds(cardIds)
    const withSections = await supabase
      .from('write_permanent_cards')
      .select('id,note_number,type,title,created_at,exported_at,sections')
      .in('id', cardIds)
      .eq('project_id', projectId)
      .eq('user_id', user.id)
    const cardQuery =
      withSections.error && isWritePermanentSectionsUnavailable(withSections.error)
        ? await supabase
            .from('write_permanent_cards')
            .select('id,note_number,type,title,created_at,exported_at')
            .in('id', cardIds)
            .eq('project_id', projectId)
            .eq('user_id', user.id)
        : withSections
    if (cardQuery.error || !cardQuery.data?.length) {
      setRelatedPermanentCards([])
      return
    }
    const list = ((cardQuery.data as Record<string, unknown>[]) ?? [])
      .map((r) => parsePermanentRow(r))
      .filter((x): x is PermanentCardRow => x != null)
      .sort((a, b) => a.note_number.localeCompare(b.note_number, undefined, { numeric: true }))
    setRelatedPermanentCards(list)
  }, [selectedDocId, documents, projectId])

  useEffect(() => {
    void loadRelatedPermanentCards()
  }, [loadRelatedPermanentCards])

  useEffect(() => {
    setPermForm(null)
    setPickerOpen(false)
  }, [selectedDocId])

  const setIdeasNoop: Dispatch<SetStateAction<IdeaCardRow[]>> = () => {}
  const setPermanentFromModal: Dispatch<SetStateAction<PermanentCardRow[]>> = (next) => {
    setRelatedPermanentCards((prev) => (typeof next === 'function' ? next(prev) : next))
    setAllPermanentCards((prev) => (typeof next === 'function' ? next(prev) : next))
  }

  async function ensureAllPermanentCards() {
    if (allPermanentLoaded) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const withSections = await supabase
      .from('write_permanent_cards')
      .select('id,note_number,type,title,created_at,exported_at,sections')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .order('note_number', { ascending: true })
    const cardQuery =
      withSections.error && isWritePermanentSectionsUnavailable(withSections.error)
        ? await supabase
            .from('write_permanent_cards')
            .select('id,note_number,type,title,created_at,exported_at')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .order('note_number', { ascending: true })
        : withSections
    if (cardQuery.error) return
    const list = ((cardQuery.data as Record<string, unknown>[]) ?? [])
      .map((r) => parsePermanentRow(r))
      .filter((x): x is PermanentCardRow => x != null)
    setAllPermanentCards(list)
    setAllPermanentLoaded(true)
  }

  async function saveRelatedCards() {
    if (!doc || doc.type !== 'document') return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setPickerSaving(true)
    const del = await supabase
      .from('write_permanent_card_documents')
      .delete()
      .eq('document_id', doc.id)
      .eq('user_id', user.id)
    if (del.error) {
      setPermModalErr(del.error.message || '연결 저장에 실패했습니다.')
      setPickerSaving(false)
      return
    }
    if (pickerSelection.length > 0) {
      const rows = pickerSelection.map((cardId) => ({
        card_id: cardId,
        document_id: doc.id,
        user_id: user.id,
      }))
      const ins = await supabase.from('write_permanent_card_documents').insert(rows)
      if (ins.error) {
        setPermModalErr(ins.error.message || '연결 저장에 실패했습니다.')
        setPickerSaving(false)
        return
      }
    }
    setPickerOpen(false)
    setRelatedCardIds(pickerSelection)
    await loadRelatedPermanentCards()
    setPickerSaving(false)
  }

  async function unlinkRelatedCard(cardId: string) {
    if (!doc || doc.type !== 'document') return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('write_permanent_card_documents')
      .delete()
      .eq('document_id', doc.id)
      .eq('card_id', cardId)
      .eq('user_id', user.id)
    if (error) {
      setPermModalErr(error.message || '연결 해제에 실패했습니다.')
      return
    }
    await loadRelatedPermanentCards()
  }

  async function saveLabel() {
    if (!doc || doc.type !== 'document') return
    const nextName = labelName.trim()
    if (!nextName) return
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    if (selectedLabel) {
      const [r1, r2] = await Promise.all([
        supabase
          .from('write_document_labels')
          .update({ name: nextName, color: labelColor })
          .eq('id', selectedLabel.id)
          .eq('user_id', user.id),
        supabase
          .from('write_documents')
          .update({ label_id: selectedLabel.id })
          .eq('id', doc.id)
          .eq('user_id', user.id),
      ])
      if (r1.error || r2.error) {
        window.alert('라벨 저장에 실패했습니다.')
      } else {
        await refresh()
      }
      setSaving(false)
      return
    }
    const { data, error: insertErr } = await supabase
      .from('write_document_labels')
      .insert({
        project_id: projectId,
        user_id: user.id,
        name: nextName,
        color: labelColor,
      })
      .select('id')
      .single()
    if (insertErr || !data?.id) {
      window.alert('라벨 저장에 실패했습니다.')
      setSaving(false)
      return
    }
    const { error: updateErr } = await supabase
      .from('write_documents')
      .update({ label_id: data.id })
      .eq('id', doc.id)
      .eq('user_id', user.id)
    if (updateErr) {
      window.alert('라벨 저장에 실패했습니다.')
    } else {
      await refresh()
    }
    setSaving(false)
  }

  async function clearLabel() {
    if (!doc || doc.type !== 'document') return
    setSaving(true)
    setLabelName('')
    setLabelColor(LABEL_COLORS[0])
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }
    const { error } = await supabase
      .from('write_documents')
      .update({ label_id: null })
      .eq('id', doc.id)
      .eq('user_id', user.id)
    if (error) {
      window.alert('라벨 초기화에 실패했습니다.')
    } else {
      await refresh()
    }
    setSaving(false)
  }

  async function generateSynopsis() {
    if (!doc || doc.type !== 'document') return
    const plain = tiptapToPlainText(doc.content)
    if (!plain.trim()) {
      window.alert(projectType === 'lyrics' ? '가사 내용을 먼저 작성해주세요' : '문서 내용을 먼저 작성해주세요')
      return
    }
    setSynopsisGenerating(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: doc.content, title: doc.title, type: projectType }),
      })
      const data = (await res.json()) as { text?: string; error?: string }
      if (!res.ok) {
        window.alert(data.error || '요약 생성에 실패했습니다.')
        return
      }
      const next = (data.text ?? '').trim()
      if (!next) {
        window.alert('요약을 가져오지 못했습니다.')
        return
      }
      setSynopsisDraft(next)
      await patch({ synopsis: next || null })
      await refresh()
    } catch (err) {
      console.error('synopsis 생성 실패', err)
      window.alert('요약 생성에 실패했습니다.')
    } finally {
      setSynopsisGenerating(false)
    }
  }

  if (loading) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>
  }

  if (!doc || doc.type !== 'document') {
    return (
      <p className="text-sm text-[var(--muted)]">
        문서를 선택하면 라벨과 상태를 편집할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--muted)]">시놉시스</span>
          <button
            type="button"
            disabled={synopsisGenerating || saving}
            onClick={() => void generateSynopsis()}
            className="btn-accent inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-semibold disabled:opacity-50"
            style={{ fontSize: 12 }}
          >
            {synopsisGenerating ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            ) : null}
            ✨ 자동생성
          </button>
        </div>
        <textarea
          rows={7}
          value={synopsisDraft}
          onChange={(e) => setSynopsisDraft(e.target.value)}
          placeholder="시놉시스를 입력하세요"
          className="input-apple min-h-[168px] w-full resize-y px-2 py-1.5 text-sm"
        />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">상태</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'todo' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'todo' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <Circle className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} aria-hidden />
            예정
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'writing' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'writing' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <PenLine className="h-3.5 w-3.5" style={{ color: '#007AFF' }} aria-hidden />
            작성 중
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ status: 'done' })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
            style={{
              backgroundColor: doc.status === 'done' ? 'var(--badge-bg)' : 'transparent',
              color: 'var(--foreground)',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#34C759' }} aria-hidden />
            완료
          </button>
        </div>
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">라벨</span>
        <div className="flex items-center gap-2">
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setLabelColor(color)}
              className="h-4 w-4 rounded-full"
              style={{
                backgroundColor: color,
                border:
                  labelColor === color
                    ? '2px solid var(--foreground)'
                    : '1px solid color-mix(in srgb, var(--foreground) 20%, transparent)',
              }}
              aria-label={`라벨 색상 ${color}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            placeholder="라벨 이름"
            className="input-apple min-w-0 flex-1 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={saveLabel}
            disabled={saving || !labelName.trim()}
            className="rounded px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
            style={{ backgroundColor: 'var(--badge-bg)' }}
          >
            저장
          </button>
          <button
            type="button"
            onClick={clearLabel}
            disabled={saving || !docLabelId}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="라벨 제거"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {selectedLabel ? (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selectedLabel.color }}
            />
            <span className="text-[var(--foreground)]">{selectedLabel.name}</span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">스냅샷</span>
        <SnapshotPanel documentId={doc.id} />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">메모</span>
        <textarea
          rows={5}
          value={memoDraft}
          onChange={(e) => setMemoDraft(e.target.value)}
          placeholder="메모를 입력하세요"
          className="input-apple w-full resize-none px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--muted)]">관련 카드</span>
          <button
            type="button"
            onClick={() => {
              setPickerSelection(relatedCardIds)
              setPickerOpen((v) => !v)
              void ensureAllPermanentCards()
            }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--foreground)]"
            style={{ backgroundColor: 'var(--badge-bg)' }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            카드 추가
          </button>
        </div>
        {pickerOpen ? (
          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-2">
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {allPermanentCards.map((c) => (
                <label
                  key={c.id}
                  className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-2 text-xs text-[var(--foreground)]"
                >
                  <input
                    type="checkbox"
                    checked={pickerSelection.includes(c.id)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setPickerSelection((prev) =>
                        checked ? (prev.includes(c.id) ? prev : [...prev, c.id]) : prev.filter((id) => id !== c.id)
                      )
                    }}
                  />
                  <span className="whitespace-nowrap text-[var(--muted)]">{c.note_number}</span>
                  <span className="whitespace-nowrap text-[var(--muted)]">[{typeLabel(c.type)}]</span>
                  <span className="truncate">{c.title}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded px-2 py-1 text-xs text-[var(--muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveRelatedCards()}
                disabled={pickerSaving}
                className="rounded px-2 py-1 text-xs text-[var(--foreground)] disabled:opacity-50"
                style={{ backgroundColor: 'var(--badge-bg)' }}
              >
                저장
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          {relatedPermanentCards.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">연결된 카드가 없습니다</p>
          ) : (
            relatedPermanentCards.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPermForm({
                      mode: 'edit',
                      id: c.id,
                      note_number: c.note_number,
                      type: c.type,
                      title: c.title,
                      exported_at: c.exported_at,
                      sections: { ...c.sections },
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left text-xs text-[var(--foreground)]"
                >
                  <span className="text-[var(--muted)]">{c.note_number}</span> {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => void unlinkRelatedCard(c.id)}
                  className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
                  aria-label="연결 해제"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {saving ? <p className="text-xs text-[var(--muted)]">저장 중…</p> : null}
      {permModalErr ? <p className="text-xs text-red-500">{permModalErr}</p> : null}
      {permForm ? (
        <PermanentCardModal
          projectId={projectId}
          permForm={permForm}
          setPermForm={(next) => {
            if (next === null) {
              setPermForm(null)
              void loadRelatedPermanentCards()
              return
            }
            setPermForm(next)
          }}
          aiErr={permModalErr}
          setAiErr={setPermModalErr}
          setPermanent={setPermanentFromModal}
          setIdeas={setIdeasNoop}
          permanent={allPermanentCards.length > 0 ? allPermanentCards : relatedPermanentCards}
        />
      ) : null}
    </div>
  )
}
