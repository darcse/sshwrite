'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { textblockTypeInputRule } from '@tiptap/core'
import { Heading } from '@tiptap/extension-heading'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'
import { useBinderContext } from '@/components/binder/BinderTree'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { EditorStats } from '@/components/editor/EditorStats'
import { useEffect, useRef, useState, useCallback } from 'react'

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
}: {
  documentId: string
  initialContent: unknown
}) {
  const { refresh } = useBinderContext()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [wordCount, setWordCount] = useState(0)
  const [targetWords, setTargetWords] = useState<number | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPersistedJson = useRef<string>('')
  const documentIdRef = useRef(documentId)
  const editorRef = useRef<TiptapEditor | null>(null)

  documentIdRef.current = documentId

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
            'font-writing min-h-[240px] w-full max-w-none outline-none px-1 py-2',
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
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

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

  return (
    <div
      className={
        focusMode
          ? 'fixed bottom-0 left-0 right-0 top-14 z-[300] flex min-h-0 flex-col overflow-hidden bg-[var(--background)] px-4 pb-4 pt-2'
          : 'flex min-h-0 flex-1 flex-col'
      }
      style={
        focusMode
          ? { boxShadow: 'inset 0 1px 0 0 var(--border)' }
          : undefined
      }
    >
      <EditorToolbar editor={editor} />
      <div
        className="min-h-0 flex-1 overflow-auto rounded-lg border px-2 py-1"
        style={{
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--card-bg)',
          color: 'var(--foreground)',
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <EditorStats
        wordCount={wordCount}
        targetWords={targetWords}
        onTargetWordsChange={persistTargetWords}
        saveStatus={saveStatus}
        focusMode={focusMode}
        onFocusModeChange={setFocusMode}
      />
    </div>
  )
}
