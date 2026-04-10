'use client'

import { useState } from 'react'

type CorkboardCardProps = {
  id: string
  title: string
  synopsis: string | null
  status: string
  labelColor?: string
  onOpen: (id: string) => void
  onSaveSynopsis: (id: string, synopsis: string) => Promise<void> | void
}

const STATUS_LABEL: Record<string, string> = {
  todo: '예정',
  writing: '작성 중',
  done: '완료',
}

export function CorkboardCard({
  id,
  title,
  synopsis,
  status,
  labelColor,
  onOpen,
  onSaveSynopsis,
}: CorkboardCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  async function handleBlur() {
    setEditing(false)
    const next = draft.trim()
    const current = (synopsis ?? '').trim()
    if (next === current) return
    await onSaveSynopsis(id, next)
  }

  return (
    <article
      className="card-apple overflow-hidden p-4"
      style={{ borderTop: labelColor ? `4px solid ${labelColor}` : undefined }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {labelColor ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: labelColor }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onOpen(id)}
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[var(--foreground)]"
              aria-label={`${title} 문서 열기`}
            >
              {title}
            </button>
          </div>
          <span className="shrink-0 text-xs text-[var(--muted)]">{STATUS_LABEL[status] ?? status}</span>
        </div>
        <div className="flex items-start gap-2">
          {editing ? (
            <textarea
              autoFocus
              rows={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleBlur}
              className="input-apple h-32 w-full resize-none px-2 py-1.5 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(synopsis ?? '')
                setEditing(true)
              }}
              className="h-32 w-full overflow-auto text-left text-sm text-[var(--muted)]"
            >
              {synopsis?.trim() ? synopsis : '시놉시스를 입력하세요'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
