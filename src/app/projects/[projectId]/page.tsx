'use client'

import { BinderProvider, BinderTree, useBinderContext } from '@/components/binder/BinderTree'
import { Editor } from '@/components/editor/Editor'
import { FilePlus, FolderPlus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Suspense,
  type CSSProperties,
} from 'react'
import { useParams } from 'next/navigation'

const STORAGE_KEY = 'sshwrite:editor-layout'

type StoredLayout = {
  binderWidth: number
  inspectorWidth: number
  binderCollapsed: boolean
}

const DEFAULT_BINDER = 260
const DEFAULT_INSPECTOR = 280
const MIN_PANEL = 160
const MIN_EDITOR = 200
const SPLITTER_PX = 6
const COLLAPSE_RAIL_PX = 28

function BinderPanelToggleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="8" y="2" width="6" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

function loadStored(projectId: string): StoredLayout | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredLayout>
    if (
      typeof p.binderWidth !== 'number' ||
      typeof p.inspectorWidth !== 'number' ||
      typeof p.binderCollapsed !== 'boolean'
    ) {
      return null
    }
    return {
      binderWidth: p.binderWidth,
      inspectorWidth: p.inspectorWidth,
      binderCollapsed: p.binderCollapsed,
    }
  } catch {
    return null
  }
}

