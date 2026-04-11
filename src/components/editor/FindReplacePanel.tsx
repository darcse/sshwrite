'use client'

import type { Editor } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'
import {
  SearchQuery,
  findNext as pmFindNext,
  findPrev as pmFindPrev,
  getSearchState,
  replaceAll as pmReplaceAll,
  replaceCurrent as pmReplaceCurrent,
  setSearchState,
} from 'prosemirror-search'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

function countMatches(state: EditorState, query: SearchQuery) {
  if (!query.valid) return 0
  const range = getSearchState(state)?.range
  const from = range?.from ?? 0
  const to = range?.to ?? state.doc.content.size
  let n = 0
  let pos = from
  for (;;) {
    const m = query.findNext(state, pos, to)
    if (!m) break
    n++
    pos = m.to
  }
  return n
}

function activeMatchIndex(state: EditorState, query: SearchQuery) {
  if (!query.valid) return 0
  const range = getSearchState(state)?.range
  const from = range?.from ?? 0
  const to = range?.to ?? state.doc.content.size
  const sf = state.selection.from
  const st = state.selection.to
  let idx = 0
  let pos = from
  for (;;) {
    const m = query.findNext(state, pos, to)
    if (!m) break
    idx++
    if (m.from === sf && m.to === st) return idx
    pos = m.to
  }
  return 0
}

type FindReplacePanelProps = {
  editor: Editor | null
  open: boolean
  onClose: () => void
}

export function FindReplacePanel({ editor, open, onClose }: FindReplacePanelProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [stats, setStats] = useState({ current: 0, total: 0 })
  const findInputRef = useRef<HTMLInputElement>(null)

  const refreshStats = useCallback(() => {
    if (!editor) {
      setStats({ current: 0, total: 0 })
      return
    }
    const st = getSearchState(editor.state)
    const q = st?.query
    if (!q) {
      setStats({ current: 0, total: 0 })
      return
    }
    const total = countMatches(editor.state, q)
    const current = activeMatchIndex(editor.state, q)
    setStats({ current, total })
  }, [editor])

  useEffect(() => {
    if (!editor || !open) return
    const q = new SearchQuery({
      search: findText,
      replace: replaceText,
      literal: true,
    })
    const tr = setSearchState(editor.state.tr, q, null)
    editor.view.dispatch(tr)
    refreshStats()
  }, [editor, open, findText, replaceText, refreshStats])

  useEffect(() => {
    if (!editor || open) return
    const tr = setSearchState(editor.state.tr, new SearchQuery({ search: '' }), null)
    editor.view.dispatch(tr)
  }, [editor, open])

  useEffect(() => {
    if (!editor || !open) return
    const onTx = () => refreshStats()
    editor.on('transaction', onTx)
    return () => {
      editor.off('transaction', onTx)
    }
  }, [editor, open, refreshStats])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => findInputRef.current?.focus())
  }, [open])

  function handleFindNext() {
    if (!editor || !findText.trim()) return
    pmFindNext(editor.state, editor.view.dispatch)
    requestAnimationFrame(() => refreshStats())
  }

  function handleFindPrev() {
    if (!editor || !findText.trim()) return
    pmFindPrev(editor.state, editor.view.dispatch)
    requestAnimationFrame(() => refreshStats())
  }

  function handleReplaceCurrent() {
    if (!editor || !findText.trim()) return
    pmReplaceCurrent(editor.state, editor.view.dispatch)
    requestAnimationFrame(() => refreshStats())
  }

  function handleReplaceAll() {
    if (!editor || !findText.trim()) return
    pmReplaceAll(editor.state, editor.view.dispatch)
    requestAnimationFrame(() => refreshStats())
  }

  if (!open || !editor) return null

  const btnClass =
    'min-h-[44px] flex-1 rounded-md px-3 text-sm font-semibold text-[var(--foreground)] transition-opacity disabled:opacity-40'

  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-[350] w-[min(calc(100vw-1.5rem),24rem)] max-w-[calc(100vw-1.5rem)] rounded-xl border p-4 shadow-xl"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--card-bg)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[var(--foreground)]">찾기 및 바꾸기</span>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--badge-bg)] hover:text-[var(--foreground)]"
          aria-label="닫기"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="mb-3 text-xs leading-snug text-[var(--muted)]">
        Ctrl+H로 열고 닫습니다. 브라우저 본문 찾기(Ctrl+F 또는 ⌘F)와는 다른 창입니다.
      </p>
      <label className="mb-3 flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--foreground)]">찾기</span>
        <input
          ref={findInputRef}
          type="text"
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          className="input-apple w-full rounded-md px-3 py-2.5 text-base"
        />
      </label>
      <label className="mb-3 flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--foreground)]">바꾸기</span>
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          className="input-apple w-full rounded-md px-3 py-2.5 text-base"
        />
      </label>
      <p className="mb-3 text-sm tabular-nums text-[var(--foreground)]">
        {stats.total > 0
          ? `${stats.current} / ${stats.total} 일치`
          : findText.trim()
            ? '0 / 0 일치'
            : '검색어를 입력하세요'}
      </p>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={handleFindPrev}
          disabled={!findText.trim()}
          className={btnClass}
          style={{ backgroundColor: 'var(--badge-bg)' }}
        >
          이전 찾기
        </button>
        <button
          type="button"
          onClick={handleFindNext}
          disabled={!findText.trim()}
          className={btnClass}
          style={{ backgroundColor: 'var(--badge-bg)' }}
        >
          다음 찾기
        </button>
      </div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={handleReplaceCurrent}
          disabled={!findText.trim()}
          className={btnClass}
          style={{ backgroundColor: 'var(--badge-bg)' }}
        >
          바꾸기
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={!findText.trim()}
          className={btnClass}
          style={{ backgroundColor: 'var(--badge-bg)' }}
        >
          전체 바꾸기
        </button>
      </div>
    </div>
  )
}
