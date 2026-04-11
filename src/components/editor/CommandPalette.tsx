'use client'

import { useBinderContext } from '@/components/binder/BinderTree'
import { createClient } from '@/lib/supabase/client'
import { tiptapToPlainText } from '@/lib/doc-utils'
import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Row = { id: string; title: string; content: unknown }

function previewText(content: unknown) {
  const plain = tiptapToPlainText(content)
  if (plain.length <= 80) return plain
  return `${plain.slice(0, 80)}…`
}

type CommandPaletteProps = {
  projectId: string
  open: boolean
  onClose: () => void
}

export function CommandPalette({ projectId, open, onClose }: CommandPaletteProps) {
  const { navigateToDoc } = useBinderContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebouncedQuery('')
    setResults([])
    setSelectedIndex(0)
    setLoading(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(t)
  }, [query, open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  useEffect(() => {
    if (!open) return
    const q = debouncedQuery.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!alive) return
      if (!user) {
        setLoading(false)
        setResults([])
        return
      }
      const { data, error } = await supabase
        .from('write_documents')
        .select('id, title, content')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('type', 'document')
        .textSearch('search_vector', q, { config: 'simple' })
        .limit(10)
      if (!alive) return
      setLoading(false)
      if (error) {
        console.error(error)
        setResults([])
        return
      }
      setResults((data ?? []) as Row[])
    })()
    return () => {
      alive = false
    }
  }, [open, debouncedQuery, projectId])

  function pick(id: string) {
    navigateToDoc(id)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        if (results.length === 0) return
        e.preventDefault()
        setSelectedIndex((i) => Math.min(results.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        if (results.length === 0) return
        e.preventDefault()
        setSelectedIndex((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        const row = results[selectedIndex]
        if (!row) return
        e.preventDefault()
        navigateToDoc(row.id)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, navigateToDoc, onClose, results, selectedIndex])

  if (!open) return null

  const showNoResults =
    debouncedQuery.trim().length >= 2 && !loading && results.length === 0

  return (
    <div
      className="modal-overlay-apple fixed inset-0 z-[460] flex items-start justify-center p-4 pt-20 md:pt-24"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel-apple w-full max-w-xl overflow-hidden p-0 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 id="command-palette-title" className="sr-only">
            문서 검색
          </h2>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="문서 검색…"
              className="input-apple w-full rounded-md py-2.5 pl-3 pr-9 text-base"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {query.length > 0 ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
                aria-label="검색어 지우기"
                onClick={() => {
                  setQuery('')
                  requestAnimationFrame(() => inputRef.current?.focus())
                }}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <div className="max-h-[min(50vh,22rem)] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              검색 중…
            </div>
          ) : showNoResults ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">결과 없음</p>
          ) : results.length > 0 ? (
            <ul className="flex flex-col gap-0.5 p-0" role="listbox">
              {results.map((row, i) => (
                <li key={row.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === selectedIndex}
                    onClick={() => pick(row.id)}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                    style={{
                      backgroundColor:
                        i === selectedIndex ? 'var(--badge-bg)' : 'transparent',
                      color: 'var(--foreground)',
                    }}
                  >
                    <span className="block font-semibold">{row.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--muted)]">
                      {previewText(row.content)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
