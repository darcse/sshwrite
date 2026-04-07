'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { textblockTypeInputRule } from '@tiptap/core'
import { Heading } from '@tiptap/extension-heading'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'
import { useBinderContext } from '@/components/binder/BinderTree'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

function countWords(text: string) {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

function normalizeContent(raw: unknown) {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'type' in raw &&
    (raw as { type: string }).type === 'doc'
  ) {
    return raw as Record<string, unknown>
  }
  return { type: 'doc', content: [] }
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const MarkdownHeading = Heading.extend({
  addInputRules() {
    return this.options.levels.map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^${'#'.repeat(level)}\\s$`),
        type: this.type,
        getAttributes: { level },
      })
    )
  },
})

export function Editor({
  documentId,
  initialContent,
  focusMode,
  onFocusModeChange,
}: {
  documentId: string
  initialContent: unknown
  focusMode: boolean
  onFocusModeChange: (v: boolean) => void
}) {
  const { refresh } = useBinderContext()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [wordCount, setWordCount] = useState(0)
  const [targetWords, setTargetWords] = useState<number | null>(null)
  const [inspectorMount, setInspectorMount] = useState<HTMLElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPersistedJson = useRef<string>('')
  const documentIdRef = useRef(documentId)
  const editorRef = useRef<TiptapEditor | null>(null)

  useEffect(() => {
    documentIdRef.current = documentId
  }, [documentId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sshwrite:word-goal:${documentId}`)
      if (raw === null) {
        setTargetWords(null)
        return
      }
      const n = parseInt(raw, 10)
      setTargetWords(Number.isFinite(n) && n > 0 ? n : null)
    } catch {
      setTargetWords(null)
    }
  }, [documentId])

  const persistTargetWords = useCallback((n: number | null) => {
    setTargetWords(n)
    try {
      if (n === null) {
        localStorage.removeItem(`sshwrite:word-goal:${documentId}`)
      } else {
        localStorage.setItem(`sshwrite:word-goal:${documentId}`, String(n))
      }
    } catch {}
  }, [documentId])

  const flushSave = useCallback(async () => {
    const id = documentIdRef.current
    const ed = editorRef.current
    if (!ed) return
    const json = ed.getJSON()
    const serialized = JSON.stringify(json)
    if (serialized === lastPersistedJson.current) return
    setSaveStatus('saving')
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) {
        setSaveStatus('error')
        return
      }
      const { error } = await supabase
        .from('write_documents')
        .update({ content: json })
        .eq('id', id)
        .eq('user_id', userId)
      if (error) {
        setSaveStatus('error')
        return
      }
      lastPersistedJson.current = serialized
      setSaveStatus('saved')
      await refresh()
      if (savedClearRef.current) clearTimeout(savedClearRef.current)
      savedClearRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [refresh])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
        }),
        MarkdownHeading.configure({ levels: [1, 2, 3] }),
      ],
      content: normalizeContent(initialContent),
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class:
            'font-writing w-full outline-none',
        },
      },
    },
    [documentId]
  )

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    lastPersistedJson.current = JSON.stringify(editor.getJSON())
    setSaveStatus('idle')
  }, [editor, documentId])

  useEffect(() => {
    if (!editor) return
    const update = () => {
      setWordCount(countWords(editor.getText()))
    }
    update()
    editor.on('update', update)
    editor.on('transaction', update)
    return () => {
      editor.off('update', update)
      editor.off('transaction', update)
    }
  }, [editor])

  useEffect(() => {
    if (!focusMode) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFocusModeChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode, onFocusModeChange])

  useEffect(() => {
    if (!focusMode) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [focusMode])

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        void flushSave()
      }, 1500)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [editor, flushSave])

  useEffect(() => {
    return () => {
      if (savedClearRef.current) clearTimeout(savedClearRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    const host = document.querySelector(
      'aside[data-panel="inspector"] > div:last-child'
    ) as HTMLElement | null
    if (!host) return
    const el = document.createElement('div')
    host.appendChild(el)
    setInspectorMount(el)
    return () => {
      setInspectorMount(null)
      if (el.parentNode === host) {
        host.removeChild(el)
      }
    }
  }, [])

  const onGoalInput = useCallback((raw: string) => {
    const t = raw.trim()
    if (t === '') {
      persistTargetWords(null)
      return
    }
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n <= 0) {
      persistTargetWords(null)
      return
    }
    persistTargetWords(n)
  }, [persistTargetWords])

  const progressPct =
    targetWords != null && targetWords > 0
      ? Math.min(100, (wordCount / targetWords) * 100)
      : null
  const overTarget = targetWords != null && targetWords > 0 && wordCount > targetWords

  return (
    <div
      className={
        focusMode
          ? 'fixed bottom-0 left-0 right-0 top-14 z-[300] flex min-h-0 flex-col overflow-hidden bg-[var(--background)]'
          : 'flex min-h-0 flex-1 flex-col'
      }
      style={{ backgroundColor: 'var(--background)' }}
    >
      <style>{`.ProseMirror { outline: none !important; border: none !important; }`}</style>
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={{
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
        }}
      >
        <div className="w-full h-full" style={{ 
  paddingLeft: 0, 
  paddingRight: 0,
  backgroundColor: 'var(--card-bg)',
  boxShadow: 'var(--shadow)',
}}>
  <EditorToolbar editor={editor} />
  <div
    style={{
      padding: '16px 8px',
      fontFamily: 'var(--font-writing)',
      lineHeight: 1.8,
      fontSize: 16,
      outline: 'none',
    }}
  >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      {inspectorMount
        ? createPortal(
            <div
              className="mb-4 border-b pb-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--muted)]">목표 단어 수</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={targetWords ?? ''}
                  placeholder="미설정"
                  onChange={(e) => onGoalInput(e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm text-[var(--foreground)] outline-none"
                />
              </label>
              <div className="mt-3 flex items-baseline justify-between gap-2 text-xs text-[var(--muted)]">
                <span style={{ color: overTarget ? '#ff3b30' : 'var(--foreground)' }}>
                  {wordCount}
                  {targetWords != null && targetWords > 0 ? ` / ${targetWords}` : ''}{' '}
                  단어
                </span>
              </div>
              {progressPct != null ? (
                <div
                  className="mt-2 h-1 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--badge-bg)' }}
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: overTarget ? '#ff3b30' : 'var(--accent)',
                    }}
                  />
                </div>
              ) : null}
            </div>,
            inspectorMount
          )
        : null}
    </div>
  )
}