function saveStored(projectId: string, layout: StoredLayout) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${projectId}`, JSON.stringify(layout))
  } catch {}
}

function clampBinder(next: number, containerW: number, inspectorW: number) {
  const max = containerW - inspectorW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

function clampInspector(next: number, containerW: number, binderW: number) {
  const max = containerW - binderW - SPLITTER_PX * 2 - MIN_EDITOR
  return Math.min(Math.max(MIN_PANEL, next), Math.max(MIN_PANEL, max))
}

function BinderHeaderBar({ onCollapse }: { onCollapse: () => void }) {
  const { createDocument, createFolder, loading } = useBinderContext()
  const [pending, setPending] = useState(false)
  const busy = loading || pending

  async function run(fn: () => Promise<void>) {
    setPending(true)
    try {
      await fn()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card-bg)] px-2">
      <span className="text-sm font-medium text-[var(--foreground)]">바인더</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => run(createDocument)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 문서"
        >
          <FilePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => run(createFolder)}
          disabled={busy}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
          title="새 폴더"
        >
          <FolderPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          aria-expanded
          aria-controls="binder-panel"
          title="바인더 접기"
        >
          <BinderPanelToggleIcon />
        </button>
      </div>
    </div>
  )
}

function EditorPanel() {
  const { documents, selectedDocId } = useBinderContext()
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined
  return (
    <>
      <div className="flex h-12 min-w-0 shrink-0 items-center border-b border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm font-medium text-[var(--foreground)]">
        <span className="truncate">{doc ? doc.title : '문서를 선택하세요'}</span>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-4"
        style={{
          backgroundColor: 'var(--card-bg)',
        }}
      >
        {!doc ? (
          <p className="text-[var(--muted)]">문서를 선택하세요</p>
        ) : doc.type === 'folder' ? (
          <p className="text-[var(--muted)]">
            폴더는 여기에 본문이 없습니다. 문서를 선택하세요.
          </p>
        ) : (
          <Editor
            key={doc.id}
            documentId={doc.id}
            initialContent={doc.content}
          />
        )}
      </div>
    </>
  )
}

function InspectorPanel() {
  const { documents, labels, selectedDocId, updateDocument, loading } =
    useBinderContext()
  const [saving, setSaving] = useState(false)
  const doc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : undefined

  async function patch(p: Parameters<typeof updateDocument>[1]) {
    if (!doc) return
    setSaving(true)
    await updateDocument(doc.id, p)
    setSaving(false)
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
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">상태</span>
        <select
          value={doc.status}
          disabled={saving}
          onChange={(e) => patch({ status: e.target.value })}
          className="rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-[var(--foreground)]"
        >
          <option value="todo">할 일</option>
          <option value="writing">작성 중</option>
          <option value="done">완료</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">라벨</span>
        <select
          value={doc.label ?? ''}
          disabled={saving}
          onChange={(e) =>
            patch({ label: e.target.value ? e.target.value : null })
          }
          className="rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5 text-[var(--foreground)]"
        >
          <option value="">없음</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {saving ? <p className="text-xs text-[var(--muted)]">저장 중…</p> : null}
    </div>
  )
}

function ProjectWorkspace({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<StoredLayout>({
    binderWidth: DEFAULT_BINDER,
    inspectorWidth: DEFAULT_INSPECTOR,
    binderCollapsed: false,
  })

  const [binderWidth, setBinderWidth] = useState(DEFAULT_BINDER)
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR)
  const [binderCollapsed, setBinderCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [desktop, setDesktop] = useState(false)

  const dragKind = useRef<'binder' | 'inspector' | null>(null)
  const dragStartX = useRef(0)
  const dragStartBinder = useRef(0)
  const dragStartInspector = useRef(0)

  useLayoutEffect(() => {
    const s = loadStored(projectId)
    if (s) {
      layoutRef.current = s
      setBinderWidth(s.binderWidth)
      setInspectorWidth(s.inspectorWidth)
      setBinderCollapsed(s.binderCollapsed)
    } else {
      layoutRef.current = {
        binderWidth: DEFAULT_BINDER,
        inspectorWidth: DEFAULT_INSPECTOR,
        binderCollapsed: false,
      }
    }
    setHydrated(true)
  }, [projectId])

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    function update() {
      setDesktop(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    layoutRef.current = {
      binderWidth,
      inspectorWidth,
      binderCollapsed,
    }
  }, [binderWidth, inspectorWidth, binderCollapsed])

  useEffect(() => {
    if (!hydrated) return
    saveStored(projectId, layoutRef.current)
  }, [projectId, binderCollapsed, hydrated])

  const persistWidths = useCallback(() => {
    saveStored(projectId, layoutRef.current)
  }, [projectId])

  useEffect(() => {
    if (!hydrated || !desktop) return

    function onMove(e: MouseEvent) {
      const el = containerRef.current
      if (!el || !dragKind.current) return
      const width = el.getBoundingClientRect().width
      if (width <= 0) return

      if (dragKind.current === 'binder') {
        const delta = e.clientX - dragStartX.current
        const next = dragStartBinder.current + delta
        const b = clampBinder(next, width, layoutRef.current.inspectorWidth)
        setBinderWidth(b)
        layoutRef.current = {
          ...layoutRef.current,
          binderWidth: b,
        }
      } else {
        const delta = e.clientX - dragStartX.current
        const next = dragStartInspector.current + delta
        const i = clampInspector(next, width, layoutRef.current.binderWidth)
        setInspectorWidth(i)
        layoutRef.current = {
          ...layoutRef.current,
          inspectorWidth: i,
        }
      }
    }

    function onUp() {
      if (dragKind.current) {
        dragKind.current = null
        persistWidths()
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [hydrated, desktop, persistWidths])

  function startDragBinder(e: React.MouseEvent) {
    if (binderCollapsed || !desktop) return
    e.preventDefault()
    dragKind.current = 'binder'
    dragStartX.current = e.clientX
    dragStartBinder.current = binderWidth
  }

  function startDragInspector(e: React.MouseEvent) {
    if (!desktop) return
    e.preventDefault()
    dragKind.current = 'inspector'
    dragStartX.current = e.clientX
    dragStartInspector.current = inspectorWidth
  }

  function toggleBinder() {
    setBinderCollapsed((c) => !c)
  }

  const binderColumnStyle: CSSProperties = desktop
    ? {
        width: binderCollapsed ? COLLAPSE_RAIL_PX : binderWidth,
        minWidth: binderCollapsed ? COLLAPSE_RAIL_PX : MIN_PANEL,
        maxWidth: binderCollapsed ? COLLAPSE_RAIL_PX : undefined,
      }
    : {
        width: '100%',
        maxHeight: '30vh',
      }

  const inspectorStyle: CSSProperties = desktop
    ? {
        width: inspectorWidth,
        minWidth: MIN_PANEL,
      }
    : {
        width: '100%',
        maxHeight: '28vh',
      }

  return (
    <BinderProvider projectId={projectId}>
        <div
          ref={containerRef}
          className="flex min-h-0 w-full flex-1 flex-col border-t border-[var(--border)] bg-[var(--background)] md:h-[calc(100dvh-3.5rem)] md:flex-row md:overflow-hidden"
        >
        <div
          className="flex min-h-0 shrink-0 flex-col border-b border-[var(--border)] bg-[var(--card-bg)] transition-[width] duration-200 ease-out md:h-full md:border-b-0 md:border-r"
          style={binderColumnStyle}
          data-panel="binder"
        >
          {desktop && binderCollapsed ? (
            <div className="flex w-full flex-col items-stretch">
              <button
                type="button"
                onClick={toggleBinder}
                className="sticky top-0 z-10 flex h-12 w-7 shrink-0 items-center justify-center border-r border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                aria-expanded={false}
                aria-controls="binder-panel"
                title="바인더 펼치기"
              >
                <BinderPanelToggleIcon />
              </button>
            </div>
          ) : binderCollapsed && !desktop ? (
            <div className="flex h-full min-h-[2.5rem] w-full flex-row items-stretch">
              <button
                type="button"
                onClick={toggleBinder}
                className="flex flex-1 items-center justify-center border-r border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                aria-expanded={false}
                aria-controls="binder-panel"
                title="바인더 펼치기"
              >
                <BinderPanelToggleIcon />
              </button>
            </div>
          ) : (
            <div
              id="binder-panel"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <BinderHeaderBar onCollapse={toggleBinder} />
              <BinderTree />
            </div>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          className={
            binderCollapsed
              ? 'hidden'
              : 'hidden cursor-col-resize md:block md:shrink-0'
          }
          style={{
            width: SPLITTER_PX,
            backgroundColor: 'var(--border)',
          }}
          onMouseDown={startDragBinder}
        />

        <main
          className="flex min-h-[40vh] min-w-0 flex-1 flex-col overflow-hidden border-b border-[var(--border)] md:min-h-0 md:border-b-0"
          data-panel="editor"
        >
          <EditorPanel />
        </main>

        <div
          role="separator"
          aria-orientation="vertical"
          className="hidden shrink-0 cursor-col-resize md:block"
          style={{
            width: SPLITTER_PX,
            backgroundColor: 'var(--border)',
          }}
          onMouseDown={startDragInspector}
        />

        <aside
          className="flex min-h-0 shrink-0 flex-col border-t border-[var(--border)] bg-[var(--card-bg)] md:h-full md:border-t-0 md:border-l"
          style={{
            ...inspectorStyle,
            borderColor: 'var(--border)',
          }}
          data-panel="inspector"
        >
          <div className="flex h-12 shrink-0 items-center border-b border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)]">
            인스펙터
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-[var(--muted)]">
            <InspectorPanel />
          </div>
        </aside>
      </div>
    </BinderProvider>
  )
}

function ProjectPageInner() {
  const params = useParams()
  const projectId = params.projectId as string
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectWorkspace projectId={projectId} />
    </div>
  )
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--muted)]">
          불러오는 중…
        </div>
      }
    >
      <ProjectPageInner />
    </Suspense>
  )
}
