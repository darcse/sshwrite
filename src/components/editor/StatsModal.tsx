'use client'

import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

function wordCountFromContent(content: unknown): number {
  const plain = tiptapToPlainText(content)
  return plain.split(' ').filter(Boolean).length
}

type StatsModalProps = {
  projectId: string
  open: boolean
  onClose: () => void
}

export function StatsModal({ projectId, open, onClose }: StatsModalProps) {
  const [loading, setLoading] = useState(false)
  const [totalWords, setTotalWords] = useState(0)
  const [docCount, setDocCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (alive) setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('write_documents')
        .select('content, type, status')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
      if (!alive) return
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const rows = (data ?? []) as { content: unknown; type: string; status: string }[]
      const documents = rows.filter((r) => r.type === 'document')
      const nDocs = documents.length
      let words = 0
      let done = 0
      for (const d of documents) {
        words += wordCountFromContent(d.content)
        if (d.status === 'done') done += 1
      }
      setTotalWords(words)
      setDocCount(nDocs)
      setDoneCount(done)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [open, projectId])

  if (!open) return null

  const pct = docCount > 0 ? Math.round((doneCount / docCount) * 100) : 0

  const cardClass =
    'flex flex-col gap-1 rounded-lg border px-4 py-3 text-[var(--foreground)]'
  const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--badge-bg)' }

  return (
    <div
      className="modal-overlay-apple fixed inset-0 z-[450] flex items-start justify-center p-4 pt-20 md:pt-24"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel-apple w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="stats-modal-title" className="text-lg font-semibold text-[var(--foreground)]">
            집필 통계
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
        ) : docCount === 0 ? (
          <p className="text-sm text-[var(--muted)]">작성된 문서가 없습니다</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cardClass} style={cardStyle}>
              <span className="text-xs font-medium text-[var(--muted)]">총 단어 수</span>
              <span className="text-2xl font-bold tabular-nums">{totalWords.toLocaleString('ko-KR')}</span>
            </div>
            <div className={cardClass} style={cardStyle}>
              <span className="text-xs font-medium text-[var(--muted)]">문서 수</span>
              <span className="text-2xl font-bold tabular-nums">{docCount.toLocaleString('ko-KR')}</span>
            </div>
            <div className={cardClass} style={cardStyle}>
              <span className="text-xs font-medium text-[var(--muted)]">완료 문서</span>
              <span className="text-2xl font-bold tabular-nums">
                {doneCount} / {docCount}
              </span>
              <span className="text-xs text-[var(--muted)]">{pct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
