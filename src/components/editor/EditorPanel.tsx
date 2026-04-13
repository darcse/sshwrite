'use client'

import { Corkboard } from '@/components/corkboard/Corkboard'
import { Editor } from '@/components/editor/Editor'
import { CompileModal } from '@/components/editor/CompileModal'
import { ReadingMode } from '@/components/editor/ReadingMode'
import { PomodoroTimer } from '@/components/ui/PomodoroTimer'
import { useBinderContext } from '@/components/binder/BinderTree'
import {
  AlignVerticalJustifyCenter,
  BookOpen,
  Expand,
  FileOutput,
  Search,
  Shrink,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function EditorPanel({ showInspectorMeta }: { showInspectorMeta: boolean }) {
  const { documents, labels, selectedDocId, updateDocument, navigateToDoc } = useBinderContext()
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  const [focusMode, setFocusMode] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false)
  const [compileOpen, setCompileOpen] = useState(false)
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [typewriterScroll, setTypewriterScroll] = useState(false)
  const editorScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setTypewriterScroll(localStorage.getItem('sshwrite:typewriter-scroll') === 'true')
    } catch {}
  }, [])

  const toggleTypewriter = useCallback(() => {
    setTypewriterScroll((v) => {
      const next = !v
      try { localStorage.setItem('sshwrite:typewriter-scroll', String(next)) } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    if (!typewriterScroll) return
    requestAnimationFrame(() => {
      document.dispatchEvent(new Event('typewriter-activate'))
    })
  }, [typewriterScroll])

  useEffect(() => {
    setFindReplaceOpen(false)
  }, [selectedDocId])

  return (
    <>
      <CompileModal open={compileOpen} onClose={() => setCompileOpen(false)} />
      <ReadingMode open={readingOpen} onClose={() => setReadingOpen(false)} />
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-12 min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm font-medium text-[var(--foreground)]">
        <span className="min-w-0 flex-1 truncate">{doc ? doc.title : '문서를 선택하세요'}</span>
        <div className="flex items-center gap-1">
          {doc?.type === 'document' ? (
            <button
              type="button"
              className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              onClick={() => setFindReplaceOpen((v) => !v)}
              aria-label="찾기 및 바꾸기"
              title="찾기 및 바꾸기 (Ctrl+H)"
            >
              <Search className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <PomodoroTimer />
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={() => setCompileOpen(true)}
            aria-label="컴파일"
            title="컴파일"
          >
            <FileOutput className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={() => setReadingOpen(true)}
            aria-label="읽기 모드"
            title="읽기 모드"
          >
            <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="shrink-0 rounded p-1 transition-colors hover:text-[var(--foreground)]"
            style={{ color: typewriterScroll ? 'var(--accent)' : 'var(--muted)' }}
            onClick={toggleTypewriter}
            aria-label="타자기 스크롤"
            title="타자기 스크롤"
          >
            <AlignVerticalJustifyCenter className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            onClick={() => setFocusMode((v) => !v)}
            aria-label={focusMode ? '포커스 해제' : '포커스 모드'}
            title={focusMode ? '포커스 해제' : '포커스 모드'}
          >
            {focusMode ? (
              <Shrink className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Expand className="h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </div>
      <div
        ref={editorScrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4"
        {...(typewriterScroll ? { 'data-typewriter-scroll': '' } : {})}
        style={{
          backgroundColor: 'var(--card-bg)',
        }}
      >
        {!doc ? (
          <p className="text-[var(--muted)]">문서를 선택하세요</p>
        ) : doc.type === 'folder' ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <Corkboard
              folderId={doc.id}
              documents={documents}
              labels={labels}
              onOpenDocument={navigateToDoc}
              onSaveSynopsis={async (id, synopsis) => {
                await updateDocument(id, { synopsis: synopsis || null })
              }}
            />
          </div>
        ) : (
          <div className="w-full shrink-0">
            <Editor
              key={doc.id}
              documentId={doc.id}
              initialContent={doc.content}
              createdAt={doc.created_at ?? null}
              updatedAt={doc.updated_at ?? null}
              showInspectorMeta={showInspectorMeta}
              focusMode={focusMode}
              onFocusModeChange={setFocusMode}
              findReplaceOpen={findReplaceOpen}
              onFindReplaceOpenChange={setFindReplaceOpen}
              typewriterScroll={typewriterScroll}
            />
          </div>
        )}
      </div>
      </div>
    </>
  )
}
