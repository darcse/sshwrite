'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import { SnapshotPanel } from '@/components/editor/SnapshotPanel'
import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import { LABEL_COLORS } from '@/lib/workspace-layout'
import { CheckCircle2, Circle, Loader2, PenLine, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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
      if (!error) await refresh()
    }, 1000)
    return () => clearTimeout(timer)
  }, [memoDraft, doc?.id, refresh])

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
      <label className="mb-6 flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">메모</span>
        <textarea
          rows={5}
          value={memoDraft}
          onChange={(e) => setMemoDraft(e.target.value)}
          placeholder="메모를 입력하세요"
          className="input-apple w-full resize-none px-2 py-1.5 text-sm"
        />
      </label>
      {saving ? <p className="text-xs text-[var(--muted)]">저장 중…</p> : null}
    </div>
  )
}
